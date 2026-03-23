import { describe, expect, it, vi } from 'vitest';
import { RenderGraph } from '../src/renderer/render/RenderGraph';
import { createStore, createInitialState } from '../src/renderer/state/store';
import { DEFAULT_PROJECT, SceneConfig } from '../src/shared/project';

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
