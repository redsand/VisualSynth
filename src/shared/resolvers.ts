/**
 * Canonical Asset/Layer Binding Resolver
 *
 * Provides authoritative functions to resolve:
 * - Scene by ID from a project
 * - Layer by ID from a scene
 * - Asset binding from a layer (including fallback to generator bindings)
 *
 * All resolvers use stable IDs only (not array positions) and return
 * structured results with explicit status types instead of throwing errors.
 */

import type { VisualSynthProject, SceneConfig, LayerConfig, AssetItem } from './project';

// ---------------------------------------------------------------------------
// Status Types for Structured Results
// ---------------------------------------------------------------------------

export type ResolutionStatus =
  | 'not-found'       // Item with ID was not found
  | 'no-binding'      // Item exists but has no asset binding
  | 'resolved'        // Item was found and asset binding resolved
  | 'generator-bound' // Item uses generator instead of asset binding
  | 'missing-asset';  // Asset ID exists but asset not found in project

export interface SceneResolution {
  status: ResolutionStatus;
  scene?: SceneConfig;
  reason?: string;
}

export interface LayerResolution {
  status: ResolutionStatus;
  layer?: LayerConfig;
  reason?: string;
}

export interface AssetResolution {
  status: ResolutionStatus;
  asset?: AssetItem;
  layer?: LayerConfig; // The layer that references the asset
  assetId?: string;   // The asset ID that was looked up
  reason?: string;
}

export interface LayerAssetResolution extends AssetResolution {
  generatorId?: string; // If layer uses generatorId instead of assetId
}

// ---------------------------------------------------------------------------
// 1. Scene Resolvers
// ---------------------------------------------------------------------------

/**
 * Resolve a scene by its ID from a project.
 */
export const resolveScene = (
  project: VisualSynthProject | undefined | null,
  sceneId: string
): SceneResolution => {
  if (!project || !Array.isArray(project.scenes)) {
    return { status: 'not-found', reason: 'No scenes in project' };
  }

  const scene = project.scenes.find(s => s.id === sceneId);
  if (!scene) {
    return { status: 'not-found', reason: `Scene "${sceneId}" not found` };
  }

  return { status: 'resolved', scene };
};

/**
 * Resolve the active scene from a project.
 */
export const resolveActiveScene = (
  project: VisualSynthProject | undefined | null
): SceneResolution => {
  if (!project || !project.activeSceneId) {
    return { status: 'not-found', reason: 'No active scene ID' };
  }
  return resolveScene(project, project.activeSceneId);
};

// ---------------------------------------------------------------------------
// 2. Layer Resolvers
// ---------------------------------------------------------------------------

/**
 * Resolve a layer by its ID within a specific scene.
 */
export const resolveLayer = (
  scene: SceneConfig | undefined | null,
  layerId: string
): LayerResolution => {
  if (!scene || !Array.isArray(scene.layers)) {
    return { status: 'not-found', reason: 'No layers in scene' };
  }

  const layer = scene.layers.find(l => l.id === layerId);
  if (!layer) {
    return { status: 'not-found', reason: `Layer "${layerId}" not found in scene` };
  }

  return { status: 'resolved', layer };
};

/**
 * Resolve a layer by its ID within a specific scene in a project.
 * Convenience wrapper combining resolveScene + resolveLayer.
 */
export const resolveSceneLayer = (
  project: VisualSynthProject | undefined | null,
  sceneId: string,
  layerId: string
): LayerResolution => {
  const sceneRes = resolveScene(project, sceneId);
  if (sceneRes.status !== 'resolved') {
    return { status: 'not-found', reason: `Scene not found: ${sceneRes.reason}` };
  }
  return resolveLayer(sceneRes.scene, layerId);
};

/**
 * Resolve the active scene's layer by layer ID.
 */
export const resolveActiveSceneLayer = (
  project: VisualSynthProject | undefined | null,
  layerId: string
): LayerResolution => {
  if (!project || !project.activeSceneId) {
    return { status: 'not-found', reason: 'No active scene' };
  }
  return resolveSceneLayer(project, project.activeSceneId, layerId);
};

// ---------------------------------------------------------------------------
// 3. Asset Binding Resolvers
// ---------------------------------------------------------------------------

/**
 * Resolve the asset binding from a layer.
 *
 * Returns information about:
 * - The asset (if found in project.assets)
 * - The assetId that was referenced
 * - Whether the layer uses generatorId instead of assetId
 */
export const resolveLayerAsset = (
  layer: LayerConfig | undefined | null,
  projectAssets: AssetItem[] | undefined | null
): LayerAssetResolution => {
  if (!layer) {
    return { status: 'not-found', reason: 'Layer not found' };
  }

  // Check if layer has assetId binding
  const assetId = layer.assetId;
  if (!assetId) {
    // Check if layer uses generatorId instead
    if (layer.generatorId) {
      return {
        status: 'generator-bound',
        generatorId: layer.generatorId,
        reason: 'Layer uses generatorId instead of assetId'
      };
    }
    return {
      status: 'no-binding',
      reason: 'Layer has no assetId or generatorId binding'
    };
  }

  // Look up the asset in project assets
  const asset = projectAssets?.find(a => a.id === assetId);
  if (!asset) {
    return {
      status: 'missing-asset',
      assetId,
      layer,
      reason: `Asset "${assetId}" not found in project`
    };
  }

  return {
    status: 'resolved',
    asset,
    assetId,
    layer,
    reason: undefined
  };
};

/**
 * Resolve the asset binding for a layer in a scene within a project.
 * Convenience wrapper combining resolveSceneLayer + resolveLayerAsset.
 */
export const resolveProjectLayerAsset = (
  project: VisualSynthProject | undefined | null,
  sceneId: string,
  layerId: string
): LayerAssetResolution => {
  const layerRes = resolveSceneLayer(project, sceneId, layerId);
  if (layerRes.status !== 'resolved') {
    return { status: 'not-found', reason: `Layer not found: ${layerRes.reason}` };
  }
  return resolveLayerAsset(layerRes.layer, project?.assets);
};

/**
 * Resolve the asset binding for the active scene's layer.
 */
export const resolveActiveSceneLayerAsset = (
  project: VisualSynthProject | undefined | null,
  layerId: string
): LayerAssetResolution => {
  const layerRes = resolveActiveSceneLayer(project, layerId);
  if (layerRes.status !== 'resolved') {
    return { status: 'not-found', reason: `Layer not found: ${layerRes.reason}` };
  }
  return resolveLayerAsset(layerRes.layer, project?.assets);
};

// ---------------------------------------------------------------------------
// 4. Asset Lookup Resolvers
// ---------------------------------------------------------------------------

/**
 * Resolve an asset directly by ID from a project.
 */
export const resolveProjectAsset = (
  project: VisualSynthProject | undefined | null,
  assetId: string
): AssetResolution => {
  const asset = project?.assets?.find(a => a.id === assetId);
  if (!asset) {
    return { status: 'not-found', reason: `Asset "${assetId}" not found` };
  }
  return { status: 'resolved', asset, assetId };
};

/**
 * Get all assets referenced by layers in a scene.
 */
export const resolveSceneAssetBindings = (
  project: VisualSynthProject | undefined | null,
  sceneId: string
): Record<string, LayerAssetResolution> => {
  const sceneRes = resolveScene(project, sceneId);
  if (sceneRes.status !== 'resolved') {
    return {};
  }

  const bindings: Record<string, LayerAssetResolution> = {};
  for (const layer of sceneRes.scene.layers) {
    bindings[layer.id] = resolveLayerAsset(layer, project?.assets);
  }
  return bindings;
};

// ---------------------------------------------------------------------------
// 5. Error Handling Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a resolution result to a throw error if not successful.
 * Useful for cases where you want explicit error handling.
 */
export const ensureResolution = <T extends { status: ResolutionStatus; reason?: string }>(
  result: T,
  message?: string
): T => {
  if (result.status === 'resolved') {
    return result;
  }
  const reason = message || `Resolution failed: ${result.status}${result.reason ? ` - ${result.reason}` : ''}`;
  throw new Error(reason);
};

/**
 * Get a fallback value if resolution fails.
 */
export const withFallback = <T extends { status: ResolutionStatus; reason?: string }>(
  result: T,
  fallback: T
): T => {
  if (result.status === 'resolved') {
    return result;
  }
  return fallback;
};
