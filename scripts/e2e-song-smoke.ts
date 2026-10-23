// E2E song-detection smoke: virtualize the MIC with a real song and prove
// the whole chain — page-side getUserMedia mock → app audio engine →
// rolling PCM capture → song-change detector → identifyNowPlaying (the
// REAL main-process Shazam path, Node-side via page.exposeFunction) →
// matched title surfaced in the UI. Only the mic hardware and the Electron
// IPC transport are virtualized; every line of app code in between runs.
//
// Usage:
//   ts-node --transpile-only scripts/e2e-song-smoke.ts <song-file> [--expect "Title"] [--song2 <file>]
//   --expect asserts the recognized title contains the given substring.
//   --song2 plays a second song after the auto-detect duck, giving the
//   song-change detector a real song change to catch (the same song returning
//   after silence is spectrally identical to it).
//
// The song is sliced to 90s by ffmpeg and looped into the synthetic mic
// stream; a silence→music onset gives the song-change detector a real
// transition to detect. If auto-detection doesn't fire within AUTO_DETECT_MS
// the manual "live test" button is clicked as a fallback (same pipeline).
import fs from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';
import { execFileSync } from 'child_process';
import puppeteer from 'puppeteer';
import { identifyNowPlaying } from '../src/main/nowPlayingLookup';

const songFile = process.argv[2];
const expectIdx = process.argv.indexOf('--expect');
const expectSubstr = expectIdx !== -1 ? process.argv[expectIdx + 1] : null;
// --song2 <file>: a SECOND song played after the duck's silence. The
// song-change detector compares normalized spectra, so the same song coming
// back after silence is not a "change" — a real song change is. When given,
// the auto path should detect the song1→song2 transition and the lookup
// should match song2 (the capture window holds mostly the new track).
const song2Idx = process.argv.indexOf('--song2');
const song2File = song2Idx !== -1 ? process.argv[song2Idx + 1] : null;
// Serve dist over http (not file://): the song-detection PCM worklet loads
// from a blob: URL, and Chromium blocks blob:null module fetches on the
// opaque file:// origin — headless-only artifact; Electron loads it fine.
const DIST_DIR = path.resolve(__dirname, '../dist/renderer');
// The song-change detector suppresses lookups until minTrackMs (30s) of
// track has elapsed, then needs ~2 confirm windows (~5s) of sustained
// change after the onset. Duck only after the gate opens, then give the
// detector a full window to confirm.
const DUCK_AFTER_MS = 35000;
const AUTO_DETECT_MS = 30000;
const CLIP_SEC = 90;

if (!songFile || !fs.existsSync(songFile)) {
  console.error('Usage: ts-node --transpile-only scripts/e2e-song-smoke.ts <song-file> [--expect "Title"] [--song2 <file>]');
  process.exit(1);
}

const main = async () => {
  // ── slice the song to keep the page-side base64 payload small; if ffmpeg
  //    can't decode it, pass the original file through ──
  let songBase64: string;
  const tmp = path.join(os.tmpdir(), `vs-song-smoke-${process.pid}.m4a`);
  try {
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-t', String(CLIP_SEC),
      '-i', songFile, '-c:a', 'aac', '-b:a', '128k', tmp], { stdio: 'ignore' });
    songBase64 = fs.readFileSync(tmp).toString('base64');
    fs.unlinkSync(tmp);
  } catch {
    songBase64 = fs.readFileSync(songFile).toString('base64');
    console.log(`[e2e] ffmpeg slice failed — using original file (${Math.round(songBase64.length / 1024)}KB base64)`);
  }
  console.log(`[e2e] song: ${songFile} (${Math.round(songBase64.length / 1024)}KB base64)`);
  let song2Base64: string | null = null;
  if (song2File) {
    if (!fs.existsSync(song2File)) {
      console.error(`--song2 file not found: ${song2File}`);
      process.exit(1);
    }
    const tmp2 = path.join(os.tmpdir(), `vs-song-smoke2-${process.pid}.m4a`);
    try {
      execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-t', String(CLIP_SEC),
        '-i', song2File, '-c:a', 'aac', '-b:a', '128k', tmp2], { stdio: 'ignore' });
      song2Base64 = fs.readFileSync(tmp2).toString('base64');
      fs.unlinkSync(tmp2);
    } catch {
      song2Base64 = fs.readFileSync(song2File).toString('base64');
    }
    console.log(`[e2e] song2 (after song change): ${song2File} (${Math.round(song2Base64.length / 1024)}KB base64)`);
  }

  // Same launch args as the batch tester: without the autoplay flag headless
  // Chrome blocks AudioContext.resume()/getUserMedia and app init hangs at
  // "[Song Detection] State: initializing".
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url?.split('?')[0] ?? '/');
    // Chromium always requests /favicon.ico; a 404 there surfaces as a console
    // error. Serve an empty icon so console cleanliness is about real assets.
    if (urlPath === '/favicon.ico') {
      res.writeHead(200, { 'Content-Type': 'image/x-icon' });
      res.end();
      return;
    }
    let file = path.join(DIST_DIR, urlPath === '/' ? 'index.html' : urlPath);
    if (!file.startsWith(DIST_DIR)) file = path.join(DIST_DIR, 'index.html');
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      const ext = path.extname(file);
      const type = ext === '.html' ? 'text/html' : ext === '.js' ? 'text/javascript'
        : ext === '.css' ? 'text/css' : 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type });
      res.end(data);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as { port: number }).port;
  console.log(`[e2e] serving dist on http://127.0.0.1:${port}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--autoplay-policy=no-user-gesture-required',
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream'
    ]
  });
  const page = await browser.newPage();
  const consoleErrors: string[] = [];
  const stateLogs: string[] = [];
  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error') consoleErrors.push(text.slice(0, 200));
    if (text.includes('[Song Detection]') || text.includes('[Now Playing')) stateLogs.push(text.slice(0, 200));
  });
  page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${String(err).slice(0, 200)}`));
  // 404s log as a bare "Failed to load resource" console error — record the
  // URL so missing dist assets are fixable rather than whitelisted blind.
  page.on('response', (res) => {
    if (res.status() >= 400) consoleErrors.push(`HTTP ${res.status()}: ${res.url()}`);
  });

  // The REAL main-process lookup, callable from the page.
  const identifyCalls: Array<{ numSamples?: number; matched?: boolean; title?: string; artist?: string; error?: string }> = [];
  await page.exposeFunction('__vsIdentifyNowPlaying', async (req: any) => {
    // dump the mic-captured PCM for offline dissection (--keep-pcm)
    if (process.argv.includes('--keep-pcm')) {
      const out = path.join(os.tmpdir(), `vs-e2e-pcm-${process.pid}.s16`);
      fs.writeFileSync(out, Buffer.from(req.audioBase64, 'base64'));
      console.log(`[e2e] dumped PCM to ${out} (${req.numSamples} samples)`);
    }
    let result = await identifyNowPlaying(req);
    // DIAGNOSTIC: if the first call fails, retry the identical request once
    // in-process — discriminates transient/edge rejection (retry succeeds)
    // from a payload the server rejects every time.
    if (!result.matched && result.error) {
      console.log('[e2e] first call failed — retrying identical request in-process');
      await new Promise((r) => setTimeout(r, 2000));
      result = await identifyNowPlaying(req);
      console.log(`[e2e] retry: matched=${result.matched}${result.error ? `, error=${String(result.error).slice(0, 80)}` : ''}`);
    }
    identifyCalls.push({
      numSamples: req.numSamples,
      matched: result.matched,
      title: result.title,
      artist: result.artist,
      error: result.error
    });
    console.log(`[e2e] identifyNowPlaying: numSamples=${req.numSamples}, matched=${result.matched}, title=${result.title ?? '—'}, artist=${result.artist ?? '—'}${result.error ? `, error=${String(result.error).slice(0, 80)}` : ''}`);
    return result;
  });

  await page.evaluateOnNewDocument((song: string, song2: string | null) => {
    (window.navigator as any).requestMIDIAccess = async () => ({
      inputs: new Map(), outputs: new Map(), onstatechange: null, sysexEnabled: false
    });
    if (window.navigator.mediaDevices) {
      window.navigator.mediaDevices.getUserMedia = async () => {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const destination = audioContext.createMediaStreamDestination();
        try {
          const binary = atob(song);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
          const buffer = await audioContext.decodeAudioData(bytes.buffer);
          if (audioContext.state === 'suspended') await audioContext.resume();
          let source = audioContext.createBufferSource();
          source.buffer = buffer;
          source.loop = true;
          // gentle fade-in so the song-change detector sees silence→music
          const gain = audioContext.createGain();
          gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
          gain.gain.exponentialRampToValueAtTime(1.0, audioContext.currentTime + 2);
          source.connect(gain).connect(destination);
          source.start();
          // Pre-decode the second song so the duck helper stays synchronous.
          let buffer2: AudioBuffer | null = null;
          if (song2) {
            try {
              const binary = atob(song2);
              const bytes = new Uint8Array(binary.length);
              for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
              buffer2 = await audioContext.decodeAudioData(bytes.buffer);
            } catch (e) {
              (window as any).__vsDuckDecodeError = String(e);
            }
          }
          // Duck helper for the auto-detect path. The detector compares
          // NORMALIZED spectra — the same section returning after silence has
          // distance ~0 — so after the 3s silence SWITCH to the second song
          // (or, without --song2, seek to a later section of the same clip)
          // to give the detector a genuine spectral change.
          (window as any).__vsDuckSong = () => {
            const ctx = audioContext;
            gain.gain.cancelScheduledValues(ctx.currentTime);
            gain.gain.setValueAtTime(0.0001, ctx.currentTime);
            gain.gain.setValueAtTime(0.0001, ctx.currentTime + 3);
            gain.gain.exponentialRampToValueAtTime(1.0, ctx.currentTime + 5);
            try {
              source.stop(ctx.currentTime + 3.05);
              const next = ctx.createBufferSource();
              next.buffer = buffer2 || buffer;
              next.loop = true;
              next.connect(gain);
              const seekTo = buffer2 ? 0 : Math.min(60, Math.max(0, buffer.duration - 1));
              next.start(ctx.currentTime + 3, seekTo);
              source = next;
            } catch (e) {
              (window as any).__vsDuckSeekError = String(e);
            }
            return true;
          };
          (window as any).__vsSongStreamActive = true;
        } catch (e) {
          (window as any).__vsSongStreamActive = false;
          (window as any).__vsSongStreamError = String(e);
        }
        return destination.stream;
      };
      (window.navigator.mediaDevices as any).enumerateDevices = async () => [
        { deviceId: 'default', kind: 'audioinput', label: 'Virtualized Song Source' }
      ];
    }
    window.visualSynth = {
      ...(window.visualSynth ?? {}),
      listPresets: async () => [],
      identifyNowPlaying: (req: any) => (window as any).__vsIdentifyNowPlaying(req),
      saveNowPlayingSettings: async (settings: any) => settings,
      cacheRemoteArtwork: async () => ({ cached: false }),
      enrichNowPlayingArtwork: async () => ({}),
      onCloseRequested: (cb: () => void) => { (window as any).__mockOnCloseRequested = cb; },
      showSaveDialog: async () => ({ result: 'cancel' }),
      saveProject: async () => ({ canceled: true }),
      saveProjectAs: async () => ({ canceled: true }),
      confirmClose: async () => {},
    } as any;
  }, songBase64, song2Base64);

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => Boolean((window as any).__visualSynthInitialized), { timeout: 120000 });

  const results: Array<[string, boolean, string]> = [];
  const check = (name: string, ok: boolean, detail: string) => {
    results.push([name, ok, detail]);
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
  };

  // 1. mic virtualized → app reaches listening (state logs are ground truth;
  //    the DOM state label only updates on status-render events)
  await new Promise((r) => setTimeout(r, 3000));
  const heardListening = stateLogs.some((l) => l.includes('State: listening (Audio input connected)'));
  check('song detection listening on virtualized mic', heardListening,
    heardListening ? 'state: listening' : `states seen: ${stateLogs.slice(-3).join(' | ') || 'none'}`);

  // 2. enable song detection through the REAL settings UI (as a user would):
  //    open the modal, tick enabled, pick the shazam provider, save.
  const configureResult = await page.evaluate(() => {
    const open = document.getElementById('now-playing-configure') as HTMLButtonElement | null;
    if (!open) return 'configure button missing';
    open.click();
    const enabled = document.getElementById('now-playing-enabled') as HTMLInputElement | null;
    const provider = document.getElementById('now-playing-provider') as HTMLSelectElement | null;
    const save = document.getElementById('now-playing-save') as HTMLButtonElement | null;
    if (!enabled || !provider || !save) return 'settings inputs missing';
    enabled.checked = true;
    enabled.dispatchEvent(new Event('change', { bubbles: true }));
    provider.value = 'shazam';
    provider.dispatchEvent(new Event('change', { bubbles: true }));
    save.click();
    return 'ok';
  });
  await new Promise((r) => setTimeout(r, 2000));
  const enabledLog = stateLogs.some((l) => l.includes('Song detection enabled'));
  check('song detection enabled via settings UI', configureResult === 'ok' && enabledLog,
    `configure=${configureResult}${enabledLog ? ', enabled log seen' : ''}`);

  // 3. auto path: duck the song to create a genuine silence→music onset,
  //    then wait for the song-change detector to fire a lookup. The detector
  //    gate (minTrackMs) stays closed for the first 30s of track, so don't
  //    duck before DUCK_AFTER_MS.
  let trigger = 'auto song-change detector';
  await new Promise((r) => setTimeout(r, DUCK_AFTER_MS));
  await page.evaluate(() => { (window as any).__vsDuckSong?.(); });
  // Open the settings modal: its diagnostics panel re-renders every tick,
  // exposing the detector's state + spectral-change meter to the DOM.
  await page.evaluate(() => {
    document.getElementById('now-playing-configure')?.click();
  });
  const started = Date.now();
  let lastTelemetry = '';
  while (Date.now() - started < AUTO_DETECT_MS && identifyCalls.length === 0) {
    await new Promise((r) => setTimeout(r, 2000));
    const telemetry = await page.evaluate(() => ({
      state: (document.getElementById('now-playing-state')?.textContent || '').trim(),
      spectral: (document.getElementById('now-playing-spectral-bar')?.style.width || '').trim(),
      confidence: (document.getElementById('now-playing-confidence-bar')?.style.width || '').trim()
    }));
    lastTelemetry = `state=${telemetry.state}, spectral=${telemetry.spectral}, confidence=${telemetry.confidence}`;
    console.log(`[e2e] detector telemetry: ${lastTelemetry}`);
  }
  let usedAuto = identifyCalls.length > 0;
  if (!usedAuto) {
    trigger = 'manual live-test button (auto did not fire)';
    // With --song2 the capture window straddles the transition (old song +
    // silence + new song) and Shazam can't match the mix. Re-duck so the
    // 12s window holds a clean stretch of song2 before the manual lookup.
    if (song2File) {
      await page.evaluate(() => { (window as any).__vsDuckSong?.(); });
      await new Promise((r) => setTimeout(r, 18000));
    }
    // the live-test reads the settings modal DRAFT — set provider again, then click
    await page.evaluate(() => {
      const open = document.getElementById('now-playing-configure') as HTMLButtonElement | null;
      open?.click();
      const enabled = document.getElementById('now-playing-enabled') as HTMLInputElement | null;
      const provider = document.getElementById('now-playing-provider') as HTMLSelectElement | null;
      if (enabled) { enabled.checked = true; enabled.dispatchEvent(new Event('change', { bubbles: true })); }
      if (provider) { provider.value = 'shazam'; provider.dispatchEvent(new Event('change', { bubbles: true })); }
      const btn = document.getElementById('now-playing-test-live') as HTMLButtonElement | null;
      btn?.click();
    });
  }
  // wait for at least one identify call (Node-side polling — the page can't
  // see the Node array)
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline && identifyCalls.length === 0) {
    await new Promise((r) => setTimeout(r, 1000));
  }
  check('identifyNowPlaying called (real Shazam path)', identifyCalls.length > 0,
    identifyCalls.length ? `trigger=${trigger}, numSamples=${identifyCalls[0].numSamples}` : `trigger=${trigger}, no calls; last telemetry: ${lastTelemetry}`);
  check('captured PCM is valid (>= 48000 samples)', (identifyCalls[0]?.numSamples ?? 0) >= 48000,
    `numSamples=${identifyCalls[0]?.numSamples}`);

  // 3. Shazam matched a real title
  const matched = identifyCalls.find((c) => c.matched);
  check('Shazam matched the song', Boolean(matched),
    matched ? `title="${matched.title}", artist="${matched.artist}"` : `errors: ${identifyCalls.map((c) => c.error).filter(Boolean).slice(0, 2).join('; ') || 'no match'}`);
  if (expectSubstr) {
    const ok = Boolean(matched && `${matched.title} ${matched.artist}`.toLowerCase().includes(expectSubstr.toLowerCase()));
    check(`expected title contains "${expectSubstr}"`, ok, matched ? `"${matched.title} — ${matched.artist}"` : 'no match to compare');
  }

  // 4. the match surfaced where users see it: the auto-created title overlay
  //    in the live project (the "show the name on all visuals" feature)
  if (matched) {
    await new Promise((r) => setTimeout(r, 2000));
    const overlayText = await page.evaluate(() => {
      const project = (window as any).__visualSynthCaptureApi?.getCurrentProject?.();
      const overlay = project?.overlays?.find?.(
        (o: { id?: string }) => o.id === 'now-playing-title'
      );
      return typeof overlay?.text === 'string' ? overlay.text : null;
    });
    const showed = Boolean(matched.title && overlayText && overlayText.includes(matched.title));
    check('title overlay in live project', showed,
      showed ? `"${overlayText!.replace(/\n/g, ' / ').slice(0, 80)}"` : `overlay text: ${JSON.stringify(overlayText)}`);
  }

  // 5. console cleanliness
  const realErrors = consoleErrors.filter((e) => !/favicon|net::ERR|ResizeObserver|Autofill|DevTools/.test(e));
  check('no console errors', realErrors.length === 0, realErrors.length ? realErrors.slice(0, 3).join(' | ') : 'clean');

  console.log('\nsong-detection state log:');
  stateLogs.forEach((l) => console.log('  ' + l));
  await browser.close();
  server.close();
  const failed = results.filter(([, ok]) => !ok).length;
  console.log(`\nSONG-DETECTION E2E: ${results.length - failed}/${results.length} checks passed${failed ? ` — ${failed} FAILED` : ''}${usedAuto ? ' (auto-detect path)' : ` (${trigger})`}`);
  process.exit(failed ? 1 : 0);
};

main();