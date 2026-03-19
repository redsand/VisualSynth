#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const inputArg = process.argv[2];
if (!inputArg) {
  console.error('Usage: node scripts/runtime-audit-milkwave-project.js <project.json> [--start N] [--count N]');
  process.exit(1);
}

const args = process.argv.slice(3);
const readNumberArg = (flag, fallback) => {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return fallback;
  const value = Number.parseInt(args[idx + 1], 10);
  return Number.isFinite(value) ? value : fallback;
};

const inputPath = path.resolve(process.cwd(), inputArg);
if (!fs.existsSync(inputPath)) {
  console.error(`File not found: ${inputPath}`);
  process.exit(1);
}

const rendererPath = path.join(process.cwd(), 'dist', 'renderer', 'index.html');
if (!fs.existsSync(rendererPath)) {
  console.error('dist/renderer/index.html not found. Run npm run build first.');
  process.exit(1);
}

const project = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const startIndex = Math.max(0, readNumberArg('--start', 0));
const requestedCount = readNumberArg('--count', project.scenes?.length ?? 0);
const settleFrames = Math.max(1, readNumberArg('--settle-frames', 8));
const evidenceTimeoutMs = Math.max(500, readNumberArg('--evidence-timeout', 6000));
const targetScenes = (project.scenes || []).slice(startIndex, startIndex + Math.max(0, requestedCount));

const waitForApp = async (page, timeoutMs = 30000) => {
  await page.waitForFunction(() => Boolean(window.__visualSynthInitialized), { timeout: timeoutMs });
  await page.waitForFunction(() => Boolean(window.__visualSynthCaptureApi?.applyProject), { timeout: timeoutMs });
};

const waitForFrames = async (page, count) => {
  await page.evaluate(async (frameCount) => {
    for (let i = 0; i < frameCount; i += 1) {
      await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    }
  }, count);
};

const waitForCanvasEvidence = async (page, timeoutMs = 6000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const evidence = await page.evaluate(() => {
      const canvas = document.getElementById('gl-canvas');
      if (!(canvas instanceof HTMLCanvasElement)) {
        return { ready: false, nonBlackSamples: 0, samples: [] };
      }
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) {
        return { ready: false, nonBlackSamples: 0, samples: [] };
      }

      const samplePoints = [
        [0.5, 0.5],
        [0.25, 0.25],
        [0.75, 0.25],
        [0.25, 0.75],
        [0.75, 0.75]
      ];
      const samples = samplePoints.map(([nx, ny]) => {
        const x = Math.min(canvas.width - 1, Math.max(0, Math.floor(canvas.width * nx)));
        const y = Math.min(canvas.height - 1, Math.max(0, Math.floor(canvas.height * ny)));
        const pixels = new Uint8Array(4);
        gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        return Array.from(pixels);
      });
      const nonBlackSamples = samples.filter((rgba) => rgba[0] > 8 || rgba[1] > 8 || rgba[2] > 8).length;
      return {
        ready: true,
        nonBlackSamples,
        samples
      };
    });

    if (evidence.ready && evidence.nonBlackSamples > 0) {
      return evidence;
    }

    await waitForFrames(page, 2);
    await sleep(100);
  }

  return page.evaluate(() => {
    const canvas = document.getElementById('gl-canvas');
    if (!(canvas instanceof HTMLCanvasElement)) {
      return { ready: false, nonBlackSamples: 0, samples: [] };
    }
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) {
      return { ready: false, nonBlackSamples: 0, samples: [] };
    }
    const pixels = new Uint8Array(4);
    gl.readPixels(
      Math.max(0, Math.floor(canvas.width / 2)),
      Math.max(0, Math.floor(canvas.height / 2)),
      1,
      1,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels
    );
    return { ready: true, nonBlackSamples: (pixels[0] > 8 || pixels[1] > 8 || pixels[2] > 8) ? 1 : 0, samples: [Array.from(pixels)] };
  });
};

const main = async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  const consoleEntries = [];
  const pageErrors = [];

  page.on('console', (msg) => {
    consoleEntries.push({ type: msg.type(), text: msg.text() });
  });
  page.on('pageerror', (error) => {
    pageErrors.push(String(error));
  });

  await page.setViewport({ width: 1280, height: 720 });

  await page.evaluateOnNewDocument(() => {
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
    await page.goto(`file://${rendererPath.replace(/\\/g, '/')}`, { waitUntil: 'load' });
    await waitForApp(page);
    await waitForFrames(page, 6);

    await page.evaluate(async (projectData) => {
      await window.__visualSynthCaptureApi.applyProject(projectData, { skipRecovery: true });
    }, project);

    await waitForFrames(page, 10);

    const reports = [];
    for (let index = 0; index < targetScenes.length; index += 1) {
      const scene = targetScenes[index];
      console.log(`[RuntimeAudit] Scene ${startIndex + index + 1}/${project.scenes.length}: ${scene.name || scene.id}`);
      try {
        await page.evaluate((sceneId) => {
          window.__visualSynthCaptureApi.applyScene(sceneId);
        }, scene.id);
        await waitForFrames(page, settleFrames);
        await sleep(150);
        const evidence = await waitForCanvasEvidence(page, evidenceTimeoutMs);
        const diagnostics = await page.evaluate(() => window.__visualSynthCaptureApi.getDiagnostics());

        const compile = diagnostics?.milkdropCompileReport ?? null;
        const nativeRuntime = diagnostics?.milkdropNativeRuntimeReport ?? null;
        const noShaderError = !diagnostics?.lastShaderError;
        const noSafeMode = !diagnostics?.safeModeReasons?.length;
        const warpOkay = !compile?.warp?.requested || compile?.warp?.compiled;
        const compOkay = !compile?.comp?.requested || compile?.comp?.compiled;
        const runtimeConfirmed =
          noShaderError &&
          noSafeMode &&
          warpOkay &&
          compOkay &&
          evidence.nonBlackSamples > 0;

        reports.push({
          sceneId: scene.id,
          sceneName: scene.name || scene.id,
          runtimeConfirmed,
          nonBlackSamples: evidence.nonBlackSamples,
          pixelSamples: evidence.samples,
          lastShaderError: diagnostics?.lastShaderError ?? null,
          safeModeReasons: diagnostics?.safeModeReasons ?? [],
          compile,
          nativeRuntime
        });
        console.log(`[RuntimeAudit]   ${runtimeConfirmed ? 'confirmed' : 'rejected'} nonBlack=${evidence.nonBlackSamples}`);
      } catch (error) {
        reports.push({
          sceneId: scene.id,
          sceneName: scene.name || scene.id,
          runtimeConfirmed: false,
          nonBlackSamples: 0,
          pixelSamples: [],
          lastShaderError: String(error),
          safeModeReasons: ['runtime-audit-exception'],
          compile: null,
          nativeRuntime: null
        });
        console.log(`[RuntimeAudit]   exception ${String(error)}`);
      }

      const partialReportPath = inputPath.replace(/\.project\.json$/i, `.runtime-audit.partial.json`);
      fs.writeFileSync(partialReportPath, `${JSON.stringify({
        sourceProject: path.basename(inputPath),
        startIndex,
        requestedCount,
        settleFrames,
        evidenceTimeoutMs,
        processedCount: reports.length,
        reports
      }, null, 2)}\n`, 'utf8');
    }

    const confirmedSceneIds = new Set(reports.filter((report) => report.runtimeConfirmed).map((report) => report.sceneId));
    const confirmedProject = {
      ...project,
      name: `${project.name} [Runtime Confirmed ${startIndex + 1}-${startIndex + targetScenes.length}]`,
      scenes: targetScenes.filter((scene) => confirmedSceneIds.has(scene.id)),
      activeSceneId: targetScenes.find((scene) => confirmedSceneIds.has(scene.id))?.id ?? project.activeSceneId
    };

    const suffix = `.runtime-audit.${String(startIndex + 1).padStart(4, '0')}-${String(startIndex + targetScenes.length).padStart(4, '0')}`;
    const reportPath = inputPath.replace(/\.project\.json$/i, `${suffix}.json`);
    const confirmedPath = inputPath.replace(/\.project\.json$/i, `${suffix}.confirmed.project.json`);
    fs.writeFileSync(reportPath, `${JSON.stringify({
      sourceProject: path.basename(inputPath),
      startIndex,
      requestedCount,
      settleFrames,
      evidenceTimeoutMs,
      sceneCount: reports.length,
      confirmedCount: confirmedProject.scenes.length,
      rejectedCount: reports.length - confirmedProject.scenes.length,
      reports,
      consoleEntries,
      pageErrors
    }, null, 2)}\n`, 'utf8');
    fs.writeFileSync(confirmedPath, `${JSON.stringify(confirmedProject, null, 2)}\n`, 'utf8');

    console.log(`Runtime confirmed ${confirmedProject.scenes.length}/${reports.length} scenes in ${path.basename(inputPath)}`);
    console.log(`Wrote runtime audit: ${reportPath}`);
    console.log(`Wrote runtime-confirmed project: ${confirmedPath}`);
  } finally {
    await browser.close();
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
