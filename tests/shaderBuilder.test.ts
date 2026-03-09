import { describe, expect, it } from 'vitest';
import { buildFragmentShader, shaderCacheKey } from '../src/renderer/render/shaderBuilder';
import type { GeneratorShaderBlock, ShaderParts } from '../src/renderer/render/shaderBuilder';

const PREAMBLE = '#version 300 es\nprecision highp float;\n/* @@GENERATOR_UNIFORMS */\n';
const MAIN_TEMPLATE = 'void main() {\nvec3 color = vec3(0.0);\n/* @@GENERATOR_CALLS */\noutColor = vec4(color, 1.0);\n}\n';

const parts: ShaderParts = {
  preamble: PREAMBLE,
  mainTemplate: MAIN_TEMPLATE,
};

const blockA: GeneratorShaderBlock = {
  id: 'gen-foo',
  uniforms: 'uniform float uFooEnabled;\nuniform float uFooOpacity;\n',
  functions: 'vec3 foo(vec2 uv, float t, float audio) { return vec3(1.0); }\n',
  mainCall: '  if (uFooEnabled > 0.5) color += foo(uv, t, 0.0);\n',
};

const blockB: GeneratorShaderBlock = {
  id: 'gen-bar',
  uniforms: 'uniform float uBarEnabled;\nuniform float uBarSpeed;\n',
  functions: 'vec3 bar(vec2 uv, float t, float audio) { return vec3(0.5); }\n',
  mainCall: '  if (uBarEnabled > 0.5) color += bar(uv, t, 0.0);\n',
};

describe('buildFragmentShader', () => {
  it('always includes preamble content', () => {
    const src = buildFragmentShader(parts, [blockA, blockB], new Set(['gen-foo']));
    expect(src).toContain('#version 300 es');
  });

  it('includes uniforms only for active generators', () => {
    const src = buildFragmentShader(parts, [blockA, blockB], new Set(['gen-foo']));
    expect(src).toContain('uFooEnabled');
    expect(src).not.toContain('uBarEnabled');
  });

  it('includes functions only for active generators', () => {
    const src = buildFragmentShader(parts, [blockA, blockB], new Set(['gen-foo']));
    expect(src).toContain('vec3 foo(');
    expect(src).not.toContain('vec3 bar(');
  });

  it('includes mainCalls only for active generators', () => {
    const src = buildFragmentShader(parts, [blockA, blockB], new Set(['gen-foo']));
    expect(src).toContain('uFooEnabled > 0.5');
    expect(src).not.toContain('uBarEnabled > 0.5');
  });

  it('includes all blocks when all ids are active', () => {
    const src = buildFragmentShader(parts, [blockA, blockB], new Set(['gen-foo', 'gen-bar']));
    expect(src).toContain('uFooEnabled');
    expect(src).toContain('uBarEnabled');
    expect(src).toContain('vec3 foo(');
    expect(src).toContain('vec3 bar(');
  });

  it('produces a shader with no generator code when activeIds is empty', () => {
    const src = buildFragmentShader(parts, [blockA, blockB], new Set());
    expect(src).not.toContain('uFooEnabled');
    expect(src).not.toContain('uBarEnabled');
    expect(src).toContain('#version 300 es'); // preamble still present
  });

  it('injects sdfUniforms at the @@GENERATOR_UNIFORMS placeholder position', () => {
    const sdfU = 'uniform float uSdfThing;\n';
    const src = buildFragmentShader(parts, [], new Set(), sdfU);
    expect(src).toContain('uSdfThing');
  });

  it('replaces all three placeholder comments', () => {
    const src = buildFragmentShader(parts, [blockA], new Set(['gen-foo']));
    expect(src).not.toContain('@@GENERATOR_UNIFORMS');
    expect(src).not.toContain('@@GENERATOR_CALLS');
  });

  it('ignores blocks whose id is not in activeIds', () => {
    const src = buildFragmentShader(parts, [blockA, blockB], new Set(['gen-bar']));
    expect(src).not.toContain('uFooEnabled');
    expect(src).toContain('uBarEnabled');
  });
});

describe('shaderCacheKey', () => {
  it('produces the same key regardless of Set insertion order', () => {
    const s1 = new Set(['gen-foo', 'gen-bar']);
    const s2 = new Set(['gen-bar', 'gen-foo']);
    expect(shaderCacheKey(s1, '10.0', null)).toBe(shaderCacheKey(s2, '10.0', null));
  });

  it('produces different keys for different generator sets', () => {
    const s1 = new Set(['gen-foo']);
    const s2 = new Set(['gen-bar']);
    expect(shaderCacheKey(s1, '10.0', null)).not.toBe(shaderCacheKey(s2, '10.0', null));
  });

  it('produces different keys for same generators but different sdfMapBody', () => {
    const s = new Set(['gen-foo']);
    expect(shaderCacheKey(s, '10.0', null)).not.toBe(shaderCacheKey(s, 'customMap()', null));
  });

  it('produces different keys for same generators but different plasmaSource', () => {
    const s = new Set(['gen-foo']);
    expect(shaderCacheKey(s, '10.0', null)).not.toBe(shaderCacheKey(s, '10.0', 'custom plasma'));
  });

  it('empty set produces a stable key', () => {
    const key = shaderCacheKey(new Set(), '10.0', null);
    expect(typeof key).toBe('string');
    expect(key.length).toBeGreaterThan(0);
  });
});
