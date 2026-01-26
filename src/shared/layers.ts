import { SceneConfig } from './project';

export const reorderLayers = (scene: SceneConfig, from: number, to: number) => {
  if (from < 0 || to < 0 || from >= scene.layers.length || to >= scene.layers.length) {
    return scene.layers;
  }
  const updated = [...scene.layers];
  const [moved] = updated.splice(from, 1);
  updated.splice(to, 0, moved);
  return updated;
};
