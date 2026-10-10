import { describe, it, expect } from 'vitest';
import {
  applySlideshowDefaults,
  filterPresetsForPicker,
  advanceSlideshowOnSongChange,
  SLIDESHOW_DEFAULT_DURATION_MS
} from '../src/shared/slideshow';
import type { PresetIndexEntry } from '../src/shared/presetIndex';
import type { SceneConfig } from '../src/shared/project';

const makeScene = (overrides: Partial<SceneConfig> = {}): SceneConfig => ({
  id: 'scene-1',
  name: 'Scene 1',
  layers: [],
  ...overrides
});

const makeEntry = (name: string, path: string, searchText = ''): PresetIndexEntry => ({
  name,
  path,
  category: 'Test',
  primaryCategory: 'Test',
  subcategory: 'Test',
  visualFamilies: [],
  useCases: ['bridge'],
  energy: 'medium',
  density: 'balanced',
  motion: 'static',
  sourceDependency: 'none',
  riskFlags: [],
  sceneCount: 1,
  searchText: searchText || name.toLowerCase(),
  presetMode: 'live'
});

describe('applySlideshowDefaults', () => {
  it('converts a manual trigger to time and fills a zero duration', () => {
    const scene = applySlideshowDefaults(makeScene({ trigger: { type: 'manual' }, duration: 0 }));
    expect(scene.trigger?.type).toBe('time');
    expect(scene.duration).toBe(SLIDESHOW_DEFAULT_DURATION_MS);
  });

  it('applies defaults when trigger and duration are missing', () => {
    const scene = applySlideshowDefaults(makeScene());
    expect(scene.trigger?.type).toBe('time');
    expect(scene.duration).toBe(SLIDESHOW_DEFAULT_DURATION_MS);
  });

  it('preserves authored audio triggers and non-zero durations', () => {
    const scene = applySlideshowDefaults(
      makeScene({ trigger: { type: 'audio', threshold: 0.4, minIntervalMs: 5000 }, duration: 42000 })
    );
    expect(scene.trigger).toEqual({ type: 'audio', threshold: 0.4, minIntervalMs: 5000 });
    expect(scene.duration).toBe(42000);
  });

  it('preserves authored time triggers', () => {
    const scene = applySlideshowDefaults(makeScene({ trigger: { type: 'time' }, duration: 0 }));
    expect(scene.trigger).toEqual({ type: 'time' });
  });

  it('returns a copy without mutating the input', () => {
    const input = makeScene({ trigger: { type: 'manual' }, duration: 0 });
    applySlideshowDefaults(input);
    expect(input.trigger?.type).toBe('manual');
    expect(input.duration).toBe(0);
  });

  it('honors a custom default duration', () => {
    const scene = applySlideshowDefaults(makeScene({ duration: 0 }), 5000);
    expect(scene.duration).toBe(5000);
  });
});

describe('filterPresetsForPicker', () => {
  const entries = [
    makeEntry('Laser Storm', '/presets/laser.json'),
    makeEntry('Calm Drift', '/presets/drift.json'),
    makeEntry('Rain Fall', '/presets/rain.json', 'weather storm rain')
  ];

  it('matches on searchText case-insensitively', () => {
    const results = filterPresetsForPicker(entries, 'STORM', { favorites: [], recents: [] });
    // Laser Storm matches on name; Rain Fall's searchText contains 'storm'
    expect(results.map((entry) => entry.name)).toEqual(['Laser Storm', 'Rain Fall']);
  });

  it('matches on name case-insensitively', () => {
    const results = filterPresetsForPicker(entries, 'RAIN', { favorites: [], recents: [] });
    expect(results.map((entry) => entry.name)).toEqual(['Rain Fall']);
  });

  it('returns all entries for an empty query', () => {
    const results = filterPresetsForPicker(entries, '   ', { favorites: [], recents: [] });
    expect(results.length).toBe(3);
  });

  it('sorts favorites first, then recents, then name', () => {
    const results = filterPresetsForPicker(entries, '', {
      favorites: ['/presets/rain.json'],
      recents: ['/presets/drift.json']
    });
    // Rain (favorite), Drift (recent), then Laser by name
    expect(results.map((entry) => entry.path)).toEqual([
      '/presets/rain.json',
      '/presets/drift.json',
      '/presets/laser.json'
    ]);
  });

  it('returns an empty array when nothing matches', () => {
    expect(filterPresetsForPicker(entries, 'zzz-no-match', { favorites: [], recents: [] })).toEqual([]);
  });
});

describe('advanceSlideshowOnSongChange', () => {
  const scenes = new Map<string, SceneConfig>([
    ['scene-1', makeScene({ id: 'scene-1' })],
    ['scene-3', makeScene({ id: 'scene-3' })]
  ]);
  const resolve = (id: string) => scenes.get(id);

  it('cycles forward from the last index', () => {
    const result = advanceSlideshowOnSongChange(['scene-1', 'scene-3'], 0, resolve);
    expect(result.sceneId).toBe('scene-3');
    expect(result.nextIndex).toBe(1);
  });

  it('wraps around the end of the list', () => {
    const result = advanceSlideshowOnSongChange(['scene-1', 'scene-3'], 1, resolve);
    expect(result.sceneId).toBe('scene-1');
    expect(result.nextIndex).toBe(0);
  });

  it('starts at the first entry before any song change', () => {
    const result = advanceSlideshowOnSongChange(['scene-1', 'scene-3'], -1, resolve);
    expect(result.sceneId).toBe('scene-1');
    expect(result.nextIndex).toBe(0);
  });

  it('skips stale ids whose scene no longer exists', () => {
    const result = advanceSlideshowOnSongChange(['scene-gone', 'scene-3'], 0, resolve);
    expect(result.sceneId).toBe('scene-3');
    expect(result.nextIndex).toBe(1);
  });

  it('returns null for an empty list', () => {
    const result = advanceSlideshowOnSongChange([], -1, resolve);
    expect(result.sceneId).toBeNull();
    expect(result.nextIndex).toBe(-1);
  });

  it('returns null when every id is stale', () => {
    const result = advanceSlideshowOnSongChange(['scene-gone', 'scene-also-gone'], 0, resolve);
    expect(result.sceneId).toBeNull();
    expect(result.nextIndex).toBe(0);
  });
});