import { describe, expect, it } from 'vitest';
import { GENERATORS, getVisibleGenerators, toggleFavorite, updateRecents } from '../src/shared/generatorLibrary';

describe('generator library helpers', () => {
  it('updates recents with latest first', () => {
    expect(updateRecents(['layer-plasma'], 'layer-spectrum', 5)).toEqual([
      'layer-spectrum',
      'layer-plasma'
    ]);
  });

  it('limits recents length', () => {
    const recents = updateRecents(
      ['layer-plasma', 'layer-spectrum', 'layer-plasma', 'layer-spectrum'],
      'layer-plasma',
      1
    );
    expect(recents.length).toBe(1);
  });

  it('toggles favorites', () => {
    expect(toggleFavorite(['layer-plasma'], 'layer-plasma')).toEqual([]);
    expect(toggleFavorite([], 'layer-spectrum')).toEqual(['layer-spectrum']);
  });

  it('keeps import-only generators out of the visible library', () => {
    expect(GENERATORS.some((entry) => entry.id === 'gen-milkwave')).toBe(true);
    expect(getVisibleGenerators().some((entry) => entry.id === 'gen-milkwave')).toBe(false);
  });
});
