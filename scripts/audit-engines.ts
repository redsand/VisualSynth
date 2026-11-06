// Engine reliability audit: boots the shipped dist headless with the default
// startup project, selects EVERY visual engine through the real UI dropdown,
// and samples the canvas over time — catching engines whose output decays to
// black (the Vapor Grid Shift warp drifts its sample coordinates out of the
// domain within ~30s), runs white, or never renders.
//
// Verdicts per engine (ffmpeg signalstats over 3 timed shots):
//   ok    = visible (YMAX >= 48, YMAX-YMIN >= 16) in the last shot and
//           at least half the shots, no blown (YAVG >= 200) shots
//   BLACK = decayed or never rendered
//   BLOWN = saturated white
//
// Usage: ts-node --transpile-only scripts/audit-engines.ts [--project=<file>]
import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

const ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT, 'dist/renderer');
const WAV = path.join(__dirname, 'test-audio-fake.wav');
const OUT_DIR = path.join(ROOT, 'milkwave-test-results/engine-audit');
const projectArg = process.argv.find((a) => a.startsWith('--project='));
const PROJECT_PATH = projectArg ? path.resolve(projectArg.slice('--project='.length)) : null;

const SETTLE_MS = 2000;
const SHOT_TIMES_MS = [2000, 8000, 30000]; // long tail catches time-drift blacks

interface Stats { ymin: number; ymax: number; yavg: number }

const shotStats = (file: string): Promise<Stats | null> =>
  new Promise((resolve) => {
    execFile(
      'ffmpeg',
      ['-hide_banner', '-i', file, '-vf', 'signalstats,metadata=print', '-f', 'null', '-'],
      (_err, _stdout, stderr) => {
        const out = String(stderr || '');
        const grab = (key: string) => {
          const m = out.match(new RegExp(`lavfi\\.signalstats\\.${key}=([0-9.]+)`));
          return m ? Number(m[1]) : null;
        };
        const ymin = grab('YMIN');
        const ymax = grab('YMAX');
        resolve(ymin === null || ymax === null ? null : { ymin, ymax, yavg: grab('YAVG') ?? 0 });
      }
    );
  });

const passesVisible = (s: Stats) => s.ymax >= 48 && s.ymax - s.ymin >= 16;
const verdictOf = (stats: Stats[]) => {
  if (stats.length === 0) return 'NO-SHOT';
  if (stats.some((s) => s.yavg >= 200)) return 'BLOWN';
  const visible =
    passesVisible(stats[stats.length - 1]) &&
    stats.filter(passesVisible).length >= Math.ceil(stats.length / 2);
  return visible ? 'ok' : 'BLACK';
};

const shoot = async (page: puppeteer.Page, file: string): Promise<Stats | null> => {
  const base64: string = await Promise.race([
    page.evaluate(() => new Promise<string>((resolve) => {
      const canvas = document.querySelector('#gl-canvas') as HTMLCanvasElement | null;
      if (!canvas) { resolve(''); return; }
      requestAnimationFrame(() => resolve(canvas.toDataURL('image/png').split(',')[1] ?? ''));
    })),
    new Promise<string>((r) => setTimeout(() => r(''), 5000))
  ]);
  if (!base64) return null;
  fs.writeFileSync(file, Buffer.from(base64, 'base64'));
  return shotStats(file);
};

const main = async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const wavBase64 = fs.existsSync(WAV) ? fs.readFileSync(WAV).toString('base64') : '';

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--autoplay-policy=no-user-gesture-required',
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream'
    ]
  });
  const page = await browser.newPage();
  const consoleErrors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 160)); });
  page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${String(err).slice(0, 160)}`));

  await page.evaluateOnNewDocument((wav: string) => {
    (window.navigator as any).requestMIDIAccess = async () => ({
      inputs: new Map(), outputs: new Map(), onstatechange: null, sysexEnabled: false
    });
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
        } catch { /* silent stream is fine */ }
        return destination.stream;
      };
      (window.navigator.mediaDevices as any).enumerateDevices = async () => [
        { deviceId: 'default', kind: 'audioinput', label: 'Synthetic WAV Audio Source' }
      ];
    }
    window.visualSynth = {
      ...(window.visualSynth ?? {}),
      listPresets: async () => [],
      onCloseRequested: (cb: () => void) => { (window as any).__mockOnCloseRequested = cb; },
      showSaveDialog: async () => ({ result: 'cancel' }),
      saveProject: async () => ({ canceled: true }),
      saveProjectAs: async () => ({ canceled: true }),
      confirmClose: async () => {},
      autosaveProject: async () => ({ saved: false })
    } as any;
  }, wavBase64);

  await page.goto('file://' + path.join(DIST_DIR, 'index.html'), { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => Boolean((window as any).__visualSynthInitialized), { timeout: 120000 });
  await new Promise((r) => setTimeout(r, 3000));

  if (PROJECT_PATH) {
    const project = JSON.parse(fs.readFileSync(PROJECT_PATH, 'utf8'));
    await page.evaluate(async (p: unknown) => {
      await (window as any).__visualSynthCaptureApi.applyProject(p);
    }, project);
    await new Promise((r) => setTimeout(r, 4000));
  }

  const engineIds: Array<{ id: string; name: string }> = await page.evaluate(() => {
    const select = document.getElementById('engine-select') as HTMLSelectElement | null;
    if (!select) return [];
    return Array.from(select.options).map((o) => ({ id: o.value, name: o.textContent || o.value }));
  });

  console.log(`engines in UI: ${engineIds.map((e) => e.name).join(', ') || '(select not found)'}`);
  const results: Array<{ id: string; name: string; verdict: string; shots: string }> = [];
  for (const engine of engineIds) {
    const applied = await page.evaluate((id: string) => {
      const select = document.getElementById('engine-select') as HTMLSelectElement | null;
      if (!select) return 'select missing';
      select.value = id;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return 'ok';
    }, engine.id);
    await new Promise((r) => setTimeout(r, SETTLE_MS));

    const stats: Stats[] = [];
    const start = Date.now();
    for (let shot = 0; shot < SHOT_TIMES_MS.length; shot += 1) {
      const wait = start + SHOT_TIMES_MS[shot] - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      const s = await shoot(page, path.join(OUT_DIR, `${engine.id}_t${shot + 1}.png`));
      if (s) stats.push(s);
    }
    const verdict = verdictOf(stats);
    const shots = stats.map((s) => `${s.ymin}/${s.ymax}/${Math.round(s.yavg)}`).join(' ');
    results.push({ ...engine, verdict, shots });
    console.log(`${verdict === 'ok' ? 'PASS' : 'FAIL'}  ${engine.name.padEnd(24)} ${verdict} [${shots}]${applied !== 'ok' ? ` (${applied})` : ''}`);
  }

  const bad = results.filter((r) => r.verdict !== 'ok');
  console.log(`\nENGINE AUDIT: ${results.length - bad.length}/${results.length} engines render reliably${bad.length ? ` — FAILURES: ${bad.map((b) => b.name).join(', ')}` : ''}`);
  await browser.close();
  process.exit(bad.length > 0 ? 1 : 0);
};

main().catch((e) => { console.error(e); process.exit(1); });
