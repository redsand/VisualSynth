// E2E: the timed slideshow walks EVERY scene in the show, in order, holding
// each for the "Seconds per scene" value. (At the 2026-11-21 show it cycled
// only the 14 Live pads and read the box as bars: 16s regardless.)
// Usage: npm run build && ts-node --transpile-only scripts/check-slideshow-timing.ts [show.json]
import fs from 'fs';
import os from 'os';
import path from 'path';
import puppeteer from 'puppeteer';
const file = process.argv[2] ?? path.join(os.homedir(), 'Documents/visualsynth-show-2026-11-21.json');
const SECONDS = 3;
(async () => {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const project = raw.project ?? raw;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    (navigator as any).requestMIDIAccess = async () => ({ inputs: new Map(), outputs: new Map() });
    (window as any).visualSynth = { listPresets: async () => [], onCloseRequested: () => {}, autosaveProject: async () => ({ saved: false }), checkAssetPaths: async (p: string[]) => Object.fromEntries(p.map((x) => [x, true])), setOutputConfig: async (c: any) => ({ ...c, enabled: false }), openOutput: async (c: any) => ({ opened: false, config: c }), closeOutput: async () => ({ closed: true }), getSessionId: async () => 'e2e', writeSessionLog: (e: unknown) => { ((window as any).__logs ??= []).push(e); } };
    (window as any).__vsDisablePrewarm = true;
  });
  await page.goto('file://' + path.join(process.cwd(), 'dist/renderer/index.html'), { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean((window as any).__visualSynthInitialized), { timeout: 120000 });
  await page.evaluate(async (p: unknown) => { await (window as any).__visualSynthCaptureApi.applyProject(p); }, project);
  await new Promise((r) => setTimeout(r, 2000));
  const label = await page.evaluate((secs: number) => {
    (document.querySelector('.mode-button-live') as HTMLButtonElement).click();
    const box = document.getElementById('live-playlist-duration') as HTMLInputElement;
    const text = box.closest('label')?.textContent?.trim().split('\n')[0] ?? '';
    box.value = String(secs);
    box.dispatchEvent(new Event('change', { bubbles: true }));
    (document.getElementById('live-playlist-play') as HTMLButtonElement).click();
    return text;
  }, SECONDS);
  // Watch long enough to pass well beyond the 16 Live pads.
  const watchScenes = Math.min(project.scenes.length, 20);
  await new Promise((r) => setTimeout(r, (watchScenes * SECONDS + 2) * 1000));
  const r = await page.evaluate(() => {
    const logs = (window as any).__logs as any[];
    const steps = logs.filter((e) => e.event === 'live.slideshow_scene');
    const sw = logs.filter((e) => e.event === 'scene.switch' && String(e.data.trigger).includes('slideshow'));
    const gaps = steps.slice(1).map((e, i) => (e.ts - steps[i].ts) / 1000);
    return { started: logs.find((e) => e.event === 'live.playlist_started')?.data, steps: steps.length, order: steps.map((e) => e.data.index), of: steps[0]?.data.of, gaps, switches: sw.length };
  });
  const sorted = [...r.gaps].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const inOrder = r.order.every((n: number, i: number) => i === 0 || n === r.order[i - 1] + 1);
  console.log(`label: "${label}"`);
  console.log(`started: ${JSON.stringify(r.started)}`);
  console.log(`advanced ${r.steps} times, scene index ${r.order[0]}..${r.order[r.order.length - 1]} of ${r.of}, in order: ${inOrder}`);
  console.log(`seconds between scenes: median ${median}, min ${sorted[0]}, max ${sorted[sorted.length - 1]} (set to ${SECONDS})`);
  const pass = r.of === project.scenes.length && r.order[r.order.length - 1] > 16 && inOrder && Math.abs(median - SECONDS) < 0.5;
  console.log(pass ? 'PASS' : 'FAIL');
  await browser.close();
  process.exit(pass ? 0 : 1);
})();
