import { toFileUrl } from '../shared/fileUrl';
import type { AssetItem, MilkDropShaderData } from '../shared/project';
import type { AssetTextureSampling } from '../shared/assets';
import { buildSdfShader } from './sdf/compile/glslBuilder';
import { buildFragmentShader, shaderCacheKey, mergeShaderBlocks } from './render/shaderBuilder';
import type { CustomShaderBlock } from '../shared/customShaderBlock';
import { GENERATOR_SHADER_BLOCKS } from '../shared/generatorShaderBlocks';
import SHADER_PREAMBLE from './shaders/preamble.glsl';
import SHADER_MAIN_TEMPLATE from './shaders/mainTemplate.glsl';
import type { RenderState } from './renderState';
import { collectActiveUniformLookup, hasUniform } from './uniformIntrospection';
import { createMilkDropRenderer, type MilkDropRenderer } from './milkdropRenderer';
export type {
  RenderTelemetryState,
  RenderLayerEnabledState,
  RenderColorPipelineState,
  RenderTransitionState,
  RenderPostFxState,
  RenderSdfState,
  RenderState,
} from './renderState';

export const resizeCanvasToDisplaySize = (canvas: HTMLCanvasElement) => {
  const dpr = window.devicePixelRatio || 1;
  const width = Math.floor(canvas.clientWidth * dpr);
  const height = Math.floor(canvas.clientHeight * dpr);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    return true;
  }
  return false;
};

export interface RendererOptions {
  onError?: (error: string, type: 'vertex' | 'fragment' | 'link') => void;
}

export const createGLRenderer = (canvas: HTMLCanvasElement, options: RendererOptions = {}) => {
  const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true });
  if (!gl) {
    throw new Error('WebGL2 required');
  }

  let lastShaderError: string | null = null;
  let customPlasmaSource: string | null = null;
  let contextLost = false;

  // Handle WebGL context loss / restore
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    contextLost = true;
    console.warn('[GLRenderer] WebGL context lost');
  });
  canvas.addEventListener('webglcontextrestored', () => {
    console.log('[GLRenderer] WebGL context restored — rebuilding');
    contextLost = false;
    // All GL resources are invalid after context loss — clear every cache
    programCache.clear();
    activeUniformLookupCache.clear();
    uniformLocationCache.clear();
    missingUniforms.clear();
    uniformWarningsLogged = false;
    advancedSdfProgram = null;
    advancedSdfUniformLocations.clear();
    milkDropCompositeProgram = null;
    milkDropEnabled = false;
    milkDropRenderer = null;
    lastMilkDropWarp = '';
    lastMilkDropComp = '';
    previousFrameWidth = 0;
    previousFrameHeight = 0;
    // Re-init textures and recompile the active shader
    initInternalTextures();
    standardProgram = getOrCompileProgram(
      currentActiveIds,
      currentSdfUniforms,
      currentSdfFunctions,
      currentSdfMapBody,
      currentPlasmaSource,
      currentCustomBlocks
    );
    currentProgram = standardProgram;
  });

  // --- Generator Diagnostics ---
  const missingUniforms = new Set<string>();
  let uniformWarningsLogged = false;
  const generatorDiagnostics: Map<string, { enabled: boolean; opacity: number; uniformsBound: boolean }> = new Map();

  const vertexShaderSrc = `#version 300 es
in vec2 position;
out vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

  let currentPalette: [number, number, number][] = [
    [0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0]
  ];
  let advancedSdfProgram: WebGLProgram | null = null;
  let advancedSdfUniforms: any[] = [];
  let advancedSdfUniformLocations: Map<string, WebGLUniformLocation | null> = new Map();
  let milkDropRenderer: MilkDropRenderer | null = null;
  let currentMilkDropShaderData: MilkDropShaderData | null = null;
  let milkDropEnabled = false;
  let milkDropTexture: WebGLTexture | null = null;
  
  const waveformTexture = gl.createTexture();
  const spectrumTexture = gl.createTexture();
  const modulatorTexture = gl.createTexture();
  const midiTexture = gl.createTexture();
  const previousFrameTexture = gl.createTexture();
  let previousFrameWidth = 0;
  let previousFrameHeight = 0;

  const initInternalTextures = () => {
    [waveformTexture, spectrumTexture, modulatorTexture, midiTexture, previousFrameTexture].forEach(tex => {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    });
  };
  initInternalTextures();

  const ensurePreviousFrameTextureSize = () => {
    if (canvas.width === previousFrameWidth && canvas.height === previousFrameHeight) {
      return;
    }
    gl.bindTexture(gl.TEXTURE_2D, previousFrameTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, Math.max(1, canvas.width), Math.max(1, canvas.height), 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    previousFrameWidth = canvas.width;
    previousFrameHeight = canvas.height;
  };

  const clearHistory = () => {
    ensurePreviousFrameTextureSize();
    gl.bindTexture(gl.TEXTURE_2D, previousFrameTexture);
    const emptyFrame = new Uint8Array(Math.max(1, canvas.width) * Math.max(1, canvas.height) * 4);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0,
      0,
      Math.max(1, canvas.width),
      Math.max(1, canvas.height),
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      emptyFrame
    );
  };

  const compileShader = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader) || 'Unknown error';
      lastShaderError = log;
      console.error('Shader compile error:', log);
      
      if (options.onError) {
        options.onError(log, type === gl.VERTEX_SHADER ? 'vertex' : 'fragment');
      }

      const hasCustom = source.includes('customPlasma');
      if (hasCustom || source.length < 4000) {
        const numbered = source
          .split('\n')
          .map((line, i) => `${String(i + 1).padStart(4, '0')}: ${line}`)
          .join('\n');
        console.error('Shader source (numbered):\n', numbered);
      } else {
        console.error('Shader source omitted (too large).');
      }
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };

  const createProgram = (vSource: string, fSource: string) => {
    const vs = compileShader(gl.VERTEX_SHADER, vSource);
    const fs = compileShader(gl.FRAGMENT_SHADER, fSource);
    if (!vs || !fs) return null;
    const prog = gl.createProgram();
    if (!prog) return null;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(prog) || 'Unknown link error';
      lastShaderError = log;
      console.error('Program link error:', log);
      
      if (options.onError) {
        options.onError(log, 'link');
      }

      gl.deleteProgram(prog);
      return null;
    }
    return prog;
  };

  // Shader program cache to avoid recompiling the same shader variants
  const programCache = new Map<string, WebGLProgram>();
  const activeUniformLookupCache = new Map<WebGLProgram, Set<string>>();
  const uniformLocationCache = new Map<WebGLProgram, Map<string, WebGLUniformLocation | null>>();

  // Cache current SDF parameters for recompilation
  let currentSdfUniforms = '';
  let currentSdfFunctions = '';
  let currentSdfMapBody = '10.0';
  let currentPlasmaSource: string | null = null;
  let currentActiveIds = new Set<string>();
  let currentCustomBlocks: CustomShaderBlock[] = [];

  const getOrCompileProgram = (
    activeIds: Set<string>,
    sdfUniforms = '',
    sdfFunctions = '',
    sdfMapBody = '10.0',
    plasmaSource: string | null = null,
    customBlocks: CustomShaderBlock[] = []
  ): WebGLProgram | null => {
    const customHash = customBlocks.map(b => b.id + ':' + b.uniforms + (b.functions ?? '') + b.mainCall).join('|');
    const key = shaderCacheKey(activeIds, sdfMapBody, plasmaSource ?? '', customHash);

    // Check cache first
    if (programCache.has(key)) {
      return programCache.get(key)!;
    }

    // Compile new shader
    const effectiveBlocks = mergeShaderBlocks(GENERATOR_SHADER_BLOCKS, customBlocks);
    const fSrc = buildFragmentShader(
      { preamble: SHADER_PREAMBLE, mainTemplate: SHADER_MAIN_TEMPLATE },
      effectiveBlocks,
      activeIds,
      sdfUniforms, sdfFunctions, sdfMapBody, plasmaSource
    );

    const prog = createProgram(vertexShaderSrc, fSrc);
    if (prog) {
      programCache.set(key, prog);
    }
    return prog ?? null;
  };

  const EMPTY_GENERATOR_SET = new Set<string>();

  // Start from a minimal shader and switch to scene/project-specific variants once loaded.
  let standardProgram = getOrCompileProgram(
    EMPTY_GENERATOR_SET,
    '', '', '10.0', null
  );
  if (!standardProgram) {
    throw new Error('Failed to compile standard shader program.');
  }
  let currentProgram: WebGLProgram | null = standardProgram;
  let lastSdfSceneJson = '';

  const updateAdvancedSdfProgram = (scene: any) => {
    const sceneJson = JSON.stringify(scene || {});
    if (sceneJson === lastSdfSceneJson) return;
    lastSdfSceneJson = sceneJson;
    if (!scene || !scene.nodes || scene.nodes.length === 0) {
      advancedSdfProgram = null; return;
    }
    try {
      const compiled = buildSdfShader(scene.nodes, scene.connections || [], scene.mode || '2d');
      const uniformsCode = compiled.uniforms.map(u => `uniform ${u.type} ${u.name};`).join('\n');

      // Update current SDF parameters
      currentSdfUniforms = uniformsCode;
      currentSdfFunctions = compiled.functionsCode;
      currentSdfMapBody = compiled.mapBody;

      const newProg = getOrCompileProgram(
        currentActiveIds,
        uniformsCode,
        compiled.functionsCode,
        compiled.mapBody,
        customPlasmaSource,
        currentCustomBlocks
      );
      if (newProg) {
        advancedSdfProgram = newProg;
        advancedSdfUniforms = compiled.uniforms;
        advancedSdfUniformLocations.clear();
        advancedSdfUniforms.forEach(u => advancedSdfUniformLocations.set(u.name, gl.getUniformLocation(newProg, u.name)));
      }
    } catch (err) {
      console.error('Failed to build advanced SDF shader:', err);
      advancedSdfProgram = null;
    }
  };

  let lastMilkDropWarp = '';
  let lastMilkDropComp = '';
  let milkDropCompositeProgram: WebGLProgram | null = null;

  const updateMilkDropShaders = (shaderData: MilkDropShaderData | null) => {
    if (!shaderData) {
      if (milkDropEnabled) {
        console.log('[GLRenderer] No MilkDrop shader data, disabling MilkDrop');
      }
      currentMilkDropShaderData = null;
      milkDropEnabled = false;
      lastMilkDropWarp = '';
      lastMilkDropComp = '';
      return;
    }

    // Skip recompilation if shader source hasn't changed
    if (shaderData.warp === lastMilkDropWarp && shaderData.comp === lastMilkDropComp) {
      return;
    }

    currentMilkDropShaderData = shaderData;
    milkDropEnabled = true;
    lastMilkDropWarp = shaderData.warp;
    lastMilkDropComp = shaderData.comp;

    if (!milkDropRenderer) {
      milkDropRenderer = createMilkDropRenderer({ canvas, onError: options.onError });
    }

    const success = milkDropRenderer.compileShaders(shaderData);
    if (!success) {
      console.warn('[GLRenderer] MilkDrop shaders failed to compile, using fallback gen-milkwave');
      currentMilkDropShaderData = null;
      milkDropEnabled = false;
    } else {
      console.log('[GLRenderer] MilkDrop shaders compiled successfully');
    }
  };

  const positionBuffer = gl.createBuffer();
  if (!positionBuffer) throw new Error('Buffer creation failed');
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

  const getActiveUniformLookup = (prog: WebGLProgram) => {
    let lookup = activeUniformLookupCache.get(prog);
    if (!lookup) {
      lookup = collectActiveUniformLookup(gl, prog);
      activeUniformLookupCache.set(prog, lookup);
    }
    return lookup;
  };

  const updateStandardUniforms = (prog: WebGLProgram, state: RenderState) => {
    gl.useProgram(prog);
    const activeUniformLookup = getActiveUniformLookup(prog);
    let programUniformLocations = uniformLocationCache.get(prog);
    if (!programUniformLocations) {
      programUniformLocations = new Map<string, WebGLUniformLocation | null>();
      uniformLocationCache.set(prog, programUniformLocations);
    }
    const getLocation = (name: string) => {
      if (!hasUniform(activeUniformLookup, name)) {
        return null;
      }
      if (programUniformLocations!.has(name)) {
        return programUniformLocations!.get(name)!;
      }
      const loc = gl.getUniformLocation(prog, name);
      programUniformLocations!.set(name, loc);
      if (loc === null && !missingUniforms.has(name)) {
        missingUniforms.add(name);
        console.warn(`[VisualSynth] Uniform not found in shader: "${name}"`);
      }
      return loc;
    };
    gl.uniform1f(getLocation('uTime'), state.timeMs / 1000);
    gl.uniform1f(getLocation('uRms'), state.rms);
    gl.uniform1f(getLocation('uPeak'), state.peak);
    gl.uniform1f(getLocation('uStrobe'), state.strobe);
    gl.uniform1f(getLocation('uAspect'), canvas.width / canvas.height);
    gl.uniform2f(getLocation('uResolution'), canvas.width, canvas.height);
    gl.uniform1f(getLocation('uPlasmaEnabled'), state.plasmaEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uPlasmaOpacity'), state.plasmaOpacity);
    gl.uniform1f(getLocation('uPlasmaSpeed'), state.plasmaSpeed || 1.0);
    gl.uniform1f(getLocation('uPlasmaScale'), state.plasmaScale || 1.0);
    gl.uniform1f(getLocation('uPlasmaComplexity'), state.plasmaComplexity || 3.0);
    gl.uniform1f(getLocation('uPlasmaAudioReact'), state.plasmaAudioReact || 0.5);
    gl.uniform1f(getLocation('uSpectrumEnabled'), state.spectrumEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uSpectrumOpacity'), state.spectrumOpacity);
    gl.uniform1fv(getLocation('uSpectrum[0]'), state.spectrum);
    gl.uniform1f(getLocation('uOrigamiEnabled'), state.origamiEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uOrigamiOpacity'), state.origamiOpacity);
    gl.uniform1f(getLocation('uOrigamiFoldState'), state.origamiFoldState);
    gl.uniform1f(getLocation('uOrigamiFoldSharpness'), state.origamiFoldSharpness);
    gl.uniform1f(getLocation('uOrigamiSpeed'), state.origamiSpeed || 1.0);
    gl.uniform1f(getLocation('uGlyphEnabled'), state.glyphEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uGlyphOpacity'), state.glyphOpacity);
    gl.uniform1f(getLocation('uGlyphMode'), state.glyphMode);
    gl.uniform1f(getLocation('uGlyphSeed'), state.glyphSeed);
    gl.uniform1f(getLocation('uGlyphBeat'), state.glyphBeat);
    gl.uniform1f(getLocation('uGlyphSpeed'), state.glyphSpeed || 1.0);
    gl.uniform1f(getLocation('uCrystalEnabled'), state.crystalEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uCrystalOpacity'), state.crystalOpacity);
    gl.uniform1f(getLocation('uCrystalMode'), state.crystalMode);
    gl.uniform1f(getLocation('uCrystalBrittleness'), state.crystalBrittleness);
    gl.uniform1f(getLocation('uCrystalScale'), state.crystalScale || 1.0);
    gl.uniform1f(getLocation('uCrystalSpeed'), state.crystalSpeed || 1.0);
    gl.uniform1f(getLocation('uInkEnabled'), state.inkEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uInkOpacity'), state.inkOpacity);
    gl.uniform1f(getLocation('uInkBrush'), state.inkBrush);
    gl.uniform1f(getLocation('uInkPressure'), state.inkPressure);
    gl.uniform1f(getLocation('uInkLifespan'), state.inkLifespan);
    gl.uniform1f(getLocation('uInkSpeed'), state.inkSpeed || 1.0);
    gl.uniform1f(getLocation('uInkScale'), state.inkScale || 1.0);
    gl.uniform1f(getLocation('uTopoEnabled'), state.topoEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uTopoOpacity'), state.topoOpacity);
    gl.uniform1f(getLocation('uTopoQuake'), state.topoQuake);
    gl.uniform1f(getLocation('uTopoSlide'), state.topoSlide);
    gl.uniform1f(getLocation('uTopoPlate'), state.topoPlate);
    gl.uniform1f(getLocation('uTopoTravel'), state.topoTravel);
    gl.uniform1f(getLocation('uTopoScale'), state.topoScale || 1.0);
    gl.uniform1f(getLocation('uTopoElevation'), state.topoElevation || 1.0);
    gl.uniform1f(getLocation('uWeatherEnabled'), state.weatherEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uWeatherOpacity'), state.weatherOpacity);
    gl.uniform1f(getLocation('uWeatherMode'), state.weatherMode);
    gl.uniform1f(getLocation('uWeatherIntensity'), state.weatherIntensity);
    gl.uniform1f(getLocation('uWeatherSpeed'), state.weatherSpeed || 1.0);
    gl.uniform1f(getLocation('uPortalEnabled'), state.portalEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uPortalOpacity'), state.portalOpacity);
    gl.uniform1f(getLocation('uPortalShift'), state.portalShift);
    gl.uniform1f(getLocation('uPortalStyle'), state.portalStyle);
    gl.uniform2fv(getLocation('uPortalPos[0]'), state.portalPositions);
    gl.uniform1fv(getLocation('uPortalRadius[0]'), state.portalRadii);
    gl.uniform1fv(getLocation('uPortalActive[0]'), state.portalActives);
    gl.uniform1f(getLocation('uMediaEnabled'), state.mediaEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uMediaOpacity'), state.mediaOpacity);
    gl.uniform1f(getLocation('uMediaAssetBlend'), state.mediaAssetBlendMode);
    gl.uniform1f(getLocation('uMediaAssetAudioReact'), state.mediaAssetAudioReact);
    gl.uniform2fv(getLocation('uMediaBurstPos[0]'), state.mediaBurstPositions);
    gl.uniform1fv(getLocation('uMediaBurstRadius[0]'), state.mediaBurstRadii);
    gl.uniform1fv(getLocation('uMediaBurstType[0]'), state.mediaBurstTypes);
    gl.uniform1fv(getLocation('uMediaBurstActive[0]'), state.mediaBurstActives);
    gl.uniform1f(getLocation('uOscilloEnabled'), state.oscilloEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uOscilloOpacity'), state.oscilloOpacity);
    gl.uniform1f(getLocation('uOscilloMode'), state.oscilloMode);
    gl.uniform1f(getLocation('uOscilloFreeze'), state.oscilloFreeze);
    gl.uniform1f(getLocation('uOscilloRotate'), state.oscilloRotate);
    gl.uniform1fv(getLocation('uOscillo[0]'), state.oscilloData);
    gl.uniform2fv(getLocation('uGravityPos[0]'), state.gravityPositions);
    gl.uniform1fv(getLocation('uGravityStrength[0]'), state.gravityStrengths);
    gl.uniform1fv(getLocation('uGravityPolarity[0]'), state.gravityPolarities);
    gl.uniform1fv(getLocation('uGravityActive[0]'), state.gravityActives);
    gl.uniform1f(getLocation('uGravityCollapse'), state.gravityCollapse);
    gl.uniform1f(getLocation('uContrast'), state.contrast);
    gl.uniform1f(getLocation('uSaturation'), state.saturation);
    gl.uniform1f(getLocation('uPaletteShift'), state.paletteShift);
    gl.uniform1f(getLocation('uEffectsEnabled'), state.effectsEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uBloom'), state.bloom);
    gl.uniform1f(getLocation('uBlur'), state.blur);
    gl.uniform1f(getLocation('uChroma'), state.chroma);
    gl.uniform1f(getLocation('uPosterize'), state.posterize);
    gl.uniform1f(getLocation('uKaleidoscope'), state.kaleidoscope);
    gl.uniform1f(getLocation('uKaleidoscopeRotation'), state.kaleidoscopeRotation || 0.0);
    gl.uniform1f(getLocation('uFeedback'), state.feedback);
    gl.uniform1f(getLocation('uFeedbackZoom'), state.feedbackZoom || 0.0);
    gl.uniform1f(getLocation('uFeedbackRotation'), state.feedbackRotation || 0.0);
    gl.uniform1f(getLocation('uPersistence'), state.persistence);
    gl.uniform1fv(getLocation('uTrailSpectrum[0]'), state.trailSpectrum);
    gl.uniform1f(getLocation('uExpressiveEnergyBloom'), state.expressiveEnergyBloom);
    gl.uniform1f(getLocation('uExpressiveEnergyThreshold'), state.expressiveEnergyThreshold);
    gl.uniform1f(getLocation('uExpressiveEnergyAccumulation'), state.expressiveEnergyAccumulation);
    gl.uniform1f(getLocation('uExpressiveRadialGravity'), state.expressiveRadialGravity);
    gl.uniform1f(getLocation('uExpressiveRadialStrength'), state.expressiveRadialStrength);
    gl.uniform1f(getLocation('uExpressiveRadialRadius'), state.expressiveRadialRadius);
    gl.uniform1f(getLocation('uExpressiveRadialFocusX'), state.expressiveRadialFocusX);
    gl.uniform1f(getLocation('uExpressiveRadialFocusY'), state.expressiveRadialFocusY);
    gl.uniform1f(getLocation('uExpressiveMotionEcho'), state.expressiveMotionEcho);
    gl.uniform1f(getLocation('uExpressiveMotionEchoDecay'), state.expressiveMotionEchoDecay);
    gl.uniform1f(getLocation('uExpressiveMotionEchoWarp'), state.expressiveMotionEchoWarp);
    gl.uniform1f(getLocation('uExpressiveSpectralSmear'), state.expressiveSpectralSmear);
    gl.uniform1f(getLocation('uExpressiveSpectralOffset'), state.expressiveSpectralOffset);
    gl.uniform1f(getLocation('uExpressiveSpectralMix'), state.expressiveSpectralMix);
    gl.uniform1f(getLocation('uParticlesEnabled'), state.particlesEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uParticleDensity'), state.particleDensity);
    gl.uniform1f(getLocation('uParticleSpeed'), state.particleSpeed);
    gl.uniform1f(getLocation('uParticleSize'), state.particleSize);
    gl.uniform1f(getLocation('uParticleGlow'), state.particleGlow);
    gl.uniform1f(getLocation('uParticleTurbulence'), state.particleTurbulence || 0.3);
    gl.uniform1f(getLocation('uParticleAudioLift'), state.particleAudioLift || 0.5);
    gl.uniform1f(getLocation('uSdfEnabled'), state.sdfEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uSdfShape'), state.sdfShape);
    gl.uniform1f(getLocation('uSdfScale'), state.sdfScale);
    gl.uniform1f(getLocation('uSdfEdge'), state.sdfEdge);
    gl.uniform1f(getLocation('uSdfGlow'), state.sdfGlow);
    gl.uniform1f(getLocation('uSdfRotation'), state.sdfRotation);
    gl.uniform1f(getLocation('uSdfFill'), state.sdfFill);
    gl.uniform3fv(getLocation('uSdfColor'), state.sdfColor || [1.0, 0.6, 0.25]);
    gl.uniform1f(getLocation('uInternalSource'), state.hasInternalAsset ? 1 : 0);
    gl.uniform3fv(getLocation('uGlobalColor'), state.globalColor || [1.0, 1.0, 1.0]);
    gl.uniform1f(getLocation('uDebugTint'), state.debugTint ?? 0);
    gl.uniform3f(getLocation('uRoleWeights'), state.roleWeights.core, state.roleWeights.support, state.roleWeights.atmosphere);
    gl.uniform1f(getLocation('uTransitionAmount'), state.transitionAmount);
    gl.uniform1f(getLocation('uTransitionType'), state.transitionType);
    gl.uniform1f(getLocation('uChemistryMode'), state.chemistryMode);
    gl.uniform1f(getLocation('uMotionTemplate'), state.motionTemplate);
    gl.uniform1f(getLocation('uEngineMass'), state.engineMass);
    gl.uniform1f(getLocation('uEngineFriction'), state.engineFriction);
    gl.uniform1f(getLocation('uEngineElasticity'), state.engineElasticity);
    gl.uniform1f(getLocation('uMaxBloom'), state.maxBloom);
    gl.uniform1f(getLocation('uForceFeedback'), state.forceFeedback ? 1.0 : 0.0);
    gl.uniform1f(getLocation('uEngineGrain'), state.engineGrain);
    gl.uniform1f(getLocation('uEngineVignette'), state.engineVignette);
    gl.uniform1f(getLocation('uEngineCA'), state.engineCA);
    gl.uniform1f(getLocation('uEngineSignature'), state.engineSignature);
    // Gen-* uniforms: all handled dynamically via state.genUniforms below.
    // Only special-case array uniforms remain explicit:
    gl.uniform1fv(getLocation('uBurstSpawnTimes[0]'), state.shapeBurstSpawnTimes ?? new Float32Array(8));
    gl.uniform1fv(getLocation('uBurstActives[0]'), state.shapeBurstActives ?? new Float32Array(8));
    gl.uniform1f(getLocation('uAdvancedSdfEnabled'), (state.sdfScene && prog === advancedSdfProgram) ? 1 : 0);
    if (currentPalette.length >= 5) {
      // Set each palette element individually for maximum driver compatibility
      for (let pi = 0; pi < 5; pi++) {
        const loc = gl.getUniformLocation(prog, `uPalette[${pi}]`);
        if (loc !== null) {
          gl.uniform3fv(loc, currentPalette[pi]);
        } else if (pi === 0 && !missingUniforms.has('uPalette[0]')) {
          missingUniforms.add('uPalette[0]');
          console.warn('[GLRenderer] uPalette[0] not in active uniforms — palette() will return black.');
        }
      }
    }
    const pLoc = gl.getAttribLocation(prog, 'position');
    gl.enableVertexAttribArray(pLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(pLoc, 2, gl.FLOAT, false, 0, 0);

    // --- Dynamic gen-* uniforms from resolveGenUniforms() ---
    if (state.genUniforms) {
      for (const key in state.genUniforms) {
        const loc = getLocation(`u${key}`);
        if (loc) {
          gl.uniform1f(loc, state.genUniforms[key]);
        }
      }
    }

    // --- Generator Diagnostics: track enable/opacity state ---
    // Legacy layers use explicit state properties
    const legacyEntries: [string, boolean, number][] = [
      ['plasma', state.plasmaEnabled, state.plasmaOpacity],
      ['spectrum', state.spectrumEnabled, state.spectrumOpacity],
      ['origami', state.origamiEnabled, state.origamiOpacity],
      ['glyph', state.glyphEnabled, state.glyphOpacity],
      ['crystal', state.crystalEnabled, state.crystalOpacity],
      ['ink', state.inkEnabled, state.inkOpacity],
      ['topo', state.topoEnabled, state.topoOpacity],
      ['weather', state.weatherEnabled, state.weatherOpacity],
      ['portal', state.portalEnabled, state.portalOpacity],
      ['media', state.mediaEnabled, state.mediaOpacity],
      ['oscillo', state.oscilloEnabled, state.oscilloOpacity],
    ];
    generatorDiagnostics.clear();
    for (const [name, enabled, opacity] of legacyEntries) {
      const enabledUniformName = `u${name.charAt(0).toUpperCase() + name.slice(1)}Enabled`;
      generatorDiagnostics.set(name, {
        enabled,
        opacity,
        uniformsBound: hasUniform(activeUniformLookup, enabledUniformName) && !missingUniforms.has(enabledUniformName)
      });
    }
    // Gen-* layers: derive diagnostics from genUniforms dictionary
    if (state.genUniforms) {
      const seen = new Set<string>();
      for (const key in state.genUniforms) {
        if (!key.endsWith('Enabled')) continue;
        const prefix = key.slice(0, -'Enabled'.length);
        if (seen.has(prefix)) continue;
        seen.add(prefix);
        const enabled = state.genUniforms[key] > 0;
        const opacity = state.genUniforms[`${prefix}Opacity`] ?? 0;
        const uniformName = `u${prefix}Enabled`;
        generatorDiagnostics.set(prefix, {
          enabled,
          opacity,
          uniformsBound: hasUniform(activeUniformLookup, uniformName) && !missingUniforms.has(uniformName)
        });
      }
    }

    // Log uniform binding summary once
    if (!uniformWarningsLogged && missingUniforms.size > 0) {
      uniformWarningsLogged = true;
      console.warn(`[VisualSynth] ${missingUniforms.size} uniforms not found in shader:`, Array.from(missingUniforms));
    }
  };

  type AssetLayerId = 'layer-plasma' | 'layer-spectrum' | 'layer-media';
  const ASSET_LAYER_UNITS: Record<AssetLayerId, number> = {
    'layer-plasma': 1,
    'layer-spectrum': 2,
    'layer-media': 3
  };

  interface AssetCacheEntry {
    assetId: string;
    texture: WebGLTexture;
    internalSourceId?: string;
    video?: HTMLVideoElement;
    width?: number;
    height?: number;
    options?: AssetItem['options'];
    frameBlendCanvas?: HTMLCanvasElement;
    frameBlendBackCanvas?: HTMLCanvasElement;
  }

  const assetCache = new Map<string, AssetCacheEntry>();
  const pendingAssetLoads = new Map<string, Promise<AssetCacheEntry>>();
  const layerBindings: Partial<Record<AssetLayerId, AssetCacheEntry>> = {};

  const isPowerOf2 = (value: number) => (value & (value - 1)) === 0;
  const getSamplingFilter = (sampling: AssetTextureSampling | undefined) =>
    sampling === 'nearest' ? gl.NEAREST : gl.LINEAR;

  const applyTextureSampling = (
    sampling: AssetTextureSampling | undefined,
    generateMipmaps: boolean,
    width?: number,
    height?: number
  ) => {
    const filter = getSamplingFilter(sampling);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    if (generateMipmaps && width && height && isPowerOf2(width) && isPowerOf2(height)) {
      gl.generateMipmap(gl.TEXTURE_2D);
    }
  };

  const loadImageAsset = (asset: AssetItem): Promise<AssetCacheEntry> =>
    new Promise((resolve) => {
      const texture = gl.createTexture();
      if (!texture) { resolve({ assetId: asset.id, texture: gl.createTexture()! }); return; }
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      if (!asset.path) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        resolve({ assetId: asset.id, texture, width: asset.width, height: asset.height });
        return;
      }
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        applyTextureSampling(asset.options?.textureSampling, Boolean(asset.options?.generateMipmaps), image.width, image.height);
        resolve({ assetId: asset.id, texture, width: image.width, height: image.height });
      };
      image.onerror = () => {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        resolve({ assetId: asset.id, texture, width: asset.width, height: asset.height });
      };
      image.src = toFileUrl(asset.path);
    });

  const loadVideoAsset = (asset: AssetItem, videoOverride?: HTMLVideoElement): Promise<AssetCacheEntry> =>
    new Promise((resolve) => {
      const texture = gl.createTexture();
      if (!texture) { resolve({ assetId: asset.id, texture: gl.createTexture()! }); return; }
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      const video = videoOverride ?? document.createElement('video');
      if (!videoOverride) { 
        video.crossOrigin = 'anonymous'; video.muted = true; video.loop = asset.options?.loop ?? true;
        video.playsInline = true; video.preload = 'auto'; video.autoplay = true;
        video.playbackRate = asset.options?.playbackRate ?? 1;
      }
      const finalize = () => {
        const baseRate = asset.options?.playbackRate ?? 1;
        video.playbackRate = asset.options?.reverse ? -Math.max(0.01, Math.abs(baseRate)) : baseRate;
        if (asset.options?.reverse && video.duration) video.currentTime = video.duration;
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
        applyTextureSampling(asset.options?.textureSampling, false, video.videoWidth, video.videoHeight);
        resolve({ assetId: asset.id, texture, video, width: video.videoWidth || asset.width, height: video.videoHeight || asset.height, options: asset.options });
      };
      if (!videoOverride) {
        video.addEventListener('error', () => resolve({ assetId: asset.id, texture, video }), { once: true });
        if (asset.path) { video.src = toFileUrl(asset.path); void video.play().catch(() => undefined); }
        else { resolve({ assetId: asset.id, texture, video }); return; }
      }
      if (video.readyState >= video.HAVE_CURRENT_DATA) finalize();
      else video.addEventListener('loadeddata', finalize, { once: true });
    });

  const loadTextAsset = (asset: AssetItem, canvas: HTMLCanvasElement): Promise<AssetCacheEntry> =>
    new Promise((resolve) => {
      const texture = gl.createTexture();
      if (!texture) { resolve({ assetId: asset.id, texture: gl.createTexture()! }); return; }
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
      resolve({ assetId: asset.id, texture, width: canvas.width, height: canvas.height, options: asset.options });
    });

  const loadInternalAsset = (asset: AssetItem): Promise<AssetCacheEntry> => {
    let texture = waveformTexture!;
    if (asset.internalSource === 'audio-spectrum') texture = spectrumTexture!;
    if (asset.internalSource === 'modulators') texture = modulatorTexture!;
    
    return Promise.resolve({
        assetId: asset.id,
        texture,
        internalSourceId: asset.internalSource,
        width: 256,
        height: 1
    });
  };

  const ensureAssetEntry = (asset: AssetItem, videoOverride?: HTMLVideoElement, textCanvas?: HTMLCanvasElement) => {
    if (assetCache.has(asset.id)) {
      const cached = assetCache.get(asset.id)!;
      if (JSON.stringify(cached.options ?? {}) === JSON.stringify(asset.options ?? {})) return Promise.resolve(cached);
      assetCache.delete(asset.id);
    }
    if (pendingAssetLoads.has(asset.id)) return pendingAssetLoads.get(asset.id)!;
    let loader: Promise<AssetCacheEntry>;
    if (asset.kind === 'internal') loader = loadInternalAsset(asset);
    else if (asset.kind === 'video' || asset.kind === 'live') loader = loadVideoAsset(asset, videoOverride);
    else if (asset.kind === 'text' && textCanvas) loader = loadTextAsset(asset, textCanvas);
    else loader = loadImageAsset(asset);
    pendingAssetLoads.set(asset.id, loader);
    loader.then((entry) => { assetCache.set(asset.id, entry); pendingAssetLoads.delete(asset.id); });
    return loader;
  };

  const updateVideoTextures = () => {
    (Object.keys(ASSET_LAYER_UNITS) as AssetLayerId[]).forEach((layerId) => {
      const entry = layerBindings[layerId];
      if (entry?.video && entry.texture && entry.video.readyState >= entry.video.HAVE_CURRENT_DATA) {
        gl.activeTexture(gl.TEXTURE0 + ASSET_LAYER_UNITS[layerId]);
        gl.bindTexture(gl.TEXTURE_2D, entry.texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, entry.video);
      }
    });
  };

  const updateInternalTextures = (state: RenderState) => {
    // 1. Waveform (256x1)
    gl.bindTexture(gl.TEXTURE_2D, waveformTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, 256, 1, 0, gl.RED, gl.FLOAT, state.oscilloData);

    // 2. Spectrum (64x1)
    gl.bindTexture(gl.TEXTURE_2D, spectrumTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, 64, 1, 0, gl.RED, gl.FLOAT, state.spectrum);

    // 3. Modulators
    gl.bindTexture(gl.TEXTURE_2D, modulatorTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, state.modulatorValues.length, 1, 0, gl.RED, gl.FLOAT, state.modulatorValues);

    // 4. MIDI History
    gl.bindTexture(gl.TEXTURE_2D, midiTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, 128, 1, 0, gl.RG, gl.FLOAT, state.midiData);
  };

  const applyInternalTextures = (prog: WebGLProgram) => {
    const units = { waveform: 10, spectrum: 11, modulators: 12, midi: 13, previousFrame: 14 };
    
    gl.activeTexture(gl.TEXTURE0 + units.waveform);
    gl.bindTexture(gl.TEXTURE_2D, waveformTexture);
    gl.uniform1i(gl.getUniformLocation(prog, 'uWaveformTex'), units.waveform);

    gl.activeTexture(gl.TEXTURE0 + units.spectrum);
    gl.bindTexture(gl.TEXTURE_2D, spectrumTexture);
    gl.uniform1i(gl.getUniformLocation(prog, 'uSpectrumTex'), units.spectrum);

    gl.activeTexture(gl.TEXTURE0 + units.modulators);
    gl.bindTexture(gl.TEXTURE_2D, modulatorTexture);
    gl.uniform1i(gl.getUniformLocation(prog, 'uModulatorTex'), units.modulators);

    gl.activeTexture(gl.TEXTURE0 + units.midi);
    gl.bindTexture(gl.TEXTURE_2D, midiTexture);
    gl.uniform1i(gl.getUniformLocation(prog, 'uMidiTex'), units.midi);

    ensurePreviousFrameTextureSize();
    gl.activeTexture(gl.TEXTURE0 + units.previousFrame);
    gl.bindTexture(gl.TEXTURE_2D, previousFrameTexture);
    gl.uniform1i(gl.getUniformLocation(prog, 'uPreviousFrame'), units.previousFrame);
  };

  const applyLayerBinding = (prog: WebGLProgram, layerId: AssetLayerId) => {
    const entry = layerBindings[layerId];
    const unitIndex = ASSET_LAYER_UNITS[layerId];
    const prefix =
      layerId === 'layer-plasma' ? 'uPlasma' : layerId === 'layer-spectrum' ? 'uSpectrum' : 'uMedia';
    const enabledLoc = gl.getUniformLocation(prog, `${prefix}AssetEnabled`);
    const samplerLoc = gl.getUniformLocation(prog, `${prefix}Asset`);
    
    if (enabledLoc) gl.uniform1f(enabledLoc, entry ? 1 : 0);
    
    if (entry?.internalSourceId) {
        let internalUnit = 10; // waveform
        if (entry.internalSourceId === 'audio-spectrum') internalUnit = 11;
        if (entry.internalSourceId === 'modulators') internalUnit = 12;
        if (entry.internalSourceId === 'midi-history') internalUnit = 13;
        
        if (samplerLoc) gl.uniform1i(samplerLoc, internalUnit);
    } else {
        if (samplerLoc) gl.uniform1i(samplerLoc, unitIndex);
        gl.activeTexture(gl.TEXTURE0 + unitIndex);
        gl.bindTexture(gl.TEXTURE_2D, entry?.texture ?? null);
    }
  };

  const setLayerAsset = async (layerId: AssetLayerId, asset: AssetItem | null, videoOverride?: HTMLVideoElement, textCanvas?: HTMLCanvasElement) => {
    if (!asset) { delete layerBindings[layerId]; return; }
    const entry = await ensureAssetEntry(asset, videoOverride, textCanvas);
    layerBindings[layerId] = entry;
  };

  const setPalette = (colors: [string, string, string, string, string]) => {
    currentPalette = colors.map(hex => {
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      return [r, g, b];
    }) as [number, number, number][];
    clearHistory();
  };

  const setPlasmaShaderSource = (source: string | null) => {
    const trimmed = source?.trim();
    const nextSource = trimmed ? trimmed : null;
    const activeIds = currentActiveIds;
    const nextProgram = getOrCompileProgram(
      activeIds,
      currentSdfUniforms,
      currentSdfFunctions,
      currentSdfMapBody,
      nextSource,
      currentCustomBlocks
    );
    if (!nextProgram) {
      return { ok: false };
    }
    standardProgram = nextProgram;
    customPlasmaSource = nextSource;
    currentPlasmaSource = nextSource;
    uniformLocationCache.clear();
    return { ok: true };
  };

  const render = (state: RenderState) => {
    if (contextLost) return;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    updateInternalTextures(state);
    updateAdvancedSdfProgram(state.sdfScene);
    currentProgram = (state.sdfScene && advancedSdfProgram) ? advancedSdfProgram! : standardProgram;
    if (!currentProgram) {
      console.error('Render program unavailable; skipping frame.');
      return;
    }
    updateStandardUniforms(currentProgram, state);
    applyInternalTextures(currentProgram);
    updateVideoTextures();
    applyLayerBinding(currentProgram, 'layer-plasma');
    applyLayerBinding(currentProgram, 'layer-spectrum');
    applyLayerBinding(currentProgram, 'layer-media');
    
    if (currentProgram === advancedSdfProgram && state.sdfScene) {
      const s = state.sdfScene;
      if (s.mode === '3d' && s.render3d) {
          const l = s.render3d.lighting;
          gl.uniform3fv(gl.getUniformLocation(currentProgram, 'uSdfLightDir'), l.direction);
          gl.uniform3fv(gl.getUniformLocation(currentProgram, 'uSdfLightColor'), l.color);
          gl.uniform1f(gl.getUniformLocation(currentProgram, 'uSdfLightIntensity'), l.intensity);
          gl.uniform1f(gl.getUniformLocation(currentProgram, 'uSdfAoEnabled'), s.render3d.aoEnabled ?1 : 0);
          gl.uniform1f(gl.getUniformLocation(currentProgram, 'uSdfShadowsEnabled'), s.render3d.softShadowsEnabled ? 1 : 0);
          
          // Camera defaults if not in config
          const camPos = s.render3d.cameraPosition || [0, 0, 2];
          const camTarget = s.render3d.cameraTarget || [0, 0, 0];
          const camFov = s.render3d.cameraFov || 1.0;
          gl.uniform3fv(gl.getUniformLocation(currentProgram, 'uCameraPos'), camPos);
          gl.uniform3fv(gl.getUniformLocation(currentProgram, 'uCameraTarget'), camTarget);
          gl.uniform1f(gl.getUniformLocation(currentProgram, 'uCameraFov'), camFov);
      }

      advancedSdfUniforms.forEach(u => {
        const loc = advancedSdfUniformLocations.get(u.name);
        if (loc) {
          const node = state.sdfScene.nodes.find((n: any) => n.instanceId === u.instanceId);
          const val = node?.params[u.parameterId];
          if (typeof val === 'number') gl.uniform1f(loc, val);
          else if (Array.isArray(val)) {
            if (val.length === 2) gl.uniform2fv(loc, val);
            else if (val.length === 3) gl.uniform3fv(loc, val);
          }
        }
      });
    }
    
    // Render MilkDrop if enabled
    if (milkDropEnabled && milkDropRenderer && currentMilkDropShaderData && state.milkwaveEnabled) {
      const milkDropSuccess = milkDropRenderer.render(state, currentMilkDropShaderData, false);
      if (milkDropSuccess) {
        const mdTexture = milkDropRenderer.getMainTexture();
        if (mdTexture) {
          // Lazily create the composite program (reused across frames)
          if (!milkDropCompositeProgram) {
            milkDropCompositeProgram = createProgram(
              `#version 300 es
in vec2 position;
out vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`,
              `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTexture;
uniform float uOpacity;
out vec4 fragColor;
void main() {
  fragColor = texture(uTexture, vUv) * uOpacity;
}`
            );
          }
          if (milkDropCompositeProgram) {
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            gl.useProgram(milkDropCompositeProgram);
            gl.uniform1i(gl.getUniformLocation(milkDropCompositeProgram, 'uTexture'), 0);
            gl.uniform1f(gl.getUniformLocation(milkDropCompositeProgram, 'uOpacity'), state.milkwaveOpacity ?? 1.0);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, mdTexture);
            gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
            const posLoc = gl.getAttribLocation(milkDropCompositeProgram, 'position');
            gl.enableVertexAttribArray(posLoc);
            gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            gl.disable(gl.BLEND);
          }
        }
      }
    }
    
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    ensurePreviousFrameTextureSize();
    gl.bindTexture(gl.TEXTURE_2D, previousFrameTexture);
    gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 0, 0, canvas.width, canvas.height);
  };

  const getLastShaderError = () => lastShaderError;

  const getGeneratorDiagnostics = () => {
    const result: { name: string; enabled: boolean; opacity: number; uniformsBound: boolean }[] = [];
    generatorDiagnostics.forEach((diag, name) => {
      result.push({ name, ...diag });
    });
    return result;
  };

  const getMissingUniforms = () => Array.from(missingUniforms);

  const recompileForGenerators = (activeIds: Set<string>, customBlocks: CustomShaderBlock[] = []): boolean => {
    // Store the active IDs and custom blocks for future recompilations (e.g., when SDF changes)
    currentActiveIds = new Set(activeIds);
    currentCustomBlocks = customBlocks;

    const t0 = performance.now();
    const customHash = customBlocks.map(b => b.id + ':' + b.uniforms + (b.functions ?? '') + b.mainCall).join('|');
    const wasCached = programCache.has(shaderCacheKey(activeIds, currentSdfMapBody, currentPlasmaSource, customHash));
    const prog = getOrCompileProgram(
      activeIds,
      currentSdfUniforms,
      currentSdfFunctions,
      currentSdfMapBody,
      currentPlasmaSource,
      customBlocks
    );
    const elapsed = (performance.now() - t0).toFixed(1);
    console.log(`[Shader] Compiled ${activeIds.size} generators in ${elapsed}ms (cached: ${wasCached})`);

    if (!prog) {
      console.error('Failed to recompile shader for generators:', activeIds);
      return false;
    }

    standardProgram = prog;
    currentProgram = standardProgram;
    uniformLocationCache.clear();
    return true;
  };

  const precompileVariant = (ids: Set<string>): void => {
    if (contextLost) return;
    // Compile and cache a shader variant without activating it.
    // Used at load time to warm the cache for all scene variants.
    const t0 = performance.now();
    const prog = getOrCompileProgram(ids, currentSdfUniforms, currentSdfFunctions, currentSdfMapBody, currentPlasmaSource, currentCustomBlocks);
    const elapsed = (performance.now() - t0).toFixed(1);
    const cached = !prog || elapsed === '0.0';
    console.log(`[Shader] Precompiled ${ids.size} generators in ${elapsed}ms (cached: ${cached})`);
  };

  const setCustomShaderBlocks = (blocks: CustomShaderBlock[]): void => {
    currentCustomBlocks = blocks;
    programCache.clear();
  };

  return {
    render,
    clearHistory,
    setLayerAsset,
    setPalette,
    setPlasmaShaderSource,
    getLastShaderError,
    getGeneratorDiagnostics,
    getMissingUniforms,
    recompileForGenerators,
    precompileVariant,
    setCustomShaderBlocks,
    updateMilkDropShaders
  };
};
