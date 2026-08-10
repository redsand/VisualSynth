import { describe, expect, it } from 'vitest';
import { DEFAULT_PROJECT } from '../src/shared/project';
import { deserializeProject, serializeProject } from '../src/shared/serialization';

describe('project serialization', () => {
  it('serializes and deserializes a project', () => {
    const payload = serializeProject(DEFAULT_PROJECT);
    const project = deserializeProject(payload);
    expect(project.name).toBe(DEFAULT_PROJECT.name);
  });

  it('upgrades legacy projects', () => {
    const legacy = {
      version: 1,
      name: 'Legacy',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      scenes: DEFAULT_PROJECT.scenes,
      modMatrix: [],
      midiMappings: [],
      activeSceneId: DEFAULT_PROJECT.activeSceneId
    };
    const payload = JSON.stringify(legacy);
    const upgraded = deserializeProject(payload);
    expect(upgraded.version).toBeGreaterThan(1);
    expect(upgraded.stylePresets).toBeDefined();
    expect(upgraded.macros.length).toBeGreaterThan(0);
  });

  it('preserves added scenes and scene names across a save/load round-trip', () => {
    const project = JSON.parse(JSON.stringify(DEFAULT_PROJECT));
    project.scenes = [
      ...project.scenes,
      {
        ...project.scenes[0],
        id: 'scene-67',
        scene_id: 'scene-67',
        name: 'Selena'
      },
      {
        ...project.scenes[0],
        id: 'scene-69',
        scene_id: 'scene-69',
        name: 'Bad Bunny'
      }
    ];
    project.activeSceneId = 'scene-69';

    const payload = serializeProject(project);
    const reloaded = deserializeProject(payload);

    expect(reloaded.scenes.some((scene) => scene.name === 'Selena')).toBe(true);
    expect(reloaded.scenes.some((scene) => scene.name === 'Bad Bunny')).toBe(true);
    expect(reloaded.activeSceneId).toBe('scene-69');
  });

  it('preserves the output config across a save/load round-trip', () => {
    // serializeProject previously stripped `output`, so the file never carried
    // it and a reload reset the output window to DEFAULT_OUTPUT_CONFIG. The
    // round-trip must keep the authored output so resolveProjectOutputConfig
    // (project-wins) can re-apply it on load.
    const project = JSON.parse(JSON.stringify(DEFAULT_PROJECT));
    project.output = { ...project.output, scale: 0.5, fullscreen: true, enabled: true };

    const reloaded = deserializeProject(serializeProject(project));

    expect(reloaded.output.scale).toBe(0.5);
    expect(reloaded.output.fullscreen).toBe(true);
    expect(reloaded.output.enabled).toBe(true);
  });

  it('loads legacy projects with array-shaped effects blocks', () => {
    const legacy = JSON.parse(JSON.stringify(DEFAULT_PROJECT));
    legacy.effects = [
      {
        enabled: true,
        bloom: 0,
        blur: 0,
        chroma: 0,
        posterize: 0,
        kaleidoscope: 0,
        feedback: 0,
        persistence: 0
      }
    ];
    legacy.scenes = legacy.scenes.map((scene: any) => ({
      ...scene,
      look: {
        ...(scene.look ?? {}),
        effects: [
          {
            enabled: true,
            bloom: 0,
            blur: 0,
            chroma: 0,
            posterize: 0,
            kaleidoscope: 0,
            feedback: 0,
            persistence: 0
          }
        ]
      }
    }));

    const reloaded = deserializeProject(JSON.stringify(legacy));

    expect(Array.isArray(reloaded.effects)).toBe(false);
    expect(reloaded.effects.enabled).toBe(true);
    expect(Array.isArray(reloaded.scenes[0].look?.effects)).toBe(false);
    expect(reloaded.scenes[0].look?.effects?.enabled).toBe(true);
  });
});

describe('asset-layer blend/audio-react persistence', () => {
  it('preserves assetLayerBlendModes and assetLayerAudioReact across a save/load round-trip', () => {
    const project = JSON.parse(JSON.stringify(DEFAULT_PROJECT));
    project.assetLayerBlendModes = { 'layer-plasma': 4, 'layer-media': 2 };
    project.assetLayerAudioReact = { 'layer-spectrum': 0.25 };

    const reloaded = deserializeProject(serializeProject(project));

    expect(reloaded.assetLayerBlendModes).toEqual({ 'layer-plasma': 4, 'layer-media': 2 });
    expect(reloaded.assetLayerAudioReact).toEqual({ 'layer-spectrum': 0.25 });
  });

  it('omits the fields when the source project does not set them (no churn for legacy projects)', () => {
    const project = JSON.parse(JSON.stringify(DEFAULT_PROJECT));
    delete project.assetLayerBlendModes;
    delete project.assetLayerAudioReact;

    const reloaded = deserializeProject(serializeProject(project));

    // Optional with no default: absent stays absent, so old projects do not
    // gain a spurious {} key on load.
    expect(reloaded.assetLayerBlendModes).toBeUndefined();
    expect(reloaded.assetLayerAudioReact).toBeUndefined();
  });
});
