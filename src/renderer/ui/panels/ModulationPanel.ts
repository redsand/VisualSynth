/**
 * ModulationPanel: Manages LFOs, Envelopes, Sample-Hold, Mod Matrix, and MIDI Mappings
 */

import type { Store } from '../../state/store';
import { setStatus } from '../../state/events';

export interface ModulationPanelDeps {
  store: Store;
  armMidiLearn: (target: string, label: string) => void;
}

export interface ModulationPanelApi {
  renderModulators: () => void;
  renderModMatrix: () => void;
  renderMidiMappings: () => void;
}

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
      const rate = document.createElement('input');
      rate.type = 'range';
      rate.min = '0.01';
      rate.max = '10';
      rate.step = '0.01';
      rate.value = String(lfo.rate);
      rate.addEventListener('input', () => {
        lfo.rate = Number(rate.value);
      });
      row.appendChild(label);
      row.appendChild(rate);
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
      const removeButton = document.createElement('button');
      removeButton.textContent = '✕';
      removeButton.addEventListener('click', () => {
        project.modMatrix.splice(index, 1);
        renderModMatrix();
      });
      row.appendChild(sourceLabel);
      row.appendChild(targetLabel);
      row.appendChild(amountInput);
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
      targetLabel.textContent = mapping.label || mapping.target;
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

  modMatrixAdd?.addEventListener('click', () => {
    const project = store.getState().project;
    project.modMatrix.push({
      source: 'audio.rms',
      target: 'layer-plasma.opacity',
      amount: 0.5
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
    renderMidiMappings
  };
};
