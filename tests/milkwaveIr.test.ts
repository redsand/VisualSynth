import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseMilkFile } from '../src/shared/milkwaveParser';
import { buildMilkwaveIR, assessMilkwaveSupportTier } from '../src/shared/milkwaveIr';

const fixturesDir = join(__dirname, 'fixtures', 'milkwave');

describe('Milkwave IR', () => {
  it('normalizes parsed preset data into a stable IR shape', () => {
    const content = readFileSync(join(fixturesDir, 'with-shader.milk'), 'utf-8');
    const parsed = parseMilkFile(content, 'Test - Shader.milk', 'TestFolder');
    expect(parsed).not.toBeNull();

    const ir = buildMilkwaveIR(parsed!);
    expect(ir.format).toBe('milkwave-ir');
    expect(ir.version).toBe(1);
    expect(ir.metadata.name).toBe('Shader');
    expect(ir.passes.warp.source).toContain('shader_body');
    expect(ir.passes.comp.source).toContain('shader_body');
    expect(ir.expressionBlocks.find((block) => block.kind === 'preset-frame')?.lines.length).toBeGreaterThan(0);
  });

  it('detects compatibility blockers from raw shader requirements', () => {
    const parsed = parseMilkFile(
      [
        'MILKDROP_PRESET_VERSION=201',
        '[preset00]',
        'warp_0=shader_body {',
        'warp_1=  float1 d = 0.005;',
        'warp_2=  sampler3D vol;',
        'warp_3=  ret = tex2D(sampler_main, uv).xyz;',
        'warp_4=}'
      ].join('\n'),
      'Author - Blocked.milk',
      'TestFolder'
    );
    expect(parsed).not.toBeNull();

    const ir = buildMilkwaveIR(parsed!);
    expect(ir.featureRequirements.usesFloat1).toBe(true);
    expect(ir.featureRequirements.requiresVolumeNoise).toBe(false);
    expect(ir.capability.tier).toBe('supported-with-degradation');
    expect(ir.capability.reasons.some((reason) => reason.includes('scalar aliases'))).toBe(true);
  });

  it('classifies sampler-state driven presets as fallback-only', () => {
    const tier = assessMilkwaveSupportTier({
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
      requiresVolumeNoise: false,
      requiresBlurSamplers: false,
      requiresCustomSamplers: false,
      requiresPreviousFrameAliases: false,
      requiresCustomTextureSlots: false,
      usesFloat1: false,
      usesFloat4x3: false,
      usesTex2Dbias: false,
      usesSamplerState: true
    });

    expect(tier.tier).toBe('fallback-only');
    expect(tier.reasons.some((reason) => reason.includes('sampler_state'))).toBe(true);
  });

  it('captures wave and shape init/per-point blocks in the IR', () => {
    const parsed = parseMilkFile(
      [
        'MILKDROP_PRESET_VERSION=201',
        '[preset00]',
        'wavecode_0_enabled=1',
        'wave_0_init1=t1 = 0.5;',
        'wave_0_per_frame1=x = x + 0.1;',
        'wave_0_per_point1=y = sample;',
        'shapecode_0_enabled=1',
        'shape_0_init1=t2 = 0.25;',
        'shape_0_per_frame1=ang = ang + 0.02;',
        'shape_0_per_point1=x = x + 0.01;'
      ].join('\n'),
      'Author - ShapeWave.milk',
      'TestFolder'
    );
    expect(parsed).not.toBeNull();

    const ir = buildMilkwaveIR(parsed!);
    expect(ir.featureRequirements.hasCustomWaveInitCode).toBe(true);
    expect(ir.featureRequirements.hasCustomWavePointCode).toBe(true);
    expect(ir.featureRequirements.hasCustomShapeInitCode).toBe(true);
    expect(ir.featureRequirements.hasCustomShapePointCode).toBe(true);
    expect(ir.waves[0]?.expressionBlocks.some((block) => block.kind === 'wave-init' && block.lines[0] === 't1 = 0.5;')).toBe(true);
    expect(ir.shapes[0]?.expressionBlocks.some((block) => block.kind === 'shape-point' && block.lines[0] === 'x = x + 0.01;')).toBe(true);
  });

  it('includes hasTexturedShapes in the feature requirements object', () => {
    const parsed = parseMilkFile(
      [
        'MILKDROP_PRESET_VERSION=201',
        '[preset00]'
      ].join('\n'),
      'Author - Simple.milk',
      'TestFolder'
    );
    expect(parsed).not.toBeNull();

    const ir = buildMilkwaveIR(parsed!);
    expect(ir.featureRequirements).toHaveProperty('hasTexturedShapes');
    expect(typeof ir.featureRequirements.hasTexturedShapes).toBe('boolean');
  });

  it('detects hasTexturedShapes: false when shapes have textured: false', () => {
    const parsed = parseMilkFile(
      [
        'MILKDROP_PRESET_VERSION=201',
        '[preset00]',
        'shapecode_0_enabled=1',
        'shapecode_0_textured=0',
        'shape_0_per_frame1=ang = ang + 0.01;'
      ].join('\n'),
      'Author - NonTexturedShape.milk',
      'TestFolder'
    );
    expect(parsed).not.toBeNull();

    const ir = buildMilkwaveIR(parsed!);
    expect(ir.featureRequirements.hasTexturedShapes).toBe(false);
  });

  it('detects hasTexturedShapes: true when shapes have textured: true', () => {
    const parsed = parseMilkFile(
      [
        'MILKDROP_PRESET_VERSION=201',
        '[preset00]',
        'shapecode_0_enabled=1',
        'shapecode_0_textured=1',
        'shape_0_per_frame1=ang = ang + 0.01;'
      ].join('\n'),
      'Author - TexturedShape.milk',
      'TestFolder'
    );
    expect(parsed).not.toBeNull();

    const ir = buildMilkwaveIR(parsed!);
    expect(ir.featureRequirements.hasTexturedShapes).toBe(true);
  });
});
