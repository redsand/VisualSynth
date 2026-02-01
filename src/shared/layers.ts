import { LayerConfig, SceneConfig, DEFAULT_PROJECT } from './project';

export const cloneLayerConfig = (layer: LayerConfig): LayerConfig => ({
  ...layer,
  transform: { ...layer.transform }
});

export const getDefaultLayerTemplate = (layerId: string) => {
  const templateScene = DEFAULT_PROJECT.scenes[0];
  return templateScene?.layers.find((layer) => layer.id === layerId) ?? null;
};

export const ensureLayerWithDefaults = (
  scene: SceneConfig,
  layerId: string,
  fallbackName: string
) => {
  let layer = scene.layers.find((item) => item.id === layerId);
  if (!layer) {
    const template = getDefaultLayerTemplate(layerId);
    if (template) {
      layer = cloneLayerConfig(template);
    } else {
      layer = {
        id: layerId,
        name: fallbackName,
        enabled: true,
        opacity: 0.8,
        blendMode: 'screen',
        transform: { x: 0, y: 0, scale: 1, rotation: 0 }
      };
    }
    scene.layers.push(layer);
  }
  return layer;
};

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
