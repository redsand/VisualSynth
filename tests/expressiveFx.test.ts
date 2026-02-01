import { describe, it, expect, beforeEach } from 'vitest';
import { RenderGraph } from '../src/renderer/render/RenderGraph';
import { createInitialState, createStore } from '../src/renderer/state/store';

describe('Expressive FX', () => {
  let store: ReturnType<typeof createStore>;
  let renderGraph: RenderGraph;

  beforeEach(() => {
    store = createStore(createInitialState());
    renderGraph = new RenderGraph(store);
  });

  it('applies intent binding to radial gravity macro', () => {
    store.update((state: any) => {
      const scene = state.project.scenes[0];
      scene.intent = 'build';
      state.project.expressiveFx.radialGravity = {
        enabled: true,
        macro: 0.4,
        intentBinding: { enabled: true, intent: 'build', amount: 0.35 },
        expert: { strength: 0.7, radius: 0.5, focusX: 0.25, focusY: 0.75 }
      };
    });

    const renderState = renderGraph.buildRenderState(0, 16, { width: 800, height: 600 });
    expect(renderState.expressiveRadialGravity).toBeCloseTo(0.75, 5);
    expect(renderState.expressiveRadialStrength).toBeCloseTo(0.7, 5);
    expect(renderState.expressiveRadialRadius).toBeCloseTo(0.5, 5);
    expect(renderState.expressiveRadialFocusX).toBeCloseTo(0.25, 5);
    expect(renderState.expressiveRadialFocusY).toBeCloseTo(0.75, 5);
  });

  it('clamps intent binding to 1.0 and disables when off', () => {
    store.update((state: any) => {
      const scene = state.project.scenes[0];
      scene.intent = 'chaos';
      state.project.expressiveFx.radialGravity = {
        enabled: true,
        macro: 0.9,
        intentBinding: { enabled: true, intent: 'chaos', amount: 0.6 },
        expert: { strength: 0.4, radius: 0.6, focusX: 0.5, focusY: 0.5 }
      };
    });

    const renderState = renderGraph.buildRenderState(0, 16, { width: 800, height: 600 });
    expect(renderState.expressiveRadialGravity).toBe(1);

    store.update((state: any) => {
      state.project.expressiveFx.radialGravity.enabled = false;
    });
    const disabledState = renderGraph.buildRenderState(0, 16, { width: 800, height: 600 });
    expect(disabledState.expressiveRadialGravity).toBe(0);
  });
});
