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
      'Uses HLSL sampler_state declarations that require a non-WebGL binding model.',
      'fallback'
    );
  }
  if (features.requiresVolumeNoise) {
    pushReason(
      reasonsDetailed,
      'volume_noise',
      'Requires Milkwave volume-noise samplers that are not currently provided by the native runtime.',
      'fallback'
    );
  }
  if (features.requiresCustomTextureSlots) {
    pushReason(
      reasonsDetailed,
      'custom_texture_slots',
      'Requires custom texture-slot sampler binding and texture-manager evaluation.',
      'fallback'
    );
  }

  if (features.usesFloat1) {
    pushReason(
      reasonsDetailed,
      'float1',
      'Uses HLSL scalar aliases that must be normalized before GLSL generation.',
      'degrade'
    );
  }
  if (features.usesFloat4x3) {
    pushReason(
      reasonsDetailed,
      'float4x3',
      'Uses MilkDrop rotation matrices requiring explicit matrix conversion rules.',
      'degrade'
    );
  }
  if (features.usesTex2Dbias) {
    pushReason(
      reasonsDetailed,
      'tex2Dbias',
      'Uses biased texture sampling that needs GLSL-specific translation semantics.',
      'degrade'
    );
  }
  if (features.hasPresetPixel) {
    pushReason(
      reasonsDetailed,
      'preset_pixel',
      'Uses preset per-pixel expression code, which is not yet mapped into native execution.',
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
