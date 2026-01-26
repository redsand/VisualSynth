import { describe, expect, it } from 'vitest';
import { DEFAULT_PROJECT } from '../src/shared/project';
import { projectSchema } from '../src/shared/projectSchema';

describe('timeline markers', () => {
  it('defaults to empty array', () => {
    expect(DEFAULT_PROJECT.timelineMarkers.length).toBe(0);
  });

  it('schema supplies default markers', () => {
    const { timelineMarkers, ...rest } = DEFAULT_PROJECT;
    const parsed = projectSchema.safeParse(rest);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.timelineMarkers.length).toBe(0);
  });
});
