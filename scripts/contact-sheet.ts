// Contact sheet: one thumbnail per scene, N seconds in (visual review of a show).
// Usage: ts-node --transpile-only scripts/contact-sheet.ts --project=<f> --out=<dir> [--at=6]
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
const opt = (n: string, d?: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
(async () => {
  const project = JSON.parse(fs.readFileSync(opt('project')!, 'utf8'));
  const proj = project.project ?? project;
  const out = opt('out')!; fs.mkdirSync(out, { recursive: true });
  const at = Number(opt('at', '6'));
  const wav = fs.readFileSync(path.join(__dirname, 'test-audio-fake.wav')).toString('base64');
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.evaluateOnNewDocument((w: string) => {
    (navigator as any).requestMIDIAccess = async () => ({ inputs: new Map(), outputs: new Map() });
    navigator.mediaDevices.getUserMedia = async () => {
      const ctx = new AudioContext(); const dest = ctx.createMediaStreamDestination();
      const bytes = Uint8Array.from(atob(w), (c) => c.charCodeAt(0));
      const buf = await ctx.decodeAudioData(bytes.buffer); await ctx.resume();
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; src.connect(dest); src.start();
      return dest.stream;
    };
    (window as any).visualSynth = { listPresets: async () => [], onCloseRequested: () => {}, autosaveProject: async () => ({ saved: false }), checkAssetPaths: async (p: string[]) => Object.fromEntries(p.map((x) => [x, true])), setOutputConfig: async (c: any) => ({ ...c, enabled: false }), openOutput: async (c: any) => ({ opened: false, config: c }), closeOutput: async () => ({ closed: true }) };
  }, wav);
  await page.goto('file://' + path.join(process.cwd(), 'dist/renderer/index.html'), { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean((window as any).__visualSynthInitialized), { timeout: 120000 });
  await page.evaluate(async (p: unknown) => { await (window as any).__visualSynthCaptureApi.applyProject(p); }, { ...proj, overlays: [] });
  for (const [i, scene] of (proj.scenes as any[]).entries()) {
    await page.evaluate((id: string) => (window as any).__visualSynthCaptureApi.applyScene(id), scene.id);
    await new Promise((r) => setTimeout(r, at * 1000));
    const clip = await page.evaluate(() => { const r = document.getElementById('gl-canvas')!.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
    await page.screenshot({ path: path.join(out, `${String(i + 1).padStart(2, '0')}.png`), clip });
  }
  fs.writeFileSync(path.join(out, 'names.txt'), (proj.scenes as any[]).map((s, i) => `${i + 1}. ${s.name}`).join('\n'));
  await browser.close();
})().catch((e) => { console.error(String(e).slice(0, 300)); process.exit(1); });
