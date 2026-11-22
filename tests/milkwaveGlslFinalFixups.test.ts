import { describe, expect, it } from 'vitest';
import { aliasUndeclaredSamplers, dropNonConstantConst, resolveTexSizeSwizzles } from '../src/shared/milkwaveGlslPatcher';

describe('GLSL final fix-ups (show scenes stuck on a fallback warp)', () => {
  it('resolves any texsize swizzle (texsize = w, h, 1/w, 1/h)', () => {
    expect(resolveTexSizeSwizzles('a*uTexSize.wz')).toBe('a*vec2((1.0/uTexSize.y), (1.0/uTexSize.x))');
    expect(resolveTexSizeSwizzles('uTexSize.zw')).toBe('vec2((1.0/uTexSize.x), (1.0/uTexSize.y))');
    expect(resolveTexSizeSwizzles('uTexSize.z')).toBe('(1.0/uTexSize.x)');
    expect(resolveTexSizeSwizzles('uTexSize.xy + uTexSize.x')).toBe('uTexSize.xy + uTexSize.x');
  });

  it('maps an undeclared custom sampler wherever it is used', () => {
    const src = '#define tex sampler_Pattern_001\nvec3 c = texture(tex, uv).xyz; vec3 d = texture(sampler_main, uv).xyz;';
    const out = aliasUndeclaredSamplers(src);
    expect(out).not.toContain('sampler_Pattern_001');
    expect(out).toContain('#define tex sampler_noise_lq');
    expect(out).toContain('sampler_main');
  });

  it('keeps a declared custom sampler', () => {
    const src = 'uniform sampler2D sampler_custom;\nvec3 c = texture(sampler_custom, uv).xyz;';
    expect(aliasUndeclaredSamplers(src)).toBe(src);
  });

  it('drops const only when the value is not a compile-time constant', () => {
    expect(dropNonConstantConst('const vec2 par = vec2 (q1,q2);')).toBe('vec2 par = vec2 (q1,q2);');
    expect(dropNonConstantConst('const float k = 1.5e3;')).toBe('const float k = 1.5e3;');
    expect(dropNonConstantConst('const vec3 w = vec3(0.2, 0.7, 0.1);')).toBe('const vec3 w = vec3(0.2, 0.7, 0.1);');
  });
});
