// Offline probe for the song-change detector's feature representation.
// Plays two songs through an AnalyserNode configured exactly like the app's
// (fftSize 2048, smoothing 0.7, 8 log-spaced BAND_EDGES_HZ bands + the 64-bin
// 20Hz–20kHz spectrum), averages frames per song, normalizes like the
// detector does, and reports the spectral distance both ways. Answers: can
// this representation ever discriminate a real song change (distance ≥
// changeThreshold 0.35), or is the coarse 8-band shape the bottleneck?
//
// Usage: ts-node --transpile-only scripts/probe-spectral-distance.ts <a.m4a> <b.m4a>
import fs from 'fs';
import http from 'http';
import path from 'path';
import os from 'os';
import { execFileSync } from 'child_process';
import puppeteer from 'puppeteer';

const fileA = process.argv[2];
const fileB = process.argv[3];
if (!fileA || !fileB || !fs.existsSync(fileA) || !fs.existsSync(fileB)) {
  console.error('Usage: ts-node --transpile-only scripts/probe-spectral-distance.ts <a.m4a> <b.m4a>');
  process.exit(1);
}

const slice = (file: string, out: string) => {
  try {
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-t', '30',
      '-i', file, '-c:a', 'aac', '-b:a', '128k', out], { stdio: 'ignore', timeout: 30000 });
    return out;
  } catch {
    return file; // undecodable container — serve the original; decodeAudioData in the page handles mp3 fine
  }
};

const clipA = slice(fileA, path.join(os.tmpdir(), `vs-probe-a-${process.pid}.m4a`));
const clipB = slice(fileB, path.join(os.tmpdir(), `vs-probe-b-${process.pid}.m4a`));
const clipIsTemp = (p: string) => p.endsWith('.m4a');

const server = http.createServer((req, res) => {
  const f = req.url === '/a.m4a' ? clipA : req.url === '/b.m4a' ? clipB : null;
  if (!f) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': 'audio/mp4', 'Access-Control-Allow-Origin': '*' });
  res.end(fs.readFileSync(f));
});
await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
const port = (server.address() as { port: number }).port;

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required']
});
const page = await browser.newPage();
page.on('console', (m) => console.log(`[page] ${m.text()}`));

const result = await page.evaluate(async (port) => {
  const BAND_EDGES_HZ = [20, 60, 150, 400, 1000, 2500, 6000, 12000, 20000];
  const ctx = new AudioContext();
  if (ctx.state === 'suspended') await ctx.resume();
  const silent = ctx.createGain();
  silent.gain.value = 0;
  silent.connect(ctx.destination);

  const collect = async (url: string) => {
    const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
    const buffer = await ctx.decodeAudioData(bytes.buffer);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.7;
    source.connect(analyser).connect(silent);
    source.start();
    const binHz = ctx.sampleRate / analyser.fftSize;
    const freq = new Uint8Array(analyser.frequencyBinCount);
    const bandFor = (loHz: number, hiHz: number) => {
      const start = Math.max(1, Math.floor(loHz / binHz));
      const end = Math.min(freq.length - 1, Math.ceil(hiHz / binHz));
      let s = 0;
      for (let i = start; i <= end; i += 1) s += freq[i] / 255;
      return s / (end - start + 1);
    };
    const bandsSum = new Array(8).fill(0);
    const specSum = new Array(64).fill(0);
    let frames = 0;
    // skip 1s of smoothing ramp, collect 6s of settled frames
    await new Promise((r) => setTimeout(r, 1000));
    const t0 = performance.now();
    while (performance.now() - t0 < 6000) {
      analyser.getByteFrequencyData(freq);
      for (let b = 0; b < 8; b += 1) bandsSum[b] += bandFor(BAND_EDGES_HZ[b], BAND_EDGES_HZ[b + 1]);
      const minHz = 20, maxHz = 20000;
      for (let i = 0; i < 64; i += 1) {
        const lo = minHz * Math.pow(maxHz / minHz, i / 64);
        const hi = minHz * Math.pow(maxHz / minHz, (i + 1) / 64);
        specSum[i] += bandFor(lo, hi);
      }
      frames += 1;
      await new Promise((r) => setTimeout(r, 50));
    }
    source.stop();
    const norm = (v: number[]) => {
      const total = v.reduce((s, x) => s + Math.max(0, x), 0);
      return total <= 1e-6 ? v.map(() => 0) : v.map((x) => Math.max(0, x) / total);
    };
    return {
      bands: norm(bandsSum.map((x) => x / Math.max(1, frames))),
      spectrum: norm(specSum.map((x) => x / Math.max(1, frames)))
    };
  };

  const a = await collect(`http://127.0.0.1:${port}/a.m4a`);
  const b = await collect(`http://127.0.0.1:${port}/b.m4a`);
  const distance = (x: number[], y: number[]) => {
    let sum = 0;
    for (let i = 0; i < Math.min(x.length, y.length); i += 1) sum += Math.abs(x[i] - y[i]);
    return sum * 0.5;
  };
  return {
    bandsA: a.bands.map((v) => Number(v.toFixed(4))),
    bandsB: b.bands.map((v) => Number(v.toFixed(4))),
    bandsDistance: Number(distance(a.bands, b.bands).toFixed(4)),
    spectrumDistance: Number(distance(a.spectrum, b.spectrum).toFixed(4)),
    sampleRate: ctx.sampleRate
  };
}, port);

console.log('bands A:', result.bandsA.join(' '));
console.log('bands B:', result.bandsB.join(' '));
console.log(`8-band signature distance:      ${result.bandsDistance} (detector threshold: 0.35)`);
console.log(`64-bin spectrum signature distance: ${result.spectrumDistance} (12-bucket downsample path)`);
console.log(`sample rate: ${result.sampleRate}`);

await browser.close();
server.close();
if (clipIsTemp(clipA)) fs.unlinkSync(clipA);
if (clipIsTemp(clipB)) fs.unlinkSync(clipB);
process.exit(0);