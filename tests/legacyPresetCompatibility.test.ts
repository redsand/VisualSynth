import { describe, expect, it } from 'vitest';
import { createStore, createInitialState } from '../src/renderer/state/store';
import { RenderGraph } from '../src/renderer/render/RenderGraph';
import { DEFAULT_PROJECT } from '../src/shared/project';
import { applyPresetV3, applyPresetV4, applyPresetV6, migratePreset } from '../src/shared/presetMigration';

const cloneDefaultProject = () => JSON.parse(JSON.stringify(DEFAULT_PROJECT));
const LEGACY_NEUTRAL_EFFECTS = {
  enabled: true,
  bloom: 0,
  blur: 0,
  chroma: 0,
  posterize: 0,
  kaleidoscope: 0,
  feedback: 0,
  persistence: 0
};

describe('legacy preset compatibility', () => {
  it('applies v3 presets onto a neutral legacy scaffold', () => {
    const preset = {
      version: 3,
      name: 'Legacy Plasma',
      layers: [
        {
          type: 'plasma',
          params: {
            enabled: true,
            opacity: 0.8,
            speed: 0.5,
            scale: 1.2,
            complexity: 0.4
          }
        }
      ],
      modulations: [],
      macros: []
    };

    const { project } = applyPresetV3(preset, cloneDefaultProject());

    expect(project.name).toBe('Legacy Plasma');
    expect(project.activeEngineId).toBe('');
    expect(project.activeModeId).toBe('');
    expect(project.colorChemistry).toEqual(['analog', 'balanced']);
    expect(project.roleWeights).toEqual({ core: 1, support: 1, atmosphere: 1 });
    expect(project.engineFinish).toEqual({ grain: 0, vignette: 0, ca: 0 });
    expect(project.activeStylePresetId).toBe('style-neutral');
    expect(project.sdf.enabled).toBe(false);
    expect(project.sdf.fill).toBe(0);
    expect(project.sdf.glow).toBe(0);
    expect(project.effects).toEqual(LEGACY_NEUTRAL_EFFECTS);
    expect(project.activePaletteId).toBe(DEFAULT_PROJECT.activePaletteId);
  });

  it('applies v4 presets onto a neutral legacy scaffold', () => {
    const preset = {
      version: 4,
      metadata: {
        version: 4,
        name: 'Legacy Spectrum',
        createdAt: '2026-02-01T00:00:00.000Z',
        updatedAt: '2026-02-01T00:00:00.000Z',
        presetType: 'performance',
        intendedMusicStyle: 'Ambient',
        visualIntentTags: ['legacy'],
        defaultTransition: {
          durationMs: 500,
          curve: 'easeInOut'
        }
      },
      scenes: [
        {
          id: 'scene-v4-1',
          name: 'Legacy Scene',
          layers: [
            {
              id: 'layer-spectrum',
              name: 'Spectrum',
              role: 'support',
              enabled: true,
              opacity: 1,
              blendMode: 'add',
              transform: { x: 0, y: 0, scale: 1, rotation: 0 },
              params: {}
            }
          ]
        }
      ],
      activeSceneId: 'scene-v4-1',
      modulations: [],
      macros: []
    };

    const { project } = applyPresetV4(preset, cloneDefaultProject());

    expect(project.name).toBe('Legacy Spectrum');
    expect(project.activeEngineId).toBe('');
    expect(project.activeModeId).toBe('');
    expect(project.colorChemistry).toEqual(['analog', 'balanced']);
    expect(project.roleWeights).toEqual({ core: 1, support: 1, atmosphere: 1 });
    expect(project.engineFinish).toEqual({ grain: 0, vignette: 0, ca: 0 });
    expect(project.activeStylePresetId).toBe('style-neutral');
    expect(project.sdf.enabled).toBe(false);
    expect(project.sdf.fill).toBe(0);
    expect(project.sdf.glow).toBe(0);
    expect(project.effects).toEqual(LEGACY_NEUTRAL_EFFECTS);
    expect(project.activePaletteId).toBe(DEFAULT_PROJECT.activePaletteId);
  });

  it('renders neutral engine finish when no engine is active', () => {
    const project = cloneDefaultProject();
    project.activeEngineId = '';
    project.activeModeId = '';
    project.engineFinish = {};
    project.colorChemistry = ['analog', 'balanced'];
    project.macros = [];
    project.scenes = [
      {
        ...project.scenes[0],
        id: 'scene-1',
        scene_id: 'scene-1',
        layers: [
          {
            id: 'layer-plasma',
            name: 'Plasma',
            role: 'core',
            enabled: true,
            opacity: 0.95,
            blendMode: 'screen',
            transform: { x: 0, y: 0, scale: 1, rotation: 0 },
            params: { opacity: 0.95, enabled: true }
          }
        ]
      }
    ];
    project.activeSceneId = 'scene-1';

    const store = createStore(createInitialState());
    const renderGraph = new RenderGraph(store);
    store.update((state: any) => {
      state.project = project;
    });

    const renderState = renderGraph.buildRenderState(0, 16, { width: 800, height: 600 });

    expect(renderState.motionTemplate).toBe(0);
    expect(renderState.chemistryMode).toBe(0);
    expect(renderState.plasmaOpacity).toBe(0.95);
    expect(renderState.engineGrain).toBe(0);
    expect(renderState.engineVignette).toBe(0);
    expect(renderState.engineCA).toBe(0);
  });

  it('normalizes migrated legacy macro targets for schema-compatible runtime projects', () => {
    const legacyPreset = {
      version: 3,
      metadata: {
        version: 3,
        name: 'Legacy Macro Plasma',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      },
      layers: [
        {
          type: 'plasma',
          params: {
            enabled: true,
            opacity: 0.95,
            blendMode: 'screen',
            transform: { x: 0, y: 0, scale: 1, rotation: 0 },
            speed: 1
          }
        }
      ],
      modulations: [],
      macros: [
        {
          id: 'macro-1',
          name: 'Plasma Speed',
          value: 0.5,
          targets: [
            {
              target: { type: 'plasma', param: 'speed' },
              amount: 1
            }
          ]
        }
      ]
    };

    const migrated = migratePreset(legacyPreset);
    expect(migrated.success).toBe(true);
    expect(migrated.preset.version).toBe(6);

    const { project } = applyPresetV6(migrated.preset, cloneDefaultProject());

    expect(project.activeEngineId).toBe('');
    expect(project.macros[0]?.targets[0]?.target).toBe('layer-plasma.speed');
  });

  it('does not inherit template macro opacity boosts for migrated legacy presets', () => {
    const legacyPreset = {
      version: 3,
      name: 'Legacy Plasma',
      layers: [
        {
          type: 'plasma',
          params: {
            enabled: true,
            opacity: 0.95,
            speed: 1,
            scale: 1,
            complexity: 0.5
          }
        }
      ],
      modulations: [],
      macros: []
    };

    const { project } = applyPresetV3(legacyPreset, cloneDefaultProject());
    const store = createStore(createInitialState());
    const renderGraph = new RenderGraph(store);

    store.update((state: any) => {
      state.project = project;
    });

    const renderState = renderGraph.buildRenderState(0, 16, { width: 800, height: 600 });

    expect(project.macros).toEqual([]);
    expect(renderState.plasmaOpacity).toBe(0.95);
  });

  it('does not apply role-based effect bloom boosts for legacy neutral presets', () => {
    const legacyPreset = {
      version: 3,
      name: 'Legacy Spectrum',
      layers: [
        {
          type: 'spectrum',
          params: {
            enabled: true,
            opacity: 0.9
          }
        }
      ],
      modulations: [],
      macros: []
    };

    const { project } = applyPresetV3(legacyPreset, cloneDefaultProject());
    const store = createStore(createInitialState());
    const renderGraph = new RenderGraph(store);

    store.update((state: any) => {
      state.project = project;
    });

    const renderState = renderGraph.buildRenderState(0, 16, { width: 800, height: 600 });

    expect(renderState.bloom).toBe(0);
    expect(renderState.blur).toBe(0);
    expect(renderState.chroma).toBe(0);
    expect(renderState.feedback).toBe(0);
    expect(renderState.sdfEnabled).toBe(false);
  });
});
