// BPM accuracy probe: feeds a real song through the virtualized mic (same
// harness as e2e-song-smoke), switches the BPM source to AUTO through the
// real UI, and samples the displayed transport BPM every second for 60s.
// Reports the estimated track over time — the ground truth for "is auto BPM
// accurate and stable" (the October logs showed it flapping 120→132→125→138).
//
// Usage: ts-node --transpile-only scripts/probe-bpm.ts <song> [song2 ...]
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import puppeteer from 'puppeteer';

const ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT, 'dist/renderer');
const songs = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (songs.length === 0 || songs.some((f) => !fs.existsSync(f))) {
  console.error('Usage: ts-node --transpile-only scripts/probe-bpm.ts <song> [song2 ...]');
  process.exit(1);
}
const SAMPLE_SEC = 60;

const server = http.createServer((req, res) => {
  const songMatch = /^\/song-(\d+)\.(mp3|m4a)$/.exec(req.url ?? '');
  if (songMatch) {
    res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Access-Control-Allow-Origin': '*' });
    res.end(fs.readFileSync(songs[Number(songMatch[1])]));
    return;
  }
  // Serve dist over http (not file://): the mic mock fetches the song from
  // this origin, and Chromium blocks http fetches from the opaque file://
  // origin — the same reason e2e-song-smoke serves dist over http.
  const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
  let file = path.join(DIST_DIR, urlPath === '/' ? 'index.html' : urlPath);
  if (!file.startsWith(DIST_DIR)) file = path.join(DIST_DIR, 'index.html');
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    const ext = path.extname(file);
    const type = ext === '.html' ? 'text/html' : ext === '.js' ? 'text/javascript'
      : ext === '.css' ? 'text/css' : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  });
});
const main = async () => {
  const songB64s: string[] = [];
  for (const song of songs) {
    const out = path.join(os.tmpdir(), `vs-bpm-${process.pid}-${songs.indexOf(song)}.mp3`);
    try {
      execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-t', '150',
        '-i', song, '-c:a', 'libmp3lame', '-b:a', '128k', out], { stdio: 'ignore', timeout: 30000 });
      songB64s.push(fs.readFileSync(out).toString('base64'));
      fs.unlinkSync(out);
    } catch {
      songB64s.push(fs.readFileSync(song).toString('base64')); // pass-through
    }
  }
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as { port: number }).port;

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required',
      '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'
    ]
  });
  const page = await browser.newPage();
  page.on('console', (m) => { const t = m.text(); if (t.includes('[Song Detection]')) console.log(`[page] ${t.slice(0, 120)}`); });

  await page.evaluateOnNewDocument((port: number) => {
    (window.navigator as any).requestMIDIAccess = async () => ({ inputs: new Map(), outputs: new Map(), onstatechange: null, sysexEnabled: false });
    if (window.navigator.mediaDevices) {
      window.navigator.mediaDevices.getUserMedia = async () => {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const destination = audioContext.createMediaStreamDestination();
        try {
          const bytes = new Uint8Array(await (await fetch(`http://127.0.0.1:${port}/song-0.mp3`)).arrayBuffer());
          const buffer = await audioContext.decodeAudioData(bytes.buffer);
          if (audioContext.state === 'suspended') await audioContext.resume();
          const source = audioContext.createBufferSource();
          source.buffer = buffer;
          source.loop = true;
          source.connect(destination);
          source.start();
        } catch { /* silent */ }
        return destination.stream;
      };
      (window.navigator.mediaDevices as any).enumerateDevices = async () => [{ deviceId: 'default', kind: 'audioinput', label: 'BPM Probe Source' }];
    }
    window.visualSynth = {
      ...(window.visualSynth ?? {}),
      listPresets: async () => [], onCloseRequested: () => {}, showSaveDialog: async () => ({ result: 'cancel' }),
      saveProject: async () => ({ canceled: true }), saveProjectAs: async () => ({ canceled: true }),
      confirmClose: async () => {}, autosaveProject: async () => ({ saved: false })
    } as any;
  }, port);

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => Boolean((window as any).__visualSynthInitialized), { timeout: 120000 });
  await new Promise((r) => setTimeout(r, 3000));

  for (const song of songs) {
    // Switch the BPM source to Auto through the real UI (as a user would).
    await page.evaluate(() => {
      const select = document.getElementById('bpm-source') as HTMLSelectElement | null;
      if (select && select.value !== 'auto') {
        select.value = 'auto';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    console.log(`\n=== ${path.basename(song)} — sampling displayed BPM every 2s for ${SAMPLE_SEC}s ===`);
    const samples: string[] = [];
    const t0 = Date.now();
    while (Date.now() - t0 < SAMPLE_SEC * 1000) {
      const bpm = await page.evaluate(() => {
        const v = (document.getElementById('transport-bpm') as HTMLInputElement)?.value ?? '';
        const st = (document.getElementById('transport-bpm-state') as HTMLSpanElement)?.textContent ?? '';
        const src = (document.getElementById('bpm-source') as HTMLSelectElement)?.value ?? '';
        return v + ' | state=' + st + ' | src=' + src;
      });
      if (samples[samples.length - 1] !== bpm) samples.push(bpm);
      await new Promise((r) => setTimeout(r, 2000));
    }
    console.log('BPM trajectory:', samples.join(' → '));
  }

  await browser.close();
  server.close();
  process.exit(0);
};
main().catch((e) => { console.error(e); process.exit(1); });
