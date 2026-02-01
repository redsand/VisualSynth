import { describe, it, expect } from 'vitest';
import { SceneManager, captureSceneSnapshot } from '../src/renderer/scene/SceneManager';
import { DEFAULT_PROJECT } from '../src/shared/project';

const makeProject = () => {
  const project = JSON.parse(JSON.stringify(DEFAULT_PROJECT));
  project.scenes = [
    {
      ...project.scenes[0],
      id: 'scene-a',
      scene_id: 'scene-a',
      name: 'Scene A',
      layers: [
        { ...project.scenes[0].layers[0], id: 'layer-plasma', opacity: 0.2, enabled: true }
      ]
    },
    {
      ...project.scenes[0],
      id: 'scene-b',
      scene_id: 'scene-b',
      name: 'Scene B',
      layers: [
        { ...project.scenes[0].layers[0], id: 'layer-plasma', opacity: 0.8, enabled: true }
      ]
    }
  ];
  project.activeSceneId = 'scene-a';
  return project;
};

describe('SceneManager blending', () => {
  it('blends layer opacity during transitions', () => {
    const project = makeProject();
    const manager = new SceneManager(() => project);
    const from = captureSceneSnapshot(project, 'scene-a');
    const to = captureSceneSnapshot(project, 'scene-b');
    expect(from && to).toBeTruthy();
    manager.startTransition(from!, to!, 0, 1000, 'linear');
    const mid = manager.getBlendSnapshot(500);
    expect(mid).toBeTruthy();
    const blended = mid!.scene.layers.find((layer) => layer.id === 'layer-plasma');
    expect(blended).toBeTruthy();
    expect(blended!.opacity).toBeGreaterThan(0.2);
    expect(blended!.opacity).toBeLessThan(0.8);
  });

  it('returns null when transition completes', () => {
    const project = makeProject();
    const manager = new SceneManager(() => project);
    const from = captureSceneSnapshot(project, 'scene-a');
    const to = captureSceneSnapshot(project, 'scene-b');
    manager.startTransition(from!, to!, 0, 100, 'linear');
    const done = manager.getBlendSnapshot(200);
    expect(done).toBeNull();
  });
});
