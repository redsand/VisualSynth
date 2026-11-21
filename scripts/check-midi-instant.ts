// E2E: a brand-new controller (no profile) is useful from its first press.
// Pad 1 press → 16 scene pads mapped (and Live pads filled); pad 5 → cuts to
// scene pad 5; first press on another 16-note bank → palettes; that bank's
// pad 5 → palette 5. Simulated device, no hardware.
// Usage: npm run build && ts-node --transpile-only scripts/check-midi-instant.ts
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
(async () => {
  const project = JSON.parse(fs.readFileSync('showcase-unique-100.project.json', 'utf8'));
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.evaluateOnNewDocument(() => {
    const input: any = { id: 'jp1', name: 'JP-1', type: 'input', onmidimessage: null };
    (window as any).__fakeMidi = input;
    try { localStorage.removeItem('vs.midiProfiles.v1'); } catch { /* fresh */ }
    (navigator as any).requestMIDIAccess = async () => ({ inputs: new Map([['jp1', input]]), outputs: new Map() });
    (window as any).visualSynth = { listPresets: async () => [], onCloseRequested: () => {}, autosaveProject: async () => ({ saved: false }), closeNodeMidi: async () => {} };
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
    (document.getElementById('midi-device') as HTMLSelectElement).value = 'jp1';
    (document.getElementById('toggle-midi') as HTMLButtonElement).click();
    await wait(300);
    const statusAfterConnect = document.getElementById('status')?.textContent ?? '';
    send([0x90, 36, 100]); send([0x80, 36, 0]); await wait(300);
    const sceneMaps = proj().midiMappings.filter((m: any) => m.target.startsWith('livepad.slot.')).length;
    const padsFilled = (proj().livePads ?? []).filter(Boolean).length;
    send([0x90, 40, 100]); await wait(600);
    const cutToPad5 = proj().activeSceneId === (proj().livePads ?? [])[4];
    send([0x90, 52, 100]); send([0x80, 52, 0]); await wait(300);
    const paletteMaps = proj().midiMappings.filter((m: any) => m.target.startsWith('palette.slot.')).length;
    send([0x90, 56, 100]); await wait(300);
    const palette5 = proj().activePaletteId === proj().palettes[4]?.id;
    // 8 dials: first knob turned maps CC 70-77 to the FX; FX are per scene.
    const pads = proj().livePads;
    send([0x90, 36, 100]); await wait(700); // cut to pad 1
    const snap = () => { const c = document.getElementById('gl-canvas') as HTMLCanvasElement; const t = document.createElement('canvas'); t.width = 32; t.height = 18; const x = t.getContext('2d')!; x.drawImage(c, 0, 0, 32, 18); return Array.from(x.getImageData(0, 0, 32, 18).data); };
    send([0xb0, 70, 0]); await wait(300);
    const dialMaps = proj().midiMappings.filter((m: any) => m.message === 'cc').length;
    const before = snap();
    send([0xb0, 70, 127]); await wait(400);                    // dial 1 = kaleidoscope full
    const after = snap();
    const hudText = document.querySelector('.control-hud.visible')?.textContent ?? null;
    let diff = 0; for (let i = 0; i < before.length; i += 4) diff += Math.abs(before[i] - after[i]) + Math.abs(before[i + 1] - after[i + 1]);
    const kaleidoOnPad1 = (proj().scenes.find((sc: any) => sc.id === pads[0])?.look?.effects?.kaleidoscope ?? 0);
    send([0x90, 37, 100]); await wait(700);                     // pad 2
    const kaleidoOnPad2 = proj().effects?.kaleidoscope ?? 0;
    send([0x90, 36, 100]); await wait(700);                     // back to pad 1
    const kaleidoBackOnPad1 = proj().effects?.kaleidoscope ?? 0;
    return { statusAfterConnect: statusAfterConnect.slice(0, 90), sceneMaps, padsFilled, cutToPad5, paletteMaps, palette5,
      hudText, dialMaps, dialVisiblyChangesMilkwave: +(diff / (before.length / 4)).toFixed(1), kaleidoOnPad1, kaleidoOnPad2, kaleidoBackOnPad1 };
  });
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
})().catch((e) => { console.error(String(e).slice(0, 300)); process.exit(1); });
