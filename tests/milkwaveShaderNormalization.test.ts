import { describe, expect, it } from 'vitest';
import { normalizeMilkwaveShaderPass } from '../src/shared/milkwaveShaderNormalization';

describe('Milkwave shader normalization', () => {
  it('splits prelude helpers from shader_body lines', () => {
    const normalized = normalizeMilkwaveShaderPass(
      [
        '`static const float2 centre = float2(0.5, 0.5);',
        '`float3 lavcol(float t) { return smoothstep(0, 0.8, pow(t, float3(1,2,4))); }',
        '`shader_body {',
        '`ret = tex2D(sampler_main, uv).rgb;',
        '`}'
      ].join('\n'),
      'comp'
    );

    expect(normalized.hasShaderBodyBlock).toBe(true);
    expect(normalized.preludeLines).toContain('static const float2 centre = float2(0.5, 0.5);');
    expect(normalized.helperLines).toContain('float3 lavcol(float t) { return smoothstep(0, 0.8, pow(t, float3(1,2,4))); }');
    expect(normalized.bodyLines).toEqual(['ret = tex2D(sampler_main, uv).rgb;']);
    expect(normalized.source).toContain('shader_body {');
  });

  it('preserves shader text without shader_body blocks', () => {
    const normalized = normalizeMilkwaveShaderPass(
      [
        '`ret = tex2D(sampler_main, uv).rgb;',
        '`ret *= 0.5;'
      ].join('\n'),
      'warp'
    );

    expect(normalized.hasShaderBodyBlock).toBe(false);
    expect(normalized.bodyLines).toEqual([]);
    expect(normalized.preludeLines).toEqual([
      'ret = tex2D(sampler_main, uv).rgb;',
      'ret *= 0.5;'
    ]);
  });
});
