import type { MilkPresetData } from './milkwaveParser';
import type { MilkwaveIR, MilkwaveSupportTier, MilkwaveShaderPassKind } from './milkwaveIr';
import { buildMilkwaveIR } from './milkwaveIr';
import { classifyMilkwaveIR } from './milkwaveCapability';
import { analyzeMilkwaveShaderSource } from './milkwaveDiagnostics';
import { normalizeMilkwaveShaderPass } from './milkwaveShaderNormalization';

export interface MilkwaveOfflineTranslationIssue {
  severity: 'info' | 'warning' | 'error';
  code: string;
  message: string;
}

export interface MilkwaveOfflineTranslationPass {
  kind: MilkwaveShaderPassKind;
  requested: boolean;
  generated: boolean;
  source: string;
  backend: 'milkwave-direct-v2';
  normalized: {
    preludeLineCount: number;
    bodyLineCount: number;
    helperLineCount: number;
    hasShaderBodyBlock: boolean;
    source: string;
    dialectSource: string;
  } | null;
  warnings: string[];
  errors: string[];
  diagnostics: {
    lineCount: number;
    sourceLength: number;
    issueCount: number;
    issues: MilkwaveOfflineTranslationIssue[];
  } | null;
}

export interface MilkwaveOfflineTranslationReport {
  pipeline: 'milkwave-offline-v1';
  supportTier: MilkwaveSupportTier;
  featureSummary: string[];
  runtimePatchRecommended: boolean;
  passes: {
    warp: MilkwaveOfflineTranslationPass;
    comp: MilkwaveOfflineTranslationPass;
  };
}

const createEmptyPass = (kind: MilkwaveShaderPassKind): MilkwaveOfflineTranslationPass => ({
  kind,
  requested: false,
  generated: false,
  source: '',
  backend: 'milkwave-direct-v2',
  normalized: null,
  warnings: [],
  errors: [],
  diagnostics: null
});

const generateMilkwaveGlslHeader = (): string => `#version 300 es
precision highp float;

// VisualSynth uniforms
uniform float uTime;
uniform float uFrame;
uniform float uFps;
uniform float uRms;

// Audio uniforms
uniform float audioLow;
uniform float audioLowSmooth;
uniform float audioMid;
uniform float audioMidSmooth;
uniform float audioHigh;
uniform float audioHighSmooth;

// Screen uniforms
uniform float uAspectX;
uniform float uAspectY;
uniform vec2 uAspect;
uniform vec2 uTexSize;

// Random values
uniform vec2 uRandomPreset;
uniform vec2 uRandomFrame;

// Input from vertex shader
in vec2 vUv;
in vec2 vUvOriginal;
in float vRadius;
in float vAngle;

// Output
out vec4 fragColor;

// Textures
uniform sampler2D sampler_main;
uniform sampler2D sampler_noise_lq;
uniform sampler2D sampler_noise_mq;
uniform sampler2D sampler_noise_hq;
uniform sampler2D sampler_blur1;
uniform sampler2D sampler_blur2;
uniform sampler2D sampler_blur3;

float clamp01(float x) { return clamp(x, 0.0, 1.0); }
vec2 clamp01(vec2 x) { return clamp(x, vec2(0.0), vec2(1.0)); }
vec3 clamp01(vec3 x) { return clamp(x, vec3(0.0), vec3(1.0)); }
vec4 clamp01(vec4 x) { return clamp(x, vec4(0.0), vec4(1.0)); }
float lum(vec3 x) { return dot(x, vec3(0.32, 0.49, 0.29)); }
float lum(vec4 x) { return dot(x.rgb, vec3(0.32, 0.49, 0.29)); }
float sat(float x) { return clamp(x, 0.0, 1.0); }
vec2 sat(vec2 x) { return clamp(x, vec2(0.0), vec2(1.0)); }
vec3 sat(vec3 x) { return clamp(x, vec3(0.0), vec3(1.0)); }
vec4 sat(vec4 x) { return clamp(x, vec4(0.0), vec4(1.0)); }

vec3 GetPixel(vec2 uv) { return texture(sampler_main, uv).xyz; }
vec3 GetBlur1(vec2 uv) { return texture(sampler_blur1, uv).xyz; }
vec3 GetBlur2(vec2 uv) { return texture(sampler_blur2, uv).xyz; }
vec3 GetBlur3(vec2 uv) { return texture(sampler_blur3, uv).xyz; }
vec4 noise3(vec2 uv) { return texture(sampler_noise_lq, uv); }
vec3 GetMain(vec2 uv) { return texture(sampler_main, uv).xyz; }
vec2 multiply(vec2 v, mat2 m) { return m * v; }
vec3 multiply(vec3 v, mat3 m) { return m * v; }
vec4 multiply(vec4 v, mat4 m) { return m * v; }
vec4 textureBias(sampler2D s, vec4 uv4) { return textureLod(s, uv4.xy, uv4.w); }
`;

const generateMilkwaveMain = (prelude: string, body: string) => {
  const outerPrelude = prelude.trim();
  const mainBody = body.trim();
  return `${outerPrelude ? `${outerPrelude}\n\n` : ''}void main() {
  vec4 ret = vec4(0.0);
  vec2 uv = vUv;
  vec2 uv_orig = vUvOriginal;
  float rad = vRadius;
  float ang = vAngle;
  ${mainBody}
  fragColor = ret;
}`;
};

const MILKWAVE_DIALECT_TYPE_REWRITES: Array<[RegExp, string]> = [
  [/\bfloat1\b/g, 'float'],
  [/\bfloat2\b/g, 'vec2'],
  [/\bfloat3\b/g, 'vec3'],
  [/\bfloat4\b/g, 'vec4'],
  [/\bhalf\b/g, 'float'],
  [/\bhalf2\b/g, 'vec2'],
  [/\bhalf3\b/g, 'vec3'],
  [/\bhalf4\b/g, 'vec4'],
  [/\bfixed\b/g, 'float'],
  [/\bfixed2\b/g, 'vec2'],
  [/\bfixed3\b/g, 'vec3'],
  [/\bfixed4\b/g, 'vec4']
];

const MILKWAVE_DIALECT_FUNCTION_REWRITES: Array<[RegExp, string]> = [
  [/\btex2D\s*\(/g, 'texture('],
  [/\btex2Dbias\s*\(/g, 'textureBias('],
  [/\btex2Dlod\s*\(/g, 'textureLod('],
  [/\blerp\s*\(/g, 'mix('],
  [/\bfrac\s*\(/g, 'fract('],
  [/\bsaturate\s*\(/g, 'clamp01('],
  [/\bmul\s*\(/g, 'multiply(']
];

const applyMilkwaveDialectRewrites = (source: string): string => {
  let rewritten = source.replace(/#define\s+sat\s+saturate\b/g, '#define sat clamp01');

  for (const [pattern, replacement] of MILKWAVE_DIALECT_TYPE_REWRITES) {
    rewritten = rewritten.replace(pattern, replacement);
  }
  for (const [pattern, replacement] of MILKWAVE_DIALECT_FUNCTION_REWRITES) {
    rewritten = rewritten.replace(pattern, replacement);
  }

  rewritten = rewritten
    .replace(/\bbass_att\b/g, 'audioLowSmooth')
    .replace(/\bbass\b/g, 'audioLow')
    .replace(/\bmid_att\b/g, 'audioMidSmooth')
    .replace(/\bmid\b/g, 'audioMid')
    .replace(/\btreb_att\b/g, 'audioHighSmooth')
    .replace(/\btreb\b/g, 'audioHigh')
    .replace(/\bvol\b/g, 'uRms')
    .replace(/\btime\b/g, 'uTime')
    .replace(/\bframe\b/g, 'uFrame')
    .replace(/\bfps\b/g, 'uFps')
    .replace(/\btexsize\b/g, 'uTexSize');

  return rewritten;
};

const processMilkwaveCode = (code: string): string => {
  let result = applyMilkwaveDialectRewrites(code).replace(/^`/gm, '');

  result = result.replace(/\bstatic\s+const\b/g, 'const');
  result = result.replace(/\baspectx\b/g, 'uAspectX');
  result = result.replace(/\baspecty\b/g, 'uAspectY');
  result = result.replace(/\baspect\b/g, 'uAspect');

  result = result.replace(
    /\bvec2\s+(\w+)\s*\(([^)]*)\)\s*\{\s*return\s*\(([\s\S]*?)\);\s*\}/g,
    (_match, name, args, expr) => `vec2 ${name}(${args}) { return (${expr}).xy; }`
  );
  result = result.replace(
    /\bvec3\s+(\w+)\s*\(([^)]*)\)\s*\{\s*return\s*\(([\s\S]*?)\);\s*\}/g,
    (_match, name, args, expr) => `vec3 ${name}(${args}) { return (${expr}).xyz; }`
  );
  result = result.replace(/\bclip\s*\(([^)]+)\)/g, 'if ($1 < 0.0) discard');
  result = result.replace(/\btexture\s*\(([^,]+),\s*([^)]+)\)\.rgb\b/g, 'texture($1, $2).xyz');
  result = result.replace(/\btexture\s*\(([^,]+),\s*([^)]+)\)\.xy\b/g, 'texture($1, $2).xy');
  result = result.replace(
    /\bmix\s*\(\s*([^,]+?)\s*,\s*([^,]+?)\s*,\s*(-?\d+)\s*\)/g,
    (_match, a, b, t) => `mix(${a}, ${b}, ${t}.0)`
  );
  result = result.replace(
    /\bdot\s*\(\s*([^,]+?)\s*,\s*(-?(?:\d+\.\d+|\d+|\.\d+))\s*\)/g,
    (_match, vecExpr, scalarLiteral) => {
      const trimmed = vecExpr.trim();
      const dim = /\.((?:xy|rg))(?![a-zA-Z])/i.test(trimmed) ? 'vec2' : 'vec3';
      return `dot(${trimmed}, ${dim}(${scalarLiteral}))`;
    }
  );
  result = result.replace(
    /\bmix\s*\(\s*(dot\([^\n;]+?\))\s*,\s*((?:vec3\s*\([^)]*\))|(?:[a-zA-Z_]\w*))\s*,/g,
    (_match, dotExpr, vecExpr) => `mix(vec3(${dotExpr}), ${vecExpr},`
  );
  result = result.replace(
    /\bmix\s*\(\s*([^,]+?)\s*,\s*(lum\s*\([^)]*\))\s*,/g,
    (_match, vecExpr, lumExpr) => `mix(${vecExpr}, vec3(${lumExpr}),`
  );
  result = result.replace(
    /\bmix\s*\(\s*([^,]+?)\s*,\s*([^,]+?)\s*,\s*(-?\d+)\s*\)/g,
    (_match, a, b, t) => `mix(${a}, ${b}, ${t}.0)`
  );
  result = result.replace(
    /\bret\s*=\s*(-?(?:\d+\.\d+|\d+|\.\d+))\s*-\s*([^;]+);/g,
    (_match, scalarLiteral, rhs) => `ret = vec3(${scalarLiteral}) - ${rhs};`
  );
  result = result.replace(
    /(\bvec2\s+\w+\s*=\s*[^;]*?)(\b(?:GetPixel|GetBlur[123]|GetMain)\((?:[^()]|\([^()]*\))*\))(?!\s*\.)/g,
    (_match, prefix, helperCall) => `${prefix}${helperCall}.xy`
  );
  result = result.replace(
    /(\b[a-zA-Z_]\w*\s*(?:[+\-*/]?=)\s*[^;]*?\b(?:uv|uv2|delta|offset|coord)\w*[^;]*?)(\b(?:GetPixel|GetBlur[123]|GetMain)\((?:[^()]|\([^()]*\))*\))(?!\s*\.)/g,
    (_match, prefix, helperCall) => `${prefix}${helperCall}.xy`
  );
  result = result.replace(
    /(?<=[=(,])\s*(-?(?:\d+\.\d+|\d+|\.\d+))\s*([+\-])\s*((?:\d*\.?\d+\s*\*\s*)?(?:GetPixel|GetBlur[123]|GetMain)\((?:[^()]|\([^()]*\))*\)\.xy)/g,
    (_match, scalarLiteral, op, rhs) => ` vec2(${scalarLiteral}) ${op} ${rhs}`
  );
  result = result
    .split('\n')
    .map((line) => {
      if (/\bvec2\s+\w+\s*=/.test(line) || /\buv2?\s*(?:[+\-*/]?=)/.test(line)) {
        line = line.replace(
          /\b(?:GetPixel|GetBlur[123]|GetMain)\((?:[^()]|\([^()]*\))*\)(?!\s*\.xy)/g,
          (match) => `${match}.xy`
        );
      }
      line = line.replace(/(\bmix\([^;\n]*?),\s*(-?\d+)\s*\)/g, '$1, $2.0)');
      return line;
    })
    .join('\n');

  return result;
};

const translatePass = (
  ir: MilkwaveIR,
  kind: MilkwaveShaderPassKind
): MilkwaveOfflineTranslationPass => {
  const source = ir.passes[kind].source;
  if (!source) {
    return createEmptyPass(kind);
  }

  const normalized = normalizeMilkwaveShaderPass(source, kind);
  const dialectSource = processMilkwaveCode(normalized.source);
  const warnings: string[] = [];
  const errors: string[] = [];

  if (dialectSource.includes('sampler3D')) {
    warnings.push('3D textures are not fully supported in WebGL2');
  }
  if (dialectSource.includes('ComputeShader') || dialectSource.includes('RWTexture')) {
    errors.push('Compute shaders are not supported in WebGL2');
  }
  if (source.includes('static const')) {
    warnings.push('Static constants converted to const');
  }

  const processedPrelude = normalized.preludeLines.length
    ? processMilkwaveCode(normalized.preludeLines.join('\n'))
    : '';
  const processedBody = normalized.bodyLines.length
    ? processMilkwaveCode(normalized.bodyLines.join('\n'))
    : dialectSource;

  const glsl = generateMilkwaveGlslHeader() + generateMilkwaveMain(processedPrelude, processedBody);
  const diagnostics = analyzeMilkwaveShaderSource({
    source: glsl,
    pass: kind,
    stage: 'glsl'
  });

  return {
    kind,
    requested: true,
    generated: true,
    source: glsl,
    backend: 'milkwave-direct-v2',
    normalized: {
      preludeLineCount: normalized.preludeLines.length,
      bodyLineCount: normalized.bodyLines.length,
      helperLineCount: normalized.helperLines.length,
      hasShaderBodyBlock: normalized.hasShaderBodyBlock,
      source: normalized.source,
      dialectSource
    },
    warnings,
    errors,
    diagnostics: {
      lineCount: diagnostics.lineCount,
      sourceLength: diagnostics.sourceLength,
      issueCount: diagnostics.issues.length,
      issues: diagnostics.issues.map((issue) => ({
        severity: issue.severity,
        code: issue.code,
        message: issue.message
      }))
    }
  };
};

export const translateMilkwaveIROffline = (
  ir: MilkwaveIR
): MilkwaveOfflineTranslationReport => {
  const capability = classifyMilkwaveIR(ir);
  const warp = translatePass(ir, 'warp');
  const comp = translatePass(ir, 'comp');

  const runtimePatchRecommended =
    [warp, comp].some((pass) => pass.diagnostics?.issueCount || pass.errors.length > 0) ||
    capability.featureSummary.some((feature) =>
      ['float1', 'float4x3', 'tex2Dbias', 'sampler_state'].includes(feature)
    );

  return {
    pipeline: 'milkwave-offline-v1',
    supportTier: capability.tier,
    featureSummary: capability.featureSummary,
    runtimePatchRecommended,
    passes: {
      warp,
      comp
    }
  };
};

export const translateMilkwavePresetOffline = (preset: MilkPresetData) => {
  const ir = buildMilkwaveIR(preset);
  const capability = classifyMilkwaveIR(ir);
  const translation = translateMilkwaveIROffline(ir);
  return {
    ir,
    capability,
    translation
  };
};
