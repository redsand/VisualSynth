// Offline replica of milkdropRenderer's EEL per-frame execution (the exact
// transpile + eval pipeline, copied from src/renderer/milkdropRenderer.ts) —
// runs a preset's perFrameCode across simulated frames and reports whether
// the warp-driving variables (zoom/rot/cx/cy/dx/dy) actually move, or
// whether the block throws and leaves the warp static (the silently-caught
// catch in executePerFrameCode hides this at runtime).
//
// Usage: ts-node --transpile-only scripts/probe-eel-perframe.ts <preset.json>
import fs from 'fs';

const presetPath = process.argv[2];
if (!presetPath || !fs.existsSync(presetPath)) {
  console.error('Usage: ts-node --transpile-only scripts/probe-eel-perframe.ts <preset.json>');
  process.exit(1);
}

const eelFindMatchingParen = (s: string, openAt: number): number => {
  let depth = 0;
  for (let i = openAt; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')') { if (--depth === 0) return i; }
  }
  return s.length - 1;
};
const eelSplitArgs = (inner: string): string[] => {
  const result: string[] = [];
  let depth = 0, start = 0;
  for (let i = 0; i < inner.length; i++) {
    if (inner[i] === '(') depth++;
    else if (inner[i] === ')') depth--;
    else if (inner[i] === ',' && depth === 0) { result.push(inner.slice(start, i).trim()); start = i + 1; }
  }
  result.push(inner.slice(start).trim());
  return result;
};
const EEL_FN_RE = /\b(if|above|below|equal|sqr)\s*\(/;
const transpileEelExpr = (s: string): string => {
  let out = '';
  let i = 0;
  while (i < s.length) {
    const rest = s.slice(i);
    const m = EEL_FN_RE.exec(rest);
    if (!m) { out += rest; break; }
    out += rest.slice(0, m.index);
    const fnName = m[1];
    const openIdx = i + m.index + m[0].length - 1;
    const closeIdx = eelFindMatchingParen(s, openIdx);
    const args = eelSplitArgs(s.slice(openIdx + 1, closeIdx)).map(a => transpileEelExpr(a));
    if (fnName === 'if' && args.length >= 3) out += `((bool(${args[0]})) ? (${args[1]}) : (${args[2]}))`;
    else if (fnName === 'above' && args.length >= 2) out += `((${args[0]}) > (${args[1]}) ? 1.0 : 0.0)`;
    else if (fnName === 'below' && args.length >= 2) out += `((${args[0]}) < (${args[1]}) ? 1.0 : 0.0)`;
    else if (fnName === 'equal' && args.length >= 2) out += `((${args[0]}) == (${args[1]}) ? 1.0 : 0.0)`;
    else if (fnName === 'sqr' && args.length >= 1) out += `((${args[0]})*(${args[0]}))`;
    else out += `${fnName}(${args.join(', ')})`;
    i = closeIdx + 1;
  }
  return out;
};
const transpileEelLine = (line: string): string => {
  let l = line.trim();
  if (!l || l.startsWith('//')) return l;
  l = l.replace(/\bif\s+\(/g, 'if(');
  l = l.replace(/\bmekdx\b/g, 'kdx');
  l = l.replace(/\bdy-r\b/g, 'dy_r');
  l = l.replace(/\ba\s*\*\s*bass_att\b/g, 'ang * bass_att');
  l = l.replace(/\bbass_att\s*\+\s*a\b/g, 'bass_att + ang');
  l = l.replace(/\b(megabuf|gmegabuf)\s*\(([^)]+)\)\s*=\s*([^;]+)/g, '$1($2, $3)');
  l = l.replace(/\bloop\s*\(\s*(\w+)\s*,/g, 'for (let __i=0; __i<$1; __i++) {');
  if (l.includes('for (let __i')) l = l.replace(/\);\s*$/, '} ');
  l = transpileEelExpr(l);
  if (!/[;{}]\s*$/.test(l)) l += ';';
  return l;
};
const EEL_JS_RESERVED = new Set([
  'for', 'let', 'const', 'var', 'return', 'if', 'else', 'new', 'true', 'false',
  'null', 'undefined', 'void', 'typeof', 'while', 'do', 'break', 'continue',
  'function', 'this', '__ctx', '__i', 'trunc', 'Math', 'Number', 'Boolean',
  'Object', 'String', 'Infinity', 'NaN'
]);

const preset = JSON.parse(fs.readFileSync(presetPath, 'utf8'));
const code: string[] = preset?._shaderData?.perFrameCode ?? [];
console.log(`per-frame lines: ${code.length}`);

let threwAt: string | null = null;
let errorMessage: string | null = null;
const transpiled = code
  .filter(line => line.trim() && !line.trim().startsWith('//'))
  .map(transpileEelLine);
console.log('transpiled ok, sample:');
transpiled.slice(0, 5).forEach(l => console.log('  ', l.slice(0, 100)));

// Simulate 90 frames (1.5s of audio with bass pulses)
const customVars: Record<string, number> = {};
const qVars = new Array(32).fill(0);
const standardVarNames = new Set(['time', 'frame', 'fps', 'bass', 'mid', 'treb', 'bass_att', 'mid_att', 'treb_att', 'rms']);
for (let qi = 1; qi <= 32; qi++) standardVarNames.add(`q${qi}`);

const samples: Array<Record<string, number>> = [];
for (let frame = 0; frame < 90; frame++) {
  const time = frame / 60;
  const bass = 0.5 + 0.5 * Math.sin(time * 6.28 * 2); // ~2 pulses/sec
  const mid = 0.4 + 0.3 * Math.sin(time * 3.1);
  const ctx: Record<string, any> = {
    ...customVars,
    time,
    frame,
    fps: 60,
    bass,
    mid,
    treb: 0.3,
    bass_att: bass * 0.9 + (customVars.__b ?? 0) * 0.1,
    mid_att: mid * 0.9 + (customVars.__m ?? 0) * 0.1,
    treb_att: 0.3,
    rms: bass * 0.7,
    ...qVars.reduce((acc, v, i) => { acc[`q${i + 1}`] = v; return acc; }, {} as Record<string, number>),
    above: (a: number, b: number) => a > b ? 1 : 0,
    below: (a: number, b: number) => a < b ? 1 : 0,
    equal: (a: number, b: number) => a === b ? 1 : 0,
    if_milk: (cond: number, a: number, b: number) => cond ? a : b,
    bool: (v: number | boolean) => Boolean(v) ? 1 : 0,
    max: Math.max, min: Math.min, sin: Math.sin, cos: Math.cos, tan: Math.tan,
    abs: Math.abs, sqrt: Math.sqrt, pow: Math.pow, log: Math.log, log10: Math.log10,
    exp: Math.exp, asin: Math.asin, acos: Math.acos, atan: Math.atan, atan2: Math.atan2,
    floor: Math.floor, ceil: Math.ceil, sign: Math.sign,
    rand: (max: number) => Math.random() * max,
    bor: (a: number, b: number) => (a || b) ? 1 : 0,
    bnot: (a: number) => a ? 0 : 1,
    band: (a: number, b: number) => (a && b) ? 1 : 0,
    sqr: (a: number) => a * a,
    sigmoid: (x: number, c: number) => 1 / (1 + Math.exp(-x * c)),
    int: Math.trunc, frac: (x: number) => x - Math.trunc(x), pi: Math.PI,
    megabuf: (idx: number, val?: number) => 0,
    gmegabuf: (idx: number, val?: number) => 0,
  };
  try {
    const allLines = transpiled.join('\n');
    const identifiers = allLines.match(/\b[A-Za-z_]\w*\b/g) ?? [];
    for (const ident of new Set(identifiers)) {
      if (!(ident in ctx) && !EEL_JS_RESERVED.has(ident)) ctx[ident] = 0;
    }
    const varNames = Object.keys(ctx).filter(k => typeof ctx[k] !== 'function');
    const funcNames = Object.keys(ctx).filter(k => typeof ctx[k] === 'function');
    const header = varNames.map(k => `let ${k} = __ctx.${k};`).join('\n');
    const funcHeader = funcNames.map(k => `const ${k} = __ctx.${k};`).join('\n');
    const footer = `return { ${varNames.join(', ')} };`;
    const fn = new Function('__ctx', `${header}\n${funcHeader}\n${allLines}\n${footer}`);
    const result = fn(ctx);
    if (result) {
      Object.assign(ctx, result);
      for (let i = 0; i < 32; i++) qVars[i] = ctx[`q${i + 1}`] ?? qVars[i];
      for (const [k, v] of Object.entries(result)) {
        if (!standardVarNames.has(k) && typeof v === 'number') customVars[k] = v;
      }
    }
  } catch (e) {
    threwAt = `frame ${frame}`;
    errorMessage = String(e).slice(0, 200);
    break;
  }
  if (frame % 30 === 0) samples.push({ frame, zoom: customVars.zoom, rot: customVars.rot, cx: customVars.cx, cy: customVars.cy, dx: customVars.dx, dy: customVars.dy, q9: qVars[8], decay: customVars.decay });
}

console.log('\nthrew:', threwAt ? `${threwAt} — ${errorMessage}` : 'no');
console.log('variable evolution (every 30 frames):');
for (const s of samples) {
  console.log(`  frame ${s.frame}: zoom=${s.zoom?.toFixed(4)} rot=${s.rot?.toFixed(4)} cx=${s.cx?.toFixed(4)} cy=${s.cy?.toFixed(4)} dx=${s.dx?.toFixed(4)} dy=${s.dy?.toFixed(4)} q9=${s.q9?.toFixed(4)} decay=${s.decay?.toFixed(4)}`);
}
const moved = (k: string) => samples.length > 1 && samples.some(s => s[k] !== undefined) &&
  new Set(samples.map(s => s[k]?.toFixed(5))).size > 1;
console.log('\nwarp-driving variables MOVE:', ['zoom', 'rot', 'cx', 'cy', 'dx', 'dy'].map(k => `${k}=${moved(k) ? 'yes' : 'NO'}`).join(' '));
