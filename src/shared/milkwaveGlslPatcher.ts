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
import { visit as glslVisit } from '@shaderfrog/glsl-parser/ast';
import type { NodeVisitors } from '@shaderfrog/glsl-parser/ast';
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

/**
 * Crash-proof visit: malformed-but-parsable shaders can leave null children
 * in the AST, and the library's visitor throws on them (reading `.type` of
 * null). A pass that dies mid-traversal keeps its partial edits — still far
 * better than propagating the exception, which aborts every remaining pass
 * and sends the whole shader to the runtime fallback path.
 */
const visit = (ast: Program | AstNode, visitors: NodeVisitors): void => {
  try {
    glslVisit(ast, visitors);
  } catch (err) {
    console.warn(
      '[MilkwaveGlslPatcher] AST visit pass skipped after traversal error:',
      err instanceof Error ? err.message : err
    );
  }
};

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
  // mod and pow are component-wise in GLSL
  'mod', 'pow',
  // normalize/reflect return the dimension of their (first) vector argument
  'normalize', 'reflect',
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
    // User-declared functions: their declared return type was recorded in
    // typeMap (fn-return visit). Without this, calls to helpers like
    // `float noise2(...)` infer dim 0 and every dim-aware pass misfires.
    const declared = typeMap?.get(fn);
    if (declared !== undefined) return declared >= 16 ? 4 : declared >= 9 ? 3 : declared >= 4 ? 4 : declared >= 1 ? declared : 0;
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
  // Binary/assignment args must be parenthesized — a raw binary arg would be
  // generated without parens, changing precedence inside the call:
  // vec3(a - b * 0.1, 0.0) means a - (b * 0.1), not (a - b) * 0.1.
  args: args.map((arg) =>
    arg.type === 'binary' || arg.type === 'assignment'
      ? ({
          type: 'group',
          lp: mkLiteral('('),
          expression: arg,
          rp: mkLiteral(')'),
        } as unknown as AstNode)
      : arg
  ),
  rp: mkLiteral(')'),
});

/** Build `name = initializer;` from a duplicate declaration's parts. */
const mkAssignStatement = (decl: DeclarationNode): AstNode =>
  ({
    type: 'expression_statement',
    expression: {
      type: 'assignment',
      left: decl.identifier,
      operator: mkLiteral('='),
      right: decl.initializer,
    },
    semi: mkLiteral(';'),
  } as unknown as AstNode);

/** Build `left op right` — args to mkFnCall auto-parenthesize binaries. */
const mkBinary = (left: AstNode, op: string, right: AstNode): AstNode =>
  ({
    type: 'binary',
    left,
    operator: mkLiteral(op),
    right,
  } as unknown as AstNode);

/**
 * Deduplicate same-scope redeclarations. Mashup presets concatenate the
 * global blocks of two source shaders, which can declare the same variable
 * twice in one scope (`vec2 polar, ...;` … `vec2 polar = vec2(...)`) — a
 * hard `'redefinition'` compile error in GLSL (HLSL tolerates nothing here
 * either; MilkDrop's translator silently re-hoists). For a duplicate with an
 * initializer we convert to an assignment (the second block clearly wants a
 * fresh value); a bare duplicate declarator is dropped. Only fires within a
 * single statement list — shadowing across nested scopes stays legal.
 *
 * Exception: FUNCTION BODIES inherit the file-scope names. The offline
 * translator and our moved-code stub machinery hoist per-frame variables to
 * file scope while main keeps (or gets a stub-inserted) real declaration with
 * an initializer. That shadow is legal GLSL and the frontend compiles it,
 * but ANGLE's Metal backend flattens scopes and emits the local twice under
 * one MSL name → a *link*-stage "redefinition" failure the compile probe
 * cannot see (02_mw_new* family). Converting the function-body declaration
 * to an assignment restores MilkDrop semantics: the variable is the global.
 * Cross-type inherited names keep their declaration (a legal shadow we have
 * no business rewriting); nested blocks still get a fresh map.
 */
const dedupeSameScopeDeclarations = (ast: Program): void => {
  const processList = (stmts: AstNode[], seed?: Map<string, string>): void => {
    const seen = new Map<string, string>(seed ?? []);
    const inherited = new Set<string>(seed?.keys() ?? []);
    const out: AstNode[] = [];
    for (const raw of stmts) {
      const stmt = raw as unknown as Record<string, unknown>;
      if (stmt.type === 'compound_statement' && Array.isArray(stmt.statements)) {
        processList(stmt.statements as AstNode[]);
        out.push(raw);
        continue;
      }
      if (stmt.type === 'function') {
        const body = stmt.body as unknown as Record<string, unknown> | undefined;
        if (body?.type === 'compound_statement' && Array.isArray(body.statements)) {
          processList(body.statements as AstNode[], seen);
        }
        out.push(raw);
        continue;
      }
      if (
        stmt.type === 'declaration_statement' &&
        (stmt.declaration as unknown as Record<string, unknown>)?.type === 'declarator_list'
      ) {
        const dl = stmt.declaration as unknown as DeclaratorListNode;
        const kw = getTypeKeyword(dl);
        const qualifiers = dl.specified_type?.qualifiers;
        const decls = (dl.declarations ?? []) as DeclarationNode[];
        const listIsSafe =
          kw !== '' && !qualifiers && decls.every((d) => d && d.identifier && !d.quantifier);
        if (listIsSafe) {
          const kept: DeclarationNode[] = [];
          const assignDupes: DeclarationNode[] = [];
          for (const d of decls) {
            const name = d.identifier!.identifier;
            const prev = seen.get(name);
            if (prev === undefined) {
              seen.set(name, kw);
              kept.push(d);
            } else if (inherited.has(name) && prev !== kw) {
              // cross-type shadow of an inherited (file-scope) name is legal
              // GLSL — keep the declaration, do not rewrite it
              kept.push(d);
            } else if (d.initializer && prev === kw) {
              // same-type redeclaration with initializer → assignment
              assignDupes.push(d);
            }
            // bare or cross-type same-scope duplicate declarator → drop
          }
          if (kept.length === 0) {
            // every declarator was a duplicate: emit assignments (if any), drop the declaration
            for (const d of assignDupes) out.push(mkAssignStatement(d));
            continue;
          }
          if (kept.length !== decls.length) {
            // trim the declarator list in place; emit assignments for the dropped-with-init ones
            dl.declarations = kept as unknown as DeclarationNode[];
            if (Array.isArray(dl.commas)) dl.commas = dl.commas.slice(0, kept.length - 1);
            out.push(raw);
            for (const d of assignDupes) out.push(mkAssignStatement(d));
            continue;
          }
          out.push(raw);
          continue;
        }
        // qualified (const/uniform) or untyped lists: never deduped against,
        // so don't record their names either — a later `float x` after a
        // `const float x` is a legal shadow in a fresh block and must not be
        // dropped by cross-storage confusion.
        out.push(raw);
        continue;
      }
      out.push(raw);
    }
    stmts.length = 0;
    for (const s of out) stmts.push(s);
  };
  processList(((ast as unknown as Record<string, unknown>).program ?? []) as AstNode[]);
};

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
 * From a file-scope declaration line (`vec2 sunpos = vec2(...), other = ...;`),
 * extract a bare global declaration stub (`vec2 sunpos, other;`). Returns null
 * when the line doesn't start with a plain type-keyword declaration.
 */
const makeGlobalDeclStub = (line: string): string | null => {
  const head = /^\s*(?:const\s+)?(float|vec[234]|mat[234x]*|int|uint|bool|ivec[234]|bvec[234]|uvec[234])\s+/.exec(line);
  if (!head) return null;
  const type = head[1];
  const rest = line.slice(head[0].length);
  // Split declarators on top-level commas only (parens/brackets shield the
  // commas inside constructors and index expressions).
  const names: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of rest) {
    if (ch === '(' || ch === '[') { depth++; cur += ch; continue; }
    if (ch === ')' || ch === ']') { depth--; cur += ch; continue; }
    if (depth === 0 && ch === ',') {
      const m = /^\s*([a-zA-Z_]\w*)\s*(?:[=;\[]|$)/.exec(cur);
      if (m) names.push(m[1]);
      cur = '';
      continue;
    }
    cur += ch;
  }
  const m = /^\s*([a-zA-Z_]\w*)\s*(?:[=;\[]|$)/.exec(cur);
  if (m) names.push(m[1]);
  if (names.length === 0) return null;
  return `${type} ${names.join(', ')};`;
};

/** Strip the leading type keyword from a declaration line, turning it into an assignment. */
const stripDeclTypeKeyword = (line: string): string => {
  const head = /^\s*(?:const\s+)?(?:float|vec[234]|mat[234x]*|int|uint|bool|ivec[234]|bvec[234]|uvec[234])\s+/.exec(line);
  return head ? line.slice(head[0].length) : line;
};

/**
 * Insert collected file-scope code into main's body, after the leading
 * preamble declarations. The moved code comes from the offline translator's
 * pre-main shader_body emission and routinely references the main preamble
 * (`uv`, `ret`, `rad`, ...) — so it cannot go at the very top. Skipping the
 * preamble's declaration statements lands it right where shader_body ran.
 */
const insertMovedCode = (source: string, moved: string[]): string => {
  if (moved.length === 0) return source;
  const mainIdx = source.indexOf('void main()');
  if (mainIdx === -1) return source;
  const bodyStart = source.indexOf('{', mainIdx);
  if (bodyStart === -1) return source;

  const isPreambleLine = (l: string): boolean => {
    const t = l.trim();
    if (!t || t.startsWith('//')) return true;
    // Preamble is all plain declarations (`vec3 ret = vec3(0.0);` etc.).
    return /^\s*(?:(?:const\s+)?(?:float|vec[234]|mat[234x]*|int|uint|bool|ivec[234]|bvec[234]|uvec[234])\s+)[a-zA-Z_]\w*(\s*,\s*[a-zA-Z_]\w*)*\s*(?:=[^;]*)?;\s*$/.test(l);
  };

  const lines = source.substring(bodyStart + 1).split('\n');
  let insertLine = 0;
  for (let i = 0; i < lines.length; i++) {
    if (isPreambleLine(lines[i])) continue;
    insertLine = i;
    break;
  }

  // The moved block routinely references names that main declares LATER in
  // its body (mashups concatenate a stray shader_body mid-file: `shine2` used
  // here, declared 20 lines down). Emit bare stub declarations before the
  // moved block; the AST dedupe pass then turns the later real declaration
  // into an assignment, so the initializer still runs in place.
  const stubs: string[] = [];
  const movedText = moved.join('\n');
  const restText = lines.slice(insertLine).join('\n');
  const idents = new Set(movedText.match(/\b[a-zA-Z_]\w*\b/g) ?? []);
  for (const name of idents) {
    // Skip call sites (`name(`) and keywords/gl_ builtins.
    if (new RegExp('\\b' + name + '\\s*\\(').test(movedText)) continue;
    if (/^(uv|ret|rad|ang|uv_orig)$/.test(name) || name.startsWith('gl_')) continue;
    const declRe = new RegExp(
      '\\b(?:const\\s+)?(float|vec2|vec3|vec4|int|bool)\\s+' + name + '\\s*(?:=|;|,)',
    );
    const m = declRe.exec(restText);
    if (m) stubs.push('  ' + m[1] + ' ' + name + ';');
  }

  const insert = [
    '  // --- moved file-scope code ---',
    ...stubs,
    ...moved.map((l) => '  ' + l),
    '',
  ];
  lines.splice(insertLine, 0, ...insert);
  return source.substring(0, bodyStart + 1) + lines.join('\n');
};

/**
 * Repair commas that terminate statements at bracket depth 0 — a corruption
 * artifact of some mashup imports (`ret += foo(uvm),\nret = ...`). Only line
 * endings count, so multi-arg declarations and call arguments (depth > 0 or
 * mid-line) are untouched. Called only as a parse-failure retry, never
 * speculatively — valid comma-operator usage stays valid because this runs
 * only when the parser already proved the source unparseable.
 */
const repairTrailingCommas = (source: string): string => {
  let depth = 0;
  return source
    .split('\n')
    .map((line) => {
      for (const ch of line) {
        if (ch === '(' || ch === '[') depth++;
        else if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
      }
      if (depth === 0 && /,\s*(\/\/.*)?$/.test(line)) {
        return line.replace(/,(\s*(\/\/.*)?)$/, ';$1');
      }
      return line;
    })
    .join('\n');
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
  source = source.replace(/\btex3[Dd]\b/g, 'texture');                       // HLSL `tex3D()` → `texture()`
  source = source.replace(/\btex2[Dd]\b/g, 'texture');                      // HLSL `tex2D()` → `texture()`
  source = source.replace(/\btex2[Dd]bias\b/g, 'textureBias');              // HLSL `tex2Dbias()` → `textureBias()`
  source = source.replace(/\btex2[Dd]lod\b/g, 'textureLod');                // HLSL `tex2Dlod()` → `textureLod()`
  // MilkDrop per-frame roam banks: the offline translation renamed them to
  // the _c8-_c11 vec4 uniforms, but some shaders still reference the
  // original float3 names. Alias them onto the uniforms the renderer feeds
  // (milkwaveBuiltins.ts _c8/_c9 fast cos/sin, _c10/_c11 slow cos/sin).
  // Skip when the shader declares its own variable with these names.
  if (!/\b(?:float|vec[234])\s+(?:slow_)?roam_(?:cos|sin|pos)\b/.test(source)) {
    source = source.replace(/\bslow_roam_cos\b/g, '_c10');
    source = source.replace(/\bslow_roam_sin\b/g, '_c11');
    source = source.replace(/\broam_cos\b/g, '_c8');
    source = source.replace(/\broam_sin\b/g, '_c9');
  }
  source = source.replace(/\\\s*\n/g, ' ');                                 // Line continuations
  source = source.replace(/\bfloat\s+smooth\b/g, 'float smooth_');          // `smooth` is GLSL reserved
  source = source.replace(/\bsmooth\s*(?=[+\-*/=;,)])/g, 'smooth_');
  // GLSL ES 3.0 reserved words that MilkDrop presets use as variable names
  // (e.g. `vec3 output = 0;`, `vec3 sample = texture(...)`). Word-boundary
  // replacement renames declaration and uses consistently; occurrences inside
  // comments are harmless.
  source = source.replace(/\boutput\b/g, 'output_');
  source = source.replace(/\bsample\b/g, 'sample_');
  source = source.replace(/\binput\b/g, 'input_');
  // ── `#define main <sampler>` ──
  // Some presets name a custom sampler "main"; the offline translator emits
  // `#define main sampler_pw_main`. Left in place, macro expansion renames the
  // GLSL entry point — `void main()` becomes `void sampler_main()`, colliding
  // with the `uniform sampler2D sampler_main` declaration ("'sampler_main' :
  // redefinition of a function"). Inline the macro instead: substitute bare
  // `main` tokens with the alias target (protecting `void main`) and drop the
  // define lines.
  let mainAliasTarget = '';
  source = source.replace(/^[ \t]*#[ \t]*define[ \t]+main[ \t]+([A-Za-z_]\w*)[^\n]*\n?/gm, (_m, target: string) => {
    if (!mainAliasTarget) mainAliasTarget = target;
    return '';
  });
  if (mainAliasTarget) {
    source = source.replace(/\bvoid(\s+)main\b/g, 'void$1__VS_ENTRY_MAIN__');
    source = source.replace(/\bmain\b/g, mainAliasTarget);
    source = source.replace(/\bvoid(\s+)__VS_ENTRY_MAIN__\b/g, 'void$1main');
  }
  // ── rand_frame / rand_preset: MilkDrop scalar semantics ──
  // MilkDrop defines these as scalar 0-1 random values, but the offline
  // translator declares them `uniform vec4` (component accesses `.z`, `.xy`
  // exist in the corpus, so the vec4 stays). Bare uses are scalar context:
  // `float z = ... + rand_frame * 64.0;` — with the vec4 in place, the
  // declaration-inference pass widens `float z` to vec4 and cascades
  // "wrong operand types" errors. Swizzle bare uses to `.x`; already-swizzled
  // uses and the uniform declaration itself are untouched. No corpus preset
  // assigns the full vec4 (`vec4 v = rand_frame;` — 0 hits in 733 shaders).
  source = source.replace(
    /(?<!uniform\s+vec[234]\s+)\b(rand_frame|rand_preset)\b(?!\s*\.)/g,
    '$1.x'
  );
  source = source.replace(/\bfilter\b/g, 'filter_');
  // HLSL bool-to-float in arithmetic context: (a<=b)*c → ((a<=b)?1.0:0.0)*c
  // HLSL allows bool*float, GLSL does not.
  // Only handle <= and >= when followed by arithmetic operators (not in while/if conditions)
  source = source.replace(/\(([^()]+?)\s*<=\s*([^()]+?)\)(?=\s*[\*\/+\-])/g, '($1 <= $2 ? 1.0 : 0.0)');
  source = source.replace(/\(([^()]+?)\s*>=\s*([^()]+?)\)(?=\s*[\*\/+\-])/g, '($1 >= $2 ? 1.0 : 0.0)');

  // ── 0a.1. Pre-alias unknown sampler_XXX names used in texture() calls ──
  // Use direct text replacement instead of #define to avoid shader_body block issues
  const knownSamplers = new Set([
    'sampler_main', 'sampler_blur1', 'sampler_blur2', 'sampler_blur3',
    'sampler_noise_lq', 'sampler_noise_mq', 'sampler_noise_hq',
    'sampler_fc_main', 'sampler_pc_main', 'sampler_fw_main', 'sampler_pw_main',
    'sampler_FC_main', 'sampler_PC_main', 'sampler_FW_main', 'sampler_PW_main',
    'sampler_noise_lq_lite', 'sampler_noisevol_lq', 'sampler_noisevol_hq',
    'sampler_fw_noise_lq', 'sampler_fw_noise_mq', 'sampler_fw_noise_hq',
    'sampler_pw_noise_lq', 'sampler_pw_noise_mq', 'sampler_pw_noise_hq',
    'sampler_rand00', 'sampler_rand01', 'sampler_rand02', 'sampler_rand03',
    'sampler_rand04', 'sampler_rand05', 'sampler_rand06', 'sampler_rand07',
    'sampler_rand08', 'sampler_rand09',
  ]);
  // Find all sampler_XXX used in texture() calls
  const textureSamplerRe = /\btexture\s*\(\s*(sampler_\w+)\s*,/g;
  const samplersToAlias = new Set<string>();
  let tm: RegExpExecArray | null;
  while ((tm = textureSamplerRe.exec(source)) !== null) {
    const name = tm[1];
    if (knownSamplers.has(name)) continue;
    // The raw already aliases this name itself (`#define sampler_pic
    // sampler_noise_lq`) — renaming would collide with the macro target and
    // produce "macro redefined" errors. The macro resolves it for us.
    if (new RegExp(`#\\s*define\\s+${name}\\b`).test(source)) continue;
    samplersToAlias.add(name);
  }
  if (samplersToAlias.size > 0) {
    console.log(`[GLSL Patcher] Pre-aliasing unknown samplers: ${Array.from(samplersToAlias).join(', ')}`);
    // Direct text replacement - replace each unknown sampler with sampler_noise_lq
    for (const name of samplersToAlias) {
      const re = new RegExp(`\\b${name}\\b`, 'g');
      source = source.replace(re, 'sampler_noise_lq');
    }
  }

  // ── 0a.2. Duplicate #define dedupe (keep first) ──
  // Some presets #define the same macro twice with different bodies — a hard
  // "macro redefined" error in GLSL. Keep the first definition, drop the rest.
  {
    const seen = new Set<string>();
    source = source
      .split('\n')
      .filter((line) => {
        const m = /^\s*#\s*define\s+(\w+)\s*(.*)$/.exec(line);
        if (!m) return true;
        if (seen.has(m[1])) return false; // drop duplicate definition
        seen.add(m[1]);
        return true;
      })
      .join('\n');
  }

  // ── 0a.4. HLSL brace matrix initializers ──
  // `mat2 rot = { a, b, c, d };` (HLSL initializer-list syntax, possibly
  // line-broken) is a syntax error in GLSL ES — rewrite to a constructor.
  // [^}]* spans newlines; nested braces inside these initializers don't
  // occur in the corpus.
  source = source.replace(/\b(mat[234])\s+(\w+)\s*=\s*\{([^}]*)\}\s*;/g,
    (m, ty: string, name: string, body: string) => `${ty} ${name} = ${ty}(${body});`);

  // ── 0a.3. Strip bare local sampler2D declarations ──
  // MilkDrop per-shader sampler declarations (`sampler2D sampler_pic;`)
  // shadow the patcher's uniform samplers — "sampler2Ds must be uniform".
  // Only unqualified single-name declarations; `uniform sampler2D ...`
  // headers and function parameters are untouched.
  source = source.replace(/^[ \t]*sampler2D\s+sampler_\w+\s*;[ \t]*$/gm, '');

  // ── 0a. Strip invalid swizzles from scalar function results ──
  // The offline translator sometimes adds .xyz/.xy etc. to scalar function results.
  // Handle both simple and nested parentheses cases.
  // First pass: simple cases like fn(arg).xyz
  const scalarFns = 'lum|length|dot|abs|floor|ceil|fract|sin|cos|tan|pow|sqrt|log|log2|log10|exp|sign|step|smoothstep|min|max|clamp|fwidth|dFdx|dFdy|inversesqrt|round|trunc|degrees|radians|asin|acos|atan';
  source = source.replace(new RegExp(`\\b(${scalarFns})\\s*\\(([^()]*)\\)\\s*\\.([xyzwrgba]{2,})`, 'g'), '$1($2)');
  // Handle mod with parentheses: mod(a, b).xyz → mod(a, b)
  source = source.replace(/\bmod\s*\(([^()]*)\)\s*\.([xyzwrgba]{2,})/g, 'mod($1)');

  // ── 0a.2. uAspect inverse-aspect swizzles ──
  // MilkDrop's uAspect (vec2: x=aspect, y=inverse-ish) exposes the inverse
  // aspect via .z (1/x), .w (1/y), and .zw (vec2(1)/uAspect). These swizzles
  // are invalid on a vec2 in GLSL, so expand them to the real arithmetic
  // before parsing. (Longest match .zw first; \b prevents .z from matching
  // inside .zw.)
  source = source.replace(/\buAspect\.zw\b/g, '(vec2(1.0)/uAspect)');
  source = source.replace(/\buAspect\.z\b/g, '(1.0/uAspect.x)');
  source = source.replace(/\buAspect\.w\b/g, '(1.0/uAspect.y)');

  // ── 0a.3. Numeric literal swizzles ──
  // `1.0.xy` swizzles a numeric literal, which is invalid GLSL (scalars have
  // no components). Wrap the literal in a vec constructor of the swizzle's
  // width so the swizzle applies to a real vector: 1.0.xy → vec2(1.0).xy.
  source = source.replace(/\b(\d+\.?\d*)\.([xyzwrgba]{2,4})\b/g, (_m, lit, sw) =>
    `vec${sw.length}(${lit}).${sw}`);

  // ── 0a.4. Float-declaration int-literal promotion ──
  // GLSL ES 3.00 forbids implicit int→float conversion, so `float x = 0;`
  // (or `const float x = -1;`) fails to compile. Promote the bare integer
  // initializer to a float literal by appending `.0`. Mirrors the
  // `int-literal-float-decl` rule in milkwaveDiagnostics, whose regex is
  // `\b(?:const\s+)?float\s+\w+\s*=\s*-?\d+\s*;` — we match the same shape and
  // only touch cases where the int literal is the sole initializer directly
  // before `;` (already-float `0.0`, expressions, and multi-declarator lists
  // with a trailing `,` are all left untouched).
  source = source.replace(
    /\b((?:const\s+)?float\s+\w+\s*=\s*-?)(\d+)(\s*;)/g,
    (_m, pre, num, post) => `${pre}${num}.0${post}`
  );

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
  // Args allow ONE level of parenthesized nesting so `multiply(uv3, mat2(a,b,c,d))`
  // keeps the mat2's closing paren (the old `[^)]+` ate it and produced
  // `(mat2(a,b,c,d * v)` — a 5-arg constructor).
  source = source.replace(
    /\bmultiply\s*\(\s*(?!vec[234]|mat[234x])((?:[^(),]|\([^()]*\))+)\s*,\s*((?:[^()]|\([^()]*\))+)\s*\)/g,
    '($2 * $1)'
  );
  // Strip the now-unused multiply function definitions (single-line form)
  source = source.replace(/^vec[234]\s+multiply\s*\([^{}]+\)\s*\{[^}]*\}\s*$/gm, '');
  // Mixed-type comma declarations: `float x, y,\nvec2 a, b;` → split with `;`
  source = source.replace(/,\s*\n\s*(vec[234]|mat[234x]*|float|int|uint|bool|ivec[234]|bvec[234]|uvec[234])\s/g, ';\n$1 ');

  // ── 0b. Strip HLSL sampler declarations ──
  // HLSL sampler declarations (`sampler sampler_pw_noise_lq;`). Must NOT
  // cross newlines — `[^;]+` would match `sampler ` inside a comment and eat
  // through a following `#define ... sampler alias` line to a distant `;`,
  // silently deleting the alias the shader depends on.
  source = source.replace(/\bsampler\s+[^\n;]+;/g, '');

  // ── 0b.5. Move #define statements from inside shader_body to before void main() ──
  // Some presets have #define aliases inside shader_body that need to be moved.
  const mainIdxForMove = source.indexOf('void main()');
  if (mainIdxForMove !== -1) {
    const beforeMain = source.substring(0, mainIdxForMove);
    const afterMain = source.substring(mainIdxForMove);
    // Find #define lines inside main body (after void main() {)
    const mainBrace2 = afterMain.indexOf('{');
    if (mainBrace2 !== -1) {
      const mainBody = afterMain.substring(mainBrace2);
      const definesInside: string[] = [];
      const mainBodyWithoutDefines = mainBody.replace(/^(\s*#define\s+\w+\s+\w+\s*)$/gm, (match) => {
        definesInside.push(match.trim());
        return '';
      });
      if (definesInside.length > 0) {
        // Move defines to before main
        source = beforeMain + definesInside.join('\n') + '\n\n' + afterMain.substring(0, mainBrace2) + mainBodyWithoutDefines;
      }
    }
  }

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
            // File-scope helper functions (HLSL `static` globals pattern,
            // e.g. `vec3 cloud(vec2) { ... sunpos ... }`) reference these
            // names. Moving the whole declaration into main makes the name
            // invisible to the helper → "'sunpos' : undeclared identifier".
            // Split instead: keep a global declaration stub at the original
            // position (`vec2 sunpos;`), and move only the initializer into
            // main as an assignment (`sunpos = vec2(...);`). Globals are
            // assignable from main, and helpers see the assigned value.
            const stub = makeGlobalDeclStub(line);
            if (stub) {
              keepLines.push(stub);
              moveLines.push(stripDeclTypeKeyword(line));
            } else {
              moveLines.push(line);
            }
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
          // The file-scope code collected in moveLines (non-constant global
          // initializers etc.) still has to run. Insert after main's preamble
          // declarations (the moved code may use uv/ret/rad).
          finalAfterMain = insertMovedCode(finalAfterMain, moveLines);
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
          } else {
            // Main already contains real shader code (no shader_body wrapper).
            // The collected file-scope code still has to run — insert after
            // main's preamble declarations (it may use uv/ret/rad).
            finalAfterMain = insertMovedCode(finalAfterMain, moveLines);
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

  // ── 0h. Dangling statement commas → semicolons ──
  // EEL per-pixel code sometimes ends a statement with `,` instead of `;`
  // (`ret = vec3(1.0),\n  ret = mix(...)`). A comma at paren depth 0 that
  // immediately follows a closing `)` and precedes a newline is a statement
  // separator the GLSL parser rejects; convert it to `;`. Commas inside
  // argument lists (depth>0) and declaration commas (`float a, b`, where the
  // comma follows an identifier, not `)`) are left untouched.
  {
    let outStr = '';
    let depth = 0;
    for (let i = 0; i < source.length; i++) {
      const ch = source[i];
      if (ch === '(') depth++;
      else if (ch === ')') depth = depth > 0 ? depth - 1 : 0;
      if (ch === ',' && depth === 0) {
        let p = outStr.length - 1;
        while (p >= 0 && (outStr[p] === ' ' || outStr[p] === '\t')) p--;
        let j = i + 1;
        while (j < source.length && (source[j] === ' ' || source[j] === '\t')) j++;
        if (p >= 0 && outStr[p] === ')' && source[j] === '\n') {
          outStr += ';';
          continue;
        }
      }
      outStr += ch;
    }
    source = outStr;
  }

  // ── 0i. Close unterminated main-body blocks before fragColor ──
  // `while (...) {\n  ...\n  fragColor = ...` leaves the inner block open past
  // the fragColor assignment, unbalancing braces so the AST parse fails. Count
  // brace depth between main's opening `{` and the fragColor assignment; if
  // positive, insert that many `}` lines before fragColor (dedenting the
  // fragColor line to column 0) so the block(s) close and the output assignment
  // sits at main-body scope.
  {
    const mainIdx2 = source.indexOf('void main()');
    if (mainIdx2 !== -1) {
      const openBrace = source.indexOf('{', mainIdx2);
      const fragIdx = source.lastIndexOf('fragColor');
      if (openBrace !== -1 && fragIdx !== -1 && fragIdx > openBrace) {
        const between = source.substring(openBrace + 1, fragIdx);
        let d = 0;
        for (const ch of between) { if (ch === '{') d++; else if (ch === '}') d--; }
        if (d > 0) {
          let lineStart = fragIdx;
          while (lineStart > 0 && source[lineStart - 1] !== '\n') lineStart--;
          const fragLine = source.substring(lineStart);
          source = source.substring(0, lineStart) + '}\n'.repeat(d) + fragLine.replace(/^\s+/, '');
        }
      }
    }
  }

  // ── 0j. Repair truncated function calls with a missing trailing argument ──
  // `mix(a, b,\n  )` — a trailing comma + close paren with no final argument
  // is invalid GLSL. The offline translator sometimes truncates a mix() blend
  // factor. Supply a neutral 0.5 blend factor: `mix(a, b, 0.5)`. Matches a
  // comma at the end of an argument line directly followed by the call's
  // closing `)` (with only whitespace between).
  source = source.replace(/,\s*\)\s*;/g, ', 0.5);');

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
 * Captures LHS of assignments, including swizzle targets like `cnt.xyz = ...`.
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
        } else if (node.left.type === 'postfix') {
          // Handle swizzle assignments like cnt.xyz = ...
          const postfix = node.left as PostfixNode;
          if (postfix.expression && postfix.expression.type === 'identifier') {
            const name = (postfix.expression as IdentifierNode).identifier;
            assignments.add(name);
            if (!assignmentNodes.has(name)) {
              assignmentNodes.set(name, node);
            }
          }
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
  let working = source;
  try {
    ast = parse(working, { stage: 'fragment', quiet: true });
  } catch (err) {
    // Some mashups have source corrupted mid-import: commas where statement
    // semicolons belong (`ret += foo(x),\n`). If the parser died on exactly
    // that, repair depth-0 trailing commas into semicolons and re-parse once.
    if (String(err).includes("Expected \";\" but \",\" found")) {
      working = repairTrailingCommas(working);
      try {
        ast = parse(working, { stage: 'fragment', quiet: true });
      } catch (err2) {
        console.warn('[MilkwaveGlslPatcher] AST parse failed, returning source as-is:', err2);
        return source;
      }
    } else {
      // If parsing fails, return the source as-is (caller will handle fallback)
      console.warn('[MilkwaveGlslPatcher] AST parse failed, returning source as-is:', err);
      return source;
    }
  }

  // ── Pass 0: same-scope redeclaration dedupe ──
  // Mashup presets can concatenate two shaders' global blocks, redeclaring
  // a variable in one scope. Must run before any pass that reads
  // declarations (collectDeclaredNames, typeMap).
  dedupeSameScopeDeclarations(ast);

  // ── Pass 0.1: variables shadowing same-named functions ──
  // `float lum = lum(pic);` declares a local named lum that shadows the
  // lum() helper — every later `lum(...)` call then fails with "function
  // name expected" (GLSL and HLSL agree the variable wins). HLSL-era
  // MilkDrop tolerated nothing here either, but the intent is obvious:
  // keep the function, rename the variable. Renames all non-call
  // references so downstream passes see a consistent name.
  {
    const shadowed = new Set<string>();
    visit(ast, {
      declarator_list: {
        enter: (p) => {
          for (const d of (p.node as DeclaratorListNode).declarations) {
            const decl = d as DeclarationNode;
            if (
              decl.identifier &&
              decl.initializer &&
              (decl.initializer as any).type === 'function_call' &&
              getFnName(decl.initializer as unknown as FunctionCallNode) === decl.identifier.identifier
            ) {
              shadowed.add(decl.identifier.identifier);
              decl.identifier.identifier = decl.identifier.identifier + '_shadow';
            }
          }
        },
      },
    });
    if (shadowed.size > 0) {
      // Function definition names are identifier nodes too — leave those.
      const fnNameNodes = new Set<unknown>();
      visit(ast, {
        function: {
          enter: (p) => {
            fnNameNodes.add((p.node as FunctionNode).prototype.header.name);
          },
        },
      });
      visit(ast, {
        identifier: {
          enter: (p) => {
            if (fnNameNodes.has(p.node)) return;
            if (shadowed.has((p.node as IdentifierNode).identifier)) {
              (p.node as IdentifierNode).identifier += '_shadow';
            }
          },
        },
      });
    }
  }

  const declaredNames = collectDeclaredNames(ast);
  const { assignments, assignmentNodes } = collectIdentifier(ast);

  // ── Build a type map from all declarator lists ──
  // This lets inferDim know the types of declared variables.
  const typeMap = new Map<string, number>();
  const matrixNames = new Set<string>();
  const boolNames = new Set<string>();
  // int-typed names (declarations and function params) — used to wrap int
  // operands into float() when they mix with float expressions (the GLSL ES
  // driver rejects implicit int→float even in `*`, unlike HLSL).
  const intNames = new Set<string>();
  visit(ast, {
    declarator_list: {
      enter: (p) => {
        const kw = getTypeKeyword(p.node);
        const dim = kw === 'float' ? 1 : kw === 'vec2' ? 2 : kw === 'vec3' ? 3 : kw === 'vec4' ? 4 :
                    kw === 'mat2' ? 4 : kw === 'mat3' ? 9 : kw === 'mat4' ? 16 : 0;
        // mat2 shares inferred dim 4 with vec4, but mat*vec is valid GLSL while
        // vec4±vec3 is not — passes that "fix" dim mismatches need to know
        // which is which (see Pass 9's matrix skip).
        const isMat = kw === 'mat2' || kw === 'mat3' || kw === 'mat4';
        for (const d of (p.node as DeclaratorListNode).declarations) {
          const decl = d as DeclarationNode;
          if (decl.identifier) {
            typeMap.set(decl.identifier.identifier, dim);
            if (isMat) matrixNames.add(decl.identifier.identifier);
            if (kw === 'bool') boolNames.add(decl.identifier.identifier);
            if (kw === 'int' || kw === 'uint') intNames.add(decl.identifier.identifier);
          }
        }
      },
    },
  });

  // Also track function return types (and parameter dims for arg splat)
  const userFnParams = new Map<string, number[]>();
  const userFnIntParams = new Map<string, Set<number>>();
  visit(ast, {
    function: {
      enter: (p) => {
        const fn = p.node as FunctionNode;
        const name = fn.prototype.header.name.identifier;
        const retSpec = fn.prototype.header.returnType.specifier.specifier;
        const retKw = retSpec.type === 'keyword' ? retSpec.token : retSpec.type === 'type_name' ? retSpec.identifier : '';
        const dim = retKw === 'float' ? 1 : retKw === 'vec2' ? 2 : retKw === 'vec3' ? 3 : retKw === 'vec4' ? 4 : 0;
        if (name && dim > 0) typeMap.set(name, dim);
        if (name) {
          const collect = (): { dims: number[]; ints: Set<number> } => {
            const dims: number[] = [];
            const ints = new Set<number>();
            (fn.prototype.parameters || []).forEach((param, i) => {
              const pd = (param as unknown as { specifier?: { specifier?: { type?: string; token?: string } } }).specifier;
              const kw = pd?.specifier?.type === 'keyword' ? pd.specifier.token ?? '' : '';
              dims.push(kw === 'float' ? 1 : kw === 'vec2' ? 2 : kw === 'vec3' ? 3 : kw === 'vec4' ? 4 : kw === 'mat2' ? 4 : kw === 'mat3' ? 9 : kw === 'mat4' ? 16 : 0);
              if (kw === 'int') {
                ints.add(i);
                const pname = (param as unknown as { identifier?: { identifier?: string } }).identifier?.identifier;
                if (pname) intNames.add(pname);
              }
            });
            return { dims, ints };
          };
          const sig = collect();
          const prior = userFnParams.get(name);
          // A name defined more than once with DIFFERENT params (overloaded
          // clamp01/lum/multiply) has no single signature — mark ambiguous
          // with [] and never arg-align it. Mashups duplicate identical
          // definitions verbatim; those keep the (identical) signature.
          if (prior !== undefined) {
            if (prior.length !== sig.dims.length || prior.some((d, i) => d !== sig.dims[i])) {
              userFnParams.set(name, []);
              userFnIntParams.set(name, new Set());
            }
          } else {
            userFnParams.set(name, sig.dims);
            userFnIntParams.set(name, sig.ints);
          }
        }
      },
    },
  });

  // ── Pass 1.6: uAspect z/w swizzle expansion ──
  // MilkDrop's `aspect` is a float4 (xy = scale, zw = the inverses) but the
  // patcher header declares `uniform vec2 uAspect`. Presets legitimately
  // write `uAspect.wz` / `uAspect.zw` — out-of-range on a vec2. Expand each
  // component: x→uAspect.x, y→uAspect.y, z→(1.0/uAspect.x), w→(1.0/uAspect.y).
  {
    const mkGroup = (expr: AstNode): AstNode =>
      ({ type: 'group', lp: mkLiteral('('), expression: expr, rp: mkLiteral(')') }) as unknown as AstNode;
    const mkAspectComp = (ch: string): AstNode => {
      const n = 'rgba'.includes(ch) ? 'xyzw'['rgba'.indexOf(ch)] : ch;
      if (n === 'x' || n === 'y') return mkPostfixSwizzle(mkIdentifier('uAspect'), n) as unknown as AstNode;
      const comp = n === 'z' ? 'x' : 'y';
      return mkGroup(mkBinary(mkFloat('1.0', ' '), '/', mkPostfixSwizzle(mkIdentifier('uAspect'), comp) as unknown as AstNode));
    };
    visit(ast, {
      postfix: {
        enter: (p) => {
          const pf = (p.node as PostfixNode).postfix;
          if (!pf || pf.type !== 'field_selection') return;
          const sel = pf as FieldSelectionNode;
          // Multi-char swizzles lex as identifiers (`wz`), single chars as literals.
          const swizzle = sel.selection.type === 'literal'
            ? (sel.selection as LiteralNode).literal
            : sel.selection.type === 'identifier' ? (sel.selection as unknown as IdentifierNode).identifier : '';
          if (!/^[xyzwrgba]{1,4}$/.test(swizzle)) return;
          const expr = (p.node as PostfixNode).expression;
          if (!expr || expr.type !== 'identifier' || (expr as IdentifierNode).identifier !== 'uAspect') return;
          const mapped = swizzle.split('').map((ch) => 'rgba'.includes(ch) ? 'xyzw'['rgba'.indexOf(ch)] : ch).join('');
          if (!/[zw]/.test(mapped)) return; // .xy etc. is valid on the vec2
          if (mapped.length === 1) {
            p.replaceWith(mkAspectComp(mapped));
          } else {
            const args: AstNode[] = [];
            for (const ch of mapped.split('')) {
              if (args.length) args.push(mkLiteral(',') as unknown as AstNode);
              args.push(mkAspectComp(ch));
            }
            p.replaceWith(mkFnCall(`vec${mapped.length}`, args) as unknown as AstNode);
          }
        },
      },
    });
  }

  // ── Pass 1.5: return-expression dimension alignment ──
  // MilkDrop-era HLSL silently truncates a wider return expression to the
  // declared type (float3 → float takes .x) and splats a scalar to the
  // declared vector type. GLSL rejects both ("function return is not
  // matching type"). Rewrite the return expression to the declared dim:
  // wider → swizzle down, narrower scalar → vecN(expr).
  visit(ast, {
    function: {
      enter: (p) => {
        const fn = p.node as FunctionNode;
        const retSpec = fn.prototype.header.returnType.specifier.specifier;
        const retKw = retSpec.type === 'keyword' ? retSpec.token : '';
        const retDim = retKw === 'float' ? 1 : retKw === 'vec2' ? 2 : retKw === 'vec3' ? 3 : retKw === 'vec4' ? 4 : 0;
        if (retDim === 0) return; // void / unknown — leave alone
        visit(fn, {
          return_statement: {
            enter: (rp) => {
              const retStmt = rp.node as ReturnStatementNode;
              if (!retStmt.expression) return;
              const exprDim = inferDim(retStmt.expression as unknown as AstNode, typeMap);
              if (exprDim <= 0 || exprDim === retDim) return;
              if (exprDim > 4 || retDim > 4) return;
              if (exprDim > retDim) {
                (retStmt as any).expression = mkPostfixSwizzle(
                  retStmt.expression as unknown as AstNode,
                  'xyzw'.slice(0, retDim),
                );
              } else {
                (retStmt as any).expression = mkFnCall(
                  `vec${retDim}`,
                  [retStmt.expression as unknown as AstNode],
                  ' ',
                ) as unknown as AstNode;
              }
            },
          },
        });
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

  // Single-letter names that live in `builtins` ONLY to suppress stray swizzle
  // *usages* (e.g. `x`, `y`, `a` read as bare identifiers). When such a name is
  // the target of an assignment (`a = q1; b = q2;`), it is a real variable and
  // must be declared — see the assignments loop below. Field selections like
  // `color.a` parse the component as a literal, not an identifier, so they are
  // not affected by declaring these.
  const swizzleLetters = new Set([
    'i', 'j', 'k', 'n', 'x', 'y', 'z', 'w', 'r', 'g', 'b', 'a', 's', 't', 'p'
  ]);

  // ── Find all identifiers used in expressions ──
  const allUsedIdentifiers = new Set<string>();
  const functionNames = new Set<string>();
  const declaredInFunctions = new Set<string>();
  // `#define` macro names (e.g. `#define base02 sampler_main` — a standard
  // MilkDrop sampler alias) act like declarations: the preprocessor expands
  // them before compilation, so injecting `float base02 = 0.0;` would expand
  // to `float sampler_main = 0.0;` and clobber the sampler uniform.
  const macroNames = new Set<string>();
  visit(ast, {
    identifier: {
      enter: (p) => {
        // Multi-char swizzle components (`.zx`, `.xyz`) parse their selection
        // as an identifier node under a field_selection parent — they are
        // component names, not variables. (Single-char selections parse as
        // literals and never reach here.)
        if (p.parentPath?.node?.type === 'field_selection') return;
        const name = (p.node as IdentifierNode).identifier;
        if (name) allUsedIdentifiers.add(name);
      },
    },
    preprocessor: {
      enter: (p) => {
        const line = (p.node as unknown as { line?: string }).line ?? '';
        const m = /^#\s*define\s+(\w+)/.exec(line);
        if (m) macroNames.add(m[1]);
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
    if (declaredNames.has(name) || macroNames.has(name)) continue;
    // A name assigned as an identifier LHS is a real variable. Only true
    // builtins (gl_FragCoord, sin, uniforms, q1..q32, etc.) are skipped; a name
    // that is "builtin" solely because it is a swizzle letter (a, b, x, ...)
    // is still declared — EEL per-pixel code uses `a = q1; b = q2;` as genuine
    // float variables, and leaving them undeclared is a compile error.
    if (!builtins.has(name) || swizzleLetters.has(name)) {
      undeclared.add(name);
    }
  }
  // Also add used-but-not-declared identifiers (here swizzle letters stay
  // suppressed — a bare `x` read without an assignment is ambiguous).
  for (const name of allUsedIdentifiers) {
    if (!declaredNames.has(name) && !macroNames.has(name) && !builtins.has(name)) {
      undeclared.add(name);
    }
  }

  // ── Infer types for undeclared variables ──
  // Swizzle usage widens the inferred type: `hue_shader.zxy` on an undeclared
  // name requires at least a vec3, no matter what assignment inference says
  // (declared-as-float + multi-char swizzle is the "'zxy' : field selection
  // requires structure, vector, or interface block" family). Component max
  // index gives the true minimum (`.wz` needs a vec4 even though length is 2).
  const swizzleUsageDims = new Map<string, number>();
  visit(ast, {
    postfix: {
      enter: (p) => {
        const pf = (p.node as PostfixNode).postfix;
        if (!pf || pf.type !== 'field_selection') return;
        const sel = pf as FieldSelectionNode;
        const swizzle = sel.selection.type === 'literal'
          ? (sel.selection as LiteralNode).literal
          : sel.selection.type === 'identifier' ? (sel.selection as unknown as IdentifierNode).identifier : '';
        if (!/^[xyzwrgba]+$/.test(swizzle)) return;
        const expr = (p.node as PostfixNode).expression;
        if (!expr || expr.type !== 'identifier') return;
        let dim = 0;
        for (const ch of swizzle) {
          const idx = 'xyzwrgba'.indexOf(ch) % 4;
          dim = Math.max(dim, idx + 1);
        }
        // Any swizzle (even single-char `.x`) implies a vector — a float
        // declaration makes the swizzle a field-selection error. Bare scalar
        // uses of the same name stay legal (vec-scalar arithmetic broadcasts).
        if (swizzle.length >= 1) dim = Math.max(dim, 2);
        const name = (expr as IdentifierNode).identifier;
        swizzleUsageDims.set(name, Math.max(swizzleUsageDims.get(name) ?? 0, dim));
      },
    },
  });

  const inferredTypes = new Map<string, string>();
  for (const name of undeclared) {
    const assignNode = assignmentNodes.get(name);
    if (assignNode) {
      // Infer from RHS dimension
      let dim = inferDim(assignNode.right, typeMap);
      dim = Math.max(dim, swizzleUsageDims.get(name) ?? 0);

      // Also check LHS swizzle dimension (for assignments like cnt.xyz = ...)
      if (assignNode.left.type === 'postfix') {
        const postfix = assignNode.left as PostfixNode;
        if (postfix.postfix && postfix.postfix.type === 'field_selection') {
          const fs = postfix.postfix as FieldSelectionNode;
          const swizzle = fs.selection.type === 'literal'
            ? (fs.selection as LiteralNode).literal
            : '';
          if (/^[xyzwrgba]+$/.test(swizzle) && swizzle.length >= 2) {
            dim = Math.max(dim, swizzle.length);
          }
        }
      }

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
      // Never assigned — a swizzle-using read (`hue_shader.zxy`) still needs a
      // vector declaration, or the `.zxy` fails on the injected float.
      const dim = swizzleUsageDims.get(name) ?? 0;
      if (dim === 2) inferredTypes.set(name, 'vec2');
      else if (dim === 3) inferredTypes.set(name, 'vec3');
      else if (dim === 4) inferredTypes.set(name, 'vec4');
      else inferredTypes.set(name, 'float');
    }
  }

  // Seed typeMap with the injector's inferred types so dim-based passes
  // (6 pow widening, 9 rebalancing, 10.5, 12 mix alignment, ...) agree with
  // the declarations that will be injected post-generation. Without this,
  // `pow(hue_shader, 8.0)` runs Pass 6 while hue_shader is still dim 0 and
  // the widening never fires — then the injector declares it vec3 and the
  // driver rejects pow(vec3, float).
  for (const [name, type] of inferredTypes) {
    if (!typeMap.has(name)) {
      const d = type === 'vec2' ? 2 : type === 'vec3' ? 3 : type === 'vec4' ? 4 : 1;
      typeMap.set(name, d);
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
          // The declaration is now `vec3 ret`; reflect that in the type map so
          // later passes (e.g. Pass 11 vec-constructor arg sizing) infer `ret`
          // as 3 components. Without this, `vec4(ret, 1.0)` (built by Pass 5)
          // reads as 4+1=5 components and Pass 11 swizzles `ret` down to `.xy`,
          // producing the invalid `vec4(ret.xy, 1.0)` (only 3 components).
          typeMap.set(decls[0].identifier.identifier, 3);
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

  // ── Pass 7.5: matching-dim fn scalar arg widening ──
  // dot/cross/distance/reflect require both args to share a dimension, so
  // `dot(vec3, float)` is invalid GLSL. When exactly one arg is scalar (dim 1)
  // and the other is a vector (dim 2-4), widen the scalar to vecN(scalar) so
  // the dimensions match. (refract/faceforward are excluded: their last arg
  // is an intentionally-scalar eta/Nref-like operand, not a matching-dim pair.)
  visit(ast, {
    function_call: {
      enter: (p) => {
        const name = getFnName(p.node);
        if (name !== 'dot' && name !== 'cross' && name !== 'distance' && name !== 'reflect') return;
        const args = getArgs(p.node);
        if (args.length !== 2) return;
        const aDim = inferDim(args[0], typeMap);
        const bDim = inferDim(args[1], typeMap);
        // One side scalar (1), the other a true vector (2-4). Matrices are
        // dim >= 4 in typeMap and are left untouched (a mat operand makes the
        // call a matrix builtin, not something to coerce here).
        const vecDim = Math.max(aDim, bDim);
        if (vecDim < 2 || vecDim > 3) return;
        const allArgs = p.node.args;
        if (aDim === 1 && bDim >= 2 && bDim <= 3) {
          const idx = allArgs.indexOf(args[0]);
          if (idx !== -1) allArgs[idx] = mkFnCall(`vec${bDim}`, [args[0]], ' ') as unknown as AstNode;
        } else if (bDim === 1 && aDim >= 2 && aDim <= 3) {
          const idx = allArgs.indexOf(args[1]);
          if (idx !== -1) allArgs[idx] = mkFnCall(`vec${aDim}`, [args[1]], ' ') as unknown as AstNode;
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
          // Use the variable's declared dimension when available. The
          // VEC3_VARS heuristic assumes vec3, but a variable can be declared
          // vec4 (e.g. `vec4 color = vec4(0.0)`); wrapping its scalar RHS as
          // vec3 and then letting Pass 10.5 pad to vec4 produces
          // `vec4(vec3(1.0), 0.0)` (alpha 0.0). vecN(scalar) broadcasts the
          // scalar to all N components, so `color = 1.0` → `vec4(1.0)` (alpha
          // 1.0). Falls back to 3 for undeclared EEL per-pixel vars.
          const targetDim = typeMap.get(varName) ?? 3;
          if (targetDim >= 2) {
            (p.node as any).right = mkFnCall(`vec${targetDim}`, [right], ' ') as unknown as AstNode;
          }
        }
      },
    },
  });

  // ── Pass 8.5: vec2-context binary lowering ──
  // A vec2 assignment/declaration whose RHS is built from vec3-returning calls
  // (GetPixel/GetBlurN/GetMain) and scalars otherwise comes out as vec3 and is
  // assigned to a vec2 target — invalid GLSL. Lower the whole RHS to vec2 in
  // place: swizzle each vec3-returning call to .xy, and widen a bare scalar
  // +/- operand to vec2(scalar). `*`/`/` scalar multipliers stay scalar
  // (component-wise), and existing swizzles are left alone. Runs before Pass 9
  // so the rebalancer sees matching vec2 dims and does not pad to vec3.
  const lowerToVec2 = (node: AstNode): AstNode => {
    if (!node) return node;
    switch (node.type) {
      case 'postfix':
        // Already swizzled/indexed — never add a second swizzle.
        return node;
      case 'function_call': {
        const fn = getFnName(node as FunctionCallNode);
        if (VEC3_FNS.has(fn)) {
          return mkPostfixSwizzle(node, 'xy') as unknown as AstNode;
        }
        return node;
      }
      case 'group': {
        (node as any).expression = lowerToVec2((node as any).expression);
        // A widened `vecN(scalar)` at the very start of the group has no
        // leading whitespace of its own (function_call emits none), so the
        // space before it must live on the group's `(`. If the group's
        // expression now begins with such a widened scalar call, add it.
        let leaf: AstNode | undefined = (node as any).expression;
        while (leaf && (leaf.type === 'binary' || leaf.type === 'group' || leaf.type === 'unary')) {
          leaf = (leaf as any).type === 'group' || (leaf as any).type === 'unary'
            ? (leaf as any).expression
            : (leaf as any).left;
        }
        if (leaf && leaf.type === 'function_call') {
          const fn = getFnName(leaf as FunctionCallNode);
          const la = getArgs(leaf as FunctionCallNode);
          if ((fn === 'vec2' || fn === 'vec3') && la.length === 1 && inferDim(la[0], typeMap) === 1) {
            ((node as any).lp as any).whitespace = ' ';
          }
        }
        return node;
      }
      case 'unary': {
        (node as any).expression = lowerToVec2((node as any).expression);
        return node;
      }
      case 'binary': {
        const bn = node as BinaryNode;
        const bop = bn.operator.literal;
        if (['+', '-', '*', '/'].includes(bop)) {
          bn.left = lowerToVec2(bn.left);
          bn.right = lowerToVec2(bn.right);
          if (bop === '+' || bop === '-') {
            const lDim = inferDim(bn.left, typeMap);
            const rDim = inferDim(bn.right, typeMap);
            // Only widen a bare scalar +/- operand; `scalar * vec2` stays scalar.
            if (lDim === 1 && rDim >= 2 && rDim <= 3) {
              const widened = mkFnCall('vec2', [bn.left], ' ') as unknown as FunctionCallNode;
              (widened.rp as any).whitespace = ' ';
              bn.left = widened as unknown as AstNode;
              (bn.operator as any).whitespace = ' ';
            } else if (rDim === 1 && lDim >= 2 && lDim <= 3) {
              bn.right = mkFnCall('vec2', [bn.right], ' ') as unknown as AstNode;
              (bn.operator as any).whitespace = ' ';
            }
          }
        }
        return bn;
      }
      default:
        return node;
    }
  };

  visit(ast, {
    assignment: {
      enter: (p) => {
        const a = p.node as AssignmentNode;
        if (a.left.type !== 'identifier') return;
        if (inferDim(a.left, typeMap) !== 2) return;
        a.right = lowerToVec2(a.right);
      },
    },
    declarator_list: {
      enter: (p) => {
        if (getTypeKeyword(p.node) !== 'vec2') return;
        for (const d of (p.node as DeclaratorListNode).declarations) {
          const decl = d as DeclarationNode;
          if (decl.initializer) {
            decl.initializer = lowerToVec2(decl.initializer as unknown as AstNode) as any;
          }
        }
      },
    },
  });

  // ── Pass 9: Binary Dimension Rebalancing ──
  // When vecA op vecB where dims don't match, wrap the smaller side in a vec constructor
  // to match the larger side. e.g. vec3 + vec2 → vec3 + vec3(vec2, 0.0)
  // Note: This can cause issues with texture() coordinates. Pass 9.1 fixes that.
  // Matrix operands are skipped (mat*vec is valid GLSL), but a *known matrix*
  // must not shield a genuine vec4/vec3 mismatch from truncation.
  const isMatrixExpr = (node: AstNode): boolean => {
    if (node.type === 'identifier') return matrixNames.has((node as IdentifierNode).identifier);
    if (node.type === 'function_call') {
      const fn = getFnName(node as FunctionCallNode);
      return fn === 'mat2' || fn === 'mat3' || fn === 'mat4' || /^mat[234]x[234]$/.test(fn);
    }
    if (node.type === 'group') return isMatrixExpr((node as unknown as { expression: AstNode }).expression);
    return false;
  };

  // Dim inference that understands mat*vec results: typeMap stores mat2 as
  // 4 (conflated with vec4), so `(rot * uv) - vec4(0.5)` infers the left as
  // 4 and Pass 9 misses the real vec2-vs-vec4 mismatch. A matN * vecK
  // product has the VECTOR's dim (mat*mat keeps the left's).
  const inferDimMatAware = (node: AstNode): number => {
    if (node.type === 'group') return inferDimMatAware((node as unknown as { expression: AstNode }).expression);
    if (node.type === 'unary') return inferDimMatAware((node as unknown as { expression: AstNode }).expression);
    if (node.type === 'binary') {
      const b = node as BinaryNode;
      if (b.operator?.literal === '*') {
        const lm = isMatrixExpr(b.left);
        const rm = isMatrixExpr(b.right);
        if (lm && !rm) {
          const d = inferDim(b.right, typeMap);
          return d >= 2 && d <= 4 ? d : inferDimMatAware(b.left);
        }
        if (rm && !lm) {
          const d = inferDim(b.left, typeMap);
          return d >= 2 && d <= 4 ? d : inferDimMatAware(b.right);
        }
        if (lm && rm) return inferDim(b.left, typeMap);
      }
      // Recurse so an outer op sees the dim AFTER inner rebalancing
      // (`((rot*uv) - vec2(0.5)) + vec4(0.5)` — the inner fix shrank it).
      return Math.max(inferDimMatAware(b.left), inferDimMatAware(b.right));
    }
    return inferDim(node, typeMap);
  };

  // ── Pass 8.9: multiply(mat, vec) → mat * vec ──
  // Presets declare `multiply(vecN v, matN m)` helpers but CALL them with
  // the arguments reversed (`rs = multiply(mat2(...), rs)`) — no overload
  // matches in GLSL. The product is the same either way, so inline it.
  visit(ast, {
    function_call: {
      enter: (p) => {
        const name = getFnName(p.node);
        if (name !== 'multiply') return;
        const args = getArgs(p.node);
        if (args.length !== 2) return;
        if (!isMatrixExpr(args[0]) || isMatrixExpr(args[1])) return;
        // Non-square: preprocess maps HLSL `float2x3` (2 ROWS) to GLSL
        // `mat2x3` (2 COLUMNS), so the GLSL matrix is the transpose of the
        // HLSL one — mul(M, v) = rows(M)·v = transpose(glMat) * v, which
        // yields the vecR the HLSL preset expects.
        const callName = args[0].type === 'function_call' ? getFnName(args[0] as FunctionCallNode) : '';
        const nx = /^mat([234])x([234])$/.exec(callName);
        if (nx && nx[1] !== nx[2]) {
          const tr = mkFnCall('transpose', [args[0]], ' ') as unknown as AstNode;
          p.replaceWith(mkBinary(tr, '*', args[1]) as unknown as AstNode);
          return;
        }
        p.replaceWith(mkBinary(args[0], '*', args[1]) as unknown as AstNode);
      },
    },
  });
  visit(ast, {
    binary: {
      // Bottom-up: an outer `+` must see the dims AFTER its inner operands
      // were rebalanced (e.g. `(vec2 + .1*float4) + .1*uTime` — the inner
      // vec4 gets truncated to .xy, so the outer scalar widens to vec2,
      // not vec4). Top-down would widen on the stale pre-truncation dim.
      exit: (p: Path<BinaryNode>) => {
        const left = p.node.left;
        const right = p.node.right;
        const op = p.node.operator.literal;
        if (!['+', '-', '*', '/'].includes(op)) return;

        const leftDim = inferDimMatAware(left);
        const rightDim = inferDimMatAware(right);
        if (leftDim === 0 || rightDim === 0) return;
        // Skip matrix operands — mat*vec is valid GLSL. Only mat2 shares dim 4
        // with vec4; mat3/mat4 (9/16) are excluded below.
        if (isMatrixExpr(left) || isMatrixExpr(right)) return;
        if (leftDim > 4 || rightDim > 4) return;
        if (leftDim === rightDim) return;
        if (leftDim === 1 || rightDim === 1) {
          // `vec * scalar` / `vec / scalar` (and the reverse) are valid GLSL
          // applied component-wise — leave them alone. But `scalar +/- vec` is
          // not portable across GLSL ES drivers, so widen the scalar operand to
          // vecN(scalar). Matrices are dim >= 4 and already excluded above, so
          // the non-scalar side here is a true vector (dim 2 or 3).
          if (op === '*' || op === '/') return;
          const vecDim = Math.max(leftDim, rightDim);
          const vecType = `vec${vecDim}`;
          if (leftDim === 1) {
            const widened = mkFnCall(vecType, [left], ' ') as unknown as FunctionCallNode;
            // glsl-parser stores whitespace as TRAILING; a function_call emits
            // its closing `)` (rp) last, so the space before the operator lives
            // on rp.whitespace. operator.whitespace is the space after it.
            (widened.rp as any).whitespace = ' ';
            p.node.left = widened as unknown as AstNode;
            (p.node.operator as any).whitespace = ' ';
          } else {
            p.node.right = mkFnCall(vecType, [right], ' ') as unknown as AstNode;
            (p.node.operator as any).whitespace = ' ';
          }
          return;
        }

        // For vec2 + vec4 or vec3 + vec4, truncate the wider operand instead of padding
        // This preserves semantics better than padding with zeros
        const maxDim = Math.max(leftDim, rightDim);
        const minDim = Math.min(leftDim, rightDim);

        if (maxDim === 4 && minDim >= 2) {
          // Truncate vec4 to vec2/vec3 using swizzle
          const swizzle = minDim === 2 ? 'xy' : 'xyz';
          if (leftDim === 4) {
            p.node.left = mkPostfixSwizzle(left, swizzle) as unknown as AstNode;
          } else {
            p.node.right = mkPostfixSwizzle(right, swizzle) as unknown as AstNode;
          }
          return;
        }

        // Otherwise wrap the smaller side in a vec constructor with padding
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

  // ── Pass 9.1: texture() coordinate dimension fix ──
  // Pass 9's binary rebalancing (and the offline translator) can produce
  // `texture(sampler, vec3-coord)`. Every sampler in the milkdrop pipeline is
  // 2D (`sampler_noisevol_*` are aliased down to 2D noise samplers by
  // injectMissingSamplers), so a coord wider than vec2 has no matching overload.
  // Swizzle the coordinate down to `.xy`.
  // Shader-declared helpers with the same names (textureBias(vec4), textureLod4)
  // define their own prototypes and must be left alone — `declaredNames`
  // contains user function names, builtins like `texture` are never in it.
  visit(ast, {
    function_call: {
      enter: (p) => {
        const name = getFnName(p.node);
        if (name !== 'texture' && name !== 'textureLod' && name !== 'textureBias') return;
        if (declaredNames.has(name)) return;
        const args = getArgs(p.node);
        if (args.length < 2) return;
        // Any identifier is an acceptable first arg: MilkDrop presets name
        // their samplers freely (base02, sampler_fw_main, ...) and the old
        // `/^sampler_\w+$/` restriction here let free-named samplers fall
        // through to a post-gen regex that corrupted nested coord expressions.
        // Shader-declared helpers are excluded above via declaredNames; the
        // remaining calls are the real builtin, whose samplers are all 2D.
        const sampler = args[0];
        if (sampler.type !== 'identifier') return;
        const coordDim = inferDim(args[1], typeMap);
        const allArgs = (p.node as FunctionCallNode).args;
        if (coordDim === 1) {
          // HLSL tex2D splats a scalar coord to float2 (`tex2D(s, n*0.074+q25)`);
          // GLSL has no implicit scalar→vec2 for texture coords.
          for (let i = 0; i < allArgs.length; i++) {
            if (allArgs[i] === args[1]) {
              allArgs[i] = mkFnCall('vec2', [args[1]], ' ') as unknown as AstNode;
              break;
            }
          }
          return;
        }
        if (coordDim <= 2) return;
        for (let i = 0; i < allArgs.length; i++) {
          if (allArgs[i] === args[1]) {
            allArgs[i] = mkPostfixSwizzle(args[1], 'xy') as unknown as AstNode;
            break;
          }
        }
      },
    },
  });

  // ── Pass 9.1b: scalar args to MilkDrop sampler-lookup helpers ──
  // The offline translator emits `GetBlur1(0.0)` / `GetBlur1(uv_y)` — a scalar
  // passed to helpers whose declared signature is `vec3 GetBlur1(vec2 uv)`.
  // No matching overload → compile failure ("'GetBlur1' : no matching
  // overloaded function"). Coerce the scalar into a vec2 broadcast, the same
  // implicit conversion MilkDrop's compiler performed.
  const samplerLookupFns = new Set(['GetPixel', 'GetMain', 'GetBlur1', 'GetBlur2', 'GetBlur3']);
  visit(ast, {
    function_call: {
      enter: (p) => {
        const name = getFnName(p.node);
        if (!samplerLookupFns.has(name)) return;
        const args = getArgs(p.node);
        if (args.length === 0) return;
        const first = args[0];
        // >1 is already valid; 1 (scalar) broadcasts, and 0 (undeclared —
        // the auto-declare injector will pick a type) is safe either way:
        // vec2(vec2) is a copy ctor and vec2(float) broadcasts.
        if (inferDim(first, typeMap) > 1) return;
        const allArgs = (p.node as FunctionCallNode).args;
        for (let i = 0; i < allArgs.length; i++) {
          if (allArgs[i] === first) {
            allArgs[i] = mkFnCall('vec2', [first], ' ') as unknown as AstNode;
            break;
          }
        }
      },
    },
  });

  // ── Pass 9.2: component-wise builtin arg dimension alignment ──
  // `max(GetPixel(uv3), GetBlur1(uv3).xy)` — vec3 vs vec2 has no GLSL overload.
  // HLSL's implicit float2→float3 conversion pads missing components with 0,
  // so pad the narrower argument up to the wider one's dimension.
  const componentwiseFns = new Set(['max', 'min', 'pow', 'mod', 'mix']);
  visit(ast, {
    function_call: {
      enter: (p) => {
        const name = getFnName(p.node);
        if (!componentwiseFns.has(name)) return;
        const args = getArgs(p.node);
        // mix(a, b, t): only align the two value args; t is scalar-tolerant.
        const alignArgs = name === 'mix' && args.length === 3 ? [args[0], args[1]] : args;
        if (alignArgs.length !== 2) return;
        const leftDim = inferDim(alignArgs[0], typeMap);
        const rightDim = inferDim(alignArgs[1], typeMap);
        // HLSL splats a scalar operand of component-wise fns (pow(2.0, ret),
        // pow(hue_shader, ret)) — GLSL needs both sides the same dim.
        if ((leftDim === 1 && rightDim >= 2) || (rightDim === 1 && leftDim >= 2)) {
          const scalarIdx = leftDim === 1 ? 0 : 1;
          const wideDim = Math.max(leftDim, rightDim);
          const splat = mkFnCall(`vec${wideDim}`, [alignArgs[scalarIdx]], ' ') as unknown as AstNode;
          const all = (p.node as FunctionCallNode).args;
          for (let i = 0; i < all.length; i++) {
            if (all[i] === alignArgs[scalarIdx]) {
              all[i] = splat;
              break;
            }
          }
          return;
        }
        if (leftDim < 2 || rightDim < 2 || leftDim === rightDim) return;
        if (isMatrixExpr(args[0]) || isMatrixExpr(args[1])) return;
        // pad the NARROWER argument up to the wider dimension
        const narrow = leftDim > rightDim ? 1 : 0;
        const wideDim = Math.max(leftDim, rightDim);
        const paddingArgs: AstNode[] = [args[narrow]];
        for (let i = Math.min(leftDim, rightDim); i < wideDim; i++) {
          paddingArgs.push(mkLiteral(',') as unknown as AstNode);
          paddingArgs.push(mkFloat('0.0') as unknown as AstNode);
        }
        const padded = mkFnCall(`vec${wideDim}`, paddingArgs, ' ') as unknown as AstNode;
        const allArgs = (p.node as FunctionCallNode).args;
        for (let i = 0; i < allArgs.length; i++) {
          if (allArgs[i] === args[narrow]) {
            allArgs[i] = padded;
            break;
          }
        }
      },
    },
  });
  // MilkDrop's per-frame rotation matrices (rot_uf1 & friends) are injected as
  // `uniform mat4` AFTER generation, so every AST pass sees them as unknown
  // identifiers and a translated `rot_uf1 * s` (vec3) reaches the driver —
  // no mat4×vec3 overload exists. Promote the vector operand to the matrix's
  // row count (padding with 0.0/1.0 like a point transform) and swizzle the
  // product back down so downstream expression dims are unchanged:
  //   rot_uf1 * s      → (rot_uf1 * vec4(s, 0.0, 1.0)).xyz
  // matN * vecN (valid) and mat * scalar (component-wise) are left alone.
  const matRowCount = (node: AstNode): number => {
    // `-rot_d2 * s` parses as (-rot_d2) * s — unwrap unary minus first
    if (node.type === 'unary') return matRowCount((node as unknown as { expression: AstNode }).expression);
    if (node.type === 'identifier') {
      const name = (node as IdentifierNode).identifier;
      if (/^rot_(?:s|d|f|vf|uf|rand)[1-4]$/.test(name)) return 4;
      const dim = typeMap.get(name) ?? 0;
      return dim >= 16 ? 4 : dim >= 9 ? 3 : dim >= 4 ? 2 : 0;
    }
    if (node.type === 'function_call') {
      const fn = getFnName(node as FunctionCallNode);
      return fn === 'mat4' ? 4 : fn === 'mat3' ? 3 : fn === 'mat2' ? 2 : 0;
    }
    return 0;
  };
  visit(ast, {
    binary: {
      enter: (p: Path<BinaryNode>) => {
        if (p.node.operator.literal !== '*') return;
        const left = p.node.left;
        const right = p.node.right;
        const rows = matRowCount(left);
        if (rows === 0 || isMatrixExpr(right)) return;
        // mat * scalar is valid component-wise — only genuine narrow vectors
        // (dim 2..rows-1) need promotion.
        const rDim = inferDim(right, typeMap);
        if (rDim < 2 || rDim >= rows) return;
        const paddingArgs: AstNode[] = [right];
        for (let i = rDim; i < rows; i++) {
          paddingArgs.push(mkLiteral(',') as unknown as AstNode);
          paddingArgs.push(mkFloat(i === rows - 1 ? '1.0' : '0.0') as unknown as AstNode);
        }
        p.node.right = mkFnCall(`vec${rows}`, paddingArgs, ' ') as unknown as AstNode;
        // Narrow the product back to the operand's dim so downstream passes
        // infer the same dimension the original expression had.
        const narrowed = mkPostfixSwizzle(p.node, rDim === 2 ? 'xy' : 'xyz') as unknown as AstNode;
        const parent = p.parentPath?.node as any;
        if (parent) {
          for (const key of Object.keys(parent)) {
            const value = parent[key];
            if (Array.isArray(value)) {
              const idx = value.indexOf(p.node);
              if (idx !== -1) {
                value[idx] = narrowed;
                return;
              }
            } else if (value === p.node) {
              parent[key] = narrowed;
              return;
            }
          }
        }
      },
    },
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

        // Multi-declarator lists (`vec3 a = 0, b = 1;`) share one type keyword,
        // so the float→vecN type *change* only fires when a single declaration
        // would be rewritten. But the vecN-broadcast *wrap*
        // (`vecX x = scalar` → `vecX x = vecX(scalar)`) needs no type change
        // and can safely be applied per declaration.
        if (decls.length > 1) {
          for (const d of decls) {
            const decl = d as DeclarationNode;
            if (!decl.initializer) continue;
            if (declaredDim < 2) continue;
            if (inferDim(decl.initializer, typeMap) !== 1) continue;
            decl.initializer = mkFnCall(`vec${declaredDim}`, [decl.initializer as unknown as AstNode], ' ') as unknown as AstNode;
          }
          return;
        }

        if (decls.length !== 1) return;
        const decl = decls[0] as DeclarationNode;
        if (!decl.initializer) return;

        const initDim = inferDim(decl.initializer, typeMap);
        // `float mask = (z <= 1);` — a scalar declaration whose initializer is
        // a VECTOR comparison. Widening the type to vecN (below) poisons every
        // later scalar use (`(1.0-mask)*vec3`); the HLSL semantic is a
        // scalar bool→float, so collapse with any() instead.
        const unwrapGroup = (n: AstNode): AstNode =>
          n.type === 'group' ? unwrapGroup((n as unknown as { expression: AstNode }).expression) : n;
        const isCmpExpr = (n: AstNode): boolean => {
          const u = unwrapGroup(n);
          return u.type === 'binary' && ['<', '>', '<=', '>=', '==', '!='].includes((u as BinaryNode).operator?.literal ?? '');
        };
        if (declaredDim === 1 && initDim >= 2 && isCmpExpr(decl.initializer as unknown as AstNode)) {
          decl.initializer = mkFnCall('float', [
            mkFnCall('any', [decl.initializer as unknown as AstNode], ' ') as unknown as AstNode,
          ], ' ') as unknown as AstNode;
          return;
        }
        if (declaredDim === 1 && initDim >= 2) {
          // float x = vec_expr → vecX x = vec_expr — BUT only when a later
          // use of x requires vector-ness (a translator artifact downgraded
          // the declaration). Valid HLSL truncates on assignment
          // (`float mod = sin(vec2)` keeps mod scalar, taking .x) and the
          // variable is then used as a scalar. Detect the artifact via any
          // swizzle beyond the first component on the variable.
          const varName = decl.identifier.identifier;
          let needsVector = false;
          visit(ast, {
            postfix: {
              enter: (pp) => {
                if (needsVector) return;
                const pn = pp.node as PostfixNode;
                const e = pn.expression;
                if (!e || e.type !== 'identifier' || (e as IdentifierNode).identifier !== varName) return;
                let cur: AstNode | undefined = pn.postfix as unknown as AstNode;
                while (cur) {
                  let fs: FieldSelectionNode | undefined;
                  if (cur.type === 'field_selection') {
                    fs = cur as FieldSelectionNode;
                    cur = undefined;
                  } else if (cur.type === 'postfix') {
                    const inner = (cur as PostfixNode).expression;
                    if (inner && inner.type === 'field_selection') fs = inner as FieldSelectionNode;
                    cur = (cur as PostfixNode).postfix as unknown as AstNode;
                  } else break;
                  if (!fs) continue;
                  const sw = fs.selection.type === 'literal'
                    ? (fs.selection as LiteralNode).literal
                    : fs.selection.type === 'identifier' ? (fs.selection as unknown as IdentifierNode).identifier : '';
                  for (const ch of sw) {
                    if ('xyzwrgba'.indexOf(ch) % 4 > 0) {
                      needsVector = true;
                      return;
                    }
                  }
                }
              },
            },
          });
          if (!needsVector) {
            // HLSL implicit truncation: keep the declaration scalar.
            decl.initializer = mkPostfixSwizzle(decl.initializer as unknown as AstNode, 'x') as unknown as AstNode;
            return;
          }
          const newType = initDim === 2 ? 'vec2' : initDim === 3 ? 'vec3' : 'vec4';
          const spec = node.specified_type.specifier.specifier;
          if (spec.type === 'keyword') (spec as any).token = newType;
          typeMap.set(decl.identifier.identifier, initDim);
        } else if (declaredDim >= 2 && initDim === 1) {
          // vecX x = scalar_expr → vecX x = vecX(scalar_expr)
          // Promote the scalar initializer to the declared vector dimension
          // rather than silently downgrading the variable's declared type to
          // float. Downgrading changes the variable's type and breaks later
          // vector uses (e.g. `vec3(uv2, 0.0)` reading uv2 as a scalar). vecN
          // with a single scalar arg broadcasts it to all N components, so
          // `vec2 uv2 = 0.5` → `vec2 uv2 = vec2(0.5)` and the declared vec2
          // type is preserved.
          const vecType = `vec${declaredDim}`;
          decl.initializer = mkFnCall(vecType, [decl.initializer as unknown as AstNode], ' ') as unknown as AstNode;
        } else if (declaredDim >= 2 && initDim > declaredDim && !isMatrixExpr(decl.initializer as unknown as AstNode)) {
          // vecN x = wider_expr → swizzle the initializer down. A narrow
          // declaration silently truncates in MilkDrop/HLSL but is a
          // `'=' : dimension mismatch` in GLSL (`vec2 tex = bl*ret.xyz`).
          // Matrices swizzle differently (vecN(mat) constructors, separate
          // family) — leave them to the mat passes.
          const swizzle = declaredDim === 2 ? 'xy' : 'xyz';
          decl.initializer = mkPostfixSwizzle(decl.initializer as unknown as AstNode, swizzle) as unknown as AstNode;
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
        // Plain `=` also ends with '=' — exclude it, or scalar→vecN
        // assignments take the zero-padding path and emit
        // `vec3(vec3_expr, 0.0, 0.0)` (too many constructor args) instead of
        // the broadcast `vecN(scalar)` / pass-through the HLSL semantics use.
        const isCompound = op.literal.length > 1 && op.literal.endsWith('=');

        const left = p.node.left;
        if (left.type !== 'identifier') return;
        const varName = (left as IdentifierNode).identifier;
        // Matrix LHS: typeMap conflates mat2→4 with vec4, but padding/
        // swizzling a matrix RHS against that dim produces vec4(mat2*4.0,...)
        // garbage. Matrix assignments keep their own arithmetic.
        if (matrixNames.has(varName)) return;
        let varDim = typeMap.get(varName) || 0;

        const right = p.node.right;
        const rightDim = inferDim(right, typeMap);
        if (rightDim === 0 || rightDim === varDim) return;

        if (rightDim > varDim) {
          // Swizzling a matrix down (`mat2_expr.xy`) is not valid GLSL field
          // selection on matrices — leave these for the matrix passes.
          if (isMatrixExpr(right)) return;
          // Swizzle down: vecX → smaller. Only do this when the LHS dimension is
          // KNOWN (>=1). When varDim is 0 the variable is undeclared (e.g. EEL
          // per-pixel vars like `ag = ang + 3.1415;` or `zm = -.45;`) and we
          // cannot know its target type. The previous code swizzled a scalar
          // RHS down to `.x` whenever the LHS was unknown, producing invalid
          // GLSL like `ag = (ang + 3.1415).x;` and `zm = -.45.x;` — a scalar
          // swizzled to `.x` is a compile error. An unknown LHS assigned a
          // scalar is left alone (the auto-declare pass declares it float).
          if (varDim === 0) return;
          const swizzle = varDim === 1 ? 'x' : varDim === 2 ? 'xy' : 'xyz';
          p.node.right = mkPostfixSwizzle(right, swizzle) as unknown as AstNode;
        } else if (!isCompound && varDim >= 2 && rightDim === 1) {
          // vec3_var = scalar_expr → vec3_var = vec3(scalar_expr).
          // GLSL has no implicit scalar→vector assignment; MilkDrop did.
          p.node.right = mkFnCall(`vec${varDim}`, [right], ' ') as unknown as AstNode;
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

        // Convert integer literal initializers to float — including NESTED
        // ones (`int mask = (c.y>0);` has the 0 inside a group/binary).
        for (const decl of node.declarations) {
          const d = decl as DeclarationNode;
          if (d.initializer) {
            visit(d.initializer as unknown as AstNode, {
              int_constant: {
                enter: (ip) => {
                  (ip.node as any).type = 'float_constant';
                  (ip.node as any).token = ((ip.node as any).token || '0') + '.0';
                },
              },
            });
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

  // ── Pass 10.7: Vector comparison operators ──
  // MilkDrop/HLSL allows `vec >= vec` component-wise (bool→float in
  // arithmetic contexts, "any" semantics in conditions). GLSL only defines
  // comparisons for scalars, so rewrite:
  //   arithmetic: `noise *= (noise >= .0)` → vecN(greaterThanEqual(a, b))
  //   condition:  `if (noise >= x)`       → any(greaterThanEqual(a, b))
  // Scalar operands are widened via the broadcasting vecN(scalar) constructor.
  const CMP_FNS: Record<string, string> = {
    '<': 'lessThan', '>': 'greaterThan',
    '<=': 'lessThanEqual', '>=': 'greaterThanEqual',
    '==': 'equal', '!=': 'notEqual',
  };
  const conditionStatementTypes = new Set([
    'if_statement', 'while_statement', 'for_statement', 'do_statement',
  ]);
  const isInConditionSlot = (p: Path<BinaryNode>): boolean => {
    const parent = p.parentPath?.node as any;
    if (!parent) return false;
    if (conditionStatementTypes.has(parent.type)) return true;
    // A bare ternary condition: `a >= b ? x : y`.
    if (parent.type === 'ternary') return parent.expression === p.node;
    // `(a >= b)` in a condition parses the binary under a group node whose
    // parent is the statement (or the ternary's condition slot).
    if (parent.type === 'group') {
      const grand = p.parentPath?.parentPath?.node as any;
      if (grand && conditionStatementTypes.has(grand.type)) return true;
      if (grand && grand.type === 'ternary' && grand.expression === parent) return true;
      return false;
    }
    return false;
  };
  const replaceInParent = (p: Path<BinaryNode>, replacement: AstNode): boolean => {
    const parent = p.parentPath?.node as any;
    if (!parent) return false;
    for (const key of Object.keys(parent)) {
      const value = parent[key];
      if (Array.isArray(value)) {
        const idx = value.indexOf(p.node);
        if (idx !== -1) {
          value[idx] = replacement;
          return true;
        }
      } else if (value === p.node) {
        parent[key] = replacement;
        return true;
      }
    }
    return false;
  };
  visit(ast, {
    binary: {
      enter: (p: Path<BinaryNode>) => {
        const op = p.node.operator.literal;
        if (!(op in CMP_FNS)) return;
        const leftDim = inferDim(p.node.left, typeMap);
        const rightDim = inferDim(p.node.right, typeMap);
        const dim = Math.max(leftDim, rightDim);
        if (dim <= 1) return;

        let left = p.node.left;
        let right = p.node.right;
        // Broadcast scalar operands up to the comparison dimension. Unknown
        // dims (0) are left alone — the comparison only fires when at least
        // one side is a known vector.
        if (leftDim === 1 && dim > 1) left = mkFnCall(`vec${dim}`, [left], ' ') as unknown as AstNode;
        if (rightDim === 1 && dim > 1) right = mkFnCall(`vec${dim}`, [right], ' ') as unknown as AstNode;

        const cmp = mkFnCall(CMP_FNS[op], [left, mkLiteral(',') as unknown as AstNode, right], ' ') as unknown as FunctionCallNode;
        // Already inside `any(...)` (e.g. Pass 10's scalar-decl collapse
        // emitted `float mask = any((z <= 1))`): the bare comparison is the
        // correct replacement — wrapping again would nest any(any(...)) or
        // any(vec2(lessThan(...))).
        const inAnyCall = (() => {
          let ctx: Path<any> | undefined = p.parentPath;
          while (ctx && ctx.node.type === 'group') ctx = ctx.parentPath;
          const parent = ctx?.node as any;
          return parent?.type === 'function_call' && getFnName(parent as FunctionCallNode) === 'any';
        })();
        const replacement = inAnyCall
          ? (cmp as unknown as AstNode)
          : isInConditionSlot(p)
            ? mkFnCall('any', [cmp as unknown as AstNode, ], ' ')
            : mkFnCall(`vec${dim}`, [cmp as unknown as AstNode], ' ');
        replaceInParent(p, replacement as unknown as AstNode);
      },
    },
  });

  // ── Pass 10.75: bools in arithmetic / float slots ──
  // HLSL implicitly converts bool→float (0.0/1.0) in arithmetic
  // (`vec3 * mask`, `(a > b) * c`) and in float assignments/declarations.
  // GLSL has no such conversion — wrap the bool operand in `float(...)`,
  // which then broadcasts against vectors naturally.
  const isBoolExpr = (node: AstNode | undefined | null): boolean => {
    if (!node) return false;
    if (node.type === 'identifier') return boolNames.has((node as IdentifierNode).identifier);
    if (node.type === 'binary') {
      const op = (node as BinaryNode).operator?.literal;
      return typeof op === 'string' && ['<', '>', '<=', '>=', '==', '!=', '&&', '||', '^^'].includes(op);
    }
    if (node.type === 'group') return isBoolExpr((node as unknown as { expression?: AstNode }).expression);
    return false;
  };
  visit(ast, {
    binary: {
      enter: (p) => {
        const op = p.node.operator.literal;
        if (!['+', '-', '*', '/', '%'].includes(op)) return;
        for (const side of ['left', 'right'] as const) {
          const operand = p.node[side];
          if (operand && isBoolExpr(operand)) {
            (p.node as unknown as Record<string, unknown>)[side] =
              mkFnCall('float', [operand], ' ') as unknown as AstNode;
          }
        }
      },
    },
  });
  // The mirror case for logical operators: `(tube>0) || dotmask` passes a
  // float into `||` — HLSL converts float→bool (nonzero = true) implicitly.
  // GLSL has no such conversion; bool(x) is the explicit form.
  visit(ast, {
    binary: {
      enter: (p) => {
        const op = p.node.operator.literal;
        if (!['&&', '||', '^^'].includes(op)) return;
        for (const side of ['left', 'right'] as const) {
          const operand = p.node[side];
          if (operand && !isBoolExpr(operand) && inferDim(operand, typeMap) === 1) {
            (p.node as unknown as Record<string, unknown>)[side] =
              mkFnCall('bool', [operand], ' ') as unknown as AstNode;
          }
        }
      },
    },
  });
  visit(ast, {
    declarator_list: {
      enter: (p) => {
        if (getTypeKeyword(p.node) !== 'float') return;
        for (const d of (p.node as DeclaratorListNode).declarations) {
          const decl = d as DeclarationNode;
          if (decl.initializer && isBoolExpr(decl.initializer as unknown as AstNode)) {
            decl.initializer = mkFnCall('float', [decl.initializer as unknown as AstNode], ' ') as unknown as AstNode;
          }
        }
      },
    },
    assignment: {
      enter: (p) => {
        const node = p.node as unknown as {
          left?: AstNode;
          right?: AstNode;
          operator?: { literal?: string };
        };
        const isCompound = node.operator?.literal && node.operator.literal !== '=';
        const leftName = node.left?.type === 'identifier' ? (node.left as IdentifierNode).identifier : null;
        if (!leftName) return;
        if (!isCompound && typeMap.get(leftName) !== 1) return;
        if (isCompound && typeMap.get(leftName) !== 1) return;
        if (node.right && isBoolExpr(node.right)) {
          node.right = mkFnCall('float', [node.right], ' ') as unknown as AstNode;
        }
      },
    },
  });

  // ── Pass 10.76: assignment dimension truncation / splat ──
  // HLSL silently truncates a wider RHS to the LHS type (`float d = vec3;`
  // takes .x) and splats a scalar RHS to a vector LHS. GLSL rejects both
  // ("'=' : dimension mismatch"). Plain '=' only — compound ops are
  // component-wise and never change width.
  visit(ast, {
    assignment: {
      enter: (p) => {
        const node = p.node as unknown as {
          left?: AstNode;
          right?: AstNode;
          operator?: { literal?: string };
        };
        // Compound ops (`+=`) are component-wise for matching dims, but a
        // mismatched RHS is still truncated/splated by HLSL — handle both.
        const op = node.operator?.literal ?? '=';
        if (!/^[+\-*/%]=$|^=$/.test(op)) return;
        if (!node.left || !node.right) return;
        const lhsDim = inferDim(node.left, typeMap);
        if (lhsDim < 1 || lhsDim > 4) return;
        const leftName = node.left.type === 'identifier' ? (node.left as IdentifierNode).identifier : null;
        if (leftName && matrixNames.has(leftName)) return;
        // bool RHS to a float/vector LHS: float() first, then splat. A bool
        // LHS keeps the bool RHS as-is.
        if (leftName && boolNames.has(leftName)) return;
        if (isBoolExpr(node.right)) {
          node.right = mkFnCall('float', [node.right], ' ') as unknown as AstNode;
        }
        if (isMatrixExpr(node.right)) return;
        const rhsDim = inferDim(node.right, typeMap);
        if (rhsDim === lhsDim || rhsDim < 1 || rhsDim > 4) return;
        if (rhsDim > lhsDim) {
          // truncate: vec → narrower per HLSL implicit truncation
          node.right = mkPostfixSwizzle(node.right, 'xyzw'.slice(0, lhsDim)) as unknown as AstNode;
        } else {
          // splat scalar up to the LHS dim
          node.right = mkFnCall(`vec${lhsDim}`, [node.right], ' ') as unknown as AstNode;
        }
      },
    },
  });

  // ── Pass 10.77: bool function arguments → float(...) ──
  // `sat((a > b) * c)`-style call sites pass comparison results into
  // float-expecting functions; HLSL converts bool→float implicitly, GLSL
  // doesn't. Boolean builtins (any/all/not/comparators) are excluded.
  const boolArgExemptFns = new Set([
    'any', 'all', 'not', 'equal', 'notEqual', 'lessThan', 'lessThanEqual',
    'greaterThan', 'greaterThanEqual',
  ]);
  visit(ast, {
    function_call: {
      enter: (p) => {
        const name = getFnName(p.node);
        if (boolArgExemptFns.has(name)) return;
        // Skip our own float(...)/bool(...) wraps — re-visiting them would
        // wrap the bool again, one nesting level per visit (stack overflow).
        if (name === 'float' || name === 'bool') return;
        const allArgs = (p.node as FunctionCallNode).args;
        for (let i = 0; i < allArgs.length; i++) {
          const arg = allArgs[i];
          if (arg && isBoolExpr(arg)) {
            allArgs[i] = mkFnCall('float', [arg], ' ') as unknown as AstNode;
          }
        }
      },
    },
  });

  // ── Pass 10.78: user-function argument dimension alignment ──
  // HLSL implicitly splats scalar args to vector params (`pwnoise(uv.x, t)`
  // with `float pwnoise(vec2, float)`) and truncates wider args. GLSL does
  // neither. Runs after 10.77 so bool args are already float-wrapped.
  visit(ast, {
    function_call: {
      enter: (p) => {
        const name = getFnName(p.node);
        const paramDims = userFnParams.get(name);
        if (!paramDims || paramDims.length === 0) return;
        const args = getArgs(p.node);
        const intParams = userFnIntParams.get(name) ?? new Set<number>();
        const allArgs = (p.node as FunctionCallNode).args;
        for (let i = 0; i < args.length && i < paramDims.length; i++) {
          const pd = paramDims[i];
          const arg = args[i];
          // HLSL converts float→int implicitly for int params; GLSL needs an
          // explicit int(...) constructor.
          if (intParams.has(i) && arg.type !== 'int_constant' && inferDim(arg, typeMap) === 1) {
            const idx = allArgs.indexOf(arg);
            if (idx !== -1) allArgs[idx] = mkFnCall('int', [arg], ' ') as unknown as AstNode;
            continue;
          }
          if (pd < 1 || pd > 4) continue;
          const argDim = inferDim(arg, typeMap);
          if (argDim === pd) continue;
          if (argDim === 1) {
            // splat scalar up to the param dim
            const padded = mkFnCall(`vec${pd}`, [arg], ' ') as unknown as AstNode;
            const idx = allArgs.indexOf(arg);
            if (idx !== -1) allArgs[idx] = padded;
          } else if (argDim > pd) {
            // truncate wider arg down to the param dim
            const narrowed = mkPostfixSwizzle(arg, 'xyzw'.slice(0, pd)) as unknown as AstNode;
            const idx = allArgs.indexOf(arg);
            if (idx !== -1) allArgs[idx] = narrowed;
          }
        }
      },
    },
  });

  // ── Pass 10.79: int operands in float expressions → float(...) ──
  // `polar.x * fins` (fins an `int` param) compiles in HLSL (implicit
  // int→float) but not on this GLSL ES driver. Wrap the int side when the
  // other side is confidently float. int↔int stays int (loop counters);
  // int constants were already float-ified by Pass 1 outside int contexts.
  {
    const isFloatSide = (node: AstNode | undefined | null): boolean => {
      if (!node) return false;
      if (node.type === 'float_constant' || node.type === 'double_constant') return true;
      if (node.type === 'int_constant') return false;
      if (node.type === 'identifier') {
        const n = (node as IdentifierNode).identifier;
        return typeMap.get(n) === 1 && !intNames.has(n);
      }
      if (node.type === 'function_call') return inferDim(node, typeMap) === 1;
      if (node.type === 'postfix' || node.type === 'group' || node.type === 'unary' || node.type === 'binary') {
        return inferDim(node, typeMap) === 1;
      }
      return false;
    };
    const isIntSide = (node: AstNode | undefined | null): boolean => {
      if (!node) return false;
      if (node.type === 'identifier') return intNames.has((node as IdentifierNode).identifier);
      if (node.type === 'postfix') {
        const pf = (node as PostfixNode).expression;
        return pf?.type === 'identifier' ? intNames.has((pf as IdentifierNode).identifier) : false;
      }
      return false;
    };
    visit(ast, {
      binary: {
        enter: (p) => {
          const op = p.node.operator.literal;
          if (!['+', '-', '*', '/', '%', '<', '>', '<=', '>=', '==', '!='].includes(op)) return;
          for (const side of ['left', 'right'] as const) {
            const other = side === 'left' ? p.node.right : p.node.left;
            if (isIntSide(p.node[side]) && isFloatSide(other)) {
              (p.node as unknown as Record<string, unknown>)[side] =
                mkFnCall('float', [p.node[side]], ' ') as unknown as AstNode;
            }
          }
        },
      },
    });
  }

  // ── Pass 10.8: swizzles on scalar variables ──
  // The offline translator sometimes emits `.xyz`/`.xy`/`.x` on identifiers
  // that are declared floats ("field selection requires structure, vector,
  // or interface block"). HLSL scalar swizzles replicate (`s.xyz` == `s`), so
  // the whole postfix is dropped — truncating to `.x` would still be invalid
  // GLSL on a float and recreates the same driver error with one letter.
  // Scalar *function results* are handled by Pass 10.9.
  // Swizzles on unknown (dim 0) names are left alone — the undeclared-variable
  // injector declares them (swizzle-aware since the inference fix, so a
  // swizzle-using name becomes a vector, not a float).
  // Runs BEFORE Pass 11 so the constructor-narrowing swizzles Pass 11 creates
  // (always on real vectors) are unaffected.
  visit(ast, {
    postfix: {
      enter: (p) => {
        const pf = (p.node as PostfixNode).postfix;
        if (pf.type !== 'field_selection') return;
        const sel = (pf as FieldSelectionNode).selection;
        const swizzle = sel.type === 'literal'
          ? (sel as LiteralNode).literal
          : sel.type === 'identifier' ? (sel as unknown as IdentifierNode).identifier : '';
        if (!/^[xyzwrgba]+$/.test(swizzle) || swizzle.length < 1) return;
        const expr = (p.node as PostfixNode).expression;
        if (expr.type !== 'identifier') return;
        const name = (expr as IdentifierNode).identifier;
        if (typeMap.get(name) !== 1) return;
        // HLSL scalar swizzle replicates: `s.<any>` on a float is just `s`.
        p.replaceWith(expr as unknown as AstNode);
      },
    },
  });

  // ── Pass 10.9: swizzles on scalar expressions ──
  // Same family as 10.8 but for non-identifier bases: the offline translator
  // emits `.xyz` on scalar results (`lum(a).xyz`, `(a - b).r`). Unlike the
  // old post-gen strip, this is dimension-aware via inferDim — component-wise
  // functions (fract, floor, sin, abs, mix, ...) legitimately return vectors
  // and their swizzles must SURVIVE. Stripping those recreates `'=' :
  // dimension mismatch` errors on valid code like `uv2 = fract(vec3_expr).xy`.
  visit(ast, {
    postfix: {
      enter: (p) => {
        const pf = (p.node as PostfixNode).postfix;
        if (pf.type !== 'field_selection') return;
        const sel = (pf as FieldSelectionNode).selection;
        const swizzle = sel.type === 'literal'
          ? (sel as LiteralNode).literal
          : sel.type === 'identifier' ? (sel as unknown as IdentifierNode).identifier : '';
        if (!/^[xyzwrgba]+$/.test(swizzle)) return;
        const expr = (p.node as PostfixNode).expression;
        // Identifiers are Pass 10.8's job; anything else that confidently
        // infers scalar (binary of scalar calls, groups of those, ...) is
        // HLSL scalar-swizzle replication — drop the postfix.
        if (expr.type === 'identifier') return;
        // Unknown dim (undeclared args) — leave for the post-gen safety net.
        if (inferDim(expr, typeMap) !== 1) return;
        p.replaceWith(expr as unknown as AstNode);
      },
    },
  });

  // ── Pass 10.95: out-of-range swizzle letters → clamp to base dim ──
  // Corrupted-source presets chain swizzles (`GetBlur1(uvm).xy.zzz` — a
  // vec2 base with .zzz). Even HLSL rejects these; MilkDrop fell back to a
  // simpler preset. Clamp each letter to the base's last component so the
  // shader still compiles and shows something (slightly-wrong-but-rendering
  // beats fallback). Chained selections nest as a linked list
  // (postfix.postfix = {type:'postfix', expression: field_selection, ...}),
  // so walk the chain, shrinking the available dim after each selection.
  const clampSelection = (fs: FieldSelectionNode, dim: number): number => {
    const swizzle = fs.selection.type === 'literal'
      ? (fs.selection as LiteralNode).literal
      : fs.selection.type === 'identifier' ? (fs.selection as unknown as IdentifierNode).identifier : '';
    if (!/^[xyzwrgba]{1,4}$/.test(swizzle)) return 0; // struct member / unknown
    if (dim === 2 || dim === 3) {
      const chars = 'xyzwrgba';
      let changed = false;
      const fixed = swizzle.split('').map((ch) => {
        const idx = chars.indexOf(ch) % 4;
        if (idx >= dim) {
          changed = true;
          return chars[dim - 1];
        }
        return ch;
      }).join('');
      if (changed) {
        (fs.selection as unknown as Record<string, unknown>).type = 'literal';
        (fs.selection as unknown as Record<string, unknown>).literal = fixed;
        (fs.selection as unknown as Record<string, unknown>).whitespace = '';
      }
    }
    return swizzle.length;
  };
  visit(ast, {
    postfix: {
      enter: (p) => {
        const node = p.node as PostfixNode;
        const expr = node.expression;
        if (expr.type === 'identifier') return; // 10.8's job; declarations may be widened later
        let dim = inferDim(expr, typeMap);
        let pf: AstNode | undefined = node.postfix as unknown as AstNode;
        while (pf) {
          if (pf.type === 'postfix') {
            const fs = (pf as PostfixNode).expression;
            if (!fs || fs.type !== 'field_selection') return;
            dim = clampSelection(fs as FieldSelectionNode, dim);
            pf = (pf as PostfixNode).postfix as unknown as AstNode;
          } else if (pf.type === 'field_selection') {
            dim = clampSelection(pf as FieldSelectionNode, dim);
            pf = undefined;
          } else {
            return; // array access / quantifier — leave the rest untouched
          }
          if (dim === 0) return;
        }
      },
    },
  });

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

        // ── Pass 11.1: too-narrow constructors → pad with zeros ──
        // `vec3(vec2_expr)` / `vec4(vec3_expr, float)` have no valid overload —
        // GLSL requires exactly N components from multiple args. A single
        // scalar arg (`vec3(0.5)`) broadcasts and is legal, so only pad when
        // the total lands in [2, target). Matrix args construct differently
        // (vec4(mat2) is 4 components) — leave those alone.
        if (totalComponents >= 2 && totalComponents < targetDim) {
          if (args.some((arg) => isMatrixExpr(arg))) return;
          const missing = targetDim - totalComponents;
          for (let k = 0; k < missing; k++) {
            (p.node as FunctionCallNode).args.push(mkLiteral(',') as unknown as AstNode);
            (p.node as FunctionCallNode).args.push(mkFloat('0.0') as unknown as AstNode);
          }
          return;
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
        const secondDim = inferDim(args[1], typeMap);
        const thirdDim = inferDim(args[2], typeMap);
        if (firstDim <= 0 || thirdDim <= 0) return;

        // Helper to fix dimension mismatch - swizzle or wrap in vec constructor
        const fixDim = (arg: AstNode, targetDim: number): AstNode => {
          const currentDim = inferDim(arg, typeMap);
          if (currentDim === targetDim || currentDim <= 0) return arg;

          // If it's a literal or scalar, wrap in vec constructor
          if (currentDim === 1) {
            return mkFnCall(`vec${targetDim}`, [arg], ' ') as unknown as AstNode;
          }

          // Otherwise swizzle down (all four widths reachable — the old
          // ternary fell through to 'xyz' for vec4, leaving the mismatch)
          const swizzle = targetDim === 1 ? 'x' : targetDim === 2 ? 'xy' : targetDim === 3 ? 'xyz' : 'xyzw';
          return mkPostfixSwizzle(arg, swizzle) as unknown as AstNode;
        };

        // Handle case where arg0 and arg1 have mismatching dimensions.
        // Two vectors (both >= 2): narrow the wider to the narrower — the
        // result feeds the same expression that produced the vecN, and
        // widening a vecN to vecM has no single-operand GLSL form (the old
        // code "widened" by swizzling down, producing `ret.xyz.xyz` and
        // leaving mix(vec3, vec4, float) unmatched). Scalar vs vector: widen
        // the scalar via constructor.
        if (firstDim !== secondDim && firstDim > 0 && secondDim > 0) {
          const vecToVec = firstDim >= 2 && secondDim >= 2;
          const targetDim = vecToVec ? Math.min(firstDim, secondDim) : Math.max(firstDim, secondDim);
          const allArgs = p.node.args;
          for (let i = 0; i < allArgs.length; i++) {
            if (allArgs[i] === args[0] && firstDim !== targetDim) {
              allArgs[i] = fixDim(args[0], targetDim);
              break;
            }
            if (allArgs[i] === args[1] && secondDim !== targetDim) {
              allArgs[i] = fixDim(args[1], targetDim);
              break;
            }
          }
        }

        if (firstDim >= thirdDim) return; // OK: third is scalar or same dim

        // Third arg is wider than first two — swizzle/wrap it down
        const allArgs = p.node.args;
        for (let i = 0; i < allArgs.length; i++) {
          if (allArgs[i] === args[2]) {
            allArgs[i] = fixDim(args[2], firstDim);
            break;
          }
        }
      },
    },
  });

  // ── Pass 12.1: pow(vec, scalar) → pow(vec, vecN(scalar)) ──
  // GLSL pow has no genType×float overload — both args must match. MilkDrop's
  // HLSL pow accepted component-wise scalars, so translated shaders hit
  // "no matching overloaded function found" on vec bases with scalar exponents.
  visit(ast, {
    function_call: {
      enter: (p) => {
        if (getFnName(p.node) !== 'pow') return;
        if (declaredNames.has('pow')) return;
        const args = getArgs(p.node);
        if (args.length !== 2) return;
        const baseDim = inferDim(args[0], typeMap);
        if (baseDim < 2) return;
        if (inferDim(args[1], typeMap) !== 1) return;
        const allArgs = (p.node as FunctionCallNode).args;
        for (let i = 0; i < allArgs.length; i++) {
          if (allArgs[i] === args[1]) {
            allArgs[i] = mkFnCall(`vec${baseDim}`, [args[1]], ' ') as unknown as AstNode;
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
  // SAFETY NET ONLY for calls whose args inferDim can't type (undeclared vars):
  // dimension-aware stripping of swizzles after component-wise functions
  // (fract, sin, mix, ...) happens in AST Pass 10.9 — those functions CAN
  // return vectors, so they must NOT appear here. Listing them here strips
  // valid swizzles like `fract(vec3).xy` and recreates dimension-mismatch
  // errors that Pass 10.5 just fixed.
  const scalarFns = 'lum|length|dot|distance|float|int|bool';
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

  // NOTE: a previous post-gen regex here rewrote `texture(sampler, vec3-coord)`
  // to `.xy`. Its `[^)]*` stopped at the FIRST close-paren inside the coord, so
  // Pass 9's padded `vec3(expr, 0.0)` nested in the coord got spliced:
  // `vec3((uv- vec2(0.5).xy))*0.1,0.0` — operator and pad ended up OUTSIDE the
  // ctor, producing "constructor not enough data" / syntax errors. This is now
  // handled structurally in AST Pass 9.1 (all samplers, not just sampler_*),
  // so the regex is gone.

  // ── Post-generation fix: float/var = vecN_expr dimension mismatch ──
  // When a float variable is initialized with a vec3 expression (e.g., from mix/texture),
  // change the declared type to match. e.g. float x = texture(...).xyz → vec3 x = texture(...).xyz
  // This catches cases the AST Pass 10 misses.
  patched = patched.replace(
    /(\bfloat\b\s+)(\w+\s*=\s*(?:mix|texture|textureLod|textureBias|GetPixel|GetBlur\d|GetMain|clamp01|sat)\b[^;])/g,
    (_match, floatKw, rest) => {
      // Count the vector dimension from common patterns in the RHS
      if (/vec3\s*\(|\.xyz/.test(rest)) return `vec3 ${rest}`;
      if (/vec2\s*\(|\.xy[^z]/.test(rest)) return `vec2 ${rest}`;
      if (/vec4\s*\(|\.xyzw/.test(rest)) return `vec4 ${rest}`;
      return _match; // Not a vector expr, leave as-is
    }
  );

  // NOTE: a previous post-gen regex here appended `.xyz` to compound
  // assignments whose RHS *started* with `vec3(`/`GetPixel(` etc. It fired on
  // the first balanced `)` only, so `ret -= vec3(float(ret.x), ...)` became
  // `ret -= vec3(float(ret.x).xyz, ...)` — corrupting valid code and
  // re-adding the exact scalar-swizzle compile errors the strip above
  // removes. Legitimate compound-assignment dimension fixes are handled in
  // the AST by Pass 10.5 (with a real typeMap), so the regex is gone.

  // ── Post-generation: inject declarations, constants, samplers, helpers ──
  // These must happen after generation because we need to know what's used.
  // Order matters: uniforms first, then declarations (to avoid shadowing).
  patched = injectMissingUniforms(patched);
  patched = injectMissingDeclarations(patched, undeclared, inferredTypes);
  patched = injectMissingConstants(patched);
  patched = injectMissingSamplers(patched);
  patched = injectMissingHelpers(patched);

  // ── Post-generation: q-var assignments → local copies ──
  // MilkDrop lets warp/comp shaders write q1-q32; writes are per-pixel
  // locals (they never propagate back to per-frame state). GLSL uniforms
  // are read-only: `q25 = q24 + .01;` → "'assign' : l-value required
  // (can't modify a uniform "q25")". Give each assigned q-var a local copy
  // initialized from the uniform and rename body references to it — reads
  // stay faithful, writes stay local, exactly like MilkDrop.
  {
    const mainIdx2 = patched.indexOf('void main()');
    if (mainIdx2 !== -1) {
      const bodyStart = patched.indexOf('{', mainIdx2);
      if (bodyStart !== -1) {
        const beforeMain2 = patched.substring(0, mainIdx2);
        const body = patched.substring(bodyStart + 1);
        const assigned = new Set<string>();
        for (const m of body.matchAll(/\b(q\d+)\s*(?:[+\-*/%|&^]|<<|>>)?=(?!=)/g)) {
          assigned.add(m[1]);
        }
        const decls: string[] = [];
        let newBody = body;
        for (const name of assigned) {
          // Only q-vars actually declared as uniforms get a copy; anything
          // else keeps its injected local declaration.
          const declMatch = beforeMain2.match(new RegExp(`uniform\\s+(float|vec[234])\\s+${name}\\s*;`));
          if (!declMatch) continue;
          decls.push(`${declMatch[1]} ${name}_l = ${name};`);
          newBody = newBody.replace(new RegExp(`\\b${name}\\b`, 'g'), `${name}_l`);
        }
        if (decls.length > 0) {
          patched = patched.substring(0, bodyStart + 1) + '\n  ' + decls.join('\n  ') + newBody;
        }
      }
    }
  }

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

  // Extract any existing #define lines from the entire source
  const defineRegex = /^#define\s+(\w+)\s+(.+)$/gm;
  const existingDefines = new Map<string, { line: string; pos: number }>();
  let match: RegExpExecArray | null;
  while ((match = defineRegex.exec(source)) !== null) {
    existingDefines.set(match[1], { line: match[0], pos: match.index });
  }

  const additions: string[] = [];
  const definesToRemove = new Set<string>();

  for (const [name, val] of constants) {
    // Check if the constant is used anywhere in the source
    const usageRegex = new RegExp(`\\b${name}\\b`);
    if (!usageRegex.test(source)) continue;

    // Find the FIRST usage position
    const firstUsageMatch = source.match(usageRegex);
    const firstUsagePos = firstUsageMatch && firstUsageMatch.index !== undefined ? firstUsageMatch.index : -1;

    if (existingDefines.has(name)) {
      const existing = existingDefines.get(name)!;
      // If the #define comes AFTER its first usage, relocate it
      if (existing.pos > firstUsagePos) {
        definesToRemove.add(name);
        additions.push(existing.line);
      }
      // Otherwise it's already in the right place
    } else {
      // Not defined at all - inject
      additions.push(`#define ${name} ${val}`);
    }
  }

  if (additions.length === 0) return source;

  // Remove relocated defines from their original positions
  let patchedSource = source;
  for (const name of definesToRemove) {
    const existing = existingDefines.get(name);
    if (existing) {
      patchedSource = patchedSource.substring(0, existing.pos) + patchedSource.substring(existing.pos + existing.line.length);
    }
  }

  // Find the earliest position where any of these constants are used
  let earliestUsagePos = patchedSource.length;
  for (const [name] of constants) {
    const regex = new RegExp(`\\b${name}\\b`);
    const m = patchedSource.match(regex);
    if (m && m.index !== undefined && m.index < earliestUsagePos) {
      earliestUsagePos = m.index;
    }
  }

  // Find the start of the line containing the earliest usage
  const lineStart = patchedSource.lastIndexOf('\n', earliestUsagePos - 1) + 1;

  // Insert constants before that line
  return patchedSource.substring(0, lineStart) +
    '// --- MilkDrop constants ---\n' + additions.join('\n') + '\n\n' +
    patchedSource.substring(lineStart);
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
    // Common custom sampler names from community presets
    ['sampler_fw_clouds', 'sampler_noise_lq'], ['sampler_pw_clouds', 'sampler_noise_lq'],
    ['sampler_fw_warp', 'sampler_main'], ['sampler_pw_warp', 'sampler_main'],
  ];

  // Also detect and alias any sampler_fw_* or sampler_pw_* patterns not explicitly listed
  const samplerPattern = /\b(sampler_[fp][w]_\w+)\b/g;
  let m: RegExpExecArray | null;
  const foundSamplers = new Set<string>();
  while ((m = samplerPattern.exec(source)) !== null) {
    foundSamplers.add(m[1]);
  }
  for (const samplerName of foundSamplers) {
    if (!aliases.some(([a]) => a === samplerName)) {
      // Default unknown fw/pw samplers to noise_lq
      aliases.push([samplerName, 'sampler_noise_lq']);
    }
  }

  // Detect ANY sampler_XXX pattern used in texture() calls that isn't already defined
  // This catches custom preset-specific samplers like sampler_SOCS_20
  const textureSamplerPattern = /\btexture\s*\(\s*(sampler_\w+)\s*,/g;
  while ((m = textureSamplerPattern.exec(source)) !== null) {
    const samplerName = m[1];
    if (!aliases.some(([a]) => a === samplerName) &&
        !beforeMain.includes(`uniform sampler2D ${samplerName}`) &&
        !beforeMain.includes(`#define ${samplerName}`)) {
      // Default unknown samplers to noise_lq (safe fallback)
      aliases.push([samplerName, 'sampler_noise_lq']);
    }
  }

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

  if (/\blum\s*\(/.test(source)) {
    // Per-signature: the preset may already define some lum() overloads
    // (MilkDrop shaders commonly ship lum(vec3)/lum(vec4)) but call it with
    // a vec2/float — fill in only the missing signatures.
    if (!beforeMain.includes('float lum(float')) {
      additions.push('float lum(float x) { return x; }');
    }
    if (!beforeMain.includes('float lum(vec2')) {
      additions.push('float lum(vec2 x) { return dot(x, vec2(0.5)); }');
    }
    if (!beforeMain.includes('float lum(vec3')) {
      additions.push('float lum(vec3 x) { return dot(x, vec3(0.32, 0.49, 0.29)); }');
    }
    if (!beforeMain.includes('float lum(vec4')) {
      additions.push('float lum(vec4 x) { return dot(x.rgb, vec3(0.32, 0.49, 0.29)); }');
    }
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

  // UV transformation helpers (common in community MilkDrop presets)
  if (/\buv_rotate\s*\(/.test(source) && !beforeMain.includes('vec2 uv_rotate(')) {
    additions.push(
      'vec2 uv_rotate(vec2 domain, vec2 center, float sinw, float cosw, float scale) {',
      '  vec2 uv_r = (domain - center);',
      '  return center + vec2(cosw * uv_r.x - sinw * uv_r.y, sinw * uv_r.x + cosw * uv_r.y) * scale;',
      '}'
    );
  }
  if (/\buv_polar\s*\(/.test(source) && !beforeMain.includes('vec2 uv_polar(')) {
    additions.push(
      'vec2 uv_polar(vec2 domain, vec2 center) {',
      '  vec2 c = domain - center;',
      '  float rad_hq = length(c);',
      '  float ang_hq = atan(c.x, c.y);',
      '  return vec2(ang_hq * M_INV_PI_2, rad_hq);',
      '}'
    );
  }
  if (/\buv_polar_logarithmic\s*\(/.test(source) && !beforeMain.includes('vec2 uv_polar_logarithmic(')) {
    additions.push(
      'vec2 uv_polar_logarithmic(vec2 domain, vec2 center, int fins, float log_factor, vec2 coord) {',
      '  vec2 polar = uv_polar(domain, center);',
      '  return vec2(polar.x * float(fins) + coord.x, log_factor * log(polar.y) + coord.y);',
      '}'
    );
  }
  if (/\buv_moebius_transformation\s*\(/.test(source) && !beforeMain.includes('vec2 uv_moebius_transformation(')) {
    additions.push(
      'vec2 complex_div(vec2 a, vec2 b) {',
      '  float denom = b.x * b.x + b.y * b.y;',
      '  if (denom == 0.0) return vec2(0.0);',
      '  return vec2((a.x * b.x + a.y * b.y) / denom, (a.y * b.x - a.x * b.y) / denom);',
      '}',
      'vec2 uv_moebius_transformation(vec2 domain, vec2 zeroPoint, vec2 infinityPoint, float zoom) {',
      '  return complex_div((domain - zeroPoint) * zoom, domain - infinityPoint) + 0.5;',
      '}'
    );
  }
  if (/\buv_bipolar\s*\(/.test(source) && !beforeMain.includes('vec2 uv_bipolar(')) {
    additions.push(
      'vec2 uv_bipolar(vec2 domain, vec2 northPole, vec2 southPole, int fins, float log_factor, vec2 coord) {',
      '  vec2 help_uv = uv_moebius_transformation(domain, northPole, southPole, 1.0);',
      '  return uv_polar_logarithmic(help_uv, vec2(0.5), fins, log_factor, coord);',
      '}'
    );
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
  const out = astTransform(preprocessed);

  // The @shaderfrog/glsl-parser generator renders a group node as
  // `generate(lp) + generate(expression) + generate(rp)`. When the group's
  // first token is an identifier (e.g. a `vec2(...)` constructor — whether one
  // we injected for the uAspect.zw expansion, or one produced by scalar-vector
  // coercion like `uv*(1-...)` -> `uv*( vec2(1.0) - ...)`), the identifier
  // carries a default leading-whitespace space, so the group is emitted as
  // `( vec2(...)`. A literal-first group like `(1.0/uAspect.x)` gets no such
  // space. This space is semantically inert in GLSL and is the generator's
  // consistent output, so callers/tests that assert these forms must expect it.
  return out;
};
