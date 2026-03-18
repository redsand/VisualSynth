import { describe, expect, it } from 'vitest';
import { buildPresetIndexEntry } from '../src/shared/presetIndex';
import { applyPresetV6 } from '../src/shared/presetMigration';
import { DEFAULT_PROJECT } from '../src/shared/project';

describe('preset index classifier', () => {
  it('classifies audio reactive presets from oscillo layers', () => {
    const entry = buildPresetIndexEntry('preset-oscillo.json', {
      version: 6,
      metadata: { name: 'Amp Oscillo' },
      scenes: [
        {
          id: 'scene-1',
          name: 'Amp Oscillo',
          layers: [
            {
              id: 'gen-analog-oscillo',
              name: 'Oscillo',
              generatorId: 'gen-analog-oscillo',
              enabled: true,
              opacity: 1,
              blendMode: 'screen',
              role: 'core',
              transform: { x: 0, y: 0, scale: 1, rotation: 0 }
            }
          ]
        }
      ]
    });

    expect(entry.primaryCategory).toBe('Audio-Reactive');
    expect(entry.visualFamilies).toContain('Oscillo');
    expect(entry.sourceDependency).toBe('audio-reactive');
    expect(entry.riskFlags).toContain('audio-required');
  });

  it('classifies text/media presets with embedded assets', () => {
    const entry = buildPresetIndexEntry('preset-data.json', {
      version: 6,
      metadata: { name: 'Data Overlay' },
      assets: [
        {
          id: 'asset-text',
          name: 'Headline',
          kind: 'text',
          tags: [],
          addedAt: new Date().toISOString()
        }
      ],
      scenes: [
        {
          id: 'scene-1',
          name: 'Data Overlay',
          layers: [
            {
              id: 'layer-text',
              name: 'Text',
              assetId: 'asset-text',
              enabled: true,
              opacity: 1,
              blendMode: 'normal',
              role: 'support',
              transform: { x: 0, y: 0, scale: 1, rotation: 0 }
            }
          ]
        }
      ]
    });

    expect(entry.primaryCategory).toBe('Typography/Data');
    expect(entry.sourceDependency).toBe('text-media');
    expect(entry.riskFlags).toContain('media-required');
  });

  it('normalizes null MilkDrop shader fields during preset application', () => {
    const result = applyPresetV6(
      {
        version: 6,
        metadata: {
          version: 6,
          name: 'Null Shader',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          activeEngineId: 'engine-radial-core',
          activeModeId: 'mode-cosmic',
          intendedMusicStyle: 'Test',
          visualIntentTags: [],
          colorChemistry: ['analog', 'balanced'],
          defaultTransition: { durationMs: 600, curve: 'easeInOut' }
        },
        scenes: [
          {
            id: 'scene-1',
            scene_id: 'scene-1',
            name: 'Main',
            intent: 'ambient',
            duration: 0,
            transition_in: { durationMs: 600, curve: 'easeInOut' },
            transition_out: { durationMs: 600, curve: 'easeInOut' },
            trigger: { type: 'manual' },
            assigned_layers: { core: [], support: [], atmosphere: [] },
            layers: [
              {
                id: 'layer-milkwave',
                name: 'Milkwave',
                role: 'support',
                enabled: true,
                opacity: 1,
                blendMode: 'screen',
                transform: { x: 0, y: 0, scale: 1, rotation: 0 }
              }
            ]
          }
        ],
        activeSceneId: 'scene-1',
        roleWeights: { core: 1, support: 1, atmosphere: 1 },
        tempoSync: { bpm: 120, source: 'manual' },
        modulations: [],
        macros: [],
        _shaderData: {
          warp: null,
          comp: null,
          perFrameCode: [],
          perFrameInitCode: [],
          originalParameters: {}
        }
      },
      DEFAULT_PROJECT
    );

    expect(result.project.scenes[0]._shaderData?.warp).toBe('');
    expect(result.project.scenes[0]._shaderData?.comp).toBe('');
  });
});
