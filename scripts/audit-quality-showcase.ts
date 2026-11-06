// Ground-truth audit of the quality-showcase project, scene by scene.
//
// The builder's selection was based on the batch sweep's stats and the dist
// verify checked diagnostics only — which pass even when the canvas is black
// (readPixels/diagnostics under-detect; screenshots + ffmpeg are the ground
// truth, per the certification chain). This applies the built project to the
// shipped dist exactly like the live show, then for EVERY scene captures two
// canvas screenshots (#gl-canvas toDataURL) and runs ffmpeg signalstats with
// the same verdict thresholds as reverify-batch-screenshots.js:
//   visible   = any shot YMAX >= 48 and (YMAX - YMIN) >= 16
//   blownOut  = any shot YAVG >= 200
//
// Usage: ts-node --transpile-only scripts/audit-quality-showcase.ts
import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import { buildPresetIndexEntry } from '../src/shared/presetIndex';

const ROOT = path.resolve(__dirname, '..');
const PROJECT_PATH = path.join(ROOT, 'showcase-quality-tonight.project.json');
const PRESET_DIR = path.join(ROOT, 'assets/presets');
const DIST = 'file://' + path.join(ROOT, 'dist/renderer/index.html');
const WAV = path.join(__dirname, 'test-audio-fake.wav');
const OUT_DIR = path.join(ROOT, 'milkwave-test-results/showcase-audit');

const VISIBLE_YMAX = 48; // peak luma below this = effectively black
const VISIBLE_RANGE = 16; // YMAX-YMIN below this = uniform placeholder frame
const BLOWN_YAVG = 200; // average luma above this = saturated-white runaway
const SETTLE_MS = 3500; // first-compile of heavy warp shaders can stall frames
// Dwell a full slideshow slot (16s) with samples across it — catches
// time-bomb scenes that render bright at first and then decay to black or
// saturate to white (e.g. Mashup (451): bright at t=3.5s, near-black at 6.5s).
const SHOT_TIMES_MS = [5000, 9000, 13000, 16000];
// --audio=fake (default) feeds the synthetic WAV through the mic mock, like
// the batch sweep. --audio=silent mutes it — matching a live show running
// without song detection, where audio-reactive MilkDrop presets can render
// black even though the shader compiled and draws.
const audioArg = process.argv.find((a) => a.startsWith('--audio='));
const AUDIO = audioArg ? audioArg.slice(8) : 'fake';

const shotStats = (file: string): Promise<{ ymin: number; ymax: number; yavg: number } | null> =>
  new Promise((resolve) => {
    execFile(
      'ffmpeg',
      ['-hide_banner', '-i', file, '-vf', 'signalstats,metadata=print', '-f', 'null', '-'],
      (err, _stdout, stderr) => {
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

const main = async () => {
  const project = JSON.parse(fs.readFileSync(PROJECT_PATH, 'utf8'));
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`auditing "${project.name}": ${project.scenes.length} scenes`);

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

  const wavBase64 =
    AUDIO === 'silent' ? '' : (fs.existsSync(WAV) ? fs.readFileSync(WAV).toString('base64') : '');
  console.log(`audio mode: ${AUDIO}`);
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
        { deviceId: 'default', kind: 'audioinput', label: wav ? 'Synthetic WAV Audio Source' : 'Silent Mic' }
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
      // Called from the main render tick — a missing method throws
      // synchronously and KILLS the rAF loop (canvas freezes).
      autosaveProject: async () => ({ saved: false }),
    } as any;
  }, entries, wavBase64);

  await page.goto(DIST, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => Boolean((window as any).__visualSynthInitialized), { timeout: 120000 });
  await page.waitForFunction(() => Boolean((window as any).__visualSynthCaptureApi?.applyProject), { timeout: 60000 });

  // Audit a copy with MANUAL triggers so the scene under test stays active for
  // the full dwell — with the show's 16s time triggers, auto-advance would
  // switch scenes mid-dwell and the shots would capture the next scene.
  const auditProject = {
    ...project,
    scenes: project.scenes.map((s: any) => ({ ...s, trigger: { type: 'manual' } }))
  };
  await page.evaluate(async (p: unknown) => {
    await (window as any).__visualSynthCaptureApi.applyProject(p);
  }, auditProject);
  await new Promise((r) => setTimeout(r, 4000));

  interface Row {
    name: string; visible: boolean; blown: boolean; safeMode: boolean; shaderError: boolean;
    stats: string;
  }
  const rows: Row[] = [];

  for (let i = 0; i < project.scenes.length; i += 1) {
    const scene = project.scenes[i];
    const slug = `scene-${String(i + 1).padStart(2, '0')}`;
    await page.evaluate((sceneId: string) => {
      (window as any).__visualSynthCaptureApi.applyScene(sceneId);
    }, scene.id);
    await new Promise((r) => setTimeout(r, 2000));
    const activated = await page.evaluate(
      (sceneId: string) => (window as any).__visualSynthCaptureApi.getCurrentProject().activeSceneId === sceneId,
      scene.id
    );
    if (!activated) {
      console.log(`FROZEN       ${String(i + 1).padStart(2)}. ${scene.name}  — scene never activated (render loop dead?)`);
      rows.push({ name: scene.name, visible: false, blown: false, safeMode: true, shaderError: true, stats: 'not-activated' });
      continue;
    }
    await new Promise((r) => setTimeout(r, SETTLE_MS - 2000));

    const stats: Array<{ ymin: number; ymax: number; yavg: number }> = [];
    const applyAt = Date.now();
    for (let shot = 1; shot <= SHOT_TIMES_MS.length; shot += 1) {
      const targetMs = SHOT_TIMES_MS[shot - 1];
      const wait = applyAt + SETTLE_MS + targetMs - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      const shotPath = path.join(OUT_DIR, `${slug}_t${shot}.png`);
      const base64: string = await page.evaluate(() => {
        const canvas = document.getElementById('gl-canvas') as HTMLCanvasElement | null;
        if (!canvas) return '';
        const data = canvas.toDataURL('image/png');
        return data.split(',')[1];
      });
      if (base64) fs.writeFileSync(shotPath, Buffer.from(base64, 'base64'));
      const s = base64 ? await shotStats(shotPath) : null;
      if (s) stats.push(s);
    }

    const diag = await page.evaluate(() => (window as any).__visualSynthCaptureApi.getDiagnostics());
    const activeOk = await page.evaluate(
      (sceneId: string) => (window as any).__visualSynthCaptureApi.getCurrentProject().activeSceneId === sceneId,
      scene.id
    );
    if (!activeOk) {
      console.log(`FROZEN       ${String(i + 1).padStart(2)}. ${scene.name}  — scene never activated (render loop dead?)`);
      rows.push({ name: scene.name, visible: false, blown: false, safeMode: true, shaderError: true, stats: 'not-activated' });
      continue;
    }
    const passesVisible = (s: { ymin: number; ymax: number; yavg: number }) =>
      s.ymax >= VISIBLE_YMAX && s.ymax - s.ymin >= VISIBLE_RANGE;
    // show-usable: visible through the END of the slot (catches decay-to-black)
    // and visible in most samples (catches flicker-to-black strobing)
    const visible =
      stats.length > 0 && passesVisible(stats[stats.length - 1]) &&
      stats.filter(passesVisible).length >= Math.ceil(stats.length / 2);
    const blown = stats.some((s) => s.yavg >= BLOWN_YAVG);
    const safeMode = Array.isArray(diag?.safeModeReasons) && diag.safeModeReasons.length > 0;
    const shaderError = Boolean(diag?.lastShaderError);
    const rms = diag?.renderSnapshot?.rms ?? 0;
    rows.push({
      name: scene.name,
      visible,
      blown,
      safeMode,
      shaderError,
      stats: stats.map((s) => `${s.ymin}/${s.ymax}/${s.yavg.toFixed(0)}`).join(' ')
    });
    const verdict = shaderError ? 'SHADER-ERROR' : safeMode ? 'SAFE-MODE' : blown ? 'BLOWN' : visible ? 'ok' : 'BLACK';
    console.log(
      `${verdict.padEnd(12)} ${String(i + 1).padStart(2)}. ${scene.name}  [${rows[rows.length - 1].stats}] rms=${Number(rms).toFixed(3)}`
    );
  }

  const bad = rows.filter((r) => r.shaderError || r.safeMode || r.blown || !r.visible);
  const realErrors = consoleErrors.filter((e) => !/favicon|net::ERR|ResizeObserver/.test(e));
  console.log(`${realErrors.length === 0 ? 'PASS' : 'FAIL'}  no console errors ${realErrors.length ? `(${realErrors.slice(0, 3).join(' | ')})` : ''}`);
  console.log(`\nAUDIT: ${rows.length - bad.length}/${rows.length} scenes render visibly and cleanly`);
  if (bad.length > 0) {
    console.log(`failing scenes:\n  ${bad.map((r) => r.name).join('\n  ')}`);
  }
  await browser.close();
  process.exit(bad.length > 0 || realErrors.length > 0 ? 1 : 0);
};

main();