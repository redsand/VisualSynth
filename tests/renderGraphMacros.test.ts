import { describe, expect, it } from 'vitest';
import { RenderGraph } from '../src/renderer/render/RenderGraph';
import { createStore, createInitialState } from '../src/renderer/state/store';

describe('render graph macros', () => {
  it('applies structured macro targets to layer params', () => {
    const state = createInitialState();
    const plasmaLayer = state.project.scenes[0].layers.find((layer) => layer.id === 'layer-plasma');
    if (plasmaLayer) {
      plasmaLayer.params = { ...(plasmaLayer.params ?? {}), scale: 1.0 };
    }
    state.project.macros = [
      {
        id: 'macro-1',
        name: 'Macro 1',
        value: 1.0,
        targets: [{ target: { type: 'plasma', param: 'scale' }, amount: 0.5 }]
      }
    ];
    const store = createStore(state);
    const renderGraph = new RenderGraph(store);
    const renderState = renderGraph.buildRenderState(0, 16, { width: 800, height: 600 });
    expect(renderState.plasmaScale).toBeCloseTo(1.5, 4);
  });
});
