import fs from 'fs';
import path from 'path';
import * as esbuild from 'esbuild';
import puppeteer from 'puppeteer';
import {
  FOCUSED_MILKWAVE_PRESETS,
  TARGET_MILKWAVE_PRESET_ID
} from '../src/shared/milkwaveTargetPreset';

const PRESETS_DIR = path.resolve(__dirname, '../assets/presets');
const AUDIT_RUNNER_SRC = path.resolve(__dirname, '../src/renderer/milkwaveAuditRunner.ts');
const DIST_RENDERER_BUNDLE = path.resolve(__dirname, '../dist/renderer/index.js');
const OUTPUT_DIR = path.resolve(__dirname, '../assets/presets');
const REPORT_JSON = path.join(OUTPUT_DIR, 'milkwave_audit_report.json');
const REPORT_MD = path.join(OUTPUT_DIR, 'milkwave_audit_report.md');
const DEFAULT_CHROMIUM_PATHS = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  'C:\\Program Files\\Chromium\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Chromium\\Application\\chrome.exe'
].filter((value): value is string => Boolean(value));

const parseArgs = () => {
  const args = process.argv.slice(2);
  let presetId: string | null = null;
  let presetIds: string[] | null = null;
  let limit = 100;
  let pack: number | null = null;
  let packSize = 100;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--preset') {
      const value = args[i + 1];
      if (!value) {
        throw new Error('Missing value for --preset');
      }
      presetId = value === 'target' ? TARGET_MILKWAVE_PRESET_ID : value;
      i += 1;
      continue;
    }
    if (arg === '--focus') {
      presetIds = FOCUSED_MILKWAVE_PRESETS.map((preset) => preset.id);
      continue;
    }
    if (arg === '--limit') {
      const value = Number(args[i + 1]);
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error('Invalid value for --limit');
      }
      limit = Math.floor(value);
      i += 1;
      continue;
    }
    if (arg === '--pack') {
      const value = Number(args[i + 1]);
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error('Invalid value for --pack');
      }
      pack = Math.floor(value);
      i += 1;
      continue;
    }
    if (arg === '--pack-size') {
      const value = Number(args[i + 1]);
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error('Invalid value for --pack-size');
      }
      packSize = Math.floor(value);
      i += 1;
      continue;
    }
    if (arg === '--all') {
      limit = Number.MAX_SAFE_INTEGER;
    }
  }

  if (pack !== null && (presetId || presetIds)) {
    throw new Error('--pack cannot be combined with --preset or --focus');
  }

  return { presetId, presetIds, limit, pack, packSize };
};

const escapeForTemplateLiteral = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

const exposeMilkdropRendererFromDistBundle = () => {
  if (!fs.existsSync(DIST_RENDERER_BUNDLE)) {
    throw new Error(`Fallback bundle not found at ${DIST_RENDERER_BUNDLE}. Run npm run build:index first.`);
  }

  const source = fs.readFileSync(DIST_RENDERER_BUNDLE, 'utf-8');
  const marker = /(\s+)void init\(\);\r?\n\}\)\(\);/;
  if (!marker.test(source)) {
    throw new Error('Unable to patch dist renderer bundle for audit fallback.');
  }

  return source.replace(
    marker,
    '$1window.__createMilkDropRenderer = createMilkDropRenderer;\n})();'
  );
};

const createAuditHarnessSource = () => `
(() => {
  const createAuditRenderState = (frame) => {
    const spectrum = Float32Array.from({ length: 64 }, (_, index) => 0.2 + 0.8 * (index / 63));
    const oscilloData = Float32Array.from({ length: 512 }, (_, index) =>
      Math.sin((index / 511) * Math.PI * 6 + frame * 0.1)
    );
    return {
      timeMs: frame * 16.6667,
      rms: 0.8,
      peak: 1,
      strobe: 0,
      spectrum,
      plasmaEnabled: false,
      spectrumEnabled: false,
      origamiEnabled: false,
      glyphEnabled: false,
      crystalEnabled: false,
      inkEnabled: false,
      topoEnabled: false,
      weatherEnabled: false,
      portalEnabled: false,
      mediaEnabled: false,
      oscilloEnabled: true,
      contrast: 1,
      saturation: 1,
      paletteShift: 0,
      transitionAmount: 0,
      transitionType: 0,
      chemistryMode: 0,
      motionTemplate: 0,
      effectsEnabled: false,
      bloom: 0,
      blur: 0,
      chroma: 0,
      posterize: 0,
      kaleidoscope: 0,
      kaleidoscopeRotation: 0,
      feedback: 0,
      persistence: 0,
      feedbackZoom: 0,
      feedbackRotation: 0,
      sdfEnabled: false,
      sdfShape: 0,
      sdfScale: 0,
      sdfEdge: 0,
      sdfGlow: 0,
      sdfRotation: 0,
      sdfFill: 0,
      plasmaOpacity: 0,
      plasmaSpeed: 0,
      plasmaScale: 0,
      plasmaComplexity: 0,
      plasmaAudioReact: 0,
      spectrumOpacity: 0,
      origamiOpacity: 0,
      origamiFoldState: 0,
      origamiFoldSharpness: 0,
      glyphOpacity: 0,
      glyphMode: 0,
      glyphSeed: 0,
      glyphBeat: 0,
      glyphSpeed: 0,
      crystalOpacity: 0,
      crystalMode: 0,
      crystalBrittleness: 0,
      crystalScale: 0,
      crystalSpeed: 0,
      inkOpacity: 0,
      inkBrush: 0,
      inkPressure: 0,
      inkLifespan: 0,
      inkSpeed: 0,
      inkScale: 0,
      topoOpacity: 0,
      topoQuake: 0,
      topoSlide: 0,
      topoPlate: 0,
      topoTravel: 0,
      topoScale: 0,
      topoElevation: 0,
      weatherOpacity: 0,
      weatherMode: 0,
      weatherIntensity: 0,
      weatherSpeed: 0,
      portalOpacity: 0,
      portalShift: 0,
      portalStyle: 0,
      portalPositions: new Float32Array(16),
      portalRadii: new Float32Array(8),
      portalActives: new Float32Array(8),
      mediaOpacity: 0,
      mediaBurstPositions: new Float32Array(16),
      mediaBurstRadii: new Float32Array(8),
      mediaBurstTypes: new Float32Array(8),
      mediaBurstActives: new Float32Array(8),
      oscilloOpacity: 1,
      oscilloMode: 0,
      oscilloFreeze: 0,
      oscilloRotate: 0,
      oscilloData,
      modulatorValues: new Float32Array(32),
      midiData: new Float32Array(32),
      plasmaAssetBlendMode: 0,
      plasmaAssetAudioReact: 0,
      spectrumAssetBlendMode: 0,
      spectrumAssetAudioReact: 0,
      mediaAssetBlendMode: 0,
      mediaAssetAudioReact: 0,
      trailSpectrum: spectrum,
      expressiveEnergyBloom: 0,
      expressiveEnergyThreshold: 0,
      expressiveEnergyAccumulation: 0,
      expressiveRadialGravity: 0,
      expressiveRadialStrength: 0,
      expressiveRadialRadius: 0,
      expressiveRadialFocusX: 0.5,
      expressiveRadialFocusY: 0.5,
      expressiveMotionEcho: 0,
      expressiveMotionEchoDecay: 0,
      expressiveMotionEchoWarp: 0,
      expressiveSpectralSmear: 0,
      expressiveSpectralOffset: 0,
      expressiveSpectralMix: 0,
      particlesEnabled: false,
      particleDensity: 0,
      particleSpeed: 0,
      particleSize: 0,
      particleGlow: 0,
      particleTurbulence: 0,
      particleAudioLift: 0,
      gravityPositions: new Float32Array(16),
      gravityStrengths: new Float32Array(8),
      gravityPolarities: new Float32Array(8),
      gravityActives: new Float32Array(8),
      gravityCollapse: 0,
      origamiSpeed: 0,
      roleWeights: { core: 1, support: 1, atmosphere: 1 },
      engineMass: 0,
      engineFriction: 0,
      engineElasticity: 0,
      maxBloom: 0,
      forceFeedback: false,
      engineGrain: 0,
      engineVignette: 0,
      engineCA: 0,
      engineSignature: 0,
      shapeBurstSpawnTimes: new Float32Array(8),
      shapeBurstActives: new Float32Array(8),
      milkDropShaderData: null,
      performanceMode: true,
      genUniforms: {}
    };
  };

  window.runMilkwaveAudit = async (presets) => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    document.body.appendChild(canvas);

    const errors = [];
    const renderer = window.__createMilkDropRenderer({
      canvas,
      onError: (err, type) => errors.push(\`[\${type}] \${err}\`)
    });

    const results = [];
    for (const preset of presets) {
      errors.length = 0;
      try {
        renderer.compileShaders(preset.shaderData);
      } catch (e) {
        errors.push(\`Runtime exception during compile: \${e}\`);
      }

      const compileReport = renderer.getLastCompileReport();

      for (let i = 0; i < 5; i++) {
        try {
          renderer.render(createAuditRenderState(i), preset.shaderData, false);
        } catch (e) {
          errors.push(\`Runtime exception during render: \${e}\`);
          break;
        }
      }

      const runtimeReport = renderer.getLastNativeRuntimeReport();
      const warpStatus = compileReport?.warp.status;
      const compStatus = compileReport?.comp.status;
      const hasVisibleMilkwaveActivity =
        (runtimeReport?.shapes.rendered ?? 0) > 0 || (runtimeReport?.waves.rendered ?? 0) > 0;

      let classification = 'runtime-failed';
      if (warpStatus === 'success' && compStatus === 'success' && hasVisibleMilkwaveActivity) {
        classification = 'native-supported';
      } else if (warpStatus === 'degraded' || compStatus === 'degraded') {
        classification = 'supported-with-degradation';
      } else if (warpStatus === 'fallback' || compStatus === 'fallback') {
        classification = 'fallback-only';
      } else if (warpStatus === 'failed' || compStatus === 'failed') {
        classification = 'runtime-failed';
      }

      if (errors.length > 0) {
        classification = 'runtime-failed';
      } else if ((warpStatus === 'success' || compStatus === 'success') && !hasVisibleMilkwaveActivity) {
        errors.push('No Milkwave shapes or waves rendered during audit frames');
        classification = 'runtime-failed';
      }

      const proofSteps = [
        {
          id: 'compile-warp',
          label: 'Warp path compiles successfully',
          passed: warpStatus === 'success' && (compileReport?.warp.compiled ?? false),
          details: \`status=\${warpStatus ?? 'unknown'}, compiled=\${compileReport?.warp.compiled ?? false}\`
        },
        {
          id: 'compile-comp',
          label: 'Comp path compiles successfully',
          passed: compStatus === 'success' && (compileReport?.comp.compiled ?? false),
          details: \`status=\${compStatus ?? 'unknown'}, compiled=\${compileReport?.comp.compiled ?? false}\`
        },
        {
          id: 'render-activity',
          label: 'Milkwave runtime renders visible activity',
          passed: hasVisibleMilkwaveActivity,
          details: \`shapes=\${runtimeReport?.shapes.rendered ?? 0}, waves=\${runtimeReport?.waves.rendered ?? 0}\`
        },
        {
          id: 'no-fallback',
          label: 'Runtime never reaches fallback or degraded path',
          passed: !((compileReport?.warp.fallbackUsed || compileReport?.comp.fallbackUsed) ?? false) && warpStatus === 'success' && compStatus === 'success',
          details: \`fallback=\${(compileReport?.warp.fallbackUsed || compileReport?.comp.fallbackUsed) ?? false}, warp=\${warpStatus ?? 'unknown'}, comp=\${compStatus ?? 'unknown'}\`
        },
        {
          id: 'no-errors',
          label: 'Audit completes without runtime or shader errors',
          passed: errors.length === 0,
          details: errors.length === 0 ? 'no errors recorded' : errors.join(' | ')
        }
      ];

      results.push({
        id: preset.id,
        name: preset.name,
        classification,
        warpCompiled: compileReport?.warp.compiled ?? false,
        compCompiled: compileReport?.comp.compiled ?? false,
        fallbackUsed: (compileReport?.warp.fallbackUsed || compileReport?.comp.fallbackUsed) ?? false,
        shapesRendered: runtimeReport?.shapes.rendered ?? 0,
        wavesRendered: runtimeReport?.waves.rendered ?? 0,
        errors: [...errors],
        warnings: [],
        auditAt: new Date().toISOString(),
        proof: {
          proven: proofSteps.every((step) => step.passed),
          fallbackReached: (compileReport?.warp.fallbackUsed || compileReport?.comp.fallbackUsed) ?? false,
          visibleActivity: hasVisibleMilkwaveActivity,
          stepCount: proofSteps.length,
          passedStepCount: proofSteps.filter((step) => step.passed).length,
          steps: proofSteps
        }
      });
    }

    return results;
  };
})();
`;

const loadAuditBundle = async () => {
  try {
    const bundle = await esbuild.build({
      entryPoints: [AUDIT_RUNNER_SRC],
      bundle: true,
      write: false,
      platform: 'browser',
      target: 'chrome120',
      loader: { '.glsl': 'text' },
      define: {
        'process.env.NODE_ENV': '"production"'
      }
    });

    return {
      source: bundle.outputFiles[0].text,
      mode: 'esbuild'
    } as const;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err?.code !== 'EPERM') {
      throw error;
    }

    console.warn('[Audit] esbuild spawn blocked, using dist renderer fallback bundle.');
    return {
      source: `${exposeMilkdropRendererFromDistBundle()}\n${createAuditHarnessSource()}`,
      mode: 'dist-fallback'
    } as const;
  }
};

const resolveBrowserExecutablePath = () => {
  for (const candidate of DEFAULT_CHROMIUM_PATHS) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return undefined;
};

const CHROMIUM_AUDIT_ARGS = [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--test-type',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-background-networking',
  '--disable-component-update',
  '--metrics-recording-only',
  '--remote-allow-origins=*'
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const connectToExistingBrowser = async ({
  browserUrl,
  wsEndpoint,
  attempts = 20,
  delayMs = 1000
}: {
  browserUrl?: string;
  wsEndpoint?: string;
  attempts?: number;
  delayMs?: number;
}) => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      if (browserUrl) {
        if (attempt > 1) {
          console.log(`Retrying browser URL connection (${attempt}/${attempts})...`);
        }
        return await puppeteer.connect({ browserURL: browserUrl });
      }
      if (wsEndpoint) {
        if (attempt > 1) {
          console.log(`Retrying browser WS connection (${attempt}/${attempts})...`);
        }
        return await puppeteer.connect({ browserWSEndpoint: wsEndpoint });
      }
      throw new Error('No browser connection target provided.');
    } catch (error) {
      lastError = error;
      if (attempt === attempts) {
        break;
      }
      await sleep(delayMs);
    }
  }

  throw lastError;
};

async function runAudit() {
  console.log('--- Milkwave Runtime Audit ---');
  const { presetId, presetIds, limit, pack, packSize } = parseArgs();

  // 1. Identify Milkwave presets
  const files = fs.readdirSync(PRESETS_DIR)
    .filter(f => f.endsWith('.json'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  const milkwavePresets: any[] = [];
  let count = 0;
  const packStart = pack !== null ? (pack - 1) * packSize : 0;
  const packEnd = pack !== null ? packStart + packSize : Number.MAX_SAFE_INTEGER;
  let matchedMilkwaveCount = 0;

  for (const file of files) {
    if (presetIds && !presetIds.includes(file.replace('.json', ''))) {
      continue;
    }
    if (presetId && file !== `${presetId}.json`) {
      continue;
    }
    if (!presetId && count >= limit) break;
    const filePath = path.join(PRESETS_DIR, file);
    try {
      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (content._shaderData && content.metadata?.importedFrom === 'Milkwave') {
        if (pack !== null) {
          if (matchedMilkwaveCount < packStart) {
            matchedMilkwaveCount += 1;
            continue;
          }
          if (matchedMilkwaveCount >= packEnd) {
            break;
          }
        }
        milkwavePresets.push({
          id: file.replace('.json', ''),
          name: content.metadata.name,
          shaderData: content._shaderData,
          expectedSupport: content.metadata.milkwave?.supportTier || 'unknown'
        });
        count++;
        matchedMilkwaveCount += 1;
      }
    } catch (e) {
      console.warn(`Failed to parse ${file}: ${e}`);
    }
  }

  if (presetId && milkwavePresets.length === 0) {
    throw new Error(`Target preset not found: ${presetId}`);
  }
  if (presetIds && milkwavePresets.length !== presetIds.length) {
    const foundIds = new Set(milkwavePresets.map((preset) => preset.id));
    const missing = presetIds.filter((id) => !foundIds.has(id));
    throw new Error(`Focused preset(s) not found: ${missing.join(', ')}`);
  }

  if (presetId) {
    console.log(`Auditing single preset: ${presetId}`);
  } else if (presetIds) {
    console.log(`Auditing focused preset suite (${presetIds.length} presets)`);
  } else if (pack !== null) {
    console.log(`Auditing Milkwave pack ${pack} (size ${packSize})`);
  } else {
    console.log(`Auditing first ${Math.min(limit, milkwavePresets.length)} presets`);
  }
  console.log(`Found ${milkwavePresets.length} Milkwave presets to audit.`);

  // 2. Bundle Audit Runner
  console.log('Bundling audit runner...');
  const bundle = await loadAuditBundle();
  const bundleCode = bundle.source;
  console.log(`Audit bundle mode: ${bundle.mode}`);

  // 3. Launch Puppeteer
  console.log('Launching browser...');
  const browserUrl = process.env.PUPPETEER_BROWSER_URL;
  const wsEndpoint = process.env.PUPPETEER_WS_ENDPOINT;
  const executablePath = resolveBrowserExecutablePath();
  if (browserUrl) {
    console.log(`Connecting to browser via URL: ${browserUrl}`);
  } else if (wsEndpoint) {
    console.log(`Connecting to browser via WS endpoint: ${wsEndpoint}`);
  } else if (executablePath) {
    console.log(`Using browser executable: ${executablePath}`);
  } else {
    console.log('Using Puppeteer default browser executable');
  }

  const browser = browserUrl || wsEndpoint
    ? await connectToExistingBrowser({ browserUrl, wsEndpoint })
    : await puppeteer.launch({
        headless: true,
        executablePath,
        args: CHROMIUM_AUDIT_ARGS
      });

  const page = await browser.newPage();
  await page.goto('about:blank', { waitUntil: 'domcontentloaded' });
  await page.setViewport({ width: 1280, height: 720 });
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`[Browser Error] ${msg.text()}`);
    } else {
      console.log(`[Browser] ${msg.text()}`);
    }
  });

  page.on('pageerror', (err: any) => {
    console.log(`[Browser PageError] ${err.toString()}`);
  });

  // Inject bundle
  await page.evaluate(bundleCode);

  // 4. Execute Audit
  console.log('Executing audit in browser context...');
  // We chunk the presets to avoid huge IPC payloads or memory pressure
  const chunkSize = 100;
  const allResults = [];

  for (let i = 0; i < milkwavePresets.length; i += chunkSize) {
    const chunk = milkwavePresets.slice(i, i + chunkSize);
    console.log(`Auditing chunk ${Math.floor(i / chunkSize) + 1}/${Math.ceil(milkwavePresets.length / chunkSize)}...`);
    
    const chunkResults = await page.evaluate(async (presets) => {
      // @ts-ignore
      return await window.runMilkwaveAudit(presets);
    }, chunk);
    
    allResults.push(...chunkResults);
  }

  await browser.close();

  // 5. Generate Report
  console.log('Generating reports...');
  
  const report = {
    timestamp: new Date().toISOString(),
    totalPresets: allResults.length,
    selection: {
      mode: presetId ? 'preset' : presetIds ? 'focus' : pack !== null ? 'pack' : 'limit',
      presetId,
      presetIds: presetIds ?? null,
      limit: presetIds || presetId || pack !== null ? null : limit,
      pack,
      packSize: pack !== null ? packSize : null,
      ids: milkwavePresets.map((preset) => preset.id)
    },
    results: allResults.map(r => {
      const preset = milkwavePresets.find(p => p.id === r.id);
      return {
        ...r,
        expectedSupport: preset?.expectedSupport
      };
    })
  };

  fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2));

  // Markdown Summary
  const nativeFailed = report.results.filter(r => r.expectedSupport === 'native-supported' && r.classification !== 'native-supported');
  const totalFailed = report.results.filter(r => r.classification === 'runtime-failed').length;
  const totalProven = report.results.filter(r => r.proof?.proven).length;
  const totalFallbackReached = report.results.filter(r => r.proof?.fallbackReached).length;

  let md = `# Milkwave Runtime Audit Report\n\n`;
  md += `**Date**: ${report.timestamp}\n`;
  md += `**Total Presets Audited**: ${report.totalPresets}\n`;
  if (report.selection.mode === 'pack') {
    md += `**Pack**: ${report.selection.pack}\n`;
    md += `**Pack Size**: ${report.selection.packSize}\n`;
  }
  md += `**Runtime Failed**: ${totalFailed}\n`;
  md += `**Native-Supported Regression**: ${nativeFailed.length}\n`;
  md += `**Proof Passed**: ${totalProven}\n`;
  md += `**Fallback Reached**: ${totalFallbackReached}\n\n`;

  md += `## Classification Summary\n\n`;
  const summary: Record<string, number> = {
    'native-supported': 0,
    'supported-with-degradation': 0,
    'fallback-only': 0,
    'runtime-failed': 0
  };
  report.results.forEach(r => summary[r.classification]++);
  
  md += `| Classification | Count |\n`;
  md += `| :--- | :--- |\n`;
  md += `| Native Supported | ${summary['native-supported']} |\n`;
  md += `| Supported with Degradation | ${summary['supported-with-degradation']} |\n`;
  md += `| Fallback Only | ${summary['fallback-only']} |\n`;
  md += `| Runtime Failed | ${summary['runtime-failed']} |\n\n`;

  md += `## Proof Summary\n\n`;
  md += `| Proof Gate | Count |\n`;
  md += `| :--- | :--- |\n`;
  md += `| Fully Proven | ${totalProven} |\n`;
  md += `| Fallback Reached | ${totalFallbackReached} |\n`;
  md += `| Visible Activity | ${report.results.filter(r => r.proof?.visibleActivity).length} |\n\n`;

  if (nativeFailed.length > 0) {
    md += `## Native Support Regressions ⚠️\n\n`;
    md += `These presets are marked \`native-supported\` but failed to compile or render natively.\n\n`;
    md += `| ID | Name | Classification | Errors |\n`;
    md += `| :--- | :--- | :--- | :--- |\n`;
    nativeFailed.forEach(r => {
      md += `| ${r.id} | ${r.name} | ${r.classification} | ${r.errors.join('; ')} |\n`;
    });
    md += `\n`;
  }

  const proofFailed = report.results.filter(r => !r.proof?.proven);
  if (proofFailed.length > 0) {
    md += `## Proof Failures\n\n`;
    md += `| ID | Name | Failed Steps |\n`;
    md += `| :--- | :--- | :--- |\n`;
    proofFailed.forEach(r => {
      const failedSteps = (r.proof?.steps ?? [])
        .filter((step: { passed: boolean }) => !step.passed)
        .map((step: { id: string }) => step.id)
        .join(', ');
      md += `| ${r.id} | ${r.name} | ${failedSteps || 'unknown'} |\n`;
    });
    md += `\n`;
  }

  md += `## Detailed Results\n\n`;
  md += `| ID | Name | Support | Proven | Warp | Comp | Fallback | Shapes | Waves |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;
  
  report.results.forEach(r => {
    md += `| ${r.id} | ${r.name} | ${r.classification} | ${r.proof?.proven ? '✅' : '❌'} | ${r.warpCompiled ? '✅' : '❌'} | ${r.compCompiled ? '✅' : '❌'} | ${r.fallbackUsed ? '⚠️' : '✅'} | ${r.shapesRendered} | ${r.wavesRendered} |\n`;
  });

  fs.writeFileSync(REPORT_MD, md);

  console.log(`Audit complete. Results written to ${REPORT_JSON} and ${REPORT_MD}`);

  // 6. CI Failure Check
  if (nativeFailed.length > 0) {
    console.error(`ERROR: ${nativeFailed.length} presets marked as native-supported failed runtime audit.`);
    process.exit(1);
  }

  if (totalFailed > (milkwavePresets.length * 0.1)) { // Allow 10% failure for now as baseline? No, task says "fail CI if presets marked native-supported actually fail"
    // Task specifically said native-supported failure should fail CI.
  }
}

runAudit().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
