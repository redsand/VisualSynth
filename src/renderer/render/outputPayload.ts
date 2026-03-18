import type { RenderState } from '../glRenderer';
import type { AssetItem, OverlayConfig, SceneConfig, VisualSynthProject } from '../../shared/project';

type ExcludedOutputField = 'sdfScene' | 'debugTint';
type AssetLayerId = 'layer-plasma' | 'layer-spectrum' | 'layer-media';

export type RendererOutputPayload = Omit<RenderState, ExcludedOutputField>;
export interface SerializedOutputAsset {
  id: string;
  name: string;
  kind: AssetItem['kind'];
  path: string;
  width?: number;
  height?: number;
  internalSource?: string;
  options?: AssetItem['options'];
}

export interface RendererOutputBroadcastPayload extends RendererOutputPayload {
  paletteColors?: string[];
  layerAssets?: Partial<Record<AssetLayerId, SerializedOutputAsset | null>>;
  activeGeneratorIds?: string[];
  overlays?: OverlayConfig[];
}

export const buildRendererOutputPayload = (
  renderState: RenderState
): RendererOutputPayload => {
  const {
    spectrum,
    sdfScene: _ignoredSdfScene,
    debugTint: _ignoredDebugTint,
    ...rest
  } = renderState;

  return {
    ...rest,
    spectrum: spectrum.slice()
  };
};

const serializeAssetForOutput = (asset: AssetItem | null): SerializedOutputAsset | null =>
  asset
    ? {
        id: asset.id,
        name: asset.name,
        kind: asset.kind,
        path: asset.path,
        width: asset.width,
        height: asset.height,
        internalSource: asset.internalSource,
        options: asset.options
      }
    : null;

const resolveLayerAsset = (
  project: VisualSynthProject,
  scene: SceneConfig | undefined,
  layerId: AssetLayerId
): SerializedOutputAsset | null => {
  const layer = scene?.layers.find((candidate) => candidate.id === layerId);
  if (!layer?.assetId) return null;
  const asset = project.assets.find((item) => item.id === layer.assetId) ?? null;
  return serializeAssetForOutput(asset);
};

export const buildRendererOutputBroadcastPayload = ({
  renderState,
  project,
  scene,
  activePaletteId,
  activeGeneratorIds
}: {
  renderState: RenderState;
  project: VisualSynthProject;
  scene?: SceneConfig;
  activePaletteId?: string;
  activeGeneratorIds?: string[];
}): RendererOutputBroadcastPayload => {
  const base = buildRendererOutputPayload(renderState);
  const palette =
    project.palettes.find((candidate) => candidate.id === (activePaletteId ?? project.activePaletteId)) ??
    project.palettes[0];

  return {
    ...base,
    paletteColors: palette?.colors,
    layerAssets: {
      'layer-plasma': resolveLayerAsset(project, scene, 'layer-plasma'),
      'layer-spectrum': resolveLayerAsset(project, scene, 'layer-spectrum'),
      'layer-media': resolveLayerAsset(project, scene, 'layer-media')
    },
    activeGeneratorIds,
    overlays: project.overlays ?? []
  };
};
