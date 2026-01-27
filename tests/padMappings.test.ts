import { describe, expect, it } from 'vitest';
import { DEFAULT_PROJECT } from '../src/shared/project';
import { projectSchema } from '../src/shared/projectSchema';

describe('pad mappings', () => {
  it('defaults to 256 pad slots', () => {
    expect(DEFAULT_PROJECT.padMappings.length).toBe(256);
  });

  it('defaults map first bank actions', () => {
    expect(DEFAULT_PROJECT.padMappings[0]).toBe('toggle-plasma');
    expect(DEFAULT_PROJECT.padMappings[31]).toBe('toggle-plasma');
    expect(DEFAULT_PROJECT.padMappings[32]).toBe('strobe');
    expect(DEFAULT_PROJECT.padMappings[63]).toBe('strobe');
    expect(DEFAULT_PROJECT.padMappings[64]).toBe('origami-mountain');
  });

  it('schema supplies pad mappings when missing', () => {
    const { padMappings, ...rest } = DEFAULT_PROJECT;
    const parsed = projectSchema.safeParse(rest);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.padMappings.length).toBe(256);
  });
});
