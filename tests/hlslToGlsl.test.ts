import { describe, expect, it } from 'vitest';
import {
  convertType,
  convertFunction,
  convertUniform,
  hlslToGlsl,
  transpileMilkDropShader,
  inferPresetCategory
} from '../src/shared/hlslToGlsl';

describe('HLSL to GLSL Transpiler', () => {
  describe('convertType', () => {
    it('should convert float2 to vec2', () => {
      expect(convertType('float2')).toBe('vec2');
    });

    it('should convert float3 to vec3', () => {
      expect(convertType('float3')).toBe('vec3');
    });

    it('should convert float4 to vec4', () => {
      expect(convertType('float4')).toBe('vec4');
    });

    it('should convert float2x2 to mat2', () => {
      expect(convertType('float2x2')).toBe('mat2');
    });

    it('should convert float3x3 to mat3', () => {
      expect(convertType('float3x3')).toBe('mat3');
    });

    it('should convert float4x4 to mat4', () => {
      expect(convertType('float4x4')).toBe('mat4');
    });

    it('should convert half to float', () => {
      expect(convertType('half')).toBe('float');
    });

    it('should pass through unknown types', () => {
      expect(convertType('customType')).toBe('customType');
    });
  });

  describe('convertFunction', () => {
    it('should convert tex2D to texture', () => {
      expect(convertFunction('tex2D')).toBe('texture');
    });

    it('should convert lerp to mix', () => {
      expect(convertFunction('lerp')).toBe('mix');
    });

    it('should convert frac to fract', () => {
      expect(convertFunction('frac')).toBe('fract');
    });

    it('should convert ddx to dFdx', () => {
      expect(convertFunction('ddx')).toBe('dFdx');
    });

    it('should convert ddy to dFdy', () => {
      expect(convertFunction('ddy')).toBe('dFdy');
    });

    it('should pass through GLSL-compatible functions', () => {
      expect(convertFunction('sin')).toBe('sin');
      expect(convertFunction('cos')).toBe('cos');
      expect(convertFunction('normalize')).toBe('normalize');
    });
  });

  describe('convertUniform', () => {
    it('should convert time to uTime', () => {
      expect(convertUniform('time')).toBe('uTime');
    });

    it('should convert bass to audioLow', () => {
      expect(convertUniform('bass')).toBe('audioLow');
    });

    it('should convert mid to audioMid', () => {
      expect(convertUniform('mid')).toBe('audioMid');
    });

    it('should convert treb to audioHigh', () => {
      expect(convertUniform('treb')).toBe('audioHigh');
    });

    it('should convert vol to uRms', () => {
      expect(convertUniform('vol')).toBe('uRms');
    });

    it('should convert bass_att to audioLowSmooth', () => {
      expect(convertUniform('bass_att')).toBe('audioLowSmooth');
    });

    it('should convert frame to uFrame', () => {
      expect(convertUniform('frame')).toBe('uFrame');
    });

    it('should pass through unknown variables', () => {
      expect(convertUniform('customVar')).toBe('customVar');
    });
  });

  describe('hlslToGlsl', () => {
    it('should convert basic HLSL types to GLSL', () => {
      const hlsl = `float2 coords = vec2(0.5);`;
      const glsl = hlslToGlsl(hlsl, { wrapInShader: false });
      expect(glsl).toContain('vec2 coords');
    });

    it('should convert tex2D calls', () => {
      const hlsl = `float4 color = tex2D(sampler, coords);`;
      const glsl = hlslToGlsl(hlsl, { wrapInShader: false });
      expect(glsl).toContain('texture(sampler, coords)');
    });

    it('should convert lerp to mix', () => {
      const hlsl = `float result = lerp(a, b, t);`;
      const glsl = hlslToGlsl(hlsl, { wrapInShader: false });
      expect(glsl).toContain('mix(a, b, t)');
    });

    it('should convert frac to fract', () => {
      const hlsl = `float result = frac(x);`;
      const glsl = hlslToGlsl(hlsl, { wrapInShader: false });
      expect(glsl).toContain('fract(x)');
    });

    it('should convert static const to const', () => {
      const hlsl = `static const float PI = 3.14159;`;
      const glsl = hlslToGlsl(hlsl, { wrapInShader: false });
      expect(glsl).toContain('const float PI');
      expect(glsl).not.toContain('static');
    });

    it('should remove backticks from shader code', () => {
      const hlsl = '`ret = GetPixel(vUv);';
      const glsl = hlslToGlsl(hlsl, { wrapInShader: false });
      expect(glsl).not.toContain('`');
      expect(glsl).toContain('ret = GetPixel(vUv)');
    });

    it('should convert MilkDrop uniforms to VisualSynth equivalents', () => {
      const hlsl = `float intensity = bass * 0.5 + treb * 0.3;`;
      const glsl = hlslToGlsl(hlsl, { wrapInShader: false });
      expect(glsl).toContain('audioLow');
      expect(glsl).toContain('audioHigh');
    });

    it('should convert saturate to clamp01 helper', () => {
      const hlsl = `float result = saturate(x);`;
      const glsl = hlslToGlsl(hlsl, { wrapInShader: false });
      // saturate is converted to clamp01 (helper function defined in header)
      expect(glsl).toContain('clamp01(x)');
    });
  });

  describe('transpileMilkDropShader', () => {
    it('should transpile a simple warp shader', () => {
      const hlsl = `
shader_body {
  ret = GetPixel(vUv);
}`;
      const result = transpileMilkDropShader(hlsl, 'warp');
      expect(result.glsl).toContain('void main()');
      expect(result.glsl).toContain('fragColor');
    });

    it('should include required uniforms', () => {
      const hlsl = `shader_body { ret = vec4(1.0); }`;
      const result = transpileMilkDropShader(hlsl, 'warp');
      expect(result.glsl).toContain('uniform float uTime');
      expect(result.glsl).toContain('uniform float audioLow');
      expect(result.glsl).toContain('uniform float audioMid');
      expect(result.glsl).toContain('uniform float audioHigh');
    });

    it('should generate warnings for unsupported features', () => {
      const hlsl = `sampler3D vol;`;
      const result = transpileMilkDropShader(hlsl, 'warp');
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('3D textures'))).toBe(true);
    });

    it('should include helper functions', () => {
      const hlsl = `shader_body { ret = vec4(1.0); }`;
      const result = transpileMilkDropShader(hlsl, 'warp');
      expect(result.glsl).toContain('clamp01');
      expect(result.glsl).toContain('GetPixel');
      expect(result.glsl).toContain('GetBlur1');
    });
  });

  describe('inferPresetCategory', () => {
    it('should categorize cosmic presets as Space', () => {
      expect(inferPresetCategory('Cosmic Journey', '')).toBe('Space');
      expect(inferPresetCategory('Nebula Drift', '')).toBe('Space');
    });

    it('should categorize tunnel presets as Abstract', () => {
      expect(inferPresetCategory('Tunnel Vision', '')).toBe('Abstract');
      expect(inferPresetCategory('Warp Portal', '')).toBe('Abstract');
    });

    it('should categorize plasma presets as Organic', () => {
      expect(inferPresetCategory('Plasma Flow', '')).toBe('Organic');
      expect(inferPresetCategory('Liquid Metal', '')).toBe('Organic');
    });

    it('should categorize audio presets as Audio Reactive', () => {
      expect(inferPresetCategory('Audio Spectrum', '')).toBe('Audio Reactive');
      expect(inferPresetCategory('Wave Rider', '')).toBe('Audio Reactive');
    });

    it('should default to Imported for unknown presets', () => {
      expect(inferPresetCategory('Random Name', '')).toBe('Imported');
    });

    it('should infer from shader code', () => {
      expect(inferPresetCategory('Test', 'cosmic star field')).toBe('Space');
    });
  });

  describe('full shader conversion', () => {
    it('should convert complex warp shader', () => {
      const hlsl = `
shader_body {
  ret = lerp(GetPixel(vUv), GetBlur1(vUv), 0.2) * 0.75;
  ret = ret * (1 - pow(rad, 2) * 1);
}`;
      const result = transpileMilkDropShader(hlsl, 'warp');
      expect(result.glsl).toContain('mix(');
      expect(result.glsl).toContain('GetPixel');
      expect(result.glsl).toContain('GetBlur1');
      expect(result.glsl).toContain('fragColor');
    });

    it('should include all necessary uniforms', () => {
      const hlsl = `shader_body { ret = vec4(1.0); }`;
      const result = transpileMilkDropShader(hlsl, 'warp');
      expect(result.glsl).toContain('uniform float uTime');
      expect(result.glsl).toContain('uniform float audioLow');
      expect(result.glsl).toContain('uniform float audioMid');
      expect(result.glsl).toContain('uniform float audioHigh');
      expect(result.glsl).toContain('in vec2 vUv');
    });

    it('should provide helper functions', () => {
      const hlsl = `shader_body { ret = vec4(1.0); }`;
      const result = transpileMilkDropShader(hlsl, 'warp');
      expect(result.glsl).toContain('clamp01');
      expect(result.glsl).toContain('GetPixel');
      expect(result.glsl).toContain('GetBlur1');
      expect(result.glsl).toContain('GetBlur2');
    });
  });
});