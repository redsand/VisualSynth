import { app, shell } from 'electron';
import fs from 'fs';
import path from 'path';
import { execFile, spawn } from 'child_process';

interface CompanionArtifact {
  platform: string;
  arch: string;
  filename: string;
  downloadUrl?: string;
  sha256?: string;
}

interface CompanionManifest {
  name: string;
  vendor: string;
  version: string;
  artifacts: CompanionArtifact[];
}

export interface CompanionToolLaunchResult {
  available: boolean;
  installed: boolean;
  launched: boolean;
  extractedPath?: string;
  executablePath?: string;
  message?: string;
  error?: string;
}

const RESOURCE_DIR = app.isPackaged
  ? path.join(process.resourcesPath, 'companion-tools', 'whats-now-playing')
  : path.join(app.getAppPath(), 'third_party', 'whats-now-playing');

const INSTALL_DIR = path.join(app.getPath('userData'), 'companion-tools', 'whats-now-playing');

const execFileAsync = (command: string, args: string[]) =>
  new Promise<void>((resolve, reject) => {
    execFile(command, args, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

const readManifest = (): CompanionManifest => {
  const manifestPath = path.join(RESOURCE_DIR, 'artifacts.json');
  const raw = fs.readFileSync(manifestPath, 'utf-8');
  return JSON.parse(raw) as CompanionManifest;
};

const selectArtifact = (manifest: CompanionManifest): CompanionArtifact | null => {
  if (process.platform === 'win32') {
    return manifest.artifacts.find((artifact) => artifact.platform === 'windows') ?? null;
  }

  if (process.platform === 'darwin') {
    const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
    return (
      manifest.artifacts.find(
        (artifact) => artifact.platform === 'macos' && artifact.arch === arch
      ) ?? null
    );
  }

  return null;
};

const findExecutable = (rootDir: string): string | null => {
  if (!fs.existsSync(rootDir)) {
    return null;
  }

  const queue = [rootDir];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (process.platform === 'darwin' && entry.name === 'WhatsNowPlaying.app') {
          return fullPath;
        }
        queue.push(fullPath);
        continue;
      }

      if (process.platform === 'win32' && entry.name.toLowerCase() === 'whatsnowplaying.exe') {
        return fullPath;
      }
    }
  }

  return null;
};

const ensureExtracted = async (
  archivePath: string,
  destinationPath: string
): Promise<{ extractedPath: string; executablePath: string }> => {
  fs.mkdirSync(destinationPath, { recursive: true });

  let executablePath = findExecutable(destinationPath);
  if (executablePath) {
    return { extractedPath: destinationPath, executablePath };
  }

  if (process.platform === 'win32') {
    await execFileAsync('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `Expand-Archive -LiteralPath '${archivePath.replace(/'/g, "''")}' -DestinationPath '${destinationPath.replace(/'/g, "''")}' -Force`
    ]);
  } else if (process.platform === 'darwin') {
    await execFileAsync('/usr/bin/ditto', ['-x', '-k', archivePath, destinationPath]);
  } else {
    throw new Error(`What's Now Playing is not bundled for ${process.platform}.`);
  }

  executablePath = findExecutable(destinationPath);
  if (!executablePath) {
    throw new Error('Extracted companion tool, but could not find the executable.');
  }

  return { extractedPath: destinationPath, executablePath };
};

const launchExecutable = async (executablePath: string) => {
  if (process.platform === 'win32') {
    const child = spawn(executablePath, [], {
      detached: true,
      stdio: 'ignore'
    });
    child.unref();
    return;
  }

  if (process.platform === 'darwin') {
    const child = spawn('open', [executablePath], {
      detached: true,
      stdio: 'ignore'
    });
    child.unref();
    return;
  }

  throw new Error(`Launch is not supported on ${process.platform}.`);
};

export const installAndLaunchWhatsNowPlaying = async (): Promise<CompanionToolLaunchResult> => {
  try {
    const manifest = readManifest();
    const artifact = selectArtifact(manifest);
    if (!artifact) {
      return {
        available: false,
        installed: false,
        launched: false,
        error: `No bundled What's Now Playing artifact is available for ${process.platform}/${process.arch}.`
      };
    }

    const archivePath = path.join(RESOURCE_DIR, artifact.filename);
    if (!fs.existsSync(archivePath)) {
      return {
        available: false,
        installed: false,
        launched: false,
        error: `Bundled artifact missing: ${artifact.filename}`
      };
    }

    const installPath = path.join(INSTALL_DIR, `${manifest.version}-${process.platform}-${process.arch}`);
    const hadExecutable = Boolean(findExecutable(installPath));
    const { extractedPath, executablePath } = await ensureExtracted(archivePath, installPath);
    await launchExecutable(executablePath);

    return {
      available: true,
      installed: true,
      launched: true,
      extractedPath,
      executablePath,
      message: hadExecutable
        ? `Opened What's Now Playing from ${path.basename(extractedPath)}.`
        : `Installed and opened What's Now Playing ${manifest.version}.`
    };
  } catch (error) {
    return {
      available: true,
      installed: false,
      launched: false,
      error: (error as Error).message
    };
  }
};

export const openWhatsNowPlayingFolder = async (): Promise<{ opened: boolean; path?: string; error?: string }> => {
  try {
    const manifest = readManifest();
    const folderPath = path.join(INSTALL_DIR, `${manifest.version}-${process.platform}-${process.arch}`);
    fs.mkdirSync(folderPath, { recursive: true });
    const error = await shell.openPath(folderPath);
    if (error) {
      return { opened: false, error };
    }
    return { opened: true, path: folderPath };
  } catch (error) {
    return { opened: false, error: (error as Error).message };
  }
};
