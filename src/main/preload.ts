import { contextBridge, ipcRenderer } from 'electron';
import type { AssetImportResult } from '../shared/assets';
import { OutputConfig } from '../shared/project';

contextBridge.exposeInMainWorld('visualSynth', {
  saveProject: (payload: string) => ipcRenderer.invoke('project:save', payload),
  autosaveProject: (payload: string) => ipcRenderer.invoke('project:autosave', payload),
  saveExchange: (payload: string, defaultName: string) =>
    ipcRenderer.invoke('exchange:save', payload, defaultName),
  openProject: () => ipcRenderer.invoke('project:open'),
  getRecovery: () => ipcRenderer.invoke('project:recovery'),
  openExchange: () => ipcRenderer.invoke('exchange:open'),
  listPresets: () => ipcRenderer.invoke('presets:list'),
  loadPreset: (presetPath: string) => ipcRenderer.invoke('presets:load', presetPath),
  listTemplates: () => ipcRenderer.invoke('templates:list'),
  loadTemplate: (templatePath: string) => ipcRenderer.invoke('templates:load', templatePath),
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
    ipcRenderer.on('output:closed', () => handler()),
  listNetworkInterfaces: () => ipcRenderer.invoke('network:list-interfaces') as Promise<
    { name: string; address: string }[]
  >,
  startNetworkBpm: (iface: { name: string; address: string } | null) =>
    ipcRenderer.invoke('bpm:network-start', iface),
  stopNetworkBpm: () => ipcRenderer.invoke('bpm:network-stop'),
  onNetworkBpm: (
    handler: (payload: { bpm: number; deviceId: number; isMaster: boolean; isOnAir: boolean }) => void
  ) => ipcRenderer.on('bpm:network', (_event, payload) => handler(payload)),
  saveCapture: (data: Uint8Array, defaultName: string, format: 'png' | 'webm' | 'mp4') =>
    ipcRenderer.invoke('capture:save', data, defaultName, format),
  transcodeCapture: (
    data: Uint8Array,
    defaultName: string,
    format: 'mp4'
  ) => ipcRenderer.invoke('capture:transcode', data, defaultName, format),
  importAsset: (kind: 'texture' | 'shader' | 'video') =>
    ipcRenderer.invoke('assets:import', kind) as Promise<AssetImportResult>,
  analyzeAsset: (filePath: string) => ipcRenderer.invoke('assets:analyze', filePath),
  copyAssetToCache: (sourcePath: string) => ipcRenderer.invoke('assets:copy', sourcePath),
  importPlugin: () => ipcRenderer.invoke('plugins:import')
});
