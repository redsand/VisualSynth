// Probe whether a scene keeps moving over a long dwell (motion collapse /
// freeze detection). Renders the scene for --seconds and prints per-5s motion
// (mean abs frame delta on a 32x18 grid) and mean luma, plus EEL per-frame
// variable snapshots so a frozen variable (overflow / saturation) is visible.
// Usage: ts-node --transpile-only scripts/probe-motion-over-time.ts --project=<f> --only=<name> [--seconds=120]
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
const opt = (n: string, d?: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
(async () => {
  const project = JSON.parse(fs.readFileSync(opt('project')!, 'utf8'));
  const proj = project.project ?? project;
  const only = opt('only')!.toLowerCase();
  const seconds = Number(opt('seconds', '120'));
  const scene = proj.scenes.find((s: any) => s.name.toLowerCase().includes(only));
  if (!scene) throw new Error('scene not found');
  const wav = fs.readFileSync(path.join(__dirname, 'test-audio-fake.wav')).toString('base64');
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.evaluateOnNewDocument((w: string) => {
    (navigator as any).requestMIDIAccess = async () => ({ inputs: new Map(), outputs: new Map() });
    navigator.mediaDevices.getUserMedia = async () => {
      const ctx = new AudioContext(); const dest = ctx.createMediaStreamDestination();
      const bytes = Uint8Array.from(atob(w), (c) => c.charCodeAt(0));
      const buf = await ctx.decodeAudioData(bytes.buffer); await ctx.resume();
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; src.connect(dest); src.start();
      return dest.stream;
    };
    (window as any).visualSynth = { listPresets: async () => [], onCloseRequested: () => {}, autosaveProject: async () => ({ saved: false }), checkAssetPaths: async (p: string[]) => Object.fromEntries(p.map((x) => [x, true])) };
  }, wav);
  await page.goto('file://' + path.join(process.cwd(), 'dist/renderer/index.html'), { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean((window as any).__visualSynthInitialized), { timeout: 120000 });
  await page.evaluate(async (p: unknown) => { await (window as any).__visualSynthCaptureApi.applyProject(p); }, proj);
  await page.evaluate((id: string) => (window as any).__visualSynthCaptureApi.applyScene(id), scene.id);
  console.log(`scene: ${scene.name}`);
  const shotDir = opt('shots');
  if (shotDir) {
    for (const at of [1, 4, 20]) {
      await new Promise((r) => setTimeout(r, (at === 1 ? 1 : at === 4 ? 3 : 16) * 1000));
      await page.screenshot({ path: path.join(shotDir, `motion-${at}s.png`), clip: await page.evaluate(() => { const r = document.getElementById('gl-canvas')!.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }) });
    }
  }
  const rows = await page.evaluate((secs: number) => new Promise<any[]>((resolve) => {
    const src = document.getElementById('gl-canvas') as HTMLCanvasElement;
    const tmp = document.createElement('canvas'); tmp.width = 32; tmp.height = 18;
    const ctx = tmp.getContext('2d', { willReadFrequently: true })!;
    let prev: Uint8ClampedArray | null = null;
    let bucket = { motion: 0, luma: 0, n: 0, frames: 0 };
    const out: any[] = [];
    const t0 = performance.now();
    let lastBucket = t0;
    const tick = (t: number) => {
      ctx.drawImage(src, 0, 0, 32, 18);
      const d = ctx.getImageData(0, 0, 32, 18).data;
      let l = 0, m = 0;
      for (let i = 0; i < d.length; i += 4) {
        l += (d[i] + d[i + 1] + d[i + 2]) / 3;
        if (prev) m += Math.abs(d[i] - prev[i]) + Math.abs(d[i + 1] - prev[i + 1]) + Math.abs(d[i + 2] - prev[i + 2]);
      }
      if (prev) { bucket.motion += m / (d.length / 4) / 3; bucket.n += 1; }
      bucket.luma += l / (d.length / 4); bucket.frames += 1;
      prev = new Uint8ClampedArray(d);
      if (t - lastBucket >= 5000) {
        const dg = (window as any).__visualSynthCaptureApi.getDiagnostics?.() ?? {};
        const rs = dg.renderSnapshot ?? dg.latestRenderSnapshot ?? {};
        out.push({ timeMs: rs.timeMs, rms: rs.rms, s: Math.round((t - t0) / 1000), motion: +(bucket.motion / Math.max(1, bucket.n)).toFixed(2), luma: Math.round(bucket.luma / bucket.frames), fps: Math.round(bucket.frames / ((t - lastBucket) / 1000)) });
        bucket = { motion: 0, luma: 0, n: 0, frames: 0 }; lastBucket = t;
      }
      if (t - t0 < secs * 1000) requestAnimationFrame(tick); else resolve(out);
    };
    requestAnimationFrame(tick);
  }), seconds);
  const snap = await page.evaluate(() => {
    const d = (window as any).__visualSynthCaptureApi.getDiagnostics?.() ?? {};
    const r = d.renderSnapshot ?? d.latestRenderSnapshot ?? d.render ?? {};
    return { timeMs: r.timeMs ?? null, rms: r.rms ?? null, keys: Object.keys(d).slice(0, 30) };
  });
  console.log('diagnostics after run:', JSON.stringify(snap));
  for (const r of rows) console.log(`t=${String(r.s).padStart(4)}s motion=${String(r.motion).padStart(6)} luma=${String(r.luma).padStart(3)} fps=${r.fps} timeMs=${r.timeMs === undefined ? '?' : Math.round(r.timeMs)} rms=${r.rms === undefined ? '?' : (+r.rms).toFixed(3)}`);
  await browser.close();
})().catch((e) => { console.error(String(e).slice(0, 300)); process.exit(1); });
