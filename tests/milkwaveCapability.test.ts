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

  it('does NOT degrade presets with per-pixel EEL code — warp mesh is now implemented', () => {
    const result = classifyMilkwaveFeatures({
      hasCustomWarp: false,
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

    // Per-pixel EEL warp mesh is now implemented — no degrade for preset_pixel in any case
    expect(result.reasonsDetailed.some((reason) => reason.key === 'preset_pixel')).toBe(false);
    // float1, tex2Dbias handled by offline translator — no longer degrade reasons
    expect(result.reasonsDetailed.some((reason) => reason.key === 'float1')).toBe(false);
    expect(result.reasonsDetailed.some((reason) => reason.key === 'tex2Dbias')).toBe(false);
    // wave and shape codes are all implemented
    expect(result.reasonsDetailed.some((reason) => reason.key === 'wave_init')).toBe(false);
    expect(result.reasonsDetailed.some((reason) => reason.key === 'wave_point')).toBe(false);
    expect(result.reasonsDetailed.some((reason) => reason.key === 'custom_shapes')).toBe(false);
    expect(result.reasonsDetailed.some((reason) => reason.key === 'shape_init')).toBe(false);
    expect(result.reasonsDetailed.some((reason) => reason.key === 'shape_point')).toBe(false);
    // No degrade reasons at all — native-supported
    expect(result.tier).toBe('native-supported');
  });

  it('does NOT degrade preset_pixel when a custom warp GLSL shader is present', () => {
    const result = classifyMilkwaveFeatures({
      hasCustomWarp: true,
      hasCustomComp: true,
      hasPresetInit: true,
      hasPresetFrame: true,
      hasPresetPixel: true,
      hasCustomWaves: false,
      hasCustomWaveInitCode: false,
      hasCustomWavePointCode: false,
      hasCustomShapes: false,
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

    // GLSL warp shader completely replaces per-pixel EEL code in MilkDrop2 — no degrade
    expect(result.reasonsDetailed.some((reason) => reason.key === 'preset_pixel')).toBe(false);
    expect(result.tier).toBe('native-supported');
  });

  it('does NOT degrade for sampler_state, volume_noise, or custom_texture_slots — all handled by offline translator', () => {
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

    // All three are handled by the offline translator — no degrade reasons
    expect(result.reasonsDetailed.some((reason) => reason.key === 'sampler_state')).toBe(false);
    expect(result.reasonsDetailed.some((reason) => reason.key === 'volume_noise')).toBe(false);
    expect(result.reasonsDetailed.some((reason) => reason.key === 'custom_texture_slots')).toBe(false);
    expect(result.tier).toBe('native-supported');
    // Features still appear in the summary for diagnostic visibility
    expect(result.featureSummary).toContain('volume-noise');
    expect(result.featureSummary).toContain('custom-texture-slots');
    expect(result.featureSummary).toContain('sampler_state');
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

  it('does NOT degrade for hasTexturedShapes: true — textured shapes are fully implemented', () => {
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

    // Textured shapes sample from the main framebuffer via tex_zoom/tex_ang UV mapping — no degrade
    expect(result.reasonsDetailed.some((reason) => reason.key === 'textured_shapes')).toBe(false);
    expect(result.tier).toBe('native-supported');
    expect(result.featureSummary).toContain('textured-shapes');
  });
});
