import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { RenderGraph } from '../src/renderer/render/RenderGraph';
import { createStore, createInitialState } from '../src/renderer/state/store';
import { DEFAULT_PROJECT } from '../src/shared/project';
import { applyPresetV3, applyPresetV4, applyPresetV5, applyPresetV6, migratePreset } from '../src/shared/presetMigration';

const presetsDir = path.resolve(__dirname, '..', 'assets', 'presets');

const applyPresetToProject = (fileName: string) => {
  const payload = fs.readFileSync(path.join(presetsDir, fileName), 'utf-8');
  const preset = JSON.parse(payload);
  const migrated = migratePreset(preset);
  if (!migrated.success) {
    throw new Error(`Preset migration failed for ${fileName}: ${(migrated.errors || []).join(', ')}`);
  }
  if (migrated.preset.version === 6) return applyPresetV6(migrated.preset, DEFAULT_PROJECT).project;
  if (migrated.preset.version === 5) return applyPresetV5(migrated.preset, DEFAULT_PROJECT).project;
  if (migrated.preset.version === 4) return applyPresetV4(migrated.preset, DEFAULT_PROJECT).project;
  if (migrated.preset.version === 3) return applyPresetV3(migrated.preset, DEFAULT_PROJECT).project;
  throw new Error(`Unsupported migrated version for ${fileName}: ${migrated.preset.version}`);
};

describe('RenderGraph entry parity', () => {
  it('matches shipped index spectrum enablement fallback for all presets', () => {
    const presetFiles = fs.readdirSync(presetsDir).filter((file) => file.endsWith('.json')).sort();
    const mismatches: string[] = [];

    for (const fileName of presetFiles) {
      const project = applyPresetToProject(fileName);
      const store = createStore(createInitialState());
      const renderGraph = new RenderGraph(store);
      store.update((state) => {
        state.project = project;
      });

      const renderState = renderGraph.buildRenderState(0, 16, { width: 800, height: 600 });
      const scene = project.scenes.find((item) => item.id === project.activeSceneId) ?? project.scenes[0];
      const spectrumLayer = scene?.layers.find((layer) => layer.id === 'layer-spectrum');
      const expected = spectrumLayer?.enabled ?? false;
      if (renderState.spectrumEnabled !== expected) {
        mismatches.push(fileName);
      }
    }

    expect(mismatches).toEqual([]);
  });

  it('supports both canonical and legacy 8-bit grid layer ids in render state', () => {
    const store = createStore(createInitialState());
    const renderGraph = new RenderGraph(store);
    const baseScene = DEFAULT_PROJECT.scenes[0];

    const withCanonical = {
      ...DEFAULT_PROJECT,
      scenes: [
        {
          ...baseScene,
          layers: [
            ...baseScene.layers,
            {
              id: 'gen-8bit-grid',
              name: '8-Bit Grid',
              role: 'support' as const,
              enabled: true,
              opacity: 0.9,
              blendMode: 'screen' as const,
              transform: { x: 0, y: 0, scale: 1, rotation: 0 },
              params: { opacity: 0.9, speed: 1.25, pixelSize: 12 }
            }
          ]
        }
      ]
    };

    store.update((state) => {
      state.project = withCanonical;
    });
    const canonicalState = renderGraph.buildRenderState(0, 16, { width: 800, height: 600 });
    expect(canonicalState.eightBitGridEnabled).toBe(true);
    expect(canonicalState.eightBitGridPixelSize).toBe(12);

    const withLegacy = {
      ...DEFAULT_PROJECT,
      scenes: [
        {
          ...baseScene,
          layers: [
            ...baseScene.layers,
            {
              id: 'gen-eight-bit-grid',
              name: '8-Bit Grid Legacy',
              role: 'support' as const,
              enabled: true,
              opacity: 0.75,
              blendMode: 'screen' as const,
              transform: { x: 0, y: 0, scale: 1, rotation: 0 },
              params: { opacity: 0.75, speed: 0.75, pixelSize: 10 }
            }
          ]
        }
      ]
    };

    store.update((state) => {
      state.project = withLegacy;
    });
    const legacyState = renderGraph.buildRenderState(0, 16, { width: 800, height: 600 });
    expect(legacyState.eightBitGridEnabled).toBe(true);
    expect(legacyState.eightBitGridPixelSize).toBe(10);
  });
});

