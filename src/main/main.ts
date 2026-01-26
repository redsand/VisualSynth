import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { spawn } from 'child_process';
import type { NetworkInterfaceInfoIPv4 } from 'os';
import { bringOnline, ProlinkNetwork } from 'prolink-connect';
import { projectSchema } from '../shared/projectSchema';
import {
  DEFAULT_OUTPUT_CONFIG,
  OUTPUT_BASE_HEIGHT,
  OUTPUT_BASE_WIDTH,
  OutputConfig
} from '../shared/project';
import { deserializeProject } from '../shared/serialization';

const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
let outputWindow: BrowserWindow | null = null;
let outputConfig: OutputConfig = { ...DEFAULT_OUTPUT_CONFIG };
let prolinkNetwork: ProlinkNetwork | null = null;
let prolinkStatusHandler: ((status: { trackBPM: number | null; isMaster: boolean; isOnAir: boolean; deviceId: number }) => void) | null =
  null;
let lastMasterBpmAt = 0;

const clampScale = (value: number) => Math.min(1, Math.max(0.25, value));
const captureFilters: Record<string, { name: string; extensions: string[] }> = {
  png: { name: 'PNG Image', extensions: ['png'] },
  webm: { name: 'WebM Video', extensions: ['webm'] },
  mp4: { name: 'MP4 Video', extensions: ['mp4'] }
};

const runFfmpeg = (inputPath: string, outputPath: string) =>
  new Promise<void>((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-y',
      '-i',
      inputPath,
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      outputPath
    ]);
    ffmpeg.on('error', (error) => reject(error));
    ffmpeg.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code ?? 'unknown'}`));
    });
  });

const applyOutputConfig = (config: OutputConfig) => {
  outputConfig = { ...outputConfig, ...config, scale: clampScale(config.scale ?? outputConfig.scale) };
  if (!outputWindow) return;
  const width = Math.round(OUTPUT_BASE_WIDTH * outputConfig.scale);
  const height = Math.round(OUTPUT_BASE_HEIGHT * outputConfig.scale);
  outputWindow.setContentSize(width, height);
  outputWindow.setFullScreen(outputConfig.fullscreen);
};

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    backgroundColor: '#0b0f18',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const indexPath = path.join(__dirname, '../../renderer/index.html');
  void mainWindow.loadFile(indexPath);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
};

const createOutputWindow = () => {
  if (outputWindow) {
    outputWindow.focus();
    return;
  }
  const width = Math.round(OUTPUT_BASE_WIDTH * outputConfig.scale);
  const height = Math.round(OUTPUT_BASE_HEIGHT * outputConfig.scale);
  outputWindow = new BrowserWindow({
    width,
    height,
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const outputPath = path.join(__dirname, '../../renderer/output.html');
  void outputWindow.loadFile(outputPath);

  outputWindow.on('closed', () => {
    outputWindow = null;
    outputConfig = { ...outputConfig, enabled: false };
    if (mainWindow) {
      mainWindow.webContents.send('output:closed');
    }
  });

  applyOutputConfig(outputConfig);
};

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('project:save', async (_event, payload: string) => {
  if (!mainWindow) return { canceled: true };
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save VisualSynth Project',
    defaultPath: 'visualsynth-project.json',
    filters: [{ name: 'VisualSynth Project', extensions: ['json'] }]
  });
  if (result.canceled || !result.filePath) {
    return { canceled: true };
  }
  fs.writeFileSync(result.filePath, payload, 'utf-8');
  return { canceled: false, filePath: result.filePath };
});

ipcMain.handle('project:autosave', async (_event, payload: string) => {
  if (!mainWindow) return { saved: false };
  try {
    const project = deserializeProject(payload);
    const baseDir = app.getPath('userData');
    const sessionDir = path.join(baseDir, 'sessions');
    fs.mkdirSync(sessionDir, { recursive: true });
    const filePath = path.join(sessionDir, 'recovery.json');
    fs.writeFileSync(filePath, JSON.stringify(project, null, 2), 'utf-8');
    return { saved: true, filePath };
  } catch (error) {
    return { saved: false };
  }
});

ipcMain.handle('project:recovery', async () => {
  const baseDir = app.getPath('userData');
  const filePath = path.join(baseDir, 'sessions', 'recovery.json');
  if (!fs.existsSync(filePath)) return { found: false };
  const payload = fs.readFileSync(filePath, 'utf-8');
  return { found: true, payload, filePath };
});

ipcMain.handle('exchange:save', async (_event, payload: string, defaultName: string) => {
  if (!mainWindow) return { canceled: true };
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export VisualSynth Exchange',
    defaultPath: defaultName,
    filters: [{ name: 'VisualSynth Exchange', extensions: ['json'] }]
  });
  if (result.canceled || !result.filePath) {
    return { canceled: true };
  }
  fs.writeFileSync(result.filePath, payload, 'utf-8');
  return { canceled: false, filePath: result.filePath };
});

ipcMain.handle('project:open', async () => {
  if (!mainWindow) return { canceled: true };
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open VisualSynth Project',
    filters: [{ name: 'VisualSynth Project', extensions: ['json'] }],
    properties: ['openFile']
  });
  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }
  const filePath = result.filePaths[0];
  const data = fs.readFileSync(filePath, 'utf-8');
  const parsed = projectSchema.safeParse(JSON.parse(data));
  if (!parsed.success) {
    return { canceled: true, error: 'Invalid project file.' };
  }
  return { canceled: false, filePath, project: parsed.data };
});

ipcMain.handle('exchange:open', async () => {
  if (!mainWindow) return { canceled: true };
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Import VisualSynth Exchange',
    filters: [{ name: 'VisualSynth Exchange', extensions: ['json'] }],
    properties: ['openFile']
  });
  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }
  const filePath = result.filePaths[0];
  const payload = fs.readFileSync(filePath, 'utf-8');
  return { canceled: false, filePath, payload };
});

ipcMain.handle('capture:save', async (_event, data: Uint8Array, defaultName: string, format: 'png' | 'webm' | 'mp4') => {
  if (!mainWindow) return { canceled: true };
  const filter = captureFilters[format] ?? captureFilters.png;
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Capture',
    defaultPath: defaultName,
    filters: [filter]
  });
  if (result.canceled || !result.filePath) {
    return { canceled: true };
  }
  fs.writeFileSync(result.filePath, Buffer.from(data));
  return { canceled: false, filePath: result.filePath };
});

ipcMain.handle('capture:transcode', async (_event, data: Uint8Array, defaultName: string) => {
  if (!mainWindow) return { canceled: true };
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Capture (MP4)',
    defaultPath: defaultName,
    filters: [captureFilters.mp4]
  });
  if (result.canceled || !result.filePath) {
    return { canceled: true };
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'visualsynth-'));
  const inputPath = path.join(tempDir, 'capture.webm');
  try {
    fs.writeFileSync(inputPath, Buffer.from(data));
    await runFfmpeg(inputPath, result.filePath);
    return { canceled: false, filePath: result.filePath };
  } catch (error) {
    return { canceled: false, error: (error as Error).message };
  } finally {
    try {
      fs.unlinkSync(inputPath);
      fs.rmdirSync(tempDir);
    } catch {
      // ignore cleanup errors
    }
  }
});

ipcMain.handle('assets:import', async (_event, kind: 'texture' | 'shader' | 'video') => {
  if (!mainWindow) return { canceled: true };
  const filters: Record<typeof kind, { name: string; extensions: string[] }> = {
    texture: { name: 'Textures', extensions: ['png', 'jpg', 'jpeg', 'webp'] },
    shader: { name: 'Shaders', extensions: ['glsl', 'frag', 'vert'] },
    video: { name: 'Videos', extensions: ['mp4', 'webm', 'mov'] }
  };
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Import Asset',
    filters: [filters[kind]],
    properties: ['openFile']
  });
  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }
  const filePath = result.filePaths[0];
  return { canceled: false, filePath };
});

ipcMain.handle('presets:list', async () => {
  const presetDir = app.isPackaged
    ? path.join(process.resourcesPath, 'presets')
    : path.join(app.getAppPath(), 'assets/presets');

  if (!fs.existsSync(presetDir)) return [];
  return fs
    .readdirSync(presetDir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => ({
      name: file,
      path: path.join(presetDir, file)
    }));
});

ipcMain.handle('presets:load', async (_event, presetPath: string) => {
  const data = fs.readFileSync(presetPath, 'utf-8');
  const parsed = projectSchema.safeParse(JSON.parse(data));
  if (!parsed.success) {
    return { error: 'Invalid preset file.' };
  }
  return { project: parsed.data };
});

ipcMain.handle('templates:list', async () => {
  const templateDir = app.isPackaged
    ? path.join(process.resourcesPath, 'templates')
    : path.join(app.getAppPath(), 'assets/templates');

  if (!fs.existsSync(templateDir)) return [];
  return fs
    .readdirSync(templateDir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => ({
      name: file,
      path: path.join(templateDir, file)
    }));
});

ipcMain.handle('templates:load', async (_event, templatePath: string) => {
  const data = fs.readFileSync(templatePath, 'utf-8');
  const parsed = projectSchema.safeParse(JSON.parse(data));
  if (!parsed.success) {
    return { error: 'Invalid template file.' };
  }
  return { project: parsed.data };
});

ipcMain.handle('output:get-config', () => outputConfig);

ipcMain.handle('output:is-open', () => Boolean(outputWindow));

ipcMain.handle('output:open', (_event, config: OutputConfig) => {
  outputConfig = { ...outputConfig, ...config, enabled: true };
  createOutputWindow();
  applyOutputConfig(outputConfig);
  return { opened: true, config: outputConfig };
});

ipcMain.handle('output:close', () => {
  if (outputWindow) {
    outputWindow.close();
  }
  outputConfig = { ...outputConfig, enabled: false };
  return { closed: true, config: outputConfig };
});

ipcMain.handle('output:set-config', (_event, config: OutputConfig) => {
  applyOutputConfig(config);
  return outputConfig;
});

ipcMain.handle('network:list-interfaces', () => {
  const interfaces = os.networkInterfaces();
  const items: { name: string; address: string }[] = [];
  for (const [name, entries] of Object.entries(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        items.push({ name, address: entry.address });
      }
    }
  }
  return items;
});

const findInterface = (iface: { name: string; address: string } | null): NetworkInterfaceInfoIPv4 | null => {
  if (!iface) return null;
  const interfaces = os.networkInterfaces();
  const entries = interfaces[iface.name] ?? [];
  for (const entry of entries) {
    if (entry.family === 'IPv4' && entry.address === iface.address && !entry.internal) {
      return entry;
    }
  }
  return null;
};

ipcMain.handle('bpm:network-start', async (_event, iface: { name: string; address: string } | null) => {
  if (prolinkNetwork) {
    return { started: true, message: 'Pro DJ Link already running.' };
  }

  const selected = findInterface(iface);
  const config = selected ? { iface: selected, vcdjId: 7 } : undefined;
  prolinkNetwork = await bringOnline(config);

  if (!prolinkNetwork.isConfigured) {
    await prolinkNetwork.autoconfigFromPeers();
  }

  prolinkNetwork.connect();
  if (prolinkNetwork.statusEmitter) {
    prolinkStatusHandler = (status) => {
      if (!status.trackBPM) return;
      const now = Date.now();
      const useMaster = status.isMaster;
      if (useMaster) {
        lastMasterBpmAt = now;
      }
      const allowFallback = now - lastMasterBpmAt > 2000 && status.isOnAir;
      if (useMaster || allowFallback) {
        if (mainWindow) {
          mainWindow.webContents.send('bpm:network', {
            bpm: status.trackBPM,
            deviceId: status.deviceId,
            isMaster: status.isMaster,
            isOnAir: status.isOnAir
          });
        }
      }
    };
    prolinkNetwork.statusEmitter.on('status', prolinkStatusHandler);
  }

  return {
    started: true,
    message: selected
      ? `Pro DJ Link listening on ${selected.address}.`
      : 'Pro DJ Link autoconfig active.'
  };
});

ipcMain.handle('bpm:network-stop', async () => {
  if (prolinkNetwork?.statusEmitter && prolinkStatusHandler) {
    prolinkNetwork.statusEmitter.off('status', prolinkStatusHandler);
  }
  prolinkStatusHandler = null;
  if (prolinkNetwork) {
    await prolinkNetwork.disconnect();
    prolinkNetwork = null;
  }
  return { stopped: true };
});

ipcMain.handle('midi:list-node', async () => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const midi = require('midi');
    const input = new midi.Input();
    const count = input.getPortCount();
    const ports = Array.from({ length: count }, (_v, i) => ({
      index: i,
      name: input.getPortName(i)
    }));
    input.closePort();
    return ports;
  } catch (error) {
    return [];
  }
});

ipcMain.handle('midi:open-node', async (event, portIndex: number) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const midi = require('midi');
    const input = new midi.Input();
    input.ignoreTypes(false, false, false);
    input.on('message', (_delta: number, message: number[]) => {
      event.sender.send('midi:node-message', message);
    });
    input.openPort(portIndex);
    return { opened: true };
  } catch (error) {
    return { opened: false, error: 'Unable to open node-midi input.' };
  }
});
