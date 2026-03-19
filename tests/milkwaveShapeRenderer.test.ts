import { describe, expect, it } from 'vitest';
import { createMilkwaveShapeRenderer } from '../src/renderer/milkwave/runtime/milkwaveShapeRenderer';

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
    TEXTURE0: 0x84c0,
    TEXTURE_2D: 0x0de1,
    TRIANGLE_FAN: 0x0006,
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
    getAttribLocation: (_program: unknown, name: string) => (name === 'aPosition' ? 0 : name === 'aUv' ? 1 : 2),
    getUniformLocation: () => ({}),
    useProgram: () => {},
    bindBuffer: () => {},
    enableVertexAttribArray: () => {},
    vertexAttribPointer: () => {},
    enable: () => {},
    activeTexture: () => {},
    bindTexture: () => {},
    uniform1i: () => {},
    blendFunc: () => {},
    bufferData: () => {},
    lineWidth: () => {},
    drawArrays: (mode: number, _first: number, count: number) => drawCalls.push({ mode, count })
  };
  return { gl: gl as unknown as WebGL2RenderingContext, drawCalls };
};

describe('Milkwave shape renderer', () => {
  it('renders fill and border geometry for enabled shapes', () => {
    const { gl, drawCalls } = createMockWebGl();
    const renderer = createMilkwaveShapeRenderer(gl);

    const stats = renderer.render({
      shapes: [
        {
          enabled: true,
          sides: 4,
          additive: false,
          thickOutline: true,
          textured: true,
          numInst: 1,
          x: 0.5,
          y: 0.5,
          rad: 0.25,
          ang: 0,
          texAng: 0,
          texZoom: 1,
          r: 1,
          g: 0.5,
          b: 0.25,
          a: 1,
          r2: 0.5,
          g2: 0.4,
          b2: 0.3,
          a2: 1,
          borderR: 1,
          borderG: 1,
          borderB: 1,
          borderA: 1,
          initCode: [],
          perFrameCode: [],
          perPointCode: []
        }
      ],
      runtime: {
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
        qVars: new Array(32).fill(0)
      },
      mainTexture: {} as WebGLTexture
    });

    expect(stats.renderedShapes).toBe(1);
    expect(stats.renderedBorders).toBe(1);
    expect(stats.ignoredTexturedShapes).toBe(0);
    expect(stats.evaluatedShapes).toBe(1);
    expect(stats.evaluatedPoints).toBe(0);
    expect(drawCalls.some((call) => call.mode === gl.TRIANGLE_FAN)).toBe(true);
    expect(drawCalls.some((call) => call.mode === gl.LINE_STRIP)).toBe(true);
  });

  it('runs init once and per-frame code on each render', () => {
    const { gl } = createMockWebGl();
    const renderer = createMilkwaveShapeRenderer(gl);

    const shape = {
      enabled: true,
      sides: 3,
      additive: false,
      thickOutline: false,
      textured: false,
      numInst: 1,
      x: 0.2,
      y: 0.2,
      rad: 0.1,
      ang: 0,
      texAng: 0,
      texZoom: 1,
      r: 1,
      g: 1,
      b: 1,
      a: 1,
      r2: 1,
      g2: 1,
      b2: 1,
      a2: 1,
      borderR: 0,
      borderG: 0,
      borderB: 0,
      borderA: 0,
      initCode: ['t1 = 0.15;', 'rad = rad + t1;'],
      perFrameCode: ['ang = ang + 0.1 + t1;', 'x = x + 0.05;'],
      perPointCode: []
    };

    const first = renderer.render({
      shapes: [shape],
      runtime: {
        timeSeconds: 1,
        frame: 1,
        fps: 60,
        progress: 0.1,
        bass: 0,
        mid: 0,
        treb: 0,
        bassAtt: 0,
        midAtt: 0,
        trebAtt: 0,
        qVars: new Array(32).fill(0)
      }
    });
    const second = renderer.render({
      shapes: [shape],
      runtime: {
        timeSeconds: 2,
        frame: 2,
        fps: 60,
        progress: 0.2,
        bass: 0,
        mid: 0,
        treb: 0,
        bassAtt: 0,
        midAtt: 0,
        trebAtt: 0,
        qVars: new Array(32).fill(0)
      }
    });

    expect(first.evaluatedShapes).toBe(1);
    expect(second.evaluatedShapes).toBe(1);
    expect(first.evaluatedPoints).toBe(0);
    expect(second.evaluatedPoints).toBe(0);
  });

  it('evaluates shape per-point code across the perimeter vertices', () => {
    const { gl } = createMockWebGl();
    const renderer = createMilkwaveShapeRenderer(gl);

    const result = renderer.render({
      shapes: [
        {
          enabled: true,
          sides: 3,
          additive: false,
          thickOutline: false,
          textured: false,
          numInst: 1,
          x: 0.5,
          y: 0.5,
          rad: 0.2,
          ang: 0,
          texAng: 0,
          texZoom: 1,
          r: 1,
          g: 1,
          b: 1,
          a: 1,
          r2: 0.5,
          g2: 0.5,
          b2: 0.5,
          a2: 1,
          borderR: 1,
          borderG: 1,
          borderB: 1,
          borderA: 0,
          initCode: [],
          perFrameCode: [],
          perPointCode: ['x = x + 0.01;', 'r = 0.2 + point_idx * 0.1;']
        }
      ],
      runtime: {
        timeSeconds: 0,
        frame: 0,
        fps: 60,
        progress: 0,
        bass: 0,
        mid: 0,
        treb: 0,
        bassAtt: 0,
        midAtt: 0,
        trebAtt: 0,
        qVars: new Array(32).fill(0)
      }
    });

    expect(result.renderedShapes).toBe(1);
    expect(result.evaluatedPoints).toBe(4);
  });
});
