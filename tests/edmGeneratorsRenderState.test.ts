import { describe, expect, it } from 'vitest';
import { RenderGraph } from '../src/renderer/render/RenderGraph';
import { createStore, createInitialState } from '../src/renderer/state/store';
import { DEFAULT_PROJECT } from '../src/shared/project';

const cloneProject = () => JSON.parse(JSON.stringify(DEFAULT_PROJECT));

const buildProjectWithLaser = (layerId: string) => {
  const project = cloneProject();
  project.activeSceneId = 'scene-1';
  const scene = project.scenes.find((item: any) => item.id === 'scene-1');
  if (!scene) {
    throw new Error('Expected scene-1 in default project.');
  }
  scene.layers = [
    {
      id: layerId,
      name: 'Laser Beam Generator',
      role: 'core',
      enabled: true,
      opacity: 1,
      blendMode: 'screen',
      transform: { x: 0, y: 0, scale: 1, rotation: 0 },
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
    const project = buildProjectWithLaser('gen-laser-beam');
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
    const project = buildProjectWithLaser('gen\u2011laser\u2011beam');
    store.update((state: any) => {
      state.project = project;
    });

    const renderState = renderGraph.buildRenderState(0, 16, { width: 800, height: 600 });
    expect(renderState.laserEnabled).toBe(true);
  });
});
