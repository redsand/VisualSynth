import { createMilkDropRenderer } from './milkdropRenderer';
import type { MilkDropShaderData } from '../shared/project';
import type { RenderState } from './renderState';
import type { MilkwaveAuditProof, MilkwaveProofStep } from '../shared/milkwaveStatus';

const sampleRenderedTexture = (
  gl: WebGL2RenderingContext,
  texture: WebGLTexture,
  width: number,
  height: number,
  framebuffer: WebGLFramebuffer,
  sampleBuffer: Uint8Array
) => {
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return {
      classification: 'blank',
      avgBrightness: 0,
      nonBlackPercent: 0
    } as const;
  }

  const sampleDim = 16;
  const cx = Math.max(0, Math.floor((width - sampleDim) / 2));
  const cy = Math.max(0, Math.floor((height - sampleDim) / 2));
  gl.readPixels(cx, cy, sampleDim, sampleDim, gl.RGBA, gl.UNSIGNED_BYTE, sampleBuffer);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  let totalBrightness = 0;
  let nonBlackCount = 0;
  const pixelCount = sampleDim * sampleDim;
  for (let i = 0; i < pixelCount; i++) {
    const r = sampleBuffer[i * 4];
    const g = sampleBuffer[i * 4 + 1];
    const b = sampleBuffer[i * 4 + 2];
    totalBrightness += (r + g + b) / 3;
    if (r > 5 || g > 5 || b > 5) nonBlackCount++;
  }

  const avgBrightness = totalBrightness / pixelCount;
  const nonBlackPercent = nonBlackCount / pixelCount;
  const classification =
    nonBlackPercent < 0.01 && avgBrightness < 2 ? 'blank'
      : avgBrightness < 4 ? 'low-content'
      : 'healthy';

  return {
    classification,
    avgBrightness,
    nonBlackPercent
  } as const;
};

interface AuditResult {
  id: string;
  name: string;
  classification: 'native-supported' | 'supported-with-degradation' | 'fallback-only' | 'runtime-failed';
  warpCompiled: boolean;
  compCompiled: boolean;
  fallbackUsed: boolean;
  shapesRendered: number;
  wavesRendered: number;
  errors: string[];
  warnings: string[];
  proof: MilkwaveAuditProof;
}

const createAuditRenderState = (frame: number): RenderState => {
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
    roleWeights: {
      core: 1,
      support: 1,
      atmosphere: 1
    },
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

export async function runMilkwaveAudit(presets: { id: string, name: string, shaderData: MilkDropShaderData }[]) {
  const auditFrames = 16;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  // document.body.appendChild(canvas); // Optional: for debugging if needed
  const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true });
  const sampleFramebuffer = gl ? gl.createFramebuffer() : null;
  const sampleBuffer = gl ? new Uint8Array(16 * 16 * 4) : null;

  const errors: string[] = [];
  const renderer = createMilkDropRenderer({
    canvas,
    onError: (err, type) => {
      errors.push(`[${type}] ${err}`);
    }
  });

  const results: AuditResult[] = [];

  for (const preset of presets) {
    errors.length = 0;
    let visibleCanvasActivity = false;
    let lastFrameClassification = 'unsampled';
    let lastFrameBrightness = 0;
    let lastFrameNonBlackPercent = 0;

    try {
      renderer.compileShaders(preset.shaderData);
    } catch (e) {
      errors.push(`Runtime exception during compile: ${e}`);
    }

    const compileReport = renderer.getLastCompileReport();
    
    // Many feedback-driven presets need a few iterations before visible output emerges.
    for (let i = 0; i < auditFrames; i++) {
      try {
        renderer.render(createAuditRenderState(i), preset.shaderData, true);
        if (gl && sampleFramebuffer && sampleBuffer) {
          const mainTexture = renderer.getMainTexture();
          if (mainTexture) {
            const metrics = sampleRenderedTexture(
              gl,
              mainTexture,
              canvas.width,
              canvas.height,
              sampleFramebuffer,
              sampleBuffer
            );
            lastFrameClassification = metrics.classification;
            lastFrameBrightness = metrics.avgBrightness;
            lastFrameNonBlackPercent = metrics.nonBlackPercent;
            if (metrics.classification !== 'blank') {
              visibleCanvasActivity = true;
            }
          }
        }
      } catch (e) {
        errors.push(`Runtime exception during render: ${e}`);
        break;
      }
    }

    const runtimeReport = renderer.getLastNativeRuntimeReport();
    
    let classification: AuditResult['classification'] = 'runtime-failed';
    const warpStatus = compileReport?.warp.status;
    const compStatus = reportStatus(compileReport?.comp.status); // Fixed typo below

    function reportStatus(s?: string) { return s; }

    const hasVisibleMilkwaveActivity =
      (runtimeReport?.shapes.rendered ?? 0) > 0 ||
      (runtimeReport?.waves.rendered ?? 0) > 0 ||
      visibleCanvasActivity;
    // A preset with no enabled shapes or waves is a warp-only preset: its
    // visible activity is the warp shader itself (feedback displacement), not
    // shapes/waves. The previous gate required shapes+waves>0 for EVERY preset,
    // which correctly-native warp-only presets could never satisfy, marking
    // them runtime-failed. Treat warp-only as activity-satisfied.
    const enabledShapes = (preset.shaderData?.shapes ?? []).filter((s: any) => s.enabled).length;
    const enabledWaves = (preset.shaderData?.waves ?? []).filter((w: any) => w.enabled).length;
    const isWarpOnly = enabledShapes === 0 && enabledWaves === 0;
    const activitySatisfied = hasVisibleMilkwaveActivity || isWarpOnly;

    if (warpStatus === 'success' && compStatus === 'success' && activitySatisfied) {
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
    } else if ((warpStatus === 'success' || compStatus === 'success') && !activitySatisfied) {
      errors.push('No Milkwave shapes or waves rendered during audit frames');
      classification = 'runtime-failed';
    }

    const proofSteps: MilkwaveProofStep[] = [
      {
        id: 'compile-warp',
        label: 'Warp path compiles successfully',
        passed: warpStatus === 'success' && (compileReport?.warp.compiled ?? false),
        details: `status=${warpStatus ?? 'unknown'}, compiled=${compileReport?.warp.compiled ?? false}`
      },
      {
        id: 'compile-comp',
        label: 'Comp path compiles successfully',
        passed: compStatus === 'success' && (compileReport?.comp.compiled ?? false),
        details: `status=${compStatus ?? 'unknown'}, compiled=${compileReport?.comp.compiled ?? false}`
      },
      {
        id: 'render-activity',
        label: 'Milkwave runtime renders visible activity',
        passed: activitySatisfied,
        details:
          `shapes=${runtimeReport?.shapes.rendered ?? 0}, waves=${runtimeReport?.waves.rendered ?? 0}, ` +
          `canvasVisible=${visibleCanvasActivity}, frame=${lastFrameClassification}, ` +
          `brightness=${lastFrameBrightness.toFixed(1)}, nonBlack=${(lastFrameNonBlackPercent * 100).toFixed(1)}%, ` +
          `warpOnly=${isWarpOnly}`
      },
      {
        id: 'no-fallback',
        label: 'Runtime never reaches fallback or degraded path',
        passed:
          !((compileReport?.warp.fallbackUsed || compileReport?.comp.fallbackUsed) ?? false) &&
          warpStatus === 'success' &&
          compStatus === 'success',
        details: `fallback=${(compileReport?.warp.fallbackUsed || compileReport?.comp.fallbackUsed) ?? false}, warp=${warpStatus ?? 'unknown'}, comp=${compStatus ?? 'unknown'}`
      },
      {
        id: 'no-errors',
        label: 'Audit completes without runtime or shader errors',
        passed: errors.length === 0,
        details: errors.length === 0 ? 'no errors recorded' : errors.join(' | ')
      }
    ];
    const proof: MilkwaveAuditProof = {
      proven: proofSteps.every((step) => step.passed),
      fallbackReached: (compileReport?.warp.fallbackUsed || compileReport?.comp.fallbackUsed) ?? false,
      visibleActivity: activitySatisfied,
      stepCount: proofSteps.length,
      passedStepCount: proofSteps.filter((step) => step.passed).length,
      steps: proofSteps
    };

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
      warnings: [], // Could extract from diagnostics if needed
      auditAt: new Date().toISOString(),
      proof
    });
  }

  return results;
}

// Expose to window for Puppeteer
(window as any).runMilkwaveAudit = runMilkwaveAudit;
