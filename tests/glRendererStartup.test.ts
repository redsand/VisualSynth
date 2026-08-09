import { describe, expect, it } from 'vitest';
import { createGLRenderer } from '../src/renderer/glRenderer';

const createMockGl = () => {
  const fragmentSources: string[] = [];

  const gl = {
    getExtension: () => null,
    VERTEX_SHADER: 0x8b31,
    FRAGMENT_SHADER: 0x8b30,
    COMPILE_STATUS: 0x8b81,
    LINK_STATUS: 0x8b82,
    ARRAY_BUFFER: 0x8892,
    STATIC_DRAW: 0x88e4,
    TEXTURE_2D: 0x0de1,
    TEXTURE_MIN_FILTER: 0x2801,
    TEXTURE_MAG_FILTER: 0x2800,
    TEXTURE_WRAP_S: 0x2802,
    TEXTURE_WRAP_T: 0x2803,
    LINEAR: 0x2601,
    CLAMP_TO_EDGE: 0x812f,
    createTexture: () => ({}),
    bindTexture: () => {},
    texParameteri: () => {},
    createShader: (type: number) => ({ type, source: '' }),
    shaderSource: (shader: { type: number; source: string }, source: string) => {
      shader.source = source;
      if (shader.type === gl.FRAGMENT_SHADER) {
        fragmentSources.push(source);
      }
    },
    compileShader: () => {},
    getShaderParameter: () => true,
    getShaderInfoLog: () => '',
    deleteShader: () => {},
    createProgram: () => ({ attached: [] as unknown[] }),
    attachShader: (program: { attached: unknown[] }, shader: unknown) => {
      program.attached.push(shader);
    },
    // The renderer detaches previously-attached shaders when it (re)links a
    // program during startup/compile, and touches a few GL state queries.
    // Without these stubs the mock throws "gl.detachShader is not a function"
    // before the startup path can produce its minimal shader.
    detachShader: () => {},
    disable: () => {},
    enable: () => {},
    isEnabled: () => false,
    getParameter: () => 0,
    disableVertexAttribArray: () => {},
    BLEND: 0x0be2,
    linkProgram: () => {},
    getProgramParameter: () => true,
    getProgramInfoLog: () => '',
    deleteProgram: () => {},
    createBuffer: () => ({}),
    bindBuffer: () => {},
    bufferData: () => {},
  };

  return { gl, fragmentSources };
};

describe('createGLRenderer startup compilation', () => {
  it('initializes with a minimal fragment shader instead of compiling the full generator registry', () => {
    const { gl, fragmentSources } = createMockGl();
    const canvas = {
      getContext: (kind: string) => (kind === 'webgl2' ? gl : null),
      addEventListener: () => {},
      clientWidth: 640,
      clientHeight: 360,
      width: 640,
      height: 360,
    } as unknown as HTMLCanvasElement;

    const renderer = createGLRenderer(canvas);

    expect(renderer).toBeTruthy();
    expect(fragmentSources.length).toBeGreaterThan(0);

    const startupFragment = fragmentSources[0];
    expect(startupFragment).toContain('#version 300 es');
    expect(startupFragment).not.toContain('uPlasmaEnabled');
    expect(startupFragment).not.toContain('lightningBolt(');
  });
});
