import { Layer, Scene } from "./project";

export const reorderLayers = (scene: Scene, from: number, to: number) => {
    const { layers } = scene;
    if (from < 0 || from >= layers.length || to < 0 || to >= layers.length) {
        return layers;
    }
    const next = [...layers];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
    }

export const removeLayer = (scene: Scene, layerId: string) => {
    const { layers } = scene;
    const index = layers.findIndex((layer) => layer.id === layerId);
    if (index < 0) {
        return layers;
    }
    const next = [...layers];
    next.splice(index, 1);
    return next;
    }