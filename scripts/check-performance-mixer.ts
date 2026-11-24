// E2E: the Performance page's Mixer (role weights) must change MilkDrop
// scenes — dimmer below 1, brighter above 1 — and lowering it must fade to
// black, not reveal a fallback/plasma background (2026-11-24 report).
// Usage: npm run build && ts-node --transpile-only scripts/check-performance-mixer.ts
import fs from 'fs';
import os from 'os';
import path from 'path';
import puppeteer from 'puppeteer';
(async () => {
  const project = JSON.parse(fs.readFileSync(path.join(os.homedir(), 'Documents/visualsynth-show-2026-11-21.json'), 'utf8'));
  const wav = fs.readFileSync(path.join(__dirname, 'test-audio-fake.wav')).toString('base64');
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1512, height: 860 });
  await page.evaluateOnNewDocument((w: string) => {
    (navigator as any).requestMIDIAccess = async () => ({ inputs: new Map(), outputs: new Map() });
    navigator.mediaDevices.getUserMedia = async () => { const ctx = new AudioContext(); const dest = ctx.createMediaStreamDestination(); const buf = await ctx.decodeAudioData(Uint8Array.from(atob(w), (c) => c.charCodeAt(0)).buffer); await ctx.resume(); const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.connect(dest); s.start(); return dest.stream; };
    (window as any).visualSynth = { listPresets: async () => [], onCloseRequested: () => {}, autosaveProject: async () => ({ saved: false }), checkAssetPaths: async (p: string[]) => Object.fromEntries(p.map((x) => [x, true])), setOutputConfig: async (c: any) => ({ ...c, enabled: false }), openOutput: async (c: any) => ({ opened: false, config: c }), closeOutput: async () => ({ closed: true }) };
    (window as any).__vsDisablePrewarm = true;
    (window as any).__vsDisableBeatPulse = true;
  }, wav);
  await page.goto('file://' + path.join(process.cwd(), 'dist/renderer/index.html'), { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean((window as any).__visualSynthInitialized), { timeout: 120000 });
  await page.evaluate(async (p: unknown) => { await (window as any).__visualSynthCaptureApi.applyProject(p); }, project);
  await new Promise((r) => setTimeout(r, 1500));
  const target = project.scenes.find((s: any) => s.name === 'Mashup (341)');
  await page.evaluate((id: string) => (window as any).__visualSynthCaptureApi.applyScene(id), target.id);
  await page.click('.mode-button[data-mode="performance"]');
  await new Promise((r) => setTimeout(r, 3000));
  const luma = () => page.evaluate(async () => {
    const c = document.getElementById('gl-canvas') as HTMLCanvasElement; const t = document.createElement('canvas'); t.width = 48; t.height = 27; const x = t.getContext('2d')!;
    let sum = 0; for (let k = 0; k < 8; k++) { x.drawImage(c, 0, 0, 48, 27); const d = x.getImageData(0, 0, 48, 27).data; for (let i = 0; i < d.length; i += 4) sum += (d[i] + d[i + 1] + d[i + 2]) / 3; await new Promise((r) => setTimeout(r, 80)); }
    return Math.round(sum / 8 / (48 * 27));
  });
  const set = (v: number) => page.evaluate((val: number) => { const el = document.getElementById('mix-role-core') as HTMLInputElement; el.value = String(val); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, v);
  const out: Record<string, number> = {};
  for (const v of [1, 0.25, 0.5, 1.55, 2, 1]) { await set(v); await new Promise((r) => setTimeout(r, 1200)); out[`core ${v}`] = await luma(); }
  console.log(JSON.stringify(out));
  const pass = out['core 0.25'] < out['core 0.5'] && out['core 0.5'] < out['core 1'] && out['core 1.55'] > out['core 1'] && out['core 0.25'] <= out['core 1'] * 0.45;
  console.log(pass ? 'PASS' : 'FAIL');
  await browser.close();
  process.exit(pass ? 0 : 1);
})();
