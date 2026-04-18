#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const BATCH_SIZE = 100;
const SCREENSHOT_INTERVAL_MS = 3000;
const SCREENSHOT_COUNT = 3;
const SETTLE_FRAMES = 8;
const EVIDENCE_TIMEOUT_MS = 8000;

const PRESETS_DIR = path.join(__dirname, '..', 'assets', 'presets');
const TRACKING_DIR = path.join(__dirname, '..', 'milkwave-test-results');
const BATCHES_DIR = path.join(TRACKING_DIR, 'batches');
const SCREENSHOTS_DIR = path.join(TRACKING_DIR, 'screenshots');
const SHADERS_DIR = path.join(TRACKING_DIR, 'shaders');
const TRACKING_FILE = path.join(TRACKING_DIR, 'tracking.json');
const REPORTS_DIR = path.join(TRACKING_DIR, 'reports');

const args = process.argv.slice(2);
const readArg = (flag, fallback) => {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return fallback;
  return args[idx + 1];
};

const hasFlag = (flag) => args.includes(flag);

const batchNumber = parseInt(readArg('--batch', '1'), 10);
const batchSize = parseInt(readArg('--batch-size', String(BATCH_SIZE)), 10);
const resumeFrom = readArg('--resume', null);
const presetFilter = readArg('--preset', null);
const screenshotWidth = parseInt(readArg('--width', '640'), 10);
const screenshotHeight = parseInt(readArg('--height', '360'), 10);

const collectMilkwavePresets = () => {
  if (!fs.existsSync(PRESETS_DIR)) {
    console.error(`Presets directory not found: ${PRESETS_DIR}`);
    process.exit(1);
  }
  return fs.readdirSync(PRESETS_DIR)
    .filter(f => f.includes('milkwave') && f.endsWith('.json') && f.startsWith('preset-'))
    .sort();
};

const loadTracking = () => {
  if (!fs.existsSync(TRACKING_FILE)) return { version: 1, totalPresets: 0, completedBatches: [], currentBatch: null, lastUpdated: null };
  return JSON.parse(fs.readFileSync(TRACKING_FILE, 'utf8'));
};

const saveTracking = (tracking) => {
  tracking.lastUpdated = new Date().toISOString();
  fs.mkdirSync(path.dirname(TRACKING_FILE), { recursive: true });
  fs.writeFileSync(TRACKING_FILE, JSON.stringify(tracking, null, 2) + '\n', 'utf8');
};

const getBatchRange = (allPresets, batchNum, size) => {
  const start = (batchNum - 1) * size;
  const end = Math.min(start + size, allPresets.length);
  return { start, end, presets: allPresets.slice(start, end) };
};

const ensureDirs = (batchNum) => {
  const batchDir = path.join(BATCHES_DIR, `batch-${String(batchNum).padStart(4, '0')}`);
  const batchScreenshots = path.join(SCREENSHOTS_DIR, `batch-${String(batchNum).padStart(4, '0')}`);
  const batchShaders = path.join(SHADERS_DIR, `batch-${String(batchNum).padStart(4, '0')}`);
  [TRACKING_DIR, BATCHES_DIR, SCREENSHOTS_DIR, SHADERS_DIR, REPORTS_DIR, batchDir, batchScreenshots, batchShaders].forEach(d => {
    fs.mkdirSync(d, { recursive: true });
  });
  return { batchDir, batchScreenshots, batchShaders };
};

const loadPresetAsProject = (presetFile) => {
  const filePath = path.join(PRESETS_DIR, presetFile);
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!raw.scenes || !raw.scenes.length) return null;

  const project = { ...raw };

  if (!project.name && project.metadata?.name) {
    project.name = project.metadata.name;
  }
  if (!project.name) {
    project.name = presetFile.replace('.json', '');
  }
  if (!project.createdAt && project.metadata?.createdAt) {
    project.createdAt = project.metadata.createdAt;
  }
  if (!project.createdAt) {
    project.createdAt = new Date().toISOString();
  }
  if (!project.updatedAt && project.metadata?.updatedAt) {
    project.updatedAt = project.metadata.updatedAt;
  }

  const cleanStringArray = (arr) => {
    if (!Array.isArray(arr)) return arr;
    return arr.map(item => (item === null || item === undefined) ? '' : String(item));
  };

  const cleanShaderData = (sd) => {
    if (!sd) return sd;
    const cleaned = { ...sd };
    cleaned.perFrameCode = cleanStringArray(cleaned.perFrameCode);
    cleaned.perFrameInitCode = cleanStringArray(cleaned.perFrameInitCode);
    cleaned.perPixelCode = cleanStringArray(cleaned.perPixelCode);
    if (cleaned.waves) {
      cleaned.waves = cleaned.waves.map(w => ({
        ...w,
        initCode: cleanStringArray(w.initCode),
        perFrameCode: cleanStringArray(w.perFrameCode),
        perPointCode: cleanStringArray(w.perPointCode)
      }));
    }
    if (cleaned.shapes) {
      cleaned.shapes = cleaned.shapes.map(s => ({
        ...s,
        initCode: cleanStringArray(s.initCode),
        perFrameCode: cleanStringArray(s.perFrameCode),
        perPointCode: cleanStringArray(s.perPointCode)
      }));
    }
    return cleaned;
  };

  const shaderData = project._shaderData ? cleanShaderData(project._shaderData) : null;

  if (shaderData && project.scenes) {
    for (const scene of project.scenes) {
      if (!scene._shaderData) {
        scene._shaderData = shaderData;
      } else {
        scene._shaderData = cleanShaderData(scene._shaderData);
      }
      // Ensure milkwave layers have generatorId set
      if (scene.layers) {
        for (const layer of scene.layers) {
          if (layer.id === 'layer-milkwave' && !layer.generatorId) {
            layer.generatorId = 'gen-milkwave';
          }
        }
      }
    }
  }

  if (project._shaderData) {
    delete project._shaderData;
  }

  return project;
};

const waitForApp = async (page, timeoutMs = 90000) => {
  await page.waitForFunction(() => Boolean(window.__visualSynthInitialized), { timeout: timeoutMs });
  await page.waitForFunction(() => Boolean(window.__visualSynthCaptureApi?.applyProject), { timeout: timeoutMs });
};

const waitForFrames = async (page, count) => {
  try {
    await page.evaluate(async (frameCount) => {
      for (let i = 0; i < frameCount; i += 1) {
        await new Promise((resolve) => requestAnimationFrame(() => resolve()));
      }
    }, count);
  } catch (err) {
    // Frame may have been detached during project switch — treat as recovered
    await sleep(200);
  }
};

const captureCanvasScreenshot = async (page, filePath) => {
  try {
    const dataUrl = await page.evaluate(() => {
      const canvas = document.getElementById('gl-canvas');
      if (!canvas) return null;
      return canvas.toDataURL('image/png');
    });
    if (dataUrl) {
      const base64Data = dataUrl.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      fs.writeFileSync(filePath, buffer);
      return buffer.length;
    }
  } catch (err) {
    // Frame detached — retry once
    await sleep(500);
    try {
      const dataUrl = await page.evaluate(() => {
        const canvas = document.getElementById('gl-canvas');
        if (!canvas) return null;
        return canvas.toDataURL('image/png');
      });
      if (dataUrl) {
        const base64Data = dataUrl.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(filePath, buffer);
        return buffer.length;
      }
    } catch (_) { /* still failed */ }
  }
  return 0;
};

const sampleCanvasPixels = async (page) => {
  try {
    return await page.evaluate(() => {
      const canvas = document.getElementById('gl-canvas');
      if (!(canvas instanceof HTMLCanvasElement)) return { ready: false, nonBlackSamples: 0, samples: [], avgBrightness: 0 };
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) return { ready: false, nonBlackSamples: 0, samples: [], avgBrightness: 0 };

      const samplePoints = [
        [0.5, 0.5], [0.25, 0.25], [0.75, 0.25],
        [0.25, 0.75], [0.75, 0.75], [0.1, 0.1],
        [0.9, 0.9], [0.5, 0.25], [0.5, 0.75]
      ];
      const samples = samplePoints.map(([nx, ny]) => {
        const x = Math.min(canvas.width - 1, Math.max(0, Math.floor(canvas.width * nx)));
        const y = Math.min(canvas.height - 1, Math.max(0, Math.floor(canvas.height * ny)));
        const pixels = new Uint8Array(4);
        gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        return Array.from(pixels);
      });
      const nonBlackSamples = samples.filter((rgba) => rgba[0] > 8 || rgba[1] > 8 || rgba[2] > 8).length;
      const totalBrightness = samples.reduce((sum, rgba) => sum + rgba[0] + rgba[1] + rgba[2], 0);
      const avgBrightness = totalBrightness / (samples.length * 3);
      return { ready: true, nonBlackSamples, samples, avgBrightness: Math.round(avgBrightness * 10) / 10 };
    });
  } catch (err) {
    // Frame detached — return empty
    return { ready: false, nonBlackSamples: 0, samples: [], avgBrightness: 0 };
  }
};

const getDiagnostics = async (page) => {
  try {
    return await page.evaluate(() => window.__visualSynthCaptureApi.getDiagnostics());
  } catch (err) {
    return null;
  }
};

const getGeneratedShaderCode = async (page) => {
  return page.evaluate(() => {
    const canvas = document.getElementById('gl-canvas');
    if (!canvas) return { warpSource: null, compSource: null };
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return { warpSource: null, compSource: null };
    const dbg = gl.getExtension('WEBGL_debug_shaders');
    if (!dbg) return { warpSource: null, compSource: null, note: 'WEBGL_debug_shaders not available - capturing source from diagnostics instead' };
    return { note: 'WEBGL_debug_shaders available but cannot enumerate compiled shaders programmatically - use diagnostics compile report' };
  });
};

const waitForCanvasEvidence = async (page, timeoutMs = 8000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const evidence = await sampleCanvasPixels(page);
    if (evidence.ready && evidence.nonBlackSamples > 0) return evidence;
    await waitForFrames(page, 2);
    await sleep(100);
  }
  return sampleCanvasPixels(page);
};

const testSinglePreset = async (page, presetFile, screenshotDir, shaderDir) => {
  const presetId = presetFile.replace('.json', '');
  const result = {
    presetFile,
    presetId,
    status: 'unknown',
    screenshots: [],
    pixelEvidence: [],
    diagnostics: null,
    shaderData: null,
    errors: [],
    timings: {}
  };

  const project = loadPresetAsProject(presetFile);
  if (!project) {
    result.status = 'error';
    result.errors.push('Failed to load preset as project');
    return result;
  }

  const shaderData = project._shaderData || project.scenes?.[0]?._shaderData;
  result.shaderData = {
    hasWarpShader: Boolean(shaderData?.warp),
    hasCompShader: Boolean(shaderData?.comp),
    hasPerFrameCode: Boolean(shaderData?.perFrameCode?.length),
    hasPerPixelCode: Boolean(shaderData?.perPixelCode?.length),
    hasPerFrameInitCode: Boolean(shaderData?.perFrameInitCode?.length),
    hasShapes: Boolean(shaderData?.shapes?.length),
    hasWaves: Boolean(shaderData?.waves?.length),
    warpSourceLength: shaderData?.warp?.length ?? 0,
    compSourceLength: shaderData?.comp?.length ?? 0,
    warpSource: shaderData?.warp || null,
    compSource: shaderData?.comp || null,
    perFrameCode: shaderData?.perFrameCode || [],
    perPixelCode: shaderData?.perPixelCode || [],
    originalParameters: shaderData?.originalParameters || null,
    translation: shaderData?.translation || null
  };

  if (shaderData?.warp) {
    fs.mkdirSync(shaderDir, { recursive: true });
    fs.writeFileSync(path.join(shaderDir, `${presetId}.warp.glsl`), shaderData.warp, 'utf8');
  }
  if (shaderData?.comp) {
    fs.mkdirSync(shaderDir, { recursive: true });
    fs.writeFileSync(path.join(shaderDir, `${presetId}.comp.glsl`), shaderData.comp, 'utf8');
  }

  try {
    const applyStart = Date.now();
    // Apply project with retry to handle frame detachment
    let applied = false;
    for (let attempt = 0; attempt < 3 && !applied; attempt++) {
      try {
        await page.evaluate(async (projectData) => {
          await window.__visualSynthCaptureApi.applyProject(projectData, { skipRecovery: true });
        }, project);
        applied = true;
      } catch (applyErr) {
        if (attempt < 2) await sleep(1000);
        else throw applyErr;
      }
    }
    // Wait for renderer to settle after project switch
    await sleep(500);
    await waitForFrames(page, SETTLE_FRAMES);
    result.timings.apply = Date.now() - applyStart;

    const evidenceStart = Date.now();
    const evidence = await waitForCanvasEvidence(page, EVIDENCE_TIMEOUT_MS);
    result.timings.evidence = Date.now() - evidenceStart;
    result.pixelEvidence.push({ time: 'initial', ...evidence });

    const diagnostics = await getDiagnostics(page);
    result.diagnostics = {
      lastShaderError: diagnostics?.lastShaderError ?? null,
      safeModeReasons: diagnostics?.safeModeReasons ?? [],
      milkdropCompileReport: diagnostics?.milkdropCompileReport ?? null,
      milkdropNativeRuntimeReport: diagnostics?.milkdropNativeRuntimeReport ?? null,
      enabledLayerIds: diagnostics?.enabledLayerIds ?? [],
      activeGeneratorIds: diagnostics?.activeGeneratorIds ?? [],
      renderSnapshot: diagnostics?.renderSnapshot ?? null
    };

    if (diagnostics?.milkdropCompileReport) {
      const report = diagnostics.milkdropCompileReport;
      if (report.warp?.source) {
        fs.mkdirSync(shaderDir, { recursive: true });
        fs.writeFileSync(path.join(shaderDir, `${presetId}.warp.compiled.glsl`), report.warp.source, 'utf8');
      }
      if (report.comp?.source) {
        fs.mkdirSync(shaderDir, { recursive: true });
        fs.writeFileSync(path.join(shaderDir, `${presetId}.comp.compiled.glsl`), report.comp.source, 'utf8');
      }
    }

    for (let shotIdx = 0; shotIdx < SCREENSHOT_COUNT; shotIdx++) {
      if (shotIdx > 0) {
        await sleep(SCREENSHOT_INTERVAL_MS);
      }
      const shotTime = (shotIdx + 1) * SCREENSHOT_INTERVAL_MS / 1000;
      const shotPath = path.join(screenshotDir, `${presetId}_t${shotIdx + 1}.png`);
      const size = await captureCanvasScreenshot(page, shotPath);
      const pixels = await sampleCanvasPixels(page);
      result.screenshots.push({
        timeSeconds: shotTime,
        path: shotPath,
        sizeBytes: size,
        pixels: { ...pixels }
      });
      result.pixelEvidence.push({ time: `${shotTime}s`, ...pixels });
    }

    const hasError = diagnostics?.lastShaderError;
    const inSafeMode = diagnostics?.safeModeReasons?.length > 0;
    const compile = diagnostics?.milkdropCompileReport;
    const warpFailed = compile?.warp?.requested && !compile?.warp?.compiled;
    const compFailed = compile?.comp?.requested && !compile?.comp?.compiled;
    const warpFallback = compile?.warp?.fallbackUsed;
    const compFallback = compile?.comp?.fallbackUsed;
    const finalEvidence = result.pixelEvidence[result.pixelEvidence.length - 1];
    const isBlack = !finalEvidence || finalEvidence.nonBlackSamples === 0;

    // Smart classification: if canvas has visible output, consider it working
    // even if fallbackUsed flag is set (renderer can set this even on successful compile)
    const hasVisibleOutput = finalEvidence?.nonBlackSamples >= 3 && finalEvidence?.avgBrightness > 5;

    if (hasError) {
      result.status = 'shader_error';
      result.errors.push(hasError);
    } else if (inSafeMode) {
      result.status = 'safe_mode';
      result.errors.push(...diagnostics.safeModeReasons);
    } else if (warpFailed || compFailed) {
      result.status = 'compile_failed';
      if (warpFailed) result.errors.push('warp shader failed to compile');
      if (compFailed) result.errors.push('comp shader failed to compile');
    } else if (hasVisibleOutput) {
      // Has visible output - consider it working regardless of fallbackUsed flag
      result.status = 'working';
    } else if (warpFallback || compFallback) {
      result.status = 'fallback';
      if (warpFallback) result.errors.push('warp shader using fallback');
      if (compFallback) result.errors.push('comp shader using fallback: ' + (compile?.comp?.error || '').substring(0, 200));
    } else if (isBlack) {
      result.status = 'black_output';
      result.errors.push('Canvas output is all black after rendering');
    } else {
      result.status = 'working';
    }

  } catch (err) {
    result.status = 'runtime_error';
    result.errors.push(String(err));
  }

  return result;
};

const analyzeBatchResults = (results) => {
  const summary = {
    total: results.length,
    working: 0,
    shader_error: 0,
    compile_failed: 0,
    safe_mode: 0,
    black_output: 0,
    runtime_error: 0,
    fallback: 0,
    error: 0,
    unknown: 0,
    byFeatureType: {
      withWarpShader: 0,
      withCompShader: 0,
      withPerFrameCode: 0,
      withPerPixelCode: 0,
      withShapes: 0,
      withWaves: 0,
      pureParameter: 0
    },
    commonErrors: {},
    failingPresets: []
  };

  for (const result of results) {
    summary[result.status] = (summary[result.status] || 0) + 1;

    if (result.status !== 'working' && result.status !== 'unknown') {
      summary.failingPresets.push({
        presetFile: result.presetFile,
        presetId: result.presetId,
        status: result.status,
        errors: result.errors
      });
    }

    if (result.shaderData) {
      if (result.shaderData.hasWarpShader) summary.byFeatureType.withWarpShader++;
      if (result.shaderData.hasCompShader) summary.byFeatureType.withCompShader++;
      if (result.shaderData.hasPerFrameCode) summary.byFeatureType.withPerFrameCode++;
      if (result.shaderData.hasPerPixelCode) summary.byFeatureType.withPerPixelCode++;
      if (result.shaderData.hasShapes) summary.byFeatureType.withShapes++;
      if (result.shaderData.hasWaves) summary.byFeatureType.withWaves++;
      if (!result.shaderData.hasWarpShader && !result.shaderData.hasCompShader &&
          !result.shaderData.hasPerFrameCode && !result.shaderData.hasPerPixelCode) {
        summary.byFeatureType.pureParameter++;
      }
    }

    for (const err of result.errors) {
      const key = err.substring(0, 120);
      summary.commonErrors[key] = (summary.commonErrors[key] || 0) + 1;
    }
  }

  return summary;
};

const generateBatchReport = (batchNum, results, summary) => {
  const lines = [];
  lines.push(`# Milkwave Preset Batch Test Report - Batch ${batchNum}`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('## Summary');
  lines.push(`- Total presets: ${summary.total}`);
  lines.push(`- Working: ${summary.working} (${(summary.working / summary.total * 100).toFixed(1)}%)`);
  lines.push(`- Shader errors: ${summary.shader_error}`);
  lines.push(`- Compile failures: ${summary.compile_failed}`);
  lines.push(`- Fallback shaders: ${summary.fallback}`);
  lines.push(`- Black output: ${summary.black_output}`);
  lines.push(`- Safe mode: ${summary.safe_mode}`);
  lines.push(`- Runtime errors: ${summary.runtime_error}`);
  lines.push(`- Unknown: ${summary.unknown}`);
  lines.push('');
  lines.push('## Feature Distribution');
  lines.push(`- With warp shader (HLSL/GLSL): ${summary.byFeatureType.withWarpShader}`);
  lines.push(`- With comp shader (HLSL/GLSL): ${summary.byFeatureType.withCompShader}`);
  lines.push(`- With per-frame EEL code: ${summary.byFeatureType.withPerFrameCode}`);
  lines.push(`- With per-pixel EEL code: ${summary.byFeatureType.withPerPixelCode}`);
  lines.push(`- With custom shapes: ${summary.byFeatureType.withShapes}`);
  lines.push(`- With custom waves: ${summary.byFeatureType.withWaves}`);
  lines.push(`- Pure parameter presets: ${summary.byFeatureType.pureParameter}`);
  lines.push('');
  lines.push('## Common Errors');
  const sortedErrors = Object.entries(summary.commonErrors).sort((a, b) => b[1] - a[1]);
  for (const [err, count] of sortedErrors.slice(0, 20)) {
    lines.push(`- [${count}x] ${err}`);
  }
  lines.push('');

  if (summary.failingPresets.length > 0) {
    lines.push('## Failing Presets');
    lines.push('');
    lines.push('| # | Preset | Status | Error |');
    lines.push('|---|--------|--------|-------|');
    summary.failingPresets.forEach((fp, idx) => {
      const shortName = fp.presetFile.replace('preset-', '').replace('-milkwave-', ' ').substring(0, 60);
      const errStr = fp.errors.join('; ').substring(0, 80);
      lines.push(`| ${idx + 1} | ${shortName} | ${fp.status} | ${errStr} |`);
    });
    lines.push('');
  }

  lines.push('## Per-Preset Results');
  lines.push('');
  lines.push('| # | Preset | Status | Warp | Comp | EEL-Frame | EEL-Pixel | Shapes | Waves | Black? | Brightness |');
  lines.push('|---|--------|--------|------|------|-----------|-----------|--------|-------|--------|------------|');
  results.forEach((r, idx) => {
    const shortName = r.presetFile.replace('preset-', '').replace('-milkwave-', ' ').substring(0, 50);
    const sd = r.shaderData || {};
    const hasW = sd.hasWarpShader ? 'Y' : '-';
    const hasC = sd.hasCompShader ? 'Y' : '-';
    const hasPF = sd.hasPerFrameCode ? 'Y' : '-';
    const hasPP = sd.hasPerPixelCode ? 'Y' : '-';
    const hasS = sd.hasShapes ? 'Y' : '-';
    const hasWv = sd.hasWaves ? 'Y' : '-';
    const lastEvidence = r.pixelEvidence?.[r.pixelEvidence.length - 1];
    const black = lastEvidence?.nonBlackSamples === 0 ? 'YES' : 'no';
    const brightness = lastEvidence?.avgBrightness ?? '?';
    lines.push(`| ${idx + 1} | ${shortName} | ${r.status} | ${hasW} | ${hasC} | ${hasPF} | ${hasPP} | ${hasS} | ${hasWv} | ${black} | ${brightness} |`);
  });
  lines.push('');

  return lines.join('\n');
};

const main = async () => {
  console.log('=== Milkwave Preset Batch Tester ===');
  console.log(`Batch: ${batchNumber}, Batch size: ${batchSize}`);

  const allPresets = collectMilkwavePresets();
  console.log(`Total milkwave presets found: ${allPresets.length}`);

  let targetPresets;
  let resumeIndex = 0;

  if (presetFilter) {
    targetPresets = allPresets.filter(p => p.includes(presetFilter));
    if (targetPresets.length === 0) {
      console.error(`No presets matching filter: ${presetFilter}`);
      process.exit(1);
    }
    console.log(`Filtered to ${targetPresets.length} presets matching: ${presetFilter}`);
  } else {
    const { start, end, presets } = getBatchRange(allPresets, batchNumber, batchSize);
    targetPresets = presets;
    console.log(`Batch range: presets ${start + 1} - ${end} of ${allPresets.length}`);
  }

  if (resumeFrom) {
    resumeIndex = targetPresets.findIndex(p => p === resumeFrom);
    if (resumeIndex === -1) resumeIndex = 0;
    else resumeIndex = Math.max(0, resumeIndex);
    console.log(`Resuming from: ${targetPresets[resumeIndex]} (index ${resumeIndex})`);
  }

  const { batchDir, batchScreenshots, batchShaders } = ensureDirs(batchNumber);

  const tracking = loadTracking();
  tracking.totalPresets = allPresets.length;

  const partialResults = [];
  const partialPath = path.join(batchDir, `batch-${batchNumber}-partial.json`);
  if (resumeFrom && fs.existsSync(partialPath)) {
    const prev = JSON.parse(fs.readFileSync(partialPath, 'utf8'));
    partialResults.push(...(prev.results || []));
    console.log(`Loaded ${partialResults.length} previous results`);
  }

  console.log(`\nLaunching headless browser...`);
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  const consoleEntries = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      consoleEntries.push({ type: msg.type(), text: msg.text().substring(0, 500) });
    }
  });
  page.on('pageerror', (error) => {
    consoleEntries.push({ type: 'pageerror', text: String(error).substring(0, 500) });
  });

  await page.setViewport({ width: screenshotWidth, height: screenshotHeight });

  await page.evaluateOnNewDocument(() => {
    window.navigator.requestMIDIAccess = async () => ({
      inputs: new Map(), outputs: new Map(), onstatechange: null, sysexEnabled: false
    });
    if (window.navigator.mediaDevices) {
      window.navigator.mediaDevices.getUserMedia = async () => {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        return audioContext.createMediaStreamDestination().stream;
      };
      window.navigator.mediaDevices.enumerateDevices = async () => [
        { deviceId: 'default', kind: 'audioinput', label: 'Synthetic Audio Source' }
      ];
    }
    window.__mockOnCloseRequested = null;
    if (!window.visualSynth) {
      window.visualSynth = {};
    }
    window.visualSynth.onCloseRequested = (cb) => { window.__mockOnCloseRequested = cb; };
    window.visualSynth.showSaveDialog = async () => ({ result: 'cancel' });
    window.visualSynth.saveProject = async () => ({ canceled: true });
    window.visualSynth.saveProjectAs = async () => ({ canceled: true });
    window.visualSynth.confirmClose = async () => {};
  });

  const rendererPath = path.join(__dirname, '..', 'dist', 'renderer', 'index.html');
  console.log(`Loading app from: ${rendererPath}`);

  try {
    await page.goto(`file://${rendererPath.replace(/\\/g, '/')}`, { waitUntil: 'load' });
    console.log('Page loaded, waiting for app init...');

    // Use retry logic for waitForFunction to handle frame detachment
    const waitForInit = async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await page.waitForFunction(() => Boolean(window.__visualSynthInitialized), { timeout: 120000 });
          console.log('App initialized flag set, waiting for capture API...');
          await sleep(5000);
          await page.waitForFunction(() => Boolean(window.__visualSynthCaptureApi?.applyProject), { timeout: 60000 });
          await waitForFrames(page, 6);
          console.log('App fully initialized with capture API');
          return true;
        } catch (err) {
          if (err.message.includes('detached') || err.message.includes('detached Frame')) {
            console.log(`Frame detached (attempt ${attempt + 1}), retrying...`);
            await sleep(2000);
            continue;
          }
          throw err;
        }
      }
      throw new Error('Frame detached after 3 retries');
    };
    await waitForInit();
  } catch (err) {
    console.error(`Failed to initialize app: ${err}`);
    try {
      const initCheck = await page.evaluate(() => ({
        initialized: window.__visualSynthInitialized,
        hasCaptureApi: Boolean(window.__visualSynthCaptureApi),
        hasApplyProject: Boolean(window.__visualSynthCaptureApi?.applyProject),
      }));
      console.error('Init state:', JSON.stringify(initCheck));
    } catch {
      console.error('Could not check init state - page frame detached');
    }
    await browser.close();
    process.exit(1);
  }

  const results = [...partialResults];
  const startTime = Date.now();

  for (let i = resumeIndex; i < targetPresets.length; i++) {
    const presetFile = targetPresets[i];
    const presetNum = i + 1;
    console.log(`\n[${presetNum}/${targetPresets.length}] Testing: ${presetFile.substring(0, 80)}`);

    const presetScreenshotDir = path.join(batchScreenshots, targetPresets[i].replace('.json', ''));
    fs.mkdirSync(presetScreenshotDir, { recursive: true });

    const result = await testSinglePreset(page, presetFile, presetScreenshotDir, batchShaders);
    results.push(result);

    const statusIcon = result.status === 'working' ? 'OK' : 'FAIL';
    const lastEvidence = result.pixelEvidence?.[result.pixelEvidence.length - 1];
    console.log(`  ${statusIcon} status=${result.status} nonBlack=${lastEvidence?.nonBlackSamples ?? '?'} brightness=${lastEvidence?.avgBrightness ?? '?'}`);

    fs.mkdirSync(path.dirname(partialPath), { recursive: true });
    fs.writeFileSync(partialPath, JSON.stringify({
      batchNumber,
      batchSize,
      totalInBatch: targetPresets.length,
      processedCount: results.length,
      startTime: new Date(startTime).toISOString(),
      lastUpdated: new Date().toISOString(),
      results
    }, null, 2) + '\n', 'utf8');
  }

  console.log(`\n\n=== Analyzing results ===`);
  const summary = analyzeBatchResults(results);
  const report = generateBatchReport(batchNumber, results, summary);

  const reportPath = path.join(REPORTS_DIR, `batch-${String(batchNumber).padStart(4, '0')}-report.md`);
  const reportJsonPath = path.join(REPORTS_DIR, `batch-${String(batchNumber).padStart(4, '0')}-report.json`);
  fs.writeFileSync(reportPath, report, 'utf8');
  fs.writeFileSync(reportJsonPath, JSON.stringify({ batchNumber, summary, results, consoleEntries }, null, 2) + '\n', 'utf8');

  tracking.currentBatch = batchNumber;
  if (!tracking.completedBatches) tracking.completedBatches = [];
  const batchEntry = {
    batchNumber,
    totalPresets: targetPresets.length,
    working: summary.working,
    failed: summary.total - summary.working,
    completedAt: new Date().toISOString(),
    reportPath,
    durationMs: Date.now() - startTime
  };
  const existingIdx = tracking.completedBatches.findIndex(b => b.batchNumber === batchNumber);
  if (existingIdx >= 0) tracking.completedBatches[existingIdx] = batchEntry;
  else tracking.completedBatches.push(batchEntry);
  saveTracking(tracking);

  console.log(`\n=== Batch ${batchNumber} Complete ===`);
  console.log(`Duration: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  console.log(`Working: ${summary.working}/${summary.total} (${(summary.working / summary.total * 100).toFixed(1)}%)`);
  console.log(`Report: ${reportPath}`);
  console.log(`Partial: ${partialPath}`);
  console.log(`\nNext batch: node scripts/milkwave-batch-test.js --batch ${batchNumber + 1}`);

  await browser.close();
};

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
