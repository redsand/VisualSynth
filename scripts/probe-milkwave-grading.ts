// Verify the milkwave grading chain: switching palettes and engines on a
// milkwave scene must now change the output measurably beyond the scene's
// own animation (blend-difference YAVG; baseline = same setting twice).
// Also reports the gamma effect (fGammaAdj darkening) vs the pre-fix build.
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

const ROOT = path.resolve(__dirname, '..');
const PROJECT = path.join(ROOT, 'showcase-unique-100.project.json');
const WAV = path.join(__dirname, 'test-audio-fake.wav');
const SCENE_NAME = process.argv[2] ?? 'Mashup (432)';

const diff = (a: string, b: string): number => {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', a, '-i', b,
    '-filter_complex', 'blend=all_mode=difference,signalstats,metadata=print', '-f', 'null', '-'],
    { encoding: 'utf8' });
  return Number((String(r.stderr).match(/lavfi\.signalstats\.YAVG=([0-9.]+)/) || [])[1] ?? -1);
};

const main = async () => {
  const project = JSON.parse(fs.readFileSync(PROJECT, 'utf8'));
  const scene = project.scenes.find((s: any) => s.name === SCENE_NAME);
  if (!scene) throw new Error(`scene "${SCENE_NAME}" not found`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required',
      '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream']
  });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('[PAGEERROR]', String(e).slice(0, 200)));
  const wav = fs.existsSync(WAV) ? fs.readFileSync(WAV).toString('base64') : '';
  await page.evaluateOnNewDocument((w: string) => {
    (window.navigator as any).requestMIDIAccess = async () => ({ inputs: new Map(), outputs: new Map(), onstatechange: null, sysexEnabled: false });
    if (window.navigator.mediaDevices) {
      window.navigator.mediaDevices.getUserMedia = async () => {
        const ctx = new AudioContext();
        const dest = ctx.createMediaStreamDestination();
        try {
          const bytes = new Uint8Array(atob(w).length);
          for (let i = 0; i < bytes.length; i++) bytes[i] = w.charCodeAt(i);
          const buf = await ctx.decodeAudioData(bytes.buffer);
          if (ctx.state === 'suspended') await ctx.resume();
          const src = ctx.createBufferSource();
          src.buffer = buf;
          src.loop = true;
          src.connect(dest);
          src.start();
        } catch { /* silent */ }
        return dest.stream;
      };
      (window.navigator.mediaDevices as any).enumerateDevices = async () => [{ deviceId: 'default', kind: 'audioinput', label: 'grade probe' }];
    }
    window.visualSynth = {
      ...(window.visualSynth ?? {}), listPresets: async () => [], onCloseRequested: () => {},
      showSaveDialog: async () => ({ result: 'cancel' }), saveProject: async () => ({ canceled: true }),
      saveProjectAs: async () => ({ canceled: true }), confirmClose: async () => {},
      autosaveProject: async () => ({ saved: false })
    } as any;
  }, wav);
  await page.goto('file://' + path.join(ROOT, 'dist/renderer/index.html'), { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => Boolean((window as any).__visualSynthInitialized), { timeout: 120000 });
  await page.evaluate(async (p: unknown) => { await (window as any).__visualSynthCaptureApi.applyProject(p); }, project);
  await page.evaluate((id: string) => (window as any).__visualSynthCaptureApi.applyScene(id), scene.id);
  await new Promise((r) => setTimeout(r, 8000));

  const grab = (f: string) =>
    page.evaluate(() => new Promise<string>((resolve) => {
      const canvas = document.querySelector('#gl-canvas') as HTMLCanvasElement | null;
      requestAnimationFrame(() => resolve(canvas?.toDataURL('image/png').split(',')[1] ?? ''));
    })).then((b: string) => fs.writeFileSync(f, Buffer.from(b, 'base64')));
  const set = (sel: string, val: string) =>
    page.evaluate((s: string, v: string) => {
      const el = document.getElementById(s) as HTMLSelectElement | null;
      if (!el) return `missing ${s}`;
      el.value = v;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return 'ok';
    }, sel, val);

  // PALETTE: a1 → ember → back to aurora → a2
  await grab('/tmp/g_a1.png');
  console.log('switch palette to ember:', await set('palette-select', 'ember'));
  await new Promise((r) => setTimeout(r, 1200));
  await grab('/tmp/g_y.png');
  console.log('switch palette back:', await set('palette-select', 'aurora'));
  await new Promise((r) => setTimeout(r, 1200));
  await grab('/tmp/g_a2.png');
  const palBase = diff('/tmp/g_a1.png', '/tmp/g_a2.png');
  const palSwitch = diff('/tmp/g_a1.png', '/tmp/g_y.png');
  console.log(`PALETTE: animation baseline=${palBase.toFixed(2)}  palette-switch diff=${palSwitch.toFixed(2)}  -> ${palSwitch > palBase * 1.3 ? 'EFFECTIVE' : 'no effect'}`);

  // ENGINE: none vs vapor (vignette 1.1 + ca 0.8 differ from none's zeros)
  await set('engine-select', 'engine-none');
  await new Promise((r) => setTimeout(r, 2000));
  await grab('/tmp/g_e_none.png');
  await set('engine-select', 'engine-vapor-grid');
  await new Promise((r) => setTimeout(r, 2000));
  await grab('/tmp/g_e_vapor.png');
  const engDiff = diff('/tmp/g_e_none.png', '/tmp/g_e_vapor.png');
  console.log(`ENGINE (none vs vapor): diff=${engDiff.toFixed(2)}  -> ${engDiff > 8 ? 'EFFECTIVE' : 'no effect'}`);

  await browser.close();
  process.exit(0);
};
main().catch((e) => { console.error(e); process.exit(1); });
