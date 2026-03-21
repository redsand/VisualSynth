/**
 * ScenePanel: Manages scenes, presets, playlists, and macros
 * Enhanced with multi-scene management and template-based scene creation
 */

import type { Store } from '../../state/store';
import type { VisualSynthProject, SceneConfig, SceneIntent, SceneLayerRoles, LayerConfig } from '../../../shared/project';
import { actions } from '../../state/actions';
import { setStatus } from '../../state/events';
import {
  SCENE_TEMPLATES,
  SCENE_PAIR_TEMPLATES,
  createSceneFromTemplate,
  createScenePairFromTemplate,
  type SceneTemplateCategory
} from '../../../shared/sceneTemplates';
import {
  SCENE_MODULATION_TARGETS,
  createSceneSwitchModulation,
  getSceneModulationsForProject,
  type SceneModulationTarget
} from '../../../shared/sceneModulation';

export interface ScenePanelDeps {
  store: Store;
  loadPreset: (presetPath: string) => Promise<void>;
  applyScene: (sceneId: string) => void;
  onSceneCreated?: (scene: SceneConfig) => void;
  onScenesUpdated?: () => void;
}

export interface ScenePanelApi {
  syncFromProject: () => void;
  refreshSceneSelect: () => void;
  initMacros: () => void;
  createSceneFromTemplate: (templateId: string) => void;
  createScenePair: (pairId: string) => void;
  duplicateScene: (sceneId: string) => void;
  deleteScene: (sceneId: string) => void;
  assignLayerToRole: (sceneId: string, layerId: string, role: 'core' | 'support' | 'atmosphere') => void;
}

const generateId = (): string => `scene-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const generateLayerId = (): string => `layer-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export const createScenePanel = ({ store, loadPreset, applyScene, onSceneCreated, onScenesUpdated }: ScenePanelDeps): ScenePanelApi => {
  const sceneSelect = document.getElementById('scene-select') as HTMLSelectElement | null;
  const presetSelect = document.getElementById('preset-select') as HTMLSelectElement;
  const applyPresetButton = document.getElementById('btn-apply-preset') as HTMLButtonElement;
  const presetPrevButton = document.getElementById('preset-prev') as HTMLButtonElement;
  const presetNextButton = document.getElementById('preset-next') as HTMLButtonElement;
  const presetShuffleButton = document.getElementById('preset-shuffle') as HTMLButtonElement;
  const macroList = document.getElementById('macro-list') as HTMLDivElement;

  let macroInputs: HTMLInputElement[] = [];

  const refreshSceneSelect = () => {
    if (!sceneSelect) return;
    const project = store.getState().project;
    sceneSelect.innerHTML = '';
    project.scenes.forEach((scene) => {
      const option = document.createElement('option');
      option.value = scene.id;
      option.textContent = scene.name;
      sceneSelect.appendChild(option);
    });
    sceneSelect.value = project.activeSceneId;
  };

  const initMacros = () => {
    const project = store.getState().project;
    macroList.innerHTML = '';
    macroInputs = [];
    project.macros.forEach((macro, index) => {
      const row = document.createElement('div');
      row.className = 'macro-row';

      const label = document.createElement('div');
      label.className = 'macro-label';
      label.textContent = macro.name || `Macro ${index + 1}`;

      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = '0';
      slider.max = '1';
      slider.step = '0.01';
      slider.value = String(macro.value);
      slider.dataset.learnTarget = `macro-${index + 1}.value`;
      slider.dataset.learnLabel = macro.name || `Macro ${index + 1}`;
      slider.addEventListener('input', () => {
        macro.value = Number(slider.value);
      });

      const learn = document.createElement('button');
      learn.className = 'macro-learn';
      learn.textContent = 'Learn';
      learn.addEventListener('click', () => {
        setStatus(`MIDI learn placeholder for ${macro.name}`);
      });

      row.appendChild(label);
      row.appendChild(slider);
      row.appendChild(learn);
      macroList.appendChild(row);
      macroInputs.push(slider);
    });
  };

  const syncFromProject = () => {
    refreshSceneSelect();
    initMacros();
  };

  const createSceneFromTemplateImpl = (templateId: string) => {
    const template = SCENE_TEMPLATES.find(t => t.id === templateId);
    if (!template) {
      setStatus(`Template ${templateId} not found`);
      return;
    }
    
    const project = store.getState().project;
    const newScene = createSceneFromTemplate(template, {
      id: generateId(),
      scene_id: generateId(),
      name: `${template.name} ${project.scenes.length + 1}`
    });
    
    project.scenes.push(newScene);
    refreshSceneSelect();
    setStatus(`Created scene: ${newScene.name}`);
    
    if (onSceneCreated) {
      onSceneCreated(newScene);
    }
    if (onScenesUpdated) {
      onScenesUpdated();
    }
  };

  const createScenePairImpl = (pairId: string) => {
    const pairTemplate = SCENE_PAIR_TEMPLATES.find(t => t.id === pairId);
    if (!pairTemplate) {
      setStatus(`Scene pair template ${pairId} not found`);
      return;
    }
    
    const project = store.getState().project;
    const { sceneA, sceneB, modulations } = createScenePairFromTemplate(pairTemplate);
    
    sceneA.id = generateId();
    sceneA.scene_id = sceneA.id;
    sceneA.name = `${sceneA.name} ${project.scenes.length + 1}`;
    
    sceneB.id = generateId();
    sceneB.scene_id = sceneB.id;
    sceneB.name = `${sceneB.name} ${project.scenes.length + 2}`;
    
    project.scenes.push(sceneA, sceneB);
    modulations.forEach(mod => {
      project.modMatrix.push(mod);
    });
    
    const sceneModulations = getSceneModulationsForProject(2);
    sceneModulations.forEach(mod => {
      project.modMatrix.push(mod);
    });
    
    refreshSceneSelect();
    setStatus(`Created scene pair: ${sceneA.name} -> ${sceneB.name}`);
    
    if (onScenesUpdated) {
      onScenesUpdated();
    }
  };

  const duplicateSceneImpl = (sceneId: string) => {
    const project = store.getState().project;
    const scene = project.scenes.find(s => s.id === sceneId);
    if (!scene) {
      setStatus(`Scene ${sceneId} not found`);
      return;
    }
    
    const newScene: SceneConfig = {
      ...JSON.parse(JSON.stringify(scene)),
      id: generateId(),
      scene_id: generateId(),
      name: `${scene.name} (copy)`,
      layers: scene.layers.map(layer => ({
        ...JSON.parse(JSON.stringify(layer)),
        id: generateLayerId()
      })),
      assigned_layers: scene.assigned_layers ? {
        core: scene.assigned_layers.core.map(() => generateLayerId()),
        support: scene.assigned_layers.support.map(() => generateLayerId()),
        atmosphere: scene.assigned_layers.atmosphere.map(() => generateLayerId())
      } : undefined
    };
    
    project.scenes.push(newScene);
    refreshSceneSelect();
    setStatus(`Duplicated scene: ${newScene.name}`);
    
    if (onSceneCreated) {
      onSceneCreated(newScene);
    }
    if (onScenesUpdated) {
      onScenesUpdated();
    }
  };

  const deleteSceneImpl = (sceneId: string) => {
    const project = store.getState().project;
    const index = project.scenes.findIndex(s => s.id === sceneId);
    if (index === -1) {
      setStatus(`Scene ${sceneId} not found`);
      return;
    }
    
    if (project.scenes.length <= 1) {
      setStatus('Cannot delete the last scene');
      return;
    }
    
    const sceneName = project.scenes[index].name;
    project.scenes.splice(index, 1);
    
    if (project.activeSceneId === sceneId) {
      project.activeSceneId = project.scenes[0].id;
    }
    
    refreshSceneSelect();
    setStatus(`Deleted scene: ${sceneName}`);
    
    if (onScenesUpdated) {
      onScenesUpdated();
    }
  };

  const assignLayerToRoleImpl = (
    sceneId: string,
    layerId: string,
    role: 'core' | 'support' | 'atmosphere'
  ) => {
    const project = store.getState().project;
    const scene = project.scenes.find(s => s.id === sceneId);
    if (!scene || !scene.assigned_layers) {
      setStatus(`Scene ${sceneId} not found or has no assigned layers`);
      return;
    }
    
    const otherRoles = ['core', 'support', 'atmosphere'].filter(r => r !== role) as Array<'core' | 'support' | 'atmosphere'>;
    otherRoles.forEach(r => {
      const idx = scene.assigned_layers![r].indexOf(layerId);
      if (idx !== -1) {
        scene.assigned_layers![r].splice(idx, 1);
      }
    });
    
    if (!scene.assigned_layers[role].includes(layerId)) {
      scene.assigned_layers[role].push(layerId);
    }
    
    const layer = scene.layers.find(l => l.id === layerId);
    if (layer) {
      layer.role = role;
    }
    
    setStatus(`Layer ${layerId} assigned to ${role}`);
    
    if (onScenesUpdated) {
      onScenesUpdated();
    }
  };

  if (sceneSelect) {
    sceneSelect.addEventListener('change', () => {
      applyScene(sceneSelect.value);
      setStatus(`Scene: ${sceneSelect.options[sceneSelect.selectedIndex].text}`);
    });
  }

  if (applyPresetButton) {
    applyPresetButton.addEventListener('click', async () => {
      const presetPath = presetSelect.value;
      if (!presetPath) return;
      await loadPreset(presetPath);
    });
  }

  if (presetPrevButton) {
    presetPrevButton.addEventListener('click', () => {
      if (presetSelect && presetSelect.selectedIndex > 0) {
        presetSelect.selectedIndex -= 1;
        if (applyPresetButton) applyPresetButton.click();
      }
    });
  }

  if (presetNextButton) {
    presetNextButton.addEventListener('click', () => {
      if (presetSelect && presetSelect.selectedIndex < presetSelect.options.length - 1) {
        presetSelect.selectedIndex += 1;
        if (applyPresetButton) applyPresetButton.click();
      }
    });
  }

  if (presetShuffleButton) {
    presetShuffleButton.addEventListener('click', () => {
      if (presetSelect) {
        const randomIndex = Math.floor(Math.random() * presetSelect.options.length);
        presetSelect.selectedIndex = randomIndex;
        if (applyPresetButton) applyPresetButton.click();
      }
    });
  }

  return {
    syncFromProject,
    refreshSceneSelect,
    initMacros,
    createSceneFromTemplate: createSceneFromTemplateImpl,
    createScenePair: createScenePairImpl,
    duplicateScene: duplicateSceneImpl,
    deleteScene: deleteSceneImpl,
    assignLayerToRole: assignLayerToRoleImpl
  };
};

export { SCENE_TEMPLATES, SCENE_PAIR_TEMPLATES, SCENE_MODULATION_TARGETS };