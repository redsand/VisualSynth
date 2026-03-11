import {
  DEFAULT_OUTPUT_CONFIG,
  type OutputConfig,
  type VisualSynthProject
} from '../shared/project';

export const resolveProjectOutputConfig = (
  project: VisualSynthProject,
  currentOutputConfig?: Partial<OutputConfig>
): OutputConfig => ({
  ...DEFAULT_OUTPUT_CONFIG,
  ...currentOutputConfig,
  ...project.output
});
