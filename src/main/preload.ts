import { contextBridge, ipcRenderer } from 'electron';
import { OutputConfig } from '../shared/project';

contextBridge.exposeInMainWorld('visualSynth', {
  saveProject: (payload: string) => ipcRenderer.invoke('project:save', payload),
  openProject: () => ipcRenderer.invoke('project:open'),
  listPresets: () => ipcRenderer.invoke('presets:list'),
  loadPreset: (presetPath: string) => ipcRenderer.invoke('presets:load', presetPath),
  listNodeMidi: () => ipcRenderer.invoke('midi:list-node'),
  openNodeMidi: (portIndex: number) => ipcRenderer.invoke('midi:open-node', portIndex),
  onNodeMidiMessage: (handler: (message: number[]) => void) =>
    ipcRenderer.on('midi:node-message', (_event, message: number[]) => handler(message)),
  getOutputConfig: () => ipcRenderer.invoke('output:get-config') as Promise<OutputConfig>,
  isOutputOpen: () => ipcRenderer.invoke('output:is-open') as Promise<boolean>,
  openOutput: (config: OutputConfig) => ipcRenderer.invoke('output:open', config),
  closeOutput: () => ipcRenderer.invoke('output:close'),
  setOutputConfig: (config: OutputConfig) => ipcRenderer.invoke('output:set-config', config),
  onOutputClosed: (handler: () => void) =>
    ipcRenderer.on('output:closed', () => handler())
});
