import { describe, expect, it } from 'vitest';
import { collectActiveGeneratorIds } from '../src/shared/shaderUtils';
import { GENERATORS } from '../src/shared/generatorLibrary';
import type { VisualSynthProject } from '../src/shared/project';

const makeProject = (layerIds: string[][]): VisualSynthProject =>
  ({
    activeSceneId: 'scene-1',
    scenes: layerIds.map((ids, i) => ({
      id: `scene-${i + 1}`,
      name: `Scene ${i + 1}`,
      layers: ids.map(id => ({ id, name: id, enabled: true, role: 'support', opacity: 1, params: {} }))
    })),
    palettes: [],
    activePaletteId: '',
    midiMappings: [],
    macros: [],
    stylePresets: [],
    envelopes: [],
  } as unknown as VisualSynthProject);

const validGeneratorIds = GENERATORS.map(g => g.id);

describe('collectActiveGeneratorIds', () => {
  it('returns empty set for project with no scenes', () => {
    const project = makeProject([]);
    const result = collectActiveGeneratorIds(project);
    expect(result.size).toBe(0);
  });

  it('returns empty set for scenes with no layers', () => {
    const project = makeProject([[], []]);
    const result = collectActiveGeneratorIds(project);
    expect(result.size).toBe(0);
  });

  it('collects generator ids from a single scene', () => {
    const id = validGeneratorIds[0];
    const project = makeProject([[id]]);
    const result = collectActiveGeneratorIds(project);
    expect(result.has(id)).toBe(true);
  });

  it('collects generator ids from all scenes, not just the active one', () => {
    const id1 = validGeneratorIds[0];
    const id2 = validGeneratorIds[1];
    const project = makeProject([[id1], [id2]]);
    project.activeSceneId = 'scene-1'; // only scene-1 is active
    const result = collectActiveGeneratorIds(project);
    expect(result.has(id1)).toBe(true);
    expect(result.has(id2)).toBe(true); // scene-2 still included
  });

  it('deduplicates generator ids that appear in multiple scenes', () => {
    const id = validGeneratorIds[0];
    const project = makeProject([[id], [id], [id]]);
    const result = collectActiveGeneratorIds(project);
    expect(result.size).toBe(1);
    expect(result.has(id)).toBe(true);
  });

  it('ignores layer ids that are not in the GENERATORS registry', () => {
    const unknownId = 'fx-reverb'; // effect layer, not a generator
    const project = makeProject([[unknownId]]);
    const result = collectActiveGeneratorIds(project);
    expect(result.has(unknownId)).toBe(false);
  });

  it('handles a mix of valid generator ids and non-generator ids', () => {
    const validId = validGeneratorIds[0];
    const project = makeProject([[validId, 'fx-reverb', 'some-effect']]);
    const result = collectActiveGeneratorIds(project);
    expect(result.has(validId)).toBe(true);
    expect(result.size).toBe(1);
  });

  it('returns a Set (not an array)', () => {
    const project = makeProject([[validGeneratorIds[0]]]);
    const result = collectActiveGeneratorIds(project);
    expect(result).toBeInstanceOf(Set);
  });
});
