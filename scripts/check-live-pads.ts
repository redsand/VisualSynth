// End-to-end check of Live scene pads (no hardware): Fill from show fills 16
// pads; a pad key cuts to that pad's scene; the scene timeline is NEVER
// changed (same scenes, same order); pads survive a project save/reload.
// Usage: npm run build && ts-node --transpile-only scripts/check-live-pads.ts
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
(async () => {
  const project = JSON.parse(fs.readFileSync('showcase-unique-100.project.json', 'utf8'));
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1470, height: 860 });
  await page.evaluateOnNewDocument(() => {
    (navigator as any).requestMIDIAccess = async () => ({ inputs: new Map(), outputs: new Map() });
    (window as any).visualSynth = { listPresets: async () => [], onCloseRequested: () => {}, autosaveProject: async () => ({ saved: false }), checkAssetPaths: async (p: string[]) => Object.fromEntries(p.map((x) => [x, true])) };
  });
  await page.goto('file://' + path.join(process.cwd(), 'dist/renderer/index.html'), { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean((window as any).__visualSynthInitialized), { timeout: 120000 });
  await page.evaluate(async (p: unknown) => { await (window as any).__visualSynthCaptureApi.applyProject(p); }, project);
  await new Promise((r) => setTimeout(r, 1500));
  const r = await page.evaluate(async () => {
    const w = window as any;
    const api = w.__visualSynthCaptureApi;
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const order = () => api.getCurrentProject().scenes.map((s: any) => s.id).join(',');
    [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Live')?.click();
    await wait(400);
    const before = order();
    (document.getElementById('live-pads-fill') as HTMLButtonElement).click();
    await wait(200);
    const pads = api.getCurrentProject().livePads ?? [];
    const padButtons = document.querySelectorAll('#live-pad-grid .live-pad').length;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '3', bubbles: true }));
    await wait(600);
    const activeAfterKey = api.getCurrentProject().activeSceneId;
    const after = order();
    // save/reload round trip through the project schema
    const saved = JSON.parse(JSON.stringify(api.getCurrentProject()));
    await api.applyProject(saved);
    await wait(500);
    return {
      padButtons,
      filled: pads.filter(Boolean).length,
      key3CutToPad3: activeAfterKey === pads[2],
      timelineUnchanged: before === after,
      sceneCount: api.getCurrentProject().scenes.length,
      padsSurviveReload: (api.getCurrentProject().livePads ?? []).filter(Boolean).length
    };
  });
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
})().catch((e) => { console.error(String(e).slice(0, 400)); process.exit(1); });
