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
    expect(renderState.genUniforms.LightningEnabled).toBe(1);
    expect(renderState.genUniforms.LightningSpeed).toBe(2.5);
    expect(renderState.genUniforms.LightningBranches).toBe(4);
    expect(renderState.genUniforms.LightningThickness).toBe(0.05);
    expect(renderState.genUniforms.LightningColor).toBe(1);
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
    expect(renderState.genUniforms.AnalogOscilloEnabled).toBe(1);
    expect(renderState.genUniforms.AnalogOscilloThickness).toBe(0.02);
    expect(renderState.genUniforms.AnalogOscilloGlow).toBe(0.8);
    expect(renderState.genUniforms.AnalogOscilloColor).toBe(2);
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
    expect(renderState.genUniforms.WormholeEnabled).toBe(1);
    expect(renderState.genUniforms.WormholeSpeed).toBe(1.5);
    expect(renderState.genUniforms.WormholeWeave).toBe(0.6);
    expect(renderState.genUniforms.WormholeIter).toBe(5);
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
    expect(renderState.genUniforms.DataStreamEnabled).toBe(1);
    expect(renderState.genUniforms.DataStreamSpeed).toBe(2.0);
    expect(renderState.genUniforms.DataStreamOpacity).toBe(0.9);
  });

  it('correctly maps gen-caustic-liquid parameters', () => {
    const store = createStore(createInitialState());
    const renderGraph = new RenderGraph(store);
    const project = buildProjectWithGenerator('gen-caustic-liquid', {
      speed: 1.2
    });
    store.update((state: any) => { state.project = project; });

    const renderState = renderGraph.buildRenderState(0, 16, { width: 800, height: 600 });
    expect(renderState.genUniforms.CausticLiquidEnabled).toBe(1);
    expect(renderState.genUniforms.CausticLiquidSpeed).toBe(1.2);
  });

  it('correctly maps gen-shimmer-veil parameters', () => {
    const store = createStore(createInitialState());
    const renderGraph = new RenderGraph(store);
    const project = buildProjectWithGenerator('gen-shimmer-veil', {
      complexity: 12.0
    });
    store.update((state: any) => { state.project = project; });

    const renderState = renderGraph.buildRenderState(0, 16, { width: 800, height: 600 });
    expect(renderState.genUniforms.ShimmerVeilEnabled).toBe(1);
    expect(renderState.genUniforms.ShimmerVeilComplexity).toBe(12.0);
  });

  it('maps imported Milkwave layers into render state', () => {
    const store = createStore(createInitialState());
    const renderGraph = new RenderGraph(store);
    const project = JSON.parse(JSON.stringify(DEFAULT_PROJECT));
    project.activeSceneId = 'scene-1';
    project.scenes[0].layers = [
      {
        id: 'layer-milkwave',
        name: 'Milkwave',
        role: 'atmosphere',
        enabled: true,
        opacity: 0.85,
        blendMode: 'screen',
        transform: { x: 0, y: 0, scale: 1, rotation: 0 },
        params: { opacity: 0.85, enabled: true }
      }
    ];
    store.update((state: any) => { state.project = project; });

    const renderState = renderGraph.buildRenderState(0, 16, { width: 800, height: 600 });
    expect(renderState.genUniforms.MilkwaveEnabled).toBe(1);
    expect(renderState.genUniforms.MilkwaveOpacity).toBe(0.85);
  });

  it('treats imported Milkwave layers as support-role content', async () => {
    const { GENERATOR_SHADER_BLOCKS } = await import('../src/shared/generatorShaderBlocks');
    const block = GENERATOR_SHADER_BLOCKS.find((entry) => entry.id === 'gen-milkwave');
    expect(block?.mainCall).toContain('uRoleWeights.y');
  });
});
