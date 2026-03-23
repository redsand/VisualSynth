import type { VisualSynthProject, SceneConfig } from '../shared/project';
import type { CustomShaderBlock } from '../shared/customShaderBlock';
import { collectSceneGeneratorIds } from '../shared/shaderUtils';

export interface ShaderCompiler {
  recompileForGenerators: (activeIds: Set<string>, customBlocks?: CustomShaderBlock[], forceSync?: boolean, fxUniforms?: string) => boolean;
  precompileVariant: (ids: Set<string>, fxUniforms?: string) => void;
  setCustomShaderBlocks?: (blocks: CustomShaderBlock[]) => void;
}

export const getActiveScene = (project: VisualSynthProject): SceneConfig | undefined =>
  project.scenes.find((scene) => scene.id === project.activeSceneId) ?? project.scenes[0];

export const compileSceneShaders = (
  renderer: ShaderCompiler,
  scene: SceneConfig | undefined,
  customBlocks: CustomShaderBlock[] = [],
  sdfEnabled = false,
  forceSync = false,
  fxUniforms = ''
): number => {
  const activeIds = scene ? collectSceneGeneratorIds(scene) : new Set<string>();
  if (sdfEnabled) {
    activeIds.add('gen-sdf');
  }
  renderer.setCustomShaderBlocks?.(customBlocks);
  renderer.recompileForGenerators(activeIds, customBlocks, forceSync, fxUniforms);
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
  // queueSceneVariantPrecompile is now handled by SceneCacheWarmer
  return activeGeneratorCount;
};

export const queueSceneVariantPrecompile = (
  renderer: ShaderCompiler,
  scenes: SceneConfig[],
  initialDelayMs: number
) => {
  const scenesToPrecompile = [...scenes];
  const precompileNext = (index: number) => {
    if (index >= scenesToPrecompile.length) return;
    const ids = collectSceneGeneratorIds(scenesToPrecompile[index]);
    renderer.precompileVariant(ids);
    setTimeout(() => precompileNext(index + 1), 150);
  };
  setTimeout(() => precompileNext(0), initialDelayMs);
};
