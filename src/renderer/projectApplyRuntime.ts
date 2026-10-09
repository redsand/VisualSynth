import type { AssetItem, OutputConfig, VisualSynthProject } from '../shared/project';
import { normalizeAssetPath } from '../shared/assets';
import { resolveLoadableProject } from './loadableProject';
import { resolveProjectOutputConfig } from './outputRuntime';
import { assetService } from './ui/assetService';

interface ApplyLoadableProjectRuntimeDeps {
  currentOutputConfig?: OutputConfig;
  onResolvedProject: (project: VisualSynthProject) => Promise<void> | void;
  syncOutputConfig: (config: OutputConfig) => Promise<void>;
  setOutputEnabled: (enabled: boolean) => Promise<void>;
}

export type ApplyLoadableProjectRuntimeResult =
  | {
      ok: true;
      project: VisualSynthProject;
      outputConfig: OutputConfig;
    }
  | {
      ok: false;
      name: string;
      errorDetail: string;
    };

export const applyLoadableProjectRuntime = async (
  project: VisualSynthProject,
  deps: ApplyLoadableProjectRuntimeDeps,
  projectPath: string | null = null
): Promise<ApplyLoadableProjectRuntimeResult> => {
  const resolved = resolveLoadableProject(project);
  if (!resolved.ok) {
    return {
      ok: false,
      name: resolved.name,
      errorDetail: resolved.errorDetail
    };
  }

  const normalized = resolved.project;

  // Resolve assets and update missing flag during load
  if (normalized.assets && normalized.assets.length > 0) {
    const resolvedAssets = await assetService.resolveAllAssets(normalized.assets, projectPath);
    normalized.assets = normalized.assets.map((asset) => ({
      ...asset,
      missing: resolvedAssets[asset.id]?.missing ?? asset.missing,
      path: resolvedAssets[asset.id]?.resolvedPath ?? asset.path
    }));

    // Mirror the resolved (absolute) asset path back onto each image overlay
    // and link it to the asset by id. ensureOverlayAssets (run inside
    // prepareProjectForRuntime, via resolveLoadableProject) created texture
    // assets from overlay.assetPath, and resolveAllAssets just turned those
    // (possibly project-relative) paths into absolute ones — but the overlay's
    // own assetPath was never updated. That left overlayRenderer.loadImage
    // building a wrong file:/// URL for relative paths (the image never
    // appeared) and left Renderer.ts's prune lookup
    // (project.assets.find(a => a.path === overlay.assetPath)) failing
    // (absolute asset path vs relative overlay path), so the overlay asset
    // was pruned mid-show. Match by the asset's pre-resolution path
    // (originalPath, falling back to its current path) normalized the same
    // way ensureOverlayAssets normalized it.
    if (normalized.overlays && normalized.overlays.length > 0) {
      const overlayAssetByPath = new Map<string, AssetItem>();
      for (const asset of normalized.assets) {
        const original =
          resolvedAssets[asset.id]?.originalPath ?? asset.path;
        const norm = normalizeAssetPath(original);
        if (norm) overlayAssetByPath.set(norm, asset);
      }
      normalized.overlays = normalized.overlays.map((overlay) => {
        if (overlay.type !== 'image' || !overlay.assetPath) return overlay;
        const match = overlayAssetByPath.get(normalizeAssetPath(overlay.assetPath) ?? '');
        if (!match || !match.path) return overlay;
        return { ...overlay, assetPath: match.path, assetId: match.id };
      });
    }
  }

  await deps.onResolvedProject(normalized);
  const outputConfig = resolveProjectOutputConfig(normalized, deps.currentOutputConfig);
  await deps.syncOutputConfig(outputConfig);
  await deps.setOutputEnabled(outputConfig.enabled);

  return {
    ok: true,
    project: normalized,
    outputConfig
  };
};
