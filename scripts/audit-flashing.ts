// Photosensitivity (seizure-risk) flash audit for a saved project.
//
// Massive flashing is a health risk — scenes whose SCREEN-WIDE luminance
// oscillates fast must be found and removed. This probe boots the shipped
// dist headless, applies the project through the real capture API, and for
// EVERY scene records a real-time frame stream (CDP screencast ~10-25fps)
// from the render canvas, computing per-frame mean luma with ffmpeg
// signalstats.
//
// A scene is FLAGGED when any 1-second window contains >= 4 large
// mean-luma flashes (each |Δluma| > 25/255 between consecutive frames) —
// i.e. sustained flashing above ~3/second, the photosensitivity
// guideline threshold. Screen-MEAN luma is the proxy for large-area
// flashing (small elements barely move the mean, which is the correct
// risk dimension).
//
// Usage: ts-node --transpile-only scripts/audit-flashing.ts --project=<file> [--only=<substr,substr...>]
import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import puppeteer from 'puppeteer';

const ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT, 'dist/renderer');
const WAV = path.join(__dirname, 'test-audio-fake.wav');
const arg = (name: string) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!hit) throw new Error(`--${name}= required`);
  return hit.slice(name.length + 3);
};
const PROJECT_PATH = arg('project');
const onlyArg = process.argv.find((a) => a.startsWith('--only='));
const ONLY = onlyArg ? onlyArg.slice(7).split(',').filter(Boolean) : null;

const CAPTURE_SEC = 9;      // per-scene stream
const FLASH_DELTA = 25;     // |ΔYAVG| between consecutive frames = one flash
const WINDOW_SEC = 1;       // sliding window
const FLAG_FLASHES = 4;     // >= this many flashes in any 1s window -> flag

interface Frame { t: number; yavg: number }

// Per-frame mean luma for a directory of sequentially-numbered JPEGs in a
// SINGLE ffmpeg pass (image2 demuxer + signalstats): one process per scene,
// not one per frame — the per-frame-spawn version took minutes per scene.
const framesYavg = (dir: string, count: number): Promise<Array<number | null>> =>
  new Promise((resolve) => {
    execFile('ffmpeg',
      ['-hide_banner', '-loglevel', 'error', '-i', path.join(dir, 'f%04d.jpg'),
        '-vf', 'signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-', '-f', 'null', '-'],
      (_e, _o, _stdout, stderr) => {
        const text = String(stderr || _o || '');
        const out: Array<number | null> = [];
        const re = /lavfi\.signalstats\.YAVG=([0-9.]+)/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(text)) !== null) out.push(Number(m[1]));
        while (out.length < count) out.push(null);
        resolve(out);
      });
  });

const main = async () => {
  const project = JSON.parse(fs.readFileSync(PROJECT_PATH, 'utf8'));
  const scenes = project.scenes.filter((s: any) =>
    !ONLY || ONLY.some((sub: string) => String(s.name).includes(sub)));
  console.log(`flash-auditing ${scenes.length} scenes (${CAPTURE_SEC}s stream each)`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required',
      '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream']
  });
  const page = await browser.newPage();
  const wav = fs.existsSync(WAV) ? fs.readFileSync(WAV).toString('base64') : '';
  await page.evaluateOnNewDocument((w: string) => {
    (window.navigator as any).requestMIDIAccess = async () => ({ inputs: new Map(), outputs: new Map(), onstatechange: null, sysexEnabled: false });
    if (window.navigator.mediaDevices) {
      window.navigator.mediaDevices.getUserMedia = async () => {
        const ctx = new AudioContext();
        const dest = ctx.createMediaStreamDestination();
        try {
          const bytes = new Uint8Array(atob(w).length);
          for (let i = 0; i < bytes.length; i++) bytes[i] = w.charCodeAt(i);
          const buf = await ctx.decodeAudioData(bytes.buffer);
          if (ctx.state === 'suspended') await ctx.resume();
          const src = ctx.createBufferSource();
          src.buffer = buf;
          src.loop = true;
          src.connect(dest);
          src.start();
        } catch { /* silent */ }
        return dest.stream;
      };
      (window.navigator.mediaDevices as any).enumerateDevices = async () => [{ deviceId: 'default', kind: 'audioinput', label: 'flash probe' }];
    }
    window.visualSynth = {
      ...(window.visualSynth ?? {}), listPresets: async () => [], onCloseRequested: () => {},
      showSaveDialog: async () => ({ result: 'cancel' }), saveProject: async () => ({ canceled: true }),
      saveProjectAs: async () => ({ canceled: true }), confirmClose: async () => {},
      autosaveProject: async () => ({ saved: false })
    } as any;
  }, wav);
  await page.goto('file://' + path.join(DIST_DIR, 'index.html'), { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => Boolean((window as any).__visualSynthInitialized), { timeout: 120000 });
  await page.evaluate(async (p: unknown) => { await (window as any).__visualSynthCaptureApi.applyProject(p); }, project);
  await new Promise((r) => setTimeout(r, 3000));

  // CDP screencast client that buffers frames (base64 JPEG) with timestamps.
  const results: Array<{ name: string; flagged: boolean; maxRate: number; flashes: number; amp: number; samples: number }> = [];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-flash-'));

  for (const scene of scenes as any[]) {
    await page.evaluate((id: string) => (window as any).__visualSynthCaptureApi.applyScene(id), scene.id);
    await new Promise((r) => setTimeout(r, 2500)); // settle past the transition

    const frameTimes: number[] = [];
    const sceneDir = path.join(tmp, `s${results.length}`);
    fs.mkdirSync(sceneDir, { recursive: true });
    const client = await page.createCDPSession();
    await new Promise<void>((done) => {
      client.on('Page.screencastFrame', async (ev: any) => {
        const idx = frameTimes.length;
        frameTimes.push(ev.metadata.timestamp);
        fs.writeFileSync(path.join(sceneDir, `f${String(idx).padStart(4, '0')}.jpg`), Buffer.from(ev.data, 'base64'));
        try { await client.send('Page.screencastFrameAck', { sessionId: ev.sessionId }); } catch { /* ended */ }
        if (idx >= 1 && ev.metadata.timestamp - frameTimes[0] >= CAPTURE_SEC) done();
      });
      client.send('Page.startScreencast', { format: 'jpeg', quality: 70, maxWidth: 320, maxHeight: 180, everyNthFrame: 1 }).catch(() => {});
      setTimeout(done, (CAPTURE_SEC + 4) * 1000); // safety stop
    });
    try { await client.send('Page.stopScreencast'); } catch { /* ignore */ }
    await client.detach().catch(() => {});

    const yavgs = await framesYavg(sceneDir, frameTimes.length);
    fs.rmSync(sceneDir, { recursive: true, force: true });
    const samples: Frame[] = frameTimes
      .map((t, i) => ({ t, yavg: yavgs[i] }))
      .filter((f) => f.yavg !== null) as Frame[];
    // flash analysis
    let flashes = 0;
    let maxRate = 0;
    let amp = 0;
    const flashTimes: number[] = [];
    for (let i = 1; i < samples.length; i++) {
      const d = Math.abs(samples[i].yavg - samples[i - 1].yavg);
      if (d > amp) amp = d;
      if (d > FLASH_DELTA) {
        flashes += 1;
        flashTimes.push(samples[i].t);
      }
    }
    for (const ft of flashTimes) {
      const inWindow = flashTimes.filter((t) => t >= ft - WINDOW_SEC && t <= ft + WINDOW_SEC).length;
      if (inWindow > maxRate) maxRate = inWindow;
    }
    const flagged = maxRate >= FLAG_FLASHES;
    results.push({ name: scene.name, flagged, maxRate, flashes, amp: Math.round(amp), samples: samples.length });
    console.log(
      `${flagged ? 'FLAG ' : '  . '}${scene.name.slice(0, 42).padEnd(42)} ` +
      `peakWin=${maxRate} flashes=${flashes} amp=${Math.round(amp)} samples=${samples.length}`
    );
  }
  fs.rmSync(tmp, { recursive: true, force: true });

  const flaggedScenes = results.filter((r) => r.flagged);
  console.log(`\nFLASH AUDIT: ${flaggedScenes.length}/${results.length} scenes flagged (>=${FLAG_FLASHES} flashes/second window)`);
  for (const f of flaggedScenes) console.log(`  FLAGGED: ${f.name} (peak ${f.maxRate} flashes/window, ${f.flashes} total, amp ${f.amp})`);
  await browser.close();
  process.exit(flaggedScenes.length > 0 ? 1 : 0);
};
main().catch((e) => { console.error(e); process.exit(1); });
