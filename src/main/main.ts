import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { projectSchema } from '../shared/projectSchema';
import {
  DEFAULT_OUTPUT_CONFIG,
  OUTPUT_BASE_HEIGHT,
  OUTPUT_BASE_WIDTH,
  OutputConfig
} from '../shared/project';

const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
let outputWindow: BrowserWindow | null = null;
let outputConfig: OutputConfig = { ...DEFAULT_OUTPUT_CONFIG };

const clampScale = (value: number) => Math.min(1, Math.max(0.25, value));

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

  const indexPath = path.join(__dirname, '../renderer/index.html');
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

  const outputPath = path.join(__dirname, '../renderer/output.html');
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
