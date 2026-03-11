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

  it('matches v1.0 contrast and saturation semantics', () => {
    expect(builtShader).toContain('vec3 applySaturation(vec3 color, float amount)');
    expect(builtShader).toContain('vec3 applyContrast(vec3 color, float amount)');
    expect(builtShader).toContain('color = applySaturation(color, uSaturation);');
    expect(builtShader).toContain('color = applyContrast(color, uContrast);');
    expect(builtShader).not.toContain('1.0 + uContrast');
    expect(builtShader).not.toContain('1.0 + uSaturation');
  });

  it('matches v1.0 low/mid/high audio band shaping', () => {
    expect(builtShader).toContain('low = pow(low, 1.2);');
    expect(builtShader).toContain('mid = pow(mid, 1.1);');
    expect(builtShader).toContain('high = pow(high, 1.0);');
  });

  it('matches v1.0 kaleidoscope distortion semantics', () => {
    expect(builtShader).toContain('float slices = mix(1.0, 8.0, uKaleidoscope);');
    expect(builtShader).toContain('angle = abs(angle - slice * 0.5);');
    expect(builtShader).not.toContain('floor(2.0 + uKaleidoscope * 6.0)');
  });

  it('matches v1.0 base frame color', () => {
    expect(builtShader).toContain('vec3 color = vec3(0.02, 0.04, 0.08);');
  });

  it('matches v1.0 finishing color pipeline and effect gating', () => {
    expect(builtShader).toContain('if (uEffectsEnabled > 0.5) {');
    expect(builtShader).toContain('color = posterize(color, uPosterize);');
    expect(builtShader).toContain('if (uEffectsEnabled > 0.5 && uChroma > 0.01)');
    expect(builtShader).toContain('if (uEffectsEnabled > 0.5 && uBlur > 0.01)');
    expect(builtShader).toContain('color = shiftPalette(color, uPaletteShift);');
    expect(builtShader).toContain('color = color / (vec3(1.0) + color);');
    expect(builtShader).toContain('color = pow(color, vec3(1.0 / 1.35));');
    expect(builtShader).toContain('color *= uGlobalColor;');
  });

  it('matches v1.0 gravity warp and lens accumulation path', () => {
    expect(builtShader).toContain('float gravityLens = 0.0;');
    expect(builtShader).toContain('float gravityRing = 0.0;');
    expect(builtShader).toContain('if (uGravityActive[0] > 0.5 || uGravityActive[1] > 0.5');
    expect(builtShader).toContain('warp *= (1.0 + uGravityCollapse * 0.8);');
    expect(builtShader).toContain('effectUv = clamp(effectUv + warp * 0.5, 0.0, 1.0);');
    expect(builtShader).toContain('color += vec3(0.08, 0.12, 0.2) * gravityLens + vec3(0.2, 0.35, 0.5) * gravityRing * (0.4 + high);');
  });

  it('matches v1.0 fixed-color semantics for topo/weather/portal/oscillo core generators', () => {
    expect(builtShader).toContain('mix(vec3(0.18, 0.28, 0.35), vec3(0.4, 0.6, 0.7), clamp(terrain, 0.0, 1.0))');
    expect(builtShader).toContain('vec3 cCol = mix(vec3(0.6, 0.65, 0.7), vec3(0.85, 0.88, 0.9), cloud);');
    expect(builtShader).toContain('vec3 baseCol = vec3(0.2, 0.6, 0.9);');
    expect(builtShader).toContain('if (style > 0.5 && style < 1.5) baseCol = vec3(0.7, 0.35, 0.95);');
    expect(builtShader).toContain('if (style >= 1.5) baseCol = vec3(0.2, 0.9, 0.55);');
    expect(builtShader).toContain('mix(vec3(0.95, 0.82, 0.6), vec3(0.6, 0.8, 1.0), uSpectrum[28])');
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
