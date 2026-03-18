import type { VisualSynthProject, SceneConfig } from '../shared/project';
import type { CustomShaderBlock } from '../shared/customShaderBlock';
import { collectSceneGeneratorIds } from '../shared/shaderUtils';

export interface ShaderCompiler {
  recompileForGenerators: (activeIds: Set<string>, customBlocks?: CustomShaderBlock[]) => boolean;
  precompileVariant: (ids: Set<string>) => void;
  setCustomShaderBlocks?: (blocks: CustomShaderBlock[]) => void;
}

export const getActiveScene = (project: VisualSynthProject): SceneConfig | undefined =>
  project.scenes.find((scene) => scene.id === project.activeSceneId) ?? project.scenes[0];

export const compileSceneShaders = (
  renderer: ShaderCompiler,
  scene: SceneConfig | undefined,
  customBlocks: CustomShaderBlock[] = [],
  sdfEnabled = false
): number => {
  const activeIds = scene ? collectSceneGeneratorIds(scene) : new Set<string>();
  if (sdfEnabled) {
    activeIds.add('gen-sdf');
  }
  renderer.setCustomShaderBlocks?.(customBlocks);
  renderer.recompileForGenerators(activeIds, customBlocks);
  return activeIds.size;
};

export const compileActiveSceneShaders = (
  renderer: ShaderCompiler,
  project: VisualSynthProject
): number => compileSceneShaders(
  renderer,
  getActiveScene(project),
  project.customShaderBlocks ?? [],
  project.sdf?.enabled ?? false
);

export const primeProjectShaders = (
  renderer: ShaderCompiler,
  project: VisualSynthProject,
  initialDelayMs: number
): number => {
  const activeGeneratorCount = compileActiveSceneShaders(renderer, project);
  queueSceneVariantPrecompile(renderer, project.scenes, initialDelayMs);
  return activeGeneratorCount;
};

const MAX_PRECOMPILE_VARIANTS = 8;
const PRECOMPILE_INTERVAL_MS = 400;

export const queueSceneVariantPrecompile = (
  renderer: ShaderCompiler,
  scenes: SceneConfig[],
  initialDelayMs: number
) => {
  // Limit to first N scenes to avoid prolonged main-thread stalls in large projects.
  const scenesToPrecompile = scenes.slice(0, MAX_PRECOMPILE_VARIANTS);
  const precompileNext = (index: number) => {
    if (index >= scenesToPrecompile.length) return;
    const ids = collectSceneGeneratorIds(scenesToPrecompile[index]);
    renderer.precompileVariant(ids);
    setTimeout(() => precompileNext(index + 1), PRECOMPILE_INTERVAL_MS);
  };
  setTimeout(() => precompileNext(0), initialDelayMs);
};
