import {
  DEFAULT_OUTPUT_CONFIG,
  DEFAULT_PROJECT,
  DEFAULT_SCENE_ROLES,
  DEFAULT_SCENE_TRANSITION,
  DEFAULT_SCENE_TRIGGER,
  OUTPUT_BASE_HEIGHT,
  OUTPUT_BASE_WIDTH,
  OutputConfig,
  VisualSynthProject,
  ColorPalette,
  SceneLook,
  SceneConfig,
  SceneIntent,
  MacroConfig,
  LayerConfig,
  AssetItem,
  AssetColorSpace
} from '../shared/project';
import { SceneManager, captureSceneSnapshot } from './scene/SceneManager';
import { renderSceneTimelineItems } from './scene/sceneTimeline';
import { projectSchema } from '../shared/projectSchema';
import { createGLRenderer, RenderState, resizeCanvasToDisplaySize } from './glRenderer';
import { createDebugOverlay } from './render/debugOverlay';
import { createLayerPanel } from './panels/LayerPanel';
import { createSdfPanel } from './ui/panels/SdfPanel';
import { registerSdfNodes } from './sdf/nodes';
import { createModulationPanel } from './panels/ModulationPanel';
import { getBeatsUntil, getNextQuantizedTimeMs, QuantizationUnit } from '../shared/quantization';
import { BpmRange, clampBpmRange, fitBpmToRange } from '../shared/bpm';
import { GENERATORS, GeneratorId, updateRecents, toggleFavorite } from '../shared/generatorLibrary';
import { getMidiChannel, mapPadWithBank, scaleMidiValue } from '../shared/midiMapping';
import { applyModMatrix } from '../shared/modMatrix';
import { buildLegacyTarget, getParamDef, parseLegacyTarget } from '../shared/parameterRegistry';
import { lfoValueForShape } from '../shared/lfoUtils';
import { reorderLayers, cloneLayerConfig, ensureLayerWithDefaults } from '../shared/layers';
import { applyExchangePayload, createMacrosExchange, createSceneExchange, ExchangePayload } from '../shared/exchange';
import { pluginManifestSchema } from '../shared/pluginSchema';
import { mergeProjectSections, MergeOptions } from '../shared/projectMerge';
import { toFileUrl } from '../shared/fileUrl';
import { createAssetItem, normalizeAssetTags } from '../shared/assets';
import type { AssetImportResult } from '../shared/assets';
import { getModeVisibility, UiMode } from '../shared/uiModes';
import { VISUAL_MODES, VisualMode } from '../shared/modes';

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
      listPresets: () => Promise<{ name: string; category: string; path: string }[]>;
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
      isProlinkAvailable: () => Promise<boolean>;
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
      openAssetFolder: (filePath: string) => Promise<{ opened: boolean }>;
    };
  }
}

const audioSelect = document.getElementById('audio-device') as HTMLSelectElement;
const midiSelect = document.getElementById('midi-device') as HTMLSelectElement;
const toggleMidiButton = document.getElementById('toggle-midi') as HTMLButtonElement;
const saveButton = document.getElementById('btn-save') as HTMLButtonElement;
const savePerfButton = document.getElementById('btn-save-perf') as HTMLButtonElement;
const loadButton = document.getElementById('btn-load') as HTMLButtonElement;
const presetSelect = document.getElementById('preset-select') as HTMLSelectElement;
const applyPresetButton = document.getElementById('btn-apply-preset') as HTMLButtonElement;
const presetPrevButton = document.getElementById('preset-prev') as HTMLButtonElement;
const presetNextButton = document.getElementById('preset-next') as HTMLButtonElement;
const presetCategorySelect = document.getElementById('preset-category') as HTMLSelectElement;
const presetShuffleButton = document.getElementById('preset-shuffle') as HTMLButtonElement;
const presetBrowser = document.getElementById('preset-browser') as HTMLDivElement;
const presetExplorer = document.getElementById('preset-explorer') as HTMLDivElement;
const templateSelect = document.getElementById('template-select') as HTMLSelectElement;
const applyTemplateButton = document.getElementById('btn-apply-template') as HTMLButtonElement;
const modeSwitcher = document.getElementById('mode-switcher') as HTMLDivElement;
const modeButtons = Array.from(
  modeSwitcher.querySelectorAll<HTMLButtonElement>('button[data-mode]')
);
const sceneTimeline = document.getElementById('scene-timeline') as HTMLDivElement;
const sceneTimelineTrack = document.getElementById('scene-timeline-track') as HTMLDivElement;
const sceneTimelineStatus = document.getElementById('scene-timeline-status') as HTMLSpanElement;
const performanceLeft = document.getElementById('mode-performance-left') as HTMLDivElement;
const performanceRight = document.getElementById('mode-performance-right') as HTMLDivElement;
const sceneLeft = document.getElementById('mode-scene-left') as HTMLDivElement;
const sceneRight = document.getElementById('mode-scene-right') as HTMLDivElement;
const designLeft = document.getElementById('mode-design-left') as HTMLDivElement;
const designRight = document.getElementById('mode-design-right') as HTMLDivElement;
const matrixLeft = document.getElementById('mode-matrix-left') as HTMLDivElement;
const matrixRight = document.getElementById('mode-matrix-right') as HTMLDivElement;
const matrixCenter = document.getElementById('mode-matrix-center') as HTMLDivElement;
const systemLeft = document.getElementById('mode-system-left') as HTMLDivElement;
const systemRight = document.getElementById('mode-system-right') as HTMLDivElement;
const sceneStrip = document.getElementById('scene-strip') as HTMLDivElement;
const sceneStripAnchor = document.getElementById('scene-strip-anchor') as HTMLDivElement;
const sceneStripCards = document.getElementById('scene-strip-cards') as HTMLDivElement;
const sceneStripList = document.getElementById('scene-strip-list') as HTMLDivElement;
const sceneStripViewButtons = Array.from(
  sceneStrip.querySelectorAll<HTMLButtonElement>('button[data-scene-view]')
);
const addBlankSceneButton = document.getElementById('scene-add-blank') as HTMLButtonElement;
const transportTap = document.getElementById('transport-tap') as HTMLButtonElement;
const transportBpmInput = document.getElementById('transport-bpm') as HTMLInputElement;
const transportPauseButton = document.getElementById('transport-pause') as HTMLButtonElement;
const outputRouteSelect = document.getElementById('output-route') as HTMLSelectElement;
const visualModeSelect = document.getElementById('visual-mode-select') as HTMLSelectElement;
const healthFps = document.getElementById('health-fps') as HTMLSpanElement;
const healthLatency = document.getElementById('health-latency') as HTMLSpanElement;
const healthWatchdog = document.getElementById('health-watchdog') as HTMLSpanElement;
const summaryMods = document.getElementById('summary-mods') as HTMLButtonElement;
const summaryFx = document.getElementById('summary-fx') as HTMLButtonElement;
const summaryAuto = document.getElementById('summary-auto') as HTMLButtonElement;
const latencySummary = document.getElementById('latency-summary') as HTMLDivElement;
const guardrailStatus = document.getElementById('guardrail-status') as HTMLDivElement;
const guardrailHint = document.getElementById('guardrail-hint') as HTMLDivElement;
const mixRoleCore = document.getElementById('mix-role-core') as HTMLInputElement;
const mixRoleSupport = document.getElementById('mix-role-support') as HTMLInputElement;
const mixRoleAtmosphere = document.getElementById('mix-role-atmosphere') as HTMLInputElement;
const perfToggleSpectrum = document.getElementById('perf-toggle-spectrum') as HTMLInputElement;
const perfTogglePlasma = document.getElementById('perf-toggle-plasma') as HTMLInputElement;
const spectrumHint = document.getElementById('spectrum-hint') as HTMLDivElement;
const spectrumHintDismiss = document.getElementById('spectrum-hint-dismiss') as HTMLButtonElement;
const perfAddLayerButton = document.getElementById('perf-add-layer') as HTMLButtonElement;
const generatorPanel = document.getElementById('generator-panel') as HTMLDivElement;
const playlistAddButton = document.getElementById('playlist-add') as HTMLButtonElement;
const playlistRemoveButton = document.getElementById('playlist-remove') as HTMLButtonElement;
const playlistPlayButton = document.getElementById('playlist-play') as HTMLButtonElement;
const playlistStopButton = document.getElementById('playlist-stop') as HTMLButtonElement;
const playlistList = document.getElementById('playlist-list') as HTMLDivElement;
const playlistSlotSeconds = document.getElementById('playlist-slot-seconds') as HTMLInputElement;
const playlistFadeSeconds = document.getElementById('playlist-fade-seconds') as HTMLInputElement;
const shaderTargetSelect = document.getElementById('shader-target') as HTMLSelectElement;
const shaderEditor = document.getElementById('shader-editor') as HTMLTextAreaElement;
const shaderApplyButton = document.getElementById('shader-apply') as HTMLButtonElement;
const shaderSaveButton = document.getElementById('shader-save') as HTMLButtonElement;
const shaderStatus = document.getElementById('shader-status') as HTMLDivElement;
const layerList = document.getElementById('layer-list') as HTMLDivElement;
const layerListScene = document.getElementById('layer-list-scene') as HTMLDivElement;
const layerListDesign = document.getElementById('layer-list-design') as HTMLDivElement | null;
let plasmaToggle: HTMLInputElement | null = null;
let spectrumToggle: HTMLInputElement | null = null;
let origamiToggle: HTMLInputElement | null = null;
let glyphToggle: HTMLInputElement | null = null;
let crystalToggle: HTMLInputElement | null = null;
let inkToggle: HTMLInputElement | null = null;
let topoToggle: HTMLInputElement | null = null;
let weatherToggle: HTMLInputElement | null = null;
let portalToggle: HTMLInputElement | null = null;
let oscilloToggle: HTMLInputElement | null = null;
const statusLabel = document.getElementById('status') as HTMLDivElement;
const padGrid = document.getElementById('pad-grid') as HTMLDivElement;
const padBank = document.getElementById('pad-bank') as HTMLDivElement;
const padMapGrid = document.getElementById('pad-map-grid') as HTMLDivElement;
const padMapBank = document.getElementById('pad-map-bank') as HTMLDivElement;
const sceneSelect = document.getElementById('scene-select') as HTMLSelectElement;
const tempoInput = document.getElementById('tempo-input') as HTMLInputElement;
const quantizeSelect = document.getElementById('quantize-select') as HTMLSelectElement;
const queueSceneButton = document.getElementById('queue-scene') as HTMLButtonElement;
const activateSceneButton = document.getElementById('activate-scene') as HTMLButtonElement;
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
const visualizerModeSelect = document.getElementById('visualizer-mode') as HTMLSelectElement;
const visualizerEnabledToggle = document.getElementById('visualizer-enabled') as HTMLInputElement;
const visualizerOpacityInput = document.getElementById('visualizer-opacity') as HTMLInputElement;
const visualizerMacroToggle = document.getElementById('visualizer-macro-enabled') as HTMLInputElement;
const visualizerMacroSelect = document.getElementById('visualizer-macro-select') as HTMLSelectElement;
const styleSelect = document.getElementById('style-select') as HTMLSelectElement;
const styleContrast = document.getElementById('style-contrast') as HTMLInputElement;
const styleSaturation = document.getElementById('style-saturation') as HTMLInputElement;
const styleShift = document.getElementById('style-shift') as HTMLInputElement;
const macroList = document.getElementById('macro-list') as HTMLDivElement;
const macroEnergy = document.getElementById('macro-energy') as HTMLInputElement;
const macroMotion = document.getElementById('macro-motion') as HTMLInputElement;
const macroColor = document.getElementById('macro-color') as HTMLInputElement;
const macroDensity = document.getElementById('macro-density') as HTMLInputElement;
const macroEnergyValue = document.getElementById('macro-energy-value') as HTMLSpanElement;
const macroMotionValue = document.getElementById('macro-motion-value') as HTMLSpanElement;
const macroColorValue = document.getElementById('macro-color-value') as HTMLSpanElement;
const macroDensityValue = document.getElementById('macro-density-value') as HTMLSpanElement;
const macroHero = document.querySelector('.macro-hero') as HTMLDivElement;
const matrixControls = document.getElementById('matrix-controls') as HTMLDivElement;
const effectsEnabled = document.getElementById('effects-enabled') as HTMLInputElement;
const effectBloom = document.getElementById('effect-bloom') as HTMLInputElement;
const effectBlur = document.getElementById('effect-blur') as HTMLInputElement;
const effectChroma = document.getElementById('effect-chroma') as HTMLInputElement;
const effectPosterize = document.getElementById('effect-posterize') as HTMLInputElement;
const effectKaleidoscope = document.getElementById('effect-kaleidoscope') as HTMLInputElement;
const effectFeedback = document.getElementById('effect-feedback') as HTMLInputElement;
const effectPersistence = document.getElementById('effect-persistence') as HTMLInputElement;
const expressiveEnergyEnabled = document.getElementById('expressive-energy-enabled') as HTMLInputElement;
const expressiveEnergyMacro = document.getElementById('expressive-energy-macro') as HTMLInputElement;
const expressiveEnergyIntentEnabled = document.getElementById('expressive-energy-intent-enabled') as HTMLInputElement;
const expressiveEnergyIntent = document.getElementById('expressive-energy-intent') as HTMLSelectElement;
const expressiveEnergyIntentAmount = document.getElementById('expressive-energy-intent-amount') as HTMLInputElement;
const expressiveEnergyThreshold = document.getElementById('expressive-energy-threshold') as HTMLInputElement;
const expressiveEnergyAccumulation = document.getElementById('expressive-energy-accumulation') as HTMLInputElement;
const expressiveRadialEnabled = document.getElementById('expressive-radial-enabled') as HTMLInputElement;
const expressiveRadialMacro = document.getElementById('expressive-radial-macro') as HTMLInputElement;
const expressiveRadialIntentEnabled = document.getElementById('expressive-radial-intent-enabled') as HTMLInputElement;
const expressiveRadialIntent = document.getElementById('expressive-radial-intent') as HTMLSelectElement;
const expressiveRadialIntentAmount = document.getElementById('expressive-radial-intent-amount') as HTMLInputElement;
const expressiveRadialStrength = document.getElementById('expressive-radial-strength') as HTMLInputElement;
const expressiveRadialRadius = document.getElementById('expressive-radial-radius') as HTMLInputElement;
const expressiveRadialFocusX = document.getElementById('expressive-radial-focus-x') as HTMLInputElement;
const expressiveRadialFocusY = document.getElementById('expressive-radial-focus-y') as HTMLInputElement;
const expressiveEchoEnabled = document.getElementById('expressive-echo-enabled') as HTMLInputElement;
const expressiveEchoMacro = document.getElementById('expressive-echo-macro') as HTMLInputElement;
const expressiveEchoIntentEnabled = document.getElementById('expressive-echo-intent-enabled') as HTMLInputElement;
const expressiveEchoIntent = document.getElementById('expressive-echo-intent') as HTMLSelectElement;
const expressiveEchoIntentAmount = document.getElementById('expressive-echo-intent-amount') as HTMLInputElement;
const expressiveEchoDecay = document.getElementById('expressive-echo-decay') as HTMLInputElement;
const expressiveEchoWarp = document.getElementById('expressive-echo-warp') as HTMLInputElement;
const expressiveSmearEnabled = document.getElementById('expressive-smear-enabled') as HTMLInputElement;
const expressiveSmearMacro = document.getElementById('expressive-smear-macro') as HTMLInputElement;
const expressiveSmearIntentEnabled = document.getElementById('expressive-smear-intent-enabled') as HTMLInputElement;
const expressiveSmearIntent = document.getElementById('expressive-smear-intent') as HTMLSelectElement;
const expressiveSmearIntentAmount = document.getElementById('expressive-smear-intent-amount') as HTMLInputElement;
const expressiveSmearOffset = document.getElementById('expressive-smear-offset') as HTMLInputElement;
const expressiveSmearMix = document.getElementById('expressive-smear-mix') as HTMLInputElement;
const paletteSelect = document.getElementById('palette-select') as HTMLSelectElement;
const palettePreview = document.getElementById('palette-preview') as HTMLDivElement;
const paletteApplyToggle = document.getElementById('palette-apply-scene') as HTMLInputElement;
const particlesEnabled = document.getElementById('particles-enabled') as HTMLInputElement;
const particlesDensity = document.getElementById('particles-density') as HTMLInputElement;
const particlesSpeed = document.getElementById('particles-speed') as HTMLInputElement;
const particlesSize = document.getElementById('particles-size') as HTMLInputElement;
const particlesGlow = document.getElementById('particles-glow') as HTMLInputElement;
const sdfEnabled = document.getElementById('sdf-enabled') as HTMLInputElement;
const sdfAdvancedToggle = document.getElementById('sdf-advanced-enabled') as HTMLInputElement;
const sdfSimpleControls = document.getElementById('sdf-simple-controls') as HTMLDivElement;
const sdfEditor = document.getElementById('sdf-editor') as HTMLDivElement;
const sdfShape = document.getElementById('sdf-shape') as HTMLSelectElement;
const sdfScale = document.getElementById('sdf-scale') as HTMLInputElement;
const sdfRotation = document.getElementById('sdf-rotation') as HTMLInputElement;
const sdfEdge = document.getElementById('sdf-edge') as HTMLInputElement;
const sdfGlow = document.getElementById('sdf-glow') as HTMLInputElement;
const sdfFill = document.getElementById('sdf-fill') as HTMLInputElement;
const sdfColor = document.getElementById('sdf-color') as HTMLInputElement;
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
const assetTextInput = document.getElementById('asset-text-input') as HTMLInputElement | null;
const assetFontInput = document.getElementById('asset-font-input') as HTMLInputElement | null;
const assetTextAddButton = document.getElementById('asset-text-add') as HTMLButtonElement | null;
const assetTagsInput = document.getElementById('asset-tags') as HTMLInputElement;
const assetList = document.getElementById('asset-list') as HTMLDivElement;
const webcamPicker = document.getElementById('webcam-picker') as HTMLDivElement | null;
const webcamPickerSelect = document.getElementById('webcam-picker-select') as HTMLSelectElement | null;
const webcamPickerRemember = document.getElementById('webcam-picker-remember') as HTMLInputElement | null;
const webcamPickerConfirm = document.getElementById('webcam-picker-confirm') as HTMLButtonElement | null;
const webcamPickerCancel = document.getElementById('webcam-picker-cancel') as HTMLButtonElement | null;

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
const gpuLabel = document.getElementById('diag-gpu') as HTMLDivElement;
const webglDiag = document.getElementById('diag-webgl') as HTMLDivElement;
const webglCopyButton = document.getElementById('diag-webgl-copy') as HTMLButtonElement;

let currentProject: VisualSynthProject = DEFAULT_PROJECT;
const sceneManager = new SceneManager(() => currentProject);
let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let mediaStream: MediaStream | null = null;
let midiAccess: MIDIAccess | null = null;
let strobeIntensity = 0;
let strobeDecay = 0.92;
let origamiFoldState = 0;
let origamiFoldSharpness = 0.65;
let gravityGlobalPolarity = 1;
let gravityCollapse = 0;
let gravityFixedIndex = 0;
let lastGravityIndex = -1;
let glyphMode = 0;
let glyphSeed = Math.random() * 1000;
let glyphBeatPulse = 0;
let crystalMode = 0;
let crystalBrittleness = 0.4;
let inkBrush = 0;
let inkPressure = 0.6;
let inkLifespan = 0.6;
let topoQuake = 0;
let topoSlide = 0;
let topoPlate = 0;
let topoTravel = 0;
let weatherMode = 0;
let weatherIntensity = 0.6;
let portalShift = 0;
let portalSeed = Math.random() * 1000;
let lastPortalAutoSpawn = 0;
let oscilloMode = 0;
let oscilloFreeze = 0;
let oscilloRotate = 0;
let isPlaying = true;
let transportTimeMs = 0;
let activeMode: UiMode = 'performance';
let sceneStripView: 'cards' | 'list' =
  (localStorage.getItem('vs.sceneStrip.view') as 'cards' | 'list' | null) ?? 'cards';
let selectedSceneId: string | null = null;
let outputConfig: OutputConfig = { ...DEFAULT_OUTPUT_CONFIG };
let outputOpen = false;
const outputChannel = new BroadcastChannel('visualsynth-output');
let lastOutputBroadcast = 0;
const WEBCAM_STORAGE_KEY = 'visualsynth.webcamDeviceId';
let lastMidiLatencyMs: number | null = null;
let pendingSceneSwitch: { targetSceneId: string; scheduledTimeMs: number } | null = null;
let sdfPanel: { render: () => void } | null = null;
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
let macroPreviewRows: HTMLDivElement[] = [];
let learnTarget: { target: string; label: string } | null = null;
let midiSum: Record<string, number> = {};
let safeModeReasons: string[] = [];
let webglInitError: string | null = null;
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
let lastSummaryUpdate = 0;
let visualizerMode: 'off' | 'spectrum' | 'waveform' | 'oscilloscope' = 'off';
let playlist: { name: string; path: string }[] = [];
let playlistIndex = 0;
let playlistTimer: number | null = null;
let playlistActive = false;
let playlistOverrides: Record<string, Partial<LayerConfig>> = {};
let presetLibrary: { name: string; path: string; category: string }[] = [];
const presetThumbStorageKey = 'vs.preset.thumbs';
let presetThumbs: Record<string, string> = {};
const shaderDraftKey = 'vs.shader.draft';
const shaderTargetDraftValue = 'layer-plasma';
const shaderTargetAssetPrefix = 'asset:';
let runtimeShaderOverride: string | null = null;
let currentTransitionAmount = 0;
let currentTransitionType = 0; // 0: none, 1: fade, 2: warp, 3: glitch

const audioState = {
  rms: 0,
  peak: 0,
  bands: new Array(8).fill(0),
  spectrum: new Float32Array(64),
  waveform: new Float32Array(256)
};

const gravityWells = Array.from({ length: 8 }, () => ({
  x: 0,
  y: 0,
  baseX: 0,
  baseY: 0,
  strength: 0,
  polarity: 1,
  active: false,
  phase: Math.random() * Math.PI * 2
}));
const gravityPositions = new Float32Array(16);
const gravityStrengths = new Float32Array(8);
const gravityPolarities = new Float32Array(8);
const gravityActives = new Float32Array(8);
const gravityFixedSlots = [
  { x: -0.45, y: -0.35 },
  { x: 0.45, y: -0.35 },
  { x: -0.45, y: 0.35 },
  { x: 0.45, y: 0.35 },
  { x: 0, y: -0.5 },
  { x: 0, y: 0.5 },
  { x: -0.6, y: 0 },
  { x: 0.6, y: 0 }
];

const portals = Array.from({ length: 4 }, () => ({
  x: 0,
  y: 0,
  radius: 0.2,
  active: false,
  phase: Math.random() * Math.PI * 2
}));
const portalPositions = new Float32Array(8);
const portalRadii = new Float32Array(4);
const portalActives = new Float32Array(4);

const mediaBursts = Array.from({ length: 8 }, () => ({
  x: 0,
  y: 0,
  radius: 0,
  life: 0,
  type: 0,
  active: false
}));
const mediaBurstPositions = new Float32Array(16);
const mediaBurstRadii = new Float32Array(8);
const mediaBurstTypes = new Float32Array(8);
const mediaBurstActives = new Float32Array(8);

const oscilloCapture = new Float32Array(256);

const padStates = Array.from({ length: 256 }, () => false);
const padBanks = ['A', 'B', 'C', 'D'] as const;
let activePadBank = 0;
let activePadMapBank = 0;

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

const setStatus = (message: string) => {
  statusLabel.textContent = message;
};

const recordPlaylistOverride = (layerId: string, override: Partial<LayerConfig>) => {
  if (!playlistActive) return;
  const existing = playlistOverrides[layerId] ?? {};
  const merged: Partial<LayerConfig> = { ...existing, ...override };
  if (override.params) {
    merged.params = { ...(existing.params ?? {}), ...override.params };
  }
  playlistOverrides[layerId] = merged;
};

const applyVisualMode = (modeId: string) => {
  const mode = VISUAL_MODES.find(m => m.id === modeId);
  if (!mode) return;

  // Trigger Transition Effect
  currentTransitionType = mode.transition.type === 'warp' ? 2 : mode.transition.type === 'glitch' ? 3 : 1;
  currentTransitionAmount = 1.0;

  currentProject.activeModeId = modeId;
  setStatus(`Visual Mode applied: ${mode.name}`);

  // 1. Apply Palette
  applyPaletteSelection(mode.palette.id);
  paletteSelect.value = mode.palette.id;

  // 2. Apply Audio Mappings (Mod Matrix)
  // We'll append these or replace them? User said "grouped into high-level expressions"
  // Let's replace the mod matrix for a clean "expression"
  currentProject.modMatrix = mode.audioMappings.map((mapping, index) => {
    const defaults = getTargetDefaults(mapping.target);
    return {
      id: `mod-mode-${index}`,
      source: mapping.source,
      target: mapping.target,
      amount: mapping.amount,
      curve: 'linear',
      smoothing: 0.1,
      bipolar: false,
      min: defaults.min,
      max: defaults.max
    };
  });
  renderModMatrix();

  // 3. Apply Glow/Depth (Effects)
  currentProject.effects.bloom = mode.glowDepth.glow;
  // We'll use 'blur' as a proxy for depth for now if not available
  currentProject.effects.blur = mode.glowDepth.depth * 0.2; 
  initEffects();

  // 4. Intensity Envelopes
  if (currentProject.envelopes[0]) {
    currentProject.envelopes[0].attack = mode.intensityEnvelopes.attack;
    currentProject.envelopes[0].release = mode.intensityEnvelopes.release;
    renderEnvelopeList();
  }

  // 5. Motion Template (Set macro targets for motion)
  // We'll map motionTemplate to macro-2 (Motion)
  const motionMacro = currentProject.macros.find(m => m.id === 'macro-2');
  if (motionMacro) {
    if (mode.motionTemplate === 'vortex') {
      motionMacro.value = 0.8;
    } else if (mode.motionTemplate === 'radial') {
      motionMacro.value = 0.3;
    } else {
      motionMacro.value = 0.5;
    }
    updateMacroPreviews();
  }
};

const applyPlaylistOverrides = (project: VisualSynthProject) => {
  if (!playlistActive || Object.keys(playlistOverrides).length === 0) return project;
  const activeScene =
    project.scenes.find((scene) => scene.id === project.activeSceneId) ?? project.scenes[0];
  if (!activeScene) return project;
  activeScene.layers = activeScene.layers.map((layer) => {
    const override = playlistOverrides[layer.id];
    if (!override) return layer;
    const next = { ...layer, ...override };
    if (override.params) {
      next.params = { ...(layer.params ?? {}), ...override.params };
    }
    return next;
  });
  return project;
};

const setMode = (mode: UiMode) => {
  activeMode = mode;
  const visibility = getModeVisibility(mode);
  document.body.dataset.mode = mode;
  modeButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.mode === mode);
  });
  performanceLeft.classList.toggle('hidden', !visibility.performance);
  performanceRight.classList.toggle('hidden', !visibility.performance);
  sceneLeft.classList.toggle('hidden', !visibility.scene);
  sceneRight.classList.toggle('hidden', !visibility.scene);
  designLeft.classList.toggle('hidden', !visibility.design);
  designRight.classList.toggle('hidden', !visibility.design);
  matrixLeft.classList.toggle('hidden', !visibility.matrix);
  matrixCenter.classList.toggle('hidden', !visibility.matrix);
  matrixRight?.classList.toggle('hidden', true);
  systemLeft.classList.toggle('hidden', !visibility.system);
  systemRight.classList.toggle('hidden', !visibility.system);
  presetExplorer?.classList.toggle('hidden', mode !== 'performance');
  macroHero?.classList.toggle('hidden', mode === 'matrix');
  matrixControls?.classList.toggle('hidden', mode !== 'matrix');
};

const syncTempoInputs = (value: number) => {
  const normalized = Number.isFinite(value) ? value : 120;
  tempoInput.value = String(normalized);
  transportBpmInput.value = String(normalized);
};

const loadPlaylist = () => {
  try {
    const stored = localStorage.getItem('vs.preset.playlist');
    playlist = stored ? (JSON.parse(stored) as { name: string; path: string }[]) : [];
  } catch {
    playlist = [];
  }
};

const savePlaylist = () => {
  localStorage.setItem('vs.preset.playlist', JSON.stringify(playlist));
};

const loadPresetThumbnails = () => {
  try {
    const stored = localStorage.getItem(presetThumbStorageKey);
    presetThumbs = stored ? (JSON.parse(stored) as Record<string, string>) : {};
  } catch {
    presetThumbs = {};
  }
};

const savePresetThumbnails = () => {
  localStorage.setItem(presetThumbStorageKey, JSON.stringify(presetThumbs));
};

const hashPreset = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const categorizePreset = (name: string) => {
  const key = name.toLowerCase();
  if (key.includes('dna')) return 'DNA';
  if (key.includes('particle')) return 'Particles';
  if (key.includes('sdf') || key.includes('prism')) return 'SDF';
  if (key.includes('feedback') || key.includes('trail')) return 'Feedback';
  if (key.includes('kaleido')) return 'Kaleido';
  if (key.includes('strobe')) return 'Strobe';
  if (key.includes('nebula') || key.includes('no bars')) return 'No Bars';
  return 'General';
};

const renderPresetBrowser = () => {
  presetBrowser.innerHTML = '';
  const filter = presetCategorySelect.value;
  const entries =
    filter === 'All' ? presetLibrary : presetLibrary.filter((item) => item.category === filter);
  entries.forEach((preset) => {
    const card = document.createElement('div');
    const selected = preset.path === presetSelect.value;
    card.className = `preset-card${selected ? ' selected' : ''}`;
    const thumb = document.createElement('div');
    thumb.className = 'preset-thumb';
    const cachedThumb = presetThumbs[preset.path];
    if (cachedThumb) {
      thumb.style.backgroundImage = `url('${cachedThumb}')`;
    } else {
      const hue = hashPreset(preset.name) % 360;
      thumb.style.background = `linear-gradient(135deg, hsl(${hue},70%,45%), hsl(${(hue + 60) % 360},70%,35%))`;
    }
    const name = document.createElement('div');
    name.className = 'preset-name';
    name.textContent = preset.name;
    const tag = document.createElement('div');
    tag.className = 'preset-tag';
    tag.textContent = preset.category;
    
    const auditionBtn = document.createElement('button');
    auditionBtn.className = 'preset-audition-btn';
    auditionBtn.textContent = 'Audition';
    auditionBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      void auditionPreset(preset.path);
    });

    card.appendChild(thumb);
    card.appendChild(name);
    card.appendChild(tag);
    card.appendChild(auditionBtn);
    card.addEventListener('click', () => {
      presetSelect.value = preset.path;
      renderPresetBrowser();
      setStatus(`Preset selected: ${preset.name}`);
    });
    card.addEventListener('dblclick', () => {
      void addSceneFromPreset(preset.path);
    });
    presetBrowser.appendChild(card);
  });
};

const refreshPresetCategories = () => {
  const categories = Array.from(new Set(presetLibrary.map((item) => item.category)));
  presetCategorySelect.innerHTML = '';
  const all = document.createElement('option');
  all.value = 'All';
  all.textContent = 'All';
  presetCategorySelect.appendChild(all);
  categories.sort().forEach((category) => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    presetCategorySelect.appendChild(option);
  });
  const hasDna = categories.includes('DNA');
  presetCategorySelect.value = hasDna ? 'DNA' : 'All';
};

const captureCanvasSnapshot = () => {
  try {
    return canvas.toDataURL('image/jpeg', 0.85);
  } catch {
    return null;
  }
};

const capturePresetThumbnail = async (path: string) => {
  if (!path) return;
  try {
    await new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(resolve);
      });
    });
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = 240;
    thumbCanvas.height = 135;
    const ctx = thumbCanvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
    const dataUrl = thumbCanvas.toDataURL('image/jpeg', 0.72);
    presetThumbs[path] = dataUrl;
    savePresetThumbnails();
    renderPresetBrowser();
  } catch {
    // Ignore thumbnail capture failures (likely tainted canvas).
  }
};

const crossfadeToPreset = async (path: string, name: string, fadeSeconds: number) => {
  const duration = Math.max(0, fadeSeconds);
  if (duration === 0) {
    await applyPresetPath(path, 'Playlist');
    return;
  }
  const snapshot = captureCanvasSnapshot();
  fadeOverlay.classList.remove('hidden');
  fadeOverlay.style.transitionDuration = '0s';
  fadeOverlay.style.backgroundImage = snapshot ? `url('${snapshot}')` : '';
  fadeOverlay.style.opacity = '1';
  await applyPresetPath(path, 'Playlist');
  await new Promise((resolve) => requestAnimationFrame(resolve));
  fadeOverlay.style.transitionDuration = `${duration}s`;
  fadeOverlay.style.opacity = '0';
  await new Promise((resolve) => setTimeout(resolve, duration * 1000));
  fadeOverlay.classList.add('hidden');
  fadeOverlay.style.backgroundImage = '';
  setStatus(`Playlist: ${name}`);
};

const renderPlaylist = () => {
  playlistList.innerHTML = '';
  if (playlist.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'matrix-empty';
    empty.textContent = 'No presets queued.';
    playlistList.appendChild(empty);
    return;
  }
  playlist.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'marker-row';
    const indexLabel = document.createElement('div');
    indexLabel.textContent = String(index + 1);
    const name = document.createElement('div');
    name.textContent = item.name;
    const remove = document.createElement('button');
    remove.textContent = '✕';
    remove.addEventListener('click', () => {
      playlist = playlist.filter((_entry, i) => i !== index);
      if (playlistIndex >= playlist.length) playlistIndex = 0;
      savePlaylist();
      renderPlaylist();
    });
    row.appendChild(indexLabel);
    row.appendChild(name);
    row.appendChild(remove);
    playlistList.appendChild(row);
  });
};

const stopPlaylist = () => {
  if (playlistTimer !== null) {
    window.clearInterval(playlistTimer);
    playlistTimer = null;
  }
};

const applyPresetPath = async (path: string, reason?: string) => {
  const traceId = createPresetTraceId();
  logPresetDebug(traceId, 'Loading preset', { path, reason });
  const result = await window.visualSynth.loadPreset(path);
  if (result.error) {
    setStatus(`Preset load failed: ${result.error}`);
    await ensureSafeVisuals(traceId, result.error);
    return;
  }
  if (result.project) {
    // Migrate preset if needed
    const presetMigration = await import('../shared/presetMigration');
    const migrationResult = presetMigration.migratePreset(result.project);

    if (!migrationResult.success) {
      const reasonText = migrationResult.errors.join(', ');
      setStatus(`Preset migration failed: ${reasonText}`);
      await ensureSafeVisuals(traceId, reasonText);
      return;
    }

    // Show warnings if any
    if (migrationResult.warnings.length > 0) {
      logPresetDebug(traceId, 'Preset migration warnings', migrationResult.warnings);
    }

    // Validate migrated preset
    const validationResult = presetMigration.validatePreset(migrationResult.preset);
    if (!validationResult.valid) {
      const reasonText = validationResult.errors.join(', ');
      setStatus(`Preset validation failed: ${reasonText}`);
      logPresetError(traceId, 'Preset validation failed', {
        errors: validationResult.errors,
        warnings: validationResult.warnings
      });
      await ensureSafeVisuals(traceId, reasonText);
      return;
    }
    if (validationResult.warnings.length > 0) {
      logPresetDebug(traceId, 'Preset validation warnings', validationResult.warnings);
    }

    // Apply the (possibly migrated) preset
    const migratedProject = migrationResult.preset;

    // If preset is v3, convert to v2 format for current application
    if (migratedProject.version === 3) {
      const applyResult = presetMigration.applyPresetV3(migratedProject, currentProject);
      if (applyResult.warnings.length > 0) {
        logPresetDebug(traceId, 'Preset application warnings', applyResult.warnings);
      }
      logPresetDebug(
        traceId,
        'Resolved preset project',
        serializePresetPayload({
          activeSceneId: applyResult.project?.activeSceneId,
          scenes: applyResult.project?.scenes?.map((scene: any) => ({
            id: scene.id,
            name: scene.name,
            layers: scene.layers?.map((layer: any) => ({
              id: layer.id,
              enabled: layer.enabled,
              opacity: layer.opacity,
              blendMode: layer.blendMode,
              params: layer.params
            }))
          })),
          modMatrix: applyResult.project?.modMatrix?.length ?? 0,
          macros: applyResult.project?.macros?.length ?? 0
        })
      );
      if (applyResult.project) {
        const resolvedProject = applyPlaylistOverrides(applyResult.project);
        await applyProject(resolvedProject);
      }
    } else if (migratedProject.version === 4) {
      const applyResult = presetMigration.applyPresetV4(migratedProject, currentProject);
      if (applyResult.warnings.length > 0) {
        logPresetDebug(traceId, 'Preset application warnings', applyResult.warnings);
      }
      logPresetDebug(
        traceId,
        'Resolved preset project (V4)',
        serializePresetPayload({
          activeSceneId: applyResult.project?.activeSceneId,
          scenes: applyResult.project?.scenes?.map((scene: any) => ({
            id: scene.id,
            name: scene.name,
            layers: scene.layers?.map((layer: any) => ({
              id: layer.id,
              enabled: layer.enabled,
              opacity: layer.opacity,
              blendMode: layer.blendMode,
              params: layer.params
            }))
          })),
          modMatrix: applyResult.project?.modMatrix?.length ?? 0,
          macros: applyResult.project?.macros?.length ?? 0
        })
      );
      if (applyResult.project) {
        const resolvedProject = applyPlaylistOverrides(applyResult.project);
        await applyProject(resolvedProject);
      }
    } else if (migratedProject.version === 5) {
      const applyResult = presetMigration.applyPresetV5(migratedProject, currentProject);
      if (applyResult.warnings.length > 0) {
        logPresetDebug(traceId, 'Preset application warnings', applyResult.warnings);
      }
      logPresetDebug(
        traceId,
        'Resolved performance project (V5)',
        serializePresetPayload({
          activeModeId: applyResult.project?.activeModeId,
          roleWeights: applyResult.project?.roleWeights,
          tempoSync: applyResult.project?.tempoSync,
          scenes: applyResult.project?.scenes?.length ?? 0
        })
      );
      if (applyResult.project) {
        const resolvedProject = applyPlaylistOverrides(applyResult.project);
        await applyProject(resolvedProject);
      }
    } else {
      logPresetDebug(
        traceId,
        'Resolved preset project',
        serializePresetPayload({
          activeSceneId: migratedProject.activeSceneId,
          scenes: migratedProject.scenes?.map((scene: any) => ({
            id: scene.id,
            name: scene.name,
            layers: scene.layers?.map((layer: any) => ({
              id: layer.id,
              enabled: layer.enabled,
              opacity: layer.opacity,
              blendMode: layer.blendMode,
              params: layer.params
            }))
          })),
          modMatrix: migratedProject.modMatrix?.length ?? 0,
          macros: migratedProject.macros?.length ?? 0
        })
      );
      const resolvedProject = applyPlaylistOverrides(migratedProject);
      await applyProject(resolvedProject);
    }

    const presetName = playlist.find((item) => item.path === path)?.name ?? path;
    const message = `${reason ? `${reason}: ` : ''}Preset applied: ${presetName}`;
    if (migrationResult.warnings.length > 0) {
      setStatus(`${message} (${migrationResult.warnings.length} warnings - see console)`);
    } else {
      setStatus(message);
    }
    void capturePresetThumbnail(path);
  }
};

const auditionPreset = async (path: string) => {
  setStatus('Auditioning performance...');
  await applyPresetPath(path, 'Audition');
  
  // Audition automatically sets tempo and mode
  if (currentProject.tempoSync) {
    syncTempoInputs(currentProject.tempoSync.bpm);
    bpmSource = currentProject.tempoSync.source;
    bpmSourceSelect.value = bpmSource;
  }
  
  if (currentProject.activeModeId) {
    visualModeSelect.value = currentProject.activeModeId;
    applyVisualMode(currentProject.activeModeId);
  }
};

const advancePlaylist = async () => {
  if (playlist.length === 0) return;
  const item = playlist[playlistIndex];
  playlistIndex = (playlistIndex + 1) % playlist.length;
  const fadeSeconds = Math.max(0, Number(playlistFadeSeconds.value) || 0);
  if (fadeSeconds > 0) {
    setStatus(`Transitioning to ${item.name}...`);
    await crossfadeToPreset(item.path, item.name, fadeSeconds);
  } else {
    await applyPresetPath(item.path, 'Playlist');
  }
};

const updateSummaryChips = () => {
  const modCount = currentProject.modMatrix?.length ?? 0;
  summaryMods.textContent = `Mods: ${modCount}`;
  summaryMods.classList.toggle('hidden', modCount === 0);

  const effects = currentProject.effects;
  const fxActive = Boolean(
    effects?.enabled &&
      (effects.bloom > 0 ||
        effects.blur > 0 ||
        effects.chroma > 0 ||
        effects.posterize > 0 ||
        effects.kaleidoscope > 0 ||
        effects.feedback > 0 ||
        effects.persistence > 0)
  );
  summaryFx.textContent = fxActive ? 'FX: Active' : 'FX: Off';
  summaryFx.classList.toggle('hidden', !effects);

  const markerCount = currentProject.timelineMarkers?.length ?? 0;
  summaryAuto.textContent = `Auto: ${markerCount}`;
  summaryAuto.classList.toggle('hidden', markerCount === 0);
};

const setVisualizerMode = (mode: typeof visualizerMode) => {
  visualizerMode = mode;
  visualizerModeSelect.value = mode;
  currentProject.visualizer.mode = mode;
  visualizerEnabledToggle.checked = currentProject.visualizer.enabled;
  visualizerOpacityInput.value = String(currentProject.visualizer.opacity);
  visualizerMacroToggle.checked = currentProject.visualizer.macroEnabled;
  visualizerMacroSelect.value = String(currentProject.visualizer.macroId);
  visualizerMacroSelect.disabled = !currentProject.visualizer.macroEnabled;
  visualizerCanvas.classList.toggle('hidden', mode === 'off' || !currentProject.visualizer.enabled);
};

const syncVisualizerFromProject = () => {
  visualizerMode = currentProject.visualizer.mode;
  visualizerModeSelect.value = visualizerMode;
  visualizerEnabledToggle.checked = currentProject.visualizer.enabled;
  visualizerOpacityInput.value = String(currentProject.visualizer.opacity);
  visualizerMacroToggle.checked = currentProject.visualizer.macroEnabled;
  visualizerMacroSelect.value = String(currentProject.visualizer.macroId);
  visualizerMacroSelect.disabled = !currentProject.visualizer.macroEnabled;
  visualizerCanvas.classList.toggle('hidden', visualizerMode === 'off' || !currentProject.visualizer.enabled);
};

const getShaderAssetIdFromTarget = (value: string) =>
  value.startsWith(shaderTargetAssetPrefix) ? value.slice(shaderTargetAssetPrefix.length) : null;

const getShaderAssetById = (assetId: string | null) =>
  assetId ? currentProject.assets.find((asset) => asset.id === assetId && asset.kind === 'shader') ?? null : null;

const refreshShaderTargetOptions = () => {
  const previousValue = shaderTargetSelect.value;
  shaderTargetSelect.innerHTML = '';
  const draftOption = document.createElement('option');
  draftOption.value = shaderTargetDraftValue;
  draftOption.textContent = 'Plasma Draft';
  shaderTargetSelect.appendChild(draftOption);

  const shaderAssets = currentProject.assets
    .filter((asset) => asset.kind === 'shader')
    .sort((a, b) => a.name.localeCompare(b.name));

  shaderAssets.forEach((asset) => {
    const option = document.createElement('option');
    option.value = `${shaderTargetAssetPrefix}${asset.id}`;
    option.textContent = `Shader: ${asset.name}`;
    shaderTargetSelect.appendChild(option);
  });

  const hasPrevious = Array.from(shaderTargetSelect.options).some(
    (option) => option.value === previousValue
  );
  shaderTargetSelect.value = hasPrevious ? previousValue : shaderTargetDraftValue;
};

const loadShaderSourceForAsset = async (asset: AssetItem) => {
  if (asset.options?.shaderSource) return asset.options.shaderSource;
  if (!asset.path) return null;
  try {
    const response = await fetch(toFileUrl(asset.path));
    if (!response.ok) return null;
    const source = await response.text();
    asset.options = { ...(asset.options ?? {}), shaderSource: source };
    return source;
  } catch {
    return null;
  }
};

const applyPlasmaShaderSource = (source: string | null, label: string) => {
  if (typeof (renderer as { setPlasmaShaderSource?: (s: string | null) => { ok: boolean } })
    .setPlasmaShaderSource !== 'function') {
    setStatus(`Shader system unavailable (${label}).`);
    shaderStatus.textContent = 'Shader system unavailable in this build.';
    return false;
  }
  const result = renderer.setPlasmaShaderSource(source);
  if (!result.ok) {
    setStatus(`Shader compile failed (${label}).`);
    shaderStatus.textContent = `Shader compile failed for ${label}.`;
    return false;
  }
  shaderStatus.textContent = `Shader applied (${label}).`;
  return true;
};

const loadShaderDraft = () => {
  try {
    refreshShaderTargetOptions();
    const stored = localStorage.getItem(shaderDraftKey);
    if (stored) {
      const parsed = JSON.parse(stored) as { target: string; code: string };
      const hasTarget = Array.from(shaderTargetSelect.options).some(
        (option) => option.value === parsed.target
      );
      shaderTargetSelect.value = hasTarget ? parsed.target : shaderTargetDraftValue;
      shaderEditor.value = parsed.code;
      shaderStatus.textContent = 'Draft loaded.';
    }
  } catch {
    shaderStatus.textContent = 'Draft load failed.';
  }
};

const saveShaderDraft = () => {
  const payload = {
    target: shaderTargetSelect.value,
    code: shaderEditor.value
  };
  localStorage.setItem(shaderDraftKey, JSON.stringify(payload));
  shaderStatus.textContent = 'Draft saved locally.';
};

const syncShaderEditorForTarget = async () => {
  const assetId = getShaderAssetIdFromTarget(shaderTargetSelect.value);
  if (!assetId) {
    const stored = localStorage.getItem(shaderDraftKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as { code?: string };
        if (parsed?.code) {
          shaderEditor.value = parsed.code;
        }
      } catch {
        // ignore
      }
    }
    return;
  }
  const asset = getShaderAssetById(assetId);
  if (!asset) {
    shaderStatus.textContent = 'Shader asset not found.';
    return;
  }
  const source = await loadShaderSourceForAsset(asset);
  if (!source) {
    shaderStatus.textContent = 'Shader source missing.';
    return;
  }
  shaderEditor.value = source;
  shaderStatus.textContent = `Loaded shader: ${asset.name}`;
};

const getUniqueShaderName = (base: string) => {
  const existing = new Set(currentProject.assets.map((asset) => asset.name));
  if (!existing.has(base)) return base;
  let index = 2;
  let candidate = `${base} ${index}`;
  while (existing.has(candidate)) {
    index += 1;
    candidate = `${base} ${index}`;
  }
  return candidate;
};

const validateCustomPlasmaSource = (code: string) => {
  const signature = /vec3\s+customPlasma\s*\(\s*vec2\s+\w+\s*,\s*float\s+\w+\s*\)/;
  if (!signature.test(code)) {
    return 'Expected signature: vec3 customPlasma(vec2 uv, float t).';
  }
  return null;
};

const assignShaderToPlasmaLayer = (shaderId: string | null) => {
  const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
  if (!scene) return;
  const layer = scene.layers.find((item) => item.id === 'layer-plasma');
  if (!layer) return;
  if (!layer.params) layer.params = {};
  if (shaderId) {
    layer.params.shaderId = shaderId;
  } else {
    delete layer.params.shaderId;
  }
};

const syncPerformanceToggles = () => {
  const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
  if (!scene) return;
  const plasmaLayer = scene.layers.find((layer) => layer.id === 'layer-plasma');
  const spectrumLayer = scene.layers.find((layer) => layer.id === 'layer-spectrum');
  if (plasmaLayer) perfTogglePlasma.checked = plasmaLayer.enabled;
  if (spectrumLayer) perfToggleSpectrum.checked = spectrumLayer.enabled;
};

const initSpectrumHint = () => {
  const dismissed = localStorage.getItem('visualsynth.spectrumHintDismissed') === '1';
  spectrumHint.classList.toggle('hidden', dismissed);
};

const updateSafeModeBanner = () => {
  if (safeModeReasons.length === 0) {
    safeModeBanner.classList.add('hidden');
    return;
  }
  safeModeBanner.textContent = `Safe mode: ${safeModeReasons.join(', ')}`;
  safeModeBanner.classList.remove('hidden');
};

const getWebglDiagnostics = () => {
  const lines: string[] = [];
  lines.push(`User Agent: ${navigator.userAgent}`);
  const tempCanvas = document.createElement('canvas');
  let gl2: WebGL2RenderingContext | null = null;
  let gl1: WebGLRenderingContext | null = null;
  try {
    gl2 = tempCanvas.getContext('webgl2');
  } catch {
    gl2 = null;
  }
  try {
    gl1 = tempCanvas.getContext('webgl');
  } catch {
    gl1 = null;
  }
  lines.push(`WebGL2: ${gl2 ? 'available' : 'unavailable'}`);
  lines.push(`WebGL1: ${gl1 ? 'available' : 'unavailable'}`);
  const gl = gl2 ?? gl1;
  if (gl) {
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const vendor = debugInfo
      ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)
      : gl.getParameter(gl.VENDOR);
    const renderer = debugInfo
      ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
      : gl.getParameter(gl.RENDERER);
    lines.push(`Vendor: ${vendor}`);
    lines.push(`Renderer: ${renderer}`);
    lines.push(`Version: ${gl.getParameter(gl.VERSION)}`);
    lines.push(`GLSL: ${gl.getParameter(gl.SHADING_LANGUAGE_VERSION)}`);
    lines.push(`Max Texture: ${gl.getParameter(gl.MAX_TEXTURE_SIZE)}`);
    lines.push(`Max Viewport: ${gl.getParameter(gl.MAX_VIEWPORT_DIMS)}`);
  }
  return { lines, hasWebgl2: Boolean(gl2), hasWebgl1: Boolean(gl1) };
};

const updateWebglDiagnostics = () => {
  const { lines, hasWebgl2, hasWebgl1 } = getWebglDiagnostics();
  if (webglInitError) {
    lines.push(`Init Error: ${webglInitError}`);
  }
  if (gpuLabel) {
    gpuLabel.textContent = `GPU: ${hasWebgl2 ? 'WebGL2' : hasWebgl1 ? 'WebGL1' : 'Unavailable'}`;
  }
  if (webglDiag) {
    webglDiag.textContent = lines.join('\n');
  }
};

const modSourceOptions = [
  { id: 'audio.rms', label: 'Audio RMS' },
  { id: 'audio.peak', label: 'Audio Peak' },
  { id: 'audio.strobe', label: 'Strobe' },
  { id: 'tempo.bpm', label: 'Tempo BPM' },
  { id: 'lfo-1', label: 'LFO 1' },
  { id: 'lfo-2', label: 'LFO 2' },
  { id: 'lfo-3', label: 'LFO 3' },
  { id: 'lfo-4', label: 'LFO 4' },
  { id: 'lfo-3', label: 'LFO 3' },
  { id: 'lfo-4', label: 'LFO 4' },
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
  { id: 'layer-plasma.speed', label: 'Plasma Speed', min: 0.1, max: 3 },
  { id: 'layer-plasma.scale', label: 'Plasma Scale', min: 0.1, max: 3 },
  { id: 'layer-spectrum.opacity', label: 'Spectrum Opacity', min: 0, max: 1 },
  { id: 'layer-origami.opacity', label: 'Origami Opacity', min: 0, max: 1 },
  { id: 'layer-origami.speed', label: 'Origami Speed', min: 0.1, max: 3 },
  { id: 'layer-glyph.opacity', label: 'Glyph Opacity', min: 0, max: 1 },
  { id: 'layer-glyph.speed', label: 'Glyph Speed', min: 0.1, max: 3 },
  { id: 'layer-crystal.opacity', label: 'Crystal Opacity', min: 0, max: 1 },
  { id: 'layer-crystal.scale', label: 'Crystal Scale', min: 0.1, max: 3 },
  { id: 'layer-crystal.speed', label: 'Crystal Speed', min: 0.1, max: 3 },
  { id: 'layer-inkflow.opacity', label: 'Ink Flow Opacity', min: 0, max: 1 },
  { id: 'layer-inkflow.speed', label: 'Ink Flow Speed', min: 0.1, max: 3 },
  { id: 'layer-inkflow.scale', label: 'Ink Flow Scale', min: 0.1, max: 3 },
  { id: 'layer-topo.opacity', label: 'Topo Opacity', min: 0, max: 1 },
  { id: 'layer-topo.scale', label: 'Topo Scale', min: 0.1, max: 3 },
  { id: 'layer-topo.elevation', label: 'Topo Elevation', min: 0, max: 1 },
  { id: 'layer-weather.opacity', label: 'Weather Opacity', min: 0, max: 1 },
  { id: 'layer-weather.speed', label: 'Weather Speed', min: 0.1, max: 3 },
  { id: 'layer-portal.opacity', label: 'Portal Opacity', min: 0, max: 1 },
  { id: 'layer-media.opacity', label: 'Media Opacity', min: 0, max: 1 },
  { id: 'layer-oscillo.opacity', label: 'Oscillo Opacity', min: 0, max: 1 },
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
  { id: 'layer-origami.enabled', label: 'Origami Enabled' },
  { id: 'layer-glyph.enabled', label: 'Glyph Enabled' },
  { id: 'layer-crystal.enabled', label: 'Crystal Enabled' },
  { id: 'layer-inkflow.enabled', label: 'Ink Flow Enabled' },
  { id: 'layer-topo.enabled', label: 'Topo Enabled' },
  { id: 'layer-weather.enabled', label: 'Weather Enabled' },
  { id: 'layer-portal.enabled', label: 'Portal Enabled' },
  { id: 'layer-media.enabled', label: 'Media Enabled' },
  { id: 'layer-oscillo.enabled', label: 'Oscillo Enabled' },
  { id: 'layer-plasma.opacity', label: 'Plasma Opacity' },
  { id: 'layer-plasma.speed', label: 'Plasma Speed' },
  { id: 'layer-plasma.scale', label: 'Plasma Scale' },
  { id: 'layer-spectrum.opacity', label: 'Spectrum Opacity' },
  { id: 'layer-origami.opacity', label: 'Origami Opacity' },
  { id: 'layer-origami.speed', label: 'Origami Speed' },
  { id: 'layer-glyph.opacity', label: 'Glyph Opacity' },
  { id: 'layer-glyph.speed', label: 'Glyph Speed' },
  { id: 'layer-crystal.opacity', label: 'Crystal Opacity' },
  { id: 'layer-crystal.scale', label: 'Crystal Scale' },
  { id: 'layer-crystal.speed', label: 'Crystal Speed' },
  { id: 'layer-inkflow.opacity', label: 'Ink Flow Opacity' },
  { id: 'layer-inkflow.speed', label: 'Ink Flow Speed' },
  { id: 'layer-inkflow.scale', label: 'Ink Flow Scale' },
  { id: 'layer-topo.opacity', label: 'Topo Opacity' },
  { id: 'layer-topo.scale', label: 'Topo Scale' },
  { id: 'layer-topo.elevation', label: 'Topo Elevation' },
  { id: 'layer-weather.opacity', label: 'Weather Opacity' },
  { id: 'layer-weather.speed', label: 'Weather Speed' },
  { id: 'layer-portal.opacity', label: 'Portal Opacity' },
  { id: 'layer-media.opacity', label: 'Media Opacity' },
  { id: 'layer-media.burst', label: 'Media Burst' },
  { id: 'layer-oscillo.opacity', label: 'Oscillo Opacity' },
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

const cloneValue = <T>(value: T): T => {
  if (value === undefined) return value;
  return JSON.parse(JSON.stringify(value)) as T;
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const ensureProjectMacros = (project: VisualSynthProject) => {
  if (!project.macros || project.macros.length === 0) {
    project.macros = cloneValue(DEFAULT_PROJECT.macros);
    return;
  }
  const defaultsById = new Map(DEFAULT_PROJECT.macros.map((macro) => [macro.id, macro]));
  project.macros = project.macros.map((macro) => {
    const fallback = defaultsById.get(macro.id);
    if (!fallback) return macro;
    const targets = Array.isArray(macro.targets) ? macro.targets : [];
    const shouldFillTargets = targets.length === 0 && ['macro-1', 'macro-2', 'macro-3', 'macro-4'].includes(macro.id);
    return {
      ...macro,
      name: macro.name || fallback.name,
      targets: shouldFillTargets ? cloneValue(fallback.targets) : targets
    };
  });
};

const ensureProjectPalettes = (project: VisualSynthProject) => {
  if (!project.palettes || project.palettes.length === 0) {
    project.palettes = cloneValue(DEFAULT_PROJECT.palettes);
  }
  if (!project.activePaletteId) {
    project.activePaletteId = project.palettes[0]?.id ?? DEFAULT_PROJECT.activePaletteId;
  }
};

const ensureProjectExpressiveFx = (project: VisualSynthProject) => {
  const fallback = DEFAULT_PROJECT.expressiveFx;
  const current = project.expressiveFx;
  if (!current) {
    project.expressiveFx = cloneValue(fallback);
    return;
  }
  project.expressiveFx = {
    energyBloom: {
      ...fallback.energyBloom,
      ...current.energyBloom,
      intentBinding: { ...fallback.energyBloom.intentBinding, ...(current.energyBloom?.intentBinding ?? {}) },
      expert: { ...fallback.energyBloom.expert, ...(current.energyBloom?.expert ?? {}) }
    },
    radialGravity: {
      ...fallback.radialGravity,
      ...current.radialGravity,
      intentBinding: { ...fallback.radialGravity.intentBinding, ...(current.radialGravity?.intentBinding ?? {}) },
      expert: { ...fallback.radialGravity.expert, ...(current.radialGravity?.expert ?? {}) }
    },
    motionEcho: {
      ...fallback.motionEcho,
      ...current.motionEcho,
      intentBinding: { ...fallback.motionEcho.intentBinding, ...(current.motionEcho?.intentBinding ?? {}) },
      expert: { ...fallback.motionEcho.expert, ...(current.motionEcho?.expert ?? {}) }
    },
    spectralSmear: {
      ...fallback.spectralSmear,
      ...current.spectralSmear,
      intentBinding: { ...fallback.spectralSmear.intentBinding, ...(current.spectralSmear?.intentBinding ?? {}) },
      expert: { ...fallback.spectralSmear.expert, ...(current.spectralSmear?.expert ?? {}) }
    }
  };
};

const ensureProjectModulators = (project: VisualSynthProject) => {
  const defaultLfos = cloneValue(DEFAULT_PROJECT.lfos);
  const defaultEnvelopes = cloneValue(DEFAULT_PROJECT.envelopes);
  const defaultSampleHold = cloneValue(DEFAULT_PROJECT.sampleHold);
  project.lfos = project.lfos?.length ? project.lfos : defaultLfos;
  project.envelopes = project.envelopes?.length ? project.envelopes : defaultEnvelopes;
  project.sampleHold = project.sampleHold?.length ? project.sampleHold : defaultSampleHold;
  if (project.lfos.length < defaultLfos.length) {
    project.lfos = [...project.lfos, ...defaultLfos.slice(project.lfos.length)];
  }
  if (project.envelopes.length < defaultEnvelopes.length) {
    project.envelopes = [
      ...project.envelopes,
      ...defaultEnvelopes.slice(project.envelopes.length)
    ];
  }
  if (project.sampleHold.length < defaultSampleHold.length) {
    project.sampleHold = [
      ...project.sampleHold,
      ...defaultSampleHold.slice(project.sampleHold.length)
    ];
  }
};

const resolveExpressiveMacro = (
  intent: SceneIntent | undefined,
  macro: number,
  binding: { enabled: boolean; intent: SceneIntent; amount: number }
) => {
  let value = macro;
  if (binding?.enabled && intent && binding.intent === intent) {
    value = clamp01(value + binding.amount);
  }
  return clamp01(value);
};

const getDefaultRoleForLayerId = (layerId: string) => {
  if (layerId === 'layer-plasma') return 'core';
  if (layerId === 'layer-spectrum') return 'support';
  if (layerId === 'layer-origami') return 'support';
  if (layerId === 'layer-glyph') return 'support';
  if (layerId === 'layer-crystal') return 'support';
  if (layerId === 'layer-inkflow') return 'atmosphere';
  if (layerId === 'layer-topo') return 'atmosphere';
  if (layerId === 'layer-weather') return 'atmosphere';
  if (layerId === 'layer-portal') return 'atmosphere';
  if (layerId === 'layer-media') return 'support';
  if (layerId === 'layer-oscillo') return 'support';
  return 'support';
};

const normalizeSceneLayerRoles = (scene: SceneConfig) => {
  let coreAssigned = false;
  scene.layers.forEach((layer, index) => {
    const nextRole = layer.role ?? getDefaultRoleForLayerId(layer.id);
    if (nextRole === 'core') {
      if (coreAssigned) {
        layer.role = 'support';
      } else {
        layer.role = 'core';
        coreAssigned = true;
      }
      return;
    }
    layer.role = nextRole;
    if (!coreAssigned && index === scene.layers.length - 1) {
      const firstEnabled = scene.layers.find((item) => item.enabled) ?? scene.layers[0];
      if (firstEnabled) {
        firstEnabled.role = 'core';
        coreAssigned = true;
      }
    }
  });
  const coreIndex = scene.layers.findIndex((layer) => layer.role === 'core');
  if (coreIndex >= 0 && coreIndex !== scene.layers.length - 1) {
    const [coreLayer] = scene.layers.splice(coreIndex, 1);
    scene.layers.push(coreLayer);
  }
};

const ensureSceneDefaults = (scene: SceneConfig) => {
  scene.scene_id = scene.scene_id ?? scene.id;
  scene.intent = scene.intent ?? 'ambient';
  scene.duration = typeof scene.duration === 'number' ? scene.duration : 0;
  scene.transition_in = { ...DEFAULT_SCENE_TRANSITION, ...(scene.transition_in ?? {}) };
  scene.transition_out = { ...DEFAULT_SCENE_TRANSITION, ...(scene.transition_out ?? {}) };
  scene.trigger = { ...DEFAULT_SCENE_TRIGGER, ...(scene.trigger ?? {}) };
  scene.assigned_layers = {
    core: scene.assigned_layers?.core ?? [...DEFAULT_SCENE_ROLES.core],
    support: scene.assigned_layers?.support ?? [...DEFAULT_SCENE_ROLES.support],
    atmosphere: scene.assigned_layers?.atmosphere ?? [...DEFAULT_SCENE_ROLES.atmosphere]
  };
  normalizeSceneLayerRoles(scene);
  return scene;
};

const ensureProjectScenes = (project: VisualSynthProject) => {
  project.scenes = project.scenes.map((scene) => ensureSceneDefaults(scene));
  if (!project.activeSceneId && project.scenes.length > 0) {
    project.activeSceneId = project.scenes[0].id;
  }
};

const presetDebugEnabled = () => {
  try {
    return Boolean((window as any).__VS_PRESET_DEBUG) || localStorage.getItem('vs.presetDebug') === '1';
  } catch {
    return Boolean((window as any).__VS_PRESET_DEBUG);
  }
};

const createPresetTraceId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `preset-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const serializePresetPayload = (payload: unknown, maxLength = 5000) => {
  try {
    const json = JSON.stringify(payload, null, 2);
    if (json.length <= maxLength) return json;
    return `${json.slice(0, maxLength)}\n...<truncated>`;
  } catch {
    return String(payload);
  }
};

const logPresetDebug = (traceId: string, message: string, payload?: unknown) => {
  if (!presetDebugEnabled()) return;
  if (payload !== undefined) {
    console.debug(`[Preset][${traceId}] ${message}`, payload);
  } else {
    console.debug(`[Preset][${traceId}] ${message}`);
  }
};

const logPresetError = (traceId: string, message: string, payload?: unknown) => {
  if (payload !== undefined) {
    console.error(`[Preset][${traceId}] ${message}`, payload);
  } else {
    console.error(`[Preset][${traceId}] ${message}`);
  }
};

const ensureSafeVisuals = async (traceId: string, reason: string) => {
  logPresetError(traceId, 'Fallback to safe visuals', { reason });
  if (projectSchema.safeParse(currentProject).success) {
    setStatus(`Preset failed: ${reason}. Kept current visuals.`);
    return;
  }
  await applyProject(DEFAULT_PROJECT);
  setStatus(`Preset failed: ${reason}. Applied safe default visuals.`);
};

const getNextAssetId = () => {
  let candidate = `asset-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  while (currentProject.assets.some((asset) => asset.id === candidate)) {
    candidate = `asset-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }
  return candidate;
};

const getNextSceneId = () => {
  const used = new Set(currentProject.scenes.map((scene) => scene.id));
  let index = currentProject.scenes.length + 1;
  let id = `scene-${index}`;
  while (used.has(id)) {
    index += 1;
    id = `scene-${index}`;
  }
  return id;
};

const getUniqueSceneName = (base: string) => {
  const used = new Set(currentProject.scenes.map((scene) => scene.name));
  if (!used.has(base)) return base;
  let counter = 2;
  let name = `${base} ${counter}`;
  while (used.has(name)) {
    counter += 1;
    name = `${base} ${counter}`;
  }
  return name;
};

const createBlankScene = (): SceneConfig => {
  const template = DEFAULT_PROJECT.scenes[0];
  const baseLayer = template.layers[0];
  const id = getNextSceneId();
  return {
    id,
    scene_id: id,
    name: getUniqueSceneName('Blank Scene'),
    intent: 'ambient',
    duration: 0,
    transition_in: { ...DEFAULT_SCENE_TRANSITION },
    transition_out: { ...DEFAULT_SCENE_TRANSITION },
    trigger: { ...DEFAULT_SCENE_TRIGGER },
    assigned_layers: {
      core: baseLayer ? [baseLayer.id] : [],
      support: [],
      atmosphere: []
    },
    layers: baseLayer
      ? [
          {
            ...cloneLayerConfig(baseLayer),
            enabled: true
          }
        ]
      : []
  };
};

const addSceneToProject = (scene: SceneConfig, activate = false) => {
  currentProject.scenes = [...currentProject.scenes, scene];
  refreshSceneSelect();
  if (activate) applyScene(scene.id);
};

const removeScene = (sceneId: string) => {
  if (currentProject.scenes.length <= 1) {
    setStatus('At least one scene is required.');
    return;
  }
  const nextScenes = currentProject.scenes.filter((scene) => scene.id !== sceneId);
  if (nextScenes.length === currentProject.scenes.length) return;
  currentProject.scenes = nextScenes;
  const nextActive = currentProject.activeSceneId === sceneId
    ? nextScenes[0]?.id
    : currentProject.activeSceneId;
  if (nextActive) {
    currentProject.activeSceneId = nextActive;
    applyScene(nextActive);
  } else {
    refreshSceneSelect();
  }
  renderSceneStrip();
  setStatus('Scene removed.');
};

const updateOutputResolution = () => {
  const width = Math.round(OUTPUT_BASE_WIDTH * outputConfig.scale);
  const height = Math.round(OUTPUT_BASE_HEIGHT * outputConfig.scale);
  outputResolutionLabel.textContent = `Output: ${width} x ${height}`;
};

const updateOutputUI = () => {
  outputToggleButton.textContent = outputOpen ? 'Close Output' : 'Open Output';
  outputFullscreenToggle.checked = outputConfig.fullscreen;
  outputScaleSelect.value = String(outputConfig.scale);
  outputRouteSelect.value = outputOpen ? 'output' : 'preview';
  guardrailHint.textContent = `Output scale: ${Math.round(outputConfig.scale * 100)}%`;
  updateOutputResolution();
};

const setSceneStripView = (view: 'cards' | 'list') => {
  sceneStripView = view;
  localStorage.setItem('vs.sceneStrip.view', view);
  sceneStripCards.classList.toggle('hidden', view !== 'cards');
  sceneStripList.classList.toggle('hidden', view !== 'list');
  sceneStripViewButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.sceneView === view);
  });
};

const renderSceneStrip = () => {
  sceneStripCards.innerHTML = '';
  sceneStripList.innerHTML = '';
  if (currentProject.scenes.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'matrix-empty';
    empty.textContent = 'No scenes available.';
    sceneStripCards.appendChild(empty);
    sceneStripList.appendChild(empty.cloneNode(true));
    return;
  }

  currentProject.scenes.forEach((scene) => {
    const isActive = scene.id === currentProject.activeSceneId;
    const isSelected = scene.id === (selectedSceneId ?? currentProject.activeSceneId);
    const layerCount = scene.layers.length;

    const card = document.createElement('div');
    card.className = `scene-card${isActive ? ' active' : ''}${isSelected ? ' selected' : ''}`;
    const title = document.createElement('div');
    title.className = 'scene-card-title';
    title.textContent = scene.name;
    const meta = document.createElement('div');
    meta.className = 'scene-card-meta';
    meta.textContent = `${layerCount} layer${layerCount === 1 ? '' : 's'}`;
    const remove = document.createElement('button');
    remove.className = 'scene-remove';
    remove.textContent = '✕';
    remove.addEventListener('click', (event) => {
      event.stopPropagation();
      if (!window.confirm(`Remove scene "${scene.name}"?`)) return;
      removeScene(scene.id);
    });
    card.appendChild(title);
    card.appendChild(meta);
    card.appendChild(remove);
    card.addEventListener('click', () => {
      selectedSceneId = scene.id;
      renderSceneStrip();
      setStatus(`Scene selected: ${scene.name}`);
    });
    sceneStripCards.appendChild(card);

    const row = document.createElement('div');
    row.className = `scene-list-row${isActive ? ' active' : ''}${isSelected ? ' selected' : ''}`;
    const name = document.createElement('div');
    name.className = 'scene-list-name';
    name.textContent = scene.name;
    const rowMeta = document.createElement('div');
    rowMeta.className = 'scene-list-meta';
    rowMeta.textContent = `${layerCount} layer${layerCount === 1 ? '' : 's'}`;
    const rowRemove = document.createElement('button');
    rowRemove.className = 'scene-remove';
    rowRemove.textContent = '✕';
    rowRemove.addEventListener('click', (event) => {
      event.stopPropagation();
      if (!window.confirm(`Remove scene "${scene.name}"?`)) return;
      removeScene(scene.id);
    });
    row.appendChild(name);
    row.appendChild(rowMeta);
    row.appendChild(rowRemove);
    row.addEventListener('click', () => {
      selectedSceneId = scene.id;
      renderSceneStrip();
      setStatus(`Scene selected: ${scene.name}`);
    });
    sceneStripList.appendChild(row);
  });
};

const renderSceneTimeline = () => {
  if (!sceneTimelineTrack) return;
  renderSceneTimelineItems({
    project: currentProject,
    track: sceneTimelineTrack,
    status: sceneTimelineStatus,
    onSelect: (sceneId, sceneName) => {
      applyScene(sceneId);
      setStatus(`Scene switched: ${sceneName}`);
    },
    onRemove: (sceneId, sceneName) => {
      if (!window.confirm(`Remove scene \"${sceneName}\"?`)) return;
      removeScene(sceneId);
    }
  });
};

const updateSceneTimelineProgress = (blendSnapshot: { mix: number; inTransition: boolean } | null) => {
  if (!sceneTimelineTrack) return;
  const activeScene = currentProject.scenes.find((scene) => scene.id === currentProject.activeSceneId);
  if (!activeScene) return;
  const progress = sceneManager.getActiveSceneProgress(transportTimeMs);
  const items = Array.from(sceneTimelineTrack.querySelectorAll<HTMLDivElement>('.scene-timeline-item'));
  items.forEach((item) => {
    const isActive = item.dataset.sceneId === activeScene.id;
    const progressEl = item.querySelector<HTMLDivElement>('.scene-timeline-progress');
    if (!progressEl) return;
    if (!isActive) {
      progressEl.style.width = '0%';
      return;
    }
    if (progress) {
      progressEl.style.width = `${Math.min(100, progress.progress * 100)}%`;
    } else {
      progressEl.style.width = blendSnapshot?.inTransition ? `${Math.min(100, blendSnapshot.mix * 100)}%` : '100%';
    }
  });

  if (sceneTimelineStatus) {
    if (blendSnapshot?.inTransition) {
      sceneTimelineStatus.textContent = 'Transitioning...';
      return;
    }
    if (progress) {
      sceneTimelineStatus.textContent = `Active: ${activeScene.name} • ${formatDurationMs(progress.remainingMs)} left`;
      return;
    }
    sceneTimelineStatus.textContent = `Active: ${activeScene.name}`;
  }
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
  if (!selectedSceneId) {
    selectedSceneId = currentProject.activeSceneId;
  }
  renderSceneStrip();
  renderSceneTimeline();
};

const moveLayer = (sceneId: string, layerId: string, direction: -1 | 1) => {
  const scene = currentProject.scenes.find((item) => item.id === sceneId);
  if (!scene) return;
  const index = scene.layers.findIndex((layer) => layer.id === layerId);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= scene.layers.length) return;
  scene.layers = reorderLayers(scene, index, nextIndex);
  normalizeSceneLayerRoles(scene);
  renderLayerList();
};

const removeLayer = (sceneId: string, layerId: string) => {
  const scene = currentProject.scenes.find((item) => item.id === sceneId);
  if (!scene) return;
  const nextLayers = scene.layers.filter((layer) => layer.id !== layerId);
  if (nextLayers.length === scene.layers.length) return;
  if (nextLayers.length === 0) {
    setStatus('Scenes must contain at least one layer.');
    return;
  }
  scene.layers = nextLayers;
  normalizeSceneLayerRoles(scene);
  renderLayerList();
  setStatus(`Layer removed: ${layerId}`);
};

const renderLayerList = () => {
  // Clear all layer lists
  layerList.innerHTML = '';
  layerListScene.innerHTML = '';
  if (layerListDesign) layerListDesign.innerHTML = '';

  const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
  if (!scene) return;

  // Count modulation connections for each layer
  const getModCountForLayer = (layerId: string): number => {
    const prefix = `${layerId}.`;
    return currentProject.modMatrix.filter((conn) => conn.target.startsWith(prefix)).length;
  };

  // Count MIDI mappings for each layer
  const getMidiCountForLayer = (layerId: string): number => {
    return currentProject.midiMappings.filter(map => map.target.startsWith(layerId)).length;
  };

  scene.layers.forEach((layer, index) => {
    const createLayerRow = (targetList: HTMLDivElement) => {
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
        recordPlaylistOverride(layer.id, { enabled: checkbox.checked });
        if (layer.id === 'layer-plasma') plasmaToggle = layerList.querySelector(`[data-learn-target="layer-plasma.enabled"]`) as HTMLInputElement;
        if (layer.id === 'layer-spectrum') spectrumToggle = layerList.querySelector(`[data-learn-target="layer-spectrum.enabled"]`) as HTMLInputElement;
        if (layer.id === 'layer-origami') origamiToggle = layerList.querySelector(`[data-learn-target="layer-origami.enabled"]`) as HTMLInputElement;
        if (layer.id === 'layer-glyph') glyphToggle = layerList.querySelector(`[data-learn-target="layer-glyph.enabled"]`) as HTMLInputElement;
        if (layer.id === 'layer-crystal') crystalToggle = layerList.querySelector(`[data-learn-target="layer-crystal.enabled"]`) as HTMLInputElement;
        if (layer.id === 'layer-inkflow') inkToggle = layerList.querySelector(`[data-learn-target="layer-inkflow.enabled"]`) as HTMLInputElement;
        if (layer.id === 'layer-topo') topoToggle = layerList.querySelector(`[data-learn-target="layer-topo.enabled"]`) as HTMLInputElement;
        if (layer.id === 'layer-weather') weatherToggle = layerList.querySelector(`[data-learn-target="layer-weather.enabled"]`) as HTMLInputElement;
        if (layer.id === 'layer-portal') portalToggle = layerList.querySelector(`[data-learn-target="layer-portal.enabled"]`) as HTMLInputElement;
        if (layer.id === 'layer-oscillo') oscilloToggle = layerList.querySelector(`[data-learn-target="layer-oscillo.enabled"]`) as HTMLInputElement;
        syncPerformanceToggles();
        setStatus(`${layer.name} ${checkbox.checked ? 'enabled' : 'disabled'}`);
      });
    const text = document.createElement('span');
    text.textContent = layer.name;
    if (!layer.role) {
      layer.role = getLayerRole(layer);
    }
    const roleBadge = document.createElement('span');
    roleBadge.className = `layer-role-badge ${layer.role}`;
    roleBadge.textContent = layer.role.toUpperCase();
    label.appendChild(checkbox);
    label.appendChild(text);
    label.appendChild(roleBadge);

      // Add modulation indicator badge
      const modCount = getModCountForLayer(layer.id);
      const midiCount = getMidiCountForLayer(layer.id);
      if (modCount > 0 || midiCount > 0) {
        const badgeContainer = document.createElement('div');
        badgeContainer.className = 'layer-inputs-badge';
        if (modCount > 0) {
          const modBadge = document.createElement('span');
          modBadge.className = 'layer-mod-badge';
          modBadge.textContent = `MOD: ${modCount}`;
          modBadge.title = `${modCount} modulation connection(s) to this layer`;
          badgeContainer.appendChild(modBadge);
        }
        if (midiCount > 0) {
          const midiBadge = document.createElement('span');
          midiBadge.className = 'layer-midi-badge';
          midiBadge.textContent = `MIDI: ${midiCount}`;
          midiBadge.title = `${midiCount} MIDI mapping(s) to this layer`;
          badgeContainer.appendChild(midiBadge);
        }
        label.appendChild(badgeContainer);
      }

      const controls = document.createElement('div');
      controls.className = 'layer-controls';
      const opacity = document.createElement('input');
      opacity.type = 'range';
      opacity.min = '0';
      opacity.max = '1';
      opacity.step = '0.01';
      opacity.value = String(layer.opacity);
      opacity.className = 'layer-opacity';
      opacity.dataset.learnTarget = `${layer.id}.opacity`;
      opacity.dataset.learnLabel = `${layer.name} Opacity`;
      opacity.addEventListener('input', () => {
        layer.opacity = Number(opacity.value);
        recordPlaylistOverride(layer.id, { opacity: Number(opacity.value) });
      });
      const opacityRow = document.createElement('div');
      opacityRow.className = 'layer-opacity-row';
      const opacityLabel = document.createElement('span');
      opacityLabel.className = 'layer-opacity-label';
      opacityLabel.textContent = 'Opacity';
      opacityRow.appendChild(opacityLabel);
      opacityRow.appendChild(opacity);
      const upButton = document.createElement('button');
      upButton.textContent = '↑';
      upButton.disabled = index === 0;
      upButton.addEventListener('click', () => moveLayer(scene.id, layer.id, -1));
      const downButton = document.createElement('button');
      downButton.textContent = '↓';
      downButton.disabled = index === scene.layers.length - 1;
      downButton.addEventListener('click', () => moveLayer(scene.id, layer.id, 1));
      const removeButton = document.createElement('button');
      removeButton.className = 'layer-remove';
      removeButton.textContent = '✕';
      removeButton.addEventListener('click', () => {
        if (!window.confirm(`Remove "${layer.name}" from this scene?`)) return;
        removeLayer(scene.id, layer.id);
      });
      controls.appendChild(upButton);
      controls.appendChild(downButton);
      controls.appendChild(removeButton);

      row.appendChild(label);
      row.appendChild(controls);
      const assetControl = document.createElement('div');
      assetControl.className = 'layer-asset-control';
      assetControl.appendChild(buildLayerAssetSelect(layer));
      assetControl.appendChild(opacityRow);

      if (layer.id === 'layer-plasma' || layer.id === 'layer-spectrum' || layer.id === 'layer-media') {
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

      if (layer.id === 'layer-portal') {
        const params = layer.params ?? {};
        const autoValue = typeof params.autoSpawn === 'number' ? params.autoSpawn : 1;
        const styleValue = typeof params.style === 'number' ? params.style : 0;

        const autoLabel = document.createElement('label');
        autoLabel.textContent = 'Auto Spawn';
        autoLabel.className = 'asset-control-label';
        const autoToggle = document.createElement('input');
        autoToggle.type = 'checkbox';
        autoToggle.checked = autoValue > 0.5;
        autoToggle.addEventListener('change', () => {
          layer.params = { ...(layer.params ?? {}), autoSpawn: autoToggle.checked ? 1 : 0 };
          recordPlaylistOverride(layer.id, { params: { autoSpawn: autoToggle.checked ? 1 : 0 } });
        });

        const styleLabel = document.createElement('label');
        styleLabel.textContent = 'Style';
        styleLabel.className = 'asset-control-label';
        const styleSelect = document.createElement('select');
        const styles = [
          { id: 0, label: 'Ring' },
          { id: 1, label: 'Glow' },
          { id: 2, label: 'Nebula' }
        ];
        styles.forEach((style) => {
          const option = document.createElement('option');
          option.value = String(style.id);
          option.textContent = style.label;
          styleSelect.appendChild(option);
        });
        styleSelect.value = String(Math.round(styleValue));
        styleSelect.addEventListener('change', () => {
          const value = Number(styleSelect.value);
          layer.params = { ...(layer.params ?? {}), style: value };
          recordPlaylistOverride(layer.id, { params: { style: value } });
        });

        assetControl.appendChild(autoLabel);
        assetControl.appendChild(autoToggle);
        assetControl.appendChild(styleLabel);
        assetControl.appendChild(styleSelect);
      }

      row.appendChild(assetControl);
      targetList.appendChild(row);
    };

    // Create fresh rows for each layer list
    createLayerRow(layerList);
    createLayerRow(layerListScene);
    if (layerListDesign) createLayerRow(layerListDesign);

    // Update toggle references from the first list
    if (layer.id === 'layer-plasma') plasmaToggle = layerList.querySelector(`[data-learn-target="layer-plasma.enabled"]`) as HTMLInputElement;
    if (layer.id === 'layer-spectrum') spectrumToggle = layerList.querySelector(`[data-learn-target="layer-spectrum.enabled"]`) as HTMLInputElement;
    if (layer.id === 'layer-origami') origamiToggle = layerList.querySelector(`[data-learn-target="layer-origami.enabled"]`) as HTMLInputElement;
    if (layer.id === 'layer-glyph') glyphToggle = layerList.querySelector(`[data-learn-target="layer-glyph.enabled"]`) as HTMLInputElement;
    if (layer.id === 'layer-crystal') crystalToggle = layerList.querySelector(`[data-learn-target="layer-crystal.enabled"]`) as HTMLInputElement;
    if (layer.id === 'layer-inkflow') inkToggle = layerList.querySelector(`[data-learn-target="layer-inkflow.enabled"]`) as HTMLInputElement;
    if (layer.id === 'layer-topo') topoToggle = layerList.querySelector(`[data-learn-target="layer-topo.enabled"]`) as HTMLInputElement;
    if (layer.id === 'layer-weather') weatherToggle = layerList.querySelector(`[data-learn-target="layer-weather.enabled"]`) as HTMLInputElement;
    if (layer.id === 'layer-portal') portalToggle = layerList.querySelector(`[data-learn-target="layer-portal.enabled"]`) as HTMLInputElement;
    if (layer.id === 'layer-oscillo') oscilloToggle = layerList.querySelector(`[data-learn-target="layer-oscillo.enabled"]`) as HTMLInputElement;

    syncLayerAsset(layer);
  });

  // Add visualizer row to all lists
  const createVisualizerRow = (targetList: HTMLDivElement) => {
    const visualizerRow = document.createElement('div');
    visualizerRow.className = 'layer-row';
    const vizLabel = document.createElement('label');
    const vizToggle = document.createElement('input');
    vizToggle.type = 'checkbox';
    vizToggle.checked = currentProject.visualizer.enabled;
    vizToggle.addEventListener('change', () => {
      currentProject.visualizer.enabled = vizToggle.checked;
      visualizerEnabledToggle.checked = vizToggle.checked;
      visualizerCanvas.classList.toggle(
        'hidden',
        visualizerMode === 'off' || !currentProject.visualizer.enabled
      );
      setStatus(`Visualizer ${vizToggle.checked ? 'enabled' : 'disabled'}`);
    });
    const vizText = document.createElement('span');
    vizText.textContent = 'Visualizer Overlay';
    vizLabel.appendChild(vizToggle);
    vizLabel.appendChild(vizText);
    const vizControls = document.createElement('div');
    vizControls.className = 'layer-controls';
    visualizerRow.appendChild(vizLabel);
    visualizerRow.appendChild(vizControls);
    targetList.appendChild(visualizerRow);
  };

  createVisualizerRow(layerList);
  createVisualizerRow(layerListScene);
  if (layerListDesign) createVisualizerRow(layerListDesign);

  updateSdfAdvancedVisibility();
  initLearnables();
};

const renderModMatrix = () => {
  modMatrixList.innerHTML = '';
  if (currentProject.modMatrix.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'matrix-empty';
    empty.textContent = 'No mod connections yet.';
    modMatrixList.appendChild(empty);
    renderLayerList();
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
      renderLayerList();
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
      renderLayerList();
      setStatus('Mod connection removed.');
    });

    const updateTargetDefaults = () => {
      const defaults = getTargetDefaults(targetSelect.value);
      connection.target = targetSelect.value;
      connection.min = defaults.min;
      connection.max = defaults.max;
      minInput.value = String(defaults.min);
      maxInput.value = String(defaults.max);
      renderLayerList();
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
  renderLayerList();
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
  renderLayerList();
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
      renderLayerList();
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
      renderLayerList();
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
  renderLayerList();
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
  preview.className = asset.missing ? 'asset-preview asset-preview-missing' : 'asset-preview';

  if (asset.missing) {
    const missingIcon = document.createElement('span');
    missingIcon.className = 'asset-preview-missing-icon';
    missingIcon.textContent = '⚠';
    preview.appendChild(missingIcon);
    return preview;
  }

  if (asset.kind === 'texture') {
    const previewUrl = asset.thumbnail ?? (asset.path ? toFileUrl(asset.path) : undefined);
    if (previewUrl) {
      preview.style.backgroundImage = `url(${previewUrl})`;
      return preview;
    }
  }

  if (asset.kind === 'live') {
    const liveVideo = livePreviewElements.get(asset.id);
    if (liveVideo) {
      const videoClone = liveVideo.cloneNode(false) as HTMLVideoElement;
      videoClone.className = 'asset-preview-video';
      videoClone.srcObject = liveVideo.srcObject;
      videoClone.muted = true;
      void videoClone.play().catch(() => undefined);
      preview.appendChild(videoClone);
      const liveIndicator = document.createElement('span');
      liveIndicator.className = 'asset-preview-live-indicator';
      liveIndicator.textContent = '●';
      preview.appendChild(liveIndicator);
      return preview;
    }
    preview.textContent = '◉';
    return preview;
  }

  if (asset.kind === 'video') {
    const video = document.createElement('video');
    configurePreviewVideo(video, asset);
    preview.appendChild(video);
    return preview;
  }

  if (asset.kind === 'shader') {
    preview.textContent = '{ }';
    preview.style.fontSize = '20px';
    preview.style.display = 'flex';
    preview.style.alignItems = 'center';
    preview.style.justifyContent = 'center';
    return preview;
  }

  if (asset.kind === 'text') {
    preview.textContent = 'Aa';
    preview.style.fontSize = '18px';
    preview.style.fontWeight = '600';
    preview.style.display = 'flex';
    preview.style.alignItems = 'center';
    preview.style.justifyContent = 'center';
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

const checkMissingAssets = async () => {
  const paths = currentProject.assets
    .filter((asset) => asset.path && !asset.options?.liveSource)
    .map((asset) => asset.path!);
  if (paths.length === 0) return;
  const results = await window.visualSynth.checkAssetPaths(paths);
  let changed = false;
  currentProject.assets.forEach((asset) => {
    if (asset.path && !asset.options?.liveSource) {
      const exists = results[asset.path] ?? false;
      if (asset.missing !== !exists) {
        asset.missing = !exists;
        changed = true;
      }
    }
  });
  if (changed) {
    renderAssets();
  }
  if (presetDebugEnabled()) {
    const missingAssets = currentProject.assets
      .filter((asset) => asset.missing)
      .map((asset) => ({ id: asset.id, name: asset.name, path: asset.path }));
    if (missingAssets.length > 0) {
      console.warn('[Preset][Assets] Missing assets', missingAssets);
    } else {
      console.debug('[Preset][Assets] All referenced assets resolved');
    }
  }
};

const relinkAsset = async (asset: AssetItem) => {
  const result = await window.visualSynth.relinkAsset(asset.id, asset.kind);
  if (result.canceled || !result.filePath) return;
  asset.path = result.filePath;
  asset.hash = result.hash;
  asset.missing = false;
  if (result.width) asset.width = result.width;
  if (result.height) asset.height = result.height;
  if (result.mime) asset.mime = result.mime;
  renderAssets();
  renderLayerList();
  setStatus(`Asset relinked: ${asset.name}`);
};

const renderAssets = () => {
  assetList.innerHTML = '';
  if (currentProject.assets.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'matrix-empty';
    empty.textContent = 'No assets yet.';
    assetList.appendChild(empty);
    refreshShaderTargetOptions();
    return;
  }
  currentProject.assets.forEach((asset) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'asset-row-wrapper';

    const row = document.createElement('div');
    row.className = asset.missing ? 'asset-row asset-missing' : 'asset-row';
    const preview = createAssetPreviewElement(asset);
    const kind = document.createElement('div');
    kind.className = 'asset-kind';
    kind.textContent = asset.kind;
    if (asset.missing) {
      const missingBadge = document.createElement('span');
      missingBadge.className = 'asset-missing-badge';
      missingBadge.textContent = 'MISSING';
      kind.appendChild(missingBadge);
    }
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
    if (asset.path) {
      const revealBtn = document.createElement('button');
      revealBtn.textContent = 'Open Folder';
      revealBtn.addEventListener('click', () => {
        void window.visualSynth.openAssetFolder(asset.path!);
      });
      actions.appendChild(revealBtn);
    }
    if (asset.missing) {
      const relinkBtn = document.createElement('button');
      relinkBtn.className = 'asset-relink-btn';
      relinkBtn.textContent = 'Relink';
      relinkBtn.addEventListener('click', () => {
        void relinkAsset(asset);
      });
      actions.appendChild(relinkBtn);
    }
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
  refreshShaderTargetOptions();
};

const ASSET_LAYER_IDS = ['layer-plasma', 'layer-spectrum', 'layer-media'] as const;
type AssetLayerId = (typeof ASSET_LAYER_IDS)[number];

const assetLayerBlendModes: Record<AssetLayerId, number> = {
  'layer-plasma': 3,
  'layer-spectrum': 1,
  'layer-media': 3
};
const assetLayerAudioReact: Record<AssetLayerId, number> = {
  'layer-plasma': 0.6,
  'layer-spectrum': 0.8,
  'layer-media': 0.5
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
    const textCanvas = target?.kind === 'text' ? getTextCanvas(target) ?? undefined : undefined;
    await renderer.setLayerAsset(layer.id, target, previewVideo, textCanvas);
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
  if (currentProject.assets.length === 0) {
    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = 'No assets loaded (Design > Assets)';
    emptyOption.disabled = true;
    select.appendChild(emptyOption);
  }
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
  let shaderSource: string | undefined;
  if (kind === 'shader') {
    try {
      const response = await fetch(toFileUrl(result.filePath));
      if (response.ok) {
        shaderSource = await response.text();
      }
    } catch {
      shaderSource = undefined;
    }
  }
  currentProject.assets = [
    ...currentProject.assets,
    createAssetItem({
      name,
      kind,
      path: result.filePath,
      tags,
      metadata,
      options: {
        ...(buildTextureOptions() ?? {}),
        ...(shaderSource ? { shaderSource } : {})
      }
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

const renderTextToCanvas = (
  text: string,
  font: string,
  color: string,
  width = 512,
  height = 128
): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = 'transparent';
  ctx.fillRect(0, 0, width, height);

  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const metrics = ctx.measureText(text);
  const textWidth = metrics.width;
  const neededWidth = Math.max(width, Math.ceil(textWidth * 1.2));
  if (neededWidth > width) {
    canvas.width = neededWidth;
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
  }

  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.lineWidth = 2;
  ctx.strokeText(text, canvas.width / 2, canvas.height / 2);

  return canvas;
};

const textCanvasCache = new Map<string, HTMLCanvasElement>();

const getTextCanvas = (asset: AssetItem): HTMLCanvasElement | null => {
  if (asset.kind !== 'text' || !asset.options?.text) return null;

  const cacheKey = `${asset.id}-${asset.options.text}-${asset.options.font}-${asset.options.fontColor}`;
  if (textCanvasCache.has(cacheKey)) {
    return textCanvasCache.get(cacheKey)!;
  }

  const text = asset.options.text;
  const font = asset.options.font || '48px Arial';
  const color = asset.options.fontColor || '#ffffff';

  const canvas = renderTextToCanvas(text, font, color);
  textCanvasCache.set(cacheKey, canvas);
  return canvas;
};

const createTextAsset = () => {
  const text = assetTextInput?.value?.trim();
  if (!text) {
    setStatus('Enter text to create a text layer');
    return;
  }

  const fontSpec = assetFontInput?.value?.trim() || '48px Arial';
  const fontMatch = fontSpec.match(/(\d+)px\s+(.+)/i);
  const fontSize = fontMatch ? parseInt(fontMatch[1], 10) : 48;
  const fontFamily = fontMatch ? fontMatch[2] : fontSpec || 'Arial';
  const font = `${fontSize}px ${fontFamily}`;

  const tags = normalizeAssetTags(assetTagsInput.value);
  const canvas = renderTextToCanvas(text, font, '#ffffff');

  const asset = createAssetItem({
    name: text.length > 20 ? `${text.substring(0, 20)}...` : text,
    kind: 'text',
    tags,
    metadata: {
      width: canvas.width,
      height: canvas.height,
      colorSpace: 'srgb'
    },
    options: {
      text,
      font,
      fontSize,
      fontColor: '#ffffff'
    }
  });

  textCanvasCache.set(
    `${asset.id}-${text}-${font}-#ffffff`,
    canvas
  );

  currentProject.assets = [...currentProject.assets, asset];

  if (assetTextInput) assetTextInput.value = '';
  assetTagsInput.value = '';
  renderAssets();
  renderLayerList();
  setStatus(`Text layer created: ${asset.name}`);
};

const getSavedWebcamId = () => {
  try {
    return localStorage.getItem(WEBCAM_STORAGE_KEY);
  } catch {
    return null;
  }
};

const setSavedWebcamId = (deviceId: string | null, remember: boolean) => {
  try {
    if (remember && deviceId) {
      localStorage.setItem(WEBCAM_STORAGE_KEY, deviceId);
    } else {
      localStorage.removeItem(WEBCAM_STORAGE_KEY);
    }
  } catch {
    // Ignore storage failures (private mode, etc.)
  }
};

const pickWebcamDevice = async (cameras: MediaDeviceInfo[]) => {
  if (!webcamPicker || !webcamPickerSelect || !webcamPickerConfirm || !webcamPickerCancel || !webcamPickerRemember) {
    const choices = cameras
      .map((device, index) => `${index + 1}) ${device.label || `Camera ${index + 1}`}`)
      .join('\n');
    const response = window.prompt(`Select webcam:\n${choices}`);
    if (!response) return null;
    const index = Number(response.trim()) - 1;
    return cameras[index] ?? null;
  }

  return new Promise<MediaDeviceInfo | null>((resolve) => {
    const savedId = getSavedWebcamId();
    webcamPickerSelect.innerHTML = '';
    cameras.forEach((device, index) => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.textContent = device.label || `Camera ${index + 1}`;
      webcamPickerSelect.appendChild(option);
    });

    if (savedId && cameras.some((device) => device.deviceId === savedId)) {
      webcamPickerSelect.value = savedId;
    } else if (webcamPickerSelect.options.length > 0) {
      webcamPickerSelect.selectedIndex = 0;
    }
    webcamPickerRemember.checked = true;

    const cleanup = () => {
      webcamPicker.classList.add('hidden');
      webcamPickerConfirm.removeEventListener('click', onConfirm);
      webcamPickerCancel.removeEventListener('click', onCancel);
      webcamPicker.removeEventListener('click', onBackdrop);
    };

    const onConfirm = () => {
      const selectedId = webcamPickerSelect.value;
      const selected = cameras.find((device) => device.deviceId === selectedId) ?? null;
      setSavedWebcamId(selectedId, webcamPickerRemember.checked);
      cleanup();
      resolve(selected);
    };

    const onCancel = () => {
      cleanup();
      resolve(null);
    };

    const onBackdrop = (event: MouseEvent) => {
      if (event.target === webcamPicker) {
        onCancel();
      }
    };

    webcamPickerConfirm.addEventListener('click', onConfirm);
    webcamPickerCancel.addEventListener('click', onCancel);
    webcamPicker.addEventListener('click', onBackdrop);
    webcamPicker.classList.remove('hidden');
  });
};

const startLiveCapture = async (source: 'webcam' | 'screen') => {
  try {
    let videoConstraints: MediaTrackConstraints | boolean = true;
    if (source === 'webcam') {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter((device) => device.kind === 'videoinput');
      if (cameras.length > 1) {
        const selected = await pickWebcamDevice(cameras);
        if (!selected) {
          setStatus('Webcam selection canceled.');
          return;
        }
        videoConstraints = { deviceId: { exact: selected.deviceId }, width: 1280, height: 720 };
      } else {
        videoConstraints = { width: 1280, height: 720 };
      }
    } else {
      videoConstraints = { displaySurface: 'monitor' };
    }

    const constraints = { video: videoConstraints, audio: false };

    const stream =
      source === 'webcam'
        ? await navigator.mediaDevices.getUserMedia(constraints)
        : await navigator.mediaDevices.getDisplayMedia(constraints as DisplayMediaStreamOptions);

    const track = stream.getVideoTracks()[0];
    const settings = track.getSettings();
    const width = settings.width ?? 1280;
    const height = settings.height ?? 720;

    const name = source === 'webcam' ? `Webcam (${track.label})` : `Screen (${track.label})`;
    const tags = normalizeAssetTags(assetTagsInput.value);

    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    void video.play();

    const asset = createAssetItem({
      name,
      kind: 'live',
      tags,
      metadata: {
        width,
        height,
        colorSpace: 'srgb'
      },
      options: {
        liveSource: source
      }
    });

    livePreviewElements.set(asset.id, video);
    liveStreams.set(asset.id, stream);

    track.addEventListener('ended', () => {
      stopLiveAssetStream(asset.id);
      asset.missing = true;
      renderAssets();
      setStatus(`Live source ended: ${name}`);
    });

    currentProject.assets = [...currentProject.assets, asset];
    assetTagsInput.value = '';
    renderAssets();
    renderLayerList();
    setStatus(`Live capture started: ${name}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    setStatus(`Failed to start ${source}: ${msg}`);
  }
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
  { key: 'expressiveFx', label: 'Expressive FX', get: (p: VisualSynthProject) => p.expressiveFx },
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
    expressiveFx: selections.has('expressiveFx'),
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

const initMatrixTabs = () => {
  const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>('.matrix-tab'));
  if (tabs.length === 0) return;
  const panels = Array.from(document.querySelectorAll<HTMLElement>('.matrix-tab-panel'));
  const setActive = (key: string) => {
    tabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.matrixTab === key));
    panels.forEach((panel) => panel.classList.toggle('active', panel.dataset.matrixPanel === key));
  };
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const key = tab.dataset.matrixTab;
      if (key) setActive(key);
    });
  });
  const initial = tabs.find((tab) => tab.classList.contains('active'))?.dataset.matrixTab;
  if (initial) setActive(initial);
};

const applyPlasmaShaderFromScene = async (scene: SceneConfig) => {
  if (runtimeShaderOverride) {
    const applied = applyPlasmaShaderSource(runtimeShaderOverride, 'Draft');
    if (!applied) {
      runtimeShaderOverride = null;
    } else {
      return;
    }
  }

  const plasmaLayer = scene.layers.find((layer) => layer.id === 'layer-plasma');
  const shaderId = plasmaLayer?.params?.shaderId as string | undefined;
  const asset = getShaderAssetById(shaderId ?? null);
  if (!asset) {
    applyPlasmaShaderSource(null, 'Default');
    shaderTargetSelect.value = shaderTargetDraftValue;
    return;
  }
  const source = await loadShaderSourceForAsset(asset);
  if (!source) {
    applyPlasmaShaderSource(null, 'Default');
    shaderTargetSelect.value = shaderTargetDraftValue;
    return;
  }
  applyPlasmaShaderSource(source, asset.name);
  shaderTargetSelect.value = `${shaderTargetAssetPrefix}${asset.id}`;
};

const applyScene = (sceneId: string) => {
  const scene = currentProject.scenes.find((item) => item.id === sceneId);
  if (!scene) return;
  const previousSceneId = currentProject.activeSceneId;
  const previousScene = currentProject.scenes.find((item) => item.id === previousSceneId) ?? null;
  const fromSnapshot = previousSceneId ? captureSceneSnapshot(currentProject, previousSceneId) : null;
  currentProject = { ...currentProject, activeSceneId: sceneId };
  if (scene.look) {
    currentProject = {
      ...currentProject,
      effects: scene.look.effects ?? currentProject.effects,
      particles: scene.look.particles ?? currentProject.particles,
      sdf: scene.look.sdf ?? currentProject.sdf,
      visualizer: scene.look.visualizer ?? currentProject.visualizer,
      stylePresets: scene.look.stylePresets ?? currentProject.stylePresets,
      activeStylePresetId: scene.look.activeStylePresetId ?? currentProject.activeStylePresetId,
      palettes: scene.look.palettes ?? currentProject.palettes,
      activePaletteId: scene.look.activePaletteId ?? currentProject.activePaletteId,
      macros: scene.look.macros ?? currentProject.macros,
      modMatrix: scene.look.modMatrix ?? currentProject.modMatrix
    };
    initStylePresets();
    initPalettes();
    initMacros();
    initEffects();
    initParticles();
    initSdf();
    syncVisualizerFromProject();
    renderModMatrix();
  }
  const toSnapshot = captureSceneSnapshot(currentProject, sceneId);
  if (fromSnapshot && toSnapshot && previousSceneId !== sceneId) {
    const { durationMs, curve } = SceneManager.resolveTransitionDuration(previousScene, scene);
    sceneManager.startTransition(fromSnapshot, toSnapshot, transportTimeMs, durationMs, curve);
  } else {
    sceneManager.clearTransition();
  }
  sceneManager.markSceneActivated(transportTimeMs);
  paletteApplyToggle.checked = Boolean(scene.look?.activePaletteId);
  sceneSelect.value = sceneId;
  renderLayerList();
  syncPerformanceToggles();
  renderSceneStrip();
  renderSceneTimeline();
  void applyPlasmaShaderFromScene(scene);
};

const addSceneFromPreset = async (presetPath: string) => {
  const traceId = createPresetTraceId();
  logPresetDebug(traceId, 'Loading preset for scene', { presetPath });
  const result = await window.visualSynth.loadPreset(presetPath);
  if (result.error) {
    setStatus(`Preset load failed: ${result.error}`);
    await ensureSafeVisuals(traceId, result.error);
    return null;
  }

  // Migrate preset to latest version (V5)
  const presetMigration = await import('../shared/presetMigration');
  const migrationResult = presetMigration.migratePreset(result.project);
  if (!migrationResult.success) {
    const reasonText = migrationResult.errors.join(', ');
    setStatus(`Preset migration failed: ${reasonText}`);
    await ensureSafeVisuals(traceId, reasonText);
    return null;
  }

  const migratedProject = migrationResult.preset;

  if (!migratedProject.scenes || migratedProject.scenes.length === 0) {
    const reasonText = 'Preset has no scenes to add.';
    setStatus(reasonText);
    await ensureSafeVisuals(traceId, reasonText);
    return null;
  }
  const sourceScene =
    migratedProject.scenes.find((scene: any) => scene.id === migratedProject.activeSceneId) ??
    migratedProject.scenes[0];
  const presetName = presetSelect.selectedOptions[0]?.textContent ?? presetPath;
  const assetIdMap = new Map<string, string>();
  const referencedAssetIds = new Set<string>();
  sourceScene.layers.forEach((layer: any) => {
    const assetId = (layer as LayerConfig & { assetId?: string }).assetId;
    if (assetId) referencedAssetIds.add(assetId);
  });
  if (migratedProject.assets && migratedProject.assets.length > 0 && referencedAssetIds.size > 0) {
    const nextAssets = [...currentProject.assets];
    migratedProject.assets.forEach((asset: any) => {
      if (!referencedAssetIds.has(asset.id)) return;
      const hasCollision = nextAssets.some((existing) => existing.id === asset.id);
      const newId = hasCollision ? getNextAssetId() : asset.id;
      assetIdMap.set(asset.id, newId);
      nextAssets.push({ ...cloneValue(asset), id: newId });
    });
    currentProject.assets = nextAssets;
    renderAssets();
  }
  const look: SceneLook = {
    effects: cloneValue(migratedProject.effects || {}),
    particles: cloneValue(migratedProject.particles || {}),
    sdf: cloneValue(migratedProject.sdf || {}),
    visualizer: cloneValue(migratedProject.visualizer || {}),
    stylePresets: cloneValue(migratedProject.stylePresets || []),
    activeStylePresetId: cloneValue(migratedProject.activeStylePresetId || ''),
    palettes: cloneValue(migratedProject.palettes || []),
    activePaletteId: cloneValue(migratedProject.activePaletteId || ''),
    macros: cloneValue(migratedProject.macros || []),
    modMatrix: cloneValue(migratedProject.modMatrix || [])
  };
  const newSceneId = getNextSceneId();
  const newScene: SceneConfig = {
    id: newSceneId,
    scene_id: newSceneId,
    name: getUniqueSceneName(presetName),
    intent: sourceScene.intent ?? 'ambient',
    duration: typeof sourceScene.duration === 'number' ? sourceScene.duration : 0,
    transition_in: { ...DEFAULT_SCENE_TRANSITION, ...(sourceScene.transition_in ?? {}) },
    transition_out: { ...DEFAULT_SCENE_TRANSITION, ...(sourceScene.transition_out ?? {}) },
    trigger: { ...DEFAULT_SCENE_TRIGGER, ...(sourceScene.trigger ?? {}) },
    assigned_layers: {
      core: sourceScene.assigned_layers?.core ?? [],
      support: sourceScene.assigned_layers?.support ?? [],
      atmosphere: sourceScene.assigned_layers?.atmosphere ?? []
    },
    layers: sourceScene.layers.map((layer) => {
      const cloned = cloneLayerConfig(layer);
      const assetId = (cloned as LayerConfig & { assetId?: string }).assetId;
      if (assetId && assetIdMap.has(assetId)) {
        (cloned as LayerConfig & { assetId?: string }).assetId = assetIdMap.get(assetId);
      }
      return cloned;
    }),
    look
  };
  addSceneToProject(newScene, false);
  selectedSceneId = newScene.id;
  renderSceneStrip();
  renderSceneTimeline();
  setStatus(`Scene added from preset: ${newScene.name} (preview ready)`);
  logPresetDebug(
    traceId,
    'Preset scene added',
    serializePresetPayload({
      sceneId: newScene.id,
      sceneName: newScene.name,
      layers: newScene.layers.map((layer) => ({
        id: layer.id,
        enabled: layer.enabled,
        opacity: layer.opacity,
        blendMode: layer.blendMode,
        params: layer.params
      })),
      look: newScene.look
    })
  );
  void capturePresetThumbnail(presetPath);
  return newScene.id;
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

const formatDurationMs = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
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

const applyGeneratorVariant = (
  layerId: string,
  options: {
    name: string;
    params?: Record<string, number>;
    opacity?: number;
    blendMode?: LayerConfig['blendMode'];
  }
) => {
  const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
  if (!scene) return;
  const layer = ensureLayerWithDefaults(scene, layerId, options.name);
  layer.enabled = true;
  if (options.opacity !== undefined) {
    layer.opacity = options.opacity;
  }
  if (options.blendMode) {
    layer.blendMode = options.blendMode;
  }
  if (options.params) {
    layer.params = { ...(layer.params ?? {}), ...options.params };
  }
  recordPlaylistOverride(layerId, {
    enabled: true,
    opacity: options.opacity,
    blendMode: options.blendMode,
    params: options.params
  });
  renderLayerList();
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
  const sorted = [...GENERATORS].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  );
  sorted.forEach((gen) => {
    const option = document.createElement('option');
    option.value = gen.id;
    option.textContent = gen.name;
    generatorSelect.appendChild(option);
  });
  renderGeneratorList(generatorFavorites, generatorFavoritesState);
  renderGeneratorList(generatorRecents, generatorRecentsState);
};

const addGenerator = (id: GeneratorId) => {
  recordPlaylistOverride(id, { enabled: true });
  if (id === 'layer-plasma') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      const layer = ensureLayerWithDefaults(scene, 'layer-plasma', 'Shader Plasma');
      layer.enabled = true;
    }
    if (plasmaToggle) plasmaToggle.checked = true;
    if (perfTogglePlasma) perfTogglePlasma.checked = true;
    renderLayerList();
    setStatus('Plasma layer enabled.');
  }
  if (id === 'layer-spectrum') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      const layer = ensureLayerWithDefaults(scene, 'layer-spectrum', 'Spectrum Bars');
      layer.enabled = true;
    }
    if (spectrumToggle) spectrumToggle.checked = true;
    if (perfToggleSpectrum) perfToggleSpectrum.checked = true;
    renderLayerList();
    setStatus('Spectrum layer enabled.');
  }
  if (id === 'layer-origami') {
    const layer = ensureOrigamiLayer(true);
    if (origamiToggle) origamiToggle.checked = true;
    if (layer) {
      layer.enabled = true;
      renderLayerList();
    }
    setStatus('Origami fold layer enabled.');
  }
  if (id === 'layer-glyph') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      let layer = scene.layers.find((item) => item.id === 'layer-glyph');
      if (!layer) {
        layer = {
          id: 'layer-glyph',
          name: 'Glyph Language',
          role: getDefaultRoleForLayerId('layer-glyph'),
          enabled: true,
          opacity: 0.8,
          blendMode: 'screen',
          transform: { x: 0, y: 0, scale: 1, rotation: 0 }
        };
        scene.layers.push(layer);
      } else {
        layer.enabled = true;
      }
      renderLayerList();
    }
    if (glyphToggle) glyphToggle.checked = true;
    setStatus('Glyph language layer enabled.');
  }
  if (id === 'layer-crystal') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      let layer = scene.layers.find((item) => item.id === 'layer-crystal');
      if (!layer) {
        layer = {
          id: 'layer-crystal',
          name: 'Crystal Harmonics',
          role: getDefaultRoleForLayerId('layer-crystal'),
          enabled: true,
          opacity: 0.85,
          blendMode: 'screen',
          transform: { x: 0, y: 0, scale: 1, rotation: 0 }
        };
        scene.layers.push(layer);
      } else {
        layer.enabled = true;
      }
      renderLayerList();
    }
    if (crystalToggle) crystalToggle.checked = true;
    setStatus('Crystal harmonics layer enabled.');
  }
  if (id === 'layer-inkflow') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      let layer = scene.layers.find((item) => item.id === 'layer-inkflow');
      if (!layer) {
        layer = {
          id: 'layer-inkflow',
          name: 'Ink Flow',
          role: getDefaultRoleForLayerId('layer-inkflow'),
          enabled: true,
          opacity: 0.85,
          blendMode: 'screen',
          transform: { x: 0, y: 0, scale: 1, rotation: 0 }
        };
        scene.layers.push(layer);
      } else {
        layer.enabled = true;
      }
      renderLayerList();
    }
    if (inkToggle) inkToggle.checked = true;
    setStatus('Ink flow layer enabled.');
  }
  if (id === 'layer-topo') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      let layer = scene.layers.find((item) => item.id === 'layer-topo');
      if (!layer) {
        layer = {
          id: 'layer-topo',
          name: 'Topo Terrain',
          role: getDefaultRoleForLayerId('layer-topo'),
          enabled: true,
          opacity: 0.85,
          blendMode: 'screen',
          transform: { x: 0, y: 0, scale: 1, rotation: 0 }
        };
        scene.layers.push(layer);
      } else {
        layer.enabled = true;
      }
      renderLayerList();
    }
    if (topoToggle) topoToggle.checked = true;
    setStatus('Topo terrain layer enabled.');
  }
  if (id === 'layer-weather') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      let layer = scene.layers.find((item) => item.id === 'layer-weather');
      if (!layer) {
        layer = {
          id: 'layer-weather',
          name: 'Audio Weather',
          role: getDefaultRoleForLayerId('layer-weather'),
          enabled: true,
          opacity: 0.85,
          blendMode: 'screen',
          transform: { x: 0, y: 0, scale: 1, rotation: 0 }
        };
        scene.layers.push(layer);
      } else {
        layer.enabled = true;
      }
      renderLayerList();
    }
    if (weatherToggle) weatherToggle.checked = true;
    setStatus('Audio weather layer enabled.');
  }
  if (id === 'layer-portal') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      let layer = scene.layers.find((item) => item.id === 'layer-portal');
      if (!layer) {
        layer = {
          id: 'layer-portal',
          name: 'Wormhole Portal',
          role: getDefaultRoleForLayerId('layer-portal'),
          enabled: true,
          opacity: 0.85,
          blendMode: 'screen',
          transform: { x: 0, y: 0, scale: 1, rotation: 0 }
        };
        scene.layers.push(layer);
      } else {
        layer.enabled = true;
      }
      renderLayerList();
    }
    if (portalToggle) portalToggle.checked = true;
    setStatus('Wormhole portal layer enabled.');
  }
  if (id === 'layer-media') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      let layer = scene.layers.find((item) => item.id === 'layer-media');
      if (!layer) {
        layer = {
          id: 'layer-media',
          name: 'Media Overlay',
          role: getDefaultRoleForLayerId('layer-media'),
          enabled: true,
          opacity: 0.9,
          blendMode: 'screen',
          transform: { x: 0, y: 0, scale: 1, rotation: 0 }
        };
        scene.layers.push(layer);
      } else {
        layer.enabled = true;
      }
      renderLayerList();
    }
    setStatus('Media overlay layer enabled.');
  }
  if (id === 'layer-oscillo') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      let layer = scene.layers.find((item) => item.id === 'layer-oscillo');
      if (!layer) {
        layer = {
          id: 'layer-oscillo',
          name: 'Sacred Oscilloscope',
          role: getDefaultRoleForLayerId('layer-oscillo'),
          enabled: true,
          opacity: 0.85,
          blendMode: 'screen',
          transform: { x: 0, y: 0, scale: 1, rotation: 0 }
        };
        scene.layers.push(layer);
      } else {
        layer.enabled = true;
      }
      renderLayerList();
    }
    if (oscilloToggle) oscilloToggle.checked = true;
    setStatus('Sacred oscilloscope layer enabled.');
  }
  if (id === 'variant-plasma-vortex') {
    applyGeneratorVariant('layer-plasma', {
      name: 'Shader Plasma',
      params: { speed: 1.6, scale: 1.4, complexity: 0.75 },
      opacity: 0.9,
      blendMode: 'screen'
    });
    setStatus('Plasma: Vortex added.');
  }
  if (id === 'variant-plasma-liquid') {
    applyGeneratorVariant('layer-plasma', {
      name: 'Shader Plasma',
      params: { speed: 0.7, scale: 2.2, complexity: 0.4 },
      opacity: 0.85,
      blendMode: 'screen'
    });
    setStatus('Plasma: Liquid Metal added.');
  }
  if (id === 'variant-spectrum-neon') {
    applyGeneratorVariant('layer-spectrum', {
      name: 'Spectrum Bars',
      params: {},
      opacity: 0.95,
      blendMode: 'add'
    });
    setStatus('Spectrum: Neon Bars added.');
  }
  if (id === 'variant-origami-canyon') {
    applyGeneratorVariant('layer-origami', {
      name: 'Origami Fold',
      params: { speed: 0.8 },
      opacity: 0.8,
      blendMode: 'screen'
    });
    setStatus('Origami: Canyon Fold added.');
  }
  if (id === 'variant-glyph-orbit') {
    applyGeneratorVariant('layer-glyph', {
      name: 'Glyph Language',
      params: { speed: 1.4 },
      opacity: 0.7,
      blendMode: 'screen'
    });
    setStatus('Glyph: Orbit Field added.');
  }
  if (id === 'variant-crystal-fracture') {
    applyGeneratorVariant('layer-crystal', {
      name: 'Crystal Harmonics',
      params: { speed: 1.3, scale: 1.6 },
      opacity: 0.75,
      blendMode: 'screen'
    });
    setStatus('Crystal: Fracture Bloom added.');
  }
  if (id === 'variant-ink-neon') {
    applyGeneratorVariant('layer-inkflow', {
      name: 'Ink Flow',
      params: { speed: 1.1, scale: 1.8 },
      opacity: 0.8,
      blendMode: 'screen'
    });
    setStatus('Ink: Neon Flow added.');
  }
  if (id === 'variant-topo-rift') {
    applyGeneratorVariant('layer-topo', {
      name: 'Topo Terrain',
      params: { scale: 1.6, elevation: 0.75 },
      opacity: 0.8,
      blendMode: 'screen'
    });
    setStatus('Topo: Rift Lines added.');
  }
  if (id === 'variant-weather-stormcells') {
    applyGeneratorVariant('layer-weather', {
      name: 'Audio Weather',
      params: { speed: 1.5 },
      opacity: 0.7,
      blendMode: 'screen'
    });
    setStatus('Weather: Storm Cells added.');
  }
  if (id === 'variant-portal-echo') {
    applyGeneratorVariant('layer-portal', {
      name: 'Wormhole Portal',
      params: { style: 1 },
      opacity: 0.65,
      blendMode: 'screen'
    });
    setStatus('Portal: Echo Rings added.');
  }
  if (id === 'gen-audio-geometry') {
    applyGeneratorVariant('layer-glyph', {
      name: 'Glyph Language',
      params: { speed: 1.2 },
      opacity: 0.7,
      blendMode: 'screen'
    });
    applyGeneratorVariant('layer-spectrum', {
      name: 'Spectrum Bars',
      params: {},
      opacity: 0.85,
      blendMode: 'add'
    });
    setStatus('Generator: Audio Geometry added.');
  }
  if (id === 'variant-audio-geometry-prism') {
    applyGeneratorVariant('layer-glyph', {
      name: 'Glyph Language',
      params: { speed: 1.4 },
      opacity: 0.6,
      blendMode: 'screen'
    });
    applyGeneratorVariant('layer-crystal', {
      name: 'Crystal Harmonics',
      params: { speed: 1.2, scale: 1.4 },
      opacity: 0.55,
      blendMode: 'screen'
    });
    setStatus('Generator: Audio Geometry (Prism) added.');
  }
  if (id === 'gen-organic-fluid') {
    applyGeneratorVariant('layer-plasma', {
      name: 'Shader Plasma',
      params: { speed: 0.85, scale: 1.6, complexity: 0.65 },
      opacity: 0.8,
      blendMode: 'screen'
    });
    applyGeneratorVariant('layer-inkflow', {
      name: 'Ink Flow',
      params: { speed: 1.1, scale: 1.3 },
      opacity: 0.65,
      blendMode: 'screen'
    });
    setStatus('Generator: Organic Fluid added.');
  }
  if (id === 'variant-organic-fluid-ink') {
    applyGeneratorVariant('layer-inkflow', {
      name: 'Ink Flow',
      params: { speed: 1.4, scale: 1.8 },
      opacity: 0.85,
      blendMode: 'screen'
    });
    applyGeneratorVariant('layer-plasma', {
      name: 'Shader Plasma',
      params: { speed: 0.6, scale: 1.3, complexity: 0.5 },
      opacity: 0.45,
      blendMode: 'screen'
    });
    setStatus('Generator: Organic Fluid (Ink) added.');
  }
  if (id === 'gen-neon-wireframe') {
    applyGeneratorVariant('layer-topo', {
      name: 'Topo Terrain',
      params: { scale: 1.6, elevation: 0.75 },
      opacity: 0.75,
      blendMode: 'screen'
    });
    applyGeneratorVariant('layer-glyph', {
      name: 'Glyph Language',
      params: { speed: 1.1 },
      opacity: 0.4,
      blendMode: 'screen'
    });
    setStatus('Generator: Neon Wireframe added.');
  }
  if (id === 'variant-neon-wireframe-grid') {
    applyGeneratorVariant('layer-topo', {
      name: 'Topo Terrain',
      params: { scale: 2.0, elevation: 0.9 },
      opacity: 0.8,
      blendMode: 'screen'
    });
    applyGeneratorVariant('layer-spectrum', {
      name: 'Spectrum Bars',
      params: {},
      opacity: 0.25,
      blendMode: 'add'
    });
    setStatus('Generator: Neon Wireframe (Grid) added.');
  }
  if (id === 'gen-glitch-datamosh') {
    effectsEnabled.checked = true;
    effectFeedback.value = '0.55';
    effectChroma.value = '0.25';
    effectPosterize.value = '0.3';
    effectBlur.value = '0.12';
    applyEffectControls();
    setStatus('Generator: Glitch Datamosh added.');
  }
  if (id === 'variant-glitch-datamosh-hard') {
    effectsEnabled.checked = true;
    effectFeedback.value = '0.7';
    effectChroma.value = '0.35';
    effectPosterize.value = '0.45';
    effectBlur.value = '0.2';
    applyEffectControls();
    setStatus('Generator: Glitch Datamosh (Hard) added.');
  }
  if (id === 'gen-particle-swarm') {
    particlesEnabled.checked = true;
    particlesDensity.value = '0.6';
    particlesSpeed.value = '0.8';
    particlesSize.value = '0.45';
    particlesGlow.value = '0.7';
    applyParticleControls();
    setStatus('Generator: Particle Swarm added.');
  }
  if (id === 'variant-particle-swarm-bloom') {
    particlesEnabled.checked = true;
    particlesDensity.value = '0.75';
    particlesSpeed.value = '0.95';
    particlesSize.value = '0.5';
    particlesGlow.value = '0.85';
    applyParticleControls();
    effectsEnabled.checked = true;
    effectBloom.value = '0.35';
    applyEffectControls();
    setStatus('Generator: Particle Swarm (Bloom) added.');
  }
  if (id === 'gen-typography-reveal') {
    applyGeneratorVariant('layer-media', {
      name: 'Media Overlay',
      params: {},
      opacity: 0.9,
      blendMode: 'screen'
    });
    setStatus('Generator: Typography Reveal (add a text/media asset).');
  }
  if (id === 'variant-typography-reveal-glow') {
    applyGeneratorVariant('layer-media', {
      name: 'Media Overlay',
      params: {},
      opacity: 0.95,
      blendMode: 'screen'
    });
    effectsEnabled.checked = true;
    effectBloom.value = '0.35';
    applyEffectControls();
    setStatus('Generator: Typography Reveal (Glow) added.');
  }
  if (id === 'gen-kaleido-shard') {
    applyGeneratorVariant('layer-plasma', {
      name: 'Shader Plasma',
      params: { speed: 1.1, scale: 1.4, complexity: 0.6 },
      opacity: 0.8,
      blendMode: 'screen'
    });
    effectsEnabled.checked = true;
    effectKaleidoscope.value = '0.7';
    effectBloom.value = '0.25';
    applyEffectControls();
    setStatus('Generator: Kaleido Shards added.');
  }
  if (id === 'variant-kaleido-shard-iris') {
    applyGeneratorVariant('layer-plasma', {
      name: 'Shader Plasma',
      params: { speed: 0.9, scale: 1.8, complexity: 0.7 },
      opacity: 0.85,
      blendMode: 'screen'
    });
    effectsEnabled.checked = true;
    effectKaleidoscope.value = '0.9';
    effectBloom.value = '0.3';
    applyEffectControls();
    setStatus('Generator: Kaleido Shards (Iris) added.');
  }
  if (id === 'gen-radar-hud') {
    applyGeneratorVariant('layer-oscillo', {
      name: 'Sacred Oscilloscope',
      params: {},
      opacity: 0.9,
      blendMode: 'screen'
    });
    applyGeneratorVariant('layer-spectrum', {
      name: 'Spectrum Bars',
      params: {},
      opacity: 0.35,
      blendMode: 'add'
    });
    setStatus('Generator: Radar HUD added.');
  }
  if (id === 'variant-radar-hud-deep') {
    applyGeneratorVariant('layer-oscillo', {
      name: 'Sacred Oscilloscope',
      params: {},
      opacity: 0.95,
      blendMode: 'screen'
    });
    applyGeneratorVariant('layer-topo', {
      name: 'Topo Terrain',
      params: { scale: 1.3, elevation: 0.6 },
      opacity: 0.35,
      blendMode: 'screen'
    });
    setStatus('Generator: Radar HUD (Deep) added.');
  }
  if (id === 'gen-fractal-bloom') {
    applyGeneratorVariant('layer-plasma', {
      name: 'Shader Plasma',
      params: { speed: 0.6, scale: 1.8, complexity: 0.8 },
      opacity: 0.85,
      blendMode: 'screen'
    });
    effectsEnabled.checked = true;
    effectBloom.value = '0.4';
    applyEffectControls();
    setStatus('Generator: Fractal Bloom added.');
  }
  if (id === 'variant-fractal-bloom-ember') {
    applyGeneratorVariant('layer-plasma', {
      name: 'Shader Plasma',
      params: { speed: 0.75, scale: 2.0, complexity: 0.9 },
      opacity: 0.9,
      blendMode: 'screen'
    });
    effectsEnabled.checked = true;
    effectBloom.value = '0.5';
    effectPosterize.value = '0.15';
    applyEffectControls();
    setStatus('Generator: Fractal Bloom (Ember) added.');
  }
  if (id === 'gen-vhs-scanline') {
    effectsEnabled.checked = true;
    effectChroma.value = '0.22';
    effectBlur.value = '0.18';
    effectPosterize.value = '0.15';
    effectFeedback.value = '0.05';
    applyEffectControls();
    setStatus('Generator: VHS Scanline added.');
  }
  if (id === 'variant-vhs-scanline-warp') {
    effectsEnabled.checked = true;
    effectChroma.value = '0.3';
    effectBlur.value = '0.25';
    effectPosterize.value = '0.25';
    effectFeedback.value = '0.12';
    applyEffectControls();
    setStatus('Generator: VHS Scanline (Warp) added.');
  }
  if (id === 'gen-tunnel-warp') {
    applyGeneratorVariant('layer-plasma', {
      name: 'Shader Plasma',
      params: { speed: 1.0, scale: 1.3, complexity: 0.7 },
      opacity: 0.7,
      blendMode: 'screen'
    });
    effectsEnabled.checked = true;
    effectFeedback.value = '0.6';
    effectKaleidoscope.value = '0.3';
    applyEffectControls();
    setStatus('Generator: Tunnel Warp added.');
  }
  if (id === 'variant-tunnel-warp-spiral') {
    applyGeneratorVariant('layer-plasma', {
      name: 'Shader Plasma',
      params: { speed: 1.2, scale: 1.5, complexity: 0.8 },
      opacity: 0.8,
      blendMode: 'screen'
    });
    effectsEnabled.checked = true;
    effectFeedback.value = '0.7';
    effectKaleidoscope.value = '0.45';
    applyEffectControls();
    setStatus('Generator: Tunnel Warp (Spiral) added.');
  }
  if (id === 'gen-wormhole-core') {
    applyGeneratorVariant('layer-portal', {
      name: 'Wormhole Portal',
      params: { style: 2, autoSpawn: 1 },
      opacity: 0.8,
      blendMode: 'screen'
    });
    effectsEnabled.checked = true;
    effectFeedback.value = '0.45';
    applyEffectControls();
    setStatus('Generator: Wormhole Core added.');
  }
  if (id === 'variant-wormhole-core-echo') {
    applyGeneratorVariant('layer-portal', {
      name: 'Wormhole Portal',
      params: { style: 1, autoSpawn: 1 },
      opacity: 0.85,
      blendMode: 'screen'
    });
    effectsEnabled.checked = true;
    effectFeedback.value = '0.55';
    effectBloom.value = '0.2';
    applyEffectControls();
    setStatus('Generator: Wormhole Core (Echo) added.');
  }
  if (id === 'gen-nebula-drift') {
    applyGeneratorVariant('layer-plasma', {
      name: 'Shader Plasma',
      params: { speed: 0.7, scale: 1.9, complexity: 0.55 },
      opacity: 0.65,
      blendMode: 'screen'
    });
    applyGeneratorVariant('layer-spectrum', {
      name: 'Spectrum Bars',
      params: {},
      opacity: 0.35,
      blendMode: 'add'
    });
    setStatus('Generator: Nebula Drift added.');
  }
  if (id === 'variant-nebula-drift-cold') {
    applyGeneratorVariant('layer-plasma', {
      name: 'Shader Plasma',
      params: { speed: 0.6, scale: 2.1, complexity: 0.5 },
      opacity: 0.7,
      blendMode: 'screen'
    });
    applyGeneratorVariant('layer-spectrum', {
      name: 'Spectrum Bars',
      params: {},
      opacity: 0.25,
      blendMode: 'add'
    });
    setStatus('Generator: Nebula Drift (Cold) added.');
  }
  if (id === 'viz-off') {
    currentProject.visualizer.enabled = false;
    setVisualizerMode('off');
    setStatus('Visualizer off.');
  }
  if (id === 'viz-spectrum') {
    currentProject.visualizer.enabled = true;
    setVisualizerMode('spectrum');
    setStatus('Visualizer: Spectrum.');
  }
  if (id === 'viz-waveform') {
    currentProject.visualizer.enabled = true;
    setVisualizerMode('waveform');
    setStatus('Visualizer: Waveform.');
  }
  if (id === 'viz-oscilloscope') {
    currentProject.visualizer.enabled = true;
    setVisualizerMode('oscilloscope');
    setStatus('Visualizer: Oscilloscope.');
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
  if (target === 'layer-origami.enabled') {
    const layer = ensureOrigamiLayer(true);
    const next = isToggle ? !layer?.enabled : value > 0.5;
    if (layer) layer.enabled = Boolean(next);
    if (origamiToggle) origamiToggle.checked = Boolean(next);
    renderLayerList();
    return;
  }
  if (target === 'layer-origami.opacity') {
    const layer = ensureOrigamiLayer();
    if (layer) {
      layer.opacity = scaleMidiValue(value, 0, 1);
      renderLayerList();
    }
    return;
  }
  if (target === 'layer-glyph.enabled') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      let layer = scene.layers.find((item) => item.id === 'layer-glyph');
      if (!layer) {
        layer = {
          id: 'layer-glyph',
          name: 'Glyph Language',
          role: getDefaultRoleForLayerId('layer-glyph'),
          enabled: true,
          opacity: 0.8,
          blendMode: 'screen',
          transform: { x: 0, y: 0, scale: 1, rotation: 0 }
        };
        scene.layers.push(layer);
      }
      const next = isToggle ? !layer.enabled : value > 0.5;
      layer.enabled = next;
      if (glyphToggle) glyphToggle.checked = next;
      renderLayerList();
    }
    return;
  }
  if (target === 'layer-glyph.opacity') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    const layer = scene?.layers.find((item) => item.id === 'layer-glyph');
    if (layer) {
      layer.opacity = scaleMidiValue(value, 0, 1);
      renderLayerList();
    }
    return;
  }
  if (target === 'layer-crystal.enabled') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      let layer = scene.layers.find((item) => item.id === 'layer-crystal');
      if (!layer) {
        layer = {
          id: 'layer-crystal',
          name: 'Crystal Harmonics',
          role: getDefaultRoleForLayerId('layer-crystal'),
          enabled: true,
          opacity: 0.85,
          blendMode: 'screen',
          transform: { x: 0, y: 0, scale: 1, rotation: 0 }
        };
        scene.layers.push(layer);
      }
      const next = isToggle ? !layer.enabled : value > 0.5;
      layer.enabled = next;
      if (crystalToggle) crystalToggle.checked = next;
      renderLayerList();
    }
    return;
  }
  if (target === 'layer-crystal.opacity') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    const layer = scene?.layers.find((item) => item.id === 'layer-crystal');
    if (layer) {
      layer.opacity = scaleMidiValue(value, 0, 1);
      renderLayerList();
    }
    return;
  }
  if (target === 'layer-inkflow.enabled') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      let layer = scene.layers.find((item) => item.id === 'layer-inkflow');
      if (!layer) {
        layer = {
          id: 'layer-inkflow',
          name: 'Ink Flow',
          role: getDefaultRoleForLayerId('layer-inkflow'),
          enabled: true,
          opacity: 0.85,
          blendMode: 'screen',
          transform: { x: 0, y: 0, scale: 1, rotation: 0 }
        };
        scene.layers.push(layer);
      }
      const next = isToggle ? !layer.enabled : value > 0.5;
      layer.enabled = next;
      if (inkToggle) inkToggle.checked = next;
      renderLayerList();
    }
    return;
  }
  if (target === 'layer-inkflow.opacity') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    const layer = scene?.layers.find((item) => item.id === 'layer-inkflow');
    if (layer) {
      layer.opacity = scaleMidiValue(value, 0, 1);
      renderLayerList();
    }
    return;
  }
  if (target === 'layer-topo.enabled') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      let layer = scene.layers.find((item) => item.id === 'layer-topo');
      if (!layer) {
        layer = {
          id: 'layer-topo',
          name: 'Topo Terrain',
          role: getDefaultRoleForLayerId('layer-topo'),
          enabled: true,
          opacity: 0.85,
          blendMode: 'screen',
          transform: { x: 0, y: 0, scale: 1, rotation: 0 }
        };
        scene.layers.push(layer);
      }
      const next = isToggle ? !layer.enabled : value > 0.5;
      layer.enabled = next;
      if (topoToggle) topoToggle.checked = next;
      renderLayerList();
    }
    return;
  }
  if (target === 'layer-topo.opacity') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    const layer = scene?.layers.find((item) => item.id === 'layer-topo');
    if (layer) {
      layer.opacity = scaleMidiValue(value, 0, 1);
      renderLayerList();
    }
    return;
  }
  if (target === 'layer-weather.enabled') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      let layer = scene.layers.find((item) => item.id === 'layer-weather');
      if (!layer) {
        layer = {
          id: 'layer-weather',
          name: 'Audio Weather',
          role: getDefaultRoleForLayerId('layer-weather'),
          enabled: true,
          opacity: 0.85,
          blendMode: 'screen',
          transform: { x: 0, y: 0, scale: 1, rotation: 0 }
        };
        scene.layers.push(layer);
      }
      const next = isToggle ? !layer.enabled : value > 0.5;
      layer.enabled = next;
      if (weatherToggle) weatherToggle.checked = next;
      renderLayerList();
    }
    return;
  }
  if (target === 'layer-weather.opacity') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    const layer = scene?.layers.find((item) => item.id === 'layer-weather');
    if (layer) {
      layer.opacity = scaleMidiValue(value, 0, 1);
      renderLayerList();
    }
    return;
  }
  if (target === 'layer-portal.enabled') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      let layer = scene.layers.find((item) => item.id === 'layer-portal');
      if (!layer) {
        layer = {
          id: 'layer-portal',
          name: 'Wormhole Portal',
          role: getDefaultRoleForLayerId('layer-portal'),
          enabled: true,
          opacity: 0.85,
          blendMode: 'screen',
          transform: { x: 0, y: 0, scale: 1, rotation: 0 }
        };
        scene.layers.push(layer);
      }
      const next = isToggle ? !layer.enabled : value > 0.5;
      layer.enabled = next;
      if (portalToggle) portalToggle.checked = next;
      renderLayerList();
    }
    return;
  }
  if (target === 'layer-portal.opacity') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    const layer = scene?.layers.find((item) => item.id === 'layer-portal');
    if (layer) {
      layer.opacity = scaleMidiValue(value, 0, 1);
      renderLayerList();
    }
    return;
  }
  if (target === 'layer-media.enabled') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      let layer = scene.layers.find((item) => item.id === 'layer-media');
      if (!layer) {
        layer = {
          id: 'layer-media',
          name: 'Media Overlay',
          role: getDefaultRoleForLayerId('layer-media'),
          enabled: true,
          opacity: 0.9,
          blendMode: 'screen',
          transform: { x: 0, y: 0, scale: 1, rotation: 0 }
        };
        scene.layers.push(layer);
      }
      const next = isToggle ? !layer.enabled : value > 0.5;
      layer.enabled = next;
      renderLayerList();
    }
    return;
  }
  if (target === 'layer-media.opacity') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    const layer = scene?.layers.find((item) => item.id === 'layer-media');
    if (layer) {
      layer.opacity = scaleMidiValue(value, 0, 1);
      renderLayerList();
    }
    return;
  }
  if (target === 'layer-media.burst') {
    if (value > 0.5) {
      spawnMediaBurst();
    }
    return;
  }
  if (target === 'layer-oscillo.enabled') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      let layer = scene.layers.find((item) => item.id === 'layer-oscillo');
      if (!layer) {
        layer = {
          id: 'layer-oscillo',
          name: 'Sacred Oscilloscope',
          role: getDefaultRoleForLayerId('layer-oscillo'),
          enabled: true,
          opacity: 0.85,
          blendMode: 'screen',
          transform: { x: 0, y: 0, scale: 1, rotation: 0 }
        };
        scene.layers.push(layer);
      }
      const next = isToggle ? !layer.enabled : value > 0.5;
      layer.enabled = next;
      if (oscilloToggle) oscilloToggle.checked = next;
      renderLayerList();
    }
    return;
  }
  if (target === 'layer-oscillo.opacity') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    const layer = scene?.layers.find((item) => item.id === 'layer-oscillo');
    if (layer) {
      layer.opacity = scaleMidiValue(value, 0, 1);
      renderLayerList();
    }
    return;
  }
  // Speed/Scale/Elevation targets - stored in midiSum
  if (target === 'layer-plasma.speed' || target === 'layer-plasma.scale') {
    midiSum[target] = scaleMidiValue(value, 0, 2);
    return;
  }
  if (target === 'layer-origami.speed') {
    midiSum[target] = scaleMidiValue(value, 0, 2);
    return;
  }
  if (target === 'layer-glyph.speed') {
    midiSum[target] = scaleMidiValue(value, 0, 2);
    return;
  }
  if (target === 'layer-crystal.speed' || target === 'layer-crystal.scale') {
    midiSum[target] = scaleMidiValue(value, 0, 2);
    return;
  }
  if (target === 'layer-inkflow.speed' || target === 'layer-inkflow.scale') {
    midiSum[target] = scaleMidiValue(value, 0, 2);
    return;
  }
  if (target === 'layer-topo.scale' || target === 'layer-topo.elevation') {
    midiSum[target] = scaleMidiValue(value, 0, 2);
    return;
  }
  if (target === 'layer-weather.speed') {
    midiSum[target] = scaleMidiValue(value, 0, 2);
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
      updateMacroPreviews();
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

const renderPalettePreview = (colors: [string, string, string, string, string]) => {
  palettePreview.innerHTML = '';
  colors.forEach((color) => {
    const swatch = document.createElement('div');
    swatch.className = 'palette-swatch';
    swatch.style.background = color;
    palettePreview.appendChild(swatch);
  });
};

const applyPaletteSelection = (paletteId: string) => {
  const palette =
    currentProject.palettes.find((item) => item.id === paletteId) ?? currentProject.palettes[0];
  if (!palette) return;
  currentProject.activePaletteId = palette.id;
  renderPalettePreview(palette.colors);
  renderer?.setPalette?.(palette.colors);

  const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
  if (paletteApplyToggle.checked && scene) {
    scene.look = {
      ...scene.look,
      palettes: cloneValue(currentProject.palettes),
      activePaletteId: palette.id
    };
  }
};

const initPalettes = () => {
  ensureProjectPalettes(currentProject);
  const scene =
    currentProject.scenes.find((item) => item.id === currentProject.activeSceneId) ??
    currentProject.scenes[0];
  paletteApplyToggle.checked = Boolean(scene?.look?.activePaletteId);
  paletteSelect.innerHTML = '';
  const palettes = [...currentProject.palettes].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  );
  palettes.forEach((palette) => {
    const option = document.createElement('option');
    option.value = palette.id;
    option.textContent = palette.name;
    paletteSelect.appendChild(option);
  });
  paletteSelect.value = currentProject.activePaletteId ?? palettes[0]?.id ?? '';
  if (paletteSelect.value) {
    applyPaletteSelection(paletteSelect.value);
  }
  paletteSelect.onchange = () => {
    applyPaletteSelection(paletteSelect.value);
  };
  paletteApplyToggle.onchange = () => {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (!scene) return;
    if (paletteApplyToggle.checked) {
      scene.look = {
        ...scene.look,
        palettes: cloneValue(currentProject.palettes),
        activePaletteId: currentProject.activePaletteId
      };
    } else if (scene.look) {
      delete scene.look.palettes;
      delete scene.look.activePaletteId;
    }
  };
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
  macroPreviewRows = [];
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
      updateMacroPreviews();
      syncMacroHeroFromProject();
      syncMacrosToActiveScene();
    });

    const learn = document.createElement('button');
    learn.className = 'macro-learn';
    learn.textContent = 'Learn';
    learn.addEventListener('click', () => {
      setStatus(`MIDI learn placeholder for ${macro.name}`);
    });

    const preview = document.createElement('div');
    preview.className = 'macro-preview';
    preview.textContent = '';

    row.appendChild(label);
    row.appendChild(slider);
    row.appendChild(learn);
    row.appendChild(preview);
    macroList.appendChild(row);
    macroInputs.push(slider);
    macroPreviewRows.push(preview);
  });
  initLearnables();
  updateMacroPreviews();
  syncMacroHeroFromProject();
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
  const expressive = currentProject.expressiveFx ?? DEFAULT_PROJECT.expressiveFx;
  expressiveEnergyEnabled.checked = expressive.energyBloom.enabled;
  expressiveEnergyMacro.value = String(expressive.energyBloom.macro);
  expressiveEnergyIntentEnabled.checked = expressive.energyBloom.intentBinding.enabled;
  expressiveEnergyIntent.value = expressive.energyBloom.intentBinding.intent;
  expressiveEnergyIntentAmount.value = String(expressive.energyBloom.intentBinding.amount);
  expressiveEnergyThreshold.value = String(expressive.energyBloom.expert.threshold);
  expressiveEnergyAccumulation.value = String(expressive.energyBloom.expert.accumulation);

  expressiveRadialEnabled.checked = expressive.radialGravity.enabled;
  expressiveRadialMacro.value = String(expressive.radialGravity.macro);
  expressiveRadialIntentEnabled.checked = expressive.radialGravity.intentBinding.enabled;
  expressiveRadialIntent.value = expressive.radialGravity.intentBinding.intent;
  expressiveRadialIntentAmount.value = String(expressive.radialGravity.intentBinding.amount);
  expressiveRadialStrength.value = String(expressive.radialGravity.expert.strength);
  expressiveRadialRadius.value = String(expressive.radialGravity.expert.radius);
  expressiveRadialFocusX.value = String(expressive.radialGravity.expert.focusX);
  expressiveRadialFocusY.value = String(expressive.radialGravity.expert.focusY);

  expressiveEchoEnabled.checked = expressive.motionEcho.enabled;
  expressiveEchoMacro.value = String(expressive.motionEcho.macro);
  expressiveEchoIntentEnabled.checked = expressive.motionEcho.intentBinding.enabled;
  expressiveEchoIntent.value = expressive.motionEcho.intentBinding.intent;
  expressiveEchoIntentAmount.value = String(expressive.motionEcho.intentBinding.amount);
  expressiveEchoDecay.value = String(expressive.motionEcho.expert.decay);
  expressiveEchoWarp.value = String(expressive.motionEcho.expert.warp);

  expressiveSmearEnabled.checked = expressive.spectralSmear.enabled;
  expressiveSmearMacro.value = String(expressive.spectralSmear.macro);
  expressiveSmearIntentEnabled.checked = expressive.spectralSmear.intentBinding.enabled;
  expressiveSmearIntent.value = expressive.spectralSmear.intentBinding.intent;
  expressiveSmearIntentAmount.value = String(expressive.spectralSmear.intentBinding.amount);
  expressiveSmearOffset.value = String(expressive.spectralSmear.expert.offset);
  expressiveSmearMix.value = String(expressive.spectralSmear.expert.mix);
};

const initParticles = () => {
  particlesEnabled.checked = currentProject.particles.enabled;
  particlesDensity.value = String(currentProject.particles.density);
  particlesSpeed.value = String(currentProject.particles.speed);
  particlesSize.value = String(currentProject.particles.size);
  particlesGlow.value = String(currentProject.particles.glow);
};

const getActiveScene = () =>
  currentProject.scenes.find((scene) => scene.id === currentProject.activeSceneId);

const formatMacroPreviewValue = (value: number | undefined, fallback = '—') => {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
  return value.toFixed(3).replace(/\.?0+$/, '');
};

const flashInteraction = (target: HTMLElement | null) => {
  if (!target) return;
  const host =
    target.closest<HTMLElement>(
      '.macro-hero-item, .panel-block, .scene-row, .scene-label, .scene-inline, .mode-button, button'
    ) ?? target;
  host.classList.add('interaction-flash');
  window.setTimeout(() => host.classList.remove('interaction-flash'), 180);
};

const resolveMacroTargetBase = (target: string) => {
  const parsed = parseLegacyTarget(target);
  if (!parsed) return null;
  const { layerType, param } = parsed;
  const layerId = buildLegacyTarget(layerType, '').split('.')[0];
  const scene = getActiveScene();
  const layer = scene?.layers.find((item) => item.id === layerId);
  if (param === 'opacity') {
    return layer?.opacity;
  }
  if (param === 'enabled') {
    return layer?.enabled ? 1 : 0;
  }
  if (param.startsWith('effects.')) {
    const fxKey = param.split('.')[1];
    return (currentProject.effects as any)?.[fxKey];
  }
  const layerParam = layer?.params?.[param];
  return typeof layerParam === 'number' ? layerParam : undefined;
};

const updateMacroPreviews = () => {
  if (macroPreviewRows.length === 0) return;
  currentProject.macros.forEach((macro, index) => {
    const preview = macroPreviewRows[index];
    if (!preview) return;
    if (!macro.targets || macro.targets.length === 0) {
      preview.textContent = '';
      return;
    }
    const snippets: string[] = [];
    macro.targets.slice(0, 3).forEach((target) => {
      const rawTarget = target.target as
        | string
        | { type?: string; layerType?: string; param: string };
      let key: string | null = null;
      if (typeof rawTarget === 'string') {
        key = rawTarget;
      } else if (rawTarget && rawTarget.param) {
        const layerType = rawTarget.type ?? rawTarget.layerType;
        if (layerType) {
          key = buildLegacyTarget(layerType, rawTarget.param);
        }
      }
      if (!key) return;
      const base = resolveMacroTargetBase(key);
      const effective = typeof base === 'number' ? base + macro.value * target.amount : undefined;
      snippets.push(`${key} → ${formatMacroPreviewValue(effective)}`);
    });
    preview.textContent = snippets.join(' • ');
  });
};

const macroHeroInputs = [macroEnergy, macroMotion, macroColor, macroDensity];
const macroHeroValues = [macroEnergyValue, macroMotionValue, macroColorValue, macroDensityValue];

const syncMacrosToActiveScene = () => {
  const scene = getActiveScene();
  if (!scene) return;
  if (!scene.look) scene.look = {};
  scene.look.macros = cloneValue(currentProject.macros);
};

const syncMacroHeroFromProject = () => {
  macroHeroInputs.forEach((input, index) => {
    const value = currentProject.macros[index]?.value ?? 0;
    input.value = String(value);
    const valueLabel = macroHeroValues[index];
    if (valueLabel) valueLabel.textContent = formatMacroPreviewValue(value, '0.00');
  });
};

const updateMacroFromHero = (index: number, value: number) => {
  if (!currentProject.macros[index]) return;
  currentProject.macros[index].value = value;
  const slider = macroInputs[index];
  if (slider) slider.value = String(value);
  const valueLabel = macroHeroValues[index];
  if (valueLabel) valueLabel.textContent = formatMacroPreviewValue(value, '0.00');
  updateMacroPreviews();
  syncMacrosToActiveScene();
};

const hasAdvancedSdfLayer = () => {
  const scene = getActiveScene();
  return Boolean(scene?.layers.find((layer) => layer.id === 'gen-sdf-scene'));
};

const ensureAdvancedSdfLayer = () => {
  const scene = getActiveScene();
  if (!scene) return;
  let layer = scene.layers.find((item) => item.id === 'gen-sdf-scene');
  if (!layer) {
    layer = {
      id: 'gen-sdf-scene',
      name: 'SDF Scene (Advanced)',
      enabled: true,
      opacity: 1,
      blendMode: 'normal',
      transform: { x: 0, y: 0, scale: 1, rotation: 0 },
      sdfScene: {
        nodes: [],
        connections: [],
        mode: '2d'
      }
    };
    scene.layers.push(layer);
    renderLayerList();
  }
};

const updateSdfAdvancedVisibility = () => {
  const available = hasAdvancedSdfLayer();
  sdfAdvancedToggle.classList.toggle('hidden', !available);
  if (!available) {
    sdfAdvancedToggle.checked = false;
    sdfSimpleControls.classList.remove('hidden');
    sdfEditor.classList.add('hidden');
  }
};

const initSdf = () => {
  registerSdfNodes();
  updateSdfAdvancedVisibility();
  sdfEnabled.checked = currentProject.sdf.enabled;
  sdfShape.value = currentProject.sdf.shape;
  sdfScale.value = String(currentProject.sdf.scale);
  sdfRotation.value = String(currentProject.sdf.rotation);
  sdfEdge.value = String(currentProject.sdf.edge);
  sdfGlow.value = String(currentProject.sdf.glow);
  sdfFill.value = String(currentProject.sdf.fill);
  
  if (currentProject.sdf.color) {
      const r = Math.round(currentProject.sdf.color[0] * 255).toString(16).padStart(2, '0');
      const g = Math.round(currentProject.sdf.color[1] * 255).toString(16).padStart(2, '0');
      const b = Math.round(currentProject.sdf.color[2] * 255).toString(16).padStart(2, '0');
      sdfColor.value = `#${r}${g}${b}`;
  }

  // Initialize Advanced Panel
  if (!sdfPanel) {
    sdfPanel = createSdfPanel({
      store: {
        getState: () => ({ project: currentProject }),
        dispatch: (action: any) => { /* dummy if not needed yet */ }
      } as any
    });
  }

  sdfAdvancedToggle.addEventListener('change', () => {
    if (sdfAdvancedToggle.checked) {
      ensureAdvancedSdfLayer();
    }
    const advanced = sdfAdvancedToggle.checked;
    sdfSimpleControls.classList.toggle('hidden', advanced);
    sdfEditor.classList.toggle('hidden', !advanced);
    if (advanced) sdfPanel?.render();
  });

  // Set initial state
  const isAdvanced = false; // Default to simple for now or extract from project if added
  sdfAdvancedToggle.checked = isAdvanced;
  sdfSimpleControls.classList.toggle('hidden', isAdvanced);
  sdfEditor.classList.toggle('hidden', !isAdvanced);
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

const applyExpressiveFxControls = () => {
  currentProject.expressiveFx = {
    energyBloom: {
      enabled: expressiveEnergyEnabled.checked,
      macro: Number(expressiveEnergyMacro.value),
      intentBinding: {
        enabled: expressiveEnergyIntentEnabled.checked,
        intent: expressiveEnergyIntent.value as SceneIntent,
        amount: Number(expressiveEnergyIntentAmount.value)
      },
      expert: {
        threshold: Number(expressiveEnergyThreshold.value),
        accumulation: Number(expressiveEnergyAccumulation.value)
      }
    },
    radialGravity: {
      enabled: expressiveRadialEnabled.checked,
      macro: Number(expressiveRadialMacro.value),
      intentBinding: {
        enabled: expressiveRadialIntentEnabled.checked,
        intent: expressiveRadialIntent.value as SceneIntent,
        amount: Number(expressiveRadialIntentAmount.value)
      },
      expert: {
        strength: Number(expressiveRadialStrength.value),
        radius: Number(expressiveRadialRadius.value),
        focusX: Number(expressiveRadialFocusX.value),
        focusY: Number(expressiveRadialFocusY.value)
      }
    },
    motionEcho: {
      enabled: expressiveEchoEnabled.checked,
      macro: Number(expressiveEchoMacro.value),
      intentBinding: {
        enabled: expressiveEchoIntentEnabled.checked,
        intent: expressiveEchoIntent.value as SceneIntent,
        amount: Number(expressiveEchoIntentAmount.value)
      },
      expert: {
        decay: Number(expressiveEchoDecay.value),
        warp: Number(expressiveEchoWarp.value)
      }
    },
    spectralSmear: {
      enabled: expressiveSmearEnabled.checked,
      macro: Number(expressiveSmearMacro.value),
      intentBinding: {
        enabled: expressiveSmearIntentEnabled.checked,
        intent: expressiveSmearIntent.value as SceneIntent,
        amount: Number(expressiveSmearIntentAmount.value)
      },
      expert: {
        offset: Number(expressiveSmearOffset.value),
        mix: Number(expressiveSmearMix.value)
      }
    }
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
    fill: Number(sdfFill.value),
    color: [
        parseInt(sdfColor.value.slice(1, 3), 16) / 255,
        parseInt(sdfColor.value.slice(3, 5), 16) / 255,
        parseInt(sdfColor.value.slice(5, 7), 16) / 255
    ]
  };
  if (sdfAdvancedToggle.checked) {
    sdfPanel?.render();
  }
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

const ensureOrigamiLayer = (enable = false) => {
  const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
  if (!scene) return null;
  let layer = scene.layers.find((item) => item.id === 'layer-origami');
  if (!layer) {
    layer = {
      id: 'layer-origami',
      name: 'Origami Fold',
      role: getDefaultRoleForLayerId('layer-origami'),
      enabled: enable,
      opacity: 0.85,
      blendMode: 'screen',
      transform: { x: 0, y: 0, scale: 1, rotation: 0 }
    };
    scene.layers.push(layer);
    renderLayerList();
  } else if (enable) {
    layer.enabled = true;
  }
  return layer;
};

const computeAudioCentroid = () => {
  let sum = 0;
  let weighted = 0;
  for (let i = 0; i < audioState.spectrum.length; i += 1) {
    const value = audioState.spectrum[i];
    sum += value;
    weighted += value * i;
  }
  const index = sum > 0 ? weighted / sum : 0;
  const x = ((index / (audioState.spectrum.length - 1)) - 0.5) * 1.2;
  const bass = audioState.bands[0] ?? 0;
  const y = (0.45 - bass * 0.6);
  return { x: Math.min(0.7, Math.max(-0.7, x)), y: Math.min(0.7, Math.max(-0.7, y)) };
};

const spawnGravityWell = (mode: 'fixed' | 'audio') => {
  const slotIndex = gravityWells.findIndex((well) => !well.active);
  const index = slotIndex === -1 ? 0 : slotIndex;
  const slot = gravityFixedSlots[gravityFixedIndex % gravityFixedSlots.length];
  const spawn = mode === 'audio' ? computeAudioCentroid() : slot;
  const bass = audioState.bands[0] ?? 0;
  const strength = 0.35 + bass * 0.8;
  gravityWells[index] = {
    ...gravityWells[index],
    x: spawn.x,
    y: spawn.y,
    baseX: spawn.x,
    baseY: spawn.y,
    strength,
    polarity: gravityGlobalPolarity,
    active: true
  };
  gravityFixedIndex = (gravityFixedIndex + 1) % gravityFixedSlots.length;
  lastGravityIndex = index;
};

const destroyGravityWell = () => {
  if (lastGravityIndex >= 0 && gravityWells[lastGravityIndex]?.active) {
    gravityWells[lastGravityIndex].active = false;
    return;
  }
  const activeIndex = gravityWells.map((well, i) => (well.active ? i : -1)).filter((i) => i >= 0);
  if (activeIndex.length > 0) {
    gravityWells[activeIndex[activeIndex.length - 1]].active = false;
  }
};

const flipGravityPolarity = (all = true) => {
  if (all) {
    gravityGlobalPolarity *= -1;
    gravityWells.forEach((well) => {
      if (well.active) {
        well.polarity *= -1;
      }
    });
    return;
  }
  if (lastGravityIndex >= 0 && gravityWells[lastGravityIndex]?.active) {
    gravityWells[lastGravityIndex].polarity *= -1;
  }
};

const collapseGravityWells = () => {
  gravityCollapse = 1;
};

const spawnPortal = () => {
  const index = portals.findIndex((portal) => !portal.active);
  const slot = index === -1 ? 0 : index;
  const x = (Math.random() - 0.5) * 1.2;
  const y = (Math.random() - 0.5) * 1.2;
  portals[slot] = {
    ...portals[slot],
    x,
    y,
    radius: 0.18 + (audioState.bands[2] ?? 0) * 0.35,
    active: true,
    phase: Math.random() * Math.PI * 2
  };
};

const collapsePortal = () => {
  const activeIndex = portals.map((portal, i) => (portal.active ? i : -1)).filter((i) => i >= 0);
  if (activeIndex.length > 0) {
    portals[activeIndex[activeIndex.length - 1]].active = false;
  }
};

const triggerPortalTransition = () => {
  portalShift = 0.2 + (audioState.bands[4] ?? 0) * 0.4;
  portalSeed = (portalSeed + 17.3) % 1000;
};

const spawnMediaBurst = (forcedType?: number) => {
  const slotIndex = mediaBursts.findIndex((burst) => !burst.active);
  const index = slotIndex === -1 ? 0 : slotIndex;
  const type = typeof forcedType === 'number' ? forcedType : Math.floor(Math.random() * 3);
  const x = 0.1 + Math.random() * 0.8;
  const y = 0.1 + Math.random() * 0.8;
  mediaBursts[index] = {
    ...mediaBursts[index],
    x,
    y,
    radius: 0.04,
    life: 1,
    type,
    active: true
  };
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
  if (action.startsWith('origami-')) {
    const foldMap: Record<string, number> = {
      'origami-mountain': 0,
      'origami-valley': 1,
      'origami-collapse': 2,
      'origami-explode': 3
    };
    origamiFoldState = foldMap[action] ?? 0;
    origamiFoldSharpness = Math.min(1, Math.max(0.2, velocity));
    const layer = ensureOrigamiLayer(true);
    if (layer) {
      layer.enabled = true;
      renderLayerList();
    }
    updatePadUI(localIndex, true);
    setTimeout(() => updatePadUI(localIndex, false), 140);
    return;
  }
  if (action === 'gravity-spawn-fixed') {
    spawnGravityWell('fixed');
    updatePadUI(localIndex, true);
    setTimeout(() => updatePadUI(localIndex, false), 140);
    return;
  }
  if (action === 'gravity-spawn-audio') {
    spawnGravityWell('audio');
    updatePadUI(localIndex, true);
    setTimeout(() => updatePadUI(localIndex, false), 140);
    return;
  }
  if (action === 'gravity-destroy') {
    destroyGravityWell();
    updatePadUI(localIndex, true);
    setTimeout(() => updatePadUI(localIndex, false), 140);
    return;
  }
  if (action === 'gravity-toggle-polarity') {
    flipGravityPolarity(true);
    updatePadUI(localIndex, true);
    setTimeout(() => updatePadUI(localIndex, false), 140);
    return;
  }
  if (action === 'gravity-flip-last') {
    flipGravityPolarity(false);
    updatePadUI(localIndex, true);
    setTimeout(() => updatePadUI(localIndex, false), 140);
    return;
  }
  if (action === 'gravity-collapse') {
    collapseGravityWells();
    updatePadUI(localIndex, true);
    setTimeout(() => updatePadUI(localIndex, false), 140);
    return;
  }
  if (action === 'glyph-stack') {
    glyphMode = 0;
    glyphSeed = (glyphSeed + 11.1) % 1000;
    updatePadUI(localIndex, true);
    setTimeout(() => updatePadUI(localIndex, false), 140);
    return;
  }
  if (action === 'glyph-orbit') {
    glyphMode = 1;
    glyphSeed = (glyphSeed + 17.7) % 1000;
    updatePadUI(localIndex, true);
    setTimeout(() => updatePadUI(localIndex, false), 140);
    return;
  }
  if (action === 'glyph-explode') {
    glyphMode = 2;
    glyphSeed = (glyphSeed + 23.3) % 1000;
    updatePadUI(localIndex, true);
    setTimeout(() => updatePadUI(localIndex, false), 140);
    return;
  }
  if (action === 'glyph-sentence') {
    glyphMode = 3;
    glyphSeed = (glyphSeed + 31.9) % 1000;
    updatePadUI(localIndex, true);
    setTimeout(() => updatePadUI(localIndex, false), 140);
    return;
  }
  if (action === 'crystal-seed') {
    crystalMode = 0;
    crystalBrittleness = Math.min(1, Math.max(0.1, velocity));
    updatePadUI(localIndex, true);
    setTimeout(() => updatePadUI(localIndex, false), 140);
    return;
  }
  if (action === 'crystal-grow') {
    crystalMode = 1;
    crystalBrittleness = Math.min(1, Math.max(0.1, velocity));
    updatePadUI(localIndex, true);
    setTimeout(() => updatePadUI(localIndex, false), 140);
    return;
  }
  if (action === 'crystal-fracture') {
    crystalMode = 2;
    crystalBrittleness = Math.min(1, Math.max(0.1, velocity));
    updatePadUI(localIndex, true);
    setTimeout(() => updatePadUI(localIndex, false), 140);
    return;
  }
  if (action === 'crystal-melt') {
    crystalMode = 3;
    crystalBrittleness = Math.min(1, Math.max(0.1, velocity));
    updatePadUI(localIndex, true);
    setTimeout(() => updatePadUI(localIndex, false), 140);
    return;
  }
  if (action === 'ink-fine') {
    inkBrush = 0;
    inkPressure = Math.min(1, Math.max(0.2, velocity));
    updatePadUI(localIndex, true);
    setTimeout(() => updatePadUI(localIndex, false), 140);
    return;
  }
  if (action === 'ink-dry') {
    inkBrush = 1;
    inkPressure = Math.min(1, Math.max(0.2, velocity));
    updatePadUI(localIndex, true);
    setTimeout(() => updatePadUI(localIndex, false), 140);
    return;
  }
  if (action === 'ink-neon') {
    inkBrush = 2;
    inkPressure = Math.min(1, Math.max(0.2, velocity));
    updatePadUI(localIndex, true);
    setTimeout(() => updatePadUI(localIndex, false), 140);
    return;
  }
  if (action === 'ink-lifespan') {
    inkLifespan = Math.min(1, Math.max(0.1, velocity));
    updatePadUI(localIndex, true);
    setTimeout(() => updatePadUI(localIndex, false), 140);
    return;
  }
  if (action === 'ink-pressure') {
    inkPressure = Math.min(1, Math.max(0.1, velocity));
    updatePadUI(localIndex, true);
    setTimeout(() => updatePadUI(localIndex, false), 140);
    return;
  }
  if (action === 'topo-quake') {
    topoQuake = Math.min(1, Math.max(0.2, velocity));
    updatePadUI(localIndex, true);
    setTimeout(() => updatePadUI(localIndex, false), 140);
    return;
  }
  if (action === 'topo-landslide') {
    topoSlide = Math.min(1, Math.max(0.2, velocity));
    updatePadUI(localIndex, true);
    setTimeout(() => updatePadUI(localIndex, false), 140);
    return;
  }
  if (action === 'topo-plate') {
    topoPlate = Math.min(1, Math.max(0.2, velocity));
    updatePadUI(localIndex, true);
    setTimeout(() => updatePadUI(localIndex, false), 140);
    return;
  }
  if (action === 'weather-storm') {
    weatherMode = 0;
    weatherIntensity = Math.min(1, Math.max(0.2, velocity));
    updatePadUI(localIndex, true);
    setTimeout(() => updatePadUI(localIndex, false), 140);
    return;
  }
  if (action === 'weather-fog') {
    weatherMode = 1;
    weatherIntensity = Math.min(1, Math.max(0.2, velocity));
    updatePadUI(localIndex, true);
    setTimeout(() => updatePadUI(localIndex, false), 140);
    return;
  }
  if (action === 'weather-calm') {
    weatherMode = 2;
    weatherIntensity = Math.min(1, Math.max(0.2, velocity));
    updatePadUI(localIndex, true);
    setTimeout(() => updatePadUI(localIndex, false), 140);
    return;
  }
  if (action === 'weather-hurricane') {
    weatherMode = 3;
    weatherIntensity = Math.min(1, Math.max(0.2, velocity));
    updatePadUI(localIndex, true);
    setTimeout(() => updatePadUI(localIndex, false), 140);
    return;
  }
  if (action === 'portal-spawn') {
    spawnPortal();
    updatePadUI(localIndex, true);
    setTimeout(() => updatePadUI(localIndex, false), 140);
    return;
  }
  if (action === 'portal-collapse') {
    collapsePortal();
    updatePadUI(localIndex, true);
    setTimeout(() => updatePadUI(localIndex, false), 140);
    return;
  }
  if (action === 'portal-transition') {
    triggerPortalTransition();
    updatePadUI(localIndex, true);
    setTimeout(() => updatePadUI(localIndex, false), 140);
    return;
  }
  if (action === 'oscillo-capture') {
    oscilloMode = (oscilloMode + 1) % 3;
    oscilloCapture.set(audioState.waveform);
    updatePadUI(localIndex, true);
    setTimeout(() => updatePadUI(localIndex, false), 140);
    return;
  }
  if (action === 'oscillo-freeze') {
    oscilloFreeze = oscilloFreeze > 0.5 ? 0 : 1;
    if (oscilloFreeze > 0.5) {
      oscilloCapture.set(audioState.waveform);
    }
    updatePadUI(localIndex, true);
    setTimeout(() => updatePadUI(localIndex, false), 140);
    return;
  }
  if (action === 'oscillo-rotate') {
    oscilloRotate = (oscilloRotate + 1) % 6;
    updatePadUI(localIndex, true);
    setTimeout(() => updatePadUI(localIndex, false), 140);
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
      updateMacroPreviews();
      syncMacroHeroFromProject();
      syncMacrosToActiveScene();
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
  const timeData = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(timeData);

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
  for (let i = 0; i < audioState.waveform.length; i += 1) {
    const sample = timeData[Math.floor((i / audioState.waveform.length) * timeData.length)];
    audioState.waveform[i] = (sample - 128) / 128;
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
    glyphBeatPulse = 1;
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

const serializePerformance = () => {
  const now = new Date().toISOString();
  
  // Find current visual mode metadata
  const currentMode = VISUAL_MODES.find(m => m.id === currentProject.activeModeId) || VISUAL_MODES[0];

  const performance: any = {
    version: 5,
    metadata: {
      version: 5,
      name: currentProject.name,
      createdAt: currentProject.createdAt || now,
      updatedAt: now,
      activeModeId: currentProject.activeModeId || 'mode-cosmic',
      intendedMusicStyle: currentProject.intendedMusicStyle || 'Any',
      visualIntentTags: currentProject.visualIntentTags || [],
      colorChemistry: currentProject.colorChemistry || ['analog', 'balanced'],
      defaultTransition: currentMode.transition
    },
    scenes: currentProject.scenes,
    activeSceneId: currentProject.activeSceneId,
    roleWeights: currentProject.roleWeights || { core: 1, support: 1, atmosphere: 1 },
    tempoSync: {
      bpm: getActiveBpm(),
      source: bpmSource
    },
    modulations: currentProject.modMatrix.map(mod => {
      const parsed = parseLegacyTarget(mod.target);
      return {
        source: mod.source,
        target: parsed ? { type: parsed.layerType, param: parsed.param } : mod.target,
        amount: mod.amount,
        min: mod.min,
        max: mod.max,
        curve: mod.curve,
        smoothing: mod.smoothing,
        bipolar: mod.bipolar
      };
    }),
    macros: currentProject.macros.map(macro => ({
      ...macro,
      value: macro.value // Presets save default values, but we capture current for performance state
    }))
  };

  return JSON.stringify(performance, null, 2);
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
  const normalized = parsed.data;
  ensureProjectMacros(normalized);
  ensureProjectPalettes(normalized);
  ensureProjectExpressiveFx(normalized);
  ensureProjectModulators(normalized);
  ensureProjectScenes(normalized);
  normalized.version = Math.max(normalized.version ?? 0, DEFAULT_PROJECT.version);
  currentProject = normalized;
  refreshSceneSelect();
  applyScene(currentProject.activeSceneId);
  outputConfig = { ...DEFAULT_OUTPUT_CONFIG, ...currentProject.output };
  await syncOutputConfig(outputConfig);
  await setOutputEnabled(outputConfig.enabled);
  initStylePresets();
  initPalettes();
  initMacros();
  initEffects();
  initParticles();
  initSdf();
  syncVisualizerFromProject();
  if (visualModeSelect) {
    visualModeSelect.value = normalized.activeModeId || 'mode-cosmic';
  }
  if (normalized.roleWeights) {
    mixRoleCore.value = String(normalized.roleWeights.core);
    mixRoleSupport.value = String(normalized.roleWeights.support);
    mixRoleAtmosphere.value = String(normalized.roleWeights.atmosphere);
  }
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
  void checkMissingAssets();
  setStatus(`Loaded project: ${currentProject.name}`);
};

saveButton.addEventListener('click', async () => {
  const payload = serializeProject();
  await window.visualSynth.saveProject(payload);
});

savePerfButton.addEventListener('click', async () => {
  const payload = serializePerformance();
  await window.visualSynth.saveProject(payload);
});

loadButton.addEventListener('click', async () => {
  const result = await window.visualSynth.openProject();
  if (!result.canceled && result.project) {
    await applyProject(result.project);
  }
});

if (applyPresetButton) {
  applyPresetButton.addEventListener('click', async () => {
    if (!presetSelect.value) return;
    await addSceneFromPreset(presetSelect.value);
  });
}

if (presetPrevButton) {
  presetPrevButton.addEventListener('click', () => {
    if (presetSelect.options.length === 0) return;
    const nextIndex =
      (presetSelect.selectedIndex - 1 + presetSelect.options.length) % presetSelect.options.length;
    presetSelect.selectedIndex = nextIndex;
    renderPresetBrowser();
    setPresetSelectionStatus('Previous');
  });
}

if (presetNextButton) {
  presetNextButton.addEventListener('click', () => {
    if (presetSelect.options.length === 0) return;
    const nextIndex = (presetSelect.selectedIndex + 1) % presetSelect.options.length;
    presetSelect.selectedIndex = nextIndex;
    renderPresetBrowser();
    setPresetSelectionStatus('Next');
  });
}

if (presetSelect) {
  presetSelect.addEventListener('change', () => {
    renderPresetBrowser();
    setPresetSelectionStatus('Selected');
  });
}

if (presetCategorySelect) {
  presetCategorySelect.addEventListener('change', () => {
    renderPresetBrowser();
  });
}

if (addBlankSceneButton) {
  addBlankSceneButton.addEventListener('click', () => {
    const scene = createBlankScene();
    addSceneToProject(scene, false);
    setStatus(`Scene added: ${scene.name}`);
  });
}

if (presetShuffleButton) {
  presetShuffleButton.addEventListener('click', () => {
    if (presetLibrary.length === 0) return;
    const filter = presetCategorySelect.value;
    const entries =
      filter === 'All' ? presetLibrary : presetLibrary.filter((item) => item.category === filter);
    const pick = entries[Math.floor(Math.random() * entries.length)];
    if (!pick) return;
    presetSelect.value = pick.path;
    renderPresetBrowser();
    setPresetSelectionStatus('Shuffle');
  });
}

if (applyTemplateButton) {
  applyTemplateButton.addEventListener('click', async () => {
    const templatePath = templateSelect.value;
    const result = await window.visualSynth.loadTemplate(templatePath);
    if (result.project) {
      await applyProject(result.project);
    }
  });
}

if (sceneSelect) {
  sceneSelect.disabled = true;
}

if (queueSceneButton) {
  queueSceneButton.addEventListener('click', () => {
    if (currentProject.scenes.length === 0) return;
    const targetSceneId = selectedSceneId ?? sceneSelect?.value;
    if (!targetSceneId) return;
    const bpm = getActiveBpm();
    const unit = quantizeSelect.value as QuantizationUnit;
    const scheduledTimeMs = getNextQuantizedTimeMs(performance.now(), bpm, unit);
    pendingSceneSwitch = { targetSceneId, scheduledTimeMs };
    const targetName =
      currentProject.scenes.find((scene) => scene.id === targetSceneId)?.name ?? targetSceneId;
    setStatus(`Queued scene switch to ${targetName}`);
  });
}

if (activateSceneButton) {
  activateSceneButton.addEventListener('click', () => {
    const targetSceneId = selectedSceneId ?? sceneSelect?.value;
    if (!targetSceneId) return;
    applyScene(targetSceneId);
    const targetName =
      currentProject.scenes.find((scene) => scene.id === targetSceneId)?.name ?? targetSceneId;
    setStatus(`Scene active: ${targetName}`);
  });
}

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

visualizerModeSelect.addEventListener('change', () => {
  setVisualizerMode(visualizerModeSelect.value as typeof visualizerMode);
});

visualizerEnabledToggle.addEventListener('change', () => {
  currentProject.visualizer.enabled = visualizerEnabledToggle.checked;
  visualizerCanvas.classList.toggle(
    'hidden',
    visualizerMode === 'off' || !currentProject.visualizer.enabled
  );
  renderLayerList();
});

visualizerOpacityInput.addEventListener('input', () => {
  currentProject.visualizer.opacity = Number(visualizerOpacityInput.value);
});
visualizerMacroToggle.addEventListener('change', () => {
  currentProject.visualizer.macroEnabled = visualizerMacroToggle.checked;
  visualizerMacroSelect.disabled = !visualizerMacroToggle.checked;
});
visualizerMacroSelect.addEventListener('change', () => {
  currentProject.visualizer.macroId = Number(visualizerMacroSelect.value);
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

assetLiveWebcamButton?.addEventListener('click', () => {
  void startLiveCapture('webcam');
});

assetLiveScreenButton?.addEventListener('click', () => {
  void startLiveCapture('screen');
});

assetTextAddButton?.addEventListener('click', () => {
  createTextAsset();
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

[macroEnergy, macroMotion, macroColor, macroDensity].forEach((control, index) => {
  control.addEventListener('input', () => {
    updateMacroFromHero(index, Number(control.value));
  });
});

document.addEventListener('input', (event) => {
  flashInteraction(event.target as HTMLElement);
});

document.addEventListener('click', (event) => {
  flashInteraction(event.target as HTMLElement);
});

[effectsEnabled, effectBloom, effectBlur, effectChroma, effectPosterize, effectKaleidoscope, effectFeedback, effectPersistence].forEach(
  (control) => {
    control.addEventListener('input', () => {
      applyEffectControls();
    });
  }
);

[
  expressiveEnergyEnabled,
  expressiveEnergyMacro,
  expressiveEnergyIntentEnabled,
  expressiveEnergyIntentAmount,
  expressiveEnergyThreshold,
  expressiveEnergyAccumulation,
  expressiveRadialEnabled,
  expressiveRadialMacro,
  expressiveRadialIntentEnabled,
  expressiveRadialIntentAmount,
  expressiveRadialStrength,
  expressiveRadialRadius,
  expressiveRadialFocusX,
  expressiveRadialFocusY,
  expressiveEchoEnabled,
  expressiveEchoMacro,
  expressiveEchoIntentEnabled,
  expressiveEchoIntentAmount,
  expressiveEchoDecay,
  expressiveEchoWarp,
  expressiveSmearEnabled,
  expressiveSmearMacro,
  expressiveSmearIntentEnabled,
  expressiveSmearIntentAmount,
  expressiveSmearOffset,
  expressiveSmearMix
].forEach((control) => {
  control.addEventListener('input', () => {
    applyExpressiveFxControls();
  });
});
[expressiveEnergyIntent, expressiveRadialIntent, expressiveEchoIntent, expressiveSmearIntent].forEach((control) => {
  control.addEventListener('change', () => {
    applyExpressiveFxControls();
  });
});

[particlesEnabled, particlesDensity, particlesSpeed, particlesSize, particlesGlow].forEach(
  (control) => {
    control.addEventListener('input', () => {
      applyParticleControls();
    });
  }
);

  [sdfEnabled, sdfScale, sdfRotation, sdfEdge, sdfGlow, sdfFill, sdfColor].forEach((control) => {
    control.addEventListener('input', () => {
      applySdfControls();
    });
  });
sdfShape.addEventListener('change', () => {
  applySdfControls();
});

visualModeSelect.addEventListener('change', () => {
  applyVisualMode(visualModeSelect.value);
});

[mixRoleCore, mixRoleSupport, mixRoleAtmosphere].forEach((slider) => {
  slider.addEventListener('input', () => {
    if (!currentProject.roleWeights) {
      currentProject.roleWeights = { core: 1, support: 1, atmosphere: 1 };
    }
    currentProject.roleWeights = {
      core: Number(mixRoleCore.value),
      support: Number(mixRoleSupport.value),
      atmosphere: Number(mixRoleAtmosphere.value)
    };
  });
});

audioSelect.addEventListener('change', async () => {
  await setupAudio(audioSelect.value);
});

perfToggleSpectrum.addEventListener('change', () => {
  const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
  const spectrumLayer = scene?.layers.find((layer) => layer.id === 'layer-spectrum');
  if (spectrumLayer) {
    spectrumLayer.enabled = perfToggleSpectrum.checked;
    recordPlaylistOverride('layer-spectrum', { enabled: perfToggleSpectrum.checked });
    renderLayerList();
    setStatus(`Spectrum Bars ${perfToggleSpectrum.checked ? 'enabled' : 'disabled'}`);
  }
});

perfTogglePlasma.addEventListener('change', () => {
  const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
  const plasmaLayer = scene?.layers.find((layer) => layer.id === 'layer-plasma');
  if (plasmaLayer) {
    plasmaLayer.enabled = perfTogglePlasma.checked;
    recordPlaylistOverride('layer-plasma', { enabled: perfTogglePlasma.checked });
    renderLayerList();
    setStatus(`Plasma Layer ${perfTogglePlasma.checked ? 'enabled' : 'disabled'}`);
  }
});

spectrumHintDismiss.addEventListener('click', () => {
  localStorage.setItem('visualsynth.spectrumHintDismissed', '1');
  spectrumHint.classList.add('hidden');
});

perfAddLayerButton.addEventListener('click', () => {
  setMode('scene');
  generatorPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  generatorSelect.focus();
  setStatus('Scene mode: use Generator Library to add layers.');
});

playlistAddButton.addEventListener('click', () => {
  if (!presetSelect.value) return;
  const name = presetSelect.selectedOptions[0]?.textContent ?? presetSelect.value;
  const exists = playlist.some((item) => item.path === presetSelect.value);
  if (!exists) {
    playlist.push({ name, path: presetSelect.value });
    savePlaylist();
    renderPlaylist();
    setStatus(`Added to playlist: ${name}`);
  }
});

playlistRemoveButton.addEventListener('click', () => {
  if (playlist.length === 0) return;
  playlist.pop();
  if (playlistIndex >= playlist.length) playlistIndex = 0;
  savePlaylist();
  renderPlaylist();
});

playlistPlayButton.addEventListener('click', async () => {
  if (playlist.length === 0) return;
  stopPlaylist();
  playlistActive = true;
  playlistOverrides = {};
  playlistIndex = 0;
  await advancePlaylist();
  const slotMs = Math.max(2000, Number(playlistSlotSeconds.value) * 1000 || 16000);
  playlistTimer = window.setInterval(() => {
    void advancePlaylist();
  }, slotMs);
});

playlistStopButton.addEventListener('click', () => {
  stopPlaylist();
  playlistActive = false;
  playlistOverrides = {};
  setStatus('Playlist stopped.');
});

shaderSaveButton.addEventListener('click', () => {
  const code = shaderEditor.value;
  const validationError = validateCustomPlasmaSource(code);
  if (validationError) {
    setStatus(`Shader invalid: ${validationError}`);
    shaderStatus.textContent = validationError;
    return;
  }
  const targetAssetId = getShaderAssetIdFromTarget(shaderTargetSelect.value);
  let asset = getShaderAssetById(targetAssetId);
  if (!asset) {
    const name = getUniqueShaderName('Custom Plasma Shader');
    asset = createAssetItem({
      name,
      kind: 'shader',
      tags: ['custom', 'plasma'],
      options: { shaderSource: code }
    });
    currentProject.assets = [...currentProject.assets, asset];
  } else {
    asset.options = { ...(asset.options ?? {}), shaderSource: code };
  }
  runtimeShaderOverride = null;
  renderAssets();
  renderLayerList();
  assignShaderToPlasmaLayer(asset.id);
  const applied = applyPlasmaShaderSource(code, asset.name);
  if (applied) {
    shaderTargetSelect.value = `${shaderTargetAssetPrefix}${asset.id}`;
    setStatus(`Shader saved: ${asset.name}`);
  }
  saveShaderDraft();
});

shaderTargetSelect.addEventListener('change', () => {
  void syncShaderEditorForTarget();
});

shaderApplyButton.addEventListener('click', () => {
  saveShaderDraft();
  const code = shaderEditor.value;
  const validationError = validateCustomPlasmaSource(code);
  if (validationError) {
    setStatus(`Shader invalid: ${validationError}`);
    shaderStatus.textContent = validationError;
    return;
  }
  if (!code.trim()) {
    runtimeShaderOverride = null;
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) void applyPlasmaShaderFromScene(scene);
    setStatus('Shader draft cleared.');
    return;
  }
  const applied = applyPlasmaShaderSource(code, 'Draft');
  if (applied) {
    runtimeShaderOverride = code;
    setStatus('Shader draft applied (session only).');
  }
});

toggleMidiButton.addEventListener('click', async () => {
  await startMidiInput();
});

modeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const mode = button.dataset.mode as 'performance' | 'scene' | 'design' | 'system';
    setMode(mode);
  });
});

[summaryMods, summaryFx, summaryAuto].forEach((chip) => {
  chip.addEventListener('click', () => {
    const mode = chip.dataset.mode as UiMode | undefined;
    if (mode) setMode(mode);
  });
});


transportTap.addEventListener('click', () => {
  setStatus('Tap tempo (placeholder).');
});

webglCopyButton.addEventListener('click', async () => {
  if (!webglDiag) return;
  try {
    await navigator.clipboard.writeText(webglDiag.textContent ?? '');
    setStatus('WebGL diagnostics copied.');
  } catch {
    setStatus('Failed to copy diagnostics.');
  }
});

transportBpmInput.addEventListener('change', () => {
  syncTempoInputs(Number(transportBpmInput.value));
  setStatus(`Tempo set to ${transportBpmInput.value} BPM`);
});

transportPauseButton.addEventListener('click', () => {
  if (isPlaying) {
    isPlaying = false;
    setStatus('Visuals paused.');
  } else {
    isPlaying = true;
    setStatus('Visuals resumed.');
  }
  updateTransportUI();
});

tempoInput.addEventListener('change', () => {
  syncTempoInputs(Number(tempoInput.value));
});

outputRouteSelect.addEventListener('change', async () => {
  await setOutputEnabled(outputRouteSelect.value === 'output');
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
  loadPresetThumbnails();

  // Try to load presets - may not be available in testing environment
  if (!window.visualSynth || !window.visualSynth.listPresets) {
    console.log('Preset API not available - skipping preset initialization');
    return;
  }

  const presets = await window.visualSynth.listPresets();
  
  // Sort presets alphabetically by name
  presets.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  presetSelect.innerHTML = '';
  presetLibrary = presets.map((preset) => ({
    name: preset.name,
    path: preset.path,
    category: preset.category
  }));
  presets.forEach((preset) => {
    const option = document.createElement('option');
    option.value = preset.path;
    option.textContent = preset.name;
    presetSelect.appendChild(option);
  });
  refreshPresetCategories();
  renderPresetBrowser();
  const hasPresets = presets.length > 0;
  presetPrevButton.disabled = !hasPresets;
  presetNextButton.disabled = !hasPresets;
  applyPresetButton.disabled = !hasPresets;
  presetShuffleButton.disabled = !hasPresets;
};

const setPresetSelectionStatus = (reason?: string) => {
  if (!presetSelect.value) return;
  const name = presetSelect.selectedOptions[0]?.textContent ?? presetSelect.value;
  setStatus(`${reason ? `${reason}: ` : ''}Preset selected: ${name}`);
};

const updateGravityWells = (time: number, dt: number) => {
  gravityCollapse = Math.max(0, gravityCollapse - dt * 0.18);
  const bass = audioState.bands[0] ?? 0;
  const mid = audioState.bands[3] ?? 0;
  const orbitRate = 0.2 + mid * 0.6;
  gravityWells.forEach((well, index) => {
    if (!well.active) {
      gravityPositions[index * 2] = 0;
      gravityPositions[index * 2 + 1] = 0;
      gravityStrengths[index] = 0;
      gravityPolarities[index] = 0;
      gravityActives[index] = 0;
      return;
    }
    const angle = time * 0.00015 * orbitRate + well.phase;
    const orbitRadius = 0.05 + mid * 0.18;
    const targetX = well.baseX + Math.cos(angle) * orbitRadius;
    const targetY = well.baseY + Math.sin(angle * 1.1) * orbitRadius;
    const collapseMix = gravityCollapse * 0.85;
    well.x = well.x + (targetX - well.x) * 0.08;
    well.y = well.y + (targetY - well.y) * 0.08;
    if (collapseMix > 0) {
      well.x = well.x * (1 - collapseMix);
      well.y = well.y * (1 - collapseMix);
    }
    const strength = well.strength + bass * 0.45 + gravityCollapse * 0.6;
    gravityPositions[index * 2] = Math.min(0.9, Math.max(-0.9, well.x));
    gravityPositions[index * 2 + 1] = Math.min(0.9, Math.max(-0.9, well.y));
    gravityStrengths[index] = strength;
    gravityPolarities[index] = well.polarity;
    gravityActives[index] = 1;
  });
};

const updatePortals = (time: number, dt: number) => {
  const activeScene =
    currentProject.scenes.find((scene) => scene.id === currentProject.activeSceneId) ??
    currentProject.scenes[0];
  const portalLayer = activeScene?.layers.find((layer) => layer.id === 'layer-portal');
  const portalEnabled = portalLayer?.enabled ?? false;
  const autoSpawn = (typeof portalLayer?.params?.autoSpawn === 'number'
    ? portalLayer?.params?.autoSpawn
    : 1) > 0.5;
  if (portalEnabled && autoSpawn) {
    const activeCount = portals.filter((portal) => portal.active).length;
    const energy = (audioState.bands[2] ?? 0) + (audioState.bands[3] ?? 0);
    const interval = Math.max(600, 1600 - energy * 800);
    if (activeCount === 0 || time - lastPortalAutoSpawn > interval) {
      spawnPortal();
      lastPortalAutoSpawn = time;
    }
  }
  const bands = audioState.bands;
  const base = bands[1] ?? 0;
  const harmonic = Math.abs((bands[2] ?? 0) - base * 0.66) + Math.abs((bands[3] ?? 0) - base * 0.5);
  const energy = Math.min(1, (bands[2] ?? 0) + (bands[3] ?? 0) + (bands[4] ?? 0));
  portals.forEach((portal, index) => {
    if (!portal.active) {
      portalPositions[index * 2] = 0;
      portalPositions[index * 2 + 1] = 0;
      portalRadii[index] = 0;
      portalActives[index] = 0;
      return;
    }
    const pulse = 0.02 * Math.sin(time * 0.001 + portal.phase) + energy * 0.08;
    portal.radius = Math.min(0.45, portal.radius + (pulse - portal.radius) * 0.02);
    portalPositions[index * 2] = portal.x;
    portalPositions[index * 2 + 1] = portal.y;
    portalRadii[index] = portal.radius * (0.8 + harmonic * 0.8);
    portalActives[index] = 1;
  });
};

const updateMediaBursts = (time: number, dt: number) => {
  const energy = Math.min(1, (audioState.rms ?? 0) + (audioState.peak ?? 0));
  const speed = 0.12 + energy * 0.3;
  mediaBursts.forEach((burst, index) => {
    if (!burst.active) {
      mediaBurstPositions[index * 2] = 0;
      mediaBurstPositions[index * 2 + 1] = 0;
      mediaBurstRadii[index] = 0;
      mediaBurstTypes[index] = burst.type;
      mediaBurstActives[index] = 0;
      return;
    }
    burst.radius += dt * speed;
    burst.life = Math.max(0, burst.life - dt * 0.5);
    if (burst.life <= 0) {
      burst.active = false;
    }
    mediaBurstPositions[index * 2] = burst.x;
    mediaBurstPositions[index * 2 + 1] = burst.y;
    mediaBurstRadii[index] = burst.radius;
    mediaBurstTypes[index] = burst.type;
    mediaBurstActives[index] = burst.life;
  });
};

const initTemplates = async () => {
  // Check if the visualSynth API is available
  if (!window.visualSynth || !window.visualSynth.listTemplates) {
    console.log('Template API not available - skipping template initialization');
    return;
  }

  const templates = await window.visualSynth.listTemplates();
  
  // Sort templates alphabetically by name
  templates.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  templateSelect.innerHTML = '';
  templates.forEach((template) => {
    const option = document.createElement('option');
    option.value = template.path;
    option.textContent = template.name;
    templateSelect.appendChild(option);
  });
};

const initOutputConfig = async () => {
  // Check if the visualSynth API is available
  if (!window.visualSynth || !window.visualSynth.getOutputConfig) {
    console.log('Output config API not available - using defaults');
    return;
  }

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
  // Check if the visualSynth API is available
  if (!window.visualSynth || !window.visualSynth.isProlinkAvailable) {
    console.log('BPM networking API not available - skipping prolink setup');
    return;
  }

  const prolinkAvailable = await window.visualSynth.isProlinkAvailable();
  const prolinkOption = bpmSourceSelect.querySelector('option[value="network"]');
  if (!prolinkAvailable) {
    prolinkOption?.remove();
    bpmNetworkToggle.disabled = true;
    if (bpmSource === 'network') {
      bpmSource = 'manual';
      bpmSourceSelect.value = 'manual';
    }
  }

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
        `Prolink BPM ${payload.bpm.toFixed(1)} from device ${payload.deviceId}${
          payload.isMaster ? ' (master)' : payload.isOnAir ? ' (on-air)' : ''
        }`
      );
    }
  });
  syncPerformanceToggles();
};

const updateTransportUI = () => {
  transportPauseButton.textContent = isPlaying ? 'Pause' : 'Resume';
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
      event.preventDefault();
      if (isPlaying) {
        isPlaying = false;
        setStatus('Visuals paused.');
      } else {
        isPlaying = true;
        setStatus('Visuals resumed.');
      }
      updateTransportUI();
    }
  });
};

const initSceneStrip = () => {
  setSceneStripView(sceneStripView);
  sceneStripViewButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const view = button.dataset.sceneView as 'cards' | 'list' | undefined;
      if (!view) return;
      setSceneStripView(view);
    });
  });
};

const initPanelCollapse = () => {
  const panels = Array.from(document.querySelectorAll<HTMLDivElement>('.panel-block'));
  panels.forEach((panel, index) => {
    const header = panel.querySelector<HTMLHeadingElement>('h3');
    if (!header) return;
    const key = panel.id ? `vs.panel.${panel.id}` : `vs.panel.${header.textContent ?? index}`;
    header.setAttribute('role', 'button');
    header.setAttribute('tabindex', '0');
    const stored = localStorage.getItem(key);
    if (stored === 'collapsed') {
      panel.classList.add('collapsed');
    }
    const toggle = () => {
      panel.classList.toggle('collapsed');
      localStorage.setItem(key, panel.classList.contains('collapsed') ? 'collapsed' : 'open');
    };
    header.addEventListener('click', toggle);
    header.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggle();
      }
    });
  });
};

const canvas = document.getElementById('gl-canvas') as HTMLCanvasElement;
const visualizerCanvas = document.getElementById('visualizer-canvas') as HTMLCanvasElement;
const fadeOverlay = document.getElementById('fade-overlay') as HTMLDivElement;
updateWebglDiagnostics();
try {
  renderer = createGLRenderer(canvas);
} catch (error) {
  webglInitError = error instanceof Error ? error.message : String(error);
  safeModeReasons.push('Renderer init failed');
  updateSafeModeBanner();
  setStatus('Renderer init failed. Safe mode enabled.');
  updateWebglDiagnostics();
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Debug Overlay - Press 'D' to toggle
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const debugOverlay = createDebugOverlay((flags) => {
  console.log('[Debug] Flags changed:', flags);
  // Flags: { tintLayers: boolean, fxDelta: boolean }
  // These can be used to enable visual debugging features
});

let lastTime = performance.now();
let fpsAccumulator = 0;
let frameCount = 0;
let currentFps = 0;

const buildModSources = (bpm: number, macros: MacroConfig[] = currentProject.macros) => {
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
    'macro-1': macros[0]?.value ?? 0,
    'macro-2': macros[1]?.value ?? 0,
    'macro-3': macros[2]?.value ?? 0,
    'macro-4': macros[3]?.value ?? 0,
    'macro-5': macros[4]?.value ?? 0,
    'macro-6': macros[5]?.value ?? 0,
    'macro-7': macros[6]?.value ?? 0,
    'macro-8': macros[7]?.value ?? 0
  };
};

const drawVisualizer = (visualizerConfig = currentProject.visualizer) => {
  const ctx = visualizerCanvas.getContext('2d');
  if (!ctx) return;
  const width = visualizerCanvas.width;
  const height = visualizerCanvas.height;
  ctx.clearRect(0, 0, width, height);
  if (visualizerConfig.mode === 'off' || !visualizerConfig.enabled) return;

  let visualizerAlpha = visualizerConfig.opacity;
  if (visualizerConfig.macroEnabled) {
    const macroId = Math.min(Math.max(Math.round(visualizerConfig.macroId), 1), 8);
    const macroValue = Number(macroInputs[macroId - 1]?.value ?? 1);
    visualizerAlpha *= Math.min(Math.max(macroValue, 0), 1);
  }
  ctx.globalAlpha = visualizerAlpha;
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#8fd6ff';
  ctx.beginPath();
  if (visualizerConfig.mode === 'spectrum') {
    const barCount = audioState.spectrum.length;
    for (let i = 0; i < barCount; i += 1) {
      const value = audioState.spectrum[i];
      const x = (i / (barCount - 1)) * width;
      const y = height - value * height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  } else {
    const data = audioState.waveform;
    for (let i = 0; i < data.length; i += 1) {
      const x = (i / (data.length - 1)) * width;
      const y = height / 2 + data[i] * (height * 0.45);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    if (visualizerConfig.mode === 'oscilloscope') {
      ctx.stroke();
      ctx.strokeStyle = '#ffd166';
      ctx.beginPath();
      for (let i = 0; i < data.length; i += 1) {
        const phase = (i / data.length) * Math.PI * 2;
        const radius = height * 0.3 + data[i] * height * 0.15;
        const x = width / 2 + Math.cos(phase) * radius;
        const y = height / 2 + Math.sin(phase) * radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    }
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
};

const ROLE_SETTINGS = {
  core: { audioScale: 1.0, fxCap: 1.0, bloomBoost: 1.15, opacityBoost: 1.05, lowFreqOnly: false },
  support: { audioScale: 0.75, fxCap: 0.75, bloomBoost: 1.0, opacityBoost: 1.0, lowFreqOnly: false },
  atmosphere: { audioScale: 0.45, fxCap: 0.5, bloomBoost: 0.9, opacityBoost: 0.95, lowFreqOnly: true }
} as const;

const getLayerRole = (layer?: LayerConfig) =>
  layer?.role ?? getDefaultRoleForLayerId(layer?.id ?? '');

const applyRoleOpacity = (opacity: number, role: keyof typeof ROLE_SETTINGS, lowFreq: number) => {
  const settings = ROLE_SETTINGS[role];
  if (settings.lowFreqOnly) {
    return opacity * (0.35 + lowFreq * 0.65);
  }
  return opacity * settings.opacityBoost;
};

const getRoleAudioScale = (role: keyof typeof ROLE_SETTINGS, lowFreq: number) => {
  const settings = ROLE_SETTINGS[role];
  const lowFreqScale = settings.lowFreqOnly ? 0.3 + lowFreq * 0.7 : 1;
  return settings.audioScale * lowFreqScale;
};

const render = (time: number) => {
  const delta = time - lastTime;
  lastTime = time;
  fpsAccumulator += delta;
  frameCount += 1;
  if (fpsAccumulator > 1000) {
    currentFps = Math.round((frameCount / fpsAccumulator) * 1000);
    fpsLabel.textContent = `FPS: ${currentFps}`;
    healthFps.textContent = `FPS: ${currentFps}`;
    fpsAccumulator = 0;
    frameCount = 0;
  }
  if (!isPlaying) {
    requestAnimationFrame(render);
    return;
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
      healthWatchdog.textContent = 'Watchdog: Warning';
      guardrailStatus.textContent = 'Guardrails: Active';
    } else {
      watchdogLabel.textContent = 'Watchdog: OK';
      watchdogLabel.classList.remove('watchdog-warning');
      healthWatchdog.textContent = 'Watchdog: OK';
      guardrailStatus.textContent = 'Guardrails: OK';
    }
  }

  if (time - lastAutosaveAt > 120000) {
    lastAutosaveAt = time;
    const payload = serializeProject();
    void window.visualSynth.autosaveProject(payload);
  }
  if (time - lastSummaryUpdate > 500) {
    lastSummaryUpdate = time;
    updateSummaryChips();
  }
  if (audioContext) {
    latencyLabel.textContent = `Audio Latency: ${Math.round(audioContext.baseLatency * 1000)}ms`;
    healthLatency.textContent = `Latency: ${Math.round(audioContext.baseLatency * 1000)}ms`;
    const outputLatency = audioContext.outputLatency ?? 0;
    outputLatencyLabel.textContent = outputLatency
      ? `Output Latency: ${Math.round(outputLatency * 1000)}ms`
      : 'Output Latency: --';
    latencySummary.textContent = `Audio: ${Math.round(audioContext.baseLatency * 1000)}ms | Output: ${
      outputLatency ? `${Math.round(outputLatency * 1000)}ms` : '--'
    } | MIDI: ${
      lastMidiLatencyMs === null ? '--' : `${Math.round(lastMidiLatencyMs)}ms`
    }`;
  } else {
    healthLatency.textContent = 'Latency: --';
    latencySummary.textContent = 'Audio: -- | Output: -- | MIDI: --';
  }
  midiLatencyLabel.textContent =
    lastMidiLatencyMs === null
      ? 'MIDI Latency: --'
      : `MIDI Latency: ${Math.round(lastMidiLatencyMs)}ms`;
  updateBpmDisplay();

  if (!isPlaying) {
    updateQuantizeHud(null);
  } else if (pendingSceneSwitch) {
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
  updateGravityWells(time, delta * 0.001);
  updatePortals(time, delta * 0.001);
  updateMediaBursts(time, delta * 0.001);
  if (glyphBeatPulse > 0) {
    glyphBeatPulse = Math.max(0, glyphBeatPulse - delta * 0.006);
  }
  portalShift = Math.max(0, portalShift - delta * 0.0003);
  topoQuake = Math.max(0, topoQuake - delta * 0.002);
  topoSlide = Math.max(0, topoSlide - delta * 0.002);
  topoPlate = Math.max(0, topoPlate - delta * 0.002);
  topoTravel += delta * 0.0002;
  strobeIntensity *= strobeDecay;

  if (isPlaying) {
    transportTimeMs += delta;
  }

  if (isPlaying && !pendingSceneSwitch) {
    const autoSceneId = sceneManager.updateAutoSwitch(transportTimeMs, {
      rms: audioState.rms,
      peak: audioState.peak
    });
    if (autoSceneId) {
      const targetName =
        currentProject.scenes.find((scene) => scene.id === autoSceneId)?.name ?? autoSceneId;
      applyScene(autoSceneId);
      setStatus(`Auto scene switch: ${targetName}`);
    }
  }

  const activeBpm = getActiveBpm();
  if (isPlaying) {
    updateLfos(delta * 0.001, activeBpm);
    updateEnvelopes(delta * 0.001);
    updateSampleHold(delta * 0.001, activeBpm);
    
    // Transition Decay
    if (currentTransitionAmount > 0) {
      currentTransitionAmount = Math.max(0, currentTransitionAmount - delta * 0.002);
    } else {
      currentTransitionType = 0;
    }
  }

  resizeCanvasToDisplaySize(canvas);
  const blendSnapshot = sceneManager.getBlendSnapshot(transportTimeMs);
  const activeStyle =
    currentProject.stylePresets?.find((preset) => preset.id === currentProject.activeStylePresetId) ??
    null;
  const styleSettings =
    blendSnapshot?.styleSettings ?? activeStyle?.settings ?? { contrast: 1, saturation: 1, paletteShift: 0 };
  const effects = blendSnapshot?.effects ?? currentProject.effects ?? {
    enabled: true,
    bloom: 0.2,
    blur: 0,
    chroma: 0.1,
    posterize: 0,
    kaleidoscope: 0,
    feedback: 0,
    persistence: 0
  };
  const particles = blendSnapshot?.particles ?? currentProject.particles ?? {
    enabled: true,
    density: 0.35,
    speed: 0.3,
    size: 0.45,
    glow: 0.6
  };
  const sdf = blendSnapshot?.sdf ?? currentProject.sdf ?? {
    enabled: true,
    shape: 'circle' as const,
    scale: 0.45,
    edge: 0.08,
    glow: 0.5,
    rotation: 0,
    fill: 0.35
  };
  const effectiveMacros = blendSnapshot?.macros ?? currentProject.macros;
  const modSources = buildModSources(activeBpm, effectiveMacros);
  const modValue = (target: string, base: number) =>
    applyModMatrix(base, target, modSources, currentProject.modMatrix);
  const lowFreq = ((audioState.bands[0] ?? 0) + (audioState.bands[1] ?? 0)) * 0.5;
  const moddedStyle = {
    contrast: modValue('style.contrast', styleSettings.contrast),
    saturation: modValue('style.saturation', styleSettings.saturation),
    paletteShift: modValue('style.paletteShift', styleSettings.paletteShift + portalShift)
  };
  const effectsActive = effects.enabled;
  let moddedEffects = effectsActive
    ? {
        bloom: modValue('effects.bloom', effects.bloom),
        blur: modValue('effects.blur', effects.blur),
        chroma: modValue('effects.chroma', effects.chroma),
        posterize: modValue('effects.posterize', effects.posterize),
        kaleidoscope: modValue('effects.kaleidoscope', effects.kaleidoscope),
        kaleidoscopeRotation: modValue('effects.kaleidoscopeRotation', 0), // Default to 0 if not present in project
        feedback: modValue('effects.feedback', effects.feedback),
        persistence: modValue('effects.persistence', effects.persistence)
      }
    : {
        bloom: 0,
        blur: 0,
        chroma: 0,
        posterize: 0,
        kaleidoscope: 0,
        kaleidoscopeRotation: 0,
        feedback: 0,
        persistence: 0
      };
  let moddedParticles = {
    density: modValue('particles.density', particles.density),
    speed: modValue('particles.speed', particles.speed),
    size: modValue('particles.size', particles.size),
    glow: modValue('particles.glow', particles.glow)
  };
  let moddedSdf = {
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
  const macroSum = effectiveMacros.reduce(
    (acc, macro) => {
      macro.targets.forEach((target) => {
        const rawTarget = target.target as
          | string
          | { type?: string; layerType?: string; param: string };
        let key: string | null = null;
        if (typeof rawTarget === 'string') {
          key = rawTarget;
        } else if (rawTarget && rawTarget.param) {
          const layerType = rawTarget.type ?? rawTarget.layerType;
          if (layerType) {
            key = buildLegacyTarget(layerType, rawTarget.param);
          }
        }
        if (!key) return;
        acc[key] = (acc[key] ?? 0) + macro.value * target.amount;
      });
      return acc;
    },
    {} as Record<string, number>
  );
  const renderScene =
    blendSnapshot?.scene ??
    currentProject.scenes.find((scene) => scene.id === currentProject.activeSceneId);
  const plasmaLayer = renderScene?.layers.find((layer) => layer.id === 'layer-plasma');
  const spectrumLayer = renderScene?.layers.find((layer) => layer.id === 'layer-spectrum');
  const origamiLayer = renderScene?.layers.find((layer) => layer.id === 'layer-origami');
  const glyphLayer = renderScene?.layers.find((layer) => layer.id === 'layer-glyph');
  const crystalLayer = renderScene?.layers.find((layer) => layer.id === 'layer-crystal');
  const inkLayer = renderScene?.layers.find((layer) => layer.id === 'layer-inkflow');
  const topoLayer = renderScene?.layers.find((layer) => layer.id === 'layer-topo');
  const weatherLayer = renderScene?.layers.find((layer) => layer.id === 'layer-weather');
  const portalLayer = renderScene?.layers.find((layer) => layer.id === 'layer-portal');
  const mediaLayer = renderScene?.layers.find((layer) => layer.id === 'layer-media');
  const oscilloLayer = renderScene?.layers.find((layer) => layer.id === 'layer-oscillo');
  const plasmaRole = getLayerRole(plasmaLayer);
  const spectrumRole = getLayerRole(spectrumLayer);
  const origamiRole = getLayerRole(origamiLayer);
  const glyphRole = getLayerRole(glyphLayer);
  const crystalRole = getLayerRole(crystalLayer);
  const inkRole = getLayerRole(inkLayer);
  const topoRole = getLayerRole(topoLayer);
  const weatherRole = getLayerRole(weatherLayer);
  const portalRole = getLayerRole(portalLayer);
  const mediaRole = getLayerRole(mediaLayer);
  const oscilloRole = getLayerRole(oscilloLayer);

  const dominantRole = (() => {
    if (!renderScene) return 'support';
    const enabledLayers = renderScene.layers.filter((layer) => layer.enabled);
    if (enabledLayers.some((layer) => getLayerRole(layer) === 'core')) return 'core';
    if (enabledLayers.some((layer) => getLayerRole(layer) === 'support')) return 'support';
    return 'atmosphere';
  })();

  const fxCap = ROLE_SETTINGS[dominantRole].fxCap;
  moddedEffects = {
    ...moddedEffects,
    bloom: Math.min(moddedEffects.bloom, fxCap),
    blur: Math.min(moddedEffects.blur, fxCap),
    chroma: Math.min(moddedEffects.chroma, fxCap),
    posterize: Math.min(moddedEffects.posterize, fxCap),
    kaleidoscope: Math.min(moddedEffects.kaleidoscope, fxCap),
    kaleidoscopeRotation: moddedEffects.kaleidoscopeRotation,
    feedback: Math.min(moddedEffects.feedback, fxCap),
    persistence: Math.min(moddedEffects.persistence, fxCap)
  };

  const coreEnabled = Boolean(renderScene?.layers.some((layer) => layer.enabled && getLayerRole(layer) === 'core'));
  if (coreEnabled) {
    moddedEffects = {
      ...moddedEffects,
      bloom: Math.min(1, moddedEffects.bloom * ROLE_SETTINGS.core.bloomBoost)
    };
    moddedParticles = {
      ...moddedParticles,
      glow: Math.min(1, moddedParticles.glow * ROLE_SETTINGS.core.bloomBoost)
    };
    moddedSdf = {
      ...moddedSdf,
      glow: Math.min(1, moddedSdf.glow * ROLE_SETTINGS.core.bloomBoost)
    };
  }
  const getLayerParamNumber = (layer: LayerConfig | undefined, key: string, fallback: number) => {
    const value = layer?.params?.[key];
    return typeof value === 'number' ? value : fallback;
  };
  const plasmaOpacity = Math.min(
    1,
    Math.max(0, (plasmaLayer?.opacity ?? 1) * (1 + (macroSum['layer-plasma.opacity'] ?? 0)))
  );
  const plasmaBaseSpeed = getLayerParamNumber(plasmaLayer, 'speed', 1.0);
  const plasmaBaseScale = getLayerParamNumber(plasmaLayer, 'scale', 1.0);
  const plasmaSpeed = Math.max(
    0.1,
    plasmaBaseSpeed + (macroSum['layer-plasma.speed'] ?? 0) + (midiSum['layer-plasma.speed'] ?? 0)
  );
  const plasmaScale = Math.max(
    0.1,
    plasmaBaseScale + (macroSum['layer-plasma.scale'] ?? 0) + (midiSum['layer-plasma.scale'] ?? 0)
  );

  const spectrumOpacity = Math.min(
    1,
    Math.max(0, (spectrumLayer?.opacity ?? 1) * (1 + (macroSum['layer-spectrum.opacity'] ?? 0)))
  );
  const origamiOpacity = Math.min(
    1,
    Math.max(0, (origamiLayer?.opacity ?? 1) * (1 + (macroSum['layer-origami.opacity'] ?? 0)))
  );
  const origamiBaseSpeed = getLayerParamNumber(origamiLayer, 'speed', 1.0);
  const origamiSpeed = Math.max(
    0.1,
    origamiBaseSpeed + (macroSum['layer-origami.speed'] ?? 0) + (midiSum['layer-origami.speed'] ?? 0)
  );

  const glyphOpacity = Math.min(
    1,
    Math.max(0, (glyphLayer?.opacity ?? 1) * (1 + (macroSum['layer-glyph.opacity'] ?? 0)))
  );
  const glyphBaseSpeed = getLayerParamNumber(glyphLayer, 'speed', 1.0);
  const glyphSpeed = Math.max(
    0.1,
    glyphBaseSpeed + (macroSum['layer-glyph.speed'] ?? 0) + (midiSum['layer-glyph.speed'] ?? 0)
  );

  const crystalOpacity = Math.min(
    1,
    Math.max(0, (crystalLayer?.opacity ?? 1) * (1 + (macroSum['layer-crystal.opacity'] ?? 0)))
  );
  const crystalBaseScale = getLayerParamNumber(crystalLayer, 'scale', 1.0);
  const crystalBaseSpeed = getLayerParamNumber(crystalLayer, 'speed', 1.0);
  const crystalScale = Math.max(
    0.1,
    crystalBaseScale + (macroSum['layer-crystal.scale'] ?? 0) + (midiSum['layer-crystal.scale'] ?? 0)
  );
  const crystalSpeed = Math.max(
    0.1,
    crystalBaseSpeed + (macroSum['layer-crystal.speed'] ?? 0) + (midiSum['layer-crystal.speed'] ?? 0)
  );

  const inkOpacity = Math.min(
    1,
    Math.max(0, (inkLayer?.opacity ?? 1) * (1 + (macroSum['layer-inkflow.opacity'] ?? 0)))
  );
  const inkBaseSpeed = getLayerParamNumber(inkLayer, 'speed', 1.0);
  const inkBaseScale = getLayerParamNumber(inkLayer, 'scale', 1.0);
  const inkSpeed = Math.max(
    0.1,
    inkBaseSpeed + (macroSum['layer-inkflow.speed'] ?? 0) + (midiSum['layer-inkflow.speed'] ?? 0)
  );
  const inkScale = Math.max(
    0.1,
    inkBaseScale + (macroSum['layer-inkflow.scale'] ?? 0) + (midiSum['layer-inkflow.scale'] ?? 0)
  );

  const topoOpacity = Math.min(
    1,
    Math.max(0, (topoLayer?.opacity ?? 1) * (1 + (macroSum['layer-topo.opacity'] ?? 0)))
  );
  const topoBaseScale = getLayerParamNumber(topoLayer, 'scale', 1.0);
  const topoBaseElevation = getLayerParamNumber(topoLayer, 'elevation', 0.5);
  const topoScale = Math.max(
    0.1,
    topoBaseScale + (macroSum['layer-topo.scale'] ?? 0) + (midiSum['layer-topo.scale'] ?? 0)
  );
  const topoElevation = Math.max(
    0.1,
    topoBaseElevation + (macroSum['layer-topo.elevation'] ?? 0) + (midiSum['layer-topo.elevation'] ?? 0)
  );

  const weatherOpacity = Math.min(
    1,
    Math.max(0, (weatherLayer?.opacity ?? 1) * (1 + (macroSum['layer-weather.opacity'] ?? 0)))
  );
  const weatherBaseSpeed = getLayerParamNumber(weatherLayer, 'speed', 1.0);
  const weatherSpeed = Math.max(
    0.1,
    weatherBaseSpeed + (macroSum['layer-weather.speed'] ?? 0) + (midiSum['layer-weather.speed'] ?? 0)
  );

  const portalOpacity = Math.min(
    1,
    Math.max(0, (portalLayer?.opacity ?? 1) * (1 + (macroSum['layer-portal.opacity'] ?? 0)))
  );
  const mediaOpacity = Math.min(
    1,
    Math.max(0, (mediaLayer?.opacity ?? 1) * (1 + (macroSum['layer-media.opacity'] ?? 0)))
  );
  const portalStyle = Math.max(0, Math.min(2, getLayerParamNumber(portalLayer, 'style', 0)));
  const oscilloOpacity = Math.min(
    1,
    Math.max(0, (oscilloLayer?.opacity ?? 1) * (1 + (macroSum['layer-oscillo.opacity'] ?? 0)))
  );
  const moddedPlasmaOpacity = applyRoleOpacity(
    modValue('layer-plasma.opacity', plasmaOpacity),
    plasmaRole,
    lowFreq
  );
  const moddedPlasmaSpeed = modValue('layer-plasma.speed', plasmaSpeed);
  const moddedPlasmaScale = modValue('layer-plasma.scale', plasmaScale);
  const moddedSpectrumOpacity = applyRoleOpacity(
    modValue('layer-spectrum.opacity', spectrumOpacity),
    spectrumRole,
    lowFreq
  );
  const moddedOrigamiOpacity = applyRoleOpacity(
    modValue('layer-origami.opacity', origamiOpacity),
    origamiRole,
    lowFreq
  );
  const moddedOrigamiSpeed = modValue('layer-origami.speed', origamiSpeed);
  const moddedGlyphOpacity = applyRoleOpacity(
    modValue('layer-glyph.opacity', glyphOpacity),
    glyphRole,
    lowFreq
  );
  const moddedGlyphSpeed = modValue('layer-glyph.speed', glyphSpeed);
  const moddedCrystalOpacity = applyRoleOpacity(
    modValue('layer-crystal.opacity', crystalOpacity),
    crystalRole,
    lowFreq
  );
  const moddedCrystalScale = modValue('layer-crystal.scale', crystalScale);
  const moddedCrystalSpeed = modValue('layer-crystal.speed', crystalSpeed);
  const moddedInkOpacity = applyRoleOpacity(
    modValue('layer-inkflow.opacity', inkOpacity),
    inkRole,
    lowFreq
  );
  const moddedInkSpeed = modValue('layer-inkflow.speed', inkSpeed);
  const moddedInkScale = modValue('layer-inkflow.scale', inkScale);
  const moddedTopoOpacity = applyRoleOpacity(
    modValue('layer-topo.opacity', topoOpacity),
    topoRole,
    lowFreq
  );
  const moddedTopoScale = modValue('layer-topo.scale', topoScale);
  const moddedTopoElevation = modValue('layer-topo.elevation', topoElevation);
  const moddedWeatherOpacity = applyRoleOpacity(
    modValue('layer-weather.opacity', weatherOpacity),
    weatherRole,
    lowFreq
  );
  const moddedWeatherSpeed = modValue('layer-weather.speed', weatherSpeed);
  const moddedPortalOpacity = applyRoleOpacity(
    modValue('layer-portal.opacity', portalOpacity),
    portalRole,
    lowFreq
  );
  const moddedMediaOpacity = applyRoleOpacity(
    modValue('layer-media.opacity', mediaOpacity),
    mediaRole,
    lowFreq
  );
  const moddedOscilloOpacity = applyRoleOpacity(
    modValue('layer-oscillo.opacity', oscilloOpacity),
    oscilloRole,
    lowFreq
  );
  const plasmaEnabled = plasmaLayer?.enabled ?? true;
  const spectrumEnabled = spectrumLayer?.enabled ?? true;
  const origamiEnabled = origamiLayer?.enabled ?? false;
  const glyphEnabled = glyphLayer?.enabled ?? false;
  const crystalEnabled = crystalLayer?.enabled ?? false;
  const inkEnabled = inkLayer?.enabled ?? false;
  const topoEnabled = topoLayer?.enabled ?? false;
  const weatherEnabled = weatherLayer?.enabled ?? false;
  const portalEnabled = portalLayer?.enabled ?? false;
  const mediaEnabled = mediaLayer?.enabled ?? false;
  const oscilloEnabled = oscilloLayer?.enabled ?? false;
  if (oscilloFreeze < 0.5) {
    oscilloCapture.set(audioState.waveform);
  }
  const plasmaAssetBlendMode = getAssetBlendModeValue('layer-plasma');
  const plasmaAssetAudioReact =
    getAssetAudioReactValue('layer-plasma') * getRoleAudioScale(plasmaRole, lowFreq);
  const spectrumAssetBlendMode = getAssetBlendModeValue('layer-spectrum');
  const spectrumAssetAudioReact =
    getAssetAudioReactValue('layer-spectrum') * getRoleAudioScale(spectrumRole, lowFreq);
  const mediaAssetBlendMode = getAssetBlendModeValue('layer-media');
  const mediaAssetAudioReact =
    getAssetAudioReactValue('layer-media') * getRoleAudioScale(mediaRole, lowFreq);
  const expressive = currentProject.expressiveFx ?? DEFAULT_PROJECT.expressiveFx;
  const activeIntent = renderScene?.intent ?? 'ambient';
  const energyMacro = resolveExpressiveMacro(
    activeIntent,
    expressive.energyBloom.macro,
    expressive.energyBloom.intentBinding
  );
  const radialMacro = resolveExpressiveMacro(
    activeIntent,
    expressive.radialGravity.macro,
    expressive.radialGravity.intentBinding
  );
  const echoMacro = resolveExpressiveMacro(
    activeIntent,
    expressive.motionEcho.macro,
    expressive.motionEcho.intentBinding
  );
  const smearMacro = resolveExpressiveMacro(
    activeIntent,
    expressive.spectralSmear.macro,
    expressive.spectralSmear.intentBinding
  );
  const renderState: RenderState = {
    timeMs: transportTimeMs,
    rms: audioState.rms,
    peak: audioState.peak,
    strobe: strobeIntensity,
    plasmaEnabled,
    spectrumEnabled,
    origamiEnabled,
    glyphEnabled,
    crystalEnabled,
    inkEnabled,
    topoEnabled,
    weatherEnabled,
    portalEnabled,
    mediaEnabled,
    oscilloEnabled,
    spectrum: audioState.spectrum,
    contrast: moddedStyle.contrast,
    saturation: moddedStyle.saturation,
    paletteShift: moddedStyle.paletteShift,
    plasmaOpacity: moddedPlasmaOpacity,
    plasmaSpeed: moddedPlasmaSpeed,
    plasmaScale: moddedPlasmaScale,
    plasmaAudioReact: plasmaAssetAudioReact,
    spectrumOpacity: moddedSpectrumOpacity,
    origamiOpacity: moddedOrigamiOpacity,
    origamiFoldState,
    origamiFoldSharpness,
    origamiSpeed: moddedOrigamiSpeed,
    glyphOpacity: moddedGlyphOpacity,
    glyphMode,
    glyphSeed,
    glyphBeat: glyphBeatPulse,
    glyphSpeed: moddedGlyphSpeed,
    crystalOpacity: moddedCrystalOpacity,
    crystalMode,
    crystalBrittleness,
    crystalScale: moddedCrystalScale,
    crystalSpeed: moddedCrystalSpeed,
    inkOpacity: moddedInkOpacity,
    inkBrush: inkLayer ? 1.0 : 0.0, // Simplification based on existing logic or extraction if available
    inkPressure: 0.5, // Placeholder or extraction
    inkLifespan: 0.5, // Placeholder or extraction
    inkSpeed: moddedInkSpeed,
    inkScale: moddedInkScale,
    topoOpacity: moddedTopoOpacity,
    topoQuake,
    topoSlide,
    topoPlate,
    topoTravel,
    topoScale: moddedTopoScale,
    topoElevation: moddedTopoElevation,
    weatherOpacity: moddedWeatherOpacity,
    weatherMode,
    weatherIntensity,
    weatherSpeed: moddedWeatherSpeed,
    portalOpacity: moddedPortalOpacity,
    portalShift,
    portalStyle,
    portalPositions,
    portalRadii,
    portalActives,
    mediaOpacity: moddedMediaOpacity,
    mediaBurstPositions,
    mediaBurstRadii,
    mediaBurstTypes,
    mediaBurstActives,
    oscilloOpacity: moddedOscilloOpacity,
    oscilloMode,
    oscilloFreeze,
    oscilloRotate,
    oscilloData: oscilloCapture,
    modulatorValues: new Float32Array(16),
    midiData: new Float32Array(256),
    plasmaAssetBlendMode: plasmaAssetBlendMode,
    plasmaAssetAudioReact: plasmaAssetAudioReact,
    spectrumAssetBlendMode: spectrumAssetBlendMode,
    spectrumAssetAudioReact: spectrumAssetAudioReact,
    mediaAssetBlendMode: mediaAssetBlendMode,
    mediaAssetAudioReact: mediaAssetAudioReact,
    roleWeights: currentProject.roleWeights || { core: 1, support: 1, atmosphere: 1 },
    transitionAmount: currentTransitionAmount,
    transitionType: currentTransitionType,
    effectsEnabled: effects.enabled,
    bloom: moddedEffects.bloom,
    blur: moddedEffects.blur,
    chroma: moddedEffects.chroma,
    posterize: moddedEffects.posterize,
    kaleidoscope: moddedEffects.kaleidoscope,
    kaleidoscopeRotation: moddedEffects.kaleidoscopeRotation,
    feedback: moddedEffects.feedback,
    persistence: moddedEffects.persistence,
    trailSpectrum: trailSpectrum,
    expressiveEnergyBloom: expressive.energyBloom.enabled ? energyMacro : 0,
    expressiveEnergyThreshold: expressive.energyBloom.expert.threshold,
    expressiveEnergyAccumulation: expressive.energyBloom.expert.accumulation,
    expressiveRadialGravity: expressive.radialGravity.enabled ? radialMacro : 0,
    expressiveRadialStrength: expressive.radialGravity.expert.strength,
    expressiveRadialRadius: expressive.radialGravity.expert.radius,
    expressiveRadialFocusX: expressive.radialGravity.expert.focusX,
    expressiveRadialFocusY: expressive.radialGravity.expert.focusY,
    expressiveMotionEcho: expressive.motionEcho.enabled ? echoMacro : 0,
    expressiveMotionEchoDecay: expressive.motionEcho.expert.decay,
    expressiveMotionEchoWarp: expressive.motionEcho.expert.warp,
    expressiveSpectralSmear: expressive.spectralSmear.enabled ? smearMacro : 0,
    expressiveSpectralOffset: expressive.spectralSmear.expert.offset,
    expressiveSpectralMix: expressive.spectralSmear.expert.mix,
    particlesEnabled: particles.enabled,
    particleDensity: moddedParticles.density,
    particleSpeed: moddedParticles.speed,
    particleSize: moddedParticles.size,
    particleGlow: moddedParticles.glow,
    sdfEnabled: sdf.enabled,
    sdfShape: sdf.shape === 'circle' ? 0 : sdf.shape === 'box' ? 1 : sdf.shape === 'triangle' ? 2 : sdf.shape === 'hexagon' ? 3 : sdf.shape === 'star' ? 4 : 5,
    sdfScale: moddedSdf.scale,
    sdfEdge: moddedSdf.edge,
    sdfGlow: moddedSdf.glow,
    sdfRotation: moddedSdf.rotation,
    sdfFill: moddedSdf.fill,
    sdfColor: sdf.color,
    sdfScene: sdfAdvancedToggle.checked ? renderScene?.layers.find((layer) => layer.id === 'gen-sdf-scene')?.sdfScene : undefined,
    gravityPositions,
    gravityStrengths,
    gravityPolarities,
    gravityActives,
    gravityCollapse
  };
  renderer.render(renderState);
  resizeCanvasToDisplaySize(visualizerCanvas);
  updateSceneTimelineProgress(blendSnapshot);
  drawVisualizer(blendSnapshot?.visualizer ?? currentProject.visualizer);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Debug Overlay Update - Shows layer/FX execution status
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const debugActiveScene = currentProject.scenes.find((s) => s.id === currentProject.activeSceneId);
  debugOverlay.update(
    {
      frameId: Math.floor(time),
      activeSceneName: debugActiveScene?.name ?? '—',
      layerCount: debugActiveScene?.layers.length ?? 0,
      layers: (debugActiveScene?.layers ?? []).map((layer) => ({
        id: layer.id,
        name: layer.name,
        enabled: layer.enabled,
        opacity: layer.opacity,
        blendMode: layer.blendMode,
        fboSize: `${canvas.width}x${canvas.height}`,
        lastRenderedFrameId: layer.enabled ? Math.floor(time) : 0,
        nonEmpty: layer.enabled && layer.opacity > 0.01
      })),
      fx: [
        {
          id: 'bloom',
          enabled: currentProject.effects.enabled && currentProject.effects.bloom > 0,
          bypassed: !currentProject.effects.enabled,
          lastAppliedFrameId: Math.floor(time)
        },
        {
          id: 'blur',
          enabled: currentProject.effects.enabled && currentProject.effects.blur > 0,
          bypassed: !currentProject.effects.enabled,
          lastAppliedFrameId: Math.floor(time)
        },
        {
          id: 'chroma',
          enabled: currentProject.effects.enabled && currentProject.effects.chroma > 0,
          bypassed: !currentProject.effects.enabled,
          lastAppliedFrameId: Math.floor(time)
        },
        {
          id: 'posterize',
          enabled: currentProject.effects.enabled && currentProject.effects.posterize > 0,
          bypassed: !currentProject.effects.enabled,
          lastAppliedFrameId: Math.floor(time)
        },
        {
          id: 'kaleidoscope',
          enabled: currentProject.effects.enabled && currentProject.effects.kaleidoscope > 0,
          bypassed: !currentProject.effects.enabled,
          lastAppliedFrameId: Math.floor(time)
        },
        {
          id: 'feedback',
          enabled: currentProject.effects.enabled && currentProject.effects.feedback > 0,
          bypassed: !currentProject.effects.enabled,
          lastAppliedFrameId: Math.floor(time)
        },
        {
          id: 'persistence',
          enabled: currentProject.effects.enabled && currentProject.effects.persistence > 0,
          bypassed: !currentProject.effects.enabled,
          lastAppliedFrameId: Math.floor(time)
        }
      ],
      masterBusFrameId: Math.floor(time),
      uniformsUpdatedFrameId: Math.floor(time)
    },
    currentFps
  );

  if (outputOpen && time - lastOutputBroadcast > 33) {
    lastOutputBroadcast = time;
    outputChannel.postMessage({
      timeMs: renderState.timeMs,
      rms: renderState.rms,
      peak: renderState.peak,
      strobe: renderState.strobe,
      plasmaEnabled: renderState.plasmaEnabled,
      spectrumEnabled: renderState.spectrumEnabled,
      origamiEnabled: renderState.origamiEnabled,
      glyphEnabled: renderState.glyphEnabled,
      crystalEnabled: renderState.crystalEnabled,
      inkEnabled: renderState.inkEnabled,
      topoEnabled: renderState.topoEnabled,
      weatherEnabled: renderState.weatherEnabled,
      portalEnabled: renderState.portalEnabled,
      mediaEnabled: renderState.mediaEnabled,
      oscilloEnabled: renderState.oscilloEnabled,
      spectrum: renderState.spectrum.slice(),
      contrast: renderState.contrast,
      saturation: renderState.saturation,
      paletteShift: renderState.paletteShift,
      plasmaOpacity: renderState.plasmaOpacity,
      spectrumOpacity: renderState.spectrumOpacity,
      origamiOpacity: renderState.origamiOpacity,
      origamiFoldState: renderState.origamiFoldState,
      origamiFoldSharpness: renderState.origamiFoldSharpness,
      glyphOpacity: renderState.glyphOpacity,
      glyphMode: renderState.glyphMode,
      glyphSeed: renderState.glyphSeed,
      glyphBeat: renderState.glyphBeat,
      crystalOpacity: renderState.crystalOpacity,
      crystalMode: renderState.crystalMode,
      crystalBrittleness: renderState.crystalBrittleness,
      inkOpacity: renderState.inkOpacity,
      inkBrush: renderState.inkBrush,
      inkPressure: renderState.inkPressure,
      inkLifespan: renderState.inkLifespan,
      topoOpacity: renderState.topoOpacity,
      topoQuake: renderState.topoQuake,
      topoSlide: renderState.topoSlide,
      topoPlate: renderState.topoPlate,
      topoTravel: renderState.topoTravel,
      weatherOpacity: renderState.weatherOpacity,
      weatherMode: renderState.weatherMode,
      weatherIntensity: renderState.weatherIntensity,
      portalOpacity: renderState.portalOpacity,
      portalShift: renderState.portalShift,
      portalStyle: renderState.portalStyle,
      portalPositions: renderState.portalPositions,
      portalRadii: renderState.portalRadii,
      portalActives: renderState.portalActives,
      mediaOpacity: renderState.mediaOpacity,
      mediaBurstPositions: renderState.mediaBurstPositions,
      mediaBurstRadii: renderState.mediaBurstRadii,
      mediaBurstTypes: renderState.mediaBurstTypes,
      mediaBurstActives: renderState.mediaBurstActives,
      oscilloOpacity: renderState.oscilloOpacity,
      oscilloMode: renderState.oscilloMode,
      oscilloFreeze: renderState.oscilloFreeze,
      oscilloRotate: renderState.oscilloRotate,
      oscilloData: renderState.oscilloData,
      plasmaAssetBlendMode: renderState.plasmaAssetBlendMode,
      plasmaAssetAudioReact: renderState.plasmaAssetAudioReact,
      spectrumAssetBlendMode: renderState.spectrumAssetBlendMode,
      spectrumAssetAudioReact: renderState.spectrumAssetAudioReact,
      mediaAssetBlendMode: renderState.mediaAssetBlendMode,
      mediaAssetAudioReact: renderState.mediaAssetAudioReact,
      effectsEnabled: renderState.effectsEnabled,
      bloom: renderState.bloom,
      blur: renderState.blur,
      chroma: renderState.chroma,
      posterize: renderState.posterize,
      kaleidoscope: renderState.kaleidoscope,
      feedback: renderState.feedback,
      persistence: renderState.persistence,
      trailSpectrum: renderState.trailSpectrum,
      expressiveEnergyBloom: renderState.expressiveEnergyBloom,
      expressiveEnergyThreshold: renderState.expressiveEnergyThreshold,
      expressiveEnergyAccumulation: renderState.expressiveEnergyAccumulation,
      expressiveRadialGravity: renderState.expressiveRadialGravity,
      expressiveRadialStrength: renderState.expressiveRadialStrength,
      expressiveRadialRadius: renderState.expressiveRadialRadius,
      expressiveRadialFocusX: renderState.expressiveRadialFocusX,
      expressiveRadialFocusY: renderState.expressiveRadialFocusY,
      expressiveMotionEcho: renderState.expressiveMotionEcho,
      expressiveMotionEchoDecay: renderState.expressiveMotionEchoDecay,
      expressiveMotionEchoWarp: renderState.expressiveMotionEchoWarp,
      expressiveSpectralSmear: renderState.expressiveSpectralSmear,
      expressiveSpectralOffset: renderState.expressiveSpectralOffset,
      expressiveSpectralMix: renderState.expressiveSpectralMix,
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
      sdfFill: renderState.sdfFill,
      gravityPositions: renderState.gravityPositions,
      gravityStrengths: renderState.gravityStrengths,
      gravityPolarities: renderState.gravityPolarities,
      gravityActives: renderState.gravityActives,
      gravityCollapse: renderState.gravityCollapse
    });
  }

  requestAnimationFrame(render);
};

const init = async () => {
  initPads();
  initShortcuts();
  initSceneStrip();
  initPanelCollapse();
  initMatrixTabs();
  initLearnables();
  initSpectrumHint();
  loadPlaylist();
  renderPlaylist();
  loadShaderDraft();
  syncVisualizerFromProject();
  setCaptureStatus('Idle');
  console.log('[Init] Starting initPresets...');
  await initPresets();
  console.log('[Init] initPresets completed');

  console.log('[Init] Starting initTemplates...');
  await initTemplates();
  console.log('[Init] initTemplates completed');

  console.log('[Init] Starting initOutputConfig...');
  await initOutputConfig();
  console.log('[Init] initOutputConfig completed');

  refreshSceneSelect();
  applyScene(currentProject.activeSceneId);

  console.log('[Init] Starting initBpmNetworking...');
  await initBpmNetworking();
  console.log('[Init] initBpmNetworking completed');

  console.log('[Init] Starting loadGeneratorLibrary...');
  loadGeneratorLibrary();
  console.log('[Init] loadGeneratorLibrary completed');

  refreshGeneratorUI();
  initStylePresets();
  initPalettes();
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

  console.log('[Init] Starting initAudioDevices...');
  try {
    await initAudioDevices();
    console.log('[Init] initAudioDevices completed');

    await setupAudio();
    console.log('[Init] setupAudio completed');

    await setupMIDI();
    console.log('[Init] setupMIDI completed');
  } catch (e) {
    console.error('[Init] Audio setup error:', e);
  }

  // Check if recovery API is available
  if (window.visualSynth && window.visualSynth.getRecovery) {
    console.log('[Init] Starting recovery check...');
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
  } else {
    console.log('[Init] Recovery API not available - skipping');
  }

  console.log('[Init] Starting final setup...');
  syncTempoInputs(Number(tempoInput.value));
  console.log('[Init] syncTempoInputs completed');

  setMode('performance');
  console.log('[Init] setMode completed');

  if (currentProject.activeModeId) {
    applyVisualMode(currentProject.activeModeId);
  }

  updateTransportUI();
  console.log('[Init] updateTransportUI completed');

  requestAnimationFrame(render);
  console.log('[Init] requestAnimationFrame completed');

  console.log('VisualSynth init completed - render loop started');
  (window as any).__visualSynthInitialized = true;
  console.log('[Init] Initialized flag set');

  // Expose capture API for screenshot automation
  (window as any).__visualSynthCaptureApi = {
    applyProject: async (project: VisualSynthProject) => {
      await applyProject(project);
    },
    getCurrentProject: () => {
      return { ...currentProject };
    },
    applyScene: (sceneId: string) => {
      applyScene(sceneId);
    },
    setMode: (mode: UiMode) => {
      setMode(mode);
    }
  };
  console.log('[Init] Capture API exposed');
};

void init();
