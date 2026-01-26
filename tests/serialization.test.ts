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
    expect(upgraded.stylePresets.length).toBeGreaterThan(0);
    expect(upgraded.macros.length).toBeGreaterThan(0);
  });
});
