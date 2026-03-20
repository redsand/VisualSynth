import type { MilkWaveConfig } from '../../../shared/milkwaveParser';

interface MilkwaveWaveRuntimeFrameState {
  timeSeconds: number;
  frame: number;
  fps: number;
  progress: number;
  bass: number;
  mid: number;
  treb: number;
  bassAtt: number;
  midAtt: number;
  trebAtt: number;
  qVars: number[];
  waveform: Float32Array;
  spectrum: Float32Array;
}

interface MilkwaveWaveRuntimeMemory {
  initRan: boolean;
  tVars: number[];
  qVars: number[];
  /** samples count persisted after init code runs (init may modify it) */
  samples?: number;
}

interface MilkwaveWaveRenderVertex {
  x: number;
  y: number;
  color: { r: number; g: number; b: number; a: number };
}

const WAVE_VERTEX_SHADER = `#version 300 es
precision highp float;

in vec2 aPosition;
in vec4 aColor;
out vec4 vColor;

void main() {
  vColor = aColor;
  gl_Position = vec4(aPosition, 0.0, 1.0);
  gl_PointSize = 2.0;
}`;

const WAVE_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec4 vColor;
out vec4 fragColor;

void main() {
  fragColor = vColor;
}`;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const compileShader = (
  gl: WebGL2RenderingContext,
  type: number,
  source: string
): WebGLShader | null => {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('[MilkwaveWaves] Shader compile error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
};

const createProgram = (gl: WebGL2RenderingContext): WebGLProgram | null => {
  const vs = compileShader(gl, gl.VERTEX_SHADER, WAVE_VERTEX_SHADER);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, WAVE_FRAGMENT_SHADER);
  if (!vs || !fs) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('[MilkwaveWaves] Program link error:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
};

const toNdc = (x: number, y: number) => ({
  x: x * 2 - 1,
  y: 1 - y * 2
});

const createInterleavedBuffer = ({
  vertices
}: {
  vertices: MilkwaveWaveRenderVertex[];
}) => {
  const data = new Float32Array(vertices.length * 6);
  vertices.forEach((vertex, index) => {
    const ndc = toNdc(vertex.x, vertex.y);
    const offset = index * 6;
    data[offset] = ndc.x;
    data[offset + 1] = ndc.y;
    data[offset + 2] = vertex.color.r;
    data[offset + 3] = vertex.color.g;
    data[offset + 4] = vertex.color.b;
    data[offset + 5] = vertex.color.a;
  });
  return data;
};

export interface MilkwaveWaveRenderStats {
  renderedWaves: number;
  renderedPoints: number;
  evaluatedPoints: number;
}

const preprocessMilkwaveCode = (lines: string[]) =>
  lines
    .filter((line) => line.trim() && !line.trim().startsWith('//'))
    .map((line) =>
      line
        .trim()
        .replace(/\bif\s*\(\s*([^,]+),\s*([^,]+),\s*([^)]+)\)/g, '(($1) ? ($2) : ($3))')
    )
    .join('\n');

const executeMilkwaveWaveCode = ({
  lines,
  ctx,
  persistentNames
}: {
  lines: string[];
  ctx: Record<string, any>;
  persistentNames: string[];
}) => {
  if (!lines.some((line) => line.trim().length > 0)) return ctx;
  try {
    const localNames = Object.keys(ctx).filter((key) => typeof ctx[key] !== 'function');
    const fnNames = Object.keys(ctx).filter((key) => typeof ctx[key] === 'function');
    const header = localNames.map((key) => `let ${key} = __ctx.${key};`).join('\n');
    const fnHeader = fnNames.map((key) => `const ${key} = __ctx.${key};`).join('\n');
    const returnNames = [...new Set([...persistentNames, ...localNames])];
    const body = preprocessMilkwaveCode(lines);
    const fn = new Function('__ctx', `${header}\n${fnHeader}\n${body}\nreturn { ${returnNames.join(', ')} };`);
    const result = fn(ctx);
    return { ...ctx, ...result };
  } catch {
    return ctx;
  }
};

const smoothSeries = (data: Float32Array, sampleCount: number, sourceOffset: number, smoothing: number, scale: number) => {
  const out = new Array<number>(sampleCount).fill(0);
  if (sampleCount <= 0) return out;
  const mix1 = Math.pow(clamp01(smoothing) * 0.98, 0.5);
  const mix2 = 1 - mix1;
  const maxIndex = Math.max(0, data.length - 1);

  const sampleAt = (index: number) => data[Math.max(0, Math.min(maxIndex, index + sourceOffset))] ?? 0;
  out[0] = sampleAt(0) * scale;
  for (let i = 1; i < sampleCount; i++) {
    out[i] = sampleAt(i) * scale * mix2 + out[i - 1] * mix1;
  }
  for (let i = sampleCount - 2; i >= 0; i--) {
    out[i] = out[i] * mix2 + out[i + 1] * mix1;
  }
  return out;
};

const createBaseWaveContext = ({
  wave,
  runtime,
  memory
}: {
  wave: MilkWaveConfig;
  runtime: MilkwaveWaveRuntimeFrameState;
  memory: MilkwaveWaveRuntimeMemory;
}) => {
  const ctx: Record<string, any> = {
    time: runtime.timeSeconds,
    frame: runtime.frame,
    fps: runtime.fps,
    progress: runtime.progress,
    bass: runtime.bass,
    mid: runtime.mid,
    treb: runtime.treb,
    bass_att: runtime.bassAtt,
    mid_att: runtime.midAtt,
    treb_att: runtime.trebAtt,
    r: wave.r,
    g: wave.g,
    b: wave.b,
    a: wave.a,
    samples: wave.samples,
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
    min: Math.min,
    max: Math.max,
    sign: Math.sign,
    int: Math.trunc,
    sqr: (a: number) => a * a,
    frac: (x: number) => x - Math.trunc(x),
    rand: (max: number) => Math.random() * max,
    bor: (a: number, b: number) => (a || b ? 1 : 0),
    band: (a: number, b: number) => (a && b ? 1 : 0),
    bnot: (a: number) => (a ? 0 : 1),
    if_milk: (cond: number, a: number, b: number) => (cond ? a : b),
    pi: Math.PI
  };

  for (let i = 0; i < 32; i++) ctx[`q${i + 1}`] = memory.qVars[i] ?? runtime.qVars[i] ?? 0;
  for (let i = 0; i < 8; i++) ctx[`t${i + 1}`] = memory.tVars[i] ?? 0;
  return ctx;
};

export const createMilkwaveWaveRenderer = (gl: WebGL2RenderingContext) => {
  const program = createProgram(gl);
  const buffer = gl.createBuffer();
  const runtimeMemory = new Map<string, MilkwaveWaveRuntimeMemory>();

  const render = ({
    waves,
    runtime
  }: {
    waves: MilkWaveConfig[] | undefined | null;
    runtime: MilkwaveWaveRuntimeFrameState;
  }): MilkwaveWaveRenderStats => {
    if (!program || !buffer || !Array.isArray(waves) || waves.length === 0) {
      return { renderedWaves: 0, renderedPoints: 0, evaluatedPoints: 0 };
    }

    const posLoc = gl.getAttribLocation(program, 'aPosition');
    const colorLoc = gl.getAttribLocation(program, 'aColor');
    if (posLoc < 0 || colorLoc < 0) {
      return { renderedWaves: 0, renderedPoints: 0, evaluatedPoints: 0 };
    }

    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(posLoc);
    gl.enableVertexAttribArray(colorLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 24, 0);
    gl.vertexAttribPointer(colorLoc, 4, gl.FLOAT, false, 24, 8);
    gl.enable(gl.BLEND);

    let renderedWaves = 0;
    let renderedPoints = 0;
    let evaluatedPoints = 0;

    for (const [index, wave] of waves.entries()) {
      if (!wave.enabled) continue;
      const memoryKey = `wave-${index}`;
      const memory =
        runtimeMemory.get(memoryKey) ??
        { initRan: false, tVars: new Array(8).fill(0), qVars: [...runtime.qVars], samples: undefined };
      runtimeMemory.set(memoryKey, memory);

      let frameCtx = createBaseWaveContext({ wave, runtime, memory });
      // Restore persisted samples count from init (if init already ran)
      if (memory.initRan && memory.samples != null) {
        frameCtx = { ...frameCtx, samples: memory.samples };
      }
      if (!memory.initRan && wave.initCode?.length) {
        frameCtx = executeMilkwaveWaveCode({
          lines: wave.initCode,
          ctx: frameCtx,
          persistentNames: [
            'r', 'g', 'b', 'a', 'samples',
            ...Array.from({ length: 8 }, (_, i) => `t${i + 1}`),
            ...Array.from({ length: 32 }, (_, i) => `q${i + 1}`)
          ]
        });
        memory.initRan = true;
        memory.samples = Number(frameCtx.samples ?? wave.samples);
      }
      if (wave.perFrameCode?.length) {
        frameCtx = executeMilkwaveWaveCode({
          lines: wave.perFrameCode,
          ctx: frameCtx,
          persistentNames: [
            'r', 'g', 'b', 'a', 'samples',
            ...Array.from({ length: 8 }, (_, i) => `t${i + 1}`),
            ...Array.from({ length: 32 }, (_, i) => `q${i + 1}`)
          ]
        });
      }

      for (let i = 0; i < 8; i++) memory.tVars[i] = Number(frameCtx[`t${i + 1}`] ?? memory.tVars[i] ?? 0);
      for (let i = 0; i < 32; i++) memory.qVars[i] = Number(frameCtx[`q${i + 1}`] ?? memory.qVars[i] ?? runtime.qVars[i] ?? 0);

      const sampleCount = Math.max(1, Math.min(512, Math.round(Number(frameCtx.samples ?? wave.samples ?? 0))));
      const source = wave.bSpectrum ? runtime.spectrum : runtime.waveform;
      const baseScale = (wave.bSpectrum ? 0.15 : 0.004) * (wave.scaling || 1);
      const left = smoothSeries(source, sampleCount, 0, wave.smoothing || 0, baseScale);
      const right = smoothSeries(source, sampleCount, Math.round(wave.sep || 0), wave.smoothing || 0, baseScale);
      const vertices: MilkwaveWaveRenderVertex[] = [];

      for (let pointIndex = 0; pointIndex < sampleCount; pointIndex++) {
        let pointCtx: Record<string, number> = {
          ...frameCtx,
          sample: sampleCount <= 1 ? 0 : pointIndex / (sampleCount - 1),
          value1: left[pointIndex] ?? 0,
          value2: right[pointIndex] ?? 0,
          x: 0.5 + (left[pointIndex] ?? 0),
          y: 0.5 + (right[pointIndex] ?? 0),
          r: Number(frameCtx.r ?? wave.r),
          g: Number(frameCtx.g ?? wave.g),
          b: Number(frameCtx.b ?? wave.b),
          a: Number(frameCtx.a ?? wave.a)
        };

        if (wave.perPointCode?.length) {
          pointCtx = executeMilkwaveWaveCode({
            lines: wave.perPointCode,
            ctx: pointCtx,
            persistentNames: [
              'x', 'y', 'r', 'g', 'b', 'a',
              ...Array.from({ length: 8 }, (_, i) => `t${i + 1}`),
              ...Array.from({ length: 32 }, (_, i) => `q${i + 1}`)
            ]
          });
          evaluatedPoints++;
        }

        for (let i = 0; i < 8; i++) memory.tVars[i] = Number(pointCtx[`t${i + 1}`] ?? memory.tVars[i] ?? 0);
        for (let i = 0; i < 32; i++) memory.qVars[i] = Number(pointCtx[`q${i + 1}`] ?? memory.qVars[i] ?? runtime.qVars[i] ?? 0);

        vertices.push({
          x: clamp01(Number(pointCtx.x ?? 0.5)),
          y: clamp01(Number(pointCtx.y ?? 0.5)),
          color: {
            r: clamp01(Number(pointCtx.r ?? wave.r)),
            g: clamp01(Number(pointCtx.g ?? wave.g)),
            b: clamp01(Number(pointCtx.b ?? wave.b)),
            a: clamp01(Number(pointCtx.a ?? wave.a))
          }
        });
      }

      if (vertices.length === 0) continue;
      gl.blendFunc(gl.SRC_ALPHA, wave.bAdditive ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
      const interleaved = createInterleavedBuffer({ vertices });
      gl.bufferData(gl.ARRAY_BUFFER, interleaved, gl.DYNAMIC_DRAW);

      if (wave.bUseDots) {
        gl.drawArrays(gl.POINTS, 0, vertices.length);
      } else {
        gl.lineWidth(wave.bDrawThick ? 2 : 1);
        gl.drawArrays(gl.LINE_STRIP, 0, vertices.length);
      }
      renderedWaves++;
      renderedPoints += vertices.length;
    }

    return { renderedWaves, renderedPoints, evaluatedPoints };
  };

  const clear = () => {
    if (program) gl.deleteProgram(program);
    if (buffer) gl.deleteBuffer(buffer);
    runtimeMemory.clear();
  };

  return { render, clear };
};
