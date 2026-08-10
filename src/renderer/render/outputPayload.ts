import type { RenderState } from '../glRenderer';
import type { AssetItem, OverlayConfig, SceneConfig, VisualSynthProject } from '../../shared/project';
import type { CustomShaderBlock } from '../../shared/customShaderBlock';
import { getFxUniformsDeclarations } from '../../shared/shaderUtils';

type ExcludedOutputField = 'sdfScene' | 'debugTint';
export type AssetLayerId = 'layer-plasma' | 'layer-spectrum' | 'layer-media' | 'gen-asset-vortex' | 'gen-asset-slices' | 'gen-asset-polar' | 'gen-asset-mosaic' | 'gen-asset-ripple' | 'gen-asset-scatter' | 'gen-asset-echo';

export type RendererOutputPayload = Omit<RenderState, ExcludedOutputField>;
export interface OutputShaderVariantPayload {
  sceneId: string | null;
  sceneName: string | null;
  key: string;
  fxUniforms: string;
  customBlocks: CustomShaderBlock[];
}

export interface OutputTransitionPayload {
  seq: number;
  prevSceneId: string | null;
  prevSceneName: string | null;
  nextSceneId: string;
  nextSceneName: string;
  source: string;
  timestamp: number;
  flaggedBlack: boolean;
}

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
  shaderVariant?: OutputShaderVariantPayload;
  transition?: OutputTransitionPayload | null;
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
        path: asset.path ?? '',
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

const buildCustomBlocksHash = (customBlocks: CustomShaderBlock[]): string =>
  [...customBlocks]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((block) =>
      [
        block.id,
        (block.uniforms ?? '').replace(/\s+/g, ''),
        (block.functions ?? '').replace(/\s+/g, ''),
        (block.mainCall ?? '').replace(/\s+/g, '')
      ].join(':')
    )
    .join('|');

export const buildOutputShaderVariantPayload = (
  project: VisualSynthProject,
  scene: SceneConfig | undefined,
  activeGeneratorIds: string[] = [],
  keyOverride?: string | null
): OutputShaderVariantPayload => {
  const customBlocks = project.customShaderBlocks ?? [];
  const fxUniforms = getFxUniformsDeclarations(project, scene ?? null);
  const generatorKey = [...activeGeneratorIds].sort().join(',');
  const customHash = buildCustomBlocksHash(customBlocks);
  return {
    sceneId: scene?.id ?? null,
    sceneName: scene?.name ?? null,
    key: keyOverride ?? [scene?.id ?? 'none', generatorKey, fxUniforms.replace(/\s+/g, ''), customHash].join('::'),
    fxUniforms,
    customBlocks: customBlocks.map((block) => ({ ...block }))
  };
};

export const buildRendererOutputBroadcastPayload = ({
  renderState,
  project,
  scene,
  activePaletteId,
  activeGeneratorIds,
  shaderVariantKey,
  transition
}: {
  renderState: RenderState;
  project: VisualSynthProject;
  scene?: SceneConfig;
  activePaletteId?: string;
  activeGeneratorIds?: string[];
  shaderVariantKey?: string | null;
  transition?: OutputTransitionPayload | null;
}): RendererOutputBroadcastPayload => {
  const base = buildRendererOutputPayload(renderState);
  const palette =
    project.palettes.find((candidate) => candidate.id === (activePaletteId ?? project.activePaletteId)) ??
    project.palettes[0];
  const shaderVariant = buildOutputShaderVariantPayload(project, scene, activeGeneratorIds ?? [], shaderVariantKey);

  return {
    ...base,
    paletteColors: palette?.colors,
    layerAssets: {
      'layer-plasma': resolveLayerAsset(project, scene, 'layer-plasma'),
      'layer-spectrum': resolveLayerAsset(project, scene, 'layer-spectrum'),
      'layer-media': resolveLayerAsset(project, scene, 'layer-media'),
      'gen-asset-vortex': resolveLayerAsset(project, scene, 'gen-asset-vortex'),
      'gen-asset-slices': resolveLayerAsset(project, scene, 'gen-asset-slices'),
      'gen-asset-polar': resolveLayerAsset(project, scene, 'gen-asset-polar'),
      'gen-asset-mosaic': resolveLayerAsset(project, scene, 'gen-asset-mosaic'),
      'gen-asset-ripple': resolveLayerAsset(project, scene, 'gen-asset-ripple'),
      'gen-asset-scatter': resolveLayerAsset(project, scene, 'gen-asset-scatter'),
      'gen-asset-echo': resolveLayerAsset(project, scene, 'gen-asset-echo')
    },
    activeGeneratorIds,
    overlays: project.overlays ?? [],
    shaderVariant,
    transition: transition ?? null
  };
};
