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

  if (features.usesSamplerState) {
    pushReason(
      reasonsDetailed,
      'sampler_state',
      'Uses HLSL sampler_state blocks; the offline translator strips these — texture state is implicit in GLSL sampler objects.',
      'degrade'
    );
  }
  if (features.requiresVolumeNoise) {
    pushReason(
      reasonsDetailed,
      'volume_noise',
      'References volume-noise samplers; these are stubbed to sampler_noise_lq — visual quality degrades but shader compiles.',
      'degrade'
    );
  }
  if (features.requiresCustomTextureSlots) {
    pushReason(
      reasonsDetailed,
      'custom_texture_slots',
      'References custom texture-slot samplers; the offline translator stubs these to sampler_noise_lq — textures render as noise.',
      'degrade'
    );
  }

  // float1, float4x3, tex2Dbias, and sampler_state are all handled by the offline translator:
  // - float1 → float (type rewrite)
  // - float4x3 → mat4 (type rewrite)
  // - tex2Dbias → textureBias bridge helper
  // - sampler_state blocks → stripped
  // These no longer need to cause degradation; they are tracked in the feature summary only.

  // preset_pixel only degrades when there is no custom GLSL warp shader.
  // When hasCustomWarp is true, the GLSL warp shader completely replaces the per-pixel EEL
  // warp mesh — MilkDrop2 never executes per_pixel EEL code when a custom warp GLSL is present.
  if (features.hasPresetPixel && !features.hasCustomWarp) {
    pushReason(
      reasonsDetailed,
      'preset_pixel',
      'Uses per-pixel EEL expression code for warp mesh but has no custom GLSL warp shader; EEL warp mesh execution is not yet implemented — the default warp transform is used instead.',
      'degrade'
    );
  }
  if (features.hasTexturedShapes) {
    pushReason(
      reasonsDetailed,
      'textured_shapes',
      'Uses textured custom shapes; texture sampling on shapes is not yet supported — shapes render as flat-color geometry.',
      'degrade'
    );
  }

  let tier: MilkwaveSupportTier = 'native-supported';
  if (reasonsDetailed.some((reason) => reason.severity === 'fallback')) {
    tier = 'fallback-only';
  } else if (reasonsDetailed.some((reason) => reason.severity === 'degrade')) {
    tier = 'supported-with-degradation';
  }

  return {
    tier,
    reasons: reasonsDetailed.map((reason) => reason.message),
    reasonsDetailed,
    featureSummary: summarizeFeatures(features)
  };
};

export const classifyMilkwaveIR = (ir: MilkwaveIR): MilkwaveCapabilityReport =>
  classifyMilkwaveFeatures(ir.featureRequirements);
