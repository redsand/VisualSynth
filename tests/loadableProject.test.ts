import { describe, expect, it } from 'vitest';
import { resolveLoadableProject, resolveLoadableProjectPayload } from '../src/renderer/loadableProject';
import { DEFAULT_PROJECT } from '../src/shared/project';

describe('resolveLoadableProject', () => {
  it('normalizes a valid project into runtime-safe shape', () => {
    const project = JSON.parse(JSON.stringify(DEFAULT_PROJECT));
    project.palettes = [];
    project.activePaletteId = '';

    const result = resolveLoadableProject(project);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected valid project');
    expect(result.name).toBe(DEFAULT_PROJECT.name);
    expect(result.project.palettes.length).toBeGreaterThan(0);
    expect(result.project.activePaletteId).toBe(result.project.palettes[0].id);
  });

  it('returns a stable display name and formatted error detail for invalid input', () => {
    const result = resolveLoadableProject({
      metadata: { name: 'Broken Import' },
      version: 'bad-data'
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected invalid project');
    expect(result.name).toBe('Broken Import');
    expect(result.errorDetail).toContain('version');
  });

  it('parses and normalizes serialized project payloads', () => {
    const payload = JSON.stringify(DEFAULT_PROJECT);

    const result = resolveLoadableProjectPayload(payload);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected valid payload');
    expect(result.project.name).toBe(DEFAULT_PROJECT.name);
    expect(result.project.activeSceneId).toBe(DEFAULT_PROJECT.activeSceneId);
  });

  it('returns parse detail for malformed serialized payloads', () => {
    const result = resolveLoadableProjectPayload('{not-json');

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected invalid payload');
    expect(result.errorDetail).toContain('Expected property name');
  });
});
