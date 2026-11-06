// Rotation gate for the quality-showcase project: boots the shipped dist,
// applies the show project as-is (16s time triggers intact), then drives real
// transitions through every scene pair via the capture API's regression cycle
// and reads the TransitionTracer dump — the same detector that flagged
// "Black-output detected on transition" in the live app. PASS = zero flagged
// black transitions.
//
// Usage: ts-node --transpile-only scripts/rotation-check-quality-showcase.ts [--project=<file>]
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import { buildPresetIndexEntry } from '../src/shared/presetIndex';

const ROOT = path.resolve(__dirname, '..');
const projectArg = process.argv.find((a) => a.startsWith('--project='));
const PROJECT_PATH = projectArg
  ? path.resolve(projectArg.slice('--project='.length))
  : path.join(ROOT, 'showcase-quality-tonight.project.json');
const PRESET_DIR = path.join(ROOT, 'assets/presets');
const DIST = 'file://' + path.join(ROOT, 'dist/renderer/index.html');
const WAV = path.join(__dirname, 'test-audio-fake.wav');

const main = async () => {
  const project = JSON.parse(fs.readFileSync(PROJECT_PATH, 'utf8'));

  const files = fs.readdirSync(PRESET_DIR).filter((f) => f.endsWith('.json'));
  const entries: unknown[] = [];
  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(PRESET_DIR, file), 'utf8'));
      entries.push(buildPresetIndexEntry(path.join(PRESET_DIR, file), data));
    } catch { /* stub entry in the real app */ }
  }

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
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 200)); });
  page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${String(err).slice(0, 200)}`));

  const wavBase64 = fs.existsSync(WAV) ? fs.readFileSync(WAV).toString('base64') : '';
  await page.evaluateOnNewDocument((lib: unknown[], wav: string) => {
    (window.navigator as any).requestMIDIAccess = async () => ({
      inputs: new Map(), outputs: new Map(), onstatechange: null, sysexEnabled: false
    });
    if (window.navigator.mediaDevices) {
      window.navigator.mediaDevices.getUserMedia = async () => {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const destination = audioContext.createMediaStreamDestination();
        if (wav) {
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
        }
        return destination.stream;
      };
      (window.navigator.mediaDevices as any).enumerateDevices = async () => [
        { deviceId: 'default', kind: 'audioinput', label: 'Synthetic WAV Audio Source' }
      ];
    }
    window.visualSynth = {
      ...(window.visualSynth ?? {}),
      listPresets: async () => lib as never[],
      onCloseRequested: (cb: () => void) => { (window as any).__mockOnCloseRequested = cb; },
      showSaveDialog: async () => ({ result: 'cancel' }),
      saveProject: async () => ({ canceled: true }),
      saveProjectAs: async () => ({ canceled: true }),
      confirmClose: async () => {},
      autosaveProject: async () => ({ saved: false }),
    } as any;
  }, entries, wavBase64);

  await page.goto(DIST, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => Boolean((window as any).__visualSynthInitialized), { timeout: 120000 });
  await page.waitForFunction(() => Boolean((window as any).__visualSynthCaptureApi?.applyProject), { timeout: 60000 });

  await page.evaluate(async (p: unknown) => {
    await (window as any).__visualSynthCaptureApi.applyProject(p);
  }, project);
  await new Promise((r) => setTimeout(r, 4000));

  const sceneIds: string[] = project.scenes.map((s: any) => s.id);
  console.log(`driving ${2 * sceneIds.length} transitions across ${sceneIds.length} scenes...`);
  // The tracer's recentTransitions buffer is a ring — a full sweep rotates
  // flagged details out before the final dump. Drive in chunks and collect
  // flagged details after each so a black transition is always identifiable.
  const CHUNK = 25;
  const flagged: any[] = [];
  let dump: any;
  for (let i = 0; i < Math.ceil((sceneIds.length * 2) / CHUNK); i += 1) {
    dump = await page.evaluate(async (ids: string[], iterations: number) => {
      const api = (window as any).__visualSynthCaptureApi;
      // The cycle's `iterations` is the number of applyScene calls — drive
      // every scene TWICE (each scene pair in both rotation orders), not the
      // previous literal 2 (which transitioned only two scenes total).
      await api.runTransitionRegressionCycle(iterations, 700, ids);
      await new Promise((r) => setTimeout(r, 1500));
      return api.getTransitionDump();
    }, sceneIds, Math.min(CHUNK, sceneIds.length * 2 - i * CHUNK));
    flagged.push(...(dump.recentTransitions ?? []).filter((r: any) => r.flaggedBlack));
    console.log(`  chunk ${i + 1}: transitions=${dump.totalTransitions}, flagged so far=${dump.flaggedBlackCount}`);
  }

  // Aggregate flagged pairs across chunks — the tracer's counters reset per
  // dump, so the LAST chunk's flaggedBlackCount under-reports a full sweep.
  const byPair = new Map<string, number>();
  for (const r of flagged) {
    const key = `${r.prevSceneName} → ${r.nextSceneName}`;
    byPair.set(key, (byPair.get(key) ?? 0) + 1);
  }
  console.log(`transitions: ${dump.totalTransitions}, flagged black transitions (all chunks): ${flagged.length}`);
  for (const [pair, count] of byPair) {
    console.log(`  BLACK x${count}: ${pair}`);
  }

  const safeMode = await page.evaluate(() => (window as any).__visualSynthCaptureApi.getDiagnostics().safeModeReasons ?? []);
  console.log(`safe-mode reasons at end: ${safeMode.length ? safeMode.join(', ') : 'none'}`);

  const realErrors = consoleErrors.filter((e) => !/favicon|net::ERR|ResizeObserver/.test(e));
  console.log(`${realErrors.length === 0 ? 'PASS' : 'FAIL'}  no console errors ${realErrors.length ? `(${realErrors.slice(0, 3).join(' | ')})` : ''}`);

  await browser.close();
  const ok = flagged.length === 0 && realErrors.length === 0;
  console.log(`\nROTATION GATE: ${ok ? 'PASS' : 'FAIL'}${flagged.length ? ` — ${byPair.size} scene pair(s) flag black on transition (see above)` : ''}`);
  process.exit(ok ? 0 : 1);
};

main();