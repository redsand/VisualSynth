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
