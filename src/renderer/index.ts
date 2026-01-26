import {
  DEFAULT_OUTPUT_CONFIG,
  DEFAULT_PROJECT,
  OUTPUT_BASE_HEIGHT,
  OUTPUT_BASE_WIDTH,
  OutputConfig,
  VisualSynthProject,
  LayerConfig,
  AssetItem,
  AssetColorSpace
} from '../shared/project';
import { projectSchema } from '../shared/projectSchema';
import { createGLRenderer, RenderState, resizeCanvasToDisplaySize } from './glRenderer';
import { getBeatsUntil, getNextQuantizedTimeMs, QuantizationUnit } from '../shared/quantization';
import { BpmRange, clampBpmRange, fitBpmToRange } from '../shared/bpm';
import { GENERATORS, GeneratorId, updateRecents, toggleFavorite } from '../shared/generatorLibrary';
import { getMidiChannel, mapPadWithBank, scaleMidiValue } from '../shared/midiMapping';
import { applyModMatrix } from '../shared/modMatrix';
import { reorderLayers } from '../shared/layers';
import { applyExchangePayload, createMacrosExchange, createSceneExchange, ExchangePayload } from '../shared/exchange';
import { pluginManifestSchema } from '../shared/pluginSchema';
import { mergeProjectSections, MergeOptions } from '../shared/projectMerge';
import { toFileUrl } from '../shared/fileUrl';
import { createAssetItem, normalizeAssetTags } from '../shared/assets';
import type { AssetImportResult } from '../shared/assets';

declare global {
  interface Window {
    visualSynth: {
      saveProject: (payload: string) => Promise<{ canceled: boolean; filePath?: string }>;
      autosaveProject: (payload: string) => Promise<{ saved: boolean; filePath?: string }>;
      saveExchange: (
        payload: string,
        defaultName: string
      ) => Promise<{ canceled: boolean; filePath?: string }>;
      openProject: () => Promise<{ canceled: boolean; project?: VisualSynthProject; error?: string }>;
      getRecovery: () => Promise<{ found: boolean; payload?: string; filePath?: string }>;
      openExchange: () => Promise<{ canceled: boolean; payload?: string; filePath?: string }>;
      listPresets: () => Promise<{ name: string; path: string }[]>;
      loadPreset: (presetPath: string) => Promise<{ project?: VisualSynthProject; error?: string }>;
      listTemplates: () => Promise<{ name: string; path: string }[]>;
      loadTemplate: (templatePath: string) => Promise<{ project?: VisualSynthProject; error?: string }>;
      listNodeMidi: () => Promise<{ index: number; name: string }[]>;
      openNodeMidi: (portIndex: number) => Promise<{ opened: boolean; error?: string }>;
      onNodeMidiMessage: (handler: (message: number[]) => void) => void;
      getOutputConfig: () => Promise<OutputConfig>;
      isOutputOpen: () => Promise<boolean>;
      openOutput: (config: OutputConfig) => Promise<{ opened: boolean; config: OutputConfig }>;
      closeOutput: () => Promise<{ closed: boolean; config: OutputConfig }>;
      setOutputConfig: (config: OutputConfig) => Promise<OutputConfig>;
      onOutputClosed: (handler: () => void) => void;
      listNetworkInterfaces: () => Promise<{ name: string; address: string }[]>;
      startNetworkBpm: (
        iface: { name: string; address: string } | null
      ) => Promise<{ started: boolean; message?: string }>;
      stopNetworkBpm: () => Promise<{ stopped: boolean }>;
      onNetworkBpm: (handler: (payload: {
        bpm: number;
        deviceId: number;
        isMaster: boolean;
        isOnAir: boolean;
      }) => void) => void;
      saveCapture: (
        data: Uint8Array,
        defaultName: string,
        format: 'png' | 'webm' | 'mp4'
      ) => Promise<{ canceled: boolean; filePath?: string; error?: string }>;
      transcodeCapture: (
        data: Uint8Array,
        defaultName: string,
        format: 'mp4'
      ) => Promise<{ canceled: boolean; filePath?: string; error?: string }>;
      importAsset: (
        kind: 'texture' | 'shader' | 'video'
      ) => Promise<{ canceled: boolean; filePath?: string }>;
      importPlugin: () => Promise<{ canceled: boolean; filePath?: string; payload?: string }>;
    };
  }
}

const audioSelect = document.getElementById('audio-device') as HTMLSelectElement;
const midiSelect = document.getElementById('midi-device') as HTMLSelectElement;
const toggleMidiButton = document.getElementById('toggle-midi') as HTMLButtonElement;
const saveButton = document.getElementById('btn-save') as HTMLButtonElement;
const loadButton = document.getElementById('btn-load') as HTMLButtonElement;
const presetSelect = document.getElementById('preset-select') as HTMLSelectElement;
const applyPresetButton = document.getElementById('btn-apply-preset') as HTMLButtonElement;
const templateSelect = document.getElementById('template-select') as HTMLSelectElement;
const applyTemplateButton = document.getElementById('btn-apply-template') as HTMLButtonElement;
const layerList = document.getElementById('layer-list') as HTMLDivElement;
let plasmaToggle: HTMLInputElement | null = null;
let spectrumToggle: HTMLInputElement | null = null;
const statusLabel = document.getElementById('status') as HTMLDivElement;
const padGrid = document.getElementById('pad-grid') as HTMLDivElement;
const padBank = document.getElementById('pad-bank') as HTMLDivElement;
const padMapGrid = document.getElementById('pad-map-grid') as HTMLDivElement;
const padMapBank = document.getElementById('pad-map-bank') as HTMLDivElement;
const advancedPanel = document.getElementById('advanced-panel') as HTMLDivElement;
const toggleMode = document.getElementById('toggle-mode') as HTMLButtonElement;
const sceneSelect = document.getElementById('scene-select') as HTMLSelectElement;
const tempoInput = document.getElementById('tempo-input') as HTMLInputElement;
const quantizeSelect = document.getElementById('quantize-select') as HTMLSelectElement;
const queueSceneButton = document.getElementById('queue-scene') as HTMLButtonElement;
const quantizeHud = document.getElementById('quantize-hud') as HTMLDivElement;
const safeModeBanner = document.getElementById('safe-mode-banner') as HTMLDivElement;
const bpmSourceSelect = document.getElementById('bpm-source') as HTMLSelectElement;
const bpmRangeSelect = document.getElementById('bpm-range') as HTMLSelectElement;
const bpmMinInput = document.getElementById('bpm-min') as HTMLInputElement;
const bpmMaxInput = document.getElementById('bpm-max') as HTMLInputElement;
const bpmInterfaceSelect = document.getElementById('bpm-interface') as HTMLSelectElement;
const bpmNetworkToggle = document.getElementById('bpm-network-toggle') as HTMLButtonElement;
const bpmDisplay = document.getElementById('bpm-display') as HTMLDivElement;
const generatorSelect = document.getElementById('generator-select') as HTMLSelectElement;
const generatorAddButton = document.getElementById('generator-add') as HTMLButtonElement;
const generatorFavorites = document.getElementById('generator-favorites') as HTMLDivElement;
const generatorRecents = document.getElementById('generator-recents') as HTMLDivElement;
const styleSelect = document.getElementById('style-select') as HTMLSelectElement;
const styleContrast = document.getElementById('style-contrast') as HTMLInputElement;
const styleSaturation = document.getElementById('style-saturation') as HTMLInputElement;
const styleShift = document.getElementById('style-shift') as HTMLInputElement;
const macroList = document.getElementById('macro-list') as HTMLDivElement;
const effectsEnabled = document.getElementById('effects-enabled') as HTMLInputElement;
const effectBloom = document.getElementById('effect-bloom') as HTMLInputElement;
const effectBlur = document.getElementById('effect-blur') as HTMLInputElement;
const effectChroma = document.getElementById('effect-chroma') as HTMLInputElement;
const effectPosterize = document.getElementById('effect-posterize') as HTMLInputElement;
const effectKaleidoscope = document.getElementById('effect-kaleidoscope') as HTMLInputElement;
const effectFeedback = document.getElementById('effect-feedback') as HTMLInputElement;
const effectPersistence = document.getElementById('effect-persistence') as HTMLInputElement;
const particlesEnabled = document.getElementById('particles-enabled') as HTMLInputElement;
const particlesDensity = document.getElementById('particles-density') as HTMLInputElement;
const particlesSpeed = document.getElementById('particles-speed') as HTMLInputElement;
const particlesSize = document.getElementById('particles-size') as HTMLInputElement;
const particlesGlow = document.getElementById('particles-glow') as HTMLInputElement;
const sdfEnabled = document.getElementById('sdf-enabled') as HTMLInputElement;
const sdfShape = document.getElementById('sdf-shape') as HTMLSelectElement;
const sdfScale = document.getElementById('sdf-scale') as HTMLInputElement;
const sdfRotation = document.getElementById('sdf-rotation') as HTMLInputElement;
const sdfEdge = document.getElementById('sdf-edge') as HTMLInputElement;
const sdfGlow = document.getElementById('sdf-glow') as HTMLInputElement;
const sdfFill = document.getElementById('sdf-fill') as HTMLInputElement;
const modMatrixList = document.getElementById('mod-matrix-list') as HTMLDivElement;
const modMatrixAdd = document.getElementById('mod-matrix-add') as HTMLButtonElement;
const midiMapList = document.getElementById('midi-map-list') as HTMLDivElement;
const midiMapAdd = document.getElementById('midi-map-add') as HTMLButtonElement;
const lfoList = document.getElementById('lfo-list') as HTMLDivElement;
const envList = document.getElementById('env-list') as HTMLDivElement;
const shList = document.getElementById('sh-list') as HTMLDivElement;
const outputToggleButton = document.getElementById('output-toggle') as HTMLButtonElement;
const outputFullscreenToggle = document.getElementById('output-fullscreen') as HTMLInputElement;
const outputScaleSelect = document.getElementById('output-scale') as HTMLSelectElement;
const outputResolutionLabel = document.getElementById('output-resolution') as HTMLDivElement;
const exportSceneButton = document.getElementById('export-scene') as HTMLButtonElement;
const importSceneButton = document.getElementById('import-scene') as HTMLButtonElement;
const exportMacrosButton = document.getElementById('export-macros') as HTMLButtonElement;
const importMacrosButton = document.getElementById('import-macros') as HTMLButtonElement;
const captureScreenshotButton = document.getElementById('capture-screenshot') as HTMLButtonElement;
const captureRecordToggle = document.getElementById('capture-record-toggle') as HTMLButtonElement;
const captureFormatSelect = document.getElementById('capture-format') as HTMLSelectElement;
const captureFpsSelect = document.getElementById('capture-fps') as HTMLSelectElement;
const captureStatus = document.getElementById('capture-status') as HTMLDivElement;
const markerLabelInput = document.getElementById('marker-label') as HTMLInputElement;
const markerAddButton = document.getElementById('marker-add') as HTMLButtonElement;
const markerList = document.getElementById('marker-list') as HTMLDivElement;
const assetImportButton = document.getElementById('asset-import') as HTMLButtonElement;
const assetKindSelect = document.getElementById('asset-kind') as HTMLSelectElement;
const assetColorSpaceSelect = document.getElementById('asset-color-space') as HTMLSelectElement | null;
const assetTextureSamplingSelect = document.getElementById('asset-texture-sampling') as HTMLSelectElement | null;
const assetGenerateMipmapsToggle = document.getElementById('asset-generate-mipmaps') as HTMLInputElement | null;
const assetVideoLoopToggle = document.getElementById('asset-video-loop') as HTMLInputElement | null;
const assetVideoReverseToggle = document.getElementById('asset-video-reverse') as HTMLInputElement | null;
const assetVideoRateInput = document.getElementById('asset-video-rate') as HTMLInputElement | null;
const assetVideoFrameBlendInput = document.getElementById('asset-video-frameblend') as HTMLInputElement | null;
const assetImportVideoButton = document.getElementById('asset-import-video') as HTMLButtonElement | null;
const assetLiveWebcamButton = document.getElementById('asset-live-webcam') as HTMLButtonElement | null;
const assetLiveScreenButton = document.getElementById('asset-live-screen') as HTMLButtonElement | null;
const assetTagsInput = document.getElementById('asset-tags') as HTMLInputElement;
const assetList = document.getElementById('asset-list') as HTMLDivElement;

const livePreviewElements = new Map<string, HTMLVideoElement>();
const liveStreams = new Map<string, MediaStream>();

const stopLiveAssetStream = (assetId: string) => {
  const stream = liveStreams.get(assetId);
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    liveStreams.delete(assetId);
  }
  const video = livePreviewElements.get(assetId);
  if (video) {
    video.pause();
    video.srcObject = null;
    livePreviewElements.delete(assetId);
  }
};

const patchAsset = (assetId: string, updater: (asset: AssetItem) => AssetItem) => {
  currentProject.assets = currentProject.assets.map((asset) =>
    asset.id === assetId ? updater(asset) : asset
  );
  renderAssets();
  renderLayerList();
};
const pluginImportButton = document.getElementById('plugin-import') as HTMLButtonElement;
const pluginList = document.getElementById('plugin-list') as HTMLDivElement;
const diffUseCurrentButton = document.getElementById('diff-use-current') as HTMLButtonElement;
const diffLoadIncomingButton = document.getElementById('diff-load-incoming') as HTMLButtonElement;
const diffApplyButton = document.getElementById('diff-apply') as HTMLButtonElement;
const diffStatus = document.getElementById('diff-status') as HTMLDivElement;
const diffSections = document.getElementById('diff-sections') as HTMLDivElement;

const fpsLabel = document.getElementById('diag-fps') as HTMLDivElement;
const latencyLabel = document.getElementById('diag-latency') as HTMLDivElement;
const outputLatencyLabel = document.getElementById('diag-output-latency') as HTMLDivElement;
const midiLatencyLabel = document.getElementById('diag-midi-latency') as HTMLDivElement;
const watchdogLabel = document.getElementById('diag-watchdog') as HTMLDivElement;

let currentProject: VisualSynthProject = DEFAULT_PROJECT;
let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let mediaStream: MediaStream | null = null;
let midiAccess: MIDIAccess | null = null;
let strobeIntensity = 0;
let strobeDecay = 0.92;
let isAdvanced = true;
let outputConfig: OutputConfig = { ...DEFAULT_OUTPUT_CONFIG };
let outputOpen = false;
const outputChannel = new BroadcastChannel('visualsynth-output');
let lastOutputBroadcast = 0;
let lastMidiLatencyMs: number | null = null;
let pendingSceneSwitch: { targetSceneId: string; scheduledTimeMs: number } | null = null;
let autoBpm: number | null = null;
let networkBpm: number | null = null;
let bpmRange: BpmRange = { min: 80, max: 150 };
let bpmSource: 'manual' | 'auto' | 'network' = 'manual';
let bpmNetworkActive = false;
let lastTempoEstimateTime = 0;
let fluxPrev = 0;
let fluxPrevPrev = 0;
let fluxPrevTime = 0;
let fluxHistory: { time: number; value: number }[] = [];
let onsetTimes: number[] = [];
let spectrumPrev: Float32Array | null = null;
let generatorFavoritesState: GeneratorId[] = [];
let generatorRecentsState: GeneratorId[] = [];
let activeStyleId = '';
let macroInputs: HTMLInputElement[] = [];
let learnTarget: { target: string; label: string } | null = null;
let safeModeReasons: string[] = [];
let frameDropScore = 0;
let lastWatchdogUpdate = 0;
let lastAutosaveAt = 0;
let trailSpectrum = new Float32Array(64);
let lfoPhases: number[] = [];
let envStates: {
  stage: 'idle' | 'attack' | 'decay' | 'sustain' | 'release';
  value: number;
  holdLeft: number;
  triggerArmed: boolean;
}[] = [];
let shState: { timer: number; value: number; target: number }[] = [];
let recordingStream: MediaStream | null = null;
let mediaRecorder: MediaRecorder | null = null;
let recordingChunks: Blob[] = [];
let recordingStartedAt = 0;
let lastRenderTimeMs = 0;
let diffBaseProject: VisualSynthProject | null = null;
let diffIncomingProject: VisualSynthProject | null = null;
let renderer: ReturnType<typeof createGLRenderer>;

const audioState = {
  rms: 0,
  peak: 0,
  bands: new Array(8).fill(0),
  spectrum: new Float32Array(64)
};

const padStates = Array.from({ length: 256 }, () => false);
const padBanks = ['A', 'B', 'C', 'D'] as const;
let activePadBank = 0;
let activePadMapBank = 0;

const padActionCycle = [
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
] as const;

const padActionLabels: Record<(typeof padActionCycle)[number], string> = {
  none: '—',
  'toggle-plasma': 'Plasma',
  'toggle-spectrum': 'Spectrum',
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

const setStatus = (message: string) => {
  statusLabel.textContent = message;
};

const updateSafeModeBanner = () => {
  if (safeModeReasons.length === 0) {
    safeModeBanner.classList.add('hidden');
    return;
  }
  safeModeBanner.textContent = `Safe mode: ${safeModeReasons.join(', ')}`;
  safeModeBanner.classList.remove('hidden');
};

const modSourceOptions = [
  { id: 'audio.rms', label: 'Audio RMS' },
  { id: 'audio.peak', label: 'Audio Peak' },
  { id: 'audio.strobe', label: 'Strobe' },
  { id: 'tempo.bpm', label: 'Tempo BPM' },
  { id: 'lfo-1', label: 'LFO 1' },
  { id: 'lfo-2', label: 'LFO 2' },
  { id: 'env-1', label: 'Env 1' },
  { id: 'env-2', label: 'Env 2' },
  { id: 'sh-1', label: 'S&H 1' },
  { id: 'sh-2', label: 'S&H 2' },
  { id: 'macro-1', label: 'Macro 1' },
  { id: 'macro-2', label: 'Macro 2' },
  { id: 'macro-3', label: 'Macro 3' },
  { id: 'macro-4', label: 'Macro 4' },
  { id: 'macro-5', label: 'Macro 5' },
  { id: 'macro-6', label: 'Macro 6' },
  { id: 'macro-7', label: 'Macro 7' },
  { id: 'macro-8', label: 'Macro 8' }
];

const modTargetOptions = [
  { id: 'layer-plasma.opacity', label: 'Plasma Opacity', min: 0, max: 1 },
  { id: 'layer-spectrum.opacity', label: 'Spectrum Opacity', min: 0, max: 1 },
  { id: 'style.contrast', label: 'Style Contrast', min: 0.6, max: 1.6 },
  { id: 'style.saturation', label: 'Style Saturation', min: 0.6, max: 1.8 },
  { id: 'style.paletteShift', label: 'Palette Shift', min: -0.5, max: 0.5 },
  { id: 'effects.bloom', label: 'Bloom', min: 0, max: 1 },
  { id: 'effects.blur', label: 'Blur', min: 0, max: 1 },
  { id: 'effects.chroma', label: 'Chromatic', min: 0, max: 0.5 },
  { id: 'effects.posterize', label: 'Posterize', min: 0, max: 1 },
  { id: 'effects.kaleidoscope', label: 'Kaleidoscope', min: 0, max: 1 },
  { id: 'effects.feedback', label: 'Feedback', min: 0, max: 1 },
  { id: 'effects.persistence', label: 'Persistence', min: 0, max: 1 },
  { id: 'particles.density', label: 'Particle Density', min: 0, max: 1 },
  { id: 'particles.speed', label: 'Particle Speed', min: 0, max: 1 },
  { id: 'particles.size', label: 'Particle Size', min: 0, max: 1 },
  { id: 'particles.glow', label: 'Particle Glow', min: 0, max: 1 },
  { id: 'sdf.scale', label: 'SDF Scale', min: 0, max: 1 },
  { id: 'sdf.edge', label: 'SDF Edge', min: 0, max: 0.5 },
  { id: 'sdf.glow', label: 'SDF Glow', min: 0, max: 1 },
  { id: 'sdf.rotation', label: 'SDF Rotation', min: -3.14, max: 3.14 },
  { id: 'sdf.fill', label: 'SDF Fill', min: 0, max: 1 }
];

const getTargetDefaults = (targetId: string) =>
  modTargetOptions.find((item) => item.id === targetId) ?? { min: 0, max: 1 };

const midiTargetOptions = [
  { id: 'layer-plasma.enabled', label: 'Plasma Enabled' },
  { id: 'layer-spectrum.enabled', label: 'Spectrum Enabled' },
  { id: 'layer-plasma.opacity', label: 'Plasma Opacity' },
  { id: 'layer-spectrum.opacity', label: 'Spectrum Opacity' },
  { id: 'style.contrast', label: 'Style Contrast' },
  { id: 'style.saturation', label: 'Style Saturation' },
  { id: 'style.paletteShift', label: 'Palette Shift' },
  { id: 'effects.bloom', label: 'Bloom' },
  { id: 'effects.blur', label: 'Blur' },
  { id: 'effects.chroma', label: 'Chromatic' },
  { id: 'effects.posterize', label: 'Posterize' },
  { id: 'effects.kaleidoscope', label: 'Kaleidoscope' },
  { id: 'effects.feedback', label: 'Feedback' },
  { id: 'effects.persistence', label: 'Persistence' },
  { id: 'particles.density', label: 'Particle Density' },
  { id: 'particles.speed', label: 'Particle Speed' },
  { id: 'particles.size', label: 'Particle Size' },
  { id: 'particles.glow', label: 'Particle Glow' },
  { id: 'sdf.scale', label: 'SDF Scale' },
  { id: 'sdf.edge', label: 'SDF Edge' },
  { id: 'sdf.glow', label: 'SDF Glow' },
  { id: 'sdf.rotation', label: 'SDF Rotation' },
  { id: 'sdf.fill', label: 'SDF Fill' },
  { id: 'macro-1', label: 'Macro 1' },
  { id: 'macro-2', label: 'Macro 2' },
  { id: 'macro-3', label: 'Macro 3' },
  { id: 'macro-4', label: 'Macro 4' },
  { id: 'macro-5', label: 'Macro 5' },
  { id: 'macro-6', label: 'Macro 6' },
  { id: 'macro-7', label: 'Macro 7' },
  { id: 'macro-8', label: 'Macro 8' }
];

const normalizeOutputScale = (value: number) => Math.min(1, Math.max(0.25, value));

const updateOutputResolution = () => {
  const width = Math.round(OUTPUT_BASE_WIDTH * outputConfig.scale);
  const height = Math.round(OUTPUT_BASE_HEIGHT * outputConfig.scale);
  outputResolutionLabel.textContent = `Output: ${width} × ${height}`;
};

const updateOutputUI = () => {
  outputToggleButton.textContent = outputOpen ? 'Close Output' : 'Open Output';
  outputFullscreenToggle.checked = outputConfig.fullscreen;
  outputScaleSelect.value = String(outputConfig.scale);
  updateOutputResolution();
};

const refreshSceneSelect = () => {
  sceneSelect.innerHTML = '';
  currentProject.scenes.forEach((scene) => {
    const option = document.createElement('option');
    option.value = scene.id;
    option.textContent = scene.name;
    sceneSelect.appendChild(option);
  });
  sceneSelect.value = currentProject.activeSceneId;
};

const moveLayer = (sceneId: string, layerId: string, direction: -1 | 1) => {
  const scene = currentProject.scenes.find((item) => item.id === sceneId);
  if (!scene) return;
  const index = scene.layers.findIndex((layer) => layer.id === layerId);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= scene.layers.length) return;
  scene.layers = reorderLayers(scene, index, nextIndex);
  renderLayerList();
};

const renderLayerList = () => {
  layerList.innerHTML = '';
  const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
  if (!scene) return;
  scene.layers.forEach((layer, index) => {
    const row = document.createElement('div');
    row.className = 'layer-row';

    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = layer.enabled;
    checkbox.dataset.learnTarget = `${layer.id}.enabled`;
    checkbox.dataset.learnLabel = `${layer.name} Enabled`;
    checkbox.addEventListener('change', () => {
      layer.enabled = checkbox.checked;
      if (layer.id === 'layer-plasma') plasmaToggle = checkbox;
      if (layer.id === 'layer-spectrum') spectrumToggle = checkbox;
      setStatus(`${layer.name} ${checkbox.checked ? 'enabled' : 'disabled'}`);
    });
    const text = document.createElement('span');
    text.textContent = layer.name;
    label.appendChild(checkbox);
    label.appendChild(text);

    const controls = document.createElement('div');
    controls.className = 'layer-controls';
    const upButton = document.createElement('button');
    upButton.textContent = '↑';
    upButton.disabled = index === 0;
    upButton.addEventListener('click', () => moveLayer(scene.id, layer.id, -1));
    const downButton = document.createElement('button');
    downButton.textContent = '↓';
    downButton.disabled = index === scene.layers.length - 1;
    downButton.addEventListener('click', () => moveLayer(scene.id, layer.id, 1));
    controls.appendChild(upButton);
    controls.appendChild(downButton);

    row.appendChild(label);
    row.appendChild(controls);
    const assetControl = document.createElement('div');
    assetControl.className = 'layer-asset-control';
    assetControl.appendChild(buildLayerAssetSelect(layer));

    if (layer.id === 'layer-plasma' || layer.id === 'layer-spectrum') {
      const layerId = layer.id as AssetLayerId;

      const blendLabel = document.createElement('label');
      blendLabel.textContent = 'Blend:';
      blendLabel.className = 'asset-control-label';
      const blendSelect = document.createElement('select');
      blendSelect.className = 'asset-blend-select';
      const blendModes = ['Normal', 'Add', 'Multiply', 'Screen', 'Overlay', 'Difference'];
      blendModes.forEach((mode, i) => {
        const opt = document.createElement('option');
        opt.value = String(i);
        opt.textContent = mode;
        blendSelect.appendChild(opt);
      });
      blendSelect.value = String(assetLayerBlendModes[layerId]);
      blendSelect.addEventListener('change', () => {
        assetLayerBlendModes[layerId] = Number(blendSelect.value);
      });
      assetControl.appendChild(blendLabel);
      assetControl.appendChild(blendSelect);

      const reactLabel = document.createElement('label');
      reactLabel.textContent = 'Audio:';
      reactLabel.className = 'asset-control-label';
      const reactSlider = document.createElement('input');
      reactSlider.type = 'range';
      reactSlider.min = '0';
      reactSlider.max = '1';
      reactSlider.step = '0.05';
      reactSlider.value = String(assetLayerAudioReact[layerId]);
      reactSlider.className = 'asset-audio-react';
      reactSlider.addEventListener('input', () => {
        assetLayerAudioReact[layerId] = Number(reactSlider.value);
      });
      assetControl.appendChild(reactLabel);
      assetControl.appendChild(reactSlider);
    }

    row.appendChild(assetControl);
    layerList.appendChild(row);
    if (layer.id === 'layer-plasma') plasmaToggle = checkbox;
    if (layer.id === 'layer-spectrum') spectrumToggle = checkbox;
    syncLayerAsset(layer);
  });
  initLearnables();
};

const renderModMatrix = () => {
  modMatrixList.innerHTML = '';
  if (currentProject.modMatrix.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'matrix-empty';
    empty.textContent = 'No mod connections yet.';
    modMatrixList.appendChild(empty);
    return;
  }

  currentProject.modMatrix.forEach((connection) => {
    const row = document.createElement('div');
    row.className = 'matrix-row';

    const sourceSelect = document.createElement('select');
    modSourceOptions.forEach((option) => {
      const item = document.createElement('option');
      item.value = option.id;
      item.textContent = option.label;
      sourceSelect.appendChild(item);
    });
    sourceSelect.value = connection.source;
    sourceSelect.addEventListener('change', () => {
      connection.source = sourceSelect.value;
    });

    const targetSelect = document.createElement('select');
    modTargetOptions.forEach((option) => {
      const item = document.createElement('option');
      item.value = option.id;
      item.textContent = option.label;
      targetSelect.appendChild(item);
    });
    targetSelect.value = connection.target;

    const amountInput = document.createElement('input');
    amountInput.type = 'number';
    amountInput.min = '-2';
    amountInput.max = '2';
    amountInput.step = '0.05';
    amountInput.value = String(connection.amount);

    const curveSelect = document.createElement('select');
    ['linear', 'exp', 'log'].forEach((curve) => {
      const option = document.createElement('option');
      option.value = curve;
      option.textContent = curve;
      curveSelect.appendChild(option);
    });
    curveSelect.value = connection.curve;

    const smoothingInput = document.createElement('input');
    smoothingInput.type = 'range';
    smoothingInput.min = '0';
    smoothingInput.max = '1';
    smoothingInput.step = '0.05';
    smoothingInput.value = String(connection.smoothing);

    const bipolarToggle = document.createElement('input');
    bipolarToggle.type = 'checkbox';
    bipolarToggle.checked = connection.bipolar;

    const minInput = document.createElement('input');
    minInput.type = 'number';
    minInput.step = '0.05';
    minInput.value = String(connection.min);

    const maxInput = document.createElement('input');
    maxInput.type = 'number';
    maxInput.step = '0.05';
    maxInput.value = String(connection.max);

    const removeButton = document.createElement('button');
    removeButton.className = 'matrix-remove';
    removeButton.textContent = '✕';
    removeButton.addEventListener('click', () => {
      currentProject.modMatrix = currentProject.modMatrix.filter((item) => item.id !== connection.id);
      renderModMatrix();
      setStatus('Mod connection removed.');
    });

    const updateTargetDefaults = () => {
      const defaults = getTargetDefaults(targetSelect.value);
      connection.target = targetSelect.value;
      connection.min = defaults.min;
      connection.max = defaults.max;
      minInput.value = String(defaults.min);
      maxInput.value = String(defaults.max);
    };

    targetSelect.addEventListener('change', updateTargetDefaults);
    amountInput.addEventListener('change', () => {
      connection.amount = Number(amountInput.value);
    });
    curveSelect.addEventListener('change', () => {
      connection.curve = curveSelect.value as typeof connection.curve;
    });
    smoothingInput.addEventListener('input', () => {
      connection.smoothing = Number(smoothingInput.value);
    });
    bipolarToggle.addEventListener('change', () => {
      connection.bipolar = bipolarToggle.checked;
    });
    minInput.addEventListener('change', () => {
      connection.min = Number(minInput.value);
    });
    maxInput.addEventListener('change', () => {
      connection.max = Number(maxInput.value);
    });

    row.appendChild(sourceSelect);
    row.appendChild(targetSelect);
    row.appendChild(amountInput);
    row.appendChild(curveSelect);
    row.appendChild(smoothingInput);
    row.appendChild(bipolarToggle);
    row.appendChild(minInput);
    row.appendChild(maxInput);
    row.appendChild(removeButton);
    modMatrixList.appendChild(row);
  });
};

const addModConnection = () => {
  const targetId = modTargetOptions[0].id;
  const defaults = getTargetDefaults(targetId);
  currentProject.modMatrix = [
    ...currentProject.modMatrix,
    {
      id: `mod-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      source: modSourceOptions[0].id,
      target: targetId,
      amount: 0.5,
      curve: 'linear',
      smoothing: 0.1,
      bipolar: false,
      min: defaults.min,
      max: defaults.max
    }
  ];
  renderModMatrix();
  setStatus('Mod connection added.');
};

const renderMidiMappings = () => {
  midiMapList.innerHTML = '';
  if (currentProject.midiMappings.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'matrix-empty';
    empty.textContent = 'No mappings yet.';
    midiMapList.appendChild(empty);
    return;
  }

  currentProject.midiMappings.forEach((mapping) => {
    const row = document.createElement('div');
    row.className = 'mapping-row';

    const messageSelect = document.createElement('select');
    ['cc', 'aftertouch', 'pitchbend', 'note'].forEach((type) => {
      const option = document.createElement('option');
      option.value = type;
      option.textContent = type.toUpperCase();
      messageSelect.appendChild(option);
    });
    messageSelect.value = mapping.message;

    const channelInput = document.createElement('input');
    channelInput.type = 'number';
    channelInput.min = '1';
    channelInput.max = '16';
    channelInput.step = '1';
    channelInput.value = String(mapping.channel + 1);

    const controlInput = document.createElement('input');
    controlInput.type = 'number';
    controlInput.min = '0';
    controlInput.max = '127';
    controlInput.step = '1';
    controlInput.value = String(mapping.control);

    const modeSelect = document.createElement('select');
    ['toggle', 'momentary', 'trigger'].forEach((mode) => {
      const option = document.createElement('option');
      option.value = mode;
      option.textContent = mode;
      modeSelect.appendChild(option);
    });
    modeSelect.value = mapping.mode;

    const targetSelect = document.createElement('select');
    midiTargetOptions.forEach((target) => {
      const option = document.createElement('option');
      option.value = target.id;
      option.textContent = target.label;
      targetSelect.appendChild(option);
    });
    targetSelect.value = mapping.target;

    const removeButton = document.createElement('button');
    removeButton.className = 'mapping-remove';
    removeButton.textContent = '✕';
    removeButton.addEventListener('click', () => {
      currentProject.midiMappings = currentProject.midiMappings.filter((item) => item.id !== mapping.id);
      renderMidiMappings();
      setStatus('MIDI mapping removed.');
    });

    messageSelect.addEventListener('change', () => {
      mapping.message = messageSelect.value as typeof mapping.message;
    });
    channelInput.addEventListener('change', () => {
      const channel = Number(channelInput.value);
      mapping.channel = Math.min(Math.max(channel - 1, 0), 15);
    });
    controlInput.addEventListener('change', () => {
      mapping.control = Number(controlInput.value);
    });
    modeSelect.addEventListener('change', () => {
      mapping.mode = modeSelect.value as typeof mapping.mode;
    });
    targetSelect.addEventListener('change', () => {
      mapping.target = targetSelect.value;
    });

    row.appendChild(messageSelect);
    row.appendChild(channelInput);
    row.appendChild(controlInput);
    row.appendChild(modeSelect);
    row.appendChild(targetSelect);
    row.appendChild(removeButton);
    midiMapList.appendChild(row);
  });
};

const addMidiMapping = () => {
  currentProject.midiMappings = [
    ...currentProject.midiMappings,
    {
      id: `map-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      message: 'cc',
      channel: 0,
      control: 1,
      target: midiTargetOptions[0].id,
      mode: 'momentary'
    }
  ];
  renderMidiMappings();
  setStatus('MIDI mapping added.');
};

const formatTimestamp = (timeMs: number) => {
  const totalSeconds = Math.max(0, Math.floor(timeMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const renderMarkers = () => {
  markerList.innerHTML = '';
  if (currentProject.timelineMarkers.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'matrix-empty';
    empty.textContent = 'No markers yet.';
    markerList.appendChild(empty);
    return;
  }
  currentProject.timelineMarkers.forEach((marker) => {
    const row = document.createElement('div');
    row.className = 'marker-row';
    const time = document.createElement('div');
    time.textContent = formatTimestamp(marker.timeMs);
    const label = document.createElement('div');
    label.textContent = marker.label;
    const remove = document.createElement('button');
    remove.textContent = '✕';
    remove.addEventListener('click', () => {
      currentProject.timelineMarkers = currentProject.timelineMarkers.filter(
        (item) => item.id !== marker.id
      );
      renderMarkers();
    });
    row.appendChild(time);
    row.appendChild(label);
    row.appendChild(remove);
    markerList.appendChild(row);
  });
};

const addMarker = () => {
  const label = markerLabelInput.value.trim() || `Marker ${currentProject.timelineMarkers.length + 1}`;
  currentProject.timelineMarkers = [
    ...currentProject.timelineMarkers,
    {
      id: `marker-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timeMs: lastRenderTimeMs,
      label
    }
  ];
  markerLabelInput.value = '';
  renderMarkers();
};

const buildAssetMetaParts = (asset: AssetItem) => {
  const parts: string[] = [];
  if (asset.width && asset.height) {
    parts.push(`${asset.width} × ${asset.height}`);
  }
  if (asset.colorSpace) {
    parts.push(asset.colorSpace.toUpperCase());
  }
  if (asset.mime) {
    parts.push(asset.mime);
  }
  if (asset.options?.liveSource) {
    parts.push(`Live: ${asset.options.liveSource}`);
  }
  if (asset.options?.duration) {
    parts.push(`${asset.options.duration.toFixed(1)}s`);
  }
  return parts;
};

const configurePreviewVideo = (video: HTMLVideoElement, asset: AssetItem, isLive = false) => {
  video.className = 'asset-preview-video';
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.autoplay = true;
  video.controls = false;
  if (!isLive && asset.path) {
    video.src = toFileUrl(asset.path);
  }
  video.addEventListener(
    'canplay',
    () => {
      void video.play().catch(() => undefined);
    },
    { once: true }
  );
};

const createAssetPreviewElement = (asset: AssetItem) => {
  const preview = document.createElement('div');
  preview.className = 'asset-preview';
  if (asset.kind === 'texture') {
    const previewUrl = asset.thumbnail ?? (asset.path ? toFileUrl(asset.path) : undefined);
    if (previewUrl) {
      preview.style.backgroundImage = `url(${previewUrl})`;
      return preview;
    }
  }
  if (asset.kind === 'video') {
    const liveVideo = livePreviewElements.get(asset.id);
    if (liveVideo) {
      preview.appendChild(liveVideo);
      return preview;
    }
    const video = document.createElement('video');
    configurePreviewVideo(video, asset);
    preview.appendChild(video);
    return preview;
  }
  preview.textContent = '—';
  return preview;
};

const updateAssetOptions = (assetId: string, patch: Partial<AssetItem['options']>) => {
  patchAsset(assetId, (asset) => ({
    ...asset,
    options: {
      ...asset.options,
      ...patch
    }
  }));
  refreshLayersForAsset(assetId);
};

const createMetadataPanel = (asset: AssetItem) => {
  const panel = document.createElement('div');
  panel.className = 'asset-metadata-panel';

  const makeField = (labelText: string, control: HTMLElement) => {
    const row = document.createElement('div');
    row.className = 'asset-metadata-row';
    const label = document.createElement('span');
    label.textContent = labelText;
    row.appendChild(label);
    row.appendChild(control);
    return row;
  };

  const tagsInput = document.createElement('input');
  tagsInput.type = 'text';
  tagsInput.value = asset.tags.join(', ');
  tagsInput.addEventListener('change', () => {
    const tags = normalizeAssetTags(tagsInput.value);
    patchAsset(asset.id, (existing) => ({ ...existing, tags }));
    tagsInput.value = tags.join(', ');
  });
  panel.appendChild(makeField('Tags', tagsInput));

  const colorSpaceSelect = document.createElement('select');
  ['srgb', 'linear'].forEach((space) => {
    const option = document.createElement('option');
    option.value = space;
    option.textContent = space.toUpperCase();
    if (asset.colorSpace === space) option.selected = true;
    colorSpaceSelect.appendChild(option);
  });
  colorSpaceSelect.addEventListener('change', () => {
    patchAsset(asset.id, (existing) => ({
      ...existing,
      colorSpace: colorSpaceSelect.value as AssetColorSpace
    }));
  });
  panel.appendChild(makeField('Color Space', colorSpaceSelect));

  const samplingSelect = document.createElement('select');
  ['linear', 'nearest'].forEach((sampling) => {
    const option = document.createElement('option');
    option.value = sampling;
    option.textContent = sampling;
    if (asset.options?.textureSampling === sampling) option.selected = true;
    samplingSelect.appendChild(option);
  });
  samplingSelect.addEventListener('change', () => {
    updateAssetOptions(asset.id, { textureSampling: samplingSelect.value as AssetTextureSampling });
  });
  panel.appendChild(makeField('Sampling', samplingSelect));

  const mipmapsToggle = document.createElement('input');
  mipmapsToggle.type = 'checkbox';
  mipmapsToggle.checked = Boolean(asset.options?.generateMipmaps);
  mipmapsToggle.addEventListener('change', () => {
    updateAssetOptions(asset.id, { generateMipmaps: mipmapsToggle.checked });
  });
  panel.appendChild(makeField('Mipmaps', mipmapsToggle));

  if (asset.kind === 'video') {
    const loopToggle = document.createElement('input');
    loopToggle.type = 'checkbox';
    loopToggle.checked = Boolean(asset.options?.loop);
    loopToggle.addEventListener('change', () => updateAssetOptions(asset.id, { loop: loopToggle.checked }));
    panel.appendChild(makeField('Loop', loopToggle));

    const reverseToggle = document.createElement('input');
    reverseToggle.type = 'checkbox';
    reverseToggle.checked = Boolean(asset.options?.reverse);
    reverseToggle.addEventListener('change', () => updateAssetOptions(asset.id, { reverse: reverseToggle.checked }));
    panel.appendChild(makeField('Reverse', reverseToggle));

    const rateInput = document.createElement('input');
    rateInput.type = 'number';
    rateInput.min = '0.1';
    rateInput.max = '4';
    rateInput.step = '0.1';
    rateInput.value = (asset.options?.playbackRate ?? 1).toString();
    rateInput.addEventListener('change', () => {
      const value = Number(rateInput.value) || 1;
      updateAssetOptions(asset.id, { playbackRate: value });
    });
    panel.appendChild(makeField('Rate', rateInput));

    const blendInput = document.createElement('input');
    blendInput.type = 'range';
    blendInput.min = '0';
    blendInput.max = '1';
    blendInput.step = '0.1';
    blendInput.value = (asset.options?.frameBlend ?? 0).toString();
    blendInput.addEventListener('change', () => {
      const value = Number(blendInput.value) || 0;
      updateAssetOptions(asset.id, { frameBlend: value });
    });
    panel.appendChild(makeField('Blend', blendInput));
  }

  const details = document.createElement('div');
  details.className = 'asset-meta-details';
  const metaParts = buildAssetMetaParts(asset);
  details.textContent = metaParts.length > 0 ? metaParts.join(' • ') : 'No metadata';
  panel.appendChild(details);

  return panel;
};

const renderAssets = () => {
  assetList.innerHTML = '';
  if (currentProject.assets.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'matrix-empty';
    empty.textContent = 'No assets yet.';
    assetList.appendChild(empty);
    return;
  }
  currentProject.assets.forEach((asset) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'asset-row-wrapper';

    const row = document.createElement('div');
    row.className = 'asset-row';
    const preview = createAssetPreviewElement(asset);
    const kind = document.createElement('div');
    kind.className = 'asset-kind';
    kind.textContent = asset.kind;
    const info = document.createElement('div');
    info.className = 'asset-info';
    const name = document.createElement('div');
    name.className = 'asset-name';
    name.textContent = asset.name;
    info.appendChild(name);
    const metaParts = buildAssetMetaParts(asset);
    if (metaParts.length > 0) {
      const meta = document.createElement('div');
      meta.className = 'asset-meta';
      meta.textContent = metaParts.join(' • ');
      info.appendChild(meta);
    }
    const tags = document.createElement('div');
    tags.className = 'asset-tags';
    tags.textContent = asset.tags.length === 0 ? '—' : asset.tags.join(', ');
    const actions = document.createElement('div');
    actions.className = 'asset-actions';
    if (asset.options?.liveSource) {
      const liveBadge = document.createElement('span');
      liveBadge.className = 'asset-live-badge';
      liveBadge.textContent = asset.options.liveSource.toUpperCase();
      actions.appendChild(liveBadge);
    }
    const remove = document.createElement('button');
    remove.textContent = '✕';
    remove.addEventListener('click', () => {
      stopLiveAssetStream(asset.id);
      unassignAssetFromLayers(asset.id);
      currentProject.assets = currentProject.assets.filter((item) => item.id !== asset.id);
      renderAssets();
      renderLayerList();
      setStatus(`Asset removed: ${asset.name}`);
    });
    actions.appendChild(remove);

    row.appendChild(preview);
    row.appendChild(info);
    row.appendChild(tags);
    row.appendChild(actions);

    wrapper.appendChild(row);
    wrapper.appendChild(createMetadataPanel(asset));
    assetList.appendChild(wrapper);
  });
};

const ASSET_LAYER_IDS = ['layer-plasma', 'layer-spectrum'] as const;
type AssetLayerId = (typeof ASSET_LAYER_IDS)[number];

const assetLayerBlendModes: Record<AssetLayerId, number> = {
  'layer-plasma': 3,
  'layer-spectrum': 1
};
const assetLayerAudioReact: Record<AssetLayerId, number> = {
  'layer-plasma': 0.6,
  'layer-spectrum': 0.8
};
const getAssetBlendModeValue = (layerId: AssetLayerId): number =>
  assetLayerBlendModes[layerId] ?? 0;
const getAssetAudioReactValue = (layerId: AssetLayerId): number =>
  assetLayerAudioReact[layerId] ?? 0.5;

const formatAssetLabel = (asset: AssetItem) => `${asset.name} (${asset.kind})`;

const isAssetLayerId = (value: string): value is AssetLayerId =>
  (ASSET_LAYER_IDS as readonly string[]).includes(value);

const assignAssetToLayer = async (layer: LayerConfig, assetId: string | null, forceRefresh = false) => {
  if (!forceRefresh && layer.assetId === assetId) return;
  layer.assetId = assetId ?? undefined;
  const target = assetId ? currentProject.assets.find((item) => item.id === assetId) ?? null : null;
  if (!isAssetLayerId(layer.id)) {
    setStatus(`${layer.name} does not support texture overrides yet`);
    return;
  }
  try {
    const previewVideo = target ? livePreviewElements.get(target.id) : undefined;
    await renderer.setLayerAsset(layer.id, target, previewVideo);
    if (target) {
      setStatus(`${layer.name} now using ${target.name}`);
    } else {
      setStatus(`${layer.name} asset cleared`);
    }
  } catch {
    setStatus(`Failed to bind asset to ${layer.name}`);
  }
};

const syncLayerAsset = (layer: LayerConfig) => {
  void assignAssetToLayer(layer, layer.assetId ?? null);
};

const refreshLayersForAsset = (assetId: string) => {
  currentProject.scenes.forEach((scene) => {
    scene.layers.forEach((layer) => {
      if (layer.assetId === assetId) {
        void assignAssetToLayer(layer, assetId, true);
      }
    });
  });
};

const buildLayerAssetSelect = (layer: LayerConfig) => {
  const select = document.createElement('select');
  select.className = 'layer-asset-select';
  const noneOption = document.createElement('option');
  noneOption.value = '';
  noneOption.textContent = 'None';
  select.appendChild(noneOption);
  currentProject.assets.forEach((asset) => {
    const option = document.createElement('option');
    option.value = asset.id;
    option.textContent = formatAssetLabel(asset);
    select.appendChild(option);
  });
  select.value = layer.assetId ?? '';
  select.addEventListener('change', () => {
    void assignAssetToLayer(layer, select.value || null);
  });
  return select;
};

const unassignAssetFromLayers = (assetId: string) => {
  currentProject.scenes.forEach((scene) => {
    let removed = false;
    scene.layers.forEach((layer) => {
      if (layer.assetId === assetId) {
        layer.assetId = undefined;
        void renderer.setLayerAsset(layer.id as AssetLayerId, null);
        removed = true;
      }
    });
    if (removed) {
      setStatus(`Asset unassigned from ${scene.name}`);
    }
  });
};

const loadVideoMetadata = (filePath: string) =>
  new Promise<{ width?: number; height?: number; duration?: number }>((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    const cleanup = () => {
      video.src = '';
      void video.load();
    };
    const report = () => {
      cleanup();
      const duration = Number.isFinite(video.duration) ? video.duration : undefined;
      resolve({
        width: video.videoWidth || undefined,
        height: video.videoHeight || undefined,
        duration
      });
    };
    video.addEventListener('loadedmetadata', report, { once: true });
    video.addEventListener('error', () => resolve({}), { once: true });
    video.src = toFileUrl(filePath);
    void video.load();
  });

const buildTextureOptions = (): AssetItem['options'] | undefined => {
  const opts: AssetItem['options'] = {};
  const sampling = assetTextureSamplingSelect?.value as AssetTextureSampling | undefined;
  if (sampling) {
    opts.textureSampling = sampling;
  }
  if (assetGenerateMipmapsToggle?.checked) {
    opts.generateMipmaps = true;
  }
  return Object.keys(opts).length > 0 ? opts : undefined;
};

const buildVideoOptions = (): AssetItem['options'] => {
  const opts: AssetItem['options'] = {};
  if (assetVideoLoopToggle?.checked) {
    opts.loop = true;
  }
  if (assetVideoReverseToggle?.checked) {
    opts.reverse = true;
  }
  const rate = Number(assetVideoRateInput?.value ?? 1);
  if (!Number.isNaN(rate)) {
    opts.playbackRate = rate;
  }
  const blend = Number(assetVideoFrameBlendInput?.value ?? 0);
  if (!Number.isNaN(blend) && blend > 0) {
    opts.frameBlend = blend;
  }
  return opts;
};

const importAsset = async () => {
  const kind = assetKindSelect.value as 'texture' | 'shader';
  const result = await window.visualSynth.importAsset(kind);
  if (result.canceled || !result.filePath) return;
  const name = result.filePath.split(/[\\/]/).pop() ?? 'Asset';
  const tags = normalizeAssetTags(assetTagsInput.value);
  const metadata = {
    hash: result.hash,
    mime: result.mime,
    width: result.width,
    height: result.height,
    colorSpace: (assetColorSpaceSelect?.value as AssetColorSpace) ?? result.colorSpace
  };
  currentProject.assets = [
    ...currentProject.assets,
    createAssetItem({
      name,
      kind,
      path: result.filePath,
      tags,
      metadata,
      options: buildTextureOptions()
    })
  ];
  assetTagsInput.value = '';
  renderAssets();
  renderLayerList();
  setStatus(`Asset imported: ${name}`);
};

const importVideoAsset = async () => {
  const result = await window.visualSynth.importAsset('video');
  if (result.canceled || !result.filePath) return;
  const name = result.filePath.split(/[\\/]/).pop() ?? 'Video Asset';
  const tags = normalizeAssetTags(assetTagsInput.value);
  const videoMeta = await loadVideoMetadata(result.filePath);
  const metadata = {
    hash: result.hash,
    mime: result.mime,
    width: result.width ?? videoMeta.width,
    height: result.height ?? videoMeta.height,
    colorSpace: result.colorSpace
  };
  const options = buildVideoOptions();
  if (videoMeta.duration) {
    options.duration = videoMeta.duration;
  }
  currentProject.assets = [
    ...currentProject.assets,
    createAssetItem({
      name,
      kind: 'video',
      path: result.filePath,
      tags,
      metadata,
      options
    })
  ];
  assetTagsInput.value = '';
  renderAssets();
  renderLayerList();
  setStatus(`Video imported: ${name}`);
};

const renderPlugins = () => {
  pluginList.innerHTML = '';
  if (currentProject.plugins.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'matrix-empty';
    empty.textContent = 'No plugins yet.';
    pluginList.appendChild(empty);
    return;
  }
  currentProject.plugins.forEach((plugin) => {
    const row = document.createElement('div');
    row.className = 'plugin-row';
    const kind = document.createElement('div');
    kind.textContent = plugin.kind;
    const name = document.createElement('div');
    name.textContent = `${plugin.name} ${plugin.version}`;
    const author = document.createElement('div');
    author.textContent = plugin.author;
    const toggle = document.createElement('button');
    toggle.textContent = plugin.enabled ? 'Disable' : 'Enable';
    toggle.addEventListener('click', () => {
      plugin.enabled = !plugin.enabled;
      toggle.textContent = plugin.enabled ? 'Disable' : 'Enable';
    });
    const remove = document.createElement('button');
    remove.textContent = '✕';
    remove.addEventListener('click', () => {
      currentProject.plugins = currentProject.plugins.filter((item) => item.id !== plugin.id);
      renderPlugins();
    });
    row.appendChild(kind);
    row.appendChild(name);
    row.appendChild(author);
    row.appendChild(toggle);
    row.appendChild(remove);
    pluginList.appendChild(row);
  });
};

const importPlugin = async () => {
  const result = await window.visualSynth.importPlugin();
  if (result.canceled || !result.payload) return;
  try {
    const parsed = pluginManifestSchema.safeParse(JSON.parse(result.payload));
    if (!parsed.success) {
      setStatus('Plugin manifest invalid.');
      return;
    }
    const manifest = parsed.data;
    currentProject.plugins = [
      ...currentProject.plugins,
      {
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        author: manifest.author,
        kind: manifest.kind,
        entry: manifest.entry,
        enabled: true,
        addedAt: new Date().toISOString()
      }
    ];
    renderPlugins();
    setStatus(`Plugin added: ${manifest.name}`);
  } catch {
    setStatus('Failed to import plugin.');
  }
};

const diffSectionConfig = [
  { key: 'metadata', label: 'Project Info', get: (p: VisualSynthProject) => ({ name: p.name, createdAt: p.createdAt }) },
  { key: 'output', label: 'Output', get: (p: VisualSynthProject) => p.output },
  { key: 'stylePresets', label: 'Style Presets', get: (p: VisualSynthProject) => p.stylePresets },
  { key: 'macros', label: 'Macros', get: (p: VisualSynthProject) => p.macros },
  { key: 'effects', label: 'Effects', get: (p: VisualSynthProject) => p.effects },
  { key: 'particles', label: 'Particles', get: (p: VisualSynthProject) => p.particles },
  { key: 'sdf', label: 'SDF', get: (p: VisualSynthProject) => p.sdf },
  { key: 'lfos', label: 'LFOs', get: (p: VisualSynthProject) => p.lfos },
  { key: 'envelopes', label: 'Envelopes', get: (p: VisualSynthProject) => p.envelopes },
  { key: 'sampleHold', label: 'Sample & Hold', get: (p: VisualSynthProject) => p.sampleHold },
  { key: 'scenes', label: 'Scenes', get: (p: VisualSynthProject) => p.scenes },
  { key: 'modMatrix', label: 'Mod Matrix', get: (p: VisualSynthProject) => p.modMatrix },
  { key: 'midiMappings', label: 'MIDI Mappings', get: (p: VisualSynthProject) => p.midiMappings },
  { key: 'padMappings', label: 'Pad Mappings', get: (p: VisualSynthProject) => p.padMappings },
  { key: 'timelineMarkers', label: 'Timeline Markers', get: (p: VisualSynthProject) => p.timelineMarkers },
  { key: 'assets', label: 'Assets', get: (p: VisualSynthProject) => p.assets },
  { key: 'plugins', label: 'Plugins', get: (p: VisualSynthProject) => p.plugins }
];

const serializeSection = (value: unknown) => JSON.stringify(value ?? null);

const renderDiffSections = () => {
  diffSections.innerHTML = '';
  if (!diffIncomingProject) {
    diffStatus.textContent = 'No incoming project loaded.';
    return;
  }
  const base = diffBaseProject ?? currentProject;
  diffStatus.textContent = `Incoming loaded: ${diffIncomingProject.name}`;
  diffSectionConfig.forEach((section) => {
    const row = document.createElement('div');
    row.className = 'diff-row';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.diffKey = section.key;
    const baseValue = serializeSection(section.get(base));
    const incomingValue = serializeSection(section.get(diffIncomingProject));
    const changed = baseValue !== incomingValue;
    checkbox.checked = changed;
    const label = document.createElement('span');
    label.textContent = section.label;
    const flag = document.createElement('span');
    flag.className = 'diff-flag';
    flag.textContent = changed ? 'changed' : 'same';
    row.appendChild(checkbox);
    row.appendChild(label);
    row.appendChild(flag);
    diffSections.appendChild(row);
  });
};

const getMergeOptions = (): MergeOptions => {
  const inputs = diffSections.querySelectorAll<HTMLInputElement>('input[data-diff-key]');
  const selections = new Set<string>();
  inputs.forEach((input) => {
    if (input.checked) selections.add(input.dataset.diffKey ?? '');
  });
  return {
    metadata: selections.has('metadata'),
    output: selections.has('output'),
    stylePresets: selections.has('stylePresets'),
    macros: selections.has('macros'),
    effects: selections.has('effects'),
    particles: selections.has('particles'),
    sdf: selections.has('sdf'),
    lfos: selections.has('lfos'),
    envelopes: selections.has('envelopes'),
    sampleHold: selections.has('sampleHold'),
    scenes: selections.has('scenes'),
    modMatrix: selections.has('modMatrix'),
    midiMappings: selections.has('midiMappings'),
    padMappings: selections.has('padMappings'),
    timelineMarkers: selections.has('timelineMarkers'),
    assets: selections.has('assets'),
    plugins: selections.has('plugins')
  };
};

const applyDiffMerge = async () => {
  if (!diffIncomingProject) return;
  const merged = mergeProjectSections(currentProject, diffIncomingProject, getMergeOptions());
  await applyProject(merged);
  setStatus('Merge applied.');
};

const setCaptureStatus = (message: string) => {
  captureStatus.textContent = message;
};

const getRecorderOptions = () => {
  const candidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm'
  ];
  const mimeType = candidates.find((type) => MediaRecorder.isTypeSupported(type));
  return mimeType ? { mimeType } : undefined;
};

const startRecording = () => {
  if (mediaRecorder) return;
  const fps = Number(captureFpsSelect.value) || 30;
  recordingStream = canvas.captureStream(fps);
  const options = getRecorderOptions();
  mediaRecorder = new MediaRecorder(recordingStream, options);
  recordingChunks = [];
  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) recordingChunks.push(event.data);
  };
  mediaRecorder.onstop = async () => {
    const blob = new Blob(recordingChunks, { type: 'video/webm' });
    const buffer = new Uint8Array(await blob.arrayBuffer());
    const format = captureFormatSelect.value as 'webm' | 'mp4';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultName = `visualsynth-recording-${timestamp}.${format}`;
    if (format === 'mp4') {
      const result = await window.visualSynth.transcodeCapture(buffer, defaultName, 'mp4');
      if (result.error) {
        setCaptureStatus(`FFmpeg failed: ${result.error}. Saved WebM instead.`);
        await window.visualSynth.saveCapture(
          buffer,
          `visualsynth-recording-${timestamp}.webm`,
          'webm'
        );
      } else if (!result.canceled) {
        setCaptureStatus('Recording saved.');
      }
    } else {
      const result = await window.visualSynth.saveCapture(buffer, defaultName, 'webm');
      if (!result.canceled) setCaptureStatus('Recording saved.');
    }
    recordingChunks = [];
  };
  mediaRecorder.start();
  recordingStartedAt = performance.now();
  captureRecordToggle.textContent = 'Stop Recording';
  setCaptureStatus('Recording...');
};

const stopRecording = () => {
  if (!mediaRecorder) return;
  mediaRecorder.stop();
  recordingStream?.getTracks().forEach((track) => track.stop());
  recordingStream = null;
  mediaRecorder = null;
  captureRecordToggle.textContent = 'Start Recording';
};

const toggleRecording = () => {
  if (mediaRecorder) {
    stopRecording();
  } else {
    startRecording();
  }
};

const takeScreenshot = async () => {
  setCaptureStatus('Capturing screenshot...');
  canvas.toBlob(async (blob) => {
    if (!blob) {
      setCaptureStatus('Screenshot failed.');
      return;
    }
    const buffer = new Uint8Array(await blob.arrayBuffer());
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultName = `visualsynth-screenshot-${timestamp}.png`;
    const result = await window.visualSynth.saveCapture(buffer, defaultName, 'png');
    if (!result.canceled) {
      setCaptureStatus('Screenshot saved.');
    }
  }, 'image/png');
};

const initModulators = () => {
  lfoPhases = currentProject.lfos.map((lfo) => lfo.phase ?? 0);
  envStates = currentProject.envelopes.map(() => ({
    stage: 'idle',
    value: 0,
    holdLeft: 0,
    triggerArmed: true
  }));
  shState = currentProject.sampleHold.map(() => ({
    timer: 0,
    value: Math.random(),
    target: Math.random()
  }));
};

const lfoValueForShape = (phase: number, shape: 'sine' | 'triangle' | 'saw' | 'square') => {
  const wrapped = phase % 1;
  if (shape === 'sine') {
    return 0.5 + 0.5 * Math.sin(wrapped * Math.PI * 2);
  }
  if (shape === 'triangle') {
    return wrapped < 0.5 ? wrapped * 2 : 1 - (wrapped - 0.5) * 2;
  }
  if (shape === 'square') {
    return wrapped < 0.5 ? 1 : 0;
  }
  return wrapped;
};

const updateEnvelopes = (dt: number) => {
  currentProject.envelopes.forEach((env, index) => {
    const state = envStates[index];
    if (!state) return;

    const triggerValue =
      env.trigger === 'audio.peak'
        ? audioState.peak
        : env.trigger === 'strobe'
          ? strobeIntensity
          : 0;
    if (env.trigger !== 'manual') {
      if (triggerValue >= env.threshold && state.triggerArmed) {
        state.stage = 'attack';
        state.value = 0;
        state.holdLeft = env.hold;
        state.triggerArmed = false;
      }
      if (triggerValue < env.threshold * 0.6) {
        state.triggerArmed = true;
      }
    }

    const attack = Math.max(env.attack, 0.001);
    const decay = Math.max(env.decay, 0.001);
    const release = Math.max(env.release, 0.001);

    if (state.stage === 'attack') {
      state.value += dt / attack;
      if (state.value >= 1) {
        state.value = 1;
        state.stage = 'decay';
      }
      return;
    }
    if (state.stage === 'decay') {
      state.value -= dt * (1 - env.sustain) / decay;
      if (state.value <= env.sustain) {
        state.value = env.sustain;
        state.stage = 'sustain';
      }
      return;
    }
    if (state.stage === 'sustain') {
      if (state.holdLeft > 0) {
        state.holdLeft -= dt;
      } else {
        state.stage = 'release';
      }
      return;
    }
    if (state.stage === 'release') {
      state.value -= dt * env.sustain / release;
      if (state.value <= 0) {
        state.value = 0;
        state.stage = 'idle';
      }
    }
  });
};

const updateSampleHold = (dt: number, bpm: number) => {
  currentProject.sampleHold.forEach((sh, index) => {
    const state = shState[index];
    if (!state) return;
    const rateHz = sh.sync ? Math.max(bpm / 60 / Math.max(sh.rate, 0.05), 0.1) : Math.max(sh.rate, 0.05);
    const interval = 1 / rateHz;
    state.timer += dt;
    if (state.timer >= interval) {
      state.timer = 0;
      state.target = Math.random();
    }
    const smoothing = Math.min(Math.max(sh.smooth, 0), 1);
    state.value += (state.target - state.value) * (1 - Math.exp(-dt * (2 + smoothing * 8)));
  });
};

const updateLfos = (dt: number, bpm: number) => {
  currentProject.lfos.forEach((lfo, index) => {
    const rateHz = lfo.sync ? Math.max(bpm / 60 / Math.max(lfo.rate, 0.05), 0.1) : Math.max(lfo.rate, 0.05);
    lfoPhases[index] = (lfoPhases[index] + dt * rateHz) % 1;
  });
};

const renderLfoList = () => {
  lfoList.innerHTML = '';
  currentProject.lfos.forEach((lfo, index) => {
    const row = document.createElement('div');
    row.className = 'mod-row';
    const label = document.createElement('div');
    label.textContent = lfo.name;

    const shapeSelect = document.createElement('select');
    ['sine', 'triangle', 'saw', 'square'].forEach((shape) => {
      const option = document.createElement('option');
      option.value = shape;
      option.textContent = shape;
      shapeSelect.appendChild(option);
    });
    shapeSelect.value = lfo.shape;

    const rateInput = document.createElement('input');
    rateInput.type = 'number';
    rateInput.step = '0.05';
    rateInput.min = '0.05';
    rateInput.max = '8';
    rateInput.value = String(lfo.rate);

    const syncToggle = document.createElement('input');
    syncToggle.type = 'checkbox';
    syncToggle.checked = lfo.sync;

    const phaseInput = document.createElement('input');
    phaseInput.type = 'number';
    phaseInput.step = '0.05';
    phaseInput.min = '0';
    phaseInput.max = '1';
    phaseInput.value = String(lfo.phase);

    shapeSelect.addEventListener('change', () => {
      lfo.shape = shapeSelect.value as typeof lfo.shape;
    });
    rateInput.addEventListener('change', () => {
      lfo.rate = Number(rateInput.value);
    });
    syncToggle.addEventListener('change', () => {
      lfo.sync = syncToggle.checked;
    });
    phaseInput.addEventListener('change', () => {
      lfo.phase = Number(phaseInput.value);
      lfoPhases[index] = lfo.phase;
    });

    row.appendChild(label);
    row.appendChild(shapeSelect);
    row.appendChild(rateInput);
    row.appendChild(syncToggle);
    row.appendChild(phaseInput);
    lfoList.appendChild(row);
  });
};

const renderEnvelopeList = () => {
  envList.innerHTML = '';
  currentProject.envelopes.forEach((env, index) => {
    const row = document.createElement('div');
    row.className = 'mod-row';
    const label = document.createElement('div');
    label.textContent = env.name;

    const attackInput = document.createElement('input');
    attackInput.type = 'number';
    attackInput.step = '0.01';
    attackInput.min = '0';
    attackInput.max = '2';
    attackInput.value = String(env.attack);

    const decayInput = document.createElement('input');
    decayInput.type = 'number';
    decayInput.step = '0.01';
    decayInput.min = '0';
    decayInput.max = '2';
    decayInput.value = String(env.decay);

    const sustainInput = document.createElement('input');
    sustainInput.type = 'number';
    sustainInput.step = '0.05';
    sustainInput.min = '0';
    sustainInput.max = '1';
    sustainInput.value = String(env.sustain);

    const releaseInput = document.createElement('input');
    releaseInput.type = 'number';
    releaseInput.step = '0.01';
    releaseInput.min = '0';
    releaseInput.max = '3';
    releaseInput.value = String(env.release);

    const holdInput = document.createElement('input');
    holdInput.type = 'number';
    holdInput.step = '0.05';
    holdInput.min = '0';
    holdInput.max = '4';
    holdInput.value = String(env.hold);

    const triggerSelect = document.createElement('select');
    ['audio.peak', 'strobe', 'manual'].forEach((trigger) => {
      const option = document.createElement('option');
      option.value = trigger;
      option.textContent = trigger;
      triggerSelect.appendChild(option);
    });
    triggerSelect.value = env.trigger;

    const thresholdInput = document.createElement('input');
    thresholdInput.type = 'number';
    thresholdInput.step = '0.05';
    thresholdInput.min = '0';
    thresholdInput.max = '1';
    thresholdInput.value = String(env.threshold);

    const triggerButton = document.createElement('button');
    triggerButton.className = 'mod-trigger';
    triggerButton.textContent = 'Trigger';
    triggerButton.addEventListener('click', () => {
      envStates[index].stage = 'attack';
      envStates[index].value = 0;
      envStates[index].holdLeft = env.hold;
      envStates[index].triggerArmed = false;
    });

    attackInput.addEventListener('change', () => {
      env.attack = Number(attackInput.value);
    });
    decayInput.addEventListener('change', () => {
      env.decay = Number(decayInput.value);
    });
    sustainInput.addEventListener('change', () => {
      env.sustain = Number(sustainInput.value);
    });
    releaseInput.addEventListener('change', () => {
      env.release = Number(releaseInput.value);
    });
    holdInput.addEventListener('change', () => {
      env.hold = Number(holdInput.value);
    });
    triggerSelect.addEventListener('change', () => {
      env.trigger = triggerSelect.value as typeof env.trigger;
    });
    thresholdInput.addEventListener('change', () => {
      env.threshold = Number(thresholdInput.value);
    });

    row.appendChild(label);
    row.appendChild(attackInput);
    row.appendChild(decayInput);
    row.appendChild(sustainInput);
    row.appendChild(releaseInput);
    row.appendChild(holdInput);
    row.appendChild(triggerSelect);
    row.appendChild(thresholdInput);
    row.appendChild(triggerButton);
    envList.appendChild(row);
  });
};

const renderSampleHoldList = () => {
  shList.innerHTML = '';
  currentProject.sampleHold.forEach((sh) => {
    const row = document.createElement('div');
    row.className = 'mod-row';
    const label = document.createElement('div');
    label.textContent = sh.name;

    const rateInput = document.createElement('input');
    rateInput.type = 'number';
    rateInput.step = '0.05';
    rateInput.min = '0.05';
    rateInput.max = '8';
    rateInput.value = String(sh.rate);

    const syncToggle = document.createElement('input');
    syncToggle.type = 'checkbox';
    syncToggle.checked = sh.sync;

    const smoothInput = document.createElement('input');
    smoothInput.type = 'range';
    smoothInput.min = '0';
    smoothInput.max = '1';
    smoothInput.step = '0.05';
    smoothInput.value = String(sh.smooth);

    rateInput.addEventListener('change', () => {
      sh.rate = Number(rateInput.value);
    });
    syncToggle.addEventListener('change', () => {
      sh.sync = syncToggle.checked;
    });
    smoothInput.addEventListener('input', () => {
      sh.smooth = Number(smoothInput.value);
    });

    row.appendChild(label);
    row.appendChild(rateInput);
    row.appendChild(syncToggle);
    row.appendChild(smoothInput);
    shList.appendChild(row);
  });
};

const renderModulators = () => {
  renderLfoList();
  renderEnvelopeList();
  renderSampleHoldList();
};

const applyScene = (sceneId: string) => {
  const scene = currentProject.scenes.find((item) => item.id === sceneId);
  if (!scene) return;
  currentProject = { ...currentProject, activeSceneId: sceneId };
  renderLayerList();
};

const updateQuantizeHud = (message: string | null) => {
  if (!message) {
    quantizeHud.classList.add('hidden');
    return;
  }
  quantizeHud.textContent = message;
  quantizeHud.classList.remove('hidden');
};

const updateBpmRangeUI = () => {
  const range = clampBpmRange({
    min: Number(bpmMinInput.value) || bpmRange.min,
    max: Number(bpmMaxInput.value) || bpmRange.max
  });
  bpmRange = range;
  bpmMinInput.value = String(range.min);
  bpmMaxInput.value = String(range.max);
};

const updateBpmDisplay = () => {
  const sourceLabel =
    bpmSource === 'manual' ? 'Manual' : bpmSource === 'auto' ? 'Auto' : 'Network';
  const value =
    bpmSource === 'manual'
      ? Number(tempoInput.value) || 0
      : bpmSource === 'auto'
        ? autoBpm ?? 0
        : networkBpm ?? 0;
  bpmDisplay.innerHTML =
    value > 0
      ? `BPM: <strong>${value.toFixed(1)}</strong> (${sourceLabel})`
      : `BPM: -- (${sourceLabel})`;
};

const getActiveBpm = () => {
  if (bpmSource === 'network' && networkBpm) return networkBpm;
  if (bpmSource === 'auto' && autoBpm) return autoBpm;
  return Number(tempoInput.value) || 120;
};

const loadGeneratorLibrary = () => {
  try {
    const favorites = localStorage.getItem('vs.generator.favorites');
    const recents = localStorage.getItem('vs.generator.recents');
    if (favorites) {
      generatorFavoritesState = JSON.parse(favorites) as GeneratorId[];
    }
    if (recents) {
      generatorRecentsState = JSON.parse(recents) as GeneratorId[];
    }
  } catch {
    generatorFavoritesState = [];
    generatorRecentsState = [];
  }
};

const saveGeneratorLibrary = () => {
  localStorage.setItem('vs.generator.favorites', JSON.stringify(generatorFavoritesState));
  localStorage.setItem('vs.generator.recents', JSON.stringify(generatorRecentsState));
};

const renderGeneratorList = (container: HTMLElement, items: GeneratorId[]) => {
  container.innerHTML = '';
  items.forEach((id) => {
    const entry = GENERATORS.find((gen) => gen.id === id);
    if (!entry) return;
    const chip = document.createElement('div');
    chip.className = 'generator-chip';
    const label = document.createElement('span');
    label.textContent = entry.name;
    const addButton = document.createElement('button');
    addButton.textContent = '+';
    addButton.title = 'Add generator';
    addButton.addEventListener('click', () => addGenerator(entry.id));
    const favButton = document.createElement('button');
    favButton.textContent = '★';
    favButton.title = 'Toggle favorite';
    favButton.addEventListener('click', () => {
      generatorFavoritesState = toggleFavorite(generatorFavoritesState, entry.id);
      saveGeneratorLibrary();
      refreshGeneratorUI();
    });
    chip.appendChild(label);
    chip.appendChild(addButton);
    chip.appendChild(favButton);
    container.appendChild(chip);
  });
};

const refreshGeneratorUI = () => {
  generatorSelect.innerHTML = '';
  GENERATORS.forEach((gen) => {
    const option = document.createElement('option');
    option.value = gen.id;
    option.textContent = gen.name;
    generatorSelect.appendChild(option);
  });
  renderGeneratorList(generatorFavorites, generatorFavoritesState);
  renderGeneratorList(generatorRecents, generatorRecentsState);
};

const addGenerator = (id: GeneratorId) => {
  if (id === 'layer-plasma') {
    if (plasmaToggle) plasmaToggle.checked = true;
    setStatus('Plasma layer enabled.');
  }
  if (id === 'layer-spectrum') {
    if (spectrumToggle) spectrumToggle.checked = true;
    setStatus('Spectrum layer enabled.');
  }
  if (id === 'gen-particles') {
    particlesEnabled.checked = true;
    currentProject.particles.enabled = true;
    setStatus('Particle field enabled.');
  }
  if (id === 'gen-sdf') {
    sdfEnabled.checked = true;
    currentProject.sdf.enabled = true;
    setStatus('SDF shapes enabled.');
  }
  if (id === 'fx-bloom') {
    effectsEnabled.checked = true;
    effectBloom.value = '0.35';
    applyEffectControls();
    setStatus('Bloom effect boosted.');
  }
  if (id === 'fx-feedback') {
    effectsEnabled.checked = true;
    effectFeedback.value = '0.45';
    applyEffectControls();
    setStatus('Feedback tunnel enabled.');
  }
  if (id === 'fx-kaleidoscope') {
    effectsEnabled.checked = true;
    effectKaleidoscope.value = '0.5';
    applyEffectControls();
    setStatus('Kaleidoscope effect enabled.');
  }
  if (id === 'fx-chroma') {
    effectsEnabled.checked = true;
    effectChroma.value = '0.2';
    applyEffectControls();
    setStatus('Chromatic aberration enabled.');
  }
  if (id === 'fx-posterize') {
    effectsEnabled.checked = true;
    effectPosterize.value = '0.4';
    applyEffectControls();
    setStatus('Posterize effect enabled.');
  }
  if (id === 'fx-blur') {
    effectsEnabled.checked = true;
    effectBlur.value = '0.4';
    applyEffectControls();
    setStatus('Blur effect enabled.');
  }
  if (id === 'fx-trails') {
    effectsEnabled.checked = true;
    effectPersistence.value = '0.6';
    applyEffectControls();
    setStatus('Trails enabled.');
  }
  generatorRecentsState = updateRecents(generatorRecentsState, id);
  saveGeneratorLibrary();
  refreshGeneratorUI();
};

const applyMidiTargetValue = (target: string, value: number, isToggle = false) => {
  if (target === 'layer-plasma.enabled') {
    if (plasmaToggle) {
      plasmaToggle.checked = isToggle ? !plasmaToggle.checked : value > 0.5;
    }
    return;
  }
  if (target === 'layer-spectrum.enabled') {
    if (spectrumToggle) {
      spectrumToggle.checked = isToggle ? !spectrumToggle.checked : value > 0.5;
    }
    return;
  }
  if (target === 'style.contrast') {
    styleContrast.value = String(scaleMidiValue(value, 0.6, 1.6));
    applyStyleControls();
    return;
  }
  if (target === 'style.saturation') {
    styleSaturation.value = String(scaleMidiValue(value, 0.6, 1.8));
    applyStyleControls();
    return;
  }
  if (target === 'style.paletteShift') {
    styleShift.value = String(scaleMidiValue(value, -0.5, 0.5));
    applyStyleControls();
    return;
  }
  if (target.startsWith('macro-')) {
    const index = Number(target.split('-')[1]) - 1;
    const slider = macroInputs[index];
    if (slider) {
      slider.value = String(scaleMidiValue(value, 0, 1));
      currentProject.macros[index].value = Number(slider.value);
    }
  }
};

const armMidiLearn = (target: string, label: string) => {
  learnTarget = { target, label };
  setStatus(`MIDI Learn: move a control for ${label}`);
};

const initLearnables = () => {
  const learnables = document.querySelectorAll<HTMLElement>('[data-learn-target]');
  learnables.forEach((element) => {
    element.addEventListener('click', () => {
      const target = element.dataset.learnTarget;
      const label = element.dataset.learnLabel ?? target ?? 'Parameter';
      if (!target) return;
      armMidiLearn(target, label);
    });
  });
};
const initStylePresets = () => {
  styleSelect.innerHTML = '';
  currentProject.stylePresets.forEach((preset) => {
    const option = document.createElement('option');
    option.value = preset.id;
    option.textContent = preset.name;
    styleSelect.appendChild(option);
  });
  activeStyleId = currentProject.activeStylePresetId;
  if (!activeStyleId && currentProject.stylePresets.length > 0) {
    activeStyleId = currentProject.stylePresets[0].id;
    currentProject.activeStylePresetId = activeStyleId;
  }
  styleSelect.value = activeStyleId;
  const active = currentProject.stylePresets.find((preset) => preset.id === activeStyleId);
  if (active) {
    styleContrast.value = String(active.settings.contrast);
    styleSaturation.value = String(active.settings.saturation);
    styleShift.value = String(active.settings.paletteShift);
  }
};

const applyStyleControls = () => {
  if (!activeStyleId) return;
  const preset = currentProject.stylePresets.find((item) => item.id === activeStyleId);
  if (!preset) return;
  preset.settings.contrast = Number(styleContrast.value);
  preset.settings.saturation = Number(styleSaturation.value);
  preset.settings.paletteShift = Number(styleShift.value);
};

const initMacros = () => {
  macroList.innerHTML = '';
  macroInputs = [];
  currentProject.macros.forEach((macro, index) => {
    const row = document.createElement('div');
    row.className = 'macro-row';

    const label = document.createElement('div');
    label.className = 'macro-label';
    label.textContent = macro.name || `Macro ${index + 1}`;

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '1';
    slider.step = '0.01';
    slider.value = String(macro.value);
    slider.dataset.learnTarget = `macro-${index + 1}.value`;
    slider.dataset.learnLabel = macro.name || `Macro ${index + 1}`;
    slider.addEventListener('input', () => {
      macro.value = Number(slider.value);
    });

    const learn = document.createElement('button');
    learn.className = 'macro-learn';
    learn.textContent = 'Learn';
    learn.addEventListener('click', () => {
      setStatus(`MIDI learn placeholder for ${macro.name}`);
    });

    row.appendChild(label);
    row.appendChild(slider);
    row.appendChild(learn);
    macroList.appendChild(row);
    macroInputs.push(slider);
  });
  initLearnables();
};

const initEffects = () => {
  effectsEnabled.checked = currentProject.effects.enabled;
  effectBloom.value = String(currentProject.effects.bloom);
  effectBlur.value = String(currentProject.effects.blur);
  effectChroma.value = String(currentProject.effects.chroma);
  effectPosterize.value = String(currentProject.effects.posterize);
  effectKaleidoscope.value = String(currentProject.effects.kaleidoscope);
  effectFeedback.value = String(currentProject.effects.feedback);
  effectPersistence.value = String(currentProject.effects.persistence);
};

const initParticles = () => {
  particlesEnabled.checked = currentProject.particles.enabled;
  particlesDensity.value = String(currentProject.particles.density);
  particlesSpeed.value = String(currentProject.particles.speed);
  particlesSize.value = String(currentProject.particles.size);
  particlesGlow.value = String(currentProject.particles.glow);
};

const initSdf = () => {
  sdfEnabled.checked = currentProject.sdf.enabled;
  sdfShape.value = currentProject.sdf.shape;
  sdfScale.value = String(currentProject.sdf.scale);
  sdfRotation.value = String(currentProject.sdf.rotation);
  sdfEdge.value = String(currentProject.sdf.edge);
  sdfGlow.value = String(currentProject.sdf.glow);
  sdfFill.value = String(currentProject.sdf.fill);
};

const applyEffectControls = () => {
  currentProject.effects = {
    enabled: effectsEnabled.checked,
    bloom: Number(effectBloom.value),
    blur: Number(effectBlur.value),
    chroma: Number(effectChroma.value),
    posterize: Number(effectPosterize.value),
    kaleidoscope: Number(effectKaleidoscope.value),
    feedback: Number(effectFeedback.value),
    persistence: Number(effectPersistence.value)
  };
};

const applyParticleControls = () => {
  currentProject.particles = {
    enabled: particlesEnabled.checked,
    density: Number(particlesDensity.value),
    speed: Number(particlesSpeed.value),
    size: Number(particlesSize.value),
    glow: Number(particlesGlow.value)
  };
};

const applySdfControls = () => {
  currentProject.sdf = {
    enabled: sdfEnabled.checked,
    shape: sdfShape.value as typeof currentProject.sdf.shape,
    scale: Number(sdfScale.value),
    rotation: Number(sdfRotation.value),
    edge: Number(sdfEdge.value),
    glow: Number(sdfGlow.value),
    fill: Number(sdfFill.value)
  };
};

const syncOutputConfig = async (next: Partial<OutputConfig>) => {
  outputConfig = {
    ...outputConfig,
    ...next,
    scale: normalizeOutputScale(next.scale ?? outputConfig.scale)
  };
  currentProject = { ...currentProject, output: outputConfig };
  if (outputOpen) {
    await window.visualSynth.setOutputConfig(outputConfig);
  }
  updateOutputUI();
};

const setOutputEnabled = async (enabled: boolean) => {
  if (enabled === outputOpen) {
    await syncOutputConfig({ enabled });
    return;
  }
  if (enabled) {
    const result = await window.visualSynth.openOutput({ ...outputConfig, enabled: true });
    outputOpen = result.opened;
    outputConfig = result.config;
  } else {
    await window.visualSynth.closeOutput();
    outputOpen = false;
    outputConfig = { ...outputConfig, enabled: false };
  }
  currentProject = { ...currentProject, output: outputConfig };
  updateOutputUI();
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
      const logicalIndex = index + activePadBank * 64;
      handlePadTrigger(logicalIndex, 1);
    });
    padGrid.appendChild(pad);
  });
  updatePadBankUI();
  refreshPadGridForBank();
};

const updatePadBankUI = () => {
  const buttons = padBank.querySelectorAll<HTMLButtonElement>('button[data-bank]');
  buttons.forEach((button, index) => {
    button.classList.toggle('active', index === activePadBank);
  });
  padGrid.dataset.bank = padBanks[activePadBank];
};

const refreshPadGridForBank = () => {
  for (let index = 0; index < 64; index += 1) {
    const logicalIndex = activePadBank * 64 + index;
    updatePadUI(index, padStates[logicalIndex]);
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
    button.classList.toggle('active', button.dataset.bank === padBanks[activePadMapBank]);
  });
};

const renderPadMapGrid = () => {
  padMapGrid.innerHTML = '';
  const bankOffset = activePadMapBank * 64;
  for (let i = 0; i < 64; i += 1) {
    const action = currentProject.padMappings[bankOffset + i] ?? 'none';
    const cell = document.createElement('div');
    cell.className = 'pad-map';
    const label = document.createElement('div');
    label.className = 'pad-map-label';
    label.textContent = padActionLabels[action];
    cell.appendChild(label);
    cell.addEventListener('click', () => {
      const current = currentProject.padMappings[bankOffset + i] ?? 'none';
      const index = padActionCycle.indexOf(current);
      const next = padActionCycle[(index + 1) % padActionCycle.length];
      currentProject.padMappings[bankOffset + i] = next;
      label.textContent = padActionLabels[next];
    });
    padMapGrid.appendChild(cell);
  }
  updatePadMapBankUI();
};

const handlePadTrigger = (logicalIndex: number, velocity: number) => {
  const localIndex = logicalIndex % 64;
  const action = currentProject.padMappings[logicalIndex] ?? 'none';
  if (action === 'toggle-plasma') {
    padStates[logicalIndex] = !padStates[logicalIndex];
    updatePadUI(localIndex, padStates[logicalIndex]);
    if (plasmaToggle) plasmaToggle.checked = padStates[logicalIndex];
    return;
  }
  if (action === 'toggle-spectrum') {
    padStates[logicalIndex] = !padStates[logicalIndex];
    updatePadUI(localIndex, padStates[logicalIndex]);
    if (spectrumToggle) spectrumToggle.checked = padStates[logicalIndex];
    return;
  }
  if (action === 'strobe') {
    strobeIntensity = Math.max(strobeIntensity, velocity);
    updatePadUI(localIndex, true);
    setTimeout(() => updatePadUI(localIndex, false), 120);
    return;
  }
  if (action === 'scene-next' || action === 'scene-prev') {
    const currentIndex = currentProject.scenes.findIndex(
      (scene) => scene.id === currentProject.activeSceneId
    );
    if (currentIndex !== -1) {
      const delta = action === 'scene-next' ? 1 : -1;
      const nextIndex = (currentIndex + delta + currentProject.scenes.length) % currentProject.scenes.length;
      const nextScene = currentProject.scenes[nextIndex];
      sceneSelect.value = nextScene.id;
      applyScene(nextScene.id);
      setStatus(`Scene active: ${nextScene.name}`);
    }
    return;
  }
  if (action.startsWith('macro-')) {
    const index = Number(action.split('-')[1]) - 1;
    const slider = macroInputs[index];
    if (slider) {
      slider.value = String(Math.min(1, Math.max(0, velocity)));
      currentProject.macros[index].value = Number(slider.value);
    }
    return;
  }
};

const initAudioDevices = async () => {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const inputs = devices.filter((device) => device.kind === 'audioinput');
  audioSelect.innerHTML = '';
  inputs.forEach((device, index) => {
    const option = document.createElement('option');
    option.value = device.deviceId;
    option.textContent = device.label || `Input ${index + 1}`;
    audioSelect.appendChild(option);
  });
};

const setupAudio = async (deviceId?: string) => {
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
  }
  audioContext?.close();

  try {
    audioContext = new AudioContext({ latencyHint: 'interactive' });
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: deviceId ? { deviceId: { exact: deviceId } } : true
    });
    mediaStream = stream;
    const source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.7;
    source.connect(analyser);
    latencyLabel.textContent = `Audio Latency: ${Math.round(audioContext.baseLatency * 1000)}ms`;
    const outputLatency = audioContext.outputLatency ?? 0;
    outputLatencyLabel.textContent = outputLatency
      ? `Output Latency: ${Math.round(outputLatency * 1000)}ms`
      : 'Output Latency: --';
  } catch (error) {
    analyser = null;
    audioContext = null;
    safeModeReasons.push('Audio input unavailable');
    updateSafeModeBanner();
    setStatus('Audio input unavailable. Safe mode enabled.');
  }
};

const updateAudioAnalysis = () => {
  if (!analyser) return;
  const bufferLength = analyser.frequencyBinCount;
  const data = new Uint8Array(bufferLength);
  analyser.getByteFrequencyData(data);

  let sum = 0;
  let peak = 0;
  for (let i = 0; i < bufferLength; i += 1) {
    const value = data[i] / 255;
    sum += value * value;
    if (value > peak) peak = value;
  }
  const rms = Math.sqrt(sum / bufferLength);
  audioState.rms = rms;
  audioState.peak = peak;

  const bandSize = Math.floor(bufferLength / 8);
  for (let band = 0; band < 8; band += 1) {
    let bandSum = 0;
    for (let i = 0; i < bandSize; i += 1) {
      bandSum += data[band * bandSize + i] / 255;
    }
    audioState.bands[band] = bandSum / bandSize;
  }

  for (let i = 0; i < 64; i += 1) {
    const index = Math.floor((i / 64) * bufferLength);
    audioState.spectrum[i] = data[index] / 255;
  }

  const now = performance.now();
  if (!spectrumPrev || spectrumPrev.length !== bufferLength) {
    spectrumPrev = new Float32Array(bufferLength);
  }
  let flux = 0;
  for (let i = 0; i < bufferLength; i += 1) {
    const value = data[i] / 255;
    const delta = value - spectrumPrev[i];
    if (delta > 0) flux += delta;
    spectrumPrev[i] = value;
  }
  fluxHistory.push({ time: now, value: flux });
  fluxHistory = fluxHistory.filter((entry) => now - entry.time < 1000);

  const mean =
    fluxHistory.reduce((sum, entry) => sum + entry.value, 0) /
    Math.max(1, fluxHistory.length);
  const variance =
    fluxHistory.reduce((sum, entry) => sum + (entry.value - mean) ** 2, 0) /
    Math.max(1, fluxHistory.length);
  const std = Math.sqrt(variance);
  const threshold = mean + std * 1.5;

  if (fluxPrev > fluxPrevPrev && fluxPrev > flux && fluxPrev > threshold) {
    onsetTimes.push(fluxPrevTime);
    onsetTimes = onsetTimes.filter((time) => now - time < 8000);
  }
  fluxPrevPrev = fluxPrev;
  fluxPrev = flux;
  fluxPrevTime = now;

  if (now - lastTempoEstimateTime > 500 && onsetTimes.length >= 4) {
    const intervals: number[] = [];
    for (let i = 1; i < onsetTimes.length; i += 1) {
      intervals.push(onsetTimes[i] - onsetTimes[i - 1]);
    }
    const histogram = new Map<number, number>();
    for (const interval of intervals) {
      const bpm = 60000 / interval;
      const fitted = fitBpmToRange(bpm, bpmRange);
      if (!fitted) continue;
      const rounded = Math.round(fitted);
      histogram.set(rounded, (histogram.get(rounded) ?? 0) + 1);
    }
    let bestBpm: number | null = null;
    let bestScore = 0;
    for (const [bpm, score] of histogram) {
      if (score > bestScore) {
        bestScore = score;
        bestBpm = bpm;
      }
    }
    if (bestBpm) {
      autoBpm = autoBpm ? autoBpm * 0.85 + bestBpm * 0.15 : bestBpm;
    }
    lastTempoEstimateTime = now;
  }
};

const setupMIDI = async () => {
  try {
    midiAccess = await navigator.requestMIDIAccess();
    const inputs = Array.from(midiAccess.inputs.values());
    midiSelect.innerHTML = '';
    inputs.forEach((input, index) => {
      const option = document.createElement('option');
      option.value = input.id;
      option.textContent = input.name ?? `MIDI ${index + 1}`;
      midiSelect.appendChild(option);
    });
  } catch (error) {
    setStatus('WebMIDI unavailable. Using node-midi fallback.');
  }
};

const startMidiInput = async () => {
  if (midiAccess) {
    const inputId = midiSelect.value;
    const input = Array.from(midiAccess.inputs.values()).find((item) => item.id === inputId);
    if (!input) return;
    input.onmidimessage = (event) =>
      handleMidiMessage(Array.from(event.data), event.timeStamp ?? performance.now());
    setStatus(`MIDI connected: ${input.name ?? 'Unknown'}`);
  } else {
    const ports = await window.visualSynth.listNodeMidi();
    if (ports.length === 0) {
      setStatus('No node-midi devices found.');
      return;
    }
    midiSelect.innerHTML = '';
    ports.forEach((port) => {
      const option = document.createElement('option');
      option.value = String(port.index);
      option.textContent = port.name;
      midiSelect.appendChild(option);
    });
    const portIndex = Number(midiSelect.value);
    const result = await window.visualSynth.openNodeMidi(portIndex);
    if (result.opened) {
      setStatus(`node-midi connected: ${ports[0].name}`);
    }
    window.visualSynth.onNodeMidiMessage((message) =>
      handleMidiMessage(message, performance.now())
    );
  }
};

const handleMidiMessage = (message: number[], eventTime: number) => {
  const [status, data1, data2 = 0] = message;
  lastMidiLatencyMs = Math.max(0, performance.now() - eventTime);
  const messageType = status & 0xf0;
  const channel = getMidiChannel(status);

  if (learnTarget && (messageType === 0x90 || messageType === 0xb0)) {
    const mapping = {
      id: `map-${Date.now()}`,
      message: messageType === 0x90 ? 'note' : 'cc',
      channel,
      control: data1,
      target: learnTarget.target,
      mode: messageType === 0x90 ? 'toggle' : 'momentary'
    } as const;
    currentProject.midiMappings = currentProject.midiMappings.filter(
      (item) => item.target !== learnTarget?.target
    );
    currentProject.midiMappings.push(mapping);
    renderMidiMappings();
    setStatus(`Mapped ${learnTarget.label} to ${mapping.message.toUpperCase()} ${mapping.control}`);
    learnTarget = null;
    return;
  }

  const applyMappings = () => {
    currentProject.midiMappings.forEach((mapping) => {
      if (mapping.channel !== channel) return;
      if (mapping.message === 'note' && messageType === 0x90) {
        if (mapping.control !== data1) return;
        if (data2 === 0) return;
        applyMidiTargetValue(mapping.target, data2 / 127, mapping.mode === 'toggle');
      }
      if (mapping.message === 'cc' && messageType === 0xb0) {
        if (mapping.control !== data1) return;
        applyMidiTargetValue(mapping.target, data2);
      }
      if (mapping.message === 'aftertouch' && messageType === 0xd0) {
        applyMidiTargetValue(mapping.target, data1 / 127);
      }
      if (mapping.message === 'pitchbend' && messageType === 0xe0) {
        const combined = ((data2 ?? 0) << 7) | (data1 ?? 0);
        applyMidiTargetValue(mapping.target, combined / 16383);
      }
    });
  };

  applyMappings();

  if (messageType === 0x90 && data2 > 0) {
    handlePadTrigger(mapPadWithBank(data1, activePadBank), data2 / 127);
  }
};

const serializeProject = () => {
  const now = new Date().toISOString();
  currentProject = {
    ...currentProject,
    updatedAt: now,
    output: outputConfig,
    macros: currentProject.macros.map((macro, index) => ({
      ...macro,
      value: Number(macroInputs[index]?.value ?? macro.value)
    })),
    scenes: currentProject.scenes.map((scene) => ({
      ...scene,
      layers: scene.layers.map((layer) => {
        if (layer.id === 'layer-plasma') {
          return { ...layer, enabled: plasmaToggle?.checked ?? layer.enabled };
        }
        if (layer.id === 'layer-spectrum') {
          return { ...layer, enabled: spectrumToggle?.checked ?? layer.enabled };
        }
        return layer;
      })
    }))
  };
  return JSON.stringify(currentProject, null, 2);
};

const applyProject = async (project: VisualSynthProject) => {
  const parsed = projectSchema.safeParse(project);
  if (!parsed.success) {
    setStatus('Invalid project loaded.');
    return;
  }
  currentProject = parsed.data;
  refreshSceneSelect();
  applyScene(currentProject.activeSceneId);
  outputConfig = { ...DEFAULT_OUTPUT_CONFIG, ...currentProject.output };
  await syncOutputConfig(outputConfig);
  await setOutputEnabled(outputConfig.enabled);
  initStylePresets();
  initMacros();
  initEffects();
  initParticles();
  initSdf();
  initModulators();
  renderModulators();
  renderModMatrix();
  renderMidiMappings();
  renderPadMapGrid();
  renderMarkers();
  renderAssets();
  renderPlugins();
  diffBaseProject = { ...currentProject };
  renderDiffSections();
  setStatus(`Loaded project: ${currentProject.name}`);
};

saveButton.addEventListener('click', async () => {
  const payload = serializeProject();
  await window.visualSynth.saveProject(payload);
});

loadButton.addEventListener('click', async () => {
  const result = await window.visualSynth.openProject();
  if (!result.canceled && result.project) {
    await applyProject(result.project);
  }
});

applyPresetButton.addEventListener('click', async () => {
  const presetPath = presetSelect.value;
  const result = await window.visualSynth.loadPreset(presetPath);
  if (result.project) {
    await applyProject(result.project);
  }
});

applyTemplateButton.addEventListener('click', async () => {
  const templatePath = templateSelect.value;
  const result = await window.visualSynth.loadTemplate(templatePath);
  if (result.project) {
    await applyProject(result.project);
  }
});

sceneSelect.addEventListener('change', () => {
  applyScene(sceneSelect.value);
  setStatus(`Scene active: ${sceneSelect.selectedOptions[0]?.textContent ?? sceneSelect.value}`);
});

queueSceneButton.addEventListener('click', () => {
  if (currentProject.scenes.length === 0) return;
  const targetSceneId = sceneSelect.value;
  const bpm = getActiveBpm();
  const unit = quantizeSelect.value as QuantizationUnit;
  const scheduledTimeMs = getNextQuantizedTimeMs(performance.now(), bpm, unit);
  pendingSceneSwitch = { targetSceneId, scheduledTimeMs };
  setStatus(`Queued scene switch to ${sceneSelect.selectedOptions[0]?.textContent ?? targetSceneId}`);
});

bpmSourceSelect.addEventListener('change', () => {
  bpmSource = bpmSourceSelect.value as typeof bpmSource;
  updateBpmDisplay();
});

bpmRangeSelect.addEventListener('change', () => {
  if (bpmRangeSelect.value === 'custom') {
    bpmMinInput.disabled = false;
    bpmMaxInput.disabled = false;
    updateBpmRangeUI();
    return;
  }
  const [min, max] = bpmRangeSelect.value.split('-').map((value) => Number(value));
  bpmMinInput.value = String(min);
  bpmMaxInput.value = String(max);
  bpmMinInput.disabled = true;
  bpmMaxInput.disabled = true;
  updateBpmRangeUI();
});

bpmMinInput.addEventListener('change', updateBpmRangeUI);
bpmMaxInput.addEventListener('change', updateBpmRangeUI);

bpmNetworkToggle.addEventListener('click', async () => {
  if (!bpmNetworkActive) {
    const selected = bpmInterfaceSelect.value;
    const iface = selected
      ? {
          name: selected.split('|')[0],
          address: selected.split('|')[1]
        }
      : null;
    const result = await window.visualSynth.startNetworkBpm(iface);
    bpmNetworkActive = result.started;
    bpmNetworkToggle.textContent = bpmNetworkActive ? 'Stop Network' : 'Start Network';
    if (result.message) setStatus(result.message);
  } else {
    await window.visualSynth.stopNetworkBpm();
    bpmNetworkActive = false;
    bpmNetworkToggle.textContent = 'Start Network';
    setStatus('Network BPM stopped.');
  }
});

generatorAddButton.addEventListener('click', () => {
  const id = generatorSelect.value as GeneratorId;
  addGenerator(id);
});

padBank.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  const bank = target.closest<HTMLButtonElement>('button[data-bank]');
  if (!bank) return;
  const index = padBanks.indexOf(bank.dataset.bank as (typeof padBanks)[number]);
  if (index === -1) return;
  activePadBank = index;
  updatePadBankUI();
  refreshPadGridForBank();
  setStatus(`Pad bank: ${padBanks[activePadBank]}`);
});

padMapBank?.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  const bank = target.closest<HTMLButtonElement>('button[data-bank]');
  if (!bank) return;
  const index = padBanks.indexOf(bank.dataset.bank as (typeof padBanks)[number]);
  if (index === -1) return;
  activePadMapBank = index;
  renderPadMapGrid();
});

modMatrixAdd?.addEventListener('click', () => {
  addModConnection();
});

midiMapAdd?.addEventListener('click', () => {
  addMidiMapping();
});

captureScreenshotButton?.addEventListener('click', () => {
  void takeScreenshot();
});

captureRecordToggle?.addEventListener('click', () => {
  toggleRecording();
});

markerAddButton?.addEventListener('click', () => {
  addMarker();
});

assetImportButton?.addEventListener('click', () => {
  void importAsset();
});

assetImportVideoButton?.addEventListener('click', () => {
  void importVideoAsset();
});

pluginImportButton?.addEventListener('click', () => {
  void importPlugin();
});

diffUseCurrentButton?.addEventListener('click', () => {
  diffBaseProject = { ...currentProject };
  renderDiffSections();
});

diffLoadIncomingButton?.addEventListener('click', async () => {
  const result = await window.visualSynth.openProject();
  if (result.canceled || !result.project) return;
  diffIncomingProject = result.project;
  renderDiffSections();
});

diffApplyButton?.addEventListener('click', () => {
  void applyDiffMerge();
});

exportSceneButton.addEventListener('click', async () => {
  try {
    const payload = createSceneExchange(currentProject, currentProject.activeSceneId);
    const result = await window.visualSynth.saveExchange(
      JSON.stringify(payload, null, 2),
      `visualsynth-scene-${payload.scene.id}.json`
    );
    if (!result.canceled) {
      setStatus(`Scene exported: ${payload.scene.name}`);
    }
  } catch (error) {
    setStatus('Scene export failed.');
  }
});

importSceneButton.addEventListener('click', async () => {
  const result = await window.visualSynth.openExchange();
  if (result.canceled || !result.payload) return;
  try {
    const payload = JSON.parse(result.payload) as ExchangePayload;
    if (payload.kind !== 'scene') {
      setStatus('Exchange file is not a scene.');
      return;
    }
    currentProject = applyExchangePayload(currentProject, payload);
    refreshSceneSelect();
    setStatus(`Scene imported: ${payload.scene.name}`);
  } catch (error) {
    setStatus('Scene import failed.');
  }
});

exportMacrosButton.addEventListener('click', async () => {
  try {
    const payload = createMacrosExchange(currentProject);
    const result = await window.visualSynth.saveExchange(
      JSON.stringify(payload, null, 2),
      `visualsynth-macros-${currentProject.name.replace(/\s+/g, '-')}.json`
    );
    if (!result.canceled) {
      setStatus('Macros exported.');
    }
  } catch (error) {
    setStatus('Macro export failed.');
  }
});

importMacrosButton.addEventListener('click', async () => {
  const result = await window.visualSynth.openExchange();
  if (result.canceled || !result.payload) return;
  try {
    const payload = JSON.parse(result.payload) as ExchangePayload;
    if (payload.kind !== 'macros') {
      setStatus('Exchange file is not macros.');
      return;
    }
    currentProject = applyExchangePayload(currentProject, payload);
    initMacros();
    setStatus('Macros imported.');
  } catch (error) {
    setStatus('Macro import failed.');
  }
});

styleSelect.addEventListener('change', () => {
  activeStyleId = styleSelect.value;
  currentProject.activeStylePresetId = activeStyleId;
  initStylePresets();
  setStatus(`Style preset: ${styleSelect.selectedOptions[0]?.textContent ?? activeStyleId}`);
});

[styleContrast, styleSaturation, styleShift].forEach((control) => {
  control.addEventListener('input', () => {
    applyStyleControls();
  });
});

[effectsEnabled, effectBloom, effectBlur, effectChroma, effectPosterize, effectKaleidoscope, effectFeedback, effectPersistence].forEach(
  (control) => {
    control.addEventListener('input', () => {
      applyEffectControls();
    });
  }
);

[particlesEnabled, particlesDensity, particlesSpeed, particlesSize, particlesGlow].forEach(
  (control) => {
    control.addEventListener('input', () => {
      applyParticleControls();
    });
  }
);

[sdfEnabled, sdfScale, sdfRotation, sdfEdge, sdfGlow, sdfFill].forEach((control) => {
  control.addEventListener('input', () => {
    applySdfControls();
  });
});

sdfShape.addEventListener('change', () => {
  applySdfControls();
});

audioSelect.addEventListener('change', async () => {
  await setupAudio(audioSelect.value);
});

toggleMidiButton.addEventListener('click', async () => {
  await startMidiInput();
});

toggleMode.addEventListener('click', () => {
  isAdvanced = !isAdvanced;
  advancedPanel.classList.toggle('hidden', !isAdvanced);
  toggleMode.textContent = isAdvanced ? 'Advanced' : 'Simple';
});

outputToggleButton.addEventListener('click', async () => {
  await setOutputEnabled(!outputOpen);
});

outputFullscreenToggle.addEventListener('change', async () => {
  await syncOutputConfig({ fullscreen: outputFullscreenToggle.checked });
});

outputScaleSelect.addEventListener('change', async () => {
  await syncOutputConfig({ scale: Number(outputScaleSelect.value) });
});

const initPresets = async () => {
  const presets = await window.visualSynth.listPresets();
  presetSelect.innerHTML = '';
  presets.forEach((preset) => {
    const option = document.createElement('option');
    option.value = preset.path;
    option.textContent = preset.name;
    presetSelect.appendChild(option);
  });
};

const initTemplates = async () => {
  const templates = await window.visualSynth.listTemplates();
  templateSelect.innerHTML = '';
  templates.forEach((template) => {
    const option = document.createElement('option');
    option.value = template.path;
    option.textContent = template.name;
    templateSelect.appendChild(option);
  });
};

const initOutputConfig = async () => {
  const savedConfig = await window.visualSynth.getOutputConfig();
  outputOpen = await window.visualSynth.isOutputOpen();
  await syncOutputConfig({ ...DEFAULT_OUTPUT_CONFIG, ...savedConfig });
  window.visualSynth.onOutputClosed(() => {
    outputOpen = false;
    outputConfig = { ...outputConfig, enabled: false };
    updateOutputUI();
    setStatus('Output window closed.');
  });
};

const initBpmNetworking = async () => {
  const interfaces = await window.visualSynth.listNetworkInterfaces();
  bpmInterfaceSelect.innerHTML = '';
  interfaces.forEach((iface) => {
    const option = document.createElement('option');
    option.value = `${iface.name}|${iface.address}`;
    option.textContent = `${iface.name} (${iface.address})`;
    bpmInterfaceSelect.appendChild(option);
  });
  if (interfaces.length === 0) {
    bpmInterfaceSelect.innerHTML = '<option value="">No interfaces</option>';
    bpmInterfaceSelect.disabled = true;
    bpmNetworkToggle.disabled = true;
  }

  window.visualSynth.onNetworkBpm((payload) => {
    networkBpm = fitBpmToRange(payload.bpm, bpmRange) ?? payload.bpm;
    updateBpmDisplay();
    if (bpmSource === 'network') {
      setStatus(
        `Network BPM ${payload.bpm.toFixed(1)} from device ${payload.deviceId}${
          payload.isMaster ? ' (master)' : payload.isOnAir ? ' (on-air)' : ''
        }`
      );
    }
  });
};

const initShortcuts = () => {
  window.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.key.toLowerCase() === 's') {
      event.preventDefault();
      void saveButton.click();
    }
    if (event.ctrlKey && event.key.toLowerCase() === 'o') {
      event.preventDefault();
      void loadButton.click();
    }
    if (event.key.toLowerCase() === 'f') {
      document.documentElement.requestFullscreen().catch(() => undefined);
    }
    if (event.key.toLowerCase() === 'r') {
      toggleRecording();
    }
    if (event.key.toLowerCase() === 'p') {
      void takeScreenshot();
    }
    if (event.code === 'Space') {
      setStatus('Tempo play/pause placeholder.');
    }
  });
};

const canvas = document.getElementById('gl-canvas') as HTMLCanvasElement;
try {
  renderer = createGLRenderer(canvas);
} catch (error) {
  safeModeReasons.push('WebGL2 unavailable');
  updateSafeModeBanner();
  setStatus('WebGL2 not supported. Safe mode enabled.');
  renderer = {
    render: () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#0b111b';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ffd0d0';
      ctx.font = '16px Segoe UI, sans-serif';
      ctx.fillText('Safe mode: WebGL2 unavailable', 24, 32);
    },
    setLayerAsset: async () => undefined
  };
}

let lastTime = performance.now();
let fpsAccumulator = 0;
let frameCount = 0;

const buildModSources = (bpm: number) => {
  const bpmNormalized = Math.min(Math.max((bpm - 60) / 140, 0), 1);
  const lfoValues = currentProject.lfos.map((lfo, index) =>
    lfoValueForShape(lfoPhases[index] ?? lfo.phase ?? 0, lfo.shape)
  );
  const envValues = envStates.map((state) => state.value);
  const shValues = shState.map((state) => state.value);
  return {
    'audio.rms': audioState.rms,
    'audio.peak': audioState.peak,
    'audio.strobe': strobeIntensity,
    'tempo.bpm': bpmNormalized,
    'lfo-1': lfoValues[0] ?? 0,
    'lfo-2': lfoValues[1] ?? 0,
    'env-1': envValues[0] ?? 0,
    'env-2': envValues[1] ?? 0,
    'sh-1': shValues[0] ?? 0,
    'sh-2': shValues[1] ?? 0,
    'macro-1': currentProject.macros[0]?.value ?? 0,
    'macro-2': currentProject.macros[1]?.value ?? 0,
    'macro-3': currentProject.macros[2]?.value ?? 0,
    'macro-4': currentProject.macros[3]?.value ?? 0,
    'macro-5': currentProject.macros[4]?.value ?? 0,
    'macro-6': currentProject.macros[5]?.value ?? 0,
    'macro-7': currentProject.macros[6]?.value ?? 0,
    'macro-8': currentProject.macros[7]?.value ?? 0
  };
};

const render = (time: number) => {
  const delta = time - lastTime;
  lastTime = time;
  fpsAccumulator += delta;
  frameCount += 1;
  if (fpsAccumulator > 1000) {
    const fps = Math.round((frameCount / fpsAccumulator) * 1000);
    fpsLabel.textContent = `FPS: ${fps}`;
    fpsAccumulator = 0;
    frameCount = 0;
  }
  lastRenderTimeMs = time;
  if (mediaRecorder) {
    const elapsed = time - recordingStartedAt;
    setCaptureStatus(`Recording... ${formatTimestamp(elapsed)}`);
  }
  if (delta > 24) {
    frameDropScore = Math.min(1, frameDropScore + 0.02);
  } else {
    frameDropScore = Math.max(0, frameDropScore - 0.01);
  }
  if (time - lastWatchdogUpdate > 1000) {
    lastWatchdogUpdate = time;
    if (frameDropScore > 0.3) {
      watchdogLabel.textContent = 'Watchdog: Frame drops detected — try lowering output scale.';
      watchdogLabel.classList.add('watchdog-warning');
    } else {
      watchdogLabel.textContent = 'Watchdog: OK';
      watchdogLabel.classList.remove('watchdog-warning');
    }
  }

  if (time - lastAutosaveAt > 120000) {
    lastAutosaveAt = time;
    const payload = serializeProject();
    void window.visualSynth.autosaveProject(payload);
  }
  if (audioContext) {
    latencyLabel.textContent = `Audio Latency: ${Math.round(audioContext.baseLatency * 1000)}ms`;
    const outputLatency = audioContext.outputLatency ?? 0;
    outputLatencyLabel.textContent = outputLatency
      ? `Output Latency: ${Math.round(outputLatency * 1000)}ms`
      : 'Output Latency: --';
  }
  midiLatencyLabel.textContent =
    lastMidiLatencyMs === null
      ? 'MIDI Latency: --'
      : `MIDI Latency: ${Math.round(lastMidiLatencyMs)}ms`;
  updateBpmDisplay();

  if (pendingSceneSwitch) {
    const bpm = getActiveBpm();
    const beatsLeft = getBeatsUntil(time, pendingSceneSwitch.scheduledTimeMs, bpm);
    if (time >= pendingSceneSwitch.scheduledTimeMs) {
      applyScene(pendingSceneSwitch.targetSceneId);
      updateQuantizeHud(null);
      setStatus(`Scene switched: ${sceneSelect.selectedOptions[0]?.textContent ?? 'Scene'}`);
      pendingSceneSwitch = null;
    } else {
      updateQuantizeHud(`Switching in ${beatsLeft} beat${beatsLeft === 1 ? '' : 's'}`);
    }
  } else {
    updateQuantizeHud(null);
  }

  updateAudioAnalysis();
  strobeIntensity *= strobeDecay;

  const activeBpm = getActiveBpm();
  updateLfos(delta * 0.001, activeBpm);
  updateEnvelopes(delta * 0.001);
  updateSampleHold(delta * 0.001, activeBpm);

  resizeCanvasToDisplaySize(canvas);
  const activeStyle =
    currentProject.stylePresets?.find((preset) => preset.id === currentProject.activeStylePresetId) ??
    null;
  const styleSettings = activeStyle?.settings ?? { contrast: 1, saturation: 1, paletteShift: 0 };
  const effects = currentProject.effects ?? {
    enabled: true,
    bloom: 0.2,
    blur: 0,
    chroma: 0.1,
    posterize: 0,
    kaleidoscope: 0,
    feedback: 0,
    persistence: 0
  };
  const particles = currentProject.particles ?? {
    enabled: true,
    density: 0.35,
    speed: 0.3,
    size: 0.45,
    glow: 0.6
  };
  const sdf = currentProject.sdf ?? {
    enabled: true,
    shape: 'circle' as const,
    scale: 0.45,
    edge: 0.08,
    glow: 0.5,
    rotation: 0,
    fill: 0.35
  };
  const modSources = buildModSources(activeBpm);
  const modValue = (target: string, base: number) =>
    applyModMatrix(base, target, modSources, currentProject.modMatrix);
  const moddedStyle = {
    contrast: modValue('style.contrast', styleSettings.contrast),
    saturation: modValue('style.saturation', styleSettings.saturation),
    paletteShift: modValue('style.paletteShift', styleSettings.paletteShift)
  };
  const moddedEffects = {
    bloom: modValue('effects.bloom', effects.bloom),
    blur: modValue('effects.blur', effects.blur),
    chroma: modValue('effects.chroma', effects.chroma),
    posterize: modValue('effects.posterize', effects.posterize),
    kaleidoscope: modValue('effects.kaleidoscope', effects.kaleidoscope),
    feedback: modValue('effects.feedback', effects.feedback),
    persistence: modValue('effects.persistence', effects.persistence)
  };
  const moddedParticles = {
    density: modValue('particles.density', particles.density),
    speed: modValue('particles.speed', particles.speed),
    size: modValue('particles.size', particles.size),
    glow: modValue('particles.glow', particles.glow)
  };
  const moddedSdf = {
    scale: modValue('sdf.scale', sdf.scale),
    edge: modValue('sdf.edge', sdf.edge),
    glow: modValue('sdf.glow', sdf.glow),
    rotation: modValue('sdf.rotation', sdf.rotation),
    fill: modValue('sdf.fill', sdf.fill)
  };
  if (moddedEffects.persistence > 0) {
    const decay = 0.85 + moddedEffects.persistence * 0.14;
    for (let i = 0; i < trailSpectrum.length; i += 1) {
      trailSpectrum[i] = Math.max(trailSpectrum[i] * decay, audioState.spectrum[i]);
    }
  } else {
    trailSpectrum = new Float32Array(audioState.spectrum);
  }
  const macroSum = currentProject.macros.reduce(
    (acc, macro) => {
      macro.targets.forEach((target) => {
        acc[target.target] = (acc[target.target] ?? 0) + macro.value * target.amount;
      });
      return acc;
    },
    {} as Record<string, number>
  );
  const activeScene = currentProject.scenes.find((scene) => scene.id === currentProject.activeSceneId);
  const plasmaLayer = activeScene?.layers.find((layer) => layer.id === 'layer-plasma');
  const spectrumLayer = activeScene?.layers.find((layer) => layer.id === 'layer-spectrum');
  const plasmaOpacity = Math.min(
    1,
    Math.max(0, (plasmaLayer?.opacity ?? 1) * (1 + (macroSum['layer-plasma.opacity'] ?? 0)))
  );
  const spectrumOpacity = Math.min(
    1,
    Math.max(0, (spectrumLayer?.opacity ?? 1) * (1 + (macroSum['layer-spectrum.opacity'] ?? 0)))
  );
  const moddedPlasmaOpacity = modValue('layer-plasma.opacity', plasmaOpacity);
  const moddedSpectrumOpacity = modValue('layer-spectrum.opacity', spectrumOpacity);
  const plasmaEnabled = plasmaToggle?.checked ?? true;
  const spectrumEnabled = spectrumToggle?.checked ?? true;
  const plasmaAssetBlendMode = getAssetBlendModeValue('layer-plasma');
  const plasmaAssetAudioReact = getAssetAudioReactValue('layer-plasma');
  const spectrumAssetBlendMode = getAssetBlendModeValue('layer-spectrum');
  const spectrumAssetAudioReact = getAssetAudioReactValue('layer-spectrum');
  const renderState: RenderState = {
    timeMs: time,
    rms: audioState.rms,
    peak: audioState.peak,
    strobe: strobeIntensity,
    plasmaEnabled,
    spectrumEnabled,
    spectrum: audioState.spectrum,
    contrast: moddedStyle.contrast,
    saturation: moddedStyle.saturation,
    paletteShift: moddedStyle.paletteShift,
    plasmaOpacity: moddedPlasmaOpacity,
    spectrumOpacity: moddedSpectrumOpacity,
    plasmaAssetBlendMode: plasmaAssetBlendMode,
    plasmaAssetAudioReact: plasmaAssetAudioReact,
    spectrumAssetBlendMode: spectrumAssetBlendMode,
    spectrumAssetAudioReact: spectrumAssetAudioReact,
    effectsEnabled: effects.enabled,
    bloom: moddedEffects.bloom,
    blur: moddedEffects.blur,
    chroma: moddedEffects.chroma,
    posterize: moddedEffects.posterize,
    kaleidoscope: moddedEffects.kaleidoscope,
    feedback: moddedEffects.feedback,
    persistence: moddedEffects.persistence,
    trailSpectrum: trailSpectrum,
    particlesEnabled: particles.enabled,
    particleDensity: moddedParticles.density,
    particleSpeed: moddedParticles.speed,
    particleSize: moddedParticles.size,
    particleGlow: moddedParticles.glow,
    sdfEnabled: sdf.enabled,
    sdfShape: sdf.shape === 'circle' ? 0 : sdf.shape === 'box' ? 1 : 2,
    sdfScale: moddedSdf.scale,
    sdfEdge: moddedSdf.edge,
    sdfGlow: moddedSdf.glow,
    sdfRotation: moddedSdf.rotation,
    sdfFill: moddedSdf.fill
  };
  renderer.render(renderState);

  if (outputOpen && time - lastOutputBroadcast > 33) {
    lastOutputBroadcast = time;
    outputChannel.postMessage({
      rms: renderState.rms,
      peak: renderState.peak,
      strobe: renderState.strobe,
      plasmaEnabled: renderState.plasmaEnabled,
      spectrumEnabled: renderState.spectrumEnabled,
      spectrum: renderState.spectrum.slice(),
      contrast: renderState.contrast,
      saturation: renderState.saturation,
      paletteShift: renderState.paletteShift,
      plasmaOpacity: renderState.plasmaOpacity,
      spectrumOpacity: renderState.spectrumOpacity,
      plasmaAssetBlendMode: renderState.plasmaAssetBlendMode,
      plasmaAssetAudioReact: renderState.plasmaAssetAudioReact,
      spectrumAssetBlendMode: renderState.spectrumAssetBlendMode,
      spectrumAssetAudioReact: renderState.spectrumAssetAudioReact,
      effectsEnabled: renderState.effectsEnabled,
      bloom: renderState.bloom,
      blur: renderState.blur,
      chroma: renderState.chroma,
      posterize: renderState.posterize,
      kaleidoscope: renderState.kaleidoscope,
      feedback: renderState.feedback,
      persistence: renderState.persistence,
      trailSpectrum: renderState.trailSpectrum,
      particlesEnabled: renderState.particlesEnabled,
      particleDensity: renderState.particleDensity,
      particleSpeed: renderState.particleSpeed,
      particleSize: renderState.particleSize,
      particleGlow: renderState.particleGlow,
      sdfEnabled: renderState.sdfEnabled,
      sdfShape: renderState.sdfShape,
      sdfScale: renderState.sdfScale,
      sdfEdge: renderState.sdfEdge,
      sdfGlow: renderState.sdfGlow,
      sdfRotation: renderState.sdfRotation,
      sdfFill: renderState.sdfFill
    });
  }

  requestAnimationFrame(render);
};

const init = async () => {
  initPads();
  initShortcuts();
  initLearnables();
  setCaptureStatus('Idle');
  await initPresets();
  await initTemplates();
  await initOutputConfig();
  refreshSceneSelect();
  applyScene(currentProject.activeSceneId);
  await initBpmNetworking();
  loadGeneratorLibrary();
  refreshGeneratorUI();
  initStylePresets();
  initMacros();
  initEffects();
  initParticles();
  initSdf();
  initModulators();
  renderModulators();
  renderModMatrix();
  renderMidiMappings();
  renderPadMapGrid();
  renderMarkers();
  renderAssets();
  renderPlugins();
  renderDiffSections();
  bpmRangeSelect.dispatchEvent(new Event('change'));
  await initAudioDevices();
  await setupAudio();
  await setupMIDI();
  const recovery = await window.visualSynth.getRecovery();
  if (recovery.found && recovery.payload) {
    try {
      const parsed = JSON.parse(recovery.payload) as VisualSynthProject;
      await applyProject(parsed);
      setStatus('Recovery session loaded.');
    } catch {
      setStatus('Recovery session found but failed to load.');
    }
  }
  requestAnimationFrame(render);
};

void init();
