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
    expect(result.translation.passes.warp.normalized?.dialectSource).toContain('mix(GetPixel(uv),GetBlur1(uv),0.2)');
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

  it('header contains q-vars, sampler aliases, rotation matrices and texsize macro', () => {
    const preset = parseMilkFile(readFileSync(join(fixturesDir, 'with-shader.milk'), 'utf-8'), 'Test - Shader.milk', 'TestFolder');
    expect(preset).not.toBeNull();

    const result = translateMilkwavePresetOffline(preset!);
    const source = result.translation.passes.warp.source;

    expect(source).toContain('uniform float q1;');
    expect(source).toContain('uniform float q32;');
    expect(source).toContain('#define sampler_fc_main sampler_main');
    expect(source).toContain('#define sampler_noisevol_lq sampler_noise_lq');
    expect(source).toContain('uniform mat4 rot_s1;');
    expect(source).toContain('uniform vec4 _c0;');
    expect(source).toContain('uniform vec4 rand_frame;');
    expect(source).toContain('#define texsize vec4(uTexSize, 1.0/uTexSize)');
  });

  it('main wrapper uses vec3 ret and outputs vec4(ret, 1.0)', () => {
    const preset = parseMilkFile(readFileSync(join(fixturesDir, 'with-shader.milk'), 'utf-8'), 'Test - Shader.milk', 'TestFolder');
    expect(preset).not.toBeNull();

    preset!.warpShader = 'shader_body {\nret = GetPixel(uv);\n}';

    const result = translateMilkwavePresetOffline(preset!);
    const source = result.translation.passes.warp.source;

    expect(source).toContain('vec3 ret = vec3(0.0)');
    expect(source).toContain('fragColor = vec4(ret, 1.0)');
    expect(source).not.toContain('vec4 ret = vec4(0.0)');
  });

  it('fixes uTexSize .z/.w/.zw swizzle access from texsize translation', () => {
    const preset = parseMilkFile(readFileSync(join(fixturesDir, 'with-shader.milk'), 'utf-8'), 'Test - Shader.milk', 'TestFolder');
    expect(preset).not.toBeNull();

    preset!.compShader = [
      'shader_body {',
      'float invW = texsize.z;',
      'float invH = texsize.w;',
      'vec2 invSize = texsize.zw;',
      '}'
    ].join('\n');

    const result = translateMilkwavePresetOffline(preset!);
    const dialectSource = result.translation.passes.comp.normalized?.dialectSource ?? '';

    expect(dialectSource).toContain('(1.0/uTexSize.x)');
    expect(dialectSource).toContain('(1.0/uTexSize.y)');
    expect(dialectSource).toContain('(vec2(1.0)/uTexSize)');
    expect(dialectSource).not.toContain('uTexSize.z');
    expect(dialectSource).not.toContain('uTexSize.w');
  });

  it('converts boolean NOT on floats to ternary expression', () => {
    const preset = parseMilkFile(readFileSync(join(fixturesDir, 'with-shader.milk'), 'utf-8'), 'Test - Shader.milk', 'TestFolder');
    expect(preset).not.toBeNull();

    preset!.compShader = 'shader_body {\nfloat inv = !enabled;\n}';

    const result = translateMilkwavePresetOffline(preset!);
    const dialectSource = result.translation.passes.comp.normalized?.dialectSource ?? '';

    expect(dialectSource).toContain('(enabled == 0.0 ? 1.0 : 0.0)');
    expect(dialectSource).not.toMatch(/![a-zA-Z]/);
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

  it('rewrites tex2Dlod to textureLod4 bridge and includes bridge helper in header', () => {
    const preset = parseMilkFile(readFileSync(join(fixturesDir, 'with-shader.milk'), 'utf-8'), 'Test - Shader.milk', 'TestFolder');
    expect(preset).not.toBeNull();

    preset!.warpShader = [
      'shader_body {',
      'ret = tex2Dlod(sampler_main, float4(uv, 0.0, 2.0));',
      '}'
    ].join('\n');

    const result = translateMilkwavePresetOffline(preset!);
    const source = result.translation.passes.warp.source;

    expect(source).toContain('vec4 textureLod4(sampler2D s, vec4 uv4)');
    expect(source).not.toContain('tex2Dlod(');
    expect(source).toContain('textureLod4(');
  });

  it('rewrites HLSL derivative and math functions to GLSL equivalents', () => {
    const preset = parseMilkFile(readFileSync(join(fixturesDir, 'with-shader.milk'), 'utf-8'), 'Test - Shader.milk', 'TestFolder');
    expect(preset).not.toBeNull();

    preset!.compShader = [
      'shader_body {',
      'float dx = ddx(ret.x);',
      'float dy = ddy(ret.y);',
      'float inv = rsqrt(dot(ret.xy, ret.xy));',
      'float angle = atan2(ret.y, ret.x);',
      '}'
    ].join('\n');

    const result = translateMilkwavePresetOffline(preset!);
    const dialectSource = result.translation.passes.comp.normalized?.dialectSource ?? '';

    expect(dialectSource).toContain('dFdx(');
    expect(dialectSource).toContain('dFdy(');
    expect(dialectSource).toContain('inversesqrt(');
    expect(dialectSource).toContain('atan(');
    expect(dialectSource).not.toContain('ddx(');
    expect(dialectSource).not.toContain('ddy(');
    expect(dialectSource).not.toContain('rsqrt(');
    expect(dialectSource).not.toContain('atan2(');
  });

  it('rewrites tex2Dgrad to textureGrad', () => {
    const preset = parseMilkFile(readFileSync(join(fixturesDir, 'with-shader.milk'), 'utf-8'), 'Test - Shader.milk', 'TestFolder');
    expect(preset).not.toBeNull();

    preset!.warpShader = [
      'shader_body {',
      'ret = tex2Dgrad(sampler_main, uv, ddx(uv), ddy(uv));',
      '}'
    ].join('\n');

    const result = translateMilkwavePresetOffline(preset!);
    const dialectSource = result.translation.passes.warp.normalized?.dialectSource ?? '';

    expect(dialectSource).toContain('textureGrad(');
    expect(dialectSource).not.toContain('tex2Dgrad(');
    expect(dialectSource).toContain('dFdx(');
    expect(dialectSource).toContain('dFdy(');
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

    expect(source).toContain('vec2 uv2 = uv*(1-.2*GetBlur3(clamp01(ret.xy)).xy-.05*GetBlur1(clamp01(ret.xy)).xy);');
    expect(source).toContain('uv2 += .1*GetBlur3(clamp01(ret.xy)).xy+.025*GetBlur1(clamp01(ret.xy)).xy;');
    expect(source).toContain('ret = mix(vec3(dot(ret, vec3(0.3333))), ret, 3.0);');
    expect(source).toContain('ret = mix(ret, vec3(lum(ret)), 0.2);');
    expect(source).toContain('ret = vec3( 1.0 ) - clamp01(ret);');
  });
});
