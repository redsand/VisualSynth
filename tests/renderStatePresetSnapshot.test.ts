import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { RenderGraph } from '../src/renderer/render/RenderGraph';
import { createStore, createInitialState } from '../src/renderer/state/store';
import { DEFAULT_PROJECT } from '../src/shared/project';
import { applyPresetV3, migratePreset } from '../src/shared/presetMigration';

const presetsDir = path.resolve(__dirname, '..', 'assets', 'presets');

const loadPreset = (fileName: string) => {
  const payload = fs.readFileSync(path.join(presetsDir, fileName), 'utf-8');
  return JSON.parse(payload);
};

const applyPresetToProject = (fileName: string) => {
  const preset = loadPreset(fileName);
  const migrated = preset.version === 3 ? { success: true, preset } : migratePreset(preset);
  if (!migrated.success) {
    throw new Error(`Preset migration failed: ${(migrated.errors || []).join(', ')}`);
  }
  if (migrated.preset.version !== 3) {
    throw new Error(`Preset ${fileName} did not migrate to v3.`);
  }
  return applyPresetV3(migrated.preset, DEFAULT_PROJECT).project;
};

const renderSnapshot = (renderState: any) => ({
  plasmaEnabled: renderState.plasmaEnabled,
  spectrumEnabled: renderState.spectrumEnabled,
  origamiEnabled: renderState.origamiEnabled,
  glyphEnabled: renderState.glyphEnabled,
  crystalEnabled: renderState.crystalEnabled,
  inkEnabled: renderState.inkEnabled,
  topoEnabled: renderState.topoEnabled,
  weatherEnabled: renderState.weatherEnabled,
  portalEnabled: renderState.portalEnabled,
  oscilloEnabled: renderState.oscilloEnabled,
  plasmaOpacity: renderState.plasmaOpacity,
  spectrumOpacity: renderState.spectrumOpacity,
  origamiOpacity: renderState.origamiOpacity,
  glyphOpacity: renderState.glyphOpacity,
  crystalOpacity: renderState.crystalOpacity,
  inkOpacity: renderState.inkOpacity,
  topoOpacity: renderState.topoOpacity,
  weatherOpacity: renderState.weatherOpacity,
  portalOpacity: renderState.portalOpacity,
  oscilloOpacity: renderState.oscilloOpacity,
  effectsEnabled: renderState.effectsEnabled,
  bloom: renderState.bloom,
  blur: renderState.blur,
  chroma: renderState.chroma,
  posterize: renderState.posterize,
  kaleidoscope: renderState.kaleidoscope,
  feedback: renderState.feedback,
  persistence: renderState.persistence,
  particlesEnabled: renderState.particlesEnabled,
  particleDensity: renderState.particleDensity,
  particleSpeed: renderState.particleSpeed,
  particleSize: renderState.particleSize,
  particleGlow: renderState.particleGlow,
  sdfEnabled: renderState.sdfEnabled,
  sdfScale: renderState.sdfScale,
  sdfEdge: renderState.sdfEdge,
  sdfGlow: renderState.sdfGlow,
  sdfRotation: renderState.sdfRotation,
  sdfFill: renderState.sdfFill,
  sdfScenePresent: Boolean(renderState.sdfScene)
});

describe('render-state preset snapshots', () => {
  let store: any;
  let renderGraph: RenderGraph;

  beforeEach(() => {
    store = createStore(createInitialState());
    renderGraph = new RenderGraph(store);
  });

  it('produces a stable render-state snapshot for Cosmic Plasma', () => {
    const project = applyPresetToProject('preset-01-cosmic.json');
    store.update((state: any) => {
      state.project = project;
    });
    const renderState = renderGraph.buildRenderState(0, 16, { width: 800, height: 600 });
    expect(renderSnapshot(renderState)).toMatchSnapshot();
  });

  it('produces a stable render-state snapshot for Glyph Matrix', () => {
    const project = applyPresetToProject('preset-107-glyph-matrix.json');
    store.update((state: any) => {
      state.project = project;
    });
    const renderState = renderGraph.buildRenderState(0, 16, { width: 800, height: 600 });
    expect(renderSnapshot(renderState)).toMatchSnapshot();
  });
});
