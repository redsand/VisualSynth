import type { RenderState } from './renderState';
import type { MilkShapeConfig, MilkWaveConfig } from '../shared/milkwaveParser';
import type { MilkwaveOfflineTranslationReport } from '../shared/milkwaveOfflineTranslation';
import {
  analyzeMilkwaveShaderSource,
  summarizeMilkwaveShaderDiagnostics,
  type MilkwaveShaderDiagnostics
} from '../shared/milkwaveDiagnostics';
import { bindMilkwaveBuiltins } from './milkwave/runtime/milkwaveBuiltins';
import { bindMilkwaveSamplers } from './milkwave/runtime/milkwaveSamplers';
import { createMilkwaveShapeRenderer } from './milkwave/runtime/milkwaveShapeRenderer';
import { createMilkwaveWaveRenderer } from './milkwave/runtime/milkwaveWaveRenderer';

export interface MilkDropShaderData {
  warp: string;
  comp: string;
  perFrameCode: string[];
  perFrameInitCode: string[];
  perPixelCode?: string[];
  waves?: MilkWaveConfig[];
  shapes?: MilkShapeConfig[];
  originalParameters: Record<string, number | boolean>;
  translation?: MilkwaveOfflineTranslationReport;
}

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

  // Per-pixel warp mesh state (for presets with EEL per_pixel code and no custom GLSL warp shader)
  let perPixelWarpProgram: WebGLProgram | null = null;
  let meshPositionBuffer: WebGLBuffer | null = null;
  let meshSrcUvBuffer: WebGLBuffer | null = null;
  let meshIndexBuffer: WebGLBuffer | null = null;
  let isPerPixelWarpMode = false;
  type PerPixelFn = (x: number, y: number, rad: number, ang: number, ctx: Record<string, number>) => { x: number; y: number };
  let compiledPerPixelFn: PerPixelFn | null = null;

  // Pre-compute static mesh positions and triangle indices (immutable across presets)
  const meshPositions = new Float32Array(WARP_MESH_VERT_COUNT * 2);
  const meshSrcUvs = new Float32Array(WARP_MESH_VERT_COUNT * 2);
  const meshIndices = new Uint16Array(WARP_MESH_IDX_COUNT);
  {
    const g = WARP_MESH_GRID, gs = g + 1;
    for (let j = 0; j <= g; j++) {
      for (let i = 0; i <= g; i++) {
        const vi = (j * gs + i) * 2;
        meshPositions[vi]     = (i / g) * 2 - 1;  // screen x [-1, 1]
        meshPositions[vi + 1] = (j / g) * 2 - 1;  // screen y [-1, 1]
      }
    }
    let ii = 0;
    for (let j = 0; j < g; j++) {
      for (let i = 0; i < g; i++) {
        const v0 = j * gs + i;
        meshIndices[ii++] = v0;      meshIndices[ii++] = v0 + gs;      meshIndices[ii++] = v0 + 1;
        meshIndices[ii++] = v0 + 1;  meshIndices[ii++] = v0 + gs;      meshIndices[ii++] = v0 + gs + 1;
      }
    }
  }

  // Upload static mesh data and allocate dynamic srcUv buffer
  meshPositionBuffer = gl.createBuffer();
  meshSrcUvBuffer = gl.createBuffer();
  meshIndexBuffer = gl.createBuffer();
  if (meshPositionBuffer) {
    gl.bindBuffer(gl.ARRAY_BUFFER, meshPositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, meshPositions, gl.STATIC_DRAW);
  }
  if (meshIndexBuffer) {
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, meshIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, meshIndices, gl.STATIC_DRAW);
  }
  if (meshSrcUvBuffer) {
    gl.bindBuffer(gl.ARRAY_BUFFER, meshSrcUvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, meshSrcUvs, gl.DYNAMIC_DRAW);
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

  // Compile the per-pixel warp mesh program (vertex + fragment) once at startup
  const initPerPixelWarpProgram = () => {
    const vs = gl.createShader(gl.VERTEX_SHADER);
    if (!vs) return;
    gl.shaderSource(vs, PER_PIXEL_WARP_VERTEX_SHADER);
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
      console.error('[MilkDrop] Per-pixel warp vertex shader error:', gl.getShaderInfoLog(vs));
      return;
    }
    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    if (!fs) return;
    gl.shaderSource(fs, PER_PIXEL_WARP_FRAGMENT_SHADER);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      console.error('[MilkDrop] Per-pixel warp fragment shader error:', gl.getShaderInfoLog(fs));
      return;
    }
    perPixelWarpProgram = createProgram(gl, vs, fs);
  };
  initPerPixelWarpProgram();

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
    isPerPixelWarpMode = false;
    compiledPerPixelFn = null;
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
      // Pre-MilkDrop2 preset with per-pixel EEL code: evaluate the warp mesh on the CPU
      // and render via indexed triangles — authentic MilkDrop warp mesh behaviour.
      isPerPixelWarpMode = false;
      compilePerPixelCode(shaderData.perPixelCode);
      isPerPixelWarpMode = compiledPerPixelFn !== null;
      lastCompileReport.warp.compiled = isPerPixelWarpMode;
      // warpProgram is left null — renderPerPixelWarpMesh() is used instead.
    } else {
      // Pre-MilkDrop2 preset with no custom warp and no per-pixel code: generic warp fallback
      isPerPixelWarpMode = false;
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

    console.log('[MilkDrop] Shaders compiled:', {
      warp: !!warpProgram,
      comp: !!compProgram,
      report: lastCompileReport
    });
    return warpProgram !== null || compProgram !== null || isPerPixelWarpMode;
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

  /**
   * Compile per-pixel EEL code into a reusable JS function for warp mesh evaluation.
   * The compiled function takes (x, y, rad, ang, frameCtx) and returns { x, y } — the
   * source UV coordinates to sample from the previous frame for each mesh vertex.
   */
  const compilePerPixelCode = (code: string[]): void => {
    compiledPerPixelFn = null;
    if (!code.length) return;

    const allLines = code
      .filter(line => line.trim() && !line.trim().startsWith('//'))
      .map(line => {
        let l = line.trim();
        l = l.replace(/\b(megabuf|gmegabuf)\s*\(([^)]+)\)\s*=\s*([^;]+)/g, '$1($2, $3)');
        l = l.replace(/\bif\s*\(\s*([^,]+),\s*([^,]+),\s*([^)]+)\)/g, '(($1) ? ($2) : ($3))');
        return l;
      })
      .join('\n');

    try {
      const fnBody = [
        // Per-frame animation params — from per-frame EEL results or preset defaults
        'let zoom=__ctx.zoom??1,zoomexp=__ctx.zoomexp??1,rot=__ctx.rot??0;',
        'let cx=__ctx.cx??0.5,cy=__ctx.cy??0.5,dx=__ctx.dx??0,dy=__ctx.dy??0;',
        'let warp=__ctx.warp??0,time=__ctx.time??0,frame=__ctx.frame??0;',
        'let bass=__ctx.bass??0,mid=__ctx.mid??0,treb=__ctx.treb??0;',
        ...Array.from({ length: 32 }, (_, i) => `let q${i + 1}=__ctx.q${i + 1}??0;`),
        // Math builtins
        'const abs=Math.abs,sqrt=Math.sqrt,sin=Math.sin,cos=Math.cos,tan=Math.tan;',
        'const atan=Math.atan,atan2=Math.atan2,pow=Math.pow,log=Math.log,exp=Math.exp;',
        'const floor=Math.floor,ceil=Math.ceil,sign=Math.sign,max=Math.max,min=Math.min;',
        'const sqr=x=>x*x,rand=n=>Math.random()*n,int=Math.trunc,frac=x=>x-Math.trunc(x);',
        'const above=(a,b)=>a>b?1:0,below=(a,b)=>a<b?1:0,equal=(a,b)=>a===b?1:0;',
        'const pi=Math.PI,e=Math.E;',
        // EEL per-pixel code body
        allLines,
        // Return modified x, y as the source UV for this mesh vertex
        'return { x, y };'
      ].join('\n');

      compiledPerPixelFn = new Function('x', 'y', 'rad', 'ang', '__ctx', fnBody) as PerPixelFn;
    } catch (e) {
      console.warn('[MilkDrop] Failed to compile per-pixel EEL code:', e);
    }
  };

  /**
   * Evaluate the compiled per-pixel function for every mesh vertex, then upload
   * the resulting source UV coordinates to the meshSrcUvBuffer on the GPU.
   */
  const computePerPixelMeshUVs = (params: Record<string, number | boolean>): void => {
    if (!compiledPerPixelFn || !meshSrcUvBuffer) return;

    const g = WARP_MESH_GRID, gs = g + 1;

    // Build per-frame context: prefer values computed by per-frame EEL code (in customVars),
    // falling back to preset parameters for vars that EEL did not override.
    const fctx: Record<string, number> = {
      zoom:    customVars['zoom']    ?? Number(params.zoom    ?? 1),
      zoomexp: customVars['zoomexp'] ?? Number(params.zoomexp ?? 1),
      rot:     customVars['rot']     ?? Number(params.rot     ?? 0),
      cx:      customVars['cx']      ?? Number(params.cx      ?? 0.5),
      cy:      customVars['cy']      ?? Number(params.cy      ?? 0.5),
      dx:      customVars['dx']      ?? Number(params.dx      ?? 0),
      dy:      customVars['dy']      ?? Number(params.dy      ?? 0),
      warp:    customVars['warp']    ?? Number(params.warp    ?? 0),
      time:    variables.time,
      frame:   variables.frame,
      bass:    variables.bass,
      mid:     variables.mid,
      treb:    variables.treb,
      ...Object.fromEntries(qVars.map((v, i) => [`q${i + 1}`, v])),
      ...customVars
    };

    const cx0 = fctx['cx'];
    const cy0 = fctx['cy'];

    for (let j = 0; j <= g; j++) {
      for (let i = 0; i <= g; i++) {
        const x0 = i / g;  // mesh u [0, 1]
        const y0 = j / g;  // mesh v [0, 1]
        const ddx = x0 - cx0;
        const ddy = y0 - cy0;
        const rad = Math.sqrt(ddx * ddx + ddy * ddy) / 0.5;
        const ang = Math.atan2(ddy, ddx);

        let srcX = x0;
        let srcY = y0;
        try {
          const result = compiledPerPixelFn!(x0, y0, rad, ang, fctx);
          srcX = result.x;
          srcY = result.y;
        } catch {
          // Fallback to identity mapping for this vertex
        }

        const vi = (j * gs + i) * 2;
        meshSrcUvs[vi]     = srcX;
        meshSrcUvs[vi + 1] = srcY;
      }
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, meshSrcUvBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, meshSrcUvs);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  };

  /**
   * Render the per-pixel warp mesh: compute per-vertex source UVs via EEL, upload to GPU,
   * then draw indexed triangles sampling the previous frame at the per-vertex source UV.
   * This provides authentic MilkDrop warp-mesh behaviour for presets without custom GLSL.
   */
  const renderPerPixelWarpMesh = (params: Record<string, number | boolean>): void => {
    if (!perPixelWarpProgram || !meshPositionBuffer || !meshSrcUvBuffer || !meshIndexBuffer || !mainFbo) return;

    computePerPixelMeshUVs(params);

    gl.useProgram(perPixelWarpProgram);

    const mainLoc = gl.getUniformLocation(perPixelWarpProgram, 'sampler_main');
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, mainFbo.texture);
    gl.uniform1i(mainLoc, 0);

    const decayLoc = gl.getUniformLocation(perPixelWarpProgram, 'uDecay');
    gl.uniform1f(decayLoc, Number(params.fDecay ?? 0.98));

    const posLoc = gl.getAttribLocation(perPixelWarpProgram, 'position');
    gl.enableVertexAttribArray(posLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, meshPositionBuffer);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const uvLoc = gl.getAttribLocation(perPixelWarpProgram, 'srcUv');
    gl.enableVertexAttribArray(uvLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, meshSrcUvBuffer);
    gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, meshIndexBuffer);
    gl.drawElements(gl.TRIANGLES, WARP_MESH_IDX_COUNT, gl.UNSIGNED_SHORT, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
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

    if (!shaderData || (!warpProgram && !compProgram && !isPerPixelWarpMode)) {
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

    if (isPerPixelWarpMode && perPixelWarpProgram) {
      // Per-pixel EEL warp mesh: evaluate EEL per vertex on CPU and render indexed triangles
      renderPerPixelWarpMesh(shaderData.originalParameters);
    } else if (warpProgram) {
      const activeWarpProgram = warpProgram;
      gl.useProgram(activeWarpProgram);
      setUniforms(activeWarpProgram, state, width, height);
      bindMilkwaveSamplers({
        gl,
        loc: (name) => gl.getUniformLocation(activeWarpProgram, name),
        resources: {
          previousFrameTexture: mainFbo?.texture,
          blur1Texture: blur1Fbo?.texture,
          blur2Texture: blur2Fbo?.texture,
          blur3Texture: blur3Fbo?.texture,
          noiseTexture
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
      setUniforms(activeCompProgram, state, width, height);
      bindMilkwaveSamplers({
        gl,
        loc: (name) => gl.getUniformLocation(activeCompProgram, name),
        resources: {
          warpTexture: warpFbo?.texture,
          blur1Texture: blur1Fbo?.texture,
          blur2Texture: blur2Fbo?.texture,
          blur3Texture: blur3Fbo?.texture,
          noiseTexture
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
        randomFrame: [Math.random(), Math.random(), Math.random(), Math.random()]
      }
    });
  };

  const getMainTexture = (): WebGLTexture | null => {
    return mainFbo?.texture ?? null;
  };

  const clear = () => {
    if (warpProgram) gl.deleteProgram(warpProgram);
    if (compProgram) gl.deleteProgram(compProgram);
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
