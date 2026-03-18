import type { RenderState } from './renderState';

export interface MilkDropShaderData {
  warp: string;
  comp: string;
  perFrameCode: string[];
  perFrameInitCode: string[];
  originalParameters: Record<string, number | boolean>;
}

export interface MilkDropRendererOptions {
  canvas: HTMLCanvasElement;
  onError?: (error: string, type: 'vertex' | 'fragment' | 'link') => void;
}

export interface MilkDropVariables {
  time: number;
  frame: number;
  fps: number;
  bass: number;
  mid: number;
  treb: number;
  bass_att: number;
  mid_att: number;
  treb_att: number;
  [key: string]: number;
}

/**
 * Runtime GLSL patcher for MilkDrop preset shaders.
 *
 * The import-time HLSL→GLSL transpiler (hlslToGlsl.ts) converts types and
 * function names but misses several MilkDrop-specific constructs:
 *   - Missing helper functions: lum(), sat(), noise3(), GetMain(), multiply()
 *   - Missing sampler aliases: sampler_fc_main, sampler_pc_main, etc.
 *   - Missing q-variable uniforms (q1–q32)
 *   - Missing MilkDrop built-in uniforms (_c0–_c17, _qa–_qh, texsize, etc.)
 *   - Undeclared local variables (HLSL auto-declares; GLSL does not)
 *   - Boolean NOT on floats: !mask → (mask == 0.0 ? 1.0 : 0.0)
 *
 * Rather than re-importing 7000+ presets, we patch at compile time.
 */
const patchMilkDropGlsl = (source: string): string => {
  if (!source || !source.includes('#version 300 es')) return source;

  // ── 1. Inject missing helpers + uniforms after the header block ──
  // Find the spot right before `void main()` to inject our additions
  const mainIdx = source.indexOf('void main()');
  if (mainIdx === -1) return source;

  // Collect what's already declared to avoid duplicates
  const beforeMain = source.substring(0, mainIdx);
  const afterMainStart = source.substring(mainIdx);

  const additions: string[] = [];

  // ── Sampler aliases (all point to sampler_main / sampler_noise_lq) ──
  const samplerAliases: [string, string][] = [
    ['sampler_fc_main', 'sampler_main'],
    ['sampler_pc_main', 'sampler_main'],
    ['sampler_fw_main', 'sampler_main'],
    ['sampler_pw_main', 'sampler_main'],
    ['sampler_noise_lq_lite', 'sampler_noise_lq'],
    ['sampler_noisevol_lq', 'sampler_noise_lq'],
    ['sampler_noisevol_hq', 'sampler_noise_hq'],
  ];
  for (const [alias, target] of samplerAliases) {
    if (source.includes(alias) && !beforeMain.includes(`uniform sampler2D ${alias}`)) {
      additions.push(`#define ${alias} ${target}`);
    }
  }

  // ── Case-insensitive sampler aliases ──
  const caseAliases: [string, string][] = [
    ['sampler_FC_main', 'sampler_main'],
    ['sampler_PC_main', 'sampler_main'],
    ['sampler_FW_main', 'sampler_main'],
    ['sampler_PW_main', 'sampler_main'],
  ];
  for (const [alias, target] of caseAliases) {
    if (source.includes(alias) && !beforeMain.includes(`#define ${alias}`)) {
      additions.push(`#define ${alias} ${target}`);
    }
  }

  // ── q-variable uniforms (q1–q32) ──
  const qVarsUsed: number[] = [];
  for (let i = 1; i <= 32; i++) {
    const re = new RegExp(`\\bq${i}\\b`);
    if (re.test(source) && !beforeMain.includes(`uniform float q${i};`)) {
      qVarsUsed.push(i);
    }
  }
  if (qVarsUsed.length > 0) {
    additions.push(`// q-variable uniforms from per-frame code`);
    for (const i of qVarsUsed) {
      additions.push(`uniform float q${i};`);
    }
  }

  // ── MilkDrop built-in uniforms ──
  const builtinUniforms: [string, string][] = [
    ['_c0', 'vec4'], ['_c1', 'vec4'], ['_c2', 'vec4'], ['_c3', 'vec4'],
    ['_c4', 'vec4'], ['_c5', 'vec4'], ['_c6', 'vec4'], ['_c7', 'vec4'],
    ['_c8', 'vec4'], ['_c9', 'vec4'], ['_c10', 'vec4'], ['_c11', 'vec4'],
    ['_c12', 'vec4'], ['_c13', 'vec4'], ['_c14', 'vec4'],
    ['_c15', 'vec4'], ['_c16', 'vec4'], ['_c17', 'vec4'],
    ['_qa', 'vec4'], ['_qb', 'vec4'], ['_qc', 'vec4'], ['_qd', 'vec4'],
    ['_qe', 'vec4'], ['_qf', 'vec4'], ['_qg', 'vec4'], ['_qh', 'vec4'],
    ['rand_frame', 'vec4'], ['rand_preset', 'vec4'],
    ['texsize_noise_lq', 'vec4'], ['texsize_noise_mq', 'vec4'],
    ['texsize_noise_hq', 'vec4'],
  ];
  for (const [name, type] of builtinUniforms) {
    const re = new RegExp(`\\b${name}\\b`);
    if (re.test(source) && !beforeMain.includes(`uniform ${type} ${name}`)) {
      additions.push(`uniform ${type} ${name};`);
    }
  }

  // ── Rotation matrices ──
  const rotNames = [
    'rot_s1', 'rot_s2', 'rot_s3', 'rot_s4',
    'rot_d1', 'rot_d2', 'rot_d3', 'rot_d4',
    'rot_f1', 'rot_f2', 'rot_f3', 'rot_f4',
    'rot_vf1', 'rot_vf2', 'rot_vf3', 'rot_vf4',
    'rot_uf1', 'rot_uf2', 'rot_uf3', 'rot_uf4',
    'rot_rand1', 'rot_rand2', 'rot_rand3', 'rot_rand4',
  ];
  for (const name of rotNames) {
    const re = new RegExp(`\\b${name}\\b`);
    if (re.test(source) && !beforeMain.includes(`uniform mat4 ${name}`)) {
      // float4x3 → use mat4 for simplicity (padded)
      additions.push(`uniform mat4 ${name};`);
    }
  }

  // ── Missing helper functions ──
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
    // noise3(uv) → sample from noise texture
    additions.push(`vec4 noise3(vec2 uv) { return texture(sampler_noise_lq, uv); }`);
  }

  if (/\bGetMain\s*\(/.test(source) && !beforeMain.includes('vec3 GetMain(')) {
    additions.push(`vec3 GetMain(vec2 uv) { return texture(sampler_main, uv).xyz; }`);
  }

  if (/\bmultiply\s*\(/.test(source) && !beforeMain.includes('vec2 multiply(')) {
    // HLSL mul(vector, matrix) → GLSL: matrix * vector
    additions.push(`vec2 multiply(vec2 v, mat2 m) { return m * v; }`);
    additions.push(`vec3 multiply(vec3 v, mat3 m) { return m * v; }`);
    additions.push(`vec4 multiply(vec4 v, mat4 m) { return m * v; }`);
  }

  // MilkDrop #define shortcuts that may appear in shader bodies
  // texsize in MilkDrop is vec4(w, h, 1/w, 1/h) — uTexSize is only vec2
  // Must use #define (not global var) because GLSL ES can't init globals from uniforms
  if (/\btexsize\b/.test(afterMainStart) && !beforeMain.includes('#define texsize') && !beforeMain.includes('uniform vec4 texsize')) {
    additions.push(`#define texsize vec4(uTexSize, 1.0/uTexSize)`);
  }

  // vUvOriginal: the transpiler maps uv_orig→vUvOriginal but the header doesn't declare it
  if (/\bvUvOriginal\b/.test(source) && !beforeMain.includes('in vec2 vUvOriginal')) {
    additions.push(`in vec2 vUvOriginal;`);
  }

  // ── 2. Auto-declare undeclared local variables in the shader body ──
  // Extract the body of void main() { ... }
  let patched = source;

  // Find void main() body
  const mainBodyStart = patched.indexOf('{', patched.indexOf('void main()'));
  if (mainBodyStart !== -1) {
    const beforeBody = patched.substring(0, mainBodyStart + 1);
    let body = patched.substring(mainBodyStart + 1);

    // Known declared/built-in names to skip
    const declared = new Set<string>();
    // Collect all names already declared with a type
    const declRe = /\b(float|vec[234]|mat[234]|int|bool|ivec[234]|bvec[234])\s+([a-zA-Z_]\w*)/g;
    let m: RegExpExecArray | null;
    while ((m = declRe.exec(patched)) !== null) {
      declared.add(m[2]);
    }
    // Add built-in variables, uniforms, varyings, functions
    const builtins = new Set([
      'gl_FragCoord', 'gl_FrontFacing', 'gl_PointCoord',
      'fragColor', 'vUv', 'vUvOriginal', 'vRadius', 'vAngle', 'uv', 'ret', 'rad',
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
      // Loop variables
      'i', 'j', 'k', 'n', 'x', 'y', 'z', 'w', 'r', 'g', 'b', 'a', 's', 't', 'p',
    ]);

    // Add q-vars and _c vars
    for (let qi = 1; qi <= 32; qi++) builtins.add(`q${qi}`);
    for (let ci = 0; ci <= 17; ci++) builtins.add(`_c${ci}`);
    ['_qa','_qb','_qc','_qd','_qe','_qf','_qg','_qh'].forEach(v => builtins.add(v));
    rotNames.forEach(v => builtins.add(v));
    ['rand_frame','rand_preset','texsize_noise_lq','texsize_noise_mq','texsize_noise_hq','texsize'].forEach(v => builtins.add(v));

    // Find all assignments like: `name = expr` where name is not declared
    const assignRe = /^[ \t]*([a-zA-Z_]\w*)\s*=[^=]/gm;
    const undeclared = new Set<string>();
    let am: RegExpExecArray | null;
    while ((am = assignRe.exec(body)) !== null) {
      const vname = am[1];
      if (!declared.has(vname) && !builtins.has(vname) && !undeclared.has(vname)) {
        // Check it's not a swizzle target (e.g., ret.xyz = ...)
        const lineStart = body.lastIndexOf('\n', am.index);
        const lineBefore = body.substring(lineStart + 1, am.index).trim();
        if (!lineBefore.includes('.')) {
          undeclared.add(vname);
        }
      }
    }

    // For each undeclared variable, infer type from usage context
    if (undeclared.size > 0) {
      const decls: string[] = ['  // Auto-declared MilkDrop variables'];
      const varTypes = new Map<string, string>();
      for (const vname of undeclared) {
        // Collect ALL assignment RHS to determine best type
        const usageRe = new RegExp(`\\b${vname}\\b\\s*=[^=]*`, 'g');
        const candidates: string[] = [];
        let um: RegExpExecArray | null;
        while ((um = usageRe.exec(body)) !== null) {
          const rhs = um[0];
          if (/=\s*vec2\s*\(/.test(rhs)) { candidates.push('vec2'); }
          else if (/=\s*vec3\s*\(/.test(rhs) || /=\s*GetPixel|=\s*GetBlur|=\s*GetMain/.test(rhs)) { candidates.push('vec3'); }
          else if (/=\s*vec4\s*\(/.test(rhs) || /=\s*texture\s*\(/.test(rhs)) { candidates.push('vec4'); }
          else if (/=\s*mat2\s*\(/.test(rhs)) { candidates.push('mat2'); }
          else if (/=\s*mat3\s*\(/.test(rhs)) { candidates.push('mat3'); }
          else if (/=\s*(?:float|int|bool)?\s*\d/.test(rhs) || /=\s*(?:sin|cos|length|dot|abs|pow|sqrt|floor|ceil|atan|acos|asin|fract|clamp01|lum|sat|max|min|clamp|step|smoothstep)\s*\(/.test(rhs)) { candidates.push('float'); }
          else if (/=\s*\d+\.\d+/.test(rhs) || /=\s*\d+\s*[;,)]/.test(rhs)) { candidates.push('float'); }
        }
        // Check if used as LHS with swizzle assignment: var.xyz = ... → must be vec
        const lhsAccessRe = new RegExp(`\\b${vname}\\.(xy|xyz|xyzw|rg|rgb|rgba)\\s*=`, 'g');
        let lhsMatch: RegExpExecArray | null;
        let needsVecFromLhs = 0;
        while ((lhsMatch = lhsAccessRe.exec(body)) !== null) {
          needsVecFromLhs = Math.max(needsVecFromLhs, lhsMatch[1].length);
        }
        // Determine type: prioritize vec types from assignments, fall back to float
        let type = 'float'; // safer default — most undeclared MilkDrop vars are float
        const vecCandidates = candidates.filter(c => c.startsWith('vec') || c.startsWith('mat'));
        if (vecCandidates.length > 0) {
          // Use the vec type that appears most, or the largest
          type = vecCandidates[0];
        } else if (candidates.length > 0) {
          type = candidates[0];
        }
        // Override from LHS swizzle assignment (var.xyz = ...)
        if (needsVecFromLhs >= 4) type = 'vec4';
        else if (needsVecFromLhs >= 3 && type === 'float') type = 'vec3';
        else if (needsVecFromLhs >= 2 && type === 'float') type = 'vec2';
        // Also check RHS swizzle reads — but only promote if no conflicting scalar assignments
        // In HLSL, `scalar.xxx` is valid (broadcast); in GLSL it's not — we'll rewrite those later
        if (type === 'float') {
          const rhsAccessRe = new RegExp(`\\b${vname}\\.(xy|xyz|xyzw|rg|rgb|rgba)\\b`);
          const rhsMatch = rhsAccessRe.exec(body);
          // Only promote if there are NO scalar assignments (all assignments are vec-compatible)
          if (rhsMatch && candidates.every(c => c !== 'float')) {
            const acc = rhsMatch[1];
            if (acc.length >= 4) type = 'vec4';
            else if (acc.length >= 3) type = 'vec3';
            else if (acc.length >= 2) type = 'vec2';
          }
        }
        varTypes.set(vname, type);
        decls.push(`  ${type} ${vname} = ${type === 'float' ? '0.0' : type + '(0.0)'};`);
      }

      // Post-fix: wrap scalar RHS in vec constructor for vec-typed auto-declared vars
      for (const [vname, type] of varTypes) {
        if (!type.startsWith('vec')) continue;
        // Match: vname = max(...) or vname = min(...) etc. where result would be scalar
        const scalarFns = 'max|min|clamp|abs|pow|sqrt|floor|ceil|fract|sin|cos|atan|acos|asin|length|dot|step|smoothstep|mix';
        const fixRe = new RegExp(
          `(\\b${vname}\\s*=\\s*)((?:${scalarFns})\\s*\\([^;]*\\))\\s*;`,
          'g'
        );
        body = body.replace(fixRe, (m, lhs, rhs) => {
          // Don't wrap if RHS already produces a vec (contains vec constructor or GetPixel)
          if (/\bvec[234]\s*\(/.test(rhs) || /\bGetPixel|GetBlur|GetMain/.test(rhs) || /\btexture\s*\(/.test(rhs)) {
            return m;
          }
          return `${lhs}${type}(${rhs});`;
        });
      }

      body = '\n' + decls.join('\n') + '\n' + body;
    }

    // ── 3. Fix boolean NOT on floats: !varname → (varname == 0.0 ? 1.0 : 0.0) ──
    // Match !identifier but not != and not !!(
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

  // ── 5. Fix uTexSize swizzle: transpiler replaced texsize→uTexSize (vec2),
  // but MilkDrop texsize is vec4(w, h, 1/w, 1/h) — .z/.w/.zw access fails on vec2.
  patched = patched.replace(/\buTexSize\.zw\b/g, '(vec2(1.0)/uTexSize)');
  patched = patched.replace(/\buTexSize\.z\b/g, '(1.0/uTexSize.x)');
  patched = patched.replace(/\buTexSize\.w\b/g, '(1.0/uTexSize.y)');
  // Also handle the 4-component swizzle
  patched = patched.replace(/\buTexSize\.xyzw\b/g, 'vec4(uTexSize, 1.0/uTexSize)');

  // ── 6. Fix GLSL ES strict typing issues ──
  // HLSL auto-promotes int→float; GLSL ES 3.0 does not.
  // Process line-by-line for safer context-aware integer promotion.
  patched = patched.split('\n').map(line => {
    const trimmed = line.trim();
    // Skip lines that are purely integer declarations, for loops, or array indices
    if (/^\s*int\s/.test(line) || /^\s*for\s*\(/.test(line) || /^\s*ivec/.test(line)) return line;
    // Skip preprocessor directives
    if (trimmed.startsWith('#')) return line;

    // Fix integer literals in float/vec contexts:
    // 1. After arithmetic operators: expr * 2 → expr * 2.0, expr * -4 → expr * -4.0
    //    Covers *, /, +, - with optional negation on the integer
    line = line.replace(/([a-zA-Z_)\]]\w*(?:\.[xyzwrgba]+)?)\s*([*\/+\-])\s*(-?\d+)(?!\.|\d|\s*\[)/g,
      (m, id, op, num) => `${id} ${op} ${num}.0`
    );
    // 2. Before arithmetic operators: 2 * expr → 2.0 * expr, 1-expr → 1.0-expr
    line = line.replace(/(?<=[\s(,=])(\d+)(?!\.\d)\s*([*\/+\-])\s*([a-zA-Z_(])/g,
      (m, num, op, id) => `${num}.0 ${op} ${id}`
    );
    // 3. Inside vec/mat constructors: vec3(x, 0) → vec3(x, 0.0)
    //    Match bare integers after comma or opening paren, before comma or close-paren
    line = line.replace(
      /(?<=[,(])\s*(\d+)\s*(?=[,)])/g,
      (m, num) => ` ${num}.0 `
    );

    return line;
  }).join('\n');

  // Fix ret type mismatch: the template declares `vec4 ret` but MilkDrop shaders
  // assign vec3 values to it (GetPixel returns vec3 in original MilkDrop).
  // Change ret to vec3 and fix the output.
  patched = patched.replace(/\bvec4\s+ret\s*=\s*vec4\(0\.0\)\s*;/, 'vec3 ret = vec3(0.0);');
  patched = patched.replace(
    /fragColor\s*=\s*ret\s*;/g,
    'fragColor = vec4(ret, 1.0);'
  );

  // Fix GetPixel/GetBlur return type: stored header has vec4, MilkDrop expects vec3.
  // Change the helper function return types in the header.
  patched = patched.replace(
    /vec4 GetPixel\(vec2 uv\)\s*\{\s*return texture\(sampler_main,\s*uv\);\s*\}/,
    'vec3 GetPixel(vec2 uv) { return texture(sampler_main, uv).xyz; }'
  );
  patched = patched.replace(
    /vec4 GetBlur1\(vec2 uv\)\s*\{\s*return texture\(sampler_blur1,\s*uv\);\s*\}/,
    'vec3 GetBlur1(vec2 uv) { return texture(sampler_blur1, uv).xyz; }'
  );
  patched = patched.replace(
    /vec4 GetBlur2\(vec2 uv\)\s*\{\s*return texture\(sampler_blur2,\s*uv\);\s*\}/,
    'vec3 GetBlur2(vec2 uv) { return texture(sampler_blur2, uv).xyz; }'
  );
  patched = patched.replace(
    /vec4 GetBlur3\(vec2 uv\)\s*\{\s*return texture\(sampler_blur3,\s*uv\);\s*\}/,
    'vec3 GetBlur3(vec2 uv) { return texture(sampler_blur3, uv).xyz; }'
  );

  return patched;
};

const createMilkDropVertexShader = (gl: WebGL2RenderingContext): WebGLShader | null => {
  const source = `#version 300 es
precision highp float;

in vec2 position;
out vec2 vUv;
out vec2 vUvOriginal;
out float vRadius;
out float vAngle;

void main() {
  vUv = position * 0.5 + 0.5;
  vUvOriginal = vUv;
  vec2 centered = position;
  vRadius = length(centered);
  vAngle = atan(centered.y, centered.x);
  gl_Position = vec4(position, 0.0, 1.0);
}`;
  const shader = gl.createShader(gl.VERTEX_SHADER);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    return null;
  }
  return shader;
};

const createMilkDropFragmentShader = (gl: WebGL2RenderingContext, source: string): WebGLShader | null => {
  const shader = gl.createShader(gl.FRAGMENT_SHADER);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    console.error('[MilkDrop] Fragment shader compile error:', info);
    // Log all error lines for diagnosis
    const lines = source.split('\n');
    const errorLines = new Set<number>();
    const lineRe = /\d+:(\d+):/g;
    let lm: RegExpExecArray | null;
    while ((lm = lineRe.exec(info ?? '')) !== null) {
      errorLines.add(parseInt(lm[1], 10));
    }
    if (errorLines.size > 0) {
      const minLine = Math.min(...errorLines);
      const maxLine = Math.max(...errorLines);
      const start = Math.max(0, minLine - 5);
      const end = Math.min(lines.length, maxLine + 3);
      console.error('[MilkDrop] Shader lines around errors:',
        lines.slice(start, end).map((l, i) => `${start + i + 1}: ${l}`).join('\n')
      );
    }
    return null;
  }
  return shader;
};

const createProgram = (gl: WebGL2RenderingContext, vs: WebGLShader, fs: WebGLShader): WebGLProgram | null => {
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    console.error('[MilkDrop] Program link error:', info);
    return null;
  }
  return program;
};

const createFramebuffer = (gl: WebGL2RenderingContext, width: number, height: number): { fbo: WebGLFramebuffer; texture: WebGLTexture } | null => {
  const fbo = gl.createFramebuffer();
  const texture = gl.createTexture();
  if (!fbo || !texture) return null;
  
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    console.error('[MilkDrop] Framebuffer incomplete');
    return null;
  }
  
  return { fbo, texture };
};

const createBlurTexture = (gl: WebGL2RenderingContext, width: number, height: number, downsample: number): WebGLTexture => {
  const texture = gl.createTexture();
  if (!texture) throw new Error('Failed to create texture');
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, Math.max(1, Math.floor(width / downsample)), Math.max(1, Math.floor(height / downsample)), 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return texture;
};

const BLUR_VERTEX_SHADER = `#version 300 es
precision highp float;
in vec2 position;
out vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const BLUR_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uSource;
uniform vec2 uDirection;
uniform vec2 uResolution;
out vec4 fragColor;

void main() {
  vec2 texelSize = 1.0 / uResolution;
  vec4 result = vec4(0.0);
  float weights[5] = float[](0.227027, 0.1945946, 0.1216216, 0.054054, 0.016216);
  
  result += texture(uSource, vUv) * weights[0];
  for (int i = 1; i < 5; i++) {
    vec2 offset = uDirection * texelSize * float(i);
    result += texture(uSource, vUv + offset) * weights[i];
    result += texture(uSource, vUv - offset) * weights[i];
  }
  
  fragColor = result;
}`;

/**
 * Default warp shader for pre-MilkDrop2 presets (no custom GLSL).
 * Implements the classic MilkDrop warp mesh: zoom, rotation, warp distortion,
 * decay, and feedback from previous frame.
 */
const createDefaultWarpShader = (params: Record<string, number | boolean>): string => {
  const zoom = Number(params.zoom ?? 1);
  const rot = Number(params.rot ?? 0);
  const decay = Number(params.fDecay ?? 0.95);
  const warpAmount = Number(params.warp ?? 0.01);
  const cx = Number(params.cx ?? 0.5);
  const cy = Number(params.cy ?? 0.5);
  const dx = Number(params.dx ?? 0);
  const dy = Number(params.dy ?? 0);
  const sx = Number(params.sx ?? 1);
  const sy = Number(params.sy ?? 1);
  return `#version 300 es
precision highp float;
in vec2 vUv;
in vec2 vUvOriginal;
in float vRadius;
in float vAngle;
out vec4 fragColor;
uniform sampler2D sampler_main;
uniform float uTime;
uniform float audioLow;
uniform float audioMid;
uniform float audioHigh;
uniform float audioLowSmooth;

void main() {
  vec2 center = vec2(${cx.toFixed(4)}, ${cy.toFixed(4)});
  vec2 uv = vUv - center;

  // Zoom
  float z = ${zoom.toFixed(4)} + audioLowSmooth * 0.05;
  uv /= max(z, 0.001);

  // Rotation
  float angle = ${rot.toFixed(4)} * 0.01 + audioMid * 0.002;
  float ca = cos(angle);
  float sa = sin(angle);
  uv = mat2(ca, sa, -sa, ca) * uv;

  // Scale
  uv *= vec2(${sx.toFixed(4)}, ${sy.toFixed(4)});

  // Translation
  uv += vec2(${dx.toFixed(4)}, ${dy.toFixed(4)});

  // Warp distortion
  float warp = ${warpAmount.toFixed(4)};
  uv += warp * 0.03 * vec2(
    sin(uv.y * 6.28 + uTime * 0.5),
    cos(uv.x * 6.28 + uTime * 0.5)
  );

  uv += center;

  // Sample previous frame with decay
  vec3 color = texture(sampler_main, uv).rgb;
  color *= ${decay.toFixed(4)};
  fragColor = vec4(color, 1.0);
}`;
};

/** Fallback warp shader when custom shader fails to compile */
const createFallbackWarpShader = (): string => `#version 300 es
precision highp float;
in vec2 vUv;
in vec2 vUvOriginal;
in float vRadius;
in float vAngle;
out vec4 fragColor;
uniform sampler2D sampler_main;
uniform float uTime;

void main() {
  vec2 uv = vUv;
  // Gentle zoom + rotation from previous frame
  vec2 center = vec2(0.5);
  uv -= center;
  float angle = 0.003;
  float ca = cos(angle); float sa = sin(angle);
  uv = mat2(ca, sa, -sa, ca) * uv;
  uv *= 0.99;
  uv += center;
  vec3 color = texture(sampler_main, uv).rgb * 0.97;
  fragColor = vec4(color, 1.0);
}`;

/** Fallback/default comp shader: sample warp output with optional tone adjustment */
const createFallbackCompShader = (): string => `#version 300 es
precision highp float;
in vec2 vUv;
in vec2 vUvOriginal;
in float vRadius;
in float vAngle;
out vec4 fragColor;
uniform sampler2D sampler_main;

void main() {
  vec3 color = texture(sampler_main, vUv).rgb;
  // Slight vignette
  float vig = 1.0 - 0.3 * vRadius * vRadius;
  fragColor = vec4(color * vig, 1.0);
}`;

export const createMilkDropRenderer = (options: MilkDropRendererOptions) => {
  const { canvas, onError } = options;
  const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true });
  if (!gl) {
    throw new Error('[MilkDrop] WebGL2 required');
  }

  let warpProgram: WebGLProgram | null = null;
  let compProgram: WebGLProgram | null = null;
  let blurProgram: WebGLProgram | null = null;
  
  let mainFbo: { fbo: WebGLFramebuffer; texture: WebGLTexture } | null = null;
  let warpFbo: { fbo: WebGLFramebuffer; texture: WebGLTexture } | null = null;
  let blur1Fbo: { fbo: WebGLFramebuffer; texture: WebGLTexture } | null = null;
  let blur2Fbo: { fbo: WebGLFramebuffer; texture: WebGLTexture } | null = null;
  let blur3Fbo: { fbo: WebGLFramebuffer; texture: WebGLTexture } | null = null;
  
  let noiseTexture: WebGLTexture | null = null;
  let lastWidth = 0;
  let lastHeight = 0;
  
  const variables: MilkDropVariables = {
    time: 0,
    frame: 0,
    fps: 60,
    bass: 0,
    mid: 0,
    treb: 0,
    bass_att: 0,
    mid_att: 0,
    treb_att: 0,
  };
  
  const qVars: number[] = new Array(32).fill(0);
  const customVars: Record<string, number> = {};
  const megabufData: Record<number, number> = {};
  // Random preset value — set once per preset load, not per frame
  let randomPreset = [Math.random(), Math.random()];
  const gmegabufData: Record<number, number> = {};
  let perFrameInitRun = false;
  
  const positionBuffer = gl.createBuffer();
  if (!positionBuffer) throw new Error('[MilkDrop] Buffer creation failed');
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

  const initBlurProgram = () => {
    // Note: blur vertex shader must use VERTEX_SHADER type, not fragment
    const vs = gl.createShader(gl.VERTEX_SHADER);
    if (!vs) return;
    gl.shaderSource(vs, BLUR_VERTEX_SHADER);
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) return;
    const fs = createMilkDropFragmentShader(gl, BLUR_FRAGMENT_SHADER);
    if (!fs) return;
    blurProgram = createProgram(gl, vs, fs);
  };
  initBlurProgram();

  const generateNoiseTexture = (width: number, height: number): WebGLTexture => {
    const texture = gl.createTexture()!;
    const data = new Uint8Array(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
      const v = Math.random() * 255;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    return texture;
  };

  // Create noise texture once (not on every resize)
  noiseTexture = generateNoiseTexture(256, 256);

  const ensureFramebuffers = (width: number, height: number) => {
    if (width === lastWidth && height === lastHeight && mainFbo) return;

    mainFbo = createFramebuffer(gl, width, height);
    warpFbo = createFramebuffer(gl, width, height);
    blur1Fbo = createFramebuffer(gl, Math.max(1, Math.floor(width / 2)), Math.max(1, Math.floor(height / 2)));
    blur2Fbo = createFramebuffer(gl, Math.max(1, Math.floor(width / 4)), Math.max(1, Math.floor(height / 4)));
    blur3Fbo = createFramebuffer(gl, Math.max(1, Math.floor(width / 8)), Math.max(1, Math.floor(height / 8)));

    lastWidth = width;
    lastHeight = height;
  };

  const compileShaders = (shaderData: MilkDropShaderData): boolean => {
    warpProgram = null;
    compProgram = null;
    const vs = createMilkDropVertexShader(gl);
    if (!vs) {
      onError?.('Failed to compile vertex shader', 'vertex');
      return false;
    }

    if (shaderData.warp) {
      const patchedWarp = patchMilkDropGlsl(shaderData.warp);
      const warpFs = createMilkDropFragmentShader(gl, patchedWarp);
      if (warpFs) {
        warpProgram = createProgram(gl, vs, warpFs);
        if (!warpProgram) {
          onError?.('Failed to link warp program', 'link');
        }
      } else {
        console.warn('[MilkDrop] Warp shader compile failed, using fallback');
        const fallbackWarp = createFallbackWarpShader();
        const fallbackFs = createMilkDropFragmentShader(gl, fallbackWarp);
        if (fallbackFs) warpProgram = createProgram(gl, vs, fallbackFs);
      }
    } else {
      // Pre-MilkDrop2 preset: no custom warp shader, use default warp
      const defaultWarp = createDefaultWarpShader(shaderData.originalParameters);
      const defaultFs = createMilkDropFragmentShader(gl, defaultWarp);
      if (defaultFs) warpProgram = createProgram(gl, vs, defaultFs);
    }

    if (shaderData.comp) {
      const patchedComp = patchMilkDropGlsl(shaderData.comp);
      const compFs = createMilkDropFragmentShader(gl, patchedComp);
      if (compFs) {
        compProgram = createProgram(gl, vs, compFs);
        if (!compProgram) {
          onError?.('Failed to link comp program', 'link');
        }
      } else {
        console.warn('[MilkDrop] Comp shader compile failed, using fallback');
        const fallbackComp = createFallbackCompShader();
        const fallbackFs = createMilkDropFragmentShader(gl, fallbackComp);
        if (fallbackFs) compProgram = createProgram(gl, vs, fallbackFs);
      }
    } else {
      // Pre-MilkDrop2 preset: no custom comp shader, use default passthrough
      const defaultComp = createFallbackCompShader();
      const defaultFs = createMilkDropFragmentShader(gl, defaultComp);
      if (defaultFs) compProgram = createProgram(gl, vs, defaultFs);
    }

    // Reset state for new preset
    qVars.fill(0);
    Object.keys(megabufData).forEach(k => delete megabufData[Number(k)]);
    Object.keys(gmegabufData).forEach(k => delete gmegabufData[Number(k)]);
    Object.keys(customVars).forEach(k => delete customVars[k]);
    variables.frame = 0;
    perFrameInitRun = false;
    randomPreset = [Math.random(), Math.random()];

    console.log('[MilkDrop] Shaders compiled:', {
      warp: !!warpProgram,
      comp: !!compProgram
    });
    return warpProgram !== null || compProgram !== null;
  };

  const executePerFrameCode = (code: string[], state: RenderState) => {
    const bass = state.spectrum?.[0] ?? state.rms ?? 0;
    const mid = state.spectrum?.[Math.floor((state.spectrum?.length ?? 0) / 2)] ?? state.rms ?? 0;
    const treb = state.spectrum?.[(state.spectrum?.length ?? 1) - 1] ?? state.rms ?? 0;
    
    // Standard MilkDrop variable names — these get fresh values each frame
    // and must NOT be overwritten by stale customVars from the previous frame.
    const standardVarNames = new Set([
      'time', 'frame', 'fps', 'bass', 'mid', 'treb',
      'bass_att', 'mid_att', 'treb_att', 'rms',
    ]);
    for (let qi = 1; qi <= 32; qi++) standardVarNames.add(`q${qi}`);

    const ctx: Record<string, any> = {
      // Custom vars from previous frame (persistent state like 'puls', 'beat', etc.)
      // Must come FIRST so fresh values below overwrite standard variable names
      ...customVars,
      // Fresh values — always take priority
      time: state.timeMs / 1000,
      frame: variables.frame,
      fps: 60,
      bass,
      mid,
      treb,
      bass_att: bass * 0.9 + variables.bass * 0.1,
      mid_att: mid * 0.9 + variables.mid * 0.1,
      treb_att: treb * 0.9 + variables.treb * 0.1,
      rms: state.rms,
      ...qVars.reduce((acc, v, i) => { acc[`q${i + 1}`] = v; return acc; }, {} as Record<string, number>),
      above: (a: number, b: number) => a > b ? 1 : 0,
      below: (a: number, b: number) => a < b ? 1 : 0,
      equal: (a: number, b: number) => a === b ? 1 : 0,
      if_milk: (cond: number, a: number, b: number) => cond ? a : b,
      max: Math.max,
      min: Math.min,
      sin: Math.sin,
      cos: Math.cos,
      tan: Math.tan,
      abs: Math.abs,
      sqrt: Math.sqrt,
      pow: Math.pow,
      log: Math.log,
      exp: Math.exp,
      floor: Math.floor,
      ceil: Math.ceil,
      sign: Math.sign,
      rand: (max: number) => Math.random() * max,
      bor: (a: number, b: number) => (a || b) ? 1 : 0,
      bnot: (a: number) => a ? 0 : 1,
      band: (a: number, b: number) => (a && b) ? 1 : 0,
      sqr: (a: number) => a * a,
      sigmoid: (x: number, c: number) => 1 / (1 + Math.exp(-x * c)),
      int: Math.trunc,
      frac: (x: number) => x - Math.trunc(x),
      pi: Math.PI,
      // megabuf/gmegabuf: large float arrays used by complex presets
      megabuf: (idx: number, val?: number) => {
        const i = Math.trunc(idx);
        if (val !== undefined) { megabufData[i] = val; return val; }
        return megabufData[i] ?? 0;
      },
      gmegabuf: (idx: number, val?: number) => {
        const i = Math.trunc(idx);
        if (val !== undefined) { gmegabufData[i] = val; return val; }
        return gmegabufData[i] ?? 0;
      },
    };

    try {
      // Preprocess MilkDrop code → JavaScript:
      // - Join all lines into a single block (variables persist across lines)
      // - Convert MilkDrop functions: if(cond, then, else), loop(), megabuf(), etc.
      const allLines = code
        .filter(line => line.trim() && !line.trim().startsWith('//'))
        .map(line => {
          let l = line.trim();
          // Convert megabuf(idx) = value → megabuf(idx, value)
          l = l.replace(/\b(megabuf|gmegabuf)\s*\(([^)]+)\)\s*=\s*([^;]+)/g, '$1($2, $3)');
          // Convert MilkDrop if(cond, a, b) to JS ternary (simplified)
          l = l.replace(/\bif\s*\(\s*([^,]+),\s*([^,]+),\s*([^)]+)\)/g, '(($1) ? ($2) : ($3))');
          // Convert loop(n, body) → for loop (simplified — many presets won't use this)
          l = l.replace(/\bloop\s*\(\s*(\w+)\s*,/g, 'for (let __i=0; __i<$1; __i++) {');
          // Close loop parentheses (best-effort)
          if (l.includes('for (let __i')) {
            l = l.replace(/\);\s*$/, '} ');
          }
          // Convert MilkDrop modulo operator (% on floats)
          // Convert ternary MilkDrop syntax: expr ? expr : expr already works in JS
          return l;
        })
        .join('\n');

      // Build executable function with all context vars as mutable locals
      const varNames = Object.keys(ctx).filter(k => typeof ctx[k] !== 'function');
      const funcNames = Object.keys(ctx).filter(k => typeof ctx[k] === 'function');
      const header = varNames.map(k => `let ${k} = __ctx.${k};`).join('\n');
      const funcHeader = funcNames.map(k => `const ${k} = __ctx.${k};`).join('\n');
      const footer = `return { ${varNames.join(', ')} };`;

      const fn = new Function('__ctx', `${header}\n${funcHeader}\n${allLines}\n${footer}`);
      const result = fn(ctx);
      if (result) {
        Object.assign(ctx, result);
        for (let i = 0; i < 32; i++) {
          qVars[i] = ctx[`q${i + 1}`] ?? qVars[i];
        }
        // Save only truly custom variables (not standard ones) for persistence
        for (const [k, v] of Object.entries(result)) {
          if (!standardVarNames.has(k) && typeof v === 'number') {
            customVars[k] = v;
          }
        }
      }
    } catch (_e) {
      // Per-frame code errors are expected for complex presets using megabuf/loop
    }

    variables.time = ctx.time;
    variables.frame = ctx.frame;
    variables.bass = ctx.bass;
    variables.mid = ctx.mid;
    variables.treb = ctx.treb;
    variables.bass_att = ctx.bass_att;
    variables.mid_att = ctx.mid_att;
    variables.treb_att = ctx.treb_att;
  };

  const applyBlurPass = (sourceTexture: WebGLTexture, targetFbo: WebGLFramebuffer | null, width: number, height: number, horizontal: boolean) => {
    if (!blurProgram) return;
    
    gl.useProgram(blurProgram);
    gl.bindFramebuffer(gl.FRAMEBUFFER, targetFbo);
    gl.viewport(0, 0, width, height);
    
    const sourceLoc = gl.getUniformLocation(blurProgram, 'uSource');
    const dirLoc = gl.getUniformLocation(blurProgram, 'uDirection');
    const resLoc = gl.getUniformLocation(blurProgram, 'uResolution');
    
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
    gl.uniform1i(sourceLoc, 0);
    gl.uniform2f(dirLoc, horizontal ? 1 : 0, horizontal ? 0 : 1);
    gl.uniform2f(resLoc, width, height);
    
    const posLoc = gl.getAttribLocation(blurProgram, 'position');
    gl.enableVertexAttribArray(posLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };

  const render = (state: RenderState, shaderData: MilkDropShaderData | null, outputToScreen: boolean = true): boolean => {
    const width = canvas.width;
    const height = canvas.height;

    ensureFramebuffers(width, height);

    if (!shaderData || (!warpProgram && !compProgram)) {
      return false;
    }

    // Run per-frame init code once on first frame
    if (!perFrameInitRun && shaderData.perFrameInitCode?.length) {
      executePerFrameCode(shaderData.perFrameInitCode, state);
      perFrameInitRun = true;
    }
    executePerFrameCode(shaderData.perFrameCode, state);

    gl.bindFramebuffer(gl.FRAMEBUFFER, warpFbo?.fbo ?? null);
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (warpProgram) {
      gl.useProgram(warpProgram);
      setUniforms(warpProgram, state, width, height);

      // Bind previous frame as sampler_main for warp pass
      if (mainFbo) {
        const mainLoc = gl.getUniformLocation(warpProgram, 'sampler_main');
        if (mainLoc) {
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, mainFbo.texture);
          gl.uniform1i(mainLoc, 0);
        }
      }
      if (noiseTexture) {
        const noiseLoc = gl.getUniformLocation(warpProgram, 'sampler_noise_lq');
        if (noiseLoc) {
          gl.activeTexture(gl.TEXTURE4);
          gl.bindTexture(gl.TEXTURE_2D, noiseTexture);
          gl.uniform1i(noiseLoc, 4);
        }
        const noiseMqLoc = gl.getUniformLocation(warpProgram, 'sampler_noise_mq');
        if (noiseMqLoc) gl.uniform1i(noiseMqLoc, 4);
        const noiseHqLoc = gl.getUniformLocation(warpProgram, 'sampler_noise_hq');
        if (noiseHqLoc) gl.uniform1i(noiseHqLoc, 4);
      }
      if (blur1Fbo) {
        const loc = gl.getUniformLocation(warpProgram, 'sampler_blur1');
        if (loc) { gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, blur1Fbo.texture); gl.uniform1i(loc, 1); }
      }
      if (blur2Fbo) {
        const loc = gl.getUniformLocation(warpProgram, 'sampler_blur2');
        if (loc) { gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, blur2Fbo.texture); gl.uniform1i(loc, 2); }
      }
      if (blur3Fbo) {
        const loc = gl.getUniformLocation(warpProgram, 'sampler_blur3');
        if (loc) { gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, blur3Fbo.texture); gl.uniform1i(loc, 3); }
      }

      const posLoc = gl.getAttribLocation(warpProgram, 'position');
      gl.enableVertexAttribArray(posLoc);
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    if (blurProgram && warpFbo) {
      // Blur1: half resolution
      const bw1 = Math.max(1, Math.floor(width / 2));
      const bh1 = Math.max(1, Math.floor(height / 2));
      const temp1 = createFramebuffer(gl, bw1, bh1);
      if (temp1) {
        applyBlurPass(warpFbo.texture, temp1.fbo, bw1, bh1, true);
        applyBlurPass(temp1.texture, blur1Fbo?.fbo ?? null, bw1, bh1, false);
        gl.deleteFramebuffer(temp1.fbo);
        gl.deleteTexture(temp1.texture);
      }

      // Blur2: quarter resolution (cascade from blur1)
      if (blur1Fbo && blur2Fbo) {
        const bw2 = Math.max(1, Math.floor(width / 4));
        const bh2 = Math.max(1, Math.floor(height / 4));
        const temp2 = createFramebuffer(gl, bw2, bh2);
        if (temp2) {
          applyBlurPass(blur1Fbo.texture, temp2.fbo, bw2, bh2, true);
          applyBlurPass(temp2.texture, blur2Fbo.fbo, bw2, bh2, false);
          gl.deleteFramebuffer(temp2.fbo);
          gl.deleteTexture(temp2.texture);
        }
      }

      // Blur3: eighth resolution (cascade from blur2)
      if (blur2Fbo && blur3Fbo) {
        const bw3 = Math.max(1, Math.floor(width / 8));
        const bh3 = Math.max(1, Math.floor(height / 8));
        const temp3 = createFramebuffer(gl, bw3, bh3);
        if (temp3) {
          applyBlurPass(blur2Fbo.texture, temp3.fbo, bw3, bh3, true);
          applyBlurPass(temp3.texture, blur3Fbo.fbo, bw3, bh3, false);
          gl.deleteFramebuffer(temp3.fbo);
          gl.deleteTexture(temp3.texture);
        }
      }
    }

    // Always render comp to mainFbo (for feedback loop), then blit to screen if needed.
    gl.bindFramebuffer(gl.FRAMEBUFFER, mainFbo?.fbo ?? null);
    gl.viewport(0, 0, width, height);

    if (compProgram) {
      gl.useProgram(compProgram);
      setUniforms(compProgram, state, width, height);
      
      if (warpFbo) {
        const mainLoc = gl.getUniformLocation(compProgram, 'sampler_main');
        if (mainLoc) {
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, warpFbo.texture);
          gl.uniform1i(mainLoc, 0);
        }
      }
      
      if (blur1Fbo) {
        const blur1Loc = gl.getUniformLocation(compProgram, 'sampler_blur1');
        if (blur1Loc) {
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, blur1Fbo.texture);
          gl.uniform1i(blur1Loc, 1);
        }
      }
      if (blur2Fbo) {
        const blur2Loc = gl.getUniformLocation(compProgram, 'sampler_blur2');
        if (blur2Loc) {
          gl.activeTexture(gl.TEXTURE2);
          gl.bindTexture(gl.TEXTURE_2D, blur2Fbo.texture);
          gl.uniform1i(blur2Loc, 2);
        }
      }
      if (blur3Fbo) {
        const blur3Loc = gl.getUniformLocation(compProgram, 'sampler_blur3');
        if (blur3Loc) {
          gl.activeTexture(gl.TEXTURE3);
          gl.bindTexture(gl.TEXTURE_2D, blur3Fbo.texture);
          gl.uniform1i(blur3Loc, 3);
        }
      }
      if (noiseTexture) {
        const noiseLoc = gl.getUniformLocation(compProgram, 'sampler_noise_lq');
        if (noiseLoc) {
          gl.activeTexture(gl.TEXTURE4);
          gl.bindTexture(gl.TEXTURE_2D, noiseTexture);
          gl.uniform1i(noiseLoc, 4);
        }
      }
      
      const posLoc = gl.getAttribLocation(compProgram, 'position');
      gl.enableVertexAttribArray(posLoc);
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    } else if (warpFbo && mainFbo) {
      // No comp shader — copy warp output directly to mainFbo for feedback
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, warpFbo.fbo);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, mainFbo.fbo);
      gl.blitFramebuffer(0, 0, width, height, 0, 0, width, height, gl.COLOR_BUFFER_BIT, gl.NEAREST);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    }

    // Blit mainFbo to screen if needed
    if (outputToScreen && mainFbo) {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, mainFbo.fbo);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
      gl.blitFramebuffer(0, 0, width, height, 0, 0, width, height, gl.COLOR_BUFFER_BIT, gl.NEAREST);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    }

    // Clean up GL state — milkdrop shares the GL context with the main renderer.
    // Leaving textures/FBOs bound causes feedback loops and corrupts rendering.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    for (let i = 0; i < 5; i++) {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, null);
    }
    gl.activeTexture(gl.TEXTURE0);

    variables.frame++;
    return true;
  };

  const setUniforms = (program: WebGLProgram, state: RenderState, width: number, height: number) => {
    const loc = (name: string) => gl.getUniformLocation(program, name);
    const t = variables.time;
    const aspect = width / height;

    gl.uniform1f(loc('uTime'), t);
    gl.uniform1f(loc('uFrame'), variables.frame);
    gl.uniform1f(loc('uFps'), 60);
    gl.uniform1f(loc('uRms'), state.rms);

    gl.uniform1f(loc('audioLow'), variables.bass);
    gl.uniform1f(loc('audioLowSmooth'), variables.bass_att);
    gl.uniform1f(loc('audioMid'), variables.mid);
    gl.uniform1f(loc('audioMidSmooth'), variables.mid_att);
    gl.uniform1f(loc('audioHigh'), variables.treb);
    gl.uniform1f(loc('audioHighSmooth'), variables.treb_att);

    gl.uniform1f(loc('uAspectX'), aspect);
    gl.uniform1f(loc('uAspectY'), 1.0);
    gl.uniform2f(loc('uAspect'), aspect, 1.0);
    gl.uniform2f(loc('uTexSize'), width, height);

    gl.uniform2f(loc('uRandomPreset'), randomPreset[0], randomPreset[1]);
    gl.uniform2f(loc('uRandomFrame'), Math.random(), Math.random());

    // q-variables (set by per-frame code)
    for (let i = 0; i < 32; i++) {
      const qLoc = loc(`q${i + 1}`);
      if (qLoc) gl.uniform1f(qLoc, qVars[i]);
    }

    // MilkDrop built-in _c uniforms
    // _c0: aspect multipliers
    const l = loc('_c0');
    if (l) gl.uniform4f(l, aspect, 1.0, 1.0 / aspect, 1.0);
    // _c2: time, fps, frame, progress
    const c2 = loc('_c2');
    if (c2) gl.uniform4f(c2, t, 60, variables.frame, 0);
    // _c3: bass, mid, treb, vol
    const c3 = loc('_c3');
    if (c3) gl.uniform4f(c3, variables.bass, variables.mid, variables.treb, state.rms);
    // _c4: bass_att, mid_att, treb_att, vol_att
    const c4 = loc('_c4');
    if (c4) gl.uniform4f(c4, variables.bass_att, variables.mid_att, variables.treb_att, state.rms);
    // _c7: texsize (w, h, 1/w, 1/h)
    const c7 = loc('_c7');
    if (c7) gl.uniform4f(c7, width, height, 1 / width, 1 / height);
    // _c8, _c9: roam_cos, roam_sin
    const c8 = loc('_c8');
    if (c8) gl.uniform4f(c8, 0.5 + 0.5 * Math.cos(t * 0.3), 0.5 + 0.5 * Math.cos(t * 1.3), 0.5 + 0.5 * Math.cos(t * 5), 0.5 + 0.5 * Math.cos(t * 20));
    const c9 = loc('_c9');
    if (c9) gl.uniform4f(c9, 0.5 + 0.5 * Math.sin(t * 0.3), 0.5 + 0.5 * Math.sin(t * 1.3), 0.5 + 0.5 * Math.sin(t * 5), 0.5 + 0.5 * Math.sin(t * 20));
    // _c10, _c11: slow_roam_cos, slow_roam_sin
    const c10 = loc('_c10');
    if (c10) gl.uniform4f(c10, 0.5 + 0.5 * Math.cos(t * 0.005), 0.5 + 0.5 * Math.cos(t * 0.008), 0.5 + 0.5 * Math.cos(t * 0.013), 0.5 + 0.5 * Math.cos(t * 0.022));
    const c11 = loc('_c11');
    if (c11) gl.uniform4f(c11, 0.5 + 0.5 * Math.sin(t * 0.005), 0.5 + 0.5 * Math.sin(t * 0.008), 0.5 + 0.5 * Math.sin(t * 0.013), 0.5 + 0.5 * Math.sin(t * 0.022));
    // _c1: (unused in most presets — mesh-related)
    const c1 = loc('_c1');
    if (c1) gl.uniform4f(c1, 0, 0, 0, 0);
    // _c5: texsize_noise_lq (256x256 noise texture)
    const c5 = loc('_c5');
    if (c5) gl.uniform4f(c5, 256, 256, 1 / 256, 1 / 256);
    // _c6: texsize_noise_mq (256x256)
    const c6 = loc('_c6');
    if (c6) gl.uniform4f(c6, 256, 256, 1 / 256, 1 / 256);
    // _c12, _c13: additional roam cosines/sines
    const c12 = loc('_c12');
    if (c12) gl.uniform4f(c12, 0.5 + 0.5 * Math.cos(t * 0.0005 + 1), 0.5 + 0.5 * Math.cos(t * 0.0008 + 2), 0.5 + 0.5 * Math.cos(t * 0.0013 + 3), 0.5 + 0.5 * Math.cos(t * 0.0022 + 5));
    const c13 = loc('_c13');
    if (c13) gl.uniform4f(c13, 0.5 + 0.5 * Math.sin(t * 0.0005 + 1), 0.5 + 0.5 * Math.sin(t * 0.0008 + 2), 0.5 + 0.5 * Math.sin(t * 0.0013 + 3), 0.5 + 0.5 * Math.sin(t * 0.0022 + 5));
    // _c14: blur min/max (preset-dependent, using reasonable defaults)
    const c14 = loc('_c14');
    if (c14) gl.uniform4f(c14, 0, 1, 0, 1);
    // _c15: bass_smooth, mid_smooth, treb_smooth, vol_smooth
    const c15 = loc('_c15');
    if (c15) gl.uniform4f(c15, variables.bass_att, variables.mid_att, variables.treb_att, state.rms);
    // _c16, _c17: rarely used additional constants
    const c16 = loc('_c16');
    if (c16) gl.uniform4f(c16, 0, 0, 0, 0);
    const c17 = loc('_c17');
    if (c17) gl.uniform4f(c17, 0, 0, 0, 0);

    // Texture size variants
    const tsnLq = loc('texsize_noise_lq');
    if (tsnLq) gl.uniform4f(tsnLq, 256, 256, 1 / 256, 1 / 256);
    const tsnMq = loc('texsize_noise_mq');
    if (tsnMq) gl.uniform4f(tsnMq, 256, 256, 1 / 256, 1 / 256);
    const tsnHq = loc('texsize_noise_hq');
    if (tsnHq) gl.uniform4f(tsnHq, 256, 256, 1 / 256, 1 / 256);

    // rand_frame and rand_preset as vec4
    const rfLoc = loc('rand_frame');
    if (rfLoc) gl.uniform4f(rfLoc, Math.random(), Math.random(), Math.random(), Math.random());
    const rpLoc = loc('rand_preset');
    if (rpLoc) gl.uniform4f(rpLoc, randomPreset[0], randomPreset[1], Math.random(), Math.random());

    // _qa–_qh: q-variable banks as vec4
    const qaLoc = loc('_qa'); if (qaLoc) gl.uniform4f(qaLoc, qVars[0], qVars[1], qVars[2], qVars[3]);
    const qbLoc = loc('_qb'); if (qbLoc) gl.uniform4f(qbLoc, qVars[4], qVars[5], qVars[6], qVars[7]);
    const qcLoc = loc('_qc'); if (qcLoc) gl.uniform4f(qcLoc, qVars[8], qVars[9], qVars[10], qVars[11]);
    const qdLoc = loc('_qd'); if (qdLoc) gl.uniform4f(qdLoc, qVars[12], qVars[13], qVars[14], qVars[15]);
    const qeLoc = loc('_qe'); if (qeLoc) gl.uniform4f(qeLoc, qVars[16], qVars[17], qVars[18], qVars[19]);
    const qfLoc = loc('_qf'); if (qfLoc) gl.uniform4f(qfLoc, qVars[20], qVars[21], qVars[22], qVars[23]);
    const qgLoc = loc('_qg'); if (qgLoc) gl.uniform4f(qgLoc, qVars[24], qVars[25], qVars[26], qVars[27]);
    const qhLoc = loc('_qh'); if (qhLoc) gl.uniform4f(qhLoc, qVars[28], qVars[29], qVars[30], qVars[31]);
  };

  const getMainTexture = (): WebGLTexture | null => {
    return mainFbo?.texture ?? null;
  };

  const clear = () => {
    if (warpProgram) gl.deleteProgram(warpProgram);
    if (compProgram) gl.deleteProgram(compProgram);
    warpProgram = null;
    compProgram = null;
  };

  return {
    compileShaders,
    render,
    getMainTexture,
    clear,
    getVariables: () => ({ ...variables }),
    getQVars: () => [...qVars],
  };
};

export type MilkDropRenderer = ReturnType<typeof createMilkDropRenderer>;
