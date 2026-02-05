import { describe, expect, it } from 'vitest';
import { RenderGraph } from '../src/renderer/render/RenderGraph';
import { createStore, createInitialState } from '../src/renderer/state/store';
import { DEFAULT_PROJECT } from '../src/shared/project';

const cloneProject = () => JSON.parse(JSON.stringify(DEFAULT_PROJECT));

const buildProjectWithGenerator = (layerId: string, generatorId?: string) => {
  const project = cloneProject();
  project.activeSceneId = 'scene-1';
  const scene = project.scenes.find((item: any) => item.id === 'scene-1');
  if (!scene) {
    throw new Error('Expected scene-1 in default project.');
  }
  scene.layers = [
    {
      id: layerId,
      name: 'Generator Layer',
      role: 'core',
      enabled: true,
      opacity: 1,
      blendMode: 'screen',
      transform: { x: 0, y: 0, scale: 1, rotation: 0 },
      generatorId,
      params: {
        opacity: 1,
        beamCount: 6,
        beamWidth: 0.03,
        beamLength: 1.1,
        rotation: 0,
        rotationSpeed: 0.5,
        spread: 1.57,
        mode: 0,
        colorShift: 0,
        audioReact: 0.7,
        glow: 0.5
      }
    }
  ];
  scene.assigned_layers = { core: [], support: [], atmosphere: [] };
  return project;
};

describe('EDM generators render-state', () => {
  it('enables laser when layer id is gen-laser-beam', () => {
    const store = createStore(createInitialState());
    const renderGraph = new RenderGraph(store);
    const project = buildProjectWithGenerator('gen-laser-beam');
    store.update((state: any) => {
      state.project = project;
    });

    const renderState = renderGraph.buildRenderState(0, 16, { width: 800, height: 600 });
    expect(renderState.laserEnabled).toBe(true);
    expect(renderState.laserBeamCount).toBe(6);
    expect(renderState.laserBeamWidth).toBeCloseTo(0.03, 5);
  });

  it('enables laser when layer id contains unicode dashes', () => {
    const store = createStore(createInitialState());
    const renderGraph = new RenderGraph(store);
    const project = buildProjectWithGenerator('gen\u2011laser\u2011beam');
    store.update((state: any) => {
      state.project = project;
    });

    const renderState = renderGraph.buildRenderState(0, 16, { width: 800, height: 600 });
    expect(renderState.laserEnabled).toBe(true);
  });

  it('enables laser when generatorId is gen-laser-beam', () => {
    const store = createStore(createInitialState());
    const renderGraph = new RenderGraph(store);
    const project = buildProjectWithGenerator('layer-laser-1', 'gen-laser-beam');
    store.update((state: any) => {
      state.project = project;
    });

    const renderState = renderGraph.buildRenderState(0, 16, { width: 800, height: 600 });
    expect(renderState.laserEnabled).toBe(true);
  });

  it('enables strobe when generatorId is gen-strobe', () => {
    const store = createStore(createInitialState());
    const renderGraph = new RenderGraph(store);
    const project = buildProjectWithGenerator('layer-strobe-1', 'gen-strobe');
    store.update((state: any) => {
      state.project = project;
    });

    const renderState = renderGraph.buildRenderState(0, 16, { width: 800, height: 600 });
    expect(renderState.strobeEnabled).toBe(true);
  });

  it('enables shape burst when generatorId is gen-shape-burst', () => {
    const store = createStore(createInitialState());
    const renderGraph = new RenderGraph(store);
    const project = buildProjectWithGenerator('layer-shape-burst-1', 'gen-shape-burst');
    store.update((state: any) => {
      state.project = project;
    });

    const renderState = renderGraph.buildRenderState(0, 16, { width: 800, height: 600 });
    expect(renderState.shapeBurstEnabled).toBe(true);
  });

  it('enables grid tunnel when generatorId is gen-grid-tunnel', () => {
    const store = createStore(createInitialState());
    const renderGraph = new RenderGraph(store);
    const project = buildProjectWithGenerator('layer-grid-tunnel-1', 'gen-grid-tunnel');
    store.update((state: any) => {
      state.project = project;
    });

    const renderState = renderGraph.buildRenderState(0, 16, { width: 800, height: 600 });
    expect(renderState.gridTunnelEnabled).toBe(true);
  });
});
