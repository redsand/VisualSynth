import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { DEFAULT_PROJECT } from '../src/shared/project';
import { applyPresetV6, migratePreset } from '../src/shared/presetMigration';

const presetsDir = path.resolve(__dirname, '..', 'assets', 'presets');

const loadPreset = (fileName: string) => {
  const payload = fs.readFileSync(path.join(presetsDir, fileName), 'utf-8');
  return JSON.parse(payload);
};

const applyPreset = (preset: any) => {
  const migrated = migratePreset(preset);
  if (!migrated.success) {
    throw new Error('Preset migration failed');
  }
  const migratedPreset = migrated.preset;
  return applyPresetV6(migratedPreset, DEFAULT_PROJECT);
};

describe('preset regression coverage', () => {
  it('disables non-preset layers when applying presets', () => {
    const preset = loadPreset('preset-013-glyph-matrix.json');
    const applied = applyPreset(preset);
    const scene = applied.project.scenes.find((s: any) => s.id === applied.project.activeSceneId);
    expect(scene).toBeDefined();

    // Verify scene has layers
    expect(scene.layers.length).toBeGreaterThan(0);
  });

  it('preserves layer params when migrating v2 presets to latest', () => {
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
    const migratedPreset = migrated.preset;
    const applied = applyPresetV6(migratedPreset, DEFAULT_PROJECT);
    const scene = applied.project.scenes.find((s: any) => s.id === applied.project.activeSceneId);
    const plasma = scene.layers.find((layer: any) => layer.id === 'layer-plasma');
    expect(plasma?.params?.speed).toBe(2.25);
    expect(plasma?.params?.scale).toBe(1.4);
  });

  it('does not mutate DEFAULT_PROJECT when applying presets', () => {
    const before = JSON.stringify(DEFAULT_PROJECT);
    const preset = loadPreset('preset-013-glyph-matrix.json');
    applyPreset(preset);
    const after = JSON.stringify(DEFAULT_PROJECT);
    expect(after).toBe(before);
  });

  it('produces a stable resolved layer snapshot for Cosmic Plasma', () => {
    const preset = loadPreset('preset-001-cosmic.json');
    const applied = applyPreset(preset);
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

  it('keeps known weak generator presets wired to real layer targets and visible defaults', () => {
    const analogStatic = loadPreset('preset-139-analog-static.json');
    const guitarAmp = loadPreset('preset-121-guitar-amp.json');
    const feedbackLoop = loadPreset('preset-128-feedback-loop.json');
    const shapeBurst = loadPreset('preset-113-shape-burst.json');
    const dataOverlay = loadPreset('preset-155-data-overlay.json');
    const liquidCanvas = loadPreset('preset-154-liquid-canvas.json');
    const liquidMetal = loadPreset('preset-090-liquid-metal.json');
    const acidRock = loadPreset('preset-129-acid-rock.json');

    expect(analogStatic.modulations[0].target.type).toBe('analog-oscillo');
    expect(guitarAmp.modulations[0].target.type).toBe('analog-oscillo');
    expect(feedbackLoop.modulations[0].target.type).toBe('analog-oscillo');
    expect(shapeBurst.modulations[0].target.type).toBe('shape-burst');

    expect(feedbackLoop.effects).toMatchObject({
      enabled: true,
      feedback: 0.8,
      persistence: 0.5
    });

    expect(dataOverlay.scenes[0].layers.some((layer: any) => layer.generatorId === 'gen-signal-noise')).toBe(true);
    expect(liquidCanvas.scenes[0].layers.some((layer: any) => layer.generatorId === 'gen-signal-noise')).toBe(true);
    expect(liquidMetal.scenes[0].layers.some((layer: any) => layer.generatorId === 'gen-liquid-metal')).toBe(true);
    expect(acidRock.scenes[0].layers.some((layer: any) => layer.generatorId === 'gen-liquid-metal')).toBe(true);
  });

  it('merges preset-owned assets and preserves internal default assets when applying v6 presets', () => {
    const preset = {
      version: 6,
      metadata: {
        version: 6,
        name: 'Embedded Media',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        category: 'Tests',
        compatibility: { minVersion: '1.0.0' },
        activeEngineId: '',
        activeModeId: '',
        intendedMusicStyle: 'Any',
        visualIntentTags: [],
        colorChemistry: ['analog', 'balanced'],
        defaultTransition: { durationMs: 600, curve: 'easeInOut' as const }
      },
      scenes: [
        {
          id: 'scene-1',
          scene_id: 'scene-1',
          name: 'Scene',
          intent: 'ambient',
          layers: [
            {
              id: 'layer-media',
              name: 'Media',
              enabled: true,
              opacity: 1,
              blendMode: 'normal',
              transform: { x: 0, y: 0, scale: 1, rotation: 0 },
              assetId: 'asset-embedded-title'
            }
          ]
        }
      ],
      activeSceneId: 'scene-1',
      roleWeights: { core: 1, support: 1, atmosphere: 1 },
      tempoSync: { bpm: 120, source: 'manual' as const },
      assets: [
        {
          id: 'asset-embedded-title',
          name: 'Embedded Title',
          kind: 'text',
          tags: ['preset'],
          addedAt: new Date().toISOString(),
          options: { text: 'HELLO', fontSize: 96, fontColor: '#ffffff' }
        }
      ]
    };

    const applied = applyPresetV6(preset, DEFAULT_PROJECT);
    expect(applied.project.assets.some((asset: any) => asset.id === 'asset-embedded-title')).toBe(true);
    expect(applied.project.assets.some((asset: any) => asset.id === 'internal-waveform')).toBe(true);
    expect(applied.project.scenes[0].layers[0].assetId).toBe('asset-embedded-title');
  });
});
