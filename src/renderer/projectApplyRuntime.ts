import type { OutputConfig, VisualSynthProject } from '../shared/project';
import { resolveLoadableProject } from './loadableProject';
import { resolveProjectOutputConfig } from './outputRuntime';

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
  deps: ApplyLoadableProjectRuntimeDeps
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
