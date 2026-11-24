// E2E: with rotation on, each NEW song moves to the NEXT scene in the
// timeline and loops to the first after the last — even with a stale saved
// one-scene list (live report 2026-11-24: every song went to the first scene).
// Usage: npm run build && ts-node --transpile-only scripts/check-rotation.ts
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
    // Saved settings with a STALE one-scene rotation list, as on the user's machine.
    let settings: any = { slideshowEnabled: true, slideshowSceneIds: ['scene-1'], autoCreateOverlays: true };
    (window as any).visualSynth = {
      listPresets: async () => [], onCloseRequested: () => {}, autosaveProject: async () => ({ saved: false }),
      checkAssetPaths: async (p: string[]) => Object.fromEntries(p.map((x) => [x, true])),
      setOutputConfig: async (c: any) => ({ ...c, enabled: false }), openOutput: async (c: any) => ({ opened: false, config: c }), closeOutput: async () => ({ closed: true }),
      getNowPlayingSettings: async () => settings, enrichNowPlayingArtwork: async () => ({}), cacheNowPlayingArtwork: async () => ({ cached: false }), getEmbeddedArtwork: async () => ({}), saveNowPlayingSettings: async (s: any) => (settings = { ...settings, ...s })
    };
    (window as any).__vsDisablePrewarm = true;
  });
  await page.goto('file://' + path.join(process.cwd(), 'dist/renderer/index.html'), { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean((window as any).__visualSynthInitialized), { timeout: 120000 });
  await page.evaluate(async (p: unknown) => { await (window as any).__visualSynthCaptureApi.applyProject(p); }, project);
  await new Promise((r) => setTimeout(r, 1500));
  const r = await page.evaluate(async () => {
    const api = (window as any).__visualSynthCaptureApi;
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const active = () => { const p = api.getCurrentProject(); return p.scenes.find((s: any) => s.id === p.activeSceneId)?.name; };
    // Start two scenes before the end, so the run crosses the loop point.
    const scenes = api.getCurrentProject().scenes;
    const start = scenes[scenes.length - 2].id;
    await api.applyScene(start); await wait(800);
    const seen = [active()];
    for (const [t, a] of [['Song One', 'A'], ['Song Two', 'B'], ['Song Three', 'C'], ['Song Four', 'D']]) {
      await api.simulateRecognizedTrack(t, a);
      await wait(4500); // switches are queued to the next bar
      seen.push(active());
    }
    const count = document.getElementById('topbar-rotation-count')?.textContent;
    const names = scenes.map((x: any) => x.name);
    const n = names.length;
    const expected = [n - 2, n - 1, 0, 1, 2].map((i) => names[i]); // next in timeline, loop to first
    return { seen, expected, rotationCount: count, total: n };
  });
  console.log(JSON.stringify(r));
  const pass = JSON.stringify(r.seen) === JSON.stringify(r.expected) && Number(r.rotationCount) === r.total;
  console.log(pass ? 'PASS' : 'FAIL');
  await browser.close();
  process.exit(pass ? 0 : 1);
})();
