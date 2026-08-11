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
  AssetColorSpace,
  DEFAULT_PROJECT,
  type OverlayConfig,
  type VisualSynthProject
} from '../shared/project';
import { deserializeProject, serializeProject } from '../shared/serialization';
import { normalizeAssetPath } from '../shared/assets';
import { presetV3Schema, presetV4Schema, presetV5Schema, presetV6Schema, migratePreset, applyPresetV6 } from '../shared/presetMigration';
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
import { initSessionLogger, sessionLogger } from './sessionLogger';

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
// Re-entrancy guard for bpm:network-start — see handler.
let prolinkStartInProgress = false;

let lastMasterBpmAt = 0;
const ASSET_STORAGE = path.join(app.getPath('userData'), 'assets');
fs.mkdirSync(ASSET_STORAGE, { recursive: true });
initSessionLogger(app.getPath('userData'));

const clampScale = (value: number) => Math.min(1, Math.max(0.25, value));

// Containment check for asset paths that originate from loaded project files
// (attacker-controlled). At save time rewritePortableProjectAssets reads and
// copies the file at each asset.path; a path like "../../secret.png" or an
// absolute path outside the app's data dir would exfiltrate arbitrary files
// into the saved project. Only allow paths that resolve inside one of the
// given roots (ASSET_STORAGE and the project directory for portable saves).
const isPathWithinRoots = (candidate: string, roots: string[]): boolean => {
  const resolved = path.resolve(candidate);
  for (const root of roots) {
    const resolvedRoot = path.resolve(root);
    const rel = path.relative(resolvedRoot, resolved);
    if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) {
      return true;
    }
  }
  return false;
};

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
    // Drain stderr (ffmpeg writes progress at the default log level) and ignore
    // stdout/stdin. With default piped stdio that is never read, a long recording's
    // stderr volume exceeds the OS pipe buffer (~64 KB on Windows); ffmpeg then
    // blocks on the stderr write and never exits — hanging the transcode, leaving
    // the renderer stuck on "Recording...", and leaking the temp dir because the
    // surrounding finally never runs. Drain stderr into a buffer so non-zero exits
    // also surface a useful message.
    let stderrText = '';
    const ffmpeg = spawn('ffmpeg', [
      '-y',
      '-i',
      inputPath,
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      outputPath
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    // Guard against a hung transcode. ffmpeg can stall on a corrupt/malformed
    // input and never exit, which hangs the Promise forever, leaves the
    // renderer stuck on "Recording...", and leaks the temp dir (the surrounding
    // finally never runs). Cap the run at 5 minutes; on expiry kill the process
    // (SIGTERM, then SIGKILL if it won't die) and reject so cleanup runs.
    const FFMPEG_TIMEOUT_MS = 5 * 60 * 1000;
    const timeout = setTimeout(() => {
      if (!ffmpeg.killed) {
        ffmpeg.kill('SIGTERM');
        // Give it a grace period, then force-kill.
        setTimeout(() => {
          if (!ffmpeg.killed) {
            try { ffmpeg.kill('SIGKILL'); } catch { /* already dead */ }
          }
        }, 2000);
      }
      reject(new Error('ffmpeg transcode timed out'));
    }, FFMPEG_TIMEOUT_MS);
    // Don't keep the Node event loop alive solely for this timer.
    if (typeof timeout.unref === 'function') timeout.unref();
    ffmpeg.stderr.on('data', (chunk: Buffer) => {
      stderrText += chunk.toString();
      // Cap accumulation so a pathological run can't grow memory unbounded.
      if (stderrText.length > 8192) stderrText = stderrText.slice(-8192);
    });
    ffmpeg.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    ffmpeg.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code ?? 'unknown'}${stderrText ? `: ${stderrText.trim().slice(-500)}` : ''}`));
    });
  });

const hashFile = (filePath: string) => {
  // Hash the file in 1 MB chunks instead of readFileSync-ing the whole file.
  // Asset import / Save Project call this for every referenced asset, and
  // video assets can be hundreds of MB to GB — readFileSync loaded the entire
  // file into the main process (blocking the UI, and large enough files OOM-
  // crashed the app). Chunked reads keep main-process memory flat regardless
  // of asset size; the hash is identical (SHA-256 over the same bytes).
  const hash = crypto.createHash('sha256');
  const fd = fs.openSync(filePath, 'r');
  const chunkSize = 1024 * 1024;
  const buffer = Buffer.alloc(chunkSize);
  try {
    let bytesRead: number;
    do {
      bytesRead = fs.readSync(fd, buffer, 0, chunkSize, null);
      if (bytesRead > 0) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead > 0);
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest('hex');
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

// Wire crash/hang resilience on a window's renderer. Without this, a crashed or
// hung renderer leaves the main process idling with a dead window — no log, no
// recovery. On a gone renderer we log the reason and reload; on unresponsive we
// log a warning (Electron will offer the kill dialog itself).
const wireRendererCrashHandlers = (win: BrowserWindow, label: string) => {
  const wc = win.webContents;
  wc.on('render-process-gone', (_e, details) => {
    console.error(`[${label}] Renderer process gone:`, details.reason);
    try {
      sessionLogger.writeEntry({
        level: 'error',
        event: 'renderer.crashed',
        data: { label, reason: details.reason, exitCode: details.exitCode }
      });
    } catch { /* best-effort */ }
    if (!win.isDestroyed()) {
      try { wc.reload(); } catch { /* window gone */ }
    }
  });
  wc.on('unresponsive', () => {
    console.warn(`[${label}] Renderer unresponsive.`);
    try {
      sessionLogger.writeEntry({ level: 'warn', event: 'renderer.unresponsive', data: { label } });
    } catch { /* best-effort */ }
  });
};

const createWindow = () => {
  // Reset the close-confirmation state for the new window. closeConfirmed is
  // module-level and never reset otherwise; on macOS (where window-all-closed
  // doesn't quit and activate re-creates the window) the next window's close
  // handler would see closeConfirmed === true from the prior session and skip
  // the save prompt, silently losing edits made in the re-opened window.
  closeConfirmed = false;
  if (closeTimeout) {
    clearTimeout(closeTimeout);
    closeTimeout = null;
  }
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
    // Only forward http/https URLs to the OS browser. Without this scheme
    // validation, a page could open arbitrary-scheme URLs (file:, javascript:,
    // custom handlers) via shell.openExternal.
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
        void shell.openExternal(url);
      }
    } catch {
      /* malformed URL: ignore rather than forward */
    }
    return { action: 'deny' };
  });

  mainWindow.on('close', (event) => {
    if (!closeConfirmed) {
      event.preventDefault();
      mainWindow?.webContents.send('app:close-requested');
      // Fallback: if the renderer never confirms within 5s (it may be hung,
      // still saving, or the IPC listener is gone), force the close so the
      // window does not hang open indefinitely.
      if (!closeTimeout) {
        closeTimeout = setTimeout(() => {
          closeConfirmed = true;
          closeTimeout = null;
          try { mainWindow?.close(); } catch { /* window already gone */ }
        }, 5000);
      }
    } else if (closeTimeout) {
      clearTimeout(closeTimeout);
      closeTimeout = null;
    }
  });

  mainWindow.on('closed', () => {
    if (outputWindow) {
      outputWindow.close();
    }
    mainWindow = null;
  });

  wireRendererCrashHandlers(mainWindow, 'main');

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

  wireRendererCrashHandlers(outputWindow, 'output');

  applyOutputConfig(outputConfig);
};

app.whenReady().then(() => {
  const recoveryPath = path.join(app.getPath('userData'), 'sessions', 'recovery.json');
  sessionLogger.writeEntry({
    level: 'info',
    event: 'session.start',
    data: {
      appVersion: app.getVersion(),
      platform: process.platform,
      recoveryFound: fs.existsSync(recoveryPath),
    },
  });
  // Gate media (microphone/camera) permission to the app's own local origin.
  // The window loads from file://; any remote/unknown origin that ever ends up
  // in a webContents must not be granted device access unconditionally.
  const isLocalOrigin = (wc: Electron.WebContents | null): boolean => {
    try {
      const url = wc?.getURL?.() ?? '';
      return (
        url.startsWith('file://') ||
        url.startsWith('http://localhost') ||
        url.startsWith('http://127.0.0.1')
      );
    } catch {
      return false;
    }
  };

  // Set up permission handler for media devices (microphone/camera)
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media' && isLocalOrigin(webContents)) {
      callback(true);
    } else {
      callback(false);
    }
  });

  // Handle permission check requests
  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    if (permission === 'media' && isLocalOrigin(webContents)) {
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
// Timer for the close-button fallback (see mainWindow 'close' handler).
let closeTimeout: ReturnType<typeof setTimeout> | null = null;

// will-quit fires after all windows are closed and the app is about to exit.
// Unlike before-quit (which Electron does NOT await), we can preventDefault here
// and run the async cleanup to completion before calling app.exit() — otherwise
// flushAndClose's stream.end() never reaches 'finish' before the process exits
// and the last log entries (including session.end) are lost.
app.on('will-quit', (event) => {
  event.preventDefault();
  // Safety net: if cleanup hangs (e.g. a network disconnect that never
  // resolves), don't strand the app — force-exit after 3s.
  let exited = false;
  const forceExit = setTimeout(() => {
    if (!exited) {
      exited = true;
      try { sessionLogger.flushAndClose(); } catch { /* best-effort */ }
      app.exit(0);
    }
  }, 3000);
  if (typeof forceExit.unref === 'function') forceExit.unref();
  void (async () => {
    try {
      await cleanupOutputIntegrations();
      sessionLogger.writeEntry({ level: 'info', event: 'session.end', data: { reason: 'normal' } });
      await sessionLogger.flushAndClose();
      closeOpenMidiInput();
      // Tear down the Pro DJ Link UDP listener so the OS port binding is
      // released before exit (previously leaked until process death; a quick
      // restart could find the port still held).
      await stopProlinkNetwork();
    } catch (error) {
      console.error('[Quit] Async cleanup failed:', error);
    } finally {
      if (!exited) {
        exited = true;
        clearTimeout(forceExit);
        if (closeTimeout) {
          clearTimeout(closeTimeout);
          closeTimeout = null;
        }
        app.exit(0);
      }
    }
  })();
});

const clearRecoverySession = () => {
  try {
    const recoveryPath = path.join(app.getPath('userData'), 'sessions', 'recovery.json');
    if (fs.existsSync(recoveryPath)) {
      fs.unlinkSync(recoveryPath);
    }
  } catch (error) {
    console.warn('[Recovery] Failed to clear recovery session:', error);
  }
};

const copyProjectAssetToPortableLocation = (
  sourcePath: string,
  projectAssetsDir: string
) => {
  if (!fs.existsSync(sourcePath)) {
    return normalizeAssetPath(sourcePath);
  }
  fs.mkdirSync(projectAssetsDir, { recursive: true });
  const ext = path.extname(sourcePath);
  const hash = hashFile(sourcePath);
  const fileName = `${hash}${ext}`;
  const destPath = path.join(projectAssetsDir, fileName);
  if (!fs.existsSync(destPath)) {
    fs.copyFileSync(sourcePath, destPath);
  }
  return normalizeAssetPath(path.join('assets', fileName));
};

const readEmbeddedImageData = (sourcePath: string) => {
  if (!fs.existsSync(sourcePath)) return undefined;
  const ext = path.extname(sourcePath).toLowerCase();
  if (!IMAGE_EXTENSIONS.has(ext)) return undefined;
  const mime =
    ext === '.png' ? 'image/png'
    : ext === '.webp' ? 'image/webp'
    : 'image/jpeg';
  const data = fs.readFileSync(sourcePath).toString('base64');
  return `data:${mime};base64,${data}`;
};

const rewritePortableProjectAssets = (project: VisualSynthProject, targetPath: string) => {
  const projectDir = path.dirname(targetPath);
  const projectAssetsDir = path.join(projectDir, 'assets');
  const portablePathByAssetId = new Map<string, string>();
  // Allowed roots for asset reads/copies during a portable save: the app's
  // asset storage (where imports land) and the project directory (for
  // already-portable relative paths). Paths resolving outside these — e.g. a
  // malicious project with asset.path = "../../secret.png" — are dropped
  // rather than read, so a crafted project can't exfiltrate arbitrary files
  // into the saved bundle.
  const allowedRoots = [ASSET_STORAGE, projectDir];
  const resolveAssetPath = (p: string) =>
    path.isAbsolute(p) ? p : path.resolve(projectDir, p);

  project.assets = project.assets.map((asset) => {
    if (asset.kind === 'internal' || !asset.path) {
      return asset;
    }
    if (!isPathWithinRoots(resolveAssetPath(asset.path), allowedRoots)) {
      // Path escapes the allowed roots — drop the reference instead of reading
      // a file the project shouldn't reach.
      return { ...asset, path: undefined };
    }
    if (asset.kind === 'texture') {
      const embeddedData = readEmbeddedImageData(asset.path);
      if (embeddedData) {
        return {
          ...asset,
          embeddedData,
          path: undefined
        };
      }
    }
    const portablePath = copyProjectAssetToPortableLocation(asset.path, projectAssetsDir);
    portablePathByAssetId.set(asset.id, portablePath ?? asset.path);
    return {
      ...asset,
      path: portablePath
    };
  });

  project.overlays = (project.overlays ?? []).map((overlay: OverlayConfig) => {
    if (overlay.type !== 'image') {
      return overlay;
    }
    const portableFromAssetId = overlay.assetId ? portablePathByAssetId.get(overlay.assetId) : undefined;
    if (overlay.assetPath && !isPathWithinRoots(resolveAssetPath(overlay.assetPath), allowedRoots)) {
      return { ...overlay, assetPath: undefined };
    }
    const portablePath = portableFromAssetId
      ?? (overlay.assetPath ? copyProjectAssetToPortableLocation(overlay.assetPath, projectAssetsDir) : undefined);
    return {
      ...overlay,
      assetPath: portablePath
    };
  });

  return project;
};

const buildPortableProjectPayload = (payload: string, targetPath: string) => {
  const project = rewritePortableProjectAssets(deserializeProject(payload), targetPath);
  return serializeProject(project);
};

// Presets are a different shape from projects: name/createdAt live in
// `metadata`, not at the top level, so they must NOT go through
// deserializeProject/projectSchema (which requires top-level name/createdAt) —
// that route throws "Invalid project data" and every preset save silently
// fails. Instead parse the preset JSON, rewrite the embedded project's
// assets/overlays for portability, keep the top-level `assets` mirror in sync,
// and re-serialize.
const buildPortablePresetPayload = (payload: string, targetPath: string) => {
  const preset = JSON.parse(payload);
  if (preset && typeof preset === 'object' && preset.project) {
    preset.project = rewritePortableProjectAssets(preset.project as VisualSynthProject, targetPath);
    preset.assets = preset.project.assets;
  }
  return JSON.stringify(preset, null, 2);
};

// Atomically write a text file by writing to a temp sibling then renaming.
// Prevents a crash/power loss mid-write from leaving a truncated project or
// recovery file that would fail to parse on the next launch.
const writeFileAtomic = (filePath: string, payload: string) => {
  const dir = path.dirname(filePath);
  const tmp = path.join(dir, `.${path.basename(filePath)}.${process.pid}.tmp`);
  fs.writeFileSync(tmp, payload, 'utf-8');
  try {
    fs.renameSync(tmp, filePath);
  } catch (err) {
    try { fs.unlinkSync(tmp); } catch { /* temp already gone */ }
    throw err;
  }
};

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
    const portablePayload = buildPortableProjectPayload(payload, targetPath);
    writeFileAtomic(targetPath, portablePayload);
    clearRecoverySession();
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
    // Validate the project shape before persisting so a structurally corrupt
    // in-memory state is surfaced (logged) rather than silently resurrected.
    // Recovery is a safety net, so we still save the original object on
    // validation failure rather than dropping the user's work — safeParse is
    // run for diagnostics, not as a gate.
    const validation = projectSchema.safeParse(project);
    if (!validation.success) {
      console.error('[Main] Autosave validation warning:', validation.error.flatten());
    }
    writeFileAtomic(filePath, JSON.stringify(project, null, 2));
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
  try {
    const portablePayload = buildPortablePresetPayload(payload, result.filePath);
    writeFileAtomic(result.filePath, portablePayload);
    clearRecoverySession();
    return { canceled: false, filePath: result.filePath };
  } catch (error) {
    return { canceled: true, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('project:recovery', async () => {
  const baseDir = app.getPath('userData');
  const filePath = path.join(baseDir, 'sessions', 'recovery.json');
  if (!fs.existsSync(filePath)) return { found: false };
  try {
    const payload = fs.readFileSync(filePath, 'utf-8');
    return { found: true, payload, filePath };
  } catch (error) {
    // A locked/corrupted/zero-byte recovery file would otherwise reject the
    // IPC and surface as a raw "Error invoking remote method" at startup.
    // Treat unreadable recovery as no recovery — the renderer will fall back
    // to a normal startup instead of crashing the recovery check.
    console.warn('[Main] Failed to read recovery file:', error);
    return { found: false, error: error instanceof Error ? error.message : String(error) };
  }
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
  try {
    // Run the payload through buildPortableProjectPayload so the saved-as file
    // rewrites asset/overlay paths to be relative to the new location, matching
    // project:save and preset:save. Without this, Save As kept the old (often
    // absolute / original-project-relative) asset paths and bundled no assets/,
    // so moving or sharing the saved-as file lost every texture/video/overlay.
    const portablePayload = buildPortableProjectPayload(payload, result.filePath);
    writeFileAtomic(result.filePath, portablePayload);
    return { canceled: false, filePath: result.filePath };
  } catch (error) {
    return { canceled: true, error: error instanceof Error ? error.message : String(error) };
  }
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
  try {
    writeFileAtomic(result.filePath, payload);
    return { canceled: false, filePath: result.filePath };
  } catch (error) {
    return { canceled: true, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('project:open', async () => {
  if (!mainWindow) return { canceled: true };
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open VisualSynth Project',
    filters: [{ name: 'VisualSynth Project', extensions: ['json'] }],
    properties: ['openFile']
  });
  if (result.canceled || result.filePaths.length === 0) {
    console.log('[Main] Project open canceled or no file selected.');
    return { canceled: true };
  }
  const filePath = result.filePaths[0];
  console.log(`[Main] Opening project file: ${filePath}`);
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    const raw = JSON.parse(data);
    // Legacy project/preset files (version 1-5) must be migrated to v6 before
    // the v6 project schema can validate them. Without this, opening an old
    // file silently failed with "Invalid project file".
    let projectData: unknown = raw;
    if (typeof raw?.version === 'number' && raw.version >= 1 && raw.version < 6) {
      const migrated = migratePreset(raw);
      if (!migrated.success) {
        console.error('[Main] Legacy project migration failed:', migrated.errors);
        return { canceled: true, error: 'Could not migrate legacy project file.', filePath };
      }
      projectData = applyPresetV6(migrated.preset, DEFAULT_PROJECT).project;
    }
    const parsed = projectSchema.safeParse(projectData);
    if (!parsed.success) {
      console.error('[Main] Project parse failed:', parsed.error.flatten());
      return { canceled: true, error: 'Invalid project file.', filePath };
    }
    console.log(`[Main] Project file parsed successfully: ${filePath}`);
    return { canceled: false, filePath, project: parsed.data };
  } catch (error) {
    console.error('[Main] Project open failed:', error);
    return {
      canceled: true,
      filePath,
      error: error instanceof Error ? error.message : 'Project open failed.'
    };
  }
});

ipcMain.handle('scene:open', async () => {
  if (!mainWindow) return { canceled: true };
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open VisualSynth Scene',
    filters: [{ name: 'VisualSynth JSON', extensions: ['json'] }],
    properties: ['openFile', 'multiSelections']
  });
  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }
  const files: { filePath: string; payload: string }[] = [];
  for (const filePath of result.filePaths) {
    try {
      const payload = fs.readFileSync(filePath, 'utf-8');
      files.push({ filePath, payload });
    } catch (error) {
      // A file can be locked/deleted between dialog selection and read; without
      // this guard readFileSync throws inside the handler and the renderer's
      // invoke() rejects with a raw Error instead of the documented {canceled,...} shape.
      return { canceled: true, filePath, error: error instanceof Error ? error.message : 'Failed to read scene file.' };
    }
  }
  return { canceled: false, files };
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
  try {
    const payload = fs.readFileSync(filePath, 'utf-8');
    return { canceled: false, filePath, payload };
  } catch (error) {
    return { canceled: true, filePath, error: error instanceof Error ? error.message : 'Failed to read exchange file.' };
  }
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
  try {
    fs.writeFileSync(result.filePath, Buffer.from(data));
    return { canceled: false, filePath: result.filePath };
  } catch (error) {
    // Disk full / permission denied / target folder removed between dialog
    // selection and write. Previously this threw an unhandled rejection and left
    // the renderer stuck on "Capturing screenshot..."/"Recording...". Return a
    // structured error so callers can surface it (matching capture:transcode).
    return { canceled: true, error: error instanceof Error ? error.message : String(error) };
  }
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
  // Confine reads to the asset store. These handlers accept a renderer-supplied
  // path with no dialog; without confinement a compromised/XSS'd renderer could
  // copy arbitrary files (e.g. ~/.ssh/id_rsa) into the asset store and read them
  // back through the asset pipeline. Only already-imported assets live here.
  if (!isPathWithinRoots(sourcePath, [ASSET_STORAGE])) return { success: false };
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
  if (!isPathWithinRoots(filePath, [ASSET_STORAGE])) return { exists: false };
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
  // Cap the batch so a runaway caller can't pin the main process on sync
  // existsSync calls. The renderer only ever sends its own asset list, but
  // bound it defensively.
  const capped = Array.isArray(paths) ? paths.slice(0, 2000) : [];
  for (const p of capped) {
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
  try {
    const payload = fs.readFileSync(filePath, 'utf-8');
    return { canceled: false, filePath, payload };
  } catch (error) {
    return { canceled: true, error: `Failed to read plugin manifest: ${(error as Error).message}` };
  }
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
          // Use a named handler + ipcMain.on (not .once) so we can removeListener
          // on timeout/no-window. .once leaves the listener registered forever
          // if the renderer never responds (tab backgrounded, decoder crashed),
          // orphaning one ipcMain listener per timed-out decode.
          const handler = (_ev: Electron.IpcMainEvent, result: { pcmBase64: string | null; error?: string }) => {
            clearTimeout(timeout);
            ipcMain.removeListener(requestId, handler);
            if (result.pcmBase64) {
              const buf = Buffer.from(result.pcmBase64, 'base64');
              resolve(new Int16Array(buf.buffer, buf.byteOffset, buf.byteLength / 2));
            } else {
              resolve(null);
            }
          };
          const timeout = setTimeout(() => {
            ipcMain.removeListener(requestId, handler);
            resolve(null);
          }, 30000); // 30 sec timeout
          ipcMain.on(requestId, handler);
          if (mainWindow && !mainWindow.webContents.isDestroyed()) {
            mainWindow.webContents.send('shazam:decode-file', {
              requestId,
              fileBase64,
              mimeType,
              seekSeconds,
              durationSeconds
            });
          } else {
            clearTimeout(timeout);
            ipcMain.removeListener(requestId, handler);
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

    // For AudD, extract a 10-12 second clip from the middle of the file for optimal recognition
    // AudD accepts various formats but works best with 6-12 second clips
    if (request.provider === 'audd') {
      try {
        const fileStats = fs.statSync(filePath);
        const fileSizeMB = fileStats.size / (1024 * 1024);

        // For files > 5MB, extract a clip to reduce upload size and improve recognition
        if (fileSizeMB > 5) {
          console.log(`[AudD] Large file detected (${fileSizeMB.toFixed(1)}MB), extracting clip...`);

          const fileBuffer = fs.readFileSync(filePath);
          const fileBase64 = fileBuffer.toString('base64');
          const mimeType = mimeMap[ext] ?? 'application/octet-stream';

          // Extract 12 second clip starting at 25% into the file
          const seekSeconds = 15;
          const durationSeconds = 12;

          // Send to renderer for decoding (reuses Shazam decode infrastructure)
          const rendererClip = await new Promise<{ base64: string | null; mimeType: string; durationMs: number } | null>((resolve) => {
            const requestId = `audd-decode-${Date.now()}`;
            // Named handler + removeListener on timeout/no-window (see shazam block).
            const handler = (_ev: Electron.IpcMainEvent, result: { base64: string | null; mimeType: string; durationMs: number; error?: string }) => {
              clearTimeout(timeout);
              ipcMain.removeListener(requestId, handler);
              resolve(result);
            };
            const timeout = setTimeout(() => {
              ipcMain.removeListener(requestId, handler);
              resolve(null);
            }, 30000);
            ipcMain.on(requestId, handler);
            if (mainWindow && !mainWindow.webContents.isDestroyed()) {
              mainWindow.webContents.send('audd:decode-file', {
                requestId,
                fileBase64,
                mimeType,
                seekSeconds,
                durationSeconds
              });
            } else {
              clearTimeout(timeout);
              ipcMain.removeListener(requestId, handler);
              resolve(null);
            }
          });

          if (rendererClip && rendererClip.base64) {
            console.log(`[AudD] Using extracted clip: ${(rendererClip.base64.length / 1024).toFixed(1)}KB, ${rendererClip.durationMs}ms`);
            const lookup = await identifyNowPlaying({
              ...request,
              audioBase64: rendererClip.base64,
              mimeType: rendererClip.mimeType,
              durationMs: rendererClip.durationMs,
              detectedAt: Date.now()
            });

            return {
              ...lookup,
              selectedFilePath: filePath,
              canceled: false
            };
          }

          console.log('[AudD] Clip extraction failed, falling back to full file');
        }

        // For smaller files, send the full file
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
      } catch (error) {
        return {
          matched: false,
          canceled: false,
          selectedFilePath: filePath,
          error: `AudD file processing failed: ${(error as Error).message}`
        };
      }
    }

    // Generic provider: send full file as-is
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
  try {
    const data = fs.readFileSync(templatePath, 'utf-8');
    const parsed = projectSchema.safeParse(JSON.parse(data));
    if (!parsed.success) {
      return { error: 'Invalid template file.' };
    }
    return { project: parsed.data };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to load template.' };
  }
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

const stopProlinkNetwork = async () => {
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
};

ipcMain.handle('bpm:network-start', async (_event, iface: { name: string; address: string } | null) => {
  // Serialize against re-entrancy. The `if (prolinkNetwork)` guard below is
  // check-then-act: prolinkNetwork is only assigned after `await
  // module.bringOnline(config)`. Two rapid invokes both see null, both call
  // bringOnline, the second overwrites the first, which is never disconnect()ed
  // → leaked UDP port + status listener. Drop the re-entrant call; the in-flight
  // start completes and the caller can retry if needed.
  if (prolinkStartInProgress) {
    return { started: false, message: 'Pro DJ Link start already in progress.' };
  }
  if (prolinkNetwork) {
    return { started: true, message: 'Pro DJ Link already running.' };
  }
  prolinkStartInProgress = true;
  try {
    const module = await getProlinkModule();
    if (!module) {
      return { started: false, message: 'Prolink Connect not available.' };
    }

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
    // If bringOnline() succeeded but a later step (autoconfig/connect) threw,
    // prolinkNetwork is set but not working. Tear it down so a subsequent
    // bpm:network-start isn't short-circuited by the `if (prolinkNetwork)`
    // guard above ("already running" while nothing actually runs).
    await stopProlinkNetwork();
    return { started: false, message: `Prolink start failed: ${(error as Error).message}` };
  } finally {
    prolinkStartInProgress = false;
  }
});

ipcMain.handle('bpm:network-stop', async () => {
  await stopProlinkNetwork();
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

// Track the currently open node-midi input so re-opening a port closes the
// previous one instead of leaking an open port + 'message' listener per call.
let openMidiInput: any = null;
let openMidiPortIndex: number | null = null;

const closeOpenMidiInput = () => {
  if (openMidiInput) {
    try { openMidiInput.closePort(); } catch { /* already closed */ }
    try { openMidiInput.removeAllListeners('message'); } catch { /* ignore */ }
    openMidiInput = null;
    openMidiPortIndex = null;
  }
};

ipcMain.handle('midi:open-node', async (event, portIndex: number) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const midi = require('midi');
    // Close any previously opened input first to avoid leaking ports and
    // 'message' listeners (every prior call left an open port + listener
    // behind, eventually exhausting MIDI ports and memory).
    closeOpenMidiInput();
    const input = new midi.Input();
    input.ignoreTypes(false, false, false);
    input.on('message', (_delta: number, message: number[]) => {
      // The renderer that requested this input may have been destroyed; guard
      // the send so we don't throw into a dead webContents.
      if (!event.sender.isDestroyed()) {
        event.sender.send('midi:node-message', message);
      }
    });
    input.openPort(portIndex);
    openMidiInput = input;
    openMidiPortIndex = portIndex;
    return { opened: true };
  } catch (error) {
    return { opened: false, error: 'Unable to open node-midi input.' };
  }
});

ipcMain.handle('midi:close-node', async () => {
  closeOpenMidiInput();
  return { closed: true };
});

// Automated screenshot capture for documentation
ipcMain.handle('screenshot:capture-automated', async (_event, data: Uint8Array, filePath: string) => {
  try {
    // Defense-in-depth: this handler takes a raw renderer-supplied path (no save
    // dialog, unlike capture:save/transcode) for automated screenshot runs.
    // Restrict the extension to image types so a compromised renderer can't
    // overwrite arbitrary non-image files (e.g. a .dll) via this path. The
    // legitimate caller (scripts/capture-screenshots.js) only ever writes .png.
    const ext = path.extname(filePath).toLowerCase();
    if (!['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
      return { success: false, error: 'Screenshot path must have an image extension (.png/.jpg/.jpeg/.webp).' };
    }
    // Confine writes to the app's userData dir. Without this a compromised/XSS'd
    // renderer could write a .png-named file anywhere the user has write access
    // (e.g. the Startup folder) or overwrite an existing image. This handler is
    // unused by the production renderer (the capture script registers its own),
    // so confining it can't break a live flow; a future feature wanting writes
    // elsewhere should use the dialog-based capture:save channel instead.
    if (!isPathWithinRoots(filePath, [app.getPath('userData')])) {
      return { success: false, error: 'Screenshot path must be inside the app data directory.' };
    }
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, Buffer.from(data));
    return { success: true, filePath };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

// ---------------------------------------------------------------------------
// Session logging IPC handlers
// ---------------------------------------------------------------------------
ipcMain.on('session-log:write', (_event, entry: object) => {
  // Guard against a null/undefined/non-object entry from the renderer:
  // writeEntry reads entry.level/event/data outside its try/catch, so a null
  // entry would throw inside setImmediate and crash the main process.
  if (!entry || typeof entry !== 'object') return;
  setImmediate(() => sessionLogger.writeEntry(entry as any));
});

ipcMain.handle('session:get-id', () => sessionLogger.getSessionId());

ipcMain.on('session-log:write-snapshot', (_event, snapshot: object) => {
  if (!snapshot || typeof snapshot !== 'object') return;
  setImmediate(() => sessionLogger.writeFailureSnapshot(snapshot as Record<string, unknown>));
});
