export type LayerBlendMode = 'normal' | 'add' | 'multiply' | 'screen' | 'overlay' | 'difference';

export const OUTPUT_BASE_WIDTH = 1280;
export const OUTPUT_BASE_HEIGHT = 720;

export interface OutputConfig {
  enabled: boolean;
  fullscreen: boolean;
  scale: number;
}

export const DEFAULT_OUTPUT_CONFIG: OutputConfig = {
  enabled: false,
  fullscreen: false,
  scale: 1
};

export interface LayerConfig {
  id: string;
  name: string;
  role: LayerRole;
  enabled: boolean;
  opacity: number;
  blendMode: LayerBlendMode;
  transform: {
    x: number;
    y: number;
    scale: number;
    rotation: number;
  };
  assetId?: string;
  generatorId?: string;
  params?: Record<string, any>;
  effects?: any[]; // Chain of local effects
  sdfScene?: any;
}

export interface ModConnection {
  id?: string;
  source: string;
  target: string;
  amount: number;
  curve: 'linear' | 'exp' | 'log';
  smoothing: number;
  bipolar: boolean;
  min: number;
  max: number;
}

export interface MidiMapping {
  id?: string;
  message: 'note' | 'cc' | 'aftertouch' | 'pitchbend';
  channel: number;
  control: number;
  target: string;
  mode: 'toggle' | 'momentary' | 'trigger';
}

export type LayerRole = 'core' | 'support' | 'atmosphere';

export type SceneIntent = 'calm' | 'pulse' | 'build' | 'chaos' | 'ambient';

export interface SceneTransition {
  durationMs: number;
  curve: 'linear' | 'easeInOut';
}

export interface SceneTrigger {
  type: 'manual' | 'time' | 'audio';
  threshold?: number;
  minIntervalMs?: number;
}

export interface SceneLayerRoles {
  core: string[];
  support: string[];
  atmosphere: string[];
}

export interface ExpressiveFxIntentBinding {
  enabled: boolean;
  intent: SceneIntent;
  amount: number;
}

export interface EnergyBloomFx {
  enabled: boolean;
  macro: number;
  intentBinding: ExpressiveFxIntentBinding;
  expert: {
    threshold: number;
    accumulation: number;
  };
}

export interface MotionEchoFx {
  enabled: boolean;
  macro: number;
  intentBinding: ExpressiveFxIntentBinding;
  expert: {
    decay: number;
    warp: number;
  };
}

export interface RadialGravityFx {
  enabled: boolean;
  macro: number;
  intentBinding: ExpressiveFxIntentBinding;
  expert: {
    strength: number;
    radius: number;
    focusX: number;
    focusY: number;
  };
}

export interface SpectralSmearFx {
  enabled: boolean;
  macro: number;
  intentBinding: ExpressiveFxIntentBinding;
  expert: {
    offset: number;
    mix: number;
  };
}

export interface ExpressiveFxConfig {
  energyBloom: EnergyBloomFx;
  radialGravity: RadialGravityFx;
  motionEcho: MotionEchoFx;
  spectralSmear: SpectralSmearFx;
}

export const DEFAULT_EXPRESSIVE_INTENT_BINDING: ExpressiveFxIntentBinding = {
  enabled: false,
  intent: 'ambient',
  amount: 0.35
};

export const DEFAULT_EXPRESSIVE_FX: ExpressiveFxConfig = {
  energyBloom: {
    enabled: false,
    macro: 0.35,
    intentBinding: { ...DEFAULT_EXPRESSIVE_INTENT_BINDING },
    expert: {
      threshold: 0.55,
      accumulation: 0.65
    }
  },
  radialGravity: {
    enabled: false,
    macro: 0.3,
    intentBinding: { ...DEFAULT_EXPRESSIVE_INTENT_BINDING },
    expert: {
      strength: 0.6,
      radius: 0.65,
      focusX: 0.5,
      focusY: 0.5
    }
  },
  motionEcho: {
    enabled: false,
    macro: 0.3,
    intentBinding: { ...DEFAULT_EXPRESSIVE_INTENT_BINDING },
    expert: {
      decay: 0.6,
      warp: 0.35
    }
  },
  spectralSmear: {
    enabled: false,
    macro: 0.3,
    intentBinding: { ...DEFAULT_EXPRESSIVE_INTENT_BINDING },
    expert: {
      offset: 0.4,
      mix: 0.6
    }
  }
};

export const DEFAULT_SCENE_TRANSITION: SceneTransition = {
  durationMs: 600,
  curve: 'easeInOut'
};

export const DEFAULT_SCENE_TRIGGER: SceneTrigger = {
  type: 'manual'
};

export const DEFAULT_SCENE_ROLES: SceneLayerRoles = {
  core: [],
  support: [],
  atmosphere: []
};

export interface SceneConfig {
  id: string;
  scene_id?: string;
  name: string;
  intent?: SceneIntent;
  duration?: number;
  transition_in?: SceneTransition;
  transition_out?: SceneTransition;
  trigger?: SceneTrigger;
  assigned_layers?: SceneLayerRoles;
  layers: LayerConfig[];
  look?: SceneLook;
}

export interface MacroTarget {
  target: string;
  amount: number;
}

export interface MacroConfig {
  id: string;
  name: string;
  value: number;
  targets: MacroTarget[];
}

export interface StylePreset {
  id: string;
  name: string;
  settings: {
    contrast: number;
    saturation: number;
    paletteShift: number;
  };
}

export interface ColorPalette {
  id: string;
  name: string;
  colors: [string, string, string, string, string];
}

export const COLOR_PALETTES: ColorPalette[] = [
  {
    id: 'heat',
    name: 'Heat',
    colors: ['#000000', '#ff0000', '#ff7f00', '#ffff00', '#ffffff']
  },
  {
    id: 'ocean',
    name: 'Ocean',
    colors: ['#000000', '#0000ff', '#007fff', '#00ffff', '#ffffff']
  },
  {
    id: 'forest',
    name: 'Forest',
    colors: ['#000000', '#004000', '#008000', '#00c000', '#ffffff']
  },
  {
    id: 'synthwave',
    name: 'Synthwave',
    colors: ['#000000', '#ff00ff', '#7f00ff', '#00ffff', '#ffffff']
  },
  {
    id: 'industrial',
    name: 'Industrial',
    colors: ['#000000', '#808080', '#c0c0c0', '#ffffff', '#ff0000']
  },
  {
    id: 'grayscale',
    name: 'Grayscale',
    colors: ['#000000', '#404040', '#808080', '#c0c0c0', '#ffffff']
  }
];

export interface ParticleConfig {
  enabled: boolean;
  density: number;
  speed: number;
  size: number;
  glow: number;
  turbulence?: number;
  audioLift?: number;
}

export interface SdfConfig {
  enabled: boolean;
  shape: 'circle' | 'box' | 'triangle' | 'hexagon' | 'star' | 'ring';
  scale: number;
  edge: number;
  glow: number;
  rotation: number;
  fill: number;
  color?: [number, number, number];
}

export interface LfoConfig {
  id: string;
  name: string;
  shape: 'sine' | 'triangle' | 'saw' | 'square';
  rate: number;
  sync: boolean;
  phase: number;
}

export interface EnvelopeConfig {
  id: string;
  name: string;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  hold: number;
  trigger: 'audio.peak' | 'strobe' | 'manual';
  threshold: number;
}

export interface SampleHoldConfig {
  id: string;
  name: string;
  rate: number;
  sync: boolean;
  smooth: number;
}

export interface VisualizerConfig {
  enabled: boolean;
  mode: 'off' | 'spectrum' | 'waveform' | 'oscilloscope';
  opacity: number;
  macroEnabled: boolean;
  macroId: number;
}

export interface TimelineMarker {
  id: string;
  timeMs: number;
  label: string;
}

export type AssetKind = 'texture' | 'shader' | 'video' | 'live' | 'text';
export type AssetColorSpace = 'srgb' | 'linear';

export interface AssetItem {
  id: string;
  name: string;
  kind: 'texture' | 'video' | 'shader' | 'live' | 'text' | 'internal';
  path?: string;
  tags: string[];
  addedAt: string;
  missing?: boolean;
  hash?: string;
  mime?: string;
  width?: number;
  height?: number;
  colorSpace?: AssetColorSpace;
  thumbnail?: string;
  internalSource?: 'audio-waveform' | 'audio-spectrum' | 'modulators' | 'midi-history';
  options?: {
    loop?: boolean;
    playbackRate?: number;
    reverse?: boolean;
    frameBlend?: number;
    textureSampling?: 'linear' | 'nearest';
    generateMipmaps?: boolean;
    duration?: number;
    liveSource?: 'webcam' | 'screen' | 'ndi' | 'spout';
    text?: string;
    font?: string;
    fontSize?: number;
    fontColor?: string;
    shaderSource?: string;
  };
}

export interface PluginEntry {
  id: string;
  name: string;
  version: string;
  author: string;
  kind: 'generator' | 'effect';
  entry: string;
  enabled: boolean;
  addedAt: string;
}

export type PadAction =
  | 'none'
  | 'toggle-plasma'
  | 'toggle-spectrum'
  | 'origami-mountain'
  | 'origami-valley'
  | 'origami-collapse'
  | 'origami-explode'
  | 'gravity-spawn-fixed'
  | 'gravity-spawn-audio'
  | 'gravity-destroy'
  | 'gravity-toggle-polarity'
  | 'gravity-flip-last'
  | 'gravity-collapse'
  | 'glyph-stack'
  | 'glyph-orbit'
  | 'glyph-explode'
  | 'glyph-sentence'
  | 'crystal-seed'
  | 'crystal-grow'
  | 'crystal-fracture'
  | 'crystal-melt'
  | 'ink-fine'
  | 'ink-dry'
  | 'ink-neon'
  | 'ink-lifespan'
  | 'ink-pressure'
  | 'topo-quake'
  | 'topo-landslide'
  | 'topo-plate'
  | 'weather-storm'
  | 'weather-fog'
  | 'weather-calm'
  | 'weather-hurricane'
  | 'portal-spawn'
  | 'portal-collapse'
  | 'portal-transition'
  | 'oscillo-capture'
  | 'oscillo-freeze'
  | 'oscillo-rotate'
  | 'strobe'
  | 'scene-next'
  | 'scene-prev'
  | 'macro-1'
  | 'macro-2'
  | 'macro-3'
  | 'macro-4'
  | 'macro-5'
  | 'macro-6'
  | 'macro-7'
  | 'macro-8';

export interface VisualSynthProject {
  version: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  output: OutputConfig;
  stylePresets: StylePreset[];
  activeStylePresetId: string;
  palettes: ColorPalette[];
  activePaletteId: string;
  macros: MacroConfig[];
  effects: EffectConfig;
  expressiveFx: ExpressiveFxConfig;
  particles: ParticleConfig;
  sdf: SdfConfig;
  visualizer: VisualizerConfig;
  lfos: LfoConfig[];
  envelopes: EnvelopeConfig[];
  sampleHold: SampleHoldConfig[];
  padMappings: PadAction[];
  timelineMarkers: TimelineMarker[];
  assets: AssetItem[];
  plugins: PluginEntry[];
  scenes: SceneConfig[];
  modMatrix: ModConnection[];
  midiMappings: MidiMapping[];
  activeSceneId: string;
}

export interface EffectConfig {
  enabled: boolean;
  bloom: number;
  blur: number;
  chroma: number;
  posterize: number;
  kaleidoscope: number;
  feedback: number;
  persistence: number;
}

export interface SceneLook {
  effects?: EffectConfig;
  particles?: ParticleConfig;
  sdf?: SdfConfig;
  visualizer?: {
    enabled: boolean;
    mode: 'off' | 'spectrum' | 'waveform' | 'oscilloscope';
    opacity: number;
    macroEnabled: boolean;
    macroId: number;
  };
  stylePresets?: StylePreset[];
  activeStylePresetId?: string;
  palettes?: ColorPalette[];
  activePaletteId?: string;
  macros?: MacroConfig[];
  modMatrix?: ModConnection[];
}

export const DEFAULT_PROJECT: VisualSynthProject = {
  version: 3,
  name: 'Untitled VisualSynth Project',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  output: { ...DEFAULT_OUTPUT_CONFIG },
  stylePresets: [
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
  ],
  activeStylePresetId: 'style-neutral',
  palettes: COLOR_PALETTES,
  activePaletteId: 'heat',
  macros: [
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
    {
      id: 'macro-3',
      name: 'Macro 3',
      value: 0.5,
      targets: []
    },
    {
      id: 'macro-4',
      name: 'Macro 4',
      value: 0.5,
      targets: []
    },
    {
      id: 'macro-5',
      name: 'Macro 5',
      value: 0.5,
      targets: []
    },
    {
      id: 'macro-6',
      name: 'Macro 6',
      value: 0.5,
      targets: []
    },
    {
      id: 'macro-7',
      name: 'Macro 7',
      value: 0.5,
      targets: []
    },
    {
      id: 'macro-8',
      name: 'Macro 8',
      value: 0.5,
      targets: []
    }
  ],
  effects: {
    enabled: true,
    bloom: 0.25,
    blur: 0.05,
    chroma: 0.15,
    posterize: 0.1,
    kaleidoscope: 0.2,
    feedback: 0.1,
    persistence: 0.25
  },
  expressiveFx: DEFAULT_EXPRESSIVE_FX,
  particles: {
    enabled: true,
    density: 0.55,
    speed: 0.35,
    size: 0.5,
    glow: 0.8
  },
  sdf: {
    enabled: true,
    shape: 'triangle',
    scale: 0.55,
    edge: 0.06,
    glow: 0.65,
    rotation: 0.2,
    fill: 0.4,
    color: [1.0, 0.6, 0.25]
  },
  visualizer: {
    enabled: false,
    mode: 'off',
    opacity: 0.8,
    macroEnabled: false,
    macroId: 8
  },
  lfos: [
    {
      id: 'lfo-1',
      name: 'LFO 1',
      shape: 'sine',
      rate: 0.5,
      sync: true,
      phase: 0
    },
    {
      id: 'lfo-2',
      name: 'LFO 2',
      shape: 'triangle',
      rate: 1,
      sync: true,
      phase: 0.25
    }
  ],
  envelopes: [
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
  ],
  sampleHold: [
    {
      id: 'sh-1',
      name: 'S&H 1',
      rate: 0.5,
      sync: true,
      smooth: 0.2
    },
    {
      id: 'sh-2',
      name: 'S&H 2',
      rate: 2,
      sync: false,
      smooth: 0.1
    }
  ],
  padMappings: (() => {
    const mappings: PadAction[] = new Array(256).fill('none');
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
  })(),
  timelineMarkers: [],
  assets: [
    {
      id: 'internal-waveform',
      name: 'Live Waveform',
      kind: 'internal',
      internalSource: 'audio-waveform',
      tags: ['internal', 'audio'],
      addedAt: new Date().toISOString()
    },
    {
      id: 'internal-spectrum',
      name: 'Audio Spectrum',
      kind: 'internal',
      internalSource: 'audio-spectrum',
      tags: ['internal', 'audio'],
      addedAt: new Date().toISOString()
    },
    {
      id: 'internal-modulators',
      name: 'Modulator Matrix',
      kind: 'internal',
      internalSource: 'modulators',
      tags: ['internal', 'mod'],
      addedAt: new Date().toISOString()
    },
    {
      id: 'internal-midi',
      name: 'MIDI History',
      kind: 'internal',
      internalSource: 'midi-history',
      tags: ['internal', 'midi'],
      addedAt: new Date().toISOString()
    }
  ],
  plugins: [],
  scenes: [
    {
      id: 'scene-1',
      scene_id: 'scene-1',
      name: 'Main Scene',
      intent: 'ambient',
      duration: 0,
      transition_in: { ...DEFAULT_SCENE_TRANSITION },
      transition_out: { ...DEFAULT_SCENE_TRANSITION },
      trigger: { ...DEFAULT_SCENE_TRIGGER },
      assigned_layers: {
        core: ['layer-plasma', 'layer-spectrum'],
        support: ['layer-origami', 'layer-glyph', 'layer-crystal'],
        atmosphere: ['layer-inkflow', 'layer-topo', 'layer-weather', 'layer-portal', 'layer-media', 'layer-oscillo']
      },
      layers: [
        {
          id: 'layer-plasma',
          name: 'Shader Plasma',
          role: 'core',
          enabled: true,
          opacity: 0.75,
          blendMode: 'screen',
          transform: { x: 0, y: 0, scale: 1.05, rotation: 0.05 }
        },
        {
          id: 'layer-spectrum',
          name: 'Spectrum Bars',
          role: 'support',
          enabled: true,
          opacity: 0.75,
          blendMode: 'add',
          transform: { x: 0, y: 0, scale: 1, rotation: 0 }
        },
        {
          id: 'layer-origami',
          name: 'Origami Fold',
          role: 'support',
          enabled: false,
          opacity: 0.85,
          blendMode: 'screen',
          transform: { x: 0, y: 0, scale: 1, rotation: 0 }
        },
        {
          id: 'layer-glyph',
          name: 'Glyph Language',
          role: 'support',
          enabled: false,
          opacity: 0.8,
          blendMode: 'screen',
          transform: { x: 0, y: 0, scale: 1, rotation: 0 }
        },
        {
          id: 'layer-crystal',
          name: 'Crystal Harmonics',
          role: 'support',
          enabled: false,
          opacity: 0.85,
          blendMode: 'screen',
          transform: { x: 0, y: 0, scale: 1, rotation: 0 }
        },
        {
          id: 'layer-inkflow',
          name: 'Ink Flow',
          role: 'atmosphere',
          enabled: false,
          opacity: 0.85,
          blendMode: 'screen',
          transform: { x: 0, y: 0, scale: 1, rotation: 0 }
        },
        {
          id: 'layer-topo',
          name: 'Topo Terrain',
          role: 'atmosphere',
          enabled: false,
          opacity: 0.85,
          blendMode: 'screen',
          transform: { x: 0, y: 0, scale: 1, rotation: 0 }
        },
        {
          id: 'layer-weather',
          name: 'Audio Weather',
          role: 'atmosphere',
          enabled: false,
          opacity: 0.85,
          blendMode: 'screen',
          transform: { x: 0, y: 0, scale: 1, rotation: 0 }
        },
        {
          id: 'layer-portal',
          name: 'Wormhole Portal',
          role: 'atmosphere',
          enabled: false,
          opacity: 0.85,
          blendMode: 'screen',
          transform: { x: 0, y: 0, scale: 1, rotation: 0 },
          params: {
            autoSpawn: 1,
            style: 0
          }
        },
        {
          id: 'layer-media',
          name: 'Media Overlay',
          role: 'support',
          enabled: false,
          opacity: 0.9,
          blendMode: 'screen',
          transform: { x: 0, y: 0, scale: 1, rotation: 0 }
        },
        {
          id: 'layer-oscillo',
          name: 'Sacred Oscilloscope',
          role: 'support',
          enabled: false,
          opacity: 0.85,
          blendMode: 'screen',
          transform: { x: 0, y: 0, scale: 1, rotation: 0 }
        }
      ]
    },
    {
      id: 'scene-2',
      scene_id: 'scene-2',
      name: 'Pulse Scene',
      intent: 'pulse',
      duration: 0,
      transition_in: { ...DEFAULT_SCENE_TRANSITION },
      transition_out: { ...DEFAULT_SCENE_TRANSITION },
      trigger: { ...DEFAULT_SCENE_TRIGGER },
      assigned_layers: {
        core: ['layer-spectrum'],
        support: ['layer-plasma'],
        atmosphere: ['layer-origami', 'layer-glyph', 'layer-crystal', 'layer-inkflow', 'layer-topo', 'layer-weather']
      },
      layers: [
        {
          id: 'layer-plasma',
          name: 'Shader Plasma',
          role: 'core',
          enabled: false,
          opacity: 0.8,
          blendMode: 'screen',
          transform: { x: 0, y: 0, scale: 1.05, rotation: 0.04 }
        },
        {
          id: 'layer-spectrum',
          name: 'Spectrum Bars',
          role: 'support',
          enabled: true,
          opacity: 0.95,
          blendMode: 'add',
          transform: { x: 0, y: 0, scale: 1, rotation: 0 }
        },
        {
          id: 'layer-origami',
          name: 'Origami Fold',
          role: 'support',
          enabled: false,
          opacity: 0.85,
          blendMode: 'screen',
          transform: { x: 0, y: 0, scale: 1, rotation: 0 }
        },
        {
          id: 'layer-glyph',
          name: 'Glyph Language',
          role: 'support',
          enabled: false,
          opacity: 0.8,
          blendMode: 'screen',
          transform: { x: 0, y: 0, scale: 1, rotation: 0 }
        },
        {
          id: 'layer-crystal',
          name: 'Crystal Harmonics',
          role: 'support',
          enabled: false,
          opacity: 0.85,
          blendMode: 'screen',
          transform: { x: 0, y: 0, scale: 1, rotation: 0 }
        },
        {
          id: 'layer-inkflow',
          name: 'Ink Flow',
          role: 'atmosphere',
          enabled: false,
          opacity: 0.85,
          blendMode: 'screen',
          transform: { x: 0, y: 0, scale: 1, rotation: 0 }
        },
        {
          id: 'layer-topo',
          name: 'Topo Terrain',
          role: 'atmosphere',
          enabled: false,
          opacity: 0.85,
          blendMode: 'screen',
          transform: { x: 0, y: 0, scale: 1, rotation: 0 }
        },
        {
          id: 'layer-weather',
          name: 'Audio Weather',
          role: 'atmosphere',
          enabled: false,
          opacity: 0.85,
          blendMode: 'screen',
          transform: { x: 0, y: 0, scale: 1, rotation: 0 }
        },
        {
          id: 'layer-portal',
          name: 'Wormhole Portal',
          role: 'atmosphere',
          enabled: false,
          opacity: 0.85,
          blendMode: 'screen',
          transform: { x: 0, y: 0, scale: 1, rotation: 0 },
          params: {
            autoSpawn: 1,
            style: 0
          }
        },
        {
          id: 'layer-media',
          name: 'Media Overlay',
          role: 'support',
          enabled: false,
          opacity: 0.9,
          blendMode: 'screen',
          transform: { x: 0, y: 0, scale: 1, rotation: 0 }
        },
        {
          id: 'layer-oscillo',
          name: 'Sacred Oscilloscope',
          role: 'support',
          enabled: false,
          opacity: 0.85,
          blendMode: 'screen',
          transform: { x: 0, y: 0, scale: 1, rotation: 0 }
        }
      ]
    }
  ],
  modMatrix: [],
  midiMappings: [],
  activeSceneId: 'scene-1'
};
