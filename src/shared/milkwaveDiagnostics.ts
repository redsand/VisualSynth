export type MilkwaveDiagnosticSeverity = 'info' | 'warning' | 'error';

export interface MilkwaveShaderIssue {
  severity: MilkwaveDiagnosticSeverity;
  code: string;
  message: string;
  evidence?: string;
}

export interface MilkwaveShaderDiagnostics {
  stage: 'raw' | 'glsl';
  pass: 'warp' | 'comp';
  sourceLength: number;
  lineCount: number;
  shaderBodyDetected: boolean;
  version300esDetected: boolean;
  qVarCount: number;
  previousFrameSamplerAliasCount: number;
  blurSamplerCount: number;
  issues: MilkwaveShaderIssue[];
}

const pushIssue = (
  issues: MilkwaveShaderIssue[],
  severity: MilkwaveDiagnosticSeverity,
  code: string,
  message: string,
  evidence?: string
) => {
  issues.push({ severity, code, message, evidence });
};

const firstMatch = (source: string, pattern: RegExp) => source.match(pattern)?.[0];

export const analyzeMilkwaveShaderSource = ({
  source,
  pass,
  stage
}: {
  source: string;
  pass: 'warp' | 'comp';
  stage: 'raw' | 'glsl';
}): MilkwaveShaderDiagnostics => {
  const normalized = source ?? '';
  const issues: MilkwaveShaderIssue[] = [];

  if (!normalized.trim()) {
    pushIssue(issues, 'info', 'empty-shader', 'No custom shader source is present for this pass.');
  }

  const scalarAlias = firstMatch(normalized, /\bfloat1\b/);
  if (scalarAlias) {
    pushIssue(
      issues,
      'error',
      'hlsl-float1',
      'Uses HLSL scalar alias `float1`, which is invalid in GLSL ES.',
      scalarAlias
    );
  }

  const samplerState = firstMatch(normalized, /\bsampler_state\b/);
  if (samplerState) {
    pushIssue(
      issues,
      'error',
      'hlsl-sampler-state',
      'Uses HLSL sampler_state blocks, which have no direct GLSL ES equivalent.',
      samplerState
    );
  }

  const sampler3D = firstMatch(normalized, /\bsampler3D\b/);
  if (sampler3D) {
    pushIssue(
      issues,
      'warning',
      'sampler3d',
      'Uses 3D samplers; WebGL2 support exists but the current runtime does not bind Milkwave volume-noise textures.',
      sampler3D
    );
  }

  const texBias = firstMatch(normalized, /\btex2Dbias\s*\(/);
  if (texBias) {
    pushIssue(
      issues,
      'warning',
      'tex2dbias',
      'Uses `tex2Dbias`, which requires explicit GLSL translation and sampler LOD semantics.',
      texBias
    );
  }

  const float4x3 = firstMatch(normalized, /\bfloat4x3\b/);
  if (float4x3) {
    pushIssue(
      issues,
      'warning',
      'float4x3',
      'Uses MilkDrop rotation matrices as `float4x3`; the current runtime pads these loosely to `mat4`.',
      float4x3
    );
  }

  const includeLike = firstMatch(normalized, /#include\s+[<"].+[>"]/);
  if (includeLike) {
    pushIssue(
      issues,
      'error',
      'preprocessor-include',
      'Contains preprocessor include directives; the current runtime does not run an include preprocessor.',
      includeLike
    );
  }

  const noiseVol = firstMatch(normalized, /\bsampler_noisevol_(?:lq|hq)\b/);
  if (noiseVol) {
    pushIssue(
      issues,
      'warning',
      'noise-volume-sampler',
      'References Milkwave volume-noise samplers that are not currently bound by the runtime.',
      noiseVol
    );
  }

  const customTexture = firstMatch(normalized, /\bsampler_[a-z0-9_]+\b/i);
  if (customTexture && /\bsampler_(?!main|fc_main|pc_main|fw_main|pw_main|noise_lq|noise_lq_lite|noise_mq|noise_hq|noisevol_lq|noisevol_hq|blur1|blur2|blur3)\w+\b/i.test(normalized)) {
    pushIssue(
      issues,
      'warning',
      'custom-sampler',
      'References custom sampler names; imported texture-slot assets are not currently provisioned in the runtime.',
      customTexture
    );
  }

  if (stage === 'raw' && normalized.trim() && !/\bshader_body\b/.test(normalized)) {
    pushIssue(
      issues,
      'warning',
      'missing-shader-body',
      'Raw MilkDrop shader does not contain a `shader_body` block; wrapper generation may not reflect the original contract.'
    );
  }

  if (stage === 'glsl' && normalized.trim() && !/#version 300 es/.test(normalized)) {
    pushIssue(
      issues,
      'error',
      'missing-version',
      'Generated shader is missing `#version 300 es`, so the runtime patcher will not run.'
    );
  }

  if (/\bGetBlur[123]\s*\(/.test(normalized) && !/\bsampler_blur[123]\b/.test(normalized) && stage === 'glsl') {
    pushIssue(
      issues,
      'warning',
      'blur-helper-without-sampler',
      'Shader uses blur helpers but the generated source does not explicitly reference blur samplers; verify helper injection.'
    );
  }

  if (stage === 'glsl' && /void\s+main\s*\([\s\S]*?\{[\s\S]*?\b(?:float|vec[234]|mat[234]|int|bool|void)\s+\w+\s*\([^;]*\)\s*\{/m.test(normalized)) {
    pushIssue(
      issues,
      'error',
      'nested-function-in-main',
      'Generated GLSL still contains helper function declarations inside main(), which GLSL ES does not allow.'
    );
  }

  const varyingWrite = firstMatch(normalized, /\bv(?:Uv|UvOriginal|Radius|Angle)\s*(?:[+\-*/]?=|\+\+|--)/);
  if (varyingWrite) {
    pushIssue(
      issues,
      'error',
      'varying-write',
      'Generated GLSL writes to a vertex input/varying instead of using a mutable local alias.',
      varyingWrite
    );
  }

  const saturateAlias = firstMatch(normalized, /#define\s+sat\s+saturate\b/);
  if (saturateAlias) {
    pushIssue(
      issues,
      'error',
      'saturate-macro-alias',
      'Generated GLSL still aliases sat to saturate, which is not a GLSL ES builtin.',
      saturateAlias
    );
  }

  return {
    stage,
    pass,
    sourceLength: normalized.length,
    lineCount: normalized ? normalized.split(/\r?\n/).length : 0,
    shaderBodyDetected: /\bshader_body\b/.test(normalized),
    version300esDetected: /#version 300 es/.test(normalized),
    qVarCount: (normalized.match(/\bq([1-9]|[12]\d|3[0-2])\b/g) ?? []).length,
    previousFrameSamplerAliasCount:
      (normalized.match(/\bsampler_(?:fc_main|pc_main|fw_main|pw_main)\b/g) ?? []).length,
    blurSamplerCount: (normalized.match(/\bsampler_blur[123]\b/g) ?? []).length,
    issues
  };
};

export const summarizeMilkwaveShaderDiagnostics = (diagnostics: MilkwaveShaderDiagnostics): string => {
  const errorCount = diagnostics.issues.filter((issue) => issue.severity === 'error').length;
  const warningCount = diagnostics.issues.filter((issue) => issue.severity === 'warning').length;
  return [
    `${diagnostics.pass}/${diagnostics.stage}`,
    `${diagnostics.lineCount} lines`,
    `${errorCount} errors`,
    `${warningCount} warnings`,
    `${diagnostics.qVarCount} q-vars`
  ].join(' · ');
};
