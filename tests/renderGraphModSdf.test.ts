
import { describe, it, expect, beforeEach } from 'vitest';
import { RenderGraph } from '../src/renderer/render/RenderGraph';
import { createStore, createInitialState } from '../src/renderer/state/store';
import { DEFAULT_PROJECT } from '../src/shared/project';

describe('RenderGraph SDF Modulation', () => {
  let store: any;
  let renderGraph: RenderGraph;

  beforeEach(() => {
    store = createStore(createInitialState());
    renderGraph = new RenderGraph(store);
  });

  it('should modulate SDF node parameters', () => {
    const project = {
      ...DEFAULT_PROJECT,
      activeSceneId: 'scene-1',
      scenes: [
        {
          id: 'scene-1',
          name: 'SDF Scene',
          layers: [
            {
              id: 'gen-sdf-scene',
              name: 'Advanced SDF',
              enabled: true,
              opacity: 1,
              blendMode: 'normal' as const,
              transform: { x: 0, y: 0, scale: 1, rotation: 0 },
              sdfScene: {
                nodes: [
                  {
                    instanceId: 'test-node',
                    nodeId: 'circle',
                    params: { radius: 0.5 },
                    enabled: true,
                    order: 0
                  }
                ],
                connections: [],
                mode: '2d'
              }
            }
          ]
        }
      ],
      modMatrix: [
        {
          id: 'mod-1',
          source: 'macro-1',
          target: 'test-node.radius',
          amount: 0.5,
          min: 0,
          max: 1,
          curve: 'linear' as const,
          smoothing: 0,
          bipolar: false
        }
      ],
      macros: [
        { id: 'macro-1', name: 'Radius Mod', value: 1.0, targets: [] }
      ]
    };

    // Update store state manually for test
    store.update((state: any) => {
      state.project = project;
    });

    const renderState = renderGraph.buildRenderState(0, 16, { width: 800, height: 600 });
    
    expect(renderState.sdfScene).toBeDefined();
    const testNode = renderState.sdfScene.nodes.find((n: any) => n.instanceId === 'test-node');
    
    // Original radius was 0.5. Macro value is 1.0. Mod amount is 0.5.
    // Result should be 0.5 + (1.0 * 0.5) = 1.0
    expect(testNode.params.radius).toBeCloseTo(1.0);
  });
});
