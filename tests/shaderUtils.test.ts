import { describe, expect, it } from 'vitest';
import { collectActiveGeneratorIds, collectSceneGeneratorIds } from '../src/shared/shaderUtils';
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

  it('collects generatorId when layer.id is a UUID and generatorId is the generator type', () => {
    // This is the real-world LayerConfig shape: id is a UUID, generatorId is the generator type
    const generatorType = validGeneratorIds[0];
    const project: VisualSynthProject = {
      ...makeProject([]),
      scenes: [{
        id: 'scene-1',
        name: 'Scene 1',
        layers: [{
          id: 'xxxxxxxx-uuid-0000-0000-000000000001',
          name: 'My Layer',
          enabled: true,
          role: 'support' as const,
          opacity: 1,
          blendMode: 'normal' as const,
          transform: { x: 0, y: 0, scale: 1, rotation: 0 },
          generatorId: generatorType,
        }],
      }],
    } as unknown as VisualSynthProject;
    const result = collectActiveGeneratorIds(project);
    expect(result.has(generatorType)).toBe(true);
    // UUID should NOT be treated as a generator id
    expect(result.has('xxxxxxxx-uuid-0000-0000-000000000001')).toBe(false);
  });

  it('maps imported Milkwave layer ids onto the registered generator id', () => {
    const project = makeProject([['layer-milkwave', 'layer-milkwave-effects']]);
    const result = collectActiveGeneratorIds(project);
    expect(result.has('gen-milkwave')).toBe(true);
    expect(result.size).toBe(1);
  });

  it('excludes visualizer and effect placeholder ids from shader collection', () => {
    const project = makeProject([['layer-plasma', 'viz-spectrum', 'fx-bloom']]);
    const result = collectActiveGeneratorIds(project);
    expect(result.has('layer-plasma')).toBe(true);
    expect(result.has('viz-spectrum')).toBe(false);
    expect(result.has('fx-bloom')).toBe(false);
    expect(result.size).toBe(1);
  });

  it('ignores disabled layers when collecting project-wide generator ids', () => {
    const project = makeProject([['layer-plasma', 'layer-spectrum'], ['layer-glyph', 'layer-crystal']]);
    project.scenes[0].layers[0].enabled = false;
    project.scenes[1].layers[0].enabled = false;

    const result = collectActiveGeneratorIds(project);

    expect([...result].sort()).toEqual(['layer-crystal', 'layer-spectrum']);
  });
});

describe('collectSceneGeneratorIds', () => {
  it('maps imported Milkwave layer ids onto the registered generator id', () => {
    const scene = makeProject([['layer-milkwave']]).scenes[0];
    const result = collectSceneGeneratorIds(scene);
    expect(result.has('gen-milkwave')).toBe(true);
    expect(result.size).toBe(1);
  });

  it('excludes non-rendering visualizer and effect placeholders', () => {
    const scene = makeProject([['viz-waveform', 'fx-feedback', 'gen-lightning']]).scenes[0];
    const result = collectSceneGeneratorIds(scene);
    expect(result.has('viz-waveform')).toBe(false);
    expect(result.has('fx-feedback')).toBe(false);
    expect(result.has('gen-lightning')).toBe(true);
    expect(result.size).toBe(1);
  });

  it('ignores disabled layers when collecting scene generator ids', () => {
    const scene = makeProject([['layer-plasma', 'layer-spectrum', 'layer-glyph']]).scenes[0];
    scene.layers[0].enabled = false;
    scene.layers[2].enabled = false;

    const result = collectSceneGeneratorIds(scene);

    expect([...result]).toEqual(['layer-spectrum']);
  });
});
