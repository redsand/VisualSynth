import { projectSchema } from './projectSchema';
import {
  DEFAULT_PROJECT,
  VisualSynthProject,
  COLOR_PALETTES,
  DEFAULT_SCENE_TRANSITION,
  DEFAULT_SCENE_TRIGGER,
  DEFAULT_SCENE_ROLES,
  DEFAULT_OUTPUT_CONFIG
} from './project';

const CURRENT_VERSION = 6;

/**
 * Deterministically sorts object keys for stable serialization.
 */
const sortObjectKeys = (obj: any): any => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sortObjectKeys);
  const sorted: any = {};
  Object.keys(obj).sort().forEach(key => {
    sorted[key] = sortObjectKeys(obj[key]);
  });
  return sorted;
};

const ensureSceneDefaults = (scene: any) => {
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
    layers: (scene.layers ?? []).map((layer: any) => ({
      ...layer,
      role: layer.role ?? 'support'
    }))
  };
  let coreAssigned = false;
  next.layers.forEach((layer: any) => {
    if (layer.role === 'core') {
      if (coreAssigned) {
        layer.role = 'support';
      } else {
        coreAssigned = true;
      }
    }
  });
  if (!coreAssigned && next.layers.length > 0) {
    const fallback = next.layers.find((item: any) => item.enabled) ?? next.layers[0];
    if (fallback) fallback.role = 'core';
  }
  const coreIndex = next.layers.findIndex((layer: any) => layer.role === 'core');
  if (coreIndex >= 0 && coreIndex !== next.layers.length - 1) {
    const [coreLayer] = next.layers.splice(coreIndex, 1);
    next.layers.push(coreLayer);
  }
  return next;
};

const upgradeProject = (project: VisualSynthProject): VisualSynthProject => {
  if (project.version >= CURRENT_VERSION) return project;
  let upgraded = { ...project };
  if (upgraded.version < 2) {
upgraded = {
      ...DEFAULT_PROJECT,
      ...project,
      palettes: project.palettes ?? COLOR_PALETTES,
      activePaletteId: project.activePaletteId ?? 'default-classic',
      output: { ...DEFAULT_OUTPUT_CONFIG, ...project.output },
      stylePresets: project.stylePresets ?? [],
      activeStylePresetId: project.activeStylePresetId ?? 'style-neutral',
      macros: project.macros?.length ? project.macros : DEFAULT_PROJECT.macros
    };
  }
  if (upgraded.version < 3) {
    upgraded = {
      ...upgraded,
      scenes: (upgraded.scenes ?? []).map(ensureSceneDefaults)
    };
  }
  upgraded.version = CURRENT_VERSION;
  return upgraded;
};

export const serializeProject = (project: VisualSynthProject) => {
  const parsed = projectSchema.safeParse(project);
  if (!parsed.success) {
    throw new Error('Invalid project data: ' + JSON.stringify(parsed.error.format()));
  }
  
  const canonical = { ...parsed.data };
  // Strictly remove non-canonical fields. `output` is intentionally KEPT: it is
  // part of the project (resolveProjectOutputConfig lets project.output win
  // over the current runtime window config on load). Stripping it here meant
  // the file never carried output, so on reload zod re-filled a full
  // DEFAULT_OUTPUT_CONFIG and the project-wins resolver applied that default —
  // silently resetting the user's output window (scale/fullscreen/device) on
  // every save/reload. Only updatedAt is transient.
  delete (canonical as any).updatedAt;

  return JSON.stringify(sortObjectKeys(canonical), null, 2);
};

export const deserializeProject = (payload: string): VisualSynthProject => {
  const parsed = projectSchema.safeParse(JSON.parse(payload));
  if (!parsed.success) {
    throw new Error('Invalid project data');
  }
  return upgradeProject(parsed.data as unknown as VisualSynthProject);
};
