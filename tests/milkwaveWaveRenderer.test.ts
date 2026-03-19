import { describe, expect, it } from 'vitest';
import { createMilkwaveWaveRenderer } from '../src/renderer/milkwave/runtime/milkwaveWaveRenderer';

const createMockWebGl = () => {
  const drawCalls: Array<{ mode: number; count: number }> = [];
  const gl = {
    VERTEX_SHADER: 0x8b31,
    FRAGMENT_SHADER: 0x8b30,
    COMPILE_STATUS: 0x8b81,
    LINK_STATUS: 0x8b82,
    ARRAY_BUFFER: 0x8892,
    DYNAMIC_DRAW: 0x88e8,
    FLOAT: 0x1406,
    BLEND: 0x0be2,
    SRC_ALPHA: 0x0302,
    ONE: 1,
    ONE_MINUS_SRC_ALPHA: 0x0303,
    POINTS: 0x0000,
    LINE_STRIP: 0x0003,
    createShader: () => ({}),
    shaderSource: () => {},
    compileShader: () => {},
    getShaderParameter: () => true,
    getShaderInfoLog: () => '',
    deleteShader: () => {},
    createProgram: () => ({}),
    attachShader: () => {},
    linkProgram: () => {},
    getProgramParameter: () => true,
    getProgramInfoLog: () => '',
    deleteProgram: () => {},
    createBuffer: () => ({}),
    deleteBuffer: () => {},
    getAttribLocation: (_program: unknown, name: string) => (name === 'aPosition' ? 0 : 1),
    useProgram: () => {},
    bindBuffer: () => {},
    enableVertexAttribArray: () => {},
    vertexAttribPointer: () => {},
    enable: () => {},
    blendFunc: () => {},
    bufferData: () => {},
    lineWidth: () => {},
    drawArrays: (mode: number, _first: number, count: number) => drawCalls.push({ mode, count })
  };
  return { gl: gl as unknown as WebGL2RenderingContext, drawCalls };
};

const baseRuntime = () => ({
  timeSeconds: 1,
  frame: 2,
  fps: 60,
  progress: 0.25,
  bass: 0.2,
  mid: 0.3,
  treb: 0.4,
  bassAtt: 0.25,
  midAtt: 0.35,
  trebAtt: 0.45,
  qVars: new Array(32).fill(0),
  waveform: Float32Array.from({ length: 256 }, (_, i) => Math.sin((i / 255) * Math.PI * 2)),
  spectrum: Float32Array.from({ length: 64 }, (_, i) => i / 64)
});

describe('Milkwave wave renderer', () => {
  it('renders enabled waves as line strips by default', () => {
    const { gl, drawCalls } = createMockWebGl();
    const renderer = createMilkwaveWaveRenderer(gl);

    const stats = renderer.render({
      waves: [
        {
          enabled: true,
          samples: 32,
          sep: 0,
          scaling: 1,
          smoothing: 0,
          bSpectrum: false,
          bUseDots: false,
          bDrawThick: true,
          bAdditive: false,
          r: 1,
          g: 0.5,
          b: 0.25,
          a: 0.75,
          initCode: [],
          perFrameCode: [],
          perPointCode: []
        }
      ],
      runtime: baseRuntime()
    });

    expect(stats.renderedWaves).toBe(1);
    expect(stats.renderedPoints).toBe(32);
    expect(stats.evaluatedPoints).toBe(0);
    expect(drawCalls.some((call) => call.mode === gl.LINE_STRIP)).toBe(true);
  });

  it('runs wave init once and per-frame code on every render', () => {
    const { gl } = createMockWebGl();
    const renderer = createMilkwaveWaveRenderer(gl);

    const wave = {
      enabled: true,
      samples: 16,
      sep: 0,
      scaling: 1,
      smoothing: 0,
      bSpectrum: false,
      bUseDots: false,
      bDrawThick: false,
      bAdditive: false,
      r: 1,
      g: 1,
      b: 1,
      a: 1,
      initCode: ['t1 = 0.2;', 'samples = samples + 4;'],
      perFrameCode: ['a = a - 0.1;', 'r = 0.5 + t1;'],
      perPointCode: []
    };

    const first = renderer.render({
      waves: [wave],
      runtime: baseRuntime()
    });
    const second = renderer.render({
      waves: [wave],
      runtime: {
        ...baseRuntime(),
        timeSeconds: 2,
        frame: 3
      }
    });

    expect(first.renderedWaves).toBe(1);
    expect(second.renderedWaves).toBe(1);
    expect(first.renderedPoints).toBe(20);
    expect(second.renderedPoints).toBe(20);
  });

  it('evaluates wave per-point code and can switch to point rendering', () => {
    const { gl, drawCalls } = createMockWebGl();
    const renderer = createMilkwaveWaveRenderer(gl);

    const result = renderer.render({
      waves: [
        {
          enabled: true,
          samples: 24,
          sep: 0,
          scaling: 1,
          smoothing: 0,
          bSpectrum: true,
          bUseDots: true,
          bDrawThick: false,
          bAdditive: true,
          r: 1,
          g: 1,
          b: 1,
          a: 1,
          initCode: [],
          perFrameCode: [],
          perPointCode: ['x = sample;', 'y = 0.25 + value1;', 'a = 0.5;']
        }
      ],
      runtime: baseRuntime()
    });

    expect(result.renderedWaves).toBe(1);
    expect(result.renderedPoints).toBe(24);
    expect(result.evaluatedPoints).toBe(24);
    expect(drawCalls.some((call) => call.mode === gl.POINTS)).toBe(true);
  });
});
