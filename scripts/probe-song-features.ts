// Feature-calibration probe for the song-change detector redesign.
//
// The previous representation (amplitude-normalized spectral shape, 8 or 64
// bands) cannot discriminate real songs: measured cross-song distance 0.077
// vs threshold 0.35, with same-song drift overlapping at 0.02–0.03 (see
// probe-spectral-distance.ts, which measures that representation). This probe
// feeds candidate features REAL audio sampled exactly the way the app does —
// rAF-rate frames from an AnalyserNode configured like AudioEngine's (fftSize
// 2048, smoothing 0.7, byte-frequency data) — and reports the distances the
// detector would see, so feature weights and the default changeThreshold can
// be calibrated against ground truth instead of guessed:
//
//   same-song drift    = distance between two windows of DIFFERENT sections of
//                        the SAME song (verse vs chorus) — the false-positive
//                        scale the detector must stay under
//   cross-song change  = distance between windows of DIFFERENT songs — the
//                        signal the detector must catch
//
// Features per window (the detector redesign's building blocks):
//   shape  — normalized 64-bin log-spaced spectrum mean (loudness-invariant)
//   flux   — normalized per-bin mean positive rise rate max(0, m−prev)/dt
//            (rhythmic texture: where and how fast energy enters each band)
//
// Usage: ts-node --transpile-only scripts/probe-song-features.ts <song1> <song2> [song3 ...]
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import puppeteer from 'puppeteer';

const songs = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (songs.length < 2 || songs.some((f) => !fs.existsSync(f))) {
  console.error('Usage: ts-node --transpile-only scripts/probe-song-features.ts <song1> <song2> [song3 ...]');
  process.exit(1);
}
const SECTION_OFFSETS = [0, 45]; // two sections of each song (s) — same-song drift pairs
const SECTION_SEC = 8; // per section: 1s smoothing ramp + 6s collected
const winArg = process.argv.find((a) => a.startsWith('--window='));
const WINDOW_MS = winArg ? Number(winArg.slice(9)) : 2500; // the detector's aggregation window

// Slice each song so the page payload stays small (looping a 90s slice would
// also work, but sections past the slice need real offsets anyway).
const clips: string[] = [];
const tempClips: string[] = [];
for (const song of songs) {
  const out = path.join(os.tmpdir(), `vs-featprobe-${process.pid}-${songs.indexOf(song)}.m4a`);
  try {
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-t', '120',
      '-i', song, '-c:a', 'aac', '-b:a', '128k', out], { stdio: 'ignore', timeout: 30000 });
    clips.push(out);
    tempClips.push(out);
  } catch {
    clips.push(song); // undecodable container — pass through; decodeAudioData handles mp3/m4a
  }
}

const server = http.createServer((req, res) => {
  const idx = /^\/clip-(\d+)\.m4a$/.exec(req.url ?? '');
  if (!idx) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': 'audio/mp4', 'Access-Control-Allow-Origin': '*' });
  res.end(fs.readFileSync(clips[Number(idx[1])]));
});
const main = async () => {
await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
const port = (server.address() as { port: number }).port;

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required']
});
const page = await browser.newPage();
page.on('console', (m) => { if (!m.text().startsWith('[feat]')) console.log(`[page] ${m.text()}`); });

// Collect one section (songIndex, offsetSec): rAF-rate frames, per-window
// feature sums exactly like the redesigned detector would accumulate them.
const windows = await page.evaluate(async (port: number, offsets: number[], numSongs: number, sectionSec: number, windowMs: number) => {
  const ctx = new AudioContext();
  if (ctx.state === 'suspended') await ctx.resume();
  const silent = ctx.createGain();
  silent.gain.value = 0;
  silent.connect(ctx.destination);

  const collected: Array<{ song: number; offset: number; winIndex: number; shape: number[]; flux: number[]; frames: number }> = [];

  for (let song = 0; song < numSongs; song += 1) {
    const bytes = new Uint8Array(await (await fetch(`http://127.0.0.1:${port}/clip-${song}.m4a`)).arrayBuffer());
    const buffer = await ctx.decodeAudioData(bytes.buffer);
    for (const offset of offsets) {
      if (offset + sectionSec > buffer.duration) continue;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.7;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(analyser).connect(silent);
      source.start(0, offset, sectionSec + 1);

      const binHz = ctx.sampleRate / analyser.fftSize;
      const freq = new Uint8Array(analyser.frequencyBinCount);
      const NBINS = 64, minHz = 20, maxHz = 20000;
      const readMag = (): number[] => {
        analyser.getByteFrequencyData(freq);
        const mag = new Array(NBINS).fill(0);
        for (let i = 0; i < NBINS; i += 1) {
          const lo = minHz * Math.pow(maxHz / minHz, i / NBINS);
          const hi = minHz * Math.pow(maxHz / minHz, (i + 1) / NBINS);
          const start = Math.max(1, Math.floor(lo / binHz));
          const end = Math.min(freq.length - 1, Math.ceil(hi / binHz));
          let s = 0;
          for (let j = start; j <= end; j += 1) s += freq[j] / 255;
          mag[i] = s / (end - start + 1);
        }
        return mag;
      };

      // Per-window sums, started after a 1s smoothing ramp. The onset
      // envelope (per-frame total positive flux) is kept per frame so the
      // window's beat periodicity can be estimated by autocorrelation —
      // tempo is stable across a song's sections but usually differs
      // between songs, which is exactly the separation shape/flux lack.
      let prev = readMag();
      let winStart = 0, frames = 0, windowSeq = 0;
      const shapeSum = new Array(NBINS).fill(0);
      const fluxSum = new Array(NBINS).fill(0);
      let onsetEnv: number[] = [];
      const flush = (now: number) => {
        const norm = (v: number[]) => {
          const t = v.reduce((s, x) => s + Math.max(0, x), 0);
          return t <= 1e-9 ? v.map(() => 0) : v.map((x) => Math.max(0, x) / t);
        };
        windowSeq += 1;
        const fpsEst = Math.max(30, frames / (windowMs / 1000));
        // Autocorrelation of the onset envelope sampled at fixed log-spaced
        // beat lags (0.25s–1.3s, i.e. 46–240 BPM). The CURVE (not a single
        // peak — peak-picking flips between harmonics on 2.5s windows) is
        // the tempo feature: same song → same periodicity structure.
        const NLAGS = 16;
        const beat = new Array(NLAGS).fill(0);
        if (onsetEnv.length > 48) {
          const mean = onsetEnv.reduce((s, x) => s + x, 0) / onsetEnv.length;
          const centered = onsetEnv.map((x) => x - mean);
          const energy = centered.reduce((s, x) => s + x * x, 0);
          if (energy > 1e-12) {
            let peak = 0;
            for (let li = 0; li < NLAGS; li += 1) {
              const lag = Math.round((0.25 * Math.pow(1.3 / 0.25, li / (NLAGS - 1))) * fpsEst);
              let s = 0;
              for (let k = 0; k + lag < centered.length; k += 1) s += centered[k] * centered[k + lag];
              const r = Math.max(0, s / energy);
              beat[li] = r;
              if (r > peak) peak = r;
            }
            if (peak > 0) for (let li = 0; li < NLAGS; li += 1) beat[li] /= peak; // shape-invariant
          }
        }
        collected.push({
          song,
          offset,
          winIndex: windowSeq,
          shape: norm(shapeSum.map((x) => x / Math.max(1, frames))),
          flux: norm(fluxSum.map((x) => x / Math.max(1, frames))),
          beat,
          frames
        });
      };

      await new Promise<void>((resolve) => {
        const t0 = performance.now();
        const step = () => {
          const now = performance.now() - t0;
          if (now > sectionSec * 1000) {
            if (frames > 0) flush(now);
            resolve();
            return;
          }
          const mag = readMag();
          const dt = Math.max(4, Math.min(500, (now - (prev as any).t ?? 16)));
          if (now >= 1000 && prev) { // skip the smoothing ramp
            let frameFlux = 0;
            for (let i = 0; i < NBINS; i += 1) {
              const rise = Math.max(0, mag[i] - (prev as any).m[i]);
              shapeSum[i] += mag[i];
              fluxSum[i] += rise / (dt / 1000);
              frameFlux += rise;
            }
            onsetEnv.push(frameFlux);
            frames += 1;
            if (winStart === 0) winStart = now;
            if (now - winStart >= windowMs) { flush(now); shapeSum.fill(0); fluxSum.fill(0); onsetEnv = []; frames = 0; winStart = now; }
          }
          (prev as any) = { m: mag, t: now };
          requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
      source.stop();
      // let the analyser settle before the next section
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  return collected;
}, port, SECTION_OFFSETS, clips.length, SECTION_SEC, WINDOW_MS);

await browser.close();
server.close();
for (const c of tempClips) { try { fs.unlinkSync(c); } catch { /* best-effort */ } }

if (windows.length === 0) throw new Error('no windows collected');

// Window-level analysis — the distances the DETECTOR actually compares:
//   SAME-SONG drift   = adjacent 2.5s windows within one section (what the
//                       baseline slowly tracks while a song plays on)
//   CROSS-SONG change = windows of different songs (what must fire)
const labeled = windows
  .filter((w) => w.frames > 0)
  .map((w) => ({
    song: w.song,
    offset: w.offset,
    win: w.winIndex,
    shape: w.shape,
    flux: w.flux,
    beat: w.beat
  }));

const fmt = (v: number) => v.toFixed(3);
const l1 = (a: number[], b: number[]) => {
  let s = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) s += Math.abs(a[i] - b[i]);
  return s * 0.5; // total-variation distance ∈ [0,1]
};

interface Blocks { shape: number; flux: number; beat: number }
const blocksOf = (w: (typeof labeled)[number], x: (typeof labeled)[number]): Blocks => ({
  shape: l1(w.shape, x.shape),
  flux: l1(w.flux, x.flux),
  beat: l1(w.beat, x.beat)
});

const pairs: Array<{ same: boolean; b: Blocks }> = [];
for (const w of labeled) {
  for (const x of labeled) {
    if (w.song === x.song) {
      if (x.win !== w.win + 1) continue; // same song: adjacent windows only
    } else {
      if (w.song > x.song) continue; // count each cross pair once
    }
    pairs.push({ same: w.song === x.song, b: blocksOf(w, x) });
  }
}

const stat = (v: number[]) =>
  v.length
    ? `n=${v.length} min=${fmt(Math.min(...v))} median=${fmt(v.slice().sort((a, b) => a - b)[Math.floor(v.length / 2)])} max=${fmt(Math.max(...v))}`
    : 'n=0';

console.log(`\nwindows collected: ${labeled.length} (~${windows[0]?.frames ?? 0} frames each)`);
const sameB = pairs.filter((p) => p.same).map((p) => p.b);
const crossB = pairs.filter((p) => !p.same).map((p) => p.b);
const col = (b: Blocks[], k: keyof Blocks) => b.map((x) => x[k]);
console.log(`SAME-SONG  drift   shape: ${stat(col(sameB, 'shape'))}`);
console.log(`                   flux : ${stat(col(sameB, 'flux'))}`);
console.log(`                   beat : ${stat(col(sameB, 'beat'))}`);
console.log(`CROSS-SONG change   shape: ${stat(col(crossB, 'shape'))}`);
console.log(`                   flux : ${stat(col(crossB, 'flux'))}`);
console.log(`                   beat : ${stat(col(crossB, 'beat'))}`);

for (const [ws, wf, wt] of [[0.35, 0.4, 0.25], [0.3, 0.3, 0.4], [0.4, 0.45, 0.15], [0.25, 0.25, 0.5]] as const) {
  const mix = (b: Blocks) => ws * b.shape + wf * b.flux + wt * b.beat;
  const same = sameB.map(mix);
  const cross = crossB.map(mix);
  const p90 = (v: number[]) => v.slice().sort((a, b) => a - b)[Math.floor(v.length * 0.9)];
  const sameP90 = p90(same);
  const sortedCross = cross.slice().sort((a, b) => a - b);
  const crossQ10 = sortedCross[Math.floor(sortedCross.length * 0.1)];
  const recallAt = (t: number) => cross.filter((d) => d >= t).length;
  const fpAt = (t: number) => same.filter((d) => d >= t).length;
  const mid = (sameP90 + crossQ10) / 2;
  console.log(
    `weights s/f/t=${ws}/${wf}/${wt}: same p90=${fmt(sameP90)} cross q10=${fmt(crossQ10)} | thr≈${fmt(mid)} -> recall ${recallAt(mid)}/${cross.length}, same-song fires ${fpAt(mid)}/${same.length}`
  );
}
process.exit(0);
};
main().catch((e) => { console.error(e); process.exit(1); });
