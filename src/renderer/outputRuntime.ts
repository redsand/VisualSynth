import {
  DEFAULT_OUTPUT_CONFIG,
  type OutputConfig,
  type VisualSynthProject
} from '../shared/project';
import type { AssetLayerId, SerializedOutputAsset } from './render/outputPayload';

export const resolveProjectOutputConfig = (
  project: VisualSynthProject,
  currentOutputConfig?: Partial<OutputConfig>
): OutputConfig => ({
  ...DEFAULT_OUTPUT_CONFIG,
  ...currentOutputConfig,
  ...project.output
});

export interface RebindLayerAssetsDeps {
  // Last-known asset per layer (the full SerializedOutputAsset, or null once
  // unbound — nulls are skipped).
  layerAssets: Partial<Record<AssetLayerId, SerializedOutputAsset | null>>;
  // Existing HTMLVideoElements to reuse so a restore doesn't tear down /
  // re-prompt live camera/screen streams.
  videoElements: Partial<Record<AssetLayerId, HTMLVideoElement>>;
  setLayerAsset: (
    layerId: AssetLayerId,
    asset: SerializedOutputAsset,
    videoOverride?: HTMLVideoElement,
    textCanvas?: HTMLCanvasElement
  ) => void;
  getTextCanvas: (asset: SerializedOutputAsset) => HTMLCanvasElement | null;
  onRebind?: (layerId: AssetLayerId, kind: string) => void;
}

/**
 * Re-bind the last-known layer assets after a WebGL context restore.
 *
 * On context loss the GL renderer invalidates its own assetCache + layerBindings;
 * the output window's per-layer id/key tracking still matches, so the next
 * periodic broadcast would be skipped and the bound assets would never come
 * back. This re-issues a setLayerAsset per known asset — reusing the existing
 * HTMLVideoElement for video/live assets so the stream is not torn down and
 * re-acquired (which would re-prompt for camera/screen permission).
 */
export const rebindLayerAssets = (deps: RebindLayerAssetsDeps): void => {
  (Object.keys(deps.layerAssets) as AssetLayerId[]).forEach((layerId) => {
    const asset = deps.layerAssets[layerId];
    if (!asset) return;
    const textCanvas = asset.kind === 'text' ? deps.getTextCanvas(asset) ?? undefined : undefined;
    if (asset.kind === 'live' || asset.kind === 'video') {
      deps.setLayerAsset(layerId, asset, deps.videoElements[layerId], textCanvas);
    } else {
      deps.setLayerAsset(layerId, asset, undefined, textCanvas);
    }
    deps.onRebind?.(layerId, asset.kind);
  });
};
