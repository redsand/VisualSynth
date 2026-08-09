/**
 * RenderState type definitions.
 *
 * Split from glRenderer.ts for maintainability. Import RenderState and
 * sub-interfaces from here; glRenderer.ts re-exports them for backwards
 * compatibility.
 */

import type { MilkDropShaderData } from '../shared/project';
import type { SessionHealth } from '../shared/sessionHealth';

export interface RenderTelemetryState {
  timeMs: number;
  rms: number;
  peak: number;
  strobe: number;
  spectrum: Float32Array;
  // Authoritative musical band aggregates (log-spaced, 0..1) from AudioEngine.
  // Optional so standalone projector pages without an engine can omit them;
  // consumers fall back to deriving from `spectrum`.
  bass?: number;
  mid?: number;
  treb?: number;
  // Slow-attacking followers (MilkDrop "_att" idiom), 0..1.
  bassAtt?: number;
  midAtt?: number;
  trebAtt?: number;
}

export interface RenderLayerEnabledState {
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
}

export interface RenderColorPipelineState {
  contrast: number;
  saturation: number;
  paletteShift: number;
}

export interface RenderTransitionState {
  transitionAmount: number;
  transitionType: number; // 0: none, 1: fade, 2: warp, 3: glitch, 4: dissolve
  chemistryMode: number; // 0: analog, 1: triadic, 2: complementary, 3: monochromatic
  motionTemplate: number;
}

export interface RenderPostFxState {
  effectsEnabled: boolean;
  bloom: number;
  blur: number;
  chroma: number;
  posterize: number;
  kaleidoscope: number;
  kaleidoscopeRotation: number;
  feedback: number;
  persistence: number;
  feedbackZoom: number;
  feedbackRotation: number;
}

export interface RenderSdfState {
  sdfEnabled: boolean;
  sdfShape: number;
  sdfScale: number;
  sdfEdge: number;
  sdfGlow: number;
  sdfRotation: number;
  sdfFill: number;
  sdfColor?: [number, number, number];
  sdfScene?: any; // Config for Advanced mode
}

export interface RenderState
  extends RenderTelemetryState,
    RenderLayerEnabledState,
    RenderColorPipelineState,
    RenderTransitionState,
    RenderPostFxState,
    RenderSdfState {
  plasmaOpacity: number;
  plasmaSpeed: number;
  plasmaScale: number;
  plasmaComplexity: number;
  plasmaAudioReact: number;
  spectrumOpacity: number;
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
  globalColor?: [number, number, number];
  hasInternalAsset?: boolean;
  gravityPositions: Float32Array;
  gravityStrengths: Float32Array;
  gravityPolarities: Float32Array;
  gravityActives: Float32Array;
  gravityCollapse: number;
  debugTint?: number;
  debugColorStage?: number;
  origamiSpeed: number;
  roleWeights: {
    core: number;
    support: number;
    atmosphere: number;
  };
  engineMass: number;
  engineFriction: number;
  engineElasticity: number;
  maxBloom: number;
  forceFeedback: boolean;
  engineGrain: number;
  engineVignette: number;
  engineCA: number;
  engineSignature: number;

  // Special array uniforms not handled by the dynamic resolver
  shapeBurstSpawnTimes: Float32Array;
  shapeBurstActives: Float32Array;

  // MilkDrop shader data (not a uniform)
  milkDropShaderData: MilkDropShaderData | null;

  sessionHealth?: SessionHealth;
  performanceMode?: boolean;

  /**
   * Dynamic generator uniforms — populated by resolveGenUniforms().
   * Keyed by uniform name WITHOUT 'u' prefix, e.g. { LaserOpacity: 0.8, MirrorMazeAngle: 0.78 }.
   * glRenderer iterates this and calls gl.uniform1f(getLocation(`u${key}`), value).
   * Replaces all explicit per-generator properties.
   */
  genUniforms: Record<string, number>;
}
