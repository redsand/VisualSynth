import { describe, expect, it } from 'vitest';
import {
  analyzeMilkwaveShaderSource,
  summarizeMilkwaveShaderDiagnostics
} from '../src/shared/milkwaveDiagnostics';
import { transpileMilkDropShader } from '../src/shared/hlslToGlsl';

describe('Milkwave diagnostics', () => {
  it('flags known HLSL-only constructs in raw shader source', () => {
    const raw = `
shader_body {
  float1 d = 0.005;
  sampler3D vol;
  ret = tex2Dbias(sampler_main, float4(uv, 0.0, -0.5)).xyz;
}`;

    const diagnostics = analyzeMilkwaveShaderSource({
      source: raw,
      pass: 'warp',
      stage: 'raw'
    });

    expect(diagnostics.issues.some((issue) => issue.code === 'hlsl-float1')).toBe(true);
    expect(diagnostics.issues.some((issue) => issue.code === 'sampler3d')).toBe(true);
    expect(diagnostics.issues.some((issue) => issue.code === 'tex2dbias')).toBe(true);
  });

  it('flags generated GLSL that will bypass runtime patching', () => {
    const diagnostics = analyzeMilkwaveShaderSource({
      source: 'precision highp float;\nvoid main() {}',
      pass: 'comp',
      stage: 'glsl'
    });

    expect(diagnostics.issues.some((issue) => issue.code === 'missing-version')).toBe(true);
  });

  it('summarizes useful counts for logging', () => {
    const diagnostics = analyzeMilkwaveShaderSource({
      source: '#version 300 es\nvoid main() { float v = q1 + q2; }',
      pass: 'warp',
      stage: 'glsl'
    });

    expect(summarizeMilkwaveShaderDiagnostics(diagnostics)).toContain('warp/glsl');
    expect(summarizeMilkwaveShaderDiagnostics(diagnostics)).toContain('q-vars');
  });

  it('transpiles float1 to float so no hlsl-float1 remains in GLSL output', () => {
    const result = transpileMilkDropShader(
      'shader_body { float1 d = 0.005; ret = tex2D(sampler_main, uv).xyz; }',
      'warp'
    );
    const diagnostics = analyzeMilkwaveShaderSource({
      source: result.glsl,
      pass: 'warp',
      stage: 'glsl'
    });

    expect(diagnostics.version300esDetected).toBe(true);
    // float1 is now converted to float by the transpiler — no residual hlsl-float1 issue expected
    expect(diagnostics.issues.some((issue) => issue.code === 'hlsl-float1')).toBe(false);
  });
});
