import type { VisualSynthProject } from '../shared/project';
import { projectSchema } from '../shared/projectSchema';
import { prepareProjectForRuntime } from './runtimeProject';
import { normalizeAssetPath } from '../shared/assets';

export type LoadableProjectResult =
  | {
      ok: true;
      project: VisualSynthProject;
      name: string;
      /** Scenes that failed validation and were left out (the rest loaded). */
      skippedScenes?: string[];
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

/**
 * One malformed scene (e.g. a string where a shader parameter must be a
 * number) used to make the WHOLE project fail validation and not load at all
 * — a show-stopper. When every validation issue lies inside specific scenes,
 * drop just those scenes and load the rest; report which were skipped.
 */
const withoutInvalidScenes = (project: unknown, issues: Array<{ path: Array<string | number> }>) => {
  const p = project as { scenes?: Array<{ name?: string }> };
  if (!p || !Array.isArray(p.scenes)) return null;
  const bad = new Set<number>();
  for (const issue of issues) {
    if (issue.path[0] !== 'scenes' || typeof issue.path[1] !== 'number') return null; // not scene-scoped
    bad.add(issue.path[1]);
  }
  if (bad.size === 0 || bad.size >= p.scenes.length) return null;
  return {
    project: { ...(p as object), scenes: p.scenes.filter((_, i) => !bad.has(i)) },
    skipped: p.scenes.filter((_, i) => bad.has(i)).map((s, i) => s?.name ?? `scene ${i + 1}`)
  };
};

export const resolveLoadableProject = (project: unknown): LoadableProjectResult => {
  let parsed = projectSchema.safeParse(project);
  const name = getProjectDisplayName(project);
  let skippedScenes: string[] | undefined;
  if (!parsed.success) {
    const salvage = withoutInvalidScenes(project, parsed.error.issues);
    if (salvage) {
      const retry = projectSchema.safeParse(salvage.project);
      if (retry.success) {
        parsed = retry;
        skippedScenes = salvage.skipped;
      }
    }
  }
  if (!parsed.success) {
    return {
      ok: false,
      name,
      errorDetail: JSON.stringify(parsed.error.format(), null, 2)
    };
  }

  const projectData = parsed.data as VisualSynthProject;
  
  // Normalize asset paths on load
  if (projectData.assets) {
    projectData.assets = projectData.assets.map(asset => ({
      ...asset,
      path: normalizeAssetPath(asset.path)
    }));
  }

  return {
    ok: true,
    name,
    project: prepareProjectForRuntime(projectData),
    ...(skippedScenes ? { skippedScenes } : {})
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
