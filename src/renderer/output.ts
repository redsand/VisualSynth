import { createGLRenderer, RenderState, resizeCanvasToDisplaySize } from './glRenderer';

const canvas = document.getElementById('output-canvas') as HTMLCanvasElement;
let renderer: ReturnType<typeof createGLRenderer>;

try {
  renderer = createGLRenderer(canvas);
} catch (error) {
  document.body.textContent = 'WebGL2 not supported.';
  throw error;
}

const state: RenderState = {
  timeMs: 0,
  rms: 0,
  peak: 0,
  strobe: 0,
  plasmaEnabled: true,
  spectrumEnabled: true,
  origamiEnabled: false,
  glyphEnabled: false,
  crystalEnabled: false,
  inkEnabled: false,
  topoEnabled: false,
  weatherEnabled: false,
  portalEnabled: false,
  mediaEnabled: false,
  oscilloEnabled: false,
  spectrum: new Float32Array(64),
  contrast: 1,
  saturation: 1,
  paletteShift: 0,
  plasmaOpacity: 1,
  spectrumOpacity: 1,
  origamiOpacity: 0.9,
  origamiFoldState: 0,
  origamiFoldSharpness: 0.65,
  glyphOpacity: 0.8,
  glyphMode: 0,
  glyphSeed: 0,
  glyphBeat: 0,
  crystalOpacity: 0.85,
  crystalMode: 0,
  crystalBrittleness: 0.4,
  inkOpacity: 0.85,
  inkBrush: 0,
  inkPressure: 0.6,
  inkLifespan: 0.6,
  topoOpacity: 0.85,
  topoQuake: 0,
  topoSlide: 0,
  topoPlate: 0,
  topoTravel: 0,
  weatherOpacity: 0.85,
  weatherMode: 0,
  weatherIntensity: 0.6,
  portalOpacity: 0.85,
  portalShift: 0,
  portalStyle: 0,
  portalPositions: new Float32Array(8),
  portalRadii: new Float32Array(4),
  portalActives: new Float32Array(4),
  mediaOpacity: 0.9,
  mediaBurstPositions: new Float32Array(16),
  mediaBurstRadii: new Float32Array(8),
  mediaBurstTypes: new Float32Array(8),
  mediaBurstActives: new Float32Array(8),
  oscilloOpacity: 0.85,
  oscilloMode: 0,
  oscilloFreeze: 0,
  oscilloRotate: 0,
  oscilloData: new Float32Array(256),
  plasmaAssetBlendMode: 3,
  plasmaAssetAudioReact: 0.6,
  spectrumAssetBlendMode: 1,
  spectrumAssetAudioReact: 0.8,
  mediaAssetBlendMode: 3,
  mediaAssetAudioReact: 0.5,
  effectsEnabled: true,
  bloom: 0.2,
  blur: 0,
  chroma: 0.1,
  posterize: 0,
  kaleidoscope: 0,
  feedback: 0,
  persistence: 0,
  trailSpectrum: new Float32Array(64),
  expressiveEnergyBloom: 0,
  expressiveEnergyThreshold: 0.55,
  expressiveEnergyAccumulation: 0.65,
  expressiveRadialGravity: 0,
  expressiveRadialStrength: 0.6,
  expressiveRadialRadius: 0.65,
  expressiveRadialFocusX: 0.5,
  expressiveRadialFocusY: 0.5,
  expressiveMotionEcho: 0,
  expressiveMotionEchoDecay: 0.6,
  expressiveMotionEchoWarp: 0.35,
  expressiveSpectralSmear: 0,
  expressiveSpectralOffset: 0.4,
  expressiveSpectralMix: 0.6,
  particlesEnabled: true,
  particleDensity: 0.35,
  particleSpeed: 0.3,
  particleSize: 0.45,
  particleGlow: 0.6,
  sdfEnabled: true,
  sdfShape: 0,
  sdfScale: 0.45,
  sdfEdge: 0.08,
  sdfGlow: 0.5,
  sdfRotation: 0,
  sdfFill: 0.35,
  gravityPositions: new Float32Array(16),
  gravityStrengths: new Float32Array(8),
  gravityPolarities: new Float32Array(8),
  gravityActives: new Float32Array(8),
  gravityCollapse: 0
};

const channel = new BroadcastChannel('visualsynth-output');
channel.onmessage = (event) => {
  const data = event.data as Partial<RenderState> & { spectrum?: Float32Array };
  if (typeof data.timeMs === 'number') state.timeMs = data.timeMs;
  if (typeof data.rms === 'number') state.rms = data.rms;
  if (typeof data.peak === 'number') state.peak = data.peak;
  if (typeof data.strobe === 'number') state.strobe = data.strobe;
  if (typeof data.plasmaEnabled === 'boolean') state.plasmaEnabled = data.plasmaEnabled;
  if (typeof data.spectrumEnabled === 'boolean') state.spectrumEnabled = data.spectrumEnabled;
  if (typeof data.origamiEnabled === 'boolean') state.origamiEnabled = data.origamiEnabled;
  if (typeof data.glyphEnabled === 'boolean') state.glyphEnabled = data.glyphEnabled;
  if (typeof data.crystalEnabled === 'boolean') state.crystalEnabled = data.crystalEnabled;
  if (typeof data.inkEnabled === 'boolean') state.inkEnabled = data.inkEnabled;
  if (typeof data.topoEnabled === 'boolean') state.topoEnabled = data.topoEnabled;
  if (typeof data.weatherEnabled === 'boolean') state.weatherEnabled = data.weatherEnabled;
  if (typeof data.portalEnabled === 'boolean') state.portalEnabled = data.portalEnabled;
  if (typeof data.mediaEnabled === 'boolean') state.mediaEnabled = data.mediaEnabled;
  if (typeof data.oscilloEnabled === 'boolean') state.oscilloEnabled = data.oscilloEnabled;
  if (typeof data.contrast === 'number') state.contrast = data.contrast;
  if (typeof data.saturation === 'number') state.saturation = data.saturation;
  if (typeof data.paletteShift === 'number') state.paletteShift = data.paletteShift;
  if (typeof data.plasmaOpacity === 'number') state.plasmaOpacity = data.plasmaOpacity;
  if (typeof data.spectrumOpacity === 'number') state.spectrumOpacity = data.spectrumOpacity;
  if (typeof data.origamiOpacity === 'number') state.origamiOpacity = data.origamiOpacity;
  if (typeof data.origamiFoldState === 'number') state.origamiFoldState = data.origamiFoldState;
  if (typeof data.origamiFoldSharpness === 'number')
    state.origamiFoldSharpness = data.origamiFoldSharpness;
  if (typeof data.glyphOpacity === 'number') state.glyphOpacity = data.glyphOpacity;
  if (typeof data.glyphMode === 'number') state.glyphMode = data.glyphMode;
  if (typeof data.glyphSeed === 'number') state.glyphSeed = data.glyphSeed;
  if (typeof data.glyphBeat === 'number') state.glyphBeat = data.glyphBeat;
  if (typeof data.crystalOpacity === 'number') state.crystalOpacity = data.crystalOpacity;
  if (typeof data.crystalMode === 'number') state.crystalMode = data.crystalMode;
  if (typeof data.crystalBrittleness === 'number')
    state.crystalBrittleness = data.crystalBrittleness;
  if (typeof data.inkOpacity === 'number') state.inkOpacity = data.inkOpacity;
  if (typeof data.inkBrush === 'number') state.inkBrush = data.inkBrush;
  if (typeof data.inkPressure === 'number') state.inkPressure = data.inkPressure;
  if (typeof data.inkLifespan === 'number') state.inkLifespan = data.inkLifespan;
  if (typeof data.topoOpacity === 'number') state.topoOpacity = data.topoOpacity;
  if (typeof data.topoQuake === 'number') state.topoQuake = data.topoQuake;
  if (typeof data.topoSlide === 'number') state.topoSlide = data.topoSlide;
  if (typeof data.topoPlate === 'number') state.topoPlate = data.topoPlate;
  if (typeof data.topoTravel === 'number') state.topoTravel = data.topoTravel;
  if (typeof data.weatherOpacity === 'number') state.weatherOpacity = data.weatherOpacity;
  if (typeof data.weatherMode === 'number') state.weatherMode = data.weatherMode;
  if (typeof data.weatherIntensity === 'number')
    state.weatherIntensity = data.weatherIntensity;
  if (typeof data.portalOpacity === 'number') state.portalOpacity = data.portalOpacity;
  if (typeof data.portalShift === 'number') state.portalShift = data.portalShift;
  if (typeof data.portalStyle === 'number') state.portalStyle = data.portalStyle;
  if (data.portalPositions) state.portalPositions = new Float32Array(data.portalPositions);
  if (data.portalRadii) state.portalRadii = new Float32Array(data.portalRadii);
  if (data.portalActives) state.portalActives = new Float32Array(data.portalActives);
  if (typeof data.mediaOpacity === 'number') state.mediaOpacity = data.mediaOpacity;
  if (data.mediaBurstPositions) state.mediaBurstPositions = new Float32Array(data.mediaBurstPositions);
  if (data.mediaBurstRadii) state.mediaBurstRadii = new Float32Array(data.mediaBurstRadii);
  if (data.mediaBurstTypes) state.mediaBurstTypes = new Float32Array(data.mediaBurstTypes);
  if (data.mediaBurstActives) state.mediaBurstActives = new Float32Array(data.mediaBurstActives);
  if (typeof data.oscilloOpacity === 'number') state.oscilloOpacity = data.oscilloOpacity;
  if (typeof data.oscilloMode === 'number') state.oscilloMode = data.oscilloMode;
  if (typeof data.oscilloFreeze === 'number') state.oscilloFreeze = data.oscilloFreeze;
  if (typeof data.oscilloRotate === 'number') state.oscilloRotate = data.oscilloRotate;
  if (data.oscilloData) state.oscilloData = new Float32Array(data.oscilloData);
  if (typeof data.plasmaAssetBlendMode === 'number') state.plasmaAssetBlendMode = data.plasmaAssetBlendMode;
  if (typeof data.plasmaAssetAudioReact === 'number') state.plasmaAssetAudioReact = data.plasmaAssetAudioReact;
  if (typeof data.spectrumAssetBlendMode === 'number') state.spectrumAssetBlendMode = data.spectrumAssetBlendMode;
  if (typeof data.spectrumAssetAudioReact === 'number') state.spectrumAssetAudioReact = data.spectrumAssetAudioReact;
  if (typeof data.mediaAssetBlendMode === 'number') state.mediaAssetBlendMode = data.mediaAssetBlendMode;
  if (typeof data.mediaAssetAudioReact === 'number') state.mediaAssetAudioReact = data.mediaAssetAudioReact;
  if (typeof data.effectsEnabled === 'boolean') state.effectsEnabled = data.effectsEnabled;
  if (typeof data.bloom === 'number') state.bloom = data.bloom;
  if (typeof data.blur === 'number') state.blur = data.blur;
  if (typeof data.chroma === 'number') state.chroma = data.chroma;
  if (typeof data.posterize === 'number') state.posterize = data.posterize;
  if (typeof data.kaleidoscope === 'number') state.kaleidoscope = data.kaleidoscope;
  if (typeof data.feedback === 'number') state.feedback = data.feedback;
  if (typeof data.persistence === 'number') state.persistence = data.persistence;
  if (typeof data.expressiveEnergyBloom === 'number')
    state.expressiveEnergyBloom = data.expressiveEnergyBloom;
  if (typeof data.expressiveEnergyThreshold === 'number')
    state.expressiveEnergyThreshold = data.expressiveEnergyThreshold;
  if (typeof data.expressiveEnergyAccumulation === 'number')
    state.expressiveEnergyAccumulation = data.expressiveEnergyAccumulation;
  if (typeof data.expressiveRadialGravity === 'number')
    state.expressiveRadialGravity = data.expressiveRadialGravity;
  if (typeof data.expressiveRadialStrength === 'number')
    state.expressiveRadialStrength = data.expressiveRadialStrength;
  if (typeof data.expressiveRadialRadius === 'number')
    state.expressiveRadialRadius = data.expressiveRadialRadius;
  if (typeof data.expressiveRadialFocusX === 'number')
    state.expressiveRadialFocusX = data.expressiveRadialFocusX;
  if (typeof data.expressiveRadialFocusY === 'number')
    state.expressiveRadialFocusY = data.expressiveRadialFocusY;
  if (typeof data.expressiveMotionEcho === 'number')
    state.expressiveMotionEcho = data.expressiveMotionEcho;
  if (typeof data.expressiveMotionEchoDecay === 'number')
    state.expressiveMotionEchoDecay = data.expressiveMotionEchoDecay;
  if (typeof data.expressiveMotionEchoWarp === 'number')
    state.expressiveMotionEchoWarp = data.expressiveMotionEchoWarp;
  if (typeof data.expressiveSpectralSmear === 'number')
    state.expressiveSpectralSmear = data.expressiveSpectralSmear;
  if (typeof data.expressiveSpectralOffset === 'number')
    state.expressiveSpectralOffset = data.expressiveSpectralOffset;
  if (typeof data.expressiveSpectralMix === 'number')
    state.expressiveSpectralMix = data.expressiveSpectralMix;
  if (typeof data.particlesEnabled === 'boolean') state.particlesEnabled = data.particlesEnabled;
  if (typeof data.particleDensity === 'number') state.particleDensity = data.particleDensity;
  if (typeof data.particleSpeed === 'number') state.particleSpeed = data.particleSpeed;
  if (typeof data.particleSize === 'number') state.particleSize = data.particleSize;
  if (typeof data.particleGlow === 'number') state.particleGlow = data.particleGlow;
  if (typeof data.sdfEnabled === 'boolean') state.sdfEnabled = data.sdfEnabled;
  if (typeof data.sdfShape === 'number') state.sdfShape = data.sdfShape;
  if (typeof data.sdfScale === 'number') state.sdfScale = data.sdfScale;
  if (typeof data.sdfEdge === 'number') state.sdfEdge = data.sdfEdge;
  if (typeof data.sdfGlow === 'number') state.sdfGlow = data.sdfGlow;
  if (typeof data.sdfRotation === 'number') state.sdfRotation = data.sdfRotation;
  if (typeof data.sdfFill === 'number') state.sdfFill = data.sdfFill;
  if (data.gravityPositions) state.gravityPositions = new Float32Array(data.gravityPositions);
  if (data.gravityStrengths) state.gravityStrengths = new Float32Array(data.gravityStrengths);
  if (data.gravityPolarities) state.gravityPolarities = new Float32Array(data.gravityPolarities);
  if (data.gravityActives) state.gravityActives = new Float32Array(data.gravityActives);
  if (typeof data.gravityCollapse === 'number') state.gravityCollapse = data.gravityCollapse;
  if (data.trailSpectrum) state.trailSpectrum = new Float32Array(data.trailSpectrum);
  if (data.spectrum) {
    state.spectrum = new Float32Array(data.spectrum);
  }
};

const render = (time: number) => {
  resizeCanvasToDisplaySize(canvas);
  renderer.render({
    ...state,
    timeMs: Number.isFinite(state.timeMs) ? state.timeMs : time
  });
  requestAnimationFrame(render);
};

requestAnimationFrame(render);
