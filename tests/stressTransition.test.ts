import { describe, expect, it, vi } from 'vitest';
import { RenderGraph } from '../src/renderer/render/RenderGraph';
import { createStore, createInitialState } from '../src/renderer/state/store';
import { DEFAULT_PROJECT, SceneConfig } from '../src/shared/project';
import { createGLRenderer } from '../src/renderer/glRenderer';
import { createTransitionTracer } from '../src/renderer/render/transitionTracer';

describe('Stress Test: Scene Transitions', () => {
  it('should handle 100 scene transitions without crashing or leaking excessively', async () => {
    const store = createStore(createInitialState());
    const renderGraph = new RenderGraph(store);
    
    const createTestScene = (id: string): SceneConfig => ({
      id,
      name: `Scene ${id}`,
      layers: [
        {
          id: 'layer-plasma',
          name: 'Plasma',
          enabled: true,
          opacity: 1,
          blendMode: 'normal',
          role: 'core',
          transform: { x: 0, y: 0, scale: 1, rotation: 0 }
        }
      ]
    });

    const project = {
      ...DEFAULT_PROJECT,
      scenes: [createTestScene('scene-1'), createTestScene('scene-2')],
      activeSceneId: 'scene-1'
    };

    store.update((state) => {
      state.project = project;
    });

    const iterations = 100;
    console.log(`Starting stress test with ${iterations} transitions...`);

    for (let i = 0; i < iterations; i++) {
      const nextSceneId = i % 2 === 0 ? 'scene-2' : 'scene-1';
      
      // Simulate scene transition
      store.update((state) => {
        state.project.activeSceneId = nextSceneId;
      });

      // Trigger RenderGraph disposal/rebuild logic
      // In a real app, Renderer.ts calls renderGraph.dispose() then rebuilds
      renderGraph.dispose();
      
      // Build render state to simulate a frame
      const renderState = renderGraph.buildRenderState(i * 1000, 16, { width: 1280, height: 720 });
      expect(renderState).toBeDefined();

      if (i % 10 === 0) {
        const stats = renderGraph.getDebugStats();
        console.log(`Iteration ${i}: ${stats.activeTextures} textures, ${stats.activeFramebuffers} FBOs`);
      }
    }

    const finalStats = renderGraph.getDebugStats();
    console.log(`Final Stats: ${finalStats.activeTextures} textures, ${finalStats.activeFramebuffers} FBOs`);
    
    // We expect texture/FBO counts to stay stable after the first few iterations
    expect(finalStats.activeTextures).toBeLessThan(50); 
    expect(finalStats.activeFramebuffers).toBeLessThan(20);
  });
});

describe('setCustomShaderBlocks: cache preservation regression', () => {
  const createMockGl = () => {
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
      getExtension: vi.fn(() => null),
      createTexture: () => ({}),
      bindTexture: () => {},
      texParameteri: () => {},
      createShader: (type: number) => ({ type, source: '' }),
      shaderSource: (shader: { source: string }, source: string) => { shader.source = source; },
      compileShader: () => {},
      getShaderParameter: () => true,
      getShaderInfoLog: () => '',
      deleteShader: () => {},
      createProgram: vi.fn(() => ({ id: Math.random() })),
      attachShader: () => {},
      linkProgram: vi.fn(),
      getProgramParameter: vi.fn(() => true),
      getProgramInfoLog: () => '',
      deleteProgram: vi.fn(),
      detachShader: () => {},
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
      readPixels: () => {},
    };
    const canvas = {
      getContext: (kind: string) => (kind === 'webgl2' ? gl : null),
      addEventListener: () => {},
      clientWidth: 640,
      clientHeight: 360,
      width: 640,
      height: 360,
    } as unknown as HTMLCanvasElement;
    return { gl, canvas };
  };

  it('does NOT clear the program cache when setCustomShaderBlocks is called with the same blocks', () => {
    const { gl, canvas } = createMockGl();
    const renderer = createGLRenderer(canvas);

    const blocks = [{ id: 'block-1', uniforms: 'uniform float uTest;', functions: '', mainCall: '' }] as any[];

    renderer.setCustomShaderBlocks(blocks);
    const createProgramCallsAfterFirstSet = (gl.createProgram as ReturnType<typeof vi.fn>).mock.calls.length;

    renderer.recompileForGenerators(new Set(['gen-plasma']), blocks, true);
    const createProgramCallsAfterCompile = (gl.createProgram as ReturnType<typeof vi.fn>).mock.calls.length;

    const deleteProgramCallsBefore = (gl.deleteProgram as ReturnType<typeof vi.fn>).mock.calls.length;

    renderer.setCustomShaderBlocks(blocks);

    const deleteProgramCallsAfter = (gl.deleteProgram as ReturnType<typeof vi.fn>).mock.calls.length;

    expect(deleteProgramCallsAfter).toBe(deleteProgramCallsBefore);
    expect(createProgramCallsAfterCompile).toBeGreaterThanOrEqual(createProgramCallsAfterFirstSet);
  });

  it('DOES clear the program cache when setCustomShaderBlocks is called with different blocks', () => {
    const { gl, canvas } = createMockGl();
    const renderer = createGLRenderer(canvas);

    const blocks1 = [{ id: 'block-1', uniforms: 'uniform float uTest;', functions: '', mainCall: '' }] as any[];
    const blocks2 = [{ id: 'block-2', uniforms: 'uniform float uTest2;', functions: '', mainCall: '' }] as any[];

    renderer.setCustomShaderBlocks(blocks1);
    renderer.recompileForGenerators(new Set(['gen-plasma']), blocks1, true);

    const deleteProgramCallsBefore = (gl.deleteProgram as ReturnType<typeof vi.fn>).mock.calls.length;

    renderer.setCustomShaderBlocks(blocks2);

    const deleteProgramCallsAfter = (gl.deleteProgram as ReturnType<typeof vi.fn>).mock.calls.length;

    expect(deleteProgramCallsAfter).toBeGreaterThan(deleteProgramCallsBefore);
  });
});

describe('TransitionTracer: intermittent black regression harness', () => {
  it('detects when multiple scene cycles produce black output', () => {
    const tracer = createTransitionTracer(50);
    const scenes = [
      { id: 'scene-a', name: 'Scene A', gens: ['gen-plasma'] },
      { id: 'scene-b', name: 'Scene B', gens: ['gen-lightning'] },
      { id: 'scene-c', name: 'Scene C', gens: ['gen-plasma', 'gen-lightning'] }
    ];

    for (let cycle = 0; cycle < 3; cycle++) {
      for (let i = 0; i < scenes.length; i++) {
        const from = scenes[(i + scenes.length - 1) % scenes.length];
        const to = scenes[i];
        const seq = tracer.beginTransition({
          prevSceneId: from.id,
          prevSceneName: from.name,
          nextSceneId: to.id,
          nextSceneName: to.name,
          source: 'slideshow'
        });
        tracer.recordStep(seq, 'sceneStateSwapped');
        tracer.recordStep(seq, 'generatorInitStarted');

        const blackCycle = cycle === 1 && i === 1;
        for (let frame = 0; frame < 5; frame++) {
          const brightness = blackCycle ? 0.0 : 0.3 + Math.random() * 0.3;
          tracer.recordFrameSample(seq, {
            drawCallCount: 1,
            avgBrightness: brightness,
            nonBlackRatio: brightness > 0.02 ? 0.7 : 0,
            activeGenerators: to.gens,
            activeFx: []
          });
        }
      }
    }

    const dump = tracer.getDump();
    expect(dump.totalTransitions).toBe(9);
    expect(dump.flaggedBlackCount).toBeGreaterThan(0);
    expect(dump.lastBlackTransitionSeq).not.toBeNull();

    const blackTransitions = dump.recentTransitions.filter(t => t.flaggedBlack);
    expect(blackTransitions[0].nextSceneId).toBe('scene-b');
    expect(blackTransitions[0].source).toBe('slideshow');
  });
});
