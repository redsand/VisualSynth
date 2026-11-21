import fs from 'fs';
import { describe, expect, it } from 'vitest';
import { resolveLoadableProject } from '../src/renderer/loadableProject';

const base = () => JSON.parse(fs.readFileSync('showcase-unique-100.project.json', 'utf8'));

describe('project load salvage', () => {
  it('loads the rest of the project when one scene is malformed', () => {
    const p = base();
    const bad = p.scenes[3];
    bad._shaderData.originalParameters.SpriteName = 'sprites\\Organoids1.jpg'; // string where a number is required
    const r = resolveLoadableProject(p);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.project.scenes.length).toBe(p.scenes.length - 1);
      expect(r.skippedScenes).toEqual([bad.name]);
    }
  });

  it('still refuses a project whose problem is not inside a scene', () => {
    const p = base();
    p.version = 'not-a-number';
    expect(resolveLoadableProject(p).ok).toBe(false);
  });

  it('loads a valid project with nothing skipped', () => {
    const r = resolveLoadableProject(base());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.skippedScenes).toBeUndefined();
  });
});
