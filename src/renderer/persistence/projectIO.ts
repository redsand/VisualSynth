import { projectSchema } from '../../shared/projectSchema';
import {
  DEFAULT_PROJECT,
  DEFAULT_SCENE_ROLES,
  DEFAULT_SCENE_TRANSITION,
  DEFAULT_SCENE_TRIGGER,
  type OutputConfig,
  type VisualSynthProject
} from '../../shared/project';
import { actions } from '../state/actions';
import type { Store } from '../state/store';
import { setStatus } from '../state/events';

export interface ProjectIODeps {
  store: Store;
  syncOutputConfig: (config: OutputConfig) => Promise<void>;
  setOutputEnabled: (enabled: boolean) => Promise<void>;
  onProjectApplied: () => void;
}

export interface ProjectIO {
  serializeProject: () => string;
  applyProject: (project: VisualSynthProject) => Promise<void>;
  loadProject: () => Promise<void>;
  saveProject: () => Promise<void>;
}

export const createProjectIO = ({
  store,
  syncOutputConfig,
  setOutputEnabled,
  onProjectApplied
}: ProjectIODeps): ProjectIO => {
  const ensureProjectMacros = (project: VisualSynthProject) => {
    if (!project.macros || project.macros.length === 0) {
      project.macros = JSON.parse(JSON.stringify(DEFAULT_PROJECT.macros));
    }
  };

  const ensureProjectExpressiveFx = (project: VisualSynthProject) => {
    const fallback = DEFAULT_PROJECT.expressiveFx;
    const current = project.expressiveFx;
    if (!current) {
      project.expressiveFx = JSON.parse(JSON.stringify(fallback));
      return;
    }
    project.expressiveFx = {
      energyBloom: {
        ...fallback.energyBloom,
        ...current.energyBloom,
        intentBinding: { ...fallback.energyBloom.intentBinding, ...(current.energyBloom?.intentBinding ?? {}) },
        expert: { ...fallback.energyBloom.expert, ...(current.energyBloom?.expert ?? {}) }
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

  const ensureProjectScenes = (project: VisualSynthProject) => {
    project.scenes = project.scenes.map((scene) => ({
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
    }));
    project.scenes.forEach((scene) => {
      let coreAssigned = false;
      scene.layers.forEach((layer) => {
        if (layer.role === 'core') {
          if (coreAssigned) {
            layer.role = 'support';
          } else {
            coreAssigned = true;
          }
        }
      });
      if (!coreAssigned && scene.layers.length > 0) {
        const fallback = scene.layers.find((item) => item.enabled) ?? scene.layers[0];
        if (fallback) fallback.role = 'core';
      }
      const coreIndex = scene.layers.findIndex((layer) => layer.role === 'core');
      if (coreIndex >= 0 && coreIndex !== scene.layers.length - 1) {
        const [coreLayer] = scene.layers.splice(coreIndex, 1);
        scene.layers.push(coreLayer);
      }
    });
    if (!project.activeSceneId && project.scenes.length > 0) {
      project.activeSceneId = project.scenes[0].id;
    }
  };

  const serializeProject = () => {
    const now = new Date().toISOString();
    const state = store.getState();
    const payload: VisualSynthProject = {
      ...state.project,
      updatedAt: now,
      output: state.outputConfig
    };
    return JSON.stringify(payload, null, 2);
  };

  const applyProject = async (project: VisualSynthProject) => {
    const parsed = projectSchema.safeParse(project);
    if (!parsed.success) {
      setStatus('Invalid project loaded.');
      return;
    }
    const normalized = parsed.data;
    ensureProjectMacros(normalized);
    ensureProjectExpressiveFx(normalized);
    ensureProjectScenes(normalized);
    normalized.version = Math.max(normalized.version ?? 0, DEFAULT_PROJECT.version);
    actions.setProject(store, normalized);
    const outputConfig = { ...store.getState().outputConfig, ...normalized.output };
    actions.setOutputConfig(store, outputConfig);
    await syncOutputConfig(outputConfig);
    await setOutputEnabled(outputConfig.enabled);
    onProjectApplied();
    setStatus(`Loaded project: ${normalized.name}`);
  };

  const loadProject = async () => {
    const result = await window.visualSynth.openProject();
    if (!result.canceled && result.project) {
      await applyProject(result.project);
    }
  };

  const saveProject = async () => {
    const payload = serializeProject();
    await window.visualSynth.saveProject(payload);
  };

  return {
    serializeProject,
    applyProject,
    loadProject,
    saveProject
  };
};
