/**
 * SDF Stage 1 compile harness.
 *
 * The renderer runs in a browser WebGL2 context, which is unavailable in the
 * node test env. Instead of a real GPU compile, we assemble the FULL fragment
 * shader (real preamble + mainTemplate + generator blocks + the SDF builder
 * output) the same way glRenderer does, then parse it with a real GLSL ES 3.00
 * parser (@shaderfrog/glsl-parser). This catches the assembly blockers that
 * would otherwise only surface as WebGL compile errors:
 *
 *  #1 placeholder/body mismatch — `vec2(return ..., 0.0)` is a syntax error the
 *     parser rejects.
 *  #2 getSdfColor redeclaration — asserted by counting definitions.
 *  #4 required utility functions — asserted by presence in functionsCode.
 *
 * A 3D primitive (sdSphere, takes vec3 p, single scalar param) is used so the
 * scene is not affected by the unrelated scalar/vecN arg bug (#3, Stage 2) or
 * the 2D-pArg bug (recorded for Stage 2) — both of which would mask whether
 * Stage 1 itself is correct.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { parse } from '@shaderfrog/glsl-parser';
import { GENERATOR_SHADER_BLOCKS } from '../src/shared/generatorShaderBlocks';
import { buildFragmentShader } from '../src/renderer/render/shaderBuilder';
import SHADER_PREAMBLE from '../src/renderer/shaders/preamble.glsl';
import SHADER_MAIN_TEMPLATE from '../src/renderer/shaders/mainTemplate.glsl';
import { sdfRegistry, registerSdfNodes } from '../src/renderer/sdf/nodes';
import { buildSdfShader } from '../src/renderer/sdf/compile/glslBuilder';
import { createNodeInstance } from '../src/renderer/sdf/api';

const SDF_GEN_ID = 'gen-sdf';

const assemble = (
  nodes: ReturnType<typeof createNodeInstance>[],
  connections: { from: string; to: string; slot: number }[] = [],
  mode: '2d' | '3d' = '3d'
) => {
  const compiled = buildSdfShader(nodes, connections as any, mode);
  const uniformsCode = compiled.uniforms
    .map((u) => `uniform ${u.type} ${u.name};`)
    .join('\n');
  const full = buildFragmentShader(
    { preamble: SHADER_PREAMBLE, mainTemplate: SHADER_MAIN_TEMPLATE },
    GENERATOR_SHADER_BLOCKS,
    new Set([SDF_GEN_ID]),
    uniformsCode,
    compiled.functionsCode,
    compiled.mapBody,
    null,
    '',
    compiled.colorBody
  );
  return { compiled, full };
};

const countOccurrences = (src: string, needle: string) =>
  src.split(needle).length - 1;

const expectParses = (full: string) => {
  expect(() => parse(full, { stage: 'fragment', quiet: true })).not.toThrow();
};

describe('SDF Stage 1 compile harness', () => {
  beforeEach(() => {
    registerSdfNodes();
  });

  it('a single 3D sphere scene assembles to syntactically valid GLSL (blockers #1 + #2)', () => {
    const sphere = createNodeInstance('sphere', { radius: 0.5 });
    const { compiled, full } = assemble([sphere], [], '3d');

    // Blocker #1: placeholders are filled, and mapBody is a full return statement
    // (the old `vec2(<body>, 0.0)` wrap would have left a nested return).
    expect(full).not.toContain('@@SDF_MAP_BODY');
    expect(full).not.toContain('@@SDF_COLOR_BODY');
    expect(compiled.mapBody).toContain('return vec2(');
    expect(compiled.mapBody).toContain('sdSphere');

    // Blocker #2: exactly one getSdfColor definition. The builder must NOT emit
    // its own into functionsCode (that redeclares the preamble's copy).
    expect(countOccurrences(full, 'vec3 getSdfColor(float id)')).toBe(1);
    expect(compiled.functionsCode).not.toContain('vec3 getSdfColor');

    // The real check: the full assembled shader parses without syntax errors.
    expectParses(full);
  });

  it('a 3D boolean union scene assembles to valid GLSL', () => {
    const s1 = createNodeInstance('sphere', { radius: 0.3 });
    const s2 = createNodeInstance('sphere', { radius: 0.2 });
    const op = createNodeInstance('op-union', {});
    const connections = [
      { from: s1.instanceId, to: op.instanceId, slot: 0 },
      { from: s2.instanceId, to: op.instanceId, slot: 1 }
    ];
    const { compiled, full } = assemble([s1, s2, op], connections, '3d');

    expect(compiled.mapBody).toContain('opUnion');
    expect(compiled.mapBody).toContain('sdSphere');
    expectParses(full);
  });

  it('emits required utility functions and their dependencies (blocker #4)', () => {
    // field-perlin-2d requires ['gradientNoise', 'hash22']. gradientNoise lives
    // in GLSL_NOISE, which itself calls hash21 from GLSL_HASH — so emitting the
    // noise block must also pull in the hash block. (This node's mapBody is
    // malformed by the unrelated scalar/vecN arg bug #3, so we assert util
    // emission at the functionsCode level, not full assembly.)
    expect(sdfRegistry.get('field-perlin-2d')).toBeDefined();
    const perlin = createNodeInstance('field-perlin-2d');
    const compiled = buildSdfShader([perlin], [], '2d');

    expect(compiled.functionsCode).toContain('gradientNoise');
    expect(compiled.functionsCode).toContain('hash22');
    expect(compiled.functionsCode).toContain('hash21'); // GLSL_NOISE dep on GLSL_HASH
  });

  it('an empty scene compiles with the default map/color bodies', () => {
    const { compiled, full } = assemble([], [], '3d');
    expect(compiled.mapBody).toBe('return vec2(10.0, 0.0);');
    expect(compiled.colorBody).toBe('return vec3(1.0);');
    expectParses(full);
  });
});