import { describe, expect, it } from 'vitest';
import { DEFAULT_PROJECT } from '../src/shared/project';
import { projectSchema } from '../src/shared/projectSchema';
import { pluginManifestSchema } from '../src/shared/pluginSchema';

describe('plugin defaults', () => {
  it('defaults to empty plugins array', () => {
    expect(DEFAULT_PROJECT.plugins.length).toBe(0);
  });

  it('schema supplies plugins when missing', () => {
    const { plugins, ...rest } = DEFAULT_PROJECT;
    const parsed = projectSchema.safeParse(rest);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.plugins.length).toBe(0);
  });

  it('validates plugin manifest shape', () => {
    const parsed = pluginManifestSchema.safeParse({
      id: 'test-plugin',
      name: 'Test Plugin',
      version: '1.0.0',
      author: 'Tester',
      kind: 'generator',
      entry: './index.js'
    });
    expect(parsed.success).toBe(true);
  });
});
