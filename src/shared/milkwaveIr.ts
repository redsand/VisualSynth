import type {
  MilkPresetData,
  MilkPresetMetadata,
  MilkShapeConfig,
  MilkWaveConfig
} from './milkwaveParser';
import {
  analyzeMilkwaveShaderSource,
  type MilkwaveShaderDiagnostics
} from './milkwaveDiagnostics';
import { classifyMilkwaveFeatures } from './milkwaveCapability';

export type MilkwaveSupportTier =
  | 'native-supported'
  | 'supported-with-degradation'
  | 'fallback-only'
  | 'unsupported';

export type MilkwaveShaderPassKind = 'warp' | 'comp';

export interface MilkwaveExpressionBlock {
  kind:
    | 'preset-init'
    | 'preset-frame'
    | 'preset-pixel'
    | 'wave-init'
    | 'wave-frame'
    | 'wave-point'
    | 'shape-init'
    | 'shape-frame'
    | 'shape-point';
  lines: string[];
}

export interface MilkwaveShaderPass {
  kind: MilkwaveShaderPassKind;
  source: string | null;
  diagnostics: MilkwaveShaderDiagnostics | null;
  requiresVolumeNoise: boolean;
  requiresBlurSamplers: boolean;
  requiresCustomSamplers: boolean;
  requiresPreviousFrameAliases: boolean;
  usesFloat1: boolean;
  usesFloat4x3: boolean;
  usesTex2Dbias: boolean;
  usesSamplerState: boolean;
}

export interface MilkwaveWaveNode {
  index: number;
  config: MilkWaveConfig;
  expressionBlocks: MilkwaveExpressionBlock[];
}

export interface MilkwaveShapeNode {
  index: number;
  config: MilkShapeConfig;
  expressionBlocks: MilkwaveExpressionBlock[];
}

export interface MilkwaveFeatureRequirements {
  hasCustomWarp: boolean;
  hasCustomComp: boolean;
  hasPresetInit: boolean;
  hasPresetFrame: boolean;
  hasPresetPixel: boolean;
  hasCustomWaves: boolean;
  hasCustomWaveInitCode: boolean;
  hasCustomWavePointCode: boolean;
  hasCustomShapes: boolean;
  hasCustomShapeInitCode: boolean;
  hasCustomShapePointCode: boolean;
  requiresVolumeNoise: boolean;
  requiresBlurSamplers: boolean;
  requiresCustomSamplers: boolean;
  requiresPreviousFrameAliases: boolean;
  requiresCustomTextureSlots: boolean;
  usesFloat1: boolean;
  usesFloat4x3: boolean;
  usesTex2Dbias: boolean;
  usesSamplerState: boolean;
}

export interface MilkwaveCapabilityAssessment {
  tier: MilkwaveSupportTier;
  reasons: string[];
}

export interface MilkwaveIR {
  format: 'milkwave-ir';
  version: 1;
  metadata: MilkPresetMetadata;
  header: {
    milkdropPresetVersion: number;
    psVersion: number;
    psVersionWarp: number;
    psVersionComp: number;
  };
  parameters: Record<string, number | string | boolean>;
  expressionBlocks: MilkwaveExpressionBlock[];
  passes: {
    warp: MilkwaveShaderPass;
    comp: MilkwaveShaderPass;
  };
  waves: MilkwaveWaveNode[];
  shapes: MilkwaveShapeNode[];
  featureRequirements: MilkwaveFeatureRequirements;
  capability: MilkwaveCapabilityAssessment;
}

const hasCustomSamplerReference = (source: string) =>
  /\bsampler_(?!main|fc_main|pc_main|fw_main|pw_main|noise_lq|noise_lq_lite|noise_mq|noise_hq|noisevol_lq|noisevol_hq|blur1|blur2|blur3)\w+\b/i.test(
    source
  );

const inferPassRequirements = (kind: MilkwaveShaderPassKind, source: string | null): MilkwaveShaderPass => {
  if (!source) {
    return {
      kind,
      source: null,
      diagnostics: null,
      requiresVolumeNoise: false,
      requiresBlurSamplers: false,
      requiresCustomSamplers: false,
      requiresPreviousFrameAliases: false,
      usesFloat1: false,
      usesFloat4x3: false,
      usesTex2Dbias: false,
      usesSamplerState: false
    };
  }

  const diagnostics = analyzeMilkwaveShaderSource({
    source,
    pass: kind,
    stage: 'raw'
  });

  return {
    kind,
    source,
    diagnostics,
    requiresVolumeNoise: /\bsampler_noisevol_(?:lq|hq)\b/.test(source),
    requiresBlurSamplers: /\b(GetBlur[123]|sampler_blur[123])\b/.test(source),
    requiresCustomSamplers: hasCustomSamplerReference(source),
    requiresPreviousFrameAliases: /\bsampler_(?:fc_main|pc_main|fw_main|pw_main)\b/i.test(source),
    usesFloat1: /\bfloat1\b/.test(source),
    usesFloat4x3: /\bfloat4x3\b/.test(source),
    usesTex2Dbias: /\btex2Dbias\s*\(/.test(source),
    usesSamplerState: /\bsampler_state\b/.test(source)
  };
};

const inferFeatureRequirements = ({
  preset,
  warp,
  comp,
  waves,
  shapes
}: {
  preset: MilkPresetData;
  warp: MilkwaveShaderPass;
  comp: MilkwaveShaderPass;
  waves: MilkwaveWaveNode[];
  shapes: MilkwaveShapeNode[];
}): MilkwaveFeatureRequirements => {
  const wavePointCode = waves.some((wave) =>
    wave.expressionBlocks.some((block) => block.kind === 'wave-point' && block.lines.length > 0)
  );
  const waveInitCode = waves.some((wave) =>
    wave.expressionBlocks.some((block) => block.kind === 'wave-init' && block.lines.length > 0)
  );
  const shapeInitCode = shapes.some((shape) =>
    shape.expressionBlocks.some((block) => block.kind === 'shape-init' && block.lines.length > 0)
  );
  const shapePointCode = shapes.some((shape) =>
    shape.expressionBlocks.some((block) => block.kind === 'shape-point' && block.lines.length > 0)
  );
  const customTextureSlots =
    warp.requiresCustomSamplers ||
    comp.requiresCustomSamplers ||
    /sampler_[a-z0-9_]+/i.test(
      [...preset.perFrameCode, ...preset.perFrameInitCode, ...preset.perPixelCode].join('\n')
    );

  return {
    hasCustomWarp: Boolean(warp.source),
    hasCustomComp: Boolean(comp.source),
    hasPresetInit: preset.perFrameInitCode.length > 0,
    hasPresetFrame: preset.perFrameCode.length > 0,
    hasPresetPixel: preset.perPixelCode.length > 0,
    hasCustomWaves: waves.length > 0,
    hasCustomWaveInitCode: waveInitCode,
    hasCustomWavePointCode: wavePointCode,
    hasCustomShapes: shapes.length > 0,
    hasCustomShapeInitCode: shapeInitCode,
    hasCustomShapePointCode: shapePointCode,
    requiresVolumeNoise: warp.requiresVolumeNoise || comp.requiresVolumeNoise,
    requiresBlurSamplers: warp.requiresBlurSamplers || comp.requiresBlurSamplers,
    requiresCustomSamplers: warp.requiresCustomSamplers || comp.requiresCustomSamplers,
    requiresPreviousFrameAliases: warp.requiresPreviousFrameAliases || comp.requiresPreviousFrameAliases,
    requiresCustomTextureSlots: customTextureSlots,
    usesFloat1: warp.usesFloat1 || comp.usesFloat1,
    usesFloat4x3: warp.usesFloat4x3 || comp.usesFloat4x3,
    usesTex2Dbias: warp.usesTex2Dbias || comp.usesTex2Dbias,
    usesSamplerState: warp.usesSamplerState || comp.usesSamplerState
  };
};

export const assessMilkwaveSupportTier = (
  features: MilkwaveFeatureRequirements
): MilkwaveCapabilityAssessment => {
  const classified = classifyMilkwaveFeatures(features);
  return {
    tier: classified.tier,
    reasons: classified.reasons
  };
};

const compactLines = (lines: string[]) => lines.filter((line) => line !== undefined && line.trim().length > 0);

export const buildMilkwaveIR = (preset: MilkPresetData): MilkwaveIR => {
  const warp = inferPassRequirements('warp', preset.warpShader);
  const comp = inferPassRequirements('comp', preset.compShader);

  const waves: MilkwaveWaveNode[] = preset.waves.map((wave, index) => ({
    index,
    config: wave,
    expressionBlocks: [
      { kind: 'wave-init', lines: compactLines(wave.initCode) },
      { kind: 'wave-frame', lines: compactLines(wave.perFrameCode) },
      { kind: 'wave-point', lines: compactLines(wave.perPointCode) }
    ]
  }));

  const shapes: MilkwaveShapeNode[] = preset.shapes.map((shape, index) => ({
    index,
    config: shape,
    expressionBlocks: [
      { kind: 'shape-init', lines: compactLines(shape.initCode) },
      { kind: 'shape-frame', lines: compactLines(shape.perFrameCode) },
      { kind: 'shape-point', lines: compactLines(shape.perPointCode) }
    ]
  }));

  const expressionBlocks: MilkwaveExpressionBlock[] = [
    { kind: 'preset-init', lines: compactLines(preset.perFrameInitCode) },
    { kind: 'preset-frame', lines: compactLines(preset.perFrameCode) },
    { kind: 'preset-pixel', lines: compactLines(preset.perPixelCode) }
  ];

  const featureRequirements = inferFeatureRequirements({
    preset,
    warp,
    comp,
    waves,
    shapes
  });

  return {
    format: 'milkwave-ir',
    version: 1,
    metadata: preset.metadata,
    header: {
      milkdropPresetVersion: preset.version,
      psVersion: preset.psVersion,
      psVersionWarp: preset.psVersionWarp,
      psVersionComp: preset.psVersionComp
    },
    parameters: preset.parameters,
    expressionBlocks,
    passes: { warp, comp },
    waves,
    shapes,
    featureRequirements,
    capability: assessMilkwaveSupportTier(featureRequirements)
  };
};
