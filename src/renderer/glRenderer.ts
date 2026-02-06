import { toFileUrl } from '../shared/fileUrl';
import type { AssetItem } from '../shared/project';
import type { AssetTextureSampling } from '../shared/assets';
import { buildSdfShader } from './sdf/compile/glslBuilder';

export interface RenderState {
  timeMs: number;
  rms: number;
  peak: number;
  strobe: number;
  plasmaEnabled: boolean;
  spectrumEnabled: boolean;
  origamiEnabled: boolean;
  glyphEnabled: boolean;
  crystalEnabled: boolean;
  inkEnabled: boolean;
  topoEnabled: boolean;
  weatherEnabled: boolean;
  portalEnabled: boolean;
  mediaEnabled: boolean;
  oscilloEnabled: boolean;
  spectrum: Float32Array;
  contrast: number;
  saturation: number;
  paletteShift: number;
  plasmaOpacity: number;
  plasmaSpeed: number;
  plasmaScale: number;
  plasmaComplexity: number;
  plasmaAudioReact: number;
  spectrumEnabled: boolean;
  origamiOpacity: number;
  origamiFoldState: number;
  origamiFoldSharpness: number;
  glyphOpacity: number;
  glyphMode: number;
  glyphSeed: number;
  glyphBeat: number;
  glyphSpeed: number;
  crystalOpacity: number;
  crystalMode: number;
  crystalBrittleness: number;
  crystalScale: number;
  crystalSpeed: number;
  inkOpacity: number;
  inkBrush: number;
  inkPressure: number;
  inkLifespan: number;
  inkSpeed: number;
  inkScale: number;
  topoOpacity: number;
  topoQuake: number;
  topoSlide: number;
  topoPlate: number;
  topoTravel: number;
  topoScale: number;
  topoElevation: number;
  weatherOpacity: number;
  weatherMode: number;
  weatherIntensity: number;
  weatherSpeed: number;
  portalOpacity: number;
  portalShift: number;
  portalStyle: number;
  portalPositions: Float32Array;
  portalRadii: Float32Array;
  portalActives: Float32Array;
  mediaOpacity: number;
  mediaBurstPositions: Float32Array;
  mediaBurstRadii: Float32Array;
  mediaBurstTypes: Float32Array;
  mediaBurstActives: Float32Array;
  oscilloOpacity: number;
  oscilloMode: number;
  oscilloFreeze: number;
  oscilloRotate: number;
  oscilloData: Float32Array;
  modulatorValues: Float32Array;
  midiData: Float32Array;
  plasmaAssetBlendMode: number;
  plasmaAssetAudioReact: number;
  spectrumAssetBlendMode: number;
  spectrumAssetAudioReact: number;
  mediaAssetBlendMode: number;
  mediaAssetAudioReact: number;
  effectsEnabled: boolean;
  bloom: number;
  blur: number;
  chroma: number;
  posterize: number;
  kaleidoscope: number;
  kaleidoscopeRotation: number;
  feedback: number;
  persistence: number;
  trailSpectrum: Float32Array;
  expressiveEnergyBloom: number;
  expressiveEnergyThreshold: number;
  expressiveEnergyAccumulation: number;
  expressiveRadialGravity: number;
  expressiveRadialStrength: number;
  expressiveRadialRadius: number;
  expressiveRadialFocusX: number;
  expressiveRadialFocusY: number;
  expressiveMotionEcho: number;
  expressiveMotionEchoDecay: number;
  expressiveMotionEchoWarp: number;
  expressiveSpectralSmear: number;
  expressiveSpectralOffset: number;
  expressiveSpectralMix: number;
  particlesEnabled: boolean;
  particleDensity: number;
  particleSpeed: number;
  particleSize: number;
  particleGlow: number;
  particleTurbulence: number;
  particleAudioLift: number;
  sdfEnabled: boolean;
  sdfShape: number;
  sdfScale: number;
  sdfEdge: number;
  sdfGlow: number;
  sdfRotation: number;
  sdfFill: number;
  sdfColor?: [number, number, number];
  globalColor?: [number, number, number];
  hasInternalAsset?: boolean;
  sdfScene?: any; // Config for Advanced mode
  feedbackZoom: number;
  feedbackRotation: number;
  gravityPositions: Float32Array;
  gravityStrengths: Float32Array;
  gravityPolarities: Float32Array;
  gravityActives: Float32Array;
  gravityCollapse: number;
  debugTint?: number;
  origamiSpeed: number;
  roleWeights: {
    core: number;
    support: number;
    atmosphere: number;
  };
  transitionAmount: number;
  transitionType: number; // 0: none, 1: fade, 2: warp, 3: glitch, 4: dissolve
  chemistryMode: number; // 0: analog, 1: triadic, 2: complementary, 3: monochromatic
  motionTemplate: number;
  engineMass: number;
  engineFriction: number;
  engineElasticity: number;
  maxBloom: number;
  forceFeedback: boolean;
  engineGrain: number;
  engineVignette: number;
  engineCA: number;
  engineSignature: number;
  // EDM Generators
  laserEnabled: boolean;
  laserOpacity: number;
  laserBeamCount: number;
  laserBeamWidth: number;
  laserBeamLength: number;
  laserRotation: number;
  laserRotationSpeed: number;
  laserSpread: number;
  laserMode: number;
  laserColorShift: number;
  laserAudioReact: number;
  laserGlow: number;
  strobeEnabled: boolean;
  strobeOpacity: number;
  strobeRate: number;
  strobeDutyCycle: number;
  strobeMode: number;
  strobeAudioTrigger: boolean;
  strobeThreshold: number;
  strobeFadeOut: number;
  strobePattern: number;
  shapeBurstEnabled: boolean;
  shapeBurstOpacity: number;
  shapeBurstShape: number;
  shapeBurstExpandSpeed: number;
  shapeBurstStartSize: number;
  shapeBurstMaxSize: number;
  shapeBurstThickness: number;
  shapeBurstFadeMode: number;
  shapeBurstSpawnTimes: Float32Array;
  shapeBurstActives: Float32Array;
  gridTunnelEnabled: boolean;
  gridTunnelOpacity: number;
  gridTunnelSpeed: number;
  gridTunnelGridSize: number;
  gridTunnelLineWidth: number;
  gridTunnelPerspective: number;
  gridTunnelHorizonY: number;
  gridTunnelGlow: number;
  gridTunnelAudioReact: number;
  gridTunnelMode: number;
  // Rock Generators
  lightningEnabled: boolean;
  lightningOpacity: number;
  lightningSpeed: number;
  lightningBranches: number;
  lightningThickness: number;
  lightningColor: number;
  analogOscilloEnabled: boolean;
  analogOscilloOpacity: number;
  analogOscilloThickness: number;
  analogOscilloGlow: number;
  analogOscilloColor: number;
  analogOscilloMode: number;
  speakerConeEnabled: boolean;
  speakerConeOpacity: number;
  speakerConeForce: number;
  glitchScanlineEnabled: boolean;
  glitchScanlineOpacity: number;
  glitchScanlineSpeed: number;
  glitchScanlineCount: number;
  laserStarfieldEnabled: boolean;
  laserStarfieldOpacity: number;
  laserStarfieldSpeed: number;
  laserStarfieldDensity: number;
  pulsingRibbonsEnabled: boolean;
  pulsingRibbonsOpacity: number;
  pulsingRibbonsCount: number;
  pulsingRibbonsWidth: number;
  electricArcEnabled: boolean;
  electricArcOpacity: number;
  electricArcRadius: number;
  electricArcChaos: number;
  pyroBurstEnabled: boolean;
  pyroBurstOpacity: number;
  pyroBurstForce: number;
  geoWireframeEnabled: boolean;
  geoWireframeOpacity: number;
  geoWireframeShape: number;
  geoWireframeScale: number;
  signalNoiseEnabled: boolean;
  signalNoiseOpacity: number;
  signalNoiseAmount: number;
  wormholeEnabled: boolean;
  wormholeOpacity: number;
  wormholeSpeed: number;
  wormholeWeave: number;
  wormholeIter: number;
  ribbonTunnelEnabled: boolean;
  ribbonTunnelOpacity: number;
  ribbonTunnelSpeed: number;
  ribbonTunnelTwist: number;
  fractalTunnelEnabled: boolean;
  fractalTunnelOpacity: number;
  fractalTunnelSpeed: number;
  fractalTunnelComplexity: number;
  circuitConduitEnabled: boolean;
  circuitConduitOpacity: number;
  circuitConduitSpeed: number;
  auraPortalEnabled: boolean;
  auraPortalOpacity: number;
  auraPortalColor: number;
  freqTerrainEnabled: boolean;
  freqTerrainOpacity: number;
  freqTerrainScale: number;
  dataStreamEnabled: boolean;
  dataStreamOpacity: number;
  dataStreamSpeed: number;
  causticLiquidEnabled: boolean;
  causticLiquidOpacity: number;
  causticLiquidSpeed: number;
  shimmerVeilEnabled: boolean;
  shimmerVeilOpacity: number;
  shimmerVeilComplexity: number;
  nebulaCloudEnabled: boolean;
  nebulaCloudOpacity: number;
  nebulaCloudDensity: number;
  nebulaCloudSpeed: number;
  circuitBoardEnabled: boolean;
  circuitBoardOpacity: number;
  circuitBoardGrowth: number;
  circuitBoardComplexity: number;
  lorenzAttractorEnabled: boolean;
  lorenzAttractorOpacity: number;
  lorenzAttractorSpeed: number;
  lorenzAttractorChaos: number;
  mandalaSpinnerEnabled: boolean;
  mandalaSpinnerOpacity: number;
  mandalaSpinnerSides: number;
  mandalaSpinnerSpeed: number;
  starburstGalaxyEnabled: boolean;
  starburstGalaxyOpacity: number;
  starburstGalaxyForce: number;
  starburstGalaxyCount: number;
  digitalRainV2Enabled: boolean;
  digitalRainV2Opacity: number;
  digitalRainV2Speed: number;
  digitalRainV2Density: number;
  lavaFlowEnabled: boolean;
  lavaFlowOpacity: number;
  lavaFlowHeat: number;
  lavaFlowViscosity: number;
  crystalGrowthEnabled: boolean;
  crystalGrowthOpacity: number;
  crystalGrowthRate: number;
  crystalGrowthSharpness: number;
  technoGridEnabled: boolean;
  technoGridOpacity: number;
  technoGridHeight: number;
  technoGridSpeed: number;
  magneticFieldEnabled: boolean;
  magneticFieldOpacity: number;
  magneticFieldStrength: number;
  magneticFieldDensity: number;
  prismShardsEnabled: boolean;
  prismShardsOpacity: number;
  prismShardsRefraction: number;
  prismShardsCount: number;
  neuralNetEnabled: boolean;
  neuralNetOpacity: number;
  neuralNetActivity: number;
  neuralNetDensity: number;
  auroraChordEnabled: boolean;
  auroraChordOpacity: number;
  auroraChordWaviness: number;
  auroraChordColorRange: number;
  vhsGlitchEnabled: boolean;
  vhsGlitchOpacity: number;
  vhsGlitchJitter: number;
  vhsGlitchNoise: number;
  moirePatternEnabled: boolean;
  moirePatternOpacity: number;
  moirePatternScale: number;
  moirePatternSpeed: number;
  hypercubeEnabled: boolean;
  hypercubeOpacity: number;
  hypercubeProjection: number;
  hypercubeSpeed: number;
  fluidSwirlEnabled: boolean;
  fluidSwirlOpacity: number;
  fluidSwirlVorticity: number;
  fluidSwirlColorMix: number;
  asciiStreamEnabled: boolean;
  asciiStreamOpacity: number;
  asciiStreamResolution: number;
  asciiStreamContrast: number;
  retroWaveEnabled: boolean;
  retroWaveOpacity: number;
  retroWaveSunSize: number;
  retroWaveGridSpeed: number;
  bubblePopEnabled: boolean;
  bubblePopOpacity: number;
  bubblePopPopRate: number;
  bubblePopSize: number;
  soundWave3DEnabled: boolean;
  soundWave3DOpacity: number;
  soundWave3DAmplitude: number;
  soundWave3DSmoothness: number;
  particleVortexEnabled: boolean;
  particleVortexOpacity: number;
  particleVortexSuction: number;
  particleVortexSpin: number;
  glowWormsEnabled: boolean;
  glowWormsOpacity: number;
  glowWormsLength: number;
  glowWormsSpeed: number;
  mirrorMazeEnabled: boolean;
  mirrorMazeOpacity: number;
  mirrorMazeRecursion: number;
  mirrorMazeAngle: number;
  pulseHeartEnabled: boolean;
  pulseHeartOpacity: number;
  pulseHeartBeats: number;
  pulseHeartLayers: number;
  dataShardsEnabled: boolean;
  dataShardsOpacity: number;
  dataShardsSpeed: number;
  dataShardsSharpness: number;
  hexCellEnabled: boolean;
  hexCellOpacity: number;
  hexCellPulse: number;
  hexCellScale: number;
  plasmaBallEnabled: boolean;
  plasmaBallOpacity: number;
  plasmaBallVoltage: number;
  plasmaBallFilaments: number;
  warpDriveEnabled: boolean;
  warpDriveOpacity: number;
  warpDriveWarp: number;
  warpDriveGlow: number;
  visualFeedbackEnabled: boolean;
  visualFeedbackOpacity: number;
  visualFeedbackZoom: number;
  visualFeedbackRotation: number;
}

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

  const createFragmentShaderSrc = (
    sdfUniforms = '',
    sdfFunctions = '',
    sdfMapBody = '10.0',
    plasmaSource: string | null = null
  ) => `#version 300 es
precision highp float;

uniform float uTime;
uniform float uAspect;
uniform float uRms;
uniform float uPeak;
uniform float uStrobe;
uniform float uPlasmaEnabled;
uniform float uSpectrumEnabled;
uniform float uOrigamiEnabled;
uniform float uGlyphEnabled;
uniform float uGlyphOpacity;
uniform float uGlyphMode;
uniform float uGlyphSeed;
uniform float uGlyphBeat;
uniform float uGlyphSpeed;
uniform float uCrystalEnabled;
uniform float uCrystalOpacity;
uniform float uCrystalMode;
uniform float uCrystalBrittleness;
uniform float uCrystalScale;
uniform float uCrystalSpeed;
uniform float uInkEnabled;
uniform float uInkOpacity;
uniform float uInkBrush;
uniform float uInkPressure;
uniform float uInkLifespan;
uniform float uInkSpeed;
uniform float uInkScale;
uniform float uTopoEnabled;
uniform float uTopoOpacity;
uniform float uTopoQuake;
uniform float uTopoSlide;
uniform float uTopoPlate;
uniform float uTopoTravel;
uniform float uTopoScale;
uniform float uTopoElevation;
uniform float uWeatherEnabled;
uniform float uWeatherOpacity;
uniform float uWeatherMode;
uniform float uWeatherIntensity;
uniform float uWeatherSpeed;
uniform float uPortalEnabled;
uniform float uPortalOpacity;
uniform float uPortalShift;
uniform float uPortalStyle;
uniform vec2 uPortalPos[4];
uniform float uPortalRadius[4];
uniform float uPortalActive[4];
uniform float uOscilloEnabled;
uniform float uOscilloOpacity;
uniform float uOscilloMode;
uniform float uOscilloFreeze;
uniform float uOscilloRotate;
uniform float uOscillo[256];
uniform vec2 uGravityPos[8];
uniform float uGravityStrength[8];
uniform float uGravityPolarity[8];
uniform float uGravityActive[8];
uniform float uGravityCollapse;
uniform float uSpectrum[64];
uniform float uContrast;
uniform float uSaturation;
uniform float uPaletteShift;
uniform vec3 uPalette[5];
uniform float uPlasmaOpacity;
uniform float uPlasmaSpeed;
uniform float uPlasmaScale;
uniform float uPlasmaComplexity;
uniform float uPlasmaAudioReact;
uniform float uSpectrumOpacity;
uniform float uOrigamiOpacity;
uniform float uOrigamiFoldState;
uniform float uOrigamiFoldSharpness;
uniform float uOrigamiSpeed;
uniform float uEffectsEnabled;
uniform float uBloom;
uniform float uBlur;
uniform float uChroma;
uniform float uPosterize;
uniform float uKaleidoscope;
uniform float uKaleidoscopeRotation;
uniform float uFeedback;
uniform float uFeedbackZoom;
uniform float uFeedbackRotation;
uniform float uPersistence;
uniform float uTrailSpectrum[64];
uniform float uExpressiveEnergyBloom;
uniform float uExpressiveEnergyThreshold;
uniform float uExpressiveEnergyAccumulation;
uniform float uExpressiveRadialGravity;
uniform float uExpressiveRadialStrength;
uniform float uExpressiveRadialRadius;
uniform float uExpressiveRadialFocusX;
uniform float uExpressiveRadialFocusY;
uniform float uExpressiveMotionEcho;
uniform float uExpressiveMotionEchoDecay;
uniform float uExpressiveMotionEchoWarp;
uniform float uExpressiveSpectralSmear;
uniform float uExpressiveSpectralOffset;
uniform float uExpressiveSpectralMix;
uniform float uParticlesEnabled;
uniform float uParticleDensity;
uniform float uParticleSpeed;
uniform float uParticleSize;
uniform float uParticleGlow;
uniform float uParticleTurbulence;
uniform float uParticleAudioLift;
uniform float uSdfEnabled;
uniform float uSdfShape;
uniform float uSdfScale;
uniform float uSdfEdge;
uniform float uSdfGlow;
uniform float uSdfRotation;
uniform float uSdfFill;
uniform vec3 uSdfColor;
uniform float uPlasmaAssetEnabled;
uniform sampler2D uPlasmaAsset;
uniform float uPlasmaAssetBlend;
uniform float uPlasmaAssetAudioReact;
uniform float uSpectrumAssetEnabled;
uniform sampler2D uSpectrumAsset;
uniform float uSpectrumAssetBlend;
uniform float uSpectrumAssetAudioReact;
uniform float uMediaEnabled;
uniform float uMediaOpacity;
uniform float uMediaAssetEnabled;
uniform sampler2D uMediaAsset;
uniform float uMediaAssetBlend;
uniform float uMediaAssetAudioReact;
uniform vec2 uMediaBurstPos[8];
uniform float uMediaBurstRadius[8];
uniform float uMediaBurstType[8];
uniform float uMediaBurstActive[8];
uniform sampler2D uWaveformTex;
uniform sampler2D uSpectrumTex;
uniform sampler2D uModulatorTex;
uniform sampler2D uMidiTex;
uniform float uWaveformEnabled;
uniform float uSpectrumEnabledInternal;
uniform float uModulatorsEnabled;
uniform float uMidiEnabled;
uniform vec3 uGlobalColor;
uniform float uDebugTint;
uniform vec3 uRoleWeights; // x: core, y: support, z: atmosphere
uniform float uTransitionAmount;
uniform float uTransitionType;
uniform float uChemistryMode;
uniform float uMotionTemplate;
uniform float uEngineMass;
uniform float uEngineFriction;
uniform float uEngineElasticity;
uniform float uMaxBloom;
uniform float uForceFeedback;
uniform float uEngineGrain;
uniform float uEngineVignette;
uniform float uEngineCA;
uniform float uEngineSignature;

// --- EDM Generators ---
uniform float uLaserEnabled;
uniform float uLaserOpacity;
uniform float uLaserBeamCount;
uniform float uLaserBeamWidth;
uniform float uLaserBeamLength;
uniform float uLaserRotation;
uniform float uLaserRotationSpeed;
uniform float uLaserSpread;
uniform float uLaserMode;
uniform float uLaserColorShift;
uniform float uLaserAudioReact;
uniform float uLaserGlow;
uniform float uStrobeEnabled;
uniform float uStrobeOpacity;
uniform float uStrobeRate;
uniform float uStrobeDutyCycle;
uniform float uStrobeMode;
uniform float uStrobeAudioTrigger;
uniform float uStrobeThreshold;
uniform float uStrobeFadeOut;
uniform float uStrobePattern;
uniform float uShapeBurstEnabled;
uniform float uShapeBurstOpacity;
uniform float uShapeBurstShape;
uniform float uShapeBurstExpandSpeed;
uniform float uShapeBurstStartSize;
uniform float uShapeBurstMaxSize;
uniform float uShapeBurstThickness;
uniform float uShapeBurstFadeMode;
uniform float uBurstSpawnTimes[8];
uniform float uBurstActives[8];
uniform float uGridTunnelEnabled;
uniform float uGridTunnelOpacity;
uniform float uGridTunnelSpeed;
uniform float uGridTunnelGridSize;
uniform float uGridTunnelLineWidth;
uniform float uGridTunnelPerspective;
uniform float uGridTunnelHorizonY;
uniform float uGridTunnelGlow;
uniform float uGridTunnelAudioReact;
uniform float uGridTunnelMode;

// --- Rock Generators ---
uniform float uLightningEnabled;
uniform float uLightningOpacity;
uniform float uLightningSpeed;
uniform float uLightningBranches;
uniform float uLightningThickness;
uniform float uLightningColor;
uniform float uAnalogOscilloEnabled;
uniform float uAnalogOscilloOpacity;
uniform float uAnalogOscilloThickness;
uniform float uAnalogOscilloGlow;
uniform float uAnalogOscilloColor;
uniform float uAnalogOscilloMode;
uniform float uSpeakerConeEnabled;
uniform float uSpeakerConeOpacity;
uniform float uSpeakerConeForce;
uniform float uGlitchScanlineEnabled;
uniform float uGlitchScanlineOpacity;
uniform float uGlitchScanlineSpeed;
uniform float uGlitchScanlineCount;
uniform float uLaserStarfieldEnabled;
uniform float uLaserStarfieldOpacity;
uniform float uLaserStarfieldSpeed;
uniform float uLaserStarfieldDensity;
uniform float uPulsingRibbonsEnabled;
uniform float uPulsingRibbonsOpacity;
uniform float uPulsingRibbonsCount;
uniform float uPulsingRibbonsWidth;
uniform float uElectricArcEnabled;
uniform float uElectricArcOpacity;
uniform float uElectricArcRadius;
uniform float uElectricArcChaos;
uniform float uPyroBurstEnabled;
uniform float uPyroBurstOpacity;
uniform float uPyroBurstForce;
uniform float uGeoWireframeEnabled;
uniform float uGeoWireframeOpacity;
uniform float uGeoWireframeShape;
uniform float uGeoWireframeScale;
uniform float uSignalNoiseEnabled;
uniform float uSignalNoiseOpacity;
uniform float uSignalNoiseAmount;
uniform float uWormholeEnabled;
uniform float uWormholeOpacity;
uniform float uWormholeSpeed;
uniform float uWormholeWeave;
uniform float uWormholeIter;
uniform float uRibbonTunnelEnabled;
uniform float uRibbonTunnelOpacity;
uniform float uRibbonTunnelSpeed;
uniform float uRibbonTunnelTwist;
uniform float uFractalTunnelEnabled;
uniform float uFractalTunnelOpacity;
uniform float uFractalTunnelSpeed;
uniform float uFractalTunnelComplexity;
uniform float uCircuitConduitEnabled;
uniform float uCircuitConduitOpacity;
uniform float uCircuitConduitSpeed;
uniform float uAuraPortalEnabled;
uniform float uAuraPortalOpacity;
uniform float uAuraPortalColor;
uniform float uFreqTerrainEnabled;
uniform float uFreqTerrainOpacity;
uniform float uFreqTerrainScale;
uniform float uDataStreamEnabled;
uniform float uDataStreamOpacity;
uniform float uDataStreamSpeed;
uniform float uCausticLiquidEnabled;
uniform float uCausticLiquidOpacity;
uniform float uCausticLiquidSpeed;
uniform float uShimmerVeilEnabled;
uniform float uShimmerVeilOpacity;
uniform float uShimmerVeilComplexity;

// --- New 31 Generators ---
uniform float uNebulaCloudEnabled;
uniform float uNebulaCloudOpacity;
uniform float uNebulaCloudDensity;
uniform float uNebulaCloudSpeed;
uniform float uCircuitBoardEnabled;
uniform float uCircuitBoardOpacity;
uniform float uCircuitBoardGrowth;
uniform float uCircuitBoardComplexity;
uniform float uLorenzAttractorEnabled;
uniform float uLorenzAttractorOpacity;
uniform float uLorenzAttractorSpeed;
uniform float uLorenzAttractorChaos;
uniform float uMandalaSpinnerEnabled;
uniform float uMandalaSpinnerOpacity;
uniform float uMandalaSpinnerSides;
uniform float uMandalaSpinnerSpeed;
uniform float uStarburstGalaxyEnabled;
uniform float uStarburstGalaxyOpacity;
uniform float uStarburstGalaxyForce;
uniform float uStarburstGalaxyCount;
uniform float uDigitalRainV2Enabled;
uniform float uDigitalRainV2Opacity;
uniform float uDigitalRainV2Speed;
uniform float uDigitalRainV2Density;
uniform float uLavaFlowEnabled;
uniform float uLavaFlowOpacity;
uniform float uLavaFlowHeat;
uniform float uLavaFlowViscosity;
uniform float uCrystalGrowthEnabled;
uniform float uCrystalGrowthOpacity;
uniform float uCrystalGrowthRate;
uniform float uCrystalGrowthSharpness;
uniform float uTechnoGridEnabled;
uniform float uTechnoGridOpacity;
uniform float uTechnoGridHeight;
uniform float uTechnoGridSpeed;
uniform float uMagneticFieldEnabled;
uniform float uMagneticFieldOpacity;
uniform float uMagneticFieldStrength;
uniform float uMagneticFieldDensity;
uniform float uPrismShardsEnabled;
uniform float uPrismShardsOpacity;
uniform float uPrismShardsRefraction;
uniform float uPrismShardsCount;
uniform float uNeuralNetEnabled;
uniform float uNeuralNetOpacity;
uniform float uNeuralNetActivity;
uniform float uNeuralNetDensity;
uniform float uAuroraChordEnabled;
uniform float uAuroraChordOpacity;
uniform float uAuroraChordWaviness;
uniform float uAuroraChordColorRange;
uniform float uVhsGlitchEnabled;
uniform float uVhsGlitchOpacity;
uniform float uVhsGlitchJitter;
uniform float uVhsGlitchNoise;
uniform float uMoirePatternEnabled;
uniform float uMoirePatternOpacity;
uniform float uMoirePatternScale;
uniform float uMoirePatternSpeed;
uniform float uHypercubeEnabled;
uniform float uHypercubeOpacity;
uniform float uHypercubeProjection;
uniform float uHypercubeSpeed;
uniform float uFluidSwirlEnabled;
uniform float uFluidSwirlOpacity;
uniform float uFluidSwirlVorticity;
uniform float uFluidSwirlColorMix;
uniform float uAsciiStreamEnabled;
uniform float uAsciiStreamOpacity;
uniform float uAsciiStreamResolution;
uniform float uAsciiStreamContrast;
uniform float uRetroWaveEnabled;
uniform float uRetroWaveOpacity;
uniform float uRetroWaveSunSize;
uniform float uRetroWaveGridSpeed;
uniform float uBubblePopEnabled;
uniform float uBubblePopOpacity;
uniform float uBubblePopPopRate;
uniform float uBubblePopSize;
uniform float uSoundWave3DEnabled;
uniform float uSoundWave3DOpacity;
uniform float uSoundWave3DAmplitude;
uniform float uSoundWave3DSmoothness;
uniform float uParticleVortexEnabled;
uniform float uParticleVortexOpacity;
uniform float uParticleVortexSuction;
uniform float uParticleVortexSpin;
uniform float uGlowWormsEnabled;
uniform float uGlowWormsOpacity;
uniform float uGlowWormsLength;
uniform float uGlowWormsSpeed;
uniform float uMirrorMazeEnabled;
uniform float uMirrorMazeOpacity;
uniform float uMirrorMazeRecursion;
uniform float uMirrorMazeAngle;
uniform float uPulseHeartEnabled;
uniform float uPulseHeartOpacity;
uniform float uPulseHeartBeats;
uniform float uPulseHeartLayers;
uniform float uDataShardsEnabled;
uniform float uDataShardsOpacity;
uniform float uDataShardsSpeed;
uniform float uDataShardsSharpness;
uniform float uHexCellEnabled;
uniform float uHexCellOpacity;
uniform float uHexCellPulse;
uniform float uHexCellScale;
uniform float uPlasmaBallEnabled;
uniform float uPlasmaBallOpacity;
uniform float uPlasmaBallVoltage;
uniform float uPlasmaBallFilaments;
uniform float uWarpDriveEnabled;
uniform float uWarpDriveOpacity;
uniform float uWarpDriveWarp;
uniform float uWarpDriveGlow;
uniform float uVisualFeedbackEnabled;
uniform float uVisualFeedbackOpacity;
uniform float uVisualFeedbackZoom;
uniform float uVisualFeedbackRotation;
uniform float uMyceliumGrowthEnabled;
uniform float uMyceliumGrowthOpacity;
uniform float uMyceliumGrowthSpread;
uniform float uMyceliumGrowthDecay;

// --- Advanced SDF Injections ---
uniform float uAdvancedSdfEnabled;
uniform vec3 uSdfLightDir;
uniform vec3 uSdfLightColor;
uniform float uSdfLightIntensity;
uniform float uSdfAoEnabled;
uniform float uSdfShadowsEnabled;
uniform float uInternalSource;
uniform vec3 uCameraPos;
uniform vec3 uCameraTarget;
uniform float uCameraFov;
${sdfUniforms}

${sdfFunctions}

float sdfSceneMap(vec3 p) {
  return 10.0; // Placeholder for simple mode, overridden in advanced
}

vec2 advancedSdfMap(vec3 p) {
  // Default returns distance and material (0.0 for no material)
  return vec2(${sdfMapBody}, 0.0);
}

vec3 calcSdfNormal(vec3 p) {
  vec2 e = vec2(0.001, 0.0);
  return normalize(vec3(
    advancedSdfMap(p + e.xyy).x - advancedSdfMap(p - e.xyy).x,
    advancedSdfMap(p + e.yxy).x - advancedSdfMap(p - e.yxy).x,
    advancedSdfMap(p + e.yyx).x - advancedSdfMap(p - e.yyx).x
  ));
}

vec3 getSdfColor(float id) {
  return vec3(1.0);
}

float calcSdfShadow(vec3 ro, vec3 rd, float k) {
  float res = 1.0;
  float t = 0.01;
  for (float i = 0.0; i < 16.0; i += 1.0) {
    float h = advancedSdfMap(ro + rd * t).x;
    res = min(res, k * h / t);
    t += clamp(h, 0.01, 0.2);
    if(res < 0.001 || t > 5.0) break;
  }
  return clamp(res, 0.0, 1.0);
}

float calcSdfAO(vec3 p, vec3 n) {
  float occ = 0.0;
  float sca = 1.0;
  for (float i = 0.0; i < 5.0; i += 1.0) {
    float hr = 0.01 + 0.12 * i / 4.0;
    float d = advancedSdfMap(p + n * hr).x;
    occ += (hr - d) * sca;
    sca *= 0.95;
  }
  return clamp(1.0 - 3.0 * occ, 0.0, 1.0);
}

mat3 setCamera(vec3 ro, vec3 ta, float cr) {
  vec3 cw = normalize(ta - ro);
  vec3 cp = vec3(sin(cr), cos(cr), 0.0);
  vec3 cu = normalize(cross(cw, cp));
  vec3 cv = normalize(cross(cu, cw));
  return mat3(cu, cv, cw);
}

vec3 getRayDirection(vec2 uv, vec3 ro, vec3 ta, float fov) {
  mat3 ca = setCamera(ro, ta, 0.0);
  return ca * normalize(vec3(uv, fov));
}
// --- End Injections ---

in vec2 vUv;
out vec4 outColor;

vec3 blendAdd(vec3 base, vec3 blend) {
  return min(base + blend, 1.0);
}

vec3 blendMultiply(vec3 base, vec3 blend) {
  return base * blend;
}

vec3 blendScreen(vec3 base, vec3 blend) {
  return 1.0 - (1.0 - base) * (1.0 - blend);
}

vec3 blendOverlay(vec3 base, vec3 blend) {
  return mix(
    2.0 * base * blend,
    1.0 - 2.0 * (1.0 - base) * (1.0 - blend),
    step(0.5, base)
  );
}

vec3 blendDifference(vec3 base, vec3 blend) {
  return abs(base - blend);
}

float sdSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

float sdArc(vec2 p, vec2 center, float radius, float thickness) {
  float d = abs(length(p - center) - radius);
  return d - thickness;
}

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i + vec2(0.0, 0.0)), hash21(i + vec2(1.0, 0.0)), u.x),
             mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  vec2 shift = vec2(100.0);
  mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
  for (float i = 0.0; i < 6.0; i += 1.0) {
    v += a * noise(p);
    p = rot * p * 2.0 + shift;
    a *= 0.5;
  }
  return v;
}

float voronoi(vec2 x) {
  vec2 n = floor(x);
  vec2 f = fract(x);
  float m = 8.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = vec2(hash21(n + g), hash21(n + g + 13.7));
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < m) m = d;
    }
  }
  return sqrt(m);
}

float getWaveform(float t) {
  return texture(uWaveformTex, vec2(t, 0.5)).r;
}

float getSpectrum(float t) {
  return texture(uSpectrumTex, vec2(t, 0.5)).r;
}

float getModulator(int index) {
  return texture(uModulatorTex, vec2((float(index) + 0.5) / 8.0, 0.5)).r;
}

vec2 getMidiNote(int index) {
  return texture(uMidiTex, vec2((float(index) + 0.5) / 128.0, 0.5)).rg;
}

float oscilloSample(float t) {
  float idx = clamp(t, 0.0, 1.0) * 255.0;
  int i0 = int(floor(idx));
  int i1 = min(255, i0 + 1);
  float f = fract(idx);
  float a = uOscillo[i0];
  float b = uOscillo[i1];
  return mix(a, b, f);
}

float glyphShape(vec2 p, float seed, float family, float complexity) {
  float thickness = mix(0.035, 0.012, complexity);
  float g = 10.0;
  float h1 = hash21(vec2(seed, family));
  float h2 = hash21(vec2(seed + 11.3, family * 1.7));
  float h3 = hash21(vec2(seed + 23.7, family * 2.3));
  vec2 a = vec2(-0.32 + h1 * 0.2, -0.25 + h2 * 0.15);
  vec2 b = vec2(0.32 - h2 * 0.2, 0.25 - h3 * 0.15);
  vec2 c = vec2(-0.22 + h3 * 0.2, 0.28 - h1 * 0.18);
  vec2 d = vec2(0.22 - h1 * 0.2, -0.28 + h2 * 0.18);
  g = min(g, sdSegment(p, a, b));
  g = min(g, sdSegment(p, c, d));
  if (h1 > 0.4) {
    g = min(g, sdSegment(p, vec2(-0.28, 0.0), vec2(0.28, 0.0)));
  }
  if (h2 > 0.5) {
    float radius = 0.18 + h3 * 0.12;
    vec2 center = vec2(0.0, -0.02 + (h1 - 0.5) * 0.2);
    g = min(g, sdArc(p, center, radius, thickness));
  }
  return g;
}

float crystalField(vec2 p, float seed, float scale) {
  vec2 gv = p * scale;
  vec2 cell = floor(gv);
  vec2 f = fract(gv);
  float d = 10.0;
  for (int j = -1; j <= 1; j += 1) {
    for (int i = -1; i <= 1; i += 1) {
      vec2 offset = vec2(float(i), float(j));
      vec2 id = cell + offset;
      float rnd = hash21(id + seed);
      vec2 point = offset + vec2(rnd, fract(rnd * 1.7));
      d = min(d, length(f - point));
    }
  }
  return d;
}

vec3 applyBlendMode(vec3 base, vec3 blend, float mode, float opacity) {
  vec3 result;
  if (mode < 0.5) {
    result = blend;
  } else if (mode < 1.5) {
    result = blendAdd(base, blend);
  } else if (mode < 2.5) {
    result = blendMultiply(base, blend);
  } else if (mode < 3.5) {
    result = blendScreen(base, blend);
  } else if (mode < 4.5) {
    result = blendOverlay(base, blend);
  } else {
    result = blendDifference(base, blend);
  }
  return mix(base, result, opacity);
}

vec3 palette(float t);

float plasmaDefault(vec2 uv, float t) {
  float v = 0.0;
  vec2 p = uv * uPlasmaScale;
  float audio = (uRms * 0.5 + uPeak * 0.5) * uPlasmaAudioReact;
  
  for (float i = 1.0; i < 9.0; i += 1.0) {
      if (i > uPlasmaComplexity) break;
      v += sin(p.x * i + t * uPlasmaSpeed * (1.0 + i * 0.1) + audio * i);
      v += sin(p.y * i - t * uPlasmaSpeed * (1.1 + i * 0.15) + audio * 0.5);
      p += vec2(sin(t * 0.1), cos(t * 0.1)) * 0.5;
  }
  
  return v / uPlasmaComplexity * 0.5 + 0.5;
}

vec3 samplePlasma(vec2 uv, float t) {
#ifdef HAS_CUSTOM_PLASMA
  return customPlasma(uv, t);
#else
  float p = plasmaDefault(uv, t);
  return palette(p);
#endif
}

float particleField(vec2 uv, float t, float density, float speed, float size) {
  float grid = mix(18.0, 90.0, density);
  float audio = (uRms * 0.4 + uPeak * 0.6) * uParticleAudioLift;
  vec2 drift = vec2(t * 0.02 * (0.2 + speed), t * 0.015 * (0.2 + speed));
  
  // Add turbulence
  vec2 turb = vec2(
      sin(uv.y * 4.0 + t * 0.5),
      cos(uv.x * 4.0 + t * 0.5)
  ) * uParticleTurbulence * 0.5;
  
  vec2 gv = uv * grid + drift + turb;
  vec2 cell = floor(gv);
  vec2 f = fract(gv);
  float rnd = hash21(cell);
  vec2 pos = vec2(hash21(cell + 1.3), hash21(cell + 9.1));
  pos = 0.2 + 0.6 * pos;
  
  float twinkle = 0.4 + 0.6 * sin(t * (1.5 + rnd * 2.5) + rnd * 6.2831) + audio;
  float radius = mix(0.05, 0.015, density) * mix(1.4, 0.6, size);
  float d = distance(f, pos);
  float spark = smoothstep(radius, 0.0, d);
  return spark * twinkle;
}

vec2 rotate2d(vec2 p, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}

float sdRing(vec2 p, float r, float th) {
  return abs(length(p) - r) - th;
}

float opDisplace(float d, vec3 p, float amount, float freq) {
  float displacement = sin(freq * p.x) * sin(freq * p.y) * sin(freq * p.z) * amount;
  return d + displacement;
}

float opOnion(float d, float thickness) {
  return abs(d) - thickness;
}

float opRound(float d, float r) {
  return d - r;
}

float opAnnular(float d, float thickness) {
  return abs(d) - thickness * 0.5;
}

float sdHexagon(vec2 p, float r) {
  const vec3 k = vec3(-0.866025404, 0.5, 0.577350269);
  p = abs(p);
  p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
  p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
  return length(p) * sign(p.y);
}

float sdStar(vec2 p, float r, int n, float m) {
  float an = 3.141593 / float(n);
  float en = 3.141593 / m;
  vec2 acs = vec2(cos(an), sin(an));
  vec2 ecs = vec2(cos(en), sin(en));
  float bn = mod(atan(p.x, p.y), 2.0 * an) - an;
  p = length(p) * vec2(cos(bn), abs(sin(bn)));
  p -= r * acs;
  p += ecs * clamp(-dot(p, ecs), 0.0, r * acs.y / ecs.y);
  return length(p) * sign(p.x);
}

float sdCircle(vec2 p, float r) {
  return length(p) - r;
}

float sdBox(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

float sdEquilateralTriangle(vec2 p, float r) {
  float k = 1.7320508;
  p.x = abs(p.x) - r;
  p.y = p.y + r / k;
  if (p.x + k * p.y > 0.0) {
    p = vec2(p.x - k * p.y, -k * p.x - p.y) * 0.5;
  }
  p.x -= clamp(p.x, -2.0 * r, 0.0);
  return -length(p) * sign(p.y);
}

vec3 applySaturation(vec3 color, float amount) {
  float luma = dot(color, vec3(0.299, 0.587, 0.114));
  return mix(vec3(luma), color, amount);
}

vec3 applyContrast(vec3 color, float amount) {
  return (color - 0.5) * amount + 0.5;
}

vec3 shiftPalette(vec3 color, float shift) {
  float angle = shift * 6.28318;
  
  // Apply Chemistry Constraints
  if (uChemistryMode > 0.5 && uChemistryMode < 1.5) { // Triadic
    angle = floor(shift * 3.0) * (6.28318 / 3.0);
  } else if (uChemistryMode > 1.5 && uChemistryMode < 2.5) { // Complementary
    angle = floor(shift * 2.0) * 3.14159;
  } else if (uChemistryMode > 2.5) { // Monochromatic
    float luma = dot(color, vec3(0.299, 0.587, 0.114));
    return mix(vec3(luma), uPalette[0] * luma, 0.8);
  }

  mat3 rot = mat3(
    0.299 + 0.701 * cos(angle) + 0.168 * sin(angle), 0.587 - 0.587 * cos(angle) + 0.330 * sin(angle), 0.114 - 0.114 * cos(angle) - 0.497 * sin(angle),
    0.299 - 0.299 * cos(angle) - 0.328 * sin(angle), 0.587 + 0.413 * cos(angle) + 0.035 * sin(angle), 0.114 - 0.114 * cos(angle) + 0.292 * sin(angle),
    0.299 - 0.300 * cos(angle) + 1.250 * sin(angle), 0.587 - 0.588 * cos(angle) - 1.050 * sin(angle), 0.114 + 0.886 * cos(angle) - 0.203 * sin(angle)
  );
  return clamp(rot * color, 0.0, 1.0);
}

vec2 kaleidoscope(vec2 uv, float amount) {
  if (amount <= 0.01) return uv;
  vec2 centered = uv * 2.0 - 1.0;
  float angle = atan(centered.y, centered.x) + uKaleidoscopeRotation;
  float radius = length(centered);
  float slices = mix(1.0, 8.0, amount);
  float slice = 6.28318 / slices;
  angle = mod(angle, slice);
  angle = abs(angle - slice * 0.5);
  vec2 rotated = vec2(cos(angle), sin(angle)) * radius;
  return rotated * 0.5 + 0.5;
}

vec3 posterize(vec3 color, float amount) {
  if (amount <= 0.01) return color;
  float levels = mix(16.0, 3.0, amount);
  return floor(color * levels) / levels;
}

vec3 palette(float t) {
  float v = clamp(t, 0.0, 1.0);
  if (v <= 0.25) return mix(uPalette[0], uPalette[1], v * 4.0);
  if (v <= 0.50) return mix(uPalette[1], uPalette[2], (v - 0.25) * 4.0);
  if (v <= 0.75) return mix(uPalette[2], uPalette[3], (v - 0.50) * 4.0);
  return mix(uPalette[3], uPalette[4], (v - 0.75) * 4.0);
}

// --- Rock Generator Functions ---

float lightningBolt(vec2 uv, float t, float audio) {
  vec2 p = (uv * 2.0 - 1.0);
  p.x *= uAspect;
  
  float v = 0.0;
  float intensity = uLightningOpacity;
  float branches = uLightningBranches; 
  float thickness = uLightningThickness; 
  
  for (float i = 0.0; i < 3.0; i += 1.0) {
    if (i >= uLightningBranches) break;
    float t2 = t * uLightningSpeed * (1.0 + i * 0.5) + i * 135.2;
    vec2 seed = vec2(t2 * 0.5, t2 * 0.2);
    
    float noiseVal = fbm(p * (2.0 + i) + seed);
    float bolt = 1.0 / (abs(p.y + (noiseVal - 0.5) * 1.5) + 0.05);
    
    // Masking to keep it somewhat central but wild
    bolt *= smoothstep(1.5, 0.0, abs(p.x));
    
    v += bolt * thickness;
  }
  
  v *= (1.0 + audio * 2.0);
  return clamp(v, 0.0, 1.0) * intensity;
}

float analogOscillo(vec2 uv, float t, float audio) {
  vec2 p = uv;
  float v = 0.0;
  
  float wave = getWaveform(p.x);
  float jitter = (hash21(vec2(t * 100.0, p.y)) - 0.5) * 0.01;
  float dist = abs(p.y - 0.5 - wave * 0.5 + jitter);
  float thickness = uAnalogOscilloThickness; 
  float glow = uAnalogOscilloGlow;
  
  v = smoothstep(thickness, 0.0, dist);
  v += exp(-dist * 20.0) * glow;
  
  return clamp(v, 0.0, 1.0) * uAnalogOscilloOpacity * (1.0 + audio * 0.5);
}

vec2 speakerCone(vec2 uv, float bass) {
  vec2 centered = uv - 0.5;
  float dist = length(centered);
  float push = bass * uSpeakerConeForce * 0.2 * smoothstep(0.5, 0.0, dist);
  return uv - centered * push;
}

vec3 glitchScanline(vec2 uv, float t, float audio) {
  float speed = uGlitchScanlineSpeed;
  float scan = sin(uv.y * 100.0 * uGlitchScanlineCount + t * speed) * 0.5 + 0.5;

  float blockY = floor(uv.y * 20.0);
  float blockHash = hash21(vec2(floor(t * speed * 3.0), blockY));
  float hShift = 0.0;
  if (blockHash > 0.85) {
    hShift = (hash21(vec2(t * speed * 5.0, blockY)) - 0.5) * 0.2;
  }
  vec2 glitchUv = vec2(uv.x + hShift, uv.y);

  float tearLine = smoothstep(0.01, 0.0, abs(fract(uv.y * 15.0 + t * speed * 0.5) - 0.5)) * 0.6;
  float flicker = step(0.92, hash21(vec2(floor(t * 20.0), 0.0))) * 0.4;

  vec3 col = vec3(scan * 0.6);
  col += palette(fract(blockY * 0.1 + t * 0.05)) * abs(hShift) * 5.0;
  col += vec3(tearLine);
  col *= (1.0 - flicker);

  if (blockHash > 0.93) {
    col = vec3(1.0, 0.1, 0.1) * (0.5 + audio);
  }

  return col * uGlitchScanlineOpacity * (1.0 + audio);
}

vec3 laserStarfield(vec2 uv, float t, float audio) {
  vec2 p = uv * 2.0 - 1.0;
  p.x *= uAspect;
  vec3 col = vec3(0.0);
  float layers = 3.0;
  for (float i = 0.0; i < layers; i += 1.0) {
    float depth = fract(t * uLaserStarfieldSpeed * 0.1 + i/layers);
    float scale = mix(20.0, 0.1, depth);
    float fade = depth * smoothstep(1.0, 0.8, depth);
    vec2 gv = p * scale + i * 453.2;
    vec2 id = floor(gv);
    vec2 f = fract(gv) - 0.5;
    float rnd = hash21(id);
    if(rnd > 1.0 - uLaserStarfieldDensity * 0.2) {
      float star = smoothstep(0.1, 0.0, length(f));
      col += palette(rnd) * star * fade;
    }
  }
  return col * uLaserStarfieldOpacity * (1.0 + audio * 0.5);
}

vec3 pulsingRibbons(vec2 uv, float t, float audio) {
  vec3 col = vec3(0.0);
  for (float i = 0.0; i < uPulsingRibbonsCount; i += 1.0) {
    float offset = i * 0.2;
    float wave = sin(uv.x * 5.0 + t * 2.0 + offset) * 0.2;
    wave += sin(uv.x * 10.0 - t * 1.5) * 0.1;
    float d = abs(uv.y - 0.5 - wave);
    float ribbon = smoothstep(uPulsingRibbonsWidth, 0.0, d);
    col += palette(fract(i * 0.3 + t * 0.1)) * ribbon;
  }
  return col * uPulsingRibbonsOpacity * (1.0 + audio);
}

vec3 electricArc(vec2 uv, float t, float audio) {
  vec2 p = uv * 2.0 - 1.0;
  float d = length(p);
  float arc = abs(d - uElectricArcRadius);
  float noise = fbm(p * uElectricArcChaos + t * 2.0);
  float val = smoothstep(0.05, 0.0, arc + noise * 0.1);
  return palette(fract(t * 0.1 + noise)) * val * uElectricArcOpacity * (1.0 + audio);
}

vec3 pyroBurst(vec2 uv, float t, float peak) {
  vec2 p = uv - 0.5;
  p.x *= uAspect;
  float d = length(p);
  float angle = atan(p.y, p.x);
  float burst = smoothstep(0.1, 0.0, abs(sin(angle * 10.0 + t * 10.0))) * smoothstep(uPyroBurstForce * peak, 0.0, d);
  return palette(fract(t * 0.5 + d)) * burst * uPyroBurstOpacity;
}

vec3 geoWireframe(vec2 uv, float t, float audio) {
  vec2 p = uv * 2.0 - 1.0;
  p = rotate2d(p, t * 0.5);
  float shape = 0.0;
  if(uGeoWireframeShape < 0.5) shape = abs(sdBox(p, vec2(uGeoWireframeScale))) - 0.01;
  else shape = abs(sdEquilateralTriangle(p, uGeoWireframeScale)) - 0.01;
  float val = smoothstep(0.02, 0.0, shape);
  return palette(fract(t * 0.1)) * val * uGeoWireframeOpacity * (1.0 + audio * 0.5);
}

vec3 signalNoise(vec2 uv, float t) {
  float n = hash21(uv * 200.0 + t * 10.0);
  float n2 = hash21(floor(uv * 80.0) + t * 5.0);

  float scanline = step(0.97, hash21(vec2(t * 7.0, floor(uv.y * 30.0))));
  float hShift = scanline * (hash21(vec2(t * 13.0, floor(uv.y * 30.0))) - 0.5) * 0.15;
  float staticGrain = n * 0.5 + n2 * 0.3;
  float burst = scanline * 1.5;

  vec3 col = palette(fract(n + t * 0.1)) * (staticGrain + burst);
  col += vec3(scanline) * 0.4;

  return col * uSignalNoiseOpacity * uSignalNoiseAmount;
}

vec3 infiniteWormhole(vec2 uv, float t, float audio) {
  vec2 p = uv * 2.0 - 1.0;
  p.x *= uAspect;
  float r = length(p);
  float a = atan(p.y, p.x);
  
  // The Weave: animate center
  vec2 center = vec2(sin(t * uWormholeSpeed * 0.5) * uWormholeWeave, cos(t * uWormholeSpeed * 0.3) * uWormholeWeave);
  p -= center;
  r = length(p);
  
  float z = 1.0 / (r + 0.01);
  float uv_z = z + t * uWormholeSpeed;
  
  float col = 0.0;
  for (float i = 0.0; i < uWormholeIter; i += 1.0) {
    float shift = i * 0.5;
    col += smoothstep(0.1, 0.0, abs(sin(a * 3.0 + uv_z + shift) * 0.5));
  }
  
  vec3 baseCol = palette(fract(uv_z * 0.1));
  return baseCol * col * uWormholeOpacity * (1.0 + audio);
}

vec3 ribbonTunnel(vec2 uv, float t, float audio) {
  vec2 p = uv * 2.0 - 1.0;
  p.x *= uAspect;
  float r = length(p);
  float a = atan(p.y, p.x);

  float z = 1.0 / (r + 0.01);
  vec3 col = vec3(0.0);

  for (float i = 0.0; i < 3.0; i += 1.0) {
    float offset = i * 0.8;
    float twist = a + z * uRibbonTunnelTwist * (1.0 + i * 0.3) + t * uRibbonTunnelSpeed + offset;
    float ribbon = smoothstep(0.15, 0.0, abs(sin(twist * (4.0 + i))));
    ribbon *= smoothstep(0.0, 0.4, r);
    float glow = exp(-abs(sin(twist * (4.0 + i))) * 6.0) * 0.4;
    glow *= smoothstep(0.0, 0.3, r);
    col += palette(fract(z * 0.15 + i * 0.33 + t * 0.03)) * (ribbon + glow);
  }

  float depth = smoothstep(2.0, 0.5, z) * 0.6;
  col += palette(fract(z * 0.1 + 0.5)) * depth * smoothstep(0.0, 0.3, r);

  return col * uRibbonTunnelOpacity * (1.0 + audio * 0.8);
}

vec3 fractalTunnel(vec2 uv, float t, float audio) {
  vec2 p = (uv - 0.5) * 2.0;
  p.x *= uAspect;

  float col = 0.0;
  float z = t * uFractalTunnelSpeed;
  float glow = 0.0;
  vec2 p0 = p;

  for (float i = 0.0; i < 8.0; i += 1.0) {
    p = abs(p) / dot(p, p) - (0.5 + audio * 0.1);
    p = rotate2d(p, z * 0.15 + i * 0.2);
    float d = length(p);
    float fade = exp(-d * max(0.5, 5.0 - uFractalTunnelComplexity));
    col += fade;
    glow += smoothstep(0.3, 0.0, d) * (1.0 / (i + 1.0));
  }

  col *= 0.25;
  vec3 c = palette(fract(col * 0.3 + z * 0.05)) * col;
  c += palette(fract(col * 0.5 + 0.3)) * glow * 0.4;

  return c * uFractalTunnelOpacity * (1.0 + audio * 0.8);
}

vec3 circuitConduit(vec2 uv, float t, float audio) {
  vec2 p = uv * 2.0 - 1.0;
  float r = max(abs(p.x), abs(p.y)); // Square tunnel
  float z = 1.0 / (r + 0.01);
  vec2 tu = vec2(atan(p.y, p.x) / 1.57, z + t * uCircuitConduitSpeed);
  
  float grid = step(0.95, fract(tu.x * 4.0)) + step(0.95, fract(tu.y * 10.0));
  float pulses = step(0.98, fract(tu.y * 2.0 - t * 5.0));
  
  return palette(fract(z * 0.1)) * (grid + pulses * 2.0) * uCircuitConduitOpacity * (1.0 + audio);
}

vec3 auraPortal(vec2 uv, float t, float audio) {
  vec2 p = uv * 2.0 - 1.0;
  p.x *= uAspect;
  float d = length(p);
  float a = atan(p.y, p.x);

  float core = exp(-d * 4.0) * (1.5 + audio);
  float ring1 = smoothstep(0.03, 0.0, abs(d - 0.3 - audio * 0.1)) * 0.8;
  float ring2 = smoothstep(0.04, 0.0, abs(d - 0.55 - audio * 0.05)) * 0.5;
  float ring3 = smoothstep(0.05, 0.0, abs(d - 0.8)) * 0.3;

  float pulse = sin(d * 12.0 - t * 2.0) * 0.5 + 0.5;
  pulse *= smoothstep(1.0, 0.2, d);

  float rays = smoothstep(0.4, 0.0, abs(sin(a * 6.0 + t * 0.5))) * smoothstep(1.0, 0.1, d) * 0.3;

  float baseHue = uAuraPortalColor < 0.5 ? 0.2 : 0.8;
  vec3 coreCol = palette(baseHue) * core;
  vec3 ringCol = palette(baseHue + 0.1) * (ring1 + ring2 + ring3);
  vec3 pulseCol = palette(baseHue + 0.2) * pulse * 0.35;
  vec3 rayCol = palette(baseHue + 0.3) * rays;

  return (coreCol + ringCol + pulseCol + rayCol) * uAuraPortalOpacity;
}

vec3 frequencyTerrain(vec2 uv, float t, float audio) {
  vec3 col = vec3(0.0);
  float bandF = uv.x * 64.0;
  float bandFloor = floor(bandF);
  float amp = uSpectrum[int(clamp(bandFloor, 0.0, 63.0))];

  float bandNextF = min(bandFloor + 1.0, 63.0);
  float ampNext = uSpectrum[int(bandNextF)];
  float fr = fract(bandF);
  float smoothAmp = mix(amp, ampNext, fr);

  float barHeight = smoothAmp * uFreqTerrainScale;
  float barBase = 0.5 - barHeight * 0.5;
  float barTop = 0.5 + barHeight * 0.5;
  float inBar = step(barBase, uv.y) * step(uv.y, barTop);

  float edge = smoothstep(0.02, 0.0, abs(uv.y - barTop));
  edge += smoothstep(0.02, 0.0, abs(uv.y - barBase));

  float glow = exp(-abs(uv.y - barTop) * 15.0) * smoothAmp;
  glow += exp(-abs(uv.y - barBase) * 15.0) * smoothAmp;

  vec3 barCol = palette(smoothAmp * 0.8 + 0.1) * inBar * (0.4 + smoothAmp * 0.6);
  vec3 edgeCol = palette(smoothAmp * 0.6 + 0.3) * edge;
  vec3 glowCol = palette(smoothAmp * 0.4 + 0.5) * glow * 0.5;

  col = barCol + edgeCol + glowCol;
  return col * uFreqTerrainOpacity;
}

vec3 dataStream(vec2 uv, float t, float audio) {
  vec2 gv = fract(uv * vec2(20.0, 1.0) + vec2(0.0, t * uDataStreamSpeed));
  float line = step(0.98, gv.x);
  float bits = step(0.9, hash21(floor(uv * vec2(20.0, 10.0) + vec2(0.0, t * 5.0))));
  return palette(fract(uv.x * 0.1 + t * 0.05)) * (line + bits) * uDataStreamOpacity * (1.0 + audio);
}

vec3 causticLiquid(vec2 uv, float t, float audio) {
  vec2 p = uv * 8.0;
  float swirl = 0.0;
  for (float i = 1.0; i < 5.0; i += 1.0) {
    p.x += 0.3 / i * sin(i * 3.0 * p.y + t * uCausticLiquidSpeed + 0.3 * i) + 0.5;
    p.y += 0.3 / i * sin(i * 3.0 * p.x + t * uCausticLiquidSpeed + 0.3 * i) + 0.5;
    swirl += length(p) * 0.05;
  }
  float c = sin(p.x + p.y + swirl) * 0.5 + 0.5;
  return palette(c) * smoothstep(0.0, 1.0, c) * uCausticLiquidOpacity * (1.0 + audio);
}

vec3 shimmerVeil(vec2 uv, float t, float audio) {
  float v = sin(uv.x * 10.0 + t) * sin(uv.y * uShimmerVeilComplexity + t * 0.5);
  float pattern = smoothstep(0.1, 0.0, abs(v));
  return palette(fract(t * 0.1)) * pattern * uShimmerVeilOpacity * (1.0 + audio);
}

// --- New 31 Generators Helper Functions ---
vec3 nebulaCloud(vec2 uv, float t, float audio) {
  vec2 p = uv * uNebulaCloudDensity;
  float n = fbm(p + t * uNebulaCloudSpeed);
  float n2 = fbm(p * 2.0 - t * uNebulaCloudSpeed * 0.5);
  vec3 col = palette(n + n2 + audio * 0.2);
  return col * pow(n, 3.0) * uNebulaCloudOpacity;
}

vec3 circuitBoard(vec2 uv, float t, float audio) {
  vec2 p = uv * uCircuitBoardComplexity;
  vec2 id = floor(p);
  vec2 f = fract(p);
  float h = hash21(id);
  float growth = fract(t * uCircuitBoardGrowth + h);
  float line = smoothstep(0.1, 0.0, abs(f.x - 0.5)) * step(f.y, growth);
  float node = smoothstep(0.2, 0.0, length(f - 0.5)) * step(0.9, h);
  return palette(h) * (line + node * (1.0 + audio)) * uCircuitBoardOpacity;
}

vec3 lorenzAttractor(vec2 uv, float t, float audio) {
  vec2 p = (uv - 0.5) * 2.0;
  float d = 10000000000.0;
  vec3 curr = vec3(0.1, 0.0, 0.0);
  float dt = 0.01 * uLorenzAttractorSpeed;
  for (float i = 0.0; i < 20.0; i += 1.0) {
    vec3 next;
    next.x = curr.x + dt * 10.0 * (curr.y - curr.x);
    next.y = curr.y + dt * (curr.x * (28.0 - curr.z) - curr.y);
    next.z = curr.z + dt * (curr.x * curr.y - (8.0/3.0) * curr.z);
    curr = next;
    d = min(d, length(p - curr.xy * 0.05 * uLorenzAttractorChaos));
  }
  return palette(t * 0.1) * smoothstep(0.05, 0.0, d) * uLorenzAttractorOpacity;
}

vec3 mandalaSpinner(vec2 uv, float t, float audio) {
  vec2 p = (uv - 0.5) * 2.0;
  p.x *= uAspect;
  float r = length(p);
  float a = atan(p.y, p.x) + t * uMandalaSpinnerSpeed;
  float sides = uMandalaSpinnerSides;
  a = mod(a, 6.28/sides) - 3.14/sides;
  p = vec2(cos(a), sin(a)) * r;
  float mask = smoothstep(0.02, 0.0, abs(p.y - sin(p.x * 10.0 + t) * 0.1));
  return palette(r + audio) * mask * uMandalaSpinnerOpacity;
}

vec3 starburstGalaxy(vec2 uv, float t, float audio) {
  vec2 p = (uv - 0.5) * 2.0;
  p.x *= uAspect;
  vec3 col = vec3(0.0);
  float count = clamp(uStarburstGalaxyCount, 10.0, 200.0);
  for (float i = 0.0; i < 200.0; i += 1.0) {
    if (i >= count) break;
    float h = hash21(vec2(i, 123.4));
    float h2 = hash21(vec2(i, 456.7));
    float burst = fract(t * uStarburstGalaxyForce * (0.5 + h2 * 0.5) + h);
    float angle = h * 6.28 + h2 * 0.5;
    vec2 dir = vec2(cos(angle), sin(angle));
    vec2 pos = dir * burst * 1.5;
    float size = mix(0.06, 0.02, burst);
    float star = smoothstep(size, 0.0, length(p - pos));
    float trail = smoothstep(size * 3.0, 0.0, length(p - pos)) * 0.3;
    float fade = (1.0 - burst) * (1.0 - burst);
    col += palette(fract(h + t * 0.05)) * (star + trail) * fade;
  }
  return col * uStarburstGalaxyOpacity * (1.0 + audio);
}

vec3 digitalRainV2(vec2 uv, float t, float audio) {
  vec2 p = uv * vec2(30.0, 1.0);
  float col_id = floor(p.x);
  float h = hash21(vec2(col_id, 456.7));
  float speed = uDigitalRainV2Speed * (0.5 + h);
  float drop = fract(uv.y + t * speed + h);
  float mask = step(0.9, fract(p.x)) * smoothstep(0.2, 0.0, abs(drop - 0.5));
  return palette(h) * mask * uDigitalRainV2Opacity * (1.0 + audio);
}

vec3 lavaFlow(vec2 uv, float t, float audio) {
  vec2 p = uv * 3.0;
  float n = fbm(p + vec2(t * 0.2 * uLavaFlowViscosity));
  float heat = clamp(n * uLavaFlowHeat + audio * 0.2, 0.0, 1.0);
  return palette(heat) * heat * uLavaFlowOpacity;
}

vec3 crystalGrowth(vec2 uv, float t, float audio) {
  vec2 p = (uv - 0.5) * 2.0;
  float d = 10000000000.0;
  for (float i = 0.0; i < 5.0; i += 1.0) {
    p = abs(p) - 0.5;
    p = rotate2d(p, t * uCrystalGrowthRate * 0.1);
    d = min(d, abs(p.x));
  }
  float edge = smoothstep(0.01 * uCrystalGrowthSharpness, 0.0, d);
  return palette(audio) * edge * uCrystalGrowthOpacity;
}

vec3 technoGrid3D(vec2 uv, float t, float audio) {
  vec2 p = uv * 2.0 - 1.0;
  float z = 1.0 / (abs(p.y) + 0.01);
  vec2 grid_uv = vec2(p.x * z, z + t * uTechnoGridSpeed);
  float grid = step(0.95, fract(grid_uv.x * 5.0)) + step(0.95, fract(grid_uv.y * 5.0));
  float towers = step(0.98, hash21(floor(grid_uv * 5.0))) * z * uTechnoGridHeight * 0.1;
  return palette(fract(z * 0.1 + t * 0.05)) * (grid + towers) * uTechnoGridOpacity * (1.0 + audio);
}

vec3 magneticField(vec2 uv, float t, float audio) {
  vec2 p = (uv - 0.5) * 2.0;
  vec3 col = vec3(0.0);
  float lines = uMagneticFieldDensity;
  for (float i = 0.0; i < 20.0; i += 1.0) {
    if (i >= float(lines)) break;
    float h = i / lines;
    vec2 force = vec2(sin(t + h * 6.28), cos(t * 0.5 + h * 6.28)) * uMagneticFieldStrength;
    float d = abs(length(p - force) - 0.5);
    col += palette(h) * smoothstep(0.02, 0.0, d);
  }
  return col * uMagneticFieldOpacity * (1.0 + audio);
}

vec3 prismShards(vec2 uv, float t, float audio) {
  vec2 p = uv;
  vec3 col = vec3(0.0);
  for (float i = 0.0; i < 5.0; i += 1.0) {
    if (i >= float(uPrismShardsCount)) break;
    vec2 pos = vec2(hash21(vec2(i, 1.1)), hash21(vec2(i, 2.2)));
    float dist = length(p - pos);
    float refract_val = uPrismShardsRefraction * sin(t + i);
    col += palette(dist + refract_val) * smoothstep(0.1, 0.0, dist);
  }
  return col * uPrismShardsOpacity * (1.0 + audio);
}

vec3 neuralNet(vec2 uv, float t, float audio) {
  vec2 p = uv * 10.0 * uNeuralNetDensity;
  vec2 id = floor(p);
  vec2 f = fract(p);
  float col = 0.0;
  for (float y = -1.0; y <= 1.0; y += 1.0) {
    for (float x = -1.0; x <= 1.0; x += 1.0) {
      vec2 neighbor = vec2(x, y);
      float h = hash21(id + neighbor);
      vec2 pt = neighbor + sin(t * uNeuralNetActivity + h * 6.28) * 0.5;
      float d = length(f - pt);
      col += smoothstep(0.1, 0.0, d);
    }
  }
  return palette(fract(t * 0.1)) * col * uNeuralNetOpacity * (1.0 + audio);
}

vec3 auroraChord(vec2 uv, float t, float audio) {
  float v = 0.0;
  for (float i = 0.0; i < 3.0; i += 1.0) {
    float shift = i * uAuroraChordColorRange;
    v += sin(uv.x * 5.0 + t + shift) * sin(uv.y * 2.0 - t * 0.5);
  }
  return palette(v * 0.2 + t * 0.1) * abs(v) * uAuroraChordOpacity * uAuroraChordWaviness;
}

vec3 vhsGlitch(vec2 uv, float t, float audio) {
  vec2 p = uv;
  p.x += (hash21(vec2(t, floor(uv.y * 10.0))) - 0.5) * uVhsGlitchJitter * 0.1;
  float noise = hash21(uv + t) * uVhsGlitchNoise;
  vec3 col = vec3(noise);
  if (abs(uv.y - fract(t)) < 0.01) col.r = 1.0;
  return col * uVhsGlitchOpacity * (1.0 + audio);
}

vec3 moirePattern(vec2 uv, float t, float audio) {
  vec2 p = (uv - 0.5) * uMoirePatternScale;
  float v1 = sin(p.x * 10.0 + t * uMoirePatternSpeed);
  vec2 p2 = rotate2d(p, t * 0.2);
  float v2 = sin(p2.x * 10.0);
  float moire = v1 * v2;
  return palette(moire * 0.5 + 0.5) * uMoirePatternOpacity * (1.0 + audio);
}

vec3 hypercube(vec2 uv, float t, float audio) {
  vec2 p = (uv - 0.5) * 2.0;
  float rot = t * uHypercubeSpeed;
  p = rotate2d(p, rot);
  float box = max(abs(p.x), abs(p.y));
  float inner = max(abs(p.x), abs(p.y)) * uHypercubeProjection;
  float mask = smoothstep(0.5, 0.48, box) - smoothstep(0.4, 0.38, box);
  mask += (smoothstep(0.3, 0.28, inner) - smoothstep(0.2, 0.18, inner));
  return palette(rot) * mask * uHypercubeOpacity * (1.0 + audio);
}

vec3 fluidSwirl(vec2 uv, float t, float audio) {
  vec2 p = uv;
  for (float i = 0.0; i < 3.0; i += 1.0) {
    p += sin(p.yx * 4.0 + t) * 0.1 * uFluidSwirlVorticity;
  }
  float swirl = length(p - uv);
  return palette(swirl * uFluidSwirlColorMix) * swirl * 10.0 * uFluidSwirlOpacity;
}

vec3 asciiStream(vec2 uv, float t, float audio) {
  vec2 p = floor(uv * uAsciiStreamResolution) / uAsciiStreamResolution;
  float h = hash21(p + floor(t * 10.0));
  float bright = (sin(uv.x * 10.0) + sin(uv.y * 10.0)) * 0.5 + 0.5;
  float mask = step(0.5, fract(h * 10.0));
  return palette(h) * mask * bright * uAsciiStreamContrast * uAsciiStreamOpacity;
}

vec3 retroWave(vec2 uv, float t, float audio) {
  vec2 p = uv * 2.0 - 1.0;
  p.x *= uAspect;
  
  // Custom standalone grid for retroWave
  float z = 1.0 / (abs(p.y + 0.1) + 0.01);
  vec2 grid_uv = vec2(p.x * z, z + t * uRetroWaveGridSpeed);
  float gridLine = step(0.95, fract(grid_uv.x * 5.0)) + step(0.95, fract(grid_uv.y * 5.0));
  float grid = gridLine * smoothstep(0.0, -0.5, p.y); // Only show grid on bottom half
  
  float sunDist = length(p - vec2(0.0, 0.3));
  float sun = smoothstep(uRetroWaveSunSize * 0.5, uRetroWaveSunSize * 0.48, sunDist);
  
  // Retro sun stripes
  if (p.y < 0.3 && fract(p.y * 15.0) < 0.25) sun = 0.0;
  
  vec3 sunCol = palette(0.9); 
  vec3 gridCol = palette(0.2); 
  
  return (sunCol * sun + gridCol * grid) * uRetroWaveOpacity * (1.0 + audio);
}

vec3 bubblePop(vec2 uv, float t, float audio) {
  vec2 p = uv * 5.0;
  vec2 id = floor(p);
  vec2 f = fract(p);
  float h = hash21(id);
  float size = fract(t * uBubblePopPopRate + h) * uBubblePopSize;
  float bubble = smoothstep(size, size - 0.02, length(f - 0.5));
  return palette(h) * bubble * uBubblePopOpacity * (1.0 + audio);
}

vec3 soundWave3D(vec2 uv, float t, float audio) {
  float z = 1.0 / (uv.y + 0.01);
  float wave = getWaveform(uv.x * uSoundWave3DSmoothness) * uSoundWave3DAmplitude;
  float d = abs(uv.y - 0.5 - wave * 0.2);
  return palette(wave) * smoothstep(0.02, 0.0, d) * uSoundWave3DOpacity;
}

vec3 particleVortex(vec2 uv, float t, float audio) {
  vec2 p = (uv - 0.5) * 2.0;
  float r = length(p);
  float a = atan(p.y, p.x) + t * uParticleVortexSpin + r * uParticleVortexSuction;
  vec2 pv = vec2(cos(a), sin(a)) * r;
  float dots = step(0.99, hash21(floor(pv * 20.0)));
  return palette(r) * dots * uParticleVortexOpacity * (1.0 + audio);
}

vec3 glowWorms(vec2 uv, float t, float audio) {
  vec2 p = uv;
  float worm = 0.0;
  for (float i = 0.0; i < 5.0; i += 1.0) {
    vec2 pos = vec2(sin(t * uGlowWormsSpeed + i), cos(t * 0.7 * uGlowWormsSpeed + i)) * 0.4 + 0.5;
    float d = length(p - pos);
    worm += exp(-d * (10.0 / uGlowWormsLength));
  }
  return palette(audio) * worm * uGlowWormsOpacity;
}

vec3 mirrorMaze(vec2 uv, float t, float audio) {
  vec2 p = (uv - 0.5) * 2.0;
  for (float i = 0.0; i < 8.0; i += 1.0) {
    if (i >= float(uMirrorMazeRecursion)) break;
    p = abs(p) - 0.2;
    p = rotate2d(p, uMirrorMazeAngle);
  }
  float d = length(p);
  return palette(d + t) * smoothstep(0.1, 0.0, d) * uMirrorMazeOpacity;
}

vec3 pulseHeart(vec2 uv, float t, float audio) {
  vec2 p = (uv - 0.5) * 2.0;
  float r = length(p);
  float pulse = sin(t * 5.0 * uPulseHeartBeats) * 0.1 + 0.5;
  float heart = 0.0;
  for (float i = 0.0; i < 10.0; i += 1.0) {
    if (i >= float(uPulseHeartLayers)) break;
    float radius = pulse * (i / uPulseHeartLayers);
    heart += smoothstep(radius, radius - 0.02, r) - smoothstep(radius - 0.04, radius - 0.06, r);
  }
  return palette(fract(pulse * 0.2 + audio)) * heart * uPulseHeartOpacity * (1.0 + audio);
}

vec3 dataShards(vec2 uv, float t, float audio) {
  vec2 p = (uv - 0.5) * 2.0;
  vec3 col = vec3(0.0);
  for (float i = 0.0; i < 5.0; i += 1.0) {
    float h = hash21(vec2(i, 88.8));
    vec2 dir = vec2(cos(t * uDataShardsSpeed + h * 6.28), sin(t * uDataShardsSpeed + h * 6.28));
    float shard = smoothstep(0.1 * uDataShardsSharpness, 0.0, abs(dot(p, dir) - h));
    col += palette(h) * shard;
  }
  return col * uDataShardsOpacity * (1.0 + audio);
}

vec3 hexCell(vec2 uv, float t, float audio) {
  vec2 p = uv * 10.0 * uHexCellScale;
  vec2 r = vec2(1.0, 1.73);
  vec2 h = r * 0.5;
  vec2 a = mod(p, r) - h;
  vec2 b = mod(p - h, r) - h;
  vec2 gv = dot(a, a) < dot(b, b) ? a : b;
  float d = length(gv);
  float pulse = sin(t * uHexCellPulse) * 0.1 + 0.4;
  float hex = smoothstep(pulse, pulse - 0.05, d);
  return palette(d) * hex * uHexCellOpacity * (1.0 + audio);
}

vec3 plasmaBall(vec2 uv, float t, float audio) {
  vec2 p = (uv - 0.5) * 2.0;
  float col = 0.0;
  for (float i = 0.0; i < 20.0; i += 1.0) {
    if (i >= float(uPlasmaBallFilaments)) break;
    float h = i * 123.4;
    vec2 target = vec2(sin(t + h), cos(t * 0.5 + h)) * 0.8;
    float line = smoothstep(0.02, 0.0, abs(length(p - target * sin(t)) - 0.1));
    col += line;
  }
  return palette(fract(t * 0.1 + audio)) * col * uPlasmaBallVoltage * uPlasmaBallOpacity;
}

vec3 warpDrive(vec2 uv, float t, float audio) {
  vec2 p = (uv - 0.5) * 2.0;
  float a = atan(p.y, p.x);
  float r = length(p);
  float streaks = step(0.95, hash21(vec2(floor(a * 20.0), 1.0)));
  float star = streaks * smoothstep(1.0, 0.0, fract(r - t * uWarpDriveWarp));
  return palette(fract(a * 0.1 + t * 0.05)) * star * uWarpDriveGlow * uWarpDriveOpacity * (1.0 + audio);
}

vec3 visualFeedback(vec2 uv, float t, float audio) {
  // This is a pseudo-feedback since we can't easily sample the backbuffer here     
  // We simulate it with recursive coordinate warping
  vec2 p = uv;
  float f = 0.0;
  for (float i = 0.0; i < 4.0; i += 1.0) {
    p = (p - 0.5) * uVisualFeedbackZoom + 0.5;
    p = rotate2d(p - 0.5, uVisualFeedbackRotation) + 0.5;
    f += fbm(p * 5.0 + t);
  }  return palette(f * 0.2) * f * 0.5 * uVisualFeedbackOpacity;
}

vec3 myceliumGrowth(vec2 uv, float t, float audio) {
  vec2 p = uv * 5.0;
  float n = fbm(p + t * 0.1 * uMyceliumGrowthSpread);
  float pattern = smoothstep(0.4, 0.5, n);
  pattern -= smoothstep(0.5, 0.6, n);
  float decay = exp(-t * uMyceliumGrowthDecay * 0.1);
  return palette(n + audio) * pattern * decay * uMyceliumGrowthOpacity;
}

// --- EDM Generator Functions ---
vec3 hueRotate(vec3 col, float hue) {
  float s = sin(hue);
  float c = cos(hue);
  mat3 rot = mat3(
    0.299 + 0.701*c + 0.168*s, 0.587 - 0.587*c + 0.330*s, 0.114 - 0.114*c - 0.497*s,
    0.299 - 0.299*c - 0.328*s, 0.587 + 0.413*c + 0.035*s, 0.114 - 0.114*c + 0.292*s,
    0.299 - 0.300*c + 1.250*s, 0.587 - 0.588*c - 1.050*s, 0.114 + 0.886*c - 0.203*s
  );
  return clamp(rot * col, 0.0, 1.0);
}

vec3 laserBeam(vec2 uv, float t, float audio) {
  vec2 centered = uv - 0.5;
  centered.x *= uAspect;
  vec3 color = vec3(0.0);
  float beamCount = (uLaserMode > 3.5) ? 1.0 : uLaserBeamCount;

  for (float i = 0.0; i < 16.0; i += 1.0) {
    if (i >= beamCount) break;

    float angle;
    vec2 beamOrigin = vec2(0.0);
    float beamLength = uLaserBeamLength;

    // Mode 0: Radial - beams emanate from center
    if (uLaserMode < 0.5) {
      angle = uLaserRotation + t * uLaserRotationSpeed + i * uLaserSpread / beamCount;
    }
    // Mode 1: Parallel - beams move horizontally
    else if (uLaserMode < 1.5) {
      angle = uLaserRotation;
      float yOffset = (i / beamCount - 0.5) * 0.8;
      beamOrigin = vec2(-0.5, yOffset);
    }
    // Mode 2: Crossing - beams cross in X pattern
    else if (uLaserMode < 2.5) {
      float side = mod(i, 2.0) < 0.5 ? 1.0 : -1.0;
      angle = uLaserRotation + t * uLaserRotationSpeed * side + (i * 0.2 - 0.5) * side;
      beamOrigin = vec2(-0.5 * side, -0.5);
    }
    // Mode 3: Scanning - single beam sweeps back and forth
    else {
      float sweep = sin(t * uLaserRotationSpeed + i * 0.5) * uLaserSpread * 0.5;
      angle = uLaserRotation + sweep;
    }
    // Mode 4: Distance Sweep - single beam across screen from far origin
    if (uLaserMode > 3.5) {
      float sweep = sin(t * uLaserRotationSpeed) * 0.6;
      angle = uLaserRotation;
      beamOrigin = vec2(-1.2, sweep);
      beamLength = 3.0;
    }

    vec2 dir = vec2(cos(angle), sin(angle));
    vec2 delta = centered - beamOrigin;

    // Distance to beam line
    float proj = dot(delta, dir);
    float perp = abs(dot(delta, vec2(-dir.y, dir.x)));

    // Beam visibility
    float inBeam = step(0.0, proj) * step(proj, beamLength);

    // Soft edge with audio-reactive width
    float width = uLaserBeamWidth * (1.0 + audio * uLaserAudioReact * 0.5);
    float beam = smoothstep(width, 0.0, perp) * inBeam;
    float glow = exp(-perp / (width * 4.0)) * uLaserGlow * inBeam * 0.5;

    // Color with optional shift
    vec3 beamColor = palette(0.3 + i * 0.1);
    if (uLaserColorShift > 0.0) {
      float hueShift = (i / beamCount + audio * uLaserAudioReact) * uLaserColorShift;
      beamColor = hueRotate(beamColor, hueShift * 6.28);
    }

    color += beamColor * (beam + glow);
  }
  return color * uLaserOpacity;
}

vec3 strobeFlash(vec2 uv, float t, float audio, float peak) {
  float beatPhase = fract(t * uStrobeRate * 0.5);
  float flash = step(beatPhase, uStrobeDutyCycle);

  // Audio trigger override: Force flash to 1.0 immediately on peak
  bool isHit = uStrobeAudioTrigger > 0.5 && peak > uStrobeThreshold;
  if (isHit) {
    flash = 1.0;
  }

  // Fade decay: only apply decay to the beat-synced flash OR the audio hit
  float fadeT = isHit ? 0.0 : beatPhase / max(uStrobeDutyCycle, 0.01);
  flash *= exp(-fadeT * (1.0 / max(uStrobeFadeOut, 0.01)));

  vec3 color = palette(1.0); // Use top of palette for white-ish flashes

  // Mode 0: White (mapped to palette peak)
  if (uStrobeMode < 0.5) {
    color = palette(1.0);
  }
  // Mode 1: Color (use palette)
  else if (uStrobeMode < 1.5) {
    color = palette(0.5);
  }
  // Mode 2: Rainbow
  else if (uStrobeMode < 2.5) {
    color = palette(fract(t * 0.2));
  }
  // Mode 3: Invert (handled in main)
  else {
    color = vec3(1.0);
  }

  // Pattern variation
  // Pattern 0: Solid (no modification)
  // Pattern 1: Scanlines
  if (uStrobePattern > 0.5 && uStrobePattern < 1.5) {
    flash *= step(0.5, fract(uv.y * 100.0));
  }
  // Pattern 2: Radial
  else if (uStrobePattern > 1.5) {
    flash *= 1.0 - smoothstep(0.0, 0.7, length(uv - 0.5) * 2.0);
  }

  return color * flash * uStrobeOpacity;
}

vec3 shapeBurst(vec2 uv, float t) {
  vec2 centered = uv - 0.5;
  centered.x *= uAspect;
  vec3 color = vec3(0.0);

  for (float i = 0.0; i < 8.0; i += 1.0) {
    if (uBurstActives[int(i)] < 0.5) continue;

    float age = t - uBurstSpawnTimes[int(i)];
    if (age < 0.0) continue;

    float size = uShapeBurstStartSize + age * uShapeBurstExpandSpeed;
    if (size > uShapeBurstMaxSize) continue;

    float fadeT = size / uShapeBurstMaxSize;
    float opacity = 1.0;

    // Fade mode: 0=size, 1=opacity, 2=both
    if (uShapeBurstFadeMode > 0.5) {
      opacity = 1.0 - fadeT;
    }

    float dist = length(centered);
    float shape = 0.0;

    // Shape 0: Ring
    if (uShapeBurstShape < 0.5) {
      shape = smoothstep(uShapeBurstThickness, 0.0, abs(dist - size * 0.5));
    }
    // Shape 1: Circle (filled)
    else if (uShapeBurstShape < 1.5) {
      shape = smoothstep(size * 0.5 + uShapeBurstThickness, size * 0.5, dist);
    }
    // Shape 2: Hexagon
    else if (uShapeBurstShape < 2.5) {
      float hex = sdHexagon(centered, size * 0.5);
      shape = smoothstep(uShapeBurstThickness, 0.0, abs(hex));
    }
    // Shape 3: Star
    else if (uShapeBurstShape < 3.5) {
      float star = sdStar(centered, size * 0.5, 5, 2.5);
      shape = smoothstep(uShapeBurstThickness, 0.0, abs(star));
    }
    // Shape 4: Triangle
    else {
      float tri = sdEquilateralTriangle(centered, size * 0.5);
      shape = smoothstep(uShapeBurstThickness, 0.0, abs(tri));
    }

    vec3 burstColor = palette(fract(float(i) * 0.15 + age * 0.5));
    color += burstColor * shape * opacity;
  }

  return color * uShapeBurstOpacity;
}

vec3 gridTunnel(vec2 uv, float t, float audio) {
  float speed = uGridTunnelSpeed * (1.0 + audio * uGridTunnelAudioReact);
  vec3 color = vec3(0.0);

  // Mode 0: Floor
  if (uGridTunnelMode < 0.5) {
    float y = uv.y - uGridTunnelHorizonY;
    if (abs(y) < 0.01) return color;

    float z = uGridTunnelPerspective / (abs(y) + 0.01);
    float x = (uv.x - 0.5) * z;

    float gridX = fract(x * uGridTunnelGridSize * 0.1);
    float gridZ = fract(z * uGridTunnelGridSize * 0.1 - t * speed);

    float lineX = smoothstep(uGridTunnelLineWidth, 0.0, min(gridX, 1.0 - gridX));
    float lineZ = smoothstep(uGridTunnelLineWidth, 0.0, min(gridZ, 1.0 - gridZ));
    float grid = max(lineX, lineZ);

    float fade = exp(-abs(y) * 3.0);
    float horizon = smoothstep(0.0, 0.1, abs(y));

    vec3 gridColor = palette(0.6);
    color = gridColor * grid * fade * horizon * (1.0 + uGridTunnelGlow);
  }
  // Mode 1: Tunnel
  else if (uGridTunnelMode < 1.5) {
    vec2 centered = uv - 0.5;
    centered.x *= uAspect;

    float r = length(centered);
    float angle = atan(centered.y, centered.x);

    float z = uGridTunnelPerspective / (r + 0.01);
    z = fract(z * 0.2 - t * speed * 0.5);

    float angleGrid = fract(angle / 6.28318 * uGridTunnelGridSize);

    float lineR = smoothstep(uGridTunnelLineWidth * 2.0, 0.0, min(z, 1.0 - z));
    float lineA = smoothstep(uGridTunnelLineWidth, 0.0, min(angleGrid, 1.0 - angleGrid));
    float grid = max(lineR, lineA);

    float fade = 1.0 - smoothstep(0.0, 0.5, r);

    vec3 gridColor = palette(0.7);
    color = gridColor * grid * fade * (1.0 + uGridTunnelGlow);
  }
  // Mode 2: Box
  else {
    vec2 centered = (uv - 0.5) * 2.0;
    centered.x *= uAspect;

    // Create a box perspective effect
    float z = fract(t * speed * 0.5);
    float scale = 1.0 + z * 2.0;
    vec2 scaled = centered * scale;

    // Box edges
    float boxDist = max(abs(scaled.x), abs(scaled.y));
    float boxLine = smoothstep(uGridTunnelLineWidth * scale, 0.0, abs(boxDist - 1.0));

    // Grid on surfaces
    float gridX = fract(scaled.x * uGridTunnelGridSize * 0.2);
    float gridY = fract(scaled.y * uGridTunnelGridSize * 0.2);
    float gridLine = smoothstep(uGridTunnelLineWidth, 0.0, min(gridX, 1.0 - gridX));
    gridLine = max(gridLine, smoothstep(uGridTunnelLineWidth, 0.0, min(gridY, 1.0 - gridY)));

    float fade = 1.0 - z;

    vec3 gridColor = palette(0.5 + z * 0.3);
    color = gridColor * (boxLine + gridLine * 0.5) * fade * (1.0 + uGridTunnelGlow);
  }

  return color * uGridTunnelOpacity;
}
// --- End EDM Generator Functions ---

${plasmaSource ? '#define HAS_CUSTOM_PLASMA' : ''}
${plasmaSource ?? ''}

void main() {
  vec2 uv = vUv;
  float low = 0.0;
  for (float i = 0.0; i < 8.0; i += 1.0) { low += uSpectrum[int(i)]; }
  low /= 8.0;
  float mid = 0.0;
  for (float i = 8.0; i < 24.0; i += 1.0) { mid += uSpectrum[int(i)]; }
  mid /= 16.0;
  float high = 0.0;
  for (float i = 24.0; i < 64.0; i += 1.0) { high += uSpectrum[int(i)]; }
  high /= 40.0;
  
  // Apply Motion Template Distortion
  if (uMotionTemplate > 0.5 && uMotionTemplate < 1.5) { // Radial
      vec2 centered = uv * 2.0 - 1.0;
      float r = length(centered);
      float a = atan(centered.y, centered.x);
      
      // Radial Core Semantic: Kick drives compression
      if (uMotionTemplate > 0.9 && uMotionTemplate < 1.1) {
          r *= (1.0 + low * 0.4); // Push outward on kick
      }
      
      uv = vec2(r, a / 6.2831 + 0.5);
  } else if (uMotionTemplate > 1.5 && uMotionTemplate < 2.5) { // Vortex
      vec2 centered = uv * 2.0 - 1.0;
      float r = length(centered);
      float torque = uTime * 0.2 + mid * 2.5; // Torque driven by mids
      float a = atan(centered.y, centered.x) + r * 3.1415 * (1.0 + sin(torque));
      uv = vec2(cos(a), sin(a)) * r * 0.5 + 0.5;
  } else if (uMotionTemplate > 4.5 && uMotionTemplate < 5.5) { // Organic
      vec2 noiseOffset = vec2(fbm(uv * 2.5 + uTime * 0.15), fbm(uv * 3.0 - uTime * 0.1));
      uv += (noiseOffset - 0.5) * 0.12;
  } else if (uMotionTemplate > 7.5) { // Vapor
      uv.y = 1.0 / (uv.y + 0.5); 
      uv.x = (uv.x - 0.5) * uv.y + 0.5;
      uv.y += uTime * 0.05; // Scents of movement
  }

  // Apply Transition Distortion
  if (uTransitionAmount > 0.01) {
    if (uTransitionType > 1.5 && uTransitionType < 2.5) { // Warp
      vec2 centered = uv * 2.0 - 1.0;
      float dist = length(centered);
      float angle = atan(centered.y, centered.x);
      angle += uTransitionAmount * 3.1415 * (1.0 - dist);
      float zoom = 1.0 - uTransitionAmount * 0.5;
      uv = vec2(cos(angle), sin(angle)) * dist * zoom * 0.5 + 0.5;
    } else if (uTransitionType > 2.5) { // Glitch
      float noiseVal = hash21(vec2(floor(uv.y * 40.0), uTime * 15.0));
      if (noiseVal < uTransitionAmount) {
        uv.x += (hash21(vec2(uTime * 20.0)) - 0.5) * uTransitionAmount * 0.3;
      }
    } else if (uTransitionType > 3.5) { // Dissolve
      float dNoise = noise(uv * 12.0 + uTime * 0.1);
      if (dNoise < uTransitionAmount * 1.2) {
        discard;
      }
    }
  }

  vec2 effectUv = kaleidoscope(uv, uKaleidoscope);
  
  // Speaker Cone (Woofer) distortion: apply before sampling any generators
  if (uSpeakerConeEnabled > 0.5) {
      effectUv = speakerCone(effectUv, low);
  }

  // Origami (Fold) distortion: coordinate warp
  if (uOrigamiEnabled > 0.5) {
      vec2 centered = effectUv * 2.0 - 1.0;
      float fold = sin((centered.x * 0.9 + centered.y * 0.4) * mix(2.5, 7.5, low) + uTime * 0.35 * uOrigamiSpeed);
      effectUv += normalize(centered + 0.0001) * fold * 0.05 * uOrigamiOpacity;
  }
  
  // Engine Grammar: Inertial Energy Accumulation
  // We use Time to simulate a decaying energy state that "charges" on audio peaks
  float lowEnergy = pow(low, 2.0 / uEngineElasticity);
  float midEnergy = pow(mid, 1.5 / uEngineElasticity);
  float highEnergy = pow(high, 1.0 / uEngineElasticity);

  // Apply Mass/Friction simulation (simulated via smoothing)
  low = mix(low, lowEnergy, 1.0 - uEngineMass);
  mid = mix(mid, midEnergy, 1.0 - uEngineMass);
  high = mix(high, highEnergy, 1.0 - uEngineMass);

  low = pow(low, 1.2);
  mid = pow(mid, 1.1);
  high = pow(high, 1.0);

  float gravityLens = 0.0;
  float gravityRing = 0.0;
  if (uGravityActive[0] > 0.5 || uGravityActive[1] > 0.5 || uGravityActive[2] > 0.5 || uGravityActive[3] > 0.5 ||
      uGravityActive[4] > 0.5 || uGravityActive[5] > 0.5 || uGravityActive[6] > 0.5 || uGravityActive[7] > 0.5) {
    vec2 centered = effectUv * 2.0 - 1.0;
    vec2 warp = vec2(0.0);
    float ringAcc = 0.0;
    float lens = 0.0;
    float tWarp = uTime * (1.0 - clamp(low, 0.0, 1.0) * 0.25);
    for (int i = 0; i < 8; i += 1) {
      if (uGravityActive[i] < 0.5) continue;
      vec2 well = uGravityPos[i];
      vec2 delta = centered - well;
      float dist = length(delta) + 0.001;
      float inv = uGravityStrength[i] / (dist * dist + 0.12);
      float polarity = uGravityPolarity[i];
      warp += normalize(delta) * inv * -0.08 * polarity;
      float ring = sin(dist * (8.0 + mid * 14.0) - tWarp * 2.2);
      ring *= smoothstep(0.6, 0.05, dist) * (0.4 + high);
      ringAcc += ring * inv;
      lens += inv * 0.2;
    }
    warp *= (1.0 + uGravityCollapse * 0.8);
    effectUv = clamp(effectUv + warp * 0.5, 0.0, 1.0);
    gravityLens = lens;
    gravityRing = ringAcc;
  }
  if (uFeedback > 0.01 || abs(uFeedbackZoom) > 0.01 || abs(uFeedbackRotation) > 0.01) {
    vec2 centered = effectUv * 2.0 - 1.0;
    float radius = length(centered);
    float angle = atan(centered.y, centered.x);
    
    // Twist from amount
    angle += uFeedback * radius * 2.0;
    
    // Explicit rotation
    angle += uFeedbackRotation;
    
    // Zoom/Scale (Zoom in if zoom > 0)
    float zoomFactor = 1.0 - uFeedbackZoom * 0.5;
    float stretch = 1.0 + uFeedback * 0.5;
    float newRadius = pow(radius * zoomFactor, stretch);
    
    effectUv = vec2(cos(angle), sin(angle)) * newRadius * 0.5 + 0.5;
  }
  if (uExpressiveRadialGravity > 0.01) {
    vec2 focus = vec2(uExpressiveRadialFocusX, uExpressiveRadialFocusY);
    vec2 toFocus = focus - effectUv;
    float dist = length(toFocus);
    float radius = mix(0.1, 1.2, clamp(uExpressiveRadialRadius, 0.0, 1.0));
    float strength = uExpressiveRadialGravity * clamp(uExpressiveRadialStrength, 0.0, 1.0);
    float falloff = smoothstep(radius, 0.0, dist);
    vec2 pull = normalize(toFocus + 0.0001) * strength * falloff * 0.12;
    effectUv = clamp(effectUv + pull, 0.0, 1.0);
  }
  vec3 color = vec3(0.0);
  if (uPlasmaEnabled > 0.5) {
    vec3 plasmaColor = samplePlasma(effectUv, uTime);
    color += plasmaColor * uPlasmaOpacity * uRoleWeights.x;
  }
  if (uPlasmaAssetEnabled > 0.5) {
    vec2 assetUv = effectUv;
    float audioMod = 1.0 + (uRms * 0.3 + uPeak * 0.5) * uPlasmaAssetAudioReact;
    vec2 centeredAssetUv = (assetUv - 0.5) / audioMod + 0.5;
    centeredAssetUv = clamp(centeredAssetUv, 0.0, 1.0);
    vec4 assetSample = texture(uPlasmaAsset, centeredAssetUv);
    vec3 assetColor = assetSample.rgb * (0.85 + audioMod * 0.15);
    float alpha = assetSample.a * clamp(uPlasmaOpacity, 0.0, 1.0) * uRoleWeights.x;
    color = applyBlendMode(color, assetColor, uPlasmaAssetBlend, alpha);
  }
  if (uSpectrumEnabled > 0.5) {
    float band = floor(effectUv.x * 64.0);
    int index = int(clamp(band, 0.0, 63.0));
    float amp = uSpectrum[index];
    float trail = uTrailSpectrum[index];
    float bar = step(effectUv.y, amp);
    float trailBar = step(effectUv.y, trail);
    color += palette(amp) * bar * 0.8 * uSpectrumOpacity * uRoleWeights.y;
    if (uPersistence > 0.01) { color += palette(trail) * trailBar * 0.5 * uPersistence * uRoleWeights.y; }
  }
  if (uSpectrumAssetEnabled > 0.5) {
    vec2 assetUv = effectUv;
    float band = floor(assetUv.x * 64.0);
    int specIndex = int(clamp(band, 0.0, 63.0));
    float specVal = uSpectrum[specIndex];
    float audioMod = 1.0 + (specVal * 0.4 + uRms * 0.3) * uSpectrumAssetAudioReact;
    vec2 centeredAssetUv = (assetUv - 0.5) / audioMod + 0.5;
    centeredAssetUv = clamp(centeredAssetUv, 0.0, 1.0);
    vec4 assetSample = texture(uSpectrumAsset, centeredAssetUv);
    vec3 assetColor = assetSample.rgb * (0.8 + audioMod * 0.2);
    float alpha = assetSample.a * clamp(uSpectrumOpacity, 0.0, 1.0) * uRoleWeights.y;
    color = applyBlendMode(color, assetColor, uSpectrumAssetBlend, alpha);
  }
  if (uMediaEnabled > 0.5 && uMediaAssetEnabled > 0.5) {
    vec2 assetUv = effectUv;
    float audioMod = 1.0 + (uRms * 0.3 + uPeak * 0.5) * uMediaAssetAudioReact;
    vec2 centeredAssetUv = (assetUv - 0.5) / audioMod + 0.5;
    centeredAssetUv = clamp(centeredAssetUv, 0.0, 1.0);
    vec4 assetSample = texture(uMediaAsset, centeredAssetUv);
    vec3 assetColor = assetSample.rgb * (0.85 + audioMod * 0.15);
    float alpha = assetSample.a * clamp(uMediaOpacity, 0.0, 1.0) * uRoleWeights.y;
    color = applyBlendMode(color, assetColor, uMediaAssetBlend, alpha);
  }
  if (uMediaEnabled > 0.5) {
      for (float i = 0.0; i < 8.0; i += 1.0) {
        float activeAmt = uMediaBurstActive[int(i)];
        if (activeAmt <= 0.01) continue;
        vec2 delta = effectUv - uMediaBurstPos[int(i)];
        float r = uMediaBurstRadius[int(i)];
        float w = 0.01 + activeAmt * 0.015;
        float type = uMediaBurstType[int(i)];
        float shape = 0.0;
        if (type < 0.5) {
          float dist = length(delta);
          shape = smoothstep(r + w, r, dist) * smoothstep(r, r - w * 2.2, dist);
        } else if (type < 1.5) {
          float t = sdEquilateralTriangle(delta, r);
          shape = smoothstep(w, 0.0, abs(t));
        } else {
          float line = smoothstep(w, 0.0, abs(delta.y)) * smoothstep(r, r - w * 6.0, abs(delta.x));
          shape = line;
        }
        vec3 burstColor = palette(fract(i * 0.17 + uPaletteShift * 0.2));
        color += burstColor * shape * activeAmt * uMediaOpacity * uRoleWeights.y;
      }  }
  if (uGlyphEnabled > 0.5) {
    vec2 grid = vec2(18.0, 10.0);
    vec2 cell = floor(effectUv * grid);
    vec2 local = fract(effectUv * grid) - 0.5;
    float cellId = cell.x + cell.y * grid.x;
    float band = floor((cell.x / grid.x) * 8.0);
    int bandIndex = int(clamp(band, 0.0, 7.0));
    float bandVal = uSpectrum[bandIndex * 8];
    float complexity = clamp(0.3 + bandVal * 0.8 + uGlyphBeat * 0.4, 0.0, 1.0);
    float seed = uGlyphSeed + cellId * 0.37 + band * 2.1 + floor(uGlyphBeat * 4.0) * 7.0;
    if (uGlyphMode < 0.5) { local.y += (mod(cell.x, 3.0) - 1.0) * (0.08 + bandVal * 0.12); }
    else if (uGlyphMode < 1.5) { local = rotate2d(local, uTime * 0.15 * uGlyphSpeed + cellId * 0.12); }
    else if (uGlyphMode < 2.5) { local += normalize(local + 0.0001) * (uGlyphBeat * 0.35 + bandVal * 0.12); }
    else { local.x += sin(uTime * 0.2 * uGlyphSpeed + cell.y * 0.6) * 0.2; local.y += (cell.x / grid.x - 0.5) * 0.12; }
    if (uGlyphMode > 2.5) { local.y += (mod(cell.y, 4.0) - 1.5) * 0.06; local.x += sin(uTime * 0.2 * uGlyphSpeed + cell.y * 0.8) * 0.06; }
    float dist = glyphShape(local, seed, band, complexity);
    float stroke = smoothstep(0.04, 0.0, dist);
    vec3 glyphColor = palette(fract(float(bandIndex) * 0.15 + uTime * 0.05));
    glyphColor *= 0.55 + complexity * 0.75;
    color += glyphColor * stroke * uGlyphOpacity * uRoleWeights.y;
  }
  if (uCrystalEnabled > 0.5) {
    vec2 centered = effectUv * 2.0 - 1.0;
    float alignment = smoothstep(0.2, 0.7, uRms);
    float bassStability = clamp(low * 1.4, 0.0, 1.0);
    float timeScale = uCrystalSpeed > 0.01 ? uCrystalSpeed : 1.0;
    float cell = crystalField(centered, uTime * 0.02 * timeScale + uCrystalMode * 2.0, mix(4.0, 10.0, bassStability) * (uCrystalScale > 0.01 ? uCrystalScale : 1.0));
    float shard = smoothstep(0.22, 0.02, cell);
    float growth = mix(0.35, 0.9, alignment) + mid * 0.2;
    vec3 base = palette(0.1), core = palette(0.5), caustic = palette(0.9);
    vec3 crystal = mix(base, core, (1.0 - cell) * (0.6 + bassStability * 0.6));
    crystal += caustic * smoothstep(0.1, 0.0, cell - high * 0.05) * clamp(uPeak - uRms, 0.0, 1.0) * (0.6 + high);
    crystal *= growth + (uCrystalMode < 0.5 ? 0.15 : uCrystalMode < 1.5 ? 0.35 : uCrystalMode < 2.5 ? 0.7 : 0.05);
    crystal *= 0.4 + (1.0 - clamp(uCrystalBrittleness, 0.0, 1.0)) * 0.6;
    color += crystal * shard * uCrystalOpacity * uRoleWeights.y;
  }
  if (uInkEnabled > 0.5) {
    vec2 centered = effectUv * 2.0 - 1.0;
    float flowScale = mix(1.5, 4.0, uRms) * uInkScale;
    vec2 flow = vec2(sin(centered.y * flowScale + uTime * 0.4 * uInkSpeed + uPeak * 1.2), cos(centered.x * flowScale - uTime * 0.35 * uInkSpeed + uRms));
    flow += vec2(-centered.y, centered.x) * (0.25 + uPeak * 0.5);
    if (uGlyphBeat > 0.1) flow = vec2(flow.y, -flow.x);
    vec2 inkUv = effectUv + flow * 0.08;
    float stroke = smoothstep(0.6, 0.0, abs(sin((inkUv.x + inkUv.y) * 18.0 * uInkScale + uTime * 0.6 * uInkSpeed))) * (0.4 + uInkPressure * 0.8);
    vec3 inkColor = palette(uInkBrush < 0.5 ? 0.1 : uInkBrush < 1.5 ? 0.4 : 0.7);
    if (uInkBrush > 0.5 && uInkBrush < 1.5) stroke *= 0.6 + abs(sin(inkUv.x * 12.0 + uTime * 0.4 * uInkSpeed)) * 0.6;
    color += inkColor * stroke * mix(0.3, 0.9, uInkLifespan) * uInkOpacity * uRoleWeights.z;
  }
  if (uTopoEnabled > 0.5) {
    vec2 centered = (effectUv * 2.0 - 1.0) * (2.0 - clamp(uTopoScale, 0.1, 1.9));
    float travel = uTopoTravel + uTopoPlate * 0.4;
    vec2 flow = centered + vec2(travel * 0.4, travel * 0.2);
    float elevation = (low * 0.6 + mid * 0.3 + high * 0.1) * uTopoElevation;
    float terrain = (abs(sin(flow.x * 2.4 + travel) + cos(flow.y * 2.2 - travel)) * 0.35) * (0.6 + elevation) + elevation * 0.6;
    terrain += uTopoQuake * 0.6 * sin(flow.x * 6.0 + uTime * 1.4);
    terrain -= uTopoSlide * 0.5 * smoothstep(0.2, 0.9, terrain);
    float mask = smoothstep(0.12, 0.02, abs(sin(terrain * mix(6.0, 18.0, high))) * mix(0.2, 1.0, mid));
    color += mix(palette(0.2), palette(0.6), clamp(terrain, 0.0, 1.0)) * mask * uTopoOpacity * uRoleWeights.z;
  }
  if (uWeatherEnabled > 0.5) {
    vec2 centered = effectUv * 2.0 - 1.0;
    float pressure = low * 1.2 + uWeatherIntensity * 0.4;
    vec2 flow = vec2(sin(centered.y * 1.6 + uTime * 0.2 * uWeatherSpeed), cos(centered.x * 1.4 - uTime * 0.18 * uWeatherSpeed));
    flow += vec2(-centered.y, centered.x) * (0.2 + (uWeatherMode > 2.5 ? 1.0 : 0.0) * 0.6) * (0.4 + pressure);
    vec2 wUv = effectUv + flow * (0.08 + mid * 1.1 * 0.15);
    float cloud = smoothstep(0.1, 0.7, (sin(wUv.x * 3.2 + uTime * 0.1 * uWeatherSpeed) + cos(wUv.y * 2.6 - uTime * 0.08 * uWeatherSpeed)) * 0.35 + pressure);
    vec3 cCol = mix(palette(0.1), palette(0.3), cloud);
    if (uWeatherMode < 0.5) cCol = mix(cCol, palette(0.2), 1.0);
    else if (uWeatherMode < 2.5) cCol = mix(cCol, palette(0.4), 1.0);
    float pHigh = high * 1.2 + uWeatherIntensity * 0.2;
    float rain = smoothstep(0.6, 0.0, abs(sin((wUv.x + uTime * 0.4 * uWeatherSpeed) * 30.0)) * pHigh) * (uWeatherMode < 0.5 || uWeatherMode > 2.5 ? 1.0 : 0.0);
    float snow = smoothstep(0.65, 0.0, abs(sin((wUv.y - uTime * 0.2 * uWeatherSpeed) * 18.0)) * pHigh) * (uWeatherMode > 0.5 && uWeatherMode < 1.5 ? 1.0 : 0.0);
    color += (cCol * cloud + palette(0.6) * rain + palette(0.9) * snow + palette(1.0) * smoothstep(0.9, 1.0, pHigh) * (uWeatherMode < 0.5 ? 1.0 : 0.0) * uGlyphBeat) * (0.5 + uWeatherIntensity * 0.6) * uWeatherOpacity * uRoleWeights.z;
  }
  if (uPortalEnabled > 0.5) {
    vec2 centered = effectUv * 2.0 - 1.0;
    vec2 warp = vec2(0.0); float ringGlow = 0.0;
    float style = clamp(uPortalStyle, 0.0, 2.0);
    float ringWidth = mix(0.02, 0.05, step(0.5, style));
    ringWidth = mix(ringWidth, 0.08, step(1.5, style));
    for (int i = 0; i < 4; i += 1) {
      if (uPortalActive[i] < 0.5) continue;
      vec2 delta = centered - uPortalPos[i]; float dist = length(delta), rad = uPortalRadius[i];
      ringGlow += smoothstep(rad + ringWidth, rad, dist) * smoothstep(rad - ringWidth, rad - ringWidth * 2.5, dist);
      warp += normalize(delta + 0.0001) * (rad - dist) * mix(0.06, 0.12, step(1.5, style));
    }
    effectUv = clamp(effectUv + warp * mix(0.45, 0.6, step(0.5, style)), 0.0, 1.0);
    vec3 baseCol = palette(0.2);
    if (style > 0.5 && style < 1.5) baseCol = palette(0.5);
    if (style >= 1.5) baseCol = palette(0.8);
    color += (baseCol + palette(0.9) * uPortalShift) * ringGlow * uPortalOpacity * uRoleWeights.z;
  }
  if (uOscilloEnabled > 0.5) {
    vec2 centered = effectUv * 2.0 - 1.0;
    float rot = uOscilloRotate * 0.6 + uTime * 0.12 * (1.0 - uOscilloFreeze), minDist = 10.0, arcGlow = 0.0;
    for (float i = 0.0; i < 64.0; i += 1.0) {
      float t = i / 63.0, rad = 0.28 + oscilloSample(t) * 0.22 + uRms * 0.12;
      vec2 p = rotate2d(vec2(cos(t * 6.28318 * (1.0 + floor(uOscilloMode) * 0.35)), sin(t * 6.28318 * (1.0 + floor(uOscilloMode) * 0.35))) * rad, rot);
      minDist = min(minDist, length(centered - p));
      arcGlow += smoothstep(0.08, 0.0, abs(length(centered) - (rad + 0.06 * sin(t * 12.0 + uTime * 0.3)))) * 0.2;
    }
    color += (mix(palette(0.1), palette(0.3), uSpectrum[28]) * (0.6 + smoothstep(0.2, 0.7, uRms) * 0.5) + mix(palette(0.2), palette(0.4), uSpectrum[8]) * (0.2 + uPeak * 0.6) + palette(0.6) * arcGlow) * (smoothstep(0.07, 0.0, minDist) + smoothstep(0.18, 0.0, minDist) * 0.35 + arcGlow) * uOscilloOpacity * uRoleWeights.y;
  }
  if (gravityLens > 0.0 || gravityRing > 0.0) color += (palette(0.1) * gravityLens + palette(0.4) * gravityRing * (0.4 + high)) * uRoleWeights.z;
  if (uOrigamiEnabled > 0.5) {
    vec2 centered = effectUv * 2.0 - 1.0;
    float sharp = mix(0.12, 0.02, clamp(uOrigamiFoldSharpness, 0.0, 1.0));
    // High-contrast crease lines
    float foldField = abs(sin((centered.x * 0.9 + centered.y * 0.4) * mix(2.5, 7.5, low) + uTime * 0.35 * uOrigamiSpeed));
    float crease = smoothstep(sharp, 0.0, foldField);
    
    vec3 creaseCol = palette(0.9) * (0.5 + high * 0.5);
    color += creaseCol * crease * uOrigamiOpacity * uRoleWeights.y;
  }
  if (uParticlesEnabled > 0.5) color += palette(0.5) * particleField(effectUv, uTime, uParticleDensity, uParticleSpeed, uParticleSize) * uParticleGlow * (0.5 + uRms * 0.8) * uRoleWeights.z;
  if (uSdfEnabled > 0.5) {
    vec2 centered = effectUv * 2.0 - 1.0;
    if (uAdvancedSdfEnabled > 0.5) {
      vec2 uv = centered * vec2(uAspect, 1.0);
      vec3 ro = uCameraPos;
      vec3 rd = getRayDirection(uv, ro, uCameraTarget, uCameraFov);
      float t = 0.0; vec2 res = vec2(0.0); bool hit = false;
      for (float i = 0.0; i < 64.0; i += 1.0) {
        vec3 p = ro + rd * t; res = advancedSdfMap(p); 
        if (res.x < 0.001) { hit = true; break; }
        if (t > 10.0) break;
        t += res.x;
      }
      if (hit) {
        vec3 p = ro + rd * t, n = calcSdfNormal(p), l = normalize(uSdfLightDir);
        float diff = max(dot(n, l), 0.0) * uSdfLightIntensity;
        float amb = 0.2;
        float shadow = uSdfShadowsEnabled > 0.5 ? calcSdfShadow(p, l, 8.0) : 1.0;
        float ao = uSdfAoEnabled > 0.5 ? calcSdfAO(p, n) : 1.0;
        vec3 lighting = uSdfLightColor * (diff * shadow + amb) * ao;
        float spec = pow(max(dot(reflect(-l, n), -rd), 0.0), 32.0) * 0.5 * shadow;
        
        // Dynamic sampling based on internal source
        vec3 baseCol = getSdfColor(res.y);
        if (uInternalSource > 0.5) {
            float sampleVal = getWaveform(fract(res.y * 0.123 + uTime * 0.1));
            baseCol = mix(baseCol, vec3(sampleVal), 0.5);
        }
        
        baseCol *= uSdfColor;
        color += (baseCol * lighting + spec + smoothstep(0.1, 0.0, res.x) * uSdfGlow) * uSdfFill * uRoleWeights.y;
      }
    } else {
      centered = rotate2d(centered, uSdfRotation); 
      float scale = mix(0.2, 0.9, uSdfScale);
      float sdfValue;
      if (uSdfShape < 0.5) sdfValue = sdCircle(centered, scale);
      else if (uSdfShape < 1.5) sdfValue = sdBox(centered, vec2(scale));
      else if (uSdfShape < 2.5) sdfValue = sdEquilateralTriangle(centered, scale);
      else if (uSdfShape < 3.5) sdfValue = sdHexagon(centered, scale);
      else if (uSdfShape < 4.5) sdfValue = sdStar(centered, scale, 5, 2.0);
      else sdfValue = sdRing(centered, scale, uSdfEdge * 0.5);
      
      color += uSdfColor * max(smoothstep(0.02, -0.02, sdfValue) * uSdfFill, smoothstep(uSdfEdge + 0.02, 0.0, abs(sdfValue)) * uSdfGlow) * (0.85 + uPeak * 0.6) * uRoleWeights.y;
    }
  }

  // --- Rock Generators ---
  if (uLightningEnabled > 0.5) {
    float lightningVal = lightningBolt(effectUv, uTime, high);
    vec3 lightningCol = palette(uLightningColor < 0.5 ? 0.2 : (uLightningColor < 1.5 ? 0.5 : 0.8));
    color += lightningCol * lightningVal * uRoleWeights.y;
  }
  
  if (uAnalogOscilloEnabled > 0.5) {
    float oscVal = analogOscillo(effectUv, uTime, mid);
    vec3 oscCol = palette(uAnalogOscilloColor < 0.5 ? 0.1 : (uAnalogOscilloColor < 1.5 ? 0.4 : 0.7));
    color += oscCol * oscVal * uRoleWeights.x;
  }
  
  if (uGlitchScanlineEnabled > 0.5) {
    color += glitchScanline(effectUv, uTime, low) * uRoleWeights.z;
  }
  
  if (uLaserStarfieldEnabled > 0.5) {
    color += laserStarfield(effectUv, uTime, high) * uRoleWeights.x;
  }
  if (uPulsingRibbonsEnabled > 0.5) {
    color += pulsingRibbons(effectUv, uTime, mid) * uRoleWeights.y;
  }
  if (uElectricArcEnabled > 0.5) {
    color += electricArc(effectUv, uTime, mid) * uRoleWeights.z;
  }
  if (uPyroBurstEnabled > 0.5) {
    color += pyroBurst(effectUv, uTime, uPeak) * uRoleWeights.y;
  }
  if (uGeoWireframeEnabled > 0.5) {
    color += geoWireframe(effectUv, uTime, low) * uRoleWeights.x;
  }
  if (uSignalNoiseEnabled > 0.5) {
    color += signalNoise(effectUv, uTime) * uRoleWeights.z;
  }

  if (uWormholeEnabled > 0.5) {
    color += infiniteWormhole(effectUv, uTime, low) * uRoleWeights.x;
  }
  if (uRibbonTunnelEnabled > 0.5) {
    color += ribbonTunnel(effectUv, uTime, mid) * uRoleWeights.y;
  }
  if (uFractalTunnelEnabled > 0.5) {
    color += fractalTunnel(effectUv, uTime, low) * uRoleWeights.x;
  }
  if (uCircuitConduitEnabled > 0.5) {
    color += circuitConduit(effectUv, uTime, low) * uRoleWeights.z;
  }

  if (uAuraPortalEnabled > 0.5) {
    color += auraPortal(effectUv, uTime, low) * uRoleWeights.x;
  }
  if (uFreqTerrainEnabled > 0.5) {
    color += frequencyTerrain(effectUv, uTime, mid) * uRoleWeights.y;
  }
  if (uDataStreamEnabled > 0.5) {
    color += dataStream(effectUv, uTime, low) * uRoleWeights.z;
  }
  if (uCausticLiquidEnabled > 0.5) {
    color += causticLiquid(effectUv, uTime, mid) * uRoleWeights.x;
  }
  if (uShimmerVeilEnabled > 0.5) {
    color += shimmerVeil(effectUv, uTime, high) * uRoleWeights.y;
  }

  // --- New 31 Generators Accumulation ---
  if (uNebulaCloudEnabled > 0.5) color += nebulaCloud(effectUv, uTime, high) * uRoleWeights.z;
  if (uCircuitBoardEnabled > 0.5) color += circuitBoard(effectUv, uTime, mid) * uRoleWeights.z;
  if (uLorenzAttractorEnabled > 0.5) color += lorenzAttractor(effectUv, uTime, low) * uRoleWeights.y;
  if (uMandalaSpinnerEnabled > 0.5) color += mandalaSpinner(effectUv, uTime, mid) * uRoleWeights.y;
  if (uStarburstGalaxyEnabled > 0.5) color += starburstGalaxy(effectUv, uTime, high) * uRoleWeights.y;
  if (uDigitalRainV2Enabled > 0.5) color += digitalRainV2(effectUv, uTime, low) * uRoleWeights.z;
  if (uLavaFlowEnabled > 0.5) color += lavaFlow(effectUv, uTime, low) * uRoleWeights.z;
  if (uCrystalGrowthEnabled > 0.5) color += crystalGrowth(effectUv, uTime, high) * uRoleWeights.z;
  if (uTechnoGridEnabled > 0.5) color += technoGrid3D(effectUv, uTime, low) * uRoleWeights.z;
  if (uMagneticFieldEnabled > 0.5) color += magneticField(effectUv, uTime, high) * uRoleWeights.z;
  if (uPrismShardsEnabled > 0.5) color += prismShards(effectUv, uTime, high) * uRoleWeights.y;
  if (uNeuralNetEnabled > 0.5) color += neuralNet(effectUv, uTime, mid) * uRoleWeights.z;
  if (uAuroraChordEnabled > 0.5) color += auroraChord(effectUv, uTime, mid) * uRoleWeights.z;
  if (uVhsGlitchEnabled > 0.5) color += vhsGlitch(effectUv, uTime, low) * uRoleWeights.z;
  if (uMoirePatternEnabled > 0.5) color += moirePattern(effectUv, uTime, high) * uRoleWeights.y;
  if (uHypercubeEnabled > 0.5) color += hypercube(effectUv, uTime, mid) * uRoleWeights.x;
  if (uFluidSwirlEnabled > 0.5) color += fluidSwirl(effectUv, uTime, mid) * uRoleWeights.z;
  if (uAsciiStreamEnabled > 0.5) color += asciiStream(effectUv, uTime, high) * uRoleWeights.z;
  if (uRetroWaveEnabled > 0.5) color += retroWave(effectUv, uTime, low) * uRoleWeights.x;
  if (uBubblePopEnabled > 0.5) color += bubblePop(effectUv, uTime, uPeak) * uRoleWeights.y;
  if (uSoundWave3DEnabled > 0.5) color += soundWave3D(effectUv, uTime, mid) * uRoleWeights.y;
  if (uParticleVortexEnabled > 0.5) color += particleVortex(effectUv, uTime, low) * uRoleWeights.z;
  if (uGlowWormsEnabled > 0.5) color += glowWorms(effectUv, uTime, mid) * uRoleWeights.z;
  if (uMirrorMazeEnabled > 0.5) color += mirrorMaze(effectUv, uTime, high) * uRoleWeights.y;
  if (uPulseHeartEnabled > 0.5) color += pulseHeart(effectUv, uTime, low) * uRoleWeights.x;
  if (uDataShardsEnabled > 0.5) color += dataShards(effectUv, uTime, high) * uRoleWeights.z;
  if (uHexCellEnabled > 0.5) color += hexCell(effectUv, uTime, mid) * uRoleWeights.z;
  if (uPlasmaBallEnabled > 0.5) color += plasmaBall(effectUv, uTime, uPeak) * uRoleWeights.z;
  if (uWarpDriveEnabled > 0.5) color += warpDrive(effectUv, uTime, high) * uRoleWeights.x;
  if (uVisualFeedbackEnabled > 0.5) color += visualFeedback(effectUv, uTime, mid) * uRoleWeights.y;
  if (uMyceliumGrowthEnabled > 0.5) color += myceliumGrowth(effectUv, uTime, mid) * uRoleWeights.z;
  // --- End New 31 Generators ---

  // --- EDM Generators ---
  // Laser Beam Generator
  if (uLaserEnabled > 0.5) {
    float audio = uRms * 0.5 + uPeak * 0.5;
    color += laserBeam(effectUv, uTime, audio) * uRoleWeights.y;
  }

  // Grid Tunnel Generator
  if (uGridTunnelEnabled > 0.5) {
    float audio = low; // Bass drives grid
    color += gridTunnel(effectUv, uTime, audio) * uRoleWeights.z;
  }

  // Shape Burst Generator
  if (uShapeBurstEnabled > 0.5) {
    color += shapeBurst(effectUv, uTime) * uRoleWeights.y;
  }

  // Strobe Flash Effect (added last for maximum impact)
  if (uStrobeEnabled > 0.5) {
    float audio = uRms * 0.3 + uPeak * 0.7;
    vec3 strobeCol = strobeFlash(effectUv, uTime, audio, uPeak);
    // Mode 3: Invert - invert colors instead of adding
    if (uStrobeMode > 2.5 && strobeCol.r > 0.1) {
      color = vec3(1.0) - color;
    } else {
      color += strobeCol;
    }
  }
  // --- End EDM Generators ---

  // Strobe addition logic: only add if enabled
  if (uStrobeEnabled > 0.5) {
    color += vec3(uStrobe * 1.5);
  }

  // Opinionated Engine Glow (HDR-style accumulation)
  if (uEffectsEnabled > 0.5) {
      vec3 glow = pow(color, vec3(2.2)) * uBloom * uMaxBloom;
      glow *= (0.7 + high * 0.5); // Boost glow based on spectral energy
      color += glow;
      
      if (uForceFeedback > 0.5) {
          color = mix(color, color * color, 0.15 * low); // Organic feedback-like saturation
      }
      
      color = posterize(color, uPosterize);
  }

  if (uEffectsEnabled > 0.5 && uChroma > 0.01) color = mix(color, vec3(color.r + uChroma * 0.02, color.g, color.b - uChroma * 0.02), 0.3);
  if (uEffectsEnabled > 0.5 && uBlur > 0.01) color = mix(color, vec3((color.r + color.g + color.b) / 3.0), uBlur * 0.3);
  color = shiftPalette(color, uPaletteShift);
  color = applySaturation(color, uSaturation);
  color = applyContrast(color, uContrast);
  color = color / (vec3(1.0) + color);
  color = pow(color, vec3(1.0 / 1.35));
  color *= uGlobalColor;

  // --- Engine Finish (Aesthetic Polish) ---
  // 1. Chromatic Aberration
  if (uEngineCA > 0.01) {
      float ca = uEngineCA * 0.015;
      vec2 dist = uv - 0.5;
      color.r = mix(color.r, color.r + ca * dist.x, 0.5);
      color.b = mix(color.b, color.b - ca * dist.y, 0.5);
  }

  // 2. Film Grain
  if (uEngineGrain > 0.01) {
      float grain = hash21(uv + uTime) * uEngineGrain * 0.08;
      color += grain;
  }

  // 3. Vignette
  if (uEngineVignette > 0.01) {
      float vig = length(uv - 0.5);
      color *= smoothstep(0.8, 0.2, vig * uEngineVignette);
  }

  // --- Engine Signature (Unique Identity) ---
  if (uEngineSignature > 0.5) {
      if (uEngineSignature < 1.5) { // Radial Core: Energy Halo
          float halo = 1.0 - smoothstep(0.3, 0.5, length(uv - 0.5));
          if (any(greaterThan(color, vec3(0.001)))) {
              color += color * halo * 0.15 * low;
          }
      } else if (uEngineSignature < 2.5) { // Particle Flow: Organic Grit
          float grit = fbm(uv * 20.0 + uTime * 0.05);
          if (any(greaterThan(color, vec3(0.001)))) {
              color = mix(color, color * (0.8 + grit * 0.4), 0.2);
          }
      } else if (uEngineSignature < 3.5) { // Kaleido Pulse: Digital Interference
          float line = step(0.98, fract(uv.y * 100.0 + uTime * 2.0));
          if (any(greaterThan(color, vec3(0.001)))) {
              color += vec3(line) * 0.05 * high;
          }
      } else if (uEngineSignature > 3.5) { // Vapor Grid: Retro Scanlines
          float scan = sin(uv.y * 400.0) * 0.04;
          color *= (1.0 - scan * low);
      }
  }

  // Final Safety Check: Prevent retina-burning white-out
  float totalLuma = dot(color, vec3(0.299, 0.587, 0.114));
  if (totalLuma > 0.92) {
      color *= (0.92 / totalLuma);
  }

  if (uDebugTint > 0.5) color += vec3(0.02, 0.0, 0.0);
  outColor = vec4(color, 1.0);
}
`;

  let currentPalette: [number, number, number][] = [
    [0.05, 0.0, 0.15], // Deep Purple
    [0.0, 0.0, 0.8],   // Blue
    [0.0, 0.8, 0.8],   // Cyan
    [0.9, 0.0, 0.6],   // Magenta
    [1.0, 1.0, 1.0]    // White
  ];
  let advancedSdfProgram: WebGLProgram | null = null;
  let advancedSdfUniforms: any[] = [];
  let advancedSdfUniformLocations: Map<string, WebGLUniformLocation | null> = new Map();
  
  const waveformTexture = gl.createTexture();
  const spectrumTexture = gl.createTexture();
  const modulatorTexture = gl.createTexture();
  const midiTexture = gl.createTexture();

  const initInternalTextures = () => {
    [waveformTexture, spectrumTexture, modulatorTexture, midiTexture].forEach(tex => {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    });
  };
  initInternalTextures();

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

  let standardProgram = createProgram(vertexShaderSrc, createFragmentShaderSrc());
  if (!standardProgram) {
    throw new Error('Failed to compile standard shader program.');
  }
  let currentProgram = standardProgram;
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
      const fSource = createFragmentShaderSrc(
        uniformsCode,
        compiled.functionsCode,
        compiled.mapBody,
        customPlasmaSource
      );
      const newProg = createProgram(vertexShaderSrc, fSource);
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

  const positionBuffer = gl.createBuffer();
  if (!positionBuffer) throw new Error('Buffer creation failed');
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

  const updateStandardUniforms = (prog: WebGLProgram, state: RenderState) => {
    gl.useProgram(prog);
    const getLocation = (name: string) => {
      const loc = gl.getUniformLocation(prog, name);
      if (!loc && !missingUniforms.has(name)) {
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
    // EDM Generators
    gl.uniform1f(getLocation('uLaserEnabled'), state.laserEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uLaserOpacity'), state.laserOpacity ?? 1.0);
    gl.uniform1f(getLocation('uLaserBeamCount'), state.laserBeamCount ?? 4);
    gl.uniform1f(getLocation('uLaserBeamWidth'), state.laserBeamWidth ?? 0.02);
    gl.uniform1f(getLocation('uLaserBeamLength'), state.laserBeamLength ?? 1.0);
    gl.uniform1f(getLocation('uLaserRotation'), state.laserRotation ?? 0);
    gl.uniform1f(getLocation('uLaserRotationSpeed'), state.laserRotationSpeed ?? 0.5);
    gl.uniform1f(getLocation('uLaserSpread'), state.laserSpread ?? 1.57);
    gl.uniform1f(getLocation('uLaserMode'), state.laserMode ?? 0);
    gl.uniform1f(getLocation('uLaserColorShift'), state.laserColorShift ?? 0);
    gl.uniform1f(getLocation('uLaserAudioReact'), state.laserAudioReact ?? 0.7);
    gl.uniform1f(getLocation('uLaserGlow'), state.laserGlow ?? 0.5);
    gl.uniform1f(getLocation('uStrobeEnabled'), state.strobeEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uStrobeOpacity'), state.strobeOpacity ?? 1.0);
    gl.uniform1f(getLocation('uStrobeRate'), state.strobeRate ?? 4);
    gl.uniform1f(getLocation('uStrobeDutyCycle'), state.strobeDutyCycle ?? 0.1);
    gl.uniform1f(getLocation('uStrobeMode'), state.strobeMode ?? 0);
    gl.uniform1f(getLocation('uStrobeAudioTrigger'), state.strobeAudioTrigger ? 1 : 0);
    gl.uniform1f(getLocation('uStrobeThreshold'), state.strobeThreshold ?? 0.6);
    gl.uniform1f(getLocation('uStrobeFadeOut'), state.strobeFadeOut ?? 0.1);
    gl.uniform1f(getLocation('uStrobePattern'), state.strobePattern ?? 0);
    gl.uniform1f(getLocation('uShapeBurstEnabled'), state.shapeBurstEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uShapeBurstOpacity'), state.shapeBurstOpacity ?? 1.0);
    gl.uniform1f(getLocation('uShapeBurstShape'), state.shapeBurstShape ?? 0);
    gl.uniform1f(getLocation('uShapeBurstExpandSpeed'), state.shapeBurstExpandSpeed ?? 2);
    gl.uniform1f(getLocation('uShapeBurstStartSize'), state.shapeBurstStartSize ?? 0.05);
    gl.uniform1f(getLocation('uShapeBurstMaxSize'), state.shapeBurstMaxSize ?? 1.5);
    gl.uniform1f(getLocation('uShapeBurstThickness'), state.shapeBurstThickness ?? 0.03);
    gl.uniform1f(getLocation('uShapeBurstFadeMode'), state.shapeBurstFadeMode ?? 2);
    gl.uniform1fv(getLocation('uBurstSpawnTimes[0]'), state.shapeBurstSpawnTimes ?? new Float32Array(8));
    gl.uniform1fv(getLocation('uBurstActives[0]'), state.shapeBurstActives ?? new Float32Array(8));
    gl.uniform1f(getLocation('uGridTunnelEnabled'), state.gridTunnelEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uGridTunnelOpacity'), state.gridTunnelOpacity ?? 1.0);
    gl.uniform1f(getLocation('uGridTunnelSpeed'), state.gridTunnelSpeed ?? 1);
    gl.uniform1f(getLocation('uGridTunnelGridSize'), state.gridTunnelGridSize ?? 20);
    gl.uniform1f(getLocation('uGridTunnelLineWidth'), state.gridTunnelLineWidth ?? 0.02);
    gl.uniform1f(getLocation('uGridTunnelPerspective'), state.gridTunnelPerspective ?? 1);
    gl.uniform1f(getLocation('uGridTunnelHorizonY'), state.gridTunnelHorizonY ?? 0.5);
    gl.uniform1f(getLocation('uGridTunnelGlow'), state.gridTunnelGlow ?? 0.5);
    gl.uniform1f(getLocation('uGridTunnelAudioReact'), state.gridTunnelAudioReact ?? 0.3);
    gl.uniform1f(getLocation('uGridTunnelMode'), state.gridTunnelMode ?? 0);
    // Rock Generators
    gl.uniform1f(getLocation('uLightningEnabled'), state.lightningEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uLightningOpacity'), state.lightningOpacity ?? 1.0);
    gl.uniform1f(getLocation('uLightningSpeed'), state.lightningSpeed ?? 1.0);
    gl.uniform1f(getLocation('uLightningBranches'), state.lightningBranches ?? 3.0);
    gl.uniform1f(getLocation('uLightningThickness'), state.lightningThickness ?? 0.02);
    gl.uniform1f(getLocation('uLightningColor'), state.lightningColor ?? 0);
    gl.uniform1f(getLocation('uAnalogOscilloEnabled'), state.analogOscilloEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uAnalogOscilloOpacity'), state.analogOscilloOpacity ?? 1.0);
    gl.uniform1f(getLocation('uAnalogOscilloThickness'), state.analogOscilloThickness ?? 0.01);
    gl.uniform1f(getLocation('uAnalogOscilloGlow'), state.analogOscilloGlow ?? 0.5);
    gl.uniform1f(getLocation('uAnalogOscilloColor'), state.analogOscilloColor ?? 0);
    gl.uniform1f(getLocation('uAnalogOscilloMode'), state.analogOscilloMode ?? 0);
    gl.uniform1f(getLocation('uSpeakerConeEnabled'), state.speakerConeEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uSpeakerConeOpacity'), state.speakerConeOpacity ?? 1.0);
    gl.uniform1f(getLocation('uSpeakerConeForce'), state.speakerConeForce ?? 1.0);
    gl.uniform1f(getLocation('uGlitchScanlineEnabled'), state.glitchScanlineEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uGlitchScanlineOpacity'), state.glitchScanlineOpacity ?? 1.0);
    gl.uniform1f(getLocation('uGlitchScanlineSpeed'), state.glitchScanlineSpeed ?? 1.0);
    gl.uniform1f(getLocation('uGlitchScanlineCount'), state.glitchScanlineCount ?? 1.0);
    gl.uniform1f(getLocation('uLaserStarfieldEnabled'), state.laserStarfieldEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uLaserStarfieldOpacity'), state.laserStarfieldOpacity ?? 1.0);
    gl.uniform1f(getLocation('uLaserStarfieldSpeed'), state.laserStarfieldSpeed ?? 1.0);
    gl.uniform1f(getLocation('uLaserStarfieldDensity'), state.laserStarfieldDensity ?? 1.0);
    gl.uniform1f(getLocation('uPulsingRibbonsEnabled'), state.pulsingRibbonsEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uPulsingRibbonsOpacity'), state.pulsingRibbonsOpacity ?? 1.0);
    gl.uniform1f(getLocation('uPulsingRibbonsCount'), state.pulsingRibbonsCount ?? 3.0);
    gl.uniform1f(getLocation('uPulsingRibbonsWidth'), state.pulsingRibbonsWidth ?? 0.05);
    gl.uniform1f(getLocation('uElectricArcEnabled'), state.electricArcEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uElectricArcOpacity'), state.electricArcOpacity ?? 1.0);
    gl.uniform1f(getLocation('uElectricArcRadius'), state.electricArcRadius ?? 0.5);
    gl.uniform1f(getLocation('uElectricArcChaos'), state.electricArcChaos ?? 1.0);
    gl.uniform1f(getLocation('uPyroBurstEnabled'), state.pyroBurstEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uPyroBurstOpacity'), state.pyroBurstOpacity ?? 1.0);
    gl.uniform1f(getLocation('uPyroBurstForce'), state.pyroBurstForce ?? 1.0);
    gl.uniform1f(getLocation('uGeoWireframeEnabled'), state.geoWireframeEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uGeoWireframeOpacity'), state.geoWireframeOpacity ?? 1.0);
    gl.uniform1f(getLocation('uGeoWireframeShape'), state.geoWireframeShape ?? 0);
    gl.uniform1f(getLocation('uGeoWireframeScale'), state.geoWireframeScale ?? 0.5);
    gl.uniform1f(getLocation('uSignalNoiseEnabled'), state.signalNoiseEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uSignalNoiseOpacity'), state.signalNoiseOpacity ?? 1.0);
    gl.uniform1f(getLocation('uSignalNoiseAmount'), state.signalNoiseAmount ?? 1.0);
    gl.uniform1f(getLocation('uWormholeEnabled'), state.wormholeEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uWormholeOpacity'), state.wormholeOpacity ?? 1.0);
    gl.uniform1f(getLocation('uWormholeSpeed'), state.wormholeSpeed ?? 1.0);
    gl.uniform1f(getLocation('uWormholeWeave'), state.wormholeWeave ?? 0.2);
    gl.uniform1f(getLocation('uWormholeIter'), state.wormholeIter ?? 3.0);
    gl.uniform1f(getLocation('uRibbonTunnelEnabled'), state.ribbonTunnelEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uRibbonTunnelOpacity'), state.ribbonTunnelOpacity ?? 1.0);
    gl.uniform1f(getLocation('uRibbonTunnelSpeed'), state.ribbonTunnelSpeed ?? 1.0);
    gl.uniform1f(getLocation('uRibbonTunnelTwist'), state.ribbonTunnelTwist ?? 1.0);
    gl.uniform1f(getLocation('uFractalTunnelEnabled'), state.fractalTunnelEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uFractalTunnelOpacity'), state.fractalTunnelOpacity ?? 1.0);
    gl.uniform1f(getLocation('uFractalTunnelSpeed'), state.fractalTunnelSpeed ?? 1.0);
    gl.uniform1f(getLocation('uFractalTunnelComplexity'), state.fractalTunnelComplexity ?? 3.0);
    gl.uniform1f(getLocation('uCircuitConduitEnabled'), state.circuitConduitEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uCircuitConduitOpacity'), state.circuitConduitOpacity ?? 1.0);
    gl.uniform1f(getLocation('uCircuitConduitSpeed'), state.circuitConduitSpeed ?? 1.0);
    gl.uniform1f(getLocation('uAuraPortalEnabled'), state.auraPortalEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uAuraPortalOpacity'), state.auraPortalOpacity ?? 1.0);
    gl.uniform1f(getLocation('uAuraPortalColor'), state.auraPortalColor ?? 0);
    gl.uniform1f(getLocation('uFreqTerrainEnabled'), state.freqTerrainEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uFreqTerrainOpacity'), state.freqTerrainOpacity ?? 1.0);
    gl.uniform1f(getLocation('uFreqTerrainScale'), state.freqTerrainScale ?? 1.0);
    gl.uniform1f(getLocation('uDataStreamEnabled'), state.dataStreamEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uDataStreamOpacity'), state.dataStreamOpacity ?? 1.0);
    gl.uniform1f(getLocation('uDataStreamSpeed'), state.dataStreamSpeed ?? 1.0);
    gl.uniform1f(getLocation('uCausticLiquidEnabled'), state.causticLiquidEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uCausticLiquidOpacity'), state.causticLiquidOpacity ?? 1.0);
    gl.uniform1f(getLocation('uCausticLiquidSpeed'), state.causticLiquidSpeed ?? 1.0);
    gl.uniform1f(getLocation('uShimmerVeilEnabled'), state.shimmerVeilEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uShimmerVeilOpacity'), state.shimmerVeilOpacity ?? 1.0);
    gl.uniform1f(getLocation('uShimmerVeilComplexity'), state.shimmerVeilComplexity ?? 10.0);

    // --- New 31 Generators Uniform Bindings ---
    gl.uniform1f(getLocation('uNebulaCloudEnabled'), state.nebulaCloudEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uNebulaCloudOpacity'), state.nebulaCloudOpacity ?? 1.0);
    gl.uniform1f(getLocation('uNebulaCloudDensity'), state.nebulaCloudDensity ?? 1.0);
    gl.uniform1f(getLocation('uNebulaCloudSpeed'), state.nebulaCloudSpeed ?? 0.5);
    gl.uniform1f(getLocation('uCircuitBoardEnabled'), state.circuitBoardEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uCircuitBoardOpacity'), state.circuitBoardOpacity ?? 1.0);
    gl.uniform1f(getLocation('uCircuitBoardGrowth'), state.circuitBoardGrowth ?? 1.0);
    gl.uniform1f(getLocation('uCircuitBoardComplexity'), state.circuitBoardComplexity ?? 5.0);
    gl.uniform1f(getLocation('uLorenzAttractorEnabled'), state.lorenzAttractorEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uLorenzAttractorOpacity'), state.lorenzAttractorOpacity ?? 1.0);
    gl.uniform1f(getLocation('uLorenzAttractorSpeed'), state.lorenzAttractorSpeed ?? 1.0);
    gl.uniform1f(getLocation('uLorenzAttractorChaos'), state.lorenzAttractorChaos ?? 1.0);
    gl.uniform1f(getLocation('uMandalaSpinnerEnabled'), state.mandalaSpinnerEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uMandalaSpinnerOpacity'), state.mandalaSpinnerOpacity ?? 1.0);
    gl.uniform1f(getLocation('uMandalaSpinnerSides'), state.mandalaSpinnerSides ?? 6.0);
    gl.uniform1f(getLocation('uMandalaSpinnerSpeed'), state.mandalaSpinnerSpeed ?? 1.0);
    gl.uniform1f(getLocation('uStarburstGalaxyEnabled'), state.starburstGalaxyEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uStarburstGalaxyOpacity'), state.starburstGalaxyOpacity ?? 1.0);
    gl.uniform1f(getLocation('uStarburstGalaxyForce'), state.starburstGalaxyForce ?? 1.0);
    gl.uniform1f(getLocation('uStarburstGalaxyCount'), state.starburstGalaxyCount ?? 100.0);
    gl.uniform1f(getLocation('uDigitalRainV2Enabled'), state.digitalRainV2Enabled ? 1 : 0);
    gl.uniform1f(getLocation('uDigitalRainV2Opacity'), state.digitalRainV2Opacity ?? 1.0);
    gl.uniform1f(getLocation('uDigitalRainV2Speed'), state.digitalRainV2Speed ?? 1.0);
    gl.uniform1f(getLocation('uDigitalRainV2Density'), state.digitalRainV2Density ?? 1.0);
    gl.uniform1f(getLocation('uLavaFlowEnabled'), state.lavaFlowEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uLavaFlowOpacity'), state.lavaFlowOpacity ?? 1.0);
    gl.uniform1f(getLocation('uLavaFlowHeat'), state.lavaFlowHeat ?? 1.0);
    gl.uniform1f(getLocation('uLavaFlowViscosity'), state.lavaFlowViscosity ?? 1.0);
    gl.uniform1f(getLocation('uCrystalGrowthEnabled'), state.crystalGrowthEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uCrystalGrowthOpacity'), state.crystalGrowthOpacity ?? 1.0);
    gl.uniform1f(getLocation('uCrystalGrowthRate'), state.crystalGrowthRate ?? 0.5);
    gl.uniform1f(getLocation('uCrystalGrowthSharpness'), state.crystalGrowthSharpness ?? 0.8);
    gl.uniform1f(getLocation('uTechnoGridEnabled'), state.technoGridEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uTechnoGridOpacity'), state.technoGridOpacity ?? 1.0);
    gl.uniform1f(getLocation('uTechnoGridHeight'), state.technoGridHeight ?? 1.0);
    gl.uniform1f(getLocation('uTechnoGridSpeed'), state.technoGridSpeed ?? 1.0);
    gl.uniform1f(getLocation('uMagneticFieldEnabled'), state.magneticFieldEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uMagneticFieldOpacity'), state.magneticFieldOpacity ?? 1.0);
    gl.uniform1f(getLocation('uMagneticFieldStrength'), state.magneticFieldStrength ?? 1.0);
    gl.uniform1f(getLocation('uMagneticFieldDensity'), state.magneticFieldDensity ?? 20.0);
    gl.uniform1f(getLocation('uPrismShardsEnabled'), state.prismShardsEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uPrismShardsOpacity'), state.prismShardsOpacity ?? 1.0);
    gl.uniform1f(getLocation('uPrismShardsRefraction'), state.prismShardsRefraction ?? 0.5);
    gl.uniform1f(getLocation('uPrismShardsCount'), state.prismShardsCount ?? 5.0);
    gl.uniform1f(getLocation('uNeuralNetEnabled'), state.neuralNetEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uNeuralNetOpacity'), state.neuralNetOpacity ?? 1.0);
    gl.uniform1f(getLocation('uNeuralNetActivity'), state.neuralNetActivity ?? 1.0);
    gl.uniform1f(getLocation('uNeuralNetDensity'), state.neuralNetDensity ?? 1.0);
    gl.uniform1f(getLocation('uAuroraChordEnabled'), state.auroraChordEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uAuroraChordOpacity'), state.auroraChordOpacity ?? 1.0);
    gl.uniform1f(getLocation('uAuroraChordWaviness'), state.auroraChordWaviness ?? 1.0);
    gl.uniform1f(getLocation('uAuroraChordColorRange'), state.auroraChordColorRange ?? 1.0);
    gl.uniform1f(getLocation('uVhsGlitchEnabled'), state.vhsGlitchEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uVhsGlitchOpacity'), state.vhsGlitchOpacity ?? 1.0);
    gl.uniform1f(getLocation('uVhsGlitchJitter'), state.vhsGlitchJitter ?? 0.2);
    gl.uniform1f(getLocation('uVhsGlitchNoise'), state.vhsGlitchNoise ?? 0.3);
    gl.uniform1f(getLocation('uMoirePatternEnabled'), state.moirePatternEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uMoirePatternOpacity'), state.moirePatternOpacity ?? 1.0);
    gl.uniform1f(getLocation('uMoirePatternScale'), state.moirePatternScale ?? 5.0);
    gl.uniform1f(getLocation('uMoirePatternSpeed'), state.moirePatternSpeed ?? 1.0);
    gl.uniform1f(getLocation('uHypercubeEnabled'), state.hypercubeEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uHypercubeOpacity'), state.hypercubeOpacity ?? 1.0);
    gl.uniform1f(getLocation('uHypercubeProjection'), state.hypercubeProjection ?? 1.0);
    gl.uniform1f(getLocation('uHypercubeSpeed'), state.hypercubeSpeed ?? 1.0);
    gl.uniform1f(getLocation('uFluidSwirlEnabled'), state.fluidSwirlEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uFluidSwirlOpacity'), state.fluidSwirlOpacity ?? 1.0);
    gl.uniform1f(getLocation('uFluidSwirlVorticity'), state.fluidSwirlVorticity ?? 1.0);
    gl.uniform1f(getLocation('uFluidSwirlColorMix'), state.fluidSwirlColorMix ?? 1.0);
    gl.uniform1f(getLocation('uAsciiStreamEnabled'), state.asciiStreamEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uAsciiStreamOpacity'), state.asciiStreamOpacity ?? 1.0);
    gl.uniform1f(getLocation('uAsciiStreamResolution'), state.asciiStreamResolution ?? 40.0);
    gl.uniform1f(getLocation('uAsciiStreamContrast'), state.asciiStreamContrast ?? 1.0);
    gl.uniform1f(getLocation('uRetroWaveEnabled'), state.retroWaveEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uRetroWaveOpacity'), state.retroWaveOpacity ?? 1.0);
    gl.uniform1f(getLocation('uRetroWaveSunSize'), state.retroWaveSunSize ?? 1.0);
    gl.uniform1f(getLocation('uRetroWaveGridSpeed'), state.retroWaveGridSpeed ?? 1.0);
    gl.uniform1f(getLocation('uBubblePopEnabled'), state.bubblePopEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uBubblePopOpacity'), state.bubblePopOpacity ?? 1.0);
    gl.uniform1f(getLocation('uBubblePopPopRate'), state.bubblePopPopRate ?? 1.0);
    gl.uniform1f(getLocation('uBubblePopSize'), state.bubblePopSize ?? 0.5);
    gl.uniform1f(getLocation('uSoundWave3DEnabled'), state.soundWave3DEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uSoundWave3DOpacity'), state.soundWave3DOpacity ?? 1.0);
    gl.uniform1f(getLocation('uSoundWave3DAmplitude'), state.soundWave3DAmplitude ?? 1.0);
    gl.uniform1f(getLocation('uSoundWave3DSmoothness'), state.soundWave3DSmoothness ?? 1.0);
    gl.uniform1f(getLocation('uParticleVortexEnabled'), state.particleVortexEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uParticleVortexOpacity'), state.particleVortexOpacity ?? 1.0);
    gl.uniform1f(getLocation('uParticleVortexSuction'), state.particleVortexSuction ?? 1.0);
    gl.uniform1f(getLocation('uParticleVortexSpin'), state.particleVortexSpin ?? 1.0);
    gl.uniform1f(getLocation('uGlowWormsEnabled'), state.glowWormsEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uGlowWormsOpacity'), state.glowWormsOpacity ?? 1.0);
    gl.uniform1f(getLocation('uGlowWormsLength'), state.glowWormsLength ?? 1.0);
    gl.uniform1f(getLocation('uGlowWormsSpeed'), state.glowWormsSpeed ?? 1.0);
    gl.uniform1f(getLocation('uMirrorMazeEnabled'), state.mirrorMazeEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uMirrorMazeOpacity'), state.mirrorMazeOpacity ?? 1.0);
    gl.uniform1f(getLocation('uMirrorMazeRecursion'), state.mirrorMazeRecursion ?? 4.0);
    gl.uniform1f(getLocation('uMirrorMazeAngle'), state.mirrorMazeAngle ?? 0.78);
    gl.uniform1f(getLocation('uPulseHeartEnabled'), state.pulseHeartEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uPulseHeartOpacity'), state.pulseHeartOpacity ?? 1.0);
    gl.uniform1f(getLocation('uPulseHeartBeats'), state.pulseHeartBeats ?? 1.0);
    gl.uniform1f(getLocation('uPulseHeartLayers'), state.pulseHeartLayers ?? 5.0);
    gl.uniform1f(getLocation('uDataShardsEnabled'), state.dataShardsEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uDataShardsOpacity'), state.dataShardsOpacity ?? 1.0);
    gl.uniform1f(getLocation('uDataShardsSpeed'), state.dataShardsSpeed ?? 1.0);
    gl.uniform1f(getLocation('uDataShardsSharpness'), state.dataShardsSharpness ?? 1.0);
    gl.uniform1f(getLocation('uHexCellEnabled'), state.hexCellEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uHexCellOpacity'), state.hexCellOpacity ?? 1.0);
    gl.uniform1f(getLocation('uHexCellPulse'), state.hexCellPulse ?? 1.0);
    gl.uniform1f(getLocation('uHexCellScale'), state.hexCellScale ?? 1.0);
    gl.uniform1f(getLocation('uPlasmaBallEnabled'), state.plasmaBallEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uPlasmaBallOpacity'), state.plasmaBallOpacity ?? 1.0);
    gl.uniform1f(getLocation('uPlasmaBallVoltage'), state.plasmaBallVoltage ?? 1.0);
    gl.uniform1f(getLocation('uPlasmaBallFilaments'), state.plasmaBallFilaments ?? 5.0);
    gl.uniform1f(getLocation('uWarpDriveEnabled'), state.warpDriveEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uWarpDriveOpacity'), state.warpDriveOpacity ?? 1.0);
    gl.uniform1f(getLocation('uWarpDriveWarp'), state.warpDriveWarp ?? 1.0);
    gl.uniform1f(getLocation('uWarpDriveGlow'), state.warpDriveGlow ?? 1.0);
    gl.uniform1f(getLocation('uVisualFeedbackEnabled'), state.visualFeedbackEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uVisualFeedbackOpacity'), state.visualFeedbackOpacity ?? 1.0);
    gl.uniform1f(getLocation('uVisualFeedbackZoom'), state.visualFeedbackZoom ?? 1.01);
    gl.uniform1f(getLocation('uVisualFeedbackRotation'), state.visualFeedbackRotation ?? 0.01);
    gl.uniform1f(getLocation('uMyceliumGrowthEnabled'), state.myceliumGrowthEnabled ? 1 : 0);
    gl.uniform1f(getLocation('uMyceliumGrowthOpacity'), state.myceliumGrowthOpacity ?? 1.0);
    gl.uniform1f(getLocation('uMyceliumGrowthSpread'), state.myceliumGrowthSpread ?? 1.0);
    gl.uniform1f(getLocation('uMyceliumGrowthDecay'), state.myceliumGrowthDecay ?? 0.5);
    gl.uniform1f(getLocation('uAdvancedSdfEnabled'), (state.sdfScene && prog === advancedSdfProgram) ? 1 : 0);
    if (currentPalette.length >= 5) gl.uniform3fv(getLocation('uPalette[0]'), currentPalette.flat());
    const pLoc = gl.getAttribLocation(prog, 'position');
    gl.enableVertexAttribArray(pLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(pLoc, 2, gl.FLOAT, false, 0, 0);

    // --- Generator Diagnostics: track enable/opacity state ---
    const genEntries: [string, boolean, number][] = [
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
      ['laser', state.laserEnabled, state.laserOpacity],
      ['strobe', state.strobeEnabled, state.strobeOpacity],
      ['shapeBurst', state.shapeBurstEnabled, state.shapeBurstOpacity],
      ['gridTunnel', state.gridTunnelEnabled, state.gridTunnelOpacity],
      ['lightning', state.lightningEnabled, state.lightningOpacity],
      ['analogOscillo', state.analogOscilloEnabled, state.analogOscilloOpacity],
      ['speakerCone', state.speakerConeEnabled, state.speakerConeOpacity],
      ['glitchScanline', state.glitchScanlineEnabled, state.glitchScanlineOpacity],
      ['laserStarfield', state.laserStarfieldEnabled, state.laserStarfieldOpacity],
      ['pulsingRibbons', state.pulsingRibbonsEnabled, state.pulsingRibbonsOpacity],
      ['electricArc', state.electricArcEnabled, state.electricArcOpacity],
      ['pyroBurst', state.pyroBurstEnabled, state.pyroBurstOpacity],
      ['geoWireframe', state.geoWireframeEnabled, state.geoWireframeOpacity],
      ['signalNoise', state.signalNoiseEnabled, state.signalNoiseOpacity],
      ['wormhole', state.wormholeEnabled, state.wormholeOpacity],
      ['ribbonTunnel', state.ribbonTunnelEnabled, state.ribbonTunnelOpacity],
      ['fractalTunnel', state.fractalTunnelEnabled, state.fractalTunnelOpacity],
      ['circuitConduit', state.circuitConduitEnabled, state.circuitConduitOpacity],
      ['auraPortal', state.auraPortalEnabled, state.auraPortalOpacity],
      ['freqTerrain', state.freqTerrainEnabled, state.freqTerrainOpacity],
      ['dataStream', state.dataStreamEnabled, state.dataStreamOpacity],
      ['causticLiquid', state.causticLiquidEnabled, state.causticLiquidOpacity],
      ['shimmerVeil', state.shimmerVeilEnabled, state.shimmerVeilOpacity],
      ['nebulaCloud', state.nebulaCloudEnabled, state.nebulaCloudOpacity],
      ['circuitBoard', state.circuitBoardEnabled, state.circuitBoardOpacity],
      ['lorenzAttractor', state.lorenzAttractorEnabled, state.lorenzAttractorOpacity],
      ['mandalaSpinner', state.mandalaSpinnerEnabled, state.mandalaSpinnerOpacity],
      ['starburstGalaxy', state.starburstGalaxyEnabled, state.starburstGalaxyOpacity],
      ['digitalRainV2', state.digitalRainV2Enabled, state.digitalRainV2Opacity],
      ['lavaFlow', state.lavaFlowEnabled, state.lavaFlowOpacity],
      ['crystalGrowth', state.crystalGrowthEnabled, state.crystalGrowthOpacity],
      ['technoGrid', state.technoGridEnabled, state.technoGridOpacity],
      ['magneticField', state.magneticFieldEnabled, state.magneticFieldOpacity],
      ['prismShards', state.prismShardsEnabled, state.prismShardsOpacity],
      ['neuralNet', state.neuralNetEnabled, state.neuralNetOpacity],
      ['auroraChord', state.auroraChordEnabled, state.auroraChordOpacity],
      ['vhsGlitch', state.vhsGlitchEnabled, state.vhsGlitchOpacity],
      ['moirePattern', state.moirePatternEnabled, state.moirePatternOpacity],
      ['hypercube', state.hypercubeEnabled, state.hypercubeOpacity],
      ['fluidSwirl', state.fluidSwirlEnabled, state.fluidSwirlOpacity],
      ['asciiStream', state.asciiStreamEnabled, state.asciiStreamOpacity],
      ['retroWave', state.retroWaveEnabled, state.retroWaveOpacity],
      ['bubblePop', state.bubblePopEnabled, state.bubblePopOpacity],
      ['soundWave3D', state.soundWave3DEnabled, state.soundWave3DOpacity],
      ['particleVortex', state.particleVortexEnabled, state.particleVortexOpacity],
      ['glowWorms', state.glowWormsEnabled, state.glowWormsOpacity],
      ['mirrorMaze', state.mirrorMazeEnabled, state.mirrorMazeOpacity],
      ['pulseHeart', state.pulseHeartEnabled, state.pulseHeartOpacity],
      ['dataShards', state.dataShardsEnabled, state.dataShardsOpacity],
      ['hexCell', state.hexCellEnabled, state.hexCellOpacity],
      ['plasmaBall', state.plasmaBallEnabled, state.plasmaBallOpacity],
      ['warpDrive', state.warpDriveEnabled, state.warpDriveOpacity],
      ['visualFeedback', state.visualFeedbackEnabled, state.visualFeedbackOpacity],
    ];
    generatorDiagnostics.clear();
    for (const [name, enabled, opacity] of genEntries) {
      generatorDiagnostics.set(name, {
        enabled,
        opacity,
        uniformsBound: !missingUniforms.has(`u${name.charAt(0).toUpperCase() + name.slice(1)}Enabled`)
      });
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
    const units = { waveform: 10, spectrum: 11, modulators: 12 };
    
    gl.activeTexture(gl.TEXTURE0 + units.waveform);
    gl.bindTexture(gl.TEXTURE_2D, waveformTexture);
    gl.uniform1i(gl.getUniformLocation(prog, 'uWaveformTex'), units.waveform);

    gl.activeTexture(gl.TEXTURE0 + units.spectrum);
    gl.bindTexture(gl.TEXTURE_2D, spectrumTexture);
    gl.uniform1i(gl.getUniformLocation(prog, 'uSpectrumTex'), units.spectrum);

    gl.activeTexture(gl.TEXTURE0 + units.modulators);
    gl.bindTexture(gl.TEXTURE_2D, modulatorTexture);
    gl.uniform1i(gl.getUniformLocation(prog, 'uModulatorTex'), units.modulators);

    gl.activeTexture(gl.TEXTURE0 + 13);
    gl.bindTexture(gl.TEXTURE_2D, midiTexture);
    gl.uniform1i(gl.getUniformLocation(prog, 'uMidiTex'), 13);
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
    });
  };

  const setPlasmaShaderSource = (source: string | null) => {
    const trimmed = source?.trim();
    const nextSource = trimmed ? trimmed : null;
    const nextProgram = createProgram(
      vertexShaderSrc,
      createFragmentShaderSrc('', '', '10.0', nextSource)
    );
    if (!nextProgram) {
      return { ok: false };
    }
    standardProgram = nextProgram;
    customPlasmaSource = nextSource;
    return { ok: true };
  };

  const render = (state: RenderState) => {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    updateInternalTextures(state);
    updateAdvancedSdfProgram(state.sdfScene);
    currentProgram = (state.sdfScene && advancedSdfProgram) ? advancedSdfProgram : standardProgram;
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
          gl.uniform1f(gl.getUniformLocation(currentProgram, 'uSdfAoEnabled'), s.render3d.aoEnabled ? 1 : 0);
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
    gl.drawArrays(gl.TRIANGLES, 0, 6);
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

  return { render, setLayerAsset, setPalette, setPlasmaShaderSource, getLastShaderError, getGeneratorDiagnostics, getMissingUniforms };
};
