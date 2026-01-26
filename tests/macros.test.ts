import { describe, expect, it } from 'vitest';
import { DEFAULT_PROJECT } from '../src/shared/project';
import { projectSchema } from '../src/shared/projectSchema';

describe('macro defaults', () => {
  it('includes 8 macros', () => {
    expect(DEFAULT_PROJECT.macros.length).toBe(8);
  });

  it('applies defaults when missing', () => {
    const { macros, ...rest } = DEFAULT_PROJECT;
    const parsed = projectSchema.safeParse(rest);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.macros.length).toBe(8);
  });
});
