/**
 * ScenePanel: Manages scenes, presets, playlists, and macros
 */

import type { Store } from '../../state/store';
import type { VisualSynthProject } from '../../../shared/project';
import { actions } from '../../state/actions';
import { setStatus } from '../../state/events';

export interface ScenePanelDeps {
  store: Store;
  loadPreset: (presetPath: string) => Promise<void>;
  applyScene: (sceneId: string) => void;
}

export interface ScenePanelApi {
  syncFromProject: () => void;
  refreshSceneSelect: () => void;
  initMacros: () => void;
}

export const createScenePanel = ({ store, loadPreset, applyScene }: ScenePanelDeps): ScenePanelApi => {
  const sceneSelect = document.getElementById('scene-select') as HTMLSelectElement;
  const presetSelect = document.getElementById('preset-select') as HTMLSelectElement;
  const applyPresetButton = document.getElementById('btn-apply-preset') as HTMLButtonElement;
  const presetPrevButton = document.getElementById('preset-prev') as HTMLButtonElement;
  const presetNextButton = document.getElementById('preset-next') as HTMLButtonElement;
  const presetShuffleButton = document.getElementById('preset-shuffle') as HTMLButtonElement;
  const macroList = document.getElementById('macro-list') as HTMLDivElement;

  let macroInputs: HTMLInputElement[] = [];

  const refreshSceneSelect = () => {
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

  // Scene selection
  sceneSelect.addEventListener('change', () => {
    applyScene(sceneSelect.value);
    setStatus(`Scene: ${sceneSelect.options[sceneSelect.selectedIndex].text}`);
  });

  // Preset handling
  applyPresetButton.addEventListener('click', async () => {
    const presetPath = presetSelect.value;
    if (!presetPath) return;
    await loadPreset(presetPath);
  });

  presetPrevButton.addEventListener('click', () => {
    if (presetSelect.selectedIndex > 0) {
      presetSelect.selectedIndex -= 1;
      applyPresetButton.click();
    }
  });

  presetNextButton.addEventListener('click', () => {
    if (presetSelect.selectedIndex < presetSelect.options.length - 1) {
      presetSelect.selectedIndex += 1;
      applyPresetButton.click();
    }
  });

  presetShuffleButton.addEventListener('click', () => {
    const randomIndex = Math.floor(Math.random() * presetSelect.options.length);
    presetSelect.selectedIndex = randomIndex;
    applyPresetButton.click();
  });

  return {
    syncFromProject,
    refreshSceneSelect,
    initMacros
  };
};
