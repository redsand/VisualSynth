import type { StartupProjectSelection } from './startupProject';
import type { VisualSynthProject } from '../shared/project';

interface StartupSelectionRuntimeDeps {
  applyProject: (project: VisualSynthProject) => Promise<void>;
  setStatus: (message: string) => void;
  log?: (message: string) => void;
  warn?: (message: string, detail?: string) => void;
  invalidRecoveryFallbackStatus?: string;
}

export const applyStartupSelection = async (
  selection: StartupProjectSelection,
  deps: StartupSelectionRuntimeDeps
): Promise<void> => {
  if (selection.kind === 'recovery' || selection.kind === 'showcase') {
    await deps.applyProject(selection.project);
    deps.setStatus(selection.status);
    deps.log?.(selection.logLabel);
    return;
  }

  if (selection.kind === 'invalid-recovery') {
    deps.warn?.('Recovery project invalid', selection.errorDetail);
    deps.setStatus(selection.status ?? deps.invalidRecoveryFallbackStatus ?? 'Recovery session found but invalid.');
    return;
  }

  if (selection.kind === 'invalid-showcase') {
    deps.warn?.('Showcase project invalid', selection.errorDetail);
    if (selection.status) deps.setStatus(selection.status);
    return;
  }

  deps.log?.('No startup project override found');
};
