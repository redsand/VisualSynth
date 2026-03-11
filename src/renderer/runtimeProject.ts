import {
  DEFAULT_PROJECT,
  DEFAULT_SCENE_ROLES,
  DEFAULT_SCENE_TRANSITION,
  DEFAULT_SCENE_TRIGGER,
  type SceneConfig,
  type SceneIntent,
  type VisualSynthProject
} from '../shared/project';
import { getLayerType } from '../shared/parameterRegistry';

const cloneValue = <T>(value: T): T => {
  if (value === undefined) return value;
  return JSON.parse(JSON.stringify(value)) as T;
};

const ensureProjectMacros = (project: VisualSynthProject) => {
  if (!project.macros || project.macros.length === 0) {
    project.macros = cloneValue(DEFAULT_PROJECT.macros);
    return;
  }
  const defaultsById = new Map(DEFAULT_PROJECT.macros.map((macro) => [macro.id, macro]));
  project.macros = project.macros.map((macro) => {
    const fallback = defaultsById.get(macro.id);
    if (!fallback) return macro;
    const targets = Array.isArray(macro.targets) ? macro.targets : [];
    const shouldFillTargets = targets.length === 0 && ['macro-1', 'macro-2', 'macro-3', 'macro-4'].includes(macro.id);
    return {
      ...macro,
      name: macro.name || fallback.name,
      targets: shouldFillTargets ? cloneValue(fallback.targets) : targets
    };
  });
};

const ensureProjectPalettes = (project: VisualSynthProject) => {
  if (!project.palettes || project.palettes.length === 0) {
    project.palettes = cloneValue(DEFAULT_PROJECT.palettes);
  } else {
    const existingIds = new Set(project.palettes.map((palette) => palette.id));
    const missing = DEFAULT_PROJECT.palettes.filter((palette) => !existingIds.has(palette.id));
    if (missing.length > 0) {
      project.palettes = [...project.palettes, ...cloneValue(missing)];
    }
  }
  if (!project.activePaletteId) {
    project.activePaletteId = project.palettes[0]?.id ?? DEFAULT_PROJECT.activePaletteId;
  }
};

const ensureProjectExpressiveFx = (project: VisualSynthProject) => {
  const fallback = DEFAULT_PROJECT.expressiveFx;
  const current = project.expressiveFx;
  if (!current) {
    project.expressiveFx = cloneValue(fallback);
    return;
  }
  project.expressiveFx = {
    enabled: current.enabled ?? fallback.enabled,
    energyBloom: {
      ...fallback.energyBloom,
      ...current.energyBloom,
      intentBinding: { ...fallback.energyBloom.intentBinding, ...(current.energyBloom?.intentBinding ?? {}) },
      expert: { ...fallback.energyBloom.expert, ...(current.energyBloom?.expert ?? {}) }
    },
    radialGravity: {
      ...fallback.radialGravity,
      ...current.radialGravity,
      intentBinding: { ...fallback.radialGravity.intentBinding, ...(current.radialGravity?.intentBinding ?? {}) },
      expert: { ...fallback.radialGravity.expert, ...(current.radialGravity?.expert ?? {}) }
    },
    motionEcho: {
      ...fallback.motionEcho,
      ...current.motionEcho,
      intentBinding: { ...fallback.motionEcho.intentBinding, ...(current.motionEcho?.intentBinding ?? {}) },
      expert: { ...fallback.motionEcho.expert, ...(current.motionEcho?.expert ?? {}) }
    },
    spectralSmear: {
      ...fallback.spectralSmear,
      ...current.spectralSmear,
      intentBinding: { ...fallback.spectralSmear.intentBinding, ...(current.spectralSmear?.intentBinding ?? {}) },
      expert: { ...fallback.spectralSmear.expert, ...(current.spectralSmear?.expert ?? {}) }
    }
  };
};

const ensureProjectModulators = (project: VisualSynthProject) => {
  const defaultLfos = cloneValue(DEFAULT_PROJECT.lfos);
  const defaultEnvelopes = cloneValue(DEFAULT_PROJECT.envelopes);
  const defaultSampleHold = cloneValue(DEFAULT_PROJECT.sampleHold);
  project.lfos = project.lfos?.length ? project.lfos : defaultLfos;
  project.envelopes = project.envelopes?.length ? project.envelopes : defaultEnvelopes;
  project.sampleHold = project.sampleHold?.length ? project.sampleHold : defaultSampleHold;
  if (project.lfos.length < defaultLfos.length) {
    project.lfos = [...project.lfos, ...defaultLfos.slice(project.lfos.length)];
  }
  if (project.envelopes.length < defaultEnvelopes.length) {
    project.envelopes = [...project.envelopes, ...defaultEnvelopes.slice(project.envelopes.length)];
  }
  if (project.sampleHold.length < defaultSampleHold.length) {
    project.sampleHold = [...project.sampleHold, ...defaultSampleHold.slice(project.sampleHold.length)];
  }
};

const getDefaultRoleForLayerId = (layerId: string) => {
  if (layerId === 'layer-plasma') return 'core';
  if (layerId === 'layer-spectrum') return 'support';
  if (layerId === 'layer-origami') return 'support';
  if (layerId === 'layer-glyph') return 'support';
  if (layerId === 'layer-crystal') return 'support';
  if (layerId === 'layer-inkflow') return 'atmosphere';
  if (layerId === 'layer-topo') return 'atmosphere';
  if (layerId === 'layer-weather') return 'atmosphere';
  if (layerId === 'layer-portal') return 'atmosphere';
  if (layerId === 'layer-media') return 'support';
  if (layerId === 'layer-oscillo') return 'support';
  if (layerId === 'gen-strobe') return 'core';
  if (layerId === 'gen-laser-beam') return 'support';
  if (layerId === 'gen-shape-burst') return 'support';
  if (layerId === 'gen-grid-tunnel') return 'atmosphere';
  if (layerId === 'gen-lightning') return 'core';
  if (layerId === 'gen-analog-oscillo') return 'core';
  if (layerId === 'gen-speaker-cone') return 'atmosphere';
  if (layerId === 'gen-glitch-scanline') return 'atmosphere';
  if (layerId === 'gen-laser-starfield') return 'support';
  if (layerId === 'gen-pulsing-ribbons') return 'support';
  if (layerId === 'gen-electric-arc') return 'atmosphere';
  if (layerId === 'gen-pyro-burst') return 'support';
  if (layerId === 'gen-geo-wireframe') return 'core';
  if (layerId === 'gen-signal-noise') return 'atmosphere';
  if (layerId === 'gen-infinite-wormhole') return 'core';
  if (layerId === 'gen-ribbon-tunnel') return 'core';
  if (layerId === 'gen-fractal-tunnel') return 'core';
  if (layerId === 'gen-circuit-conduit') return 'atmosphere';
  if (layerId === 'gen-aura-portal') return 'core';
  if (layerId === 'gen-freq-terrain') return 'support';
  if (layerId === 'gen-data-stream') return 'atmosphere';
  if (layerId === 'gen-caustic-liquid') return 'core';
  if (layerId === 'gen-shimmer-veil') return 'support';
  return 'support';
};

const buildDefaultParamsForLayerId = (layerId: string) => {
  const layerType = getLayerType(layerId);
  if (!layerType) return {} as Record<string, any>;
  const params: Record<string, any> = {};
  layerType.params.forEach((param) => {
    if (param.default !== undefined) {
      params[param.id] = param.default;
    }
  });
  return params;
};

const normalizeSceneLayerRoles = (scene: SceneConfig) => {
  let coreAssigned = false;
  scene.layers.forEach((layer, index) => {
    const nextRole = layer.role ?? getDefaultRoleForLayerId(layer.id);
    const mergedParams = { ...buildDefaultParamsForLayerId(layer.id), ...(layer.params ?? {}) };
    layer.params = mergedParams;
    if (nextRole === 'core') {
      if (coreAssigned) {
        layer.role = 'support';
      } else {
        layer.role = 'core';
        coreAssigned = true;
      }
      return;
    }
    layer.role = nextRole;
    if (!coreAssigned && index === scene.layers.length - 1) {
      const firstEnabled = scene.layers.find((item) => item.enabled) ?? scene.layers[0];
      if (firstEnabled) {
        firstEnabled.role = 'core';
        coreAssigned = true;
      }
    }
  });
  const coreIndex = scene.layers.findIndex((layer) => layer.role === 'core');
  if (coreIndex >= 0 && coreIndex !== scene.layers.length - 1) {
    const [coreLayer] = scene.layers.splice(coreIndex, 1);
    scene.layers.push(coreLayer);
  }
};

const ensureSceneDefaults = (scene: SceneConfig) => {
  scene.scene_id = scene.scene_id ?? scene.id;
  scene.intent = scene.intent ?? ('ambient' as SceneIntent);
  scene.duration = typeof scene.duration === 'number' ? scene.duration : 0;
  scene.transition_in = { ...DEFAULT_SCENE_TRANSITION, ...(scene.transition_in ?? {}) };
  scene.transition_out = { ...DEFAULT_SCENE_TRANSITION, ...(scene.transition_out ?? {}) };
  scene.trigger = { ...DEFAULT_SCENE_TRIGGER, ...(scene.trigger ?? {}) };
  scene.assigned_layers = {
    core: scene.assigned_layers?.core ?? [...DEFAULT_SCENE_ROLES.core],
    support: scene.assigned_layers?.support ?? [...DEFAULT_SCENE_ROLES.support],
    atmosphere: scene.assigned_layers?.atmosphere ?? [...DEFAULT_SCENE_ROLES.atmosphere]
  };
  normalizeSceneLayerRoles(scene);
  return scene;
};

const ensureProjectScenes = (project: VisualSynthProject) => {
  project.scenes = project.scenes.map((scene) => ensureSceneDefaults(scene));
  if (!project.activeSceneId && project.scenes.length > 0) {
    project.activeSceneId = project.scenes[0].id;
  }
};

export const prepareProjectForRuntime = (project: VisualSynthProject): VisualSynthProject => {
  ensureProjectMacros(project);
  ensureProjectPalettes(project);
  ensureProjectExpressiveFx(project);
  ensureProjectModulators(project);
  ensureProjectScenes(project);
  project.version = Math.max(project.version ?? 0, DEFAULT_PROJECT.version);
  return project;
};
