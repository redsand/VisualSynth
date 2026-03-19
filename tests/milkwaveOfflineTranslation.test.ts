import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseMilkFile } from '../src/shared/milkwaveParser';
import { translateMilkwavePresetOffline } from '../src/shared/milkwaveOfflineTranslation';

const fixturesDir = join(__dirname, 'fixtures', 'milkwave');

describe('Milkwave offline translation', () => {
  it('builds a reusable offline translation artifact for shader presets', () => {
    const content = readFileSync(join(fixturesDir, 'with-shader.milk'), 'utf-8');
    const preset = parseMilkFile(content, 'Test - Shader.milk', 'TestFolder');

    expect(preset).not.toBeNull();

    const result = translateMilkwavePresetOffline(preset!);

    expect(result.translation.pipeline).toBe('milkwave-offline-v1');
    expect(result.translation.passes.warp.requested).toBe(true);
    expect(result.translation.passes.warp.generated).toBe(true);
    expect(result.translation.passes.warp.backend).toBe('milkwave-direct-v2');
    expect(result.translation.passes.warp.normalized?.hasShaderBodyBlock).toBe(true);
    expect(result.translation.passes.warp.normalized?.dialectSource).toContain('mix(GetPixel(uv),GetBlur1(uv).xy,0.2)');
    expect(result.translation.passes.warp.source).toContain('float lum(vec3 x)');
    expect(result.translation.passes.warp.source).toContain('vec4 textureBias(sampler2D s, vec4 uv4)');
    expect(result.translation.passes.warp.source).toContain('void main()');
    expect(result.translation.passes.comp.requested).toBe(true);
    expect(result.translation.passes.comp.normalized?.helperLineCount).toBeGreaterThanOrEqual(1);
    expect(result.translation.passes.comp.normalized?.dialectSource).toContain('vec3 lavcol');
    expect(result.translation.passes.comp.normalized?.dialectSource).toContain('texture(sampler_main, uv).xyz;');
    expect(result.translation.passes.comp.source).toContain('vec3 lavcol');
    expect(result.translation.passes.comp.source).toContain('fragColor');
    expect(result.translation.passes.comp.source).not.toContain('float3 ');
    expect(result.translation.passes.comp.source).not.toContain('tex2D(');
    expect(result.translation.featureSummary).toEqual(result.capability.featureSummary);
  });

  it('keeps absent shader passes empty without fabricating GLSL', () => {
    const content = readFileSync(join(fixturesDir, 'simple.milk'), 'utf-8');
    const preset = parseMilkFile(content, 'Test - Simple.milk', 'TestFolder');

    expect(preset).not.toBeNull();

    const result = translateMilkwavePresetOffline(preset!);

    expect(result.translation.passes.warp.requested).toBe(false);
    expect(result.translation.passes.warp.source).toBe('');
    expect(result.translation.passes.comp.requested).toBe(false);
    expect(result.translation.passes.comp.source).toBe('');
  });

  it('applies scalar-vector coercion fixes during offline generation', () => {
    const preset = parseMilkFile(readFileSync(join(fixturesDir, 'with-shader.milk'), 'utf-8'), 'Test - Shader.milk', 'TestFolder');
    expect(preset).not.toBeNull();

    preset!.compShader = [
      'float3 lavcol(float t) { return smoothstep(0,0.8,pow(t,float3(1,2,4))); }',
      'shader_body {',
      'vec2 uv2 = uv*(1-.2*GetBlur3(clamp01(ret.xy))-.05*GetBlur1(clamp01(ret.xy)));',
      'uv2 += .1*GetBlur3(clamp01(ret.xy))+.025*GetBlur1(clamp01(ret.xy));',
      'ret = mix(dot(ret, 0.3333), ret, 3);',
      'ret = mix(ret, lum(ret), 0.2);',
      'ret = 1-clamp01(ret);',
      '}'
    ].join('\n');

    const result = translateMilkwavePresetOffline(preset!);
    const source = result.translation.passes.comp.source;

    expect(source).toContain('vec2 uv2 = uv*( vec2(1) - .2*GetBlur3(clamp01(ret.xy)).xy-.05*GetBlur1(clamp01(ret.xy)).xy);');
    expect(source).toContain('uv2 += .1*GetBlur3(clamp01(ret.xy)).xy+.025*GetBlur1(clamp01(ret.xy)).xy;');
    expect(source).toContain('ret = mix(vec3(dot(ret, vec3(0.3333))), ret, 3.0);');
    expect(source).toContain('ret = mix(ret, vec3(lum(ret)), 0.2);');
    expect(source).toContain('ret = vec3(1) - clamp01(ret);');
  });
});
