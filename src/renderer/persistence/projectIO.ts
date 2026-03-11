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
import { applyLoadableProjectRuntime } from '../projectApplyRuntime';

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
    const applied = await applyLoadableProjectRuntime(project, {
      currentOutputConfig: store.getState().outputConfig,
      onResolvedProject: (normalized) => {
        actions.setProject(store, normalized);
      },
      syncOutputConfig,
      setOutputEnabled
    });
    if (!applied.ok) {
      setStatus('Invalid project loaded.');
      return;
    }
    actions.setOutputConfig(store, applied.outputConfig);
    onProjectApplied();
    setStatus(`Loaded project: ${applied.project.name}`);
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
