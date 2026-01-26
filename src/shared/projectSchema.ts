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

const macroSchema = z.object({
  id: z.string(),
  name: z.string(),
  value: z.number(),
  targets: z.array(
    z.object({
      target: z.string(),
      amount: z.number()
    })
  )
});

const stylePresetSchema = z.object({
  id: z.string(),
  name: z.string(),
  settings: z.object({
    contrast: z.number(),
    saturation: z.number(),
    paletteShift: z.number()
  })
});

const outputConfigSchema = z.object({
  enabled: z.boolean(),
  fullscreen: z.boolean(),
  scale: z.number().min(0.25).max(1)
});

const stylePresetDefaults = [
  {
    id: 'style-neutral',
    name: 'Neutral',
    settings: { contrast: 1, saturation: 1, paletteShift: 0 }
  },
  {
    id: 'style-surge',
    name: 'Surge',
    settings: { contrast: 1.2, saturation: 1.4, paletteShift: 0.08 }
  },
  {
    id: 'style-noir',
    name: 'Noir',
    settings: { contrast: 1.4, saturation: 0.7, paletteShift: -0.12 }
  }
];

const effectsSchema = z.object({
  enabled: z.boolean(),
  bloom: z.number(),
  blur: z.number(),
  chroma: z.number(),
  posterize: z.number(),
  kaleidoscope: z.number(),
  feedback: z.number(),
  persistence: z.number()
});

const particlesSchema = z.object({
  enabled: z.boolean(),
  density: z.number(),
  speed: z.number(),
  size: z.number(),
  glow: z.number()
});

const sdfSchema = z.object({
  enabled: z.boolean(),
  shape: z.enum(['circle', 'box', 'triangle']),
  scale: z.number(),
  edge: z.number(),
  glow: z.number(),
  rotation: z.number(),
  fill: z.number()
});

const lfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  shape: z.enum(['sine', 'triangle', 'saw', 'square']),
  rate: z.number(),
  sync: z.boolean(),
  phase: z.number()
});

const envelopeSchema = z.object({
  id: z.string(),
  name: z.string(),
  attack: z.number(),
  decay: z.number(),
  sustain: z.number(),
  release: z.number(),
  hold: z.number(),
  trigger: z.enum(['audio.peak', 'strobe', 'manual']),
  threshold: z.number()
});

const sampleHoldSchema = z.object({
  id: z.string(),
  name: z.string(),
  rate: z.number(),
  sync: z.boolean(),
  smooth: z.number()
});

const padActionSchema = z.enum([
  'none',
  'toggle-plasma',
  'toggle-spectrum',
  'strobe',
  'scene-next',
  'scene-prev',
  'macro-1',
  'macro-2',
  'macro-3',
  'macro-4',
  'macro-5',
  'macro-6',
  'macro-7',
  'macro-8'
]);

const timelineMarkerSchema = z.object({
  id: z.string(),
  timeMs: z.number(),
  label: z.string()
});

const assetItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(['texture', 'shader', 'video']),
  path: z.string(),
  tags: z.array(z.string()),
  addedAt: z.string()
});

const pluginEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  author: z.string(),
  kind: z.enum(['generator', 'effect']),
  entry: z.string(),
  enabled: z.boolean(),
  addedAt: z.string()
});

const defaultPadMappings = (() => {
  const mappings = new Array(256).fill('none');
  for (let i = 0; i < 32; i += 1) {
    mappings[i] = 'toggle-plasma';
  }
  for (let i = 32; i < 64; i += 1) {
    mappings[i] = 'strobe';
  }
  return mappings;
})();

export const projectSchema = z.object({
  version: z.number(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  output: outputConfigSchema.default(DEFAULT_OUTPUT_CONFIG),
  stylePresets: z.array(stylePresetSchema).default(stylePresetDefaults),
  activeStylePresetId: z.string().default(stylePresetDefaults[0].id),
  macros: z
    .array(macroSchema)
    .default([
      {
        id: 'macro-1',
        name: 'Macro 1',
        value: 0.5,
        targets: [{ target: 'layer-plasma.opacity', amount: 1 }]
      },
      {
        id: 'macro-2',
        name: 'Macro 2',
        value: 0.5,
        targets: [{ target: 'layer-spectrum.opacity', amount: 1 }]
      },
      { id: 'macro-3', name: 'Macro 3', value: 0.5, targets: [] },
      { id: 'macro-4', name: 'Macro 4', value: 0.5, targets: [] },
      { id: 'macro-5', name: 'Macro 5', value: 0.5, targets: [] },
      { id: 'macro-6', name: 'Macro 6', value: 0.5, targets: [] },
      { id: 'macro-7', name: 'Macro 7', value: 0.5, targets: [] },
      { id: 'macro-8', name: 'Macro 8', value: 0.5, targets: [] }
    ]),
  effects: effectsSchema.default({
    enabled: true,
    bloom: 0.2,
    blur: 0,
    chroma: 0.1,
    posterize: 0,
    kaleidoscope: 0,
    feedback: 0,
    persistence: 0
  }),
  particles: particlesSchema.default({
    enabled: true,
    density: 0.35,
    speed: 0.3,
    size: 0.45,
    glow: 0.6
  }),
  sdf: sdfSchema.default({
    enabled: true,
    shape: 'circle',
    scale: 0.45,
    edge: 0.08,
    glow: 0.5,
    rotation: 0,
    fill: 0.35
  }),
  lfos: z
    .array(lfoSchema)
    .default([
      { id: 'lfo-1', name: 'LFO 1', shape: 'sine', rate: 0.5, sync: true, phase: 0 },
      { id: 'lfo-2', name: 'LFO 2', shape: 'triangle', rate: 1, sync: true, phase: 0.25 }
    ]),
  envelopes: z
    .array(envelopeSchema)
    .default([
      {
        id: 'env-1',
        name: 'Env 1',
        attack: 0.05,
        decay: 0.2,
        sustain: 0.6,
        release: 0.3,
        hold: 0.4,
        trigger: 'audio.peak',
        threshold: 0.6
      },
      {
        id: 'env-2',
        name: 'Env 2',
        attack: 0.1,
        decay: 0.3,
        sustain: 0.5,
        release: 0.4,
        hold: 0.5,
        trigger: 'strobe',
        threshold: 0.4
      }
    ]),
  sampleHold: z
    .array(sampleHoldSchema)
    .default([
      { id: 'sh-1', name: 'S&H 1', rate: 0.5, sync: true, smooth: 0.2 },
      { id: 'sh-2', name: 'S&H 2', rate: 2, sync: false, smooth: 0.1 }
    ]),
  padMappings: z.array(padActionSchema).default(defaultPadMappings),
  timelineMarkers: z.array(timelineMarkerSchema).default([]),
  assets: z.array(assetItemSchema).default([]),
  plugins: z.array(pluginEntrySchema).default([]),
  scenes: z.array(sceneSchema),
  modMatrix: z.array(modConnectionSchema),
  midiMappings: z.array(midiMappingSchema),
  activeSceneId: z.string()
});

export type ProjectSchema = z.infer<typeof projectSchema>;
