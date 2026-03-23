import {
  DEFAULT_PROJECT,
  DEFAULT_SCENE_ROLES,
  DEFAULT_SCENE_TRANSITION,
  DEFAULT_SCENE_TRIGGER,
  type OutputConfig,
  type VisualSynthProject,
  type AssetItem
} from '../../shared/project';
import { normalizeAssetPath } from '../../shared/assets';
import { serializeProject } from '../../shared/serialization';
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
  saveProjectAs: () => Promise<void>;
}

export const createProjectIO = ({
  store,
  syncOutputConfig,
  setOutputEnabled,
  onProjectApplied
}: ProjectIODeps): ProjectIO => {
  const serializeProjectLocal = () => {
    const state = store.getState();
    const project = state.project;

    // Normalize asset paths before saving
    const normalizedAssets = project.assets.map((asset: AssetItem) => ({
      ...asset,
      path: normalizeAssetPath(asset.path)
    }));

    // Use unified shared serialization for deterministic canonical model
    return serializeProject({
      ...project,
      assets: normalizedAssets
    });
  };

  const applyProject = async (project: VisualSynthProject, filePath: string | null = null) => {
    const applied = await applyLoadableProjectRuntime(project, {
      currentOutputConfig: store.getState().outputConfig,
      onResolvedProject: (normalized) => {
        actions.setProject(store, normalized);
        actions.setProjectPath(store, filePath);
      },
      syncOutputConfig,
      setOutputEnabled
    }, filePath);
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
      await applyProject(result.project, result.filePath);
    }
  };

  const saveProject = async () => {
    const payload = serializeProjectLocal();
    const currentPath = store.getState().projectPath;
    const result = await window.visualSynth.saveProject(payload, currentPath ?? undefined);
    if (!result.canceled) {
      if (result.filePath) {
        actions.setProjectPath(store, result.filePath);
      }
      setStatus(`Saved project: ${store.getState().project.name}`);
    }
  };

  const saveProjectAs = async () => {
    const payload = serializeProjectLocal();
    const result = await window.visualSynth.saveProjectAs(payload);
    if (!result.canceled) {
      if (result.filePath) {
        actions.setProjectPath(store, result.filePath);
      }
      setStatus(`Saved project as: ${store.getState().project.name}`);
    }
  };

  return {
    serializeProject: serializeProjectLocal,
    applyProject,
    loadProject,
    saveProject,
    saveProjectAs
  };
};
