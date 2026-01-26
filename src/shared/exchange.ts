import { VisualSynthProject, SceneConfig, MacroConfig } from './project';

export type ExchangePayload =
  | {
      kind: 'scene';
      version: 1;
      name: string;
      createdAt: string;
      scene: SceneConfig;
    }
  | {
      kind: 'macros';
      version: 1;
      name: string;
      createdAt: string;
      macros: MacroConfig[];
    };

const ensureUniqueSceneId = (scenes: SceneConfig[], incoming: SceneConfig) => {
  let baseId = incoming.id;
  if (!baseId) baseId = `scene-${scenes.length + 1}`;
  let candidate = baseId;
  let counter = 1;
  while (scenes.some((scene) => scene.id === candidate)) {
    candidate = `${baseId}-${counter}`;
    counter += 1;
  }
  return { ...incoming, id: candidate };
};

export const createSceneExchange = (project: VisualSynthProject, sceneId: string): ExchangePayload => {
  const scene = project.scenes.find((item) => item.id === sceneId);
  if (!scene) {
    throw new Error('Scene not found');
  }
  return {
    kind: 'scene',
    version: 1,
    name: scene.name,
    createdAt: new Date().toISOString(),
    scene
  };
};

export const createMacrosExchange = (project: VisualSynthProject): ExchangePayload => {
  return {
    kind: 'macros',
    version: 1,
    name: project.name,
    createdAt: new Date().toISOString(),
    macros: project.macros
  };
};

export const applyExchangePayload = (
  project: VisualSynthProject,
  payload: ExchangePayload
): VisualSynthProject => {
  if (payload.kind === 'scene') {
    const scene = ensureUniqueSceneId(project.scenes, payload.scene);
    return {
      ...project,
      scenes: [...project.scenes, scene]
    };
  }

  return {
    ...project,
    macros: payload.macros
  };
};
