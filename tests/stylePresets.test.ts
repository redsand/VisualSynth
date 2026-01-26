import { describe, expect, it } from 'vitest';
import { projectSchema } from '../src/shared/projectSchema';
import { DEFAULT_PROJECT } from '../src/shared/project';

describe('style presets', () => {
  it('defaults include style presets', () => {
    const parsed = projectSchema.safeParse(DEFAULT_PROJECT);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.stylePresets.length).toBeGreaterThan(0);
    expect(parsed.data.activeStylePresetId).toBeTruthy();
  });

  it('applies defaults when missing', () => {
    const { stylePresets, activeStylePresetId, ...rest } = DEFAULT_PROJECT;
    const parsed = projectSchema.safeParse(rest);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.stylePresets.length).toBeGreaterThan(0);
  });
});
