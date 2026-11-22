// E2E (the 2026-11-22 report): with the Output window CLOSED, single-click a
// scene card, open the Mixer tab, drag Kaleidoscope — the clicked scene must
// be the live one and the preview must visibly change.
// Usage: npm run build && ts-node --transpile-only scripts/check-click-then-fx.ts
import fs from 'fs';
import os from 'os';
import path from 'path';
import puppeteer from 'puppeteer';
(async () => {
  const project = JSON.parse(fs.readFileSync(path.join(os.homedir(), 'Documents/visualsynth-show-2026-11-21.json'), 'utf8'));
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1512, height: 860 });
  await page.evaluateOnNewDocument(() => {
    (navigator as any).requestMIDIAccess = async () => ({ inputs: new Map(), outputs: new Map() });
    (window as any).visualSynth = { listPresets: async () => [], onCloseRequested: () => {}, autosaveProject: async () => ({ saved: false }), checkAssetPaths: async (p: string[]) => Object.fromEntries(p.map((x) => [x, true])), setOutputConfig: async (c: any) => ({ ...c, enabled: false }), openOutput: async (c: any) => ({ opened: false, config: c }), closeOutput: async () => ({ closed: true }) };
    (window as any).__vsDisablePrewarm = true;
    (window as any).__vsDisableBeatPulse = true;
  });
  await page.goto('file://' + path.join(process.cwd(), 'dist/renderer/index.html'), { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean((window as any).__visualSynthInitialized), { timeout: 120000 });
  await page.evaluate(async (p: unknown) => { await (window as any).__visualSynthCaptureApi.applyProject(p); }, project);
  await new Promise((r) => setTimeout(r, 2000));
  const target = project.scenes.find((s: any) => s.name === 'Hillshade') ?? project.scenes[2];
  // The user's exact steps: one click on the card, then Mixer, then drag.
  await page.click(`.scene-timeline-item[data-scene-id="${target.id}"]`);
  await new Promise((r) => setTimeout(r, 1500));
  await page.click('.mode-button[data-mode="mixer"]');
  await new Promise((r) => setTimeout(r, 800));
  const snap = () => page.evaluate(() => { const c = document.getElementById('gl-canvas') as HTMLCanvasElement; const t = document.createElement('canvas'); t.width = 48; t.height = 27; const x = t.getContext('2d')!; x.drawImage(c, 0, 0, 48, 27); return Array.from(x.getImageData(0, 0, 48, 27).data); });
  const diff = (a: number[], b: number[]) => { let d = 0; for (let i = 0; i < a.length; i += 4) d += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); return d / (a.length / 4) / 3; };
  const state = await page.evaluate(() => { const p = (window as any).__visualSynthCaptureApi.getCurrentProject(); return { active: p.scenes.find((s: any) => s.id === p.activeSceneId)?.name }; });
  const n1 = await snap(); await new Promise((r) => setTimeout(r, 400)); const n2 = await snap();
  const el = (await page.$('#mixer-fx-effects-kaleidoscope'))!;
  await el.evaluate((e) => (e as HTMLElement).scrollIntoView({ block: 'center' }));
  const box = (await el.boundingBox())!;
  const before = await snap();
  await page.mouse.move(box.x + 2, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2, { steps: 10 }); await page.mouse.up();
  await new Promise((r) => setTimeout(r, 800));
  const after = await snap();
  const noise = diff(n1, n2);
  const change = diff(before, after);
  console.log(`clicked "${target.name}" -> live scene "${state.active}"`);
  console.log(`preview change from Kaleidoscope: ${change.toFixed(1)} (normal motion ${noise.toFixed(1)})`);
  const pass = state.active === target.name && change > noise * 2;
  console.log(pass ? 'PASS' : 'FAIL');
  await browser.close();
  process.exit(pass ? 0 : 1);
})();
