import { describe, expect, it } from 'vitest';
import { deriveMilkDropSeedColor, patchMilkDropGlsl } from '../src/renderer/milkdropRenderer';

describe('MilkDrop feedback seeding', () => {
  it('prefers explicit wave color parameters when present', () => {
    const seed = deriveMilkDropSeedColor(
      {
        wave_r: 0.8,
        wave_g: 0.4,
        wave_b: 0.2
      },
      [0.1, 0.9]
    );

    expect(seed).toEqual([0.8, 0.4, 0.2]);
  });

  it('falls back to deterministic non-black color when preset colors are absent', () => {
    const seed = deriveMilkDropSeedColor({}, [0.2, 0.6]);

    expect(seed[0]).toBeGreaterThan(0.1);
    expect(seed[1]).toBeGreaterThan(0.1);
    expect(seed[2]).toBeGreaterThan(0.1);
  });

  it('patches common scalar-vector coercions in imported shaders', () => {
    const source = `#version 300 es
precision highp float;
in vec2 vUv;
in vec2 vUvOriginal;
in float vRadius;
in float vAngle;
uniform vec2 uTexSize;
uniform sampler2D sampler_main;
uniform sampler2D sampler_blur1;
uniform sampler2D sampler_blur2;
uniform sampler2D sampler_blur3;
out vec4 fragColor;
vec3 GetPixel(vec2 uv) { return texture(sampler_main, uv).xyz; }
vec3 GetBlur1(vec2 uv) { return texture(sampler_blur1, uv).xyz; }
vec3 GetBlur2(vec2 uv) { return texture(sampler_blur2, uv).xyz; }
vec3 GetBlur3(vec2 uv) { return texture(sampler_blur3, uv).xyz; }
void main() {
  vec4 ret = vec4(0.0);
  vec2 uv = vUv;
  vec2 uv2 = uv*(1-.2*GetBlur3(clamp01(ret.xy))-.05*GetBlur1(clamp01(ret.xy)));
  uv2 += .1*GetBlur3(clamp01(ret.xy))+.025*GetBlur1(clamp01(ret.xy));
  ret = mix(dot(ret, 0.3333), ret, 3);
  ret = mix(ret, lum(ret), 0.2);
  ret = 1-clamp01(ret);
  fragColor = ret;
}`;

    const patched = patchMilkDropGlsl(source);

    expect(patched).toContain('mix(vec3(dot(ret, vec3(0.3333))), ret, 3.0');
    expect(patched).toContain('mix(ret, vec3(lum(ret)), 0.2)');
    expect(patched).toContain('ret = vec3(1.0) - clamp01(ret);');
    expect(patched).toContain('vec2 uv2 = uv*( vec2(1.0) - .2*GetBlur3(clamp01(ret.xy)).xy-.05*GetBlur1(clamp01(ret.xy)).xy);');
    expect(patched).toContain('uv2 += .1*GetBlur3(clamp01(ret.xy)).xy+.025*GetBlur1(clamp01(ret.xy)).xy;');
  });
});
