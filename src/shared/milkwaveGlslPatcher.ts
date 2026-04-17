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
    if (spec.type === 'type_name') return spec.identifier;
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

type DimLookup = ReadonlyMap<string, number>;

/** Known scalar-returning function names. */
const SCALAR_FNS = new Set([
  'lum', 'dot', 'length', 'distance', 'float',
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan',
  'degrees', 'radians', 'round', 'trunc',
]);

/** Functions whose output dimension follows their first argument. */
const PRESERVE_FIRST_ARG_DIM_FNS = new Set([
  'abs', 'sign', 'floor', 'ceil', 'fract',
  'sqrt', 'inversesqrt', 'log', 'exp',
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan',
  'sat', 'clamp01', 'pow',
]);

/** Functions whose output dimension follows the largest vector argument. */
const PRESERVE_MAX_ARG_DIM_FNS = new Set([
  'mod', 'min', 'max', 'clamp', 'step', 'smoothstep',
]);

/** Infer the vec dimensionality of an expression. Returns 1/2/3/4 or 0 if unknown. */
const inferDim = (node: AstNode, declaredDims?: DimLookup): number => {
  if (node.type === 'float_constant' || node.type === 'int_constant' || node.type === 'double_constant') return 1;

  if (node.type === 'identifier') {
    const name = (node as IdentifierNode).identifier;
    const declared = declaredDims?.get(name);
    if (declared) return declared;
    if (VEC3_VARS.has(name)) return 3;
    if (name === 'uv' || name === 'vUv') return 2;
    if (name === 'fragColor') return 4;
    return 0;
  }

  if (node.type === 'function_call') {
    const fn = getFnName(node as FunctionCallNode);
    const args = getArgs(node as FunctionCallNode);
    if (fn === 'texture' || fn === 'textureLod' || fn === 'textureBias') return 4;
    if (fn === 'vec2') return 2;
    if (fn === 'vec3') return 3;
    if (fn === 'vec4') return 4;
    if (fn === 'GetPixel' || fn === 'GetBlur1' || fn === 'GetBlur2' || fn === 'GetBlur3' || fn === 'GetMain') return 3;
    if (fn === 'GetBlurX') return 3;
    if (fn === 'noise3') return 4;
    if (PRESERVE_FIRST_ARG_DIM_FNS.has(fn)) {
      return args.length > 0 ? inferDim(args[0], declaredDims) : 0;
    }
    if (PRESERVE_MAX_ARG_DIM_FNS.has(fn)) {
      return args.reduce((maxDim, arg) => Math.max(maxDim, inferDim(arg, declaredDims)), 0);
    }
    if (fn === 'mix') {
      // mix preserves the dimensionality of its first arg
      return args.length > 0 ? inferDim(args[0], declaredDims) : 0;
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
    return inferDim((node as PostfixNode).expression, declaredDims);
  }

  if (node.type === 'binary') {
    const left = inferDim((node as BinaryNode).left, declaredDims);
    const right = inferDim((node as BinaryNode).right, declaredDims);
    return Math.max(left, right);
  }

  if (node.type === 'unary') {
    return inferDim((node as UnaryNode).expression, declaredDims);
  }

  if (node.type === 'group') {
    return inferDim((node as GroupNode).expression, declaredDims);
  }

  if (node.type === 'assignment') {
    return inferDim((node as AssignmentNode).left, declaredDims);
  }

  return 0;
};

/**
 * Find the enclosing statement's LHS to determine vec context.
 * Returns the inferred dimension of the assignment target, or 0 if unknown.
 */
const findEnclosingAssignmentDim = (p: Path<any>, declaredDims?: DimLookup): number => {
  let ctx: Path<any> | undefined = p;
  while (ctx) {
    const n = ctx.node;
    if (n.type === 'assignment') {
      return inferDim((n as AssignmentNode).left, declaredDims);
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

const getVecDimFromKeyword = (kw: string): number => {
  if (kw === 'float') return 1;
  if (kw === 'vec2') return 2;
  if (kw === 'vec3') return 3;
  if (kw === 'vec4') return 4;
  return 0;
};

const wrapScalarForDim = (node: AstNode, dim: number): AstNode => {
  if (dim <= 1) return node;
  return mkFnCall(`vec${dim}`, [node]) as unknown as AstNode;
};

const collectDeclaredDims = (ast: Program): Map<string, number> => {
  const declaredDims = new Map<string, number>();
  visit(ast, {
    declarator_list: {
      enter: (p) => {
        const dim = getVecDimFromKeyword(getTypeKeyword(p.node));
        if (dim === 0) return;
        for (const decl of p.node.declarations) {
          declaredDims.set(decl.identifier.identifier, dim);
        }
      },
    },
  });
  return declaredDims;
};

const sanitizeAstArrays = (node: unknown): void => {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (let i = node.length - 1; i >= 0; i--) {
      if (node[i] == null) node.splice(i, 1);
      else sanitizeAstArrays(node[i]);
    }
    return;
  }
  for (const value of Object.values(node as Record<string, unknown>)) {
    sanitizeAstArrays(value);
  }
};

const getConstructorDimForSwizzle = (swizzle: string): number => {
  const componentDim = [...swizzle].reduce((maxDim, component) => {
    if (component === 'x' || component === 'r') return Math.max(maxDim, 1);
    if (component === 'y' || component === 'g') return Math.max(maxDim, 2);
    if (component === 'z' || component === 'b') return Math.max(maxDim, 3);
    if (component === 'w' || component === 'a') return Math.max(maxDim, 4);
    return maxDim;
  }, 0);
  return Math.max(componentDim, swizzle.length);
};

const normalizeDanglingStatementCommas = (source: string): string => {
  const lines = source.split('\n');
  let parenDepth = 0;

  return lines.map((line) => {
    const code = line.replace(/\/\/.*$/, '');
    let lineEndParenDepth = parenDepth;
    for (const ch of code) {
      if (ch === '(') lineEndParenDepth++;
      else if (ch === ')') lineEndParenDepth = Math.max(0, lineEndParenDepth - 1);
    }

    const trimmed = code.trim();
    const shouldConvertTrailingComma =
      parenDepth === 0 &&
      lineEndParenDepth === 0 &&
      /,\s*$/.test(trimmed) &&
      /(=|[+\-*/]=|\breturn\b)/.test(trimmed) &&
      !/^\s*(?:const\s+)?(?:float|vec[234]|mat[234x]*|int|uint|bool|ivec[234]|uvec[234]|bvec[234])\b/.test(trimmed);

    parenDepth = lineEndParenDepth;

    if (!shouldConvertTrailingComma) return line;
    return line.replace(/,\s*$/, ';');
  }).join('\n');
};

const closeUnbalancedMainBlocks = (source: string): string => {
  const mainIdx = source.indexOf('void main()');
  if (mainIdx === -1) return source;
  const mainBraceIdx = source.indexOf('{', mainIdx);
  if (mainBraceIdx === -1) return source;
  const fragColorIdx = source.lastIndexOf('fragColor');
  if (fragColorIdx === -1 || fragColorIdx <= mainBraceIdx) return source;

  const segment = source.slice(mainBraceIdx + 1, fragColorIdx);
  let braceDepth = 1;
  for (const ch of segment) {
    if (ch === '{') braceDepth++;
    else if (ch === '}') braceDepth = Math.max(0, braceDepth - 1);
  }

  if (braceDepth <= 1) return source;
  const missingClosers = '}\n'.repeat(braceDepth - 1);
  return source.slice(0, fragColorIdx) + missingClosers + source.slice(fragColorIdx);
};

const stripRawTextLines = (source: string): string =>
  source
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) return true;
      if (trimmed.startsWith('#')) return true;
      const isRawText =
        !/[;{}()=+\-*/<>!&|,#]/.test(trimmed) &&
        !/^\s*(float|vec|mat|int|uint|bool|void|uniform|in|out|const|precision|layout)\b/.test(trimmed);
      return !isRawText;
    })
    .join('\n');

const repairTruncatedMixCalls = (source: string): string =>
  source.replace(/\bmix\s*\(([\s\S]*?),\s*([\s\S]*?),\s*\)/g, (_match, a: string, b: string) => {
    const first = a.trim();
    const second = b.trim();
    if (!first || !second) return _match;
    if (/[;{}]$/.test(first) || /[;{}]$/.test(second)) return _match;
    return `mix(${a},${b}, 0.5)`;
  });

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
  // HLSL `sampler` declarations (e.g., `sampler sampler_rand00 = ;` or `sampler sampler_rand00;`)
  source = source.replace(/\bsampler\s+[^;]+;/g, '');
  // Local GLSL sampler declarations from imported presets are not valid inside shader bodies.
  source = source.replace(/^\s*sampler(?:2D|3D|Cube)?\s+\w+\s*;.*$/gm, '');
  source = source.replace(/^\s*vec4\s+texsize_[a-zA-Z0-9_]+\s*;.*$/gm, '');
  // HLSL semantics (`: COLOR0`, `: SV_TARGET`, etc.)
  source = source.replace(/\)\s*:\s*[A-Z_][A-Z0-9_]*/g, ')');
  // HLSL `tex3D()` → `texture()`
  source = source.replace(/\btex3D\b/g, 'texture');
  // HLSL `tex2D()` / `tex2d()` → `texture()`
  source = source.replace(/\btex2[Dd]\b/g, 'texture');
  // HLSL `tex2Dbias()` → `textureBias()`
  source = source.replace(/\btex2[Dd]bias\b/g, 'textureBias');
  // Line continuations: `\` at end of line followed by newline → join lines
  source = source.replace(/\\\s*\n/g, ' ');
  // Imported shaders sometimes preserve unary `+` after a multiplication token.
  source = source.replace(/\*\s*\+/g, '* ');
  // `smooth` is a GLSL reserved keyword — rename if used as variable
  source = source.replace(/\bfloat\s+smooth\b/g, 'float smooth_');
  source = source.replace(/\bsmooth\s*(?=[+\-*/=;,)])/g, 'smooth_');
  // Mixed-type comma declarations: `float x, y,\nvec2 a, b;` → split with `;`
  source = source.replace(/,\s*\n\s*(vec[234]|mat[234x]*|float|int|uint|bool|ivec[234]|bvec[234]|uvec[234])\s/g, ';\n$1 ');
  source = normalizeDanglingStatementCommas(source);

  // ── 0b. Strip shader_body keyword everywhere ──
  source = source.replace(/\bshader_body\b/g, '');
  // Legacy offline-generated aliases mapped volume samplers to 2D noise samplers.
  // The runtime now binds real 3D textures, so these defines must be removed.
  source = source.replace(/^\s*#define\s+sampler_noisevol_lq\s+sampler_noise_lq\s*$/gm, '');
  source = source.replace(/^\s*#define\s+sampler_noisevol_hq\s+sampler_noise_hq\s*$/gm, '');

  // ── 0c. Strip double semicolons (empty statements not valid at file scope) ──
  source = source.replace(/;;/g, ';');

  // Helper colors are vec3 in the runtime. Legacy generated shaders sometimes swizzle only one
  // side of color arithmetic down to .xy, which creates vec3/vec2 mismatches in WebGL2.
  source = source.replace(
    /(\b(?:GetPixel|GetMain|GetBlur[123])\((?:[^()]|\([^()]*\))*\)\s*[-+]\s*\b(?:GetPixel|GetMain|GetBlur[123])\((?:[^()]|\([^()]*\))*\))\.xy/g,
    '$1'
  );
  source = source.replace(
    /(\b(?:GetPixel|GetMain|GetBlur[123])\((?:[^()]|\([^()]*\))*\)\s*\+\s*\b(?:GetPixel|GetMain|GetBlur[123])\((?:[^()]|\([^()]*\))*\))\.xy/g,
    '$1'
  );
  source = source.replace(
    /(\bclamp01\s*\([^()\n]*\b(?:GetPixel|GetMain|GetBlur[123])\((?:[^()]|\([^()]*\))*\))\.xy/g,
    '$1'
  );
  source = source.replace(
    /(\bdot\s*\([^,\n]+,\s*[^()\n]*\b(?:GetPixel|GetMain|GetBlur[123])\((?:[^()]|\([^()]*\))*\))\.xy/g,
    '$1'
  );
  source = source.replace(
    /(\b(?:texture(?:Lod)?\s*\((?:[^()]|\([^()]*\))*\)|GetPixel\((?:[^()]|\([^()]*\))*\)|GetMain\((?:[^()]|\([^()]*\))*\)|GetBlur[123]\((?:[^()]|\([^()]*\))*\))\s*[-+]\s*GetPixel\((?:[^()]|\([^()]*\))*\))\.xy/g,
    '$1'
  );
  source = source.replace(
    /([*+\-/]\s*)(\b(?:GetPixel|GetMain|GetBlur[123])\((?:[^()]|\([^()]*\))*\))\.xy\b/g,
    '$1$2'
  );
  source = source.replace(/\bpow\s*\(\s*ret\s*,\s*([^)]+)\)/g, 'pow(ret, vec3($1))');
  source = source.replace(/\bpow\s*\(\s*abs\(([^()]*\b(?:GetPixel|GetMain|GetBlur[123])\([^)]*\)[^()]*)\)\s*,\s*([^)]+)\)/g, 'pow(abs($1), vec3($2))');
  source = source.replace(/\bvec3\s*\(\s*pow\(\s*([^\n]*)\s*,\s*([0-9.]+)\s*\)\s*\)/g, 'pow($1, vec3($2))');
  source = source.replace(
    /ret\s*=\s*vec3\s*\(\s*pow\s*\(\s*abs\(([^;\n]+)\)\s*\*\s*1\.0\s*,\s*1\.0\s*\)\s*\)\s*;/g,
    'ret = pow(abs($1) * 1.0, vec3(1.0));'
  );
  source = repairTruncatedMixCalls(source);
  source = source.replace(/\bsand\s*\*=\s*([a-zA-Z_]\w*)\s*;/g, 'sand *= lum($1);');
  source = source.replace(/\bsand\s*\+=\s*(Get(?:Pixel|Main|Blur[123])\((?:[^()]|\([^()]*\))*\))\s*;/g, 'sand += lum($1);');
  source = source.replace(
    /(?<![\w.)])(-?(?:\d+\.\d+|\d+\.\d*|\d+|\.\d+))\s*\.(xyzw|rgba|xyz|rgb|xy|rg|x|y|z|w|r|g|b|a)\b/g,
    (_match, literal, swizzle: string) => {
      const dim = getConstructorDimForSwizzle(swizzle);
      return dim === 1 ? literal : `vec${dim}(${literal}).${swizzle}`;
    }
  );
  source = source.replace(
    /(?<![\w])\(\s*(-?(?:\d+\.\d+|\d+\.\d*|\d+|\.\d+))\s*\)\s*\.(xyzw|rgba|xyz|rgb|xy|rg|x|y|z|w|r|g|b|a)\b/g,
    (_match, literal, swizzle: string) => {
      const dim = getConstructorDimForSwizzle(swizzle);
      return dim === 1 ? literal : `vec${dim}(${literal}).${swizzle}`;
    }
  );
  source = source.replace(/\b(vec[234])\s*\(\s*\1\s*\(([^()]*)\)\s*\)/g, '$1($2)');

  const mainIdxPre = source.indexOf('void main()');
  if (mainIdxPre !== -1) {
    // ── 0d. Before void main(): handle orphan shader_body content ──
    // The transpiler emits shader_body content at file scope. We need to:
    //  1. Keep declarations and function definitions at file scope
    //  2. Move everything else (exec stmts, control flow, orphan braces) into main()
    //  3. Remove nested function definitions inside main() (GLSL forbids them)
    //
    // The moved content goes BEFORE the fragColor line in main(), because the
    // orphan `}` often closes an unclosed for/while loop inside main().

    const beforeMain = source.substring(0, mainIdxPre);
    const bmLines = beforeMain.split('\n');

    // Phase A: Classify each line before main()
    // Track brace depth; at depth 0 we can distinguish declarations vs exec stmts
    let depth = 0;
    const keepLines: string[] = [];
    const moveLines: string[] = [];
    let inFuncDef = false;   // inside a function definition body
    let inBareBlock = false; // inside a bare { } block (orphan shader_body)
    let inArrayInit = false; // inside a `const type name[] = { ... }` initializer
    let prevKeptLineEndsWithSemicolon = true; // tracks multi-line continuations

    for (let i = 0; i < bmLines.length; i++) {
      const line = bmLines[i];
      const trimmed = line.trim();

      // Calculate brace delta for this line
      let delta = 0;
      for (const ch of trimmed) {
        if (ch === '{') delta++;
        else if (ch === '}') delta--;
      }

      // Handle being inside a function definition body
      if (inFuncDef) {
        keepLines.push(line);
        depth += delta;
        if (depth <= 0) { inFuncDef = false; depth = 0; }
        continue;
      }

      // Handle being inside an array initializer `const type name[] = { ... }`
      if (inArrayInit) {
        keepLines.push(line);
        depth += delta;
        if (depth <= 0) { inArrayInit = false; depth = 0; }
        continue;
      }

      // Handle being inside a bare { ... } block (orphan shader_body)
      if (inBareBlock) {
        moveLines.push(line);
        depth += delta;
        if (depth <= 0) { inBareBlock = false; depth = 0; }
        continue;
      }

      // At depth 0: classify the line
      if (depth === 0) {
        // Detect orphan `}` — brace underflow
        if (depth + delta < 0) {
          moveLines.push(line);
          depth = 0;
          continue;
        }

        // Multi-line continuation: if previous kept line didn't end with `;`, `{`, `}`,
        // `)`, or a comment/preprocessor, this line continues it → keep
        if (!prevKeptLineEndsWithSemicolon && trimmed) {
          keepLines.push(line);
          depth += delta;
          if (trimmed.endsWith(';') || trimmed.endsWith('}') || trimmed.endsWith('{')) {
            prevKeptLineEndsWithSemicolon = true;
          }
          continue;
        }

        // Detect bare `{` — could be shader_body block or array initializer
        if (trimmed === '{') {
          // Check if previous kept line is a declaration with `= {` (array init)
          const prevKept = keepLines.length > 0 ? keepLines[keepLines.length - 1].trim() : '';
          if (/=\s*$/.test(prevKept) || /\[\d*\]\s*=\s*$/.test(prevKept)) {
            // Array initializer — keep
            keepLines.push(line);
            depth += delta;
            inArrayInit = true;
            continue;
          }
          // Otherwise it's a shader_body block (or control flow) — move
          moveLines.push(line);
          depth += delta;
          inBareBlock = true;
          continue;
        }

        // Check if this is a valid file-scope construct
        const isTypeDecl = /^\s*(?:(?:const\s+)?(?:flat\s+)?(?:float|vec[234]|mat[234x]*|int|uint|bool|ivec[234]|bvec[234]|uvec[234]|sampler\w*)\s)/.test(line);
        const isFuncDef = isTypeDecl && /\)\s*\{/.test(trimmed);
        const isVoidFuncDef = /^\s*void\s+[a-zA-Z_]\w*\s*\([^)]*\)\s*\{/.test(trimmed);
        const isPreprocessor = trimmed.startsWith('#');
        const isUniform = /^\s*(?:uniform|in|out|precision|layout)\s/.test(line);
        const isEmpty = !trimmed;
        const isComment = trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*');
        // Raw text (not code): no semicolons, no operators, no parens — strip
        const isRawText = trimmed.length > 0 && !isEmpty && !isComment && !isPreprocessor &&
          !/[;{}()=+\-*/<>!&|,#]/.test(trimmed) && !/^\s*(float|vec|mat|int|uint|bool|void|uniform|in|out|const|precision|layout)\b/.test(trimmed);

        if (isRawText) {
          // Plain text like "written by martin", "END" — discard
          continue;
        }

        if (isFuncDef || isVoidFuncDef) {
          keepLines.push(line);
          depth += delta;
          if (depth > 0) inFuncDef = true;
          prevKeptLineEndsWithSemicolon = true;
          continue;
        }

        // Function declaration on this line, `{` on next line
        const isFuncProto = /^\s*(?:(?:const\s+)?(?:float|vec[234]|mat[234x]*|int|uint|bool|ivec[234]|bvec[234]|uvec[234]|void)\s+[a-zA-Z_]\w*\s*\([^)]*\)\s*$)/.test(trimmed);
        if (isFuncProto && (bmLines[i + 1] || '').trim().startsWith('{')) {
          keepLines.push(line);
          depth += delta;
          inFuncDef = true;
          prevKeptLineEndsWithSemicolon = true;
          continue;
        }

        // Type declaration with `= {` (array initializer start)
        if (isTypeDecl && /=\s*\{/.test(trimmed)) {
          keepLines.push(line);
          depth += delta;
          if (depth > 0) inArrayInit = true;
          prevKeptLineEndsWithSemicolon = trimmed.endsWith(';') || trimmed.endsWith('}');
          continue;
        }

        if (isTypeDecl || isPreprocessor || isUniform || isEmpty || isComment) {
          keepLines.push(line);
          depth += delta;
          if (trimmed.endsWith(';') || trimmed.endsWith('}') || isEmpty || isComment || isPreprocessor) {
            prevKeptLineEndsWithSemicolon = true;
          } else {
            prevKeptLineEndsWithSemicolon = false;
          }
        } else {
          // Executable statement or control flow at file scope — move to main()
          moveLines.push(line);
          depth += delta;
          if (delta > 0) inBareBlock = true;
        }
      } else {
        // depth > 0 but not in funcDef, arrayInit, or bareBlock — should not happen
        moveLines.push(line);
        depth += delta;
        if (depth <= 0) depth = 0;
      }
    }

    // Phase B: Reconstruct source
    let afterMain = source.substring(mainIdxPre);

    if (moveLines.length > 0) {
      // Insert moved content into main() before the fragColor line
      const fragColorIdx = afterMain.lastIndexOf('fragColor');
      if (fragColorIdx !== -1) {
        const insertContent = '\n  // --- moved from shader_body ---\n' +
          moveLines.map(l => '  ' + l).join('\n') + '\n';
        afterMain = afterMain.substring(0, fragColorIdx) +
          insertContent +
          afterMain.substring(fragColorIdx);
      }
    }

    source = normalizeDanglingStatementCommas(keepLines.join('\n') + '\n' + afterMain);
    source = source.replace(/(\n\s*\/\/ --- moved from shader_body ---\n)\s*\{\s*\n/g, '$1');
    source = source.replace(
      /(\n\s*\/\/ --- moved from shader_body ---[\s\S]*?)\s*}\s*(?:\/\/[^\n]*)?\n(\s*fragColor\s*=)/g,
      '$1\n$2'
    );

    // ── 0e. Inside void main(): remove nested function definitions ──
    // GLSL doesn't allow function definitions inside other functions.
    // The transpiler duplicates file-scope functions inside main().
    const mainPos = source.indexOf('void main()');
    const mainBrace = source.indexOf('{', mainPos);
    if (mainBrace !== -1) {
      const beforeMainBody = source.substring(0, mainBrace + 1);
      let body = source.substring(mainBrace + 1);

      // Find and remove function definitions inside main
      const bodyLines = body.split('\n');
      const cleanBodyLines: string[] = [];
      let bodyDepth = 0;
      let inNestedFunc = false;
      let nestedFuncDepth = 0;

      for (let i = 0; i < bodyLines.length; i++) {
        const trimmed = bodyLines[i].trim();

        if (inNestedFunc) {
          for (const ch of trimmed) {
            if (ch === '{') bodyDepth++;
            else if (ch === '}') bodyDepth--;
          }
          if (bodyDepth <= nestedFuncDepth) {
            inNestedFunc = false;
          }
          continue;
        }

        // Detect function definition: type name(params) {
        const funcDefRe = /^\s*(?:float|vec[234]|mat[234x]*|int|uint|bool|ivec[234]|bvec[234]|uvec[234]|void)\s+[a-zA-Z_]\w*\s*\([^)]*\)\s*\{/;
        const funcDeclRe = /^\s*(?:float|vec[234]|mat[234x]*|int|uint|bool|ivec[234]|bvec[234]|uvec[234]|void)\s+[a-zA-Z_]\w*\s*\([^)]*\)\s*$/;

        if (funcDefRe.test(trimmed)) {
          inNestedFunc = true;
          nestedFuncDepth = bodyDepth;
          for (const ch of trimmed) {
            if (ch === '{') bodyDepth++;
            else if (ch === '}') bodyDepth--;
          }
          if (bodyDepth <= nestedFuncDepth) inNestedFunc = false;
          continue;
        }

        if (funcDeclRe.test(trimmed)) {
          const nextTrimmed = (bodyLines[i + 1] || '').trim();
          if (nextTrimmed.startsWith('{')) {
            inNestedFunc = true;
            nestedFuncDepth = bodyDepth;
            i++;
            for (const ch of (bodyLines[i] || '')) {
              if (ch === '{') bodyDepth++;
              else if (ch === '}') bodyDepth--;
            }
            if (bodyDepth <= nestedFuncDepth) inNestedFunc = false;
            continue;
          }
        }

        for (const ch of trimmed) {
          if (ch === '{') bodyDepth++;
          else if (ch === '}') bodyDepth--;
        }

        cleanBodyLines.push(bodyLines[i]);
      }

      source = beforeMainBody + cleanBodyLines.join('\n');
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
    ['sampler_FC_main', 'sampler_main'], ['sampler_PC_main', 'sampler_main'],
    ['sampler_FW_main', 'sampler_main'], ['sampler_PW_main', 'sampler_main'],
    ['sampler_rand01', 'sampler_noise_lq'], ['sampler_rand02', 'sampler_noise_mq'],
    ['sampler_rand03', 'sampler_noise_hq'], ['sampler_rand04', 'sampler_noise_lq'],
  ];
  for (const [alias, target] of samplerAliases) {
    if (source.includes(alias) && !beforeMain.includes(`uniform sampler2D ${alias}`) && !beforeMain.includes(`#define ${alias}`)) {
      additions.push(`#define ${alias} ${target}`);
    }
  }

  // MilkDrop built-in constants
  const builtinConstants: [string, string][] = [
    ['M_PI', '3.14159265359'],
    ['M_PI_2', '1.57079632679'],
    ['M_INV_PI_2', '0.63661977236'],
    ['PI', '3.14159265359'],
    ['PI_2', '1.57079632679'],
  ];
  for (const [name, val] of builtinConstants) {
    if (new RegExp(`\\b${name}\\b`).test(source) && !beforeMain.includes(`#define ${name}`)) {
      additions.push(`#define ${name} ${val}`);
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
    ['sampler_noisevol_lq', 'highp sampler3D'], ['sampler_noisevol_hq', 'highp sampler3D'],
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
  if (/\bhue_shader\b/.test(source) && !beforeMain.includes('uniform vec3 hue_shader') && !beforeMain.includes('vec3 hue_shader')) {
    additions.push(`vec3 hue_shader = vec3(1.0);`);
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
  if (/\bGetPixel\s*\(/.test(source) && !beforeMain.includes('vec3 GetPixel(')) {
    additions.push(`vec3 GetPixel(vec2 uv) { return texture(sampler_main, uv).xyz; }`);
  }
  if (/\bGetBlur1\s*\(/.test(source) && !beforeMain.includes('vec3 GetBlur1(')) {
    additions.push(`vec3 GetBlur1(vec2 uv) { return texture(sampler_blur1, uv).xyz; }`);
  }
  if (/\bGetBlur2\s*\(/.test(source) && !beforeMain.includes('vec3 GetBlur2(')) {
    additions.push(`vec3 GetBlur2(vec2 uv) { return texture(sampler_blur2, uv).xyz; }`);
  }
  if (/\bGetBlur3\s*\(/.test(source) && !beforeMain.includes('vec3 GetBlur3(')) {
    additions.push(`vec3 GetBlur3(vec2 uv) { return texture(sampler_blur3, uv).xyz; }`);
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
  patched = patched.replace(/\buAspect\.zw\b/g, '(vec2(1.0)/uAspect)');
  patched = patched.replace(/\buAspect\.z\b/g, '(1.0/uAspect.x)');
  patched = patched.replace(/\buAspect\.w\b/g, '(1.0/uAspect.y)');
  patched = patched.replace(/\buAspect\.xyzw\b/g, 'vec4(uAspect, vec2(1.0)/uAspect)');
  patched = normalizeDanglingStatementCommas(patched);
  patched = closeUnbalancedMainBlocks(patched);
  patched = stripRawTextLines(patched);
  patched = repairTruncatedMixCalls(patched);

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
  sanitizeAstArrays(ast);

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

  let declaredDims = collectDeclaredDims(ast as Program);

  // ── Pass 3: texture() → texture().xyz in vec3 contexts ──
  visit(ast, {
    function_call: {
      enter: (p) => {
        const name = getFnName(p.node);
        if (name !== 'texture' && name !== 'textureLod' && name !== 'textureBias') return;

        // Skip if already has a postfix (.xyz, .rgb, etc.)
        if (p.parent?.type === 'postfix') return;

        // Check enclosing assignment dimension
        const dim = findEnclosingAssignmentDim(p, declaredDims);
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

  declaredDims = collectDeclaredDims(ast as Program);

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
        const firstDim = inferDim(first, declaredDims);
        const secondDim = inferDim(second, declaredDims);
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

  // ── Pass 7: mix(vec, scalar, t) / mix(scalar, vec, t) → mix(vec, vec, t) ──
  visit(ast, {
    function_call: {
      enter: (p) => {
        const name = getFnName(p.node);
        if (name !== 'mix') return;
        const args = getArgs(p.node);
        if (args.length !== 3) return;
        const [first, second] = args;
        const firstDim = inferDim(first, declaredDims);
        const secondDim = inferDim(second, declaredDims);
        const allArgs = p.node.args;

        if (firstDim >= 2 && secondDim === 1) {
          const secondIdx = allArgs.indexOf(second);
          if (secondIdx !== -1) {
            allArgs[secondIdx] = wrapScalarForDim(second, firstDim);
          }
        } else if (firstDim === 1 && secondDim >= 2) {
          const firstIdx = allArgs.indexOf(first);
          if (firstIdx !== -1) {
            allArgs[firstIdx] = wrapScalarForDim(first, secondDim);
          }
        }
      },
    },
  });

  // ── Pass 8: min/max(scalar, vec) → min/max(vec, scalar) ──
  // GLSL ES has min/max(genType, float) but NOT min/max(float, genType).
  visit(ast, {
    function_call: {
      enter: (p) => {
        const name = getFnName(p.node);
        if (name !== 'min' && name !== 'max') return;
        const args = getArgs(p.node);
        if (args.length !== 2) return;
        const [first, second] = args;
        const firstDim = inferDim(first, declaredDims);
        const secondDim = inferDim(second, declaredDims);
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

  // ── Pass 9: vec declaration initializer promotion ──
  // e.g. vec3 color = lum(ret); → vec3 color = vec3(lum(ret));
  visit(ast, {
    declarator_list: {
      enter: (p) => {
        const targetDim = (() => {
          const kw = getTypeKeyword(p.node);
          if (kw === 'vec2') return 2;
          if (kw === 'vec3') return 3;
          if (kw === 'vec4') return 4;
          return 0;
        })();
        if (targetDim < 2) return;

        for (const decl of p.node.declarations) {
          if (!decl.initializer) continue;
          if (inferDim(decl.initializer, declaredDims) !== 1) continue;
          decl.initializer = wrapScalarForDim(decl.initializer, targetDim) as any;
        }
      },
    },
  });

  declaredDims = collectDeclaredDims(ast as Program);

  // ── Pass 10: vec assignment promotion ──
  // e.g. ret = lum(ret); → ret = vec3(lum(ret));
  visit(ast, {
    assignment: {
      enter: (p) => {
        const left = p.node.left;
        const targetDim = inferDim(left, declaredDims);
        if (targetDim < 2) return;
        const right = p.node.right;
        if (inferDim(right, declaredDims) === 1) {
          (p.node as any).right = wrapScalarForDim(right, targetDim);
        }
      },
    },
  });

  // ── Pass 11: Binary Dimension Rebalancing (vec3 - vec2 → vec3.xy - vec2) ──
  visit(ast, {
    binary: {
      enter: (p: Path<BinaryNode>) => {
        const left = p.node.left;
        const right = p.node.right;
        const op = p.node.operator.literal;
        
        if (!['+', '-', '*', '/'].includes(op)) return;

        const leftDim = inferDim(left, declaredDims);
        const rightDim = inferDim(right, declaredDims);

        if (leftDim === 0 || rightDim === 0) return;
        if (leftDim === rightDim) return;
        if (leftDim === 1 || rightDim === 1) return; // scalar handled by GLSL

        // Mismatch found! e.g. vec3 - vec2.
        // Usually in coordinate math, we want to down-swizzle the larger vec.
        if (leftDim > rightDim) {
          const swizzle = rightDim === 2 ? 'xy' : 'xyz';
          p.node.left = mkPostfixSwizzle(left, swizzle) as unknown as AstNode;
        } else {
          const swizzle = leftDim === 2 ? 'xy' : 'xyz';
          p.node.right = mkPostfixSwizzle(right, swizzle) as unknown as AstNode;
        }
      }
    }
  });

  return generate(ast);
};

// ═══════════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════════

/** Exported for debugging; not part of public API. */
export const _preprocess = preprocess;

export const patchMilkDropGlsl = (source: string): string => {
  if (!source || !source.includes('#version 300 es')) return source;

  // Phase 1: String preprocessing
  const preprocessed = preprocess(source);

  // Phase 2: AST transforms
  return astTransform(preprocessed);
};
