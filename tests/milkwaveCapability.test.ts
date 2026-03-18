import { describe, expect, it } from 'vitest';
import { classifyMilkwaveFeatures } from '../src/shared/milkwaveCapability';

describe('Milkwave capability classifier', () => {
  it('classifies simple presets as native-supported', () => {
    const result = classifyMilkwaveFeatures({
      hasCustomWarp: true,
      hasCustomComp: true,
      hasPresetInit: true,
      hasPresetFrame: true,
      hasPresetPixel: false,
      hasCustomWaves: false,
      hasCustomWavePointCode: false,
      hasCustomShapes: false,
      requiresVolumeNoise: false,
      requiresBlurSamplers: true,
      requiresCustomSamplers: false,
      requiresPreviousFrameAliases: true,
      requiresCustomTextureSlots: false,
      usesFloat1: false,
      usesFloat4x3: false,
      usesTex2Dbias: false,
      usesSamplerState: false
    });

    expect(result.tier).toBe('native-supported');
    expect(result.reasonsDetailed).toEqual([]);
    expect(result.featureSummary).toContain('custom-warp');
  });

  it('downgrades presets with degradable features', () => {
    const result = classifyMilkwaveFeatures({
      hasCustomWarp: true,
      hasCustomComp: true,
      hasPresetInit: true,
      hasPresetFrame: true,
      hasPresetPixel: true,
      hasCustomWaves: true,
      hasCustomWavePointCode: true,
      hasCustomShapes: false,
      requiresVolumeNoise: false,
      requiresBlurSamplers: true,
      requiresCustomSamplers: false,
      requiresPreviousFrameAliases: true,
      requiresCustomTextureSlots: false,
      usesFloat1: true,
      usesFloat4x3: false,
      usesTex2Dbias: true,
      usesSamplerState: false
    });

    expect(result.tier).toBe('supported-with-degradation');
    expect(result.reasonsDetailed.some((reason) => reason.key === 'float1')).toBe(true);
    expect(result.reasonsDetailed.some((reason) => reason.key === 'preset_pixel')).toBe(true);
    expect(result.reasonsDetailed.some((reason) => reason.severity === 'degrade')).toBe(true);
  });

  it('marks runtime-contract blockers as fallback-only', () => {
    const result = classifyMilkwaveFeatures({
      hasCustomWarp: true,
      hasCustomComp: false,
      hasPresetInit: false,
      hasPresetFrame: false,
      hasPresetPixel: false,
      hasCustomWaves: false,
      hasCustomWavePointCode: false,
      hasCustomShapes: false,
      requiresVolumeNoise: true,
      requiresBlurSamplers: false,
      requiresCustomSamplers: false,
      requiresPreviousFrameAliases: false,
      requiresCustomTextureSlots: true,
      usesFloat1: false,
      usesFloat4x3: false,
      usesTex2Dbias: false,
      usesSamplerState: true
    });

    expect(result.tier).toBe('fallback-only');
    expect(result.reasonsDetailed.some((reason) => reason.severity === 'fallback')).toBe(true);
    expect(result.reasonsDetailed.some((reason) => reason.key === 'sampler_state')).toBe(true);
  });
});
