import { VisualSynthProject } from './project';

export interface MergeOptions {
  metadata: boolean;
  output: boolean;
  stylePresets: boolean;
  macros: boolean;
  effects: boolean;
  particles: boolean;
  sdf: boolean;
  lfos: boolean;
  envelopes: boolean;
  sampleHold: boolean;
  scenes: boolean;
  modMatrix: boolean;
  midiMappings: boolean;
  padMappings: boolean;
  timelineMarkers: boolean;
  assets: boolean;
  plugins: boolean;
}

export const mergeProjectSections = (
  base: VisualSynthProject,
  incoming: VisualSynthProject,
  options: MergeOptions
) => {
  const now = new Date().toISOString();
  return {
    ...base,
    ...(options.metadata
      ? {
          name: incoming.name,
          createdAt: incoming.createdAt
        }
      : {}),
    output: options.output ? incoming.output : base.output,
    stylePresets: options.stylePresets ? incoming.stylePresets : base.stylePresets,
    activeStylePresetId: options.stylePresets
      ? incoming.activeStylePresetId
      : base.activeStylePresetId,
    macros: options.macros ? incoming.macros : base.macros,
    effects: options.effects ? incoming.effects : base.effects,
    particles: options.particles ? incoming.particles : base.particles,
    sdf: options.sdf ? incoming.sdf : base.sdf,
    lfos: options.lfos ? incoming.lfos : base.lfos,
    envelopes: options.envelopes ? incoming.envelopes : base.envelopes,
    sampleHold: options.sampleHold ? incoming.sampleHold : base.sampleHold,
    scenes: options.scenes ? incoming.scenes : base.scenes,
    modMatrix: options.modMatrix ? incoming.modMatrix : base.modMatrix,
    midiMappings: options.midiMappings ? incoming.midiMappings : base.midiMappings,
    padMappings: options.padMappings ? incoming.padMappings : base.padMappings,
    timelineMarkers: options.timelineMarkers ? incoming.timelineMarkers : base.timelineMarkers,
    assets: options.assets ? incoming.assets : base.assets,
    plugins: options.plugins ? incoming.plugins : base.plugins,
    updatedAt: now
  };
};
