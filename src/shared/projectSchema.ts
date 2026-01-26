import { z } from 'zod';
import { DEFAULT_OUTPUT_CONFIG } from './project';

const transformSchema = z.object({
  x: z.number(),
  y: z.number(),
  scale: z.number(),
  rotation: z.number()
});

const layerSchema = z.object({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean(),
  opacity: z.number(),
  blendMode: z.enum(['normal', 'add', 'multiply', 'screen', 'overlay', 'difference']),
  transform: transformSchema
});

const modConnectionSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  amount: z.number(),
  curve: z.enum(['linear', 'exp', 'log']),
  smoothing: z.number(),
  bipolar: z.boolean(),
  min: z.number(),
  max: z.number()
});

const midiMappingSchema = z.object({
  id: z.string(),
  message: z.enum(['note', 'cc', 'aftertouch', 'pitchbend']),
  channel: z.number(),
  control: z.number(),
  target: z.string(),
  mode: z.enum(['toggle', 'momentary', 'trigger'])
});

const sceneSchema = z.object({
  id: z.string(),
  name: z.string(),
  layers: z.array(layerSchema)
});

const outputConfigSchema = z.object({
  enabled: z.boolean(),
  fullscreen: z.boolean(),
  scale: z.number().min(0.25).max(1)
});

export const projectSchema = z.object({
  version: z.number(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  output: outputConfigSchema.default(DEFAULT_OUTPUT_CONFIG),
  scenes: z.array(sceneSchema),
  modMatrix: z.array(modConnectionSchema),
  midiMappings: z.array(midiMappingSchema),
  activeSceneId: z.string()
});

export type ProjectSchema = z.infer<typeof projectSchema>;
