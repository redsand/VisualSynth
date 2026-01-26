import { describe, expect, it } from 'vitest';
import { projectSchema } from '../src/shared/projectSchema';
import { DEFAULT_OUTPUT_CONFIG, DEFAULT_PROJECT } from '../src/shared/project';

describe('output config defaults', () => {
  it('fills output config when missing', () => {
    const { output, ...rest } = DEFAULT_PROJECT;
    const parsed = projectSchema.safeParse(rest);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.output).toEqual(DEFAULT_OUTPUT_CONFIG);
  });

  it('accepts explicit output config', () => {
    const parsed = projectSchema.safeParse({
      ...DEFAULT_PROJECT,
      output: {
        enabled: true,
        fullscreen: true,
        scale: 0.75
      }
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.output.enabled).toBe(true);
    expect(parsed.data.output.scale).toBe(0.75);
  });
});
