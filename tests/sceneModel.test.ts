import { describe, it, expect } from 'vitest';
import { projectSchema } from '../src/shared/projectSchema';
import { DEFAULT_PROJECT, DEFAULT_SCENE_TRANSITION } from '../src/shared/project';
import { deserializeProject } from '../src/shared/serialization';

const makeLegacyScene = () => ({
  id: 'scene-legacy',
  name: 'Legacy',
  layers: [
    {
      id: 'layer-plasma',
      name: 'Plasma',
      enabled: true,
      opacity: 0.7,
      blendMode: 'screen',
      transform: { x: 0, y: 0, scale: 1, rotation: 0 }
    }
  ]
});

describe('Scene model defaults + migrations', () => {
  it('fills default scene fields via schema', () => {
    const project = {
      ...DEFAULT_PROJECT,
      scenes: [makeLegacyScene()]
    };
    const parsed = projectSchema.parse(project);
    const scene = parsed.scenes[0];
    expect(scene.scene_id ?? scene.id).toBe(scene.id);
    expect(scene.intent).toBe('ambient');
    expect(scene.duration).toBe(0);
    expect(scene.transition_in?.durationMs).toBe(DEFAULT_SCENE_TRANSITION.durationMs);
    expect(scene.transition_out?.curve).toBe(DEFAULT_SCENE_TRANSITION.curve);
    expect(scene.assigned_layers).toBeTruthy();
    expect(scene.layers[0].role).toBeDefined();
  });

  it('deserializeProject upgrades legacy scene fields', () => {
    const legacy = {
      ...DEFAULT_PROJECT,
      version: 2,
      scenes: [makeLegacyScene()]
    };
    const payload = JSON.stringify(legacy);
    const upgraded = deserializeProject(payload);
    const scene = upgraded.scenes[0];
    expect(upgraded.version).toBeGreaterThanOrEqual(3);
    expect(scene.scene_id).toBe(scene.id);
    expect(scene.intent).toBe('ambient');
    expect(scene.transition_in?.durationMs).toBe(DEFAULT_SCENE_TRANSITION.durationMs);
  });
});
