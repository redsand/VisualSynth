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
  gridTunnelMode: 0,
  // Rock Generators
  lightningEnabled: false,
  lightningOpacity: 1,
  lightningSpeed: 1,
  lightningBranches: 3,
  lightningThickness: 0.02,
  lightningColor: 0,
  analogOscilloEnabled: false,
  analogOscilloOpacity: 1,
  analogOscilloThickness: 0.02,
  analogOscilloGlow: 0.5,
  analogOscilloColor: 0,
  analogOscilloMode: 0,
  speakerConeEnabled: false,
  speakerConeOpacity: 1,
  speakerConeForce: 1,
  glitchScanlineEnabled: false,
  glitchScanlineOpacity: 1,
  glitchScanlineSpeed: 1,
  glitchScanlineCount: 5,
  laserStarfieldEnabled: false,
  laserStarfieldOpacity: 1,
  laserStarfieldSpeed: 1,
  laserStarfieldDensity: 1,
  pulsingRibbonsEnabled: false,
  pulsingRibbonsOpacity: 1,
  pulsingRibbonsCount: 4,
  pulsingRibbonsWidth: 0.05,
  electricArcEnabled: false,
  electricArcOpacity: 1,
  electricArcRadius: 0.4,
  electricArcChaos: 3,
  pyroBurstEnabled: false,
  pyroBurstOpacity: 1,
  pyroBurstForce: 1,
  geoWireframeEnabled: false,
  geoWireframeOpacity: 1,
  geoWireframeShape: 0,
  geoWireframeScale: 0.5,
  signalNoiseEnabled: false,
  signalNoiseOpacity: 1,
  signalNoiseAmount: 1,
  wormholeEnabled: false,
  wormholeOpacity: 1,
  wormholeSpeed: 1,
  wormholeWeave: 0.3,
  wormholeIter: 4,
  ribbonTunnelEnabled: false,
  ribbonTunnelOpacity: 1,
  ribbonTunnelSpeed: 1,
  ribbonTunnelTwist: 2,
  fractalTunnelEnabled: false,
  fractalTunnelOpacity: 1,
  fractalTunnelSpeed: 1,
  fractalTunnelComplexity: 3,
  circuitConduitEnabled: false,
  circuitConduitOpacity: 1,
  circuitConduitSpeed: 1,
  auraPortalEnabled: false,
  auraPortalOpacity: 1,
  auraPortalColor: 0,
  freqTerrainEnabled: false,
  freqTerrainOpacity: 1,
  freqTerrainScale: 1,
  dataStreamEnabled: false,
  dataStreamOpacity: 1,
  dataStreamSpeed: 1,
  causticLiquidEnabled: false,
  causticLiquidOpacity: 1,
  causticLiquidSpeed: 1,
  shimmerVeilEnabled: false,
  shimmerVeilOpacity: 1,
  shimmerVeilComplexity: 5,
  // New 31 Generators
  nebulaCloudEnabled: false,
  nebulaCloudOpacity: 1,
  nebulaCloudDensity: 3,
  nebulaCloudSpeed: 0.5,
  circuitBoardEnabled: false,
  circuitBoardOpacity: 1,
  circuitBoardGrowth: 1,
  circuitBoardComplexity: 10,
  lorenzAttractorEnabled: false,
  lorenzAttractorOpacity: 1,
  lorenzAttractorSpeed: 1,
  lorenzAttractorChaos: 1,
  mandalaSpinnerEnabled: false,
  mandalaSpinnerOpacity: 1,
  mandalaSpinnerSides: 6,
  mandalaSpinnerSpeed: 1,
  starburstGalaxyEnabled: false,
  starburstGalaxyOpacity: 1,
  starburstGalaxyForce: 1,
  starburstGalaxyCount: 100,
  digitalRainV2Enabled: false,
  digitalRainV2Opacity: 1,
  digitalRainV2Speed: 1,
  digitalRainV2Density: 1,
  lavaFlowEnabled: false,
  lavaFlowOpacity: 1,
  lavaFlowHeat: 1,
  lavaFlowViscosity: 1,
  crystalGrowthEnabled: false,
  crystalGrowthOpacity: 1,
  crystalGrowthRate: 1,
  crystalGrowthSharpness: 1,
  technoGridEnabled: false,
  technoGridOpacity: 1,
  technoGridHeight: 1,
  technoGridSpeed: 1,
  magneticFieldEnabled: false,
  magneticFieldOpacity: 1,
  magneticFieldStrength: 1,
  magneticFieldDensity: 1,
  prismShardsEnabled: false,
  prismShardsOpacity: 1,
  prismShardsRefraction: 1,
  prismShardsCount: 5,
  neuralNetEnabled: false,
  neuralNetOpacity: 1,
  neuralNetActivity: 1,
  neuralNetDensity: 1,
  auroraChordEnabled: false,
  auroraChordOpacity: 1,
  auroraChordWaviness: 1,
  auroraChordColorRange: 1,
  vhsGlitchEnabled: false,
  vhsGlitchOpacity: 1,
  vhsGlitchJitter: 1,
  vhsGlitchNoise: 1,
  moirePatternEnabled: false,
  moirePatternOpacity: 1,
  moirePatternScale: 1,
  moirePatternSpeed: 1,
  hypercubeEnabled: false,
  hypercubeOpacity: 1,
  hypercubeProjection: 1,
  hypercubeSpeed: 1,
  fluidSwirlEnabled: false,
  fluidSwirlOpacity: 1,
  fluidSwirlVorticity: 1,
  fluidSwirlColorMix: 0.5,
  asciiStreamEnabled: false,
  asciiStreamOpacity: 1,
  asciiStreamResolution: 1,
  asciiStreamContrast: 1,
  retroWaveEnabled: false,
  retroWaveOpacity: 1,
  retroWaveSunSize: 0.3,
  retroWaveGridSpeed: 1,
  bubblePopEnabled: false,
  bubblePopOpacity: 1,
  bubblePopPopRate: 1,
  bubblePopSize: 0.05,
  soundWave3DEnabled: false,
  soundWave3DOpacity: 1,
  soundWave3DAmplitude: 1,
  soundWave3DSmoothness: 0.5,
  particleVortexEnabled: false,
  particleVortexOpacity: 1,
  particleVortexSuction: 1,
  particleVortexSpin: 1,
  glowWormsEnabled: false,
  glowWormsOpacity: 1,
  glowWormsLength: 1,
  glowWormsSpeed: 1,
  mirrorMazeEnabled: false,
  mirrorMazeOpacity: 1,
  mirrorMazeRecursion: 3,
  mirrorMazeAngle: 0.5,
  pulseHeartEnabled: false,
  pulseHeartOpacity: 1,
  pulseHeartBeats: 1,
  pulseHeartLayers: 3,
  dataShardsEnabled: false,
  dataShardsOpacity: 1,
  dataShardsSpeed: 1,
  dataShardsSharpness: 1,
  hexCellEnabled: false,
  hexCellOpacity: 1,
  hexCellPulse: 1,
  hexCellScale: 1,
  plasmaBallEnabled: false,
  plasmaBallOpacity: 1,
  plasmaBallVoltage: 1,
  plasmaBallFilaments: 5,
  warpDriveEnabled: false,
  warpDriveOpacity: 1,
  warpDriveWarp: 1,
  warpDriveGlow: 0.5,
  visualFeedbackEnabled: false,
  visualFeedbackOpacity: 1,
  visualFeedbackZoom: 1,
  visualFeedbackRotation: 0,
  myceliumGrowthEnabled: false,
  myceliumGrowthOpacity: 1,
  myceliumGrowthSpread: 1,
  myceliumGrowthDecay: 0.5
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
  // Rock Generators
  if (typeof data.lightningEnabled === 'boolean') state.lightningEnabled = data.lightningEnabled;
  if (typeof data.lightningOpacity === 'number') state.lightningOpacity = data.lightningOpacity;
  if (typeof data.lightningSpeed === 'number') state.lightningSpeed = data.lightningSpeed;
  if (typeof data.lightningBranches === 'number') state.lightningBranches = data.lightningBranches;
  if (typeof data.lightningThickness === 'number') state.lightningThickness = data.lightningThickness;
  if (typeof data.lightningColor === 'number') state.lightningColor = data.lightningColor;
  if (typeof data.analogOscilloEnabled === 'boolean') state.analogOscilloEnabled = data.analogOscilloEnabled;
  if (typeof data.analogOscilloOpacity === 'number') state.analogOscilloOpacity = data.analogOscilloOpacity;
  if (typeof data.analogOscilloThickness === 'number') state.analogOscilloThickness = data.analogOscilloThickness;
  if (typeof data.analogOscilloGlow === 'number') state.analogOscilloGlow = data.analogOscilloGlow;
  if (typeof data.analogOscilloColor === 'number') state.analogOscilloColor = data.analogOscilloColor;
  if (typeof data.analogOscilloMode === 'number') state.analogOscilloMode = data.analogOscilloMode;
  if (typeof data.speakerConeEnabled === 'boolean') state.speakerConeEnabled = data.speakerConeEnabled;
  if (typeof data.speakerConeOpacity === 'number') state.speakerConeOpacity = data.speakerConeOpacity;
  if (typeof data.speakerConeForce === 'number') state.speakerConeForce = data.speakerConeForce;
  if (typeof data.glitchScanlineEnabled === 'boolean') state.glitchScanlineEnabled = data.glitchScanlineEnabled;
  if (typeof data.glitchScanlineOpacity === 'number') state.glitchScanlineOpacity = data.glitchScanlineOpacity;
  if (typeof data.glitchScanlineSpeed === 'number') state.glitchScanlineSpeed = data.glitchScanlineSpeed;
  if (typeof data.glitchScanlineCount === 'number') state.glitchScanlineCount = data.glitchScanlineCount;
  if (typeof data.laserStarfieldEnabled === 'boolean') state.laserStarfieldEnabled = data.laserStarfieldEnabled;
  if (typeof data.laserStarfieldOpacity === 'number') state.laserStarfieldOpacity = data.laserStarfieldOpacity;
  if (typeof data.laserStarfieldSpeed === 'number') state.laserStarfieldSpeed = data.laserStarfieldSpeed;
  if (typeof data.laserStarfieldDensity === 'number') state.laserStarfieldDensity = data.laserStarfieldDensity;
  if (typeof data.pulsingRibbonsEnabled === 'boolean') state.pulsingRibbonsEnabled = data.pulsingRibbonsEnabled;
  if (typeof data.pulsingRibbonsOpacity === 'number') state.pulsingRibbonsOpacity = data.pulsingRibbonsOpacity;
  if (typeof data.pulsingRibbonsCount === 'number') state.pulsingRibbonsCount = data.pulsingRibbonsCount;
  if (typeof data.pulsingRibbonsWidth === 'number') state.pulsingRibbonsWidth = data.pulsingRibbonsWidth;
  if (typeof data.electricArcEnabled === 'boolean') state.electricArcEnabled = data.electricArcEnabled;
  if (typeof data.electricArcOpacity === 'number') state.electricArcOpacity = data.electricArcOpacity;
  if (typeof data.electricArcRadius === 'number') state.electricArcRadius = data.electricArcRadius;
  if (typeof data.electricArcChaos === 'number') state.electricArcChaos = data.electricArcChaos;
  if (typeof data.pyroBurstEnabled === 'boolean') state.pyroBurstEnabled = data.pyroBurstEnabled;
  if (typeof data.pyroBurstOpacity === 'number') state.pyroBurstOpacity = data.pyroBurstOpacity;
  if (typeof data.pyroBurstForce === 'number') state.pyroBurstForce = data.pyroBurstForce;
  if (typeof data.geoWireframeEnabled === 'boolean') state.geoWireframeEnabled = data.geoWireframeEnabled;
  if (typeof data.geoWireframeOpacity === 'number') state.geoWireframeOpacity = data.geoWireframeOpacity;
  if (typeof data.geoWireframeShape === 'number') state.geoWireframeShape = data.geoWireframeShape;
  if (typeof data.geoWireframeScale === 'number') state.geoWireframeScale = data.geoWireframeScale;
  if (typeof data.signalNoiseEnabled === 'boolean') state.signalNoiseEnabled = data.signalNoiseEnabled;
  if (typeof data.signalNoiseOpacity === 'number') state.signalNoiseOpacity = data.signalNoiseOpacity;
  if (typeof data.signalNoiseAmount === 'number') state.signalNoiseAmount = data.signalNoiseAmount;
  if (typeof data.wormholeEnabled === 'boolean') state.wormholeEnabled = data.wormholeEnabled;
  if (typeof data.wormholeOpacity === 'number') state.wormholeOpacity = data.wormholeOpacity;
  if (typeof data.wormholeSpeed === 'number') state.wormholeSpeed = data.wormholeSpeed;
  if (typeof data.wormholeWeave === 'number') state.wormholeWeave = data.wormholeWeave;
  if (typeof data.wormholeIter === 'number') state.wormholeIter = data.wormholeIter;
  if (typeof data.ribbonTunnelEnabled === 'boolean') state.ribbonTunnelEnabled = data.ribbonTunnelEnabled;
  if (typeof data.ribbonTunnelOpacity === 'number') state.ribbonTunnelOpacity = data.ribbonTunnelOpacity;
  if (typeof data.ribbonTunnelSpeed === 'number') state.ribbonTunnelSpeed = data.ribbonTunnelSpeed;
  if (typeof data.ribbonTunnelTwist === 'number') state.ribbonTunnelTwist = data.ribbonTunnelTwist;
  if (typeof data.fractalTunnelEnabled === 'boolean') state.fractalTunnelEnabled = data.fractalTunnelEnabled;
  if (typeof data.fractalTunnelOpacity === 'number') state.fractalTunnelOpacity = data.fractalTunnelOpacity;
  if (typeof data.fractalTunnelSpeed === 'number') state.fractalTunnelSpeed = data.fractalTunnelSpeed;
  if (typeof data.fractalTunnelComplexity === 'number') state.fractalTunnelComplexity = data.fractalTunnelComplexity;
  if (typeof data.circuitConduitEnabled === 'boolean') state.circuitConduitEnabled = data.circuitConduitEnabled;
  if (typeof data.circuitConduitOpacity === 'number') state.circuitConduitOpacity = data.circuitConduitOpacity;
  if (typeof data.circuitConduitSpeed === 'number') state.circuitConduitSpeed = data.circuitConduitSpeed;
  if (typeof data.auraPortalEnabled === 'boolean') state.auraPortalEnabled = data.auraPortalEnabled;
  if (typeof data.auraPortalOpacity === 'number') state.auraPortalOpacity = data.auraPortalOpacity;
  if (typeof data.auraPortalColor === 'number') state.auraPortalColor = data.auraPortalColor;
  if (typeof data.freqTerrainEnabled === 'boolean') state.freqTerrainEnabled = data.freqTerrainEnabled;
  if (typeof data.freqTerrainOpacity === 'number') state.freqTerrainOpacity = data.freqTerrainOpacity;
  if (typeof data.freqTerrainScale === 'number') state.freqTerrainScale = data.freqTerrainScale;
  if (typeof data.dataStreamEnabled === 'boolean') state.dataStreamEnabled = data.dataStreamEnabled;
  if (typeof data.dataStreamOpacity === 'number') state.dataStreamOpacity = data.dataStreamOpacity;
  if (typeof data.dataStreamSpeed === 'number') state.dataStreamSpeed = data.dataStreamSpeed;
  if (typeof data.causticLiquidEnabled === 'boolean') state.causticLiquidEnabled = data.causticLiquidEnabled;
  if (typeof data.causticLiquidOpacity === 'number') state.causticLiquidOpacity = data.causticLiquidOpacity;
  if (typeof data.causticLiquidSpeed === 'number') state.causticLiquidSpeed = data.causticLiquidSpeed;
  if (typeof data.shimmerVeilEnabled === 'boolean') state.shimmerVeilEnabled = data.shimmerVeilEnabled;
  if (typeof data.shimmerVeilOpacity === 'number') state.shimmerVeilOpacity = data.shimmerVeilOpacity;
  if (typeof data.shimmerVeilComplexity === 'number') state.shimmerVeilComplexity = data.shimmerVeilComplexity;
  // New 31 Generators
  if (typeof data.nebulaCloudEnabled === 'boolean') state.nebulaCloudEnabled = data.nebulaCloudEnabled;
  if (typeof data.nebulaCloudOpacity === 'number') state.nebulaCloudOpacity = data.nebulaCloudOpacity;
  if (typeof data.nebulaCloudDensity === 'number') state.nebulaCloudDensity = data.nebulaCloudDensity;
  if (typeof data.nebulaCloudSpeed === 'number') state.nebulaCloudSpeed = data.nebulaCloudSpeed;
  if (typeof data.circuitBoardEnabled === 'boolean') state.circuitBoardEnabled = data.circuitBoardEnabled;
  if (typeof data.circuitBoardOpacity === 'number') state.circuitBoardOpacity = data.circuitBoardOpacity;
  if (typeof data.circuitBoardGrowth === 'number') state.circuitBoardGrowth = data.circuitBoardGrowth;
  if (typeof data.circuitBoardComplexity === 'number') state.circuitBoardComplexity = data.circuitBoardComplexity;
  if (typeof data.lorenzAttractorEnabled === 'boolean') state.lorenzAttractorEnabled = data.lorenzAttractorEnabled;
  if (typeof data.lorenzAttractorOpacity === 'number') state.lorenzAttractorOpacity = data.lorenzAttractorOpacity;
  if (typeof data.lorenzAttractorSpeed === 'number') state.lorenzAttractorSpeed = data.lorenzAttractorSpeed;
  if (typeof data.lorenzAttractorChaos === 'number') state.lorenzAttractorChaos = data.lorenzAttractorChaos;
  if (typeof data.mandalaSpinnerEnabled === 'boolean') state.mandalaSpinnerEnabled = data.mandalaSpinnerEnabled;
  if (typeof data.mandalaSpinnerOpacity === 'number') state.mandalaSpinnerOpacity = data.mandalaSpinnerOpacity;
  if (typeof data.mandalaSpinnerSides === 'number') state.mandalaSpinnerSides = data.mandalaSpinnerSides;
  if (typeof data.mandalaSpinnerSpeed === 'number') state.mandalaSpinnerSpeed = data.mandalaSpinnerSpeed;
  if (typeof data.starburstGalaxyEnabled === 'boolean') state.starburstGalaxyEnabled = data.starburstGalaxyEnabled;
  if (typeof data.starburstGalaxyOpacity === 'number') state.starburstGalaxyOpacity = data.starburstGalaxyOpacity;
  if (typeof data.starburstGalaxyForce === 'number') state.starburstGalaxyForce = data.starburstGalaxyForce;
  if (typeof data.starburstGalaxyCount === 'number') state.starburstGalaxyCount = data.starburstGalaxyCount;
  if (typeof data.digitalRainV2Enabled === 'boolean') state.digitalRainV2Enabled = data.digitalRainV2Enabled;
  if (typeof data.digitalRainV2Opacity === 'number') state.digitalRainV2Opacity = data.digitalRainV2Opacity;
  if (typeof data.digitalRainV2Speed === 'number') state.digitalRainV2Speed = data.digitalRainV2Speed;
  if (typeof data.digitalRainV2Density === 'number') state.digitalRainV2Density = data.digitalRainV2Density;
  if (typeof data.lavaFlowEnabled === 'boolean') state.lavaFlowEnabled = data.lavaFlowEnabled;
  if (typeof data.lavaFlowOpacity === 'number') state.lavaFlowOpacity = data.lavaFlowOpacity;
  if (typeof data.lavaFlowHeat === 'number') state.lavaFlowHeat = data.lavaFlowHeat;
  if (typeof data.lavaFlowViscosity === 'number') state.lavaFlowViscosity = data.lavaFlowViscosity;
  if (typeof data.crystalGrowthEnabled === 'boolean') state.crystalGrowthEnabled = data.crystalGrowthEnabled;
  if (typeof data.crystalGrowthOpacity === 'number') state.crystalGrowthOpacity = data.crystalGrowthOpacity;
  if (typeof data.crystalGrowthRate === 'number') state.crystalGrowthRate = data.crystalGrowthRate;
  if (typeof data.crystalGrowthSharpness === 'number') state.crystalGrowthSharpness = data.crystalGrowthSharpness;
  if (typeof data.technoGridEnabled === 'boolean') state.technoGridEnabled = data.technoGridEnabled;
  if (typeof data.technoGridOpacity === 'number') state.technoGridOpacity = data.technoGridOpacity;
  if (typeof data.technoGridHeight === 'number') state.technoGridHeight = data.technoGridHeight;
  if (typeof data.technoGridSpeed === 'number') state.technoGridSpeed = data.technoGridSpeed;
  if (typeof data.magneticFieldEnabled === 'boolean') state.magneticFieldEnabled = data.magneticFieldEnabled;
  if (typeof data.magneticFieldOpacity === 'number') state.magneticFieldOpacity = data.magneticFieldOpacity;
  if (typeof data.magneticFieldStrength === 'number') state.magneticFieldStrength = data.magneticFieldStrength;
  if (typeof data.magneticFieldDensity === 'number') state.magneticFieldDensity = data.magneticFieldDensity;
  if (typeof data.prismShardsEnabled === 'boolean') state.prismShardsEnabled = data.prismShardsEnabled;
  if (typeof data.prismShardsOpacity === 'number') state.prismShardsOpacity = data.prismShardsOpacity;
  if (typeof data.prismShardsRefraction === 'number') state.prismShardsRefraction = data.prismShardsRefraction;
  if (typeof data.prismShardsCount === 'number') state.prismShardsCount = data.prismShardsCount;
  if (typeof data.neuralNetEnabled === 'boolean') state.neuralNetEnabled = data.neuralNetEnabled;
  if (typeof data.neuralNetOpacity === 'number') state.neuralNetOpacity = data.neuralNetOpacity;
  if (typeof data.neuralNetActivity === 'number') state.neuralNetActivity = data.neuralNetActivity;
  if (typeof data.neuralNetDensity === 'number') state.neuralNetDensity = data.neuralNetDensity;
  if (typeof data.auroraChordEnabled === 'boolean') state.auroraChordEnabled = data.auroraChordEnabled;
  if (typeof data.auroraChordOpacity === 'number') state.auroraChordOpacity = data.auroraChordOpacity;
  if (typeof data.auroraChordWaviness === 'number') state.auroraChordWaviness = data.auroraChordWaviness;
  if (typeof data.auroraChordColorRange === 'number') state.auroraChordColorRange = data.auroraChordColorRange;
  if (typeof data.vhsGlitchEnabled === 'boolean') state.vhsGlitchEnabled = data.vhsGlitchEnabled;
  if (typeof data.vhsGlitchOpacity === 'number') state.vhsGlitchOpacity = data.vhsGlitchOpacity;
  if (typeof data.vhsGlitchJitter === 'number') state.vhsGlitchJitter = data.vhsGlitchJitter;
  if (typeof data.vhsGlitchNoise === 'number') state.vhsGlitchNoise = data.vhsGlitchNoise;
  if (typeof data.moirePatternEnabled === 'boolean') state.moirePatternEnabled = data.moirePatternEnabled;
  if (typeof data.moirePatternOpacity === 'number') state.moirePatternOpacity = data.moirePatternOpacity;
  if (typeof data.moirePatternScale === 'number') state.moirePatternScale = data.moirePatternScale;
  if (typeof data.moirePatternSpeed === 'number') state.moirePatternSpeed = data.moirePatternSpeed;
  if (typeof data.hypercubeEnabled === 'boolean') state.hypercubeEnabled = data.hypercubeEnabled;
  if (typeof data.hypercubeOpacity === 'number') state.hypercubeOpacity = data.hypercubeOpacity;
  if (typeof data.hypercubeProjection === 'number') state.hypercubeProjection = data.hypercubeProjection;
  if (typeof data.hypercubeSpeed === 'number') state.hypercubeSpeed = data.hypercubeSpeed;
  if (typeof data.fluidSwirlEnabled === 'boolean') state.fluidSwirlEnabled = data.fluidSwirlEnabled;
  if (typeof data.fluidSwirlOpacity === 'number') state.fluidSwirlOpacity = data.fluidSwirlOpacity;
  if (typeof data.fluidSwirlVorticity === 'number') state.fluidSwirlVorticity = data.fluidSwirlVorticity;
  if (typeof data.fluidSwirlColorMix === 'number') state.fluidSwirlColorMix = data.fluidSwirlColorMix;
  if (typeof data.asciiStreamEnabled === 'boolean') state.asciiStreamEnabled = data.asciiStreamEnabled;
  if (typeof data.asciiStreamOpacity === 'number') state.asciiStreamOpacity = data.asciiStreamOpacity;
  if (typeof data.asciiStreamResolution === 'number') state.asciiStreamResolution = data.asciiStreamResolution;
  if (typeof data.asciiStreamContrast === 'number') state.asciiStreamContrast = data.asciiStreamContrast;
  if (typeof data.retroWaveEnabled === 'boolean') state.retroWaveEnabled = data.retroWaveEnabled;
  if (typeof data.retroWaveOpacity === 'number') state.retroWaveOpacity = data.retroWaveOpacity;
  if (typeof data.retroWaveSunSize === 'number') state.retroWaveSunSize = data.retroWaveSunSize;
  if (typeof data.retroWaveGridSpeed === 'number') state.retroWaveGridSpeed = data.retroWaveGridSpeed;
  if (typeof data.bubblePopEnabled === 'boolean') state.bubblePopEnabled = data.bubblePopEnabled;
  if (typeof data.bubblePopOpacity === 'number') state.bubblePopOpacity = data.bubblePopOpacity;
  if (typeof data.bubblePopPopRate === 'number') state.bubblePopPopRate = data.bubblePopPopRate;
  if (typeof data.bubblePopSize === 'number') state.bubblePopSize = data.bubblePopSize;
  if (typeof data.soundWave3DEnabled === 'boolean') state.soundWave3DEnabled = data.soundWave3DEnabled;
  if (typeof data.soundWave3DOpacity === 'number') state.soundWave3DOpacity = data.soundWave3DOpacity;
  if (typeof data.soundWave3DAmplitude === 'number') state.soundWave3DAmplitude = data.soundWave3DAmplitude;
  if (typeof data.soundWave3DSmoothness === 'number') state.soundWave3DSmoothness = data.soundWave3DSmoothness;
  if (typeof data.particleVortexEnabled === 'boolean') state.particleVortexEnabled = data.particleVortexEnabled;
  if (typeof data.particleVortexOpacity === 'number') state.particleVortexOpacity = data.particleVortexOpacity;
  if (typeof data.particleVortexSuction === 'number') state.particleVortexSuction = data.particleVortexSuction;
  if (typeof data.particleVortexSpin === 'number') state.particleVortexSpin = data.particleVortexSpin;
  if (typeof data.glowWormsEnabled === 'boolean') state.glowWormsEnabled = data.glowWormsEnabled;
  if (typeof data.glowWormsOpacity === 'number') state.glowWormsOpacity = data.glowWormsOpacity;
  if (typeof data.glowWormsLength === 'number') state.glowWormsLength = data.glowWormsLength;
  if (typeof data.glowWormsSpeed === 'number') state.glowWormsSpeed = data.glowWormsSpeed;
  if (typeof data.mirrorMazeEnabled === 'boolean') state.mirrorMazeEnabled = data.mirrorMazeEnabled;
  if (typeof data.mirrorMazeOpacity === 'number') state.mirrorMazeOpacity = data.mirrorMazeOpacity;
  if (typeof data.mirrorMazeRecursion === 'number') state.mirrorMazeRecursion = data.mirrorMazeRecursion;
  if (typeof data.mirrorMazeAngle === 'number') state.mirrorMazeAngle = data.mirrorMazeAngle;
  if (typeof data.pulseHeartEnabled === 'boolean') state.pulseHeartEnabled = data.pulseHeartEnabled;
  if (typeof data.pulseHeartOpacity === 'number') state.pulseHeartOpacity = data.pulseHeartOpacity;
  if (typeof data.pulseHeartBeats === 'number') state.pulseHeartBeats = data.pulseHeartBeats;
  if (typeof data.pulseHeartLayers === 'number') state.pulseHeartLayers = data.pulseHeartLayers;
  if (typeof data.dataShardsEnabled === 'boolean') state.dataShardsEnabled = data.dataShardsEnabled;
  if (typeof data.dataShardsOpacity === 'number') state.dataShardsOpacity = data.dataShardsOpacity;
  if (typeof data.dataShardsSpeed === 'number') state.dataShardsSpeed = data.dataShardsSpeed;
  if (typeof data.dataShardsSharpness === 'number') state.dataShardsSharpness = data.dataShardsSharpness;
  if (typeof data.hexCellEnabled === 'boolean') state.hexCellEnabled = data.hexCellEnabled;
  if (typeof data.hexCellOpacity === 'number') state.hexCellOpacity = data.hexCellOpacity;
  if (typeof data.hexCellPulse === 'number') state.hexCellPulse = data.hexCellPulse;
  if (typeof data.hexCellScale === 'number') state.hexCellScale = data.hexCellScale;
  if (typeof data.plasmaBallEnabled === 'boolean') state.plasmaBallEnabled = data.plasmaBallEnabled;
  if (typeof data.plasmaBallOpacity === 'number') state.plasmaBallOpacity = data.plasmaBallOpacity;
  if (typeof data.plasmaBallVoltage === 'number') state.plasmaBallVoltage = data.plasmaBallVoltage;
  if (typeof data.plasmaBallFilaments === 'number') state.plasmaBallFilaments = data.plasmaBallFilaments;
  if (typeof data.warpDriveEnabled === 'boolean') state.warpDriveEnabled = data.warpDriveEnabled;
  if (typeof data.warpDriveOpacity === 'number') state.warpDriveOpacity = data.warpDriveOpacity;
  if (typeof data.warpDriveWarp === 'number') state.warpDriveWarp = data.warpDriveWarp;
  if (typeof data.warpDriveGlow === 'number') state.warpDriveGlow = data.warpDriveGlow;
  if (typeof data.visualFeedbackEnabled === 'boolean') state.visualFeedbackEnabled = data.visualFeedbackEnabled;
  if (typeof data.visualFeedbackOpacity === 'number') state.visualFeedbackOpacity = data.visualFeedbackOpacity;
  if (typeof data.visualFeedbackZoom === 'number') state.visualFeedbackZoom = data.visualFeedbackZoom;
  if (typeof data.visualFeedbackRotation === 'number') state.visualFeedbackRotation = data.visualFeedbackRotation;
  if (typeof (data as any).myceliumGrowthEnabled === 'boolean') (state as any).myceliumGrowthEnabled = (data as any).myceliumGrowthEnabled;
  if (typeof (data as any).myceliumGrowthOpacity === 'number') (state as any).myceliumGrowthOpacity = (data as any).myceliumGrowthOpacity;
  if (typeof (data as any).myceliumGrowthSpread === 'number') (state as any).myceliumGrowthSpread = (data as any).myceliumGrowthSpread;
  if (typeof (data as any).myceliumGrowthDecay === 'number') (state as any).myceliumGrowthDecay = (data as any).myceliumGrowthDecay;
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
