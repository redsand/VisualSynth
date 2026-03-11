#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const puppeteer = require('puppeteer');
require('ts-node/register/transpile-only');

const ROOT = path.resolve(__dirname, '..');
const WORKTREE_ROOT = path.join(ROOT, '.worktrees');
const V1_WORKTREE = path.join(WORKTREE_ROOT, 'v1-parity');
const DEFAULT_OUTPUT = path.join(ROOT, 'docs', 'visual-regression');
const DEFAULT_VIEWPORT = { width: 1280, height: 720 };
const DEFAULT_THRESHOLD = 24;
const DEFAULT_SETTLE_FRAMES = 150;

const DEFAULT_PRESET_MATRIX = [
  'assets/presets/preset-01-cosmic.json',
  'assets/presets/preset-02-spectrum.json',
  'assets/presets/preset-08-strobe.json',
  'assets/presets/preset-13-visualsynth-dna-plasma.json',
  'assets/presets/preset-49-topo-terrain.json',
  'assets/presets/preset-51-wormhole-portals.json',
  'assets/presets/preset-52-sacred-oscilloscope.json',
  'assets/presets/preset-54-vapor-grid.json',
  'assets/presets/preset-60-warp-core.json',
  'assets/presets/preset-83-sdf-geometry-101.json',
  'assets/presets/preset-85-sdf-3d-torus.json',
  'assets/presets/preset-109-weather-hurricane.json'
];

const IGNORED_WARNING_PATTERNS = [
  '[Init] window.visualSynth not found, providing mock API'
];

function usage() {
  console.log(`Usage: node scripts/compare-v1-visuals.js [options]

Options:
  --preset <git-path>     Compare a specific v1.0 preset path (repeatable)
  --limit <n>             Limit preset count after selection
  --output <dir>          Output directory (default: docs/visual-regression)
  --threshold <n>         Per-channel pixel diff threshold 0-255 (default: 24)
  --repeat <n>            Capture each preset n times and select median diff attempt (default: 1)
  --repeat-spread <n>     Mark preset unstable when max-min repeat diff ratio exceeds n (default: 0.1)
  --settle-frames <n>     Deterministic settle frames after project apply (default: 150)
  --warmup <n>            Discarded warmup captures per preset before measured repeats (default: 1)
  --skip-build            Reuse existing dist output in both branches
  --prepare-only          Prepare worktree and build artifacts, then stop
  --all-v1-presets        Compare every preset from v1.0 instead of the curated matrix
  --list                  Print the default curated preset matrix
  --help                  Show help
`);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? ROOT,
    stdio: options.stdio ?? 'pipe',
    encoding: 'utf8',
    shell: false
  });
  if (result.status !== 0) {
    const details = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    throw new Error(`${command} ${args.join(' ')} failed${details ? `\n${details}` : ''}`);
  }
  return (result.stdout ?? '').trim();
}

function parseArgs(argv) {
  const options = {
    presets: [],
    limit: null,
    output: DEFAULT_OUTPUT,
    threshold: DEFAULT_THRESHOLD,
    repeat: 1,
    repeatSpread: 0.1,
    settleFrames: DEFAULT_SETTLE_FRAMES,
    warmup: 1,
    skipBuild: false,
    prepareOnly: false,
    allV1Presets: false,
    list: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--preset') options.presets.push(argv[++i]);
    else if (arg === '--limit') options.limit = Number(argv[++i]);
    else if (arg === '--output') options.output = path.resolve(ROOT, argv[++i]);
    else if (arg === '--threshold') options.threshold = Number(argv[++i]);
    else if (arg === '--repeat') options.repeat = Number(argv[++i]);
    else if (arg === '--repeat-spread') options.repeatSpread = Number(argv[++i]);
    else if (arg === '--settle-frames') options.settleFrames = Number(argv[++i]);
    else if (arg === '--warmup') options.warmup = Number(argv[++i]);
    else if (arg === '--skip-build') options.skipBuild = true;
    else if (arg === '--prepare-only') options.prepareOnly = true;
    else if (arg === '--all-v1-presets') options.allV1Presets = true;
    else if (arg === '--list') options.list = true;
    else if (arg === '--help') {
      usage();
      process.exit(0);
    } else {
      fail(`Unknown argument: ${arg}`);
    }
  }

  if (options.limit !== null && (!Number.isFinite(options.limit) || options.limit <= 0)) {
    fail('--limit must be a positive number');
  }
  if (!Number.isFinite(options.threshold) || options.threshold < 0 || options.threshold > 255) {
    fail('--threshold must be between 0 and 255');
  }
  if (!Number.isFinite(options.repeat) || options.repeat < 1 || !Number.isInteger(options.repeat)) {
    fail('--repeat must be a positive integer');
  }
  if (!Number.isFinite(options.repeatSpread) || options.repeatSpread < 0) {
    fail('--repeat-spread must be >= 0');
  }
  if (!Number.isFinite(options.settleFrames) || options.settleFrames < 1 || !Number.isInteger(options.settleFrames)) {
    fail('--settle-frames must be a positive integer');
  }
  if (!Number.isFinite(options.warmup) || options.warmup < 0 || !Number.isInteger(options.warmup)) {
    fail('--warmup must be a non-negative integer');
  }

  return options;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function isIgnoredConsoleWarning(entry) {
  return entry?.type === 'warn' && IGNORED_WARNING_PATTERNS.some((pattern) => entry.text.includes(pattern));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getSelectedPresetPaths(options) {
  if (options.presets.length > 0) {
    return [...new Set(options.presets)];
  }
  if (options.allV1Presets) {
    const output = run('git', ['ls-tree', '-r', '--name-only', 'v1.0', 'assets/presets'], { cwd: ROOT });
    return output.split(/\r?\n/).filter(Boolean).sort();
  }
  return [...DEFAULT_PRESET_MATRIX];
}

function ensureV1Worktree() {
  ensureDir(WORKTREE_ROOT);
  if (fs.existsSync(V1_WORKTREE)) return;
  console.log(`[visual-regression] creating worktree at ${V1_WORKTREE}`);
  run('git', ['worktree', 'add', '--force', V1_WORKTREE, 'v1.0'], { cwd: ROOT, stdio: 'inherit' });
}

function buildBranch(branchRoot) {
  console.log(`[visual-regression] building ${branchRoot}`);
  run(process.execPath, [path.join(branchRoot, 'scripts', 'prepare-assets.js')], { cwd: branchRoot, stdio: 'inherit' });
  run(process.execPath, [path.join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', 'tsconfig.main.json'], { cwd: branchRoot, stdio: 'inherit' });
  run(process.execPath, [path.join(branchRoot, 'scripts', 'build-renderer.js')], { cwd: branchRoot, stdio: 'inherit' });
}

function readGitJson(revisionPath) {
  const json = run('git', ['show', `v1.0:${revisionPath}`], { cwd: ROOT });
  return JSON.parse(json);
}

const presetModuleCache = new Map();

function loadPresetModules(branchRoot) {
  const cacheKey = path.resolve(branchRoot);
  if (presetModuleCache.has(cacheKey)) {
    return presetModuleCache.get(cacheKey);
  }

  const presetMigration = require(path.join(branchRoot, 'src', 'shared', 'presetMigration.ts'));
  const projectModule = require(path.join(branchRoot, 'src', 'shared', 'project.ts'));
  const modules = { presetMigration, projectModule };
  presetModuleCache.set(cacheKey, modules);
  return modules;
}

function materializeProject(branchRoot, presetOrProject) {
  if (presetOrProject && Array.isArray(presetOrProject.scenes) && typeof presetOrProject.activeSceneId === 'string') {
    return presetOrProject;
  }

  const { presetMigration, projectModule } = loadPresetModules(branchRoot);
  const {
    migratePreset,
    applyPresetV3,
    applyPresetV4,
    applyPresetV5,
    applyPresetV6
  } = presetMigration;
  const { DEFAULT_PROJECT } = projectModule;

  const migrated = migratePreset(presetOrProject);
  if (!migrated?.success) {
    throw new Error(`Preset migration failed for ${branchRoot}: ${(migrated?.errors || []).join(', ')}`);
  }

  const preset = migrated.preset;
  if (preset.version === 6 && typeof applyPresetV6 === 'function') return applyPresetV6(preset, DEFAULT_PROJECT).project;
  if (preset.version === 5 && typeof applyPresetV5 === 'function') return applyPresetV5(preset, DEFAULT_PROJECT).project;
  if (preset.version === 4 && typeof applyPresetV4 === 'function') return applyPresetV4(preset, DEFAULT_PROJECT).project;
  if (preset.version === 3 && typeof applyPresetV3 === 'function') return applyPresetV3(preset, DEFAULT_PROJECT).project;

  throw new Error(`Unsupported migrated preset version ${preset.version} for ${branchRoot}`);
}

function sanitizePresetName(presetPath) {
  return path.basename(presetPath, '.json').replace(/[^a-zA-Z0-9._-]+/g, '-');
}

async function waitForApp(page) {
  await page.waitForFunction(() => Boolean(window.__visualSynthInitialized), { timeout: 30000 });
}

async function waitForFrames(page, frameCount = 8) {
  await page.evaluate(async (count) => {
    const frameMs = 1000 / 60;
    const target = performance.now() + count * frameMs;
    while (performance.now() < target) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }, frameCount);
}

async function normalizeCanvasSurface(page) {
  await page.evaluate(({ width, height }) => {
    const canvas = document.getElementById('gl-canvas');
    if (!(canvas instanceof HTMLCanvasElement)) return;
    canvas.style.position = 'fixed';
    canvas.style.left = '0';
    canvas.style.top = '0';
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.style.zIndex = '2147483647';
    canvas.style.pointerEvents = 'none';
    canvas.width = width;
    canvas.height = height;

    const visualizer = document.getElementById('visualizer-canvas');
    if (visualizer instanceof HTMLCanvasElement) {
      visualizer.style.display = 'none';
    }
  }, DEFAULT_VIEWPORT);
}

async function setPausedState(page, paused) {
  await page.evaluate((shouldPause) => {
    const button = document.getElementById('transport-pause');
    if (!(button instanceof HTMLButtonElement)) return;
    const isPaused = button.textContent?.trim().toLowerCase() === 'resume';
    if (isPaused !== shouldPause) {
      button.click();
    }
  }, paused);
}

async function captureBranch(branchRoot, preset, branchLabel, settleFrames = DEFAULT_SETTLE_FRAMES) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  const consoleEntries = [];
  const pageErrors = [];
  page.on('console', (message) => {
    consoleEntries.push({
      type: message.type(),
      text: message.text()
    });
  });
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });
  await page.setViewport(DEFAULT_VIEWPORT);
  await page.evaluateOnNewDocument(() => {
    const FRAME_MS = 1000 / 60;
    let deterministicNow = 0;
    const INITIAL_RANDOM_SEED = 0x12345678;
    let randomSeed = INITIAL_RANDOM_SEED;
    const nativeSetTimeout = window.setTimeout.bind(window);
    const nativeClearTimeout = window.clearTimeout.bind(window);
    const rafTimers = new Map();
    let rafIdCounter = 0;

    const nextDeterministicRandom = () => {
      randomSeed ^= randomSeed << 13;
      randomSeed ^= randomSeed >>> 17;
      randomSeed ^= randomSeed << 5;
      return ((randomSeed >>> 0) % 1000000) / 1000000;
    };

    Object.defineProperty(window.performance, 'now', {
      configurable: true,
      value: () => deterministicNow
    });
    Object.defineProperty(Date, 'now', {
      configurable: true,
      value: () => deterministicNow
    });

    Object.defineProperty(Math, 'random', {
      configurable: true,
      value: () => nextDeterministicRandom()
    });

    window.__resetDeterministicClock = () => {
      deterministicNow = 0;
    };
    window.__resetDeterministicState = () => {
      deterministicNow = 0;
      randomSeed = INITIAL_RANDOM_SEED;
    };

    window.requestAnimationFrame = (callback) => {
      const id = ++rafIdCounter;
      const timer = nativeSetTimeout(() => {
        rafTimers.delete(id);
        deterministicNow += FRAME_MS;
        callback(deterministicNow);
      }, 0);
      rafTimers.set(id, timer);
      return id;
    };

    window.cancelAnimationFrame = (id) => {
      const timer = rafTimers.get(id);
      if (timer !== undefined) {
        nativeClearTimeout(timer);
        rafTimers.delete(id);
      }
    };

    const installDeterministicAnalyser = (Ctor) => {
      if (!Ctor?.prototype?.createAnalyser) return;
      const originalCreateAnalyser = Ctor.prototype.createAnalyser;
      Ctor.prototype.createAnalyser = function createAnalyserPatched(...args) {
        const analyser = originalCreateAnalyser.apply(this, args);
        const fillSpectrum = (target) => {
          const denom = Math.max(1, target.length - 1);
          for (let i = 0; i < target.length; i += 1) {
            const x = i / denom;
            const envelope = Math.pow(Math.sin(x * Math.PI), 1.2);
            const harmonics = 0.35 + 0.65 * Math.pow(Math.sin(x * 9.0), 2);
            target[i] = Math.round(255 * envelope * harmonics);
          }
        };
        const fillWaveform = (target) => {
          const denom = Math.max(1, target.length);
          for (let i = 0; i < target.length; i += 1) {
            const phase = (i / denom) * Math.PI * 8.0;
            target[i] = Math.round(128 + Math.sin(phase) * 96);
          }
        };
        analyser.getByteFrequencyData = (target) => fillSpectrum(target);
        analyser.getByteTimeDomainData = (target) => fillWaveform(target);
        return analyser;
      };
    };

    installDeterministicAnalyser(window.AudioContext);
    installDeterministicAnalyser(window.webkitAudioContext);

    window.navigator.requestMIDIAccess = async () => ({
      inputs: new Map(),
      outputs: new Map(),
      onstatechange: null,
      sysexEnabled: false
    });

    if (window.navigator.mediaDevices) {
      window.navigator.mediaDevices.getUserMedia = async () => {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const destination = audioContext.createMediaStreamDestination();
        return destination.stream;
      };
      window.navigator.mediaDevices.enumerateDevices = async () => [
        { deviceId: 'default', kind: 'audioinput', label: 'Mock Microphone' }
      ];
    }
  });

  try {
    const rendererPath = path.join(branchRoot, 'dist', 'renderer', 'index.html').replace(/\\/g, '/');
    await page.goto(`file://${rendererPath}`, { waitUntil: 'load' });
    await waitForApp(page);
    await normalizeCanvasSurface(page);
    await waitForFrames(page, 6);
    await setPausedState(page, false);

    await page.evaluate(async (project) => {
      if (!window.__visualSynthCaptureApi?.applyProject) {
        throw new Error('Capture API unavailable');
      }
      await window.__visualSynthCaptureApi.applyProject(project, { skipRecovery: true });
      if (typeof window.__resetDeterministicState === 'function') {
        window.__resetDeterministicState();
      } else if (typeof window.__resetDeterministicClock === 'function') {
        window.__resetDeterministicClock();
      }
    }, preset);

    await normalizeCanvasSurface(page);
    // Some legacy presets (notably weather-heavy scenes) need additional deterministic
    // settle frames to fully decay transitions before capture.
    await waitForFrames(page, settleFrames);
    await setPausedState(page, true);
    await waitForFrames(page, 2);

    const capture = await page.evaluate((label) => {
      const canvas = document.getElementById('gl-canvas');
      if (!(canvas instanceof HTMLCanvasElement)) {
        throw new Error(`Canvas not found for ${label}`);
      }
      const mirror = document.createElement('canvas');
      mirror.width = canvas.width;
      mirror.height = canvas.height;
      const ctx = mirror.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        throw new Error(`2D context not available for ${label}`);
      }
      ctx.drawImage(canvas, 0, 0);
      const imageData = ctx.getImageData(0, 0, mirror.width, mirror.height);
      const project = window.__visualSynthCaptureApi?.getCurrentProject?.() ?? null;
      const activeScene =
        project?.scenes?.find?.((scene) => scene.id === project.activeSceneId) ??
        project?.scenes?.[0] ??
        null;
      const projectSummary = project
        ? {
            name: project.name ?? '',
            activeSceneId: project.activeSceneId ?? '',
            activeEngineId: project.activeEngineId ?? '',
            activeModeId: project.activeModeId ?? '',
            activeLayerIds:
              activeScene?.layers
                ?.filter?.((layer) => layer?.enabled !== false)
                ?.map?.((layer) => layer?.id ?? layer?.type ?? 'unknown-layer') ?? []
          }
        : null;
      return {
        projectSummary,
        width: mirror.width,
        height: mirror.height,
        pngDataUrl: mirror.toDataURL('image/png'),
        rgba: Array.from(imageData.data),
        diagnostics: window.__visualSynthCaptureApi?.getDiagnostics?.() ?? null,
        safeModeBannerText: document.getElementById('safe-mode-banner')?.textContent?.trim() ?? '',
        transportPauseLabel: document.getElementById('transport-pause')?.textContent?.trim() ?? '',
        visualSynthInitialized: Boolean(window.__visualSynthInitialized)
      };
    }, branchLabel);

    return {
      width: capture.width,
      height: capture.height,
      pngBuffer: Buffer.from(capture.pngDataUrl.split(',')[1], 'base64'),
      rgba: Uint8ClampedArray.from(capture.rgba),
      projectSummary: capture.projectSummary,
      diagnostics: capture.diagnostics,
      safeModeBannerText: capture.safeModeBannerText,
      transportPauseLabel: capture.transportPauseLabel,
      visualSynthInitialized: capture.visualSynthInitialized,
      consoleEntries,
      pageErrors
    };
  } finally {
    await browser.close();
  }
}

function writePpm(filePath, width, height, rgba) {
  const header = Buffer.from(`P6\n${width} ${height}\n255\n`, 'ascii');
  const rgb = Buffer.alloc(width * height * 3);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
    rgb[j] = rgba[i];
    rgb[j + 1] = rgba[i + 1];
    rgb[j + 2] = rgba[i + 2];
  }
  fs.writeFileSync(filePath, Buffer.concat([header, rgb]));
}

function hasMeaningfulSafeModeText(text) {
  const normalized = String(text ?? '').trim();
  return normalized.length > 0 && normalized !== 'Safe mode: --';
}

function compareFrames(reference, candidate, threshold) {
  if (reference.width !== candidate.width || reference.height !== candidate.height) {
    throw new Error(`Canvas size mismatch: v1.0=${reference.width}x${reference.height}, main=${candidate.width}x${candidate.height}`);
  }

  const diffRgba = new Uint8ClampedArray(reference.rgba.length);
  let differentPixels = 0;
  let totalAbsDiff = 0;
  let maxChannelDiff = 0;

  for (let i = 0; i < reference.rgba.length; i += 4) {
    const dr = Math.abs(reference.rgba[i] - candidate.rgba[i]);
    const dg = Math.abs(reference.rgba[i + 1] - candidate.rgba[i + 1]);
    const db = Math.abs(reference.rgba[i + 2] - candidate.rgba[i + 2]);
    const da = Math.abs(reference.rgba[i + 3] - candidate.rgba[i + 3]);
    const maxDiff = Math.max(dr, dg, db, da);
    totalAbsDiff += dr + dg + db + da;
    maxChannelDiff = Math.max(maxChannelDiff, maxDiff);

    const flagged = maxDiff > threshold;
    if (flagged) differentPixels += 1;

    diffRgba[i] = flagged ? Math.min(255, dr * 8) : 0;
    diffRgba[i + 1] = flagged ? Math.min(255, dg * 4) : 0;
    diffRgba[i + 2] = flagged ? Math.min(255, db * 4) : 0;
    diffRgba[i + 3] = 255;
  }

  const pixelCount = reference.width * reference.height;
  return {
    width: reference.width,
    height: reference.height,
    differentPixels,
    differentRatio: pixelCount === 0 ? 0 : differentPixels / pixelCount,
    meanAbsoluteDiff: reference.rgba.length === 0 ? 0 : totalAbsDiff / reference.rgba.length,
    maxChannelDiff,
    diffRgba
  };
}

function summarizeRepeatMetrics(attempts, spreadThreshold) {
  if (!attempts.length) return null;
  const sorted = [...attempts].sort((a, b) => a.metrics.differentRatio - b.metrics.differentRatio);
  const medianAttempt = sorted[Math.floor(sorted.length / 2)];
  const max = sorted[sorted.length - 1];
  const min = sorted[0];
  const spreadDiffRatio = max.metrics.differentRatio - min.metrics.differentRatio;
  const averageDiffRatio = sorted.reduce((total, attempt) => total + attempt.metrics.differentRatio, 0) / sorted.length;
  const variance = sorted.reduce((total, attempt) => {
    const delta = attempt.metrics.differentRatio - averageDiffRatio;
    return total + (delta * delta);
  }, 0) / sorted.length;
  const outlierCount = sorted.filter((entry) => Math.abs(entry.metrics.differentRatio - medianAttempt.metrics.differentRatio) > spreadThreshold).length;
  const outlierRatio = sorted.length > 0 ? outlierCount / sorted.length : 0;
  return {
    repeatCount: attempts.length,
    medianAttempt: medianAttempt.attempt,
    minDiffRatio: min.metrics.differentRatio,
    maxDiffRatio: max.metrics.differentRatio,
    spreadDiffRatio,
    averageDiffRatio,
    stdDevDiffRatio: Math.sqrt(variance),
    unstable: outlierRatio > 0.34,
    outlierCount,
    outlierRatio,
    attempts: sorted.map((entry) => ({
      attempt: entry.attempt,
      diffRatio: entry.metrics.differentRatio,
      meanAbsoluteDiff: entry.metrics.meanAbsoluteDiff,
      maxChannelDiff: entry.metrics.maxChannelDiff,
      v1Luma: entry.v1AverageLuma ?? null,
      mainLuma: entry.mainAverageLuma ?? null
    }))
  };
}

function computeAverageLuma(capture) {
  if (!capture?.rgba?.length) return 0;
  let total = 0;
  for (let i = 0; i < capture.rgba.length; i += 4) {
    total += (0.2126 * capture.rgba[i]) + (0.7152 * capture.rgba[i + 1]) + (0.0722 * capture.rgba[i + 2]);
  }
  return total / (capture.width * capture.height);
}

function writeReport(outputDir, report) {
  fs.writeFileSync(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2));

  const lines = [
    '# v1.0 Visual Regression Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    `Compared presets: ${report.summary.totalPresets}`,
    `Flagged presets: ${report.summary.flaggedPresets}`,
    `Average diff ratio: ${(report.summary.averageDiffRatio * 100).toFixed(3)}%`,
    `Presets with safe mode: ${report.summary.presetsWithSafeMode}`,
    `Presets with shader errors: ${report.summary.presetsWithShaderErrors}`,
    `Unstable repeat presets: ${report.summary.unstableRepeatPresets}`,
    '',
    '| Preset | Diff Ratio | Mean Abs Diff | Max Channel Diff | Repeat Spread | Unstable | v1 Luma | Main Luma | Safe Mode | Shader Error | Active Generators | Missing Uniforms | Warns |',
    '| --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | --- | --- | --- | ---: | ---: |'
  ];

  report.results.forEach((entry) => {
    const mainDiagnostics = entry.main?.diagnostics;
    const safeMode = mainDiagnostics?.safeModeReasons?.join(', ') || (hasMeaningfulSafeModeText(entry.main?.safeModeBannerText) ? entry.main.safeModeBannerText : '-') || '-';
    const shaderError = mainDiagnostics?.lastShaderError || '-';
    const activeGenerators = mainDiagnostics?.activeGeneratorIds?.join(', ') || '-';
    const missingUniforms = mainDiagnostics?.missingUniforms?.length ?? 0;
    const warns = entry.main?.warnCount ?? 0;
    const repeatSpread = entry.repeatSummary?.spreadDiffRatio ?? 0;
    const unstable = entry.repeatSummary?.unstable ? 'yes' : 'no';
    lines.push(
      `| ${entry.preset} | ${(entry.differentRatio * 100).toFixed(3)}% | ${entry.meanAbsoluteDiff.toFixed(2)} | ${entry.maxChannelDiff} | ${(repeatSpread * 100).toFixed(3)}% | ${unstable} | ${entry.v1?.averageLuma?.toFixed(2) ?? '0.00'} | ${entry.main?.averageLuma?.toFixed(2) ?? '0.00'} | ${safeMode} | ${shaderError} | ${activeGenerators} | ${missingUniforms} | ${warns} |`
    );
  });

  fs.writeFileSync(path.join(outputDir, 'report.md'), lines.join('\n'));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.list) {
    console.log(DEFAULT_PRESET_MATRIX.join('\n'));
    return;
  }

  ensureDir(options.output);
  ensureV1Worktree();

  if (!options.skipBuild) {
    buildBranch(ROOT);
    buildBranch(V1_WORKTREE);
  }

  if (options.prepareOnly) return;

  let presetPaths = getSelectedPresetPaths(options);
  if (options.limit !== null) {
    presetPaths = presetPaths.slice(0, options.limit);
  }

  const results = [];
  for (const presetPath of presetPaths) {
    console.log(`[visual-regression] comparing ${presetPath}`);
    const rawPreset = readGitJson(presetPath);
    const v1Project = materializeProject(V1_WORKTREE, rawPreset);
    const mainProject = materializeProject(ROOT, rawPreset);
    const presetSlug = sanitizePresetName(presetPath);
    const presetDir = path.join(options.output, presetSlug);
    ensureDir(presetDir);

    const attempts = [];
    for (let warmup = 1; warmup <= options.warmup; warmup += 1) {
      if (options.warmup > 0) {
        console.log(`[visual-regression]   warmup ${warmup}/${options.warmup}`);
      }
      await captureBranch(V1_WORKTREE, v1Project, 'v1.0', options.settleFrames);
      await captureBranch(ROOT, mainProject, 'main', options.settleFrames);
    }
    for (let attempt = 1; attempt <= options.repeat; attempt += 1) {
      if (options.repeat > 1) {
        console.log(`[visual-regression]   repeat ${attempt}/${options.repeat}`);
      }
      const v1Capture = await captureBranch(V1_WORKTREE, v1Project, 'v1.0', options.settleFrames);
      const mainCapture = await captureBranch(ROOT, mainProject, 'main', options.settleFrames);
      const metrics = compareFrames(v1Capture, mainCapture, options.threshold);
      const v1AverageLuma = computeAverageLuma(v1Capture);
      const mainAverageLuma = computeAverageLuma(mainCapture);
      attempts.push({
        attempt,
        v1Capture,
        mainCapture,
        metrics,
        v1AverageLuma,
        mainAverageLuma
      });
    }
    const sortedAttempts = [...attempts].sort(
      (a, b) => a.metrics.differentRatio - b.metrics.differentRatio || a.attempt - b.attempt
    );
    const selectedAttempt = sortedAttempts[Math.floor(sortedAttempts.length / 2)];
    const { v1Capture, mainCapture, metrics } = selectedAttempt;
    const v1AverageLuma = selectedAttempt.v1AverageLuma ?? computeAverageLuma(v1Capture);
    const mainAverageLuma = selectedAttempt.mainAverageLuma ?? computeAverageLuma(mainCapture);
    const repeatSummary = summarizeRepeatMetrics(attempts, options.repeatSpread);

    fs.writeFileSync(path.join(presetDir, 'v1.0.png'), v1Capture.pngBuffer);
    fs.writeFileSync(path.join(presetDir, 'main.png'), mainCapture.pngBuffer);
    writePpm(path.join(presetDir, 'diff.ppm'), metrics.width, metrics.height, metrics.diffRgba);
    fs.writeFileSync(
      path.join(presetDir, 'diagnostics.json'),
      JSON.stringify(
        {
          preset: presetPath,
          repeatSummary,
          v1: {
            projectSummary: v1Capture.projectSummary,
            diagnostics: v1Capture.diagnostics,
            safeModeBannerText: v1Capture.safeModeBannerText,
            transportPauseLabel: v1Capture.transportPauseLabel,
            visualSynthInitialized: v1Capture.visualSynthInitialized,
            consoleEntries: v1Capture.consoleEntries,
            pageErrors: v1Capture.pageErrors
          },
          main: {
            projectSummary: mainCapture.projectSummary,
            diagnostics: mainCapture.diagnostics,
            safeModeBannerText: mainCapture.safeModeBannerText,
            transportPauseLabel: mainCapture.transportPauseLabel,
            visualSynthInitialized: mainCapture.visualSynthInitialized,
            consoleEntries: mainCapture.consoleEntries,
            pageErrors: mainCapture.pageErrors
          }
        },
        null,
        2
      )
    );

    results.push({
      preset: presetPath,
      presetName: rawPreset?.name ?? rawPreset?.metadata?.name ?? path.basename(presetPath, '.json'),
      repeatSummary,
      threshold: options.threshold,
      differentPixels: metrics.differentPixels,
      differentRatio: metrics.differentRatio,
      meanAbsoluteDiff: metrics.meanAbsoluteDiff,
      maxChannelDiff: metrics.maxChannelDiff,
      outputDir: presetDir,
      v1: {
        projectSummary: v1Capture.projectSummary,
        diagnostics: v1Capture.diagnostics,
        safeModeBannerText: v1Capture.safeModeBannerText,
        averageLuma: v1AverageLuma,
        warnCount: v1Capture.consoleEntries.filter((entry) => entry.type === 'warn' && !isIgnoredConsoleWarning(entry)).length,
        consoleEntryCount: v1Capture.consoleEntries.length,
        pageErrorCount: v1Capture.pageErrors.length
      },
      main: {
        projectSummary: mainCapture.projectSummary,
        diagnostics: mainCapture.diagnostics,
        safeModeBannerText: mainCapture.safeModeBannerText,
        averageLuma: mainAverageLuma,
        warnCount: mainCapture.consoleEntries.filter((entry) => entry.type === 'warn' && !isIgnoredConsoleWarning(entry)).length,
        consoleEntryCount: mainCapture.consoleEntries.length,
        pageErrorCount: mainCapture.pageErrors.length
      }
    });
  }

  const summary = results.reduce(
    (acc, item) => {
      acc.totalPresets += 1;
      acc.flaggedPresets += item.differentPixels > 0 ? 1 : 0;
      acc.averageDiffRatio += item.differentRatio;
      return acc;
    },
    { totalPresets: 0, flaggedPresets: 0, averageDiffRatio: 0, presetsWithSafeMode: 0, presetsWithShaderErrors: 0, unstableRepeatPresets: 0 }
  );
  if (summary.totalPresets > 0) {
    summary.averageDiffRatio /= summary.totalPresets;
  }
  summary.presetsWithSafeMode = results.filter((entry) => {
    const safeModeReasons = entry.main?.diagnostics?.safeModeReasons ?? [];
    return safeModeReasons.length > 0 || hasMeaningfulSafeModeText(entry.main?.safeModeBannerText);
  }).length;
  summary.presetsWithShaderErrors = results.filter((entry) => Boolean(entry.main?.diagnostics?.lastShaderError)).length;
  summary.unstableRepeatPresets = results.filter((entry) => Boolean(entry.repeatSummary?.unstable)).length;

  writeReport(options.output, { generatedAt: new Date().toISOString(), summary, results });
  console.log(`[visual-regression] report written to ${options.output}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
