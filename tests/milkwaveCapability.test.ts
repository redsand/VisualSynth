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
      hasCustomWaveInitCode: false,
      hasCustomWavePointCode: false,
      hasCustomShapes: false,
      hasCustomShapeInitCode: false,
      hasCustomShapePointCode: false,
      hasTexturedShapes: false,
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
      hasCustomWaveInitCode: true,
      hasCustomWavePointCode: true,
      hasCustomShapes: true,
      hasCustomShapeInitCode: true,
      hasCustomShapePointCode: true,
      hasTexturedShapes: false,
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
    // wave_init, wave_point, custom_shapes, shape_init, shape_point are now implemented — no longer degrade reasons
    expect(result.reasonsDetailed.some((reason) => reason.key === 'wave_init')).toBe(false);
    expect(result.reasonsDetailed.some((reason) => reason.key === 'wave_point')).toBe(false);
    expect(result.reasonsDetailed.some((reason) => reason.key === 'custom_shapes')).toBe(false);
    expect(result.reasonsDetailed.some((reason) => reason.key === 'shape_init')).toBe(false);
    expect(result.reasonsDetailed.some((reason) => reason.key === 'shape_point')).toBe(false);
  });

  it('marks runtime-contract blockers as fallback-only', () => {
    const result = classifyMilkwaveFeatures({
      hasCustomWarp: true,
      hasCustomComp: false,
      hasPresetInit: false,
      hasPresetFrame: false,
      hasPresetPixel: false,
      hasCustomWaves: false,
      hasCustomWaveInitCode: false,
      hasCustomWavePointCode: false,
      hasCustomShapes: false,
      hasCustomShapeInitCode: false,
      hasCustomShapePointCode: false,
      hasTexturedShapes: false,
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

  it('does NOT produce a degrade reason for hasTexturedShapes: false', () => {
    const result = classifyMilkwaveFeatures({
      hasCustomWarp: false,
      hasCustomComp: false,
      hasPresetInit: false,
      hasPresetFrame: false,
      hasPresetPixel: false,
      hasCustomWaves: false,
      hasCustomWaveInitCode: false,
      hasCustomWavePointCode: false,
      hasCustomShapes: true,
      hasCustomShapeInitCode: false,
      hasCustomShapePointCode: false,
      hasTexturedShapes: false,
      requiresVolumeNoise: false,
      requiresBlurSamplers: false,
      requiresCustomSamplers: false,
      requiresPreviousFrameAliases: false,
      requiresCustomTextureSlots: false,
      usesFloat1: false,
      usesFloat4x3: false,
      usesTex2Dbias: false,
      usesSamplerState: false
    });

    expect(result.reasonsDetailed.some((reason) => reason.key === 'textured_shapes')).toBe(false);
    expect(result.tier).toBe('native-supported');
  });

  it('produces a textured_shapes degrade reason for hasTexturedShapes: true', () => {
    const result = classifyMilkwaveFeatures({
      hasCustomWarp: false,
      hasCustomComp: false,
      hasPresetInit: false,
      hasPresetFrame: false,
      hasPresetPixel: false,
      hasCustomWaves: false,
      hasCustomWaveInitCode: false,
      hasCustomWavePointCode: false,
      hasCustomShapes: true,
      hasCustomShapeInitCode: false,
      hasCustomShapePointCode: false,
      hasTexturedShapes: true,
      requiresVolumeNoise: false,
      requiresBlurSamplers: false,
      requiresCustomSamplers: false,
      requiresPreviousFrameAliases: false,
      requiresCustomTextureSlots: false,
      usesFloat1: false,
      usesFloat4x3: false,
      usesTex2Dbias: false,
      usesSamplerState: false
    });

    expect(result.reasonsDetailed.some((reason) => reason.key === 'textured_shapes')).toBe(true);
    expect(result.reasonsDetailed.find((reason) => reason.key === 'textured_shapes')?.severity).toBe('degrade');
    expect(result.tier).toBe('supported-with-degradation');
    expect(result.featureSummary).toContain('textured-shapes');
  });
});
