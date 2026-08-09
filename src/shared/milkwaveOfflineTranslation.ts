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
  supportTier: MilkwaveSupportTier; // @deprecated
  // Optional: the persisted (zod) translation schema stores only the
  // deprecated `supportTier`, not these split tiers — they are populated when
  // a report is freshly generated at runtime. Kept optional so zod-loaded
  // project data (which omits them) satisfies this interface.
  staticSupportTier?: MilkwaveSupportTier;
  runtimeSupportTier?: MilkwaveSupportTier;
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
#define texsize vec4(uTexSize, 1.0/uTexSize)

// Random values
uniform vec2 uRandomPreset;
uniform vec2 uRandomFrame;
uniform vec4 rand_preset;
uniform vec4 rand_frame;

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
uniform highp sampler3D sampler_noisevol_lq;
uniform highp sampler3D sampler_noisevol_hq;
#define sampler_fc_main sampler_main
#define sampler_pc_main sampler_main
#define sampler_fw_main sampler_main
#define sampler_pw_main sampler_main
#define sampler_noise_lq_lite sampler_noise_lq

// MilkDrop q-variable uniforms (q1–q32)
uniform float q1; uniform float q2; uniform float q3; uniform float q4;
uniform float q5; uniform float q6; uniform float q7; uniform float q8;
uniform float q9; uniform float q10; uniform float q11; uniform float q12;
uniform float q13; uniform float q14; uniform float q15; uniform float q16;
uniform float q17; uniform float q18; uniform float q19; uniform float q20;
uniform float q21; uniform float q22; uniform float q23; uniform float q24;
uniform float q25; uniform float q26; uniform float q27; uniform float q28;
uniform float q29; uniform float q30; uniform float q31; uniform float q32;

// MilkDrop _c / _q matrix uniforms
uniform vec4 _c0; uniform vec4 _c1; uniform vec4 _c2; uniform vec4 _c3;
uniform vec4 _c4; uniform vec4 _c5; uniform vec4 _c6; uniform vec4 _c7;
uniform vec4 _c8; uniform vec4 _c9; uniform vec4 _c10; uniform vec4 _c11;
uniform vec4 _c12; uniform vec4 _c13; uniform vec4 _c14;
uniform vec4 _c15; uniform vec4 _c16; uniform vec4 _c17;
uniform vec4 _qa; uniform vec4 _qb; uniform vec4 _qc; uniform vec4 _qd;
uniform vec4 _qe; uniform vec4 _qf; uniform vec4 _qg; uniform vec4 _qh;

// MilkDrop rotation matrices
uniform mat4 rot_s1; uniform mat4 rot_s2; uniform mat4 rot_s3; uniform mat4 rot_s4;
uniform mat4 rot_d1; uniform mat4 rot_d2; uniform mat4 rot_d3; uniform mat4 rot_d4;
uniform mat4 rot_f1; uniform mat4 rot_f2; uniform mat4 rot_f3; uniform mat4 rot_f4;
uniform mat4 rot_vf1; uniform mat4 rot_vf2; uniform mat4 rot_vf3; uniform mat4 rot_vf4;
uniform mat4 rot_uf1; uniform mat4 rot_uf2; uniform mat4 rot_uf3; uniform mat4 rot_uf4;
uniform mat4 rot_rand1; uniform mat4 rot_rand2; uniform mat4 rot_rand3; uniform mat4 rot_rand4;

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
vec4 textureLod4(sampler2D s, vec4 uv4) { return textureLod(s, uv4.xy, uv4.w); }
`;

const generateMilkwaveMain = (prelude: string, body: string) => {
  const outerPrelude = prelude.trim();
  const mainBody = body.trim();
  return `${outerPrelude ? `${outerPrelude}\n\n` : ''}void main() {
  vec3 ret = vec3(0.0);
  vec2 uv = vUv;
  vec2 uv_orig = vUvOriginal;
  float rad = vRadius;
  float ang = vAngle;
  ${mainBody}
  fragColor = vec4(ret, 1.0);
}`;
};

const MILKWAVE_DIALECT_TYPE_REWRITES: Array<[RegExp, string]> = [
  [/\bfloat1\b/g, 'float'],
  [/\bfloat2\b/g, 'vec2'],
  [/\bfloat3\b/g, 'vec3'],
  [/\bfloat4\b/g, 'vec4'],
  [/\bfloat2x2\b/g, 'mat2'],
  [/\bfloat3x3\b/g, 'mat3'],
  [/\bfloat4x4\b/g, 'mat4'],
  [/\bfloat4x3\b/g, 'mat4'],
  [/\bhalf\b/g, 'float'],
  [/\bhalf2\b/g, 'vec2'],
  [/\bhalf3\b/g, 'vec3'],
  [/\bhalf4\b/g, 'vec4'],
  [/\bfixed\b/g, 'float'],
  [/\bfixed2\b/g, 'vec2'],
  [/\bfixed3\b/g, 'vec3'],
  [/\bfixed4\b/g, 'vec4'],
  [/\bint2\b/g, 'ivec2'],
  [/\bint3\b/g, 'ivec3'],
  [/\bint4\b/g, 'ivec4'],
  [/\buint2\b/g, 'uvec2'],
  [/\buint3\b/g, 'uvec3'],
  [/\buint4\b/g, 'uvec4'],
  [/\bbool2\b/g, 'bvec2'],
  [/\bbool3\b/g, 'bvec3'],
  [/\bbool4\b/g, 'bvec4']
];

const MILKWAVE_DIALECT_FUNCTION_REWRITES: Array<[RegExp, string]> = [
  [/\btex2D\s*\(/g, 'texture('],
  [/\btex2Dbias\s*\(/g, 'textureBias('],
  [/\btex2Dlod\s*\(/g, 'textureLod4('],
  [/\btex2Dgrad\s*\(/g, 'textureGrad('],
  [/\btex2Dproj\s*\(/g, 'textureProj('],
  [/\btexCUBE\s*\(/g, 'texture('],
  [/\blerp\s*\(/g, 'mix('],
  [/\bfrac\s*\(/g, 'fract('],
  [/\bfmod\s*\(/g, 'mod('],
  [/\bsaturate\s*\(/g, 'clamp01('],
  [/\bmul\s*\(/g, 'multiply('],
  [/\bddx\s*\(/g, 'dFdx('],
  [/\bddy\s*\(/g, 'dFdy('],
  [/\brsqrt\s*\(/g, 'inversesqrt('],
  [/\batan2\s*\(/g, 'atan(']
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

  // Strip unsupported preprocessor directives
  result = result.replace(/^\s*#pragma\s+.*$/gm, '');
  result = result.replace(/^\s*#define\s+HLSLPROGRAM\b.*$/gm, '');

  // Strip HLSL sampler_state blocks (no GLSL equivalent — texture state is implicit in sampler objects)
  result = result.replace(/\bsampler_state\s*\{[^}]*\}/gs, '');

  // Expand sincos(angle, s, c) to two separate assignments before they hit the compiler
  result = result.replace(
    /\bsincos\s*\(\s*([^,]+?)\s*,\s*([^,]+?)\s*,\s*([^)]+?)\s*\)/g,
    (_match, angle, s, c) => `((${s}) = sin(${angle}), (${c}) = cos(${angle}))`
  );

  // uTexSize is vec2 but MilkDrop texsize is vec4(w,h,1/w,1/h) — fix .z/.w/.zw swizzle
  result = result.replace(/\buTexSize\.zw\b/g, '(vec2(1.0)/uTexSize)');
  result = result.replace(/\buTexSize\.z\b/g, '(1.0/uTexSize.x)');
  result = result.replace(/\buTexSize\.w\b/g, '(1.0/uTexSize.y)');
  result = result.replace(/\buTexSize\.xyzw\b/g, 'vec4(uTexSize, 1.0/uTexSize)');

  // Boolean NOT on floats: !var → (var == 0.0 ? 1.0 : 0.0)
  result = result.replace(/(?<![!=<>])!([a-zA-Z_]\w*)(?!\s*=)/g, '($1 == 0.0 ? 1.0 : 0.0)');

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
  result = result
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      // Skip int declarations, for-loop headers, and preprocessor directives
      if (/^\s*int\s/.test(line) || /^\s*for\s*\(/.test(line) || /^\s*ivec/.test(line) || trimmed.startsWith('#')) {
        return line;
      }

      if (/\bvec2\s+\w+\s*=/.test(line) || /\buv2?\s*(?:[+\-*/]?=)/.test(line)) {
        line = line.replace(
          /\b(?:GetPixel|GetBlur[123]|GetMain)\((?:[^()]|\([^()]*\))*\)(?!\s*\.xy)/g,
          (match) => `${match}.xy`
        );
      }
      line = line.replace(/(\bmix\([^;\n]*?),\s*(-?\d+)\s*\)/g, '$1, $2.0)');

      // Integer literal coercion: expr OP N → expr OP N.0 (where N is a bare int)
      line = line.replace(
        /([a-zA-Z_)\]]\w*(?:\.[xyzwrgba]+)?)\s*([*\/+\-])\s*(-?\d+)(?!\.|\d|\s*\[)/g,
        (_m, id, op, num) => `${id} ${op} ${num}.0`
      );
      // N OP expr → N.0 OP expr
      line = line.replace(
        /(?<=[\s(,=])(\d+)(?!\.\d)\s*([*\/+\-])\s*([a-zA-Z_(])/g,
        (_m, num, op, id) => `${num}.0 ${op} ${id}`
      );
      // Inside vec/mat constructors: vec3(x, 0) → vec3(x, 0.0)
      line = line.replace(/(?<=[,(])\s*(\d+)\s*(?=[,)])/g, (_m, num) => ` ${num}.0 `);

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

  // Inject #define stubs for any unknown custom samplers (map to noise texture so shader compiles)
  const knownSamplers = new Set([
    'main', 'fc_main', 'pc_main', 'fw_main', 'pw_main',
    'noise_lq', 'noise_lq_lite', 'noise_mq', 'noise_hq',
    'noisevol_lq', 'noisevol_hq', 'blur1', 'blur2', 'blur3'
  ]);
  const customSamplerRe = /\bsampler_([a-z0-9_]+)\b/gi;
  const customSamplerStubs: string[] = [];
  let m: RegExpExecArray | null;
  const fullSource = (processedPrelude + '\n' + processedBody);
  while ((m = customSamplerRe.exec(fullSource)) !== null) {
    const name = m[1].toLowerCase();
    if (!knownSamplers.has(name)) {
      knownSamplers.add(name); // avoid duplicates
      customSamplerStubs.push(`#define sampler_${name} sampler_noise_lq`);
    }
  }
  const customSamplerHeader = customSamplerStubs.length > 0
    ? `// Custom sampler stubs (mapped to noise texture)\n${customSamplerStubs.join('\n')}\n`
    : '';

  const glsl = generateMilkwaveGlslHeader() + customSamplerHeader + generateMilkwaveMain(processedPrelude, processedBody);
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
      ['float1', 'float4x3', 'tex2Dbias', 'tex2Dlod', 'sampler_state'].includes(feature)
    );

  return {
    pipeline: 'milkwave-offline-v1',
    supportTier: capability.staticSupportTier,
    staticSupportTier: capability.staticSupportTier,
    runtimeSupportTier: capability.staticSupportTier, // defaults to static until audited
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
