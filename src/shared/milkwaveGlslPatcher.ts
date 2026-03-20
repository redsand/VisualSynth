/**
 * Runtime GLSL patcher for MilkDrop preset shaders.
 *
 * Architecture:
 *   Phase 1 — String preprocessing: structural fixes that must happen before
 *             the source is valid GLSL (shader_body removal, uniform/helper
 *             injection, undeclared variable auto-declaration, etc.)
 *   Phase 2 — AST transforms: type-level fixes using @shaderfrog/glsl-parser
 *             (int→float literals, texture() swizzle, pow/min/max promotion,
 *             return type fixes). These are structurally correct by
 *             construction — no regex edge cases.
 *
 * This module is pure string transformation — no WebGL, no browser APIs.
 * It lives in src/shared/ so it can be imported and tested in Node environments.
 */

import { parse, generate } from '@shaderfrog/glsl-parser';
import { visit } from '@shaderfrog/glsl-parser/ast';
import type {
  AstNode,
  Program,
  FunctionCallNode,
  FunctionNode,
  IntConstantNode,
  FloatConstantNode,
  PostfixNode,
  FieldSelectionNode,
  DeclaratorListNode,
  DeclarationNode,
  AssignmentNode,
  IdentifierNode,
  BinaryNode,
  UnaryNode,
  ExpressionStatementNode,
  ReturnStatementNode,
  TypeSpecifierNode,
  KeywordNode,
  FullySpecifiedTypeNode,
  GroupNode,
  LiteralNode,
} from '@shaderfrog/glsl-parser/ast';
import type { Path } from '@shaderfrog/glsl-parser/ast';

// ═══════════════════════════════════════════════════════════════════════════
// AST helper utilities
// ═══════════════════════════════════════════════════════════════════════════

/** Get the name of a function call (e.g. "texture", "vec3", "pow"). */
const getFnName = (node: FunctionCallNode): string => {
  const id = node.identifier;
  if (id.type === 'identifier') return id.identifier;
  if (id.type === 'type_specifier') {
    const spec = id.specifier;
    if (spec.type === 'keyword') return spec.token;
    if (spec.type === 'identifier') return spec.identifier;
  }
  return '';
};

/** Get the actual arguments of a function call (filter out comma literals). */
const getArgs = (node: FunctionCallNode): AstNode[] =>
  node.args.filter(a => !(a.type === 'literal' && (a as LiteralNode).literal === ','));

/** Get the type keyword from a declarator list (e.g. "float", "vec3"). */
const getTypeKeyword = (node: DeclaratorListNode): string => {
  const spec = node.specified_type.specifier.specifier;
  if (spec.type === 'keyword') return spec.token;
  if (spec.type === 'identifier') return spec.identifier;
  return '';
};

/** Check if a path is inside an int/ivec/uint declaration or for-loop int init. */
const isInIntContext = (p: Path<any>): boolean => {
  let ctx: Path<any> | undefined = p.parentPath;
  while (ctx) {
    if (ctx.node.type === 'declarator_list') {
      const kw = getTypeKeyword(ctx.node as DeclaratorListNode);
      if (kw === 'int' || kw === 'uint' || kw.startsWith('ivec') || kw.startsWith('uvec')) return true;
    }
    if (ctx.node.type === 'array_specifier' || ctx.node.type === 'quantifier') return true;
    ctx = ctx.parentPath;
  }
  return false;
};

/** Known vec3 variable names in MilkDrop shaders. */
const VEC3_VARS = new Set(['ret', 'col', 'color', 'orig', 'warped']);

/** Known scalar-returning function names. */
const SCALAR_FNS = new Set([
  'lum', 'dot', 'length', 'distance', 'float', 'abs', 'sign',
  'floor', 'ceil', 'fract', 'mod', 'min', 'max', 'clamp',
  'pow', 'sqrt', 'inversesqrt', 'log', 'exp',
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan',
  'step', 'smoothstep', 'mix',
  'degrees', 'radians', 'round', 'trunc',
]);

/** Infer the vec dimensionality of an expression. Returns 1/2/3/4 or 0 if unknown. */
const inferDim = (node: AstNode): number => {
  if (node.type === 'float_constant' || node.type === 'int_constant' || node.type === 'double_constant') return 1;

  if (node.type === 'identifier') {
    const name = (node as IdentifierNode).identifier;
    if (VEC3_VARS.has(name)) return 3;
    if (name === 'uv' || name === 'vUv') return 2;
    if (name === 'fragColor') return 4;
    return 0;
  }

  if (node.type === 'function_call') {
    const fn = getFnName(node as FunctionCallNode);
    if (fn === 'texture' || fn === 'textureLod' || fn === 'textureBias') return 4;
    if (fn === 'vec2') return 2;
    if (fn === 'vec3') return 3;
    if (fn === 'vec4') return 4;
    if (fn === 'GetPixel' || fn === 'GetBlur1' || fn === 'GetBlur2' || fn === 'GetBlur3' || fn === 'GetMain') return 3;
    if (fn === 'GetBlurX') return 3;
    if (fn === 'noise3') return 4;
    if (fn === 'sat') return 0; // depends on arg
    if (fn === 'clamp01') return 0;
    if (fn === 'mix') {
      // mix preserves the dimensionality of its first arg
      const args = getArgs(node as FunctionCallNode);
      return args.length > 0 ? inferDim(args[0]) : 0;
    }
    if (SCALAR_FNS.has(fn)) return 1;
    return 0;
  }

  if (node.type === 'postfix') {
    const pf = (node as PostfixNode).postfix;
    if (pf.type === 'field_selection') {
      const sel = (pf as FieldSelectionNode).selection;
      const swizzle = sel.type === 'literal' ? (sel as LiteralNode).literal : '';
      if (swizzle.length >= 1 && swizzle.length <= 4 && /^[xyzwrgba]+$/.test(swizzle)) {
        return swizzle.length;
      }
    }
    // array access → scalar
    if (pf.type === 'quantifier' || pf.type === 'array_specifier') return 1;
    return inferDim((node as PostfixNode).expression);
  }

  if (node.type === 'binary') {
    const left = inferDim((node as BinaryNode).left);
    const right = inferDim((node as BinaryNode).right);
    return Math.max(left, right);
  }

  if (node.type === 'unary') {
    return inferDim((node as UnaryNode).expression);
  }

  if (node.type === 'group') {
    return inferDim((node as GroupNode).expression);
  }

  if (node.type === 'assignment') {
    return inferDim((node as AssignmentNode).left);
  }

  return 0;
};

/**
 * Find the enclosing statement's LHS to determine vec context.
 * Returns the inferred dimension of the assignment target, or 0 if unknown.
 */
const findEnclosingAssignmentDim = (p: Path<any>): number => {
  let ctx: Path<any> | undefined = p;
  while (ctx) {
    const n = ctx.node;
    if (n.type === 'assignment') {
      return inferDim((n as AssignmentNode).left);
    }
    if (n.type === 'declarator_list') {
      const kw = getTypeKeyword(n as DeclaratorListNode);
      if (kw === 'vec2') return 2;
      if (kw === 'vec3') return 3;
      if (kw === 'vec4') return 4;
      if (kw === 'float') return 1;
      return 0;
    }
    if (n.type === 'expression_statement' || n.type === 'return_statement') break;
    ctx = ctx.parentPath;
  }
  return 0;
};

// ═══════════════════════════════════════════════════════════════════════════
// AST node factories
// ═══════════════════════════════════════════════════════════════════════════

const mkFloat = (value: string, ws: string | string[] = ' '): FloatConstantNode => ({
  type: 'float_constant',
  token: value.includes('.') ? value : value + '.0',
  whitespace: ws,
});

const mkIdentifier = (name: string, ws: string | string[] = ''): IdentifierNode => ({
  type: 'identifier',
  identifier: name,
  whitespace: ws,
});

const mkKeyword = (token: string, ws: string | string[] = ''): KeywordNode => ({
  type: 'keyword',
  token,
  whitespace: ws,
});

const mkLiteral = <T extends string = string>(literal: T, ws: string | string[] = ''): LiteralNode<T> => ({
  type: 'literal',
  literal,
  whitespace: ws,
});

const mkTypeSpecifier = (keyword: string): TypeSpecifierNode => ({
  type: 'type_specifier',
  specifier: mkKeyword(keyword),
  quantifier: null,
});

const mkFnCall = (name: string, args: AstNode[], ws: string | string[] = ''): FunctionCallNode => ({
  type: 'function_call',
  identifier: mkTypeSpecifier(name),
  lp: mkLiteral('('),
  args,
  rp: mkLiteral(')'),
});

const mkPostfixSwizzle = (expr: AstNode, swizzle: string): PostfixNode => ({
  type: 'postfix',
  expression: expr as any,
  postfix: {
    type: 'field_selection',
    dot: mkLiteral('.'),
    selection: mkLiteral(swizzle),
  } as FieldSelectionNode as unknown as AstNode,
});

// ═══════════════════════════════════════════════════════════════════════════
// Phase 1: String preprocessing
// ═══════════════════════════════════════════════════════════════════════════

const ROT_NAMES = [
  'rot_s1', 'rot_s2', 'rot_s3', 'rot_s4',
  'rot_d1', 'rot_d2', 'rot_d3', 'rot_d4',
  'rot_f1', 'rot_f2', 'rot_f3', 'rot_f4',
  'rot_vf1', 'rot_vf2', 'rot_vf3', 'rot_vf4',
  'rot_uf1', 'rot_uf2', 'rot_uf3', 'rot_uf4',
  'rot_rand1', 'rot_rand2', 'rot_rand3', 'rot_rand4',
];

/**
 * Phase 1: Structural string preprocessing.
 * Handles constructs that would prevent the GLSL parser from succeeding:
 * shader_body removal, missing declarations, undeclared variables, etc.
 */
const preprocess = (source: string): string => {
  // ── 0a. Strip HLSL remnants ──
  // `static` keyword (HLSL only, not valid GLSL)
  source = source.replace(/\bstatic\s+/g, '');
  // `float2x3` etc. → `mat2x3`
  source = source.replace(/\bfloat(\d)x(\d)\b/g, 'mat$1x$2');

  // ── 0b. Strip shader_body blocks ──
  const mainIdxPre = source.indexOf('void main()');
  if (mainIdxPre !== -1) {
    let s = source;
    // Strip explicit shader_body { ... } blocks before void main()
    let sbIdx = s.indexOf('shader_body');
    while (sbIdx !== -1 && sbIdx < s.indexOf('void main()')) {
      const openBrace = s.indexOf('{', sbIdx);
      if (openBrace === -1) break;
      let depth = 1;
      let pos = openBrace + 1;
      while (pos < s.length && depth > 0) {
        if (s[pos] === '{') depth++;
        else if (s[pos] === '}') depth--;
        pos++;
      }
      s = s.substring(0, sbIdx).trimEnd() + '\n' + s.substring(pos).trimStart();
      sbIdx = s.indexOf('shader_body');
    }
    source = s.replace(/\bshader_body\s*(?=\{)/g, '');

    // ── 0c. Handle orphan shader_body content at file scope ──
    // When the HLSL→GLSL transpiler already stripped the `shader_body` keyword,
    // the block content and closing `}` remain at file scope. The structure is:
    //   ... function definitions ...
    //   declarations / executable statements (was inside shader_body)
    //   }                          ← orphan closing brace
    //   void main() { ... }
    // The orphan `}` was the closing brace of the original shader_body block.
    // We need to: (1) remove the orphan `}`, (2) move executable statements
    // into void main(), (3) keep file-scope declarations where they are.
    const mainPos = source.indexOf('void main()');
    const beforeMainStr = source.substring(0, mainPos);
    const lines = beforeMainStr.split('\n');

    // Find orphan `}` — a `}` at file scope before void main() that would make
    // the brace depth go negative.
    let braceDepth = 0;
    let orphanBraceLine = -1;
    for (let i = 0; i < lines.length; i++) {
      for (const ch of lines[i]) {
        if (ch === '{') braceDepth++;
        else if (ch === '}') {
          braceDepth--;
          if (braceDepth < 0) {
            orphanBraceLine = i;
            braceDepth = 0; // reset after removing
          }
        }
      }
    }

    if (orphanBraceLine !== -1) {
      // Remove the orphan `}`
      lines[orphanBraceLine] = lines[orphanBraceLine].replace('}', '');

      // Collect executable statements between last function `}` and the orphan `}`
      // that need to move inside void main()
      const stmtLines: string[] = [];
      for (let i = orphanBraceLine - 1; i >= 0; i--) {
        const trimmed = lines[i].trim();
        if (!trimmed || trimmed.startsWith('//')) continue;
        // Stop at function definition end or other structural boundary
        if (trimmed === '}') break;
        if (trimmed.startsWith('#')) break;

        const isDecl = /^\s*(?:(?:const\s+)?(?:float|vec[234]|mat[234x]*|int|uint|bool|ivec[234]|bvec[234]|uvec[234]|sampler\w*|void)\s)/.test(lines[i]);
        const isExecStmt = !isDecl && /^\s*[a-zA-Z_]\w*\s*(?:[+\-*/]?=|;|\+\+|--)/.test(lines[i]);

        if (isExecStmt) {
          stmtLines.unshift(lines[i]);
          lines[i] = '';
        } else if (isDecl && (/=\s*[a-zA-Z_]\w*\s*\(/.test(trimmed) || /=\s*texture\s*\(/.test(trimmed))) {
          // Declaration with non-constant initializer (function call) — must be inside a function
          stmtLines.unshift(lines[i]);
          lines[i] = '';
        }
        // Normal declarations stay at file scope
      }

      if (stmtLines.length > 0) {
        const beforeMainClean = lines.join('\n');
        const mainBraceIdx = source.indexOf('{', mainPos);
        const afterMainBrace = source.substring(mainBraceIdx + 1);
        source = beforeMainClean + source.substring(mainPos, mainBraceIdx + 1) +
          '\n  // --- moved from shader_body ---\n  ' +
          stmtLines.join('\n  ') + '\n' +
          afterMainBrace;
      } else {
        source = lines.join('\n') + source.substring(mainPos);
      }
    }
  }

  // ── 1. Collect additions to inject before void main() ──
  const mainIdx = source.indexOf('void main()');
  if (mainIdx === -1) return source;

  const beforeMain = source.substring(0, mainIdx);
  const afterMainStart = source.substring(mainIdx);
  const additions: string[] = [];

  // Sampler aliases
  const samplerAliases: [string, string][] = [
    ['sampler_fc_main', 'sampler_main'], ['sampler_pc_main', 'sampler_main'],
    ['sampler_fw_main', 'sampler_main'], ['sampler_pw_main', 'sampler_main'],
    ['sampler_noise_lq_lite', 'sampler_noise_lq'],
    ['sampler_noisevol_lq', 'sampler_noise_lq'], ['sampler_noisevol_hq', 'sampler_noise_hq'],
    ['sampler_FC_main', 'sampler_main'], ['sampler_PC_main', 'sampler_main'],
    ['sampler_FW_main', 'sampler_main'], ['sampler_PW_main', 'sampler_main'],
  ];
  for (const [alias, target] of samplerAliases) {
    if (source.includes(alias) && !beforeMain.includes(`uniform sampler2D ${alias}`) && !beforeMain.includes(`#define ${alias}`)) {
      additions.push(`#define ${alias} ${target}`);
    }
  }

  // q-variable uniforms (q1–q32)
  for (let i = 1; i <= 32; i++) {
    if (new RegExp(`\\bq${i}\\b`).test(source) && !beforeMain.includes(`uniform float q${i};`)) {
      additions.push(`uniform float q${i};`);
    }
  }

  // MilkDrop built-in uniforms
  const builtinUniforms: [string, string][] = [
    ['_c0', 'vec4'], ['_c1', 'vec4'], ['_c2', 'vec4'], ['_c3', 'vec4'],
    ['_c4', 'vec4'], ['_c5', 'vec4'], ['_c6', 'vec4'], ['_c7', 'vec4'],
    ['_c8', 'vec4'], ['_c9', 'vec4'], ['_c10', 'vec4'], ['_c11', 'vec4'],
    ['_c12', 'vec4'], ['_c13', 'vec4'], ['_c14', 'vec4'],
    ['_c15', 'vec4'], ['_c16', 'vec4'], ['_c17', 'vec4'],
    ['_qa', 'vec4'], ['_qb', 'vec4'], ['_qc', 'vec4'], ['_qd', 'vec4'],
    ['_qe', 'vec4'], ['_qf', 'vec4'], ['_qg', 'vec4'], ['_qh', 'vec4'],
    ['rand_frame', 'vec4'], ['rand_preset', 'vec4'],
    ['texsize_noise_lq', 'vec4'], ['texsize_noise_mq', 'vec4'], ['texsize_noise_hq', 'vec4'],
  ];
  for (const [name, type] of builtinUniforms) {
    if (new RegExp(`\\b${name}\\b`).test(source) && !beforeMain.includes(`uniform ${type} ${name}`)) {
      additions.push(`uniform ${type} ${name};`);
    }
  }

  // Rotation matrices
  for (const name of ROT_NAMES) {
    if (new RegExp(`\\b${name}\\b`).test(source) && !beforeMain.includes(`uniform mat4 ${name}`)) {
      additions.push(`uniform mat4 ${name};`);
    }
  }

  // Helper functions
  if (/\blum\s*\(/.test(source) && !beforeMain.includes('float lum(')) {
    additions.push(`float lum(vec3 x) { return dot(x, vec3(0.32, 0.49, 0.29)); }`);
    additions.push(`float lum(vec4 x) { return dot(x.rgb, vec3(0.32, 0.49, 0.29)); }`);
  }
  if (/\bsat\s*\(/.test(source) && !beforeMain.includes('float sat(')) {
    additions.push(`float sat(float x) { return clamp(x, 0.0, 1.0); }`);
    additions.push(`vec2 sat(vec2 x) { return clamp(x, vec2(0.0), vec2(1.0)); }`);
    additions.push(`vec3 sat(vec3 x) { return clamp(x, vec3(0.0), vec3(1.0)); }`);
    additions.push(`vec4 sat(vec4 x) { return clamp(x, vec4(0.0), vec4(1.0)); }`);
  }
  if (/\bnoise3\s*\(/.test(source) && !beforeMain.includes('vec4 noise3(')) {
    additions.push(`vec4 noise3(vec2 uv) { return texture(sampler_noise_lq, uv); }`);
  }
  if (/\bGetMain\s*\(/.test(source) && !beforeMain.includes('vec3 GetMain(')) {
    additions.push(`vec3 GetMain(vec2 uv) { return texture(sampler_main, uv).xyz; }`);
  }
  if (/\bmultiply\s*\(/.test(source) && !beforeMain.includes('vec2 multiply(')) {
    additions.push(`vec2 multiply(vec2 v, mat2 m) { return m * v; }`);
    additions.push(`vec3 multiply(vec3 v, mat3 m) { return m * v; }`);
    additions.push(`vec4 multiply(vec4 v, mat4 m) { return m * v; }`);
  }
  if (/\btextureBias\s*\(/.test(source) && !beforeMain.includes('vec4 textureBias(')) {
    additions.push(`vec4 textureBias(sampler2D s, vec4 uv4) { return textureLod(s, uv4.xy, uv4.w); }`);
  }
  if (/\btexsize\b/.test(afterMainStart) && !beforeMain.includes('#define texsize') && !beforeMain.includes('uniform vec4 texsize')) {
    additions.push(`#define texsize vec4(uTexSize, 1.0/uTexSize)`);
  }
  if (/\bvUvOriginal\b/.test(source) && !beforeMain.includes('in vec2 vUvOriginal')) {
    additions.push(`in vec2 vUvOriginal;`);
  }

  // ── 2. Auto-declare undeclared local variables ──
  let patched = source;
  const mainBodyStart = patched.indexOf('{', patched.indexOf('void main()'));
  if (mainBodyStart !== -1) {
    const beforeBody = patched.substring(0, mainBodyStart + 1);
    let body = patched.substring(mainBodyStart + 1);

    body = body.replace(/#define\s+sat\s+saturate\b/g, '#define sat clamp01');
    body = body.replace(/\bvUv\b(?=\s*(?:[+\-*/]?=|\+\+|--))/g, 'uv');
    body = body.replace(/\bvUvOriginal\b(?=\s*(?:[+\-*/]?=|\+\+|--))/g, 'vUvOriginalLocal');
    body = body.replace(/\bvRadius\b(?=\s*(?:[+\-*/]?=|\+\+|--))/g, 'rad');
    body = body.replace(/\bvAngle\b(?=\s*(?:[+\-*/]?=|\+\+|--))/g, 'ang');

    // Collect declared names
    const declared = new Set<string>();
    const declLineRe = /\b(float|vec[234]|mat[234]|int|bool|ivec[234]|bvec[234])\s+([^;]+);/g;
    let m: RegExpExecArray | null;
    while ((m = declLineRe.exec(patched)) !== null) {
      const type = m[1];
      const declarators = m[2];
      if (declarators.includes('(') && declarators.includes('{')) continue;
      for (const rawDecl of declarators.split(',')) {
        const cleaned = rawDecl.replace(/=.*$/g, '').replace(/\[.*$/g, '').trim().split(/\s+/).pop();
        if (cleaned && cleaned !== type) declared.add(cleaned);
      }
    }

    const builtins = new Set([
      'gl_FragCoord', 'gl_FrontFacing', 'gl_PointCoord',
      'fragColor', 'vUv', 'vUvOriginal', 'vUvOriginalLocal', 'vRadius', 'vAngle', 'uv', 'ret', 'rad', 'ang',
      'uTime', 'uFrame', 'uFps', 'uRms', 'uAspectX', 'uAspectY', 'uAspect', 'uTexSize',
      'uRandomPreset', 'uRandomFrame',
      'audioLow', 'audioLowSmooth', 'audioMid', 'audioMidSmooth', 'audioHigh', 'audioHighSmooth',
      'sampler_main', 'sampler_noise_lq', 'sampler_noise_mq', 'sampler_noise_hq',
      'sampler_blur1', 'sampler_blur2', 'sampler_blur3',
      'GetPixel', 'GetBlur1', 'GetBlur2', 'GetBlur3', 'GetMain',
      'clamp01', 'lum', 'sat', 'noise3', 'multiply',
      'texture', 'clamp', 'mix', 'fract', 'abs', 'sin', 'cos', 'tan', 'atan',
      'pow', 'sqrt', 'log', 'exp', 'floor', 'ceil', 'sign', 'step',
      'smoothstep', 'min', 'max', 'mod', 'dot', 'cross', 'length', 'normalize',
      'distance', 'reflect', 'refract', 'fwidth', 'dFdx', 'dFdy',
      'inversesqrt', 'round', 'trunc', 'degrees', 'radians', 'asin', 'acos',
      'true', 'false', 'if', 'else', 'for', 'while', 'do', 'break', 'continue', 'return', 'discard',
      'void', 'const', 'in', 'out', 'inout', 'uniform', 'precision', 'highp', 'mediump', 'lowp',
      'i', 'j', 'k', 'n', 'x', 'y', 'z', 'w', 'r', 'g', 'b', 'a', 's', 't', 'p',
    ]);
    for (let qi = 1; qi <= 32; qi++) builtins.add(`q${qi}`);
    for (let ci = 0; ci <= 17; ci++) builtins.add(`_c${ci}`);
    ['_qa', '_qb', '_qc', '_qd', '_qe', '_qf', '_qg', '_qh'].forEach(v => builtins.add(v));
    ROT_NAMES.forEach(v => builtins.add(v));
    ['rand_frame', 'rand_preset', 'texsize_noise_lq', 'texsize_noise_mq', 'texsize_noise_hq', 'texsize'].forEach(v => builtins.add(v));

    const assignRe = /^[ \t]*([a-zA-Z_]\w*)\s*=[^=]/gm;
    const undeclared = new Set<string>();
    let am: RegExpExecArray | null;
    while ((am = assignRe.exec(body)) !== null) {
      const vname = am[1];
      if (!declared.has(vname) && !builtins.has(vname) && !undeclared.has(vname)) {
        const lineStart = body.lastIndexOf('\n', am.index);
        const lineBefore = body.substring(lineStart + 1, am.index).trim();
        if (!lineBefore.includes('.')) undeclared.add(vname);
      }
    }

    if (undeclared.size > 0) {
      const decls: string[] = ['  // Auto-declared MilkDrop variables'];
      for (const vname of undeclared) {
        const usageRe = new RegExp(`\\b${vname}\\b\\s*=[^=]*`, 'g');
        const candidates: string[] = [];
        let um: RegExpExecArray | null;
        while ((um = usageRe.exec(body)) !== null) {
          const rhs = um[0];
          if (/=\s*vec2\s*\(/.test(rhs)) candidates.push('vec2');
          else if (/=\s*vec3\s*\(/.test(rhs) || /=\s*GetPixel|=\s*GetBlur|=\s*GetMain/.test(rhs)) candidates.push('vec3');
          else if (/=\s*vec4\s*\(/.test(rhs) || /=\s*texture\s*\(/.test(rhs)) candidates.push('vec4');
          else if (/=\s*mat[23]\s*\(/.test(rhs)) candidates.push(rhs.match(/mat[23]/)?.[0] ?? 'float');
          else candidates.push('float');
        }
        // Check swizzle LHS: var.xyz = ... → vec3
        const lhsRe = new RegExp(`\\b${vname}\\.(xy|xyz|xyzw|rg|rgb|rgba)\\s*=`, 'g');
        let lhsMatch: RegExpExecArray | null;
        let needsVec = 0;
        while ((lhsMatch = lhsRe.exec(body)) !== null) {
          needsVec = Math.max(needsVec, lhsMatch[1].length);
        }
        let type = 'float';
        const vecCandidates = candidates.filter(c => c.startsWith('vec') || c.startsWith('mat'));
        if (vecCandidates.length > 0) type = vecCandidates[0];
        if (needsVec >= 4) type = 'vec4';
        else if (needsVec >= 3 && type === 'float') type = 'vec3';
        else if (needsVec >= 2 && type === 'float') type = 'vec2';
        // Check swizzle RHS: ... = var.xyz → vec3
        if (type === 'float') {
          const rhsRe = new RegExp(`\\b${vname}\\.(xy|xyz|xyzw|rg|rgb|rgba)\\b`);
          const rhsMatch = rhsRe.exec(body);
          if (rhsMatch && candidates.every(c => c !== 'float')) {
            const n = rhsMatch[1].length;
            if (n >= 4) type = 'vec4';
            else if (n >= 3) type = 'vec3';
            else if (n >= 2) type = 'vec2';
          }
        }
        decls.push(`  ${type} ${vname} = ${type === 'float' ? '0.0' : type + '(0.0)'};`);
      }
      body = '\n' + decls.join('\n') + '\n' + body;
    }

    // ── 3. Boolean NOT on floats: !varname → (varname == 0.0 ? 1.0 : 0.0) ──
    body = body.replace(/(?<![!=<>])!([a-zA-Z_]\w*)(?!\s*=)/g, '($1 == 0.0 ? 1.0 : 0.0)');

    patched = beforeBody + body;
  }

  // ── 4. Insert additions before void main() ──
  if (additions.length > 0) {
    const insertPoint = patched.indexOf('void main()');
    patched = patched.substring(0, insertPoint) +
      '// --- MilkDrop runtime patches ---\n' +
      additions.join('\n') + '\n\n' +
      patched.substring(insertPoint);
  }

  // ── 5. Fix uTexSize swizzle (uTexSize is vec2; MilkDrop expects vec4) ──
  patched = patched.replace(/\buTexSize\.zw\b/g, '(vec2(1.0)/uTexSize)');
  patched = patched.replace(/\buTexSize\.z\b/g, '(1.0/uTexSize.x)');
  patched = patched.replace(/\buTexSize\.w\b/g, '(1.0/uTexSize.y)');
  patched = patched.replace(/\buTexSize\.xyzw\b/g, 'vec4(uTexSize, 1.0/uTexSize)');

  return patched;
};

// ═══════════════════════════════════════════════════════════════════════════
// Phase 2: AST transforms
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Phase 2: AST-based type fixes.
 * Parses preprocessed GLSL, applies structural transforms, regenerates source.
 */
const astTransform = (source: string): string => {
  const ast = parse(source, { stage: 'fragment', quiet: true });

  // ── Pass 1: int_constant → float_constant ──
  // GLSL ES 3.00 has no implicit int→float promotion.
  visit(ast, {
    int_constant: {
      enter: (p) => {
        if (isInIntContext(p)) return;
        const floatNode: FloatConstantNode = {
          type: 'float_constant',
          token: p.node.token + '.0',
          whitespace: p.node.whitespace,
        };
        p.replaceWith(floatNode as unknown as AstNode);
      },
    },
  });

  // ── Pass 2: Fix GetPixel/GetBlur return types from vec4 to vec3 ──
  visit(ast, {
    function: {
      enter: (p) => {
        const fn = p.node as FunctionNode;
        const name = fn.prototype.header.name.identifier;
        if (!/^(GetPixel|GetBlur[123])$/.test(name)) return;

        // Change return type: vec4 → vec3
        const retSpec = fn.prototype.header.returnType.specifier.specifier;
        if (retSpec.type === 'keyword' && retSpec.token === 'vec4') {
          (retSpec as any).token = 'vec3';
        }

        // Add .xyz to any texture() call in the return statement
        visit(fn, {
          return_statement: {
            enter: (rp) => {
              const retStmt = rp.node as ReturnStatementNode;
              if (retStmt.expression.type === 'function_call') {
                const callName = getFnName(retStmt.expression as FunctionCallNode);
                if (callName === 'texture') {
                  (retStmt as any).expression = mkPostfixSwizzle(retStmt.expression, 'xyz');
                }
              }
            },
          },
        });
      },
    },
  });

  // ── Pass 3: texture() → texture().xyz in vec3 contexts ──
  visit(ast, {
    function_call: {
      enter: (p) => {
        const name = getFnName(p.node);
        if (name !== 'texture' && name !== 'textureLod' && name !== 'textureBias') return;

        // Skip if already has a postfix (.xyz, .rgb, etc.)
        if (p.parent?.type === 'postfix') return;

        // Check enclosing assignment dimension
        const dim = findEnclosingAssignmentDim(p);
        if (dim === 3) {
          p.replaceWith(mkPostfixSwizzle(p.node as unknown as AstNode, 'xyz') as unknown as AstNode);
        } else if (dim === 2) {
          p.replaceWith(mkPostfixSwizzle(p.node as unknown as AstNode, 'xy') as unknown as AstNode);
        }
        // dim===4 or unknown: leave as-is
      },
    },
  });

  // ── Pass 4: vec4 ret → vec3 ret ──
  visit(ast, {
    declarator_list: {
      enter: (p) => {
        const kw = getTypeKeyword(p.node);
        if (kw !== 'vec4') return;
        const decls = p.node.declarations;
        if (decls.length === 1 && decls[0].identifier.identifier === 'ret') {
          const spec = p.node.specified_type.specifier.specifier;
          if (spec.type === 'keyword') (spec as any).token = 'vec3';
          // Fix initializer: vec4(0.0) → vec3(0.0)
          const init = decls[0].initializer;
          if (init?.type === 'function_call') {
            const initName = getFnName(init as FunctionCallNode);
            if (initName === 'vec4') {
              const initId = (init as FunctionCallNode).identifier;
              if (initId.type === 'type_specifier') {
                const initSpec = initId.specifier;
                if (initSpec.type === 'keyword') (initSpec as any).token = 'vec3';
              }
            }
          }
        }
      },
    },
  });

  // ── Pass 5: fragColor = ret → fragColor = vec4(ret, 1.0) ──
  visit(ast, {
    assignment: {
      enter: (p) => {
        const left = p.node.left;
        if (left.type !== 'identifier' || (left as IdentifierNode).identifier !== 'fragColor') return;
        const right = p.node.right;
        if (right.type !== 'identifier' || (right as IdentifierNode).identifier !== 'ret') return;

        // Replace right side: ret → vec4(ret, 1.0)
        (p.node as any).right = mkFnCall('vec4', [
          mkIdentifier('ret', ' '),
          mkLiteral(','),
          mkFloat('1.0', ' '),
        ]);
      },
    },
  });

  // ── Pass 6: pow(vec_expr, scalar_literal) → pow(vec_expr, vec3(scalar_literal)) ──
  visit(ast, {
    function_call: {
      enter: (p) => {
        const name = getFnName(p.node);
        if (name !== 'pow') return;
        const args = getArgs(p.node);
        if (args.length !== 2) return;
        const [first, second] = args;
        const firstDim = inferDim(first);
        const secondDim = inferDim(second);
        if (firstDim >= 2 && secondDim === 1) {
          // Wrap second arg in vec constructor matching first's dimension
          const vecType = `vec${firstDim}`;
          // Find the second arg in p.node.args and replace it
          const allArgs = p.node.args;
          for (let i = 0; i < allArgs.length; i++) {
            if (allArgs[i] === second) {
              allArgs[i] = mkFnCall(vecType, [second]) as unknown as AstNode;
              break;
            }
          }
        }
      },
    },
  });

  // ── Pass 7: min/max(scalar, vec) → min/max(vec, scalar) ──
  // GLSL ES has min/max(genType, float) but NOT min/max(float, genType).
  visit(ast, {
    function_call: {
      enter: (p) => {
        const name = getFnName(p.node);
        if (name !== 'min' && name !== 'max') return;
        const args = getArgs(p.node);
        if (args.length !== 2) return;
        const [first, second] = args;
        const firstDim = inferDim(first);
        const secondDim = inferDim(second);
        if (firstDim === 1 && secondDim >= 2) {
          // Swap args in the raw args array (preserving comma literals)
          const allArgs = p.node.args;
          const firstIdx = allArgs.indexOf(first);
          const secondIdx = allArgs.indexOf(second);
          if (firstIdx !== -1 && secondIdx !== -1) {
            allArgs[firstIdx] = second;
            allArgs[secondIdx] = first;
          }
        }
      },
    },
  });

  // ── Pass 8: ret = scalar_fn(...) → ret = vec3(scalar_fn(...)) ──
  // e.g. ret = lum(ret); → ret = vec3(lum(ret));
  visit(ast, {
    assignment: {
      enter: (p) => {
        const left = p.node.left;
        if (left.type !== 'identifier') return;
        const varName = (left as IdentifierNode).identifier;
        if (!VEC3_VARS.has(varName)) return;

        const right = p.node.right;
        const rightDim = inferDim(right);
        if (rightDim === 1) {
          // Wrap in vec3()
          (p.node as any).right = mkFnCall('vec3', [right], ' ') as unknown as AstNode;
        }
      },
    },
  });

  return generate(ast);
};

// ═══════════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════════

export const patchMilkDropGlsl = (source: string): string => {
  if (!source || !source.includes('#version 300 es')) return source;

  // Phase 1: String preprocessing
  const preprocessed = preprocess(source);

  // Phase 2: AST transforms
  return astTransform(preprocessed);
};
