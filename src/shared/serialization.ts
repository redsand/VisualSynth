import { projectSchema } from './projectSchema';
import { DEFAULT_PROJECT, VisualSynthProject, COLOR_PALETTES } from './project';

const CURRENT_VERSION = 2;

const upgradeProject = (project: VisualSynthProject): VisualSynthProject => {
  if (project.version >= CURRENT_VERSION) return project;
  let upgraded = { ...project };
  if (upgraded.version < 2) {
    upgraded = {
      ...DEFAULT_PROJECT,
    ...project,
    palettes: project.palettes ?? COLOR_PALETTES,
    activePaletteId: project.activePaletteId ?? 'default-classic',
      output: { ...DEFAULT_PROJECT.output, ...upgraded.output },
      stylePresets: upgraded.stylePresets?.length
        ? upgraded.stylePresets
        : DEFAULT_PROJECT.stylePresets,
      activeStylePresetId: upgraded.activeStylePresetId || DEFAULT_PROJECT.activeStylePresetId,
      macros: upgraded.macros?.length ? upgraded.macros : DEFAULT_PROJECT.macros
    };
  }
  upgraded.version = CURRENT_VERSION;
  return upgraded;
};

export const serializeProject = (project: VisualSynthProject) => {
  const parsed = projectSchema.safeParse(project);
  if (!parsed.success) {
    throw new Error('Invalid project data');
  }
  return JSON.stringify(parsed.data, null, 2);
};

export const deserializeProject = (payload: string): VisualSynthProject => {
  const parsed = projectSchema.safeParse(JSON.parse(payload));
  if (!parsed.success) {
    throw new Error('Invalid project data');
  }
  return upgradeProject(parsed.data);
};
