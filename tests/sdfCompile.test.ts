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

  // ─── Stage 2: argPack (#3) + vec-ness (#7) ────────────────────────────────

  it('packs multiple scalar params into a vec2 slot (blocker #3)', () => {
    // sdBox(vec2 p, vec2 b) is backed by scalar `width`+`height`; the call site
    // must pack them: sdBox(p.xy, vec2(u_width, u_height)).
    const box = createNodeInstance('box', { width: 0.6, height: 0.4 });
    const { compiled, full } = assemble([box], [], '2d');
    expect(compiled.mapBody).toContain('vec2(');
    expect(compiled.mapBody).toContain('sdBox');
    // The pack must appear; a bare scalar in the vec2 slot would be a type error.
    expect(compiled.mapBody).toMatch(/sdBox\([^,]+,\s*vec2\(/);
    expectParses(full);
  });

  it('packs multiple scalar params into a vec3 slot (3D box)', () => {
    const box = createNodeInstance('box-3d', { width: 0.5, height: 0.5, depth: 0.5 });
    const { compiled, full } = assemble([box], [], '3d');
    expect(compiled.mapBody).toMatch(/sdBox3D\([^,]+,\s*vec3\(/);
    expectParses(full);
  });

  it('casts a single int param to a float slot (blocker #3)', () => {
    // sdPolygon(vec2 p, float r, float n) — `sides` is int; the call site must
    // emit float(u_sides), not the bare int uniform (GLSL ES 3.00 forbids the
    // implicit int→float in a function argument).
    const poly = createNodeInstance('polygon', { radius: 0.4, sides: 6 });
    const { compiled, full } = assemble([poly], [], '2d');
    expect(compiled.mapBody).toContain('sdPolygon');
    expect(compiled.mapBody).toMatch(/float\(/);
    expectParses(full);
  });

  it('resolves argPack by param id, not positional order (sdPlane reorder)', () => {
    // sdPlane(vec3 p, vec3 n, float h) — params are ordered [height, normalX,
    // normalY, normalZ], which does NOT match the signature slot order
    // [n, then h]. argPack must map by id: n=[normalX,normalY,normalZ], h=[height].
    // A positional auto-pack would bind (height,normalX,normalY) to n — wrong.
    const plane = createNodeInstance('plane', { height: 0, normalX: 0, normalY: 1, normalZ: 0 });
    const { compiled, full } = assemble([plane], [], '3d');
    // n is packed as vec3(u_normalX, u_normalY, u_normalZ) and h is u_height (a
    // single float, no cast since height is a float param). Order matters.
    expect(compiled.mapBody).toMatch(/sdPlane\(p,\s*vec3\(u_[^,]+_normalX,\s*u_[^,]+_normalY,\s*u_[^,]+_normalZ\),\s*u_[^)]+_height\)/);
    expectParses(full);
  });

  it('swizzles vec3 p to .xy for 2D nodes but not twice across a 2D transform (blocker #7)', () => {
    // domTranslate2D returns a vec2; a child 2D shape must NOT append another
    // .xy (the old .endsWith('.xy') heuristic double-swizzled here).
    const shape = createNodeInstance('circle', { radius: 0.3 });
    const trans = createNodeInstance('dom-translate-2d', { x: 0.1, y: 0.2 });
    const connections = [{ from: shape.instanceId, to: trans.instanceId, slot: 0 }];
    const { compiled, full } = assemble([shape, trans], connections, '2d');
    // The transform consumes p.xy (vec3→vec2), then the child circle receives the
    // vec2 transform result with NO second swizzle.
    expect(compiled.mapBody).toContain('domTranslate2D(p.xy');
    expect(compiled.mapBody).toContain('sdCircle(domTranslate2D(');
    // No double swizzle: 'domTranslate2D(...).xy' must not appear.
    expect(compiled.mapBody).not.toMatch(/domTranslate2D\([^)]*\)\.xy/);
    expectParses(full);
  });

  it('assembles a 2D perlin field (int cast + required utils) to valid GLSL', () => {
    // fieldPerlin2D requires gradientNoise+hash22 (Stage 1 #4) and casts the
    // int `octaves` param to float (Stage 2 #3). Full assembly must parse.
    const perlin = createNodeInstance('field-perlin-2d', { scale: 3, octaves: 3 });
    const { compiled, full } = assemble([perlin], [], '2d');
    expect(compiled.functionsCode).toContain('gradientNoise');
    expect(compiled.mapBody).toMatch(/fieldPerlin2D\(/);
    expectParses(full);
  });
});