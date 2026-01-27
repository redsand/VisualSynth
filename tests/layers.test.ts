import { describe, expect, it } from 'vitest';
import { reorderLayers, removeLayer } from '../src/shared/layers';
import { DEFAULT_PROJECT } from '../src/shared/project';

describe('layer reordering', () => {
  it('reorders layers within bounds', () => {
    const scene = DEFAULT_PROJECT.scenes[0];
    const updated = reorderLayers(scene, 0, 1);
    expect(updated[0].id).toBe(scene.layers[1].id);
  });

  it('ignores out of bounds', () => {
    const scene = DEFAULT_PROJECT.scenes[0];
    const updated = reorderLayers(scene, -1, 1);
    expect(updated).toEqual(scene.layers);
  });
});

describe('layer removal', () => {
    it('removes a layer from a scene', () => {
        const scene = DEFAULT_PROJECT.scenes[0];
        const layerId = scene.layers[0].id;
        const updated = removeLayer(scene, layerId);
        expect(updated.length).toBe(scene.layers.length - 1);
        expect(updated.find((layer) => layer.id === layerId)).toBeUndefined();
    });
});
