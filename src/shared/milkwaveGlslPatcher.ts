/**
 * Runtime GLSL patcher for MilkDrop preset shaders.
 *
 * Architecture:
 *   Phase 1 — Minimal string cleanup: only fixes that prevent the GLSL parser
 *             from succeeding (HLSL remnants, shader_body keyword stripping,
 *             orphan brace block removal).
 *   Phase 2 — AST transforms: ALL structural fixes using @shaderfrog/glsl-parser.
 *             Type promotion, dimension rebalancing, undeclared variable injection,
 *             sampler aliasing, constant injection, helper function injection.
 *             These are structurally correct by construction — no regex edge cases.
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
  if (spec.type === 'type_name') return spec.identifier;
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

/** Known vec3-returning function names. */
const VEC3_FNS = new Set(['GetPixel', 'GetBlur1', 'GetBlur2', 'GetBlur3', 'GetMain']);

/** Known vec4-returning function names. */
const VEC4_FNS = new Set(['texture', 'textureLod', 'textureBias', 'noise3', 'textureGrad', 'textureProj']);

/** Known scalar-returning function names. */
const SCALAR_FNS = new Set([
  'lum', 'dot', 'length', 'distance', 'float',
  'pow', 'mod',
  'step', 'smoothstep',
]);

/** Functions that preserve the dimension of their first argument. */
const PRESERVE_DIM_FNS = new Set([
  'min', 'max', 'clamp', 'mix', 'clamp01', 'sat',
  // Standard GLSL math functions that operate component-wise
  'floor', 'ceil', 'fract', 'round', 'trunc', 'abs', 'sign',
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan',
  'exp', 'exp2', 'log', 'log2', 'log10', 'sqrt', 'inversesqrt',
  'degrees', 'radians',
]);

/** Known sampler2D-returning function names (for declaration inference). */
const SAMPLER_FNS = new Set(['texture', 'textureLod', 'textureBias']);

/** Infer the vec dimensionality of an expression. Returns 1/2/3/4 or 0 if unknown. */
const inferDim = (node: AstNode, typeMap?: Map<string, number>): number => {
  if (node.type === 'float_constant' || node.type === 'int_constant' || node.type === 'double_constant') return 1;

  if (node.type === 'identifier') {
    const name = (node as IdentifierNode).identifier;
    if (typeMap?.has(name)) return typeMap.get(name)!;
    if (VEC3_VARS.has(name)) return 3;
    if (name === 'uv' || name === 'vUv') return 2;
    if (name === 'fragColor') return 4;
    return 0;
  }

  if (node.type === 'function_call') {
    const fn = getFnName(node as FunctionCallNode);
    if (VEC3_FNS.has(fn)) return 3;
    if (VEC4_FNS.has(fn)) return 4;
    if (fn === 'vec2') return 2;
    if (fn === 'vec3') return 3;
    if (fn === 'vec4') return 4;
    if (SCALAR_FNS.has(fn)) return 1;
    // Component-wise functions preserve the dimensionality of their first arg
    if (PRESERVE_DIM_FNS.has(fn)) {
      const args = getArgs(node as FunctionCallNode);
      return args.length > 0 ? inferDim(args[0], typeMap) : 0;
    }
    return 0;
  }

  if (node.type === 'postfix') {
    const pf = (node as PostfixNode).postfix;
    if (pf.type === 'field_selection') {
      const sel = (pf as FieldSelectionNode).selection;
      const swizzle = sel.type === 'literal' ? (sel as LiteralNode).literal :
                      sel.type === 'identifier' ? (sel as unknown as IdentifierNode).identifier : '';
      if (swizzle.length >= 1 && swizzle.length <= 4 && /^[xyzwrgba]+$/.test(swizzle)) {
        return swizzle.length;
      }
    }
    // array access → scalar
    if (pf.type === 'quantifier' || pf.type === 'array_specifier') return 1;
    return inferDim((node as PostfixNode).expression, typeMap);
  }

  if (node.type === 'binary') {
    const left = inferDim((node as BinaryNode).left, typeMap);
    const right = inferDim((node as BinaryNode).right, typeMap);
    return Math.max(left, right);
  }

  if (node.type === 'unary') {
    return inferDim((node as UnaryNode).expression, typeMap);
  }

  if (node.type === 'group') {
    return inferDim((node as any).expression, typeMap);
  }

  if (node.type === 'assignment') {
    return inferDim((node as AssignmentNode).left, typeMap);
  }

  return 0;
};

/**
 * Find the enclosing statement's LHS to determine vec context.
 * Returns the inferred dimension of the assignment target, or 0 if unknown.
 */
const findEnclosingAssignmentDim = (p: Path<any>, typeMap?: Map<string, number>): number => {
  let ctx: Path<any> | undefined = p;
  while (ctx) {
    const n = ctx.node;
    if (n.type === 'assignment') {
      return inferDim((n as AssignmentNode).left, typeMap);
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

const mkPostfixSwizzle = (expr: AstNode, swizzle: string): PostfixNode => {
  // Binary expressions need to be wrapped in parentheses to ensure correct output
  // Otherwise `a + b.xyz` would be generated instead of `(a + b).xyz`
  let exprNode: AstNode = expr;
  if (expr.type === 'binary' || expr.type === 'assignment') {
    exprNode = {
      type: 'group',
      lp: mkLiteral('('),
      expression: expr,
      rp: mkLiteral(')'),
    } as unknown as AstNode;
  }
  return {
    type: 'postfix',
    expression: exprNode as any,
    postfix: {
      type: 'field_selection',
      dot: mkLiteral('.'),
      selection: mkLiteral(swizzle),
    } as FieldSelectionNode as unknown as AstNode,
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// Phase 1: Minimal string preprocessing (only what prevents parsing)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Strip orphan `{ ... }` blocks that wrap the entire content of main body.
 * These come from offline translator emitting `shader_body { ... }` inside main.
 * After `shader_body` keyword is stripped, the braces remain as an orphan block.
 */
const stripOrphanBraceBlocks = (body: string): string => {
  const lines = body.split('\n');
  const result: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const trimmed = lines[i].trim();
    // Detect a bare `{` on its own line
    if (trimmed === '{') {
      // Find the matching closing `}` at the same depth
      let depth = 1;
      const innerLines: string[] = [];
      i++;
      while (i < lines.length && depth > 0) {
        const innerTrimmed = lines[i].trim();
        for (const ch of innerTrimmed) {
          if (ch === '{') depth++;
          else if (ch === '}') depth--;
        }
        if (depth > 0) {
          innerLines.push(lines[i]);
        }
        i++;
      }
      // Unwrap: dedent inner lines by 2 spaces and add to result
      for (const innerLine of innerLines) {
        result.push(innerLine.replace(/^  /, ''));
      }
    } else {
      result.push(lines[i]);
      i++;
    }
  }
  return result.join('\n');
};

/**
 * Phase 1: Minimal string preprocessing.
 * Only handles constructs that would prevent the GLSL parser from succeeding.
 * ALL structural fixes happen in Phase 2 (AST transforms).
 */
const preprocess = (source: string): string => {
  // ── 0a. Strip HLSL remnants ──
  source = source.replace(/\bstatic\s+/g, '');                              // `static` keyword
  source = source.replace(/\bfloat(\d)x(\d)\b/g, 'mat$1x$2');               // `float2x3` → `mat2x3`
  source = source.replace(/\bfloat(\d)\b/g, 'vec$1');                       // `float2/3/4` → `vec2/3/4`
  source = source.replace(/\bhalf\b/g, 'float');                            // `half` → `float`
  source = source.replace(/\bhalf(\d)\b/g, 'vec$1');                        // `half2/3/4` → `vec2/3/4`
  source = source.replace(/\bfixed\b/g, 'float');                           // `fixed` → `float`
  source = source.replace(/\bfixed(\d)\b/g, 'vec$1');                       // `fixed2/3/4` → `vec2/3/4`
  source = source.replace(/\)\s*:\s*[A-Z_][A-Z0-9_]*/g, ')');               // HLSL semantics (`: COLOR0`)
  source = source.replace(/\btex3D\b/g, 'texture');                         // HLSL `tex3D()` → `texture()`
  source = source.replace(/\btex2[Dd]\b/g, 'texture');                      // HLSL `tex2D()` → `texture()`
  source = source.replace(/\btex2[Dd]bias\b/g, 'textureBias');              // HLSL `tex2Dbias()` → `textureBias()`
  source = source.replace(/\btex2[Dd]lod\b/g, 'textureLod');                // HLSL `tex2Dlod()` → `textureLod()`
  source = source.replace(/\\\s*\n/g, ' ');                                 // Line continuations
  source = source.replace(/\bfloat\s+smooth\b/g, 'float smooth_');          // `smooth` is GLSL reserved
  source = source.replace(/\bsmooth\s*(?=[+\-*/=;,)])/g, 'smooth_');
  // HLSL bool-to-float in arithmetic context: (a<=b)*c → ((a<=b)?1.0:0.0)*c
  // HLSL allows bool*float, GLSL does not.
  // Only handle <= and >= when followed by arithmetic operators (not in while/if conditions)
  source = source.replace(/\(([^()]+?)\s*<=\s*([^()]+?)\)(?=\s*[\*\/+\-])/g, '($1 <= $2 ? 1.0 : 0.0)');
  source = source.replace(/\(([^()]+?)\s*>=\s*([^()]+?)\)(?=\s*[\*\/+\-])/g, '($1 >= $2 ? 1.0 : 0.0)');
  // ── 0a. Strip invalid swizzles from scalar function results ──
  // The offline translator sometimes adds .xyz/.xy etc. to scalar function results.
  // Handle both simple and nested parentheses cases.
  // First pass: simple cases like fn(arg).xyz
  const scalarFns = 'lum|length|dot|abs|floor|ceil|fract|sin|cos|tan|pow|sqrt|log|log2|log10|exp|sign|step|smoothstep|min|max|clamp|fwidth|dFdx|dFdy|inversesqrt|round|trunc|degrees|radians|asin|acos|atan';
  source = source.replace(new RegExp(`\\b(${scalarFns})\\s*\\(([^()]*)\\)\\s*\\.([xyzwrgba]{2,})`, 'g'), '$1($2)');
  // Handle mod with parentheses: mod(a, b).xyz → mod(a, b)
  source = source.replace(/\bmod\s*\(([^()]*)\)\s*\.([xyzwrgba]{2,})/g, 'mod($1)');

  source = source.replace(/\bint\s*\(/g, 'float(');                         // `int(expr)` casts → `float(expr)` (HLSL int*float invalid in GLSL)
  // Modulo on floats: `a % b` → `mod(a, b)` (GLSL % only works on integers)
  // Handle simple cases first: identifier/literal % identifier/literal
  source = source.replace(/(\b[a-zA-Z_]\w*(?:\.[xyzwrgba]+)?)\s*%\s*(\b[a-zA-Z_]\w*(?:\.[xyzwrgba]+)?|\d+\.?\d*)/g, 'mod($1, $2)');
  source = source.replace(/(\d+\.?\d*)\s*%\s*(\b[a-zA-Z_]\w*(?:\.[xyzwrgba]+)?|\d+\.?\d*)/g, 'mod($1, $2)');
  // Handle parenthesized expressions: (expr) % N
  source = source.replace(/\(([^()]+)\)\s*%\s*(\d+\.?\d*)/g, 'mod($1, $2)');
  // HLSL overloaded multiply() functions → direct matrix multiplication
  // GLSL ES doesn't support function overloading, so replace multiply(v, m) with (m * v)
  // Skip function definitions by requiring the first arg to NOT start with 'vec' or 'mat'
  source = source.replace(/\bmultiply\s*\(\s*(?!vec[234]|mat[234x])([^,]+)\s*,\s*([^)]+)\s*\)/g, '($2 * $1)');
  // Strip the now-unused multiply function definitions (single-line form)
  source = source.replace(/^vec[234]\s+multiply\s*\([^{}]+\)\s*\{[^}]*\}\s*$/gm, '');
  // Mixed-type comma declarations: `float x, y,\nvec2 a, b;` → split with `;`
  source = source.replace(/,\s*\n\s*(vec[234]|mat[234x]*|float|int|uint|bool|ivec[234]|bvec[234]|uvec[234])\s/g, ';\n$1 ');

  // ── 0b. Strip HLSL sampler declarations ──
  source = source.replace(/\bsampler\s+[^;]+;/g, '');

  // ── 0c. Strip shader_body keyword everywhere ──
  source = source.replace(/\bshader_body\b/g, '');

  // ── 0d. Strip double semicolons ──
  source = source.replace(/;;/g, ';');

  // ── 0e. Handle file-scope content before void main() ──
  const mainIdx = source.indexOf('void main()');
  if (mainIdx !== -1) {
    const beforeMain = source.substring(0, mainIdx);
    const afterMain = source.substring(mainIdx);

    // Classify lines before main: keep declarations, discard executable statements
    const bmLines = beforeMain.split('\n');
    const keepLines: string[] = [];
    let depth = 0;
    let inFuncDef = false;
    let inArrayInit = false;
    let inBareBlock = false;
    let prevEndsWithSemi = true;
    const moveLines: string[] = [];

    for (let i = 0; i < bmLines.length; i++) {
      const line = bmLines[i];
      const trimmed = line.trim();
      let delta = 0;
      for (const ch of trimmed) {
        if (ch === '{') delta++;
        else if (ch === '}') delta--;
      }

      if (inFuncDef) {
        keepLines.push(line);
        depth += delta;
        if (depth <= 0) { inFuncDef = false; depth = 0; }
        continue;
      }
      if (inArrayInit) {
        keepLines.push(line);
        depth += delta;
        if (depth <= 0) { inArrayInit = false; depth = 0; }
        continue;
      }
      if (inBareBlock) {
        moveLines.push(line);
        depth += delta;
        if (depth <= 0) { inBareBlock = false; depth = 0; }
        continue;
      }

      if (depth === 0) {
        if (depth + delta < 0) { depth = 0; continue; } // orphan `}`

        // Multi-line continuation
        if (!prevEndsWithSemi && trimmed) {
          keepLines.push(line);
          depth += delta;
          prevEndsWithSemi = trimmed.endsWith(';') || trimmed.endsWith('}') || trimmed.endsWith('{');
          continue;
        }

        if (trimmed === '{') {
          const prev = keepLines.length > 0 ? keepLines[keepLines.length - 1].trim() : '';
          if (/=\s*$/.test(prev) || /\[\d*\]\s*=\s*$/.test(prev)) {
            keepLines.push(line);
            depth += delta;
            inArrayInit = true;
          } else {
            // orphan bare block → collect for potential move into main
            moveLines.push(line);
            depth += delta;
            inBareBlock = true;
          }
          continue;
        }

        const isTypeDecl = /^\s*(?:(?:const\s+)?(?:flat\s+)?(?:float|vec[234]|mat[234x]*|int|uint|bool|ivec[234]|bvec[234]|uvec[234]|sampler\w*)\s)/.test(line);
        const isFuncDefLine = isTypeDecl && /\)\s*\{/.test(trimmed);
        const isVoidFuncDef = /^\s*void\s+[a-zA-Z_]\w*\s*\([^)]*\)\s*\{/.test(trimmed);
        const isPreprocessor = trimmed.startsWith('#');
        const isUniform = /^\s*(?:uniform|in|out|precision|layout)\s/.test(line);
        const isEmpty = !trimmed;
        const isComment = trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*');
        const isRawText = trimmed.length > 0 && !isEmpty && !isComment && !isPreprocessor &&
          !/[;{}()=+\-*/<>!&|,#]/.test(trimmed) && !/^\s*(float|vec|mat|int|uint|bool|void|uniform|in|out|const|precision|layout)\b/.test(trimmed);

        if (isRawText) continue; // discard plain text like "written by martin"

        if (isFuncDefLine || isVoidFuncDef) {
          keepLines.push(line);
          depth += delta;
          if (depth > 0) inFuncDef = true;
          prevEndsWithSemi = true;
          continue;
        }

        // Function declaration, `{` on next line
        const isFuncProto = /^\s*(?:(?:const\s+)?(?:float|vec[234]|mat[234x]*|int|uint|bool|void)\s+[a-zA-Z_]\w*\s*\([^)]*\)\s*$)/.test(trimmed);
        if (isFuncProto && (bmLines[i + 1] || '').trim().startsWith('{')) {
          keepLines.push(line);
          depth += delta;
          inFuncDef = true;
          prevEndsWithSemi = true;
          continue;
        }

        if (isTypeDecl && /=\s*\{/.test(trimmed)) {
          keepLines.push(line);
          depth += delta;
          if (depth > 0) inArrayInit = true;
          prevEndsWithSemi = trimmed.endsWith(';') || trimmed.endsWith('}');
          continue;
        }

        // File-scope declarations with non-constant initializers are invalid GLSL
        // e.g. `vec2 hor = vec2((1.0/uTexSize.x), 0.0)` → move to main
        // Only allow declarations without initializers, or with PURE literal initializers
        // (numbers, no variable references)
        if (isTypeDecl && /=/.test(trimmed)) {
          const hasVarRef = /[a-zA-Z_]\w*/.test(trimmed.split('=').slice(1).join('='));
          if (hasVarRef) {
            moveLines.push(line);
            continue;
          }
        }

        if (isTypeDecl || isPreprocessor || isUniform || isEmpty || isComment) {
          keepLines.push(line);
          depth += delta;
          prevEndsWithSemi = trimmed.endsWith(';') || trimmed.endsWith('}') || isEmpty || isComment || isPreprocessor;
        } else {
          // Executable statement at file scope → collect for potential move into main
          moveLines.push(line);
          depth += delta;
          if (delta > 0) inBareBlock = true;
        }
      } else {
        depth += delta;
        if (depth <= 0) depth = 0;
      }
    }

    // ── Phase B: Handle shader_body content ──
    let finalAfterMain = afterMain;
    if (moveLines.length > 0) {
      // Check if main body already has shader_body content
      const mainBodyStart = afterMain.indexOf('{', afterMain.indexOf('void main()'));
      if (mainBodyStart !== -1) {
        const mainBodyEnd = afterMain.lastIndexOf('}');
        const mainBody = afterMain.substring(mainBodyStart + 1, mainBodyEnd);
        const hasShaderBodyInMain = /\bshader_body\b/.test(mainBody);

        if (hasShaderBodyInMain) {
          // Main already has shader_body content → strip the wrapper braces and keyword
          // but keep the actual shader code
          finalAfterMain = afterMain.replace(/\bshader_body\s*\{/g, '').replace(/\}\s*fragColor/, 'fragColor');
        } else {
          // Main is boilerplate-only → move pre-main shader_body content into it
          const bodyLines = mainBody.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//'));
          if (bodyLines.length <= 8) {
            const fragColorIdx = finalAfterMain.lastIndexOf('fragColor');
            if (fragColorIdx !== -1) {
              const insertContent = '\n  // --- moved from shader_body ---\n' +
                moveLines.map(l => '  ' + l).join('\n') + '\n';
              finalAfterMain = finalAfterMain.substring(0, fragColorIdx) +
                insertContent +
                finalAfterMain.substring(fragColorIdx);
            }
          }
        }
      }
    }

    source = keepLines.join('\n') + '\n' + finalAfterMain;

    // ── 0f. Remove nested function definitions inside main() ──
    const mainPos = source.indexOf('void main()');
    const mainBrace = source.indexOf('{', mainPos);
    if (mainBrace !== -1) {
      const beforeMainBody = source.substring(0, mainBrace + 1);
      let body = source.substring(mainBrace + 1);

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
          if (bodyDepth <= nestedFuncDepth) { inNestedFunc = false; }
          continue;
        }

        const funcDefRe = /^\s*(?:float|vec[234]|mat[234x]*|int|uint|bool|void)\s+[a-zA-Z_]\w*\s*\([^)]*\)\s*\{/;
        const funcDeclRe = /^\s*(?:float|vec[234]|mat[234x]*|int|uint|bool|void)\s+[a-zA-Z_]\w*\s*\([^)]*\)\s*$/;

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

        if (funcDeclRe.test(trimmed) && (bodyLines[i + 1] || '').trim().startsWith('{')) {
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

        for (const ch of trimmed) {
          if (ch === '{') bodyDepth++;
          else if (ch === '}') bodyDepth--;
        }
        cleanBodyLines.push(bodyLines[i]);
      }

      source = beforeMainBody + cleanBodyLines.join('\n');
    }

    // ── 0g. Strip orphan brace blocks inside main body ──
    const bodyStart = source.indexOf('{', source.indexOf('void main()'));
    if (bodyStart !== -1) {
      const beforeBody = source.substring(0, bodyStart + 1);
      let body = source.substring(bodyStart + 1);
      // Find the closing `}` of main
      const closingBraceIdx = body.lastIndexOf('}');
      if (closingBraceIdx !== -1) {
        const mainBody = body.substring(0, closingBraceIdx);
        const afterBody = body.substring(closingBraceIdx);
        body = stripOrphanBraceBlocks(mainBody) + afterBody;
      }
      source = beforeBody + body;
    }
  }

  return source;
};

// ═══════════════════════════════════════════════════════════════════════════
// Phase 2: AST transforms (all structural fixes)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Collect all declared variable names from the AST.
 */
const collectDeclaredNames = (ast: Program): Set<string> => {
  const names = new Set<string>();
  visit(ast, {
    declarator_list: {
      enter: (p) => {
        const decls = (p.node as DeclaratorListNode).declarations;
        for (const d of decls) {
          if (d.identifier) names.add((d as DeclarationNode).identifier.identifier);
        }
      },
    },
    function: {
      enter: (p) => {
        const fn = p.node as FunctionNode;
        const name = fn.prototype.header.name;
        if (name && name.type === 'identifier') names.add(name.identifier);
      },
    },
  });
  return names;
};

/**
 * Collect all identifier usages relevant for undeclared variable detection.
 * Only captures LHS of assignments (actual variable assignments, not swizzle reads).
 */
const collectIdentifier = (ast: Program): { assignments: Set<string>; assignmentNodes: Map<string, AssignmentNode> } => {
  const assignments = new Set<string>();
  const assignmentNodes = new Map<string, AssignmentNode>();

  visit(ast, {
    assignment: {
      enter: (p) => {
        const node = p.node as AssignmentNode;
        if (node.left.type === 'identifier') {
          const name = (node.left as IdentifierNode).identifier;
          assignments.add(name);
          assignmentNodes.set(name, node);
        }
      },
    },
  });

  return { assignments, assignmentNodes };
};

/**
 * Phase 2: Apply all AST-based transformations.
 */
const astTransform = (source: string): string => {
  let ast: Program;
  try {
    ast = parse(source, { stage: 'fragment', quiet: true });
  } catch (err) {
    // If parsing fails, return the source as-is (caller will handle fallback)
    console.warn('[MilkwaveGlslPatcher] AST parse failed, returning source as-is:', err);
    return source;
  }

  const declaredNames = collectDeclaredNames(ast);
  const { assignments, assignmentNodes } = collectIdentifier(ast);

  // ── Build a type map from all declarator lists ──
  // This lets inferDim know the types of declared variables.
  const typeMap = new Map<string, number>();
  visit(ast, {
    declarator_list: {
      enter: (p) => {
        const kw = getTypeKeyword(p.node);
        const dim = kw === 'float' ? 1 : kw === 'vec2' ? 2 : kw === 'vec3' ? 3 : kw === 'vec4' ? 4 :
                    kw === 'mat2' ? 4 : kw === 'mat3' ? 9 : kw === 'mat4' ? 16 : 0;
        for (const d of (p.node as DeclaratorListNode).declarations) {
          const decl = d as DeclarationNode;
          if (decl.identifier) {
            typeMap.set(decl.identifier.identifier, dim);
          }
        }
      },
    },
  });

  // Also track function return types
  visit(ast, {
    function: {
      enter: (p) => {
        const fn = p.node as FunctionNode;
        const name = fn.prototype.header.name.identifier;
        const retSpec = fn.prototype.header.returnType.specifier.specifier;
        const retKw = retSpec.type === 'keyword' ? retSpec.token : retSpec.type === 'type_name' ? retSpec.identifier : '';
        const dim = retKw === 'float' ? 1 : retKw === 'vec2' ? 2 : retKw === 'vec3' ? 3 : retKw === 'vec4' ? 4 : 0;
        if (name && dim > 0) typeMap.set(name, dim);
      },
    },
  });

  // ── Built-in name sets ──
  const builtins = new Set([
    'gl_FragCoord', 'gl_FrontFacing', 'gl_PointCoord',
    'fragColor', 'vUv', 'vUvOriginal', 'vRadius', 'vAngle', 'uv', 'ret', 'rad', 'ang',
    'uTime', 'uFrame', 'uFps', 'uRms', 'uAspectX', 'uAspectY', 'uAspect', 'uTexSize',
    'uRandomPreset', 'uRandomFrame',
    'audioLow', 'audioLowSmooth', 'audioMid', 'audioMidSmooth', 'audioHigh', 'audioHighSmooth',
    'sampler_main', 'sampler_noise_lq', 'sampler_noise_mq', 'sampler_noise_hq',
    'sampler_blur1', 'sampler_blur2', 'sampler_blur3',
    'GetPixel', 'GetBlur1', 'GetBlur2', 'GetBlur3', 'GetMain',
    'clamp01', 'lum', 'sat', 'noise3', 'multiply',
    'texture', 'textureLod', 'textureBias', 'textureGrad', 'textureProj',
    'clamp', 'mix', 'fract', 'abs', 'sin', 'cos', 'tan', 'atan',
    'pow', 'sqrt', 'log', 'log2', 'log10', 'exp', 'exp2', 'floor', 'ceil', 'sign', 'step',
    'smoothstep', 'min', 'max', 'mod', 'dot', 'cross', 'length', 'normalize',
    'distance', 'reflect', 'refract', 'fwidth', 'dFdx', 'dFdy',
    'inversesqrt', 'round', 'trunc', 'degrees', 'radians', 'asin', 'acos',
    'true', 'false', 'if', 'else', 'for', 'while', 'do', 'break', 'continue', 'return', 'discard',
    'void', 'const', 'in', 'out', 'inout', 'uniform', 'precision', 'highp', 'mediump', 'lowp',
    'i', 'j', 'k', 'n', 'x', 'y', 'z', 'w', 'r', 'g', 'b', 'a', 's', 't', 'p',
    // Math constants
    'M_PI', 'M_PI_2', 'M_INV_PI_2', 'PI', 'PI_2',
  ]);
  for (let qi = 1; qi <= 32; qi++) builtins.add(`q${qi}`);
  for (let ci = 0; ci <= 17; ci++) builtins.add(`_c${ci}`);
  ['_qa', '_qb', '_qc', '_qd', '_qe', '_qf', '_qg', '_qh'].forEach(v => builtins.add(v));
  ['rot_s1', 'rot_s2', 'rot_s3', 'rot_s4', 'rot_d1', 'rot_d2', 'rot_d3', 'rot_d4',
   'rot_f1', 'rot_f2', 'rot_f3', 'rot_f4', 'rot_vf1', 'rot_vf2', 'rot_vf3', 'rot_vf4',
   'rot_uf1', 'rot_uf2', 'rot_uf3', 'rot_uf4', 'rot_rand1', 'rot_rand2', 'rot_rand3', 'rot_rand4'
  ].forEach(v => builtins.add(v));
  ['rand_frame', 'rand_preset',
   'texsize_noise_lq', 'texsize_noise_mq', 'texsize_noise_hq',
   'texsize_noisevol_lq', 'texsize_noisevol_hq', 'texsize_noisevol_mq', 'texsize_noise_lq_lite',
   'texsize',
  ].forEach(v => builtins.add(v));
  // Sampler aliases
  ['sampler_fc_main', 'sampler_pc_main', 'sampler_fw_main', 'sampler_pw_main',
   'sampler_FC_main', 'sampler_PC_main', 'sampler_FW_main', 'sampler_PW_main',
   'sampler_noise_lq_lite', 'sampler_noisevol_lq', 'sampler_noisevol_hq',
   'sampler_rand00', 'sampler_rand01', 'sampler_rand02', 'sampler_rand03',
   'sampler_rand04', 'sampler_rand05', 'sampler_rand06', 'sampler_rand07',
   'sampler_rand08', 'sampler_rand09',
   'sampler_fw_rand00', 'sampler_fw_rand01', 'sampler_fw_rand02', 'sampler_fw_rand03',
   'sampler_fw_rand04', 'sampler_fw_rand05', 'sampler_fw_rand06', 'sampler_fw_rand07',
   'sampler_fw_rand08', 'sampler_fw_rand09',
   'sampler_pw_rand00', 'sampler_pw_rand01', 'sampler_pw_rand02', 'sampler_pw_rand03',
   'sampler_pw_rand04', 'sampler_pw_rand05', 'sampler_pw_rand06', 'sampler_pw_rand07',
   'sampler_pw_rand08', 'sampler_pw_rand09',
   // Short forms (used in texture() calls without sampler_ prefix)
   'rand00', 'rand01', 'rand02', 'rand03', 'rand04', 'rand05',
   'rand06', 'rand07', 'rand08', 'rand09', 'rand10', 'rand11',
   'rand12', 'rand13', 'rand14', 'rand15',
  ].forEach(v => builtins.add(v));

  // ── Find all identifiers used in expressions ──
  const allUsedIdentifiers = new Set<string>();
  const functionNames = new Set<string>();
  const declaredInFunctions = new Set<string>();
  visit(ast, {
    identifier: {
      enter: (p) => {
        const name = (p.node as IdentifierNode).identifier;
        if (name) allUsedIdentifiers.add(name);
      },
    },
    function: {
      enter: (p) => {
        const fn = p.node as FunctionNode;
        const fname = fn.prototype.header.name;
        if (fname && fname.type === 'identifier') functionNames.add(fname.identifier);
        // Collect parameter names
        for (const param of fn.prototype.parameters || []) {
          if (param.identifier) declaredInFunctions.add(param.identifier.identifier);
        }
      },
    },
    declarator_list: {
      enter: (p) => {
        for (const d of (p.node as DeclaratorListNode).declarations) {
          if ((d as DeclarationNode).identifier) declaredInFunctions.add((d as DeclarationNode).identifier.identifier);
        }
      },
    },
  });
  // Remove function names, parameter names, and already-declared names
  for (const name of allUsedIdentifiers) {
    if (functionNames.has(name) || declaredInFunctions.has(name)) allUsedIdentifiers.delete(name);
  }

  // ── Find undeclared identifiers (assigned or used but not declared, not builtin) ──
  const undeclared = new Set<string>();
  for (const name of assignments) {
    if (!declaredNames.has(name) && !builtins.has(name)) {
      undeclared.add(name);
    }
  }
  // Also add used-but-not-declared identifiers
  for (const name of allUsedIdentifiers) {
    if (!declaredNames.has(name) && !builtins.has(name)) {
      undeclared.add(name);
    }
  }

  // ── Infer types for undeclared variables ──
  const inferredTypes = new Map<string, string>();
  for (const name of undeclared) {
    const assignNode = assignmentNodes.get(name);
    if (assignNode) {
      const dim = inferDim(assignNode.right, typeMap);
      if (dim === 2) inferredTypes.set(name, 'vec2');
      else if (dim === 3) inferredTypes.set(name, 'vec3');
      else if (dim === 4) inferredTypes.set(name, 'vec4');
      else if (dim === 0) {
        // Check if it's a sampler (used in texture() calls)
        // Look for usage in function_call as first arg
        let isSampler = false;
        visit(ast, {
          function_call: {
            enter: (p) => {
              const fnName = getFnName(p.node);
              if (fnName === 'texture' || fnName === 'textureLod' || fnName === 'textureBias') {
                const args = getArgs(p.node);
                if (args.length > 0 && args[0].type === 'identifier' && (args[0] as IdentifierNode).identifier === name) {
                  isSampler = true;
                }
              }
            },
          },
        });
        inferredTypes.set(name, isSampler ? 'sampler2D' : 'float');
      }
      else inferredTypes.set(name, 'float');
    } else {
      inferredTypes.set(name, 'float');
    }
  }

  // ── Pass 1: int_constant → float_constant ──
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

        const retSpec = fn.prototype.header.returnType.specifier.specifier;
        if (retSpec.type === 'keyword' && retSpec.token === 'vec4') {
          (retSpec as any).token = 'vec3';
        }

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
        if (p.parent?.type === 'postfix') return;

        const dim = findEnclosingAssignmentDim(p, typeMap);
        if (dim === 3) {
          p.replaceWith(mkPostfixSwizzle(p.node as unknown as AstNode, 'xyz') as unknown as AstNode);
        } else if (dim === 2) {
          p.replaceWith(mkPostfixSwizzle(p.node as unknown as AstNode, 'xy') as unknown as AstNode);
        }
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

        (p.node as any).right = mkFnCall('vec4', [
          mkIdentifier('ret', ' '),
          mkLiteral(','),
          mkFloat('1.0', ' '),
        ]);
      },
    },
  });

  // ── Pass 6: pow(vec_expr, scalar) → pow(vec_expr, vecN(scalar)) ──
  visit(ast, {
    function_call: {
      enter: (p) => {
        const name = getFnName(p.node);
        if (name !== 'pow') return;
        const args = getArgs(p.node);
        if (args.length !== 2) return;
        const [first, second] = args;
        const firstDim = inferDim(first, typeMap);
        const secondDim = inferDim(second, typeMap);
        if (firstDim >= 2 && secondDim === 1) {
          const vecType = `vec${firstDim}`;
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
  visit(ast, {
    function_call: {
      enter: (p) => {
        const name = getFnName(p.node);
        if (name !== 'min' && name !== 'max') return;
        const args = getArgs(p.node);
        if (args.length !== 2) return;
        const [first, second] = args;
        const firstDim = inferDim(first, typeMap);
        const secondDim = inferDim(second, typeMap);
        if (firstDim === 1 && secondDim >= 2) {
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
  visit(ast, {
    assignment: {
      enter: (p) => {
        const left = p.node.left;
        if (left.type !== 'identifier') return;
        const varName = (left as IdentifierNode).identifier;
        if (!VEC3_VARS.has(varName)) return;

        const right = p.node.right;
        const rightDim = inferDim(right, typeMap);
        if (rightDim === 1) {
          (p.node as any).right = mkFnCall('vec3', [right], ' ') as unknown as AstNode;
        }
      },
    },
  });

  // ── Pass 9: Binary Dimension Rebalancing ──
  // When vecA op vecB where dims don't match, wrap the smaller side in a vec constructor
  // to match the larger side. e.g. vec3 + vec2 → vec3 + vec3(vec2, 0.0)
  // Note: This can cause issues with texture() coordinates. Pass 9.1 fixes that.
  visit(ast, {
    binary: {
      enter: (p: Path<BinaryNode>) => {
        const left = p.node.left;
        const right = p.node.right;
        const op = p.node.operator.literal;
        if (!['+', '-', '*', '/'].includes(op)) return;

        const leftDim = inferDim(left, typeMap);
        const rightDim = inferDim(right, typeMap);
        if (leftDim === 0 || rightDim === 0) return;
        // Skip matrix types (dim >= 4) - mat*vec is valid GLSL
        if (leftDim >= 4 || rightDim >= 4) return;
        if (leftDim === rightDim) return;
        if (leftDim === 1 || rightDim === 1) return; // GLSL allows vec * scalar

        // Wrap the smaller side in a vec constructor with padding
        const maxDim = Math.max(leftDim, rightDim);
        const vecType = `vec${maxDim}`;

        if (leftDim < maxDim) {
          // vec3(vec2_expr, 0.0) - pad with zeros
          const paddingArgs: AstNode[] = [left];
          for (let i = leftDim; i < maxDim; i++) {
            paddingArgs.push(mkLiteral(',') as unknown as AstNode);
            paddingArgs.push(mkFloat('0.0') as unknown as AstNode);
          }
          p.node.left = mkFnCall(vecType, paddingArgs, ' ') as unknown as AstNode;
        } else {
          const paddingArgs: AstNode[] = [right];
          for (let i = rightDim; i < maxDim; i++) {
            paddingArgs.push(mkLiteral(',') as unknown as AstNode);
            paddingArgs.push(mkFloat('0.0') as unknown as AstNode);
          }
          p.node.right = mkFnCall(vecType, paddingArgs, ' ') as unknown as AstNode;
        }
      }
    }
  });

  // ── Pass 10: Dimension mismatch in declarator lists ──
  // `float x = vec_expr` → change type to match initializer
  // `vecX x = scalar_expr` → change type to float
  visit(ast, {
    declarator_list: {
      enter: (p) => {
        const node = p.node as DeclaratorListNode;
        const kw = getTypeKeyword(node);
        const declaredDim = kw === 'float' ? 1 : kw === 'vec2' ? 2 : kw === 'vec3' ? 3 : kw === 'vec4' ? 4 : 0;
        if (declaredDim === 0) return;

        const decls = node.declarations;
        if (decls.length !== 1) return;
        const decl = decls[0] as DeclarationNode;
        if (!decl.initializer) return;

        const initDim = inferDim(decl.initializer, typeMap);
        if (declaredDim === 1 && initDim >= 2) {
          // float x = vec_expr → vecX x = vec_expr
          const newType = initDim === 2 ? 'vec2' : initDim === 3 ? 'vec3' : 'vec4';
          const spec = node.specified_type.specifier.specifier;
          if (spec.type === 'keyword') (spec as any).token = newType;
          typeMap.set(decl.identifier.identifier, initDim);
        } else if (declaredDim >= 2 && initDim === 1) {
          // vecX x = scalar_expr → float x = scalar_expr
          const spec = node.specified_type.specifier.specifier;
          if (spec.type === 'keyword') (spec as any).token = 'float';
          typeMap.set(decl.identifier.identifier, 1);
        }
      },
    },
  });

  // ── Pass 10.5: Assignment dimension mismatch ──
  // Handles both simple (=) and compound (+= -= *= /=) assignments.
  // `vec3_var += vec4_expr` → `vec3_var += vec4_expr.xyz`
  // `vec2_var = vec3_expr` → `vec2_var = vec3_expr.xy`
  // `float_var = vec3_expr` → `float_var = vec3_expr.x`
  visit(ast, {
    assignment: {
      enter: (p) => {
        const op = (p.node as AssignmentNode).operator;
        const isCompound = op.literal.endsWith('=');

        const left = p.node.left;
        if (left.type !== 'identifier') return;
        const varName = (left as IdentifierNode).identifier;
        let varDim = typeMap.get(varName) || 0;

        const right = p.node.right;
        const rightDim = inferDim(right, typeMap);
        if (rightDim === 0 || rightDim === varDim) return;

        if (rightDim > varDim) {
          // Swizzle down: vecX → smaller
          const swizzle = varDim === 0 ? 'x' : varDim === 1 ? 'x' : varDim === 2 ? 'xy' : 'xyz';
          p.node.right = mkPostfixSwizzle(right, swizzle) as unknown as AstNode;
          // If varDim was 0 (unknown), assume it's float after swizzling
          if (varDim === 0) typeMap.set(varName, 1);
        } else if (isCompound) {
          // Only pad for compound assignments (+= -= *= /=)
          const targetDim = varDim || rightDim;
          if (targetDim <= 1) return;
          const vecType = `vec${targetDim}`;
          const paddingArgs: AstNode[] = [right];
          for (let i = rightDim; i < targetDim; i++) {
            paddingArgs.push(mkLiteral(',') as unknown as AstNode);
            paddingArgs.push(mkFloat('0.0') as unknown as AstNode);
          }
          p.node.right = mkFnCall(vecType, paddingArgs, ' ') as unknown as AstNode;
        }
      },
    },
  });

  // ── Pass 10.6: Convert int declarations to float ──
  // GLSL ES doesn't allow int in most shader contexts. Convert `int x = N` → `float x = N.0`.
  visit(ast, {
    declarator_list: {
      enter: (p) => {
        const node = p.node as DeclaratorListNode;
        const kw = getTypeKeyword(node);
        if (kw !== 'int' && kw !== 'ivec2' && kw !== 'ivec3' && kw !== 'ivec4') return;

        const spec = node.specified_type.specifier.specifier;
        if (kw === 'int') {
          if (spec.type === 'keyword') (spec as any).token = 'float';
        } else if (kw === 'ivec2') {
          if (spec.type === 'keyword') (spec as any).token = 'vec2';
        } else if (kw === 'ivec3') {
          if (spec.type === 'keyword') (spec as any).token = 'vec3';
        } else if (kw === 'ivec4') {
          if (spec.type === 'keyword') (spec as any).token = 'vec4';
        }

        // Convert integer literal initializers to float
        for (const decl of node.declarations) {
          const d = decl as DeclarationNode;
          if (d.initializer && d.initializer.type === 'int_constant') {
            (d.initializer as any).type = 'float_constant';
            (d.initializer as any).token = ((d.initializer as any).token || '0') + '.0';
          }
          // Update typeMap
          if (d.identifier) {
            const newDim = kw === 'int' ? 1 : kw === 'ivec2' ? 2 : kw === 'ivec3' ? 3 : 4;
            typeMap.set(d.identifier.identifier, newDim);
          }
        }
      },
    },
  });

  // ── Swizzle normalization (pre-generation) ──
  // Fix invalid swizzles like .zww, .wzy, .zxy on non-vectors.
  // These come from offline translation errors where vec3 was used as vec4.
  // Replace multi-char swizzles with the first character (treat as scalar access).
  source = source.replace(/\.([xyzwrgba])([xyzwrgba]{2,})\b/g, '.$1');
  // Fix duplicate swizzle chars like .xxx → .x
  source = source.replace(/\.([xyzwrgba])\1+\b/g, '.$1');

  // ── Pass 11: vec constructor args too wide → swizzle down ──
  // Runs AFTER Pass 10 so typeMap has updated declaration types.
  // Only applies when total components EXCEED the target (e.g. vec2(vec3, vec3) = 6 > 2).
  // Valid GLSL like vec4(vec3, float) = 4 is left alone.
  visit(ast, {
    function_call: {
      enter: (p) => {
        const name = getFnName(p.node);
        const targetDim = name === 'vec2' ? 2 : name === 'vec3' ? 3 : name === 'vec4' ? 4 : 0;
        if (targetDim === 0) return;

        const args = getArgs(p.node);
        if (args.length === 0) return;

        // Calculate total components
        let totalComponents = 0;
        for (const arg of args) {
          totalComponents += Math.max(1, inferDim(arg, typeMap));
        }

        // Only swizzle if total exceeds target
        if (totalComponents <= targetDim) return;

        // Distribute: each arg gets floor(targetDim / numArgs) components,
        // with remainder args getting 1 extra
        const numArgs = args.length;
        const basePerArg = Math.floor(targetDim / numArgs);
        const remainder = targetDim % numArgs;

        const allArgs = p.node.args;
        for (let i = 0; i < allArgs.length; i++) {
          const arg = allArgs[i];
          const argDim = inferDim(arg, typeMap);
          if (argDim <= 1) continue;
          if (arg.type === 'postfix') continue;

          // This arg's allowance
          const allowance = basePerArg + (i < remainder ? 1 : 0);
          if (argDim <= allowance) continue;

          // Swizzle down to allowance
          const swizzle = allowance === 1 ? 'x' : allowance === 2 ? 'xy' : 'xyz';
          allArgs[i] = mkPostfixSwizzle(arg, swizzle) as unknown as AstNode;
        }
      },
    },
  });

  // ── Pass 12: mix(a, b, t) dimension fix ──
  // GLSL requires t to be float or same dim as a/b.
  // e.g. mix(vec2, vec2, vec3) → mix(vec2, vec2, vec3.xy)
  visit(ast, {
    function_call: {
      enter: (p) => {
        const name = getFnName(p.node);
        if (name !== 'mix') return;
        const args = getArgs(p.node);
        if (args.length < 3) return;

        const firstDim = inferDim(args[0], typeMap);
        const thirdDim = inferDim(args[2], typeMap);
        if (firstDim <= 0 || thirdDim <= 0) return;
        if (firstDim >= thirdDim) return; // OK: third is scalar or same dim

        // Third arg is wider than first two — swizzle it down
        const swizzle = firstDim === 1 ? 'x' : firstDim === 2 ? 'xy' : 'xyz';
        const allArgs = p.node.args;
        for (let i = 0; i < allArgs.length; i++) {
          if (allArgs[i] === args[2]) {
            allArgs[i] = mkPostfixSwizzle(args[2], swizzle) as unknown as AstNode;
            break;
          }
        }
      },
    },
  });

  // ── Generate patched source ──
  let patched = generate(ast);

  // ── Post-generation fix: strip swizzles from scalar function results ──
  // The offline translator sometimes adds .xyz/.xy etc. to scalar function results.
  // Collect all function calls with their positions, then strip swizzles.
  const scalarFns = 'lum|length|dot|abs|floor|ceil|fract|sin|cos|tan|pow|sqrt|log|log2|log10|exp|sign|step|smoothstep|min|max|clamp|mix|fwidth|dFdx|dFdy|inversesqrt|round|trunc|degrees|radians|asin|acos|atan';
  for (let pass = 0; pass < 3; pass++) {
    const fnRegex = new RegExp(`\\b(${scalarFns})\\s*\\(`, 'g');
    let result = '';
    let searchPos = 0;
    let m: RegExpExecArray | null;
    let found = false;
    while ((m = fnRegex.exec(patched)) !== null) {
      // Find matching closing paren
      let depth = 1;
      let i = m.index + m[0].length;
      while (i < patched.length && depth > 0) {
        if (patched[i] === '(') depth++;
        else if (patched[i] === ')') depth--;
        i++;
      }
      // i is after closing paren, check for swizzle
      const swizzleMatch = patched.substring(i).match(/^\.([xyzwrgba]{2,})/);
      if (swizzleMatch) {
        // Found a swizzle to strip
        found = true;
        // Append text before this function call
        result += patched.substring(searchPos, m.index);
        // Append function call without swizzle
        result += patched.substring(m.index, i);
        // Move search position past the swizzle
        searchPos = i + swizzleMatch[0].length;
        // Reset regex position
        fnRegex.lastIndex = searchPos;
      }
    }
    if (found) {
      // Append remaining text
      result += patched.substring(searchPos);
      patched = result;
    } else {
      break;
    }
  }

  // ── Post-generation fix: texture() with vec3 coordinates ──
  // The binary rebalancing can cause texture(sampler, vec3(...)+...) which is invalid.
  // Fix by wrapping the coord in parentheses and adding .xy.
  patched = patched.replace(
    /\b(texture|textureLod|textureBias)\s*\(\s*([^,]+)\s*,\s*(vec3\s*\([^)]+\)\s*[\+\-\*\/][^)]*)\s*\)/g,
    (_match, fn, sampler, coord) => {
      return `${fn}(${sampler}, (${coord}).xy)`;
    }
  );

  // ── Post-generation: inject declarations, constants, samplers, helpers ──
  // These must happen after generation because we need to know what's used.
  // Order matters: uniforms first, then declarations (to avoid shadowing).
  patched = injectMissingUniforms(patched);
  patched = injectMissingDeclarations(patched, undeclared, inferredTypes);
  patched = injectMissingConstants(patched);
  patched = injectMissingSamplers(patched);
  patched = injectMissingHelpers(patched);

  return patched;
};

// ═══════════════════════════════════════════════════════════════════════════
// Post-generation injection helpers
// ═══════════════════════════════════════════════════════════════════════════

/** Inject auto-declared local variables into main body. */
const injectMissingDeclarations = (source: string, undeclared: Set<string>, inferredTypes: Map<string, string>): string => {
  if (undeclared.size === 0) return source;

  const mainIdx = source.indexOf('void main()');
  if (mainIdx === -1) return source;

  const mainBrace = source.indexOf('{', mainIdx);
  if (mainBrace === -1) return source;

  const beforeMain = source.substring(0, mainIdx);
  const beforeBody = source.substring(0, mainBrace + 1);
  let body = source.substring(mainBrace + 1);

  // Collect names already declared before main (uniforms, globals, etc.)
  const alreadyDeclared = new Set<string>();
  const declRegex = /\b(?:uniform\s+)?(?:float|vec[234]|mat[234x]*|int|sampler2D)\s+(\w+)/g;
  let m: RegExpExecArray | null;
  while ((m = declRegex.exec(beforeMain)) !== null) {
    alreadyDeclared.add(m[1]);
  }

  const decls: string[] = ['  // Auto-declared MilkDrop variables'];
  for (const name of undeclared) {
    // Skip if already declared in the source (e.g., as a uniform)
    if (alreadyDeclared.has(name)) continue;

    const type = inferredTypes.get(name) || 'float';
    if (type === 'sampler2D') continue; // samplers can't be local
    const init = type === 'float' ? '0.0' : `${type}(0.0)`;
    decls.push(`  ${type} ${name} = ${init};`);
  }

  if (decls.length > 1) {
    body = '\n' + decls.join('\n') + '\n' + body;
  }

  return beforeBody + body;
};

/** Inject missing math constants (#define) before void main(). */
const injectMissingConstants = (source: string): string => {
  const mainIdx = source.indexOf('void main()');
  if (mainIdx === -1) return source;
  const beforeMain = source.substring(0, mainIdx);

  const constants: [string, string][] = [
    ['M_PI', '3.14159265359'],
    ['M_PI_2', '1.57079632679'],
    ['M_INV_PI_2', '0.63661977236'],
    ['PI', '3.14159265359'],
    ['PI_2', '1.57079632679'],
  ];

  const additions: string[] = [];
  for (const [name, val] of constants) {
    if (source.includes(name) && !beforeMain.includes(`#define ${name}`)) {
      additions.push(`#define ${name} ${val}`);
    }
  }

  if (additions.length === 0) return source;
  return source.substring(0, mainIdx) +
    '// --- MilkDrop constants ---\n' + additions.join('\n') + '\n\n' +
    source.substring(mainIdx);
};

/** Inject missing sampler #define aliases before void main(). */
const injectMissingSamplers = (source: string): string => {
  const mainIdx = source.indexOf('void main()');
  if (mainIdx === -1) return source;
  const beforeMain = source.substring(0, mainIdx);

  const aliases: [string, string][] = [
    ['sampler_fc_main', 'sampler_main'], ['sampler_pc_main', 'sampler_main'],
    ['sampler_fw_main', 'sampler_main'], ['sampler_pw_main', 'sampler_main'],
    ['sampler_FC_main', 'sampler_main'], ['sampler_PC_main', 'sampler_main'],
    ['sampler_FW_main', 'sampler_main'], ['sampler_PW_main', 'sampler_main'],
    ['sampler_noise_lq_lite', 'sampler_noise_lq'],
    ['sampler_noisevol_lq', 'sampler_noise_lq'], ['sampler_noisevol_hq', 'sampler_noise_hq'],
    // Custom fw/pw noise samplers used by some presets
    ['sampler_fw_noise_lq', 'sampler_noise_lq'], ['sampler_fw_noise_mq', 'sampler_noise_mq'],
    ['sampler_fw_noise_hq', 'sampler_noise_hq'],
    ['sampler_pw_noise_lq', 'sampler_noise_lq'], ['sampler_pw_noise_mq', 'sampler_noise_mq'],
    ['sampler_pw_noise_hq', 'sampler_noise_hq'],
    ['sampler_rand00', 'sampler_noise_lq'], ['sampler_rand01', 'sampler_noise_lq'],
    ['sampler_rand02', 'sampler_noise_mq'], ['sampler_rand03', 'sampler_noise_hq'],
    ['sampler_rand04', 'sampler_noise_lq'], ['sampler_rand05', 'sampler_noise_mq'],
    ['sampler_rand06', 'sampler_noise_hq'], ['sampler_rand07', 'sampler_noise_lq'],
    ['sampler_rand08', 'sampler_noise_mq'], ['sampler_rand09', 'sampler_noise_hq'],
    // Per-frame / per-wave random samplers (fw_randNN, pw_randNN)
    ['sampler_fw_rand00', 'sampler_noise_lq'], ['sampler_fw_rand01', 'sampler_noise_lq'],
    ['sampler_fw_rand02', 'sampler_noise_mq'], ['sampler_fw_rand03', 'sampler_noise_hq'],
    ['sampler_fw_rand04', 'sampler_noise_lq'], ['sampler_fw_rand05', 'sampler_noise_mq'],
    ['sampler_fw_rand06', 'sampler_noise_hq'], ['sampler_fw_rand07', 'sampler_noise_lq'],
    ['sampler_fw_rand08', 'sampler_noise_mq'], ['sampler_fw_rand09', 'sampler_noise_hq'],
    ['sampler_pw_rand00', 'sampler_noise_lq'], ['sampler_pw_rand01', 'sampler_noise_lq'],
    ['sampler_pw_rand02', 'sampler_noise_mq'], ['sampler_pw_rand03', 'sampler_noise_hq'],
    ['sampler_pw_rand04', 'sampler_noise_lq'], ['sampler_pw_rand05', 'sampler_noise_mq'],
    ['sampler_pw_rand06', 'sampler_noise_hq'], ['sampler_pw_rand07', 'sampler_noise_lq'],
    ['sampler_pw_rand08', 'sampler_noise_mq'], ['sampler_pw_rand09', 'sampler_noise_hq'],
    // Short forms (no sampler_ prefix) — used directly in texture() calls
    ['rand00', 'sampler_noise_lq'], ['rand01', 'sampler_noise_lq'],
    ['rand02', 'sampler_noise_mq'], ['rand03', 'sampler_noise_hq'],
    ['rand04', 'sampler_noise_lq'], ['rand05', 'sampler_noise_mq'],
    ['rand06', 'sampler_noise_hq'], ['rand07', 'sampler_noise_lq'],
    ['rand08', 'sampler_noise_mq'], ['rand09', 'sampler_noise_hq'],
    ['rand10', 'sampler_noise_lq'], ['rand11', 'sampler_noise_mq'],
    ['rand12', 'sampler_noise_hq'], ['rand13', 'sampler_noise_lq'],
    ['rand14', 'sampler_noise_mq'], ['rand15', 'sampler_noise_hq'],
  ];

  const additions: string[] = [];
  for (const [alias, target] of aliases) {
    if (source.includes(alias) && !beforeMain.includes(`#define ${alias}`) && !beforeMain.includes(`uniform sampler2D ${alias}`)) {
      additions.push(`#define ${alias} ${target}`);
    }
  }

  if (additions.length === 0) return source;
  return source.substring(0, mainIdx) +
    '// --- MilkDrop sampler aliases ---\n' + additions.join('\n') + '\n\n' +
    source.substring(mainIdx);
};

/** Inject missing uniform declarations before void main(). */
const injectMissingUniforms = (source: string): string => {
  const mainIdx = source.indexOf('void main()');
  if (mainIdx === -1) return source;
  const beforeMain = source.substring(0, mainIdx);

  const uniforms: [string, string][] = [
    ['q1', 'float'], ['q2', 'float'], ['q3', 'float'], ['q4', 'float'],
    ['q5', 'float'], ['q6', 'float'], ['q7', 'float'], ['q8', 'float'],
    ['q9', 'float'], ['q10', 'float'], ['q11', 'float'], ['q12', 'float'],
    ['q13', 'float'], ['q14', 'float'], ['q15', 'float'], ['q16', 'float'],
    ['q17', 'float'], ['q18', 'float'], ['q19', 'float'], ['q20', 'float'],
    ['q21', 'float'], ['q22', 'float'], ['q23', 'float'], ['q24', 'float'],
    ['q25', 'float'], ['q26', 'float'], ['q27', 'float'], ['q28', 'float'],
    ['q29', 'float'], ['q30', 'float'], ['q31', 'float'], ['q32', 'float'],
    ['_c0', 'vec4'], ['_c1', 'vec4'], ['_c2', 'vec4'], ['_c3', 'vec4'],
    ['_c4', 'vec4'], ['_c5', 'vec4'], ['_c6', 'vec4'], ['_c7', 'vec4'],
    ['_c8', 'vec4'], ['_c9', 'vec4'], ['_c10', 'vec4'], ['_c11', 'vec4'],
    ['_c12', 'vec4'], ['_c13', 'vec4'], ['_c14', 'vec4'],
    ['_c15', 'vec4'], ['_c16', 'vec4'], ['_c17', 'vec4'],
    ['_qa', 'vec4'], ['_qb', 'vec4'], ['_qc', 'vec4'], ['_qd', 'vec4'],
    ['_qe', 'vec4'], ['_qf', 'vec4'], ['_qg', 'vec4'], ['_qh', 'vec4'],
    ['rand_frame', 'vec4'], ['rand_preset', 'vec4'],
    ['texsize_noise_lq', 'vec4'], ['texsize_noise_mq', 'vec4'], ['texsize_noise_hq', 'vec4'],
    ['texsize_noisevol_lq', 'vec4'], ['texsize_noisevol_hq', 'vec4'],
    ['texsize_noisevol_mq', 'vec4'], ['texsize_noise_lq_lite', 'vec4'],
  ];

  const rotNames = [
    'rot_s1', 'rot_s2', 'rot_s3', 'rot_s4',
    'rot_d1', 'rot_d2', 'rot_d3', 'rot_d4',
    'rot_f1', 'rot_f2', 'rot_f3', 'rot_f4',
    'rot_vf1', 'rot_vf2', 'rot_vf3', 'rot_vf4',
    'rot_uf1', 'rot_uf2', 'rot_uf3', 'rot_uf4',
    'rot_rand1', 'rot_rand2', 'rot_rand3', 'rot_rand4',
  ];
  for (const name of rotNames) {
    uniforms.push([name, 'mat4']);
  }

  const additions: string[] = [];
  for (const [name, type] of uniforms) {
    const re = new RegExp(`\\b${name}\\b`);
    if (re.test(source) && !beforeMain.includes(`uniform ${type} ${name};`)) {
      additions.push(`uniform ${type} ${name};`);
    }
  }

  // texsize macro
  if (/\btexsize\b/.test(source) && !beforeMain.includes('#define texsize') && !beforeMain.includes('uniform vec4 texsize')) {
    additions.push('#define texsize vec4(uTexSize, 1.0/uTexSize)');
  }

  // vUvOriginal varying
  if (/\bvUvOriginal\b/.test(source) && !beforeMain.includes('in vec2 vUvOriginal')) {
    additions.push('in vec2 vUvOriginal;');
  }

  if (additions.length === 0) return source;
  return source.substring(0, mainIdx) +
    '// --- MilkDrop uniforms ---\n' + additions.join('\n') + '\n\n' +
    source.substring(mainIdx);
};

/** Inject missing helper functions before void main(). */
const injectMissingHelpers = (source: string): string => {
  const mainIdx = source.indexOf('void main()');
  if (mainIdx === -1) return source;
  const beforeMain = source.substring(0, mainIdx);

  const additions: string[] = [];

  if (/\blum\s*\(/.test(source) && !beforeMain.includes('float lum(')) {
    additions.push('float lum(vec3 x) { return dot(x, vec3(0.32, 0.49, 0.29)); }');
    additions.push('float lum(vec4 x) { return dot(x.rgb, vec3(0.32, 0.49, 0.29)); }');
  }
  if (/\bsat\s*\(/.test(source) && !beforeMain.includes('float sat(')) {
    additions.push('float sat(float x) { return clamp(x, 0.0, 1.0); }');
    additions.push('vec2 sat(vec2 x) { return clamp(x, vec2(0.0), vec2(1.0)); }');
    additions.push('vec3 sat(vec3 x) { return clamp(x, vec3(0.0), vec3(1.0)); }');
    additions.push('vec4 sat(vec4 x) { return clamp(x, vec4(0.0), vec4(1.0)); }');
  }
  if (/\bnoise3\s*\(/.test(source) && !beforeMain.includes('vec4 noise3(')) {
    additions.push('vec4 noise3(vec2 uv) { return texture(sampler_noise_lq, uv); }');
  }
  if (/\bGetMain\s*\(/.test(source) && !beforeMain.includes('vec3 GetMain(')) {
    additions.push('vec3 GetMain(vec2 uv) { return texture(sampler_main, uv).xyz; }');
  }
  if (/\bGetPixel\s*\(/.test(source) && !beforeMain.includes('vec3 GetPixel(')) {
    additions.push('vec3 GetPixel(vec2 uv) { return texture(sampler_main, uv).xyz; }');
  }
  if (/\bGetBlur1\s*\(/.test(source) && !beforeMain.includes('vec3 GetBlur1(')) {
    additions.push('vec3 GetBlur1(vec2 uv) { return texture(sampler_blur1, uv).xyz; }');
  }
  if (/\bGetBlur2\s*\(/.test(source) && !beforeMain.includes('vec3 GetBlur2(')) {
    additions.push('vec3 GetBlur2(vec2 uv) { return texture(sampler_blur2, uv).xyz; }');
  }
  if (/\bGetBlur3\s*\(/.test(source) && !beforeMain.includes('vec3 GetBlur3(')) {
    additions.push('vec3 GetBlur3(vec2 uv) { return texture(sampler_blur3, uv).xyz; }');
  }
  if (/\bmultiply\s*\(/.test(source) && !beforeMain.includes('vec2 multiply(')) {
    additions.push('vec2 multiply(vec2 v, mat2 m) { return m * v; }');
    additions.push('vec3 multiply(vec3 v, mat3 m) { return m * v; }');
    additions.push('vec4 multiply(vec4 v, mat4 m) { return m * v; }');
  }
  if (/\btextureBias\s*\(/.test(source) && !beforeMain.includes('vec4 textureBias(')) {
    additions.push('vec4 textureBias(sampler2D s, vec4 uv4) { return textureLod(s, uv4.xy, uv4.w); }');
  }
  if (/\bclamp01\s*\(/.test(source) && !beforeMain.includes('float clamp01(')) {
    additions.push('float clamp01(float x) { return clamp(x, 0.0, 1.0); }');
    additions.push('vec2 clamp01(vec2 x) { return clamp(x, vec2(0.0), vec2(1.0)); }');
    additions.push('vec3 clamp01(vec3 x) { return clamp(x, vec3(0.0), vec3(1.0)); }');
    additions.push('vec4 clamp01(vec4 x) { return clamp(x, vec4(0.0), vec4(1.0)); }');
  }

  if (additions.length === 0) return source;
  return source.substring(0, mainIdx) +
    '// --- MilkDrop helper functions ---\n' + additions.join('\n') + '\n\n' +
    source.substring(mainIdx);
};

// ═══════════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════════

/** Exported for debugging; not part of public API. */
export const _preprocess = preprocess;

export const patchMilkDropGlsl = (source: string): string => {
  if (!source || !source.includes('#version 300 es')) return source;

  // Phase 1: Minimal string preprocessing (only what prevents parsing)
  const preprocessed = preprocess(source);

  // Phase 2: AST transforms (all structural fixes)
  return astTransform(preprocessed);
};
