import { z } from 'zod';
import { DEFAULT_OUTPUT_CONFIG } from './project';

const sdfParamValueSchema = z.union([
  z.number(),
  z.array(z.number()),
  z.boolean()
]);

const sdfNodeInstanceSchema = z.object({
  instanceId: z.string(),
  nodeId: z.string(),
  params: z.record(sdfParamValueSchema),
  enabled: z.boolean(),
  order: z.number(),
  label: z.string().optional()
});

const sdfConnectionSchema = z.object({
  from: z.string(),
  to: z.string(),
  slot: z.number()
});

const sdfRenderConfig2DSchema = z.object({
  antialiasing: z.boolean(),
  aaSmoothing: z.number(),
  strokeEnabled: z.boolean(),
  strokeWidth: z.number(),
  strokeColor: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  fillEnabled: z.boolean(),
  fillOpacity: z.number(),
  fillColor: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  glowEnabled: z.boolean(),
  glowIntensity: z.number(),
  glowRadius: z.number(),
  glowColor: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  gradientEnabled: z.boolean(),
  gradientMode: z.enum(['distance', 'normal', 'angle']),
  gradientColors: z.array(z.tuple([z.number(), z.number(), z.number(), z.number()]))
});

const sdfLightingConfigSchema = z.object({
  direction: z.tuple([z.number(), z.number(), z.number()]),
  color: z.tuple([z.number(), z.number(), z.number()]),
  intensity: z.number(),
  ambient: z.number(),
  specularPower: z.number(),
  specularIntensity: z.number()
});

const sdfRenderConfig3DSchema = z.object({
  maxSteps: z.number(),
  maxDistance: z.number(),
  epsilon: z.number(),
  normalEpsilon: z.number(),
  lighting: sdfLightingConfigSchema,
  aoEnabled: z.boolean(),
  aoSteps: z.number(),
  aoIntensity: z.number(),
  aoRadius: z.number(),
  softShadowsEnabled: z.boolean(),
  shadowSoftness: z.number(),
  shadowSteps: z.number(),
  fogEnabled: z.boolean(),
  fogDensity: z.number(),
  fogColor: z.tuple([z.number(), z.number(), z.number()]),
  backgroundColor: z.array(z.number()).length(3),
  backgroundGradient: z.boolean(),
  adaptiveQuality: z.boolean(),
  qualityBias: z.number(),
  cameraPosition: z.array(z.number()).length(3).optional(),
  cameraTarget: z.array(z.number()).length(3).optional(),
  cameraFov: z.number().optional()
});

const sdfDebugConfigSchema = z.object({
  showDistance: z.boolean(),
  distanceScale: z.number(),
  showNormals: z.boolean(),
  showSteps: z.boolean(),
  stepsColorScale: z.number(),
  showCostTier: z.boolean(),
  showBounds: z.boolean(),
  wireframe: z.boolean()
});

const sdfSceneConfigSchema = z.object({
  version: z.number(),
  mode: z.enum(['2d', '3d']),
  nodes: z.array(sdfNodeInstanceSchema),
  connections: z.array(sdfConnectionSchema),
  render2d: sdfRenderConfig2DSchema,
  render3d: sdfRenderConfig3DSchema,
  debug: sdfDebugConfigSchema,
  camera: z.object({
    position: z.tuple([z.number(), z.number(), z.number()]),
    target: z.tuple([z.number(), z.number(), z.number()]),
    fov: z.number()
  }).optional()
});

const transformSchema = z.object({
  x: z.number(),
  y: z.number(),
  scale: z.number(),
  rotation: z.number()
});

const layerSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.enum(['core', 'support', 'atmosphere']).default('support'),
  enabled: z.boolean(),
  opacity: z.number(),
  blendMode: z.enum(['normal', 'add', 'multiply', 'screen', 'overlay', 'difference']),
  transform: transformSchema,
  assetId: z.string().optional(),
  generatorId: z.string().optional(),
  params: z.record(z.any()).optional(),
  effects: z.array(z.any()).optional(),
  sdfScene: sdfSceneConfigSchema.optional()
});

const modConnectionSchema = z.object({
  id: z.string().optional(),
  source: z.string(),
  target: z.string(),
  amount: z.number().default(1),
  curve: z.enum(['linear', 'exp', 'log']).default('linear'),
  smoothing: z.number().default(0),
  bipolar: z.boolean().default(false),
  min: z.number().default(0),
  max: z.number().default(1)
});

const midiMappingSchema = z.object({
  id: z.string().optional(),
  message: z.enum(['note', 'cc', 'aftertouch', 'pitchbend']),
  channel: z.number(),
  control: z.number(),
  target: z.string(),
  mode: z.enum(['toggle', 'momentary', 'trigger'])
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

const colorPaletteSchema = z.object({
  id: z.string(),
  name: z.string(),
  colors: z.tuple([z.string(), z.string(), z.string(), z.string(), z.string()])
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
  glow: z.number(),
  turbulence: z.number().optional(),
  audioLift: z.number().optional()
});

const sdfSchema = z.object({
  enabled: z.boolean(),
  shape: z.enum(['circle', 'box', 'triangle', 'hexagon', 'star', 'ring']),
  scale: z.number(),
  edge: z.number(),
  glow: z.number(),
  rotation: z.number(),
  fill: z.number(),
  color: z.tuple([z.number(), z.number(), z.number()]).optional()
});

const visualizerSchema = z.object({
  enabled: z.boolean(),
  mode: z.enum(['off', 'spectrum', 'waveform', 'oscilloscope']),
  opacity: z.number(),
  macroEnabled: z.boolean(),
  macroId: z.number()
});

const sceneLookSchema = z
  .object({
    effects: effectsSchema,
    particles: particlesSchema,
    sdf: sdfSchema,
    visualizer: visualizerSchema,
    stylePresets: z.array(stylePresetSchema),
    activeStylePresetId: z.string(),
    palettes: z.array(colorPaletteSchema),
    activePaletteId: z.string(),
    macros: z.array(macroSchema),
    modMatrix: z.array(modConnectionSchema)
  })
  .partial();

const sceneIntentSchema = z.enum(['calm', 'pulse', 'build', 'chaos', 'ambient']);

const expressiveIntentBindingSchema = z.object({
  enabled: z.boolean(),
  intent: sceneIntentSchema,
  amount: z.number()
});

const energyBloomSchema = z.object({
  enabled: z.boolean(),
  macro: z.number(),
  intentBinding: expressiveIntentBindingSchema,
  expert: z.object({
    threshold: z.number(),
    accumulation: z.number()
  })
});

const motionEchoSchema = z.object({
  enabled: z.boolean(),
  macro: z.number(),
  intentBinding: expressiveIntentBindingSchema,
  expert: z.object({
    decay: z.number(),
    warp: z.number()
  })
});

const radialGravitySchema = z.object({
  enabled: z.boolean(),
  macro: z.number(),
  intentBinding: expressiveIntentBindingSchema,
  expert: z.object({
    strength: z.number(),
    radius: z.number(),
    focusX: z.number(),
    focusY: z.number()
  })
});

const spectralSmearSchema = z.object({
  enabled: z.boolean(),
  macro: z.number(),
  intentBinding: expressiveIntentBindingSchema,
  expert: z.object({
    offset: z.number(),
    mix: z.number()
  })
});

const expressiveFxSchema = z.object({
  energyBloom: energyBloomSchema,
  radialGravity: radialGravitySchema,
  motionEcho: motionEchoSchema,
  spectralSmear: spectralSmearSchema
});

const sceneTransitionSchema = z.object({
  durationMs: z.number(),
  curve: z.enum(['linear', 'easeInOut'])
});

const sceneTriggerSchema = z.object({
  type: z.enum(['manual', 'time', 'audio']),
  threshold: z.number().optional(),
  minIntervalMs: z.number().optional()
});

const sceneLayerRolesSchema = z.object({
  core: z.array(z.string()),
  support: z.array(z.string()),
  atmosphere: z.array(z.string())
});

const sceneSchema = z.object({
  id: z.string(),
  scene_id: z.string().optional(),
  name: z.string(),
  intent: sceneIntentSchema.default('ambient'),
  duration: z.number().default(0),
  transition_in: sceneTransitionSchema
    .default({ durationMs: 600, curve: 'easeInOut' }),
  transition_out: sceneTransitionSchema
    .default({ durationMs: 600, curve: 'easeInOut' }),
  trigger: sceneTriggerSchema.default({ type: 'manual' }),
  assigned_layers: sceneLayerRolesSchema.default({
    core: [],
    support: [],
    atmosphere: []
  }),
  layers: z.array(layerSchema).min(1),
  look: sceneLookSchema.optional()
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
  'origami-mountain',
  'origami-valley',
  'origami-collapse',
  'origami-explode',
  'gravity-spawn-fixed',
  'gravity-spawn-audio',
  'gravity-destroy',
  'gravity-toggle-polarity',
  'gravity-flip-last',
  'gravity-collapse',
  'glyph-stack',
  'glyph-orbit',
  'glyph-explode',
  'glyph-sentence',
  'crystal-seed',
  'crystal-grow',
  'crystal-fracture',
  'crystal-melt',
  'ink-fine',
  'ink-dry',
  'ink-neon',
  'ink-lifespan',
  'ink-pressure',
  'topo-quake',
  'topo-landslide',
  'topo-plate',
  'weather-storm',
  'weather-fog',
  'weather-calm',
  'weather-hurricane',
  'portal-spawn',
  'portal-collapse',
  'portal-transition',
  'oscillo-capture',
  'oscillo-freeze',
  'oscillo-rotate',
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
  kind: z.enum(['texture', 'shader', 'video', 'live', 'text', 'internal']),
  path: z.string().optional(),
  tags: z.array(z.string()),
  addedAt: z.string(),
  hash: z.string().optional(),
  mime: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  colorSpace: z.enum(['srgb', 'linear']).default('srgb'),
  thumbnail: z.string().optional(),
  missing: z.boolean().optional(),
  internalSource: z.enum(['audio-waveform', 'audio-spectrum', 'modulators', 'midi-history']).optional(),
  options: z
    .object({
      loop: z.boolean().optional(),
      playbackRate: z.number().optional(),
      reverse: z.boolean().optional(),
      frameBlend: z.number().optional(),
      textureSampling: z.enum(['linear', 'nearest']).optional(),
      generateMipmaps: z.boolean().optional(),
      duration: z.number().optional(),
      liveSource: z.enum(['webcam', 'screen', 'ndi', 'spout']).optional(),
      text: z.string().optional(),
      font: z.string().optional(),
      fontSize: z.number().optional(),
      fontColor: z.string().optional(),
      shaderSource: z.string().optional()
    })
    .optional()
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
  mappings[64] = 'origami-mountain';
  mappings[65] = 'origami-valley';
  mappings[66] = 'origami-collapse';
  mappings[67] = 'origami-explode';
  return mappings;
})();

export const projectSchema = z.object({
  version: z.number(),
  name: z.string(),
  category: z.string().optional(),
  intendedMusicStyle: z.string().optional(),
  visualIntentTags: z.array(z.string()).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  output: outputConfigSchema.default(DEFAULT_OUTPUT_CONFIG),
  stylePresets: z.array(stylePresetSchema).default(stylePresetDefaults),
  activeStylePresetId: z.string().default(stylePresetDefaults[0].id),
  palettes: z.array(colorPaletteSchema).default([]),
  activePaletteId: z.string().default('heat'),
  macros: z
    .array(macroSchema)
    .default([
      {
        id: 'macro-1',
        name: 'Energy',
        value: 0.5,
        targets: [
          { target: 'effects.bloom', amount: 0.6 },
          { target: 'particles.glow', amount: 0.35 },
          { target: 'effects.feedback', amount: 0.2 }
        ]
      },
      {
        id: 'macro-2',
        name: 'Motion',
        value: 0.5,
        targets: [
          { target: 'particles.speed', amount: 0.4 },
          { target: 'layer-plasma.speed', amount: 0.35 },
          { target: 'layer-origami.speed', amount: 0.25 },
          { target: 'layer-glyph.speed', amount: 0.2 }
        ]
      },
      {
        id: 'macro-3',
        name: 'Color',
        value: 0.5,
        targets: [
          { target: 'style.saturation', amount: 0.35 },
          { target: 'style.paletteShift', amount: 0.25 },
          { target: 'effects.chroma', amount: 0.2 }
        ]
      },
      {
        id: 'macro-4',
        name: 'Density',
        value: 0.5,
        targets: [
          { target: 'particles.density', amount: 0.5 },
          { target: 'layer-spectrum.opacity', amount: 0.35 },
          { target: 'layer-plasma.opacity', amount: 0.2 }
        ]
      },
      { id: 'macro-5', name: 'Macro 5', value: 0.5, targets: [] },
      { id: 'macro-6', name: 'Macro 6', value: 0.5, targets: [] },
      { id: 'macro-7', name: 'Macro 7', value: 0.5, targets: [] },
      { id: 'macro-8', name: 'Macro 8', value: 0.5, targets: [] }
    ]),
  effects: effectsSchema.default({
    enabled: true,
    bloom: 0.25,
    blur: 0.05,
    chroma: 0.15,
    posterize: 0.1,
    kaleidoscope: 0.2,
    feedback: 0.1,
    persistence: 0.25
  }),
  expressiveFx: expressiveFxSchema.default({
    energyBloom: {
      enabled: false,
      macro: 0.35,
      intentBinding: { enabled: false, intent: 'ambient', amount: 0.35 },
      expert: { threshold: 0.55, accumulation: 0.65 }
    },
    radialGravity: {
      enabled: false,
      macro: 0.3,
      intentBinding: { enabled: false, intent: 'ambient', amount: 0.35 },
      expert: { strength: 0.6, radius: 0.65, focusX: 0.5, focusY: 0.5 }
    },
    motionEcho: {
      enabled: false,
      macro: 0.3,
      intentBinding: { enabled: false, intent: 'ambient', amount: 0.35 },
      expert: { decay: 0.6, warp: 0.35 }
    },
    spectralSmear: {
      enabled: false,
      macro: 0.3,
      intentBinding: { enabled: false, intent: 'ambient', amount: 0.35 },
      expert: { offset: 0.4, mix: 0.6 }
    }
  }),
  particles: particlesSchema.default({
    enabled: true,
    density: 0.55,
    speed: 0.35,
    size: 0.5,
    glow: 0.8
  }),
  sdf: sdfSchema.default({
    enabled: true,
    shape: 'triangle',
    scale: 0.55,
    edge: 0.06,
    glow: 0.65,
    rotation: 0.2,
    fill: 0.4
  }),
  visualizer: visualizerSchema.default({
    enabled: false,
    mode: 'off',
    opacity: 0.8,
    macroEnabled: false,
    macroId: 8
  }),
  lfos: z
    .array(lfoSchema)
    .default([
      { id: 'lfo-1', name: 'LFO 1', shape: 'sine', rate: 0.5, sync: true, phase: 0 },
      { id: 'lfo-2', name: 'LFO 2', shape: 'triangle', rate: 1, sync: true, phase: 0.25 },
      { id: 'lfo-3', name: 'LFO 3', shape: 'saw', rate: 0.75, sync: true, phase: 0.5 },
      { id: 'lfo-4', name: 'LFO 4', shape: 'square', rate: 0.35, sync: false, phase: 0.1 }
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
      },
      {
        id: 'env-3',
        name: 'Env 3',
        attack: 0.08,
        decay: 0.25,
        sustain: 0.5,
        release: 0.35,
        hold: 0.3,
        trigger: 'audio.peak',
        threshold: 0.5
      },
      {
        id: 'env-4',
        name: 'Env 4',
        attack: 0.15,
        decay: 0.35,
        sustain: 0.45,
        release: 0.5,
        hold: 0.45,
        trigger: 'strobe',
        threshold: 0.35
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
  scenes: z.array(sceneSchema).min(1),
  modMatrix: z.array(modConnectionSchema),
  midiMappings: z.array(midiMappingSchema),
  activeSceneId: z.string(),
  activeModeId: z.string().default('mode-cosmic'),
  colorChemistry: z.array(z.string()).default(['analog', 'balanced']),
  roleWeights: z.object({
    core: z.number().default(1),
    support: z.number().default(1),
    atmosphere: z.number().default(1)
  }).default({ core: 1, support: 1, atmosphere: 1 }),
  tempoSync: z.object({
    bpm: z.number().default(120),
    source: z.enum(['manual', 'auto', 'network']).default('manual')
  }).default({ bpm: 120, source: 'manual' })
});

export type ProjectSchema = z.infer<typeof projectSchema>;
