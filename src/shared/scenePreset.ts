import { DEFAULT_SCENE_TRANSITION, SceneConfig, VisualSynthProject } from './project';

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const normalizeScene = (scene: SceneConfig): SceneConfig => ({
  ...cloneJson(scene),
  scene_id: scene.scene_id ?? scene.id,
  transition_in: { ...DEFAULT_SCENE_TRANSITION, ...(scene.transition_in ?? {}) },
  transition_out: { ...DEFAULT_SCENE_TRANSITION, ...(scene.transition_out ?? {}) }
});

export const createScenePreset = (project: VisualSynthProject, sceneId: string) => {
  const scene = project.scenes.find((entry) => entry.id === sceneId);
  if (!scene) {
    throw new Error('Scene not found');
  }

  const normalizedScene = normalizeScene(scene);
  const referencedAssetIds = new Set(
    normalizedScene.layers
      .map((layer) => layer.assetId)
      .filter((assetId): assetId is string => typeof assetId === 'string' && assetId.length > 0)
  );

  const presetAssets = cloneJson(
    project.assets.filter((asset) => asset.kind === 'internal' || referencedAssetIds.has(asset.id))
  );
  const presetProject = cloneJson(project);
  presetProject.scenes = [normalizedScene];
  presetProject.activeSceneId = normalizedScene.id;
  presetProject.assets = presetAssets;

  return {
    version: 6 as const,
    metadata: {
      version: 6 as const,
      name: normalizedScene.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      category: 'Scene Preset',
      compatibility: {
        minVersion: '1.4.0'
      },
      presetType: 'scene' as const,
      intendedMusicStyle: project.intendedMusicStyle || 'Any',
      visualIntentTags: cloneJson(project.visualIntentTags ?? []),
      colorChemistry: cloneJson(project.colorChemistry ?? ['analog', 'balanced']),
      defaultTransition: cloneJson(normalizedScene.transition_in ?? DEFAULT_SCENE_TRANSITION),
      activeModeId: project.activeModeId ?? '',
      activeEngineId: project.activeEngineId ?? ''
    },
    scenes: [normalizedScene],
    activeSceneId: normalizedScene.id,
    assets: presetAssets,
    roleWeights: cloneJson(project.roleWeights),
    tempoSync: cloneJson(project.tempoSync),
    modulations: cloneJson(
      (project.modMatrix ?? []).map((mod) => ({
        source: mod.source,
        target: mod.target,
        amount: mod.amount,
        min: mod.min,
        max: mod.max,
        curve: mod.curve,
        smoothing: mod.smoothing,
        bipolar: mod.bipolar
      }))
    ),
    macros: cloneJson(project.macros ?? []),
    project: presetProject
  };
};
