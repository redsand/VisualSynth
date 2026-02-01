import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { DEFAULT_PROJECT } from '../src/shared/project';
import { applyPresetV3, migratePreset } from '../src/shared/presetMigration';
import { buildLegacyTarget } from '../src/shared/parameterRegistry';

const presetsDir = path.resolve(__dirname, '..', 'assets', 'presets');

const loadPreset = (fileName: string) => {
  const payload = fs.readFileSync(path.join(presetsDir, fileName), 'utf-8');
  return JSON.parse(payload);
};

describe('preset regression coverage', () => {
  it('disables non-preset layers when applying v3 presets', () => {
    const preset = loadPreset('preset-107-glyph-matrix.json');
    const applied = applyPresetV3(preset, DEFAULT_PROJECT);
    const scene = applied.project.scenes.find((s: any) => s.id === applied.project.activeSceneId);
    expect(scene).toBeDefined();

    const presetLayerIds = new Set(
      preset.layers.map((layer: any) => buildLegacyTarget(layer.type, '').split('.')[0])
    );

    scene.layers.forEach((layer: any) => {
      if (presetLayerIds.has(layer.id)) {
        expect(layer.enabled).toBe(true);
      } else {
        expect(layer.enabled).toBe(false);
      }
    });
  });

  it('preserves layer params when migrating v2 presets to v3', () => {
    const v2Preset = {
      version: 2,
      name: 'Param Preserve',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      scenes: [
        {
          id: 'scene-1',
          name: 'Scene',
          layers: [
            {
              id: 'layer-plasma',
              name: 'Plasma',
              enabled: true,
              opacity: 0.5,
              blendMode: 'screen',
              transform: { x: 0, y: 0, scale: 1, rotation: 0 },
              params: { speed: 2.25, scale: 1.4 }
            }
          ]
        }
      ],
      modMatrix: [],
      midiMappings: []
    };

    const migrated = migratePreset(v2Preset);
    expect(migrated.success).toBe(true);
    const plasma = migrated.preset.layers.find((layer: any) => layer.type === 'plasma');
    expect(plasma?.params?.speed).toBe(2.25);
    expect(plasma?.params?.scale).toBe(1.4);
  });

  it('does not mutate DEFAULT_PROJECT when applying presets', () => {
    const before = JSON.stringify(DEFAULT_PROJECT);
    const preset = loadPreset('preset-107-glyph-matrix.json');
    applyPresetV3(preset, DEFAULT_PROJECT);
    const after = JSON.stringify(DEFAULT_PROJECT);
    expect(after).toBe(before);
  });

  it('produces a stable resolved layer snapshot for Cosmic Plasma', () => {
    const preset = loadPreset('preset-01-cosmic.json');
    const applied = applyPresetV3(preset, DEFAULT_PROJECT);
    const scene = applied.project.scenes.find((s: any) => s.id === applied.project.activeSceneId);
    expect(
      scene.layers.map((layer: any) => ({
        id: layer.id,
        enabled: layer.enabled,
        opacity: layer.opacity,
        blendMode: layer.blendMode,
        params: layer.params
      }))
    ).toMatchSnapshot();
  });
});
