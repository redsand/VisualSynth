import { LayerConfig, SceneConfig } from './project';

export const reorderLayers = (scene: SceneConfig, from: number, to: number) => {
  const { layers } = scene;
  if (from < 0 || from >= layers.length || to < 0 || to >= layers.length) {
    return layers;
  }
  const next = [...layers];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
};

export const removeLayer = (scene: SceneConfig, layerId: string) => {
  const { layers } = scene;
  const index = layers.findIndex((layer: any) => layer.id === layerId);
  if (index < 0) {
    return layers;
  }
  const next = [...layers];
  next.splice(index, 1);
  return next;
};