import { projectSchema } from './projectSchema';
import { VisualSynthProject } from './project';

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
  return parsed.data;
};
