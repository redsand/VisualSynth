import { app, BrowserWindow, dialog, ipcMain, nativeImage, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { spawn } from 'child_process';
import type { NetworkInterfaceInfoIPv4 } from 'os';
import crypto from 'crypto';
import { projectSchema } from '../shared/projectSchema';
import {
  DEFAULT_OUTPUT_CONFIG,
  OUTPUT_BASE_HEIGHT,
  OUTPUT_BASE_WIDTH,
  OutputConfig,
  AssetColorSpace
} from '../shared/project';
import { deserializeProject } from '../shared/serialization';

const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
let outputWindow: BrowserWindow | null = null;
let outputConfig: OutputConfig = { ...DEFAULT_OUTPUT_CONFIG };

// Use 'any' to avoid build errors if the optional dependency is missing
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let prolinkNetwork: any | null = null;
let prolinkStatusHandler: ((status: { trackBPM: number | null; isMaster: boolean; isOnAir: boolean; deviceId: number }) => void) | null =
  null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let prolinkModule: any | null = null;

let lastMasterBpmAt = 0;
const ASSET_STORAGE = path.join(app.getPath('userData'), 'assets');
fs.mkdirSync(ASSET_STORAGE, { recursive: true });

const clampScale = (value: number) => Math.min(1, Math.max(0.25, value));
const captureFilters: Record<string, { name: string; extensions: string[] }> = {
  png: { name: 'PNG Image', extensions: ['png'] },
  webm: { name: 'WebM Video', extensions: ['webm'] },
  mp4: { name: 'MP4 Video', extensions: ['mp4'] }
};

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

const getProlinkModule = async () => {
  if (prolinkModule) return prolinkModule;
  try {
    // Dynamic import wrapped in try/catch to handle optional dependency
    // @ts-ignore
    prolinkModule = await import('prolink-connect');
  } catch (e) {
    console.warn('Could not load prolink-connect, network BPM features will be unavailable.', e);
    prolinkModule = null;
  }
  return prolinkModule;
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

const hashFile = (filePath: string) => {
  const data = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(data).digest('hex');
};

const mimeFromExt = (ext: string) => {
  const map: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm'
  };
  return map[ext.toLowerCase()] ?? 'application/octet-stream';
};

const gatherAssetMetadata = (filePath: string) => {
  const ext = path.extname(filePath).toLowerCase();
  const stats = fs.statSync(filePath);
  const metadata: { mime: string; size: number; colorSpace: AssetColorSpace } & Partial<{
      width: number;
      height: number;
      thumbnail: string;
    }> = {
    mime: mimeFromExt(ext),
    size: stats.size,
    colorSpace: 'srgb'
  };

  if (IMAGE_EXTENSIONS.has(ext)) {
    try {
      const image = nativeImage.createFromPath(filePath);
      if (!image.isEmpty()) {
        const { width, height } = image.getSize();
        metadata.width = width;
        metadata.height = height;
        const preview = image.resize({ width: 200, height: 200, quality: 'good' });
        if (!preview.isEmpty()) {
          metadata.thumbnail = preview.toDataURL();
        }
      }
    } catch {
      // ignore metadata errors
    }
  }

  return metadata;
};

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
  const hash = hashFile(filePath);
  const ext = path.extname(filePath);
  const dest = path.join(ASSET_STORAGE, `${hash}${ext}`);
  if (!fs.existsSync(dest)) {
    fs.copyFileSync(filePath, dest);
  }
  const metadata = gatherAssetMetadata(dest);
  return {
    canceled: false,
    filePath: dest,
    hash,
    ...metadata
  };
});

ipcMain.handle('assets:copy', async (_event, sourcePath: string) => {
  if (!fs.existsSync(sourcePath)) return { success: false };
  const hash = hashFile(sourcePath);
  const ext = path.extname(sourcePath);
  const dest = path.join(ASSET_STORAGE, `${hash}${ext}`);
  if (!fs.existsSync(dest)) {
    fs.copyFileSync(sourcePath, dest);
  }
  return { success: true, filePath: dest };
});

ipcMain.handle('assets:analyze', async (_event, filePath: string) => {
  if (!fs.existsSync(filePath)) return { exists: false };
  const hash = hashFile(filePath);
  return {
    exists: true,
    hash,
    ...gatherAssetMetadata(filePath)
  };
});

ipcMain.handle('assets:checkPaths', async (_event, paths: string[]) => {
  const results: Record<string, boolean> = {};
  for (const p of paths) {
    results[p] = fs.existsSync(p);
  }
  return results;
});

ipcMain.handle('assets:relink', async (_event, assetId: string, kind: string) => {
  if (!mainWindow) return { canceled: true };
  const filters =
    kind === 'video'
      ? [{ name: 'Video', extensions: ['mp4', 'webm', 'mov'] }]
      : kind === 'shader'
        ? [{ name: 'Shader', extensions: ['glsl', 'frag', 'vert'] }]
        : [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'webp'] }];
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Relink Asset',
    filters,
    properties: ['openFile']
  });
  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }
  const filePath = result.filePaths[0];
  const hash = hashFile(filePath);
  const ext = path.extname(filePath);
  const dest = path.join(ASSET_STORAGE, `${hash}${ext}`);
  if (!fs.existsSync(dest)) {
    fs.copyFileSync(filePath, dest);
  }
  return {
    canceled: false,
    assetId,
    filePath: dest,
    hash,
    ...gatherAssetMetadata(dest)
  };
});

ipcMain.handle('plugins:import', async () => {
  if (!mainWindow) return { canceled: true };
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Import Plugin',
    filters: [{ name: 'Plugin Manifest', extensions: ['json'] }],
    properties: ['openFile']
  });
  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }
  const filePath = result.filePaths[0];
  const payload = fs.readFileSync(filePath, 'utf-8');
  return { canceled: false, filePath, payload };
});

ipcMain.handle('assets:open-folder', async (_event, filePath: string) => {
  if (!filePath) return { opened: false };
  shell.showItemInFolder(filePath);
  return { opened: true };
});

ipcMain.handle('presets:list', async () => {
  const presetDir = app.isPackaged
    ? path.join(process.resourcesPath, 'presets')
    : path.join(app.getAppPath(), 'assets/presets');

  if (!fs.existsSync(presetDir)) return [];
  return fs
    .readdirSync(presetDir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => {
      const presetPath = path.join(presetDir, file);
      try {
        const data = JSON.parse(fs.readFileSync(presetPath, 'utf-8'));
        return {
          name: typeof data.name === 'string' && data.name.length > 0 ? data.name : file,
          category: typeof data.category === 'string' ? data.category : 'General',
          path: presetPath
        };
      } catch {
        return { name: file, category: 'General', path: presetPath };
      }
    });
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

ipcMain.handle('bpm:prolink-available', async () => {
  const module = await getProlinkModule();
  return Boolean(module);
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

  const module = await getProlinkModule();
  if (!module) {
    return { started: false, message: 'Prolink Connect not available.' };
  }

  try {
    const selected = findInterface(iface);
    const config = selected ? { iface: selected, vcdjId: 7 } : undefined;
    prolinkNetwork = await module.bringOnline(config);

    if (!prolinkNetwork.isConfigured) {
      await prolinkNetwork.autoconfigFromPeers();
    }

    prolinkNetwork.connect();
    if (prolinkNetwork.statusEmitter) {
      prolinkStatusHandler = (status: any) => {
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
  } catch (error) {
    console.error('Failed to start Prolink network:', error);
    return { started: false, message: `Prolink start failed: ${(error as Error).message}` };
  }
});

ipcMain.handle('bpm:network-stop', async () => {
  if (prolinkNetwork?.statusEmitter && prolinkStatusHandler) {
    prolinkNetwork.statusEmitter.off('status', prolinkStatusHandler);
  }
  prolinkStatusHandler = null;
  if (prolinkNetwork) {
    try {
      await prolinkNetwork.disconnect();
    } catch (e) {
      console.warn('Error disconnecting Prolink:', e);
    }
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