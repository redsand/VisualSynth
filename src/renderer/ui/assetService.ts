import type { AssetItem } from '../../shared/project';
import type { AssetRef } from '../../shared/assets';
import { normalizeAssetPath } from '../../shared/assets';

const livePreviewElements = new Map<string, HTMLVideoElement>();
const liveStreams = new Map<string, MediaStream>();
const textCanvasCache = new Map<string, HTMLCanvasElement>();

const resolveProjectRelativeAssetPath = (assetPath: string, projectPath: string | null) => {
  if (!projectPath) return null;
  if (/^(?:[a-zA-Z]:[\\/]|\/)/.test(assetPath)) return null;
  const projectDir = projectPath.substring(0, Math.max(projectPath.lastIndexOf('/'), projectPath.lastIndexOf('\\')));
  return normalizeAssetPath(`${projectDir}/${assetPath}`.replace(/\\/g, '/'));
};

export const assetService = {
  livePreviewElements,
  liveStreams,
  stopLiveAssetStream: (assetId: string) => {
    const stream = liveStreams.get(assetId);
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      liveStreams.delete(assetId);
    }
    const video = livePreviewElements.get(assetId);
    if (video) {
      video.pause();
      video.srcObject = null;
      livePreviewElements.delete(assetId);
    }
  },
  registerLiveAsset: (assetId: string, stream: MediaStream, video: HTMLVideoElement) => {
    liveStreams.set(assetId, stream);
    livePreviewElements.set(assetId, video);
  },
  getLivePreview: (assetId: string) => livePreviewElements.get(assetId),
  getTextCanvas: (asset: AssetItem): HTMLCanvasElement | null => {
    if (asset.kind !== 'text' || !asset.options?.text) return null;
    const cacheKey = `${asset.id}-${asset.options.text}-${asset.options.font}-${asset.options.fontColor}`;
    if (textCanvasCache.has(cacheKey)) return textCanvasCache.get(cacheKey)!;
    const canvas = assetService.renderTextToCanvas(
      asset.options.text,
      asset.options.font || '48px Arial',
      asset.options.fontColor || '#ffffff'
    );
    textCanvasCache.set(cacheKey, canvas);
    return canvas;
  },
  renderTextToCanvas: (
    text: string,
    font: string,
    color: string,
    width = 512,
    height = 128
  ): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'transparent';
    ctx.fillRect(0, 0, width, height);
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const neededWidth = Math.max(width, Math.ceil(textWidth * 1.2));
    if (neededWidth > width) {
      canvas.width = neededWidth;
      ctx.font = font;
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
    }
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.lineWidth = 2;
    ctx.strokeText(text, canvas.width / 2, canvas.height / 2);
    return canvas;
  },
  cacheTextCanvas: (key: string, canvas: HTMLCanvasElement) => {
    textCanvasCache.set(key, canvas);
  },
  resolveAsset: async (asset: AssetItem, projectPath: string | null = null): Promise<AssetRef> => {
    if (asset.kind === 'internal') {
      return {
        id: asset.id,
        kind: asset.kind,
        resolvedPath: '',
        missing: false,
        status: 'resolved'
      };
    }

    if (asset.kind === 'texture' && asset.embeddedData) {
      return {
        id: asset.id,
        kind: asset.kind,
        resolvedPath: asset.embeddedData,
        originalPath: asset.path,
        missing: false,
        status: 'resolved'
      };
    }

    if (!asset.path) {
      return {
        id: asset.id,
        kind: asset.kind,
        resolvedPath: '',
        missing: true,
        status: 'missing'
      };
    }

    const check = await window.visualSynth.checkAssetPaths([asset.path]);
    if (check[asset.path]) {
      return {
        id: asset.id,
        kind: asset.kind,
        resolvedPath: asset.path,
        missing: false,
        status: 'resolved'
      };
    }

    // Attempt path remapping if projectPath is available
    if (projectPath && asset.path) {
      const relativePath = resolveProjectRelativeAssetPath(asset.path, projectPath);
      if (relativePath && relativePath !== asset.path) {
        const relativeCheck = await window.visualSynth.checkAssetPaths([relativePath]);
        if (relativeCheck[relativePath]) {
          console.info(`[AssetService] Asset resolved relative to project: ${asset.name} -> ${relativePath}`);
          return {
            id: asset.id,
            kind: asset.kind,
            resolvedPath: relativePath,
            originalPath: asset.path,
            missing: false,
            status: 'remapped'
          };
        }
      }
      const projectDir = projectPath.substring(0, Math.max(projectPath.lastIndexOf('/'), projectPath.lastIndexOf('\\')));
      const fileName = asset.path.substring(Math.max(asset.path.lastIndexOf('/'), asset.path.lastIndexOf('\\')) + 1);
      const remappedPath = `${projectDir}/${fileName}`.replace(/\\/g, '/');

      if (remappedPath !== asset.path) {
        const recheck = await window.visualSynth.checkAssetPaths([remappedPath]);
        if (recheck[remappedPath]) {
          console.info(`[AssetService] Asset remapped: ${asset.name} -> ${remappedPath}`);
          return {
            id: asset.id,
            kind: asset.kind,
            resolvedPath: remappedPath,
            originalPath: asset.path,
            missing: false,
            status: 'remapped'
          };
        }
      }
    }

    console.warn(`[AssetService] Asset resolution failed: ${asset.name} (ID: ${asset.id})`);
    console.warn(`[AssetService] Attempted path: ${asset.path}`);

    return {
      id: asset.id,
      kind: asset.kind,
      resolvedPath: asset.path,
      originalPath: asset.path,
      missing: true,
      status: 'missing'
    };
  },
  resolveAllAssets: async (assets: AssetItem[], projectPath: string | null = null): Promise<Record<string, AssetRef>> => {
    const results: Record<string, AssetRef> = {};
    const pathsToCheck = assets
      .filter((a) => a.kind !== 'internal' && a.path)
      .map((a) => a.path!);

    const checkResults = pathsToCheck.length > 0
      ? await window.visualSynth.checkAssetPaths(pathsToCheck)
      : {};

    const projectDir = projectPath ? projectPath.substring(0, Math.max(projectPath.lastIndexOf('/'), projectPath.lastIndexOf('\\'))) : null;
    const remappingQueue: { asset: AssetItem; remappedPath: string }[] = [];

    for (const asset of assets) {
      if (asset.kind === 'internal') {
        results[asset.id] = {
          id: asset.id,
          kind: asset.kind,
          resolvedPath: '',
          missing: false,
          status: 'resolved'
        };
        continue;
      }

      if (asset.kind === 'texture' && asset.embeddedData) {
        results[asset.id] = {
          id: asset.id,
          kind: asset.kind,
          resolvedPath: asset.embeddedData,
          originalPath: asset.path,
          missing: false,
          status: 'resolved'
        };
        continue;
      }

      if (!asset.path) {
        results[asset.id] = {
          id: asset.id,
          kind: asset.kind,
          resolvedPath: '',
          missing: true,
          status: 'missing'
        };
        continue;
      }

      if (checkResults[asset.path]) {
        results[asset.id] = {
          id: asset.id,
          kind: asset.kind,
          resolvedPath: asset.path,
          missing: false,
          status: 'resolved'
        };
      } else if (projectDir) {
        const relativePath = resolveProjectRelativeAssetPath(asset.path, projectPath);
        if (relativePath && relativePath !== asset.path) {
          remappingQueue.push({ asset, remappedPath: relativePath });
          continue;
        }
        const fileName = asset.path.substring(Math.max(asset.path.lastIndexOf('/'), asset.path.lastIndexOf('\\')) + 1);
        const remappedPath = `${projectDir}/${fileName}`.replace(/\\/g, '/');
        if (remappedPath !== asset.path) {
          remappingQueue.push({ asset, remappedPath });
        } else {
          console.warn(`[AssetService] Asset resolution failed: ${asset.name} (ID: ${asset.id})`);
          console.warn(`[AssetService] Attempted path: ${asset.path}`);
          results[asset.id] = {
            id: asset.id,
            kind: asset.kind,
            resolvedPath: asset.path,
            originalPath: asset.path,
            missing: true,
            status: 'missing'
          };
        }
      } else {
        console.warn(`[AssetService] Asset resolution failed: ${asset.name} (ID: ${asset.id})`);
        console.warn(`[AssetService] Attempted path: ${asset.path}`);
        results[asset.id] = {
          id: asset.id,
          kind: asset.kind,
          resolvedPath: asset.path,
          originalPath: asset.path,
          missing: true,
          status: 'missing'
        };
      }
    }

    if (remappingQueue.length > 0) {
      const remappedPaths = remappingQueue.map(q => q.remappedPath);
      const recheckResults = await window.visualSynth.checkAssetPaths(remappedPaths);

      for (const { asset, remappedPath } of remappingQueue) {
        if (recheckResults[remappedPath]) {
          console.info(`[AssetService] Asset remapped: ${asset.name} -> ${remappedPath}`);
          results[asset.id] = {
            id: asset.id,
            kind: asset.kind,
            resolvedPath: remappedPath,
            originalPath: asset.path,
            missing: false,
            status: 'remapped'
          };
        } else {
          console.warn(`[AssetService] Asset resolution failed: ${asset.name} (ID: ${asset.id})`);
          console.warn(`[AssetService] Attempted path: ${asset.path} (and remapped: ${remappedPath})`);
          results[asset.id] = {
            id: asset.id,
            kind: asset.kind,
            resolvedPath: asset.path,
            originalPath: asset.path,
            missing: true,
            status: 'missing'
          };
        }
      }
    }

    return results;
  }
};
