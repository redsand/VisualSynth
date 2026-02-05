import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { RenderGraph } from '../src/renderer/render/RenderGraph';
import { createStore, createInitialState } from '../src/renderer/state/store';
import { DEFAULT_PROJECT } from '../src/shared/project';

const examplesDir = path.resolve(__dirname, '..', 'scripts', 'examples');

const loadProject = (fileName: string) => {
  const payload = fs.readFileSync(path.join(examplesDir, fileName), 'utf-8');
  return JSON.parse(payload);
};

const buildRenderState = (fileName: string) => {
  const store = createStore(createInitialState());
  const renderGraph = new RenderGraph(store);
  const loaded = loadProject(fileName);
  const project = {
    ...DEFAULT_PROJECT,
    ...loaded,
    macros: loaded.macros?.length ? loaded.macros : DEFAULT_PROJECT.macros,
    lfos: loaded.lfos?.length ? loaded.lfos : DEFAULT_PROJECT.lfos,
    envelopes: loaded.envelopes?.length ? loaded.envelopes : DEFAULT_PROJECT.envelopes,
    sampleHold: loaded.sampleHold?.length ? loaded.sampleHold : DEFAULT_PROJECT.sampleHold,
    padMappings: loaded.padMappings?.length ? loaded.padMappings : DEFAULT_PROJECT.padMappings
  };
  store.update((state: any) => {
    state.project = project;
  });
  return renderGraph.buildRenderState(0, 16, { width: 800, height: 600 });
};

describe('EDM generator example projects', () => {
  it('laser-only project enables laser', () => {
    const renderState = buildRenderState('laser-only.project.json');
    expect(renderState.laserEnabled).toBe(true);
  });

  it('strobe-only project enables strobe', () => {
    const renderState = buildRenderState('strobe-only.project.json');
    expect(renderState.strobeEnabled).toBe(true);
  });

  it('shape-burst-only project enables shape burst', () => {
    const renderState = buildRenderState('shape-burst-only.project.json');
    expect(renderState.shapeBurstEnabled).toBe(true);
  });

  it('grid-tunnel-only project enables grid tunnel', () => {
    const renderState = buildRenderState('grid-tunnel-only.project.json');
    expect(renderState.gridTunnelEnabled).toBe(true);
  });
});
