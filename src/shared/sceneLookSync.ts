import type { SceneLook, VisualSynthProject } from './project';

const cloneValue = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export const syncActiveSceneLookSection = <K extends keyof SceneLook>(
  project: VisualSynthProject,
  key: K,
  value: SceneLook[K]
) => {
  const scene = project.scenes.find((item) => item.id === project.activeSceneId);
  if (!scene) return;
  scene.look = {
    ...scene.look,
    [key]: cloneValue(value)
  };
};
