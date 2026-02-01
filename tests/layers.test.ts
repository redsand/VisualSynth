import { describe, expect, it } from 'vitest';
import { reorderLayers, removeLayer, ensureLayerWithDefaults } from '../src/shared/layers';
import { DEFAULT_PROJECT } from '../src/shared/project';
import { actions } from '../src/renderer/state/actions';
import { createInitialState, createStore } from '../src/renderer/state/store';

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

describe('ensureLayerWithDefaults', () => {
  it('adds missing layer using default template when available', () => {
    const scene = JSON.parse(JSON.stringify(DEFAULT_PROJECT.scenes[0]));
    scene.layers = scene.layers.filter((layer: any) => layer.id !== 'layer-spectrum');
    const added = ensureLayerWithDefaults(scene, 'layer-spectrum', 'Spectrum Bars');
    expect(added.id).toBe('layer-spectrum');
    expect(added.opacity).toBe(DEFAULT_PROJECT.scenes[0].layers.find((l) => l.id === 'layer-spectrum')?.opacity);
  });
});

describe('actions.ensureLayer', () => {
  it('creates missing plasma/spectrum layers with defaults', () => {
    const state = createInitialState();
    state.project.scenes[0].layers = state.project.scenes[0].layers.filter(
      (layer) => layer.id !== 'layer-plasma' && layer.id !== 'layer-spectrum'
    );
    const store = createStore(state);
    const plasma = actions.ensureLayer(store, 'layer-plasma');
    const spectrum = actions.ensureLayer(store, 'layer-spectrum');
    expect(plasma?.id).toBe('layer-plasma');
    expect(spectrum?.id).toBe('layer-spectrum');
    expect(plasma?.blendMode).toBe('screen');
    expect(spectrum?.blendMode).toBe('add');
  });
});
