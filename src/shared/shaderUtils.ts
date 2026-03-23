import type { VisualSynthProject, SceneConfig } from './project';
import { GENERATORS } from './generatorLibrary';

const GENERATOR_ID_SET = new Set<string>(GENERATORS.map(g => g.id));
const NON_RENDERING_GENERATOR_PREFIXES = ['viz-'];
const GENERATOR_ID_ALIASES = new Map<string, string>([
  ['layer-milkwave', 'gen-milkwave'],
  ['layer-milkwave-effects', 'gen-milkwave']
]);

const isRenderableGeneratorId = (id: string): boolean =>
  !NON_RENDERING_GENERATOR_PREFIXES.some(prefix => id.startsWith(prefix));

const resolveGeneratorId = (rawId: string | undefined): string | null => {
  if (!rawId) return null;
  const normalized = GENERATOR_ID_ALIASES.get(rawId) ?? rawId;
  if (!GENERATOR_ID_SET.has(normalized)) return null;
  return isRenderableGeneratorId(normalized) ? normalized : null;
};

/**
 * Scans all scenes in a project and returns the Set of generator IDs
 * that appear in at least one layer across any scene.
 * Only IDs present in the GENERATORS registry are included.
 */
export const collectActiveGeneratorIds = (project: VisualSynthProject): Set<string> => {
  const result = new Set<string>();
  for (const scene of project.scenes) {
    const sceneIds = collectSceneGeneratorIds(scene);
    sceneIds.forEach(id => result.add(id));
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
    if (!layer.enabled) continue;
    const gid = resolveGeneratorId(layer.generatorId ?? layer.id);
    if (gid) result.add(gid);
  }

  return result;
};

/**
 * Produces GLSL uniform declarations for all FX in a scene and project.
 */
export const getFxUniformsDeclarations = (project: VisualSynthProject, scene: SceneConfig | null): string => {
  const params = ['bloom', 'chroma', 'blur', 'posterize'];
  let decls = '';
  const addDecls = (scope: string, instanceId: string) => {
    const prefix = `${scope}_${instanceId}`.replace(/:/g, '_').replace(/-/g, '_');
    params.forEach(param => {
      decls += `uniform float u${prefix}_${param};\n`;
    });
  };

  // Always add scene decls as they are used in mainTemplate
  addDecls('scene', 'scene_0');

  // Global
  if (project.effects) {
    addDecls('global', 'master');
  }

  // Layers
  if (scene?.layers) {
    scene.layers.forEach(layer => {
      const gid = resolveGeneratorId(layer.generatorId ?? layer.id);
      if (gid) {
        addDecls('layer', `${layer.id}_0`);
      }
    });
  }

  return decls;
};
