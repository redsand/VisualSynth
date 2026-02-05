import { describe, expect, it } from 'vitest';
import { RenderGraph } from '../src/renderer/render/RenderGraph';
import { createStore, createInitialState } from '../src/renderer/state/store';
import { DEFAULT_PROJECT } from '../src/shared/project';

const buildProjectWithGenerator = (generatorId: string, params: any = {}) => {
  const project = JSON.parse(JSON.stringify(DEFAULT_PROJECT));
  project.activeSceneId = 'scene-1';
  const scene = project.scenes[0];
  scene.layers = [
    {
      id: 'layer-test-1',
      name: 'Test Generator',
      role: 'core',
      enabled: true,
      opacity: 1,
      blendMode: 'screen',
      transform: { x: 0, y: 0, scale: 1, rotation: 0 },
      generatorId,
      params
    }
  ];
  return project;
};

describe('New Visual Generators (Rock & Tunnel Suite)', () => {
  it('correctly maps gen-lightning parameters', () => {
    const store = createStore(createInitialState());
    const renderGraph = new RenderGraph(store);
    const project = buildProjectWithGenerator('gen-lightning', {
      speed: 2.5,
      branches: 4,
      thickness: 0.05,
      color: 1
    });
    store.update((state: any) => { state.project = project; });

    const renderState = renderGraph.buildRenderState(0, 16, { width: 800, height: 600 });
    expect(renderState.lightningEnabled).toBe(true);
    expect(renderState.lightningSpeed).toBe(2.5);
    expect(renderState.lightningBranches).toBe(4);
    expect(renderState.lightningThickness).toBe(0.05);
    expect(renderState.lightningColor).toBe(1);
  });

  it('correctly maps gen-analog-oscillo parameters', () => {
    const store = createStore(createInitialState());
    const renderGraph = new RenderGraph(store);
    const project = buildProjectWithGenerator('gen-analog-oscillo', {
      thickness: 0.02,
      glow: 0.8,
      color: 2
    });
    store.update((state: any) => { state.project = project; });

    const renderState = renderGraph.buildRenderState(0, 16, { width: 800, height: 600 });
    expect(renderState.analogOscilloEnabled).toBe(true);
    expect(renderState.analogOscilloThickness).toBe(0.02);
    expect(renderState.analogOscilloGlow).toBe(0.8);
    expect(renderState.analogOscilloColor).toBe(2);
  });

  it('correctly maps gen-infinite-wormhole parameters', () => {
    const store = createStore(createInitialState());
    const renderGraph = new RenderGraph(store);
    const project = buildProjectWithGenerator('gen-infinite-wormhole', {
      speed: 1.5,
      weave: 0.6,
      iter: 5
    });
    store.update((state: any) => { state.project = project; });

    const renderState = renderGraph.buildRenderState(0, 16, { width: 800, height: 600 });
    expect(renderState.wormholeEnabled).toBe(true);
    expect(renderState.wormholeSpeed).toBe(1.5);
    expect(renderState.wormholeWeave).toBe(0.6);
    expect(renderState.wormholeIter).toBe(5);
  });

  it('correctly maps gen-data-stream parameters', () => {
    const store = createStore(createInitialState());
    const renderGraph = new RenderGraph(store);
    const project = buildProjectWithGenerator('gen-data-stream', {
      speed: 2.0,
      opacity: 0.9
    });
    store.update((state: any) => { state.project = project; });

    const renderState = renderGraph.buildRenderState(0, 16, { width: 800, height: 600 });
    expect(renderState.dataStreamEnabled).toBe(true);
    expect(renderState.dataStreamSpeed).toBe(2.0);
    expect(renderState.dataStreamOpacity).toBe(0.9);
  });

  it('correctly maps gen-caustic-liquid parameters', () => {
    const store = createStore(createInitialState());
    const renderGraph = new RenderGraph(store);
    const project = buildProjectWithGenerator('gen-caustic-liquid', {
      speed: 1.2
    });
    store.update((state: any) => { state.project = project; });

    const renderState = renderGraph.buildRenderState(0, 16, { width: 800, height: 600 });
    expect(renderState.causticLiquidEnabled).toBe(true);
    expect(renderState.causticLiquidSpeed).toBe(1.2);
  });

  it('correctly maps gen-shimmer-veil parameters', () => {
    const store = createStore(createInitialState());
    const renderGraph = new RenderGraph(store);
    const project = buildProjectWithGenerator('gen-shimmer-veil', {
      complexity: 12.0
    });
    store.update((state: any) => { state.project = project; });

    const renderState = renderGraph.buildRenderState(0, 16, { width: 800, height: 600 });
    expect(renderState.shimmerVeilEnabled).toBe(true);
    expect(renderState.shimmerVeilComplexity).toBe(12.0);
  });
});
