import { describe, expect, it } from 'vitest';
import { DEFAULT_PROJECT } from '../src/shared/project';
import { syncActiveSceneLookSection } from '../src/shared/sceneLookSync';

describe('syncActiveSceneLookSection', () => {
  it('persists effect changes onto the active scene look', () => {
    const project = JSON.parse(JSON.stringify(DEFAULT_PROJECT));
    project.activeSceneId = project.scenes[0].id;
    project.effects = { ...project.effects, enabled: false, bloom: 0.91 };

    syncActiveSceneLookSection(project, 'effects', project.effects as any);

    expect(project.scenes[0].look?.effects).toEqual(project.effects);
  });

  it('persists other scene-bound sections without sharing references', () => {
    const project = JSON.parse(JSON.stringify(DEFAULT_PROJECT));
    project.activeSceneId = project.scenes[0].id;
    project.particles = { ...project.particles, glow: 0.12 };

    syncActiveSceneLookSection(project, 'particles', project.particles);
    project.particles.glow = 0.88;

    expect(project.scenes[0].look?.particles?.glow).toBe(0.12);
  });
});
