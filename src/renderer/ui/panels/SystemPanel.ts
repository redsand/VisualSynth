/**
 * SystemPanel: Manages system settings, MIDI, audio, and capture
 */

import type { Store } from '../../state/store';
import { setStatus } from '../../state/events';

export interface SystemPanelDeps {
  store: Store;
  saveProject: () => Promise<void>;
  loadProject: () => Promise<void>;
  takeScreenshot: () => Promise<void>;
  toggleRecording: () => void;
}

export interface SystemPanelApi {
  updateCaptureStatus: (message: string) => void;
  syncAudioDevices: (devices: { deviceId: string; label: string }[]) => void;
  syncMidiDevices: (devices: { id: string; name: string }[]) => void;
}

export const createSystemPanel = ({
  store,
  saveProject,
  loadProject,
  takeScreenshot,
  toggleRecording
}: SystemPanelDeps): SystemPanelApi => {
  const saveButton = document.getElementById('btn-save') as HTMLButtonElement;
  const loadButton = document.getElementById('btn-load') as HTMLButtonElement;
  const audioSelect = document.getElementById('audio-device') as HTMLSelectElement;
  const midiSelect = document.getElementById('midi-device') as HTMLSelectElement;
  const captureScreenshotButton = document.getElementById('capture-screenshot') as HTMLButtonElement;
  const captureRecordToggle = document.getElementById('capture-record-toggle') as HTMLButtonElement;
  const captureStatus = document.getElementById('capture-status') as HTMLDivElement;

  const updateCaptureStatus = (message: string) => {
    captureStatus.textContent = message;
  };

  const syncAudioDevices = (devices: { deviceId: string; label: string }[]) => {
    audioSelect.innerHTML = '';
    devices.forEach((device, index) => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.textContent = device.label || `Input ${index + 1}`;
      audioSelect.appendChild(option);
    });
  };

  const syncMidiDevices = (devices: { id: string; name: string }[]) => {
    midiSelect.innerHTML = '';
    devices.forEach((device, index) => {
      const option = document.createElement('option');
      option.value = device.id;
      option.textContent = device.name || `MIDI ${index + 1}`;
      midiSelect.appendChild(option);
    });
  };

  saveButton.addEventListener('click', async () => {
    await saveProject();
    setStatus('Project saved.');
  });

  loadButton.addEventListener('click', async () => {
    await loadProject();
  });

  captureScreenshotButton.addEventListener('click', async () => {
    await takeScreenshot();
  });

  captureRecordToggle.addEventListener('click', () => {
    toggleRecording();
  });

  return {
    updateCaptureStatus,
    syncAudioDevices,
    syncMidiDevices
  };
};
