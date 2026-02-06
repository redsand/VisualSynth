import { createGLRenderer, RenderState, resizeCanvasToDisplaySize } from './glRenderer';

const canvas = document.getElementById('output-canvas') as HTMLCanvasElement;
const debugOverlay = document.getElementById('output-debug') as HTMLDivElement | null;
let debugVisible = false;
let renderer: ReturnType<typeof createGLRenderer>;

try {
  renderer = createGLRenderer(canvas, {});
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
  chemistryMode: 0,
  transitionAmount: 0,
  transitionType: 1,
  motionTemplate: 0,
  engineMass: 0.5,
  engineFriction: 0.95,
  engineElasticity: 1,
  engineGrain: 0.2,
  engineVignette: 1,
  engineCA: 0.3,
  engineSignature: 0,
  maxBloom: 1,
  forceFeedback: false,
  plasmaOpacity: 1,
  plasmaSpeed: 1,
  plasmaScale: 1,
  plasmaComplexity: 0.5,
  plasmaAudioReact: 0.6,
  spectrumOpacity: 1,
  origamiOpacity: 0.9,
  origamiFoldState: 0,
  origamiFoldSharpness: 0.65,
  origamiSpeed: 1,
  glyphOpacity: 0.8,
  glyphMode: 0,
  glyphSeed: 0,
  glyphBeat: 0,
  glyphSpeed: 1,
  crystalOpacity: 0.85,
  crystalMode: 0,
  crystalBrittleness: 0.4,
  crystalScale: 1,
  crystalSpeed: 1,
  inkOpacity: 0.85,
  inkBrush: 0,
  inkPressure: 0.6,
  inkLifespan: 0.6,
  inkSpeed: 1,
  inkScale: 1,
  topoOpacity: 0.85,
  topoQuake: 0,
  topoSlide: 0,
  topoPlate: 0,
  topoTravel: 0,
  topoScale: 1,
  topoElevation: 0.5,
  weatherOpacity: 0.85,
  weatherMode: 0,
  weatherIntensity: 0.6,
  weatherSpeed: 1,
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
  modulatorValues: new Float32Array(16),
  midiData: new Float32Array(256),
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
  kaleidoscopeRotation: 0,
  feedback: 0,
  feedbackZoom: 0,
  feedbackRotation: 0,
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
  particleTurbulence: 0.3,
  particleAudioLift: 0.5,
  sdfEnabled: true,
  sdfShape: 0,
  sdfScale: 0.45,
  sdfEdge: 0.08,
  sdfGlow: 0.5,
  sdfRotation: 0,
  sdfFill: 0.35,
  sdfColor: [1.0, 0.6, 0.25],
  gravityPositions: new Float32Array(16),
  gravityStrengths: new Float32Array(8),
  gravityPolarities: new Float32Array(8),
  gravityActives: new Float32Array(8),
  gravityCollapse: 0,
  roleWeights: {
    core: 1,
    support: 1,
    atmosphere: 1
  },
  // EDM Generators
  laserEnabled: false,
  laserOpacity: 1,
  laserBeamCount: 4,
  laserBeamWidth: 0.02,
  laserBeamLength: 1.0,
  laserRotation: 0,
  laserRotationSpeed: 0.5,
  laserSpread: 1.57,
  laserMode: 0,
  laserColorShift: 0,
  laserAudioReact: 0.7,
  laserGlow: 0.5,
  strobeEnabled: false,
  strobeOpacity: 1,
  strobeRate: 4,
  strobeDutyCycle: 0.1,
  strobeMode: 0,
  strobeAudioTrigger: true,
  strobeThreshold: 0.6,
  strobeFadeOut: 0.1,
  strobePattern: 0,
  shapeBurstEnabled: false,
  shapeBurstOpacity: 1,
  shapeBurstShape: 0,
  shapeBurstExpandSpeed: 2,
  shapeBurstStartSize: 0.05,
  shapeBurstMaxSize: 1.5,
  shapeBurstThickness: 0.03,
  shapeBurstFadeMode: 2,
  shapeBurstSpawnTimes: new Float32Array(8),
  shapeBurstActives: new Float32Array(8),
  gridTunnelEnabled: false,
  gridTunnelOpacity: 1,
  gridTunnelSpeed: 1,
  gridTunnelGridSize: 20,
  gridTunnelLineWidth: 0.02,
  gridTunnelPerspective: 1,
  gridTunnelHorizonY: 0.5,
  gridTunnelGlow: 0.5,
  gridTunnelAudioReact: 0.3,
  gridTunnelMode: 0
};

const channel = new BroadcastChannel('visualsynth-output');
let lastMessageAt = 0;
let messageCount = 0;
channel.onmessage = (event) => {
  lastMessageAt = performance.now();
  messageCount += 1;
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
  if (typeof data.chemistryMode === 'number') state.chemistryMode = data.chemistryMode;
  if (typeof data.transitionAmount === 'number') state.transitionAmount = data.transitionAmount;
  if (typeof data.transitionType === 'number') state.transitionType = data.transitionType;
  if (typeof data.motionTemplate === 'number') state.motionTemplate = data.motionTemplate;
  if (typeof data.engineMass === 'number') state.engineMass = data.engineMass;
  if (typeof data.engineFriction === 'number') state.engineFriction = data.engineFriction;
  if (typeof data.engineElasticity === 'number') state.engineElasticity = data.engineElasticity;
  if (typeof data.engineGrain === 'number') state.engineGrain = data.engineGrain;
  if (typeof data.engineVignette === 'number') state.engineVignette = data.engineVignette;
  if (typeof data.engineCA === 'number') state.engineCA = data.engineCA;
  if (typeof data.engineSignature === 'number') state.engineSignature = data.engineSignature;
  if (typeof data.maxBloom === 'number') state.maxBloom = data.maxBloom;
  if (typeof data.forceFeedback === 'boolean') state.forceFeedback = data.forceFeedback;
  if (typeof data.plasmaOpacity === 'number') state.plasmaOpacity = data.plasmaOpacity;
  if (typeof data.plasmaSpeed === 'number') state.plasmaSpeed = data.plasmaSpeed;
  if (typeof data.plasmaScale === 'number') state.plasmaScale = data.plasmaScale;
  if (typeof data.plasmaComplexity === 'number') state.plasmaComplexity = data.plasmaComplexity;
  if (typeof data.plasmaAudioReact === 'number') state.plasmaAudioReact = data.plasmaAudioReact;
  if (typeof data.spectrumOpacity === 'number') state.spectrumOpacity = data.spectrumOpacity;
  if (typeof data.origamiOpacity === 'number') state.origamiOpacity = data.origamiOpacity;
  if (typeof data.origamiFoldState === 'number') state.origamiFoldState = data.origamiFoldState;
  if (typeof data.origamiFoldSharpness === 'number')
    state.origamiFoldSharpness = data.origamiFoldSharpness;
  if (typeof data.origamiSpeed === 'number') state.origamiSpeed = data.origamiSpeed;
  if (typeof data.glyphOpacity === 'number') state.glyphOpacity = data.glyphOpacity;
  if (typeof data.glyphMode === 'number') state.glyphMode = data.glyphMode;
  if (typeof data.glyphSeed === 'number') state.glyphSeed = data.glyphSeed;
  if (typeof data.glyphBeat === 'number') state.glyphBeat = data.glyphBeat;
  if (typeof data.glyphSpeed === 'number') state.glyphSpeed = data.glyphSpeed;
  if (typeof data.crystalOpacity === 'number') state.crystalOpacity = data.crystalOpacity;
  if (typeof data.crystalMode === 'number') state.crystalMode = data.crystalMode;
  if (typeof data.crystalBrittleness === 'number')
    state.crystalBrittleness = data.crystalBrittleness;
  if (typeof data.crystalScale === 'number') state.crystalScale = data.crystalScale;
  if (typeof data.crystalSpeed === 'number') state.crystalSpeed = data.crystalSpeed;
  if (typeof data.inkOpacity === 'number') state.inkOpacity = data.inkOpacity;
  if (typeof data.inkBrush === 'number') state.inkBrush = data.inkBrush;
  if (typeof data.inkPressure === 'number') state.inkPressure = data.inkPressure;
  if (typeof data.inkLifespan === 'number') state.inkLifespan = data.inkLifespan;
  if (typeof data.inkSpeed === 'number') state.inkSpeed = data.inkSpeed;
  if (typeof data.inkScale === 'number') state.inkScale = data.inkScale;
  if (typeof data.topoOpacity === 'number') state.topoOpacity = data.topoOpacity;
  if (typeof data.topoQuake === 'number') state.topoQuake = data.topoQuake;
  if (typeof data.topoSlide === 'number') state.topoSlide = data.topoSlide;
  if (typeof data.topoPlate === 'number') state.topoPlate = data.topoPlate;
  if (typeof data.topoTravel === 'number') state.topoTravel = data.topoTravel;
  if (typeof data.topoScale === 'number') state.topoScale = data.topoScale;
  if (typeof data.topoElevation === 'number') state.topoElevation = data.topoElevation;
  if (typeof data.weatherOpacity === 'number') state.weatherOpacity = data.weatherOpacity;
  if (typeof data.weatherMode === 'number') state.weatherMode = data.weatherMode;
  if (typeof data.weatherIntensity === 'number')
    state.weatherIntensity = data.weatherIntensity;
  if (typeof data.weatherSpeed === 'number') state.weatherSpeed = data.weatherSpeed;
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
  if (data.modulatorValues) state.modulatorValues = new Float32Array(data.modulatorValues);
  if (data.midiData) state.midiData = new Float32Array(data.midiData);
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
  if (typeof data.kaleidoscopeRotation === 'number') state.kaleidoscopeRotation = data.kaleidoscopeRotation;
  if (typeof data.feedback === 'number') state.feedback = data.feedback;
  if (typeof data.feedbackZoom === 'number') state.feedbackZoom = data.feedbackZoom;
  if (typeof data.feedbackRotation === 'number') state.feedbackRotation = data.feedbackRotation;
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
  if (typeof data.particleTurbulence === 'number') state.particleTurbulence = data.particleTurbulence;
  if (typeof data.particleAudioLift === 'number') state.particleAudioLift = data.particleAudioLift;
  if (typeof data.sdfEnabled === 'boolean') state.sdfEnabled = data.sdfEnabled;
  if (typeof data.sdfShape === 'number') state.sdfShape = data.sdfShape;
  if (typeof data.sdfScale === 'number') state.sdfScale = data.sdfScale;
  if (typeof data.sdfEdge === 'number') state.sdfEdge = data.sdfEdge;
  if (typeof data.sdfGlow === 'number') state.sdfGlow = data.sdfGlow;
  if (typeof data.sdfRotation === 'number') state.sdfRotation = data.sdfRotation;
  if (typeof data.sdfFill === 'number') state.sdfFill = data.sdfFill;
  if (data.sdfColor) state.sdfColor = data.sdfColor as [number, number, number];
  if (data.gravityPositions) state.gravityPositions = new Float32Array(data.gravityPositions);
  if (data.gravityStrengths) state.gravityStrengths = new Float32Array(data.gravityStrengths);
  if (data.gravityPolarities) state.gravityPolarities = new Float32Array(data.gravityPolarities);
  if (data.gravityActives) state.gravityActives = new Float32Array(data.gravityActives);
  if (typeof data.gravityCollapse === 'number') state.gravityCollapse = data.gravityCollapse;
  if (data.trailSpectrum) state.trailSpectrum = new Float32Array(data.trailSpectrum);
  if (data.spectrum) {
    state.spectrum = new Float32Array(data.spectrum);
  }
  if (data.roleWeights) {
    state.roleWeights = {
      core: data.roleWeights.core ?? state.roleWeights.core,
      support: data.roleWeights.support ?? state.roleWeights.support,
      atmosphere: data.roleWeights.atmosphere ?? state.roleWeights.atmosphere
    };
  }
  if (typeof data.laserEnabled === 'boolean') state.laserEnabled = data.laserEnabled;
  if (typeof data.laserOpacity === 'number') state.laserOpacity = data.laserOpacity;
  if (typeof data.laserBeamCount === 'number') state.laserBeamCount = data.laserBeamCount;
  if (typeof data.laserBeamWidth === 'number') state.laserBeamWidth = data.laserBeamWidth;
  if (typeof data.laserBeamLength === 'number') state.laserBeamLength = data.laserBeamLength;
  if (typeof data.laserRotation === 'number') state.laserRotation = data.laserRotation;
  if (typeof data.laserRotationSpeed === 'number') state.laserRotationSpeed = data.laserRotationSpeed;
  if (typeof data.laserSpread === 'number') state.laserSpread = data.laserSpread;
  if (typeof data.laserMode === 'number') state.laserMode = data.laserMode;
  if (typeof data.laserColorShift === 'number') state.laserColorShift = data.laserColorShift;
  if (typeof data.laserAudioReact === 'number') state.laserAudioReact = data.laserAudioReact;
  if (typeof data.laserGlow === 'number') state.laserGlow = data.laserGlow;
  if (typeof data.strobeEnabled === 'boolean') state.strobeEnabled = data.strobeEnabled;
  if (typeof data.strobeOpacity === 'number') state.strobeOpacity = data.strobeOpacity;
  if (typeof data.strobeRate === 'number') state.strobeRate = data.strobeRate;
  if (typeof data.strobeDutyCycle === 'number') state.strobeDutyCycle = data.strobeDutyCycle;
  if (typeof data.strobeMode === 'number') state.strobeMode = data.strobeMode;
  if (typeof data.strobeAudioTrigger === 'boolean') state.strobeAudioTrigger = data.strobeAudioTrigger;
  if (typeof data.strobeThreshold === 'number') state.strobeThreshold = data.strobeThreshold;
  if (typeof data.strobeFadeOut === 'number') state.strobeFadeOut = data.strobeFadeOut;
  if (typeof data.strobePattern === 'number') state.strobePattern = data.strobePattern;
  if (typeof data.shapeBurstEnabled === 'boolean') state.shapeBurstEnabled = data.shapeBurstEnabled;
  if (typeof data.shapeBurstOpacity === 'number') state.shapeBurstOpacity = data.shapeBurstOpacity;
  if (typeof data.shapeBurstShape === 'number') state.shapeBurstShape = data.shapeBurstShape;
  if (typeof data.shapeBurstExpandSpeed === 'number') state.shapeBurstExpandSpeed = data.shapeBurstExpandSpeed;
  if (typeof data.shapeBurstStartSize === 'number') state.shapeBurstStartSize = data.shapeBurstStartSize;
  if (typeof data.shapeBurstMaxSize === 'number') state.shapeBurstMaxSize = data.shapeBurstMaxSize;
  if (typeof data.shapeBurstThickness === 'number') state.shapeBurstThickness = data.shapeBurstThickness;
  if (typeof data.shapeBurstFadeMode === 'number') state.shapeBurstFadeMode = data.shapeBurstFadeMode;
  if (data.shapeBurstSpawnTimes) state.shapeBurstSpawnTimes = new Float32Array(data.shapeBurstSpawnTimes);
  if (data.shapeBurstActives) state.shapeBurstActives = new Float32Array(data.shapeBurstActives);
  if (typeof data.gridTunnelEnabled === 'boolean') state.gridTunnelEnabled = data.gridTunnelEnabled;
  if (typeof data.gridTunnelOpacity === 'number') state.gridTunnelOpacity = data.gridTunnelOpacity;
  if (typeof data.gridTunnelSpeed === 'number') state.gridTunnelSpeed = data.gridTunnelSpeed;
  if (typeof data.gridTunnelGridSize === 'number') state.gridTunnelGridSize = data.gridTunnelGridSize;
  if (typeof data.gridTunnelLineWidth === 'number') state.gridTunnelLineWidth = data.gridTunnelLineWidth;
  if (typeof data.gridTunnelPerspective === 'number') state.gridTunnelPerspective = data.gridTunnelPerspective;
  if (typeof data.gridTunnelHorizonY === 'number') state.gridTunnelHorizonY = data.gridTunnelHorizonY;
  if (typeof data.gridTunnelGlow === 'number') state.gridTunnelGlow = data.gridTunnelGlow;
  if (typeof data.gridTunnelAudioReact === 'number') state.gridTunnelAudioReact = data.gridTunnelAudioReact;
  if (typeof data.gridTunnelMode === 'number') state.gridTunnelMode = data.gridTunnelMode;
  if (Array.isArray((data as any).paletteColors) && renderer?.setPalette) {
    const colors = (data as any).paletteColors as string[];
    if (colors.length >= 5) {
      renderer.setPalette(colors.slice(0, 5) as [string, string, string, string, string]);
    }
  }
};

let lastDebugUpdate = 0;
let frameCount = 0;
const render = (time: number) => {
  resizeCanvasToDisplaySize(canvas);
  renderer.render({
    ...state,
    timeMs: Number.isFinite(state.timeMs) ? state.timeMs : time
  });
  frameCount += 1;
  if (debugOverlay) {
    const now = performance.now();
    if (now - lastDebugUpdate > 500) {
      lastDebugUpdate = now;
      const ageMs = lastMessageAt ? Math.round(now - lastMessageAt) : -1;
      const rect = canvas.getBoundingClientRect();
      if (debugVisible) {
        debugOverlay.textContent =
          `Output Debug\n` +
          `Size: ${Math.round(rect.width)}x${Math.round(rect.height)}\n` +
          `Frames: ${frameCount}\n` +
          `Messages: ${messageCount}\n` +
          `Last msg: ${ageMs >= 0 ? ageMs + 'ms' : 'never'}`;
      }
    }
  }
  requestAnimationFrame(render);
};

requestAnimationFrame(render);

window.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() !== 'd') return;
  debugVisible = !debugVisible;
  if (debugOverlay) {
    debugOverlay.classList.toggle('hidden', !debugVisible);
  }
});
