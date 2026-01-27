import { describe, expect, it } from 'vitest';
import { DEFAULT_PROJECT } from '../src/shared/project';
import { projectSchema } from '../src/shared/projectSchema';

describe('effects defaults', () => {
  it('default project has effects config', () => {
    expect(DEFAULT_PROJECT.effects).toBeTruthy();
    expect(DEFAULT_PROJECT.effects.enabled).toBe(true);
  });

  it('default project has particle + sdf config', () => {
    expect(DEFAULT_PROJECT.particles).toBeTruthy();
    expect(DEFAULT_PROJECT.particles.enabled).toBe(true);
    expect(DEFAULT_PROJECT.sdf).toBeTruthy();
    expect(DEFAULT_PROJECT.sdf.shape).toBe('triangle');
  });

  it('schema supplies effect defaults', () => {
    const { effects, particles, sdf, ...rest } = DEFAULT_PROJECT;
    const parsed = projectSchema.safeParse(rest);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.effects.enabled).toBe(true);
    expect(parsed.data.effects.feedback).toBeDefined();
    expect(parsed.data.effects.persistence).toBeDefined();
    expect(parsed.data.particles.enabled).toBe(true);
    expect(parsed.data.sdf.shape).toBe('triangle');
  });
});
