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
import { parse } from '@shaderfrog/glsl-parser';
import { GENERATOR_SHADER_BLOCKS } from '../src/shared/generatorShaderBlocks';
import { buildFragmentShader } from '../src/renderer/render/shaderBuilder';
import SHADER_PREAMBLE from '../src/renderer/shaders/preamble.glsl';
import SHADER_MAIN_TEMPLATE from '../src/renderer/shaders/mainTemplate.glsl';
import { DEFAULT_PROJECT } from '../src/shared/project';
import { getFxUniformsDeclarations } from '../src/shared/shaderUtils';

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * Validates a GLSL shader string by parsing it into an AST.
 * This catches syntax errors, redeclarations, and some undeclared identifiers.
 */
const GLSL_KEYWORDS = new Set([
  'attribute', 'const', 'uniform', 'varying', 'break', 'continue', 'do', 'for', 'while',
  'if', 'else', 'in', 'out', 'inout', 'float', 'int', 'void', 'bool', 'true', 'false',
  'lowp', 'mediump', 'highp', 'precision', 'invariant', 'discard', 'return',
  'mat2', 'mat3', 'mat4', 'vec2', 'vec3', 'vec4', 'ivec2', 'ivec3', 'ivec4', 'bvec2', 'bvec3', 'bvec4',
  'sampler2D', 'samplerCube', 'struct', 'layout', 'location', 'flat', 'smooth'
]);

const GLSL_BUILTINS = new Set([
  'gl_Position', 'gl_FragColor', 'gl_FragCoord', 'gl_PointCoord', 'gl_PointSize', 'gl_InstanceID', 'gl_VertexID',
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'pow', 'exp', 'log', 'exp2', 'log2', 'sqrt', 'inversesqrt',
  'abs', 'sign', 'floor', 'ceil', 'fract', 'mod', 'min', 'max', 'clamp', 'mix', 'step', 'smoothstep',
  'length', 'distance', 'dot', 'cross', 'normalize', 'faceforward', 'reflect', 'refract',
  'matrixCompMult', 'lessThan', 'lessThanEqual', 'greaterThan', 'greaterThanEqual', 'any', 'all', 'not',
  'texture', 'texture2D', 'textureCube', 'dFdx', 'dFdy', 'fwidth'
]);

function isSwizzle(name: string): boolean {
  if (name.length > 4) return false;
  const swizzles = ['xyzw', 'rgba', 'stpq'];
  for (const set of swizzles) {
    let allInSet = true;
    for (const char of name) {
      if (!set.includes(char)) {
        allInSet = false;
        break;
      }
    }
    if (allInSet) return true;
  }
  return false;
}

function extractDeclarations(glsl: string): Map<string, number> {
  const map = new Map<string, number>();
  
  const withoutComments = glsl
    .replace(/\/\/.*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, (match) => match.split('\n').map(() => '').join('\n'));

  const lines = withoutComments.split('\n');
  
  const uniformRegex = /uniform\s+(?:\w+(?:\s+\w+)?)\s+(\w+)(?:\[\d+\])?\s*;/g;
  const funcRegex = /\b(?:void|float|int|bool|vec2|vec3|vec4|mat2|mat3|mat4)\s+(\w+)\s*\(/g;
  const localRegex = /\b(?:float|int|bool|vec2|vec3|vec4|mat2|mat3|mat4)\s+(\w+)\b(?!\s*\()/g;

  lines.forEach((line, i) => {
    if (line.trim().startsWith('#')) return;

    let m;
    while ((m = uniformRegex.exec(line)) !== null) {
      if (!map.has(m[1])) map.set(m[1], i);
    }
    uniformRegex.lastIndex = 0;

    while ((m = funcRegex.exec(line)) !== null) {
      if (GLSL_KEYWORDS.has(m[1]) || m[1] === 'main') continue;
      if (!map.has(m[1])) map.set(m[1], i);
    }
    funcRegex.lastIndex = 0;

    while ((m = localRegex.exec(line)) !== null) {
      if (GLSL_KEYWORDS.has(m[1]) || GLSL_BUILTINS.has(m[1])) continue;
      if (!map.has(m[1])) map.set(m[1], i);
    }
    localRegex.lastIndex = 0;
  });
  
  return map;
}

function findReferences(glsl: string): Array<{ name: string; line: number }> {
  const refs: Array<{ name: string; line: number }> = [];
  const lines = glsl.split('\n');
  
  lines.forEach((line, i) => {
    if (line.trim().startsWith('#')) return;
    const code = line.replace(/\/\/.*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const words = code.matchAll(/\b([a-zA-Z_]\w*)\b/g);
    for (const match of words) {
      const name = match[1];
      if (GLSL_KEYWORDS.has(name) || GLSL_BUILTINS.has(name) || isSwizzle(name)) continue;
      refs.push({ name, line: i });
    }
  });
  
  return refs;
}

function validateShaderComplete(glsl: string): string[] {
  const violations: string[] = [];
  
  // 1. AST check for syntax
  try {
    parse(glsl, { stage: 'fragment', quiet: true });
  } catch (e: any) {
    violations.push(`AST Error: ${e.message}`);
  }

  // 2. Declaration order check
  const declared = extractDeclarations(glsl);
  const referenced = findReferences(glsl);

  referenced.forEach(ref => {
    if (KNOWN_NON_UNIFORMS.has(ref.name)) return;
    
    const declLine = declared.get(ref.name);
    if (declLine === undefined) {
      violations.push(`${ref.name} used on line ${ref.line + 1} but never declared`);
    } else if (declLine > ref.line) {
      violations.push(`${ref.name} used on line ${ref.line + 1} but declared later on line ${declLine + 1}`);
    }
  });

  return violations;
}

// Known preamble globals that are declared but aren't `u<UpperCase>` (skip them),
// and identifiers that look like uniforms but are GLSL built-ins or shader outputs.
const KNOWN_NON_UNIFORMS = new Set([
  'uv',    // local variable, not a uniform
  'p',     // SDF input position
  'optional', // from comments or template logic
  'opacity', // from comments or template logic
  'sdfValue', // from comments or template logic
  'sdf', // from comments or template logic
  'uGravityPos', // array accessed by index
  'uGravityStrength', // array accessed by index
  'uGravityPolarity', // array accessed by index
  'uGravityActive', // array accessed by index
  'uSpectrum', // array accessed by index
  'uPalette', // array accessed by index
  'customPlasma', // injected by buildFragmentShader via @@PLASMA_SOURCE
  'sb', // soft-body / scene-body identifier in some generators
  'caustic', // local in some core generators
  'rad', // local in some core generators
  'arcGlow', // local in some core generators
  'main', // some generators may use main as a variable or have main() conflicts
  'e', // local epsilon in calcSdfNormal
  'occ', // local occlusion in calcSdfAO
  'sca', // local scale in calcSdfAO
]);

// ─── build once ─────────────────────────────────────────────────────────────

const allIds = new Set(GENERATOR_SHADER_BLOCKS.map(b => b.id));
const fxUniforms = getFxUniformsDeclarations(DEFAULT_PROJECT, DEFAULT_PROJECT.scenes[0]);

// USE A REALISTIC SDF BODY THAT CALLS LIBRARY FUNCTIONS
// This ensures the global validation catch issues like 'fbm' being used before defined.
const builtShader = buildFragmentShader(
  { preamble: SHADER_PREAMBLE, mainTemplate: SHADER_MAIN_TEMPLATE },
  GENERATOR_SHADER_BLOCKS,
  allIds,
  /* sdfUniforms */ '',
  /* sdfFunctions */ '',
  /* sdfMapBody */ 'fbm(p.xy * 2.0)',
  /* plasmaSource */ null,
  fxUniforms
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

  it('has no syntax or declaration errors', () => {
    const violations = validateShaderComplete(builtShader);
    if (violations.length > 0) {
      console.error('Shader validation failed:\n  ' + violations.join('\n  '));
    }
    expect(violations).toEqual([]);
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

  it('keeps the base frame neutral until scene content is rendered', () => {
    expect(builtShader).toContain('vec3 color = vec3(0.0);');
    expect(builtShader).toContain('float sceneColorEnergy = dot(color, vec3(0.299, 0.587, 0.114));');
    expect(builtShader).toContain('if (uChemistryMode > 0.5 && abs(uPaletteShift) > 0.01)');
    expect(builtShader).toContain('if (sceneColorEnergy > 0.001 && uEngineCA > 0.01)');
  });

  it('keeps finishing effects gated behind actual scene content', () => {
    expect(builtShader).toContain('if (sceneColorEnergy > 0.001 && uEffectsEnabled > 0.5) {');
    expect(builtShader).toContain('color = posterize(color, uPosterize);');
    expect(builtShader).toContain('if (sceneColorEnergy > 0.001 && uEffectsEnabled > 0.5 && uChroma > 0.01)');
    expect(builtShader).toContain('if (sceneColorEnergy > 0.001 && uEffectsEnabled > 0.5 && uBlur > 0.01)');
    expect(builtShader).toContain('color = shiftPalette(color, uPaletteShift);');
    expect(builtShader).toContain('color = color / max(vec3(1.0), color + vec3(0.001));');
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

  it('declares scene FX uniforms even with no project/scene (minimal boot case)', () => {
    // This replicates the case where glRenderer boots with an empty generator set
    // before any project is loaded.
    const initialFx = 'uniform float uscene_scene_0_bloom;\nuniform float uscene_scene_0_chroma;\nuniform float uscene_scene_0_blur;\nuniform float uscene_scene_0_posterize;\n';
    const minimalShader = buildFragmentShader(
      { preamble: SHADER_PREAMBLE, mainTemplate: SHADER_MAIN_TEMPLATE },
      [], // no blocks
      new Set(), // no active IDs
      '', '', '10.0', null,
      initialFx
    );

    const declared = extractDeclarations(minimalShader);
    expect(declared.has('uscene_scene_0_bloom')).toBe(true);
    expect(declared.has('uscene_scene_0_chroma')).toBe(true);
    expect(declared.has('uscene_scene_0_blur')).toBe(true);
    expect(declared.has('uscene_scene_0_posterize')).toBe(true);

    const violations = validateShaderComplete(minimalShader);
    if (violations.length > 0) {
      console.error('Minimal shader validation failures:\n  ' + violations.join('\n  '));
    }
    expect(violations).toEqual([]);
  });
});
