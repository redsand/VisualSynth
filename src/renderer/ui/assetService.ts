import type { AssetItem } from '../../shared/project';

const livePreviewElements = new Map<string, HTMLVideoElement>();
const liveStreams = new Map<string, MediaStream>();
const textCanvasCache = new Map<string, HTMLCanvasElement>();

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
  }
};
