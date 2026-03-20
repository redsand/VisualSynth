/**
 * Runtime GLSL patcher for MilkDrop preset shaders.
 *
 * The import-time HLSL→GLSL transpiler (hlslToGlsl.ts) converts types and
 * function names but misses several MilkDrop-specific constructs:
 *   - Stray shader_body { ... } blocks outside void main()
 *   - Missing helper functions: lum(), sat(), noise3(), GetMain(), multiply()
 *   - Missing sampler aliases: sampler_fc_main, sampler_pc_main, etc.
 *   - Missing q-variable uniforms (q1–q32)
 *   - Missing MilkDrop built-in uniforms (_c0–_c17, _qa–_qh, texsize, etc.)
 *   - Undeclared local variables (HLSL auto-declares; GLSL does not)
 *   - Boolean NOT on floats: !mask → (mask == 0.0 ? 1.0 : 0.0)
 *   - GLSL ES strict typing: integer literals in float contexts (int→float)
 *
 * This module is pure string transformation — no WebGL, no browser APIs.
 * It lives in src/shared/ so it can be imported and tested in Node environments.
 */

export const patchMilkDropGlsl = (source: string): string => {
  if (!source || !source.includes('#version 300 es')) return source;
  const helperCallPattern = String.raw`\b(?:GetPixel|GetBlur[123]|GetMain)\((?:[^()]|\([^()]*\))*\)`;

  // ── 0. Strip standalone 'shader_body { ... }' blocks that appear outside void main() ──
  // The HLSL→GLSL offline translator emits shader_body{...} both before void main() as a
  // "definition" and again inside void main() as an anonymous block. The pre-main copy is
  // invalid at file scope — remove it. The copy inside main needs the keyword stripped.
  const mainIdxPre = source.indexOf('void main()');
  if (mainIdxPre !== -1) {
    let s = source;
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
      // Remove the entire shader_body { ... } block before void main()
      s = s.substring(0, sbIdx).trimEnd() + '\n' + s.substring(pos).trimStart();
      sbIdx = s.indexOf('shader_body');
    }
    // Remove 'shader_body' keyword before '{' inside void main() — leave as bare anonymous block
    source = s.replace(/\bshader_body\s*(?=\{)/g, '');
  }

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

  // textureBias is how tex2Dbias is transpiled by hlslToGlsl — inject a bridge helper
  // HLSL: tex2Dbias(s, float4(u, v, 0, lod)) → textureBias(s, vec4(u, v, 0, lod))
  // GLSL: textureLod(s, uv.xy, uv.w)
  if (/\btextureBias\s*\(/.test(source) && !beforeMain.includes('vec4 textureBias(')) {
    additions.push(`vec4 textureBias(sampler2D s, vec4 uv4) { return textureLod(s, uv4.xy, uv4.w); }`);
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

    body = body.replace(/#define\s+sat\s+saturate\b/g, '#define sat clamp01');
    body = body.replace(/\bvUv\b(?=\s*(?:[+\-*/]?=|\+\+|--))/g, 'uv');
    body = body.replace(/\bvUvOriginal\b(?=\s*(?:[+\-*/]?=|\+\+|--))/g, 'vUvOriginalLocal');
    body = body.replace(/\bvRadius\b(?=\s*(?:[+\-*/]?=|\+\+|--))/g, 'rad');
    body = body.replace(/\bvAngle\b(?=\s*(?:[+\-*/]?=|\+\+|--))/g, 'ang');

    // Known declared/built-in names to skip
    const declared = new Set<string>();
    // Collect all names already declared with a type, including comma-separated declarations.
    const declLineRe = /\b(float|vec[234]|mat[234]|int|bool|ivec[234]|bvec[234])\s+([^;]+);/g;
    let m: RegExpExecArray | null;
    while ((m = declLineRe.exec(patched)) !== null) {
      const type = m[1];
      const declarators = m[2];
      if (declarators.includes('(') && declarators.includes('{')) {
        continue;
      }
      for (const rawDecl of declarators.split(',')) {
        const cleaned = rawDecl
          .replace(/=.*$/g, '')
          .replace(/\[.*$/g, '')
          .trim()
          .split(/\s+/)
          .pop();
        if (cleaned && cleaned !== type) {
          declared.add(cleaned);
        }
      }
    }
    // Add built-in variables, uniforms, varyings, functions
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
        if (type === 'float') {
          const rhsAccessRe = new RegExp(`\\b${vname}\\.(xy|xyz|xyzw|rg|rgb|rgba)\\b`);
          const rhsMatch = rhsAccessRe.exec(body);
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
        const scalarFns = 'max|min|clamp|abs|pow|sqrt|floor|ceil|fract|sin|cos|atan|acos|asin|length|dot|step|smoothstep|mix';
        const fixRe = new RegExp(
          `(\\b${vname}\\s*=\\s*)((?:${scalarFns})\\s*\\([^;]*\\))\\s*;`,
          'g'
        );
        body = body.replace(fixRe, (m, lhs, rhs) => {
          if (/\bvec[234]\s*\(/.test(rhs) || /\bGetPixel|GetBlur|GetMain/.test(rhs) || /\btexture\s*\(/.test(rhs)) {
            return m;
          }
          return `${lhs}${type}(${rhs});`;
        });
      }

      body = '\n' + decls.join('\n') + '\n' + body;
    }

    // ── 3. Fix boolean NOT on floats: !varname → (varname == 0.0 ? 1.0 : 0.0) ──
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

  // ── 5. Fix uTexSize swizzle ──
  patched = patched.replace(/\buTexSize\.zw\b/g, '(vec2(1.0)/uTexSize)');
  patched = patched.replace(/\buTexSize\.z\b/g, '(1.0/uTexSize.x)');
  patched = patched.replace(/\buTexSize\.w\b/g, '(1.0/uTexSize.y)');
  patched = patched.replace(/\buTexSize\.xyzw\b/g, 'vec4(uTexSize, 1.0/uTexSize)');

  // ── 6. Fix GLSL ES strict typing issues ──
  // HLSL auto-promotes int→float; GLSL ES 3.0 does not.
  patched = patched.split('\n').map(line => {
    const trimmed = line.trim();
    // Skip integer and vector-integer declarations (int/ivec lines can't need float-literal fixes)
    if (/^\s*int\s/.test(line) || /^\s*ivec/.test(line)) return line;
    // Skip preprocessor directives
    if (trimmed.startsWith('#')) return line;

    // Fix float/const float variable declarations with integer literal initializers.
    // GLSL ES 3.00 requires float literals; `float x = 0;` is a type error.
    // Use /g to handle multiple declarations on one line: `float a = 0; float b = 1;`
    // Also handles for-loop headers: `for (float i = 0; ...)` — the for-skip guard was removed
    // because the float-fix regex requires `float` to be present and won't misfire on int for-loops.
    line = line.replace(
      /\b((?:const\s+)?float\s+\w+\s*=\s*)(-?\d+)(\s*;)/g,
      (_, pre, num, post) => `${pre}${num}.0${post}`
    );

    // Fix integer literals in arithmetic operator contexts
    line = line.replace(/([a-zA-Z_)\]]\w*(?:\.[xyzwrgba]+)?)\s*([*\/+\-])\s*(-?\d+)(?!\.|\d|\s*\[)/g,
      (m, id, op, num) => `${id} ${op} ${num}.0`
    );
    line = line.replace(/(?<=[\s(,=])(\d+)(?!\.\d)\s*([*\/+\-])\s*([a-zA-Z_(])/g,
      (m, num, op, id) => `${num}.0 ${op} ${id}`
    );
    // Fix float_literal op bare_int: `2.0-1` → `2.0-1.0`, `4.0+1` → `4.0+1.0`
    // The previous regexes miss this because the LHS ends with a digit (from the float literal).
    line = line.replace(/(\d+\.\d*)\s*([+\-])\s*(\d+)(?!\.\d|\d)/g,
      (m, floatLit, op, intLit) => `${floatLit} ${op} ${intLit}.0`
    );
    // Fix bare integers in vec/mat constructors
    line = line.replace(
      /(?<=[,(])\s*(\d+)\s*(?=[,)])/g,
      (m, num) => ` ${num}.0 `
    );

    const vec2Context = /\bvec2\s+\w+\s*=/.test(line) || /\b(?:uv|uv2|delta|offset|coord)\w*\s*(?:[+\-*/]?=)/.test(line);
    if (vec2Context) {
      line = line.replace(new RegExp(`(${helperCallPattern})(?!\\s*\\.)`, 'g'), '$1.xy');
      line = line.replace(
        new RegExp(String.raw`(?<=[=(,])\s*(-?(?:\d+\.\d+|\d+|\.\d+))\s*([+\-])\s*((?:\d*\.?\d+\s*\*\s*)${helperCallPattern}\.xy)`, 'g'),
        (_m, scalarLiteral, op, rhs) => ` vec2(${scalarLiteral}) ${op} ${rhs}`
      );
    }

    return line;
  }).join('\n');

  // ── 7. Fix vec/scalar type mismatches from HLSL auto-promotion ──

  // 7a+7b. texture() returns vec4 but MilkDrop works in vec3.
  //   Add .xyz to bare texture() calls in vec3 contexts.
  //   Works on the full string to handle multi-line texture() calls.
  //   Uses balanced-paren matching to find the actual closing ')'.
  {
    const texRe = /\btexture\s*\(/g;
    let tm: RegExpExecArray | null;
    const texReplacements: { insertAt: number; text: string }[] = [];
    while ((tm = texRe.exec(patched)) !== null) {
      const openIdx = tm.index + tm[0].length - 1;
      let depth = 1;
      let pos = openIdx + 1;
      while (pos < patched.length && depth > 0) {
        if (patched[pos] === '(') depth++;
        else if (patched[pos] === ')') depth--;
        pos++;
      }
      if (depth !== 0) continue;
      const closeIdx = pos - 1; // index of matching ')'
      // Check what comes after: already has swizzle?
      const after = patched.slice(closeIdx + 1);
      if (/^\s*\.[xyzwrgba]/.test(after)) continue;
      // Determine context: find the statement this texture() is part of.
      // Look backwards from the texture() call to find the start of the statement.
      const stmtStart = patched.lastIndexOf(';', tm.index);
      const stmtRegion = patched.slice(stmtStart === -1 ? 0 : stmtStart, tm.index);
      // Skip if this is in a vec4 declaration/assignment context
      if (/\bvec4\s+\w+\s*=/.test(stmtRegion)) continue;
      if (/fragColor\s*=/.test(stmtRegion)) continue;
      // Only add .xyz in vec3 contexts
      const isVec3Ctx = /\b(ret|col\w*)\s*[+\-*]?=/.test(stmtRegion) ||
                        /\bvec3\s+\w+\s*=/.test(stmtRegion);
      if (!isVec3Ctx) continue;
      texReplacements.push({ insertAt: closeIdx + 1, text: '.xyz' });
    }
    // Apply in reverse to preserve indices
    for (const r of texReplacements.reverse()) {
      patched = patched.slice(0, r.insertAt) + r.text + patched.slice(r.insertAt);
    }
  }

  // 7c. vecN x = integer;  →  vecN x = vecN(integer.0);
  patched = patched.replace(
    /\b(vec([234])\s+\w+\s*=\s*)(-?\d+)(\s*;)/g,
    (_, pre, dim, num, post) => `${pre}vec${dim}(${num}.0)${post}`
  );

  // 7d. pow(vec3_expr, scalar)  →  pow(vec3_expr, vec3(scalar))
  //     GLSL ES: pow(genType, genType) — both args must match dimensionality.
  //     Uses balanced-paren arg splitting to handle nested commas.
  {
    const powRe = /\bpow\s*\(/g;
    let pm: RegExpExecArray | null;
    const powReplacements: { start: number; end: number; replacement: string }[] = [];
    while ((pm = powRe.exec(patched)) !== null) {
      const openIdx = pm.index + pm[0].length - 1;
      let depth = 1;
      let pos = openIdx + 1;
      while (pos < patched.length && depth > 0) {
        if (patched[pos] === '(') depth++;
        else if (patched[pos] === ')') depth--;
        pos++;
      }
      if (depth !== 0) continue;
      const closeIdx = pos - 1;
      const inner = patched.slice(openIdx + 1, closeIdx);
      // Split on top-level comma
      let d = 0, splitAt = -1;
      for (let ci = 0; ci < inner.length; ci++) {
        if (inner[ci] === '(') d++;
        else if (inner[ci] === ')') d--;
        else if (inner[ci] === ',' && d === 0) { splitAt = ci; break; }
      }
      if (splitAt === -1) continue;
      const firstArg = inner.slice(0, splitAt).trim();
      const secondArg = inner.slice(splitAt + 1).trim();
      // Check if first arg is a vec expression (not wrapped in scalar fn)
      const firstIsVec = !/^\s*(length|dot|lum|distance|float|abs)\s*\(/.test(firstArg) &&
                         !/\.(x|y|z|w|r|g|b|a)\s*$/.test(firstArg) &&
                         (/\b(ret|col\w*|GetPixel|GetBlur[123]?|GetMain|texture)\b/.test(firstArg) ||
                          /\bvec[23]\s*\(/.test(firstArg) ||
                          /\bmix\s*\(/.test(firstArg) ||
                          /\bclamp01\s*\(/.test(firstArg));
      // Second arg is a simple scalar literal
      const secondIsScalar = /^\s*-?(\d+\.?\d*|\.\d+)\s*$/.test(secondArg);
      if (firstIsVec && secondIsScalar) {
        const s = secondArg.includes('.') ? secondArg : `${secondArg}.0`;
        powReplacements.push({
          start: pm.index,
          end: closeIdx + 1,
          replacement: `pow(${firstArg}, vec3(${s.trim()}))`,
        });
      }
    }
    for (const r of powReplacements.reverse()) {
      patched = patched.slice(0, r.start) + r.replacement + patched.slice(r.end);
    }
  }

  // 7e. ret = scalar_expr;  →  ret = vec3(scalar_expr);
  //     lum/dot/length/distance return float but ret is vec3.
  //     Handle full expressions like: ret = lum(ret)/ret2; ret = lum(ret)*hue;
  patched = patched.replace(
    /\bret\s*=\s*((?:lum|dot|length|distance|float)\s*\([^;]*?\)(?:\s*[*\/+\-]\s*[^;]+?)?)\s*;/g,
    (m, expr) => {
      // Only wrap if the expression starts with a scalar function
      if (/^\s*(?:lum|dot|length|distance|float)\s*\(/.test(expr)) {
        return `ret = vec3(${expr});`;
      }
      return m;
    }
  );

  // 7f. float multi-variable declarations with int literals:
  //     const float quality = 3, depth = q29;  →  const float quality = 3.0, depth = q29;
  //     float a=0,b=0,c=0;  →  float a=0.0,b=0.0,c=0.0;
  //     Also single declarations missed by step 6 (e.g., inside for-loop headers)
  patched = patched.replace(
    /\b((?:const\s+)?float\s+[^;]+;)/g,
    (m) => {
      // Only transform if it contains a bare int literal after =
      if (!/=\s*-?\d+(?!\.)/.test(m)) return m;
      return m.replace(/=\s*(-?\d+)(?!\.)\b/g, (mm, num) => `= ${num}.0`);
    }
  );

  // mix() third arg must be float/vec, not bare integer literal.
  patched = patched.replace(
    /\bmix\s*\(\s*([^,]+?)\s*,\s*([^,]+?)\s*,\s*(-?\d+)\s*\)/g,
    (_match, a, b, t) => `mix(${a}, ${b}, ${t}.0)`
  );

  // dot(vecN, scalar) promotion
  patched = patched.replace(
    /\bdot\s*\(\s*([^,]+?)\s*,\s*(-?(?:\d+\.\d+|\d+|\.\d+))\s*\)/g,
    (_match, vecExpr, scalarLiteral) => {
      const trimmed = vecExpr.trim();
      const dim = /\.((?:xy|rg))(?![a-zA-Z])/i.test(trimmed) ? 'vec2' : 'vec3';
      return `dot(${trimmed}, ${dim}(${scalarLiteral}))`;
    }
  );

  // mix() scalar dot() promotion
  patched = patched.replace(
    /\bmix\s*\(\s*(dot\([^\n;]+?\))\s*,\s*((?:vec3\s*\([^)]*\))|(?:[a-zA-Z_]\w*))\s*,/g,
    (_match, dotExpr, vecExpr) => `mix(vec3(${dotExpr}), ${vecExpr},`
  );
  patched = patched.replace(
    /\bmix\s*\(\s*([^,]+?)\s*,\s*(lum\s*\([^)]*\))\s*,/g,
    (_match, vecExpr, lumExpr) => `mix(${vecExpr}, vec3(${lumExpr}),`
  );

  // vec3 ret scalar-leading subtraction
  patched = patched.replace(
    /\bret\s*=\s*(-?(?:\d+\.\d+|\d+|\.\d+))\s*-\s*([^;]+);/g,
    (_match, scalarLiteral, rhs) => `ret = vec3(${scalarLiteral}) - ${rhs};`
  );

  // 7g. min(scalar, vec) → min(vec, scalar) and max(scalar, vec) → max(vec, scalar)
  //     GLSL ES has max/min(genType, float) but NOT max/min(float, genType).
  //     Use balanced-paren arg split to handle nested expressions.
  {
    const minMaxRe = /\b(min|max)\s*\(/g;
    let mm: RegExpExecArray | null;
    const replacements: { start: number; end: number; replacement: string }[] = [];
    while ((mm = minMaxRe.exec(patched)) !== null) {
      const openIdx = mm.index + mm[0].length - 1;
      let depth = 1;
      let pos = openIdx + 1;
      while (pos < patched.length && depth > 0) {
        if (patched[pos] === '(') depth++;
        else if (patched[pos] === ')') depth--;
        pos++;
      }
      if (depth !== 0) continue;
      const closeIdx = pos - 1;
      const inner = patched.slice(openIdx + 1, closeIdx);
      let d = 0, splitAt = -1;
      for (let ci = 0; ci < inner.length; ci++) {
        if (inner[ci] === '(') d++;
        else if (inner[ci] === ')') d--;
        else if (inner[ci] === ',' && d === 0) { splitAt = ci; break; }
      }
      if (splitAt === -1) continue;
      const a = inner.slice(0, splitAt).trim();
      const b = inner.slice(splitAt + 1).trim();
      const aIsScalar = /^-?(\d+\.?\d*|\.\d+)$/.test(a);
      const bIsVec = /\b(ret|col\w*|GetPixel|GetBlur[123]?|GetMain|texture|vec[234])\b/.test(b) &&
                     !/\.(x|y|z|w|r|g|b|a)\s*$/.test(b);
      if (aIsScalar && bIsVec) {
        replacements.push({
          start: mm.index,
          end: closeIdx + 1,
          replacement: `${mm[0].slice(0, -1)}(${b}, ${a})`,
        });
      }
    }
    // Apply replacements in reverse order to preserve indices
    for (const r of replacements.reverse()) {
      patched = patched.slice(0, r.start) + r.replacement + patched.slice(r.end);
    }
  }

  // Fix ret type mismatch: vec4 ret → vec3 ret
  patched = patched.replace(/\bvec4\s+ret\s*=\s*vec4\(0\.0\)\s*;/, 'vec3 ret = vec3(0.0);');
  patched = patched.replace(
    /fragColor\s*=\s*ret\s*;/g,
    'fragColor = vec4(ret, 1.0);'
  );

  // Fix GetPixel/GetBlur return type: vec4 → vec3
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
