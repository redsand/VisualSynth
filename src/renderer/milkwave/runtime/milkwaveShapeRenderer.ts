import type { MilkShapeConfig } from '../../../shared/milkwaveParser';
import {
  buildMilkwaveShapeFan,
  createMilkwaveShapePlan
} from './milkwaveShapes';

interface MilkwaveShapeRuntimeFrameState {
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
}

interface MilkwaveShapeRuntimeMemory {
  initRan: boolean;
  tVars: number[];
  qVars: number[];
}

interface MilkwaveShapeRenderVertex {
  x: number;
  y: number;
  color: { r: number; g: number; b: number; a: number };
}

interface MilkwaveShapeTexturedVertex extends MilkwaveShapeRenderVertex {
  u: number;
  v: number;
}

const SHAPE_VERTEX_SHADER = `#version 300 es
precision highp float;

in vec2 aPosition;
in vec4 aColor;
out vec4 vColor;

void main() {
  vColor = aColor;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const SHAPE_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec4 vColor;
out vec4 fragColor;

void main() {
  fragColor = vColor;
}`;

const TEXTURED_SHAPE_VERTEX_SHADER = `#version 300 es
precision highp float;

in vec2 aPosition;
in vec2 aUv;
in vec4 aColor;
out vec2 vUv;
out vec4 vColor;

void main() {
  vUv = aUv;
  vColor = aColor;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const TEXTURED_SHAPE_FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform sampler2D uMainTexture;
in vec2 vUv;
in vec4 vColor;
out vec4 fragColor;

void main() {
  fragColor = texture(uMainTexture, vUv) * vColor;
}`;

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
    console.error('[MilkwaveShapes] Shader compile error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
};

const createProgram = ({
  gl,
  vertexSource,
  fragmentSource
}: {
  gl: WebGL2RenderingContext;
  vertexSource: string;
  fragmentSource: string;
}): WebGLProgram | null => {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  if (!vs || !fs) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('[MilkwaveShapes] Program link error:', gl.getProgramInfoLog(program));
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
  vertices: MilkwaveShapeRenderVertex[];
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

const createTexturedInterleavedBuffer = ({
  vertices
}: {
  vertices: MilkwaveShapeTexturedVertex[];
}) => {
  const data = new Float32Array(vertices.length * 8);
  vertices.forEach((vertex, index) => {
    const ndc = toNdc(vertex.x, vertex.y);
    const offset = index * 8;
    data[offset] = ndc.x;
    data[offset + 1] = ndc.y;
    data[offset + 2] = vertex.u;
    data[offset + 3] = vertex.v;
    data[offset + 4] = vertex.color.r;
    data[offset + 5] = vertex.color.g;
    data[offset + 6] = vertex.color.b;
    data[offset + 7] = vertex.color.a;
  });
  return data;
};

export interface MilkwaveShapeRenderStats {
  renderedShapes: number;
  renderedBorders: number;
  ignoredTexturedShapes: number;
  evaluatedShapes: number;
  evaluatedPoints: number;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const createBaseShapeContext = ({
  shape,
  runtime,
  instance,
  memory
}: {
  shape: MilkShapeConfig;
  runtime: MilkwaveShapeRuntimeFrameState;
  instance: number;
  memory: MilkwaveShapeRuntimeMemory;
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
    x: shape.x,
    y: shape.y,
    rad: shape.rad,
    ang: shape.ang,
    tex_ang: shape.texAng,
    tex_zoom: shape.texZoom,
    sides: shape.sides,
    textured: shape.textured ? 1 : 0,
    instance,
    num_inst: shape.numInst,
    additive: shape.additive ? 1 : 0,
    thick: shape.thickOutline ? 1 : 0,
    r: shape.r,
    g: shape.g,
    b: shape.b,
    a: shape.a,
    r2: shape.r2,
    g2: shape.g2,
    b2: shape.b2,
    a2: shape.a2,
    border_r: shape.borderR,
    border_g: shape.borderG,
    border_b: shape.borderB,
    border_a: shape.borderA,
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

  for (let i = 0; i < 32; i++) {
    ctx[`q${i + 1}`] = memory.qVars[i] ?? runtime.qVars[i] ?? 0;
  }
  for (let i = 0; i < 8; i++) {
    ctx[`t${i + 1}`] = memory.tVars[i] ?? 0;
  }

  return ctx;
};

const preprocessMilkwaveCode = (lines: string[]) =>
  lines
    .filter((line) => line.trim() && !line.trim().startsWith('//'))
    .map((line) =>
      line
        .trim()
        .replace(/\bif\s*\(\s*([^,]+),\s*([^,]+),\s*([^)]+)\)/g, '(($1) ? ($2) : ($3))')
    )
    .join('\n');

const executeMilkwaveShapeCode = ({
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

const applyShapeContextToConfig = ({
  shape,
  ctx
}: {
  shape: MilkShapeConfig;
  ctx: Record<string, any>;
}): MilkShapeConfig => ({
  ...shape,
  x: clamp01(Number(ctx.x ?? shape.x)),
  y: clamp01(Number(ctx.y ?? shape.y)),
  rad: Math.max(0, Number(ctx.rad ?? shape.rad)),
  ang: Number(ctx.ang ?? shape.ang),
  texAng: Number(ctx.tex_ang ?? shape.texAng),
  texZoom: Math.max(0.0001, Number(ctx.tex_zoom ?? shape.texZoom)),
  sides: Math.max(3, Math.round(Number(ctx.sides ?? shape.sides))),
  textured: Boolean(Number(ctx.textured ?? (shape.textured ? 1 : 0))),
  numInst: Math.max(1, Math.round(Number(ctx.num_inst ?? shape.numInst))),
  additive: Boolean(Number(ctx.additive ?? (shape.additive ? 1 : 0))),
  thickOutline: Boolean(Number(ctx.thick ?? (shape.thickOutline ? 1 : 0))),
  r: clamp01(Number(ctx.r ?? shape.r)),
  g: clamp01(Number(ctx.g ?? shape.g)),
  b: clamp01(Number(ctx.b ?? shape.b)),
  a: clamp01(Number(ctx.a ?? shape.a)),
  r2: clamp01(Number(ctx.r2 ?? shape.r2)),
  g2: clamp01(Number(ctx.g2 ?? shape.g2)),
  b2: clamp01(Number(ctx.b2 ?? shape.b2)),
  a2: clamp01(Number(ctx.a2 ?? shape.a2)),
  borderR: clamp01(Number(ctx.border_r ?? shape.borderR)),
  borderG: clamp01(Number(ctx.border_g ?? shape.borderG)),
  borderB: clamp01(Number(ctx.border_b ?? shape.borderB)),
  borderA: clamp01(Number(ctx.border_a ?? shape.borderA))
});

const evaluatePerPointVertex = ({
  shape,
  runtime,
  memory,
  x,
  y,
  pointIndex,
  pointCount,
  edgeColor
}: {
  shape: MilkShapeConfig;
  runtime: MilkwaveShapeRuntimeFrameState;
  memory: MilkwaveShapeRuntimeMemory;
  x: number;
  y: number;
  pointIndex: number;
  pointCount: number;
  edgeColor: { r: number; g: number; b: number; a: number };
}) => {
  let ctx = createBaseShapeContext({ shape, runtime, instance: 0, memory });
  ctx = {
    ...ctx,
    x,
    y,
    r: edgeColor.r,
    g: edgeColor.g,
    b: edgeColor.b,
    a: edgeColor.a,
    point_idx: pointIndex,
    points: pointCount
  };
  ctx = executeMilkwaveShapeCode({
    lines: shape.perPointCode,
    ctx,
    persistentNames: [
      'x', 'y', 'r', 'g', 'b', 'a',
      ...Array.from({ length: 8 }, (_, i) => `t${i + 1}`),
      ...Array.from({ length: 32 }, (_, i) => `q${i + 1}`)
    ]
  });

  for (let i = 0; i < 8; i++) {
    memory.tVars[i] = Number(ctx[`t${i + 1}`] ?? memory.tVars[i] ?? 0);
  }
  for (let i = 0; i < 32; i++) {
    memory.qVars[i] = Number(ctx[`q${i + 1}`] ?? memory.qVars[i] ?? runtime.qVars[i] ?? 0);
  }

  return {
    x: clamp01(Number(ctx.x ?? x)),
    y: clamp01(Number(ctx.y ?? y)),
    color: {
      r: clamp01(Number(ctx.r ?? edgeColor.r)),
      g: clamp01(Number(ctx.g ?? edgeColor.g)),
      b: clamp01(Number(ctx.b ?? edgeColor.b)),
      a: clamp01(Number(ctx.a ?? edgeColor.a))
    }
  };
};

export const createMilkwaveShapeRenderer = (gl: WebGL2RenderingContext) => {
  const program = createProgram({
    gl,
    vertexSource: SHAPE_VERTEX_SHADER,
    fragmentSource: SHAPE_FRAGMENT_SHADER
  });
  const texturedProgram = createProgram({
    gl,
    vertexSource: TEXTURED_SHAPE_VERTEX_SHADER,
    fragmentSource: TEXTURED_SHAPE_FRAGMENT_SHADER
  });
  const buffer = gl.createBuffer();
  const runtimeMemory = new Map<string, MilkwaveShapeRuntimeMemory>();

  const render = ({
    shapes,
    runtime,
    mainTexture = null
  }: {
    shapes: MilkShapeConfig[] | undefined | null;
    runtime: MilkwaveShapeRuntimeFrameState;
    mainTexture?: WebGLTexture | null;
  }): MilkwaveShapeRenderStats => {
    if (!buffer || !Array.isArray(shapes) || shapes.length === 0) {
      return { renderedShapes: 0, renderedBorders: 0, ignoredTexturedShapes: 0, evaluatedShapes: 0, evaluatedPoints: 0 };
    }

    let renderedShapes = 0;
    let renderedBorders = 0;
    let ignoredTexturedShapes = 0;
    let evaluatedShapes = 0;
    let evaluatedPoints = 0;

    for (const [index, shape] of shapes.entries()) {
      const memoryKey = `shape-${index}`;
      const memory =
        runtimeMemory.get(memoryKey) ??
        {
          initRan: false,
          tVars: new Array(8).fill(0),
          qVars: [...runtime.qVars]
        };
      runtimeMemory.set(memoryKey, memory);

      const instances = Math.max(1, shape.numInst || 1);
      for (let instance = 0; instance < instances; instance++) {
        let ctx = createBaseShapeContext({ shape, runtime, instance, memory });
        if (!memory.initRan && shape.initCode?.length) {
          ctx = executeMilkwaveShapeCode({
            lines: shape.initCode,
            ctx,
            persistentNames: [
              'x', 'y', 'rad', 'ang', 'tex_ang', 'tex_zoom', 'sides',
              'textured', 'num_inst', 'additive', 'thick',
              'r', 'g', 'b', 'a', 'r2', 'g2', 'b2', 'a2',
              'border_r', 'border_g', 'border_b', 'border_a',
              ...Array.from({ length: 8 }, (_, i) => `t${i + 1}`),
              ...Array.from({ length: 32 }, (_, i) => `q${i + 1}`)
            ]
          });
          memory.initRan = true;
        }

        if (shape.perFrameCode?.length) {
          ctx = executeMilkwaveShapeCode({
            lines: shape.perFrameCode,
            ctx,
            persistentNames: [
              'x', 'y', 'rad', 'ang', 'tex_ang', 'tex_zoom', 'sides',
              'textured', 'num_inst', 'additive', 'thick',
              'r', 'g', 'b', 'a', 'r2', 'g2', 'b2', 'a2',
              'border_r', 'border_g', 'border_b', 'border_a',
              ...Array.from({ length: 8 }, (_, i) => `t${i + 1}`),
              ...Array.from({ length: 32 }, (_, i) => `q${i + 1}`)
            ]
          });
        }

        for (let i = 0; i < 8; i++) {
          memory.tVars[i] = Number(ctx[`t${i + 1}`] ?? memory.tVars[i] ?? 0);
        }
        for (let i = 0; i < 32; i++) {
          memory.qVars[i] = Number(ctx[`q${i + 1}`] ?? memory.qVars[i] ?? runtime.qVars[i] ?? 0);
        }

        const evaluatedShape = applyShapeContextToConfig({ shape, ctx });
        const plan = createMilkwaveShapePlan({ index, shape: evaluatedShape });
        if (!plan.enabled || plan.radius <= 0) continue;

        gl.blendFunc(gl.SRC_ALPHA, plan.additive ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
        gl.enable(gl.BLEND);

        const fan = buildMilkwaveShapeFan(plan);
        const fillVerticesInput: MilkwaveShapeRenderVertex[] = [
          {
            x: fan[0].x,
            y: fan[0].y,
            color: plan.fillColor
          }
        ];
        const texturedFillVerticesInput: MilkwaveShapeTexturedVertex[] = [
          {
            x: fan[0].x,
            y: fan[0].y,
            u: fan[0].u,
            v: fan[0].v,
            color: plan.fillColor
          }
        ];
        const borderVerticesInput: MilkwaveShapeRenderVertex[] = [];
        const pointCount = Math.max(0, fan.length - 1);
        for (let i = 1; i < fan.length; i++) {
          const raw = fan[i];
          const evaluated = shape.perPointCode?.length
            ? evaluatePerPointVertex({
                shape: evaluatedShape,
                runtime,
                memory,
                x: raw.x,
                y: raw.y,
                pointIndex: i - 1,
                pointCount,
                edgeColor: plan.edgeColor
              })
            : {
                x: raw.x,
                y: raw.y,
                color: plan.edgeColor
              };
          if (shape.perPointCode?.length) evaluatedPoints++;
          fillVerticesInput.push(evaluated);
          texturedFillVerticesInput.push({
            ...evaluated,
            u: raw.u,
            v: raw.v
          });
          borderVerticesInput.push({
            x: evaluated.x,
            y: evaluated.y,
            color: {
              r: evaluatedShape.borderR,
              g: evaluatedShape.borderG,
              b: evaluatedShape.borderB,
              a: evaluatedShape.borderA
            }
          });
        }

        const canRenderTextured = Boolean(plan.textured && texturedProgram && mainTexture);
        if (canRenderTextured) {
          const posLoc = gl.getAttribLocation(texturedProgram!, 'aPosition');
          const uvLoc = gl.getAttribLocation(texturedProgram!, 'aUv');
          const colorLoc = gl.getAttribLocation(texturedProgram!, 'aColor');
          const samplerLoc = gl.getUniformLocation(texturedProgram!, 'uMainTexture');
          if (posLoc >= 0 && uvLoc >= 0 && colorLoc >= 0) {
            gl.useProgram(texturedProgram!);
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.enableVertexAttribArray(posLoc);
            gl.enableVertexAttribArray(uvLoc);
            gl.enableVertexAttribArray(colorLoc);
            gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 32, 0);
            gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 32, 8);
            gl.vertexAttribPointer(colorLoc, 4, gl.FLOAT, false, 32, 16);
            const fillVertices = createTexturedInterleavedBuffer({
              vertices: texturedFillVerticesInput
            });
            gl.bufferData(gl.ARRAY_BUFFER, fillVertices, gl.DYNAMIC_DRAW);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, mainTexture);
            if (samplerLoc) gl.uniform1i(samplerLoc, 0);
            gl.drawArrays(gl.TRIANGLE_FAN, 0, fillVertices.length / 8);
          } else {
            ignoredTexturedShapes++;
          }
        } else {
          if (plan.textured) ignoredTexturedShapes++;
          if (program) {
            const posLoc = gl.getAttribLocation(program, 'aPosition');
            const colorLoc = gl.getAttribLocation(program, 'aColor');
            if (posLoc >= 0 && colorLoc >= 0) {
              gl.useProgram(program);
              gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
              gl.enableVertexAttribArray(posLoc);
              gl.enableVertexAttribArray(colorLoc);
              gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 24, 0);
              gl.vertexAttribPointer(colorLoc, 4, gl.FLOAT, false, 24, 8);
              const fillVertices = createInterleavedBuffer({
                vertices: fillVerticesInput
              });
              gl.bufferData(gl.ARRAY_BUFFER, fillVertices, gl.DYNAMIC_DRAW);
              gl.drawArrays(gl.TRIANGLE_FAN, 0, fillVertices.length / 6);
            }
          }
        }

        renderedShapes++;
        evaluatedShapes++;

        const borderAlpha = evaluatedShape.borderA ?? 0;
        if (borderAlpha > 0 && program) {
          const posLoc = gl.getAttribLocation(program, 'aPosition');
          const colorLoc = gl.getAttribLocation(program, 'aColor');
          if (posLoc >= 0 && colorLoc >= 0) {
            gl.useProgram(program);
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.enableVertexAttribArray(posLoc);
            gl.enableVertexAttribArray(colorLoc);
            gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 24, 0);
            gl.vertexAttribPointer(colorLoc, 4, gl.FLOAT, false, 24, 8);
            const borderVertices = createInterleavedBuffer({
              vertices: borderVerticesInput
            });
            gl.bufferData(gl.ARRAY_BUFFER, borderVertices, gl.DYNAMIC_DRAW);
            gl.lineWidth(plan.thickOutline ? 2 : 1);
            gl.drawArrays(gl.LINE_STRIP, 0, borderVertices.length / 6);
            renderedBorders++;
          }
        }
      }
    }

    return { renderedShapes, renderedBorders, ignoredTexturedShapes, evaluatedShapes, evaluatedPoints };
  };

  const clear = () => {
    if (program) gl.deleteProgram(program);
    if (texturedProgram) gl.deleteProgram(texturedProgram);
    if (buffer) gl.deleteBuffer(buffer);
    runtimeMemory.clear();
  };

  return { render, clear };
};
