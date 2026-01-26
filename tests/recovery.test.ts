import { describe, expect, it } from 'vitest';
import { deserializeProject, serializeProject } from '../src/shared/serialization';
import { DEFAULT_PROJECT } from '../src/shared/project';

describe('session recovery serialization', () => {
  it('round-trips recovery payload', () => {
    const payload = serializeProject(DEFAULT_PROJECT);
    const parsed = deserializeProject(payload);
    expect(parsed.name).toBe(DEFAULT_PROJECT.name);
  });
});
