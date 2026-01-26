import { describe, expect, it } from 'vitest';
import { DEFAULT_PROJECT } from '../src/shared/project';
import { mergeProjectSections } from '../src/shared/projectMerge';

describe('mergeProjectSections', () => {
  it('keeps base sections when not selected', () => {
    const incoming = {
      ...DEFAULT_PROJECT,
      name: 'Incoming',
      output: { ...DEFAULT_PROJECT.output, scale: 0.5 }
    };
    const merged = mergeProjectSections(DEFAULT_PROJECT, incoming, {
      metadata: false,
      output: false,
      stylePresets: false,
      macros: false,
      effects: false,
      particles: false,
      sdf: false,
      lfos: false,
      envelopes: false,
      sampleHold: false,
      scenes: false,
      modMatrix: false,
      midiMappings: false,
      padMappings: false,
      timelineMarkers: false,
      assets: false,
      plugins: false
    });
    expect(merged.name).toBe(DEFAULT_PROJECT.name);
    expect(merged.output.scale).toBe(DEFAULT_PROJECT.output.scale);
  });

  it('applies selected sections from incoming', () => {
    const incoming = {
      ...DEFAULT_PROJECT,
      name: 'Incoming',
      macros: [{ ...DEFAULT_PROJECT.macros[0], name: 'Changed' }]
    };
    const merged = mergeProjectSections(DEFAULT_PROJECT, incoming, {
      metadata: true,
      output: false,
      stylePresets: false,
      macros: true,
      effects: false,
      particles: false,
      sdf: false,
      lfos: false,
      envelopes: false,
      sampleHold: false,
      scenes: false,
      modMatrix: false,
      midiMappings: false,
      padMappings: false,
      timelineMarkers: false,
      assets: false,
      plugins: false
    });
    expect(merged.name).toBe('Incoming');
    expect(merged.macros[0].name).toBe('Changed');
  });
});
