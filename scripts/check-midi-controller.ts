// End-to-end MIDI controller check with a SIMULATED device (no hardware):
// palette pad bank (one-press learn of 16 pads), pad 16 = restore scene
// palette, endless scene dial (cue), take-cue button, absolute palette knob.
// Usage: npm run build && ts-node --transpile-only scripts/check-midi-controller.ts
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
(async () => {
  const project = JSON.parse(fs.readFileSync('showcase-unique-100.project.json', 'utf8'));
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.evaluateOnNewDocument(() => {
    const input: any = { id: 'fake-pad', name: 'Fake 16-pad + dial', type: 'input', onmidimessage: null };
    (window as any).__fakeMidi = input;
    (navigator as any).requestMIDIAccess = async () => ({ inputs: new Map([['fake-pad', input]]), outputs: new Map(), onstatechange: null, sysexEnabled: false });
    (window as any).visualSynth = { listPresets: async () => [], onCloseRequested: () => {}, autosaveProject: async () => ({ saved: false }), closeNodeMidi: async () => {} };
  });
  await page.goto('file://' + path.join(process.cwd(), 'dist/renderer/index.html'), { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean((window as any).__visualSynthInitialized), { timeout: 120000 });
  await page.evaluate(async (p: unknown) => { await (window as any).__visualSynthCaptureApi.applyProject(p); }, project);
  await new Promise((r) => setTimeout(r, 2000));
  const r = await page.evaluate(async () => {
    const w = window as any;
    const send = (bytes: number[]) => w.__fakeMidi.onmidimessage?.({ data: new Uint8Array(bytes), timeStamp: performance.now() });
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const proj = () => w.__visualSynthCaptureApi.getCurrentProject();
    const sel = document.getElementById('midi-device') as HTMLSelectElement;
    const out: Record<string, unknown> = { devices: [...sel.options].map((o) => o.textContent) };
    sel.value = 'fake-pad';
    (document.getElementById('toggle-midi') as HTMLButtonElement | null)?.click();
    [...document.querySelectorAll('button')].find((b) => /Connect MIDI|Start MIDI/i.test(b.textContent ?? ''))?.click();
    await wait(300);
    out.connected = typeof w.__fakeMidi.onmidimessage === 'function';
    const quick = (label: string) => [...document.querySelectorAll('#midi-quick-setup button')].find((b) => b.textContent === label) as HTMLButtonElement;
    out.quickButtons = [...document.querySelectorAll('#midi-quick-setup button')].map((b) => b.textContent);
    // palette pads: press first pad (note 36)
    const activeScene = () => proj().scenes.find((sc: any) => sc.id === proj().activeSceneId);
    const original = activeScene()?.look?.activePaletteId;
    quick('Palette pads (16)').click(); send([0x90, 36, 100]); send([0x80, 36, 0]); await wait(100);
    send([0x90, 40, 100]); send([0x80, 40, 0]); await wait(100);   // pad 5
    out.palettePad5 = proj().activePaletteId === proj().palettes[4]?.id;
    out.sceneRecoloured = activeScene()?.look?.activePaletteId === proj().palettes[4]?.id && original !== proj().palettes[4]?.id;
    send([0x90, 51, 90]); await wait(100);                          // pad 16 = restore
    out.pad16Restored = activeScene()?.look?.activePaletteId === original;
    // scene dial: endless encoder (two's complement), CC 20
    quick('Scene dial').click(); send([0xb0, 20, 1]); await wait(100);
    const cued = () => document.querySelector('.scene-timeline-item.previewed')?.getAttribute('data-scene-id') ?? proj().activeSceneId;
    const startIdx = proj().scenes.findIndex((s: any) => s.id === cued());
    send([0xb0, 20, 1]); send([0xb0, 20, 1]); send([0xb0, 20, 1]); await wait(150);
    const after3 = proj().scenes.findIndex((s: any) => s.id === cued());
    send([0xb0, 20, 127]); await wait(150);
    const back1 = proj().scenes.findIndex((s: any) => s.id === cued());
    out.sceneDial = { startIdx, after3, back1 };
    // take: map note 60, press → cued scene goes live
    quick('Take cue').click(); send([0x90, 60, 100]); await wait(50);
    const cuedId = cued();
    send([0x90, 60, 100]); await wait(300);
    out.take = proj().activeSceneId === cuedId;
    // palette dial in ABSOLUTE mode (ordinary knob), CC 21 sweeping up
    quick('Palette dial').click(); send([0xb0, 21, 40]); await wait(50);
    const p0 = proj().palettes.findIndex((p: any) => p.id === proj().activePaletteId);
    for (let v = 40; v <= 64; v++) send([0xb0, 21, v]);
    await wait(150);
    const p1 = proj().palettes.findIndex((p: any) => p.id === proj().activePaletteId);
    out.paletteDialAbsolute = { from: p0, to: p1 };
    out.mappings = proj().midiMappings.length;
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
})().catch((e) => { console.error(String(e).slice(0, 400)); process.exit(1); });
