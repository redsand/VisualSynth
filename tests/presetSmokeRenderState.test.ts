import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { RenderGraph } from '../src/renderer/render/RenderGraph';
import { createStore, createInitialState } from '../src/renderer/state/store';
import { DEFAULT_PROJECT } from '../src/shared/project';
import { applyPresetV3, applyPresetV4, applyPresetV5, applyPresetV6, migratePreset } from '../src/shared/presetMigration';

const presetsDir = path.resolve(__dirname, '..', 'assets', 'presets');

const loadPreset = (fileName: string) => {
  const payload = fs.readFileSync(path.join(presetsDir, fileName), 'utf-8');
  return JSON.parse(payload);
};

const applyPresetToProject = (fileName: string) => {
  const preset = loadPreset(fileName);
  const migrated = migratePreset(preset);
  if (!migrated.success) {
    throw new Error(`Preset migration failed: ${(migrated.errors || []).join(', ')}`);
  }
  if (migrated.preset.version === 6) {
    return applyPresetV6(migrated.preset, DEFAULT_PROJECT).project;
  }
  if (migrated.preset.version === 5) {
    return applyPresetV5(migrated.preset, DEFAULT_PROJECT).project;
  }
  if (migrated.preset.version === 4) {
    return applyPresetV4(migrated.preset, DEFAULT_PROJECT).project;
  }
  if (migrated.preset.version === 3) {
    return applyPresetV3(migrated.preset, DEFAULT_PROJECT).project;
  }
  throw new Error(`Preset ${fileName} did not migrate to a supported version.`);
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

describe('preset smoke render-state snapshots', () => {
  let store: any;
  let renderGraph: RenderGraph;

  beforeEach(() => {
    store = createStore(createInitialState());
    renderGraph = new RenderGraph(store);
  });

  it('applies every preset and produces a stable render-state subset', () => {
    const presetFiles = fs.readdirSync(presetsDir).filter((file) => file.endsWith('.json')).sort();
    const entries = presetFiles.map((fileName) => {
      const project = applyPresetToProject(fileName);
      store.update((state: any) => {
        state.project = project;
      });
      const renderState = renderGraph.buildRenderState(0, 16, { width: 800, height: 600 });
      return { preset: fileName, snapshot: renderSnapshot(renderState) };
    });
    expect(entries).toMatchSnapshot();
  });
});
