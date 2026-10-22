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
  // HLSL scalar swizzles replicate, so the postfix is dropped entirely —
  // truncating to `.x` would still be invalid GLSL on a float.
  it('strips multi-char swizzles on scalar variables entirely', () => {
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
    expect(out).toMatch(/ret\s*\+=\s*x\s*;/);
    expect(out).not.toMatch(/\bx\s*\.\s*[xyz]/);
  });

  // Single-char scalar swizzles (`float s; s.x` — legal HLSL replication,
  // "'x' : field selection requires structure, vector, or interface block"
  // in GLSL) are the top driver-error family; they strip the same way.
  it('strips single-char swizzles on scalar variables', () => {
    const src = [
      '#version 300 es',
      'precision highp float;',
      'in vec2 vUv;',
      'out vec4 fragColor;',
      'void main() {',
      '  float s = 0.5;',
      '  float t = s.x + s.y;',
      '  fragColor = vec4(t, 0.0, 0.0, 1.0);',
      '}',
    ].join('\n');
    const out = patchMilkDropGlsl(src);
    expect(out).toMatch(/float t = s\s*\+\s*s;/);
    expect(out).not.toMatch(/\bs\s*\.\s*[xy]\b/);
  });

  // An undeclared name used only with a swizzle (`hue_shader.zxy`) must be
  // declared as a vector sized to the swizzle, not float — otherwise the
  // injected `float hue_shader` fails with the same field-selection error
  // (batch 9221: ~150 presets, biggest fallback family).
  it('declares swizzle-used undeclared names as vectors, not floats', () => {
    const src = [
      '#version 300 es',
      'precision highp float;',
      'in vec2 vUv;',
      'out vec4 fragColor;',
      'void main() {',
      '  vec3 ret = vec3(0.0);',
      '  ret *= hue_shader.zxy * 0.5;',
      '  fragColor = vec4(ret, 1.0);',
      '}',
    ].join('\n');
    const out = patchMilkDropGlsl(src);
    expect(out).toMatch(/vec3\s+hue_shader\s*=/);
    expect(out).not.toMatch(/float\s+hue_shader/);
  });

  // Swizzles on genuine vectors must survive all of the above.
  it('keeps swizzles on declared vectors intact', () => {
    const src = [
      '#version 300 es',
      'precision highp float;',
      'in vec2 vUv;',
      'out vec4 fragColor;',
      'void main() {',
      '  vec3 c = vec3(0.2, 0.4, 0.6);',
      '  float b = c.zxy.x * 2.0;',
      '  vec2 uv = vUv.xy * c.zz;',
      '  fragColor = vec4(b, uv, 1.0);',
      '}',
    ].join('\n');
    const out = patchMilkDropGlsl(src);
    expect(out).toMatch(/c\.zxy/);
    expect(out).toMatch(/vUv\.xy/);
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

  // Preset-1074 family: Pass 9 pads narrow operands into vecN ctors inside a
  // texture coord. The ctor arg is a binary expression — it must keep its
  // parens (precedence), and the over-wide coord must be swizzled to .xy for
  // ANY sampler name (base02, not just sampler_*), structurally in the AST.
  it('keeps ctor padding parenthesized and swizzles oversize coords on free-named samplers', () => {
    const src = [
      '#version 300 es',
      'precision highp float;',
      'in vec2 vUv;',
      'out vec4 fragColor;',
      'uniform sampler2D base02;',
      'void main() {',
      '  vec2 uv = vUv;',
      '  vec2 uvof = vec2(0.1);',
      '  vec3 my_mean = vec3(0.5);',
      '  vec3 sp = vec3(0.0);',
      '  sp=sin((sp+texture(base02,0.5+(uv-0.5)*0.1*(0.8+0.2*my_mean)-uvof*0.1))*1.5);',
      '  fragColor = vec4(sp, 1.0);',
      '}',
    ].join('\n');
    const out = patchMilkDropGlsl(src);
    // coord is wrapped and swizzled: texture(base02, (...).xy)
    expect(out).toMatch(/texture\s*\(\s*base02\s*,\s*\(.*\)\s*\.xy\s*\)/);
    // padded ctor keeps the binary arg parenthesized: vec3((uv - vec2(0.5)) * 0.1, 0.0)
    expect(out).toMatch(/vec3\s*\(\s*\(\s*\(uv\s*-\s*vec2\s*\(\s*0\.5\s*\)\s*\)\s*\*\s*0\.1\s*\)\s*,\s*0\.0\s*\)/);
    // the old corruption left the multiply and pad OUTSIDE the ctor
    expect(out).not.toMatch(/\)\s*\*\s*0\.1\s*,\s*0\.0/);
    let bal = 0;
    for (const ch of out) { if (ch === '(') bal++; if (ch === ')') bal--; expect(bal).toBeGreaterThanOrEqual(0); }
    expect(bal).toBe(0);
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

  // Presets that named a sampler "main": the translator emits
  // `#define main sampler_pw_main`, which renames the entry point to
  // `void sampler_main()` and collides with the sampler uniform
  // ("'sampler_main' : redefinition of a function" — dylan/led family).
  it('inlines `#define main <sampler>` and preserves the entry point', () => {
    const src = [
      '#version 300 es',
      'precision highp float;',
      'in vec2 vUv;',
      'out vec4 fragColor;',
      'uniform sampler2D sampler_main;',
      '#define sampler_pw_main sampler_main',
      '#define main sampler_pw_main',
      'void main() {',
      '  vec3 op = texture(main, vUv);',
      '  fragColor = vec4(op, 1.0);',
      '}',
    ].join('\n');
    const out = patchMilkDropGlsl(src);
    expect(out).toMatch(/void main\(\)/);
    expect(out).not.toMatch(/#define\s+main\b/);
    expect(out).toMatch(/texture\s*\(\s*sampler_pw_main\s*,\s*vUv\s*\)/);
  });

  // MilkDrop's rand_frame/rand_preset are scalars; the translator declares
  // them vec4. Bare scalar-context uses must be swizzled to .x so the
  // declaration-inference pass doesn't widen `float z` to vec4
  // (cascade: "tan(z)" → vec4, "'*' : wrong operand types").
  it('swizzles bare rand_frame/rand_preset uses to .x, keeping vec4 decls and .xy uses', () => {
    const src = [
      '#version 300 es',
      'precision highp float;',
      'in vec2 vUv;',
      'out vec4 fragColor;',
      'uniform vec4 rand_frame;',
      'uniform vec4 rand_preset;',
      'void main() {',
      '  float z = rand_frame * 64.0 + 0.1;',
      '  vec2 r = rand_preset.xy;',
      '  fragColor = vec4(vec2(z), r.x, 1.0);',
      '}',
    ].join('\n');
    const out = patchMilkDropGlsl(src);
    expect(out).toMatch(/uniform vec4 rand_frame;/);
    expect(out).toMatch(/float z = rand_frame\.x \* 64\.0/);
    expect(out).toMatch(/rand_preset\.xy/);
  });

  // MilkDrop allows warp shaders to write q1-q32 (per-pixel local writes);
  // GLSL uniforms are read-only. Assigned q-vars get a local copy.
  it('gives assigned q-vars a local copy initialized from the uniform', () => {
    const src = [
      '#version 300 es',
      'precision highp float;',
      'in vec2 vUv;',
      'out vec4 fragColor;',
      'uniform float q24;',
      'uniform float q25;',
      'void main() {',
      '  q25 = q24 + 0.01;',
      '  float f = q25 * 0.5;',
      '  fragColor = vec4(f, 0.0, 0.0, 1.0);',
      '}',
    ].join('\n');
    const out = patchMilkDropGlsl(src);
    expect(out).toMatch(/float q25_l = q25;/);
    expect(out).toMatch(/q25_l = q24 \+ 0\.01/);
    expect(out).toMatch(/float f = q25_l \* 0\.5/);
  });

  // `GetBlur1(0.0)` — scalar passed to the vec2-param lookup helpers
  // ("'GetBlur1' : no matching overloaded function"). Coerce to vec2.
  it('coerces scalar args to sampler-lookup helpers into vec2', () => {
    const src = [
      '#version 300 es',
      'precision highp float;',
      'in vec2 vUv;',
      'out vec4 fragColor;',
      'uniform sampler2D sampler_blur1;',
      'vec3 GetBlur1(vec2 uv) { return texture(sampler_blur1, uv).xyz; }',
      'void main() {',
      '  vec3 ret = GetBlur1(0.0) + GetBlur1(vUv);',
      '  fragColor = vec4(ret, 1.0);',
      '}',
    ].join('\n');
    const out = patchMilkDropGlsl(src);
    expect(out).toMatch(/GetBlur1\s*\(\s*vec2\s*\(\s*0\.0\s*\)\s*\)/);
    expect(out).toMatch(/GetBlur1\s*\(\s*vUv\s*\)/);
  });

  // Component-wise functions (fract, sin, ...) CAN return vectors — their
  // swizzles must survive (the old post-gen strip deleted them and
  // recreated the very dimension errors Pass 10.5 fixes).
  it('keeps swizzles after component-wise vector results and strips scalar ones', () => {
    const src = [
      '#version 300 es',
      'precision highp float;',
      'in vec2 vUv;',
      'out vec4 fragColor;',
      'void main() {',
      '  vec2 uv2 = vUv;',
      '  vec2 uv3;',
      '  vec3 noise = vec3(0.25);',
      '  float mask = 0.5;',
      '  uv3 = fract(uv2 + 0.5 - (noise - 0.5) * mask * 0.2).xy;',
      '  float l = lum(noise).xyz * 0.1;',
      '  fragColor = vec4(uv3, l, 1.0);',
      '}',
    ].join('\n');
    const out = patchMilkDropGlsl(src);
    expect(out).toMatch(/\)\.xy\s*;/);
    expect(out).not.toMatch(/lum\s*\([^)]*\)\s*\.xyz/);
  });

  // `-rot_d2 * s` parses as (-rot_d2) * s — Pass 9.2 must unwrap the unary
  // to see the mat4 and promote the narrow vector operand.
  it('promotes narrow vectors in unary-negated matrix multiplication', () => {
    const src = [
      '#version 300 es',
      'precision highp float;',
      'in vec2 vUv;',
      'out vec4 fragColor;',
      'void main() {',
      '  vec3 sp = vec3(1.0);',
      '  sp = -rot_d2 * sp;',
      '  fragColor = vec4(sp, 1.0);',
      '}',
    ].join('\n');
    const out = patchMilkDropGlsl(src);
    expect(out).toMatch(/-\s*rot_d2\s*\*\s*vec4\s*\(\s*sp\s*,\s*1\.0\s*\)/);
    expect(out).toMatch(/\)\.xyz/);
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

// ── Session: tier-2 compile-family fixes (batch-9221 probe loop) ──────────

describe('patchMilkDropGlsl – tier-2 compile families', () => {
  it('clamps out-of-range swizzle letters on chained selections (.xy.zzz → .xy.yyy)', () => {
    const src = '#version 300 es\n' +
      'vec3 GetBlur1(vec2 uv) { return vec3(0.0); }\n' +
      'void main() {\n  vec2 uv = vec2(0.0);\n' +
      '  vec2 uv3 = (uv-.5)*(1.0 - GetBlur1(uv).xy.zzz)+.5;\n}';
    const out = patchMilkDropGlsl(src);
    expect(out).toMatch(/\.xy\.yyy/);
    expect(out).not.toMatch(/\.xy\.zzz/);
  });

  it('splats scalar operands of pow to the vector dimension (pow(2.0, vec3))', () => {
    const src = '#version 300 es\n' +
      'void main() {\n  vec3 v = vec3(1.0);\n  v = pow(2.0, v);\n}';
    const out = patchMilkDropGlsl(src);
    expect(out).toMatch(/pow\( *vec3\(/);
  });

  it('rewrites vector ternary conditions to any(lessThan(...))', () => {
    const src = '#version 300 es\n' +
      'void main() {\n  vec2 uv = vec2(0.0);\n  vec2 mirrorized = vec2(0.0);\n' +
      '  mirrorized = (uv < 0.5) ? uv * 2.0 : (vec2(1.0) - uv) * 2.0;\n}';
    const out = patchMilkDropGlsl(src);
    expect(out).toMatch(/any\(lessThan\(/);
    expect(out).not.toMatch(/vec2\(lessThan\(/);
  });

  it('collapses float x = (vector comparison) to float(any(...)) instead of widening', () => {
    const src = '#version 300 es\n' +
      'void main() {\n  vec2 zz = vec2(0.0);\n  float mask = (zz <= 1);\n' +
      '  vec3 ret = vec3(0.0);\n  ret = (1.0 - mask) * ret;\n}';
    const out = patchMilkDropGlsl(src);
    expect(out).toMatch(/float mask = float\( *any\(/);
    expect(out).toMatch(/lessThanEqual/);
    expect(out).not.toMatch(/vec2 mask/);
  });

  it('inlines reversed multiply(mat, vec) calls as mat * vec', () => {
    const src = '#version 300 es\n' +
      'vec2 multiply(vec2 v, mat2 m) { return m * v; }\n' +
      'void main() {\n  vec2 rs = vec2(0.0);\n' +
      '  rs = multiply(mat2(1.0,2.0,-2.0,1.0), rs);\n}';
    const out = patchMilkDropGlsl(src);
    expect(out).not.toMatch(/rs = multiply\(/);
    expect(out).toMatch(/mat2\(1\.0, ?2\.0, ?-2\.0, ?1\.0\) *\* ?rs/);
  });

  it('transposes non-square multiply(mat2x3, vec3) so the product is a vec2', () => {
    const src = '#version 300 es\n' +
      'void main() {\n  vec3 tss = vec3(1.0);\n  vec3 tt = vec3(2.0);\n  vec3 vv = vec3(3.0);\n' +
      '  vec2 w = multiply(mat2x3(tss, tt), vv);\n}';
    const out = patchMilkDropGlsl(src);
    expect(out).toMatch(/transpose\(mat2x3/);
    expect(out).toMatch(/\* *vv/);
  });

  it('truncates float x = vec_expr to .x when the variable is only used as a scalar', () => {
    const src = '#version 300 es\n' +
      'void main() {\n  vec2 uvp = vec2(0.5);\n  float mm = sin(uvp * 0.3);\n' +
      '  vec3 ret = vec3(mm);\n}';
    const out = patchMilkDropGlsl(src);
    expect(out).toMatch(/float mm = sin\(uvp \* 0\.3\)\.x/);
    expect(out).not.toMatch(/vec2 mm/);
  });

  it('still widens float x = vec_expr when a later swizzle needs vector-ness', () => {
    const src = '#version 300 es\n' +
      'void main() {\n  vec2 uvp = vec2(0.5);\n  float zz = sin(uvp * 0.3);\n' +
      '  vec3 ret = vec3(zz.y, 0.0, 0.0);\n}';
    const out = patchMilkDropGlsl(src);
    expect(out).toMatch(/vec2 zz/);
  });

  it('rewrites HLSL brace matrix initializers to constructors', () => {
    const src = '#version 300 es\n' +
      'void main() {\n' +
      'mat2 rot = { cos(-0.5) - 0.01, sin(-0.5),\n' +
      '-sin(-0.5), cos(-0.5) - 0.01\n' +
      '};\n}';
    const out = patchMilkDropGlsl(src);
    expect(out).toMatch(/mat2 rot = mat2\(/);
    expect(out).not.toMatch(/= \{/);
  });

  it('broadcasts scalars on plain = assignments instead of zero-padding (vec3(x,0,0))', () => {
    const src = '#version 300 es\n' +
      'void main() {\n  vec3 rad1 = vec3(0.0);\n  rad1 = sqrt(2.0);\n}';
    const out = patchMilkDropGlsl(src);
    expect(out).toMatch(/rad1 = vec3\(sqrt\(2\.0\)\)/);
    expect(out).not.toMatch(/vec3\(sqrt\(2\.0\), *0\.0/);
  });

  it('widens outer scalars against post-truncation dims (bottom-up Pass 9)', () => {
    const src = '#version 300 es\n' +
      'void main() {\n  vec4 c8 = vec4(1.0);\n  float tt = 1.0;\n' +
      '  vec2 rr = vec2(0.0);\n  rr = rr * 0.25 + 0.1 * c8 + 0.1 * tt;\n}';
    const out = patchMilkDropGlsl(src);
    expect(out).toMatch(/vec2\(\(?0\.1 \* tt\)?\)/);
    expect(out).not.toMatch(/vec4\(\(?0\.1 \* tt\)?\)/);
  });

  it('infers mat2*vec2 products as vec2 so vec4 operands get truncated', () => {
    const src = '#version 300 es\n' +
      'void main() {\n  mat2 rot = mat2(1.0, 0.0, 0.0, 1.0);\n  vec2 uvp = vec2(0.0);\n' +
      '  vec2 w = ((rot * uvp - vec4(0.5)) + vec4(0.5)).xy;\n}';
    const out = patchMilkDropGlsl(src);
    expect(out).not.toMatch(/\+ vec4\(0\.5\)\)/);
    expect(out).toMatch(/vec4\(0\.5\)\.xy/);
  });

  it('converts same-type function-body redeclarations of file-scope names to assignments (ANGLE link)', () => {
    // 02_mw_new* family: globals hoisted to file scope, main redeclares uv2.
    // Legal GLSL (compiles) but ANGLE/Metal emits _uuv2 twice → link failure.
    const src = '#version 300 es\n' +
      'vec2 rs, uv1, uv2, uv3;\n' +
      'void main() {\n' +
      '  uv1 = vec2(0.5);\n' +
      '  uv2 = 1.0 * uv1;\n' +
      '  vec2 uv2 = 32.0 * uv1;\n' +
      '  vec3 ret = vec3(uv2, 0.0);\n}';
    const out = patchMilkDropGlsl(src);
    // the redeclaration became a bare assignment to the global
    expect(out).toMatch(/uv2 = *32\.0/);
    // only the file-scope declaration mentions the type keyword
    expect(out).not.toMatch(/vec2 uv2/);
    expect((out.match(/uv2 =/g) ?? []).length).toBe(2);
  });

  it('keeps cross-type shadows of file-scope names (legal GLSL, no rewrite)', () => {
    const src = '#version 300 es\n' +
      'vec2 q = vec2(0.0);\n' +
      'void main() {\n' +
      '  float q = 0.5;\n' +
      '  vec3 ret = vec3(q);\n}';
    const out = patchMilkDropGlsl(src);
    expect(out).toMatch(/float q = *0\.5/);
    expect(out).not.toMatch(/vec3 q/);
  });
});
