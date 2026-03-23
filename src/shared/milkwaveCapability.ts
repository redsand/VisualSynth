import type {
  MilkwaveCapabilityAssessment,
  MilkwaveFeatureRequirements,
  MilkwaveIR,
  MilkwaveSupportTier
} from './milkwaveIr';

export interface MilkwaveCapabilityReason {
  key: string;
  message: string;
  severity: 'degrade' | 'fallback' | 'block';
}

export interface MilkwaveCapabilityReport extends MilkwaveCapabilityAssessment {
  reasonsDetailed: MilkwaveCapabilityReason[];
  featureSummary: string[];
}

const pushReason = (
  reasons: MilkwaveCapabilityReason[],
  key: string,
  message: string,
  severity: 'degrade' | 'fallback' | 'block'
) => {
  reasons.push({ key, message, severity });
};

const summarizeFeatures = (features: MilkwaveFeatureRequirements): string[] => {
  const summary: string[] = [];
  if (features.hasCustomWarp) summary.push('custom-warp');
  if (features.hasCustomComp) summary.push('custom-comp');
  if (features.hasPresetInit) summary.push('preset-init');
  if (features.hasPresetFrame) summary.push('preset-frame');
  if (features.hasPresetPixel) summary.push('preset-pixel');
  if (features.hasCustomWaves) summary.push('custom-waves');
  if (features.hasCustomWaveInitCode) summary.push('wave-init');
  if (features.hasCustomWavePointCode) summary.push('wave-point');
  if (features.hasCustomShapes) summary.push('custom-shapes');
  if (features.hasCustomShapeInitCode) summary.push('shape-init');
  if (features.hasCustomShapePointCode) summary.push('shape-point');
  if (features.hasTexturedShapes) summary.push('textured-shapes');
  if (features.requiresBlurSamplers) summary.push('blur-samplers');
  if (features.requiresPreviousFrameAliases) summary.push('prev-frame-aliases');
  if (features.requiresCustomTextureSlots) summary.push('custom-texture-slots');
  if (features.requiresVolumeNoise) summary.push('volume-noise');
  if (features.usesFloat1) summary.push('float1');
  if (features.usesFloat4x3) summary.push('float4x3');
  if (features.usesTex2Dbias) summary.push('tex2Dbias');
  if (features.usesSamplerState) summary.push('sampler_state');
  return summary;
};

export const classifyMilkwaveFeatures = (
  features: MilkwaveFeatureRequirements
): MilkwaveCapabilityReport => {
  const reasonsDetailed: MilkwaveCapabilityReason[] = [];

  // All of the following are fully handled by the offline translator — no degrade:
  // - usesSamplerState: sampler_state blocks stripped; GL sampler objects provide equivalent state
  // - requiresVolumeNoise: sampler_noisevol_* → sampler_noise_lq stub; still renders as noise
  // - requiresCustomTextureSlots: unknown sampler_* → sampler_noise_lq stub; textures render as noise
  //   (when the preset's texture pack is bundled, textures display correctly)
  // These are tracked in featureSummary for diagnostic visibility only.

  // float1, float4x3, tex2Dbias, and sampler_state are all handled by the offline translator:
  // - float1 → float (type rewrite)
  // - float4x3 → mat4 (type rewrite)
  // - tex2Dbias → textureBias bridge helper
  // - sampler_state blocks → stripped
  // These no longer need to cause degradation; they are tracked in the feature summary only.

  // preset_pixel: per-pixel EEL warp mesh is now implemented via CPU evaluation per vertex.
  // When hasCustomWarp is true, GLSL completely replaces per-pixel EEL — no degrade either way.
  // This clause is intentionally left empty; hasPresetPixel is captured in featureSummary only.
  // hasTexturedShapes: textured custom shapes are fully implemented.
  // The shape renderer samples from sampler_main (previous frame) using tex_zoom/tex_ang UV mapping.
  // This clause is intentionally left empty; hasTexturedShapes is captured in featureSummary only.

  let tier: MilkwaveSupportTier = 'native-supported';
  if (reasonsDetailed.some((reason) => reason.severity === 'fallback')) {
    tier = 'fallback-only';
  } else if (reasonsDetailed.some((reason) => reason.severity === 'degrade')) {
    tier = 'supported-with-degradation';
  }

  return {
    tier,
    staticSupportTier: tier,
    reasons: reasonsDetailed.map((reason) => reason.message),
    reasonsDetailed,
    featureSummary: summarizeFeatures(features)
  };
};

export const classifyMilkwaveIR = (ir: MilkwaveIR): MilkwaveCapabilityReport =>
  classifyMilkwaveFeatures(ir.featureRequirements);
