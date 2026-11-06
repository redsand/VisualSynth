// Ground-truth render audit for ANY saved project — generalizes
// audit-quality-showcase.ts. Boots the shipped dist headless, applies the
// project through the real capture API, then for every scene captures timed
// screenshots of BOTH the preview canvas (#gl-canvas) and the output window
// (output.html, fed over the real 'visualsynth-output' BroadcastChannel) and
// runs ffmpeg signalstats with the certification-chain thresholds:
//   visible   = YMAX >= 48 and (YMAX - YMIN) >= 16, in the last shot and in
//               at least half the shots
//   blownOut  = any shot YAVG >= 200
// The output window is checked because it has its own render loop
// (output.ts) that has silently diverged from the preview before.
//
// Usage:
//   ts-node --transpile-only scripts/audit-project.ts --project=<file>
//     [--out=<dir>] [--shard=<i>/<n>] [--audio=fake|silent] [--no-output]
import { execFile, type ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import puppeteer, { Page } from 'puppeteer';
import { buildPresetIndexEntry } from '../src/shared/presetIndex';

const ROOT = path.resolve(__dirname, '..');
const PRESET_DIR = path.join(ROOT, 'assets/presets');
const DIST_DIR = path.join(ROOT, 'dist/renderer');
const WAV = path.join(__dirname, 'test-audio-fake.wav');

const arg = (name: string) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};
const PROJECT_PATH = arg('project');
if (!PROJECT_PATH) {
  console.error('usage: audit-project.ts --project=<file> [--out=<dir>] [--shard=i/n]');
  process.exit(2);
}
const OUT_DIR = arg('out') ?? path.join(ROOT, 'milkwave-test-results/project-audit', path.basename(PROJECT_PATH, '.json'));
const [SHARD_I, SHARD_N] = (arg('shard') ?? '0/1').split('/').map(Number);
const AUDIO = arg('audio') ?? 'fake';
const CHECK_OUTPUT = !process.argv.includes('--no-output');

const VISIBLE_YMAX = 48;
const VISIBLE_RANGE = 16;
const BLOWN_YAVG = 200;
const SETTLE_MS = 3500; // first-compile of heavy warp shaders can stall frames
// samples across the dwell catch decay-to-black and runaway-to-white scenes
const SHOT_TIMES_MS = [2000, 6000, 10000];
// the browser is relaunched periodically: long single-session runs degrade
// (GPU program caches, leaked FBOs) and poison later scenes' results
const RELAUNCH_EVERY = 20;
// A pathological shader can peg the renderer main thread at 100% forever —
// then page.evaluate never runs again and the audit DEADLOCKS on that scene
// (seen live: two presets hung both parallel shards for 15+ minutes). Each
// scene gets a wall-clock budget; on breach the scene is recorded as HUNG
// and the browser is killed and relaunched so the rest of the shard still
// completes.
const SCENE_TIMEOUT_MS = 60000;

const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T | null> =>
  Promise.race([
    p.then(
      (v) => v,
      () => null
    ),
    new Promise<null>((r) => setTimeout(() => r(null), ms))
  ]);

// A wedged renderer can make browser.close() itself hang — always bound it.
const closeSession = async (sess: {
  browser: { close: () => Promise<unknown>; process: () => unknown };
}): Promise<void> => {
  const closed = await withTimeout(sess.browser.close(), 10000);
  if (closed === null) (sess.browser.process() as ChildProcess | null)?.kill('SIGKILL');
};

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

const passesVisible = (s: Stats) => s.ymax >= VISIBLE_YMAX && s.ymax - s.ymin >= VISIBLE_RANGE;
const verdictOf = (stats: Stats[]) => {
  if (stats.length === 0) return 'NO-SHOT';
  if (stats.some((s) => s.yavg >= BLOWN_YAVG)) return 'BLOWN';
  const visible =
    passesVisible(stats[stats.length - 1]) &&
    stats.filter(passesVisible).length >= Math.ceil(stats.length / 2);
  return visible ? 'ok' : 'BLACK';
};

const loadPresetEntries = () => {
  const entries: unknown[] = [];
  for (const file of fs.readdirSync(PRESET_DIR).filter((f) => f.endsWith('.json'))) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(PRESET_DIR, file), 'utf8'));
      entries.push(buildPresetIndexEntry(path.join(PRESET_DIR, file), data));
    } catch { /* stub entry in the real app */ }
  }
  return entries;
};

const launch = async (entries: unknown[], wavBase64: string, project: unknown) => {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--autoplay-policy=no-user-gesture-required',
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      // the output page is a background tab — keep its rAF loop running
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--allow-file-access-from-files'
    ]
  });
  const consoleErrors: string[] = [];
  const watch = (page: Page, tag: string) => {
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(`${tag}: ${msg.text().slice(0, 200)}`); });
    page.on('pageerror', (err) => consoleErrors.push(`${tag} pageerror: ${String(err).slice(0, 200)}`));
  };

  // output window first so it is subscribed before the main window broadcasts
  let outputPage: Page | null = null;
  if (CHECK_OUTPUT) {
    outputPage = await browser.newPage();
    await outputPage.setViewport({ width: 960, height: 540 });
    watch(outputPage, 'output');
    await outputPage.goto('file://' + path.join(DIST_DIR, 'output.html'), { waitUntil: 'load', timeout: 60000 });
  }

  const page = await browser.newPage();
  watch(page, 'main');
  await page.evaluateOnNewDocument((lib: unknown[], wav: string, outputOn: boolean) => {
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
      // the output page is opened by the harness; tell the app it is open so
      // the render loop broadcasts to it exactly as with a real output window
      isOutputOpen: async () => outputOn,
      getOutputConfig: async () => ({ enabled: outputOn, fullscreen: false, scale: 1 }),
      openOutput: async (config: unknown) => ({ opened: outputOn, config }),
      closeOutput: async () => {},
      setOutputConfig: async (config: unknown) => config,
      onOutputClosed: () => {},
    } as any;
  }, entries, wavBase64, CHECK_OUTPUT);

  // headless gives only the front tab rAF; emulate focus on both so the output
  // page renders concurrently like a second real window
  for (const p of outputPage ? [page, outputPage] : [page]) {
    const cdp = await p.createCDPSession();
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await cdp.send('Page.setWebLifecycleState', { state: 'active' });
  }
  await page.goto('file://' + path.join(DIST_DIR, 'index.html'), { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => Boolean((window as any).__visualSynthInitialized), { timeout: 120000 });
  await page.waitForFunction(() => Boolean((window as any).__visualSynthCaptureApi?.applyProject), { timeout: 60000 });
  await page.evaluate(async (p: unknown) => {
    await (window as any).__visualSynthCaptureApi.applyProject(p);
  }, project);
  await new Promise((r) => setTimeout(r, 4000));
  return { browser, page, outputPage, consoleErrors };
};

// Reads the canvas inside a rAF callback queued after the app's own: the
// drawing buffer still holds the frame just rendered even without
// preserveDrawingBuffer. (Element screenshots hang on the background tab.)
const shoot = async (page: Page, selector: string, file: string): Promise<Stats | null> => {
  const base64: string = await Promise.race([
    page.evaluate((sel: string) => new Promise<string>((resolve) => {
      const canvas = document.querySelector(sel) as HTMLCanvasElement | null;
      if (!canvas) { resolve(''); return; }
      requestAnimationFrame(() => resolve(canvas.toDataURL('image/png').split(',')[1] ?? ''));
    }), selector),
    new Promise<string>((r) => setTimeout(() => r(''), 5000)) // rAF stalled = frozen loop
  ]);
  if (!base64) return null;
  fs.writeFileSync(file, Buffer.from(base64, 'base64'));
  return shotStats(file);
};

const main = async () => {
  const project = JSON.parse(fs.readFileSync(PROJECT_PATH!, 'utf8'));
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const entries = loadPresetEntries();
  const wavBase64 =
    AUDIO === 'silent' ? '' : (fs.existsSync(WAV) ? fs.readFileSync(WAV).toString('base64') : '');

  // MANUAL triggers so the scene under test stays active for the whole dwell
  // and output forced open (the show scenario) unless --respect-output: a
  // project with output disabled/absent closes the output window on apply
  const auditProject = {
    ...project,
    ...(process.argv.includes('--respect-output') ? {} : { output: { fullscreen: false, scale: 1, ...project.output, enabled: true } }),
    scenes: project.scenes.map((s: any) => ({ ...s, trigger: { type: 'manual' } }))
  };
  const indices = project.scenes.map((_: unknown, i: number) => i).filter((i: number) => i % SHARD_N === SHARD_I);
  console.log(`auditing "${project.name}" shard ${SHARD_I}/${SHARD_N}: ${indices.length}/${project.scenes.length} scenes, audio=${AUDIO}, output=${CHECK_OUTPUT}`);

  const rows: any[] = [];
  const allConsoleErrors: string[] = [];
  let session: Awaited<ReturnType<typeof launch>> | null = null;

  // The per-scene audit: apply, settle, shoot, collect diagnostics.
  const auditOneScene = async (
    sess: NonNullable<typeof session>,
    scene: any,
    i: number
  ): Promise<any> => {
    const { page, outputPage } = sess;
    const slug = `scene-${String(i + 1).padStart(3, '0')}`;

    await page.evaluate((id: string) => (window as any).__visualSynthCaptureApi.applyScene(id), scene.id);
    await new Promise((r) => setTimeout(r, SETTLE_MS));
    const activated = await page.evaluate(
      (id: string) => (window as any).__visualSynthCaptureApi.getCurrentProject().activeSceneId === id,
      scene.id
    );

    const mainStats: Stats[] = [];
    const outStats: Stats[] = [];
    const start = Date.now();
    for (let shot = 0; shot < SHOT_TIMES_MS.length; shot += 1) {
      const wait = start + SHOT_TIMES_MS[shot] - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      const m = await shoot(page, '#gl-canvas', path.join(OUT_DIR, `${slug}_main_t${shot + 1}.png`));
      if (m) mainStats.push(m);
      if (outputPage) {
        const o = await shoot(outputPage, '#output-canvas', path.join(OUT_DIR, `${slug}_out_t${shot + 1}.png`));
        if (o) outStats.push(o);
      }
    }

    const diag = await page.evaluate(() => (window as any).__visualSynthCaptureApi.getDiagnostics());
    const outDiag = outputPage
      ? await outputPage.evaluate(() => ({
          messageCount: (window as any).__outputDiagnostics?.messageCount ?? 0
        }))
      : null;
    const compile = diag?.milkdropCompileReport ?? {};
    const compileProblems = (['warp', 'comp'] as const)
      .map((stage) => [stage, compile[stage]?.status])
      .filter(([, st]) => st && st !== 'success' && st !== 'not_present')
      .map(([stage, st]) => `${stage}:${st}`);

    return {
      index: i + 1,
      name: scene.name,
      activated,
      main: verdictOf(mainStats),
      output: outputPage ? verdictOf(outStats) : 'skipped',
      shaderError: diag?.lastShaderError ? String(diag.lastShaderError).slice(0, 160) : null,
      safeMode: Array.isArray(diag?.safeModeReasons) && diag.safeModeReasons.length > 0 ? diag.safeModeReasons : null,
      compileProblems,
      outputMessages: outDiag?.messageCount ?? null,
      mainStats: mainStats.map((s) => `${s.ymin}/${s.ymax}/${s.yavg.toFixed(0)}`).join(' '),
      outStats: outStats.map((s) => `${s.ymin}/${s.ymax}/${s.yavg.toFixed(0)}`).join(' ')
    };
  };

  for (let n = 0; n < indices.length; n += 1) {
    if (!session || n % RELAUNCH_EVERY === 0) {
      if (session) {
        allConsoleErrors.push(...session.consoleErrors);
        await closeSession(session);
      }
      session = await launch(entries, wavBase64, auditProject);
    }
    const i = indices[n];
    const scene = project.scenes[i];

    let row = await withTimeout(auditOneScene(session, scene, i), SCENE_TIMEOUT_MS);
    if (!row) {
      // The scene hung the renderer (see SCENE_TIMEOUT_MS). Record it as a
      // failure — a preset that deadlocks the render loop must never reach a
      // show — then kill and relaunch so the shard continues.
      row = {
        index: i + 1,
        name: scene.name,
        activated: false,
        main: 'HUNG',
        output: 'skipped',
        shaderError: `renderer did not complete a scene within ${SCENE_TIMEOUT_MS}ms`,
        safeMode: null,
        compileProblems: [],
        outputMessages: null,
        mainStats: '',
        outStats: ''
      };
      allConsoleErrors.push(`HUNG: ${scene.name} (renderer main thread stalled >${SCENE_TIMEOUT_MS}ms)`);
      await closeSession(session);
      session = await launch(entries, wavBase64, auditProject);
    }
    rows.push(row);
    const pass =
      row.activated && row.main === 'ok' && (row.output === 'ok' || row.output === 'skipped') &&
      !row.shaderError && !row.safeMode && !row.compileProblems.length;
    console.log(
      `${pass ? 'PASS' : 'FAIL'}  ${String(i + 1).padStart(3)}. ${scene.name}  main=${row.main}[${row.mainStats}] out=${row.output}[${row.outStats}]` +
        `${row.shaderError ? ` SHADER-ERR(${String(row.shaderError).slice(0, 60)})` : ''}${row.safeMode ? ' SAFE-MODE' : ''}${row.compileProblems.length ? ' ' + row.compileProblems.join(',') : ''}${row.activated ? '' : ' NOT-ACTIVATED'}`
    );
  }
  if (session) {
    allConsoleErrors.push(...session.consoleErrors);
    await closeSession(session);
  }

  const realErrors = [...new Set(allConsoleErrors.filter((e) => !/favicon|net::ERR|ResizeObserver/.test(e)))];
  const resultFile = path.join(OUT_DIR, `results-shard${SHARD_I}of${SHARD_N}.json`);
  fs.writeFileSync(resultFile, JSON.stringify({ project: PROJECT_PATH, name: project.name, rows, consoleErrors: realErrors }, null, 2));
  const bad = rows.filter((r) =>
    !r.activated || r.main !== 'ok' || !(r.output === 'ok' || r.output === 'skipped') ||
    r.shaderError || r.safeMode || r.compileProblems.length);
  console.log(`\nAUDIT ${project.name} shard ${SHARD_I}/${SHARD_N}: ${rows.length - bad.length}/${rows.length} clean, ${realErrors.length} distinct console errors -> ${resultFile}`);
  process.exit(bad.length > 0 ? 1 : 0);
};

main();
