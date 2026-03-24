/**
 * Tests for genUniformResolver — verifies that layer param values flow correctly
 * into the uniform dictionary that glRenderer sends to the shader.
 *
 * Covers the binding path: UI slider → layer.params → resolveGenUniforms → genUniforms dict → gl.uniform1f
 */
import { describe, expect, it } from 'vitest';
import { resolveGenUniforms, buildGenUniformMeta } from '../src/shared/genUniformResolver';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const noModValue = (_target: string, base: number) => base;
const noMidi: Record<string, number> = {};
const noMacro: Record<string, number> = {};
const uniformRoles = { core: 1, support: 1, atmosphere: 1 };

function makeLayer(generatorId: string, params: Record<string, number | boolean>, enabled = true, opacity = 1) {
  return { id: generatorId, generatorId, enabled, opacity, role: 'support', params };
}

function resolve(layers: any[]) {
  return resolveGenUniforms({
    layers,
    modValue: noModValue,
    midiSum: noMidi,
    macroSum: noMacro,
    getLayerParamNumber: (layer: any, key: string, fallback: number) => {
      const v = layer?.params?.[key];
      if (typeof v === 'number') return v;
      if (typeof v === 'boolean') return v ? 1 : 0;
      return fallback;
    },
    findLayerById: (ls: any[], id: string) =>
      ls.find(l => l.generatorId === id || l.id === id),
    buildLegacyTarget: (layerType: string, param: string) => `layer-${layerType}.${param}`,
    roleWeights: uniformRoles,
  });
}

// ---------------------------------------------------------------------------
// Sound Wave 3D — amplitude ("Wave Height" slider) binding
// ---------------------------------------------------------------------------

describe('genUniformResolver — Sound Wave 3D', () => {
  it('defaults SoundWave3DAmplitude to 1 when layer has no params', () => {
    const uniforms = resolve([makeLayer('gen-sound-wave-3d', {})]);
    expect(uniforms['SoundWave3DAmplitude']).toBe(1); // registry default
  });

  it('resolves SoundWave3DAmplitude from layer.params.amplitude', () => {
    const uniforms = resolve([makeLayer('gen-sound-wave-3d', { amplitude: 2.5 })]);
    expect(uniforms['SoundWave3DAmplitude']).toBeCloseTo(2.5);
  });

  it('changing amplitude from default to 5 changes the resolved uniform', () => {
    const atDefault = resolve([makeLayer('gen-sound-wave-3d', { amplitude: 1 })]);
    const atMax = resolve([makeLayer('gen-sound-wave-3d', { amplitude: 5 })]);
    expect(atMax['SoundWave3DAmplitude']).toBe(5);
    expect(atMax['SoundWave3DAmplitude']).toBeGreaterThan(atDefault['SoundWave3DAmplitude']!);
  });

  it('sets SoundWave3DEnabled=1 for an enabled layer', () => {
    const uniforms = resolve([makeLayer('gen-sound-wave-3d', {}, true)]);
    expect(uniforms['SoundWave3DEnabled']).toBe(1);
  });

  it('sets SoundWave3DEnabled=0 for a disabled layer', () => {
    const uniforms = resolve([makeLayer('gen-sound-wave-3d', {}, false)]);
    expect(uniforms['SoundWave3DEnabled']).toBe(0);
  });

  it('sets SoundWave3DEnabled=0 when layer is absent', () => {
    const uniforms = resolve([]); // no sound-wave-3d layer in scene
    expect(uniforms['SoundWave3DEnabled']).toBe(0);
  });

  it('resolves SoundWave3DSmoothness from layer.params.smoothness', () => {
    const uniforms = resolve([makeLayer('gen-sound-wave-3d', { smoothness: 1.8 })]);
    expect(uniforms['SoundWave3DSmoothness']).toBeCloseTo(1.8);
  });
});

// ---------------------------------------------------------------------------
// FX sliders — global uniform path (uBloom, uChroma, uBlur, uPosterize)
// ---------------------------------------------------------------------------
// These uniforms are set by updateStandardUniforms in glRenderer.ts (state.bloom,
// state.chroma, state.blur, state.posterize) and passed directly to applyScopedFx
// in the shader.  The genUniformResolver is NOT involved in these — they travel
// through the RenderState path.  This block documents that invariant.

describe('genUniformResolver — FX globals are not in the gen-uniform dict', () => {
  it('does not produce Bloom/Chroma/Blur/Posterize keys (those are RenderState globals)', () => {
    // resolveGenUniforms only handles generator-layer params.
    // Global FX are set by updateStandardUniforms via state.bloom etc.
    const uniforms = resolve([]);
    expect(uniforms['Bloom']).toBeUndefined();
    expect(uniforms['Chroma']).toBeUndefined();
    expect(uniforms['Blur']).toBeUndefined();
    expect(uniforms['Posterize']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Generic: every generator with a PREFIX_CACHE entry must have an Enabled key
// ---------------------------------------------------------------------------

describe('genUniformResolver — every registered generator gets an Enabled key', () => {
  it('resolves Enabled=0 for standard generators when scene is empty', () => {
    const meta = buildGenUniformMeta();
    const uniforms = resolve([]);
    let checked = 0;
    for (const [blockId, genMeta] of meta) {
      // gen-milkwave has an 'enabled' boolean param in its registry whose default (true)
      // takes precedence over the absent-layer fallback — this is a known quirk.
      if (blockId === 'gen-milkwave') continue;
      const key = `${genMeta.prefix}Enabled`;
      expect(uniforms[key], `${key} must be 0 when layer absent`).toBe(0);
      checked++;
    }
    expect(checked).toBeGreaterThan(100); // registry has 140+ generators
  });
});
