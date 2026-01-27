import type { OutputConfig, VisualSynthProject, LayerConfig } from '../../shared/project';
import type { BpmRange } from '../../shared/bpm';
import type { Store } from './store';

const LAYER_DEFAULTS: Record<string, Omit<LayerConfig, 'id'>> = {
  'layer-origami': {
    name: 'Origami Fold',
    enabled: true,
    opacity: 0.85,
    blendMode: 'screen',
    transform: { x: 0, y: 0, scale: 1, rotation: 0 }
  },
  'layer-glyph': {
    name: 'Glyph Language',
    enabled: true,
    opacity: 0.8,
    blendMode: 'screen',
    transform: { x: 0, y: 0, scale: 1, rotation: 0 }
  },
  'layer-crystal': {
    name: 'Crystal Harmonics',
    enabled: true,
    opacity: 0.85,
    blendMode: 'screen',
    transform: { x: 0, y: 0, scale: 1, rotation: 0 }
  },
  'layer-inkflow': {
    name: 'Ink Flow',
    enabled: true,
    opacity: 0.85,
    blendMode: 'screen',
    transform: { x: 0, y: 0, scale: 1, rotation: 0 }
  },
  'layer-topo': {
    name: 'Topo Terrain',
    enabled: true,
    opacity: 0.85,
    blendMode: 'screen',
    transform: { x: 0, y: 0, scale: 1, rotation: 0 }
  },
  'layer-weather': {
    name: 'Audio Weather',
    enabled: true,
    opacity: 0.85,
    blendMode: 'screen',
    transform: { x: 0, y: 0, scale: 1, rotation: 0 }
  },
  'layer-portal': {
    name: 'Wormhole Portal',
    enabled: true,
    opacity: 0.85,
    blendMode: 'screen',
    transform: { x: 0, y: 0, scale: 1, rotation: 0 }
  },
  'layer-oscillo': {
    name: 'Sacred Oscilloscope',
    enabled: true,
    opacity: 0.85,
    blendMode: 'screen',
    transform: { x: 0, y: 0, scale: 1, rotation: 0 }
  }
};

export const actions = {
  setProject: (store: Store, project: VisualSynthProject) => {
    store.update((state) => {
      state.project = project;
    });
  },
  mutateProject: (store: Store, updater: (project: VisualSynthProject) => void, notify = true) => {
    store.update((state) => {
      updater(state.project);
    }, notify);
  },
  setOutputConfig: (store: Store, config: OutputConfig) => {
    store.update((state) => {
      state.outputConfig = config;
    });
  },
  setOutputOpen: (store: Store, open: boolean) => {
    store.update((state) => {
      state.outputOpen = open;
    });
  },
  setUiMode: (store: Store, mode: 'performance' | 'scene' | 'design' | 'system') => {
    store.update((state) => {
      state.uiMode = mode;
    });
  },
  setTransportPlaying: (store: Store, isPlaying: boolean) => {
    store.update((state) => {
      state.transport.isPlaying = isPlaying;
    }, false);
  },
  setTransportTime: (store: Store, timeMs: number) => {
    store.update((state) => {
      state.transport.timeMs = timeMs;
    }, false);
  },
  setBpmSource: (store: Store, source: 'manual' | 'auto' | 'network') => {
    store.update((state) => {
      state.bpm.source = source;
    });
  },
  setBpmRange: (store: Store, range: BpmRange) => {
    store.update((state) => {
      state.bpm.range = range;
    });
  },
  setManualBpm: (store: Store, bpm: number) => {
    store.update((state) => {
      state.bpm.manualBpm = bpm;
    });
  },
  setAutoBpm: (store: Store, bpm: number | null) => {
    store.update((state) => {
      state.bpm.autoBpm = bpm;
    }, false);
  },
  setNetworkBpm: (store: Store, bpm: number | null) => {
    store.update((state) => {
      state.bpm.networkBpm = bpm;
    }, false);
  },
  setNetworkActive: (store: Store, active: boolean) => {
    store.update((state) => {
      state.bpm.networkActive = active;
    });
  },
  setQuantizeHud: (store: Store, message: string | null) => {
    store.update((state) => {
      state.quantizeHudMessage = message;
    }, false);
  },
  setPendingSceneSwitch: (
    store: Store,
    payload: { targetSceneId: string; scheduledTimeMs: number } | null
  ) => {
    store.update((state) => {
      state.pendingSceneSwitch = payload;
    }, false);
  },
  addSafeModeReason: (store: Store, reason: string) => {
    store.update((state) => {
      if (!state.safeMode.reasons.includes(reason)) {
        state.safeMode.reasons.push(reason);
      }
    });
  },
  setWebglInitError: (store: Store, message: string | null) => {
    store.update((state) => {
      state.safeMode.webglInitError = message;
    });
  },
  setMidiLatency: (store: Store, latencyMs: number | null) => {
    store.update((state) => {
      state.midi.lastLatencyMs = latencyMs;
    }, false);
  },
  ensureLayer: (store: Store, layerId: string) => {
    let ensured: LayerConfig | null = null;
    store.update((state) => {
      const scene = state.project.scenes.find((item) => item.id === state.project.activeSceneId);
      if (!scene) return;
      let layer = scene.layers.find((item) => item.id === layerId);
      if (!layer) {
        const defaults = LAYER_DEFAULTS[layerId];
        if (!defaults) return;
        layer = { id: layerId, ...defaults };
        scene.layers.push(layer);
      } else {
        layer.enabled = true;
      }
      ensured = layer;
    });
    return ensured;
  },
  setLayerEnabled: (store: Store, layerId: string, enabled: boolean) => {
    store.update((state) => {
      const scene = state.project.scenes.find((item) => item.id === state.project.activeSceneId);
      if (!scene) return;
      const layer = scene.layers.find((item) => item.id === layerId);
      if (layer) layer.enabled = enabled;
    });
  },
  setLayerOpacity: (store: Store, layerId: string, opacity: number) => {
    store.update((state) => {
      const scene = state.project.scenes.find((item) => item.id === state.project.activeSceneId);
      if (!scene) return;
      const layer = scene.layers.find((item) => item.id === layerId);
      if (layer) layer.opacity = opacity;
    });
  },
  setAssetBlendMode: (store: Store, layerId: 'layer-plasma' | 'layer-spectrum', mode: number) => {
    store.update((state) => {
      state.renderSettings.assetLayerBlendModes[layerId] = mode;
    }, false);
  },
  setAssetAudioReact: (store: Store, layerId: 'layer-plasma' | 'layer-spectrum', amount: number) => {
    store.update((state) => {
      state.renderSettings.assetLayerAudioReact[layerId] = amount;
    }, false);
  }
};
