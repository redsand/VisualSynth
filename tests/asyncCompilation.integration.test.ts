import { describe, expect, it, vi } from 'vitest';
import { createGLRenderer } from '../src/renderer/glRenderer';

const createMockGlWithParallel = () => {
  const fragmentSources: string[] = [];
  let compileStatus = true;
  let completionStatus = false;
  let linkStatus = true;

  const gl = {
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
    COLOR_BUFFER_BIT: 0x4000,
    getExtension: vi.fn((name: string) => {
      if (name === 'KHR_parallel_shader_compile') {
        return { COMPLETION_STATUS_KHR: 0x91b1 };
      }
      return null;
    }),
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
    getShaderParameter: () => compileStatus,
    getShaderInfoLog: () => '',
    deleteShader: () => {},
    createProgram: vi.fn(() => ({ attached: [] as unknown[], id: Math.random() })),
    attachShader: (program: { attached: unknown[] }, shader: unknown) => {
      program.attached.push(shader);
    },
    linkProgram: vi.fn(),
    getProgramParameter: vi.fn((program, pname) => {
      if (pname === 0x91b1) return completionStatus; // COMPLETION_STATUS_KHR
      if (pname === gl.LINK_STATUS) return linkStatus;
      return true;
    }),
    getProgramInfoLog: () => '',
    deleteProgram: vi.fn(),
    createBuffer: () => ({}),
    bindBuffer: () => {},
    bufferData: () => {},
    texImage2D: () => {},
    texSubImage2D: () => {},
    clearColor: () => {},
    viewport: () => {},
    clear: () => {},
    useProgram: vi.fn(),
    getActiveUniform: () => ({ name: 'test', size: 1, type: 0 }),
    getUniformLocation: () => ({}),
    uniform1f: () => {},
    uniform1i: () => {},
    uniform2f: () => {},
    uniform3f: () => {},
    uniform4f: () => {},
    uniform1fv: () => {},
    uniform2fv: () => {},
    uniform3fv: () => {},
    uniform4fv: () => {},
    uniformMatrix3fv: () => {},
    uniformMatrix4fv: () => {},
    activeTexture: () => {},
    getAttribLocation: () => 0,
    enableVertexAttribArray: () => {},
    vertexAttribPointer: () => {},
    drawArrays: () => {},
    copyTexSubImage2D: () => {},
    // GL state methods the renderer touches during program (re)link and draw.
    // detachShader in particular is called on every recompile; without it the
    // mock threw "gl.detachShader is not a function" and the test couldn't
    // exercise the async-compile path it exists to check.
    detachShader: () => {},
    disable: () => {},
    enable: () => {},
    isEnabled: () => false,
    getParameter: () => 0,
    disableVertexAttribArray: () => {},
    BLEND: 0x0be2,
  };

  return { 
    gl, 
    fragmentSources,
    setCompletionStatus: (status: boolean) => { completionStatus = status; },
    setLinkStatus: (status: boolean) => { linkStatus = status; }
  };
};

describe('glRenderer Async Compilation', () => {
  it('does not block or swap program immediately on recompile when using KHR_parallel_shader_compile', () => {
    const { gl, setCompletionStatus, setLinkStatus } = createMockGlWithParallel();
    const canvas = {
      getContext: (kind: string) => (kind === 'webgl2' ? gl : null),
      addEventListener: () => {},
      clientWidth: 640,
      clientHeight: 360,
      width: 640,
      height: 360,
    } as unknown as HTMLCanvasElement;

    const renderer = createGLRenderer(canvas);
    
    // Clear the initial mock calls from startup
    gl.getProgramParameter.mockClear();
    gl.createProgram.mockClear();
    gl.linkProgram.mockClear();

    // Simulate an uncached scene compilation request
    const ids = new Set(['gen-async-test']);
    const startTime = performance.now();
    
    // We expect this to return 'true' but *defer* the link check.
    const success = renderer.recompileForGenerators(ids, []);
    
    const elapsed = performance.now() - startTime;
    
    expect(success).toBe(true);
    expect(elapsed).toBeLessThan(10); // Should be very fast (under 10ms), not blocking for 100ms+
    
    // Verify a new program was created and linked
    expect(gl.createProgram).toHaveBeenCalled();
    expect(gl.linkProgram).toHaveBeenCalled();

    // The program parameter should NOT have been queried for LINK_STATUS yet because it's async!
    // We check COMPLETION_STATUS in render() but recompileForGenerators doesn't check LINK_STATUS.
    expect(gl.getProgramParameter).not.toHaveBeenCalledWith(expect.anything(), gl.LINK_STATUS);

    // Provide a safe mock render state
    const mockState = {
      timeMs: 0,
      aspect: 1.77,
      resolution: [640, 360],
      rms: 0,
      peak: 0,
      strobe: 0,
      oscilloData: new Float32Array(256),
      spectrum: new Float32Array(64),
      trailSpectrum: new Float32Array(64),
      modulatorValues: new Float32Array(16),
      midiHistory: new Float32Array(128 * 4),
      sdfScene: null,
      palette: [[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0]],
      globalColor: [1,1,1],
      roleWeights: { core: 1, support: 1, atmosphere: 1 },
      gravityPositions: new Float32Array(16),
      gravityStrengths: new Float32Array(8),
      gravityPolarities: new Float32Array(8),
      gravityActives: new Float32Array(8),
      portalPositions: new Float32Array(16),
      portalRadii: new Float32Array(8),
      portalActives: new Float32Array(8)
    } as any;

    // Now call render().
    setCompletionStatus(false);
    renderer.render(mockState);

    // It should check COMPLETION_STATUS, get false, and NOT swap programs
    expect(gl.getProgramParameter).toHaveBeenCalledWith(expect.anything(), 0x91b1);
    expect(gl.getProgramParameter).not.toHaveBeenCalledWith(expect.anything(), gl.LINK_STATUS);

    // Next frame, simulate completion
    setCompletionStatus(true);
    setLinkStatus(true);
    
    renderer.render(mockState);

    // Now it should check LINK_STATUS because it completed
    expect(gl.getProgramParameter).toHaveBeenCalledWith(expect.anything(), gl.LINK_STATUS);
  });
});