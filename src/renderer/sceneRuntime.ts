import type { SceneConfig, VisualSynthProject } from '../shared/project';
import { SceneManager, captureSceneSnapshot, type SceneSnapshot } from './scene/SceneManager';

export interface SceneVisualTransition {
  type: number;
  amount: number;
  decay: number;
}

export interface SceneBlendTransition {
  fromSnapshot: SceneSnapshot;
  toSnapshot: SceneSnapshot;
  durationMs: number;
  curve: string;
}

export interface SceneActivationRuntime {
  scene: SceneConfig;
  previousScene: SceneConfig | null;
  project: VisualSynthProject;
  paletteApplied: boolean;
  visualTransition: SceneVisualTransition | null;
  blendTransition: SceneBlendTransition | null;
}

export interface SceneActivationApplyDeps {
  transportTimeMs: number;
  onVisualTransition: (transition: SceneVisualTransition) => void;
  startBlendTransition: (
    fromSnapshot: SceneSnapshot,
    toSnapshot: SceneSnapshot,
    transportTimeMs: number,
    durationMs: number,
    curve: string
  ) => void;
  clearBlendTransition: () => void;
  markSceneActivated: (transportTimeMs: number) => void;
  setPaletteApplied: (applied: boolean) => void;
  compileSceneShaders?: (scene: SceneConfig, project: VisualSynthProject) => number;
  skipShaderWarmup?: boolean;
}

export interface SceneActivationApplyResult {
  activeGeneratorCount: number | null;
}

export const applySceneLookToProject = (
  project: VisualSynthProject,
  scene: SceneConfig
): VisualSynthProject => {
  const withActiveScene = { ...project, activeSceneId: scene.id };
  if (!scene.look) {
    return withActiveScene;
  }

  return {
    ...withActiveScene,
    effects: scene.look.effects ?? withActiveScene.effects,
    particles: scene.look.particles ?? withActiveScene.particles,
    sdf: scene.look.sdf ?? withActiveScene.sdf,
    visualizer: scene.look.visualizer ?? withActiveScene.visualizer,
    stylePresets: scene.look.stylePresets ?? withActiveScene.stylePresets,
    activeStylePresetId: scene.look.activeStylePresetId ?? withActiveScene.activeStylePresetId,
    palettes: scene.look.palettes ?? withActiveScene.palettes,
    activePaletteId: scene.look.activePaletteId ?? withActiveScene.activePaletteId,
    macros: scene.look.macros ?? withActiveScene.macros,
    modMatrix: scene.look.modMatrix ?? withActiveScene.modMatrix
  };
};

export const resolveSceneActivationRuntime = (
  project: VisualSynthProject,
  sceneId: string
): SceneActivationRuntime | null => {
  const scene = project.scenes.find((item) => item.id === sceneId);
  if (!scene) {
    return null;
  }

  const previousSceneId = project.activeSceneId;
  const previousScene = project.scenes.find((item) => item.id === previousSceneId) ?? null;
  const fromSnapshot = previousSceneId ? captureSceneSnapshot(project, previousSceneId) : null;

  let nextProject = { ...project, activeSceneId: sceneId };
  if (scene.look) {
    nextProject = applySceneLookToProject(nextProject, scene);
  }

  const toSnapshot = captureSceneSnapshot(nextProject, sceneId);
  let blendTransition: SceneBlendTransition | null = null;
  if (fromSnapshot && toSnapshot && previousSceneId !== sceneId) {
    const { durationMs, curve } = SceneManager.resolveTransitionDuration(previousScene, scene);
    blendTransition = {
      fromSnapshot,
      toSnapshot,
      durationMs,
      curve
    };
  }

  let visualTransition: SceneVisualTransition | null = null;
  if (scene.transition_in) {
    const typeMap: Record<string, number> = {
      fade: 1,
      crossfade: 1,
      warp: 2,
      glitch: 3,
      dissolve: 4
    };
    visualTransition = {
      type: typeMap[scene.transition_in.type || 'fade'] || 1,
      amount: 1.0,
      decay: 1.0 / (scene.transition_in.durationMs || 600)
    };
  }

  return {
    scene,
    previousScene,
    project: nextProject,
    paletteApplied: Boolean(scene.look?.activePaletteId),
    visualTransition,
    blendTransition
  };
};

export const applySceneActivationRuntime = (
  activation: SceneActivationRuntime,
  deps: SceneActivationApplyDeps
): SceneActivationApplyResult => {
  if (activation.visualTransition) {
    deps.onVisualTransition(activation.visualTransition);
  }

  if (activation.blendTransition) {
    deps.startBlendTransition(
      activation.blendTransition.fromSnapshot,
      activation.blendTransition.toSnapshot,
      deps.transportTimeMs,
      activation.blendTransition.durationMs,
      activation.blendTransition.curve
    );
  } else {
    deps.clearBlendTransition();
  }

  deps.markSceneActivated(deps.transportTimeMs);
  deps.setPaletteApplied(activation.paletteApplied);

  if (deps.skipShaderWarmup || !deps.compileSceneShaders) {
    return { activeGeneratorCount: null };
  }

  const activeGeneratorCount = deps.compileSceneShaders(activation.scene, activation.project);
  return { activeGeneratorCount };
};
