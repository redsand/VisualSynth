/**
 * Asset/Layer Binding Integration Module
 *
 * Integrates the canonical resolver with the rendering system to provide:
 * - Stable ID-based asset binding resolution
 * - Diagnostic information about asset binding status
 * - Graceful handling of missing/unsupported assets
 *
 * This module serves as the bridge between the canonical resolver system
 * and the rendering pipeline (glRenderer, output path).
 */

import {
  resolveSceneAssetBindings,
  resolveLayerAsset,
  type ResolutionStatus,
  type LayerAssetResolution
} from '../../shared/resolvers';
import type { VisualSynthProject, SceneConfig, LayerConfig, AssetItem, AssetKind } from '../../shared/project';

// ---------------------------------------------------------------------------\n
// Asset Binding Diagnostic Types
// ---------------------------------------------------------------------------

export interface AssetBindingDiagnostic {
  layerId: string;
  layerName: string;
  assetId?: string;
  assetName?: string;
  status: ResolutionStatus;
  reason?: string;
  renderSkipped?: boolean;
  skippedReason?: string;
}

export interface SceneAssetDiagnostics {
  sceneId: string;
  sceneName: string;
  layerCount: number;
  bindings: Record<string, AssetBindingDiagnostic>;
  summary: {
    resolved: number;
    noBinding: number;
    missingAsset: number;
    generatorBound: number;
    notFound: number;
    total: number;
  };
}

// ---------------------------------------------------------------------------\n
// Helper Functions
// ---------------------------------------------------------------------------

/**
 * Get a human-readable description of a resolution status.
 */
export const getStatusDescription = (status: ResolutionStatus): string => {
  switch (status) {
    case 'resolved':
      return 'Bound';
    case 'no-binding':
      return 'No asset assigned';
    case 'missing-asset':
      return 'Asset not found';
    case 'generator-bound':
      return 'Using generator';
    case 'not-found':
      return 'Layer not found';
    default:
      return '';
  }
};

/**
 * Get CSS class for status chip based on resolution status.
 */
export const getStatusClass = (status: ResolutionStatus): string => {
  switch (status) {
    case 'resolved':
      return 'status-bound';
    case 'no-binding':
      return 'status-none';
    case 'missing-asset':
      return 'status-missing';
    case 'generator-bound':
      return 'status-generator';
    case 'not-found':
      return 'status-error';
    default:
      return '';
  }
};

// ---------------------------------------------------------------------------\n
// Asset Binding Resolution with Diagnostics
// ---------------------------------------------------------------------------

/**
 * Get all asset bindings for a scene with diagnostic information.
 * This replaces ad-hoc asset lookups in the rendering pipeline.
 */
export const getSceneAssetDiagnostics = (
  project: VisualSynthProject | undefined | null,
  scene: SceneConfig | undefined | null
): SceneAssetDiagnostics => {
  if (!project || !scene) {
    return {
      sceneId: scene?.id ?? 'unknown',
      sceneName: scene?.name ?? 'Unknown Scene',
      layerCount: scene?.layers?.length ?? 0,
      bindings: {},
      summary: {
        resolved: 0,
        noBinding: 0,
        missingAsset: 0,
        generatorBound: 0,
        notFound: 0,
        total: 0
      }
    };
  }

  const bindings = resolveSceneAssetBindings(project, scene.id);
  const layerIdToName = new Map(
    scene.layers.map(layer => [layer.id, layer.name])
  );

  const diagnostics: Record<string, AssetBindingDiagnostic> = {};
  const summary = {
    resolved: 0,
    noBinding: 0,
    missingAsset: 0,
    generatorBound: 0,
    notFound: 0,
    total: 0
  };

  for (const [layerId, layerBinding] of Object.entries(bindings)) {
    const layerName = layerIdToName.get(layerId) ?? layerId;
    const status = layerBinding.status;

    // Count for summary (handle kebab-case to camel-case mapping)
    let summaryKey: string;
    switch (status) {
      case 'no-binding':
        summaryKey = 'noBinding';
        break;
      case 'generator-bound':
        summaryKey = 'generatorBound';
        break;
      default:
        summaryKey = status.replace(/-asset/g, 'Asset').replace(/-found/g, 'Found').replace(/-/g, '');
    }
    if (summaryKey in summary) {
      summary[summaryKey as keyof typeof summary]++;
    }
    summary.total++;

    // Build diagnostic entry
    diagnostics[layerId] = {
      layerId,
      layerName,
      assetId: layerBinding.assetId,
      assetName: layerBinding.asset?.name,
      status,
      reason: layerBinding.reason,
      renderSkipped: status !== 'resolved',
      skippedReason: getRenderSkippedReason(status, layerBinding)
    };
  }

  return {
    sceneId: scene.id,
    sceneName: scene.name,
    layerCount: scene.layers.length,
    bindings: diagnostics,
    summary
  };
};

/**
 * Get the reason why a layer's render was skipped based on asset binding status.
 */
export const getRenderSkippedReason = (
  status: ResolutionStatus,
  layerBinding: LayerAssetResolution
): string | undefined => {
  switch (status) {
    case 'no-binding':
      return 'Layer has no asset binding';
    case 'missing-asset':
      return `Asset "${layerBinding.assetId}" not found in project`;
    case 'generator-bound':
      return 'Layer uses generator instead of asset';
    case 'not-found':
      return 'Layer not found in scene';
    default:
      return undefined;
  }
};

/**
 * Check if a layer can render based on its asset binding status.
 */
export const canLayerRender = (status: ResolutionStatus): boolean => {
  return status === 'resolved';
};

/**
 * Get asset binding info for a specific layer with diagnostics.
 * This is used by the preview/output paths to check layer states.
 */
export const getLayerAssetBindingDiagnostic = (
  project: VisualSynthProject | undefined | null,
  scene: SceneConfig | undefined | null,
  layerId: string
): AssetBindingDiagnostic | null => {
  if (!project || !scene) return null;

  const sceneDiagnostics = getSceneAssetDiagnostics(project, scene);
  return sceneDiagnostics.bindings[layerId] ?? null;
};

// ---------------------------------------------------------------------------\n
// Render Path Helpers
// ---------------------------------------------------------------------------

/**
 * Filter layers that should actually be rendered (have resolved asset bindings).
 * This replaces the ad-hoc filtering in the renderer.
 */
export const getRenderableLayers = (
  project: VisualSynthProject | undefined | null,
  scene: SceneConfig | undefined | null
): LayerConfig[] => {
  if (!project || !scene) return [];

  const renderable: LayerConfig[] = [];
  const bindings = resolveSceneAssetBindings(project, scene.id);

  for (const layer of scene.layers) {
    const binding = bindings[layer.id];
    if (binding && canLayerRender(binding.status)) {
      renderable.push(layer);
    }
  }

  return renderable;
};

/**
 * Get a mapping of layer IDs to their asset IDs for layers that should render.
 * This is used for pruning unused assets in the renderer.
 */
export const getAssetLayerIdMap = (
  project: VisualSynthProject | undefined | null,
  scene: SceneConfig | undefined | null
): Record<string, string> => {
  if (!project || !scene) return {};

  const result: Record<string, string> = {};
  const bindings = resolveSceneAssetBindings(project, scene.id);

  for (const [layerId, binding] of Object.entries(bindings)) {
    if (binding.status === 'resolved' && binding.assetId) {
      result[layerId] = binding.assetId;
    }
  }

  return result;
};

// ---------------------------------------------------------------------------\n
// Output Path Helpers
// ---------------------------------------------------------------------------

/**
 * Serialize an asset for output broadcast (preview and output paths).
 * This replaces the duplicate logic in outputPayload.ts.
 */
export const serializeAssetForOutput = (asset: AssetItem | null): any => {
  if (!asset) return null;

  return {
    id: asset.id,
    name: asset.name,
    kind: asset.kind,
    path: asset.path ?? '',
    width: asset.width,
    height: asset.height,
    internalSource: asset.internalSource,
    options: asset.options
  };
};

/**
 * Resolve and serialize an asset binding for output broadcast.
 * This is the output path equivalent of getLayerAssetBindingDiagnostic.
 */
export const resolveOutputAsset = (
  project: VisualSynthProject,
  scene: SceneConfig | undefined,
  layerId: string
): any => {
  const binding = resolveSceneAssetBindings(project, scene?.id ?? '');
  const layerBinding = binding[layerId];

  if (!layerBinding) {
    return null;
  }

  if (layerBinding.status === 'resolved' && layerBinding.asset) {
    return serializeAssetForOutput(layerBinding.asset);
  }

  return null;
};

// ---------------------------------------------------------------------------
// Layer Visibility Diagnostic Types
// ---------------------------------------------------------------------------

export type VisibilitySeverity = 'ok' | 'info' | 'warning' | 'error';

export interface LayerVisibilityDiagnostic {
  visible: boolean;
  severity: VisibilitySeverity;
  reasonCode: string;
  message: string;
  recommendedAction?: string;
}

// ---------------------------------------------------------------------------
// Layer Visibility Diagnostic Functions
// ---------------------------------------------------------------------------

/**
 * Get the unsupported asset kinds that cannot be rendered.
 * These are asset kinds that VisualSynth does not support.
 */
export const UNSUPPORTED_ASSET_KINDS: AssetKind[] = ['shader', 'live', 'text'];

/**
 * Check if an asset kind is unsupported.
 */
export const isUnsupportedAssetKind = (kind: AssetKind): boolean => {
  return UNSUPPORTED_ASSET_KINDS.includes(kind);
};

/**
 * Get a human-readable description of a visibility severity level.
 */
export const getSeverityDescription = (severity: VisibilitySeverity): string => {
  switch (severity) {
    case 'ok':
      return 'Layer is visible';
    case 'info':
      return 'Layer may be visible';
    case 'warning':
      return 'Layer visibility affected';
    case 'error':
      return 'Layer not visible';
    default:
      return '';
  }
};

/**
 * Get a CSS class for severity-based styling.
 */
export const getSeverityClass = (severity: VisibilitySeverity): string => {
  switch (severity) {
    case 'ok':
      return 'visibility-ok';
    case 'info':
      return 'visibility-info';
    case 'warning':
      return 'visibility-warning';
    case 'error':
      return 'visibility-error';
    default:
      return '';
  }
};

/**
 * Determine why a layer is or is not visible.
 *
 * This function provides a deterministic configuration-level diagnostic
 * that explains common layer visibility problems without requiring full
 * visual analysis.
 *
 * @param project - The VisualSynth project
 * @param sceneId - The scene ID containing the layer
 * @param layerId - The layer ID to check
 * @returns A structured diagnostic with visibility status and reason
 */
export const getLayerVisibilityDiagnostic = (
  project: VisualSynthProject | undefined | null,
  sceneId: string,
  layerId: string
): LayerVisibilityDiagnostic => {
  // Check if project exists
  if (!project) {
    return {
      visible: false,
      severity: 'error',
      reasonCode: 'project-not-found',
      message: 'No project loaded',
      recommendedAction: 'Load a project to view layers'
    };
  }

  // Check if scene exists
  const scene = project.scenes.find(s => s.id === sceneId);
  if (!scene) {
    return {
      visible: false,
      severity: 'error',
      reasonCode: 'scene-not-found',
      message: `Scene "${sceneId}" not found`,
      recommendedAction: 'Select a valid scene or create a new one'
    };
  }

  // Check if layer exists
  const layer = scene.layers.find(l => l.id === layerId);
  if (!layer) {
    return {
      visible: false,
      severity: 'error',
      reasonCode: 'layer-not-found',
      message: `Layer "${layerId}" not found in scene "${scene.name}"`,
      recommendedAction: 'Check the layer ID or add a new layer'
    };
  }

  // Check if layer is disabled
  if (!layer.enabled) {
    return {
      visible: false,
      severity: 'info',
      reasonCode: 'layer-disabled',
      message: `Layer "${layer.name}" is disabled`,
      recommendedAction: 'Enable the layer in the layer panel'
    };
  }

  // Check if opacity is zero or negative
  if (layer.opacity <= 0) {
    return {
      visible: false,
      severity: 'warning',
      reasonCode: 'opacity-zero',
      message: `Layer "${layer.name}" has zero opacity`,
      recommendedAction: 'Increase the opacity slider or enable the layer'
    };
  }

  // Check asset binding
  const assetId = layer.assetId;
  const generatorId = layer.generatorId;

  // If no asset or generator binding
  if (!assetId && !generatorId) {
    return {
      visible: false,
      severity: 'warning',
      reasonCode: 'no-asset-binding',
      message: `Layer "${layer.name}" has no asset or generator assigned`,
      recommendedAction: 'Assign an asset or generator to this layer'
    };
  }

  // If using generator, check if generator is available
  if (generatorId && !project.plugins?.some(p => p.enabled && p.id === generatorId)) {
    // Check if it's a built-in generator (starts with 'gen-')
    const isBuiltInGenerator = generatorId.startsWith('gen-');
    if (!isBuiltInGenerator) {
      return {
        visible: false,
        severity: 'error',
        reasonCode: 'generator-unavailable',
        message: `Generator "${generatorId}" is not available`,
        recommendedAction: 'Enable the plugin or use a different generator'
      };
    }
  }

  // If using asset binding, check the asset
  if (assetId) {
    const asset = project.assets.find(a => a.id === assetId);
    if (!asset) {
      return {
        visible: false,
        severity: 'error',
        reasonCode: 'asset-missing',
        message: `Asset "${assetId}" is missing from the project`,
        recommendedAction: 'Re-import the asset or select a different one'
      };
    }

    // Check if asset is marked as missing
    if (asset.missing) {
      return {
        visible: false,
        severity: 'error',
        reasonCode: 'asset-file-missing',
        message: `Asset file for "${asset.name}" is missing`,
        recommendedAction: 'Re-select the asset file or re-import from disk'
      };
    }

    // Check if asset kind is unsupported
    if (isUnsupportedAssetKind(asset.kind)) {
      return {
        visible: false,
        severity: 'error',
        reasonCode: 'unsupported-asset-kind',
        message: `Asset kind "${asset.kind}" is not supported`,
        recommendedAction: 'Use a texture, video, or internal source instead'
      };
    }
  }

  // Layer should be visible
  return {
    visible: true,
    severity: 'ok',
    reasonCode: 'layer-visible',
    message: `Layer "${layer.name}" is visible`,
    recommendedAction: undefined
  };
};

/**
 * Get all layer visibility diagnostics for a scene.
 */
export const getSceneLayerVisibilityDiagnostics = (
  project: VisualSynthProject | undefined | null,
  sceneId: string
): Record<string, LayerVisibilityDiagnostic> => {
  const result: Record<string, LayerVisibilityDiagnostic> = {};

  // Get all layer IDs that have asset bindings
  const bindings = resolveSceneAssetBindings(project, sceneId);
  const layerIds = Object.keys(bindings);

  // Also check layers that might not have bindings (no-binding layers)
  const scene = project?.scenes.find(s => s.id === sceneId);
  if (scene) {
    for (const layer of scene.layers) {
      if (!layerIds.includes(layer.id)) {
        layerIds.push(layer.id);
      }
    }
  }

  for (const layerId of layerIds) {
    result[layerId] = getLayerVisibilityDiagnostic(project, sceneId, layerId);
  }

  return result;
};
