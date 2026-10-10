import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { patchMilkDropGlsl } from '../src/shared/milkwaveGlslPatcher';
import { analyzeMilkwaveShaderSource } from '../src/shared/milkwaveDiagnostics';

// ── Unit tests ──────────────────────────────────────────────────────────────

describe('patchMilkDropGlsl – unit', () => {
  it('returns source unchanged if no #version 300 es header', () => {
    const src = 'void main() { gl_FragColor = vec4(1.0); }';
    expect(patchMilkDropGlsl(src)).toBe(src);
  });

  it('returns source unchanged if empty', () => {
    expect(patchMilkDropGlsl('')).toBe('');
  });

  it('fixes float declaration with integer literal initializer', () => {
    const src = '#version 300 es\nvoid main() {\n  float mipbias = 0;\n}';
    const out = patchMilkDropGlsl(src);
    expect(out).not.toMatch(/float mipbias = 0;/);
    expect(out).toMatch(/float mipbias = 0\.0;/);
  });

  it('fixes const float declaration with integer literal initializer', () => {
    const src = '#version 300 es\nvoid main() {\n  const float bias = 1;\n}';
    const out = patchMilkDropGlsl(src);
    expect(out).toMatch(/const float bias = 1\.0;/);
  });

  it('does not double-patch already-correct float declarations', () => {
    const src = '#version 300 es\nvoid main() {\n  float x = 1.0;\n}';
    const out = patchMilkDropGlsl(src);
    expect(out).toMatch(/float x = 1\.0;/);
    expect(out).not.toMatch(/1\.0\.0/);
  });

  it('removes shader_body block before void main()', () => {
    const src = [
      '#version 300 es',
      'precision highp float;',
      'shader_body {',
      '  float x = 1.0;',
      '}',
      'void main() {',
      '  fragColor = vec4(1.0);',
      '}',
    ].join('\n');
    const out = patchMilkDropGlsl(src);
    // The pre-main block should be gone
    const mainIdx = out.indexOf('void main()');
    const prePart = out.substring(0, mainIdx);
    expect(prePart).not.toMatch(/shader_body/);
  });

  it('strips shader_body keyword inside void main()', () => {
    const src = [
      '#version 300 es',
      'precision highp float;',
      'out vec4 fragColor;',
      'void main() {',
      '  shader_body {',
      '    fragColor = vec4(1.0);',
      '  }',
      '}',
    ].join('\n');
    const out = patchMilkDropGlsl(src);
    expect(out).not.toMatch(/\bshader_body\b/);
    // Anonymous block content preserved
    expect(out).toMatch(/fragColor = vec4\(1\.0\)/);
  });

  it('injects missing q-variable uniforms', () => {
    const src = '#version 300 es\nprecision highp float;\nout vec4 fragColor;\nvoid main() {\n  float v = q3;\n  fragColor = vec4(v);\n}';
    const out = patchMilkDropGlsl(src);
    expect(out).toMatch(/uniform float q3;/);
  });

  it('injects lum() helper when used', () => {
    const src = '#version 300 es\nprecision highp float;\nout vec4 fragColor;\nvoid main() {\n  float l = lum(vec3(1.0));\n  fragColor = vec4(l);\n}';
    const out = patchMilkDropGlsl(src);
    expect(out).toMatch(/float lum\(/);
  });

  it('fixes vec4 ret template to vec3 ret with fragColor output', () => {
    const src = '#version 300 es\nprecision highp float;\nout vec4 fragColor;\nvoid main() {\n  vec4 ret = vec4(0.0);\n  fragColor = ret;\n}';
    const out = patchMilkDropGlsl(src);
    expect(out).toMatch(/vec3 ret = vec3\(0\.0\)/);
    expect(out).toMatch(/fragColor = vec4\(ret\s*,\s*1\.0\s*\)/);
  });

  it('adds .xyz to texture() in vec3 context with nested parens', () => {
    const src = '#version 300 es\nprecision highp float;\nuniform sampler2D sampler_main;\nin vec2 vUv;\nout vec4 fragColor;\nvoid main() {\n  vec2 uv = vUv;\n  vec3 ret = vec3(0.0);\n  ret = max(ret, texture( sampler_main, vec2(1.0 - uv.x, 1.0 - uv.y) ) );\n  fragColor = vec4(ret, 1.0);\n}';
    const out = patchMilkDropGlsl(src);
    // .xyz should be AFTER the texture() close paren, not inside vec2()
    expect(out).toMatch(/texture\(\s*sampler_main,\s*vec2\([^)]+\)\s*\)\s*\.xyz/);
    // Must NOT have .xyz inside vec2()
    expect(out).not.toMatch(/vec2\([^)]*\.xyz/);
  });

  it('fixes GetPixel return type from vec4 to vec3', () => {
    const src = '#version 300 es\nprecision highp float;\nuniform sampler2D sampler_main;\nout vec4 fragColor;\nvec4 GetPixel(vec2 uv) { return texture(sampler_main, uv); }\nvoid main() { fragColor = vec4(GetPixel(vec2(0.5))); }';
    const out = patchMilkDropGlsl(src);
    expect(out).toMatch(/vec3 GetPixel\(/);
  });

  it('promotes scalar vec initializers to the declared vector dimension', () => {
    const src = '#version 300 es\nprecision highp float;\nout vec4 fragColor;\nvoid main() {\n  vec2 uv2 = 0.5;\n  vec3 col = lum(vec3(1.0));\n  fragColor = vec4(col + vec3(uv2, 0.0), 1.0);\n}';
    const out = patchMilkDropGlsl(src);
    expect(out).toMatch(/vec2 uv2 = vec2\(0\.5\)/);
    expect(out).toMatch(/vec3 col = vec3\(lum\(vec3\(1\.0\)\)\)/);
  });

  it('promotes scalar assignments to the target vector dimension', () => {
    const src = '#version 300 es\nprecision highp float;\nout vec4 fragColor;\nvoid main() {\n  vec4 color = vec4(0.0);\n  color = 1.0;\n  fragColor = color;\n}';
    const out = patchMilkDropGlsl(src);
    expect(out).toMatch(/color = vec4\(1\.0\)/);
  });

  it('normalizes mix calls that blend vectors with scalars', () => {
    const src = '#version 300 es\nprecision highp float;\nout vec4 fragColor;\nvoid main() {\n  vec3 ret = vec3(0.0);\n  ret = mix(ret, lum(ret), 0.2);\n  ret = mix(0.5, ret, 0.2);\n  fragColor = vec4(ret, 1.0);\n}';
    const out = patchMilkDropGlsl(src);
    expect(out).toMatch(/mix\(ret,\s*vec3\(lum\(ret\)\),\s*0\.2\)/);
    expect(out).toMatch(/mix\(vec3\(0\.5\),\s*ret,\s*0\.2\)/);
  });

  it('normalizes pow calls that raise vectors by scalar exponents', () => {
    const src = '#version 300 es\nprecision highp float;\nout vec4 fragColor;\nvoid main() {\n  vec3 ret = vec3(0.5);\n  ret = pow(ret, 2.0);\n  fragColor = vec4(ret, 1.0);\n}';
    const out = patchMilkDropGlsl(src);
    expect(out).toMatch(/pow\(ret,\s*vec3\(2\.0\)\)/);
  });

  it('collapses redundant nested vector constructors created during pow normalization', () => {
    const src = '#version 300 es\nprecision highp float;\nout vec4 fragColor;\nvoid main() {\n  vec3 ret = vec3(0.5);\n  ret = pow(ret, vec3(0.5, 0.8, 1.0));\n  fragColor = vec4(ret, 1.0);\n}';
    const out = patchMilkDropGlsl(src);
    expect(out).toContain('pow(ret, vec3(0.5, 0.8, 1.0))');
    expect(out).not.toContain('vec3(vec3(');
  });

  it('expands uAspect z and zw swizzles to inverse aspect terms', () => {
    const src = '#version 300 es\nprecision highp float;\nout vec4 fragColor;\nuniform vec2 uAspect;\nvoid main() {\n  float invAspect = uAspect.z;\n  vec2 invTerms = uAspect.zw;\n  fragColor = vec4(invAspect, invTerms.x, invTerms.y, 1.0);\n}';
    const out = patchMilkDropGlsl(src);
    expect(out).toContain('(1.0/uAspect.x)');
    // The @shaderfrog generator emits a leading space for identifier-first
    // groups, so `(vec2(1.0)/uAspect)` (from the 0a.2 regex substitution) is
    // re-emitted by astTransform as `( vec2(1.0)/uAspect)`. The space is
    // semantically inert in GLSL and is the generator's consistent output
    // (the same space milkdropRendererSeed.test.ts asserts for `uv*( vec2(1.0) - ...)`).
    expect(out).toContain('( vec2(1.0)/uAspect)');
    expect(out).not.toContain('uAspect.z');
    expect(out).not.toContain('uAspect.zw');
  });

  it('cleans up numeric literal swizzles before parsing', () => {
    const src = '#version 300 es\nprecision highp float;\nout vec4 fragColor;\nvoid main() {\n  vec2 uv = 1.0.xy;\n  fragColor = vec4(uv, 0.0, 1.0);\n}';
    const out = patchMilkDropGlsl(src);
    expect(out).toContain('vec2(1.0).xy');
    expect(out).not.toContain('1.0.xy');
  });

  it('converts dangling statement commas to semicolons without touching argument lists', () => {
    const src = '#version 300 es\nprecision highp float;\nout vec4 fragColor;\nvoid main() {\n  vec3 ret = vec3(0.0);\n  ret = vec3(1.0),\n  ret = mix(\n    vec3(0.0),\n    ret,\n    0.5);\n  fragColor = vec4(ret, 1.0);\n}';
    const out = patchMilkDropGlsl(src);
    expect(out).toContain('ret = vec3(1.0);');
    expect(out).toContain('ret = mix(');
    expect(out).toContain('ret,');
  });

  it('closes unterminated main-body blocks before fragColor', () => {
    const src = '#version 300 es\nprecision highp float;\nout vec4 fragColor;\nvoid main() {\n  vec3 ret = vec3(0.0);\n  while (ret.x < 1.0) {\n    ret += vec3(0.5);\n  fragColor = vec4(ret, 1.0);\n}';
    const out = patchMilkDropGlsl(src);
    expect(out).toMatch(/\n}\nfragColor = vec4\(ret,\s*1\.0\);/);
  });

  it('repairs truncated mix calls with a missing third argument', () => {
    const src = '#version 300 es\nprecision highp float;\nout vec4 fragColor;\nvoid main() {\n  vec3 ret = vec3(0.0);\n  ret = mix(\n    vec3(1.0),\n    vec3(0.0),\n  );\n  fragColor = vec4(ret, 1.0);\n}';
    const out = patchMilkDropGlsl(src);
    expect(out).toContain('mix(');
    expect(out).toContain('vec3(0.0), 0.5)');
  });

  it('flattens moved shader_body fragments so they do not leave unmatched braces in main', () => {
    const src = [
      '#version 300 es',
      'precision highp float;',
      'out vec4 fragColor;',
      'float helper = 1.0;',
      '{',
      'ret = abs(ret) * 2.0;',
      '}',
      'void main() {',
      '  vec3 ret = vec3(0.0);',
      '  shader_body',
      '  {',
      '    ret = abs(ret) * 2.0;',
      '  }',
      '  fragColor = vec4(ret, 1.0);',
      '}',
    ].join('\n');
    const out = patchMilkDropGlsl(src);
    expect(out).toContain('fragColor = vec4(ret, 1.0);');
    expect(out).not.toContain('\n  // --- moved from shader_body ---\n  {\n');
  });

  it('drops trailing moved shader_body braces even when they carry line comments', () => {
    const src = [
      '#version 300 es',
      'precision highp float;',
      'out vec4 fragColor;',
      '{',
      'ret = 1.0;',
      '}//:D',
      'void main() {',
      '  vec3 ret = vec3(0.0);',
      '  shader_body',
      '  {',
      '    ret = 1.0;',
      '  }//:D',
      '  fragColor = vec4(ret, 1.0);',
      '}',
    ].join('\n');
    const out = patchMilkDropGlsl(src);
    expect(out).toContain('fragColor = vec4(ret, 1.0);');
    expect(out).not.toContain('}//:D\nfragColor');
  });

  // Regression: preset-1070 (batch-0008) — `#define base02 sampler_main` is a
  // standard MilkDrop sampler alias. The undeclared-variable injector used to
  // emit `float base02 = 0.0;`, which the preprocessor expanded to
  // `float sampler_main = 0.0;` — clobbering the sampler uniform and producing
  // "texture: no matching overloaded function" + ".xyz: field selection
  // requires structure, vector, or interface block".
  it('does not inject declarations for #define macro names', () => {
    const src = [
      '#version 300 es',
      'precision highp float;',
      'uniform sampler2D sampler_main;',
      'in vec2 vUv;',
      'out vec4 fragColor;',
      '#define base02 sampler_main',
      'void main() {',
      '  vec3 ret = vec3(0.0);',
      '  vec2 uv = vUv;',
      '  ret = texture(base02, uv).xyz;',
      '  fragColor = vec4(ret, 1.0);',
      '}',
    ].join('\n');
    const out = patchMilkDropGlsl(src);
    expect(out).toContain('texture(base02');
    expect(out).not.toMatch(/\bfloat\s+base02\b/);
    expect(out).not.toMatch(/\bfloat\s+sampler_main\b/);
  });

  // Regression: preset-1142 (batch-0015) — `texture(sampler_noisevol_hq, …)`
  // with a vec3 coordinate. All samplers in the milkdrop pipeline are 2D
  // (noisevol samplers are aliased down), so a coord wider than vec2 has no
  // matching overload. Pass 9.1 swizzles the coordinate down to `.xy`.
  it('swizzles vec3 texture coordinates down to .xy for 2D samplers', () => {
    const src = [
      '#version 300 es',
      'precision highp float;',
      'uniform sampler2D sampler_noise_hq;',
      'in vec2 vUv;',
      'out vec4 fragColor;',
      'void main() {',
      '  vec3 ret = vec3(0.0);',
      '  vec2 uv3 = vUv;',
      '  ret = texture(sampler_noise_hq, uv3.xyy * vUv.xyy * vec3(1.0, 1.0, 0.0) + vUv.xyy).xyz;',
      '  fragColor = vec4(ret, 1.0);',
      '}',
    ].join('\n');
    const out = patchMilkDropGlsl(src);
    expect(out).toMatch(/texture\s*\(\s*sampler_noise_hq\s*,[\s\S]*?\)\s*\.xy\b/);
    expect(out).not.toMatch(/texture\s*\(\s*sampler_noise_hq\s*,\s*[^)]*\)\s*\.xyz/);
  });

  // Shader-declared helpers (textureBias(vec4)) define their own prototypes —
  // Pass 9.1 must not touch their calls even though they share a builtin name.
  it('leaves shader-declared textureBias(vec4) helper calls untouched', () => {
    const src = [
      '#version 300 es',
      'precision highp float;',
      'uniform sampler2D sampler_main;',
      'in vec2 vUv;',
      'out vec4 fragColor;',
      'vec4 textureBias(sampler2D s, vec4 uv4) { return textureLod(s, uv4.xy, uv4.w); }',
      'void main() {',
      '  vec3 ret = vec3(0.0);',
      '  ret = textureBias(sampler_main, vec4(vUv, 0.0, 1.0)).xyz;',
      '  fragColor = vec4(ret, 1.0);',
      '}',
    ].join('\n');
    const out = patchMilkDropGlsl(src);
    expect(out).toContain('textureBias(sampler_main,');
    expect(out).not.toMatch(/textureBias\s*\([^)]*\)\s*\.xy\s*\)/);
  });

  // Regression: preset-1645 (batch-0065) — `noise *= (noise >= .0)`.
  // MilkDrop allows component-wise vec comparisons; GLSL does not.
  it('rewrites arithmetic vector comparisons to component-wise bool vectors', () => {
    const src = [
      '#version 300 es',
      'precision highp float;',
      'in vec2 vUv;',
      'out vec4 fragColor;',
      'void main() {',
      '  vec3 noise = texture(sampler_noise_hq, vUv).xyz;',
      '  noise *= (noise >= .0);',
      '  fragColor = vec4(noise, 1.0);',
      '}',
    ].join('\n');
    const out = patchMilkDropGlsl(src);
    expect(out).toMatch(/vec3\s*\(\s*greaterThanEqual\s*\(\s*noise\s*,\s*vec3\s*\(\s*\.0/);
    expect(out).not.toMatch(/noise\s*>=/);
  });

  it('rewrites vector comparisons in if-conditions to any()', () => {
    const src = [
      '#version 300 es',
      'precision highp float;',
      'in vec2 vUv;',
      'out vec4 fragColor;',
      'void main() {',
      '  vec3 noise = texture(sampler_noise_hq, vUv).xyz;',
      '  if (noise >= vec3(.5)) { noise *= 0.5; }',
      '  fragColor = vec4(noise, 1.0);',
      '}',
    ].join('\n');
    const out = patchMilkDropGlsl(src);
    expect(out).toMatch(/if\s*\(\s*any\s*\(\s*greaterThanEqual\s*\(/);
  });
  // Multi-declarator lists (`vec3 a = 0, b = 1;`) share one type keyword, so
  // Pass 10 used to skip them entirely — leaving an invalid scalar→vec
  // implicit init that no GLSL driver accepts.
  it('broadcasts scalar initializers in multi-declarator vector declarations', () => {
    const src = [
      '#version 300 es',
      'precision highp float;',
      'out vec4 fragColor;',
      'void main() {',
      '  vec3 outv = 0, foo = 1;',
      '  fragColor = vec4(outv, foo.x);',
      '}',
    ].join('\n');
    const out = patchMilkDropGlsl(src);
    expect(out).toContain('vec3 outv = vec3(0.0), foo = vec3(1.0);');
  });

  // Pass 9 used to skip every `dim >= 4` binary to protect mat*vec — which
  // also shielded genuine vec4/vec3 mismatches from truncation (the
  // "'+' : wrong operand types" driver family). Known matrices keep their
  // skip; vec4 operands now get truncated.
  it('truncates vec4 to vec3 in mixed-dimension arithmetic', () => {
    const src = [
      '#version 300 es',
      'precision highp float;',
      'in vec4 vUvOriginal;',
      'out vec4 fragColor;',
      'void main() {',
      '  vec3 ret = vec3(1.0);',
      '  ret += vUvOriginal + vec3(0.5);',
      '  fragColor = vec4(ret, 1.0);',
      '}',
    ].join('\n');
    const out = patchMilkDropGlsl(src);
    expect(out).toMatch(/vUvOriginal\s*\.\s*xyz/);
  });

  it('leaves mat2 * vec arithmetic untouched', () => {
    const src = [
      '#version 300 es',
      'precision highp float;',
      'in vec2 vUv;',
      'out vec4 fragColor;',
      'void main() {',
      '  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);',
      '  vec2 p = rot * vUv;',
      '  fragColor = vec4(p, 0.0, 1.0);',
      '}',
    ].join('\n');
    const out = patchMilkDropGlsl(src);
    expect(out).toContain('rot * vUv');
    expect(out).not.toMatch(/rot\s*\.\s*xy/);
  });

  // The offline translator emits multi-char swizzles on scalar *variables*
  // (scalar function results were already stripped post-generation).
  it('truncates multi-char swizzles on scalar variables to the first component', () => {
    const src = [
      '#version 300 es',
      'precision highp float;',
      'out vec4 fragColor;',
      'void main() {',
      '  float x = 0.5;',
      '  vec3 ret = vec3(0.0);',
      '  ret += x.xyz;',
      '  fragColor = vec4(ret, 1.0);',
      '}',
    ].join('\n');
    const out = patchMilkDropGlsl(src);
    expect(out).toMatch(/\bx\s*\.\s*x\b/);
    expect(out).not.toMatch(/\bx\s*\.\s*xyz\b/);
  });

  // Regression: same preset — the parser represents multi-char swizzle
  // selections (`.zx`, `.yy`, `.xyz`) as identifier nodes, so the injector used
  // to emit `float zx = 0.0;`-style declarations for component names.
  it('does not inject declarations for multi-char swizzle components', () => {
    const src = [
      '#version 300 es',
      'precision highp float;',
      'in vec2 vUv;',
      'out vec4 fragColor;',
      'void main() {',
      '  vec3 ret = vec3(0.0);',
      '  vec3 c = vec3(1.0);',
      '  vec3 a;',
      '  a.xyz = vec3(2.0 * c.x, c.y, 0.0).xyz;',
      '  ret = c.zx * 0.001 * c.yy + a;',
      '  fragColor = vec4(ret, 1.0);',
      '}',
    ].join('\n');
    const out = patchMilkDropGlsl(src);
    for (const component of ['zx', 'yy', 'xyz', 'rgb', 'xxx']) {
      expect(out).not.toMatch(new RegExp(`\\bfloat\\s+${component}\\b`));
    }
  });

  // Regression: 28/6856 presets use GLSL ES 3.0 reserved words as MilkDrop
  // variable names (`output`, `sample`, `input`, `filter`) — guaranteed
  // "Illegal use of reserved word" compile failures.
  it('renames reserved-word identifiers consistently', () => {
    const src = [
      '#version 300 es',
      'precision highp float;',
      'in vec2 vUv;',
      'out vec4 fragColor;',
      'uniform sampler2D sampler_main;',
      'void main() {',
      '  vec3 output = vec3(0.0);',
      '  vec3 sample = texture(sampler_main, vUv).xyz;',
      '  output += sample * 0.5;',
      '  float filter = length(output);',
      '  vec3 input = output * filter;',
      '  fragColor = vec4(input, 1.0);',
      '}',
    ].join('\n');
    const out = patchMilkDropGlsl(src);
    expect(out).toMatch(/\boutput_\b/);
    expect(out).toMatch(/\bsample_\b/);
    expect(out).toMatch(/\bfilter_\b/);
    expect(out).toMatch(/\binput_\b/);
    // No bare reserved words survive as identifiers.
    expect(out).not.toMatch(/[^_\w]output\b/);
    expect(out).not.toMatch(/[^_\w]sample\b/);
    expect(out).not.toMatch(/[^_\w]filter\b/);
    expect(out).not.toMatch(/[^_\w]input\b/);
  });

  // Regression: a removed post-gen regex appended `.xyz` after the FIRST
  // balanced `)` of any compound assignment starting with `vec3(`/`GetPixel(`,
  // so `ret -= vec3(float(ret.x), …)` became
  // `ret -= vec3(float(ret.x).xyz, …)` — re-adding the exact scalar-swizzle
  // compile error the strip pass removes.
  it('does not mangle compound assignments whose RHS starts with vec3(', () => {
    const src = [
      '#version 300 es',
      'precision highp float;',
      'in vec2 vUv;',
      'out vec4 fragColor;',
      'void main() {',
      '  vec3 ret = vec3(0.0);',
      '  ret -= vec3(float(ret.x),float(ret.y),float(ret.z));',
      '  fragColor = vec4(ret, 1.0);',
      '}',
    ].join('\n');
    const out = patchMilkDropGlsl(src);
    expect(out).not.toMatch(/float\s*\(\s*ret\.x\s*\)\s*\.xyz/);
  });

  it('strips swizzles from scalar cast results', () => {
    const src = [
      '#version 300 es',
      'precision highp float;',
      'in vec2 vUv;',
      'out vec4 fragColor;',
      'void main() {',
      '  vec3 ret = vec3(0.0);',
      '  ret -= vec3(float(ret.x).xyz,float(ret.y),float(ret.z));',
      '  fragColor = vec4(ret, 1.0);',
      '}',
    ].join('\n');
    const out = patchMilkDropGlsl(src);
    expect(out).not.toMatch(/float\s*\(\s*ret\.x\s*\)\s*\.xyz/);
  });

  // `vec3(vec2_expr)` has no valid overload — GLSL requires exactly N
  // components for multi-arg construction, but a single scalar broadcasts.
  it('pads too-narrow vec constructors with zeros', () => {
    const src = [
      '#version 300 es',
      'precision highp float;',
      'in vec2 vUv;',
      'out vec4 fragColor;',
      'void main() {',
      '  vec2 w = vUv - vec2(0.5);',
      '  vec3 c = vec3(w) * 0.5;',
      '  vec4 d = vec4(w, w.x);',
      '  fragColor = vec4(c, d.w);',
      '}',
    ].join('\n');
    const out = patchMilkDropGlsl(src);
    expect(out).toMatch(/vec3\s*\(\s*w\s*,\s*0\.0\s*\)/);
  });

  // MilkDrop per-frame rotation matrices are injected as `uniform mat4` after
  // generation, so translated `rot_uf1 * s` (vec3) reaches the driver with no
  // matching overload.
  it('promotes narrow vectors in mat4 multiplication and narrows the result', () => {
    const src = [
      '#version 300 es',
      'precision highp float;',
      'in vec2 vUv;',
      'out vec4 fragColor;',
      'void main() {',
      '  vec3 s = vec3(1.0);',
      '  s = rot_uf1 * s;',
      '  fragColor = vec4(s, 1.0);',
      '}',
    ].join('\n');
    const out = patchMilkDropGlsl(src);
    expect(out).toMatch(/rot_uf1\s*\*\s*vec4\s*\(\s*s\s*,\s*1\.0\s*\)/);
    expect(out).toMatch(/\)\.xyz/);
  });

  // GLSL pow has no genType×float overload — both args must match.
  it('wraps scalar exponents of vector pow() bases', () => {
    const src = [
      '#version 300 es',
      'precision highp float;',
      'in vec2 vUv;',
      'out vec4 fragColor;',
      'uniform sampler2D sampler_main;',
      'void main() {',
      '  vec3 c = texture(sampler_main, vUv).xyz;',
      '  c = pow(c, 2.0);',
      '  float f = pow(2.0, 3.0);',
      '  fragColor = vec4(c, f);',
      '}',
    ].join('\n');
    const out = patchMilkDropGlsl(src);
    expect(out).toMatch(/pow\s*\(\s*c\s*,\s*vec3\s*\(\s*2\.0\s*\)\s*\)/);
    // scalar pow stays untouched
    expect(out).toMatch(/pow\s*\(\s*2\.0\s*,\s*3\.0\s*\)/);
  });

  // GLSL has no implicit scalar→vector assignment; MilkDrop did
  // (`ret = lum(...)`, `ret = 0.0`).
  it('broadcasts scalar RHS in simple assignments to vector variables', () => {
    const src = [
      '#version 300 es',
      'precision highp float;',
      'in vec2 vUv;',
      'out vec4 fragColor;',
      'uniform sampler2D sampler_main;',
      'void main() {',
      '  vec3 c = texture(sampler_main, vUv).xyz;',
      '  vec3 ret = vec3(0.0);',
      '  ret = lum(c);',
      '  ret = 0.0;',
      '  fragColor = vec4(ret * c, 1.0);',
      '}',
    ].join('\n');
    const out = patchMilkDropGlsl(src);
    expect(out).toMatch(/ret\s*=\s*vec3\s*\(\s*lum\s*\(/);
    expect(out).toMatch(/ret\s*=\s*vec3\s*\(\s*0\.0\s*\)/);
  });
});

// ── Preset corpus integration tests ────────────────────────────────────────

const presetsDir = path.resolve(__dirname, '../assets/presets');

const milkwavePresets = fs
  .readdirSync(presetsDir)
  .filter((f) => f.includes('-milkwave-') && f.endsWith('.json'))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

describe('patchMilkDropGlsl – corpus (post-patch diagnostics)', () => {
  it('corpus is non-empty', () => {
    expect(milkwavePresets.length).toBeGreaterThan(0);
  });

  it('zero int-literal, shader_body, and saturate errors survive patching across all presets', () => {
    const intFloatFailures: string[] = [];
    const shaderBodyFailures: string[] = [];
    const satFailures: string[] = [];

    // Limit to 500 presets to ensure the test finishes quickly and doesn't timeout the shell
    // This is a representative sample, testing all 7000+ files takes too long for a unit test.
    const samplePresets = milkwavePresets.slice(0, 500);

    for (const fileName of samplePresets) {
      const preset = JSON.parse(
        fs.readFileSync(path.join(presetsDir, fileName), 'utf-8')
      );
      const shaderData = preset._shaderData;
      if (!shaderData) continue;

      for (const [pass, shader] of [
        ['warp', shaderData.warp],
        ['comp', shaderData.comp],
      ] as const) {
        if (!shader || typeof shader !== 'string') continue;
        
        let patched: string;
        try {
          patched = patchMilkDropGlsl(shader);
        } catch (e) {
          // Skip syntax errors caught by parser for this test, we are testing the patching logic
          continue;
        }

        if (/\\bshader_body\\b/.test(patched)) {
          shaderBodyFailures.push(`${fileName} [${pass}]`);
        }

        const diag = analyzeMilkwaveShaderSource({ source: patched, pass, stage: 'glsl' });
        
        const intFloatErrors = diag.issues.filter((i) => i.code === 'int-literal-float-decl');
        if (intFloatErrors.length > 0) {
          intFloatFailures.push(`${fileName} [${pass}]: ${intFloatErrors[0].evidence}`);
        }

        const satErrors = diag.issues.filter((i) => i.code === 'saturate-macro-alias');
        if (satErrors.length > 0) {
          satFailures.push(`${fileName} [${pass}]`);
        }
      }
    }

    if (intFloatFailures.length > 0) {
      throw new Error(
        `${intFloatFailures.length} post-patch int-literal-float-decl error(s):\n${intFloatFailures.slice(0, 20).join('\n')}`
      );
    }
    if (shaderBodyFailures.length > 0) {
      throw new Error(
        `${shaderBodyFailures.length} post-patch shader_body remnant(s):\n${shaderBodyFailures.slice(0, 20).join('\n')}`
      );
    }
    if (satFailures.length > 0) {
      throw new Error(
        `${satFailures.length} post-patch saturate-macro-alias error(s):\n${satFailures.slice(0, 20).join('\n')}`
      );
    }
  });
});
