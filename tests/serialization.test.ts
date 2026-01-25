import { describe, expect, it } from 'vitest';
import { DEFAULT_PROJECT } from '../src/shared/project';
import { deserializeProject, serializeProject } from '../src/shared/serialization';

describe('project serialization', () => {
  it('serializes and deserializes a project', () => {
    const payload = serializeProject(DEFAULT_PROJECT);
    const project = deserializeProject(payload);
    expect(project.name).toBe(DEFAULT_PROJECT.name);
  });
});
