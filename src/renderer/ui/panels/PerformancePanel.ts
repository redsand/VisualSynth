import type { Store } from '../../state/store';
import { OUTPUT_BASE_HEIGHT, OUTPUT_BASE_WIDTH } from '../../shared/project';
import { actions } from '../../state/actions';
import { setStatus } from '../../state/events';

export interface PerformancePanelDeps {
  store: Store;
  onPadTrigger: (logicalIndex: number, velocity: number) => void;
  onLayerListChanged: () => void;
  onAddLayerShortcut: () => void;
  onSetOutputEnabled: (enabled: boolean) => Promise<void>;
  onSyncOutputConfig: (patch: Partial<{ enabled: boolean; fullscreen: boolean; scale: number }>) => Promise<void>;
}

export interface PerformancePanelApi {
  initPads: () => void;
  updatePadUI: (localIndex: number, active: boolean) => void;
  refreshPadGridForBank: () => void;
  updatePadBankUI: () => void;
  renderPadMapGrid: () => void;
  syncPerformanceToggles: () => void;
  updateMetrics: () => void;
  updateTransportUI: () => void;
  syncTempoInputs: (value: number) => void;
  refreshOutputUI: () => void;
}

export const createPerformancePanel = ({
  store,
  onPadTrigger,
  onLayerListChanged,
  onAddLayerShortcut,
  onSetOutputEnabled,
  onSyncOutputConfig
}: PerformancePanelDeps): PerformancePanelApi => {
  const padGrid = document.getElementById('pad-grid') as HTMLDivElement;
  const padBank = document.getElementById('pad-bank') as HTMLDivElement;
  const padMapGrid = document.getElementById('pad-map-grid') as HTMLDivElement;
  const padMapBank = document.getElementById('pad-map-bank') as HTMLDivElement;
  const perfToggleSpectrum = document.getElementById('perf-toggle-spectrum') as HTMLInputElement;
  const perfTogglePlasma = document.getElementById('perf-toggle-plasma') as HTMLInputElement;
  const perfAddLayerButton = document.getElementById('perf-add-layer') as HTMLButtonElement;
  const transportTap = document.getElementById('transport-tap') as HTMLButtonElement;
  const transportBpmInput = document.getElementById('transport-bpm') as HTMLInputElement;
  const tempoInput = document.getElementById('tempo-input') as HTMLInputElement;
  const outputRouteSelect = document.getElementById('output-route') as HTMLSelectElement;
  const healthFps = document.getElementById('health-fps') as HTMLSpanElement;
  const healthLatency = document.getElementById('health-latency') as HTMLSpanElement;
  const healthWatchdog = document.getElementById('health-watchdog') as HTMLSpanElement;
  const latencySummary = document.getElementById('latency-summary') as HTMLDivElement;
  const guardrailStatus = document.getElementById('guardrail-status') as HTMLDivElement;
  const guardrailHint = document.getElementById('guardrail-hint') as HTMLDivElement;
  const quantizeHud = document.getElementById('quantize-hud') as HTMLDivElement;
  const outputToggleButton = document.getElementById('output-toggle') as HTMLButtonElement;
  const outputFullscreenToggle = document.getElementById('output-fullscreen') as HTMLInputElement;
  const outputScaleSelect = document.getElementById('output-scale') as HTMLSelectElement;
  const outputResolutionLabel = document.getElementById('output-resolution') as HTMLDivElement;

  const padBanks = ['A', 'B', 'C', 'D'] as const;

  const padActionCycle = [
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
  ] as const;

  const padActionLabels: Record<(typeof padActionCycle)[number], string> = {
    none: '—',
    'toggle-plasma': 'Plasma',
    'toggle-spectrum': 'Spectrum',
    'origami-mountain': 'Origami: Mountain',
    'origami-valley': 'Origami: Valley',
    'origami-collapse': 'Origami: Collapse',
    'origami-explode': 'Origami: Explode',
    'gravity-spawn-fixed': 'Gravity: Spawn Fixed',
    'gravity-spawn-audio': 'Gravity: Spawn Audio',
    'gravity-destroy': 'Gravity: Destroy',
    'gravity-toggle-polarity': 'Gravity: Polarity All',
    'gravity-flip-last': 'Gravity: Flip Last',
    'gravity-collapse': 'Gravity: Collapse',
    'glyph-stack': 'Glyph: Stack',
    'glyph-orbit': 'Glyph: Orbit',
    'glyph-explode': 'Glyph: Explode',
    'glyph-sentence': 'Glyph: Sentence',
    'crystal-seed': 'Crystal: Seed',
    'crystal-grow': 'Crystal: Grow',
    'crystal-fracture': 'Crystal: Fracture',
    'crystal-melt': 'Crystal: Melt',
    'ink-fine': 'Ink: Fine',
    'ink-dry': 'Ink: Dry',
    'ink-neon': 'Ink: Neon',
    'ink-lifespan': 'Ink: Lifespan',
    'ink-pressure': 'Ink: Pressure',
    'topo-quake': 'Topo: Quake',
    'topo-landslide': 'Topo: Landslide',
    'topo-plate': 'Topo: Plate Shift',
    'weather-storm': 'Weather: Storm',
    'weather-fog': 'Weather: Fog',
    'weather-calm': 'Weather: Calm',
    'weather-hurricane': 'Weather: Hurricane',
    'portal-spawn': 'Portal: Spawn',
    'portal-collapse': 'Portal: Collapse',
    'portal-transition': 'Portal: Transition',
    'oscillo-capture': 'Oscillo: Capture',
    'oscillo-freeze': 'Oscillo: Freeze',
    'oscillo-rotate': 'Oscillo: Rotate',
    strobe: 'Strobe',
    'scene-next': 'Scene +',
    'scene-prev': 'Scene -',
    'macro-1': 'Macro 1',
    'macro-2': 'Macro 2',
    'macro-3': 'Macro 3',
    'macro-4': 'Macro 4',
    'macro-5': 'Macro 5',
    'macro-6': 'Macro 6',
    'macro-7': 'Macro 7',
    'macro-8': 'Macro 8'
  };

  const syncTempoInputs = (value: number) => {
    const normalized = Number.isFinite(value) ? value : 120;
    tempoInput.value = String(normalized);
    transportBpmInput.value = String(normalized);
    actions.setManualBpm(store, normalized);
  };

  const updateOutputResolution = () => {
    const scale = store.getState().outputConfig.scale;
    const width = Math.round(OUTPUT_BASE_WIDTH * scale);
    const height = Math.round(OUTPUT_BASE_HEIGHT * scale);
    outputResolutionLabel.textContent = `Output: ${width} x ${height}`;
  };

  const updateOutputUI = () => {
    const { outputConfig, outputOpen } = store.getState();
    outputToggleButton.textContent = outputOpen ? 'Close Output' : 'Open Output';
    outputFullscreenToggle.checked = outputConfig.fullscreen;
    outputScaleSelect.value = String(outputConfig.scale);
    outputRouteSelect.value = outputOpen ? 'output' : 'preview';
    guardrailHint.textContent = `Output scale: ${Math.round(outputConfig.scale * 100)}%`;
    updateOutputResolution();
  };

  const initPads = () => {
    padGrid.innerHTML = '';
    Array.from({ length: 64 }).forEach((_state, index) => {
      const pad = document.createElement('div');
      pad.className = 'pad';
      pad.dataset.index = String(index);
      const label = document.createElement('div');
      label.className = 'pad-label';
      label.textContent = String(index + 1);
      pad.appendChild(label);
      pad.addEventListener('click', () => {
        const logicalIndex = index + store.getState().pad.activeBank * 64;
        onPadTrigger(logicalIndex, 1);
      });
      padGrid.appendChild(pad);
    });
    updatePadBankUI();
    refreshPadGridForBank();
  };

  const updatePadBankUI = () => {
    const buttons = padBank.querySelectorAll<HTMLButtonElement>('button[data-bank]');
    buttons.forEach((button, index) => {
      button.classList.toggle('active', index === store.getState().pad.activeBank);
    });
    padGrid.dataset.bank = padBanks[store.getState().pad.activeBank];
  };

  const refreshPadGridForBank = () => {
    const { states, activeBank } = store.getState().pad;
    for (let index = 0; index < 64; index += 1) {
      const logicalIndex = activeBank * 64 + index;
      updatePadUI(index, states[logicalIndex]);
    }
  };

  const updatePadUI = (localIndex: number, active: boolean) => {
    const pad = padGrid.querySelector(`[data-index="${localIndex}"]`);
    if (pad) {
      pad.classList.toggle('active', active);
    }
  };

  const updatePadMapBankUI = () => {
    const buttons = padMapBank.querySelectorAll<HTMLButtonElement>('button[data-bank]');
    buttons.forEach((button) => {
      button.classList.toggle('active', button.dataset.bank === padBanks[store.getState().pad.activeMapBank]);
    });
  };

  const renderPadMapGrid = () => {
    padMapGrid.innerHTML = '';
    const bankOffset = store.getState().pad.activeMapBank * 64;
    for (let i = 0; i < 64; i += 1) {
      const action = store.getState().project.padMappings[bankOffset + i] ?? 'none';
      const cell = document.createElement('div');
      cell.className = 'pad-map';
      const label = document.createElement('div');
      label.className = 'pad-map-label';
      label.textContent = padActionLabels[action];
      cell.appendChild(label);
      cell.addEventListener('click', () => {
        const current = store.getState().project.padMappings[bankOffset + i] ?? 'none';
        const index = padActionCycle.indexOf(current);
        const next = padActionCycle[(index + 1) % padActionCycle.length];
        store.getState().project.padMappings[bankOffset + i] = next;
        label.textContent = padActionLabels[next];
      });
      padMapGrid.appendChild(cell);
    }
    updatePadMapBankUI();
  };

  const syncPerformanceToggles = () => {
    const scene = store.getState().project.scenes.find((item) => item.id === store.getState().project.activeSceneId);
    if (!scene) return;
    const plasmaLayer = scene.layers.find((layer) => layer.id === 'layer-plasma');
    const spectrumLayer = scene.layers.find((layer) => layer.id === 'layer-spectrum');
    if (plasmaLayer) perfTogglePlasma.checked = plasmaLayer.enabled;
    if (spectrumLayer) perfToggleSpectrum.checked = spectrumLayer.enabled;
  };

  const updateMetrics = () => {
    const state = store.getState();
    const fps = state.diagnostics.fps;
    const latency = state.diagnostics.latencyMs;
    const outputLatency = state.diagnostics.outputLatencyMs;
    const midiLatency = state.midi.lastLatencyMs;
    healthFps.textContent = `FPS: ${fps}`;
    healthLatency.textContent = latency !== null ? `Latency: ${latency}ms` : 'Latency: --';
    if (state.diagnostics.frameDropScore > 0.3) {
      healthWatchdog.textContent = 'Watchdog: Warning';
      guardrailStatus.textContent = 'Guardrails: Active';
    } else {
      healthWatchdog.textContent = 'Watchdog: OK';
      guardrailStatus.textContent = 'Guardrails: OK';
    }
    latencySummary.textContent = `Audio: ${latency === null ? '--' : `${latency}ms`} | Output: ${
      outputLatency === null ? '--' : `${outputLatency}ms`
    } | MIDI: ${midiLatency === null ? '--' : `${Math.round(midiLatency)}ms`}`;
    if (state.quantizeHudMessage) {
      quantizeHud.textContent = state.quantizeHudMessage;
      quantizeHud.classList.remove('hidden');
    } else {
      quantizeHud.classList.add('hidden');
    }
  };

  const updateTransportUI = () => {
    const { isPlaying, timeMs } = store.getState().transport;
  };

  transportTap.addEventListener('click', () => {
    setStatus('Tap tempo (placeholder).');
  });

  transportBpmInput.addEventListener('change', () => {
    syncTempoInputs(Number(transportBpmInput.value));
    setStatus(`Tempo set to ${transportBpmInput.value} BPM`);
  });
  tempoInput.addEventListener('change', () => {
    syncTempoInputs(Number(tempoInput.value));
  });

  outputRouteSelect.addEventListener('change', async () => {
    await onSetOutputEnabled(outputRouteSelect.value === 'output');
    updateOutputUI();
  });
  outputToggleButton.addEventListener('click', async () => {
    await onSetOutputEnabled(!store.getState().outputOpen);
    updateOutputUI();
  });
  outputFullscreenToggle.addEventListener('change', async () => {
    await onSyncOutputConfig({ fullscreen: outputFullscreenToggle.checked });
    updateOutputUI();
  });
  outputScaleSelect.addEventListener('change', async () => {
    await onSyncOutputConfig({ scale: Number(outputScaleSelect.value) });
    updateOutputUI();
  });

  perfToggleSpectrum.addEventListener('change', () => {
    const scene = store.getState().project.scenes.find((item) => item.id === store.getState().project.activeSceneId);
    const spectrumLayer = scene?.layers.find((layer) => layer.id === 'layer-spectrum');
    if (spectrumLayer) {
      spectrumLayer.enabled = perfToggleSpectrum.checked;
      onLayerListChanged();
      setStatus(`Spectrum Bars ${perfToggleSpectrum.checked ? 'enabled' : 'disabled'}`);
    }
  });

  perfTogglePlasma.addEventListener('change', () => {
    const scene = store.getState().project.scenes.find((item) => item.id === store.getState().project.activeSceneId);
    const plasmaLayer = scene?.layers.find((layer) => layer.id === 'layer-plasma');
    if (plasmaLayer) {
      plasmaLayer.enabled = perfTogglePlasma.checked;
      onLayerListChanged();
      setStatus(`Plasma Layer ${perfTogglePlasma.checked ? 'enabled' : 'disabled'}`);
    }
  });

  perfAddLayerButton.addEventListener('click', () => {
    onAddLayerShortcut();
  });

  padBank.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const bank = target.closest<HTMLButtonElement>('button[data-bank]');
    if (!bank) return;
    const index = padBanks.indexOf(bank.dataset.bank as (typeof padBanks)[number]);
    if (index === -1) return;
    store.update((state) => {
      state.pad.activeBank = index;
    });
    updatePadBankUI();
    refreshPadGridForBank();
    setStatus(`Pad bank: ${padBanks[store.getState().pad.activeBank]}`);
  });

  padMapBank?.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const bank = target.closest<HTMLButtonElement>('button[data-bank]');
    if (!bank) return;
    const index = padBanks.indexOf(bank.dataset.bank as (typeof padBanks)[number]);
    if (index === -1) return;
    store.update((state) => {
      state.pad.activeMapBank = index;
    });
    renderPadMapGrid();
  });

  updateOutputUI();

  return {
    initPads,
    updatePadUI,
    refreshPadGridForBank,
    updatePadBankUI,
    renderPadMapGrid,
    syncPerformanceToggles,
    updateMetrics,
    updateTransportUI,
    syncTempoInputs,
    refreshOutputUI: updateOutputUI
  };
};
