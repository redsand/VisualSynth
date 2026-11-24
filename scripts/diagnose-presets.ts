// Why does a preset fail? Loads each preset the way the Preset Explorer does
// (with music) and records: warp/comp compile status, the engine's diagnostic
// issue codes, the first shader compile error, brightness and motion.
// Output feeds root-cause grouping so engine gaps get fixed, not presets dropped.
// Usage: ts-node --transpile-only scripts/diagnose-presets.ts --list=<file of preset paths> --json=<out>
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import { migratePreset, applyPresetV6 } from '../src/shared/presetMigration';
import { DEFAULT_PROJECT } from '../src/shared/project';
const opt = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
(async () => {
  const files = fs.readFileSync(opt('list')!, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
  const wav = fs.readFileSync(path.join(__dirname, 'test-audio-fake.wav')).toString('base64');
  let browser!: Awaited<ReturnType<typeof puppeteer.launch>>;
  let page!: Awaited<ReturnType<typeof browser.newPage>>;
  let errs: string[] = [];
  const boot = async () => {
    browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
    page = await browser.newPage();
    page.on('console', async (m) => {
      const t = m.text();
      if (/ERROR: 0:/.test(t)) errs.push(t.split('\n')[0].replace(/^.*ERROR: 0:\d+: /, '').slice(0, 120));
      if (process.argv.includes('--lines') && /Shader lines around errors/.test(t)) {
        const args = await Promise.all(m.args().map((a) => a.jsonValue().catch(() => '')));
        console.log('LINES', String(args[1] ?? '').slice(0, 1600));
      }
    });
    await page.evaluateOnNewDocument((w: string) => {
      (navigator as any).requestMIDIAccess = async () => ({ inputs: new Map(), outputs: new Map() });
      navigator.mediaDevices.getUserMedia = async () => { const ctx = new AudioContext(); const dest = ctx.createMediaStreamDestination(); const buf = await ctx.decodeAudioData(Uint8Array.from(atob(w), (c) => c.charCodeAt(0)).buffer); await ctx.resume(); const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.connect(dest); s.start(); return dest.stream; };
      (window as any).visualSynth = { listPresets: async () => [], onCloseRequested: () => {}, autosaveProject: async () => ({ saved: false }), checkAssetPaths: async (p: string[]) => Object.fromEntries(p.map((x) => [x, true])), setOutputConfig: async (c: any) => ({ ...c, enabled: false }), openOutput: async (c: any) => ({ opened: false, config: c }), closeOutput: async () => ({ closed: true }) };
      (window as any).__vsDisablePrewarm = true;
    }, wav);
    await page.goto('file://' + path.join(process.cwd(), 'dist/renderer/index.html'), { waitUntil: 'load' });
    await page.waitForFunction(() => Boolean((window as any).__visualSynthInitialized), { timeout: 120000 });
  };
  await boot();
  const out: any[] = [];
  let since = 0;
  for (const f of files) {
    if (++since > 100) { const p = browser.process(); await Promise.race([browser.close().catch(() => {}), new Promise((r) => setTimeout(r, 5000))]); try { p?.kill('SIGKILL'); } catch { /* gone */ } await boot(); since = 1; }
    // --fresh: reload the app before each preset so nothing (a failed shader,
    // feedback buffers, async compiles) leaks from the previous one.
    if (process.argv.includes('--fresh') && out.length > 0) {
      await page.reload({ waitUntil: 'load' });
      await page.waitForFunction(() => Boolean((window as any).__visualSynthInitialized), { timeout: 120000 });
    }
    errs = [];
    const row: any = { file: path.basename(f) };
    try {
      const raw = JSON.parse(fs.readFileSync(f, 'utf8'));
      row.name = raw.metadata?.name;
      const m: any = migratePreset(raw);
      if (!m.success) { row.load = 'migration-failed'; out.push(row); continue; }
      const project = applyPresetV6(m.preset, JSON.parse(JSON.stringify(DEFAULT_PROJECT))).project;
      await Promise.race([page.evaluate(async (p: unknown) => { await (window as any).__visualSynthCaptureApi.applyProject(p); }, project), new Promise((_, rej) => setTimeout(() => rej(new Error('load timeout')), 20000))]);
      await new Promise((r) => setTimeout(r, 4000));
      const d = await page.evaluate(async () => {
        const x = (window as any).__visualSynthCaptureApi.getDiagnostics();
        const rep = x.milkdropCompileReport;
        const codes = (pass: any) => [...(pass?.diagnostics?.issues ?? []), ...(pass?.patchedDiagnostics?.issues ?? [])].map((i: any) => i.code);
        const c = document.getElementById('gl-canvas') as HTMLCanvasElement; const t = document.createElement('canvas'); t.width = 32; t.height = 18; const g = t.getContext('2d')!;
        let prev: Uint8ClampedArray | null = null, lu = 0, mo = 0, n = 0; const t0 = performance.now(); let frames = 0;
        for (let k = 0; k < 10; k++) { g.drawImage(c, 0, 0, 32, 18); const px = g.getImageData(0, 0, 32, 18).data; let l = 0, mm = 0; for (let i = 0; i < px.length; i += 4) { l += (px[i] + px[i + 1] + px[i + 2]) / 3; if (prev) mm += Math.abs(px[i] - prev[i]); } lu += l / 576; if (prev) { mo += mm / 576; n++; } prev = new Uint8ClampedArray(px); await new Promise((r) => requestAnimationFrame(() => { frames++; setTimeout(r, 120); })); }
        return { warp: rep?.warp?.status ?? null, comp: rep?.comp?.status ?? null, codes: [...new Set([...codes(rep?.warp), ...codes(rep?.comp)])], gens: x.activeGeneratorIds, luma: Math.round(lu / 10), motion: +(mo / Math.max(1, n)).toFixed(2), fps: Math.round(frames / ((performance.now() - t0) / 1000)) };
      });
      Object.assign(row, d, { compileError: errs[0] ?? null });
    } catch (e) { row.crash = String((e as Error).message).slice(0, 100); }
    out.push(row);
    if (opt('json')) fs.writeFileSync(opt('json')!, JSON.stringify(out, null, 1));
  }
  await browser.close();
  console.log(`diagnosed ${out.length}`);
})();
