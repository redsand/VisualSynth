import type { RenderState } from './renderState';
import type { MilkShapeConfig, MilkWaveConfig } from '../shared/milkwaveParser';
import type { MilkwaveOfflineTranslationReport } from '../shared/milkwaveOfflineTranslation';
import type { MilkDropShaderData } from '../shared/project';
import {
  analyzeMilkwaveShaderSource,
  summarizeMilkwaveShaderDiagnostics,
  type MilkwaveShaderDiagnostics
} from '../shared/milkwaveDiagnostics';
import { bindMilkwaveBuiltins } from './milkwave/runtime/milkwaveBuiltins';
import { bindMilkwaveSamplers } from './milkwave/runtime/milkwaveSamplers';
import { createMilkwaveShapeRenderer } from './milkwave/runtime/milkwaveShapeRenderer';
import { createMilkwaveWaveRenderer } from './milkwave/runtime/milkwaveWaveRenderer';

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export const deriveMilkDropSeedColor = (
  params: Record<string, number | boolean>,
  random: [number, number]
): [number, number, number] => {
  const numeric = (key: string, fallback = 0) => {
    const value = params[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  };

  const candidates = [
    [numeric('wave_r', -1), numeric('wave_g', -1), numeric('wave_b', -1)],
    [numeric('ob_r', -1), numeric('ob_g', -1), numeric('ob_b', -1)],
    [numeric('ib_r', -1), numeric('ib_g', -1), numeric('ib_b', -1)]
  ];

  for (const [r, g, b] of candidates) {
    if (r >= 0 || g >= 0 || b >= 0) {
      const energy = Math.max(r, g, b);
      if (energy > 0.001) {
        return [clamp01(r), clamp01(g), clamp01(b)];
      }
    }
  }

  return [
    0.12 + random[0] * 0.25,
    0.10 + ((random[0] + random[1]) * 0.5) * 0.2,
    0.15 + random[1] * 0.25
  ];
};

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

export interface MilkDropCompileReportPass {
  requested: boolean;
  diagnostics: MilkwaveShaderDiagnostics;
  patchedDiagnostics?: MilkwaveShaderDiagnostics;
  compiled: boolean;
  fallbackUsed: boolean;
}

export interface MilkDropCompileReport {
  warp: MilkDropCompileReportPass;
  comp: MilkDropCompileReportPass;
}

export interface MilkDropNativeRuntimeReport {
  shapes: {
    requested: number;
    rendered: number;
    borders: number;
    texturedFallbacks: number;
    evaluatedShapes: number;
    evaluatedPoints: number;
  };
  waves: {
    requested: number;
    rendered: number;
    renderedPoints: number;
    evaluatedPoints: number;
  };
}

export { patchMilkDropGlsl } from '../shared/milkwaveGlslPatcher';
import { patchMilkDropGlsl } from '../shared/milkwaveGlslPatcher';

// ── EEL → JavaScript transpiler ─────────────────────────────────────────────
// MilkDrop per-frame/per-pixel code is written in EEL (Nullsoft Expression
// Evaluation Library).  The naive regex approach fails for nested calls like
// `if(above(d,r), 0, sin(y)*dir)` because `[^,]+` splits on the comma inside
// `above(d,r)`.  This balanced-paren implementation handles arbitrary nesting.

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
    else if (inner[i] === ',' && depth === 0) {
      result.push(inner.slice(start, i).trim());
      start = i + 1;
    }
  }
  result.push(inner.slice(start).trim());
  return result;
};

// EEL functions that need special JS translation.
// Any other function call (sin, cos, abs, …) passes through as-is since the
// fnBody header already imports them from Math.
const EEL_FN_RE = /\b(if|above|below|equal)\s*\(/;

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

    if (fnName === 'if' && args.length >= 3) {
      out += `((${args[0]}) ? (${args[1]}) : (${args[2]}))`;
    } else if (fnName === 'above' && args.length >= 2) {
      out += `((${args[0]}) > (${args[1]}) ? 1 : 0)`;
    } else if (fnName === 'below' && args.length >= 2) {
      out += `((${args[0]}) < (${args[1]}) ? 1 : 0)`;
    } else if (fnName === 'equal' && args.length >= 2) {
      out += `((${args[0]}) == (${args[1]}) ? 1 : 0)`;
    } else {
      out += `${fnName}(${args.join(', ')})`;
    }

    i = closeIdx + 1;
  }
  return out;
};

const transpileEelLine = (line: string): string => {
  let l = line.trim();
  // megabuf(idx) = value  →  megabuf(idx, value)
  l = l.replace(/\b(megabuf|gmegabuf)\s*\(([^)]+)\)\s*=\s*([^;]+)/g, '$1($2, $3)');
  // loop(n, body)  →  best-effort for loop (many presets won't use this)
  l = l.replace(/\bloop\s*\(\s*(\w+)\s*,/g, 'for (let __i=0; __i<$1; __i++) {');
  if (l.includes('for (let __i')) {
    l = l.replace(/\);\s*$/, '} ');
  }
  // if / above / below / equal  with nested paren support
  l = transpileEelExpr(l);
  return l;
};

const transpileEelToGlsl = (code: string[]): string => {
  return code.map(line => {
    let l = transpileEelLine(line);
    // Remove megabuf/gmegabuf for GLSL compatibility
    l = l.replace(/\b(megabuf|gmegabuf)\b[^;]*;/g, '/* megabuf stubbed */');
    // Replace let __i loops with int __i
    l = l.replace(/\blet\s+__i/g, 'int __i');
    
    // Math builtins renaming
    l = l.replace(/\bint\s*\(/g, 'trunc(');
    l = l.replace(/\bfrac\s*\(/g, 'fract(');
    l = l.replace(/\bsqr\s*\(([^)]+)\)/g, '(($1)*($1))');
    l = l.replace(/\bsigmoid\s*\(([^,]+),\s*([^)]+)\)/g, '(1.0 / (1.0 + exp(-($1) * ($2))))');
    l = l.replace(/\bband\s*\(([^,]+),\s*([^)]+)\)/g, '((($1) != 0.0 && ($2) != 0.0) ? 1.0 : 0.0)');
    l = l.replace(/\bbor\s*\(([^,]+),\s*([^)]+)\)/g, '((($1) != 0.0 || ($2) != 0.0) ? 1.0 : 0.0)');
    l = l.replace(/\bbnot\s*\(([^)]+)\)/g, '(($1) == 0.0 ? 1.0 : 0.0)');
    l = l.replace(/\blog10\s*\(([^)]+)\)/g, '(log($1)/2.302585)');
    l = l.replace(/\batan2\s*\(([^,]+),\s*([^)]+)\)/g, 'atan($1, $2)');
    l = l.replace(/\basin\s*\(/g, 'asin(');
    l = l.replace(/\bacos\s*\(/g, 'acos(');
    l = l.replace(/\brand\s*\(([^)]+)\)/g, '(fract(sin(dot(vUvOriginal, vec2(12.9898, 78.233)) + uTime) * 43758.5453) * ($1))');
    l = l.replace(/\bpi\b/g, '3.14159265359');
    
    // EEL modulo
    l = l.replace(/([a-zA-Z0-9_.)]+)\s*%\s*([a-zA-Z0-9_.(]+)/g, 'mod($1, $2)');
    
    return l;
  }).join('\n');
};
// ────────────────────────────────────────────────────────────────────────────

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

const WARP_MESH_GRID = 32;
const WARP_MESH_VERT_COUNT = (WARP_MESH_GRID + 1) * (WARP_MESH_GRID + 1);
const WARP_MESH_IDX_COUNT = WARP_MESH_GRID * WARP_MESH_GRID * 6;

/**
 * Vertex shader for per-pixel EEL warp mesh.
 * Takes screen position and pre-computed source UV (from CPU EEL evaluation).
 */
const PER_PIXEL_WARP_VERTEX_SHADER = `#version 300 es
precision highp float;
in vec2 position;
in vec2 srcUv;
out vec2 vSrcUv;
void main() {
  vSrcUv = srcUv;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

/**
 * Fragment shader for per-pixel EEL warp mesh.
 * Samples previous frame at the per-vertex source UV with decay.
 */
const PER_PIXEL_WARP_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 vSrcUv;
uniform sampler2D sampler_main;
uniform float uDecay;
out vec4 fragColor;
void main() {
  vec3 color = texture(sampler_main, vSrcUv).rgb;
  fragColor = vec4(color * uDecay, 1.0);
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

const createNativePerPixelWarpShader = (params: Record<string, number | boolean>, perPixelCode: string[]): string => {
  const decay = Number(params.fDecay ?? 0.95);
  const glslBody = transpileEelToGlsl(perPixelCode);
  
  const rawGlsl = `#version 300 es
precision highp float;
in vec2 vUv;
in vec2 vUvOriginal;
in float vRadius;
in float vAngle;
out vec4 fragColor;

uniform sampler2D sampler_main;
uniform float uTime;
uniform float uFrame;
uniform float uFps;
uniform float uRms;
uniform float audioLow;
uniform float audioMid;
uniform float audioHigh;
uniform float audioLowSmooth;
uniform float audioMidSmooth;
uniform float audioHighSmooth;

uniform float uBaseZoom;
uniform float uBaseZoomexp;
uniform float uBaseRot;
uniform float uBaseCx;
uniform float uBaseCy;
uniform float uBaseDx;
uniform float uBaseDy;
uniform float uBaseSx;
uniform float uBaseSy;
uniform float uBaseWarp;

// Q variables
uniform float q1; uniform float q2; uniform float q3; uniform float q4;
uniform float q5; uniform float q6; uniform float q7; uniform float q8;
uniform float q9; uniform float q10; uniform float q11; uniform float q12;
uniform float q13; uniform float q14; uniform float q15; uniform float q16;
uniform float q17; uniform float q18; uniform float q19; uniform float q20;
uniform float q21; uniform float q22; uniform float q23; uniform float q24;
uniform float q25; uniform float q26; uniform float q27; uniform float q28;
uniform float q29; uniform float q30; uniform float q31; uniform float q32;

void main() {
  float x = vUvOriginal.x;
  float y = vUvOriginal.y;
  float rad = vRadius;
  float ang = vAngle;
  
  float zoom = uBaseZoom;
  float zoomexp = uBaseZoomexp;
  float rot = uBaseRot;
  float cx = uBaseCx;
  float cy = uBaseCy;
  float dx = uBaseDx;
  float dy = uBaseDy;
  float sx = uBaseSx;
  float sy = uBaseSy;
  float warp = uBaseWarp;
  
  float time = uTime;
  float fps = uFps;
  float frame = uFrame;
  float bass = audioLow;
  float mid = audioMid;
  float treb = audioHigh;
  float bass_att = audioLowSmooth;
  float mid_att = audioMidSmooth;
  float treb_att = audioHighSmooth;
  
  // --- EEL Per-Pixel Code ---
  ${glslBody}
  // --------------------------
  
  vec2 center = vec2(cx, cy);
  vec2 uv = vUvOriginal - center;

  float z = zoom;
  if (zoomexp != 1.0) {
    z = pow(z, pow(zoomexp, rad * 2.0 - 1.0));
  }
  uv /= max(z, 0.001);

  float ca = cos(rot);
  float sa = sin(rot);
  uv = mat2(ca, sa, -sa, ca) * uv;

  uv *= vec2(sx, sy);
  uv += vec2(dx, dy);

  uv += warp * 0.03 * vec2(
    sin(uv.y * 6.28 + uTime * 0.5),
    cos(uv.x * 6.28 + uTime * 0.5)
  );

  uv += center;

  vec3 color = texture(sampler_main, uv).rgb;
  color *= ${decay.toFixed(4)};
  fragColor = vec4(color, 1.0);
}`;
  
  // Use the patcher to fix int->float and auto-declare undeclared variables
  return patchMilkDropGlsl(rawGlsl);
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
  let noiseVolLqTexture: WebGLTexture | null = null;
  let noiseVolHqTexture: WebGLTexture | null = null;

  let mouseX = 0.5;
  let mouseY = 0.5;
  let isMouseDown = false;

  const onMouseMove = (e: MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = (e.clientX - rect.left) / rect.width;
    mouseY = (e.clientY - rect.top) / rect.height;
  };
  const onMouseDown = () => { isMouseDown = true; };
  const onMouseUp = () => { isMouseDown = false; };
  const onMouseLeave = () => { isMouseDown = false; };

  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('mouseleave', onMouseLeave);

  let lastWidth = 0;
  let lastHeight = 0;
  let lastCompileReport: MilkDropCompileReport | null = null;
  let lastNativeRuntimeReport: MilkDropNativeRuntimeReport = {
    shapes: {
      requested: 0,
      rendered: 0,
      borders: 0,
      texturedFallbacks: 0,
      evaluatedShapes: 0,
      evaluatedPoints: 0
    },
    waves: {
      requested: 0,
      rendered: 0,
      renderedPoints: 0,
      evaluatedPoints: 0
    }
  };
  
  let customTextures: (WebGLTexture | null)[] = [];
  
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
  const shapeRenderer = createMilkwaveShapeRenderer(gl);
  const waveRenderer = createMilkwaveWaveRenderer(gl);
  
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

  const generateNoiseVolTexture = (width: number, height: number, depth: number): WebGLTexture => {
    const texture = gl.createTexture()!;
    const data = new Uint8Array(width * height * depth * 4);
    for (let i = 0; i < data.length; i += 4) {
      const v = Math.random() * 255;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
    gl.bindTexture(gl.TEXTURE_3D, texture);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA8, width, height, depth, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.REPEAT);
    return texture;
  };

  // Create noise textures once (not on every resize)
  noiseTexture = generateNoiseTexture(256, 256);
  noiseVolLqTexture = generateNoiseVolTexture(32, 32, 32);
  noiseVolHqTexture = generateNoiseVolTexture(64, 64, 64);

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

  const seedFeedbackFrame = (shaderData: MilkDropShaderData, width: number, height: number) => {
    if (!mainFbo) return;
    const [r, g, b] = deriveMilkDropSeedColor(shaderData.originalParameters ?? {}, randomPreset as [number, number]);
    gl.bindFramebuffer(gl.FRAMEBUFFER, mainFbo.fbo);
    gl.viewport(0, 0, width, height);
    gl.disable(gl.BLEND);
    gl.clearColor(r, g, b, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };

  const compileShaders = (shaderData: MilkDropShaderData): boolean => {
    warpProgram = null;
    compProgram = null;
    const warpRawDiagnostics = analyzeMilkwaveShaderSource({
      source: shaderData.warp ?? '',
      pass: 'warp',
      stage: 'raw'
    });
    const compRawDiagnostics = analyzeMilkwaveShaderSource({
      source: shaderData.comp ?? '',
      pass: 'comp',
      stage: 'raw'
    });
    lastCompileReport = {
      warp: {
        requested: Boolean(shaderData.warp),
        diagnostics: warpRawDiagnostics,
        compiled: false,
        fallbackUsed: false
      },
      comp: {
        requested: Boolean(shaderData.comp),
        diagnostics: compRawDiagnostics,
        compiled: false,
        fallbackUsed: false
      }
    };
    const vs = createMilkDropVertexShader(gl);
    if (!vs) {
      onError?.('Failed to compile vertex shader', 'vertex');
      return false;
    }

    if (shaderData.warp) {
      const patchedWarp = patchMilkDropGlsl(shaderData.warp);
      const warpPatchedDiagnostics = analyzeMilkwaveShaderSource({
        source: patchedWarp,
        pass: 'warp',
        stage: 'glsl'
      });
      lastCompileReport.warp.patchedDiagnostics = warpPatchedDiagnostics;
      console.info('[MilkDrop] Warp diagnostics', {
        summary: summarizeMilkwaveShaderDiagnostics(warpPatchedDiagnostics),
        issues: [...warpRawDiagnostics.issues, ...warpPatchedDiagnostics.issues].slice(0, 8)
      });
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
        lastCompileReport.warp.fallbackUsed = true;
      }
      lastCompileReport.warp.compiled = warpProgram !== null;
    } else if (shaderData.perPixelCode?.length) {
      // Pre-MilkDrop2 preset with per-pixel EEL code: translated to native GLSL warp shader.
      const nativeWarp = createNativePerPixelWarpShader(shaderData.originalParameters, shaderData.perPixelCode);
      const nativeFs = createMilkDropFragmentShader(gl, nativeWarp);
      if (nativeFs) {
        warpProgram = createProgram(gl, vs, nativeFs);
      } else {
        console.warn('[MilkDrop] Native per-pixel warp compilation failed, using default warp fallback.');
        const fallbackWarp = createDefaultWarpShader(shaderData.originalParameters);
        const fallbackFs = createMilkDropFragmentShader(gl, fallbackWarp);
        if (fallbackFs) warpProgram = createProgram(gl, vs, fallbackFs);
      }
      lastCompileReport.warp.compiled = warpProgram !== null;
    } else {
      // Pre-MilkDrop2 preset with no custom warp and no per-pixel code: generic warp fallback
      const defaultWarp = createDefaultWarpShader(shaderData.originalParameters);
      const defaultFs = createMilkDropFragmentShader(gl, defaultWarp);
      if (defaultFs) warpProgram = createProgram(gl, vs, defaultFs);
      lastCompileReport.warp.compiled = warpProgram !== null;
    }

    if (shaderData.comp) {
      const patchedComp = patchMilkDropGlsl(shaderData.comp);
      const compPatchedDiagnostics = analyzeMilkwaveShaderSource({
        source: patchedComp,
        pass: 'comp',
        stage: 'glsl'
      });
      lastCompileReport.comp.patchedDiagnostics = compPatchedDiagnostics;
      console.info('[MilkDrop] Comp diagnostics', {
        summary: summarizeMilkwaveShaderDiagnostics(compPatchedDiagnostics),
        issues: [...compRawDiagnostics.issues, ...compPatchedDiagnostics.issues].slice(0, 8)
      });
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
        lastCompileReport.comp.fallbackUsed = true;
      }
      lastCompileReport.comp.compiled = compProgram !== null;
    } else {
      // Pre-MilkDrop2 preset: no custom comp shader, use default passthrough
      const defaultComp = createFallbackCompShader();
      const defaultFs = createMilkDropFragmentShader(gl, defaultComp);
      if (defaultFs) compProgram = createProgram(gl, vs, defaultFs);
      lastCompileReport.comp.compiled = compProgram !== null;
    }

    // Reset state for new preset
    qVars.fill(0);
    Object.keys(megabufData).forEach(k => delete megabufData[Number(k)]);
    Object.keys(gmegabufData).forEach(k => delete gmegabufData[Number(k)]);
    Object.keys(customVars).forEach(k => delete customVars[k]);
    variables.frame = 0;
    perFrameInitRun = false;
    randomPreset = [Math.random(), Math.random()];

    // Clean up old custom textures
    customTextures.forEach(t => t && gl.deleteTexture(t));
    customTextures = [];
    
    if (shaderData.textures) {
      customTextures = new Array(shaderData.textures.length).fill(null);
      shaderData.textures.forEach((texPath, i) => {
        if (!texPath) return;
        
        const texture = gl.createTexture();
        if (!texture) return;
        
        // 1x1 transparent fallback while loading
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        customTextures[i] = texture;

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          gl.bindTexture(gl.TEXTURE_2D, texture);
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0); // Restore default
        };
        img.onerror = () => {
          console.warn('[MilkDrop] Failed to load custom texture:', texPath);
        };
        // Ensure path works for local or remote
        img.src = texPath.startsWith('file:') || texPath.startsWith('http') || texPath.startsWith('data:')
          ? texPath
          : (/^[A-Za-z]:/.test(texPath) ? `file:///${texPath.replace(/\\/g, '/')}` : `file://${texPath}`);
      });
    }

    console.log('[MilkDrop] Shaders compiled:', {
      warp: !!warpProgram,
      comp: !!compProgram,
      report: lastCompileReport
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
      log10: Math.log10,
      exp: Math.exp,
      asin: Math.asin,
      acos: Math.acos,
      atan: Math.atan,
      atan2: Math.atan2,
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
      const allLines = code
        .filter(line => line.trim() && !line.trim().startsWith('//'))
        .map(transpileEelLine)
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

    if (variables.frame === 0) {
      seedFeedbackFrame(shaderData, width, height);
    }

    // Run per-frame init code once on first frame
    if (!perFrameInitRun && shaderData.perFrameInitCode?.length) {
      executePerFrameCode(shaderData.perFrameInitCode, state);
      perFrameInitRun = true;
    }
    executePerFrameCode(shaderData.perFrameCode, state);

    lastNativeRuntimeReport = {
      shapes: {
        requested: shaderData.shapes?.length ?? 0,
        rendered: 0,
        borders: 0,
        texturedFallbacks: 0,
        evaluatedShapes: 0,
        evaluatedPoints: 0
      },
      waves: {
        requested: shaderData.waves?.length ?? 0,
        rendered: 0,
        renderedPoints: 0,
        evaluatedPoints: 0
      }
    };

    gl.bindFramebuffer(gl.FRAMEBUFFER, warpFbo?.fbo ?? null);
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (warpProgram) {
      const activeWarpProgram = warpProgram;
      gl.useProgram(activeWarpProgram);
      setUniforms(activeWarpProgram, state, width, height, shaderData, 'warp');
      bindMilkwaveSamplers({
        gl,
        loc: (name) => gl.getUniformLocation(activeWarpProgram, name),
        resources: {
          previousFrameTexture: mainFbo?.texture,
          blur1Texture: blur1Fbo?.texture,
          blur2Texture: blur2Fbo?.texture,
          blur3Texture: blur3Fbo?.texture,
          noiseTexture,
          noiseVolLqTexture,
          noiseVolHqTexture,
          customTextures
        },
        phase: 'warp'
      });

      const posLoc = gl.getAttribLocation(activeWarpProgram, 'position');
      gl.enableVertexAttribArray(posLoc);
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    if (shaderData.shapes?.length) {
      const shapeStats = shapeRenderer.render({
        shapes: shaderData.shapes,
        runtime: {
          timeSeconds: variables.time,
          frame: variables.frame,
          fps: variables.fps,
          progress: 0,
          bass: variables.bass,
          mid: variables.mid,
          treb: variables.treb,
          bassAtt: variables.bass_att,
          midAtt: variables.mid_att,
          trebAtt: variables.treb_att,
          qVars
        },
        mainTexture: mainFbo?.texture ?? null
      });
      lastNativeRuntimeReport.shapes = {
        requested: shaderData.shapes.length,
        rendered: shapeStats.renderedShapes,
        borders: shapeStats.renderedBorders,
        texturedFallbacks: shapeStats.ignoredTexturedShapes,
        evaluatedShapes: shapeStats.evaluatedShapes,
        evaluatedPoints: shapeStats.evaluatedPoints
      };
    }

    if (shaderData.waves?.length) {
      const waveStats = waveRenderer.render({
        waves: shaderData.waves,
        runtime: {
          timeSeconds: variables.time,
          frame: variables.frame,
          fps: variables.fps,
          progress: 0,
          bass: variables.bass,
          mid: variables.mid,
          treb: variables.treb,
          bassAtt: variables.bass_att,
          midAtt: variables.mid_att,
          trebAtt: variables.treb_att,
          qVars,
          waveform: state.oscilloData,
          spectrum: state.spectrum
        }
      });
      lastNativeRuntimeReport.waves = {
        requested: shaderData.waves.length,
        rendered: waveStats.renderedWaves,
        renderedPoints: waveStats.renderedPoints,
        evaluatedPoints: waveStats.evaluatedPoints
      };
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
      const activeCompProgram = compProgram;
      gl.useProgram(activeCompProgram);
      setUniforms(activeCompProgram, state, width, height, shaderData, 'comp');
      bindMilkwaveSamplers({
        gl,
        loc: (name) => gl.getUniformLocation(activeCompProgram, name),
        resources: {
          warpTexture: warpFbo?.texture,
          blur1Texture: blur1Fbo?.texture,
          blur2Texture: blur2Fbo?.texture,
          blur3Texture: blur3Fbo?.texture,
          noiseTexture,
          noiseVolLqTexture,
          noiseVolHqTexture,
          customTextures
        },
        phase: 'comp'
      });

      const posLoc = gl.getAttribLocation(activeCompProgram, 'position');
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
    for (let i = 0; i < 40; i++) {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.bindTexture(gl.TEXTURE_3D, null);
    }
    gl.activeTexture(gl.TEXTURE0);

    variables.frame++;
    return true;
  };

  const setUniforms = (program: WebGLProgram, state: RenderState, width: number, height: number, shaderData: MilkDropShaderData, phase: 'warp' | 'comp') => {
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

    const p = shaderData.originalParameters ?? {};

    // EEL native per-pixel variables
    gl.uniform1f(loc('uBaseZoom'), customVars['zoom'] ?? Number(p.zoom ?? 1));
    gl.uniform1f(loc('uBaseZoomexp'), customVars['zoomexp'] ?? Number(p.zoomexp ?? 1));
    gl.uniform1f(loc('uBaseRot'), customVars['rot'] ?? Number(p.rot ?? 0));
    gl.uniform1f(loc('uBaseCx'), customVars['cx'] ?? Number(p.cx ?? 0.5));
    gl.uniform1f(loc('uBaseCy'), customVars['cy'] ?? Number(p.cy ?? 0.5));
    gl.uniform1f(loc('uBaseDx'), customVars['dx'] ?? Number(p.dx ?? 0));
    gl.uniform1f(loc('uBaseDy'), customVars['dy'] ?? Number(p.dy ?? 0));
    gl.uniform1f(loc('uBaseSx'), customVars['sx'] ?? Number(p.sx ?? 1));
    gl.uniform1f(loc('uBaseSy'), customVars['sy'] ?? Number(p.sy ?? 1));
    gl.uniform1f(loc('uBaseWarp'), customVars['warp'] ?? Number(p.warp ?? 0));

    const getBlurScale = (idx: number) => {
      const min = Number(p[`blur${idx}_min`] ?? 0);
      const max = Number(p[`blur${idx}_max`] ?? 1);
      return 1.0 / Math.max(0.0001, max - min);
    };
    const getBlurBias = (idx: number) => {
      const min = Number(p[`blur${idx}_min`] ?? 0);
      const max = Number(p[`blur${idx}_max`] ?? 1);
      return -min / Math.max(0.0001, max - min);
    };

    bindMilkwaveBuiltins({
      gl,
      loc,
      state: {
        timeSeconds: t,
        frame: variables.frame,
        width,
        height,
        rms: state.rms,
        bass: variables.bass,
        mid: variables.mid,
        treb: variables.treb,
        bassAtt: variables.bass_att,
        midAtt: variables.mid_att,
        trebAtt: variables.treb_att,
        qVars,
        randomPreset: randomPreset as [number, number],
        randomFrame: [Math.random(), Math.random(), Math.random(), Math.random()],
        mouseX,
        mouseY,
        isMouseDown,
        blurInfo: {
          scale1: getBlurScale(1), bias1: getBlurBias(1),
          scale2: getBlurScale(2), bias2: getBlurBias(2),
          scale3: getBlurScale(3), bias3: getBlurBias(3)
        }
      }
    });
  };

  const getMainTexture = (): WebGLTexture | null => {
    return mainFbo?.texture ?? null;
  };

  const clear = () => {
    canvas.removeEventListener('mousemove', onMouseMove);
    canvas.removeEventListener('mousedown', onMouseDown);
    canvas.removeEventListener('mouseup', onMouseUp);
    canvas.removeEventListener('mouseleave', onMouseLeave);

    if (warpProgram) gl.deleteProgram(warpProgram);
    if (compProgram) gl.deleteProgram(compProgram);
    if (noiseTexture) gl.deleteTexture(noiseTexture);
    if (noiseVolLqTexture) gl.deleteTexture(noiseVolLqTexture);
    if (noiseVolHqTexture) gl.deleteTexture(noiseVolHqTexture);

    shapeRenderer.clear();
    waveRenderer.clear();
    lastNativeRuntimeReport = {
      shapes: {
        requested: 0,
        rendered: 0,
        borders: 0,
        texturedFallbacks: 0,
        evaluatedShapes: 0,
        evaluatedPoints: 0
      },
      waves: {
        requested: 0,
        rendered: 0,
        renderedPoints: 0,
        evaluatedPoints: 0
      }
    };
    warpProgram = null;
    compProgram = null;
  };

  return {
    compileShaders,
    render,
    getMainTexture,
    clear,
    getLastCompileReport: () => lastCompileReport,
    getLastNativeRuntimeReport: () => lastNativeRuntimeReport,
    getVariables: () => ({ ...variables }),
    getQVars: () => [...qVars],
  };
};

export type MilkDropRenderer = ReturnType<typeof createMilkDropRenderer>;
