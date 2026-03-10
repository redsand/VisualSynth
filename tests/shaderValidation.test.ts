/**
 * Static GLSL shader validation tests.
 *
 * These tests build the full shader source (all generators active) using the same
 * pipeline as the renderer, then perform static analysis to catch errors that would
 * only surface at runtime as WebGL compile errors:
 *
 *  1. Duplicate uniform declarations (redefinition)
 *  2. Uniform references in generator functions/mainCalls that are not declared in
 *     the built shader (undeclared identifier)
 *
 * This avoids the expensive/impossible task of running a real WebGL context in tests.
 */

import { describe, expect, it } from 'vitest';
import { GENERATOR_SHADER_BLOCKS } from '../src/shared/generatorShaderBlocks';
import { buildFragmentShader } from '../src/renderer/render/shaderBuilder';
import SHADER_PREAMBLE from '../src/renderer/shaders/preamble.glsl';
import SHADER_MAIN_TEMPLATE from '../src/renderer/shaders/mainTemplate.glsl';

// ─── helpers ────────────────────────────────────────────────────────────────

/** Extract every `uniform <type> <name>[<size>]?;` declaration from a GLSL string. */
function extractDeclaredUniforms(glsl: string): Map<string, string> {
  const map = new Map<string, string>(); // name → type
  for (const m of glsl.matchAll(/uniform\s+(\w+(?:\s+\w+)?)\s+(u\w+)(?:\[\d+\])?\s*;/g)) {
    const [, type, name] = m;
    map.set(name, type);
  }
  return map;
}

/** Find every identifier that starts with 'u' followed by an uppercase letter,
 *  appearing as a standalone token (not as part of a declaration). */
function findUniformReferences(glsl: string): Set<string> {
  const refs = new Set<string>();
  // Strip declaration lines so we only look at usage sites
  const withoutDecls = glsl.replace(/uniform\s+\S+(?:\s+\S+)?\s+u\w+(?:\[\d+\])?\s*;/g, '');
  for (const m of withoutDecls.matchAll(/\b(u[A-Z]\w*)\b/g)) {
    refs.add(m[1]);
  }
  return refs;
}

// Known preamble globals that are declared but aren't `u<UpperCase>` (skip them),
// and identifiers that look like uniforms but are GLSL built-ins or shader outputs.
const KNOWN_NON_UNIFORMS = new Set([
  'uv',    // local variable, not a uniform
]);

// ─── build once ─────────────────────────────────────────────────────────────

const allIds = new Set(GENERATOR_SHADER_BLOCKS.map(b => b.id));
const builtShader = buildFragmentShader(
  { preamble: SHADER_PREAMBLE, mainTemplate: SHADER_MAIN_TEMPLATE },
  GENERATOR_SHADER_BLOCKS,
  allIds,
  /* sdfUniforms */ '',
  /* sdfFunctions */ '',
  /* sdfMapBody */ '10.0',
  /* plasmaSource */ null
);

// ─── tests ───────────────────────────────────────────────────────────────────

describe('GLSL shader static validation', () => {
  it('builds a non-empty shader', () => {
    expect(builtShader.length).toBeGreaterThan(1000);
    expect(builtShader).toContain('void main()');
    expect(builtShader).toContain('#version 300 es');
  });

  it('has no duplicate uniform declarations', () => {
    const seen = new Map<string, number>(); // name → count
    for (const m of builtShader.matchAll(/uniform\s+\S+(?:\s+\S+)?\s+(u\w+)(?:\[\d+\])?\s*;/g)) {
      const name = m[1];
      seen.set(name, (seen.get(name) ?? 0) + 1);
    }

    const duplicates = [...seen.entries()]
      .filter(([, count]) => count > 1)
      .map(([name, count]) => `${name} (×${count})`);

    if (duplicates.length > 0) {
      console.error('Duplicate uniform declarations:\n  ' + duplicates.join('\n  '));
    }
    expect(duplicates).toEqual([]);
  });

  it('has no undeclared uniform references', () => {
    const declared = extractDeclaredUniforms(builtShader);
    const referenced = findUniformReferences(builtShader);

    const undeclared = [...referenced].filter(
      name => !declared.has(name) && !KNOWN_NON_UNIFORMS.has(name)
    );

    if (undeclared.length > 0) {
      console.error('Undeclared uniform references:\n  ' + undeclared.join('\n  '));
    }
    expect(undeclared).toEqual([]);
  });

  it('preamble placeholder /* @@GENERATOR_UNIFORMS */ is replaced', () => {
    expect(builtShader).not.toContain('@@GENERATOR_UNIFORMS');
  });

  it('preamble placeholder /* @@SDF_MAP_BODY */ is replaced', () => {
    expect(builtShader).not.toContain('@@SDF_MAP_BODY');
  });

  it('mainTemplate placeholder /* @@GENERATOR_CALLS */ is replaced', () => {
    expect(builtShader).not.toContain('@@GENERATOR_CALLS');
  });

  it('does not contain GLSL reserved-word variable names', () => {
    // These are GLSL ES 3.0 reserved words that must not appear as identifiers
    const reserved = ['half', ' active ', ' sample ', ' filter '];
    const violations: string[] = [];
    for (const word of reserved) {
      // Only flag if used as a local variable declaration (float/int/bool word =)
      const pattern = new RegExp(`\\b(float|int|bool|vec\\d)\\s+${word.trim()}\\s*[=;]`, 'g');
      if (pattern.test(builtShader)) violations.push(word.trim());
    }
    expect(violations).toEqual([]);
  });
});
