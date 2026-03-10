import type { VisualSynthProject, SceneConfig } from './project';
import { GENERATORS } from './generatorLibrary';

const GENERATOR_ID_SET = new Set<string>(GENERATORS.map(g => g.id));

/**
 * Scans all scenes in a project and returns the Set of generator IDs
 * that appear in at least one layer across any scene.
 * Only IDs present in the GENERATORS registry are included.
 */
export const collectActiveGeneratorIds = (project: VisualSynthProject): Set<string> => {
  const result = new Set<string>();
  for (const scene of project.scenes) {
    for (const layer of scene.layers) {
      const gid = layer.generatorId ?? layer.id;
      if (GENERATOR_ID_SET.has(gid)) {
        result.add(gid);
      }
    }
  }
  return result;
};

/**
 * Returns the Set of generator IDs present in a single scene's layers.
 * Only IDs present in the GENERATORS registry are included.
 */
export const collectSceneGeneratorIds = (scene: SceneConfig): Set<string> => {
  const result = new Set<string>();
  for (const layer of scene.layers) {
    const gid = layer.generatorId ?? layer.id;
    if (GENERATOR_ID_SET.has(gid)) result.add(gid);
  }
  return result;
};
