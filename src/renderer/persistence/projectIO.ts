import { projectSchema } from '../../shared/projectSchema';
import { DEFAULT_PROJECT, type OutputConfig, type VisualSynthProject } from '../../shared/project';
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
