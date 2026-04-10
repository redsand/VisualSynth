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
});
