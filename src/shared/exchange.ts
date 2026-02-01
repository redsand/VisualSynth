import {
  VisualSynthProject,
  SceneConfig,
  MacroConfig,
  DEFAULT_SCENE_TRANSITION,
  DEFAULT_SCENE_TRIGGER,
  DEFAULT_SCENE_ROLES
} from './project';

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

const normalizeScene = (scene: SceneConfig): SceneConfig => {
  const next = {
    ...scene,
    scene_id: scene.scene_id ?? scene.id,
    intent: scene.intent ?? 'ambient',
    duration: typeof scene.duration === 'number' ? scene.duration : 0,
    transition_in: { ...DEFAULT_SCENE_TRANSITION, ...(scene.transition_in ?? {}) },
    transition_out: { ...DEFAULT_SCENE_TRANSITION, ...(scene.transition_out ?? {}) },
    trigger: { ...DEFAULT_SCENE_TRIGGER, ...(scene.trigger ?? {}) },
    assigned_layers: {
      core: scene.assigned_layers?.core ?? [...DEFAULT_SCENE_ROLES.core],
      support: scene.assigned_layers?.support ?? [...DEFAULT_SCENE_ROLES.support],
      atmosphere: scene.assigned_layers?.atmosphere ?? [...DEFAULT_SCENE_ROLES.atmosphere]
    },
    layers: scene.layers.map((layer) => ({
      ...layer,
      role: layer.role ?? 'support'
    }))
  };
  let coreAssigned = false;
  next.layers.forEach((layer) => {
    if (layer.role === 'core') {
      if (coreAssigned) {
        layer.role = 'support';
      } else {
        coreAssigned = true;
      }
    }
  });
  if (!coreAssigned && next.layers.length > 0) {
    const fallback = next.layers.find((item) => item.enabled) ?? next.layers[0];
    if (fallback) fallback.role = 'core';
  }
  const coreIndex = next.layers.findIndex((layer) => layer.role === 'core');
  if (coreIndex >= 0 && coreIndex !== next.layers.length - 1) {
    const [coreLayer] = next.layers.splice(coreIndex, 1);
    next.layers.push(coreLayer);
  }
  return next;
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
  return normalizeScene({ ...incoming, id: candidate });
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
