import { DEFAULT_OUTPUT_CONFIG, DEFAULT_PROJECT, OutputConfig, VisualSynthProject } from '../../shared/project';
import type { BpmRange } from '../../shared/bpm';
import type { UiMode } from '../../shared/uiModes';

export interface AudioState {
  rms: number;
  peak: number;
  bands: number[];
  spectrum: Float32Array;
  waveform: Float32Array;
}

export interface RuntimeState {
  strobeIntensity: number;
  strobeDecay: number;
  origamiFoldState: number;
  origamiFoldSharpness: number;
  gravityGlobalPolarity: number;
  gravityCollapse: number;
  gravityFixedIndex: number;
  lastGravityIndex: number;
  glyphMode: number;
  glyphSeed: number;
  glyphBeatPulse: number;
  crystalMode: number;
  crystalBrittleness: number;
  inkBrush: number;
  inkPressure: number;
  inkLifespan: number;
  topoQuake: number;
  topoSlide: number;
  topoPlate: number;
  topoTravel: number;
  weatherMode: number;
  weatherIntensity: number;
  portalShift: number;
  portalSeed: number;
  oscilloMode: number;
  oscilloFreeze: number;
  oscilloRotate: number;
}

export interface BpmState {
  source: 'manual' | 'auto' | 'network';
  range: BpmRange;
  autoBpm: number | null;
  networkBpm: number | null;
  networkActive: boolean;
  manualBpm: number;
}

export interface TransportState {
  isPlaying: boolean;
  timeMs: number;
}

export interface MidiState {
  lastLatencyMs: number | null;
}

export interface PadState {
  states: boolean[];
  activeBank: number;
  activeMapBank: number;
}

export interface ModulatorState {
  lfoPhases: number[];
  envStates: {
    stage: 'idle' | 'attack' | 'decay' | 'sustain' | 'release';
    value: number;
    holdLeft: number;
    triggerArmed: boolean;
  }[];
  shStates: { timer: number; value: number; target: number }[];
}

export interface DiagnosticsState {
  fps: number;
  frameDropScore: number;
  lastWatchdogUpdate: number;
  lastAutosaveAt: number;
  lastRenderTimeMs: number;
  lastSummaryUpdate: number;
  latencyMs: number | null;
  outputLatencyMs: number | null;
}

export interface SafeModeState {
  reasons: string[];
  webglInitError: string | null;
}

export interface DebugFlags {
  enabled: boolean;
  tintLayers: boolean;
  fxDelta: boolean;
}

export interface AppState {
  project: VisualSynthProject;
  outputConfig: OutputConfig;
  outputOpen: boolean;
  uiMode: UiMode;
  transport: TransportState;
  bpm: BpmState;
  audio: AudioState;
  midi: MidiState;
  pad: PadState;
  modulators: ModulatorState;
  runtime: RuntimeState;
  diagnostics: DiagnosticsState;
  safeMode: SafeModeState;
  debug: DebugFlags;
  quantizeHudMessage: string | null;
  pendingSceneSwitch: { targetSceneId: string; scheduledTimeMs: number } | null;
  renderSettings: {
    assetLayerBlendModes: Record<'layer-plasma' | 'layer-spectrum', number>;
    assetLayerAudioReact: Record<'layer-plasma' | 'layer-spectrum', number>;
  };
}

export const createInitialState = (): AppState => ({
  project: DEFAULT_PROJECT,
  outputConfig: { ...DEFAULT_OUTPUT_CONFIG },
  outputOpen: false,
  uiMode: 'performance',
  transport: { isPlaying: true, timeMs: 0 },
  bpm: {
    source: 'manual',
    range: { min: 80, max: 150 },
    autoBpm: null,
    networkBpm: null,
    networkActive: false,
    manualBpm: 120
  },
  audio: {
    rms: 0,
    peak: 0,
    bands: new Array(8).fill(0),
    spectrum: new Float32Array(64),
    waveform: new Float32Array(256)
  },
  midi: { lastLatencyMs: null },
  pad: {
    states: Array.from({ length: 256 }, () => false),
    activeBank: 0,
    activeMapBank: 0
  },
  modulators: {
    lfoPhases: [],
    envStates: [],
    shStates: []
  },
  runtime: {
    strobeIntensity: 0,
    strobeDecay: 0.92,
    origamiFoldState: 0,
    origamiFoldSharpness: 0.65,
    gravityGlobalPolarity: 1,
    gravityCollapse: 0,
    gravityFixedIndex: 0,
    lastGravityIndex: -1,
    glyphMode: 0,
    glyphSeed: Math.random() * 1000,
    glyphBeatPulse: 0,
    crystalMode: 0,
    crystalBrittleness: 0.4,
    inkBrush: 0,
    inkPressure: 0.6,
    inkLifespan: 0.6,
    topoQuake: 0,
    topoSlide: 0,
    topoPlate: 0,
    topoTravel: 0,
    weatherMode: 0,
    weatherIntensity: 0.6,
    portalShift: 0,
    portalSeed: Math.random() * 1000,
    oscilloMode: 0,
    oscilloFreeze: 0,
    oscilloRotate: 0
  },
  diagnostics: {
    fps: 0,
    frameDropScore: 0,
    lastWatchdogUpdate: 0,
    lastAutosaveAt: 0,
    lastRenderTimeMs: 0,
    lastSummaryUpdate: 0,
    latencyMs: null,
    outputLatencyMs: null
  },
  safeMode: { reasons: [], webglInitError: null },
  debug: { enabled: false, tintLayers: false, fxDelta: false },
  quantizeHudMessage: null,
  pendingSceneSwitch: null,
  renderSettings: {
    assetLayerBlendModes: {
      'layer-plasma': 3,
      'layer-spectrum': 1
    },
    assetLayerAudioReact: {
      'layer-plasma': 0.6,
      'layer-spectrum': 0.8
    }
  }
});

export type StoreListener = (state: AppState) => void;

export interface Store {
  getState: () => AppState;
  update: (updater: (state: AppState) => void, notify?: boolean) => void;
  setState: (patch: Partial<AppState>, notify?: boolean) => void;
  subscribe: (listener: StoreListener) => () => void;
}

export const createStore = (initial: AppState): Store => {
  const state = initial;
  const listeners = new Set<StoreListener>();

  const notify = () => {
    listeners.forEach((listener) => listener(state));
  };

  return {
    getState: () => state,
    update: (updater, notifyState = true) => {
      updater(state);
      if (notifyState) notify();
    },
    setState: (patch, notifyState = true) => {
      Object.assign(state, patch);
      if (notifyState) notify();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
};
