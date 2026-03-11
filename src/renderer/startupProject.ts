import type { VisualSynthProject } from '../shared/project';
import { resolveLoadableProjectPayload } from './loadableProject';

const FIRST_LAUNCH_KEY = 'visualsynth.firstLaunchComplete';

export interface StartupProjectApi {
  getRecovery: () => Promise<{ found: boolean; payload?: string; filePath?: string }>;
  loadShowcaseProject: () => Promise<{ found: boolean; payload?: string; error?: string }>;
}

export interface StartupStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

export type StartupProjectSelection =
  | {
      kind: 'recovery' | 'showcase';
      project: VisualSynthProject;
      status: string;
      logLabel: string;
    }
  | {
      kind: 'invalid-recovery' | 'invalid-showcase' | 'none';
      status: string | null;
      errorDetail?: string;
    };

export const selectStartupProject = async (
  api: StartupProjectApi,
  storage: StartupStorage
): Promise<StartupProjectSelection> => {
  const recovery = await api.getRecovery();
  if (recovery.found && recovery.payload) {
    const resolved = resolveLoadableProjectPayload(recovery.payload);
    if (resolved.ok) {
      return {
        kind: 'recovery',
        project: resolved.project,
        status: 'Recovery session loaded.',
        logLabel: 'Recovery project applied'
      };
    }
    return {
      kind: 'invalid-recovery',
      status: 'Recovery session found but invalid.',
      errorDetail: resolved.errorDetail
    };
  }

  const isFirstLaunch = storage.getItem(FIRST_LAUNCH_KEY) !== '1';
  if (!isFirstLaunch) {
    return { kind: 'none', status: null };
  }

  storage.setItem(FIRST_LAUNCH_KEY, '1');
  const showcase = await api.loadShowcaseProject();
  if (showcase.found && showcase.payload) {
    const resolved = resolveLoadableProjectPayload(showcase.payload);
    if (resolved.ok) {
      return {
        kind: 'showcase',
        project: resolved.project,
        status: 'Showcase project loaded.',
        logLabel: 'Showcase project applied'
      };
    }
    return {
      kind: 'invalid-showcase',
      status: null,
      errorDetail: resolved.errorDetail
    };
  }

  return { kind: 'none', status: null, errorDetail: showcase.error };
};
