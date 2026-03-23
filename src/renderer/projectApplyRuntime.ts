import type { OutputConfig, VisualSynthProject } from '../shared/project';
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
