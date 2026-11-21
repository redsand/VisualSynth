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
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage();
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
  const results: any[] = [];
  for (const f of files) {
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
      const tick = (t: number) => {
        ctx.drawImage(src, 0, 0, 32, 18); const d = ctx.getImageData(0, 0, 32, 18).data; let l = 0, m = 0;
        for (let i = 0; i < d.length; i += 4) { l += (d[i] + d[i + 1] + d[i + 2]) / 3; if (prev) m += Math.abs(d[i] - prev[i]) + Math.abs(d[i + 1] - prev[i + 1]) + Math.abs(d[i + 2] - prev[i + 2]); }
        lu += l / 576; fr++; if (prev) { mo += m / 576 / 3; n++; } prev = new Uint8ClampedArray(d);
        if (t - t0 < s * 1000) requestAnimationFrame(tick); else res({ luma: Math.round(lu / fr), motion: +(mo / Math.max(1, n)).toFixed(2) });
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
      console.log(`${String(raw.metadata?.name).padEnd(24)} early luma=${early.luma} motion=${early.motion} | late luma=${late.luma} motion=${late.motion}`);
    } catch (e) {
      results.push({ file: f, name: raw.metadata?.name, crashed: String((e as Error).message).slice(0, 80) });
      console.log(`CRASH ${f}: ${String((e as Error).message).slice(0, 160)}`);
    }
    if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(results, null, 2));
  }
  await browser.close();
})().catch((e) => { console.error(String(e).slice(0, 300)); process.exit(1); });
