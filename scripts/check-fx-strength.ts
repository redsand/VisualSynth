// How visible is each of the 8 Scene FX (0% vs 100%) on MilkDrop and
// generator scenes? Reports picture change relative to the scene's own
// frame-to-frame motion, so "barely visible" and "does nothing" show up.
// Usage: npm run build && ts-node --transpile-only scripts/check-fx-strength.ts [scene names...]
import fs from 'fs';
import os from 'os';
import path from 'path';
import puppeteer from 'puppeteer';
const SHOTS = process.env.FX_SHOTS ?? '';
const FX = ['effects.kaleidoscope', 'effects.feedback', 'effects.persistence', 'effects.chroma', 'effects.bloom', 'effects.blur', 'effects.posterize', 'style.paletteShift'];
const LABEL: Record<string, string> = { 'effects.kaleidoscope': 'Kaleidoscope', 'effects.feedback': 'Twist', 'effects.persistence': 'Zoom', 'effects.chroma': 'Chroma', 'effects.bloom': 'Glow', 'effects.blur': 'Blur', 'effects.posterize': 'Posterize', 'style.paletteShift': 'Hue' };
(async () => {
  const project = JSON.parse(fs.readFileSync(path.join(os.homedir(), 'Documents/visualsynth-show-2026-11-21.json'), 'utf8'));
  const wanted = process.argv.slice(2);
  const scenes = (wanted.length ? wanted : ['01_MW_new05a', 'Mashup (341)', 'Hillshade', 'Liquid Canvas'])
    .map((n) => project.scenes.find((s: any) => s.name === n)).filter(Boolean);
  const wav = fs.readFileSync(path.join(__dirname, 'test-audio-fake.wav')).toString('base64');
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1512, height: 860 });
  await page.evaluateOnNewDocument((w: string) => {
    (navigator as any).requestMIDIAccess = async () => ({ inputs: new Map(), outputs: new Map() });
    if (navigator.mediaDevices) {
      navigator.mediaDevices.getUserMedia = async () => {
        const ctx = new AudioContext(); const dest = ctx.createMediaStreamDestination();
        try { const buf = await ctx.decodeAudioData(Uint8Array.from(atob(w), (c) => c.charCodeAt(0)).buffer); if (ctx.state === 'suspended') await ctx.resume(); const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; src.connect(dest); src.start(); } catch { /* silent */ }
        return dest.stream;
      };
      (navigator.mediaDevices as any).enumerateDevices = async () => [{ deviceId: 'default', kind: 'audioinput', label: 'fx probe' }];
    }
    (window as any).visualSynth = { listPresets: async () => [], onCloseRequested: () => {}, autosaveProject: async () => ({ saved: false }), checkAssetPaths: async (p: string[]) => Object.fromEntries(p.map((x) => [x, true])), setOutputConfig: async (c: any) => ({ ...c, enabled: false }), openOutput: async (c: any) => ({ opened: false, config: c }), closeOutput: async () => ({ closed: true }) };
    (window as any).__vsDisablePrewarm = true;
    (window as any).__vsDisableBeatPulse = true;
  }, wav);
  await page.goto('file://' + path.join(process.cwd(), 'dist/renderer/index.html'), { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean((window as any).__visualSynthInitialized), { timeout: 120000 });
  await page.evaluate(async (p: unknown) => { await (window as any).__visualSynthCaptureApi.applyProject(p); }, project);
  await new Promise((r) => setTimeout(r, 2000));
  await page.click('.mode-button[data-mode="mixer"]');
  // Mean absolute pixel difference between the average of N frames at 0% and
  // at 100%, vs. between two N-frame averages both at 0% (the motion floor).
  const avgFrames = (n: number) => page.evaluate(async (count: number) => {
    const c = document.getElementById('gl-canvas') as HTMLCanvasElement; const t = document.createElement('canvas'); t.width = 48; t.height = 27; const x = t.getContext('2d')!;
    const acc = new Float32Array(48 * 27 * 3);
    for (let k = 0; k < count; k++) { x.drawImage(c, 0, 0, 48, 27); const d = x.getImageData(0, 0, 48, 27).data; for (let i = 0, j = 0; i < d.length; i += 4, j += 3) { acc[j] += d[i]; acc[j + 1] += d[i + 1]; acc[j + 2] += d[i + 2]; } await new Promise((r) => setTimeout(r, 60)); }
    return Array.from(acc, (v) => v / count);
  }, n);
  const diff = (a: number[], b: number[]) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0) / a.length;
  const set = (target: string, pct: number) => page.evaluate((t: string, v: number) => {
    const el = document.getElementById(`mixer-fx-${t.replace(/\W+/g, '-')}`) as HTMLInputElement; el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true }));
  }, target, pct);
  for (const scene of scenes as any[]) {
    await page.evaluate((id: string) => (window as any).__visualSynthCaptureApi.applyScene(id), scene.id);
    await new Promise((r) => setTimeout(r, 2500));
    for (const t of FX) await set(t, t === 'style.paletteShift' ? 50 : 0);
    await new Promise((r) => setTimeout(r, 800));
    const kind = scene._shaderData ? 'MilkDrop' : 'generator';
    const results: string[] = [];
    for (const t of FX) {
      const rest = t === 'style.paletteShift' ? 50 : 0;
      const a = await avgFrames(6); const b = await avgFrames(6);
      await set(t, t === 'style.paletteShift' ? 100 : 100); await new Promise((r) => setTimeout(r, 900));
      const c = await avgFrames(6);
      if (SHOTS && ['effects.bloom', 'effects.chroma', 'style.paletteShift'].includes(t)) {
        const tag = `${String(scene.name).replace(/\W+/g, '_').slice(0, 14)}-${LABEL[t]}`;
        const grab = () => page.evaluate(() => (document.getElementById('gl-canvas') as HTMLCanvasElement).toDataURL('image/png'));
        fs.writeFileSync(`${SHOTS}/${tag}-on.png`, Buffer.from((await grab()).split(',')[1], 'base64'));
        await set(t, rest); await new Promise((r) => setTimeout(r, 700));
        fs.writeFileSync(`${SHOTS}/${tag}-off.png`, Buffer.from((await grab()).split(',')[1], 'base64'));
        await set(t, 100); await new Promise((r) => setTimeout(r, 300));
      }
      await set(t, rest); await new Promise((r) => setTimeout(r, 700));
      const floor = Math.max(0.5, diff(a, b)); const change = diff(b, c);
      const ratio = change / floor;
      results.push(`${LABEL[t]} ${ratio >= 3 ? 'clear' : ratio >= 1.5 ? 'subtle' : 'NONE'}(${ratio.toFixed(1)}x)`);
    }
    console.log(`${String(scene.name).slice(0, 18).padEnd(18)} [${kind}]  ${results.join('  ')}`);
  }
  await browser.close();
})();
