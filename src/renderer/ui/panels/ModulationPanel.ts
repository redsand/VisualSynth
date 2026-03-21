/**
 * ModulationPanel: Manages LFOs, Envelopes, Sample-Hold, Mod Matrix, and MIDI Mappings
 * Enhanced with scene modulation targets for performance-driven scene switching
 */

import type { Store } from '../../state/store';
import { setStatus } from '../../state/events';
import { SCENE_MODULATION_TARGETS } from '../../../shared/sceneModulation';

export interface ModulationPanelDeps {
  store: Store;
  armMidiLearn: (target: string, label: string) => void;
}

export interface ModulationPanelApi {
  renderModulators: () => void;
  renderModMatrix: () => void;
  renderMidiMappings: () => void;
  addSceneModulation: (source: string, target: string) => void;
}

const MOD_SOURCE_CATEGORIES = {
  audio: ['audio.rms', 'audio.peak', 'audio.frequency.low', 'audio.frequency.mid', 'audio.frequency.high'],
  lfo: ['lfo-1', 'lfo-2', 'lfo-3', 'lfo-4'],
  env: ['env-1', 'env-2', 'env-3', 'env-4'],
  macro: ['macro-1', 'macro-2', 'macro-3', 'macro-4', 'macro-5', 'macro-6', 'macro-7', 'macro-8'],
  scene: ['scene.next', 'scene.prev', 'scene.mix', 'scene.transition.duration']
};

const MOD_TARGET_CATEGORIES = {
  effects: ['effects.bloom', 'effects.blur', 'effects.chroma', 'effects.feedback', 'effects.kaleidoscope', 'effects.persistence'],
  particles: ['particles.density', 'particles.speed', 'particles.size', 'particles.glow'],
  sdf: ['sdf.scale', 'sdf.edge', 'sdf.glow', 'sdf.rotation', 'sdf.fill'],
  layers: [] as string[],
  scene: ['scene.next', 'scene.prev', 'scene.mix', 'scene.transition.duration']
};

export const createModulationPanel = ({ store, armMidiLearn }: ModulationPanelDeps): ModulationPanelApi => {
  const lfoList = document.getElementById('lfo-list') as HTMLDivElement;
  const envList = document.getElementById('env-list') as HTMLDivElement;
  const shList = document.getElementById('sh-list') as HTMLDivElement;
  const modMatrixList = document.getElementById('mod-matrix-list') as HTMLDivElement;
  const modMatrixAdd = document.getElementById('mod-matrix-add') as HTMLButtonElement;
  const midiMapList = document.getElementById('midi-map-list') as HTMLDivElement;
  const midiMapAdd = document.getElementById('midi-map-add') as HTMLButtonElement;

  const renderLfoList = () => {
    if (!lfoList) return;
    lfoList.innerHTML = '';
    const project = store.getState().project;
    if (project.lfos.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'matrix-empty';
      empty.textContent = 'No LFOs configured.';
      lfoList.appendChild(empty);
      return;
    }
    project.lfos.forEach((lfo, index) => {
      const row = document.createElement('div');
      row.className = 'mod-row';
      const label = document.createElement('div');
      label.textContent = `LFO ${index + 1}: ${lfo.shape}`;
      const divisionLabel = document.createElement('div');
      divisionLabel.className = 'lfo-division-label';
      if (lfo.syncDivision && lfo.syncDivision !== 'hz') {
        divisionLabel.textContent = lfo.syncDivision;
      } else if (lfo.sync) {
        divisionLabel.textContent = 'Sync';
      } else {
        divisionLabel.textContent = `${lfo.rate.toFixed(2)} Hz`;
      }
      row.appendChild(label);
      row.appendChild(divisionLabel);
      lfoList.appendChild(row);
    });
  };

  const renderEnvelopeList = () => {
    if (!envList) return;
    envList.innerHTML = '';
    const project = store.getState().project;
    if (project.envelopes.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'matrix-empty';
      empty.textContent = 'No Envelopes configured.';
      envList.appendChild(empty);
      return;
    }
    project.envelopes.forEach((env, index) => {
      const row = document.createElement('div');
      row.className = 'mod-row';
      const label = document.createElement('div');
      label.textContent = `ENV ${index + 1}: ${env.trigger}`;
      row.appendChild(label);
      envList.appendChild(row);
    });
  };

  const renderSampleHoldList = () => {
    if (!shList) return;
    shList.innerHTML = '';
    const project = store.getState().project;
    if (project.sampleHold.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'matrix-empty';
      empty.textContent = 'No Sample-Hold configured.';
      shList.appendChild(empty);
      return;
    }
    project.sampleHold.forEach((sh, index) => {
      const row = document.createElement('div');
      row.className = 'mod-row';
      const label = document.createElement('div');
      label.textContent = `S&H ${index + 1}: ${sh.rate.toFixed(2)}Hz`;
      row.appendChild(label);
      shList.appendChild(row);
    });
  };

  const renderModMatrix = () => {
    if (!modMatrixList) return;
    modMatrixList.innerHTML = '';
    const project = store.getState().project;
    if (project.modMatrix.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'matrix-empty';
      empty.textContent = 'No modulation connections.';
      modMatrixList.appendChild(empty);
      return;
    }
    project.modMatrix.forEach((connection, index) => {
      const row = document.createElement('div');
      row.className = 'matrix-row';
      if (connection.enabled === false) row.classList.add('matrix-row-disabled');
      const enableButton = document.createElement('button');
      enableButton.className = 'mod-enable-btn' + (connection.enabled === false ? ' disabled' : '');
      enableButton.textContent = connection.enabled === false ? '○' : '●';
      enableButton.title = connection.enabled === false ? 'Enable' : 'Disable';
      enableButton.addEventListener('click', () => {
        connection.enabled = connection.enabled === false ? true : false;
        renderModMatrix();
      });
      const sourceLabel = document.createElement('div');
      sourceLabel.textContent = connection.source;
      const targetLabel = document.createElement('div');
      targetLabel.textContent = connection.target;
      const amountInput = document.createElement('input');
      amountInput.type = 'range';
      amountInput.min = '-1';
      amountInput.max = '1';
      amountInput.step = '0.01';
      amountInput.value = String(connection.amount);
      amountInput.addEventListener('input', () => {
        connection.amount = Number(amountInput.value);
      });
      const midiLearnBtn = document.createElement('button');
      midiLearnBtn.className = 'midi-learn-btn';
      midiLearnBtn.textContent = 'M';
      midiLearnBtn.title = 'MIDI learn toggle for this mod connection';
      midiLearnBtn.addEventListener('click', () => {
        armMidiLearn(`modMatrix.${index}.enabled`, `Mod ${index + 1} Enable`);
      });
      const removeButton = document.createElement('button');
      removeButton.textContent = '✕';
      removeButton.addEventListener('click', () => {
        project.modMatrix.splice(index, 1);
        renderModMatrix();
      });
      row.appendChild(enableButton);
      row.appendChild(sourceLabel);
      row.appendChild(targetLabel);
      row.appendChild(amountInput);
      row.appendChild(midiLearnBtn);
      row.appendChild(removeButton);
      modMatrixList.appendChild(row);
    });
  };

  const renderMidiMappings = () => {
    if (!midiMapList) return;
    midiMapList.innerHTML = '';
    const project = store.getState().project;
    if (project.midiMappings.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'matrix-empty';
      empty.textContent = 'No MIDI mappings.';
      midiMapList.appendChild(empty);
      return;
    }
    project.midiMappings.forEach((mapping, index) => {
      const row = document.createElement('div');
      row.className = 'matrix-row';
      const controlLabel = document.createElement('div');
      controlLabel.textContent = `${mapping.message.toUpperCase()} ${mapping.control}`;
      const targetLabel = document.createElement('div');
      targetLabel.textContent = mapping.target;
      const removeButton = document.createElement('button');
      removeButton.textContent = '✕';
      removeButton.addEventListener('click', () => {
        project.midiMappings.splice(index, 1);
        renderMidiMappings();
      });
      row.appendChild(controlLabel);
      row.appendChild(targetLabel);
      row.appendChild(removeButton);
      midiMapList.appendChild(row);
    });
  };

  const renderModulators = () => {
    renderLfoList();
    renderEnvelopeList();
    renderSampleHoldList();
  };

  const addSceneModulation = (source: string, target: string) => {
    const project = store.getState().project;
    const targetConfig = SCENE_MODULATION_TARGETS[target as keyof typeof SCENE_MODULATION_TARGETS];
    
    project.modMatrix.push({
      id: `mod-${Date.now()}`,
      source,
      target,
      amount: targetConfig?.defaultAmount ?? 0.5,
      curve: 'linear',
      smoothing: 0.2,
      bipolar: target === 'scene.mix',
      min: targetConfig?.min ?? 0,
      max: targetConfig?.max ?? 1,
      enabled: true
    });
    renderModMatrix();
    setStatus(`Added scene modulation: ${source} -> ${target}`);
  };

  modMatrixAdd?.addEventListener('click', () => {
    const project = store.getState().project;
    project.modMatrix.push({
      source: 'audio.rms',
      target: 'layer-plasma.opacity',
      amount: 0.5,
      curve: 'linear',
      smoothing: 0,
      bipolar: false,
      min: 0,
      max: 1,
      enabled: true
    });
    renderModMatrix();
    setStatus('Modulation connection added.');
  });

  midiMapAdd?.addEventListener('click', () => {
    setStatus('Click a learnable control to map MIDI...');
  });

  return {
    renderModulators,
    renderModMatrix,
    renderMidiMappings,
    addSceneModulation
  };
};
