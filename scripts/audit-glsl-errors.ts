/**
 * Audit all milkwave presets for GLSL ES 3.00 type errors that survive patching.
 *
 * Run:  npx tsx scripts/audit-glsl-errors.ts
 *
 * This performs static analysis on every warp/comp shader AFTER patchMilkDropGlsl
 * runs, detecting the common HLSL→GLSL type-mismatch patterns that cause WebGL
 * compile failures at runtime.
 */
import fs from 'fs';
import path from 'path';
import { patchMilkDropGlsl } from '../src/shared/milkwaveGlslPatcher';

const presetsDir = path.resolve(__dirname, '../assets/presets');
const files = fs.readdirSync(presetsDir)
  .filter(f => f.includes('-milkwave-') && f.endsWith('.json'))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

// ── Error pattern detectors ──────────────────────────────────────────────

interface Issue {
  file: string;
  pass: string;
  line: number;
  category: string;
  evidence: string;
}

const issues: Issue[] = [];

/** Walk `s` from `openAt` (pointing at '(') and return the index of the matching ')'. */
const findMatchingParen = (s: string, openAt: number): number => {
  let depth = 1;
  let pos = openAt + 1;
  while (pos < s.length && depth > 0) {
    if (s[pos] === '(') depth++;
    else if (s[pos] === ')') depth--;
    pos++;
  }
  return depth === 0 ? pos - 1 : -1;
};

/** Check if a texture() call on this line has a swizzle after its balanced close paren. */
const textureHasSwizzle = (line: string, texStart: number): boolean => {
  const openIdx = line.indexOf('(', texStart);
  if (openIdx === -1) return false;
  const closeIdx = findMatchingParen(line, openIdx);
  if (closeIdx === -1) return false; // multi-line
  const after = line.slice(closeIdx + 1);
  return /^\s*\.[xyzwrgba]/.test(after);
};

/** Check if an expression (from arg splitting) evaluates to a vec type */
const isVecExpr = (s: string): boolean => {
  const t = s.trim();
  // If the outermost call is a scalar-returning function, it's not a vec
  if (/^\s*(length|dot|lum|distance|float|abs|pow|sqrt|floor|ceil|fract|sin|cos|atan|acos|asin|sign|step)\s*\(/.test(t)) return false;
  // Scalar swizzle at the end: .x, .b, .r, etc.
  if (/\.(x|y|z|w|r|g|b|a)\s*$/.test(t)) return false;
  // Known vec names
  if (/\b(ret|col\w*)\b/.test(t)) return true;
  // vec constructor
  if (/\bvec[234]\s*\(/.test(t)) return true;
  // GetPixel/GetBlur/texture return vec
  if (/\b(GetPixel|GetBlur[123]?|GetMain|texture)\b/.test(t)) return true;
  return false;
};

/** Check if expression is a scalar literal */
const isScalarLiteral = (s: string): boolean =>
  /^\s*-?(\d+\.?\d*|\.\d+)\s*$/.test(s.trim());

const detectIssues = (source: string, file: string, pass: string) => {
  const lines = source.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const lineNum = i + 1;

    // Skip comments, preprocessor, empty
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('*')) continue;

    // Category: vec assignment from int literal
    // vec3 x = 0;  vec4 y = 1;
    if (/\bvec[234]\s+\w+\s*=\s*-?\d+\s*;/.test(trimmed)) {
      issues.push({ file, pass, line: lineNum, category: 'vec-assign-int', evidence: trimmed });
    }

    // Category: float/vec assigned texture() without swizzle (balanced paren on full source)
    if (/\bvec3\s+\w+\s*=.*\btexture\s*\(/.test(trimmed)) {
      const texRe = /\btexture\s*\(/g;
      let tm: RegExpExecArray | null;
      let hasBareTex = false;
      while ((tm = texRe.exec(trimmed)) !== null) {
        // Use full source for balanced paren (handles multi-line texture calls)
        const srcTexIdx = source.indexOf(trimmed.slice(tm.index), 0);
        if (srcTexIdx !== -1 && !textureHasSwizzle(source, srcTexIdx)) {
          hasBareTex = true;
          break;
        } else if (srcTexIdx === -1 && !textureHasSwizzle(trimmed, tm.index)) {
          hasBareTex = true;
          break;
        }
      }
      if (hasBareTex) {
        issues.push({ file, pass, line: lineNum, category: 'vec3-assign-texture-vec4', evidence: trimmed });
      }
    }

    // Category: scalar-vector subtraction/addition with integer
    if (/\bvec[234]\b/.test(lines.slice(Math.max(0, i - 5), i + 1).join('\n'))) {
      if (/[-+]\s*\d+\s*;/.test(trimmed) && !/[-+]\s*\d+\.\d*/.test(trimmed) && !/[-+]\s*\d+\.0/.test(trimmed)) {
        const lhs = trimmed.split(/[-+]/)[0];
        if (/texture\s*\(|GetPixel|GetBlur|ret\b|col\b/.test(lhs)) {
          issues.push({ file, pass, line: lineNum, category: 'vec-scalar-int-arith', evidence: trimmed });
        }
      }
    }

    // Category: pow() with vec3 and scalar (use balanced-paren aware arg splitting)
    if (/\bpow\s*\(/.test(trimmed)) {
      const powIdx = trimmed.search(/\bpow\s*\(/);
      const openIdx = trimmed.indexOf('(', powIdx);
      const closeIdx = findMatchingParen(trimmed, openIdx);
      if (closeIdx !== -1) {
        const inner = trimmed.slice(openIdx + 1, closeIdx);
        // Split on top-level comma
        let depth = 0, splitAt = -1;
        for (let ci = 0; ci < inner.length; ci++) {
          if (inner[ci] === '(') depth++;
          else if (inner[ci] === ')') depth--;
          else if (inner[ci] === ',' && depth === 0) { splitAt = ci; break; }
        }
        if (splitAt !== -1) {
          const a = inner.slice(0, splitAt);
          const b = inner.slice(splitAt + 1);
          if ((isVecExpr(a) && isScalarLiteral(b)) || (isScalarLiteral(a) && isVecExpr(b))) {
            issues.push({ file, pass, line: lineNum, category: 'pow-vec-scalar-mismatch', evidence: trimmed });
          }
        }
      }
    }

    // Category: max/min — only flag genuinely invalid overloads.
    // GLSL ES has max(genType, float) and min(genType, float) but NOT max(float, genType).
    if (/\b(max|min)\s*\(/.test(trimmed)) {
      const fnIdx = trimmed.search(/\b(max|min)\s*\(/);
      const fn = trimmed.slice(fnIdx).match(/^(max|min)/)?.[1] ?? '';
      const openIdx = trimmed.indexOf('(', fnIdx);
      const closeIdx = findMatchingParen(trimmed, openIdx);
      if (closeIdx !== -1) {
        const inner = trimmed.slice(openIdx + 1, closeIdx);
        let depth = 0, splitAt = -1;
        for (let ci = 0; ci < inner.length; ci++) {
          if (inner[ci] === '(') depth++;
          else if (inner[ci] === ')') depth--;
          else if (inner[ci] === ',' && depth === 0) { splitAt = ci; break; }
        }
        if (splitAt !== -1) {
          const a = inner.slice(0, splitAt);
          const b = inner.slice(splitAt + 1);
          // Only flag: scalar FIRST, vec SECOND (no valid overload)
          // max(vec, scalar) IS valid via max(genType, float)
          if (isScalarLiteral(a) && isVecExpr(b)) {
            issues.push({ file, pass, line: lineNum, category: `${fn}-vec-scalar-mismatch`, evidence: trimmed });
          }
        }
      }
    }

    // Category: vec3 = scalar expression (ret = lum(...), ret = dot(...), ret = length(...))
    if (/\bret\s*=\s*(?:lum|dot|length|distance|float)\s*\(/.test(trimmed)) {
      issues.push({ file, pass, line: lineNum, category: 'vec3-assign-scalar-fn', evidence: trimmed });
    }

    // Category: float x = int
    if (/\bfloat\s+\w+\s*=\s*-?\d+\s*[,;]/.test(trimmed) && !/\d+\.\d*/.test(trimmed.match(/=\s*(-?\d+)/)?.[1] ?? '')) {
      const m = trimmed.match(/\bfloat\s+\w+\s*=\s*(-?\d+)/);
      if (m && !m[1].includes('.')) {
        issues.push({ file, pass, line: lineNum, category: 'float-assign-int', evidence: trimmed });
      }
    }

    // Category: texture() in vec3 context without swizzle (balanced paren on full source)
    if (/\bret\s*=.*\btexture\s*\(/.test(trimmed)) {
      const texRe = /\btexture\s*\(/g;
      let tm: RegExpExecArray | null;
      let hasBareTex = false;
      while ((tm = texRe.exec(trimmed)) !== null) {
        const srcTexIdx = source.indexOf(trimmed.slice(tm.index), 0);
        if (srcTexIdx !== -1 && !textureHasSwizzle(source, srcTexIdx)) {
          hasBareTex = true;
          break;
        } else if (srcTexIdx === -1 && !textureHasSwizzle(trimmed, tm.index)) {
          hasBareTex = true;
          break;
        }
      }
      if (hasBareTex) {
        issues.push({ file, pass, line: lineNum, category: 'ret-assign-texture-vec4', evidence: trimmed });
      }
    }

    // Category: shader_body remnant
    if (/\bshader_body\b/.test(trimmed)) {
      issues.push({ file, pass, line: lineNum, category: 'shader-body-remnant', evidence: trimmed });
    }

    // Category: clamp/smoothstep with mixed vec/scalar args
    // smoothstep(float, float, genType) IS valid — only flag genuinely invalid combos
    if (/\b(clamp|smoothstep)\s*\(/.test(trimmed)) {
      const fnIdx = trimmed.search(/\b(clamp|smoothstep)\s*\(/);
      const fn = trimmed.slice(fnIdx).match(/^(clamp|smoothstep)/)?.[1] ?? '';
      const openIdx = trimmed.indexOf('(', fnIdx);
      const closeIdx = findMatchingParen(trimmed, openIdx);
      if (closeIdx !== -1) {
        const inner = trimmed.slice(openIdx + 1, closeIdx);
        // Split into 3 args on top-level commas
        const args: string[] = [];
        let depth = 0, start = 0;
        for (let ci = 0; ci < inner.length; ci++) {
          if (inner[ci] === '(') depth++;
          else if (inner[ci] === ')') depth--;
          else if (inner[ci] === ',' && depth === 0) { args.push(inner.slice(start, ci)); start = ci + 1; }
        }
        args.push(inner.slice(start));
        if (args.length === 3) {
          // smoothstep: valid overloads are (genType, genType, genType) and (float, float, genType)
          // clamp: valid overloads are (genType, genType, genType) and (genType, float, float)
          if (fn === 'smoothstep') {
            // Invalid: (vec, vec, scalar) or (vec, scalar, scalar)
            const thirdIsScalar = isScalarLiteral(args[2]);
            const firstIsVec = isVecExpr(args[0]);
            if (thirdIsScalar && firstIsVec) {
              issues.push({ file, pass, line: lineNum, category: 'smoothstep-vec-scalar-mismatch', evidence: trimmed });
            }
          } else { // clamp
            // Invalid: (scalar, vec, vec) or (scalar, scalar, vec)
            const firstIsScalar = isScalarLiteral(args[0]);
            const thirdIsVec = isVecExpr(args[2]);
            if (firstIsScalar && thirdIsVec) {
              issues.push({ file, pass, line: lineNum, category: 'clamp-vec-scalar-mismatch', evidence: trimmed });
            }
          }
        }
      }
    }
  }
};

// ── Main ─────────────────────────────────────────────────────────────────

console.log(`Scanning ${files.length} milkwave presets...\n`);

let totalShaders = 0;
let shadersWithIssues = 0;

for (const file of files) {
  const preset = JSON.parse(fs.readFileSync(path.join(presetsDir, file), 'utf-8'));
  const sd = preset._shaderData;
  if (!sd) continue;

  for (const [pass, shader] of [['warp', sd.warp], ['comp', sd.comp]] as const) {
    if (!shader || typeof shader !== 'string') continue;
    totalShaders++;
    const patched = patchMilkDropGlsl(shader);
    const beforeCount = issues.length;
    detectIssues(patched, file, pass);
    if (issues.length > beforeCount) shadersWithIssues++;
  }
}

// ── Report ───────────────────────────────────────────────────────────────

const categories = new Map<string, Issue[]>();
for (const issue of issues) {
  const list = categories.get(issue.category) ?? [];
  list.push(issue);
  categories.set(issue.category, list);
}

const sorted = [...categories.entries()].sort((a, b) => b[1].length - a[1].length);

console.log(`Total shaders scanned: ${totalShaders}`);
console.log(`Shaders with issues:   ${shadersWithIssues}`);
console.log(`Total issues found:    ${issues.length}`);
console.log(`\n${'─'.repeat(70)}`);
console.log(`ERROR CATEGORIES (sorted by frequency)\n`);

for (const [cat, catIssues] of sorted) {
  const uniqueFiles = new Set(catIssues.map(i => i.file));
  console.log(`  ${cat}: ${catIssues.length} occurrences in ${uniqueFiles.size} presets`);
  // Show up to 3 examples
  const examples = catIssues.slice(0, 3);
  for (const ex of examples) {
    console.log(`    → ${ex.evidence.slice(0, 100)}`);
  }
  console.log();
}

// Summary: unique files with any issues
const allAffected = new Set(issues.map(i => i.file));
console.log(`${'─'.repeat(70)}`);
console.log(`Presets affected: ${allAffected.size} / ${files.length} (${(allAffected.size / files.length * 100).toFixed(1)}%)`);
console.log(`Clean presets:    ${files.length - allAffected.size} / ${files.length} (${((files.length - allAffected.size) / files.length * 100).toFixed(1)}%)`);
