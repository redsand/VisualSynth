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

    // Category: float/vec assigned texture() without swizzle
    // vec3 x = texture(sampler, uv);  (texture returns vec4)
    if (/\bvec3\s+\w+\s*=\s*texture\s*\(/.test(trimmed) && !trimmed.includes('.xyz') && !trimmed.includes('.rgb')) {
      issues.push({ file, pass, line: lineNum, category: 'vec3-assign-texture-vec4', evidence: trimmed });
    }

    // Category: scalar-vector subtraction/addition with integer
    // ret = texture(...) - 1;  OR  vec3 x = something - 1;
    if (/\bvec[234]\b/.test(lines.slice(Math.max(0, i - 5), i + 1).join('\n'))) {
      // vec - int  or  vec + int  (bare integer, not float literal)
      if (/[-+]\s*\d+\s*;/.test(trimmed) && !/[-+]\s*\d+\.\d*/.test(trimmed) && !/[-+]\s*\d+\.0/.test(trimmed)) {
        // Only flag if this looks like it involves a vec context
        const lhs = trimmed.split(/[-+]/)[0];
        if (/texture\s*\(|GetPixel|GetBlur|ret\b|col\b/.test(lhs)) {
          issues.push({ file, pass, line: lineNum, category: 'vec-scalar-int-arith', evidence: trimmed });
        }
      }
    }

    // Category: pow() with vec3 and scalar
    // pow(vec3_expr, scalar)  or  pow(scalar, vec3_expr)
    if (/\bpow\s*\(/.test(trimmed)) {
      // Simple heuristic: pow where one arg is clearly a named vec and the other a scalar
      const powMatch = trimmed.match(/\bpow\s*\(\s*([^,]+),\s*([^)]+)\)/);
      if (powMatch) {
        const [, a, b] = powMatch;
        const aIsVec = /\bret\b|\bcol\b|\bGetPixel|\bGetBlur|\btexture\b|\bvec[234]\b/.test(a);
        const bIsVec = /\bret\b|\bcol\b|\bGetPixel|\bGetBlur|\btexture\b|\bvec[234]\b/.test(b);
        const aIsScalar = /^\s*-?(\d+\.?\d*|\.\d+)\s*$/.test(a) || /\bfloat\b|\blength\b|\bdot\b/.test(a);
        const bIsScalar = /^\s*-?(\d+\.?\d*|\.\d+)\s*$/.test(b) || /\bfloat\b|\blength\b|\bdot\b/.test(b);
        if ((aIsVec && bIsScalar) || (aIsScalar && bIsVec)) {
          issues.push({ file, pass, line: lineNum, category: 'pow-vec-scalar-mismatch', evidence: trimmed });
        }
      }
    }

    // Category: max/min with vec3 and scalar
    if (/\b(max|min)\s*\(/.test(trimmed)) {
      const fnMatch = trimmed.match(/\b(max|min)\s*\(\s*([^,]+),\s*([^)]+)\)/);
      if (fnMatch) {
        const [, fn, a, b] = fnMatch;
        const aIsVec = /\bret\b|\bcol\b|\bGetPixel|\bGetBlur|\btexture\b|\bvec[234]\b/.test(a);
        const bIsVec = /\bret\b|\bcol\b|\bGetPixel|\bGetBlur|\btexture\b|\bvec[234]\b/.test(b);
        const aIsScalar = /^\s*-?(\d+\.?\d*|\.\d+)\s*$/.test(a.trim());
        const bIsScalar = /^\s*-?(\d+\.?\d*|\.\d+)\s*$/.test(b.trim());
        if ((aIsVec && bIsScalar) || (aIsScalar && bIsVec)) {
          issues.push({ file, pass, line: lineNum, category: `${fn}-vec-scalar-mismatch`, evidence: trimmed });
        }
      }
    }

    // Category: vec3 = scalar expression (ret = lum(...), ret = dot(...), ret = length(...))
    // These return float but are assigned to vec3
    if (/\bret\s*=\s*(?:lum|dot|length|distance|float)\s*\(/.test(trimmed)) {
      issues.push({ file, pass, line: lineNum, category: 'vec3-assign-scalar-fn', evidence: trimmed });
    }

    // Category: float x = int (not already handled — multi-variable in same decl)
    if (/\bfloat\s+\w+\s*=\s*-?\d+\s*[,;]/.test(trimmed) && !/\d+\.\d*/.test(trimmed.match(/=\s*(-?\d+)/)?.[1] ?? '')) {
      const m = trimmed.match(/\bfloat\s+\w+\s*=\s*(-?\d+)/);
      if (m && !m[1].includes('.')) {
        issues.push({ file, pass, line: lineNum, category: 'float-assign-int', evidence: trimmed });
      }
    }

    // Category: texture() result used in vec3 context without swizzle
    // ret = texture(sampler, uv);  where ret is vec3
    if (/\bret\s*=\s*texture\s*\(/.test(trimmed) && !trimmed.includes('.xyz') && !trimmed.includes('.rgb')) {
      issues.push({ file, pass, line: lineNum, category: 'ret-assign-texture-vec4', evidence: trimmed });
    }

    // Category: shader_body remnant
    if (/\bshader_body\b/.test(trimmed)) {
      issues.push({ file, pass, line: lineNum, category: 'shader-body-remnant', evidence: trimmed });
    }

    // Category: vec3 = scalar subtraction: ret = 1.0 - vec3
    // Already partially handled but check
    if (/\bret\s*=\s*-?(?:\d+\.?\d*|\.\d+)\s*[-+*/]\s*(?:ret|col|GetPixel|texture)\b/.test(trimmed)) {
      // This is handled by patcher for ret, but check other variables
    }

    // Category: clamp/smoothstep with mixed vec/scalar args
    if (/\b(clamp|smoothstep)\s*\(/.test(trimmed)) {
      const clampMatch = trimmed.match(/\b(clamp|smoothstep)\s*\(\s*([^,]+),\s*([^,]+),\s*([^)]+)\)/);
      if (clampMatch) {
        const args = [clampMatch[2], clampMatch[3], clampMatch[4]];
        const hasVec = args.some(a => /\bret\b|\bcol\b|\bGetPixel|\btexture|\bvec[234]/.test(a));
        const hasScalar = args.some(a => /^\s*-?(\d+\.?\d*|\.\d+)\s*$/.test(a.trim()));
        if (hasVec && hasScalar) {
          issues.push({ file, pass, line: lineNum, category: `${clampMatch[1]}-vec-scalar-mismatch`, evidence: trimmed });
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
