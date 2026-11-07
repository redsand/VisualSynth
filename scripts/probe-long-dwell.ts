// Long-dwell blowout probe: holds ONE milkwave scene for minutes (the
// condition where feedback-amplifying presets drifted to white — yavg >= 200
// — in manual live use) and samples the canvas luma over time. With the
// comp-stage fGammaAdj applied and EEL-driven decay, yavg must stay under
// the certification chain's BLOWN threshold (200) for the whole dwell.
//
// Usage: ts-node --transpile-only scripts/probe-long-dwell.ts --project=<file> --scene=<name> --minutes=<n>
import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

const ROOT = path.resolve(__dirname, '..');
const arg = (name: string) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!hit) throw new Error(`--${name}= required`);
  return hit.slice(name.length + 3);
};
const PROJECT = arg('project');
const SCENE = arg('scene');
const MINUTES = Number(arg('minutes') ?? '3');
const WAV = path.join(__dirname, 'test-audio-fake.wav');

const yavg = (file: string): Promise<number | null> =>
  new Promise((resolve) => {
    execFile('ffmpeg', ['-hide_banner', '-i', file, '-vf', 'signalstats,metadata=print', '-f', 'null', '-'],
      (_e, _o, stderr) => {
        const m = String(stderr || '').match(/lavfi\.signalstats\.YAVG=([0-9.]+)/);
        resolve(m ? Number(m[1]) : null);
      });
  });

const main = async () => {
  const project = JSON.parse(fs.readFileSync(PROJECT, 'utf8'));
  const scene = project.scenes.find((s: any) => String(s.name).includes(SCENE));
  if (!scene) throw new Error(`scene "${SCENE}" not found`);
  console.log(`long dwell: "${scene.name}" for ${MINUTES} minutes`);

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
      (window.navigator.mediaDevices as any).enumerateDevices = async () => [{ deviceId: 'default', kind: 'audioinput', label: 'dwell probe' }];
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

  let max = 0;
  const started = Date.now();
  const outDir = path.join(ROOT, 'milkwave-test-results/long-dwell');
  fs.mkdirSync(outDir, { recursive: true });
  while (Date.now() - started < MINUTES * 60000) {
    await new Promise((r) => setTimeout(r, 20000));
    const file = path.join(outDir, `dwell_${Date.now()}.png`);
    const b64: string = await page.evaluate(() => new Promise<string>((resolve) => {
      const canvas = document.querySelector('#gl-canvas') as HTMLCanvasElement | null;
      requestAnimationFrame(() => resolve(canvas?.toDataURL('image/png').split(',')[1] ?? ''));
    }));
    fs.writeFileSync(file, Buffer.from(b64, 'base64'));
    const avg = await yavg(file);
    if (avg !== null && avg > max) max = avg;
    fs.unlinkSync(file);
    console.log(`t=${Math.round((Date.now() - started) / 1000)}s yavg=${avg?.toFixed(1) ?? '?'} (max ${max.toFixed(1)}) ${avg !== null && avg >= 200 ? 'BLOWN' : ''}`);
  }
  console.log(`\nLONG DWELL: max yavg ${max.toFixed(1)} — ${max >= 200 ? 'FAIL (drifted to blowout)' : 'PASS (stayed under 200)'}`);
  await browser.close();
  process.exit(max >= 200 ? 1 : 0);
};
main().catch((e) => { console.error(e); process.exit(1); });
