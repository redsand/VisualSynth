import { describe, expect, it } from 'vitest';
import { reorderLayers } from '../src/shared/layers';
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
