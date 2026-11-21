// Per-scene GPU cost audit.
//
// Live sessions showed the app's CPU work at 5-10ms/frame while delivered
// fps sat at 2-20: the cost was GPU-side (Chromium's GPU process blocked in
// MTLCommandBuffer waitUntilScheduled behind expensive scene work). This
// boots the shipped dist in a HEADED Chromium (real Metal GPU, not
// SwiftShader), applies each scene, and after the app's own frame calls
// gl.finish() on the app's context — the wait approximates the GPU time of
// that frame's work. Also reports delivered rAF fps.
//
// Usage: ts-node --transpile-only scripts/audit-scene-cost.ts --project=<file>
//          [--only=<substr,...>] [--width=1460 --height=822] [--json=<out>]
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

const ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT, 'dist/renderer');
const WAV = path.join(__dirname, 'test-audio-fake.wav');
const opt = (name: string, fallback?: string) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const PROJECT_PATH = opt('project');
if (!PROJECT_PATH) throw new Error('--project= required');
const ONLY = opt('only')?.split(',').filter(Boolean) ?? null;
const WIDTH = Number(opt('width', '1460'));
const HEIGHT = Number(opt('height', '822'));
const JSON_OUT = opt('json');
const SETTLE_MS = 2500;
const SAMPLE_FRAMES = 40;

const main = async () => {
  const project = JSON.parse(fs.readFileSync(PROJECT_PATH, 'utf8'));
  const scenes = project.scenes.filter((s: any) =>
    !ONLY || ONLY.some((sub) => String(s.name).toLowerCase().includes(sub.toLowerCase())));
  console.log(`cost-auditing ${scenes.length} scenes at ${WIDTH}x${HEIGHT}`);

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 },
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', `--window-size=${WIDTH},${HEIGHT + 100}`,
      '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows']
  });
  const page = await browser.newPage();
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
          src.buffer = buf; src.loop = true; src.connect(dest); src.start();
        } catch { /* silent */ }
        return dest.stream;
      };
      (window.navigator.mediaDevices as any).enumerateDevices = async () => [{ deviceId: 'default', kind: 'audioinput', label: 'cost probe' }];
    }
    window.visualSynth = {
      ...(window.visualSynth ?? {}), listPresets: async () => [], onCloseRequested: () => {},
      showSaveDialog: async () => ({ result: 'cancel' }), saveProject: async () => ({ canceled: true }),
      saveProjectAs: async () => ({ canceled: true }), confirmClose: async () => {},
      autosaveProject: async () => ({ saved: false })
    } as any;
  }, wav);
  await page.goto('file://' + path.join(DIST_DIR, 'index.html'), { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => Boolean((window as any).__visualSynthInitialized), { timeout: 120000 });
  await page.evaluate(async (p: unknown) => { await (window as any).__visualSynthCaptureApi.applyProject(p); }, project);
  await new Promise((r) => setTimeout(r, 3000));

  const results: Array<{ name: string; gpuMsMedian: number; gpuMsP90: number; fps: number; canvas: string }> = [];
  for (const scene of scenes as any[]) {
    await page.evaluate((id: string) => (window as any).__visualSynthCaptureApi.applyScene(id), scene.id);
    await new Promise((r) => setTimeout(r, SETTLE_MS));
    const r = await page.evaluate((frames: number) => new Promise<any>((resolve) => {
      const canvas = document.getElementById('gl-canvas') as HTMLCanvasElement;
      const gl = canvas.getContext('webgl2') as WebGL2RenderingContext;
      const waits: number[] = [];
      const t0 = performance.now();
      let n = 0;
      const tick = () => {
        // Runs after the app's rAF callback (registered earlier): its frame is queued.
        setTimeout(() => {
          const s = performance.now();
          gl.finish();
          waits.push(performance.now() - s);
          n += 1;
          if (n < frames) requestAnimationFrame(tick);
          else {
            const sorted = [...waits].sort((a, b) => a - b);
            resolve({
              med: sorted[Math.floor(sorted.length / 2)],
              p90: sorted[Math.floor(sorted.length * 0.9)],
              fps: frames / ((performance.now() - t0) / 1000),
              canvas: `${canvas.width}x${canvas.height}`
            });
          }
        }, 0);
      };
      requestAnimationFrame(tick);
    }), SAMPLE_FRAMES);
    results.push({ name: scene.name, gpuMsMedian: +r.med.toFixed(1), gpuMsP90: +r.p90.toFixed(1), fps: +r.fps.toFixed(1), canvas: r.canvas });
    console.log(`${String(scene.name).slice(0, 44).padEnd(44)} gpu med=${r.med.toFixed(1).padStart(6)}ms p90=${r.p90.toFixed(1).padStart(6)}ms fps=${r.fps.toFixed(1).padStart(5)} ${r.canvas}`);
  }
  if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(results, null, 2));
  const sorted = [...results].sort((a, b) => b.gpuMsMedian - a.gpuMsMedian);
  console.log('\nMOST EXPENSIVE:');
  for (const s of sorted.slice(0, 15)) console.log(`  ${s.gpuMsMedian.toFixed(1).padStart(6)}ms  ${s.name}`);
  await browser.close();
  process.exit(0);
};
main().catch((e) => { console.error(e); process.exit(1); });
