import { describe, expect, it } from 'vitest';
import { DEFAULT_PROJECT } from '../src/shared/project';
import { projectSchema } from '../src/shared/projectSchema';

describe('modulator defaults', () => {
  it('includes default LFOs, envelopes, and sample & hold', () => {
    expect(DEFAULT_PROJECT.lfos.length).toBe(4);
    expect(DEFAULT_PROJECT.envelopes.length).toBe(4);
    expect(DEFAULT_PROJECT.sampleHold.length).toBe(2);
  });

  it('schema supplies defaults when missing', () => {
    const { lfos, envelopes, sampleHold, ...rest } = DEFAULT_PROJECT;
    const parsed = projectSchema.safeParse(rest);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.lfos.length).toBe(4);
    expect(parsed.data.envelopes.length).toBe(4);
    expect(parsed.data.sampleHold.length).toBe(2);
  });
});
