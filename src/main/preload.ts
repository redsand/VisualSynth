import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('visualSynth', {
  saveProject: (payload: string) => ipcRenderer.invoke('project:save', payload),
  openProject: () => ipcRenderer.invoke('project:open'),
  listPresets: () => ipcRenderer.invoke('presets:list'),
  loadPreset: (presetPath: string) => ipcRenderer.invoke('presets:load', presetPath),
  listNodeMidi: () => ipcRenderer.invoke('midi:list-node'),
  openNodeMidi: (portIndex: number) => ipcRenderer.invoke('midi:open-node', portIndex),
  onNodeMidiMessage: (handler: (message: number[]) => void) =>
    ipcRenderer.on('midi:node-message', (_event, message: number[]) => handler(message))
});
