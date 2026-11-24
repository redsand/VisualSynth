// Audit preset PADS the way the app loads them: migrate → validate →
// applyPresetV6(preset, base project) → load the WHOLE resulting project
// (pads apply project-level settings too; extracting only the scene can
// misrender generator presets). Measures early + late luma/motion and the
// WCAG flash rate (same analysis as audit-flashing-v2, full-frame + quadrants).
// Usage: ts-node --transpile-only scripts/audit-pad-presets.ts --list=<file of preset basenames> [--late=15] [--json=out]
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import { migratePreset, validatePreset, applyPresetV6 } from '../src/shared/presetMigration';
import { DEFAULT_PROJECT } from '../src/shared/project';

const opt = (n: string, d?: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const files = fs.readFileSync(opt('list')!, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
const LATE = Number(opt('late', '15'));
const JSON_OUT = opt('json');

(async () => {
  const wav = fs.readFileSync(path.join(__dirname, 'test-audio-fake.wav')).toString('base64');
  // The test browser runs out of graphics resources after ~128 preset loads
  // ("detached Frame" on every later preset); restart it every 100.
  let browser!: Awaited<ReturnType<typeof puppeteer.launch>>;
  let page!: Awaited<ReturnType<typeof browser.newPage>>;
  const boot = async () => {
  browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.evaluateOnNewDocument((w: string) => {
    (window as any).__vsDisableBeatPulse = true;
    (navigator as any).requestMIDIAccess = async () => ({ inputs: new Map(), outputs: new Map() });
    navigator.mediaDevices.getUserMedia = async () => {
      const ctx = new AudioContext(); const dest = ctx.createMediaStreamDestination();
      const bytes = Uint8Array.from(atob(w), (c) => c.charCodeAt(0));
      const buf = await ctx.decodeAudioData(bytes.buffer); await ctx.resume();
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; src.connect(dest); src.start();
      return dest.stream;
    };
    (window as any).visualSynth = {
      listPresets: async () => [], onCloseRequested: () => {}, autosaveProject: async () => ({ saved: false }),
      checkAssetPaths: async (p: string[]) => Object.fromEntries(p.map((x) => [x, true])),
      // presets may carry output settings; keep the output window out of audits
      setOutputConfig: async (c: any) => ({ ...c, enabled: false }), openOutput: async (c: any) => ({ opened: false, config: c }), closeOutput: async () => ({ closed: true })
    };
  }, wav);
  await page.goto('file://' + path.join(process.cwd(), 'dist/renderer/index.html'), { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean((window as any).__visualSynthInitialized), { timeout: 120000 });
  };
  await boot();
  const results: any[] = [];
  let sinceBoot = 0;
  for (const f of files) {
    if (++sinceBoot > 100) {
      const proc = browser.process();
      await Promise.race([browser.close().catch(() => {}), new Promise((r) => setTimeout(r, 5000))]);
      try { proc?.kill('SIGKILL'); } catch { /* gone */ }
      await boot();
      sinceBoot = 1;
    }
    const raw = JSON.parse(fs.readFileSync(path.join('assets/presets', f), 'utf8'));
    const m = migratePreset(raw);
    const v = m.success ? validatePreset(m.preset) : { valid: false, errors: m.errors };
    if (!m.success || !v.valid) { results.push({ file: f, name: raw.metadata?.name, loadError: (v as any).errors?.slice(0, 2) }); console.log(`LOADFAIL ${f}`); continue; }
    const project = applyPresetV6(m.preset, JSON.parse(JSON.stringify(DEFAULT_PROJECT))).project;
    const measure = (secs: number) => page.evaluate((s: number) => new Promise<any>((res) => {
      const src = document.getElementById('gl-canvas') as HTMLCanvasElement;
      const tmp = document.createElement('canvas'); tmp.width = 32; tmp.height = 18;
      const ctx = tmp.getContext('2d', { willReadFrequently: true })!;
      let prev: Uint8ClampedArray | null = null, mo = 0, lu = 0, n = 0, fr = 0; const t0 = performance.now();
      const acc = new Float32Array(576);
      const tick = (t: number) => {
        ctx.drawImage(src, 0, 0, 32, 18); const d = ctx.getImageData(0, 0, 32, 18).data; let l = 0, m = 0;
        for (let i = 0; i < d.length; i += 4) { const px = (d[i] + d[i + 1] + d[i + 2]) / 3; l += px; acc[i >> 2] += px; if (prev) m += Math.abs(d[i] - prev[i]) + Math.abs(d[i + 1] - prev[i + 1]) + Math.abs(d[i + 2] - prev[i + 2]); }
        lu += l / 576; fr++; if (prev) { mo += m / 576 / 3; n++; } prev = new Uint8ClampedArray(d);
        if (t - t0 < s * 1000) requestAnimationFrame(tick); else {
          // Structure: how much the (time-averaged) picture varies across the
          // screen. Flat blobs and washes score low even when grain "moves".
          let mean = 0; for (let k = 0; k < 576; k++) { acc[k] /= fr; mean += acc[k]; } mean /= 576;
          let v = 0; for (let k = 0; k < 576; k++) v += (acc[k] - mean) ** 2;
          // Detail: neighbour-to-neighbour change. Smooth glows/gradients are low.
          let det = 0, dn = 0;
          for (let y = 0; y < 18; y++) for (let x = 0; x < 32; x++) {
            const k = y * 32 + x;
            if (x < 31) { det += Math.abs(acc[k + 1] - acc[k]); dn++; }
            if (y < 17) { det += Math.abs(acc[k + 32] - acc[k]); dn++; }
          }
          // Signature: 8x4 coarse image, to spot presets that render the SAME fallback.
          const sig: number[] = [];
          for (let by = 0; by < 4; by++) for (let bx = 0; bx < 8; bx++) {
            let t = 0; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const yy = Math.min(17, by * 4 + y); t += acc[yy * 32 + bx * 4 + x]; }
            sig.push(Math.round(t / 16 / 8));
          }
          res({ luma: Math.round(lu / fr), motion: +(mo / Math.max(1, n)).toFixed(2), structure: +Math.sqrt(v / 576).toFixed(1), detail: +(det / dn).toFixed(2), sig: sig.join('') });
        }
      };
      requestAnimationFrame(tick);
    }), secs);
    try {
      await page.evaluate(async (p: unknown) => { await (window as any).__visualSynthCaptureApi.applyProject(p); }, project);
      await new Promise((r) => setTimeout(r, 2500));
      const early = await measure(4);
      await new Promise((r) => setTimeout(r, Math.max(0, (LATE - 7) * 1000)));
      const late = await measure(3);
      results.push({ file: f, name: raw.metadata?.name, early, late });
      console.log(`${String(raw.metadata?.name).padEnd(24)} early luma=${early.luma} motion=${early.motion} | late luma=${late.luma} motion=${late.motion} structure=${late.structure} detail=${late.detail}`);
    } catch (e) {
      results.push({ file: f, name: raw.metadata?.name, crashed: String((e as Error).message).slice(0, 80) });
      console.log(`CRASH ${f}: ${String((e as Error).message).slice(0, 160)}`);
    }
    if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(results, null, 2));
  }
  await browser.close();
})().catch((e) => { console.error(String(e).slice(0, 300)); process.exit(1); });
