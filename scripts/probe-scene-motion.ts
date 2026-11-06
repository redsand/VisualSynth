// Temporal-motion probe for ONE scene of a saved project: applies the scene
// through the real capture API and captures canvas screenshots over time,
// then reports per-shot signalstats AND writes the PNGs for visual review —
// catches "renders once then freezes" scenes (static frames read identical
// stats across every shot).
//
// Usage: ts-node --transpile-only scripts/probe-scene-motion.ts --project=<file> --scene=<name-substring>
import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

const ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT, 'dist/renderer');
const WAV = path.join(__dirname, 'test-audio-fake.wav');
const arg = (name: string) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!hit) throw new Error(`--${name}= required`);
  return hit.slice(name.length + 3);
};
const PROJECT_PATH = arg('project');
const SCENE_SUBSTR = arg('scene');
const OUT_DIR = path.join(ROOT, 'milkwave-test-results/scene-motion-probe');
const SHOT_TIMES_MS = [1500, 4000, 8000, 15000, 25000];

const shotStats = (file: string): Promise<string> =>
  new Promise((resolve) => {
    execFile('ffmpeg', ['-hide_banner', '-i', file, '-vf', 'signalstats,metadata=print', '-f', 'null', '-'],
      (_e, _o, stderr) => {
        const out = String(stderr || '');
        const grab = (k: string) => { const m = out.match(new RegExp(`lavfi\\.signalstats\\.${k}=([0-9.]+)`)); return m ? m[1] : '?'; };
        resolve(`ymin=${grab('YMIN')} ymax=${grab('YMAX')} yavg=${grab('YAVG')}`);
      });
  });

const main = async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const project = JSON.parse(fs.readFileSync(PROJECT_PATH, 'utf8'));
  const scene = project.scenes.find((s: any) => String(s.name).includes(SCENE_SUBSTR));
  if (!scene) throw new Error(`scene matching "${SCENE_SUBSTR}" not found`);
  console.log(`scene: ${scene.name} (${scene.presetPath ? path.basename(scene.presetPath) : 'no presetPath'})`);

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required',
      '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'
    ]
  });
  const page = await browser.newPage();
  page.on('pageerror', (err) => console.log('[pageerror]', String(err).slice(0, 160)));

  await page.evaluateOnNewDocument((wav: string) => {
    (window.navigator as any).requestMIDIAccess = async () => ({ inputs: new Map(), outputs: new Map(), onstatechange: null, sysexEnabled: false });
    if (window.navigator.mediaDevices) {
      window.navigator.mediaDevices.getUserMedia = async () => {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const destination = audioContext.createMediaStreamDestination();
        try {
          const binary = atob(wav);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
          const buffer = await audioContext.decodeAudioData(bytes.buffer);
          if (audioContext.state === 'suspended') await audioContext.resume();
          const source = audioContext.createBufferSource();
          source.buffer = buffer;
          source.loop = true;
          source.connect(destination);
          source.start();
        } catch { /* silent */ }
        return destination.stream;
      };
      (window.navigator.mediaDevices as any).enumerateDevices = async () => [{ deviceId: 'default', kind: 'audioinput', label: 'Motion Probe' }];
    }
    window.visualSynth = {
      ...(window.visualSynth ?? {}),
      listPresets: async () => [], onCloseRequested: () => {}, showSaveDialog: async () => ({ result: 'cancel' }),
      saveProject: async () => ({ canceled: true }), saveProjectAs: async () => ({ canceled: true }),
      confirmClose: async () => {}, autosaveProject: async () => ({ saved: false })
    } as any;
  }, fs.existsSync(WAV) ? fs.readFileSync(WAV).toString('base64') : '');

  await page.goto('file://' + path.join(DIST_DIR, 'index.html'), { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => Boolean((window as any).__visualSynthInitialized), { timeout: 120000 });
  await page.evaluate(async (p: unknown) => {
    await (window as any).__visualSynthCaptureApi.applyProject(p);
  }, project);
  await page.evaluate((id: string) => (window as any).__visualSynthCaptureApi.applyScene(id), scene.id);
  const active = await page.evaluate((id: string) => (window as any).__visualSynthCaptureApi.getCurrentProject().activeSceneId === id, scene.id);
  console.log(`activated: ${active}`);

  const start = Date.now();
  for (let i = 0; i < SHOT_TIMES_MS.length; i += 1) {
    const wait = start + SHOT_TIMES_MS[i] - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    const file = path.join(OUT_DIR, `shot_${i + 1}.png`);
    const b64: string = await page.evaluate(() => new Promise<string>((resolve) => {
      const canvas = document.querySelector('#gl-canvas') as HTMLCanvasElement | null;
      if (!canvas) { resolve(''); return; }
      requestAnimationFrame(() => resolve(canvas.toDataURL('image/png').split(',')[1] ?? ''));
    }));
    fs.writeFileSync(file, Buffer.from(b64, 'base64'));
    console.log(`t=${SHOT_TIMES_MS[i]}ms  ${await shotStats(file)}  -> ${path.basename(file)}`);
  }
  const diag = await page.evaluate(() => (window as any).__visualSynthCaptureApi.getDiagnostics());
  console.log('lastShaderError:', diag?.lastShaderError ? String(diag.lastShaderError).slice(0, 200) : 'none');
  console.log('safeMode:', JSON.stringify(diag?.safeModeReasons ?? []));
  console.log('compile:', JSON.stringify(diag?.milkdropCompileReport ?? {}));
  await browser.close();
  process.exit(0);
};
main().catch((e) => { console.error(e); process.exit(1); });
