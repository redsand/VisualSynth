import type { VisualSynthProject } from '../shared/project';
import { projectSchema } from '../shared/projectSchema';
import { prepareProjectForRuntime } from './runtimeProject';

export type LoadableProjectResult =
  | {
      ok: true;
      project: VisualSynthProject;
      name: string;
    }
  | {
      ok: false;
      name: string;
      errorDetail: string;
    };

export const getProjectDisplayName = (project: unknown): string => {
  if (project && typeof project === 'object') {
    const candidate = project as { metadata?: { name?: unknown }; name?: unknown };
    if (typeof candidate.metadata?.name === 'string' && candidate.metadata.name.trim()) {
      return candidate.metadata.name;
    }
    if (typeof candidate.name === 'string' && candidate.name.trim()) {
      return candidate.name;
    }
  }
  return 'Unknown';
};

export const resolveLoadableProject = (project: unknown): LoadableProjectResult => {
  const name = getProjectDisplayName(project);
  const rawStylePresets = (project as any)?.stylePresets;
  const rawActiveStyleId = (project as any)?.activeStylePresetId;
  console.log('[LoadableProject] BEFORE parse:',
    '| raw stylePresets.length:', rawStylePresets?.length,
    '| raw activeStylePresetId:', rawActiveStyleId);
  
  const parsed = projectSchema.safeParse(project);
  if (!parsed.success) {
    return {
      ok: false,
      name,
      errorDetail: JSON.stringify(parsed.error.format(), null, 2)
    };
  }

  console.log('[LoadableProject] AFTER parse:',
    '| parsed stylePresets.length:', parsed.data.stylePresets?.length,
    '| parsed activeStylePresetId:', parsed.data.activeStylePresetId);

  return {
    ok: true,
    name,
    project: prepareProjectForRuntime(parsed.data)
  };
};

export type LoadableProjectPayloadResult =
  | LoadableProjectResult
  | {
      ok: false;
      name: string;
      errorDetail: string;
    };

export const resolveLoadableProjectPayload = (
  payload: string | null | undefined
): LoadableProjectPayloadResult => {
  if (!payload) {
    return {
      ok: false,
      name: 'Unknown',
      errorDetail: 'Missing project payload'
    };
  }

  try {
    return resolveLoadableProject(JSON.parse(payload));
  } catch (error) {
    return {
      ok: false,
      name: 'Unknown',
      errorDetail: error instanceof Error ? error.message : String(error)
    };
  }
};
