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
  isProlinkAvailable: () => ipcRenderer.invoke('bpm:prolink-available') as Promise<boolean>,
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
  checkAssetPaths: (paths: string[]) =>
    ipcRenderer.invoke('assets:checkPaths', paths) as Promise<Record<string, boolean>>,
  relinkAsset: (assetId: string, kind: string) =>
    ipcRenderer.invoke('assets:relink', assetId, kind) as Promise<AssetImportResult & { assetId?: string }>,
  importPlugin: () => ipcRenderer.invoke('plugins:import'),
  openAssetFolder: (filePath: string) => ipcRenderer.invoke('assets:open-folder', filePath),
  captureAutomatedScreenshot: (data: Uint8Array, filePath: string) =>
    ipcRenderer.invoke('screenshot:capture-automated', data, filePath),
  // Spout Output Integration (Windows only)
  spoutIsAvailable: () => ipcRenderer.invoke('spout:is-available') as Promise<boolean>,
  spoutEnable: (senderName: string) => ipcRenderer.invoke('spout:enable', senderName) as Promise<boolean>,
  spoutDisable: () => ipcRenderer.invoke('spout:disable') as Promise<void>,
  spoutSendTexture: (width: number, height: number) =>
    ipcRenderer.invoke('spout:send-texture', width, height) as Promise<void>,
  spoutGetStatus: () => ipcRenderer.invoke('spout:get-status') as Promise<{
    enabled: boolean;
    senderName: string;
    connectedReceivers: number;
  }>,
  spoutSetSenderName: (name: string) => ipcRenderer.invoke('spout:set-sender-name', name) as Promise<void>,
  // NDI Output Integration (Cross-platform)
  ndiIsAvailable: () => ipcRenderer.invoke('ndi:is-available') as Promise<boolean>,
  ndiEnable: (config: { senderName: string; groups: string }) =>
    ipcRenderer.invoke('ndi:enable', config) as Promise<boolean>,
  ndiDisable: () => ipcRenderer.invoke('ndi:disable') as Promise<void>,
  ndiSendFrame: (frame: { data: ArrayBuffer; width: number; height: number; fourCC: string }) =>
    ipcRenderer.invoke('ndi:send-frame', frame) as Promise<void>,
  ndiGetStatus: () => ipcRenderer.invoke('ndi:get-status') as Promise<{
    enabled: boolean;
    senderName: string;
    connectedReceivers: string[];
  }>,
  ndiSetSenderName: (name: string) => ipcRenderer.invoke('ndi:set-sender-name', name) as Promise<void>
});
