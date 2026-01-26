import { describe, expect, it } from 'vitest';
import { DEFAULT_PROJECT } from '../src/shared/project';
import { projectSchema } from '../src/shared/projectSchema';

describe('asset manager defaults', () => {
  it('starts with no assets', () => {
    expect(DEFAULT_PROJECT.assets.length).toBe(0);
  });

  it('schema supplies asset defaults', () => {
    const { assets, ...rest } = DEFAULT_PROJECT;
    const parsed = projectSchema.safeParse(rest);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.assets.length).toBe(0);
  });
});
