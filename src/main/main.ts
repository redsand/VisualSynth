import { app, BrowserWindow, dialog, ipcMain, nativeImage, shell, session } from 'electron';
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
import { presetV3Schema, presetV4Schema, presetV5Schema, presetV6Schema } from '../shared/presetMigration';
import { buildPresetIndexEntry } from '../shared/presetIndex';
import { registerOutputIntegrationHandlers, cleanupOutputIntegrations } from './outputIntegration';
import {
  cacheRemoteArtwork,
  enrichNowPlayingArtwork,
  fetchNowPlayingMetadataBridge,
  identifyNowPlaying
} from './nowPlayingLookup';
import type { NowPlayingRecognitionRequest, NowPlayingSettings } from '../shared/nowPlaying';
import { loadNowPlayingSettings, saveNowPlayingSettings } from './nowPlayingSettingsStore';
import { installAndLaunchWhatsNowPlaying, openWhatsNowPlayingFolder } from './companionTools';

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

  mainWindow.on('close', (event) => {
    if (!closeConfirmed) {
      event.preventDefault();
      mainWindow?.webContents.send('app:close-requested');
    }
  });

  mainWindow.on('closed', () => {
    if (outputWindow) {
      outputWindow.close();
    }
    mainWindow = null;
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
    parent: mainWindow ?? undefined,
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const outputPath = path.join(__dirname, '../../renderer/output.html');
  void outputWindow.loadFile(outputPath);

  outputWindow.on('closed', () => {
    outputWindow = null;
    outputConfig = { ...outputConfig, enabled: false };
    if (mainWindow && !mainWindow.webContents.isDestroyed()) {
      mainWindow.webContents.send('output:closed');
    }
  });

  applyOutputConfig(outputConfig);
};

app.whenReady().then(() => {
  // Set up permission handler for media devices (microphone/camera)
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    // Always allow microphone and camera access
    if (permission === 'media') {
      callback(true);
    } else {
      callback(false);
    }
  });

  // Handle permission check requests
  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    // Always allow microphone and camera access
    if (permission === 'media') {
      return true;
    }
    return false;
  });

  createWindow();

  // Register output integration handlers (Spout/NDI)
  if (mainWindow) {
    registerOutputIntegrationHandlers(mainWindow);
  }

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

let closeConfirmed = false;

app.on('before-quit', async () => {
  await cleanupOutputIntegrations();
});

ipcMain.handle('project:save', async (_event, payload: string, filePath?: string) => {
  if (!mainWindow) return { canceled: true };

  let targetPath = filePath;

  if (!targetPath) {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Save VisualSynth Project',
      defaultPath: 'visualsynth-project.json',
      filters: [{ name: 'VisualSynth Project', extensions: ['json'] }]
    });
    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }
    targetPath = result.filePath;
  }

  try {
    fs.writeFileSync(targetPath, payload, 'utf-8');
    return { canceled: false, filePath: targetPath };
  } catch (error) {
    return { canceled: true, error: error instanceof Error ? error.message : String(error) };
  }
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

ipcMain.handle('preset:save', async (_event, payload: string, defaultName: string) => {
  if (!mainWindow) return { canceled: true };
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save VisualSynth Scene Preset',
    defaultPath: defaultName,
    filters: [{ name: 'VisualSynth Preset', extensions: ['json'] }]
  });
  if (result.canceled || !result.filePath) {
    return { canceled: true };
  }
  fs.writeFileSync(result.filePath, payload, 'utf-8');
  return { canceled: false, filePath: result.filePath };
});

ipcMain.handle('project:recovery', async () => {
  const baseDir = app.getPath('userData');
  const filePath = path.join(baseDir, 'sessions', 'recovery.json');
  if (!fs.existsSync(filePath)) return { found: false };
  const payload = fs.readFileSync(filePath, 'utf-8');
  return { found: true, payload, filePath };
});

ipcMain.handle('app:confirm-close', () => {
  closeConfirmed = true;
  mainWindow?.close();
});

ipcMain.handle('app:show-save-dialog', async (_event, isRecovery: boolean) => {
  if (!mainWindow) return { result: 'cancel' };
  
  const choice = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons: ['Save', "Don't Save", 'Cancel'],
    defaultId: 0,
    cancelId: 2,
    title: 'Save Project?',
    message: isRecovery
      ? 'This is a recovered project. Would you like to save it?'
      : 'You have unsaved changes. Would you like to save before closing?'
  });
  
  if (choice.response === 0) return { result: 'save' };
  if (choice.response === 1) return { result: 'discard' };
  return { result: 'cancel' };
});

ipcMain.handle('project:save-as', async (_event, payload: string) => {
  if (!mainWindow) return { canceled: true };
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save VisualSynth Project As',
    defaultPath: 'visualsynth-project.json',
    filters: [{ name: 'VisualSynth Project', extensions: ['json'] }]
  });
  if (result.canceled || !result.filePath) {
    return { canceled: true };
  }
  fs.writeFileSync(result.filePath, payload, 'utf-8');
  return { canceled: false, filePath: result.filePath };
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

ipcMain.handle('scene:open', async () => {
  if (!mainWindow) return { canceled: true };
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open VisualSynth Scene',
    filters: [{ name: 'VisualSynth JSON', extensions: ['json'] }],
    properties: ['openFile']
  });
  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }
  const filePath = result.filePaths[0];
  const payload = fs.readFileSync(filePath, 'utf-8');
  return { canceled: false, filePath, payload };
});

ipcMain.handle('project:load-showcase', async () => {
  const showcasePath = app.isPackaged
    ? path.join(process.resourcesPath, 'projects', 'showcase-performance.project.json')
    : path.join(app.getAppPath(), 'showcase-performance.project.json');

  if (!fs.existsSync(showcasePath)) {
    return { found: false, error: 'Showcase project not found.' };
  }

  try {
    const payload = fs.readFileSync(showcasePath, 'utf-8');
    return { found: true, payload };
  } catch (error) {
    return { found: false, error: (error as Error).message };
  }
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
    texture: { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'] },
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

ipcMain.handle('now-playing:settings:get', () => {
  return loadNowPlayingSettings();
});

ipcMain.handle('now-playing:settings:set', (_event, settings: Partial<NowPlayingSettings>) => {
  return saveNowPlayingSettings(settings);
});

ipcMain.handle('now-playing:metadata:get', (_event, endpoint: string, secret?: string) => {
  return fetchNowPlayingMetadataBridge(endpoint, secret);
});

ipcMain.handle(
  'now-playing:test-file',
  async (
    _event,
    request: Omit<NowPlayingRecognitionRequest, 'audioBase64' | 'mimeType' | 'durationMs' | 'detectedAt'> & {
      initialPath?: string;
    }
  ) => {
    if (!mainWindow) return { matched: false, canceled: true, error: 'Main window unavailable.' };
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Audio File For Song Lookup',
      defaultPath: request.initialPath,
      filters: [
        {
          name: 'Audio',
          extensions: ['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg', 'opus', 'webm']
        }
      ],
      properties: ['openFile']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { matched: false, canceled: true };
    }

    const filePath = result.filePaths[0];
    const ext = path.extname(filePath).toLowerCase();

    const mimeMap: Record<string, string> = {
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.m4a': 'audio/mp4',
      '.aac': 'audio/aac',
      '.flac': 'audio/flac',
      '.ogg': 'audio/ogg',
      '.opus': 'audio/ogg',
      '.webm': 'audio/webm'
    };

    // For Shazam, use renderer's Web Audio API to decode file to 16kHz mono PCM
    // Sample from ~25% into the song (aiming for first drop/chorus) for better recognition
    if (request.provider === 'shazam') {
      try {
        // Read file and send to renderer for decoding
        const fileBuffer = fs.readFileSync(filePath);
        const fileBase64 = fileBuffer.toString('base64');
        const mimeType = mimeMap[ext] ?? 'application/octet-stream';
        
        // Default seek position (25% into song, aiming for first drop/chorus)
        const seekSeconds = 20;
        const durationSeconds = 5; // Shazam needs ~3.1 sec, we give 5 sec

        const rendererPcm = await new Promise<Int16Array | null>((resolve) => {
          const requestId = `shazam-decode-${Date.now()}`;
          const timeout = setTimeout(() => resolve(null), 30000); // 30 sec timeout
          ipcMain.once(requestId, (_ev, result: { pcmBase64: string | null; error?: string }) => {
            clearTimeout(timeout);
            if (result.pcmBase64) {
              const buf = Buffer.from(result.pcmBase64, 'base64');
              resolve(new Int16Array(buf.buffer, buf.byteOffset, buf.byteLength / 2));
            } else {
              resolve(null);
            }
          });
          if (mainWindow && !mainWindow.webContents.isDestroyed()) {
            mainWindow.webContents.send('shazam:decode-file', {
              requestId,
              fileBase64,
              mimeType,
              seekSeconds,
              durationSeconds
            });
          } else {
            resolve(null);
          }
        });

        if (!rendererPcm || rendererPcm.length < 16000 * 3) {
          return {
            matched: false,
            canceled: false,
            selectedFilePath: filePath,
            error: 'Failed to decode audio file. Try a different audio file format.'
          };
        }

        const rawCopy = new Uint8Array(rendererPcm.byteLength);
        rawCopy.set(new Uint8Array(rendererPcm.buffer, rendererPcm.byteOffset, rendererPcm.byteLength));
        const audioBase64 = Buffer.from(rawCopy).toString('base64');
        const numSamples = rendererPcm.length;
        const durationMs = Math.round(numSamples / 16);

        const lookup = await identifyNowPlaying({
          ...request,
          audioBase64,
          mimeType: 'audio/pcm-s16le',
          durationMs,
          detectedAt: Date.now(),
          numSamples
        });

        return {
          ...lookup,
          selectedFilePath: filePath,
          canceled: false
        };
      } catch (error) {
        return {
          matched: false,
          canceled: false,
          selectedFilePath: filePath,
          error: `Shazam file processing failed: ${(error as Error).message}`
        };
      }
    }

    const buffer = fs.readFileSync(filePath);
    const lookup = await identifyNowPlaying({
      ...request,
      audioBase64: buffer.toString('base64'),
      mimeType: mimeMap[ext] ?? 'application/octet-stream',
      durationMs: 0,
      detectedAt: Date.now()
    });

    return {
      ...lookup,
      selectedFilePath: filePath,
      canceled: false
    };
  }
);

ipcMain.handle('now-playing:identify', async (_event, request: NowPlayingRecognitionRequest) => {
  return identifyNowPlaying(request);
});

ipcMain.handle('now-playing:cache-artwork', async (_event, imageUrl: string) => {
  return cacheRemoteArtwork(imageUrl, ASSET_STORAGE);
});

ipcMain.handle(
  'now-playing:artwork:enrich',
  async (_event, request: { title?: string; artist?: string; album?: string; market?: string }) => {
    return enrichNowPlayingArtwork(request);
  }
);

ipcMain.handle('companion:whats-now-playing:launch', async () => {
  return installAndLaunchWhatsNowPlaying();
});

ipcMain.handle('companion:whats-now-playing:open-folder', async () => {
  return openWhatsNowPlayingFolder();
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

  console.log('[Presets] isPackaged:', app.isPackaged);
  console.log('[Presets] process.resourcesPath:', process.resourcesPath);
  console.log('[Presets] app.getAppPath():', app.getAppPath());
  console.log('[Presets] Listing from:', presetDir);

  if (!fs.existsSync(presetDir)) {
    console.error('[Presets] Directory not found:', presetDir);
    return [];
  }

  const files = fs.readdirSync(presetDir).filter((file) => file.endsWith('.json'));

  // Read all preset files in parallel to avoid blocking the main process
  const results = await Promise.all(
    files.map(async (file) => {
      const presetPath = path.join(presetDir, file);
      try {
        const content = await fs.promises.readFile(presetPath, 'utf-8');
        const data = JSON.parse(content);
        return buildPresetIndexEntry(presetPath, data);
      } catch (error) {
        console.error(`[Presets] Failed to read/parse ${file}:`, error);
        return buildPresetIndexEntry(presetPath, {
          name: file,
          metadata: { importedFrom: 'Unreadable' },
          category: 'Utility/Test'
        });
      }
    })
  );

  return results;
});

ipcMain.handle('presets:load', async (_event, presetPath: string) => {
  console.log('[Presets] Loading:', presetPath);
  try {
    let resolvedPath: string;
    if (path.isAbsolute(presetPath)) {
      resolvedPath = presetPath;
    } else {
      const devPath = path.join(app.getAppPath(), presetPath);
      const prodPath = path.join(
        process.resourcesPath,
        presetPath.replace(/^assets[\/\\]/, '')
      );
      resolvedPath = app.isPackaged ? prodPath : devPath;
      if (!fs.existsSync(resolvedPath)) {
        const altPath = app.isPackaged ? devPath : prodPath;
        if (fs.existsSync(altPath)) {
          resolvedPath = altPath;
        }
      }
    }
    console.log('[Presets] Resolved path:', resolvedPath);
    if (!fs.existsSync(resolvedPath)) {
      console.error('[Presets] File not found:', resolvedPath);
      return { error: `Preset file not found: ${presetPath}` };
    }
    const data = JSON.parse(fs.readFileSync(resolvedPath, 'utf-8'));

    if (data.version === 6) {
      const v6Parsed = presetV6Schema.safeParse(data);
      if (!v6Parsed.success) {
        const errorMsg = `Invalid preset v6: ${JSON.stringify(v6Parsed.error.format())}`;
        console.error('[Presets] V6 Validation Failed:', errorMsg);
        return { error: errorMsg };
      }
      return { preset: v6Parsed.data };
    }

    if (data.version === 5) {
      const v5Parsed = presetV5Schema.safeParse(data);
      if (!v5Parsed.success) {
        const errorMsg = `Invalid preset v5: ${JSON.stringify(v5Parsed.error.format())}`;
        console.error('[Presets] V5 Validation Failed:', errorMsg);
        return { error: errorMsg };
      }
      return { preset: v5Parsed.data };
    }

    if (data.version === 4) {
      const v4Parsed = presetV4Schema.safeParse(data);
      if (!v4Parsed.success) {
        const errorMsg = `Invalid preset v4: ${JSON.stringify(v4Parsed.error.format())}`;
        console.error('[Presets] V4 Validation Failed:', errorMsg);
        return { error: errorMsg };
      }
      return { preset: v4Parsed.data };
    }

    if (data.version === 3) {
      const v3Parsed = presetV3Schema.safeParse(data);
      if (!v3Parsed.success) {
        const errorMsg = `Invalid preset v3: ${JSON.stringify(v3Parsed.error.format())}`;
        console.error('[Presets] V3 Validation Failed:', errorMsg);
        return { error: errorMsg };
      }
      return { preset: v3Parsed.data };
    }

    const parsed = projectSchema.safeParse(data);
    if (!parsed.success) {
      console.error('[Presets] V2 Parse Failed:', parsed.error.format());
      return { error: 'Invalid preset file.' };
    }
    return { preset: parsed.data };
  } catch (error) {
    console.error('[Presets] Load Exception:', error);
    return { error: `Failed to load preset: ${(error as Error).message}` };
  }
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
          if (mainWindow && !mainWindow.webContents.isDestroyed()) {
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

// Automated screenshot capture for documentation
ipcMain.handle('screenshot:capture-automated', async (_event, data: Uint8Array, filePath: string) => {
  try {
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, Buffer.from(data));
    return { success: true, filePath };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});
