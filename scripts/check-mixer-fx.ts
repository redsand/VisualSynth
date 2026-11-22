// E2E: the Mixer tab's right pane shows the 8 FX sliders, a slider changes
// the effect, and the value is kept per scene (like the controller dials).
// Usage: npm run build && ts-node --transpile-only scripts/check-mixer-fx.ts
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
  });
  await page.goto('file://' + path.join(process.cwd(), 'dist/renderer/index.html'), { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean((window as any).__visualSynthInitialized), { timeout: 120000 });
  await page.evaluate(async (p: unknown) => { await (window as any).__visualSynthCaptureApi.applyProject(p); }, project);
  await new Promise((r) => setTimeout(r, 2000));
  const r = await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const api = (window as any).__visualSynthCaptureApi;
    (document.querySelector('.mode-button[data-mode="mixer"]') as HTMLButtonElement).click();
    await wait(500);
    const rows = Array.from(document.querySelectorAll('#mixer-fx-controls .mixer-fx-row')).map((r) => r.querySelector('.mixer-fx-name')?.textContent);
    const slider = document.getElementById('mixer-fx-effects-kaleidoscope') as HTMLInputElement;
    const sceneA = api.getCurrentProject().activeSceneId;
    slider.value = '100';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    await wait(300);
    const kaleidoA = api.getCurrentProject().effects?.kaleidoscope;
    const savedOnA = api.getCurrentProject().scenes.find((s: any) => s.id === sceneA)?.look?.effects?.kaleidoscope;
    const sceneB = api.getCurrentProject().scenes[3].id;
    await api.applyScene(sceneB);
    await wait(1200);
    const sliderOnB = slider.value;
    await api.applyScene(sceneA);
    await wait(1200);
    const sliderBackOnA = slider.value;
    const visible = !document.getElementById('mode-mixer-right')!.classList.contains('hidden');
    return { visible, rows, kaleidoA, savedOnA, sliderOnB, sliderBackOnA };
  });
  console.log(JSON.stringify(r));
  const pass = r.visible && r.rows.length === 8 && r.kaleidoA > 0.9 && r.savedOnA > 0.9 && r.sliderOnB !== '100' && r.sliderBackOnA === '100';
  console.log(pass ? 'PASS' : 'FAIL');
  await page.screenshot({ path: process.argv[2] ?? '/tmp/mixer.png' });
  await browser.close();
  process.exit(pass ? 0 : 1);
})();
