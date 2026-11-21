// E2E: the "Skip scene" button. Learn it from MIDI quick setup on a simulated
// JP-1, then: rotation off → next scene in the project; rotation on → next
// scene in the rotation list; Shift+N does the same from the keyboard.
// Usage: npm run build && ts-node --transpile-only scripts/check-scene-skip.ts [--project=<file>]
import fs from 'fs';
import os from 'os';
import path from 'path';
import puppeteer from 'puppeteer';
const projectPath = process.argv.find((a) => a.startsWith('--project='))?.slice(10)
  ?? path.join(os.homedir(), 'Documents/visualsynth-show-2026-11-21.json');
(async () => {
  const raw = JSON.parse(fs.readFileSync(projectPath, 'utf8'));
  const project = raw.project ?? raw;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.evaluateOnNewDocument(() => {
    const input: any = { id: 'jp1', name: 'JP-1', type: 'input', onmidimessage: null };
    (window as any).__fakeMidi = input;
    try { localStorage.removeItem('vs.midiProfiles.v1'); } catch { /* fresh */ }
    (navigator as any).requestMIDIAccess = async () => ({ inputs: new Map([['jp1', input]]), outputs: new Map() });
    (window as any).visualSynth = {
      listPresets: async () => [], onCloseRequested: () => {}, autosaveProject: async () => ({ saved: false }), closeNodeMidi: async () => {},
      saveNowPlayingSettings: async (s: unknown) => s,
      checkAssetPaths: async (p: string[]) => Object.fromEntries(p.map((x) => [x, true])),
      setOutputConfig: async (c: any) => ({ ...c, enabled: false }), openOutput: async (c: any) => ({ opened: false, config: c }), closeOutput: async () => ({ closed: true })
    };
  });
  await page.goto('file://' + path.join(process.cwd(), 'dist/renderer/index.html'), { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean((window as any).__visualSynthInitialized), { timeout: 120000 });
  await page.evaluate(async (p: unknown) => { await (window as any).__visualSynthCaptureApi.applyProject(p); }, project);
  await new Promise((r) => setTimeout(r, 1500));
  const r = await page.evaluate(async () => {
    const w = window as any; const api = w.__visualSynthCaptureApi;
    const send = (b: number[]) => w.__fakeMidi.onmidimessage?.({ data: new Uint8Array(b), timeStamp: performance.now() });
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const proj = () => api.getCurrentProject();
    const idx = () => proj().scenes.findIndex((s: any) => s.id === proj().activeSceneId);
    (document.getElementById('midi-device') as HTMLSelectElement).value = 'jp1';
    (document.getElementById('toggle-midi') as HTMLButtonElement).click();
    await wait(300);
    const learnButton = Array.from(document.querySelectorAll('#midi-quick-setup button'))
      .find((b) => b.textContent?.trim() === 'Skip scene') as HTMLButtonElement | undefined;
    if (!learnButton) return { error: 'Skip scene learn button missing' };
    learnButton.click(); await wait(100);
    send([0x90, 60, 100]); send([0x80, 60, 0]); await wait(300);
    const mapped = proj().midiMappings.filter((m: any) => m.target === 'scene.skip').length;
    // Rotation off: steps through the project.
    (document.querySelector('.mode-button-live') as HTMLButtonElement).click(); await wait(400);
    (document.activeElement as HTMLElement | null)?.blur?.();
    const i0 = idx();
    send([0x90, 60, 100]); send([0x80, 60, 0]); await wait(700);
    const i1 = idx();
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'N', shiftKey: true, bubbles: true }));
    await wait(700);
    const i2 = idx();
    // Rotation on: skip follows the rotation list (all scenes when none chosen).
    let saved: any = null;
    const realSave = w.visualSynth.saveNowPlayingSettings;
    w.visualSynth.saveNowPlayingSettings = async (s: any) => { saved = s; return realSave(s); };
    (document.getElementById('topbar-rotation') as HTMLButtonElement)?.click(); await wait(300);
    const rotationIds: string[] = saved?.slideshowSceneIds ?? [];
    const rotationOn = Boolean(saved?.slideshowEnabled);
    send([0x90, 60, 100]); send([0x80, 60, 0]); await wait(700);
    const a = proj().activeSceneId;
    send([0x90, 60, 100]); send([0x80, 60, 0]); await wait(700);
    const b = proj().activeSceneId;
    const status = document.getElementById('status')?.textContent ?? '';
    return { mapped, offStep1: i1 - i0, offStep2Keyboard: i2 - i1, rotationOn, rotationIdsKnown: rotationIds.length,
      onA: a, onB: b, onAdvancedAlongList: rotationIds.indexOf(b) === (rotationIds.indexOf(a) + 1) % rotationIds.length, status: status.slice(0, 80) };
  });
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
})().catch((e) => { console.error(String(e).slice(0, 300)); process.exit(1); });
