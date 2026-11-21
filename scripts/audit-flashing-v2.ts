// Photosensitivity (seizure-risk) flash audit, v2 — per-rendered-frame, regional,
// WCAG 2.3.1-style (general flash + red flash).
//
// v1 (audit-flashing.ts) missed every one of the 13 strobing scenes the user
// removed by hand from the Unique-100 show (2026-11-20). Its flaws:
//   - sampled a CDP screencast at ~10-25 fps and diffed consecutive captures:
//     a strobe faster than the capture rate aliases (same phase each capture
//     → zero measured change);
//   - only whole-screen MEAN luma: a flashing region of the screen, or a
//     red/blue colour flash with little luma change, barely moves the mean.
//
// v2 reads the app's render canvas on EVERY rendered frame (in-page, after the
// app's own rAF), downsampled to a 24x16 grid, and per region computes WCAG
// relative luminance and the saturated-red metric. Per region:
//   general flash: a PAIR of opposing luminance transitions, each >= 0.1 in
//                  relative luminance, with the darker state < 0.8
//   red flash:     a pair of opposing transitions of saturated red
//                  (R/(R+G+B) >= 0.8, change in (R-G-B)*320 > 20)
// Regions: full frame, 4 quadrants, 6x4 cells (~4% of the screen each; WCAG's
// flagged area is 25% of a 10-degree field ≈ 3% of a typical screen).
// FLAG when any region has > 3 flashes in any 1-second window.
//
// Frame-driven strobes (presets that toggle per frame) run at the RENDER rate,
// so the report also gives the rate projected to 60 fps; FLAG60 marks scenes
// that only cross the line at a full 60 fps (the live show's rate).
//
// Usage: ts-node --transpile-only scripts/audit-flashing-v2.ts --project=<file>
//          [--only=<substr,...>] [--seconds=8] [--json=<out>]
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

const ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT, 'dist/renderer');
const WAV = path.join(__dirname, 'test-audio-fake.wav');
const opt = (name: string, fallback?: string) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const PROJECT_PATH = opt('project');
if (!PROJECT_PATH) throw new Error('--project= required');
const ONLY = opt('only')?.split(',').filter(Boolean) ?? null;
const SECONDS = Number(opt('seconds', '8'));
const JSON_OUT = opt('json');

const GW = 24;
const GH = 16;
const FLAG_FLASHES_PER_SEC = 3; // WCAG: no more than three flashes in any one-second period

interface Frame { t: number; px: number[] } // RGB bytes, GW*GH*3

const srgbToLinear = (c: number) => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};
const LIN = Array.from({ length: 256 }, (_, i) => srgbToLinear(i));

interface Region { name: string; cells: number[] }
const regions: Region[] = (() => {
  const all: number[] = [];
  for (let i = 0; i < GW * GH; i++) all.push(i);
  const rect = (x0: number, y0: number, x1: number, y1: number) => {
    const out: number[] = [];
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) out.push(y * GW + x);
    return out;
  };
  const list: Region[] = [{ name: 'full', cells: all }];
  const hw = GW / 2, hh = GH / 2;
  list.push({ name: 'q-tl', cells: rect(0, 0, hw, hh) }, { name: 'q-tr', cells: rect(hw, 0, GW, hh) },
    { name: 'q-bl', cells: rect(0, hh, hw, GH) }, { name: 'q-br', cells: rect(hw, hh, GW, GH) });
  const cw = GW / 6, ch = GH / 4;
  for (let cy = 0; cy < 4; cy++) for (let cx = 0; cx < 6; cx++) {
    list.push({ name: `c${cx}${cy}`, cells: rect(cx * cw, cy * ch, (cx + 1) * cw, (cy + 1) * ch) });
  }
  return list;
})();

const regionSeries = (frames: Frame[], region: Region) => frames.map((f) => {
  let l = 0, r = 0, g = 0, b = 0;
  for (const c of region.cells) {
    const R = f.px[c * 3], G = f.px[c * 3 + 1], B = f.px[c * 3 + 2];
    l += 0.2126 * LIN[R] + 0.7152 * LIN[G] + 0.0722 * LIN[B];
    r += R; g += G; b += B;
  }
  const n = region.cells.length;
  const sum = r + g + b;
  const redRatio = sum > 0 ? r / sum : 0;
  const redMetric = Math.max(0, (r - g - b) / n / 255) * 320;
  return { t: f.t, lum: l / n, redRatio, redMetric };
});

// Count flashes: pairs of opposing qualifying transitions, measured between
// successive local extrema (so a ramp over several frames still counts once).
const flashTimes = (values: number[], times: number[], qualifies: (a: number, b: number) => boolean) => {
  const ext: Array<{ v: number; t: number }> = [];
  for (let i = 0; i < values.length; i++) {
    const prev = ext[ext.length - 1];
    if (!prev) { ext.push({ v: values[i], t: times[i] }); continue; }
    const prev2 = ext[ext.length - 2];
    if (prev2 && (values[i] - prev.v) * (prev.v - prev2.v) > 0) { prev.v = values[i]; prev.t = times[i]; continue; }
    if (values[i] !== prev.v) ext.push({ v: values[i], t: times[i] });
  }
  const transitions: number[] = [];
  for (let i = 1; i < ext.length; i++) {
    if (qualifies(ext[i - 1].v, ext[i].v)) transitions.push(ext[i].t);
  }
  const flashes: number[] = [];
  for (let i = 1; i < transitions.length; i += 2) flashes.push(transitions[i]);
  return flashes;
};
const maxPerWindow = (ts: number[], windowMs = 1000) => {
  let best = 0;
  for (let i = 0, j = 0; i < ts.length; i++) {
    while (ts[i] - ts[j] > windowMs) j++;
    best = Math.max(best, i - j + 1);
  }
  return best;
};

const analyse = (frames: Frame[]) => {
  let worst = { region: '', kind: '', perSec: 0 };
  for (const region of regions) {
    const s = regionSeries(frames, region);
    const times = s.map((x) => x.t);
    const general = flashTimes(s.map((x) => x.lum), times,
      (a, b) => Math.abs(a - b) >= 0.1 && Math.min(a, b) < 0.8);
    const red = flashTimes(s.map((x) => (x.redRatio >= 0.8 ? x.redMetric : 0)), times,
      (a, b) => Math.abs(a - b) > 20);
    for (const [kind, ts] of [['general', general], ['red', red]] as const) {
      const perSec = maxPerWindow(ts);
      if (perSec > worst.perSec) worst = { region: region.name, kind, perSec };
    }
  }
  return worst;
};

const main = async () => {
  const project = JSON.parse(fs.readFileSync(PROJECT_PATH, 'utf8'));
  const proj = project.project ?? project;
  const scenes = proj.scenes.filter((s: any) =>
    !ONLY || ONLY.some((sub) => String(s.name).toLowerCase().includes(sub.toLowerCase())));
  console.log(`flash-auditing v2: ${scenes.length} scenes, ${SECONDS}s each, per-frame ${GW}x${GH}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
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
          src.buffer = buf; src.loop = true; src.connect(dest); src.start();
        } catch { /* silent */ }
        return dest.stream;
      };
      (window.navigator.mediaDevices as any).enumerateDevices = async () => [{ deviceId: 'default', kind: 'audioinput', label: 'flash probe' }];
    }
    window.visualSynth = {
      ...(window.visualSynth ?? {}), listPresets: async () => [], onCloseRequested: () => {},
      showSaveDialog: async () => ({ result: 'cancel' }), saveProject: async () => ({ canceled: true }),
      saveProjectAs: async () => ({ canceled: true }), confirmClose: async () => {},
      autosaveProject: async () => ({ saved: false }),
      // Saved user projects carry asset paths; loading checks them.
      checkAssetPaths: async (paths: string[]) => Object.fromEntries(paths.map((p) => [p, true]))
    } as any;
  }, wav);
  await page.goto('file://' + path.join(DIST_DIR, 'index.html'), { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => Boolean((window as any).__visualSynthInitialized), { timeout: 120000 });
  await page.evaluate(async (p: unknown) => { await (window as any).__visualSynthCaptureApi.applyProject(p); }, proj);
  await new Promise((r) => setTimeout(r, 3000));

  const results: Array<{ name: string; flagged: boolean; flagged60: boolean; fps: number; perSec: number; perSec60: number; region: string; kind: string }> = [];
  for (const scene of scenes as any[]) {
    await page.evaluate((id: string) => (window as any).__visualSynthCaptureApi.applyScene(id), scene.id);
    await new Promise((r) => setTimeout(r, 2500));
    const frames: Frame[] = await page.evaluate((secs: number, gw: number, gh: number) => new Promise<any>((resolve) => {
      const src = document.getElementById('gl-canvas') as HTMLCanvasElement;
      const tmp = document.createElement('canvas');
      tmp.width = gw; tmp.height = gh;
      const ctx = tmp.getContext('2d', { willReadFrequently: true })!;
      const out: Array<{ t: number; px: number[] }> = [];
      const t0 = performance.now();
      const tick = (t: number) => {
        ctx.drawImage(src, 0, 0, gw, gh);
        const d = ctx.getImageData(0, 0, gw, gh).data;
        const px: number[] = new Array(gw * gh * 3);
        for (let i = 0, j = 0; i < d.length; i += 4, j += 3) { px[j] = d[i]; px[j + 1] = d[i + 1]; px[j + 2] = d[i + 2]; }
        out.push({ t, px });
        if (t - t0 < secs * 1000) requestAnimationFrame(tick); else resolve(out);
      };
      requestAnimationFrame(tick);
    }), SECONDS, GW, GH);
    const spanS = frames.length > 1 ? (frames[frames.length - 1].t - frames[0].t) / 1000 : 1;
    const fps = frames.length / Math.max(0.001, spanS);
    const worst = analyse(frames);
    const perSec60 = Math.round(worst.perSec * Math.max(1, 60 / Math.max(1, fps)));
    const flagged = worst.perSec > FLAG_FLASHES_PER_SEC;
    const flagged60 = !flagged && perSec60 > FLAG_FLASHES_PER_SEC;
    results.push({ name: scene.name, flagged, flagged60, fps: Math.round(fps), perSec: worst.perSec, perSec60, region: worst.region, kind: worst.kind });
    console.log(`${flagged ? 'FLAG  ' : flagged60 ? 'FLAG60' : '   .  '} ${String(scene.name).slice(0, 44).padEnd(44)} ` +
      `${String(worst.perSec).padStart(2)}/s (${String(perSec60).padStart(2)}/s@60) ${worst.kind || '-'} ${worst.region || '-'} fps=${Math.round(fps)}`);
  }
  if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(results, null, 2));
  const flagged = results.filter((r) => r.flagged || r.flagged60);
  console.log(`\nFLASH AUDIT v2: ${flagged.length}/${results.length} flagged (${results.filter((r) => r.flagged).length} at render rate, ${results.filter((r) => r.flagged60).length} only at 60fps)`);
  for (const f of flagged) console.log(`  ${f.flagged ? 'FLAG  ' : 'FLAG60'} ${f.name} — ${f.perSec}/s (${f.perSec60}/s@60) ${f.kind} ${f.region}`);
  await browser.close();
  process.exit(0);
};
main().catch((e) => { console.error(e); process.exit(1); });
