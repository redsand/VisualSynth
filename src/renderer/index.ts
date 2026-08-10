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
  SceneTransition,
  MacroConfig,
  LayerConfig,
  AssetItem,
  AssetColorSpace
} from '../shared/project';
import type { ModConnection, MidiMapping } from '../shared/project';
import { SceneManager, captureSceneSnapshot } from './scene/SceneManager';
import { renderSceneTimelineItems } from './scene/sceneTimeline';
import { projectSchema } from '../shared/projectSchema';
import { createGLRenderer, RenderState, resizeCanvasToDisplaySize } from './glRenderer';
import { compileSceneShaders, primeProjectShaders } from './shaderLifecycle';
import { getFxUniformsDeclarations } from '../shared/shaderUtils';
import { createDebugOverlay } from './render/debugOverlay';
import { createLayerPanel } from './ui/panels/LayerPanel';
import { createMixerPanel } from './ui/panels/MixerPanel';
import { createSdfPanel } from './ui/panels/SdfPanel';
import { createOutputManagerPanel, injectOutputManagerStyles } from './ui/panels/OutputManagerPanel';
import { registerSdfNodes } from './sdf/nodes';
import { createModulationPanel } from './ui/panels/ModulationPanel';
import { getBeatMs, getNextQuantizedTimeMs, QuantizationUnit } from '../shared/quantization';
import { BpmRange, clampBpmRange, fitBpmToRange } from '../shared/bpm';
import { GENERATORS, GeneratorId, getVisibleGenerators, updateRecents, toggleFavorite, supportsAsset, needsInput } from '../shared/generatorLibrary';
import { getMidiChannel, mapPadWithBank, scaleMidiValue } from '../shared/midiMapping';
import { applyModMatrix, ModSmoothEntry } from '../shared/modMatrix';
import { GLOBAL_MOD_TARGETS, resolveModTargetRange } from '../shared/modTargets';
import { PARAMETER_REGISTRY, buildLegacyTarget, getLayerType, getModulatableParams, getMidiMappableParams, getParamDef, parseLegacyTarget } from '../shared/parameterRegistry';
import { resolveGenUniforms } from '../shared/genUniformResolver';
import { lfoValueForShape } from '../shared/lfoUtils';
import { reorderLayers, cloneLayerConfig, ensureLayerWithDefaults } from '../shared/layers';
import { applyExchangePayload, createMacrosExchange, createSceneExchange, ExchangePayload } from '../shared/exchange';
import { pluginManifestSchema } from '../shared/pluginSchema';
import { mergeProjectSections, MergeOptions } from '../shared/projectMerge';
import { toFileUrl } from '../shared/fileUrl';
import { createAssetItem, normalizeAssetTags } from '../shared/assets';
import type { AssetImportResult, AssetTextureSampling } from '../shared/assets';
import { createScenePreset } from '../shared/scenePreset';
import type { PresetIndexEntry } from '../shared/presetIndex';
import { getCertificationColor } from '../shared/certification';
import { syncActiveSceneLookSection } from '../shared/sceneLookSync';
import { getModeVisibility, UiMode } from '../shared/uiModes';
import { VISUAL_MODES, VisualMode } from '../shared/modes';
import { ENGINE_REGISTRY, VisualEngine, EngineId } from '../shared/engines';
import { playlistManager, PlaylistEvent } from './playlist/PlaylistManager';
import { buildCaptureDiagnostics } from './captureDiagnostics';
import { createSafeModeRenderer } from './safeModeRenderer';
import { applySceneActivationRuntime, resolveSceneActivationRuntime } from './sceneRuntime';
import { selectStartupProject } from './startupProject';
import { applyStartupSelection } from './startupProjectApply';
import { applyLoadableProjectRuntime } from './projectApplyRuntime';
import { initializeOutputSession } from './outputSessionRuntime';
import {
  nextFrameDropScore,
  resolveFrameCadence,
  resolveLatencyDiagnostics,
  resolveSceneSwitch,
  tickFpsTracker
} from './render/renderLoopHelpers';
import { buildRendererOutputBroadcastPayload } from './render/outputPayload';
import type { OutputTransitionPayload } from './render/outputPayload';
import { collectSceneGeneratorIds } from '../shared/shaderUtils';
import { ensureVisualSynthBridge } from './visualSynthBridge';
import { createOverlayRenderer } from './overlayRenderer';
import type { OverlayConfig } from '../shared/project';
import { reorderScenes } from '../shared/project';
import { DEFAULT_NOW_PLAYING_SETTINGS, isNowPlayingMetadataSourceConfigured, isNowPlayingLookupConfigured, type NowPlayingRecognitionRequest, type NowPlayingRecognitionResponse, type NowPlayingSettings } from '../shared/nowPlaying';
import { createRollingAudioCapture, decodeClipToPcmWithDiagnostics, type ExportResult, type RecentAudioClip } from './audio/rollingAudioCapture';
import { getAudioEngine, createAudioEngine } from './audio/AudioEngine';
import type { Store } from './state/store';
import { sessionHealthService } from './sessionHealthService';
import { createTransitionTracer, type TransitionSource } from './render/transitionTracer';
import { sessionLog, initSessionLog } from './sessionLog';

declare global {
  interface Window {
    visualSynth: {
      saveProject: (payload: string, filePath?: string) => Promise<{ canceled: boolean; filePath?: string }>;
      saveProjectAs: (payload: string) => Promise<{ canceled: boolean; filePath?: string }>;
      autosaveProject: (payload: string) => Promise<{ saved: boolean; filePath?: string }>;
      showSaveDialog: (isRecovery: boolean) => Promise<{ result: 'save' | 'discard' | 'cancel' }>;
      confirmClose: () => Promise<void>;
      onCloseRequested: (handler: () => void) => void;
      savePreset: (
        payload: string,
        defaultName: string
      ) => Promise<{ canceled: boolean; filePath?: string; error?: string }>;
      saveExchange: (
        payload: string,
        defaultName: string
      ) => Promise<{ canceled: boolean; filePath?: string }>;
      openProject: () => Promise<{ canceled: boolean; project?: VisualSynthProject; filePath?: string; error?: string }>;
      openSceneFile: () => Promise<{ canceled: boolean; files?: { filePath: string; payload: string }[]; filePath?: string; error?: string }>;
      loadShowcaseProject: () => Promise<{ found: boolean; payload?: string; error?: string }>;
      getRecovery: () => Promise<{ found: boolean; payload?: string; filePath?: string }>;
      openExchange: () => Promise<{ canceled: boolean; payload?: string; filePath?: string }>;
      listPresets: () => Promise<PresetIndexEntry[]>;
      loadPreset: (presetPath: string) => Promise<{ preset?: any; error?: string }>;
      listTemplates: () => Promise<{ name: string; path: string }[]>;
      loadTemplate: (templatePath: string) => Promise<{ project?: VisualSynthProject; error?: string }>;
      listNodeMidi: () => Promise<{ index: number; name: string }[]>;
      openNodeMidi: (portIndex: number) => Promise<{ opened: boolean; error?: string }>;
      closeNodeMidi: () => Promise<{ closed: boolean }>;
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
      ) => Promise<AssetImportResult>;
      checkAssetPaths: (paths: string[]) => Promise<Record<string, boolean>>;
      relinkAsset: (assetId: string, kind: string) => Promise<AssetImportResult & { assetId?: string }>;
      importPlugin: () => Promise<{ canceled: boolean; filePath?: string; payload?: string }>;
      getNowPlayingSettings: () => Promise<NowPlayingSettings>;
      saveNowPlayingSettings: (settings: Partial<NowPlayingSettings>) => Promise<NowPlayingSettings>;
      fetchNowPlayingMetadata: (endpoint: string, secret?: string) => Promise<NowPlayingRecognitionResponse>;
      testNowPlayingFile: (
        request: Omit<NowPlayingRecognitionRequest, 'audioBase64' | 'mimeType' | 'durationMs' | 'detectedAt'> & {
          initialPath?: string;
        }
      ) => Promise<NowPlayingRecognitionResponse & { selectedFilePath?: string; canceled?: boolean }>;
      identifyNowPlaying: (
        request: NowPlayingRecognitionRequest
      ) => Promise<NowPlayingRecognitionResponse>;
      cacheRemoteArtwork: (
        imageUrl: string
      ) => Promise<{ cached: boolean; filePath?: string; error?: string }>;
      enrichNowPlayingArtwork: (request: {
        title?: string;
        artist?: string;
        album?: string;
        market?: string;
      }) => Promise<{
        artworkUrl?: string;
        artistImageUrl?: string;
        provider?: string;
        error?: string;
      }>;
      launchWhatsNowPlayingCompanion: () => Promise<{
        available: boolean;
        installed: boolean;
        launched: boolean;
        extractedPath?: string;
        executablePath?: string;
        message?: string;
        error?: string;
      }>;
      openWhatsNowPlayingCompanionFolder: () => Promise<{ opened: boolean; path?: string; error?: string }>;
      openAssetFolder: (filePath: string) => Promise<{ opened: boolean }>;
      // Spout/NDI output integration
      spoutIsAvailable: () => Promise<boolean>;
      spoutGetStatus: () => Promise<{ enabled: boolean; senderName: string; connectedReceivers?: number }>;
      spoutEnable: (name: string) => Promise<boolean>;
      spoutDisable: () => Promise<void>;
      spoutSetSenderName: (name: string) => Promise<void>;
      ndiIsAvailable: () => Promise<boolean>;
      ndiGetStatus: () => Promise<{ enabled: boolean; senderName: string }>;
      ndiEnable: (options: { senderName: string; groups?: string }) => Promise<boolean>;
      ndiDisable: () => Promise<void>;
      ndiSetSenderName: (name: string) => Promise<void>;
    };
    // RenderGraph for macro triggering. index.ts is the default browser entrypoint.
    renderGraph?: {
      triggerMacro: (macroId: string) => void;
      handleMidiNote: (channel: number, note: number, velocity: number, bank?: number) => boolean;
      handleMidiCC: (channel: number, cc: number, value: number) => boolean;
    };
  }
}

const audioSelect = document.getElementById('audio-device') as HTMLSelectElement;
const requestMicPermissionButton = document.getElementById('request-mic-permission') as HTMLButtonElement;
const midiSelect = document.getElementById('midi-device') as HTMLSelectElement;
const toggleMidiButton = document.getElementById('toggle-midi') as HTMLButtonElement;
const nowPlayingStatus = document.getElementById('now-playing-status') as HTMLDivElement;
const nowPlayingDiagnostics = document.getElementById('now-playing-diagnostics') as HTMLDivElement;
const nowPlayingStateLabel = document.getElementById('now-playing-state') as HTMLSpanElement;
const nowPlayingConfidenceBar = document.getElementById('now-playing-confidence-bar') as HTMLDivElement;
const nowPlayingBufferBar = document.getElementById('now-playing-buffer-bar') as HTMLDivElement;
const nowPlayingLastSuccessLabel = document.getElementById('now-playing-last-success') as HTMLSpanElement;
const nowPlayingErrorContainer = document.getElementById('now-playing-error-container') as HTMLDivElement;
const nowPlayingErrorText = document.getElementById('now-playing-error-text') as HTMLSpanElement;
const nowPlayingConfigureButton = document.getElementById('now-playing-configure') as HTMLButtonElement;
const nowPlayingModal = document.getElementById('now-playing-modal') as HTMLDivElement;
const nowPlayingEnabledInput = document.getElementById('now-playing-enabled') as HTMLInputElement;
const nowPlayingMetadataEnabledInput = document.getElementById('now-playing-metadata-enabled') as HTMLInputElement;
const nowPlayingMetadataUrlGroup = document.getElementById('now-playing-metadata-url-group') as HTMLLabelElement;
const nowPlayingMetadataUrlInput = document.getElementById('now-playing-metadata-url') as HTMLInputElement;
const nowPlayingMetadataSecretGroup = document.getElementById('now-playing-metadata-secret-group') as HTMLLabelElement;
const nowPlayingMetadataSecretInput = document.getElementById('now-playing-metadata-secret') as HTMLInputElement;
const nowPlayingProviderSelect = document.getElementById('now-playing-provider') as HTMLSelectElement;
const nowPlayingEndpointGroup = document.getElementById('now-playing-endpoint-group') as HTMLLabelElement;
const nowPlayingEndpointInput = document.getElementById('now-playing-endpoint') as HTMLInputElement;
const nowPlayingHostGroup = document.getElementById('now-playing-host-group') as HTMLLabelElement;
const nowPlayingHostInput = document.getElementById('now-playing-host') as HTMLInputElement;
const nowPlayingApiKeyGroup = document.getElementById('now-playing-api-key-group') as HTMLLabelElement;
const nowPlayingApiKeyInput = document.getElementById('now-playing-api-key') as HTMLInputElement;
const nowPlayingApiSecretGroup = document.getElementById('now-playing-api-secret-group') as HTMLLabelElement;
const nowPlayingApiSecretInput = document.getElementById('now-playing-api-secret') as HTMLInputElement;
const nowPlayingClipDurationInput = document.getElementById('now-playing-clip-duration') as HTMLInputElement;
const nowPlayingCooldownInput = document.getElementById('now-playing-cooldown') as HTMLInputElement;
const nowPlayingArtworkPreferenceSelect = document.getElementById('now-playing-artwork-preference') as HTMLSelectElement;
const nowPlayingAutoOverlaysInput = document.getElementById('now-playing-auto-overlays') as HTMLInputElement;
const nowPlayingProviderHint = document.getElementById('now-playing-provider-hint') as HTMLDivElement;
const nowPlayingApplyCompanionPresetButton = document.getElementById('now-playing-apply-companion-preset') as HTMLButtonElement;
const nowPlayingTestBridgeButton = document.getElementById('now-playing-test-bridge') as HTMLButtonElement;
const nowPlayingOpenBridgeDocsButton = document.getElementById('now-playing-open-bridge-docs') as HTMLButtonElement;
const nowPlayingOpenBridgeDownloadButton = document.getElementById('now-playing-open-bridge-download') as HTMLButtonElement;
const nowPlayingLaunchCompanionButton = document.getElementById('now-playing-launch-companion') as HTMLButtonElement;
const nowPlayingOpenCompanionFolderButton = document.getElementById('now-playing-open-companion-folder') as HTMLButtonElement;
const nowPlayingTestStatus = document.getElementById('now-playing-test-status') as HTMLDivElement;
const nowPlayingTestLiveButton = document.getElementById('now-playing-test-live') as HTMLButtonElement;
const nowPlayingTestButton = document.getElementById('now-playing-test') as HTMLButtonElement;
const nowPlayingCancelButton = document.getElementById('now-playing-cancel') as HTMLButtonElement;
const nowPlayingSaveButton = document.getElementById('now-playing-save') as HTMLButtonElement;
const saveButton = document.getElementById('btn-save') as HTMLButtonElement | null;
const savePerfButton = document.getElementById('btn-save-perf') as HTMLButtonElement | null;
const loadButton = document.getElementById('btn-load') as HTMLButtonElement | null;
const presetSelect = document.getElementById('preset-select') as HTMLSelectElement;
const applyPresetButton = document.getElementById('btn-apply-preset') as HTMLButtonElement;
const presetPrevButton = document.getElementById('preset-prev') as HTMLButtonElement;
const presetNextButton = document.getElementById('preset-next') as HTMLButtonElement;
const presetCategorySelect = document.getElementById('preset-category') as HTMLSelectElement;
const presetShuffleButton = document.getElementById('preset-shuffle') as HTMLButtonElement;
const presetBrowser = document.getElementById('preset-browser') as HTMLDivElement;
const presetExplorer = document.getElementById('preset-explorer') as HTMLDivElement;
const presetSearchInput = document.getElementById('preset-search') as HTMLInputElement;
const presetQuickFilters = document.getElementById('preset-quick-filters') as HTMLDivElement;
const presetResultsCount = document.getElementById('preset-results-count') as HTMLDivElement;
const presetPreviewThumb = document.getElementById('preset-preview-thumb') as HTMLDivElement;
const presetPreviewName = document.getElementById('preset-preview-name') as HTMLDivElement;
const presetPreviewMeta = document.getElementById('preset-preview-meta') as HTMLDivElement;
const presetPreviewBadges = document.getElementById('preset-preview-badges') as HTMLDivElement;
const presetLoadProjectButton = document.getElementById('preset-load-project') as HTMLButtonElement;
const presetFavoriteButton = document.getElementById('preset-favorite') as HTMLButtonElement;
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
const mappingLeft = document.getElementById('mode-mapping-left') as HTMLDivElement;
const mappingCenter = document.getElementById('mode-mapping-center') as HTMLDivElement;
const mixerLeft = document.getElementById('mode-mixer-left') as HTMLDivElement;
const mixerRight = document.getElementById('mode-mixer-right') as HTMLDivElement;
const mappingRight = document.getElementById('mode-mapping-right') as HTMLDivElement;
const systemLeft = document.getElementById('mode-system-left') as HTMLDivElement;
const systemRight = document.getElementById('mode-system-right') as HTMLDivElement;
const liveLeft = document.getElementById('mode-live-left') as HTMLDivElement;
const liveRight = document.getElementById('mode-live-right') as HTMLDivElement;
const livePadGrid = document.getElementById('live-pad-grid') as HTMLDivElement;
const liveSortSelect = document.getElementById('live-sort') as HTMLSelectElement;
const livePlaylistDuration = document.getElementById('live-playlist-duration') as HTMLInputElement;
const livePlaylistTransition = document.getElementById('live-playlist-transition') as HTMLInputElement;
const livePlaylistPlay = document.getElementById('live-playlist-play') as HTMLButtonElement;
const livePlaylistStop = document.getElementById('live-playlist-stop') as HTMLButtonElement;
const livePlaylistList = document.getElementById('live-playlist-list') as HTMLDivElement;
const liveActiveInfo = document.getElementById('live-active-info') as HTMLDivElement;
const liveMacroEnergy = document.getElementById('live-macro-energy') as HTMLInputElement;
const liveMacroSpeed = document.getElementById('live-macro-speed') as HTMLInputElement;
const liveMacroColor = document.getElementById('live-macro-color') as HTMLInputElement;
const liveMacroDepth = document.getElementById('live-macro-depth') as HTMLInputElement;
const livePaletteGrid = document.getElementById('live-palette-grid') as HTMLDivElement;
const liveFxList = document.getElementById('live-fx-list') as HTMLDivElement;
const sceneStrip = document.getElementById('scene-strip') as HTMLDivElement | null;
const sceneStripAnchor = document.getElementById('scene-strip-anchor') as HTMLDivElement;
const sceneStripCards = document.getElementById('scene-strip-cards') as HTMLDivElement | null;
const sceneStripList = document.getElementById('scene-strip-list') as HTMLDivElement | null;
const sceneStripViewButtons = sceneStrip
  ? Array.from(sceneStrip.querySelectorAll<HTMLButtonElement>('button[data-scene-view]'))
  : [];
const addBlankSceneButton = document.getElementById('scene-add-blank') as HTMLButtonElement | null;
const transportTap = document.getElementById('transport-tap') as HTMLButtonElement;
const transportBpmInput = document.getElementById('transport-bpm') as HTMLInputElement;
const transportBpmState = document.getElementById('transport-bpm-state') as HTMLSpanElement;
const transportPauseButton = document.getElementById('transport-pause') as HTMLButtonElement;
const outputRouteSelect = document.getElementById('output-route') as HTMLSelectElement;
const visualModeSelect = document.getElementById('visual-mode-select') as HTMLSelectElement;
const topbarOpenProjectButton = document.getElementById('topbar-open-project') as HTMLButtonElement | null;
const topbarSaveProjectButton = document.getElementById('topbar-save-project') as HTMLButtonElement | null;
const engineSelect = document.getElementById('engine-select') as HTMLSelectElement | null;
const engineDescription = document.getElementById('engine-description') as HTMLDivElement | null;
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
const perfToggleSpectrum = document.getElementById('perf-toggle-spectrum') as HTMLInputElement | null;
const spectrumHint = document.getElementById('spectrum-hint') as HTMLDivElement | null;
const spectrumHintDismiss = document.getElementById('spectrum-hint-dismiss') as HTMLButtonElement | null;
const perfAddLayerButton = document.getElementById('perf-add-layer') as HTMLButtonElement | null;
const designAddLayerButton = document.getElementById('design-add-layer') as HTMLButtonElement;
const generatorPanel = document.getElementById('generator-panel') as HTMLDivElement;
const perfPaletteGrid = document.getElementById('perf-palette-grid') as HTMLDivElement;
const overlayCanvas = document.getElementById('overlay-canvas') as HTMLCanvasElement;
const overlayAddImageBtn = document.getElementById('overlay-add-image') as HTMLButtonElement;
const overlayAddTextBtn = document.getElementById('overlay-add-text') as HTMLButtonElement;
const overlayListEl = document.getElementById('overlay-list') as HTMLDivElement;
const overlayPropsEl = document.getElementById('overlay-props') as HTMLDivElement;
const overlayNameInput = document.getElementById('overlay-name') as HTMLInputElement;
const overlayTextGroup = document.getElementById('overlay-text-group') as HTMLDivElement;
const overlayTextInput = document.getElementById('overlay-text') as HTMLInputElement;
const overlayFontSizeInput = document.getElementById('overlay-font-size') as HTMLInputElement;
const overlayFontColorInput = document.getElementById('overlay-font-color') as HTMLInputElement;
const overlayFontBoldInput = document.getElementById('overlay-font-bold') as HTMLInputElement;
const overlayTextShadowInput = document.getElementById('overlay-text-shadow') as HTMLInputElement;
const overlayOpacityInput = document.getElementById('overlay-opacity') as HTMLInputElement;
const overlayRotationInput = document.getElementById('overlay-rotation') as HTMLInputElement;
const overlayIncludeFxInput = document.getElementById('overlay-include-fx') as HTMLInputElement;
const overlayPersistInput = document.getElementById('overlay-persist') as HTMLInputElement;
const overlayDeleteBtn = document.getElementById('overlay-delete') as HTMLButtonElement;
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
const sceneSelect = document.getElementById('scene-select') as HTMLSelectElement | null;
const tempoInput = document.getElementById('tempo-input') as HTMLInputElement;
const manualBpmRow = document.getElementById('manual-bpm-row') as HTMLLabelElement;
const quantizeSelect = document.getElementById('quantize-select') as HTMLSelectElement | null;
const queueSceneButton = document.getElementById('queue-scene') as HTMLButtonElement | null;
const activateSceneButton = document.getElementById('activate-scene') as HTMLButtonElement | null;
const quantizeHud = document.getElementById('quantize-hud') as HTMLDivElement;
const safeModeBanner = document.getElementById('safe-mode-banner') as HTMLDivElement;
const mappingHud = document.getElementById('mapping-hud') as HTMLDivElement;
const mappingHudTitle = document.getElementById('mapping-hud-title') as HTMLDivElement;
const mappingHudTarget = document.getElementById('mapping-hud-target') as HTMLDivElement;
const mappingHudCancel = document.getElementById('mapping-hud-cancel') as HTMLButtonElement;
const mappingTargetSearch = document.getElementById('mapping-target-search') as HTMLInputElement;
const mappingTargetList = document.getElementById('mapping-target-list') as HTMLDivElement;
const visualPreview = document.getElementById('visual-preview') as HTMLDivElement;
const mappingPreviewHost = document.getElementById('mapping-preview-host') as HTMLDivElement;
const centerPanel = document.querySelector('.center-panel') as HTMLDivElement;
const visualPreviewParent = visualPreview?.parentElement ?? null;
const visualPreviewNextSibling = visualPreview?.nextSibling ?? null;
const midiLearnToggleButton = document.getElementById('midi-learn-toggle') as HTMLButtonElement;
const bpmSourceSelect = document.getElementById('bpm-source') as HTMLSelectElement;

const updateMappingHud = () => {
  if (learnTarget) {
    mappingHud.classList.remove('hidden');
    mappingHudTitle.textContent = 'MIDI Learn Active';
    mappingHudTarget.textContent = `Waiting for MIDI input for: ${learnTarget.label}`;
  } else {
    mappingHud.classList.add('hidden');
  }
};
const updateMidiLearnToggle = () => {
  if (!midiLearnToggleButton) return;
  midiLearnToggleButton.textContent = `MIDI Learn: ${midiLearnEnabled ? 'On' : 'Off'}`;
  midiLearnToggleButton.classList.toggle('active', midiLearnEnabled);
};
const bpmRangeSelect = document.getElementById('bpm-range') as HTMLSelectElement;
const bpmCustomRangeRow = document.getElementById('bpm-custom-range-row') as HTMLDivElement;
const bpmMinInput = document.getElementById('bpm-min') as HTMLInputElement;
const bpmMaxInput = document.getElementById('bpm-max') as HTMLInputElement;
const bpmInterfaceSelect = document.getElementById('bpm-interface') as HTMLSelectElement;
const bpmNetworkToggle = document.getElementById('bpm-network-toggle') as HTMLButtonElement;
const bpmDisplay = document.getElementById('bpm-display') as HTMLDivElement | null;
const beatSensitivityInput = document.getElementById('beat-sensitivity') as HTMLInputElement;
const beatFilterSelect = document.getElementById('beat-filter') as HTMLSelectElement;
const beatHoldOffInput = document.getElementById('beat-holdoff') as HTMLInputElement;
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
const sceneTransitionTypeSelect = document.getElementById('scene-transition-type') as HTMLSelectElement;
const sceneTransitionDuration = document.getElementById('scene-transition-duration') as HTMLInputElement;
const sceneTransitionCurve = document.getElementById('scene-transition-curve') as HTMLSelectElement;
const sceneViewSelect = document.getElementById('scene-view-select') as HTMLSelectElement;
const sceneEditSelect = document.getElementById('scene-edit-select') as HTMLSelectElement;
const sceneIntentSelect = document.getElementById('scene-intent-select') as HTMLSelectElement;
const sceneTriggerType = document.getElementById('scene-trigger-type') as HTMLSelectElement;
const sceneTriggerThreshold = document.getElementById('scene-trigger-threshold') as HTMLInputElement;
const sceneTriggerInterval = document.getElementById('scene-trigger-interval') as HTMLInputElement;
const sceneTriggerAudioOptions = document.getElementById('scene-trigger-audio-options') as HTMLDivElement;
const sceneContextPanel = document.getElementById('scene-context-panel') as HTMLDivElement;
const sceneEditPanel = document.getElementById('scene-edit-panel') as HTMLDivElement;
const sceneAddBtn = document.getElementById('scene-add-btn') as HTMLButtonElement;
const sceneAddBtnView = document.getElementById('scene-add-btn-view') as HTMLButtonElement;
const sceneDeleteBtn = document.getElementById('scene-delete-btn') as HTMLButtonElement;
const sceneDeleteBtnView = document.getElementById('scene-delete-btn-view') as HTMLButtonElement;
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
const expressiveFxEnabled = document.getElementById('expressive-fx-enabled') as HTMLInputElement;
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
const chemistrySelect = document.getElementById('chemistry-select') as HTMLSelectElement;
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

const perfModeEnabled = document.getElementById('perf-mode-enabled') as HTMLInputElement;
const perfModeRestrictPresets = document.getElementById('perf-mode-restrict-presets') as HTMLInputElement;
const perfModeAutoRecovery = document.getElementById('perf-mode-auto-recovery') as HTMLInputElement;

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
const assetFontSelect = document.getElementById('asset-font-select') as HTMLSelectElement | null;
const assetFontSizeInput = document.getElementById('asset-font-size') as HTMLInputElement | null;
const assetFontBoldCheckbox = document.getElementById('asset-font-bold') as HTMLInputElement | null;
const assetFontItalicCheckbox = document.getElementById('asset-font-italic') as HTMLInputElement | null;
const assetTextAddButton = document.getElementById('asset-text-add') as HTMLButtonElement | null;
const assetTagsInput = document.getElementById('asset-tags') as HTMLInputElement | null;
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

const stopAllLiveStreams = () => {
  liveStreams.forEach((_, assetId) => stopLiveAssetStream(assetId));
};

const restoreDynamicAssets = async () => {
  stopAllLiveStreams();

  const liveAssets = currentProject.assets.filter(
    (asset) => asset.kind === 'live' && asset.options?.liveSource && !asset.missing
  );

  if (liveAssets.length === 0) return;

  let restoredCount = 0;
  let failedCount = 0;

  for (const asset of liveAssets) {
    const source = asset.options!.liveSource;

    if (source === 'webcam') {
      try {
        const savedDeviceId = getSavedWebcamId();
        let videoConstraints: MediaTrackConstraints | boolean = true;

        if (savedDeviceId) {
          videoConstraints = { deviceId: { exact: savedDeviceId }, width: 1280, height: 720 };
        } else {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const cameras = devices.filter((device) => device.kind === 'videoinput');
          if (cameras.length > 0) {
            videoConstraints = { deviceId: { exact: cameras[0].deviceId }, width: 1280, height: 720 };
          } else {
            videoConstraints = { width: 1280, height: 720 };
          }
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: false
        });

        const track = stream.getVideoTracks()[0];
        const settings = track.getSettings();

        asset.width = settings.width ?? asset.width ?? 1280;
        asset.height = settings.height ?? asset.height ?? 720;
        asset.missing = false;

        const video = document.createElement('video');
        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        void video.play();

        livePreviewElements.set(asset.id, video);
        liveStreams.set(asset.id, stream);

        track.addEventListener('ended', () => {
          stopLiveAssetStream(asset.id);
          asset.missing = true;
          renderAssets();
          setStatus(`Live source ended: ${asset.name}`);
        });

        restoredCount++;
      } catch (err) {
        asset.missing = true;
        failedCount++;
        console.warn(`[Project] Failed to restore webcam asset "${asset.name}":`, err);
      }
    } else {
      asset.missing = true;
      failedCount++;
    }
  }

  if (restoredCount > 0 || failedCount > 0) {
    renderAssets();
    renderLayerList();
    if (failedCount > 0 && restoredCount > 0) {
      setStatus(`Restored ${restoredCount} live source(s), ${failedCount} need manual restart`);
    } else if (restoredCount > 0) {
      setStatus(`Restored ${restoredCount} live source(s)`);
    } else {
      setStatus(`${failedCount} live source(s) need manual restart`);
    }
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
const refreshAllPresetsButton = document.getElementById('refresh-all-presets') as HTMLButtonElement;

const fpsLabel = document.getElementById('diag-fps') as HTMLDivElement;
const latencyLabel = document.getElementById('diag-latency') as HTMLDivElement;
const outputLatencyLabel = document.getElementById('diag-output-latency') as HTMLDivElement;
const midiLatencyLabel = document.getElementById('diag-midi-latency') as HTMLDivElement;
const watchdogLabel = document.getElementById('diag-watchdog') as HTMLDivElement;
const gpuLabel = document.getElementById('diag-gpu') as HTMLDivElement;
const webglDiag = document.getElementById('diag-webgl') as HTMLDivElement;
const webglCopyButton = document.getElementById('diag-webgl-copy') as HTMLButtonElement;

let currentProject: VisualSynthProject = DEFAULT_PROJECT;
import { SceneCacheWarmer } from './scene/SceneCacheWarmer';
let cacheWarmer: SceneCacheWarmer | null = null;
const sceneManager = new SceneManager(() => currentProject);
const transitionTracer = createTransitionTracer(20);
let transitionTracerSeq: number | null = null;
let postTransitionFramesLeft = 0;
let lastKnownCustomBlocksHash = '';
const getLatestTransitionPayload = (): OutputTransitionPayload | null => {
  const latest = transitionTracer.getRecentTransitions(1)[0];
  if (!latest) return null;
  return {
    seq: latest.seq,
    prevSceneId: latest.prevSceneId,
    prevSceneName: latest.prevSceneName,
    nextSceneId: latest.nextSceneId,
    nextSceneName: latest.nextSceneName,
    source: latest.source,
    timestamp: latest.timestamp,
    flaggedBlack: latest.flaggedBlack
  };
};
const getRendererShaderVariantKey = (): string | null =>
  renderer.getPendingShaderVariantKey?.() ?? renderer.getCurrentShaderVariantKey?.() ?? null;
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
let previewSceneId: string | null = null;
let outputConfig: OutputConfig = { ...DEFAULT_OUTPUT_CONFIG };
let outputOpen = false;
const outputChannel = new BroadcastChannel('visualsynth-output');

let outputFallbackBanner: HTMLDivElement | null = null;
const ensureOutputFallbackBanner = () => {
  if (outputFallbackBanner) return;
  outputFallbackBanner = document.createElement('div');
  outputFallbackBanner.id = 'output-fallback-banner';
  outputFallbackBanner.style.cssText = [
    'position:fixed', 'bottom:12px', 'right:12px',
    'background:rgba(220,40,40,0.9)', 'color:#fff', 'font:bold 12px monospace',
    'padding:8px 16px', 'border-radius:4px', 'z-index:10000',
    'pointer-events:none', 'display:none', 'box-shadow: 0 4px 12px rgba(0,0,0,0.5)',
    'border: 1px solid rgba(255,255,255,0.2)'
  ].join(';');
  document.body.appendChild(outputFallbackBanner);
};

outputChannel.onmessage = (event) => {
  const data = event.data;
  if (data?.type === 'output-health') {
    ensureOutputFallbackBanner();
    if (data.isDegraded) {
      outputFallbackBanner!.style.display = 'block';
      outputFallbackBanner!.textContent = `⚠ REMOTE OUTPUT DEGRADED — blank for ${Math.round(data.blankDurationMs / 1000)}s`;
    } else {
      outputFallbackBanner!.style.display = 'none';
    }
  }
};
let lastOutputBroadcast = 0;
const WEBCAM_STORAGE_KEY = 'visualsynth.webcamDeviceId';
const ASSET_LAYER_HISTORY_KEY = 'visualsynth.assetLayerHistory';

const getAssetLayerHistory = (): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(ASSET_LAYER_HISTORY_KEY) ?? '{}');
  } catch {
    return {};
  }
};

const saveAssetLayerHistory = (history: Record<string, string>) => {
  try {
    localStorage.setItem(ASSET_LAYER_HISTORY_KEY, JSON.stringify(history));
  } catch {
    // Ignore
  }
};

const recordAssetLayerAssignment = (assetKind: string, layerId: string) => {
  const history = getAssetLayerHistory();
  history[assetKind] = layerId;
  saveAssetLayerHistory(history);
};

const getLastAssignedLayerForKind = (assetKind: string): string | null => {
  const history = getAssetLayerHistory();
  return history[assetKind] ?? null;
};
let lastMidiLatencyMs: number | null = null;
let pendingSceneSwitch: { targetSceneId: string; scheduledTimeMs: number; transitionOverride?: SceneTransition | null } | null = null;
// Cooldown for scene.next / scene.prev modulation triggers so a source that
// stays above threshold doesn't fire a scene advance every frame.
let lastSceneModTriggerMs = -Infinity;
const SCENE_MOD_COOLDOWN_MS = 1500;
let sdfPanel: { render: () => void } | null = null;
let mixerPanel: { render: () => void; updateMeters: (rms: number, peak: number, bands: number[]) => void } | null = null;
let autoBpm: number | null = null;
let networkBpm: number | null = null;
let bpmRange: BpmRange = { min: 80, max: 150 };
let bpmSource: 'manual' | 'auto' | 'network' = 'auto';
let bpmNetworkActive = false;
let lastTempoEstimateTime = 0;
let beatSensitivity = 1.5;
let beatFilterRange: 'full' | 'bass' | 'mids' = 'full';
let beatHoldOffMs = 0;
let lastBeatTime = 0;
let fluxPrev = 0;
let fluxPrevPrev = 0;
let projectDirty = false;
let isRecoveryProject = false;
let suppressStartupRecovery = false;

const markProjectDirty = () => {
  projectDirty = true;
};
let fluxPrevTime = 0;
let fluxHistory: { time: number; value: number }[] = [];
let onsetTimes: number[] = [];
let spectrumPrev: Float32Array | null = null;
let generatorFavoritesState: GeneratorId[] = [];
let generatorRecentsState: GeneratorId[] = [];
const visibleGenerators = getVisibleGenerators();
let activeStyleId = '';
let macroInputs: HTMLInputElement[] = [];
let macroPreviewRows: HTMLDivElement[] = [];
let learnTarget: { target: string; label: string } | null = null;
let midiLearnEnabled = false;
let midiSum: Record<string, number> = {};
let safeModeReasons: string[] = [];
let latestCaptureRenderSnapshot: {
  timeMs: number;
  rms: number;
  peak: number;
  strobe: number;
  legacyNeutral: boolean;
  activeEngineId: string | null;
  activeModeId: string | null;
  roleCoreWeight: number;
  roleSupportWeight: number;
  roleAtmosphereWeight: number;
  effectsEnabled: boolean;
  plasmaEnabled: boolean;
  spectrumEnabled: boolean;
  plasmaOpacity: number;
  spectrumOpacity: number;
  glyphBeat: number;
  topoOpacity: number;
  weatherOpacity: number;
  weatherMode: number;
  weatherIntensity: number;
  weatherSpeed: number;
  portalOpacity: number;
  portalStyle: number;
  portalShift: number;
  sdfEnabled: boolean;
  sdfShape: number;
  sdfScale: number;
  sdfEdge: number;
  sdfGlow: number;
  sdfRotation: number;
  sdfFill: number;
  transitionAmount: number;
  transitionType: number;
  chemistryMode: number;
  motionTemplate: number;
  contrast: number;
  saturation: number;
  paletteShift: number;
  bloom: number;
  blur: number;
  chroma: number;
  feedback: number;
  kaleidoscope: number;
  posterize: number;
} | null = null;
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
let lastShaderError: string | null = null;
let visualizerMode: 'off' | 'spectrum' | 'waveform' | 'oscilloscope' = 'off';
let playlist: { name: string; path: string; duration: number; crossfade: number }[] = [];
let playlistIndex = 0;
let playlistTimer: number | null = null;
let playlistActive = false;
let playlistOverrides: Record<string, Partial<LayerConfig>> = {};
let fpsTracker = { fpsAccumulatorMs: 0, frameCount: 0 };

const triggerPlaylistSlot = async (index: number) => {
  const scenes = currentProject.scenes;
  if (index < 0 || index >= scenes.length) return;
  playlistIndex = index;
  const scene = scenes[index];

  // applyScene handles transitions via sceneRuntime
  applyScene(scene.id);
  // Carry live layer tweaks (recorded via recordPlaylistOverride while the
  // playlist is running) into the newly-activated scene. The preset-based
  // PlaylistManager path applies these in applyPresetPath; the legacy
  // timer/manual path only swaps activeSceneId, so without this every live
  // tweak was silently dropped on each slot change. No-op when the playlist
  // isn't active (applyPlaylistOverrides early-returns).
  applyPlaylistOverrides(currentProject);
  renderLayerList();
  syncPerformanceToggles();
  setStatus(`Playlist: ${scene.name}`);
  renderPlaylist();
};

// ============================================================================
// PlaylistManager Integration
// ============================================================================

let playlistManagerInitialized = false;

const initPlaylistManager = () => {
  if (playlistManagerInitialized) return;
  playlistManagerInitialized = true;

  // Set up preset loader callback
  playlistManager.setPresetLoader(async (path, name, crossfadeSeconds) => {
    const presetName = name || path;
    setStatus(`Sequencing: ${presetName}...`);

    if (crossfadeSeconds > 0) {
      await crossfadeToPreset(path, presetName, crossfadeSeconds);
    } else {
      await applyPresetPath(path, 'Playlist');
    }
  });

  // Set up macro trigger callback
  playlistManager.setMacroTrigger((macroId) => {
    // Trigger scene macros (DROP, BUILD, BREAKDOWN, TRANSITION)
    if (window.renderGraph) {
      window.renderGraph.triggerMacro(macroId);
    }
    console.log('[PlaylistManager] Triggered macro:', macroId);
  });

  // Subscribe to playlist events
  playlistManager.on((event: PlaylistEvent) => {
    switch (event.type) {
      case 'playlist-started':
        playlistActive = true;
        playlistOverrides = {};
        renderPlaylist();
        setStatus('Playlist started');
        break;

      case 'playlist-stopped':
        playlistActive = false;
        playlistOverrides = {};
        renderPlaylist();
        setStatus('Playlist stopped');
        break;

      case 'slot-changed':
        if (event.slotIndex !== undefined) {
          playlistIndex = event.slotIndex;
          renderPlaylist();
        }
        break;

      case 'condition-waiting':
        if (event.slot) {
          setStatus(`Waiting for: ${event.slot.advanceCondition}`);
        }
        break;

      case 'cue-point-reached':
        if (event.cuePoint) {
          setStatus(`Cue: ${event.cuePoint.name}`);
        }
        break;

      case 'playlist-completed':
        playlistActive = false;
        renderPlaylist();
        setStatus('Playlist completed');
        break;
    }
  });

  // Import existing legacy playlist if available
  if (playlist.length > 0) {
    playlistManager.importLegacyPlaylist(playlist);
  }

  console.log('[PlaylistManager] Initialized');
};

// Connect BPM updates to playlist manager (call this from BPM detection)
const updatePlaylistBpm = (bpm: number) => {
  playlistManager.setBpm(bpm);
};

// Connect energy updates to playlist manager (call this from audio analysis)
const updatePlaylistEnergy = (energy: number) => {
  playlistManager.setEnergy(energy);
};

// Connect beat drop detection to playlist manager
const markPlaylistBeatDrop = () => {
  playlistManager.markBeatDrop();
};

let presetLibrary: PresetIndexEntry[] = [];
let filteredPresetLibrary: PresetIndexEntry[] = [];
let selectedPresetPath = '';
let presetCategoryFilter = 'All';
let currentPresetPage = 0;
const PRESET_PAGE_SIZE = 10;
let presetQuickFilter = 'all';
const presetThumbStorageKey = 'vs.preset.thumbs';
let presetThumbs: Record<string, string> = {};
const presetFavoritesStorageKey = 'vs.preset.favorites';
const presetRecentsStorageKey = 'vs.preset.recents';
let presetFavorites: string[] = [];
let presetRecents: string[] = [];
let presetPreviewBaseProject: VisualSynthProject | null = null;
let presetPreviewPath: string | null = null;
let preservePresetPreviewState = false;
let lastOutputRenderState: RenderState | null = null;
const shaderDraftKey = 'vs.shader.draft';
const shaderTargetDraftValue = 'layer-plasma';
const shaderTargetAssetPrefix = 'asset:';
let runtimeShaderOverride: string | null = null;
let currentTransitionAmount = 0;
let currentTransitionType = 0; // 0: none, 1: fade, 2: warp, 3: glitch
let currentTransitionDecay = 0.002;
let currentMotionTemplate = 0; // linear default

const audioState = {
  rms: 0,
  peak: 0,
  bands: new Float32Array(8),
  spectrum: new Float32Array(64),
  waveform: new Float32Array(256),
  bass: 0,
  mid: 0,
  treb: 0,
  bassAtt: 0,
  midAtt: 0,
  trebAtt: 0,
  energyLow: 0,
  energyMid: 0,
  energyHigh: 0
};

// Bridge between index.ts global variables and the AudioEngine's expectation of a Store.
// This allows AudioEngine to update audioState, bpm, and runtime variables directly.
const audioStoreBridge: Store = {
  getState: () => ({
    audio: audioState,
    project: currentProject,
    bpm: {
      source: bpmSource,
      range: bpmRange,
      autoBpm,
      networkBpm,
      networkActive: bpmNetworkActive,
      manualBpm: Number(tempoInput?.value ?? 120),
      // Live beat-detection config sourced from the UI-controlled module
      // variables. Without these the AudioEngine always fell back to defaults
      // and the beat-sensitivity / filter / hold-off sliders had no effect.
      sensitivity: beatSensitivity,
      filterRange: beatFilterRange,
      holdOffMs: beatHoldOffMs
    },
    runtime: {
      strobeIntensity,
      strobeDecay,
      glyphBeatPulse,
      glyphMode,
      glyphSeed,
      crystalMode,
      crystalBrittleness,
      inkBrush,
      inkPressure,
      inkLifespan,
      topoQuake,
      topoSlide,
      topoPlate,
      topoTravel,
      weatherMode,
      weatherIntensity,
      portalShift,
      portalSeed,
      oscilloMode,
      oscilloFreeze,
      oscilloRotate,
      // Persisted across analysis frames so the engine's beat hold-off works;
      // previously this was absent so lastBeatTime read as 0 every frame and
      // every onset was accepted.
      lastBeatTime
    },
    modulators: { 
      lfoPhases: [], 
      envStates: [], 
      shStates: [] 
    },
    // Minimal mock for other required fields
    projectPath: null,
    outputConfig,
    outputOpen,
    uiMode: activeMode,
    transport: { isPlaying, timeMs: transportTimeMs },
    midi: { lastLatencyMs: lastMidiLatencyMs },
    pad: { states: [], activeBank: 0, activeMapBank: 0 },
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
    safeMode: { reasons: safeModeReasons, webglInitError: null },
    debug: { enabled: false, tintLayers: false, fxDelta: false },
    performanceMode: false,
    quantizeHudMessage: null,
    pendingSceneSwitch: null,
    renderSettings: {
      assetLayerBlendModes: { 'layer-plasma': 3, 'layer-spectrum': 1, 'layer-media': 3 },
      assetLayerAudioReact: { 'layer-plasma': 0.6, 'layer-spectrum': 0.8, 'layer-media': 0.5 }
    }
  } as any),
  update: (updater: (state: any) => void) => {
    const state = audioStoreBridge.getState();
    updater(state);
    // Sync back critical values that AudioEngine might update
    if (state.bpm.autoBpm !== undefined) autoBpm = state.bpm.autoBpm;
    if (state.runtime.glyphBeatPulse !== undefined) glyphBeatPulse = state.runtime.glyphBeatPulse;
    if (state.runtime.lastBeatTime !== undefined) lastBeatTime = state.runtime.lastBeatTime;
    if (state.safeMode.reasons !== undefined) safeModeReasons = [...state.safeMode.reasons];
  },
  setState: (patch: any) => {
    if (patch.bpm?.autoBpm !== undefined) autoBpm = patch.bpm.autoBpm;
  },
  subscribe: () => () => {}
};

// Initialize audio engine instance
createAudioEngine(audioStoreBridge);

let audioEngineWarningLogged = false;
let audioEngineFailed = false;
const getAudioEngineSafe = () => {
  const engine = getAudioEngine();
  if (!engine && !audioEngineWarningLogged && !audioEngineFailed) {
    // Should not happen as bootstrap should have run
    console.warn('[Now Playing] Audio engine not initialized yet.');
    audioEngineWarningLogged = true;
  } else if (engine) {
    audioEngineWarningLogged = false;
  }
  return engine;
};

const nowPlayingSettings = { ...DEFAULT_NOW_PLAYING_SETTINGS };
let nowPlayingLookupInFlight = false;
let lastNowPlayingLookupAt = 0;
let nowPlayingMetadataPollInFlight = false;
let lastMetadataTrackKey: string | null = null;
let lastMetadataTrackAt = 0;
let lastMetadataPollAt = 0;
let tapTempoTimes: number[] = [];

// Handle Shazam file decode requests from main process
(window as any).visualSynth?.onShazamDecodeFile?.(async (data: { requestId: string; fileBase64: string; mimeType: string; seekSeconds: number; durationSeconds: number }) => {
  try {
    const { requestId, fileBase64, seekSeconds, durationSeconds } = data;
    
    // Decode base64 to ArrayBuffer
    const binaryString = atob(fileBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Create blob and decode using Web Audio API
    const blob = new Blob([bytes.buffer], { type: data.mimeType });
    const arrayBuffer = await blob.arrayBuffer();
    
    // Decode audio data
    const audioContext = new OfflineAudioContext(1, 1, 16000);
    let decoded: AudioBuffer;
    try {
      decoded = await audioContext.decodeAudioData(arrayBuffer);
    } catch {
      (window as any).visualSynth?.sendShazamDecodeResult?.(requestId, { pcmBase64: null, error: 'Failed to decode audio file' });
      return;
    }
    
    // Calculate seek position in samples
    const originalSampleRate = decoded.sampleRate;
    const targetSampleRate = 16000;
    const seekSamples = Math.floor(seekSeconds * originalSampleRate);
    const captureSamples = Math.floor(durationSeconds * originalSampleRate);
    
    // Get audio data, potentially seeking into the file
    const channelData = decoded.numberOfChannels > 1 
      ? mixToMonoBuffer(decoded) 
      : decoded.getChannelData(0);
    
    // Extract section starting from seek position
    const startIdx = Math.min(seekSamples, channelData.length - captureSamples);
    const endIdx = Math.min(startIdx + captureSamples, channelData.length);
    const sectionLength = endIdx - startIdx;
    
    // Resample to 16kHz mono
    const resampleRatio = originalSampleRate / targetSampleRate;
    const numOutputSamples = Math.floor(sectionLength / resampleRatio);
    const offlineCtx = new OfflineAudioContext(1, numOutputSamples, targetSampleRate);
    const srcNode = offlineCtx.createBufferSource();
    
    // Create a new buffer with just the section we want
    const sectionBuffer = offlineCtx.createBuffer(1, sectionLength, originalSampleRate);
    sectionBuffer.copyToChannel(channelData.slice(startIdx, endIdx), 0);
    srcNode.buffer = sectionBuffer;
    srcNode.connect(offlineCtx.destination);
    srcNode.start(0);
    
    const resampled = await offlineCtx.startRendering();
    const f32 = resampled.getChannelData(0);
    
    // Convert Float32 to Int16 PCM
    const s16 = new Int16Array(f32.length);
    for (let i = 0; i < f32.length; i++) {
      const clamped = Math.max(-1, Math.min(1, f32[i]));
      s16[i] = Math.round(clamped * 32767);
    }
    
    // Encode to base64
    const rawCopy = new Uint8Array(s16.buffer, s16.byteOffset, s16.byteLength);
    let binary = '';
    for (let i = 0; i < rawCopy.length; i++) {
      binary += String.fromCharCode(rawCopy[i]);
    }
    const pcmBase64 = btoa(binary);
    
    (window as any).visualSynth?.sendShazamDecodeResult?.(requestId, { pcmBase64 });
  } catch (error) {
    const requestId = (data as any).requestId;
    (window as any).visualSynth?.sendShazamDecodeResult?.(requestId, { 
      pcmBase64: null, 
      error: (error as Error).message 
    });
  }
});

// Helper to mix stereo/multichannel to mono
const mixToMonoBuffer = (buffer: AudioBuffer): Float32Array => {
  const numChannels = buffer.numberOfChannels;
  const length = buffer.length;
  const mono = new Float32Array(length);
  for (let c = 0; c < numChannels; c++) {
    const channel = buffer.getChannelData(c);
    for (let i = 0; i < length; i++) {
      mono[i] += channel[i] / numChannels;
    }
  }
  return mono;
};

// AudD file decode handler - extracts a clip from longer files
(window as any).visualSynth?.onAuddDecodeFile?.(async (data: { requestId: string; fileBase64: string; mimeType: string; seekSeconds: number; durationSeconds: number }) => {
  // Declare audioCtx outside the try so any later step throwing (after a
  // successful decodeAudioData) still gets cleaned up. Previously audioCtx was
  // block-scoped inside the try and the outer catch couldn't close it, leaking
  // an AudioContext (and its audio-hardware handle) on every post-decode failure.
  let audioCtx: AudioContext | null = null;
  try {
    const { requestId, fileBase64, seekSeconds, durationSeconds } = data;

    // Decode base64 to ArrayBuffer
    const binaryString = atob(fileBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Create blob and decode
    const blob = new Blob([bytes.buffer], { type: data.mimeType });
    const arrayBuffer = await blob.arrayBuffer();

    // Decode audio data
    audioCtx = new AudioContext();
    let decoded: AudioBuffer;
    try {
      decoded = await audioCtx.decodeAudioData(arrayBuffer);
    } catch {
      (window as any).visualSynth?.sendAuddDecodeResult?.(requestId, { base64: null, mimeType: '', durationMs: 0, error: 'Failed to decode audio file' });
      return;
    }

    // Calculate seek position
    const originalSampleRate = decoded.sampleRate;
    const seekSamples = Math.floor(seekSeconds * originalSampleRate);
    const captureSamples = Math.floor(durationSeconds * originalSampleRate);

    // Get channel data (mix to mono if multi-channel)
    const channelData = decoded.numberOfChannels > 1
      ? mixToMonoBuffer(decoded)
      : decoded.getChannelData(0);

    // Extract section
    const startIdx = Math.min(seekSamples, channelData.length - captureSamples);
    const endIdx = Math.min(startIdx + captureSamples, channelData.length);
    const actualDurationMs = Math.round(((endIdx - startIdx) / originalSampleRate) * 1000);

    // Create a new blob with just the clip
    // Re-encode to original format by creating a new AudioBuffer and exporting
    const clipBuffer = audioCtx.createBuffer(1, endIdx - startIdx, originalSampleRate);
    clipBuffer.copyToChannel(channelData.slice(startIdx, endIdx), 0);

    // Convert to WAV for reliable re-encoding
    const wavBlob = audioBufferToWavBlob(clipBuffer);

    // Convert blob to base64
    const wavArrayBuffer = await wavBlob.arrayBuffer();
    const wavBytes = new Uint8Array(wavArrayBuffer);
    let binary = '';
    for (let i = 0; i < wavBytes.length; i++) {
      binary += String.fromCharCode(wavBytes[i]);
    }
    const base64 = btoa(binary);

    (window as any).visualSynth?.sendAuddDecodeResult?.(requestId, {
      base64,
      mimeType: 'audio/wav',
      durationMs: actualDurationMs
    });
  } catch (error) {
    const requestId = (data as any).requestId;
    (window as any).visualSynth?.sendAuddDecodeResult?.(requestId, {
      base64: null,
      mimeType: '',
      durationMs: 0,
      error: (error as Error).message
    });
  } finally {
    if (audioCtx) {
      try { await audioCtx.close(); } catch { /* already closing/failed */ }
    }
  }
});

/**
 * Converts an AudioBuffer to a WAV blob for reliable re-encoding.
 */
function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataLength = buffer.length * blockAlign;
  const headerLength = 44;
  const totalLength = headerLength + dataLength;

  const arrayBuffer = new ArrayBuffer(totalLength);
  const view = new DataView(arrayBuffer);

  // WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, totalLength - 8, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  // Write interleaved audio data
  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }

  let offset = headerLength;
  for (let i = 0; i < buffer.length; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += bytesPerSample;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

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

const shapeBurstSlots = Array.from({ length: 8 }, () => ({
  active: false,
  spawnTime: 0
}));
const shapeBurstSpawnTimes = new Float32Array(8);
const shapeBurstActives = new Float32Array(8);

const resetTransientVisualState = () => {
  strobeIntensity = 0;
  origamiFoldState = 0;
  origamiFoldSharpness = 0.65;
  gravityGlobalPolarity = 1;
  gravityCollapse = 0;
  lastGravityIndex = -1;
  portalShift = 0;
  portalSeed = Math.random() * 1000;
  lastPortalAutoSpawn = 0;
  currentTransitionAmount = 0;
  currentTransitionType = 0;
  trailSpectrum = new Float32Array(64);

  gravityWells.forEach((well) => {
    well.x = 0;
    well.y = 0;
    well.baseX = 0;
    well.baseY = 0;
    well.strength = 0;
    well.polarity = 1;
    well.active = false;
  });
  gravityPositions.fill(0);
  gravityStrengths.fill(0);
  gravityPolarities.fill(0);
  gravityActives.fill(0);

  portals.forEach((portal) => {
    portal.x = 0;
    portal.y = 0;
    portal.radius = 0.2;
    portal.active = false;
  });
  portalPositions.fill(0);
  portalRadii.fill(0);
  portalActives.fill(0);

  mediaBursts.forEach((burst) => {
    burst.x = 0;
    burst.y = 0;
    burst.radius = 0;
    burst.life = 0;
    burst.type = 0;
    burst.active = false;
  });
  mediaBurstPositions.fill(0);
  mediaBurstRadii.fill(0);
  mediaBurstTypes.fill(0);
  mediaBurstActives.fill(0);

  shapeBurstSlots.forEach((burst) => {
    burst.active = false;
    burst.spawnTime = 0;
  });
  shapeBurstSpawnTimes.fill(0);
  shapeBurstActives.fill(0);
};
let shapeBurstSlotIndex = 0;
let lastShapeBurstSpawn = 0;

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
  'macro-8',
  'toggle-lightning',
  'toggle-analog-oscillo',
  'toggle-speaker-cone',
  'toggle-glitch-scanline',
  'toggle-laser-starfield',
  'toggle-pulsing-ribbons',
  'toggle-electric-arc',
  'toggle-pyro-burst',
  'toggle-geo-wireframe',
  'toggle-signal-noise',
  'toggle-infinite-wormhole',
  'toggle-ribbon-tunnel',
  'toggle-fractal-tunnel',
  'toggle-circuit-conduit',
  'toggle-aura-portal',
  'toggle-freq-terrain',
  'toggle-data-stream',
  'toggle-caustic-liquid',
  'toggle-shimmer-veil'
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
  'macro-8': 'Macro 8',
  'toggle-lightning': 'Lightning',
  'toggle-analog-oscillo': 'Analog Oscillo',
  'toggle-speaker-cone': 'Speaker Cone',
  'toggle-glitch-scanline': 'Glitch Scanline',
  'toggle-laser-starfield': 'Laser Starfield',
  'toggle-pulsing-ribbons': 'Pulsing Ribbons',
  'toggle-electric-arc': 'Electric Arc',
  'toggle-pyro-burst': 'Pyro Burst',
  'toggle-geo-wireframe': 'Geo Wireframe',
  'toggle-signal-noise': 'Signal Noise',
  'toggle-infinite-wormhole': 'Infinite Wormhole',
  'toggle-ribbon-tunnel': 'Ribbon Tunnel',
  'toggle-fractal-tunnel': 'Fractal Tunnel',
  'toggle-circuit-conduit': 'Circuit Conduit',
  'toggle-aura-portal': 'Aura Portal',
  'toggle-freq-terrain': 'Freq Terrain',
  'toggle-data-stream': 'Data Stream',
  'toggle-caustic-liquid': 'Caustic Liquid',
  'toggle-shimmer-veil': 'Shimmer Veil'
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

const applyVisualEngine = (engineId: EngineId) => {
  const engine = ENGINE_REGISTRY[engineId];
  if (!engine) return;

  currentProject.activeEngineId = engineId;
  setStatus(`Visual Engine applied: ${engine.name}`);
  if (engineDescription) {
      engineDescription.textContent = engine.description;
  }

  if (engineId === 'engine-none') {
    (currentProject as any).engineGrammar = {};
    (currentProject as any).engineFinish = { grain: 0, vignette: 0, ca: 0 };
    
    // Reset core FX systems to defaults
    currentProject.effects = JSON.parse(JSON.stringify(DEFAULT_PROJECT.effects));
    currentProject.macros = JSON.parse(JSON.stringify(DEFAULT_PROJECT.macros));
    currentProject.modMatrix = [];
    currentProject.expressiveFx = JSON.parse(JSON.stringify(DEFAULT_PROJECT.expressiveFx));
    currentProject.particles = JSON.parse(JSON.stringify(DEFAULT_PROJECT.particles));
    
    // Reset palette to default if it was changed by a previous engine
    currentProject.activePaletteId = DEFAULT_PROJECT.activePaletteId;
    if (paletteSelect) paletteSelect.value = DEFAULT_PROJECT.activePaletteId;

    initMacros();
    initEffects();
    initParticles();
    renderLayerList();
    renderModMatrix();
    renderSceneStrip();
    return;
  }

  // Set Engine Motion Template
  const templates = ['linear', 'radial', 'vortex', 'fractal', 'grid', 'organic', 'data', 'strobe', 'vapor'];
  currentMotionTemplate = templates.indexOf(engine.constraints.preferredMotion) || 0;

  // Apply Engine Grammar
  (currentProject as any).engineGrammar = engine.grammar;
  (currentProject as any).engineFinish = engine.finish;

  // 1. NON-DESTRUCTIVE: Update active scene to use engine base layers ONLY if it's currently empty or specifically requested?
  // User said "once i change the visual engine option, it appears i cant select a scene anymore"
  // This was because we were doing currentProject.scenes = [firstScene] which deleted all others.
  // We will stop doing that. We only update the active engine ID and engine-level constraints.

  // 2. Set Curated Palette
  applyPaletteSelection(engine.curatedPalette.id);
  if (paletteSelect) paletteSelect.value = engine.curatedPalette.id;

  // 3. Re-map Macros (Engine strictly defines 5-7 macros)
  currentProject.macros = engine.macros.map((m, i) => ({
    id: `macro-${i + 1}`,
    name: m.name,
    value: m.defaultValue,
    targets: [
      { target: m.target, amount: 1.0 }
    ]
  }));

  // Update Hero Macro Labels in UI
  const heroLabels = document.querySelectorAll('.macro-hero-label');
  engine.macros.forEach((m, i) => {
      if (heroLabels[i]) heroLabels[i].textContent = m.name;
  });
  
  // Fill remaining to 8 with empty
  for (let i = engine.macros.length; i < 8; i++) {
    currentProject.macros.push({
      id: `macro-${i + 1}`,
      name: `Macro ${i + 1}`,
      value: 0.5,
      targets: []
    });
  }

  // 4. Reset Mod Matrix for Engine scope
  currentProject.modMatrix = [];

  initMacros();
  renderLayerList();
  renderModMatrix();
  renderSceneStrip(); // Ensure UI reflects preserved scenes
};

const applyVisualMode = (
  modeId: string,
  options?: {
    preservePalette?: boolean;
    preserveEffects?: boolean;
    preserveModMatrix?: boolean;
    preserveMotionMacro?: boolean;
  }
) => {
  const mode = VISUAL_MODES.find(m => m.id === modeId);
  if (!mode) return;

  // Trigger Transition Effect
  const tMap: Record<string, number> = { fade: 1, crossfade: 1, warp: 2, glitch: 3, dissolve: 4 };
  currentTransitionType = tMap[mode.transition.type || 'fade'] || 1;
  currentTransitionAmount = 1.0;
  currentTransitionDecay = 1.0 / (mode.transition.durationMs || 600);

  currentProject.activeModeId = modeId;
  setStatus(`Visual Mode applied: ${mode.name}`);
  
  // 1. Apply Palette
  if (!options?.preservePalette) {
    const activeScene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (!activeScene?.look?.activePaletteId) {
      // Only apply mode palette if scene doesn't have a custom palette
      applyPaletteSelection(mode.palette.id);
      paletteSelect.value = mode.palette.id;
    }
  }

  // 2. Apply Audio Mappings (Mod Matrix)
  // We'll append these or replace them? User said "grouped into high-level expressions"
  // Let's replace the mod matrix for a clean "expression"
  if (!options?.preserveModMatrix) {
    // Replace only the connections previously injected by a Visual Mode
    // (id prefix 'mod-mode-'), preserving user-created mod connections. The
    // old behavior replaced the entire mod matrix on every mode switch,
    // silently wiping any connections the user had hand-configured. Built as a
    // single assignment so the object literals stay contextually typed as
    // ModConnection (curve: 'linear' must not widen to string).
    currentProject.modMatrix = [
      ...currentProject.modMatrix.filter((c) => c.id?.startsWith('mod-mode-') !== true),
      ...mode.audioMappings.map((mapping, index): ModConnection => {
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
      })
    ];
    renderModMatrix();
  }

  // 3. Apply Glow/Depth (Effects)
  if (!options?.preserveEffects) {
    currentProject.effects.bloom = mode.glowDepth.glow;
    // We'll use 'blur' as a proxy for depth for now if not available
    currentProject.effects.blur = mode.glowDepth.depth * 0.2; 
    initEffects();
  }

  // 4. Intensity Envelopes
  if (currentProject.envelopes[0]) {
    currentProject.envelopes[0].attack = mode.intensityEnvelopes.attack;
    currentProject.envelopes[0].release = mode.intensityEnvelopes.release;
    renderEnvelopeList();
  }

  // 5. Motion Template (Set macro targets for motion)
  // We'll map motionTemplate to macro-2 (Motion)
  if (!options?.preserveMotionMacro) {
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
  updateOverlayPointerEvents();
  modeButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.mode === mode);
  });
  performanceLeft.classList.toggle('hidden', !visibility.performance);
  performanceRight.classList.toggle('hidden', !visibility.performance);
  sceneLeft.classList.toggle('hidden', !visibility.scene);
  sceneRight.classList.toggle('hidden', !visibility.scene);
  mixerLeft.classList.toggle('hidden', !visibility.mixer);
  mixerRight.classList.toggle('hidden', !visibility.mixer);
  mappingRight.classList.toggle('hidden', !visibility.mapping);
  
  // Progressive Disclosure: Hide internal complexity unless in Design/System
  const advancedControls = document.querySelectorAll('.advanced-only');
  advancedControls.forEach(el => {
      (el as HTMLElement).classList.toggle('hidden', mode !== 'scene' && mode !== 'design');
  });

  mappingLeft.classList.toggle('hidden', !visibility.mapping);
  mappingCenter.classList.toggle('hidden', !visibility.mapping);
  if (visibility.mapping) {
    renderMappingTargets(mappingTargetSearch?.value ?? '');
    if (mappingCenter) mappingCenter.scrollTop = 0;
    if (centerPanel) centerPanel.scrollTop = 0;
  }
  designLeft.classList.toggle('hidden', !visibility.design);
  designRight.classList.toggle('hidden', !visibility.design);
  systemLeft.classList.toggle('hidden', !visibility.system);
  systemRight.classList.toggle('hidden', !visibility.system);
  liveLeft.classList.toggle('hidden', !visibility.live);
  liveRight.classList.toggle('hidden', !visibility.live);
  presetExplorer?.classList.toggle('hidden', mode !== 'performance');
  macroHero?.classList.toggle('hidden', mode === 'design' || mode === 'mapping' || mode === 'system' || mode === 'live');
  matrixControls?.classList.toggle('hidden', mode !== 'mapping');
  if (visualPreview && mappingPreviewHost && centerPanel && visualPreviewParent) {
    if (mode === 'mapping') {
      if (visualPreview.parentElement !== mappingPreviewHost) {
        mappingPreviewHost.appendChild(visualPreview);
      }
    } else if (visualPreview.parentElement !== visualPreviewParent) {
      if (visualPreviewNextSibling) {
        visualPreviewParent.insertBefore(visualPreview, visualPreviewNextSibling);
      } else {
        visualPreviewParent.appendChild(visualPreview);
      }
    }
  }
  if (mode === 'mixer') {
    mixerPanel?.render();
  }
  if (mode === 'mapping') {
    renderMappingSources();
  }
  if (mode === 'live') {
    renderLivePadGrid();
    renderLivePaletteGrid();
    renderLiveFxToggles();
    renderLivePlaylistList();
    syncLiveMacrosFromProject();
  }
};

const syncTempoInputs = (value: number) => {
  const normalized = Number.isFinite(value) ? value : 120;
  const prevBpm = Number(tempoInput.value) || 120;
  tempoInput.value = String(normalized);
  if (bpmSource === 'manual') {
    transportBpmInput.value = String(normalized);
  }
  sessionLog.log('info', 'audio.bpm_changed', { bpm: normalized, source: bpmSource, prevBpm });
};

const updateBpmSourceUI = () => {
  const isManual = bpmSource === 'manual';
  manualBpmRow.classList.toggle('hidden', !isManual);
  transportBpmInput.readOnly = !isManual;
  transportBpmInput.disabled = false;
  transportTap.classList.toggle('hidden', !isManual);
  if (!isManual) {
    const liveBpm = bpmSource === 'network' ? networkBpm : autoBpm;
    transportBpmInput.value = liveBpm ? liveBpm.toFixed(1) : '';
  } else {
    transportBpmInput.value = tempoInput.value;
  }
};

const loadPlaylist = () => {
  try {
    const stored = localStorage.getItem('vs.preset.playlist');
    playlist = stored ? (JSON.parse(stored) as { name: string; path: string; duration?: number; crossfade?: number }[]).map((item) => ({ duration: 0, crossfade: 0, ...item })) : [];
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

const loadPresetPreferences = () => {
  try {
    const favorites = localStorage.getItem(presetFavoritesStorageKey);
    presetFavorites = favorites ? (JSON.parse(favorites) as string[]) : [];
  } catch {
    presetFavorites = [];
  }
  try {
    const recents = localStorage.getItem(presetRecentsStorageKey);
    presetRecents = recents ? (JSON.parse(recents) as string[]) : [];
  } catch {
    presetRecents = [];
  }
};

const savePresetPreferences = () => {
  localStorage.setItem(presetFavoritesStorageKey, JSON.stringify(presetFavorites));
  localStorage.setItem(presetRecentsStorageKey, JSON.stringify(presetRecents));
};

const markPresetRecent = (path: string) => {
  if (!path) return;
  presetRecents = [path, ...presetRecents.filter((entry) => entry !== path)].slice(0, 24);
  savePresetPreferences();
};

const togglePresetFavorite = (path: string) => {
  if (!path) return false;
  const isFavorite = presetFavorites.includes(path);
  presetFavorites = isFavorite
    ? presetFavorites.filter((entry) => entry !== path)
    : [path, ...presetFavorites];
  savePresetPreferences();
  return !isFavorite;
};

const hashPreset = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const presetQuickFilterDefs: Array<{ id: string; label: string; match: (preset: PresetIndexEntry) => boolean }> = [
  { id: 'all', label: 'All', match: () => true },
  { id: 'favorites', label: 'Favorites', match: (preset) => presetFavorites.includes(preset.path) },
  { id: 'recent', label: 'Recent', match: (preset) => presetRecents.includes(preset.path) },
  { id: 'safe', label: 'Safe', match: (preset) => !preset.riskFlags.includes('flash-heavy') && !preset.riskFlags.includes('cpu-heavy') },
  { id: 'audio', label: 'Audio', match: (preset) => preset.sourceDependency === 'audio-reactive' || preset.sourceDependency === 'hybrid' },
  { id: 'no-media', label: 'No Media', match: (preset) => preset.sourceDependency === 'none' || preset.sourceDependency === 'audio-reactive' },
  { id: 'high-energy', label: 'High Energy', match: (preset) => preset.energy === 'high' || preset.energy === 'peak' },
  { id: 'transitions', label: 'Transitions', match: (preset) => preset.primaryCategory === 'Transitions' || preset.useCases.includes('bridge') }
];

const getPresetGradient = (preset: PresetIndexEntry) => {
  const hue = hashPreset(preset.name) % 360;
  return `linear-gradient(135deg, hsl(${hue},70%,45%), hsl(${(hue + 60) % 360},70%,35%))`;
};

const updateSelectedPreset = (path: string, reason = 'Selected') => {
  const preset = presetLibrary.find((entry) => entry.path === path);
  if (!preset) return;
  selectedPresetPath = path;
  presetSelect.value = path;
  presetBrowser.querySelectorAll<HTMLElement>('.preset-card').forEach((el) => {
    el.classList.toggle('selected', el.dataset.presetPath === path);
  });
  renderPresetPreview();
  setStatus(`${reason}: ${preset.name}`);
};

const previewPresetSelection = (path: string, reason = 'Selected') => {
  const preset = presetLibrary.find((entry) => entry.path === path);
  if (!preset) return;
  clearPresetPreviewState();
  updateSelectedPreset(path, reason);
  renderPresetPreview();
};

const clearPresetPreviewState = () => {
  presetPreviewBaseProject = null;
  presetPreviewPath = null;
};

const getSortedPresetEntries = (entries: PresetIndexEntry[]) =>
  [...entries].sort((a, b) => {
    const favoriteDiff = Number(presetFavorites.includes(b.path)) - Number(presetFavorites.includes(a.path));
    if (favoriteDiff !== 0) return favoriteDiff;
    const recentDiff = (presetRecents.indexOf(a.path) === -1 ? 999 : presetRecents.indexOf(a.path))
      - (presetRecents.indexOf(b.path) === -1 ? 999 : presetRecents.indexOf(b.path));
    if (recentDiff !== 0) return recentDiff;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });

const getFilteredPresetEntries = () => {
  const search = presetSearchInput.value.trim().toLowerCase();
  const quickFilter = presetQuickFilterDefs.find((entry) => entry.id === presetQuickFilter) ?? presetQuickFilterDefs[0];
  const restrictToSafe = currentProject.performanceMode?.enabled && currentProject.performanceMode?.restrictToSafePresets;

  return getSortedPresetEntries(
    presetLibrary.filter((preset) => {
      if (restrictToSafe && preset.certification !== 'safe') return false;
      if (presetCategoryFilter !== 'All' && preset.primaryCategory !== presetCategoryFilter) return false;
      if (!quickFilter.match(preset)) return false;
      if (!search) return true;
      return preset.searchText.includes(search) || preset.name.toLowerCase().includes(search);
    })
  );
};

const renderPresetQuickFilters = () => {
  presetQuickFilters.innerHTML = '';
  presetQuickFilterDefs.forEach((filter) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `preset-filter-chip${filter.id === presetQuickFilter ? ' active' : ''}`;
    button.textContent = filter.label;
    button.addEventListener('click', () => {
      presetQuickFilter = filter.id;
      renderPresetQuickFilters();
      renderPresetBrowser(true);
      renderPresetPreview();
    });
    presetQuickFilters.appendChild(button);
  });
};

const refreshPresetCategories = () => {
  const categories = ['All', ...Array.from(new Set(presetLibrary.map((item) => item.primaryCategory))).sort()];
  presetCategorySelect.innerHTML = '';
  categories.forEach((category) => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    presetCategorySelect.appendChild(option);
  });
  presetCategorySelect.value = categories.includes(presetCategoryFilter) ? presetCategoryFilter : 'All';
};

const truncateMiddle = (text: string, maxLen = 42): string => {
  if (text.length <= maxLen) return text;
  const tail = Math.floor((maxLen - 1) / 3);
  const head = maxLen - 1 - tail;
  return text.slice(0, head) + '…' + text.slice(text.length - tail);
};

const buildPresetCard = (preset: PresetIndexEntry): HTMLElement => {
  const card = document.createElement('div');
  const selected = preset.path === selectedPresetPath;
  card.className = `preset-card${selected ? ' selected' : ''}`;
  card.dataset.presetPath = preset.path;
  const thumb = document.createElement('div');
  thumb.className = 'preset-thumb';
  const cachedThumb = presetThumbs[preset.path];
  if (cachedThumb) {
    thumb.style.backgroundImage = `url('${cachedThumb}')`;
  } else {
    thumb.style.background = getPresetGradient(preset);
  }
  const summary = document.createElement('div');
  summary.className = 'preset-summary';
  const name = document.createElement('div');
  name.className = 'preset-name';
  name.textContent = truncateMiddle(preset.name);
  if (preset.name.length > 42) name.title = preset.name;
  const meta = document.createElement('div');
  meta.className = 'preset-meta-line';
  meta.textContent = `${preset.primaryCategory} · ${preset.energy} energy · ${preset.motion}`;
  const tags = document.createElement('div');
  tags.className = 'preset-tags';
  
  if (preset.certification) {
    const certTag = document.createElement('div');
    certTag.className = 'preset-tag certification-tag';
    certTag.textContent = preset.certification;
    certTag.style.border = `1px solid ${getCertificationColor(preset.certification)}`;
    tags.appendChild(certTag);
  }

  [preset.primaryCategory, ...preset.visualFamilies.slice(0, 2), ...preset.riskFlags.slice(0, 1)].forEach((tagText) => {
    const tag = document.createElement('div');
    tag.className = 'preset-tag';
    tag.textContent = tagText;
    tags.appendChild(tag);
  });
  const actions = document.createElement('div');
  actions.className = 'preset-card-actions';
  const addBtn = document.createElement('button');
  addBtn.className = 'preset-add-btn';
  addBtn.textContent = 'Add';
  addBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    selectedPresetPath = preset.path;
    markPresetRecent(preset.path);
    void addSceneFromPreset(preset.path);
    renderPresetQuickFilters();
    renderPresetPreview();
  });
  card.addEventListener('mouseenter', () => {
    selectedPresetPath = preset.path;
    presetSelect.value = preset.path;
    renderPresetPreview();
    setStatus(`Preview: ${preset.name} [${preset.primaryCategory}]`);
  });
  card.appendChild(thumb);
  summary.appendChild(name);
  summary.appendChild(meta);
  summary.appendChild(tags);
  actions.appendChild(addBtn);
  card.appendChild(summary);
  card.appendChild(actions);
  card.addEventListener('click', () => {
    void previewPresetSelection(preset.path);
  });
  card.addEventListener('dblclick', () => {
    void addSceneFromPreset(preset.path);
  });
  return card;
};

const renderPresetBrowser = (resetPage = false) => {
  filteredPresetLibrary = getFilteredPresetEntries();
  if (resetPage) currentPresetPage = 0;

  const total = filteredPresetLibrary.length;
  const totalPages = Math.max(1, Math.ceil(total / PRESET_PAGE_SIZE));
  currentPresetPage = Math.min(currentPresetPage, totalPages - 1);

  if (!selectedPresetPath || !filteredPresetLibrary.some((preset) => preset.path === selectedPresetPath)) {
    selectedPresetPath = filteredPresetLibrary[currentPresetPage * PRESET_PAGE_SIZE]?.path ?? '';
    presetSelect.value = selectedPresetPath;
  }

  presetResultsCount.textContent = total === 0
    ? '0 presets'
    : `${total} preset${total === 1 ? '' : 's'} · Page ${currentPresetPage + 1} of ${totalPages}`;

  presetBrowser.innerHTML = '';
  if (total === 0) {
    const empty = document.createElement('div');
    empty.className = 'matrix-empty';
    empty.textContent = 'No presets match the current search and filters.';
    presetBrowser.appendChild(empty);
  } else {
    const pageStart = currentPresetPage * PRESET_PAGE_SIZE;
    filteredPresetLibrary.slice(pageStart, pageStart + PRESET_PAGE_SIZE).forEach((preset) => {
      presetBrowser.appendChild(buildPresetCard(preset));
    });
  }

  if (presetPrevButton) presetPrevButton.disabled = currentPresetPage === 0;
  if (presetNextButton) presetNextButton.disabled = currentPresetPage >= totalPages - 1;
};

const renderPresetPreview = () => {
  const preset = presetLibrary.find((entry) => entry.path === selectedPresetPath);
  if (!preset) {
    presetPreviewName.textContent = 'No preset selected';
    presetPreviewMeta.textContent = 'Choose a preset to inspect it.';
    presetPreviewThumb.style.background = 'linear-gradient(135deg, #19304c, #101c2c)';
    presetPreviewThumb.style.backgroundImage = '';
    presetPreviewBadges.innerHTML = '';
    return;
  }
  const cachedThumb = presetThumbs[preset.path] ?? preset.thumbnail;
  presetPreviewThumb.style.background = cachedThumb ? getPresetGradient(preset) : getPresetGradient(preset);
  presetPreviewThumb.style.backgroundImage = cachedThumb ? `url('${cachedThumb}')` : '';
  presetPreviewName.textContent = preset.name;
  presetPreviewMeta.textContent =
    `${preset.primaryCategory} · ${preset.subcategory} · ${preset.energy} energy · ${preset.motion} motion · ${preset.sourceDependency}`;
  presetPreviewBadges.innerHTML = '';

  if (preset.certification) {
    const certTag = document.createElement('div');
    certTag.className = 'preset-tag certification-tag';
    certTag.textContent = preset.certification;
    certTag.style.background = getCertificationColor(preset.certification);
    certTag.style.color = '#fff';
    presetPreviewBadges.appendChild(certTag);
  }

  [
    ...preset.visualFamilies,
    ...preset.useCases,
    ...preset.riskFlags,
    preset.importedFrom ? `Imported: ${preset.importedFrom}` : ''
  ]
    .filter(Boolean)
    .slice(0, 8)
    .forEach((tagText) => {
      const tag = document.createElement('div');
      tag.className = 'preset-tag';
      tag.textContent = tagText;
      presetPreviewBadges.appendChild(tag);
    });
  if (presetPreviewPath === preset.path) {
    const tag = document.createElement('div');
    tag.className = 'preset-tag';
    tag.textContent = 'Previewing';
    presetPreviewBadges.prepend(tag);
  }
  presetFavoriteButton.innerHTML = presetFavorites.includes(preset.path)
    ? '<span class="preset-action-icon">♥</span><span>Unfavorite</span>'
    : '<span class="preset-action-icon">♥</span><span>Favorite</span>';
};

const getLivePresets = () => presetLibrary.filter(p => p.presetMode === 'live');

let livePlaylistActive = false;
let livePlaylistIndex = 0;
let livePlaylistTimer: ReturnType<typeof setTimeout> | null = null;
let activeLivePresetPath = '';

const renderLivePadGrid = () => {
  const presets = getLivePresets();
  const sortKey = liveSortSelect?.value ?? 'name';
  const sorted = [...presets].sort((a, b) => {
    if (sortKey === 'bpm') {
      const bpmA = parseInt(a.searchText.match(/(\d{2,3})\s*bpm/i)?.[1] ?? '120');
      const bpmB = parseInt(b.searchText.match(/(\d{2,3})\s*bpm/i)?.[1] ?? '120');
      return bpmA - bpmB;
    }
    if (sortKey === 'energy') {
      const energyOrder = { low: 0, medium: 1, high: 2, peak: 3 };
      return (energyOrder[a.energy] ?? 0) - (energyOrder[b.energy] ?? 0);
    }
    if (sortKey === 'pad') {
      return (a.midiPadIndex ?? 99) - (b.midiPadIndex ?? 99);
    }
    return a.name.localeCompare(b.name);
  });

  livePadGrid.innerHTML = '';
  if (sorted.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'matrix-empty';
    empty.textContent = 'No live presets found. Add presets with presetMode: "live".';
    livePadGrid.appendChild(empty);
    return;
  }

  sorted.forEach((preset) => {
    const pad = document.createElement('button');
    pad.type = 'button';
    pad.className = 'live-pad' + (preset.path === activeLivePresetPath ? ' live-pad-active' : '');
    const hue = hashPreset(preset.name) % 360;
    pad.style.setProperty('--pad-hue', String(hue));
    pad.innerHTML = `
      <span class="live-pad-name">${preset.name}</span>
      <span class="live-pad-meta">${preset.energy ?? ''}${preset.midiPadIndex !== undefined ? ' · Pad ' + preset.midiPadIndex : ''}</span>
    `;
    pad.addEventListener('click', () => triggerLivePreset(preset));
    livePadGrid.appendChild(pad);
  });
};

const triggerLivePreset = async (preset: PresetIndexEntry) => {
  sessionLog.log('info', 'live.preset_triggered', {
    presetPath: preset.path,
    presetName: preset.name,
    category: preset.category ?? '',
    traceId: '',
  });
  activeLivePresetPath = preset.path;
  renderLivePadGrid();

  if (liveActiveInfo) {
    liveActiveInfo.innerHTML = `<strong>${preset.name}</strong> · ${preset.category ?? ''}`;
  }

  await applyPresetPath(preset.path, 'Live Trigger');

  renderLivePlaylistList();
  renderLiveFxToggles();
  syncLiveMacrosFromProject();

  if (livePlaylistActive) {
    scheduleNextLivePlaylistEntry();
  }
};

const scheduleNextLivePlaylistEntry = () => {
  if (livePlaylistTimer) clearTimeout(livePlaylistTimer);
  const presets = getLivePresets();
  if (presets.length === 0) return;
  const bars = parseInt(livePlaylistDuration?.value ?? '8') || 8;
  const bpm = currentProject.tempoSync?.bpm ?? 120;
  const barMs = (60000 / bpm) * 4;
  const durationMs = bars * barMs;

  livePlaylistTimer = setTimeout(() => {
    livePlaylistIndex = (livePlaylistIndex + 1) % presets.length;
    triggerLivePreset(presets[livePlaylistIndex]);
  }, durationMs);
};

const startLivePlaylist = () => {
  livePlaylistActive = true;
  const presets = getLivePresets();
  if (presets.length === 0) {
    setStatus('No live presets to play.');
    livePlaylistActive = false;
    return;
  }
  livePlaylistIndex = 0;
  const bars = parseInt(livePlaylistDuration?.value ?? '8') || 8;
  const transitionMs = parseInt(livePlaylistTransition?.value ?? '200') || 200;
  sessionLog.log('info', 'live.playlist_started', { duration: bars, transition: transitionMs });
  triggerLivePreset(presets[0]);
  setStatus('Live playlist started.');
};

const stopLivePlaylist = () => {
  livePlaylistActive = false;
  if (livePlaylistTimer) {
    clearTimeout(livePlaylistTimer);
    livePlaylistTimer = null;
  }
  sessionLog.log('info', 'live.playlist_stopped', {});
  setStatus('Live playlist stopped.');
};

const renderLivePaletteGrid = () => {
  if (!livePaletteGrid) return;
  livePaletteGrid.innerHTML = '';
  const palettes = currentProject.palettes ?? [];
  palettes.forEach((palette) => {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'palette-swatch' + (palette.id === currentProject.activePaletteId ? ' active' : '');
    swatch.title = palette.name;
    const gradient = (palette.colors ?? []).map((c: string, i: number, arr: string[]) =>
      `${c} ${(i / Math.max(arr.length - 1, 1)) * 100}%`
    ).join(', ');
    swatch.style.background = `linear-gradient(90deg, ${gradient})`;
    swatch.addEventListener('click', async () => {
      currentProject.activePaletteId = palette.id;
      renderLivePaletteGrid();
      await applyProject(currentProject);
    });
    livePaletteGrid.appendChild(swatch);
  });
};

const renderLiveFxToggles = () => {
  if (!liveFxList) return;
  liveFxList.innerHTML = '';
  const fxKeys = ['bloom', 'blur', 'chroma', 'posterize', 'kaleidoscope', 'feedback', 'persistence'] as const;
  fxKeys.forEach((key) => {
    const val = (currentProject.effects as any)?.[key] ?? 0;
    const toggle = document.createElement('label');
    toggle.className = 'scene-inline';
    toggle.style.minWidth = '80px';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = val > 0;
    cb.addEventListener('change', () => {
      const newVal = cb.checked ? 0.3 : 0;
      (currentProject.effects as any)[key] = newVal;
      applyProject(currentProject);
    });
    const span = document.createElement('span');
    span.textContent = key.charAt(0).toUpperCase() + key.slice(1);
    toggle.appendChild(cb);
    toggle.appendChild(span);
    liveFxList.appendChild(toggle);
  });
};

const renderLivePlaylistList = () => {
  if (!livePlaylistList) return;
  livePlaylistList.innerHTML = '';
  const presets = getLivePresets();
  if (presets.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'matrix-empty';
    empty.textContent = 'No live presets available.';
    livePlaylistList.appendChild(empty);
    return;
  }
  presets.forEach((preset, index) => {
    const row = document.createElement('div');
    row.className = 'playlist-entry' + (preset.path === activeLivePresetPath ? ' playlist-entry-active' : '');
    row.innerHTML = `<span class="playlist-index">${index + 1}</span><span class="playlist-name">${preset.name}</span><span class="playlist-energy">${preset.energy}</span>`;
    row.addEventListener('click', () => {
      livePlaylistIndex = index;
      triggerLivePreset(preset);
    });
    livePlaylistList.appendChild(row);
  });
};

const syncLiveMacrosFromProject = () => {
  const macros = currentProject.macros ?? [];
  const inputs = [liveMacroEnergy, liveMacroSpeed, liveMacroColor, liveMacroDepth];
  const valueIds = ['live-macro-energy-value', 'live-macro-speed-value', 'live-macro-color-value', 'live-macro-depth-value'];
  inputs.forEach((input, i) => {
    if (!input) return;
    const v = macros[i]?.value ?? 0.5;
    input.value = String(v);
    const label = document.getElementById(valueIds[i]);
    if (label) label.textContent = v.toFixed(2);
  });
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
    // Update the matching card thumb in-place rather than rebuilding the whole list
    const card = presetBrowser.querySelector<HTMLElement>(`.preset-card[data-preset-path="${CSS.escape(path)}"]`);
    if (card) {
      const thumbEl = card.querySelector<HTMLElement>('.preset-thumb');
      if (thumbEl) thumbEl.style.backgroundImage = `url('${dataUrl}')`;
    }
    renderPresetPreview();
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
  const scenes = currentProject.scenes;
  if (scenes.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'matrix-empty';
    empty.textContent = 'No scenes in timeline.';
    playlistList.appendChild(empty);
    return;
  }
  scenes.forEach((scene, index) => {
    const row = document.createElement('div');
    const isActive = playlistIndex === index && playlistActive;
    row.className = `marker-row playlist-slot${isActive ? ' active' : ''}`;
    row.dataset.index = String(index);

    const indexLabel = document.createElement('div');
    indexLabel.className = 'slot-index';
    indexLabel.textContent = String(index + 1);

    const name = document.createElement('div');
    name.className = 'slot-name';
    name.textContent = scene.name;

    const trigger = document.createElement('button');
    trigger.className = 'slot-trigger';
    trigger.textContent = '▶';
    trigger.title = 'Activate scene';
    trigger.addEventListener('click', () => {
      // Route through triggerPlaylistSlot so playlistIndex and the active-slot
      // highlight stay in sync with the manually-activated scene. Calling
      // applyScene directly left playlistIndex pointing at the previous slot, so
      // the ▶ highlight and any later ◀▶ / auto-advance worked off the wrong
      // index.
      void triggerPlaylistSlot(index);
    });

    row.appendChild(indexLabel);
    row.appendChild(name);
    row.appendChild(trigger);
    playlistList.appendChild(row);
  });

  if (playlistActive && scenes.length > 2) {
    const activeRow = playlistList.querySelector(`[data-index="${playlistIndex}"]`) as HTMLElement;
    if (activeRow) {
      const containerHeight = playlistList.clientHeight;
      const rowHeight = activeRow.offsetHeight;
      const rowTop = activeRow.offsetTop;
      const midpoint = containerHeight / 2 - rowHeight / 2;
      playlistList.scrollTop = Math.max(0, rowTop - midpoint);
    }
  }
};

const stopPlaylist = () => {
  if (playlistTimer !== null) {
    window.clearTimeout(playlistTimer);
    playlistTimer = null;
  }
};

const applyPresetPath = async (path: string, reason?: string) => {
  const traceId = createPresetTraceId();
  logPresetDebug(traceId, 'Loading preset', { path, reason });
  sessionLog.log('info', 'preset.trigger', { path, traceId, reason: reason ?? '' });
  const result = await window.visualSynth.loadPreset(path);
  if (result.error) {
    logPresetError(traceId, 'Preset load failed', { path, error: result.error });
    sessionLog.log('error', 'preset.load_failure', { path, traceId, error: result.error });
    setStatus(`Preset load failed: ${result.error}`);
    await ensureSafeVisuals(traceId, result.error);
    return;
  }
  if (result.preset) {
    // Migrate preset if needed
    const presetMigration = await import('../shared/presetMigration');
    const migrationResult = presetMigration.migratePreset(result.preset);

    if (!migrationResult.success) {
      const reasonText = migrationResult.errors.join(', ');
      logPresetError(traceId, 'Preset migration failed', {
        path,
        errors: migrationResult.errors,
        warnings: migrationResult.warnings
      });
      sessionLog.log('error', 'preset.migration_failed', { path, traceId, errors: migrationResult.errors });
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
        path,
        errors: validationResult.errors,
        warnings: validationResult.warnings
      });
      sessionLog.log('error', 'preset.validation_failed', { path, traceId, errors: validationResult.errors });
      await ensureSafeVisuals(traceId, reasonText);
      return;
    }
    if (validationResult.warnings.length > 0) {
      logPresetDebug(traceId, 'Preset validation warnings', validationResult.warnings);
    }

    // Apply the (possibly migrated) preset
    const migratedProject = migrationResult.preset;

    // Apply preset by version.
    if (migratedProject.version === 6) {
      const applyResult = presetMigration.applyPresetV6(migratedProject, currentProject);
      if (applyResult.warnings.length > 0) {
        logPresetDebug(traceId, 'Preset application warnings', applyResult.warnings);
      }
      logPresetDebug(
        traceId,
        'Resolved preset project (V6)',
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
        'Resolved preset project (V5)',
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
    } else if (migratedProject.version === 3) {
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

    const presetName = path.split(/[\\/]/).pop()?.replace(/\.\w+$/, '') ?? path;
    const message = `${reason ? `${reason}: ` : ''}Preset applied: ${presetName}`;
    if (migrationResult.warnings.length > 0) {
      setStatus(`${message} (${migrationResult.warnings.length} warnings - see console)`);
    } else {
      setStatus(message);
    }
    void capturePresetThumbnail(path);
  }
};

const advancePlaylist = async () => {
  // Skip if WebGL context is lost
  if (renderer.isContextLost?.()) {
    console.log('[Playlist] Skipping advance - WebGL context lost');
    return;
  }
  const scenes = currentProject.scenes;
  if (scenes.length === 0) return;

  // Advance index through scene timeline
  playlistIndex = (playlistIndex + 1) % scenes.length;

  setStatus(`Sequencing: ${scenes[playlistIndex].name}...`);
  await triggerPlaylistSlot(playlistIndex);

  // Schedule next if still active
  if (playlistActive) {
    if (playlistTimer) window.clearTimeout(playlistTimer);
    const slotSec = Number(playlistSlotSeconds.value) || 16;
    playlistTimer = window.setTimeout(() => {
      void advancePlaylist();
    }, slotSec * 1000);
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
  syncActiveSceneLookSection(currentProject, 'visualizer', currentProject.visualizer);
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

const applyPlasmaShaderSource = (source: string | null, label: string, scene: SceneConfig | null = null) => {
  if (typeof (renderer as { setPlasmaShaderSource?: (s: string | null, fxUniformsOverride?: string) => { ok: boolean } })
    .setPlasmaShaderSource !== 'function') {
    setStatus(`Shader system unavailable (${label}).`);
    shaderStatus.textContent = 'Shader system unavailable in this build.';
    return false;
  }
  const fxUniforms = getFxUniformsDeclarations(currentProject, scene);
  const result = renderer.setPlasmaShaderSource(source, fxUniforms);
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
  const spectrumLayer = scene.layers.find((layer) => layer.id === 'layer-spectrum');
  if (spectrumLayer && perfToggleSpectrum) perfToggleSpectrum.checked = spectrumLayer.enabled;

  // Show/hide each role slider based on whether the active scene has any layer with that role
  const roleHasLayers = (role: string) =>
    scene.layers.some((layer) => (layer.role ?? 'support') === role);
  mixRoleCore.closest('label')?.classList.toggle('hidden', !roleHasLayers('core'));
  mixRoleSupport.closest('label')?.classList.toggle('hidden', !roleHasLayers('support'));
  mixRoleAtmosphere.closest('label')?.classList.toggle('hidden', !roleHasLayers('atmosphere'));
};

const initSpectrumHint = () => {
  const dismissed = localStorage.getItem('visualsynth.spectrumHintDismissed') === '1';
  spectrumHint?.classList.toggle('hidden', dismissed);
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
  if (lastShaderError) {
    lines.push(`Shader Error: ${lastShaderError}`);
  }
  if (gpuLabel) {
    gpuLabel.textContent = `GPU: ${hasWebgl2 ? 'WebGL2' : hasWebgl1 ? 'WebGL1' : 'Unavailable'}`;
  }
  if (webglDiag) {
    webglDiag.textContent = lines.join('\n');
  }
};

const modSourceOptions = [
  { id: 'engine.low', label: 'Engine Low' },
  { id: 'engine.mid', label: 'Engine Mid' },
  { id: 'engine.high', label: 'Engine High' },
  { id: 'audio.rms', label: 'Audio RMS' },
  { id: 'audio.peak', label: 'Audio Peak' },
  { id: 'audio.strobe', label: 'Strobe' },
  { id: 'tempo.bpm', label: 'Tempo BPM' },
  { id: 'lfo-1', label: 'LFO 1' },
  { id: 'lfo-2', label: 'LFO 2' },
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

const globalModTargets = GLOBAL_MOD_TARGETS;

function buildModTargetOptions() {
  const activeScene =
    currentProject.scenes.find((s) => s.id === currentProject.activeSceneId) ??
    currentProject.scenes[0];
  const layerTargets: { id: string; label: string; min: number; max: number }[] = [];
  for (const layer of activeScene?.layers ?? []) {
    const genId = layer.generatorId ?? layer.id;
    const layerType = getLayerType(genId);
    if (!layerType) continue;
    const legacyPrefix = buildLegacyTarget(layerType.id, '').replace(/\.$/, '');
    const params = getModulatableParams(genId);
    for (const p of params) {
      if (p.type !== 'number') continue;
      layerTargets.push({
        id: `${legacyPrefix}.${p.id}`,
        label: `${layer.name || layerType.name} ${p.name}`,
        min: p.min ?? 0,
        max: p.max ?? 1
      });
    }
  }
  return [...layerTargets, ...globalModTargets];
}

let modTargetOptions = buildModTargetOptions();

const getTargetDefaults = (targetId: string) =>
  modTargetOptions.find((item) => item.id === targetId) ?? { min: 0, max: 1 };

const globalMidiTargets = [
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
  { id: 'macro-1', label: 'Macro 1' },
  { id: 'macro-2', label: 'Macro 2' },
  { id: 'macro-3', label: 'Macro 3' },
  { id: 'macro-4', label: 'Macro 4' },
  { id: 'macro-5', label: 'Macro 5' },
  { id: 'macro-6', label: 'Macro 6' },
  { id: 'macro-7', label: 'Macro 7' },
  { id: 'macro-8', label: 'Macro 8' },
  { id: 'playlist-slot-1', label: 'Playlist Slot 1' },
  { id: 'playlist-slot-2', label: 'Playlist Slot 2' },
  { id: 'playlist-slot-3', label: 'Playlist Slot 3' },
  { id: 'playlist-slot-4', label: 'Playlist Slot 4' },
  { id: 'playlist-slot-5', label: 'Playlist Slot 5' },
  { id: 'playlist-slot-6', label: 'Playlist Slot 6' },
  { id: 'playlist-slot-7', label: 'Playlist Slot 7' },
  { id: 'playlist-slot-8', label: 'Playlist Slot 8' }
];

function buildMidiTargetOptions() {
  const activeScene =
    currentProject.scenes.find((s) => s.id === currentProject.activeSceneId) ??
    currentProject.scenes[0];
  const layerTargets: { id: string; label: string }[] = [];
  for (const layer of activeScene?.layers ?? []) {
    const genId = layer.generatorId ?? layer.id;
    const layerType = getLayerType(genId);
    if (!layerType) continue;
    const legacyPrefix = buildLegacyTarget(layerType.id, '').replace(/\.$/, '');
    // Add enabled toggle
    layerTargets.push({
      id: `${legacyPrefix}.enabled`,
      label: `${layer.name || layerType.name} Enabled`
    });
    const params = getMidiMappableParams(genId);
    for (const p of params) {
      if (p.type !== 'number') continue;
      layerTargets.push({
        id: `${legacyPrefix}.${p.id}`,
        label: `${layer.name || layerType.name} ${p.name}`
      });
    }
  }
  return [...layerTargets, ...globalMidiTargets];
}

let midiTargetOptions = buildMidiTargetOptions();

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
  } else {
    const existingIds = new Set(project.palettes.map((palette) => palette.id));
    const missing = DEFAULT_PROJECT.palettes.filter((palette) => !existingIds.has(palette.id));
    if (missing.length > 0) {
      project.palettes = [...project.palettes, ...cloneValue(missing)];
    }
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
    enabled: current.enabled ?? fallback.enabled,
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

const normalizeLayerId = (value: string) =>
  value
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const findLayerById = (
  layers: LayerConfig[] | undefined,
  id: string
): LayerConfig | undefined => {
  const target = normalizeLayerId(id);
  return layers?.find((layer) => {
    const layerId = normalizeLayerId(layer.id ?? '');
    if (layerId === target) return true;
    const generatorId = normalizeLayerId(layer.generatorId ?? '');
    return generatorId === target;
  });
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
  if (layerId === 'gen-strobe') return 'core';
  if (layerId === 'gen-laser-beam') return 'support';
  if (layerId === 'gen-shape-burst') return 'support';
  if (layerId === 'gen-grid-tunnel') return 'atmosphere';
  // New Rock & Tunnel Suite
  if (layerId === 'gen-lightning') return 'core';
  if (layerId === 'gen-analog-oscillo') return 'core';
  if (layerId === 'gen-speaker-cone') return 'atmosphere';
  if (layerId === 'gen-glitch-scanline') return 'atmosphere';
  if (layerId === 'gen-laser-starfield') return 'support';
  if (layerId === 'gen-pulsing-ribbons') return 'support';
  if (layerId === 'gen-electric-arc') return 'atmosphere';
  if (layerId === 'gen-pyro-burst') return 'support';
  if (layerId === 'gen-geo-wireframe') return 'core';
  if (layerId === 'gen-signal-noise') return 'atmosphere';
  if (layerId === 'gen-infinite-wormhole') return 'core';
  if (layerId === 'gen-ribbon-tunnel') return 'core';
  if (layerId === 'gen-fractal-tunnel') return 'core';
  if (layerId === 'gen-circuit-conduit') return 'atmosphere';
  if (layerId === 'gen-aura-portal') return 'core';
  if (layerId === 'gen-freq-terrain') return 'support';
  if (layerId === 'gen-data-stream') return 'atmosphere';
  if (layerId === 'gen-caustic-liquid') return 'core';
  if (layerId === 'gen-shimmer-veil') return 'support';
  return 'support';
};

const buildDefaultParamsForLayerId = (layerId: string) => {
  const layerType = getLayerType(layerId);
  if (!layerType) return {} as Record<string, any>;
  const params: Record<string, any> = {};
  layerType.params.forEach((param) => {
    if (param.default !== undefined) {
      params[param.id] = param.default;
    }
  });
  return params;
};

const applyDefaultParams = (layerId: string, params: Record<string, any>) => {
  const defaults = buildDefaultParamsForLayerId(layerId);
  Object.entries(defaults).forEach(([key, value]) => {
    if (params[key] === undefined) {
      params[key] = value;
    }
  });
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
  const hadValidProject = projectSchema.safeParse(currentProject).success;
  sessionLog.log('error', 'preset.safe_visuals_fallback', { traceId, reason, hadValidProject });
  sessionLog.captureFailureSnapshot({ reason, traceId, hadValidProject });
  if (hadValidProject) {
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

const addSceneFromSourceProject = (
  sourceProject: VisualSynthProject,
  options: {
    sourceSceneId?: string;
    sceneName: string;
    explicitPaletteId?: string;
    statusLabel: string;
    presetPath?: string;
  }
) => {
  if (!sourceProject.scenes.length) {
    setStatus('Imported file has no scenes.');
    return null;
  }

  const sourceScene =
    sourceProject.scenes.find((scene) => scene.id === options.sourceSceneId) ??
    sourceProject.scenes.find((scene) => scene.id === sourceProject.activeSceneId) ??
    sourceProject.scenes[0];

  const assetIdMap = new Map<string, string>();
  const referencedAssetIds = new Set<string>();
  sourceScene.layers.forEach((layer) => {
    if (layer.assetId) referencedAssetIds.add(layer.assetId);
  });

  if (sourceProject.assets?.length && referencedAssetIds.size > 0) {
    const nextAssets = [...currentProject.assets];
    sourceProject.assets.forEach((asset) => {
      if (!referencedAssetIds.has(asset.id)) return;
      const hasCollision = nextAssets.some((existing) => existing.id === asset.id);
      const newId = hasCollision ? getNextAssetId() : asset.id;
      assetIdMap.set(asset.id, newId);
      nextAssets.push({ ...cloneValue(asset), id: newId });
    });
    currentProject.assets = nextAssets;
    renderAssets();
  }

  // Prefer the source scene's own per-scene look over the source project's
  // project-level fields. The project-level fields hold the source project's
  // ACTIVE scene's look at save time — which is a *different* scene than
  // sourceScene whenever a non-active scene is imported, so building the look
  // from sourceProject.* silently replaces the imported scene's effects /
  // palette / macros with another scene's. applySceneLookToProject
  // (sceneRuntime) treats scene.look as authoritative on activation, so the
  // imported scene must carry its own look. Fall back to the project-level
  // field only when the scene has no look (e.g. presets saved before per-scene
  // looks existed). activePaletteId keeps the caller's explicit override first
  // (callers resolve it from the source project/scene), then the scene look,
  // then the project field — never undefined, which would orphan the palette.
  const sceneLook = sourceScene.look;
  const look: SceneLook = {
    effects: cloneValue(sceneLook?.effects ?? sourceProject.effects ?? {}),
    particles: cloneValue(sceneLook?.particles ?? sourceProject.particles ?? {}),
    sdf: cloneValue(sceneLook?.sdf ?? sourceProject.sdf ?? {}),
    visualizer: cloneValue(sceneLook?.visualizer ?? sourceProject.visualizer ?? {}),
    stylePresets: cloneValue(sceneLook?.stylePresets ?? sourceProject.stylePresets ?? []),
    activeStylePresetId: cloneValue(
      sceneLook?.activeStylePresetId ?? sourceProject.activeStylePresetId ?? ''
    ),
    palettes: cloneValue(sceneLook?.palettes ?? sourceProject.palettes ?? []),
    activePaletteId:
      options.explicitPaletteId ?? sceneLook?.activePaletteId ?? sourceProject.activePaletteId,
    macros: cloneValue(sceneLook?.macros ?? sourceProject.macros ?? []),
    modMatrix: cloneValue(sceneLook?.modMatrix ?? sourceProject.modMatrix ?? [])
  };

  const newSceneId = getNextSceneId();
  const newScene: SceneConfig = {
    id: newSceneId,
    scene_id: newSceneId,
    name: getUniqueSceneName(options.sceneName),
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
    // Carry over scene-scoring / classification metadata so imported scenes keep
    // their depth/complexity scores and tags. Without these, SceneManager
    // .getNextBestScene scores imported scenes as zero and calculateSimilarity
    // never matches their (undefined) tags, so auto-switch systematically
    // deprioritizes every imported scene — and the schema's .default(0)/([])
    // would bake those zeros in on the next save.
    certification: sourceScene.certification ? cloneValue(sourceScene.certification) : undefined,
    depthScore: sourceScene.depthScore,
    complexity: sourceScene.complexity,
    tags: sourceScene.tags ? [...sourceScene.tags] : undefined,
    layers: sourceScene.layers.map((layer) => {
      const cloned = cloneLayerConfig(layer);
      if (cloned.assetId && assetIdMap.has(cloned.assetId)) {
        cloned.assetId = assetIdMap.get(cloned.assetId);
      }
      return cloned;
    }),
    look,
    _shaderData: sourceScene._shaderData ? cloneValue(sourceScene._shaderData) : undefined,
    presetPath: options.presetPath
  };

  addSceneToProject(newScene, false);
  selectedSceneId = newScene.id;
  renderSceneStrip();
  renderSceneTimeline();
  renderPlaylist();
  setStatus(`${options.statusLabel}: ${newScene.name}`);
  return newScene.id;
};

const addSceneFromExchangePayload = (payload: Extract<ExchangePayload, { kind: 'scene' }>) => {
  const nextProject = applyExchangePayload(currentProject, payload);
  const newScene = nextProject.scenes[nextProject.scenes.length - 1];
  currentProject = nextProject;
  refreshSceneSelect();
  selectedSceneId = newScene?.id ?? null;
  renderSceneStrip();
  renderSceneTimeline();
  renderPlaylist();
  if (newScene) {
    applyScene(newScene.id);
    setStatus(`Scene loaded: ${newScene.name}`);
    return newScene.id;
  }
  return null;
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
  // The scene-strip ✕, the scene-list ✕, and the timeline onRemove all call
  // removeScene directly. Previously only handleDeleteScene repaired the
  // selection afterwards, so the strip/list delete paths left selectedSceneId
  // pointing at the removed scene and never refreshed the dropdown / context
  // panel (populateSceneSelectors highlighted a missing row). Re-target the
  // selection at the new active scene and refresh selectors for every caller.
  if (!selectedSceneId || !currentProject.scenes.some((s) => s.id === selectedSceneId)) {
    selectedSceneId = currentProject.activeSceneId;
  }
  populateSceneSelectors();
  renderSceneStrip();
  renderPlaylist();
  setStatus('Scene removed.');
};

const updateOutputResolution = () => {
  const width = Math.round(OUTPUT_BASE_WIDTH * outputConfig.scale);
  const height = Math.round(OUTPUT_BASE_HEIGHT * outputConfig.scale);
  outputResolutionLabel.textContent = `Output: ${width} x ${height}`;
};

const updatePerformanceModeUI = () => {
  if (currentProject.performanceMode) {
    perfModeEnabled.checked = currentProject.performanceMode.enabled;
    perfModeRestrictPresets.checked = currentProject.performanceMode.restrictToSafePresets;
    perfModeAutoRecovery.checked = currentProject.performanceMode.autoRecoveryEnabled;
  }
};

const updateOutputUI = () => {
  updatePerformanceModeUI();
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
  sceneStripCards?.classList.toggle('hidden', view !== 'cards');
  sceneStripList?.classList.toggle('hidden', view !== 'list');
  sceneStripViewButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.sceneView === view);
  });
};

const renderSceneStrip = () => {
  if (!sceneStripCards || !sceneStripList) return;
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

let sceneTimelineMenu: HTMLDivElement | null = null;
let sceneTimelineMenuCleanup: (() => void) | null = null;

const closeSceneTimelineMenu = () => {
  sceneTimelineMenuCleanup?.();
  sceneTimelineMenuCleanup = null;
  if (sceneTimelineMenu) {
    sceneTimelineMenu.remove();
    sceneTimelineMenu = null;
  }
};

const saveSceneAsPreset = async (sceneId: string) => {
  const scene = currentProject.scenes.find((entry) => entry.id === sceneId);
  if (!scene) {
    setStatus('Scene preset save failed.');
    return;
  }

  try {
    const preset = createScenePreset(currentProject, sceneId);
    const safeName = scene.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || sceneId;
    const result = await window.visualSynth.savePreset(
      JSON.stringify(preset, null, 2),
      `preset-${safeName}.json`
    );
    if (!result.canceled) {
      setStatus(`Scene preset saved: ${scene.name}`);
    } else if (result.error) {
      setStatus(`Scene preset save failed: ${result.error}`);
    }
  } catch (error) {
    setStatus('Scene preset save failed.');
  }
};

const importOneSceneFile = async (filePath: string, payload: string) => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    setStatus(`Scene import failed: invalid JSON (${filePath.split(/[\\/]/).pop()}).`);
    return;
  }

  const exchangePayload = parsed as Partial<ExchangePayload>;
  if (exchangePayload.kind === 'scene' && exchangePayload.version === 1 && exchangePayload.scene) {
    addSceneFromExchangePayload(exchangePayload as Extract<ExchangePayload, { kind: 'scene' }>);
    return;
  }

  const parsedProject = projectSchema.safeParse(parsed);
  if (parsedProject.success) {
    addSceneFromSourceProject(parsedProject.data, {
      sceneName: parsedProject.data.scenes.find((scene) => scene.id === parsedProject.data.activeSceneId)?.name
        ?? parsedProject.data.scenes[0]?.name
        ?? 'Imported Scene',
      explicitPaletteId:
        parsedProject.data.activePaletteId ||
        parsedProject.data.scenes[0]?.look?.activePaletteId ||
        undefined,
      statusLabel: 'Scene imported',
      presetPath: filePath
    });
    return;
  }

  const presetMigration = await import('../shared/presetMigration');
  const migrationResult = presetMigration.migratePreset(parsed);
  if (!migrationResult.success) {
    setStatus(`Scene import failed: ${migrationResult.errors.join(', ') || 'unsupported file.'}`);
    return;
  }

  const validationResult = presetMigration.validatePreset(migrationResult.preset);
  if (!validationResult.valid) {
    setStatus(`Scene import failed: ${validationResult.errors.join(', ') || 'invalid preset.'}`);
    return;
  }

  const migratedPreset = migrationResult.preset;
  let sourceProject: VisualSynthProject | null = null;
  if (migratedPreset.version === 6) {
    sourceProject = presetMigration.applyPresetV6(migratedPreset, currentProject).project ?? null;
  } else if (migratedPreset.version === 5) {
    sourceProject = presetMigration.applyPresetV5(migratedPreset, currentProject).project ?? null;
  } else if (migratedPreset.version === 4) {
    sourceProject = presetMigration.applyPresetV4(migratedPreset, currentProject).project ?? null;
  } else if (migratedPreset.version === 3) {
    sourceProject = presetMigration.applyPresetV3(migratedPreset, currentProject).project ?? null;
  } else if (projectSchema.safeParse(migratedPreset).success) {
    sourceProject = migratedPreset as VisualSynthProject;
  }

  if (!sourceProject) {
    setStatus('Scene import failed: file has no importable scene.');
    return;
  }

  addSceneFromSourceProject(sourceProject, {
    sceneName:
      migratedPreset.metadata?.name ||
      sourceProject.scenes.find((scene) => scene.id === sourceProject.activeSceneId)?.name ||
      sourceProject.scenes[0]?.name ||
      'Imported Scene',
    explicitPaletteId:
      migratedPreset.activePaletteId ||
      migratedPreset.project?.activePaletteId ||
      migratedPreset.project?.scenes?.[0]?.look?.activePaletteId ||
      undefined,
    statusLabel: 'Scene imported',
    presetPath: filePath
  });
};

const importSceneFromDisk = async () => {
  const result = await window.visualSynth.openSceneFile();
  if (result.canceled || !result.files?.length) return;
  for (const { filePath, payload } of result.files) {
    await importOneSceneFile(filePath, payload);
  }
};

const ACTIVATE_NOW_TRANSITION_OPTIONS: Array<{ label: string; transition: SceneTransition | null }> = [
  { label: 'Cut', transition: null },
  { label: 'Fade', transition: { type: 'fade', durationMs: 1000, curve: 'easeInOut' } },
  { label: 'Warp', transition: { type: 'warp', durationMs: 600, curve: 'easeInOut' } },
  { label: 'Glitch', transition: { type: 'glitch', durationMs: 300, curve: 'linear' } },
  { label: 'Dissolve', transition: { type: 'dissolve', durationMs: 1000, curve: 'easeInOut' } },
];

const QUEUE_TRANSITION_OPTIONS: Array<{ label: string; transition: SceneTransition | null }> = [
  { label: 'Cut', transition: null },
  { label: 'Fade', transition: { type: 'fade', durationMs: 1000, curve: 'easeInOut' } },
  { label: 'Warp', transition: { type: 'warp', durationMs: 600, curve: 'easeInOut' } },
  { label: 'Glitch', transition: { type: 'glitch', durationMs: 300, curve: 'linear' } },
  { label: 'Dissolve', transition: { type: 'dissolve', durationMs: 1000, curve: 'easeInOut' } },
];

const showSceneTimelineMenu = (x: number, y: number, sceneId: string, sceneName: string) => {
  closeSceneTimelineMenu();

  const submenus: HTMLElement[] = [];

  const styleMenuBtn = (btn: HTMLButtonElement) => {
    btn.type = 'button';
    btn.style.display = 'block';
    btn.style.width = '100%';
    btn.style.textAlign = 'left';
    btn.style.background = 'transparent';
    btn.style.color = '#e6eef8';
    btn.style.border = '0';
    btn.style.padding = '8px 10px';
    btn.style.cursor = 'pointer';
    btn.style.fontSize = '13px';
    btn.onmouseenter = () => { btn.style.background = '#1f2633'; };
    btn.onmouseleave = () => { btn.style.background = 'transparent'; };
  };

  const makeSubmenuItem = (
    parent: HTMLElement,
    label: string,
    onSelect: (transition: SceneTransition | null) => void,
    options: Array<{ label: string; transition: SceneTransition | null }>
  ) => {
    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';

    const btn = document.createElement('button');
    btn.textContent = `${label}  ›`;
    styleMenuBtn(btn);
    wrapper.appendChild(btn);
    parent.appendChild(wrapper);

    const submenu = document.createElement('div');
    submenu.style.position = 'fixed';
    submenu.style.display = 'none';
    submenu.style.background = '#141a24';
    submenu.style.border = '1px solid #2a3344';
    submenu.style.borderRadius = '6px';
    submenu.style.padding = '6px';
    submenu.style.boxShadow = '0 6px 18px rgba(0,0,0,0.45)';
    submenu.style.zIndex = '10000';
    submenu.style.minWidth = '160px';
    document.body.appendChild(submenu);
    submenus.push(submenu);

    options.forEach(({ label: tLabel, transition }) => {
      const tBtn = document.createElement('button');
      tBtn.textContent = tLabel;
      styleMenuBtn(tBtn);
      tBtn.onclick = () => {
        onSelect(transition);
        closeSceneTimelineMenu();
      };
      submenu.appendChild(tBtn);
    });

    const hideTimer = { id: 0 };
    const startHide = () => { hideTimer.id = window.setTimeout(() => { submenu.style.display = 'none'; }, 120); };
    const cancelHide = () => clearTimeout(hideTimer.id);

    btn.addEventListener('mouseenter', () => {
      submenus.forEach((s) => { if (s !== submenu) s.style.display = 'none'; });
      const r = btn.getBoundingClientRect();
      submenu.style.left = `${r.right + 2}px`;
      submenu.style.top = `${r.top}px`;
      submenu.style.display = 'block';
      const sr = submenu.getBoundingClientRect();
      if (sr.right > window.innerWidth - 4) submenu.style.left = `${r.left - sr.width - 2}px`;
      if (sr.bottom > window.innerHeight - 4) submenu.style.top = `${r.top - (sr.bottom - window.innerHeight) - 4}px`;
      cancelHide();
    });
    btn.addEventListener('mouseleave', startHide);
    submenu.addEventListener('mouseenter', cancelHide);
    submenu.addEventListener('mouseleave', startHide);
  };

  const menu = document.createElement('div');
  menu.style.position = 'fixed';
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  menu.style.background = '#141a24';
  menu.style.border = '1px solid #2a3344';
  menu.style.borderRadius = '6px';
  menu.style.padding = '6px';
  menu.style.boxShadow = '0 6px 18px rgba(0,0,0,0.45)';
  menu.style.zIndex = '9999';
  menu.style.minWidth = '180px';

  makeSubmenuItem(menu, 'Activate Now', (transition) => {
    applySceneWithTransitionOverride(sceneId, transition);
  }, ACTIVATE_NOW_TRANSITION_OPTIONS);

  makeSubmenuItem(menu, 'Queue in 4 beats', (transition) => {
    const bpm = getActiveBpm();
    const now = performance.now();
    const beatMs = getBeatMs(bpm);
    const nextBeat = getNextQuantizedTimeMs(now, bpm, 'quarter');
    const scheduledTimeMs = nextBeat + beatMs * 3;
    pendingSceneSwitch = { targetSceneId: sceneId, scheduledTimeMs, transitionOverride: transition };
    setStatus(`Queued scene switch to ${sceneName} (4 beats)`);
  }, QUEUE_TRANSITION_OPTIONS);

  const divider = document.createElement('div');
  divider.style.height = '1px';
  divider.style.margin = '4px 0';
  divider.style.background = '#2a3344';
  menu.appendChild(divider);

  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Save As';
  styleMenuBtn(saveBtn);
  saveBtn.onclick = () => {
    void saveSceneAsPreset(sceneId);
    closeSceneTimelineMenu();
  };
  menu.appendChild(saveBtn);

  const scene = currentProject.scenes.find((s) => s.id === sceneId);
  if (scene?.presetPath) {
    const refreshBtn = document.createElement('button');
    refreshBtn.textContent = 'Refresh from Disk';
    styleMenuBtn(refreshBtn);
    refreshBtn.onclick = () => {
      void refreshSceneFromPreset(sceneId);
      closeSceneTimelineMenu();
    };
    menu.appendChild(refreshBtn);
  }

  document.body.appendChild(menu);

  const rect = menu.getBoundingClientRect();
  const clampX = Math.min(x, window.innerWidth - rect.width - 6);
  const clampY = Math.min(y, window.innerHeight - rect.height - 6);
  menu.style.left = `${Math.max(6, clampX)}px`;
  menu.style.top = `${Math.max(6, clampY)}px`;

  const onDocClick = (event: MouseEvent) => {
    const inMenu = menu.contains(event.target as Node);
    const inSub = submenus.some((s) => s.contains(event.target as Node));
    if (!inMenu && !inSub) closeSceneTimelineMenu();
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') closeSceneTimelineMenu();
  };
  document.addEventListener('mousedown', onDocClick, true);
  document.addEventListener('keydown', onKey);
  sceneTimelineMenuCleanup = () => {
    document.removeEventListener('mousedown', onDocClick, true);
    document.removeEventListener('keydown', onKey);
    submenus.forEach((s) => s.remove());
  };
  sceneTimelineMenu = menu;
};

const renderSceneTimeline = () => {
  if (!sceneTimelineTrack) return;
  renderSceneTimelineItems({
    project: currentProject,
    track: sceneTimelineTrack,
    status: sceneTimelineStatus,
    previewedSceneId: previewSceneId,
    onSelect: (sceneId, sceneName) => {
      selectedSceneId = sceneId;
      previewSceneId = sceneId;

      const scene = currentProject.scenes.find((s) => s.id === sceneId);
      if (scene) {
        compileSceneShaders(
          renderer,
          scene,
          currentProject,
          currentProject.customShaderBlocks ?? [],
          currentProject.sdf?.enabled ?? false,
          true // forceSync for immediate preview feedback
        );
      }
      renderSceneStrip();
      setStatus(`Scene preview: ${sceneName}`);
    },
    onActivate: (sceneId, sceneName) => {
      applyScene(sceneId);
      setStatus(`Activated: ${sceneName}`);
    },
    onRemove: (sceneId, sceneName) => {
      removeScene(sceneId);
      closeSceneTimelineMenu();
    },
    onRename: (sceneId, newName) => {
      const scene = currentProject.scenes.find((s) => s.id === sceneId);
      if (scene) {
        scene.name = newName;
        renderSceneTimeline();
        renderSceneStrip();
        refreshSceneSelect();
        setStatus(`Renamed scene to: ${newName}`);
      }
    },
    onIntentChange: (sceneId, newIntent) => {
      const scene = currentProject.scenes.find((s) => s.id === sceneId);
      if (scene) {
        scene.intent = newIntent as any;
        renderSceneTimeline();
        setStatus(`Scene "${scene.name}" intent: ${newIntent}`);
      }
    },
    onContextMenu: (sceneId, sceneName, event) => {
      showSceneTimelineMenu(event.clientX, event.clientY, sceneId, sceneName);
    },
    onImport: () => {
      void importSceneFromDisk();
    },
    onNewScene: () => {
      const id = getNextSceneId();
      const newScene: SceneConfig = {
        id,
        scene_id: id,
        name: getUniqueSceneName('Empty Scene'),
        intent: 'ambient',
        duration: 0,
        transition_in: { ...DEFAULT_SCENE_TRANSITION },
        transition_out: { ...DEFAULT_SCENE_TRANSITION },
        trigger: { ...DEFAULT_SCENE_TRIGGER },
        assigned_layers: { core: [], support: [], atmosphere: [] },
        layers: [],
        look: {
          effects: { enabled: true, bloom: 0, blur: 0, chroma: 0, posterize: 0, kaleidoscope: 0, feedback: 0, persistence: 0 },
          particles: { enabled: false, density: 0, speed: 0, size: 0, glow: 0 },
          sdf: { enabled: false, shape: 'circle', scale: 0, edge: 0, glow: 0, rotation: 0, fill: 0 },
          visualizer: { enabled: false, mode: 'off', opacity: 0, macroEnabled: false, macroId: 0 }
        }
      };
      currentProject.scenes = [...currentProject.scenes, newScene];
      refreshSceneSelect();
      renderSceneTimeline();
      renderSceneStrip();
      setStatus(`Created empty scene: ${newScene.name}`);
    },
    onReorder: (fromIndex, toIndex) => {
      currentProject = reorderScenes(currentProject, fromIndex, toIndex);
      renderSceneTimeline();
      renderSceneStrip();
      const movedScene = currentProject.scenes[toIndex];
      setStatus(`Moved "${movedScene.name}" to position ${toIndex + 1}`);
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
  if (sceneSelect) {
    sceneSelect.innerHTML = '';
    currentProject.scenes.forEach((scene) => {
      const option = document.createElement('option');
      option.value = scene.id;
      option.textContent = scene.name;
      sceneSelect.appendChild(option);
    });
    sceneSelect.value = currentProject.activeSceneId;
  }
  populateSceneSelectors();
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

const updateSceneContextUI = (scene: SceneConfig) => {
  sceneIntentSelect.value = scene.intent ?? 'ambient';  const trigger = scene.trigger ?? { type: 'manual' };
  sceneTriggerType.value = trigger.type;
  sceneTriggerAudioOptions.classList.toggle('hidden', trigger.type !== 'audio');
  if (trigger.type === 'audio') {
    sceneTriggerThreshold.value = String(trigger.threshold ?? 0.5);
    sceneTriggerInterval.value = String(trigger.minIntervalMs ?? 2000);
  }const transition = scene.transition_in ?? { durationMs: 600, curve: 'easeInOut' };
  sceneTransitionTypeSelect.value = transition.type ?? 'fade';
  sceneTransitionDuration.value = String(transition.durationMs ?? 600);
  sceneTransitionCurve.value = transition.curve ?? 'easeInOut';
};

const populateSceneSelectors = () => {
  const sceneId = selectedSceneId ?? currentProject.activeSceneId;
  const sceneCount = currentProject.scenes.length;
  const showMultiSceneUI = sceneCount > 1;
  
  // Toggle visibility of multi-scene UI
  if (sceneContextPanel) sceneContextPanel.classList.toggle('hidden', !showMultiSceneUI);
  if (sceneEditPanel) {
    const sceneEditLabel = sceneEditPanel.querySelector('.scene-label');
    if (sceneEditLabel) sceneEditLabel.classList.toggle('hidden', !showMultiSceneUI);
  }
  [sceneViewSelect, sceneEditSelect].filter(Boolean).forEach(select => {
    select.innerHTML = '';
    currentProject.scenes.forEach((scene, index) => {
      const option = document.createElement('option');
      option.value = scene.id;
      option.textContent = scene.name?.trim()
        ? `${scene.name}${scene.intent ? ` (${scene.intent})` : ''}`
        : `Scene ${index + 1}${scene.intent ? ` (${scene.intent})` : ''}`;
      select.appendChild(option);
    });
    select.value = sceneId;
  });
  // Toggle delete buttons - can only delete if more than 1 scene and not first scene
  const selectedIndex = currentProject.scenes.findIndex(s => s.id === sceneId);
  const canDelete = sceneCount > 1 && selectedIndex > 0;
  if (sceneDeleteBtn) sceneDeleteBtn.classList.toggle('hidden', !canDelete);
  if (sceneDeleteBtnView) sceneDeleteBtnView.classList.toggle('hidden', !canDelete);const activeScene = currentProject.scenes.find(s => s.id === sceneId);
  if (activeScene) {
    updateSceneContextUI(activeScene);
  }
};

const renderLayerList = () => {
  // Clear all layer lists
  layerList.innerHTML = '';
  layerListScene.innerHTML = '';
  if (layerListDesign) layerListDesign.innerHTML = '';

  const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
  if (!scene) return;

  // Reset all layer toggle references (they may point to elements from the previous scene).
  // These are typed `HTMLInputElement | null`, so reset to `null` (not `undefined`).
  plasmaToggle = null;
  spectrumToggle = null;
  origamiToggle = null;
  glyphToggle = null;
  crystalToggle = null;
  inkToggle = null;
  topoToggle = null;
  weatherToggle = null;
  portalToggle = null;
  oscilloToggle = null;

  // Count modulation connections for each layer
  const getModCountForLayer = (layerId: string): number => {
    const prefix = `${layerId}.`;
    return currentProject.modMatrix.filter((conn) => conn.target.startsWith(prefix)).length;
  };

  // Count MIDI mappings for each layer
  const getMidiCountForLayer = (layerId: string): number => {
    return currentProject.midiMappings.filter(map => map.target.startsWith(layerId)).length;
  };

  if (scene.layers.length === 0) {
    // Empty scene: show placeholder message
    const emptyMsg = document.createElement('div');
    emptyMsg.className = 'layer-list-empty';
    emptyMsg.textContent = 'No layers in this scene';
    layerList.appendChild(emptyMsg);
    layerListScene.appendChild(emptyMsg.cloneNode(true));
    if (layerListDesign) layerListDesign.appendChild(emptyMsg.cloneNode(true));
    return;
  }

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
        if (layer.params) layer.params.opacity = Number(opacity.value);
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
        removeLayer(scene.id, layer.id);
      });
      controls.appendChild(upButton);
      controls.appendChild(downButton);
      controls.appendChild(removeButton);

      row.appendChild(label);
      row.appendChild(controls);
      const assetControl = document.createElement('div');
      assetControl.className = 'layer-asset-control';
      
      if (supportsAsset(layer.id)) {
        assetControl.appendChild(buildLayerAssetSelect(layer));
      }
      assetControl.appendChild(opacityRow);

      if (supportsAsset(layer.id)) {
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

      // Modern Generator Parameter Editing (Generic)
      const layerTypeId = layer.generatorId || layer.id;
      const genType = getLayerType(layerTypeId);
      if (genType) {
          const params = (genType.params ?? []).filter(p => p.id !== 'opacity');
          if (params.length > 0) {
              const paramsContainer = document.createElement('div');
              paramsContainer.className = 'layer-params-grid';
              params.forEach(param => {
                  const paramRow = document.createElement('div');
                  paramRow.className = 'param-row';
                  
                  const pLabel = document.createElement('label');
                  pLabel.textContent = param.name;
                  pLabel.className = 'param-label';
                  
                  if (param.type === 'enum' && param.options) {
                      const pSelect = document.createElement('select');
                      pSelect.className = 'param-select';
                      
                      param.options.forEach(opt => {
                          const option = document.createElement('option');
                          option.value = String(opt.value);
                          option.textContent = opt.label;
                          pSelect.appendChild(option);
                      });
                      
                      pSelect.value = String(layer.params?.[param.id] ?? param.default);
                      
                      pSelect.dataset.learnTarget = `${layer.id}.${param.id}`;
                      pSelect.dataset.learnLabel = `${layer.name} ${param.name}`;
                      
                      pSelect.addEventListener('change', () => {
                          if (!layer.params) layer.params = {};
                          layer.params[param.id] = Number(pSelect.value);
                          recordPlaylistOverride(layer.id, { params: { [param.id]: Number(pSelect.value) } });
                      });
                      
                      paramRow.appendChild(pLabel);
                      paramRow.appendChild(pSelect);
                  } else {
                      const pInput = document.createElement('input');
                      pInput.type = 'range';
                      pInput.min = String(param.min ?? 0);
                      pInput.max = String(param.max ?? 1);
                      pInput.step = String(0.01);
                      pInput.value = String(layer.params?.[param.id] ?? param.default);
                      pInput.className = 'param-slider';
                      
                      pInput.dataset.learnTarget = `${layer.id}.${param.id}`;
                      pInput.dataset.learnLabel = `${layer.name} ${param.name}`;
                      
                      pInput.addEventListener('input', () => {
                          if (!layer.params) layer.params = {};
                          layer.params[param.id] = Number(pInput.value);
                          recordPlaylistOverride(layer.id, { params: { [param.id]: Number(pInput.value) } });
                      });
                      
                      paramRow.appendChild(pLabel);
                      paramRow.appendChild(pInput);
                  }
                  
                  paramsContainer.appendChild(paramRow);
              });
              assetControl.appendChild(paramsContainer);
          }
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
  });

  // The forEach above rebuilt every layer toggle checkbox (new DOM nodes with
  // data-learn-target). Re-bind the MIDI-learn click handler on the fresh nodes
  // so layer-toggle MIDI-learn keeps working after scene switches / layer adds.
  // initLearnables is idempotent (skips data-learn-bound elements), so macro
  // rows that persist across this rebuild are not double-bound.
  initLearnables();
};

const renderModMatrix = () => {
  modMatrixList.innerHTML = '';
  if (currentProject.modMatrix.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'matrix-empty';
    empty.textContent = 'No modulation connections.';
    modMatrixList.appendChild(empty);
    return;
  }
  currentProject.modMatrix.forEach((connection, index) => {
    const row = document.createElement('div');
    row.className = 'matrix-row';
    if (connection.enabled === false) row.classList.add('matrix-row-disabled');

    const enableButton = document.createElement('button');
    enableButton.className = 'mod-enable-btn' + (connection.enabled === false ? ' disabled' : '');
    enableButton.textContent = connection.enabled === false ? '○' : '●';
    enableButton.title = connection.enabled === false ? 'Enable modulation' : 'Disable modulation';
    enableButton.addEventListener('click', () => {
      connection.enabled = connection.enabled === false ? true : false;
      renderModMatrix();
      renderLayerList();
    });

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

    const midiLearnBtn = document.createElement('button');
    midiLearnBtn.className = 'midi-learn-btn';
    midiLearnBtn.textContent = 'M';
    midiLearnBtn.title = 'MIDI learn toggle for this mod connection';
    midiLearnBtn.addEventListener('click', () => {
      // Learn against the connection's stable id, not its positional index.
      // Reordering or deleting other mod rows would otherwise retarget the
      // learned mapping onto whatever row now occupies that slot.
      armMidiLearn(`modMatrix.${connection.id}.enabled`, `Mod ${connection.id} Enable`);
    });

    row.appendChild(enableButton);
    row.appendChild(sourceSelect);
    row.appendChild(targetSelect);
    row.appendChild(amountInput);
    row.appendChild(curveSelect);
    row.appendChild(smoothingInput);
    row.appendChild(bipolarToggle);
    row.appendChild(minInput);
    row.appendChild(maxInput);
    row.appendChild(midiLearnBtn);
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
      max: defaults.max,
      enabled: true
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

const renderMappingSources = () => {
  const anchor = document.getElementById('mapping-sources-anchor');
  if (!anchor) return;
  anchor.innerHTML = '<h3>Sources</h3>';

  const list = document.createElement('div');
  list.className = 'mapping-source-list';

  modSourceOptions.forEach((source) => {
    const item = document.createElement('div');
    item.className = 'mapping-source-chip';
    item.textContent = source.label;
    item.draggable = true;
    item.dataset.sourceId = source.id;

    item.addEventListener('dragstart', (e) => {
      e.dataTransfer?.setData('application/vs-source', source.id);
      item.classList.add('dragging');
    });

    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      document.querySelectorAll('.drop-target-active').forEach((el) =>
        el.classList.remove('drop-target-active')
      );
    });

    list.appendChild(item);
  });

  anchor.appendChild(list);
};

const renderMappingTargets = (filterText = '') => {
  if (!mappingTargetList) return;
  const filter = filterText.trim().toLowerCase();
  mappingTargetList.innerHTML = '';
  // modTargetOptions is already scoped to active scene layers via buildModTargetOptions()
  const targets = modTargetOptions
    .slice()
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
    .filter((target) => {
      return filter ? target.label.toLowerCase().includes(filter) : true;
    });

  if (targets.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'matrix-empty';
    empty.textContent = 'No targets match.';
    mappingTargetList.appendChild(empty);
    return;
  }

  targets.forEach((target) => {
    const item = document.createElement('div');
    item.className = 'mapping-target-chip';
    item.textContent = target.label;
    item.dataset.learnTarget = target.id;
    item.dataset.learnLabel = target.label;
    mappingTargetList.appendChild(item);
  });
};

const initDragAndDropMapping = () => {
  // Global drop handler for parameters
  window.addEventListener('dragover', (e) => {
    const target = e.target as HTMLElement;
    const dropTarget = target.closest('[data-learn-target]');
    if (dropTarget) {
      e.preventDefault();
      dropTarget.classList.add('drop-target-active');
      
      mappingHud.classList.remove('hidden');
      mappingHudTitle.textContent = 'Drag to Map';
      mappingHudTarget.textContent = `Release to map to: ${(dropTarget as HTMLElement).dataset.learnLabel || 'parameter'}`;
    }
  });

  window.addEventListener('dragleave', (e) => {
    const target = e.target as HTMLElement;
    const dropTarget = target.closest('[data-learn-target]');
    if (dropTarget) {
      dropTarget.classList.remove('drop-target-active');
      mappingHud.classList.add('hidden');
    }
  });

  window.addEventListener('drop', (e) => {
    const target = e.target as HTMLElement;
    const dropTarget = target.closest('[data-learn-target]') as HTMLElement;
    if (dropTarget) {
      e.preventDefault();
      dropTarget.classList.remove('drop-target-active');
      mappingHud.classList.add('hidden');
      const sourceId = e.dataTransfer?.getData('application/vs-source');
      const targetId = dropTarget.dataset.learnTarget;
      
      if (sourceId && targetId) {
        // Create new modulation connection
        const defaults = getTargetDefaults(targetId);
        currentProject.modMatrix.push({
          id: `mod-drag-${Date.now()}`,
          source: sourceId,
          target: targetId,
          amount: 0.5,
          curve: 'linear',
          smoothing: 0.1,
          bipolar: false,
          min: defaults.min,
          max: defaults.max,
          enabled: true
        });
        renderModMatrix();
        setStatus(`Mapped ${sourceId} to ${dropTarget.dataset.learnLabel || targetId}`);
      }
    }
  });
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

  // Check if asset is truly missing (embedded assets are never missing)
  const isTrulyMissing = asset.missing && !asset.embeddedData;
  preview.className = isTrulyMissing ? 'asset-preview asset-preview-missing' : 'asset-preview';

  if (isTrulyMissing) {
    const missingIcon = document.createElement('span');
    missingIcon.className = 'asset-preview-missing-icon';
    missingIcon.textContent = '⚠';
    preview.appendChild(missingIcon);
    return preview;
  }

  if (asset.kind === 'texture') {
    // Use embeddedData if available, otherwise use thumbnail or path
    const previewUrl = asset.embeddedData ?? asset.thumbnail ?? (asset.path ? toFileUrl(asset.path) : undefined);
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

  return panel;
};

const checkMissingAssets = async () => {
  const paths = currentProject.assets
    .filter((asset) => asset.path && !asset.options?.liveSource && !asset.embeddedData)
    .map((asset) => asset.path!);
  if (paths.length === 0) return;
  const results = await window.visualSynth.checkAssetPaths(paths);
  let changed = false;
  currentProject.assets.forEach((asset) => {
    if (asset.embeddedData) {
      // Embedded assets are always resolved
      if (asset.missing) {
        asset.missing = false;
        changed = true;
      }
    } else if (asset.path && !asset.options?.liveSource) {
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

    // Embedded assets are never truly missing
    const isTrulyMissing = asset.missing && !asset.embeddedData;

    const row = document.createElement('div');
    row.className = isTrulyMissing ? 'asset-row asset-missing' : 'asset-row';
    const preview = createAssetPreviewElement(asset);
    const kind = document.createElement('div');
    kind.className = 'asset-kind';
    kind.textContent = asset.kind;
    if (isTrulyMissing) {
      const missingBadge = document.createElement('span');
      missingBadge.className = 'asset-missing-badge';
      missingBadge.textContent = 'MISSING';
      kind.appendChild(missingBadge);
    }
    if (asset.embeddedData) {
      const embeddedBadge = document.createElement('span');
      embeddedBadge.className = 'asset-embedded-badge';
      embeddedBadge.textContent = '📦 Embedded';
      kind.appendChild(embeddedBadge);
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
    const actions = document.createElement('div');
    actions.className = 'asset-actions';
    const remove = document.createElement('button');
    remove.className = 'asset-remove-btn';
    remove.innerHTML = '🗑️';
    remove.title = 'Remove asset';
    remove.addEventListener('click', () => {
      stopLiveAssetStream(asset.id);
      unassignAssetFromLayers(asset.id);
      currentProject.assets = currentProject.assets.filter((item) => item.id !== asset.id);
      renderAssets();
      renderLayerList();
      setStatus(`Asset removed: ${asset.name}`);
    });
    actions.appendChild(remove);
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

    row.appendChild(preview);
    row.appendChild(info);
    row.appendChild(actions);

    wrapper.appendChild(row);
    wrapper.appendChild(createMetadataPanel(asset));
    assetList.appendChild(wrapper);
  });
  refreshShaderTargetOptions();
};

const ASSET_LAYER_IDS = ['layer-plasma', 'layer-spectrum', 'layer-media', 'gen-asset-vortex', 'gen-asset-slices', 'gen-asset-polar', 'gen-asset-mosaic', 'gen-asset-ripple', 'gen-asset-scatter', 'gen-asset-echo'] as const;
type AssetLayerId = (typeof ASSET_LAYER_IDS)[number];
const isAssetLayerId = (layerId: string): layerId is AssetLayerId =>
  (ASSET_LAYER_IDS as readonly string[]).includes(layerId);

const assetLayerBlendModes: Record<AssetLayerId, number> = {
  'layer-plasma': 3,
  'layer-spectrum': 1,
  'layer-media': 3,
  'gen-asset-vortex': 3,
  'gen-asset-slices': 1,
  'gen-asset-polar': 3,
  'gen-asset-mosaic': 3,
  'gen-asset-ripple': 3,
  'gen-asset-scatter': 3,
  'gen-asset-echo': 1
};
const assetLayerAudioReact: Record<AssetLayerId, number> = {
  'layer-plasma': 0.6,
  'layer-spectrum': 0.8,
  'layer-media': 0.5,
  'gen-asset-vortex': 0.5,
  'gen-asset-slices': 0.5,
  'gen-asset-polar': 0.5,
  'gen-asset-mosaic': 0.5,
  'gen-asset-ripple': 0.5,
  'gen-asset-scatter': 0.5,
  'gen-asset-echo': 0.5
};
const getAssetBlendModeValue = (layerId: string): number =>
  (assetLayerBlendModes as Record<string, number>)[layerId] ?? 0;
const getAssetAudioReactValue = (layerId: string): number =>
  (assetLayerAudioReact as Record<string, number>)[layerId] ?? 0.5;

const formatAssetLabel = (asset: AssetItem) => {
  const status = asset.missing ? ' [MISSING]' : '';
  return `${asset.name} (${asset.kind})${status}`;
};

const rendererLayerAssetBindings: Partial<Record<AssetLayerId, string | null>> = {};

const bindRendererLayerAsset = async (layerId: AssetLayerId, assetId: string | null) => {
  if (rendererLayerAssetBindings[layerId] === assetId) return;
  rendererLayerAssetBindings[layerId] = assetId;
  const target = assetId ? currentProject.assets.find((item) => item.id === assetId) ?? null : null;
  const previewVideo = target ? livePreviewElements.get(target.id) : undefined;
  const textCanvas = target?.kind === 'text' ? getTextCanvas(target) ?? undefined : undefined;
  try {
    await renderer.setLayerAsset(layerId, target, previewVideo, textCanvas);
  } catch {
    rendererLayerAssetBindings[layerId] = null;
  }
};

const syncRendererAssetBindingsForScene = (scene: SceneConfig | undefined) => {
  (ASSET_LAYER_IDS as readonly AssetLayerId[]).forEach((layerId) => {
    const assetId = scene?.layers.find((layer) => layer.id === layerId)?.assetId ?? null;
    void bindRendererLayerAsset(layerId, assetId);
  });
};

const assignAssetToLayer = async (layer: LayerConfig, assetId: string | null, forceRefresh = false) => {
  if (!forceRefresh && layer.assetId === assetId) return;
  layer.assetId = assetId ?? undefined;
  const target = assetId ? currentProject.assets.find((item) => item.id === assetId) ?? null : null;
  if (!supportsAsset(layer.id)) {
    setStatus(`${layer.name} does not support texture overrides`);
    return;
  }
  try {
    const previewVideo = target ? livePreviewElements.get(target.id) : undefined;
    const textCanvas = target?.kind === 'text' ? getTextCanvas(target) ?? undefined : undefined;
    await renderer.setLayerAsset(layer.id, target, previewVideo, textCanvas);
    if (isAssetLayerId(layer.id)) {
      rendererLayerAssetBindings[layer.id] = assetId;
    }
    if (target) {
      recordAssetLayerAssignment(target.kind, layer.id);
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

const findPrioritizedAsset = (): AssetItem | null => {
  const assets = currentProject.assets;
  // Order: webcam (live), then video, then image (texture), then text
  const live = assets.find((a) => a.kind === 'live' && !a.missing);
  if (live) return live;
  const video = assets.find((a) => a.kind === 'video' && !a.missing);
  if (video) return video;
  const texture = assets.find((a) => a.kind === 'texture' && !a.missing);
  if (texture) return texture;
  const text = assets.find((a) => a.kind === 'text' && !a.missing);
  if (text) return text;
  return assets[0] ?? null;
};

const autoAssignFirstAsset = (layer: LayerConfig) => {
  if (!supportsAsset(layer.id)) return;
  if (layer.assetId) return;
  const prioritized = findPrioritizedAsset();
  if (prioritized) {
    void assignAssetToLayer(layer, prioritized.id);
  }
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
        if (isAssetLayerId(layer.id)) {
          rendererLayerAssetBindings[layer.id] = null;
        }
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
  const tags = normalizeAssetTags(assetTagsInput?.value ?? '');
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
  const newAsset = currentProject.assets[currentProject.assets.length - 1];
  if (assetTagsInput) assetTagsInput.value = '';
  renderAssets();
  renderLayerList();

  // Auto-assignment for newly imported asset
  const lastLayerId = getLastAssignedLayerForKind(kind);
  const targetScene = getActiveScene();
  if (targetScene) {
    const allowedLayers = targetScene.layers.filter((l) => supportsAsset(l.id));
    const rememberedLayer = allowedLayers.find((l) => l.id === lastLayerId);
    if (rememberedLayer && !rememberedLayer.assetId) {
      void assignAssetToLayer(rememberedLayer, newAsset.id);
    } else {
      const needsInputLayer = allowedLayers.find((l) => needsInput(l.id) && !l.assetId);
      if (needsInputLayer) {
        void assignAssetToLayer(needsInputLayer, newAsset.id);
      }
    }
  }

  setStatus(`Asset imported: ${name}`);
};

const importVideoAsset = async () => {
  const result = await window.visualSynth.importAsset('video');
  if (result.canceled || !result.filePath) return;
  const name = result.filePath.split(/[\\/]/).pop() ?? 'Video Asset';
  const tags = normalizeAssetTags(assetTagsInput?.value ?? '');
  const videoMeta = await loadVideoMetadata(result.filePath);
  const metadata = {
    hash: result.hash,
    mime: result.mime,
    width: result.width ?? videoMeta.width,
    height: result.height ?? videoMeta.height,
    colorSpace: result.colorSpace
  };
  const options = buildVideoOptions() ?? {};
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
  const newAsset = currentProject.assets[currentProject.assets.length - 1];
  if (assetTagsInput) assetTagsInput.value = '';
  renderAssets();
  renderLayerList();

  // Auto-assignment for newly imported video
  const lastLayerId = getLastAssignedLayerForKind('video');
  const targetScene = getActiveScene();
  if (targetScene) {
    const allowedLayers = targetScene.layers.filter((l) => supportsAsset(l.id));
    const rememberedLayer = allowedLayers.find((l) => l.id === lastLayerId);
    if (rememberedLayer && !rememberedLayer.assetId) {
      void assignAssetToLayer(rememberedLayer, newAsset.id);
    } else {
      const needsInputLayer = allowedLayers.find((l) => needsInput(l.id) && !l.assetId);
      if (needsInputLayer) {
        void assignAssetToLayer(needsInputLayer, newAsset.id);
      }
    }
  }

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

  const fontFamily = assetFontSelect?.value?.trim() || 'Arial';
  const fontSize = Number(assetFontSizeInput?.value) || 48;
  const isBold = assetFontBoldCheckbox?.checked ?? false;
  const isItalic = assetFontItalicCheckbox?.checked ?? false;

  const fontStyle = `${isItalic ? 'italic ' : ''}${isBold ? 'bold ' : ''}${fontSize}px ${fontFamily}`;

  const tags = normalizeAssetTags(assetTagsInput?.value ?? '');
  const canvas = renderTextToCanvas(text, fontStyle, '#ffffff');

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
      font: fontStyle,
      fontSize,
      fontColor: '#ffffff'
    }
  });

  textCanvasCache.set(
    `${asset.id}-${text}-${fontStyle}-#ffffff`,
    canvas
  );

  currentProject.assets = [...currentProject.assets, asset];

  if (assetTextInput) assetTextInput.value = '';
  if (assetTagsInput) assetTagsInput.value = '';
  renderAssets();

  // Automatically assign text to the media layer in the current scene
  const mediaLayer = getActiveScene()?.layers.find((l: LayerConfig) => l.id === 'layer-media');
  if (mediaLayer) {
    mediaLayer.assetId = asset.id;
    mediaLayer.enabled = true;
    recordAssetLayerAssignment('text', mediaLayer.id);
    void assignAssetToLayer(mediaLayer, asset.id, true);
  }

  renderLayerList();
  setStatus(`Text layer created: ${asset.name} (assigned to Media layer)`);
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
    
    const existingLiveAsset = currentProject.assets.find(
      (a) => a.kind === 'live' && a.name === name && !a.missing
    );
    if (existingLiveAsset) {
      track.stop();
      setStatus(`Live source already active: ${name}`);
      return;
    }
    
    const tags = normalizeAssetTags(assetTagsInput?.value ?? '');

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
    if (assetTagsInput) assetTagsInput.value = '';
    renderAssets();
    renderLayerList();

    // Auto-assignment for newly started live capture
    const lastLayerId = getLastAssignedLayerForKind('live');
    const targetScene = getActiveScene();
    if (targetScene) {
      const allowedLayers = targetScene.layers.filter((l) => supportsAsset(l.id));
      const alreadyAssigned = allowedLayers.some((l) => l.assetId === asset.id);

      if (!alreadyAssigned) {
        // 1. Try last assigned layer if it exists and is allowed
        const rememberedLayer = allowedLayers.find((l) => l.id === lastLayerId);
        if (rememberedLayer && !rememberedLayer.assetId) {
          void assignAssetToLayer(rememberedLayer, asset.id);
        } else {
          // 2. Try first allowed layer that needs input and is empty
          const needsInputLayer = allowedLayers.find((l) => needsInput(l.id) && !l.assetId);
          if (needsInputLayer) {
            void assignAssetToLayer(needsInputLayer, asset.id);
          } else {
            // 3. Try any empty allowed layer
            const emptyLayer = allowedLayers.find((l) => !l.assetId);
            if (emptyLayer) {
              void assignAssetToLayer(emptyLayer, asset.id);
            }
          }
        }
      }
    }

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
        kind: manifest.kind as 'generator' | 'effect',
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
    const incomingValue = serializeSection(section.get(diffIncomingProject!));
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
    // Snapshot the chunks and release the module-level array immediately. A
    // rapid stop->start calls startRecording (which does `recordingChunks = []`)
    // before this onstop fires; without the snapshot the Blob read the now-empty
    // array and saved a 0-byte file, silently discarding the previous recording.
    const chunks = recordingChunks;
    recordingChunks = [];
    const blob = new Blob(chunks, { type: 'video/webm' });
    const buffer = new Uint8Array(await blob.arrayBuffer());
    const format = captureFormatSelect.value as 'webm' | 'mp4';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultName = `visualsynth-recording-${timestamp}.${format}`;
    if (format === 'mp4') {
      const result = await window.visualSynth.transcodeCapture(buffer, defaultName, 'mp4');
      if (result.error) {
        setCaptureStatus(`FFmpeg failed: ${result.error}. Saved WebM instead.`);
        const fallback = await window.visualSynth.saveCapture(
          buffer,
          `visualsynth-recording-${timestamp}.webm`,
          'webm'
        );
        if (fallback.canceled) setCaptureStatus(fallback.error ? `Recording failed: ${fallback.error}` : 'Recording canceled.');
      } else if (result.canceled) {
        // Save dialog dismissed — recording was not written. Without this the
        // status stayed stuck on "Recording..." after the onstop fired.
        setCaptureStatus('Recording canceled.');
      } else {
        setCaptureStatus('Recording saved.');
      }
    } else {
      const result = await window.visualSynth.saveCapture(buffer, defaultName, 'webm');
      if (result.canceled) setCaptureStatus(result.error ? `Recording failed: ${result.error}` : 'Recording canceled.');
      else setCaptureStatus('Recording saved.');
    }
    // NOTE: do NOT reset recordingChunks here — we already released it at the
    // top of onstop. A reset here would wipe a NEW recording's chunks if the user
    // started recording again during the async transcode/save above.
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
    if (result.canceled) {
      setCaptureStatus(result.error ? `Screenshot failed: ${result.error}` : 'Screenshot canceled.');
    } else {
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
        : env.trigger === 'engine.low'
          ? audioState.energyLow
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

const LFO_SYNC_DIVISIONS: { label: string; beats: number }[] = [
  { label: '1/16',   beats: 0.25 },
  { label: '1/16T',  beats: 0.25 * 2 / 3 },
  { label: '1/16·3/5', beats: 0.25 * 3 / 5 },
  { label: '1/8',    beats: 0.5 },
  { label: '1/8T',   beats: 0.5 * 2 / 3 },
  { label: '1/8·3/5', beats: 0.5 * 3 / 5 },
  { label: '1/4',    beats: 1 },
  { label: '1/4T',   beats: 1 * 2 / 3 },
  { label: '1/4·3/5', beats: 1 * 3 / 5 },
  { label: '1/2',    beats: 2 },
  { label: '1/2T',   beats: 2 * 2 / 3 },
  { label: '1/2·3/5', beats: 2 * 3 / 5 },
  { label: '1 beat',  beats: 4 },
  { label: '1 beatT', beats: 4 * 2 / 3 },
  { label: '1 beat·3/5', beats: 4 * 3 / 5 },
  { label: '2 beats', beats: 8 },
  { label: '2 beatsT', beats: 8 * 2 / 3 },
  { label: '2 beats·3/5', beats: 8 * 3 / 5 },
];

const renderLfoList = () => {
  lfoList.innerHTML = '';
  currentProject.lfos.forEach((lfo, index) => {
    const row = document.createElement('div');
    row.className = 'mod-row lfo-row';
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
    const shapeWrap = document.createElement('label');
    shapeWrap.className = 'dial-toggle';
    const shapeText = document.createElement('span');
    shapeText.textContent = 'Shape';
    shapeWrap.appendChild(shapeText);
    shapeWrap.appendChild(shapeSelect);

    // Rate division dropdown (sync divisions + Hz)
    const divisionSelect = document.createElement('select');
    divisionSelect.className = 'lfo-division-select';
    const hzOption = document.createElement('option');
    hzOption.value = 'hz';
    hzOption.textContent = 'Hz';
    divisionSelect.appendChild(hzOption);
    LFO_SYNC_DIVISIONS.forEach((div) => {
      const option = document.createElement('option');
      option.value = div.label;
      option.textContent = div.label;
      divisionSelect.appendChild(option);
    });
    // Set current selection
    const currentDivision = lfo.syncDivision ?? (lfo.sync ? '1/4' : 'hz');
    divisionSelect.value = currentDivision;
    // If saved division doesn't match any option, fall back
    if (divisionSelect.value !== currentDivision) {
      divisionSelect.value = lfo.sync ? '1/4' : 'hz';
    }
    const divisionWrap = document.createElement('label');
    divisionWrap.className = 'dial-toggle';
    const divisionText = document.createElement('span');
    divisionText.textContent = 'Rate';
    divisionWrap.appendChild(divisionText);
    divisionWrap.appendChild(divisionSelect);

    // Hz rate dial (only visible when Hz is selected)
    const rateDial = createDial({
      value: lfo.sync ? 1 : lfo.rate,
      min: 0.05,
      max: 20,
      step: 0.05,
      onChange: (value) => {
        lfo.rate = value;
      },
      title: 'Hz',
      label: 'Hz'
    });
    const isHz = divisionSelect.value === 'hz';
    rateDial.wrapper.style.display = isHz ? '' : 'none';

    const phaseDial = createDial({
      value: lfo.phase,
      min: 0,
      max: 1,
      step: 0.05,
      onChange: (value) => {
        lfo.phase = value;
        lfoPhases[index] = value;
      },
      title: 'Phase',
      format: (value) => value.toFixed(2),
      label: 'Phase'
    });

    shapeSelect.addEventListener('change', () => {
      lfo.shape = shapeSelect.value as typeof lfo.shape;
    });
    rateDial.input.addEventListener('change', () => {
      lfo.rate = Number(rateDial.input.value);
    });
    divisionSelect.addEventListener('change', () => {
      const val = divisionSelect.value;
      lfo.syncDivision = val;
      if (val === 'hz') {
        lfo.sync = false;
        rateDial.wrapper.style.display = '';
      } else {
        lfo.sync = true;
        const div = LFO_SYNC_DIVISIONS.find((d) => d.label === val);
        if (div) lfo.rate = div.beats;
        rateDial.wrapper.style.display = 'none';
      }
    });
    phaseDial.input.addEventListener('change', () => {
      lfo.phase = Number(phaseDial.input.value);
      lfoPhases[index] = lfo.phase;
    });

    row.appendChild(label);
    row.appendChild(shapeWrap);
    row.appendChild(divisionWrap);
    row.appendChild(rateDial.wrapper);
    row.appendChild(phaseDial.wrapper);
    lfoList.appendChild(row);
  });
};

const renderEnvelopeList = () => {
  envList.innerHTML = '';
  // The mixer panel mirrors envelopes[0]'s attack/release with its own dials.
  // Coalesce a mixer rebuild so editing those values here doesn't leave the
  // mixer showing stale numbers. One rAF token is shared across this render's
  // dials; a subsequent render replaces the node set and orphans this closure.
  let mixerEnvRaf = 0;
  const syncMixerEnvelopes = () => {
    if (!mixerPanel) return;
    if (mixerEnvRaf) return;
    mixerEnvRaf = requestAnimationFrame(() => {
      mixerEnvRaf = 0;
      mixerPanel?.render();
    });
  };
  currentProject.envelopes.forEach((env, index) => {
    const row = document.createElement('div');
    row.className = 'mod-row';
    const label = document.createElement('div');
    label.textContent = env.name;

    const attackDial = createDial({
      value: env.attack,
      min: 0,
      max: 2,
      step: 0.01,
      onChange: (value) => {
        env.attack = value;
        if (index === 0) syncMixerEnvelopes();
      },
      title: 'Attack',
      format: (value) => value.toFixed(2),
      label: 'Attack'
    });

    const decayDial = createDial({
      value: env.decay,
      min: 0,
      max: 2,
      step: 0.01,
      onChange: (value) => {
        env.decay = value;
      },
      title: 'Decay',
      format: (value) => value.toFixed(2),
      label: 'Decay'
    });

    const sustainDial = createDial({
      value: env.sustain,
      min: 0,
      max: 1,
      step: 0.05,
      onChange: (value) => {
        env.sustain = value;
      },
      title: 'Sustain',
      format: (value) => value.toFixed(2),
      label: 'Sustain'
    });

    const releaseDial = createDial({
      value: env.release,
      min: 0,
      max: 3,
      step: 0.01,
      onChange: (value) => {
        env.release = value;
        if (index === 0) syncMixerEnvelopes();
      },
      title: 'Release',
      format: (value) => value.toFixed(2),
      label: 'Release'
    });

    const holdDial = createDial({
      value: env.hold,
      min: 0,
      max: 4,
      step: 0.05,
      onChange: (value) => {
        env.hold = value;
      },
      title: 'Hold',
      format: (value) => value.toFixed(2),
      label: 'Hold'
    });

    const triggerSelect = document.createElement('select');
    ['audio.peak', 'strobe', 'manual'].forEach((trigger) => {
      const option = document.createElement('option');
      option.value = trigger;
      option.textContent = trigger;
      triggerSelect.appendChild(option);
    });
    triggerSelect.value = env.trigger;

    const thresholdDial = createDial({
      value: env.threshold,
      min: 0,
      max: 1,
      step: 0.05,
      onChange: (value) => {
        env.threshold = value;
      },
      title: 'Threshold',
      format: (value) => value.toFixed(2),
      label: 'Thresh'
    });

    const triggerButton = document.createElement('button');
    triggerButton.className = 'mod-trigger';
    triggerButton.textContent = 'Trigger';
    triggerButton.addEventListener('click', () => {
      envStates[index].stage = 'attack';
      envStates[index].value = 0;
      envStates[index].holdLeft = env.hold;
      envStates[index].triggerArmed = false;
    });

    attackDial.input.addEventListener('change', () => {
      env.attack = Number(attackDial.input.value);
    });
    decayDial.input.addEventListener('change', () => {
      env.decay = Number(decayDial.input.value);
    });
    sustainDial.input.addEventListener('change', () => {
      env.sustain = Number(sustainDial.input.value);
    });
    releaseDial.input.addEventListener('change', () => {
      env.release = Number(releaseDial.input.value);
    });
    holdDial.input.addEventListener('change', () => {
      env.hold = Number(holdDial.input.value);
    });
    triggerSelect.addEventListener('change', () => {
      env.trigger = triggerSelect.value as typeof env.trigger;
    });
    thresholdDial.input.addEventListener('change', () => {
      env.threshold = Number(thresholdDial.input.value);
    });

    row.appendChild(label);
    row.appendChild(attackDial.wrapper);
    row.appendChild(decayDial.wrapper);
    row.appendChild(sustainDial.wrapper);
    row.appendChild(releaseDial.wrapper);
    row.appendChild(holdDial.wrapper);
    row.appendChild(triggerSelect);
    row.appendChild(thresholdDial.wrapper);
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

    const rateDial = createDial({
      value: sh.rate,
      min: 0.05,
      max: 8,
      step: 0.05,
      onChange: (value) => {
        sh.rate = value;
      },
      title: 'Rate',
      label: 'Rate'
    });

    const syncToggle = document.createElement('input');
    syncToggle.type = 'checkbox';
    syncToggle.checked = sh.sync;
    const syncWrap = document.createElement('label');
    syncWrap.className = 'dial-toggle';
    const syncText = document.createElement('span');
    syncText.textContent = 'Sync';
    syncWrap.appendChild(syncText);
    syncWrap.appendChild(syncToggle);

    const smoothDial = createDial({
      value: sh.smooth,
      min: 0,
      max: 1,
      step: 0.05,
      onChange: (value) => {
        sh.smooth = value;
      },
      title: 'Smooth',
      format: (value) => value.toFixed(2),
      label: 'Smooth'
    });

    rateDial.input.addEventListener('change', () => {
      sh.rate = Number(rateDial.input.value);
    });
    syncToggle.addEventListener('change', () => {
      sh.sync = syncToggle.checked;
    });
    smoothDial.input.addEventListener('change', () => {
      sh.smooth = Number(smoothDial.input.value);
    });

    row.appendChild(label);
    row.appendChild(rateDial.wrapper);
    row.appendChild(syncWrap);
    row.appendChild(smoothDial.wrapper);
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

const initAssetTabs = () => {
  const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>('.asset-tab'));
  if (tabs.length === 0) return;
  const panels = Array.from(document.querySelectorAll<HTMLElement>('.asset-tab-panel'));
  const setActive = (key: string) => {
    tabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.assetTab === key));
    panels.forEach((panel) => panel.classList.toggle('active', panel.dataset.assetPanel === key));
  };
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const key = tab.dataset.assetTab;
      if (key) setActive(key);
    });
  });
  const initial = tabs.find((tab) => tab.classList.contains('active'))?.dataset.assetTab;
  if (initial) setActive(initial);
};

const applyPlasmaShaderFromScene = async (scene: SceneConfig) => {
  const plasmaLayer = scene.layers.find((layer) => layer.id === 'layer-plasma');
  const shaderId = plasmaLayer?.params?.shaderId as string | undefined;
  const asset = getShaderAssetById(shaderId ?? null);
  if (!asset) {
    applyPlasmaShaderSource(null, 'Default', scene);
    shaderTargetSelect.value = shaderTargetDraftValue;
    return;
  }
  const source = await loadShaderSourceForAsset(asset);
  if (!source) {
    applyPlasmaShaderSource(null, 'Default', scene);
    shaderTargetSelect.value = shaderTargetDraftValue;
    return;
  }
  applyPlasmaShaderSource(source, asset.name, scene);
  shaderTargetSelect.value = `${shaderTargetAssetPrefix}${asset.id}`;
};

let syncRendererPalette: (() => void) | undefined;

const applyScene = (sceneId: string, options: { skipShaderWarmup?: boolean; transitionSource?: TransitionSource } = {}) => {
  if (!preservePresetPreviewState && presetPreviewBaseProject) {
    clearPresetPreviewState();
  }
  const activation = resolveSceneActivationRuntime(currentProject, sceneId);
  if (!activation) return;
  const { scene } = activation;

  const prevScene = currentProject.scenes.find(s => s.id === currentProject.activeSceneId) ?? null;
  sessionLog.log('info', 'scene.switch', {
    fromSceneId: prevScene?.id ?? '',
    fromSceneName: prevScene?.name ?? '',
    toSceneId: sceneId,
    toSceneName: scene.name,
    source: options.transitionSource ?? 'manual',
  });
  const prevGenIds = prevScene ? [...collectSceneGeneratorIds(prevScene)] : [];
  if (currentProject.sdf?.enabled) {
    prevGenIds.push('gen-sdf');
  }
  const nextGenIds = [...collectSceneGeneratorIds(scene)];
  if (activation.project.sdf?.enabled) {
    nextGenIds.push('gen-sdf');
  }
  const newCustomBlocksHash = (currentProject.customShaderBlocks ?? []).map(b => b.id).sort().join(',');
  const customBlocksDidChange = newCustomBlocksHash !== lastKnownCustomBlocksHash;
  transitionTracerSeq = transitionTracer.beginTransition({
    prevSceneId: prevScene?.id ?? null,
    prevSceneName: prevScene?.name ?? null,
    nextSceneId: sceneId,
    nextSceneName: scene.name,
    source: options.transitionSource ?? 'manual',
    fromGenerators: prevGenIds,
    toGenerators: nextGenIds,
    blendTransitionStarted: false,
    customBlocksChanged: customBlocksDidChange,
    compilePendingGenerators: renderer.getPendingProgramGenerators?.() ?? null
  });
  lastKnownCustomBlocksHash = newCustomBlocksHash;
  postTransitionFramesLeft = 5;

  currentProject = activation.project;
  // Reset the modMatrix temporal low-pass so the new scene's connections start
  // fresh — a stale `prev` from the prior scene's connections (possibly reused
  // ids) would otherwise bleed a convergence transient into the first frames.
  modSmoothingState.clear();
  transitionTracer.recordStep(transitionTracerSeq, 'sceneStateSwapped');
  previewSceneId = sceneId;
  if (scene.look) {
    initStylePresets();
    initPalettes();
    initMacros();
    initEffects();
    initParticles();
    initSdf();
    syncVisualizerFromProject();
    renderModMatrix();
  }

  const runtime = applySceneActivationRuntime(activation, {
    transportTimeMs,
    onVisualTransition: (transition) => {
      currentTransitionType = transition.type;
      currentTransitionAmount = transition.amount;
      currentTransitionDecay = transition.decay;
    },
    startBlendTransition: (fromSnapshot, toSnapshot, at, durationMs, curve) => {
      sceneManager.startTransition(fromSnapshot, toSnapshot, at, durationMs, curve as 'linear' | 'easeInOut');
      if (transitionTracerSeq !== null) {
        transitionTracer.recordStep(transitionTracerSeq, 'layerStateApplied');
        transitionTracer.setBlendTransitionStarted(transitionTracerSeq);
      }
    },
    clearBlendTransition: () => {
      sceneManager.clearTransition();
      if (transitionTracerSeq !== null) {
        transitionTracer.recordStep(transitionTracerSeq, 'layerStateApplied');
      }
    },
    markSceneActivated: (at) => {
      sceneManager.markSceneActivated(at);
    },
    setPaletteApplied: (applied) => {
      paletteApplyToggle.checked = applied;
    },
    compileSceneShaders: (targetScene, targetProject) => {
      const seq = transitionTracerSeq;
      if (seq !== null) transitionTracer.recordStep(seq, 'generatorInitStarted');
      const count = compileSceneShaders(renderer, targetScene, targetProject, targetProject.customShaderBlocks ?? [], targetProject.sdf?.enabled ?? false);
      if (seq !== null) {
        const wasAsync = renderer.hasPendingProgram?.() ?? false;
        const wasCacheHit = !wasAsync;
        transitionTracer.setExpectedShaderVariantKey(seq, getRendererShaderVariantKey());
        transitionTracer.recordStep(seq, 'generatorReinitialized', prevGenIds.join(',') !== nextGenIds.join(',') || customBlocksDidChange);
        transitionTracer.recordStep(seq, 'fxGraphRebuilt', true);
        transitionTracer.recordStep(seq, 'shaderProgramSelected');
        transitionTracer.recordCompileResult(seq, wasCacheHit, wasAsync);
      }
      return count;
    },
    skipShaderWarmup: options.skipShaderWarmup
  });
  if (runtime.activeGeneratorCount !== null) {
    console.log(`[Scene] Applied scene ${scene.name}, recompiled shaders for ${runtime.activeGeneratorCount} active generators`);
  }
  syncRendererPalette?.();
  broadcastCurrentOutputState();
  if (sceneSelect) sceneSelect.value = sceneId;
  if (sceneTransitionTypeSelect) {
    sceneTransitionTypeSelect.value = scene.transition_in?.type || 'fade';
  }
  renderLayerList();
  syncPerformanceToggles();
  renderSceneStrip();
  renderSceneTimeline();
  modTargetOptions = buildModTargetOptions();
  midiTargetOptions = buildMidiTargetOptions();
  if (activeMode === 'mapping') {
    renderMappingTargets(mappingTargetSearch?.value ?? '');
  }
  if (activeMode === 'mixer') {
    mixerPanel?.render();
  }
  void applyPlasmaShaderFromScene(scene);
};

/**
 * Apply a scene with a one-shot transition override.
 * Temporarily patches both the to-scene's transition_in and the from-scene's transition_out
 * so that resolveTransitionDuration returns the correct duration, then restores both.
 * Pass null for an instant cut (suppresses all blending and visual transitions).
 */
const applySceneWithTransitionOverride = (sceneId: string, transition: SceneTransition | null) => {
  const toScene = currentProject.scenes.find((s) => s.id === sceneId);
  if (!toScene) { applyScene(sceneId); return; }

  const fromScene = currentProject.scenes.find((s) => s.id === currentProject.activeSceneId);
  const origToIn = toScene.transition_in;
  const origFromOut = fromScene?.transition_out;

  if (transition === null) {
    // Cut: zero both sides so blend duration = max(0,0) = 0 and no visual transition fires
    toScene.transition_in = { durationMs: 0, curve: 'linear' };
    if (fromScene) fromScene.transition_out = { durationMs: 0, curve: 'linear' };
  } else {
    toScene.transition_in = transition;
    if (fromScene) fromScene.transition_out = { durationMs: transition.durationMs, curve: transition.curve };
  }

  applyScene(sceneId);

  toScene.transition_in = origToIn;
  if (fromScene) fromScene.transition_out = origFromOut;
};

const addSceneFromPreset = async (presetPath: string) => {
  const traceId = createPresetTraceId();
  logPresetDebug(traceId, 'Loading preset for scene', { presetPath });
  const result = await window.visualSynth.loadPreset(presetPath);
  if (result.error) {
    logPresetError(traceId, 'Preset load failed', { presetPath, error: result.error });
    setStatus(`Preset load failed: ${result.error}`);
    await ensureSafeVisuals(traceId, result.error);
    return null;
  }

  if (!result.preset) {
    const reasonText = 'Preset load returned no data.';
    setStatus(reasonText);
    await ensureSafeVisuals(traceId, reasonText);
    return null;
  }

  const presetMigration = await import('../shared/presetMigration');
  const migrationResult = presetMigration.migratePreset(result.preset);
  if (!migrationResult.success) {
    const reasonText = migrationResult.errors.join(', ') || 'Preset migration failed.';
    logPresetError(traceId, 'Preset migration failed', {
      presetPath,
      errors: migrationResult.errors,
      warnings: migrationResult.warnings
    });
    setStatus(`Preset migration failed: ${reasonText}`);
    await ensureSafeVisuals(traceId, reasonText);
    return null;
  }

  const validationResult = presetMigration.validatePreset(migrationResult.preset);
  if (!validationResult.valid) {
    const reasonText = validationResult.errors.join(', ') || 'Preset validation failed.';
    logPresetError(traceId, 'Preset validation failed', {
      presetPath,
      errors: validationResult.errors,
      warnings: validationResult.warnings
    });
    setStatus(`Preset validation failed: ${reasonText}`);
    await ensureSafeVisuals(traceId, reasonText);
    return null;
  }
  if (validationResult.warnings.length > 0) {
    logPresetDebug(traceId, 'Preset validation warnings', validationResult.warnings);
  }

  const migratedPreset = migrationResult.preset;
  let sourceProject: VisualSynthProject | null = null;

  if (migratedPreset.version === 6) {
    const applyResult = presetMigration.applyPresetV6(migratedPreset, currentProject);
    sourceProject = applyResult.project ?? null;
  } else if (migratedPreset.version === 5) {
    const applyResult = presetMigration.applyPresetV5(migratedPreset, currentProject);
    sourceProject = applyResult.project ?? null;
  } else if (migratedPreset.version === 4) {
    const applyResult = presetMigration.applyPresetV4(migratedPreset, currentProject);
    sourceProject = applyResult.project ?? null;
  } else if (migratedPreset.version === 3) {
    const applyResult = presetMigration.applyPresetV3(migratedPreset, currentProject);
    sourceProject = applyResult.project ?? null;
  } else {
    sourceProject = migratedPreset as VisualSynthProject;
  }

  if (!sourceProject || sourceProject.scenes.length === 0) {
    const reasonText = 'Preset has no scenes to add.';
    setStatus(reasonText);
    await ensureSafeVisuals(traceId, reasonText);
    return null;
  }
  const sourceScene =
    sourceProject.scenes.find((scene) => scene.id === sourceProject?.activeSceneId) ??
    sourceProject.scenes[0];
  const presetName = presetSelect.selectedOptions[0]?.textContent ?? presetPath;
  // Only lock palette in scene look if the preset JSON explicitly specified one.
  // Using currentProject's activePaletteId would lock every loaded scene to whatever
  // palette happened to be active, preventing the user from changing it.
  const presetExplicitPaletteId: string | undefined =
    migratedPreset.activePaletteId ||
    migratedPreset.project?.activePaletteId ||
    migratedPreset.project?.scenes?.[0]?.look?.activePaletteId ||
    undefined;
  const addedSceneId = addSceneFromSourceProject(sourceProject, {
    sourceSceneId: sourceScene.id,
    sceneName: presetName,
    explicitPaletteId: presetExplicitPaletteId,
    statusLabel: 'Scene added from preset',
    presetPath
  });
  if (!addedSceneId) return null;
  const newScene = currentProject.scenes.find((scene) => scene.id === addedSceneId);
  if (!newScene) return null;
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
  return newScene.id;
};

const refreshSceneFromPreset = async (sceneId: string): Promise<boolean> => {
  const scene = currentProject.scenes.find((s) => s.id === sceneId);
  if (!scene) {
    console.warn(`[Refresh] Scene not found: ${sceneId}`);
    return false;
  }

  if (!scene.presetPath) {
    console.warn(`[Refresh] Scene has no presetPath: ${scene.name}`);
    return false;
  }

  const result = await window.visualSynth.loadPreset(scene.presetPath);
  if (result.error) {
    console.error(`[Refresh] Load error for ${scene.name}: ${result.error}`);
    return false;
  }

  if (!result.preset) {
    console.error(`[Refresh] No preset data for ${scene.name}`);
    return false;
  }

  const presetMigration = await import('../shared/presetMigration');
  const migrationResult = presetMigration.migratePreset(result.preset);
  if (!migrationResult.success) {
    console.error(`[Refresh] Migration failed for ${scene.name}:`, migrationResult.errors);
    return false;
  }

  const validationResult = presetMigration.validatePreset(migrationResult.preset);
  if (!validationResult.valid) {
    console.error(`[Refresh] Validation failed for ${scene.name}:`, validationResult.errors);
    return false;
  }

  const migratedPreset = migrationResult.preset;
  let sourceProject: VisualSynthProject | null = null;

  if (migratedPreset.version === 6) {
    sourceProject = presetMigration.applyPresetV6(migratedPreset, currentProject).project ?? null;
  } else if (migratedPreset.version === 5) {
    sourceProject = presetMigration.applyPresetV5(migratedPreset, currentProject).project ?? null;
  } else if (migratedPreset.version === 4) {
    sourceProject = presetMigration.applyPresetV4(migratedPreset, currentProject).project ?? null;
  } else if (migratedPreset.version === 3) {
    sourceProject = presetMigration.applyPresetV3(migratedPreset, currentProject).project ?? null;
  } else {
    sourceProject = migratedPreset as VisualSynthProject;
  }

  if (!sourceProject || sourceProject.scenes.length === 0) {
    console.error(`[Refresh] Preset has no scenes: ${scene.name}`);
    return false;
  }

  const sourceScene =
    sourceProject.scenes.find((s) => s.id === sourceProject?.activeSceneId) ??
    sourceProject.scenes[0];

  const assetIdMap = new Map<string, string>();
  const referencedAssetIds = new Set<string>();
  sourceScene.layers.forEach((layer) => {
    if (layer.assetId) referencedAssetIds.add(layer.assetId);
  });

  if (sourceProject.assets?.length && referencedAssetIds.size > 0) {
    const nextAssets = [...currentProject.assets];
    sourceProject.assets.forEach((asset) => {
      if (!referencedAssetIds.has(asset.id)) return;
      const hasCollision = nextAssets.some((existing) => existing.id === asset.id);
      const newId = hasCollision ? getNextAssetId() : asset.id;
      assetIdMap.set(asset.id, newId);
      nextAssets.push({ ...cloneValue(asset), id: newId });
    });
    currentProject.assets = nextAssets;
    renderAssets();
  }

  // Prefer the preset's per-scene look over its project-level fields (see
  // addSceneFromSourceProject for why). Keep the existing scene's active
  // palette first — a refresh re-applies the preset but should not clobber a
  // palette the user changed after import — falling back to the source scene's
  // look, then the project field, so the palette is never orphaned.
  const sourceSceneLook = sourceScene.look;
  const updatedLook: SceneLook = {
    effects: cloneValue(sourceSceneLook?.effects ?? sourceProject.effects ?? {}),
    particles: cloneValue(sourceSceneLook?.particles ?? sourceProject.particles ?? {}),
    sdf: cloneValue(sourceSceneLook?.sdf ?? sourceProject.sdf ?? {}),
    visualizer: cloneValue(sourceSceneLook?.visualizer ?? sourceProject.visualizer ?? {}),
    stylePresets: cloneValue(sourceSceneLook?.stylePresets ?? sourceProject.stylePresets ?? []),
    activeStylePresetId: cloneValue(
      sourceSceneLook?.activeStylePresetId ?? sourceProject.activeStylePresetId ?? ''
    ),
    palettes: cloneValue(sourceSceneLook?.palettes ?? sourceProject.palettes ?? []),
    activePaletteId:
      scene.look?.activePaletteId ??
      sourceSceneLook?.activePaletteId ??
      sourceProject.activePaletteId,
    macros: cloneValue(sourceSceneLook?.macros ?? sourceProject.macros ?? []),
    modMatrix: cloneValue(sourceSceneLook?.modMatrix ?? sourceProject.modMatrix ?? [])
  };

  const sceneIndex = currentProject.scenes.findIndex((s) => s.id === sceneId);
  if (sceneIndex === -1) return false;

  currentProject.scenes[sceneIndex] = {
    ...scene,
    intent: sourceScene.intent ?? scene.intent,
    duration: typeof sourceScene.duration === 'number' ? sourceScene.duration : scene.duration,
    layers: sourceScene.layers.map((layer) => {
      const cloned = cloneLayerConfig(layer);
      if (cloned.assetId && assetIdMap.has(cloned.assetId)) {
        cloned.assetId = assetIdMap.get(cloned.assetId);
      }
      return cloned;
    }),
    look: updatedLook,
    _shaderData: sourceScene._shaderData ? cloneValue(sourceScene._shaderData) : undefined
  };

  compileSceneShaders(
    renderer,
    currentProject.scenes[sceneIndex],
    currentProject,
    currentProject.customShaderBlocks ?? [],
    currentProject.sdf?.enabled ?? false
  );

  renderSceneStrip();
  renderSceneTimeline();
  markProjectDirty();
  setStatus(`Refreshed scene: ${scene.name}`);
  return true;
};

const refreshAllScenesFromPresets = async (): Promise<void> => {
  const scenesWithPresets = currentProject.scenes.filter((s) => s.presetPath);
  if (scenesWithPresets.length === 0) {
    setStatus('No scenes with preset paths to refresh.');
    return;
  }

  const total = scenesWithPresets.length;
  let successCount = 0;
  let failCount = 0;
  const errors: string[] = [];

  console.log(`[Refresh] Starting refresh of ${total} scenes...`);
  setStatus(`Refreshing ${total} scenes...`);

  for (let i = 0; i < scenesWithPresets.length; i++) {
    const scene = scenesWithPresets[i];
    try {
      const success = await refreshSceneFromPreset(scene.id);
      if (success) {
        successCount++;
        if (successCount % 20 === 0) {
          console.log(`[Refresh] Progress: ${successCount}/${total}`);
        }
      } else {
        failCount++;
        console.warn(`[Refresh] Failed (returned false): ${scene.name}`);
      }
    } catch (err) {
      failCount++;
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${scene.name}: ${msg}`);
      console.error(`[Refresh] Exception for "${scene.name}":`, err);
    }
  }

  console.log(`[Refresh] Complete: ${successCount} success, ${failCount} failed`);
  if (errors.length > 0 && errors.length <= 10) {
    console.error('[Refresh] Errors:', errors);
  }

  if (failCount === 0) {
    setStatus(`Refreshed all ${successCount} scene(s) from disk.`);
  } else {
    setStatus(`Refreshed ${successCount} scene(s), ${failCount} failed.`);
  }
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
  const isCustomRange = bpmRangeSelect.value === 'custom';
  bpmCustomRangeRow.classList.toggle('hidden', !isCustomRange);
  bpmMinInput.disabled = !isCustomRange;
  bpmMaxInput.disabled = !isCustomRange;
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
  if (bpmSource === 'manual') {
    transportBpmInput.value = String(Number(tempoInput.value) || 120);
  } else {
    transportBpmInput.value = value > 0 ? value.toFixed(1) : '';
  }
  if (bpmDisplay) {
    bpmDisplay.innerHTML =
      value > 0
        ? `BPM: <strong>${value.toFixed(1)}</strong> (${sourceLabel})`
        : `BPM: -- (${sourceLabel})`;
  }

  const now = performance.now();
  const recentOnsets = onsetTimes.filter((time) => now - time < 8000);
  let stateLabel = 'Idle';
  let stateClass = 'transport-state-idle';
  if (bpmSource === 'manual') {
    stateLabel = 'Manual';
    stateClass = 'transport-state-idle';
  } else if (bpmSource === 'network') {
    stateLabel = networkBpm ? 'Network' : 'Waiting';
    stateClass = networkBpm ? 'transport-state-stable' : 'transport-state-learning';
  } else if (audioState.rms < 0.02) {
    stateLabel = 'Listening';
    stateClass = 'transport-state-idle';
  } else if (!autoBpm || recentOnsets.length < 4) {
    stateLabel = 'Learning';
    stateClass = 'transport-state-learning';
  } else {
    const intervals: number[] = [];
    for (let i = 1; i < recentOnsets.length; i += 1) {
      intervals.push(recentOnsets[i] - recentOnsets[i - 1]);
    }
    const mean =
      intervals.reduce((sum, interval) => sum + interval, 0) / Math.max(1, intervals.length);
    const variance =
      intervals.reduce((sum, interval) => sum + (interval - mean) ** 2, 0) /
      Math.max(1, intervals.length);
    const stability = mean > 0 ? Math.sqrt(variance) / mean : 1;
    const estimateAgeMs = now - lastTempoEstimateTime;
    if (recentOnsets.length >= 6 && stability < 0.12 && estimateAgeMs < 2500) {
      stateLabel = 'Stable';
      stateClass = 'transport-state-stable';
    } else {
      stateLabel = 'Weak';
      stateClass = 'transport-state-weak';
    }
  }
  transportBpmState.textContent = stateLabel;
  transportBpmState.className = `transport-state ${stateClass}`;
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
  autoAssignFirstAsset(layer);
  renderLayerList();
};

const renderGeneratorList = (container: HTMLElement, items: GeneratorId[]) => {
  container.innerHTML = '';
  items.forEach((id) => {
    const entry = visibleGenerators.find((gen) => gen.id === id);
    if (!entry) return;
    const chip = document.createElement('div');
    chip.className = 'generator-chip';
    if (entry.supportsAsset) {
      chip.classList.add('supports-asset');
      chip.title = 'Supports image/video assets';
    }
    const label = document.createElement('span');
    label.textContent = entry.name;
    if (entry.supportsAsset) {
      const assetIcon = document.createElement('span');
      assetIcon.className = 'asset-support-icon';
      assetIcon.textContent = '🖼️';
      assetIcon.style.marginLeft = '4px';
      assetIcon.style.fontSize = '10px';
      label.appendChild(assetIcon);
    }
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
  const sorted = [...visibleGenerators].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  );
  sorted.forEach((gen) => {
    const option = document.createElement('option');
    option.value = gen.id;
    option.textContent = gen.supportsAsset ? `${gen.name} 🖼️` : gen.name;
    generatorSelect.appendChild(option);
  });
  renderGeneratorList(generatorFavorites, generatorFavoritesState);
  renderGeneratorList(generatorRecents, generatorRecentsState);
};

const ensureGeneratorLayer = (
  scene: SceneConfig,
  layerId: string,
  name: string,
  options?: { blendMode?: string; opacity?: number; role?: string }
) => {
  let layer = scene.layers.find((item) => item.id === layerId);
  if (!layer) {
    layer = {
      id: layerId,
      name,
      role: (options?.role ?? getDefaultRoleForLayerId(layerId)) as LayerConfig['role'],
      enabled: true,
      opacity: options?.opacity ?? 1,
      blendMode: (options?.blendMode ?? 'screen') as LayerConfig['blendMode'],
      transform: { x: 0, y: 0, scale: 1, rotation: 0 },
      params: buildDefaultParamsForLayerId(layerId)
    };
    scene.layers.push(layer);
  } else {
    layer.enabled = true;
    if (!layer.params) layer.params = {};
    applyDefaultParams(layerId, layer.params);
  }
  return layer;
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
  // Asset-based generators
  if (id === 'gen-asset-vortex') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      ensureLayerWithDefaults(scene, 'gen-asset-vortex', 'Asset Vortex');
      renderLayerList();
    }
    setStatus('Asset Vortex enabled. Add an asset in Layers panel.');
  }
  if (id === 'gen-asset-slices') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      ensureLayerWithDefaults(scene, 'gen-asset-slices', 'Asset Slices');
      renderLayerList();
    }
    setStatus('Asset Slices enabled. Add an asset in Layers panel.');
  }
  if (id === 'gen-asset-polar') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      ensureLayerWithDefaults(scene, 'gen-asset-polar', 'Asset Polar Warp');
      renderLayerList();
    }
    setStatus('Asset Polar Warp enabled. Add an asset in Layers panel.');
  }
  if (id === 'gen-asset-mosaic') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      ensureLayerWithDefaults(scene, 'gen-asset-mosaic', 'Asset Mosaic');
      renderLayerList();
    }
    setStatus('Asset Mosaic enabled. Add an asset in Layers panel.');
  }
  if (id === 'gen-asset-ripple') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      ensureLayerWithDefaults(scene, 'gen-asset-ripple', 'Asset Ripples');
      renderLayerList();
    }
    setStatus('Asset Ripples enabled. Add an asset in Layers panel.');
  }
  if (id === 'gen-asset-scatter') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      ensureLayerWithDefaults(scene, 'gen-asset-scatter', 'Asset Scatter');
      renderLayerList();
    }
    setStatus('Asset Scatter enabled. Add an asset in Layers panel.');
  }
  if (id === 'gen-asset-echo') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      ensureLayerWithDefaults(scene, 'gen-asset-echo', 'Asset Echo Ghosts');
      renderLayerList();
    }
    setStatus('Asset Echo Ghosts enabled. Add an asset in Layers panel.');
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
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      let layer = scene.layers.find((item) => item.id === 'gen-particle-swarm');
      if (!layer) {
        layer = {
          id: 'gen-particle-swarm',
          name: 'Particle Swarm',
          role: getDefaultRoleForLayerId('gen-particle-swarm'),
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
    setStatus('Generator: Particle Swarm added.');
  }
  if (id === 'variant-particle-swarm-bloom') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      let layer = scene.layers.find((item) => item.id === 'variant-particle-swarm-bloom');
      if (!layer) {
        layer = {
          id: 'variant-particle-swarm-bloom',
          name: 'Particle Swarm (Bloom)',
          role: getDefaultRoleForLayerId('variant-particle-swarm-bloom'),
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
  if (id === 'gen-laser-beam') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      ensureGeneratorLayer(scene, 'gen-laser-beam', 'Laser Beam Generator');
      renderLayerList();
    }
    setStatus('Generator: Laser Beam added.');
  }
  if (id === 'gen-strobe') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      ensureGeneratorLayer(scene, 'gen-strobe', 'Strobe Flash Generator', { blendMode: 'screen' });
      renderLayerList();
    }
    setStatus('Generator: Strobe Flash added.');
  }
  if (id === 'gen-shape-burst') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      ensureGeneratorLayer(scene, 'gen-shape-burst', 'Shape Burst Generator');
      renderLayerList();
    }
    setStatus('Generator: Shape Burst added.');
  }
  if (id === 'gen-grid-tunnel') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      ensureGeneratorLayer(scene, 'gen-grid-tunnel', 'Grid Tunnel Generator', { blendMode: 'screen' });
      renderLayerList();
    }
    setStatus('Generator: Grid Tunnel added.');
  }
  // Rock Generators
  if (id === 'gen-lightning') {
    const scene = getActiveScene();
    if (scene) {
      ensureGeneratorLayer(scene, 'gen-lightning', 'Lightning Bolt', { blendMode: 'add' });
      renderLayerList();
    }
    setStatus('Generator: Lightning Bolt added.');
  }
  if (id === 'gen-analog-oscillo') {
    const scene = getActiveScene();
    if (scene) {
      ensureGeneratorLayer(scene, 'gen-analog-oscillo', 'Analog Oscilloscope', { blendMode: 'screen' });
      renderLayerList();
    }
    setStatus('Generator: Analog Oscilloscope added.');
  }
  if (id === 'gen-speaker-cone') {
    const scene = getActiveScene();
    if (scene) {
      ensureGeneratorLayer(scene, 'gen-speaker-cone', 'Speaker Cone', { blendMode: 'normal' });
      renderLayerList();
    }
    setStatus('Generator: Speaker Cone added.');
  }
  if (id === 'gen-glitch-scanline') {
    const scene = getActiveScene();
    if (scene) {
      ensureGeneratorLayer(scene, 'gen-glitch-scanline', 'Glitch Scanline', { blendMode: 'screen' });
      renderLayerList();
    }
    setStatus('Generator: Glitch Scanline added.');
  }
  if (id === 'gen-laser-starfield') {
    const scene = getActiveScene();
    if (scene) {
      ensureGeneratorLayer(scene, 'gen-laser-starfield', 'Laser Starfield', { blendMode: 'screen' });
      renderLayerList();
    }
    setStatus('Generator: Laser Starfield added.');
  }
  if (id === 'gen-pulsing-ribbons') {
    const scene = getActiveScene();
    if (scene) {
      ensureGeneratorLayer(scene, 'gen-pulsing-ribbons', 'Pulsing Ribbons', { blendMode: 'screen' });
      renderLayerList();
    }
    setStatus('Generator: Pulsing Ribbons added.');
  }
  if (id === 'gen-electric-arc') {
    const scene = getActiveScene();
    if (scene) {
      ensureGeneratorLayer(scene, 'gen-electric-arc', 'Electric Arc', { blendMode: 'screen' });
      renderLayerList();
    }
    setStatus('Generator: Electric Arc added.');
  }
  if (id === 'gen-pyro-burst') {
    const scene = getActiveScene();
    if (scene) {
      ensureGeneratorLayer(scene, 'gen-pyro-burst', 'Pyro Burst', { blendMode: 'add' });
      renderLayerList();
    }
    setStatus('Generator: Pyro Burst added.');
  }
  if (id === 'gen-geo-wireframe') {
    const scene = getActiveScene();
    if (scene) {
      ensureGeneratorLayer(scene, 'gen-geo-wireframe', 'Geo Wireframe', { blendMode: 'screen' });
      renderLayerList();
    }
    setStatus('Generator: Geo Wireframe added.');
  }
  if (id === 'gen-signal-noise') {
    const scene = getActiveScene();
    if (scene) {
      ensureGeneratorLayer(scene, 'gen-signal-noise', 'Signal Noise', { blendMode: 'screen' });
      renderLayerList();
    }
    setStatus('Generator: Signal Noise added.');
  }
  // Tunnel Generators
  if (id === 'gen-infinite-wormhole') {
    const scene = getActiveScene();
    if (scene) {
      ensureGeneratorLayer(scene, 'gen-infinite-wormhole', 'Infinite Wormhole', { blendMode: 'screen' });
      renderLayerList();
    }
    setStatus('Generator: Infinite Wormhole added.');
  }
  if (id === 'gen-ribbon-tunnel') {
    const scene = getActiveScene();
    if (scene) {
      ensureGeneratorLayer(scene, 'gen-ribbon-tunnel', 'Ribbon Tunnel', { blendMode: 'add' });
      renderLayerList();
    }
    setStatus('Generator: Ribbon Tunnel added.');
  }
  if (id === 'gen-fractal-tunnel') {
    const scene = getActiveScene();
    if (scene) {
      ensureGeneratorLayer(scene, 'gen-fractal-tunnel', 'Fractal Tunnel', { blendMode: 'screen' });
      renderLayerList();
    }
    setStatus('Generator: Fractal Tunnel added.');
  }
  if (id === 'gen-circuit-conduit') {
    const scene = getActiveScene();
    if (scene) {
      ensureGeneratorLayer(scene, 'gen-circuit-conduit', 'Circuit Conduit', { blendMode: 'screen' });
      renderLayerList();
    }
    setStatus('Generator: Circuit Conduit added.');
  }
  // Unique Generators
  if (id === 'gen-aura-portal') {
    const scene = getActiveScene();
    if (scene) {
      ensureGeneratorLayer(scene, 'gen-aura-portal', 'Aura Portal', { blendMode: 'screen' });
      renderLayerList();
    }
    setStatus('Generator: Aura Portal added.');
  }
  if (id === 'gen-freq-terrain') {
    const scene = getActiveScene();
    if (scene) {
      ensureGeneratorLayer(scene, 'gen-freq-terrain', 'Frequency Terrain', { blendMode: 'add' });
      renderLayerList();
    }
    setStatus('Generator: Frequency Terrain added.');
  }
  if (id === 'gen-data-stream') {
    const scene = getActiveScene();
    if (scene) {
      ensureGeneratorLayer(scene, 'gen-data-stream', 'Data Stream', { blendMode: 'screen' });
      renderLayerList();
    }
    setStatus('Generator: Data Stream added.');
  }
  if (id === 'gen-caustic-liquid') {
    const scene = getActiveScene();
    if (scene) {
      ensureGeneratorLayer(scene, 'gen-caustic-liquid', 'Caustic Liquid', { blendMode: 'screen' });
      renderLayerList();
    }
    setStatus('Generator: Caustic Liquid added.');
  }
  if (id === 'gen-shimmer-veil') {
    const scene = getActiveScene();
    if (scene) {
      ensureGeneratorLayer(scene, 'gen-shimmer-veil', 'Shimmer Veil', { blendMode: 'add' });
      renderLayerList();
    }
    setStatus('Generator: Shimmer Veil added.');
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
  if (id === 'gen-crystal-growth') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      ensureGeneratorLayer(scene, 'gen-crystal-growth', 'Crystal Growth Generator', { blendMode: 'screen' });
      renderLayerList();
    }
    setStatus('Generator: Crystal Growth added.');
  }
  if (id === 'gen-prism-shards') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      ensureGeneratorLayer(scene, 'gen-prism-shards', 'Prism Shards Generator', { blendMode: 'add' });
      renderLayerList();
    }
    setStatus('Generator: Prism Shards added.');
  }
  if (id === 'gen-neural-net') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      ensureGeneratorLayer(scene, 'gen-neural-net', 'Neural Net Generator', { blendMode: 'screen' });
      renderLayerList();
    }
    setStatus('Generator: Neural Net added.');
  }
  if (id === 'gen-hypercube') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      ensureGeneratorLayer(scene, 'gen-hypercube', 'Hypercube Generator', { blendMode: 'screen' });
      renderLayerList();
    }
    setStatus('Generator: Hypercube added.');
  }
  // New Unique Generators
  if (id === 'gen-cellular-growth') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      ensureGeneratorLayer(scene, 'gen-cellular-growth', 'Cellular Growth', { blendMode: 'screen' });
      renderLayerList();
    }
    setStatus('Generator: Cellular Growth added.');
  }
  if (id === 'gen-bio-luminescent-forest') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      ensureGeneratorLayer(scene, 'gen-bio-luminescent-forest', 'Bio-Luminescent Forest', { blendMode: 'screen' });
      renderLayerList();
    }
    setStatus('Generator: Bio-Luminescent Forest added.');
  }
  if (id === 'gen-crystalline') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      ensureGeneratorLayer(scene, 'gen-crystalline', 'Crystalline', { blendMode: 'add' });
      renderLayerList();
    }
    setStatus('Generator: Crystalline added.');
  }
  if (id === 'gen-audio-dna') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      ensureGeneratorLayer(scene, 'gen-audio-dna', 'Audio DNA', { blendMode: 'screen' });
      renderLayerList();
    }
    setStatus('Generator: Audio DNA added.');
  }
  if (id === 'gen-liquid-metal') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      ensureGeneratorLayer(scene, 'gen-liquid-metal', 'Liquid Metal', { blendMode: 'screen' });
      renderLayerList();
    }
    setStatus('Generator: Liquid Metal added.');
  }
  if (id === 'gen-neon-cityscape') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      ensureGeneratorLayer(scene, 'gen-neon-cityscape', 'Neon Cityscape', { blendMode: 'screen' });
      renderLayerList();
    }
    setStatus('Generator: Neon Cityscape added.');
  }
  if (id === 'gen-cosmic-nebula') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      ensureGeneratorLayer(scene, 'gen-cosmic-nebula', 'Cosmic Nebula', { blendMode: 'screen' });
      renderLayerList();
    }
    setStatus('Generator: Cosmic Nebula added.');
  }
  if (id === 'gen-sonic-rain') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      ensureGeneratorLayer(scene, 'gen-sonic-rain', 'Sonic Rain', { blendMode: 'screen' });
      renderLayerList();
    }
    setStatus('Generator: Sonic Rain added.');
  }
  if (id === 'gen-morphing-geometry') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      ensureGeneratorLayer(scene, 'gen-morphing-geometry', 'Morphing Geometry', { blendMode: 'screen' });
      renderLayerList();
    }
    setStatus('Generator: Morphing Geometry added.');
  }
  if (id === 'gen-urban-rhythm') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      ensureGeneratorLayer(scene, 'gen-urban-rhythm', 'Urban Rhythm', { blendMode: 'screen' });
      renderLayerList();
    }
    setStatus('Generator: Urban Rhythm added.');
  }
  if (id === 'gen-crimson-veil') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      ensureGeneratorLayer(scene, 'gen-crimson-veil', 'Crimson Veil', { blendMode: 'screen' });
      renderLayerList();
    }
    setStatus('Generator: Crimson Veil added.');
  }
  if (id === 'gen-victorian-crypt') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      ensureGeneratorLayer(scene, 'gen-victorian-crypt', 'Victorian Crypt', { blendMode: 'screen' });
      renderLayerList();
    }
    setStatus('Generator: Victorian Crypt added.');
  }
  if (id === 'gen-spectral-apparition') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      ensureGeneratorLayer(scene, 'gen-spectral-apparition', 'Spectral Apparition', { blendMode: 'screen' });
      renderLayerList();
    }
    setStatus('Generator: Spectral Apparition added.');
  }
  if (id === 'gen-gothic-cobwebs') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      ensureGeneratorLayer(scene, 'gen-gothic-cobwebs', 'Gothic Cobwebs', { blendMode: 'multiply' });
      renderLayerList();
    }
    setStatus('Generator: Gothic Cobwebs added.');
  }
  if (id === 'gen-blood-moon-rise') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      ensureGeneratorLayer(scene, 'gen-blood-moon-rise', 'Blood Moon Rise', { blendMode: 'screen' });
      renderLayerList();
    }
    setStatus('Generator: Blood Moon Rise added.');
  }
  if (id === 'gen-candlelight-vigil') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      ensureGeneratorLayer(scene, 'gen-candlelight-vigil', 'Candlelight Vigil', { blendMode: 'screen' });
      renderLayerList();
    }
    setStatus('Generator: Candlelight Vigil added.');
  }
  if (id === 'gen-gargoyles-awake') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      ensureGeneratorLayer(scene, 'gen-gargoyles-awake', 'Gargoyles Awake', { blendMode: 'screen' });
      renderLayerList();
    }
    setStatus('Generator: Gargoyles Awake added.');
  }
  if (id === 'gen-crypt-shadows') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      ensureGeneratorLayer(scene, 'gen-crypt-shadows', 'Crypt Shadows', { blendMode: 'multiply' });
      renderLayerList();
    }
    setStatus('Generator: Crypt Shadows added.');
  }
  if (id === 'gen-gothic-rose') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      ensureGeneratorLayer(scene, 'gen-gothic-rose', 'Gothic Rose', { blendMode: 'screen' });
      renderLayerList();
    }
    setStatus('Generator: Gothic Rose added.');
  }
  if (id === 'gen-eternal-darkness') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      ensureGeneratorLayer(scene, 'gen-eternal-darkness', 'Eternal Darkness', { blendMode: 'multiply' });
      renderLayerList();
    }
    setStatus('Generator: Eternal Darkness added.');
  }
  if (id === 'gen-pixel-dust') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      ensureGeneratorLayer(scene, 'gen-pixel-dust', 'Pixel Dust', { blendMode: 'screen' });
      renderLayerList();
    }
    setStatus('Generator: Pixel Dust added.');
  }
  if (id === 'gen-retro-starfield') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      ensureGeneratorLayer(scene, 'gen-retro-starfield', 'Retro Starfield', { blendMode: 'screen' });
      renderLayerList();
    }
    setStatus('Generator: Retro Starfield added.');
  }
  if (id === 'gen-8bit-grid') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      ensureGeneratorLayer(scene, 'gen-8bit-grid', '8-Bit Grid', { blendMode: 'screen' });
      renderLayerList();
    }
    setStatus('Generator: 8-Bit Grid added.');
  }
  if (id === 'gen-arcade-invaders') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      ensureGeneratorLayer(scene, 'gen-arcade-invaders', 'Arcade Invaders', { blendMode: 'screen' });
      renderLayerList();
    }
    setStatus('Generator: Arcade Invaders added.');
  }
  if (id === 'gen-power-up-pulse') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      ensureGeneratorLayer(scene, 'gen-power-up-pulse', 'Power-Up Pulse', { blendMode: 'screen' });
      renderLayerList();
    }
    setStatus('Generator: Power-Up Pulse added.');
  }
  if (id === 'gen-dungeon-tiles') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      ensureGeneratorLayer(scene, 'gen-dungeon-tiles', 'Dungeon Tiles', { blendMode: 'multiply' });
      renderLayerList();
    }
    setStatus('Generator: Dungeon Tiles added.');
  }
  if (id === 'gen-chiptune-wave') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      ensureGeneratorLayer(scene, 'gen-chiptune-wave', 'Chiptune Wave', { blendMode: 'screen' });
      renderLayerList();
    }
    setStatus('Generator: Chiptune Wave added.');
  }
  if (id === 'gen-score-counter') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      ensureGeneratorLayer(scene, 'gen-score-counter', 'Score Counter', { blendMode: 'screen' });
      renderLayerList();
    }
    setStatus('Generator: Score Counter added.');
  }
  if (id === 'gen-pixel-rain') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      ensureGeneratorLayer(scene, 'gen-pixel-rain', 'Pixel Rain', { blendMode: 'screen' });
      renderLayerList();
    }
    setStatus('Generator: Pixel Rain added.');
  }
  if (id === 'gen-boss-health') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      ensureGeneratorLayer(scene, 'gen-boss-health', 'Boss Health', { blendMode: 'screen' });
      renderLayerList();
    }
    setStatus('Generator: Boss Health added.');
  }
  generatorRecentsState = updateRecents(generatorRecentsState, id);
  saveGeneratorLibrary();
  refreshGeneratorUI();
  
  const activeScene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
  if (activeScene) {
    compileSceneShaders(renderer, activeScene, currentProject, currentProject.customShaderBlocks ?? [], currentProject.sdf?.enabled ?? false, true);
  }
};

const applyMidiTargetValue = (target: string, value: number, isToggle = false) => {
  if (target === 'layer-plasma.enabled') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      const layer = ensureLayerWithDefaults(scene, 'layer-plasma', 'Shader Plasma');
      const next = isToggle ? !layer.enabled : value > 0.5;
      layer.enabled = next;
      recordPlaylistOverride('layer-plasma', { enabled: next });
      if (plasmaToggle) plasmaToggle.checked = next;
      renderLayerList();
    }
    return;
  }
  if (target === 'layer-spectrum.enabled') {
    const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
    if (scene) {
      const layer = ensureLayerWithDefaults(scene, 'layer-spectrum', 'Spectrum Bars');
      const next = isToggle ? !layer.enabled : value > 0.5;
      layer.enabled = next;
      recordPlaylistOverride('layer-spectrum', { enabled: next });
      if (spectrumToggle) spectrumToggle.checked = next;
      renderLayerList();
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
  if (target === 'gen-laser-beam.opacity') {
    midiSum[target] = scaleMidiValue(value, 0, 1);
    return;
  }
  if (target === 'gen-laser-beam.beamWidth') {
    midiSum[target] = scaleMidiValue(value, 0.2, 3);
    return;
  }
  if (target === 'gen-laser-beam.rotationSpeed') {
    midiSum[target] = scaleMidiValue(value, 0, 3);
    return;
  }
  if (target === 'gen-laser-beam.colorShift') {
    midiSum[target] = scaleMidiValue(value, 0, 1);
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
    return;
  }
  if (target.startsWith('playlist-slot-')) {
    const index = Number(target.split('-')[2]) - 1;
    if (value > 0.5) {
      void triggerPlaylistSlot(index);
    }
    return;
  }
  if (target.startsWith('modMatrix.') && target.endsWith('.enabled')) {
    // MIDI-learn target for a modulation-matrix connection's enable toggle.
    // Format: modMatrix.<connectionId>.enabled — the id (not positional index)
    // is used so reordering/deleting other rows never retargets the mapping.
    const connId = target.slice('modMatrix.'.length, -'.enabled'.length);
    const conn = currentProject.modMatrix.find((c) => c.id === connId);
    if (conn) {
      conn.enabled = isToggle ? conn.enabled === false : value > 0.5;
      renderModMatrix();
      renderLayerList();
    }
    return;
  }
};

const armMidiLearn = (target: string, label: string) => {
  midiLearnEnabled = true;
  learnTarget = { target, label };
  updateMidiLearnToggle();
  updateMappingHud();
  setStatus(`MIDI Learn: move a control for ${label}`);
};

const initLearnables = () => {
  // Only bind elements that haven't been bound yet. renderLayerList rebuilds the
  // layer toggle checkboxes (new DOM nodes with data-learn-target) on every
  // call; without re-binding, MIDI-learn clicks on layer toggles stop working
  // after any scene switch / layer add. The data-learn-bound guard keeps this
  // idempotent so persistent elements (macro rows) don't accumulate duplicate
  // listeners on repeated calls.
  const learnables = document.querySelectorAll<HTMLElement>('[data-learn-target]:not([data-learn-bound])');
  learnables.forEach((element) => {
    element.dataset.learnBound = '1';
    element.addEventListener('click', () => {
      if (!midiLearnEnabled) return;
      const target = element.dataset.learnTarget;
      const label = element.dataset.learnLabel ?? target ?? 'Parameter';
      if (!target) return;
      armMidiLearn(target, label);
    });
  });
};

const createDial = (options: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
  title?: string;
  label?: string;
}) => {
  const wrapper = document.createElement('div');
  wrapper.className = 'dial-control';
  if (options.title) wrapper.title = options.title;

  const label = document.createElement('div');
  label.className = 'dial-label';
  label.textContent = options.label ?? '';

  const visual = document.createElement('div');
  visual.className = 'dial-visual';

  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(options.min);
  input.max = String(options.max);
  input.step = String(options.step);
  input.value = String(options.value);
  input.className = 'dial-input';

  const valueLabel = document.createElement('div');
  valueLabel.className = 'dial-value';

  const updateDial = () => {
    const value = Number(input.value);
    const percent =
      options.max === options.min
        ? 0
        : ((value - options.min) / (options.max - options.min)) * 100;
    wrapper.style.setProperty('--dial', `${percent}%`);
    wrapper.style.setProperty('--dial-rotation', `${percent * 3.6}deg`);
    valueLabel.textContent = options.format ? options.format(value) : value.toFixed(2);
  };

  input.addEventListener('input', () => {
    const value = Number(input.value);
    options.onChange(value);
    updateDial();
  });

  updateDial();

  if (label.textContent) {
    wrapper.appendChild(label);
  }
  wrapper.appendChild(visual);
  wrapper.appendChild(input);
  wrapper.appendChild(valueLabel);
  return { wrapper, input, valueLabel };
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

const initEngineSelect = () => {
  if (!engineSelect) return;
  engineSelect.innerHTML = '';
  Object.values(ENGINE_REGISTRY).forEach((engine) => {
    const option = document.createElement('option');
    option.value = engine.id;
    option.textContent = engine.name;
    engineSelect.appendChild(option);
  });
  const activeId = currentProject.activeEngineId as EngineId | undefined;
  if (activeId && ENGINE_REGISTRY[activeId]) {
    engineSelect.value = activeId;
    if (engineDescription) {
      engineDescription.textContent = ENGINE_REGISTRY[activeId].description;
    }
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

syncRendererPalette = () => {
  const palette =
    currentProject.palettes.find((item) => item.id === currentProject.activePaletteId) ??
    currentProject.palettes[0];
  if (!palette) return;
  renderPalettePreview(palette.colors);
  renderer?.setPalette?.(palette.colors);
};

const broadcastCurrentOutputState = () => {
  if (!outputOpen) return;
  // Defer by one animation frame so lastOutputRenderState reflects the newly
  // activated scene's uniforms rather than the previous scene's stale state.
  requestAnimationFrame(() => {
    if (!outputOpen || !lastOutputRenderState) return;
    const broadcastScene =
      currentProject.scenes.find((scene) => scene.id === currentProject.activeSceneId) ??
      currentProject.scenes[0];
    const generatorIds = broadcastScene ? collectSceneGeneratorIds(broadcastScene) : new Set<string>();
    if (currentProject.sdf?.enabled) {
      generatorIds.add('gen-sdf');
    }
    outputChannel.postMessage(
      buildRendererOutputBroadcastPayload({
        renderState: lastOutputRenderState,
        project: currentProject,
        scene: broadcastScene,
        activePaletteId:
          broadcastScene?.look?.activePaletteId ??
          currentProject.activePaletteId,
        activeGeneratorIds: [...generatorIds],
        shaderVariantKey: getRendererShaderVariantKey(),
        transition: getLatestTransitionPayload()
      })
    );
  });
};

const applyPaletteSelection = (paletteId: string) => {
  const palette =
    currentProject.palettes.find((item) => item.id === paletteId) ?? currentProject.palettes[0];
  if (!palette) return;
  currentProject.activePaletteId = palette.id;
  syncRendererPalette?.();
  outputChannel.postMessage({ paletteColors: palette.colors });
  // Sync mixer palette select if it exists
  const mixerSelect = document.getElementById('mixer-palette-select') as HTMLSelectElement | null;
  if (mixerSelect && mixerSelect.value !== palette.id) mixerSelect.value = palette.id;

  const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
  if (paletteApplyToggle.checked && scene) {
    scene.look = {
      ...scene.look,
      palettes: cloneValue(currentProject.palettes),
      activePaletteId: palette.id
    };
  }
  renderPerfPaletteGrid();
};

const resetPaletteToSceneDefault = () => {
  const scene = currentProject.scenes.find((s) => s.id === currentProject.activeSceneId);
  if (!scene?.look?.activePaletteId) {
    setStatus('Scene does not have a custom palette to reset to.');
    return;
  }
  
  scene.look = {
    ...scene.look,
    activePaletteId: undefined
  };
  
  syncRendererPalette?.();
  outputChannel.postMessage({ paletteColors: currentProject.palettes.find((p) => p.id === currentProject.activePaletteId)?.colors });
  setStatus('Palette reset to scene default');
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
  
  // Sync Chemistry
  if (currentProject.colorChemistry?.includes('triadic')) chemistrySelect.value = 'triadic';
  else if (currentProject.colorChemistry?.includes('complementary')) chemistrySelect.value = 'complementary';
  else if (currentProject.colorChemistry?.includes('monochromatic')) chemistrySelect.value = 'monochromatic';
  else chemistrySelect.value = 'analog';

  paletteSelect.onchange = () => {
    applyPaletteSelection(paletteSelect.value);
    // Keep the mixer's mirrored palette select in sync (the mixer panel owns a
    // duplicate of this control; without this, changing it here leaves the
    // mixer showing the previous palette until it is next rebuilt).
    const mixerPalette = document.getElementById('mixer-palette-select') as HTMLSelectElement | null;
    if (mixerPalette) mixerPalette.value = paletteSelect.value;
  };
  chemistrySelect.onchange = () => {
    currentProject.colorChemistry = [chemistrySelect.value];
    setStatus(`Color Chemistry set to: ${chemistrySelect.value}`);
    // Mirror to the mixer's duplicate chemistry select.
    const mixerChem = document.getElementById('mixer-chemistry-select') as HTMLSelectElement | null;
    if (mixerChem) mixerChem.value = chemistrySelect.value;
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
  
  const paletteResetBtn = document.getElementById('palette-reset-btn') as HTMLButtonElement | null;
  if (paletteResetBtn) {
    paletteResetBtn.onclick = resetPaletteToSceneDefault;
  }
  renderPerfPaletteGrid();
};

function renderPerfPaletteGrid() {
  if (!perfPaletteGrid) return;
  perfPaletteGrid.innerHTML = '';
  const palettes = currentProject.palettes;
  palettes.forEach((palette) => {
    const swatch = document.createElement('div');
    swatch.className = `perf-palette-swatch${palette.id === currentProject.activePaletteId ? ' active' : ''}`;
    swatch.title = palette.name;
    const gradient = palette.colors.map((c, i) => {
      const pct = (i / (palette.colors.length - 1)) * 100;
      return `${c} ${pct}%`;
    }).join(', ');
    swatch.style.background = `linear-gradient(to right, ${gradient})`;
    swatch.addEventListener('click', () => {
      applyPaletteSelection(palette.id);
      paletteSelect.value = palette.id;
      renderPerfPaletteGrid();
      setStatus(`Palette: ${palette.name}`);
    });
    perfPaletteGrid.appendChild(swatch);
  });
}

const applyStyleControls = () => {
  if (!activeStyleId) return;
  const preset = currentProject.stylePresets.find((item) => item.id === activeStyleId);
  if (!preset) return;
  preset.settings.contrast = Number(styleContrast.value);
  preset.settings.saturation = Number(styleSaturation.value);
  preset.settings.paletteShift = Number(styleShift.value);
  syncActiveSceneLookSection(currentProject, 'stylePresets', currentProject.stylePresets);
  syncActiveSceneLookSection(currentProject, 'activeStylePresetId', currentProject.activeStylePresetId);
};

const initMacros = () => {
  macroList.innerHTML = '';
  macroInputs = [];
  macroPreviewRows = [];
  
  const engineId = currentProject.activeEngineId as EngineId;
  const engine = ENGINE_REGISTRY[engineId];
  const engineMacroCount = engine ? engine.macros.length : 8;

  currentProject.macros.forEach((macro, index) => {
    const isEngineMacro = index < engineMacroCount;
    const row = document.createElement('div');
    row.className = `macro-row${!isEngineMacro ? ' macro-inactive' : ''}`;

    const label = document.createElement('div');
    label.className = 'macro-label';
    label.textContent = macro.name || `Macro ${index + 1}`;

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '1';
    slider.step = '0.01';
    slider.value = String(macro.value);
    slider.disabled = !isEngineMacro;
    slider.dataset.learnTarget = `macro-${index + 1}.value`;
    slider.dataset.learnLabel = macro.name || `Macro ${index + 1}`;
    slider.addEventListener('input', () => {
      macro.value = Number(slider.value);
      updateMacroPreviews();
      // Also update hero sliders if visible
      if (index < 4) {
          const heroSlider = [macroEnergy, macroMotion, macroColor, macroDensity][index];
          if (heroSlider) heroSlider.value = slider.value;
      }
    });

    const learn = document.createElement('button');
    learn.className = 'macro-learn';
    learn.textContent = 'Learn';
    learn.disabled = !isEngineMacro;
    learn.addEventListener('click', () => {
      armMidiLearn(slider.dataset.learnTarget!, slider.dataset.learnLabel!);
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

  // Update Macro Hero Grid Visibility
  const heroItems = macroHero?.querySelectorAll('.macro-hero-item');
  heroItems?.forEach((item, index) => {
      (item as HTMLElement).style.opacity = index < engineMacroCount ? '1' : '0.2';
      (item as HTMLElement).style.pointerEvents = index < engineMacroCount ? 'auto' : 'none';
  });

  initLearnables();
  updateMacroPreviews();
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
  expressiveFxEnabled.checked = expressive.enabled ?? true;
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
  syncActiveSceneLookSection(currentProject, 'macros', currentProject.macros);
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
      role: 'support' as LayerConfig['role'],
      enabled: true,
      opacity: 1,
      blendMode: 'normal' as LayerConfig['blendMode'],
      transform: { x: 0, y: 0, scale: 1, rotation: 0 },
      sdfScene: {
        nodes: [],
        connections: [],
        mode: '2d'
      }
    };
    scene.layers.push(layer);
    renderLayerList();
  } else {
    if (!layer.enabled) {
      layer.enabled = true;
      renderLayerList();
    }
    if (!layer.sdfScene) {
      layer.sdfScene = {
        nodes: [],
        connections: [],
        mode: '2d'
      };
    }
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
  syncActiveSceneLookSection(currentProject, 'effects', currentProject.effects as any);
};

const applyExpressiveFxControls = () => {
  currentProject.expressiveFx = {
    enabled: expressiveFxEnabled.checked,
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
  syncActiveSceneLookSection(currentProject, 'particles', currentProject.particles);
};

let sdfPanelRenderRaf = 0;
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
  syncActiveSceneLookSection(currentProject, 'sdf', currentProject.sdf);
  if (sdfAdvancedToggle.checked) {
    // The project state update above is synchronous (the renderer reads it
    // directly), but rebuilding the advanced SDF editor is deferred and
    // coalesced to one per animation frame. Without this, a stream of `input`
    // events (e.g. a macro/modulation driving a simple control while the
    // advanced editor is open) rebuilt the whole advanced panel on every tick,
    // interrupting in-progress dial drags inside it.
    if (sdfPanelRenderRaf) return;
    sdfPanelRenderRaf = requestAnimationFrame(() => {
      sdfPanelRenderRaf = 0;
      sdfPanel?.render();
    });
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
    const plasmaScene = currentProject.scenes.find((s) => s.id === currentProject.activeSceneId);
    const plasmaLayer = plasmaScene?.layers.find((l) => l.id === 'layer-plasma');
    if (plasmaLayer) plasmaLayer.enabled = padStates[logicalIndex];
    return;
  }
  if (action === 'toggle-spectrum') {
    padStates[logicalIndex] = !padStates[logicalIndex];
    updatePadUI(localIndex, padStates[logicalIndex]);
    if (spectrumToggle) spectrumToggle.checked = padStates[logicalIndex];
    const spectrumScene = currentProject.scenes.find((s) => s.id === currentProject.activeSceneId);
    const spectrumLayer = spectrumScene?.layers.find((l) => l.id === 'layer-spectrum');
    if (spectrumLayer) spectrumLayer.enabled = padStates[logicalIndex];
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
      if (sceneSelect) sceneSelect.value = nextScene.id;
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

  // If device labels are empty, permissions haven't been granted yet
  const needsPermission = inputs.length > 0 && inputs.every(device => !device.label);

  if (needsPermission) {
    // Show helpful message
    requestMicPermissionButton.style.display = 'block';
    requestMicPermissionButton.style.background = '#ff6b35';
    requestMicPermissionButton.style.fontWeight = 'bold';
    audioSelect.innerHTML = '<option>Click "Grant Microphone Permission" button</option>';
    return;
  }

  // Reset button styling
  requestMicPermissionButton.style.display = '';
  requestMicPermissionButton.style.background = '';
  requestMicPermissionButton.style.fontWeight = '';

  audioSelect.innerHTML = '';
  if (inputs.length === 0) {
    audioSelect.innerHTML = '<option>No microphone found</option>';
    return;
  }

  inputs.forEach((device, index) => {
    const option = document.createElement('option');
    option.value = device.deviceId;
    option.textContent = device.label || `Input ${index + 1}`;
    audioSelect.appendChild(option);
  });
};

const updateNowPlayingStatusText = () => {
  if (!nowPlayingSettings.enabled) {
    nowPlayingStatus.textContent = 'Disabled';
    return;
  }

  if (isNowPlayingMetadataSourceConfigured(nowPlayingSettings)) {
    const fallbackLabel = isNowPlayingLookupConfigured(nowPlayingSettings)
      ? ' with recognition fallback'
      : '';
    nowPlayingStatus.textContent = `Metadata bridge primary${fallbackLabel}.`;
    return;
  }

  if (!isNowPlayingLookupConfigured(nowPlayingSettings)) {
    nowPlayingStatus.textContent = `Enabled, but ${nowPlayingSettings.provider} is not fully configured.`;
    return;
  }

  const providerLabel =
    nowPlayingSettings.provider === 'audd'
      ? 'AudD'
      : nowPlayingSettings.provider === 'acrcloud'
        ? 'ACRCloud'
        : nowPlayingSettings.provider === 'shazam'
          ? 'Shazam Proxy'
          : 'Custom Webhook';
  nowPlayingStatus.textContent = `Enabled via ${providerLabel}.`;
};

const syncNowPlayingProviderFields = () => {
  const provider = nowPlayingProviderSelect.value as NowPlayingSettings['provider'];
  const showEndpoint = provider === 'custom';
  const showHost = provider === 'acrcloud';
  const showSecret = provider === 'acrcloud';
  const showApiKey = provider !== 'shazam';

  nowPlayingEndpointGroup.classList.toggle('hidden', !showEndpoint);
  nowPlayingHostGroup.classList.toggle('hidden', !showHost);
  nowPlayingApiSecretGroup.classList.toggle('hidden', !showSecret);
  nowPlayingApiKeyGroup.classList.toggle('hidden', !showApiKey);
  nowPlayingMetadataUrlGroup.classList.toggle('hidden', !nowPlayingMetadataEnabledInput.checked);
  nowPlayingMetadataSecretGroup.classList.toggle('hidden', !nowPlayingMetadataEnabledInput.checked);

  nowPlayingProviderHint.textContent =
    nowPlayingMetadataEnabledInput.checked
      ? 'Metadata bridge mode polls a local service like What\'s Now Playing first, then falls back to audio recognition if configured.'
      : provider === 'audd'
      ? 'AudD uses your API token directly from the app.'
      : provider === 'acrcloud'
        ? 'ACRCloud requires host, access key, and access secret.'
        : provider === 'shazam'
          ? 'Shazam identifies tracks directly — no API key or proxy needed. Uses the Shazam mobile app endpoint.'
          : 'Custom mode posts the captured clip to your own lookup endpoint.';
};

const openNowPlayingModal = () => {
  nowPlayingEnabledInput.checked = nowPlayingSettings.enabled;
  nowPlayingMetadataEnabledInput.checked = nowPlayingSettings.metadataSourceEnabled;
  nowPlayingMetadataUrlInput.value = nowPlayingSettings.metadataSourceUrl;
  nowPlayingMetadataSecretInput.value = nowPlayingSettings.metadataSourceSecret;
  nowPlayingProviderSelect.value = nowPlayingSettings.provider;
  nowPlayingEndpointInput.value = nowPlayingSettings.endpoint;
  nowPlayingHostInput.value = nowPlayingSettings.host;
  nowPlayingApiKeyInput.value = nowPlayingSettings.apiKey;
  nowPlayingApiSecretInput.value = nowPlayingSettings.apiSecret;
  nowPlayingClipDurationInput.value = String(nowPlayingSettings.clipDurationMs);
  nowPlayingCooldownInput.value = String(nowPlayingSettings.cooldownMs);
  nowPlayingArtworkPreferenceSelect.value = nowPlayingSettings.artworkPreference;
  nowPlayingAutoOverlaysInput.checked = nowPlayingSettings.autoCreateOverlays;
  nowPlayingTestStatus.textContent = 'No lookup test run yet.';
  syncNowPlayingProviderFields();
  nowPlayingModal.classList.remove('hidden');
};

const closeNowPlayingModal = () => {
  nowPlayingModal.classList.add('hidden');
};

const applyWhatsNowPlayingDraftPreset = () => {
  nowPlayingEnabledInput.checked = true;
  nowPlayingMetadataEnabledInput.checked = true;
  if (!nowPlayingMetadataUrlInput.value.trim()) {
    nowPlayingMetadataUrlInput.value = DEFAULT_NOW_PLAYING_SETTINGS.metadataSourceUrl;
  }
  if (!nowPlayingProviderSelect.value) {
    nowPlayingProviderSelect.value = DEFAULT_NOW_PLAYING_SETTINGS.provider;
  }
  if (!nowPlayingArtworkPreferenceSelect.value) {
    nowPlayingArtworkPreferenceSelect.value = DEFAULT_NOW_PLAYING_SETTINGS.artworkPreference;
  }
  nowPlayingAutoOverlaysInput.checked = true;
  syncNowPlayingProviderFields();
};

const applyNowPlayingSettings = (settings: Partial<NowPlayingSettings>) => {
  Object.assign(nowPlayingSettings, DEFAULT_NOW_PLAYING_SETTINGS, settings);
  updateNowPlayingStatusText();
};

const buildNowPlayingDraftSettings = (): NowPlayingSettings => ({
  ...nowPlayingSettings,
  enabled: nowPlayingEnabledInput.checked,
  metadataSourceEnabled: nowPlayingMetadataEnabledInput.checked,
  metadataSourceUrl: nowPlayingMetadataUrlInput.value.trim(),
  metadataSourceSecret: nowPlayingMetadataSecretInput.value.trim(),
  provider: nowPlayingProviderSelect.value as NowPlayingSettings['provider'],
  endpoint: nowPlayingEndpointInput.value.trim(),
  host: nowPlayingHostInput.value.trim(),
  apiKey: nowPlayingApiKeyInput.value.trim(),
  apiSecret: nowPlayingApiSecretInput.value.trim(),
  clipDurationMs: Math.max(4000, Number(nowPlayingClipDurationInput.value) || 12000),
  cooldownMs: Math.max(5000, Number(nowPlayingCooldownInput.value) || 15000),
  artworkPreference: nowPlayingArtworkPreferenceSelect.value as NowPlayingSettings['artworkPreference'],
  autoCreateOverlays: nowPlayingAutoOverlaysInput.checked
});

const consumeNowPlayingResult = async (
  result: NowPlayingRecognitionResponse,
  statusPrefix: string
) => {
  if (!result.matched) {
    clearNowPlayingOverlays();
    setStatus(result.error ? `${statusPrefix}: ${result.error}` : `${statusPrefix}: no match found.`);
    return;
  }

  let artworkResult = result;
  const missingArtwork =
    !result.artworkUrl ||
    (nowPlayingSettings.artworkPreference === 'artist' && !result.artistImageUrl);

  if (missingArtwork && (result.title || result.artist || result.album)) {
    const enrichedArtwork = await window.visualSynth.enrichNowPlayingArtwork({
      title: result.title,
      artist: result.artist,
      album: result.album,
      market: nowPlayingSettings.market || undefined
    });

    artworkResult = {
      ...result,
      artworkUrl: result.artworkUrl || enrichedArtwork.artworkUrl,
      artistImageUrl: result.artistImageUrl || enrichedArtwork.artistImageUrl,
      provider: result.provider || enrichedArtwork.provider
    };
  }

  const preferredArtworkUrl =
    nowPlayingSettings.artworkPreference === 'artist'
      ? artworkResult.artistImageUrl || artworkResult.artworkUrl
      : artworkResult.artworkUrl || artworkResult.artistImageUrl;
  let artworkPath: string | undefined;
  if (preferredArtworkUrl) {
    const cached = await window.visualSynth.cacheRemoteArtwork(preferredArtworkUrl);
    if (cached.cached) {
      artworkPath = cached.filePath;
    }
  }

  updateNowPlayingOverlays({
    title: artworkResult.title,
    artist: artworkResult.artist,
    album: artworkResult.album,
    artworkPath
  });

  const songLabel = [artworkResult.title, artworkResult.artist].filter(Boolean).join(' - ');
  setStatus(songLabel ? `${statusPrefix}: ${songLabel}` : `${statusPrefix} updated.`);
};

const ensureNowPlayingOverlay = (type: 'text' | 'image', overlayId: string): OverlayConfig => {
  if (!currentProject.overlays) currentProject.overlays = [];
  let overlay = currentProject.overlays.find((item) => item.id === overlayId);
  if (overlay) return overlay;

  const targetSceneId = previewSceneId ?? currentProject.activeSceneId;

  overlay =
    type === 'text'
      ? {
          id: overlayId,
          name: 'Now Playing',
          type: 'text',
          enabled: true,
          x: 0.03,
          y: 0.82,
          width: 0.38,
          height: 0.13,
          opacity: 1,
          rotation: 0,
          includeInFx: false,
          text: 'Listening...',
          fontSize: 30,
          fontColor: '#ffffff',
          fontWeight: 'bold',
          textShadow: true,
          targetSceneId
        }
      : {
          id: overlayId,
          name: 'Now Playing Artwork',
          type: 'image',
          enabled: true,
          x: 0.03,
          y: 0.62,
          width: 0.14,
          height: 0.18,
          opacity: 0.95,
          rotation: 0,
          includeInFx: false,
          targetSceneId
        };

  currentProject.overlays.push(overlay);
  renderOverlayList();
  return overlay;
};

const clearNowPlayingOverlays = () => {
  if (!nowPlayingSettings.autoCreateOverlays) return;
  
  const titleOverlay = currentProject.overlays?.find(
    (item) => item.id === nowPlayingSettings.titleOverlayId && item.type === 'text'
  );
  if (titleOverlay) {
    titleOverlay.text = '';
  }
  
  const artworkOverlay = currentProject.overlays?.find(
    (item) => item.id === nowPlayingSettings.artworkOverlayId && item.type === 'image'
  );
  if (artworkOverlay) {
    artworkOverlay.enabled = false;
    artworkOverlay.assetPath = undefined;
  }
};

const updateNowPlayingOverlays = (track: {
  title?: string;
  artist?: string;
  album?: string;
  artworkPath?: string;
}) => {
  if (!nowPlayingSettings.autoCreateOverlays) return;

  const titleOverlay = ensureNowPlayingOverlay('text', nowPlayingSettings.titleOverlayId);
  const title = track.title?.trim() || 'Unknown Track';
  const artist = track.artist?.trim() || 'Unknown Artist';
  const albumLine = track.album?.trim() ? `\n${track.album.trim()}` : '';
  titleOverlay.text = `${title}\n${artist}${albumLine}`;

  const artworkOverlay = ensureNowPlayingOverlay('image', nowPlayingSettings.artworkOverlayId);
  if (track.artworkPath) {
    artworkOverlay.assetPath = track.artworkPath;
    artworkOverlay.enabled = true;
  }
};

const blobToBase64 = async (blob: Blob): Promise<string> => {
  const arrayBuffer = await blob.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(arrayBuffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
};

interface BuildRecognitionRequestResult {
  request?: NowPlayingRecognitionRequest;
  error?: string;
  diagnostics?: {
    clipSizeKb: number;
    clipDurationMs: number;
    pcmSamples?: number;
    pcmDurationMs?: number;
  };
}

const buildRecognitionRequest = async (
  capture: ReturnType<typeof createRollingAudioCapture>,
  clip: RecentAudioClip,
  settings: NowPlayingSettings,
  detectedAt: number
): Promise<BuildRecognitionRequestResult> => {
  const diagnostics: BuildRecognitionRequestResult['diagnostics'] = {
    clipSizeKb: Math.round(clip.blob.size / 1024 * 10) / 10,
    clipDurationMs: Math.max(0, clip.endedAt - clip.startedAt)
  };

  if (settings.provider === 'shazam') {
    // Try raw PCM export first (bypasses WebM/Opus decode issues). The capture
    // instance is passed in (rather than referenced as a free variable) so this
    // helper doesn't depend on the caller's block-scoped `rollingAudioCapture`
    // -- which was out of scope here and would have thrown ReferenceError on
    // the Shazam path.
    const pcmClip = capture.exportRecentPcm?.(settings.clipDurationMs);
    if (pcmClip && pcmClip.pcmS16le.length >= 48000) {
      const rawCopy = new Uint8Array(pcmClip.pcmS16le.byteLength);
      rawCopy.set(new Uint8Array(
        pcmClip.pcmS16le.buffer,
        pcmClip.pcmS16le.byteOffset,
        pcmClip.pcmS16le.byteLength
      ));
      const audioBase64 = await blobToBase64(new Blob([rawCopy.buffer as ArrayBuffer]));
      diagnostics.pcmSamples = pcmClip.numSamples;
      diagnostics.pcmDurationMs = pcmClip.durationMs;
      console.log(`[Now Playing] Shazam using raw PCM: ${pcmClip.numSamples} samples, ${pcmClip.durationMs}ms`);
      return {
        request: {
          provider: 'shazam',
          audioBase64,
          mimeType: 'audio/pcm-s16le',
          numSamples: pcmClip.numSamples,
          durationMs: pcmClip.durationMs,
          market: settings.market || undefined,
          detectedAt
        },
        diagnostics
      };
    }
    console.warn('[Now Playing] PCM capture unavailable for Shazam, falling back to blob decode...');

    const decodeResult = await decodeClipToPcmWithDiagnostics(clip);
    if (!decodeResult.success || !decodeResult.pcm) {
      return {
        error: decodeResult.error || 'Failed to decode audio for Shazam.',
        diagnostics
      };
    }
    diagnostics.pcmSamples = decodeResult.pcm.numSamples;
    diagnostics.pcmDurationMs = decodeResult.pcm.durationMs;

    const rawCopy = new Uint8Array(decodeResult.pcm.pcmS16le.byteLength);
    rawCopy.set(new Uint8Array(
      decodeResult.pcm.pcmS16le.buffer,
      decodeResult.pcm.pcmS16le.byteOffset,
      decodeResult.pcm.pcmS16le.byteLength
    ));
    const audioBase64 = await blobToBase64(new Blob([rawCopy.buffer as ArrayBuffer]));
    return {
      request: {
        provider: 'shazam',
        audioBase64,
        mimeType: 'audio/pcm-s16le',
        numSamples: decodeResult.pcm.numSamples,
        durationMs: decodeResult.pcm.durationMs,
        market: settings.market || undefined,
        detectedAt
      },
      diagnostics
    };
  }

  const audioBase64 = await blobToBase64(clip.blob);
  return {
    request: {
      provider: settings.provider,
      endpoint: settings.endpoint || undefined,
      host: settings.host || undefined,
      apiKey: settings.apiKey || undefined,
      apiSecret: settings.apiSecret || undefined,
      market: settings.market || undefined,
      audioBase64,
      mimeType: clip.mimeType,
      durationMs: diagnostics.clipDurationMs,
      detectedAt
    },
    diagnostics
  };
};

const testNowPlayingLiveInput = async (settings: NowPlayingSettings) => {
  const logMessages: string[] = [];
  const log = (msg: string) => {
    logMessages.push(msg);
    console.log(msg);
  };
  log('[Now Playing Test] testNowPlayingLiveInput called, provider: ' + settings.provider + ', enabled: ' + settings.enabled);
  if (!isNowPlayingLookupConfigured(settings)) {
    nowPlayingTestStatus.textContent = 'Provider settings are incomplete.';
    return;
  }

  const rollingAudioCapture = getAudioEngineSafe()?.getRollingAudioCapture();
  if (!rollingAudioCapture || !rollingAudioCapture.isActive()) {
    nowPlayingTestStatus.textContent = 'Audio capture not active. Start audio input first.';
    log('[Now Playing Test] Audio capture not active');
    return;
  }

  const stats = rollingAudioCapture.getStats();
  log('[Now Playing Test] Capture stats: ' + JSON.stringify(stats));
  const minWaitMs = 10000;
  if (stats.captureDurationMs < minWaitMs && stats.totalChunks < 8) {
    const waitSeconds = Math.ceil((minWaitMs - stats.captureDurationMs) / 1000);
    nowPlayingTestStatus.textContent = `Capturing audio... wait ~${waitSeconds}s more (${stats.totalChunks} chunks, ${(stats.totalBytes / 1024).toFixed(1)}KB)`;
    return;
  }

  nowPlayingTestStatus.textContent = `Exporting ${Math.round(settings.clipDurationMs / 1000)}s clip from ${stats.totalChunks} chunks...`;
  log('[Now Playing Test] Exporting clip...');

  const exportResult = await rollingAudioCapture.exportRecentClipWithDiagnostics(settings.clipDurationMs);
  if (!exportResult.success || !exportResult.clip) {
    const detail = exportResult.errorDetail;
    if (detail) {
      nowPlayingTestStatus.textContent = `${exportResult.error} (${detail.selectedChunks}/${detail.totalChunks} chunks, ${(detail.totalBytes / 1024).toFixed(1)}KB)`;
      log('[Now Playing Test] Export failed: ' + JSON.stringify(detail));
    } else {
      nowPlayingTestStatus.textContent = exportResult.error || 'Failed to export audio clip.';
      log('[Now Playing Test] Export failed: ' + exportResult.error);
    }
    alert('SHAZAM TEST FAILED:\n\n' + logMessages.join('\n') + '\n\nStatus: ' + nowPlayingTestStatus.textContent);
    return;
  }

  const clip = exportResult.clip;
  log('[Now Playing Test] Clip exported: ' + clip.blob.size + ' bytes, mimeType: ' + clip.mimeType);
  nowPlayingTestStatus.textContent = `Validating ${(clip.blob.size / 1024).toFixed(1)}KB audio...`;

  log('[Now Playing Test] Calling decodeClipToPcmWithDiagnostics...');

  // For Shazam, try raw PCM export first (bypasses WebM/Opus decode issues).
  // Build the request inline from the exported PCM rather than calling
  // buildRecognitionRequest, which would call exportRecentPcm a SECOND time
  // and, if that second export returned null (a ring-buffer timing edge),
  // discard the already-exported clean PCM and fall through to a lossy
  // WebM/Opus decode. We already have the bytes — use them directly.
  if (settings.provider === 'shazam') {
    log('[Now Playing Test] Using raw PCM export for Shazam...');
    const pcmData = rollingAudioCapture.exportRecentPcm(settings.clipDurationMs);
    if (pcmData && pcmData.pcmS16le.length >= 48000) {
      log(`[Now Playing Test] PCM export success: ${pcmData.numSamples} samples, ${pcmData.durationMs}ms`);
      const rawCopy = new Uint8Array(pcmData.pcmS16le.byteLength);
      rawCopy.set(new Uint8Array(pcmData.pcmS16le.buffer, pcmData.pcmS16le.byteOffset, pcmData.pcmS16le.byteLength));
      const audioBase64 = await blobToBase64(new Blob([rawCopy.buffer as ArrayBuffer]));
      log(`[Now Playing Test] Built Shazam request from raw PCM: ${pcmData.numSamples} samples, ${pcmData.durationMs}ms`);
      const result = await window.visualSynth.identifyNowPlaying({
        provider: 'shazam',
        audioBase64,
        mimeType: 'audio/pcm-s16le',
        numSamples: pcmData.numSamples,
        durationMs: pcmData.durationMs,
        market: settings.market || undefined,
        detectedAt: Date.now()
      });
      log(`[Now Playing Test] Shazam result: matched=${result.matched}, title=${result.title}, artist=${result.artist}`);
      await consumeNowPlayingResult(result, 'Shazam live test');
      return;
    }
    log('[Now Playing Test] PCM export failed or too short, falling back to blob decode...');
  }

  const diagnosticDecode = await decodeClipToPcmWithDiagnostics(clip);
  log('[Now Playing Test] Decode result: ' + diagnosticDecode.success + ' ' + (diagnosticDecode.error || ''));
  if (diagnosticDecode.errorDetail) {
    log('[Now Playing Test] Error detail: ' + JSON.stringify(diagnosticDecode.errorDetail));
  }
  let actualDurationSec: string;
  let energy = 0;
  
  if (!diagnosticDecode.success || !diagnosticDecode.pcm) {
    if (settings.provider === 'shazam') {
      nowPlayingTestStatus.textContent = diagnosticDecode.error || 'Failed to validate audio quality.';
      console.error('[Now Playing] Audio validation failed for Shazam:', diagnosticDecode.errorDetail);
      return;
    }
    
    const estimatedDurationSec = Math.round((clip.blob.size / 32000) * 10) / 10;
    actualDurationSec = `${estimatedDurationSec}s (estimated)`;
    console.warn('[Now Playing] Audio decode skipped for non-Shazam provider:', {
      error: diagnosticDecode.error,
      blobSize: clip.blob.size,
      estimatedDuration: actualDurationSec,
      provider: settings.provider
    });
    
    if (estimatedDurationSec < 6) {
      nowPlayingTestStatus.textContent = `Audio may be too short (~${estimatedDurationSec}s). Wait longer before testing.`;
      return;
    }
  } else {
    actualDurationSec = (diagnosticDecode.pcm.durationMs / 1000).toFixed(1);
    const minDurationSec = 6;
    
    if (diagnosticDecode.pcm.durationMs < 6000) {
      nowPlayingTestStatus.textContent = `Audio too short: ${actualDurationSec}s captured, need at least ${minDurationSec}s. Wait longer before testing.`;
      console.warn('[Now Playing] Insufficient duration:', {
        actualDuration: actualDurationSec,
        minDuration: minDurationSec,
        samples: diagnosticDecode.pcm.numSamples,
        recommendation: 'Wait 15+ seconds before testing'
      });
      return;
    }

    energy = diagnosticDecode.pcm.pcmS16le.length > 0 ? 
      Math.sqrt(Array.from(diagnosticDecode.pcm.pcmS16le).reduce((sum, s) => sum + s * s, 0) / diagnosticDecode.pcm.pcmS16le.length) / 32768 : 0;
  }
  
  console.log('[Now Playing] Audio diagnostics:', {
    blobSize: `${(clip.blob.size / 1024).toFixed(1)}KB`,
    actualDuration: actualDurationSec,
    energy: energy.toFixed(4),
    mimeType: clip.mimeType
  });

  nowPlayingTestStatus.textContent = `Running ${settings.provider} lookup (${actualDurationSec}s audio, ${(clip.blob.size / 1024).toFixed(1)}KB)...`;

  const buildResult = await buildRecognitionRequest(rollingAudioCapture, clip, settings, Date.now());
  if (!buildResult.request) {
    const diag = buildResult.diagnostics;
    if (diag) {
      nowPlayingTestStatus.textContent = `${buildResult.error} (clip: ${diag.clipSizeKb}KB, ${Math.round(diag.clipDurationMs / 1000)}s)`;
    } else {
      nowPlayingTestStatus.textContent = buildResult.error || 'Failed to prepare audio.';
    }
    return;
  }

  const result = await window.visualSynth.identifyNowPlaying(buildResult.request);

  if (!result.matched) {
    nowPlayingTestStatus.textContent = result.error || 'No match found from live input.';
    return;
  }

  const label = [result.title, result.artist].filter(Boolean).join(' - ');
  nowPlayingTestStatus.textContent = label || 'Live lookup succeeded.';
  await consumeNowPlayingResult(result, 'Live now playing test');
};

const runNowPlayingLookup = async (detectedAt: number) => {
  if (!isNowPlayingLookupConfigured(nowPlayingSettings)) return;
  if (nowPlayingLookupInFlight) return;
  if (detectedAt - lastNowPlayingLookupAt < nowPlayingSettings.cooldownMs) return;
  if (isNowPlayingMetadataSourceConfigured(nowPlayingSettings) && detectedAt - lastMetadataTrackAt < 5000) {
    return;
  }

  const rollingAudioCapture = getAudioEngineSafe()?.getRollingAudioCapture();
  if (!rollingAudioCapture) return;

  const exportResult = await rollingAudioCapture.exportRecentClipWithDiagnostics(nowPlayingSettings.clipDurationMs);
  if (!exportResult.success || !exportResult.clip) {
    setStatus(`Song change detected, but ${exportResult.error}`);
    return;
  }

  const clip = exportResult.clip;
  nowPlayingLookupInFlight = true;
  lastNowPlayingLookupAt = detectedAt;

  try {
    const buildResult = await buildRecognitionRequest(rollingAudioCapture, clip, nowPlayingSettings, detectedAt);
    if (buildResult.request) {
      const result = await window.visualSynth.identifyNowPlaying(buildResult.request);
      await consumeNowPlayingResult(result, 'Now playing');
    }
  } finally {
    nowPlayingLookupInFlight = false;
  }
};

const pollNowPlayingMetadataSource = async () => {
  if (!isNowPlayingMetadataSourceConfigured(nowPlayingSettings)) return;
  if (nowPlayingMetadataPollInFlight) return;
  const now = Date.now();
  if (now - lastMetadataPollAt < Math.max(500, nowPlayingSettings.metadataSourcePollMs || 1500)) return;
  lastMetadataPollAt = now;
  nowPlayingMetadataPollInFlight = true;
  try {
    const result = await window.visualSynth.fetchNowPlayingMetadata(
      nowPlayingSettings.metadataSourceUrl,
      nowPlayingSettings.metadataSourceSecret || undefined
    );
    if (!result.matched) {
      return;
    }
    const trackKey = [result.artist ?? '', result.title ?? '', result.album ?? ''].join('::');
    if (!trackKey.trim()) {
      return;
    }
    if (trackKey === lastMetadataTrackKey) {
      lastMetadataTrackAt = Date.now();
      return;
    }
    lastMetadataTrackKey = trackKey;
    lastMetadataTrackAt = Date.now();
    await consumeNowPlayingResult(result, 'Metadata bridge');
  } finally {
    nowPlayingMetadataPollInFlight = false;
  }
};

const setupAudio = async (deviceId?: string) => {
  const engine = getAudioEngineSafe();
  if (engine) {
    await engine.setup(deviceId);
    sessionLog.log('info', 'audio.engine_init', { deviceId: deviceId ?? 'default', deviceLabel: '' });
    engine.updateNowPlayingSettings(nowPlayingSettings);
    engine.onSongChange(({ detectedAt }) => {
      if (!isNowPlayingLookupConfigured(nowPlayingSettings)) {
        setStatus('Song change detected. Configure Now Playing in the System tab to enable lookup.');
        return;
      }
      void runNowPlayingLookup(detectedAt);
    });
  }
};

const updateAudioAnalysis = (deltaMs: number) => {
  const engine = getAudioEngineSafe();
  if (engine) {
    engine.update(deltaMs);
    const context = engine.getContext();
    if (context) {
      latencyLabel.textContent = `Audio Latency: ${Math.round(context.baseLatency * 1000)}ms`;
      const outputLatency = context.outputLatency ?? 0;
      outputLatencyLabel.textContent = outputLatency
        ? `Output Latency: ${Math.round(outputLatency * 1000)}ms`
        : 'Output Latency: --';
    }
  }
};

const updateNowPlayingDiagnosticsUI = () => {
  const engine = getAudioEngineSafe();
  if (!engine) return;

  const diag = engine.getSongDetectionDiagnostics();
  const { status, settings } = diag;

  sessionHealthService.updateSongDetection(status.state);

  if (!settings.enabled) {
    nowPlayingDiagnostics.classList.add('hidden');
    return;
  }

  nowPlayingDiagnostics.classList.remove('hidden');
  nowPlayingStateLabel.textContent = status.state;
  
  // Update colors based on state
  nowPlayingStateLabel.style.color = 
    status.state === 'listening' ? '#1ec8ff' :
    status.state === 'detected' ? '#4caf50' :
    status.state === 'cooldown' ? '#ffd166' :
    status.state === 'failed' ? '#ff4b4b' : '#fff';

  if (status.details) {
    const confidence = status.details.confidence ?? 0;
    nowPlayingConfidenceBar.style.width = `${confidence * 100}%`;
    nowPlayingConfidenceBar.style.backgroundColor = confidence > 0.8 ? '#4caf50' : '#1ec8ff';

    const bufferHealth = status.details.bufferHealth ?? 0;
    nowPlayingBufferBar.style.width = `${bufferHealth * 100}%`;
    nowPlayingBufferBar.style.backgroundColor = bufferHealth < 0.5 ? '#ffd166' : '#1ec8ff';
  }

  if (diag.metrics.lastSuccessAt) {
    const secondsAgo = Math.round((Date.now() - diag.metrics.lastSuccessAt) / 1000);
    nowPlayingLastSuccessLabel.textContent = secondsAgo < 60 ? `${secondsAgo}s ago` : `${Math.round(secondsAgo / 60)}m ago`;
  } else {
    nowPlayingLastSuccessLabel.textContent = '--';
  }

  if (status.lastError) {
    nowPlayingErrorContainer.classList.remove('hidden');
    nowPlayingErrorText.textContent = status.lastError;
  } else {
    nowPlayingErrorContainer.classList.add('hidden');
  }
};

const setupMIDI = async () => {
  try {
    midiAccess = await navigator.requestMIDIAccess();
    const inputs = Array.from((midiAccess.inputs as unknown as Map<string, MIDIInput>).values());
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
    // If a node-midi input was previously opened (Web MIDI was unavailable at
    // the time), close it now so its 'message' listener stops firing alongside
    // Web MIDI and doesn't leak the port. No-op if none was open.
    await window.visualSynth.closeNodeMidi();
    const inputId = midiSelect.value;
    const input = Array.from((midiAccess.inputs as unknown as Map<string, MIDIInput>).values()).find((item) => item.id === inputId);
    if (!input) return;
    (input as MIDIInput).onmidimessage = (event: MIDIMessageEvent) =>
      handleMidiMessage(Array.from((event as MIDIMessageEvent).data ?? []), event.timeStamp ?? performance.now());
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

// Per-mapping CC edge state for toggle/trigger modes: stores the last normalized
// CC value so a rising-edge crossing of 0.5 flips/fires exactly once instead of
// re-triggering on every knob tick. WeakMap so entries are reclaimed when a
// mapping object is replaced/removed.
const ccEdgeState = new WeakMap<MidiMapping, number>();

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
        midiLearnEnabled = false;
        updateMidiLearnToggle();
        updateMappingHud();
        return;
      }
  const applyMappings = () => {
    currentProject.midiMappings.forEach((mapping) => {
      if (mapping.channel !== channel) return;
      if (mapping.message === 'note') {
        if (mapping.control !== data1) return;
        // 0x90 with velocity 0 is an alternative Note Off encoding; treat both.
        const isNoteOn = messageType === 0x90 && data2 > 0;
        const isNoteOff = messageType === 0x80 || (messageType === 0x90 && data2 === 0);
        if (!isNoteOn && !isNoteOff) return;
        if (mapping.mode === 'toggle') {
          // Toggle flips only on the Note On edge; Note Off is ignored.
          if (isNoteOn) applyMidiTargetValue(mapping.target, data2 / 127, true);
        } else {
          // momentary / trigger: press sets the value, release resets to 0.
          // Previously only Note On was handled, so a momentary/trigger pad
          // pegged the target on press and never released it.
          applyMidiTargetValue(mapping.target, isNoteOn ? data2 / 127 : 0, false);
        }
      }
      if (mapping.message === 'cc' && messageType === 0xb0) {
        if (mapping.control !== data1) return;
        const v = data2 / 127;
        if (mapping.mode === 'toggle') {
          // Flip on the rising edge (crossing 0.5 upward) so one knob gesture
          // toggles once, not on every tick.
          const last = ccEdgeState.get(mapping) ?? 0;
          if (v > 0.5 && last <= 0.5) applyMidiTargetValue(mapping.target, 1, true);
          ccEdgeState.set(mapping, v);
        } else if (mapping.mode === 'trigger') {
          // One-shot fire on the rising edge.
          const last = ccEdgeState.get(mapping) ?? 0;
          if (v > 0.5 && last <= 0.5) applyMidiTargetValue(mapping.target, 1, false);
          ccEdgeState.set(mapping, v);
        } else {
          // momentary: direct continuous value (CC has no release event).
          applyMidiTargetValue(mapping.target, data2);
        }
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
    version: 6,
    metadata: {
      version: 6,
      name: currentProject.name,
      createdAt: currentProject.createdAt || now,
      updatedAt: now,
      activeEngineId: currentProject.activeEngineId || 'engine-radial-core',
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
      value: macro.value
    }))
  };

  return JSON.stringify(performance, null, 2);
};

const buildProjectSnapshotForSave = (): VisualSynthProject => {
  const now = new Date().toISOString();
  return {
    ...currentProject,
    updatedAt: now,
    output: outputConfig,
    macros: currentProject.macros.map((macro) => ({ ...macro })),
    scenes: currentProject.scenes.map((scene) => ({
      ...scene,
      layers: scene.layers.map((layer) => ({ ...layer }))
    }))
  };
};

const serializeProject = () => {
  return JSON.stringify(buildProjectSnapshotForSave(), null, 2);
};

const applyProject = async (project: VisualSynthProject) => {
  isRecoveryProject = false;
  projectDirty = false;
  if (!preservePresetPreviewState && presetPreviewBaseProject) {
    clearPresetPreviewState();
  }
  resetTransientVisualState();
  renderer.clearHistory?.();
  const applied = await applyLoadableProjectRuntime(project, {
    currentOutputConfig: outputConfig,
    onResolvedProject: (normalized) => {
      currentProject = normalized;
      initEngineSelect();
      refreshSceneSelect();
      const activeGeneratorCount = primeProjectShaders(renderer, currentProject, 200);
      applyScene(currentProject.activeSceneId, { skipShaderWarmup: true });
      console.log(`[Project] Applied project "${currentProject.name}", active scene shader primed for ${activeGeneratorCount} generators and scene variants queued for precompile`);
      console.log(
        `[Project] Loaded scenes (${currentProject.scenes.length}): ${currentProject.scenes
          .map((scene) => `${scene.id}:${scene.name || 'Unnamed Scene'}`)
          .join(', ')}`
      );
    },
    syncOutputConfig,
    setOutputEnabled
  });
  if (!applied.ok) {
    console.error(`[Project] Zod Validation Failed for "${applied.name}":`, applied.errorDetail);
    setStatus(`Invalid project: ${applied.name}`);
    return;
  }

  currentProject = applied.project;
  outputConfig = applied.outputConfig;

  initStylePresets();
  initPalettes();
  initMacros();
  initEffects();
  initParticles();
  initSdf();
  syncVisualizerFromProject();
  if (visualModeSelect) {
    visualModeSelect.value = currentProject.activeModeId || 'mode-cosmic';
  }
  if (engineSelect) {
    const engineId = currentProject.activeEngineId || 'engine-radial-core';
    engineSelect.value = engineId;
    applyVisualEngine(engineId as EngineId);
  }
  if (currentProject.roleWeights) {
    mixRoleCore.value = String(currentProject.roleWeights.core);
    mixRoleSupport.value = String(currentProject.roleWeights.support);
    mixRoleAtmosphere.value = String(currentProject.roleWeights.atmosphere);
  }
  if (currentProject.tempoSync) {
    syncTempoInputs(currentProject.tempoSync.bpm);
    bpmSource = currentProject.tempoSync.source;
    if (bpmSourceSelect) bpmSourceSelect.value = bpmSource;
    updateBpmSourceUI();
    updateBpmDisplay();
  }
  initModulators();
  renderModulators();
  renderModMatrix();
  renderMidiMappings();
  renderPadMapGrid();
  renderMarkers();
  renderAssets();
  renderPlugins();
  renderOverlayList();
  selectedOverlayId = null;
  overlayRenderer.setSelected(null);
  overlayPropsEl.classList.add('hidden');
  diffBaseProject = { ...currentProject };
  renderDiffSections();
  void checkMissingAssets();
  void restoreDynamicAssets();
  broadcastCurrentOutputState();
  cacheWarmer?.notifyProjectChanged(currentProject);
  setStatus(`Loaded project: ${currentProject.name}`);
};

const saveProjectToDisk = async () => {
  const payload = serializeProject();
  const saveResult = isRecoveryProject
    ? await window.visualSynth.saveProjectAs(payload)
    : await window.visualSynth.saveProject(payload);
  if (!saveResult.canceled) {
    projectDirty = false;
    isRecoveryProject = false;
    setStatus(`Saved project: ${currentProject.name}`);
  }
};

const savePerformanceToDisk = async () => {
  const payload = serializePerformance();
  const saveResult = await window.visualSynth.saveProject(payload);
  if (!saveResult.canceled) {
    projectDirty = false;
    setStatus(`Saved project: ${currentProject.name}`);
  }
};

const loadProjectFromDisk = async () => {
  suppressStartupRecovery = true;
  console.log('[Project] Manual open requested; suppressing startup recovery.');
  try {
    const result = await window.visualSynth.openProject();
    console.log('[Project] Open dialog result:', {
      canceled: result?.canceled,
      filePath: result?.filePath,
      hasProject: Boolean(result?.project),
      error: result?.error
    });
    if (!result.canceled && result.project) {
      console.log(`[Project] Opening file: ${result.filePath ?? 'unknown path'}`);
      await applyProject(result.project);
      return;
    }
    if (result?.error) {
      console.error(`[Project] Open failed: ${result.error}`);
      setStatus(`Open project failed: ${result.error}`);
    }
  } catch (error) {
    console.error('[Project] Open request threw:', error);
    setStatus('Open project failed.');
  }
};

if (saveButton) {
  saveButton.addEventListener('click', () => {
    void saveProjectToDisk();
  });
}

if (savePerfButton) {
  savePerfButton.addEventListener('click', () => {
    void savePerformanceToDisk();
  });
}

if (loadButton) {
  loadButton.addEventListener('click', () => {
    void loadProjectFromDisk();
  });
}

if (topbarSaveProjectButton) {
  topbarSaveProjectButton.addEventListener('click', () => {
    void saveProjectToDisk();
  });
}

if (topbarOpenProjectButton) {
  topbarOpenProjectButton.addEventListener('click', () => {
    void loadProjectFromDisk();
  });
}

if (applyPresetButton) {
  applyPresetButton.addEventListener('click', async () => {
    if (!selectedPresetPath) return;
    if (presetPreviewBaseProject) {
      const baseProject = cloneValue(presetPreviewBaseProject);
      clearPresetPreviewState();
      await applyProject(baseProject);
    }
    markPresetRecent(selectedPresetPath);
    await addSceneFromPreset(selectedPresetPath);
    renderPresetQuickFilters();
    renderPresetPreview();
  });
}

if (presetPrevButton) {
  presetPrevButton.addEventListener('click', () => {
    if (currentPresetPage > 0) {
      currentPresetPage--;
      renderPresetBrowser();
    }
  });
}

if (presetNextButton) {
  presetNextButton.addEventListener('click', () => {
    const totalPages = Math.ceil(filteredPresetLibrary.length / PRESET_PAGE_SIZE);
    if (currentPresetPage < totalPages - 1) {
      currentPresetPage++;
      renderPresetBrowser();
    }
  });
}

if (presetSelect) {
  presetSelect.addEventListener('change', () => {
    updateSelectedPreset(presetSelect.value);
  });
}

if (presetCategorySelect) {
  presetCategorySelect.addEventListener('change', () => {
    presetCategoryFilter = presetCategorySelect.value;
    refreshPresetCategories();
    renderPresetBrowser(true);
    renderPresetPreview();
  });
}

if (presetSearchInput) {
  presetSearchInput.addEventListener('input', () => {
    renderPresetBrowser(true);
    renderPresetPreview();
  });
}

if (addBlankSceneButton) {
  addBlankSceneButton.addEventListener('click', () => {
    const scene = createBlankScene();
    addSceneToProject(scene, false);
    setStatus(`Scene added: ${scene.name}`);
    populateSceneSelectors();
  });
}

const handleAddScene = () => {
  const scene = createBlankScene();
  addSceneToProject(scene, false);
  populateSceneSelectors();
  setStatus(`Scene added: ${scene.name}`);
};

const handleDeleteScene = () => {
  const sceneId = selectedSceneId ?? currentProject.activeSceneId;
  const sceneIndex = currentProject.scenes.findIndex(s => s.id === sceneId);
  if (currentProject.scenes.length <= 1) {
    setStatus('Cannot delete the only scene.');
    return;
  }
  if (sceneIndex <= 0) {
    setStatus('Cannot delete the first scene.');
    return;
  }
  const scene = currentProject.scenes.find(s => s.id === sceneId);
  removeScene(sceneId);
  selectedSceneId = currentProject.activeSceneId;
  populateSceneSelectors();
  setStatus(`Deleted scene: ${scene?.name ?? sceneId}`);
};

if (sceneAddBtn) {
  sceneAddBtn.addEventListener('click', handleAddScene);
}
if (sceneAddBtnView) {
  sceneAddBtnView.addEventListener('click', handleAddScene);
}
if (sceneDeleteBtn) {
  sceneDeleteBtn.addEventListener('click', handleDeleteScene);
}
if (sceneDeleteBtnView) {
  sceneDeleteBtnView.addEventListener('click', handleDeleteScene);
}

if (presetShuffleButton) {
  presetShuffleButton.addEventListener('click', () => {
    const entries = getFilteredPresetEntries();
    const pick = entries[Math.floor(Math.random() * entries.length)];
    if (!pick) return;
    void previewPresetSelection(pick.path, 'Shuffle');
  });
}

if (presetLoadProjectButton) {
  presetLoadProjectButton.addEventListener('click', async () => {
    if (!selectedPresetPath) return;
    markPresetRecent(selectedPresetPath);
    const addedSceneId = await addSceneFromPreset(selectedPresetPath);
    if (addedSceneId) {
      applyScene(addedSceneId);
      lastOutputBroadcast = 0;
      broadcastCurrentOutputState();
    }
    renderPresetQuickFilters();
    renderPresetPreview();
  });
}

if (presetFavoriteButton) {
  presetFavoriteButton.addEventListener('click', () => {
    if (!selectedPresetPath) return;
    togglePresetFavorite(selectedPresetPath);
    renderPresetQuickFilters();
    renderPresetBrowser();
    renderPresetPreview();
  });
}


document.addEventListener('keydown', (event) => {
  if (activeMode !== 'performance') return;
  const target = event.target as HTMLElement | null;
  const isTypingTarget = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable;
  if (event.key === '/' && !isTypingTarget) {
    event.preventDefault();
    presetSearchInput?.focus();
    presetSearchInput?.select();
    return;
  }
  if (document.activeElement === presetSearchInput) return;
  if (!filteredPresetLibrary.length) return;
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    presetNextButton.click();
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    presetPrevButton.click();
  } else if (event.key === 'Enter' && event.shiftKey) {
    event.preventDefault();
    applyPresetButton.click();
  } else if (event.key === 'Enter' && event.ctrlKey) {
    event.preventDefault();
    presetLoadProjectButton.click();
  } else if (event.key.toLowerCase() === 'f') {
    event.preventDefault();
    presetFavoriteButton.click();
  } else if (event.key === 'Escape' && presetSearchInput.value) {
    presetSearchInput.value = '';
    renderPresetBrowser();
    renderPresetPreview();
  } else if (event.key === 'Escape' && presetPreviewBaseProject) {
    event.preventDefault();
    const baseProject = cloneValue(presetPreviewBaseProject);
    clearPresetPreviewState();
    void applyProject(baseProject);
  }
});

document.addEventListener('keydown', (event) => {
  if (activeMode !== 'live') return;
  const target = event.target as HTMLElement | null;
  const isTypingTarget = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable;
  if (isTypingTarget) return;

  const presets = getLivePresets();
  if (presets.length === 0) return;

  const numMap: Record<string, number> = {
    '1': 0, '2': 1, '3': 2, '4': 3, '5': 4,
    '6': 5, '7': 6, '8': 7, '9': 8, '0': 9,
    'q': 10, 'w': 11, 'e': 12, 'r': 13, 't': 14,
    'y': 15, 'u': 16, 'i': 17, 'o': 18, 'p': 19
  };
  const key = event.key.toLowerCase();
  if (key in numMap) {
    const idx = numMap[key];
    if (idx < presets.length) {
      event.preventDefault();
      livePlaylistIndex = idx;
      triggerLivePreset(presets[idx]);
    }
  }
  if (key === ' ') {
    event.preventDefault();
    if (livePlaylistActive) {
      stopLivePlaylist();
    } else {
      startLivePlaylist();
    }
  }
});

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
  sceneSelect.addEventListener('change', () => {
    const sceneId = sceneSelect.value;
    if (!sceneId) return;
    applyScene(sceneId);
    const sceneName = currentProject.scenes.find((s) => s.id === sceneId)?.name ?? sceneId;
    setStatus(`Activated: ${sceneName}`);
  });
}

if (queueSceneButton) {
  queueSceneButton.addEventListener('click', () => {
    if (currentProject.scenes.length === 0) return;
    const targetSceneId = selectedSceneId ?? sceneSelect?.value;
    if (!targetSceneId) return;
    const bpm = getActiveBpm();
    const unit = (quantizeSelect?.value ?? 'bar') as QuantizationUnit;
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
  updateBpmSourceUI();
  updateBpmDisplay();
});

bpmRangeSelect.addEventListener('change', () => {
  if (bpmRangeSelect.value === 'custom') {
    updateBpmRangeUI();
    return;
  }
  const [min, max] = bpmRangeSelect.value.split('-').map((value) => Number(value));
  bpmMinInput.value = String(min);
  bpmMaxInput.value = String(max);
  updateBpmRangeUI();
});

bpmMinInput.addEventListener('change', updateBpmRangeUI);
if (midiLearnToggleButton) {
  midiLearnToggleButton.addEventListener('click', () => {
    midiLearnEnabled = !midiLearnEnabled;
    if (!midiLearnEnabled) {
      learnTarget = null;
      updateMappingHud();
      setStatus('MIDI Learn off.');
    } else {
      setStatus('MIDI Learn on. Click a control to map.');
    }
    updateMidiLearnToggle();
  });
  updateMidiLearnToggle();
}
mappingHudCancel.addEventListener('click', () => {
  learnTarget = null;
  midiLearnEnabled = false;
  updateMidiLearnToggle();
  updateMappingHud();
  setStatus('Mapping canceled.');
});

bpmMaxInput.addEventListener('change', updateBpmRangeUI);

beatSensitivityInput.addEventListener('input', () => {
  beatSensitivity = Number(beatSensitivityInput.value);
});

beatFilterSelect.addEventListener('change', () => {
  beatFilterRange = beatFilterSelect.value as any;
});

beatHoldOffInput.addEventListener('change', () => {
  beatHoldOffMs = Number(beatHoldOffInput.value) || 0;
});

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
  syncActiveSceneLookSection(currentProject, 'visualizer', currentProject.visualizer);
  visualizerCanvas.classList.toggle(
    'hidden',
    visualizerMode === 'off' || !currentProject.visualizer.enabled
  );
  renderLayerList();
});

visualizerOpacityInput.addEventListener('input', () => {
  currentProject.visualizer.opacity = Number(visualizerOpacityInput.value);
  syncActiveSceneLookSection(currentProject, 'visualizer', currentProject.visualizer);
});
visualizerMacroToggle.addEventListener('change', () => {
  currentProject.visualizer.macroEnabled = visualizerMacroToggle.checked;
  syncActiveSceneLookSection(currentProject, 'visualizer', currentProject.visualizer);
  visualizerMacroSelect.disabled = !visualizerMacroToggle.checked;
});
visualizerMacroSelect.addEventListener('change', () => {
  currentProject.visualizer.macroId = Number(visualizerMacroSelect.value);
  syncActiveSceneLookSection(currentProject, 'visualizer', currentProject.visualizer);
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

refreshAllPresetsButton?.addEventListener('click', () => {
  void refreshAllScenesFromPresets();
});

exportSceneButton.addEventListener('click', async () => {
  try {
    const payload = createSceneExchange(currentProject, currentProject.activeSceneId) as Extract<ExchangePayload, { kind: 'scene' }>;
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

sceneTransitionTypeSelect.addEventListener('change', () => {
  const scene = getActiveScene();
  if (scene) {
    if (!scene.transition_in) {
      scene.transition_in = { ...DEFAULT_SCENE_TRANSITION, type: 'fade' };
    }
    scene.transition_in.type = sceneTransitionTypeSelect.value as any;
    setStatus(`Scene transition set to: ${scene.transition_in.type}`);
  }
});

sceneTransitionDuration.addEventListener('input', () => {
  const scene = getActiveScene();
  if (scene) {
    if (!scene.transition_in) {
      scene.transition_in = { ...DEFAULT_SCENE_TRANSITION };
    }
    scene.transition_in.durationMs = Number(sceneTransitionDuration.value);
  }
});

sceneTransitionCurve.addEventListener('change', () => {
  const scene = getActiveScene();
  if (scene) {
    if (!scene.transition_in) {
      scene.transition_in = { ...DEFAULT_SCENE_TRANSITION };
    }
    scene.transition_in.curve = sceneTransitionCurve.value as 'linear' | 'easeInOut';
  }
});

sceneViewSelect.addEventListener('change', () => {
  const sceneId = sceneViewSelect.value;
  if (sceneId) {
    selectedSceneId = sceneId;
    previewSceneId = sceneId;
    const scene = currentProject.scenes.find(s => s.id === sceneId);
    if (scene) {
      compileSceneShaders(renderer, scene, currentProject, currentProject.customShaderBlocks ?? [], currentProject.sdf?.enabled ?? false, true);
      updateSceneContextUI(scene);
      renderLayerList();
      setStatus(`Viewing scene: ${scene.name}`);
    }
  }
});

if (sceneEditSelect) {
  sceneEditSelect.addEventListener('change', () => {
    const sceneId = sceneEditSelect.value;
    if (sceneId) {
      selectedSceneId = sceneId;
      previewSceneId = sceneId;
      const scene = currentProject.scenes.find(s => s.id === sceneId);
      if (scene) {
        compileSceneShaders(renderer, scene, currentProject, currentProject.customShaderBlocks ?? [], currentProject.sdf?.enabled ?? false, true);
        updateSceneContextUI(scene);
        renderLayerList();
        setStatus(`Editing scene: ${scene.name}`);
      }
    }
  });
}

sceneIntentSelect.addEventListener('change', () => {
  const scene = getActiveScene();
  if (scene) {
    scene.intent = sceneIntentSelect.value as SceneIntent;
    setStatus(`Scene intent: ${scene.intent}`);
  }
});

sceneTriggerType.addEventListener('change', () => {
  const scene = getActiveScene();
  if (scene) {
    if (!scene.trigger) {
      scene.trigger = { type: 'manual' };
    }
    scene.trigger.type = sceneTriggerType.value as 'manual' | 'time' | 'audio';
    sceneTriggerAudioOptions.classList.toggle('hidden', scene.trigger.type !== 'audio');
    setStatus(`Trigger type: ${scene.trigger.type}`);
  }
});

sceneTriggerThreshold.addEventListener('input', () => {
  const scene = getActiveScene();
  if (scene && scene.trigger) {
    scene.trigger.threshold = Number(sceneTriggerThreshold.value);
  }
});

sceneTriggerInterval.addEventListener('input', () => {
  const scene = getActiveScene();
  if (scene && scene.trigger) {
    scene.trigger.minIntervalMs = Number(sceneTriggerInterval.value);
  }
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
  expressiveFxEnabled,
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

if (engineSelect) {
  engineSelect.addEventListener('change', () => {
    applyVisualEngine(engineSelect.value as any);
  });
}

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

nowPlayingConfigureButton.addEventListener('click', () => {
  openNowPlayingModal();
});

nowPlayingProviderSelect.addEventListener('change', () => {
  syncNowPlayingProviderFields();
});

nowPlayingMetadataEnabledInput.addEventListener('change', () => {
  syncNowPlayingProviderFields();
});

nowPlayingApplyCompanionPresetButton.addEventListener('click', async () => {
  applyWhatsNowPlayingDraftPreset();
  const draftSettings = buildNowPlayingDraftSettings();
  const savedSettings = await window.visualSynth.saveNowPlayingSettings(draftSettings);
  applyNowPlayingSettings(savedSettings);
  nowPlayingTestStatus.textContent = `WNP defaults applied: ${savedSettings.metadataSourceUrl} | fallback provider: ${savedSettings.provider}`;
});

nowPlayingTestBridgeButton.addEventListener('click', async () => {
  const metadataEnabled = nowPlayingMetadataEnabledInput.checked;
  const metadataUrl = nowPlayingMetadataUrlInput.value.trim();
  const metadataSecret = nowPlayingMetadataSecretInput.value.trim();

  if (!metadataEnabled || !metadataUrl) {
    nowPlayingTestStatus.textContent = 'Metadata bridge is not enabled or URL is empty.';
    return;
  }

  nowPlayingTestStatus.textContent = 'Testing metadata bridge...';
  const result = await window.visualSynth.fetchNowPlayingMetadata(
    metadataUrl,
    metadataSecret || undefined
  );

  if (!result.matched) {
    nowPlayingTestStatus.textContent = result.error || 'Bridge reachable, but no current track was reported.';
    return;
  }

  const label = [result.title, result.artist].filter(Boolean).join(' - ');
  nowPlayingTestStatus.textContent = label || 'Metadata bridge returned a track.';
  await consumeNowPlayingResult(result, 'Metadata bridge');
});

nowPlayingOpenBridgeDocsButton.addEventListener('click', () => {
  window.open('https://whatsnowplaying.github.io/whats-now-playing/latest/', '_blank', 'noopener,noreferrer');
});

nowPlayingOpenBridgeDownloadButton.addEventListener('click', () => {
  window.open('https://github.com/whatsnowplaying/whats-now-playing/releases', '_blank', 'noopener,noreferrer');
});

nowPlayingLaunchCompanionButton.addEventListener('click', async () => {
  nowPlayingTestStatus.textContent = 'Installing / launching What\'s Now Playing...';
  const result = await window.visualSynth.launchWhatsNowPlayingCompanion();
  if (!result.error) {
    applyWhatsNowPlayingDraftPreset();
    const savedSettings = await window.visualSynth.saveNowPlayingSettings(buildNowPlayingDraftSettings());
    applyNowPlayingSettings(savedSettings);
  }
  nowPlayingTestStatus.textContent =
    result.error ||
    `${result.message || 'What\'s Now Playing launched.'} Bridge preset is enabled at ${nowPlayingMetadataUrlInput.value.trim() || DEFAULT_NOW_PLAYING_SETTINGS.metadataSourceUrl} with ${nowPlayingProviderSelect.value} as the fallback provider.`;
});

nowPlayingOpenCompanionFolderButton.addEventListener('click', async () => {
  const result = await window.visualSynth.openWhatsNowPlayingCompanionFolder();
  nowPlayingTestStatus.textContent = result.error || (result.opened ? `Opened ${result.path}` : 'Failed to open companion folder.');
});

nowPlayingCancelButton.addEventListener('click', () => {
  closeNowPlayingModal();
});

nowPlayingSaveButton.addEventListener('click', async () => {
  Object.assign(nowPlayingSettings, buildNowPlayingDraftSettings());
  const savedSettings = await window.visualSynth.saveNowPlayingSettings({ ...nowPlayingSettings });
  applyNowPlayingSettings(savedSettings);
  getAudioEngineSafe()?.updateNowPlayingSettings(savedSettings);
  closeNowPlayingModal();
  setStatus('Now Playing configuration saved.');
});

nowPlayingTestLiveButton.addEventListener('click', async () => {
  const draftSettings = buildNowPlayingDraftSettings();
  await testNowPlayingLiveInput(draftSettings);
});

nowPlayingTestButton.addEventListener('click', async () => {
  const draftSettings = buildNowPlayingDraftSettings();

  if (!isNowPlayingLookupConfigured(draftSettings)) {
    nowPlayingTestStatus.textContent = 'Provider settings are incomplete.';
    return;
  }

  nowPlayingTestStatus.textContent = `Running file lookup with ${draftSettings.provider}...`;
  const result = await window.visualSynth.testNowPlayingFile({
    provider: draftSettings.provider,
    endpoint: draftSettings.endpoint || undefined,
    host: draftSettings.host || undefined,
    apiKey: draftSettings.apiKey || undefined,
    apiSecret: draftSettings.apiSecret || undefined,
    market: draftSettings.market || undefined,
    initialPath: 'C:\\Users\\TimShelton\\Dropbox\\Music'
  });

  if (result.canceled) {
    nowPlayingTestStatus.textContent = 'Lookup test canceled.';
    return;
  }

  if (!result.matched) {
    nowPlayingTestStatus.textContent = result.error || 'No match found.';
    return;
  }

  const label = [result.title, result.artist].filter(Boolean).join(' - ');
  nowPlayingTestStatus.textContent = label || 'Lookup succeeded.';
  await consumeNowPlayingResult(result, 'Now playing test');
});

nowPlayingModal.addEventListener('click', (event) => {
  if (event.target === nowPlayingModal) {
    closeNowPlayingModal();
  }
});

requestMicPermissionButton.addEventListener('click', async () => {
  try {
    // Request microphone permission explicitly
    await navigator.mediaDevices.getUserMedia({ audio: true });
    // Refresh the device list
    await initAudioDevices();
    // Setup audio with the selected device
    await setupAudio(audioSelect.value || undefined);
    setStatus('Microphone permission granted. Audio input connected.');
  } catch (error) {
    let errorMsg = 'Failed to get microphone permission.';
    let detailedMsg = '';

    if (error instanceof Error) {
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMsg = 'Microphone permission denied by Windows.';
        detailedMsg = 'To enable microphone access:\n\n' +
                      '1. Open Windows Settings (Win + I)\n' +
                      '2. Go to Privacy & Security → Microphone\n' +
                      '3. Turn ON "Microphone access"\n' +
                      '4. Turn ON "Let apps access your microphone"\n' +
                      '5. Restart VisualSynth\n\n' +
                      'Click OK to open Windows Settings now.';
      } else if (error.name === 'NotFoundError') {
        errorMsg = 'No microphone found.';
        detailedMsg = 'Please connect a microphone and try again.';
      } else if (error.name === 'NotReadableError') {
        errorMsg = 'Microphone is in use by another application.';
        detailedMsg = 'Close other applications using the microphone (Discord, OBS, etc.) and try again.';
      } else {
        detailedMsg = `Error: ${error.message}`;
      }
    }

    setStatus(errorMsg);

    // Show detailed message
    if (detailedMsg) {
      const shouldOpenSettings = error instanceof Error &&
        (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError');

      if (shouldOpenSettings) {
        const result = confirm(detailedMsg);
        if (result) {
          // Open Windows Settings for microphone
          window.open('ms-settings:privacy-microphone');
        }
      } else {
        alert(detailedMsg);
      }
    }
  }
});

if (perfToggleSpectrum) {
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
}

if (spectrumHintDismiss) {
  spectrumHintDismiss.addEventListener('click', () => {
    localStorage.setItem('visualsynth.spectrumHintDismissed', '1');
    spectrumHint?.classList.add('hidden');
  });
}

if (perfAddLayerButton) {
  perfAddLayerButton.addEventListener('click', () => {
    setMode('scene');
    generatorPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    generatorSelect.focus();
    setStatus('Scene mode: use Generator Library to add layers.');
  });
}

designAddLayerButton.addEventListener('click', () => {
  setMode('scene');
  generatorPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  generatorSelect.focus();
  setStatus('Scene mode: use Generator Library to add layers.');
});

playlistPlayButton.addEventListener('click', async () => {
  if (currentProject.scenes.length === 0) return;
  stopPlaylist();
  playlistActive = true;
  playlistOverrides = {};

  const startIndex = playlistIndex;

  await triggerPlaylistSlot(startIndex);

  const slotMs = Math.max(2000, (Number(playlistSlotSeconds.value) || 16) * 1000);
  playlistTimer = window.setTimeout(() => {
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
    const mode = button.dataset.mode as UiMode;
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
  if (bpmSource !== 'manual') {
    setStatus('Tap tempo is only available in Manual BPM mode.');
    return;
  }
  const now = performance.now();
  tapTempoTimes = tapTempoTimes.filter((time) => now - time < 4000);
  tapTempoTimes.push(now);
  if (tapTempoTimes.length < 2) {
    setStatus('Tap tempo started...');
    return;
  }

  const intervals: number[] = [];
  for (let i = 1; i < tapTempoTimes.length; i += 1) {
    intervals.push(tapTempoTimes[i] - tapTempoTimes[i - 1]);
  }
  const averageInterval =
    intervals.reduce((sum, interval) => sum + interval, 0) / Math.max(1, intervals.length);
  const bpm = Math.min(240, Math.max(40, 60000 / averageInterval));
  syncTempoInputs(Number(bpm.toFixed(1)));
  updateBpmDisplay();
  setStatus(`Tap tempo: ${bpm.toFixed(1)} BPM`);
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
  if (bpmSource !== 'manual') {
    updateBpmDisplay();
    return;
  }
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
  updateBpmDisplay();
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

perfModeEnabled.addEventListener('change', () => {
  if (!currentProject.performanceMode) {
    currentProject.performanceMode = {
      enabled: perfModeEnabled.checked,
      restrictToSafePresets: perfModeRestrictPresets.checked,
      autoRecoveryEnabled: perfModeAutoRecovery.checked,
      forceMinimalQualityOnStruggle: true,
      disableExperimentalEngines: true,
      maxMemoryMB: 2048
    };
  } else {
    currentProject.performanceMode.enabled = perfModeEnabled.checked;
  }
  renderPresetBrowser(true);
  markProjectDirty();
});

perfModeRestrictPresets.addEventListener('change', () => {
  if (currentProject.performanceMode) {
    currentProject.performanceMode.restrictToSafePresets = perfModeRestrictPresets.checked;
    renderPresetBrowser(true);
    markProjectDirty();
  }
});

perfModeAutoRecovery.addEventListener('change', () => {
  if (currentProject.performanceMode) {
    currentProject.performanceMode.autoRecoveryEnabled = perfModeAutoRecovery.checked;
    markProjectDirty();
  }
});

outputScaleSelect.addEventListener('change', async () => {
  await syncOutputConfig({ scale: Number(outputScaleSelect.value) });
});

const initPresets = async () => {
  loadPresetThumbnails();
  loadPresetPreferences();

  // Try to load presets - may not be available in testing environment
  console.log('[Presets] window.visualSynth exists:', !!window.visualSynth);
  console.log('[Presets] window.visualSynth.listPresets exists:', !!window.visualSynth?.listPresets);
  
  if (!window.visualSynth || !window.visualSynth.listPresets) {
    console.log('[Presets] Preset API not available - skipping preset initialization');
    return;
  }

  console.log('[Presets] Calling listPresets()...');
  const presets = await window.visualSynth.listPresets();
  console.log('[Presets] Received presets:', presets?.length ?? 0);
  
  // Sort presets alphabetically by name
  presets.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  presetSelect.innerHTML = '';
  presetLibrary = presets;
  presets.forEach((preset) => {
    const option = document.createElement('option');
    option.value = preset.path;
    option.textContent = preset.name;
    presetSelect.appendChild(option);
  });
  refreshPresetCategories();
  renderPresetQuickFilters();
  selectedPresetPath = presets[0]?.path ?? '';
  presetSelect.value = selectedPresetPath;
  // Defer browser render to avoid blocking the loading sequence with 100+ DOM nodes
  setTimeout(() => {
    renderPresetBrowser();
    renderPresetPreview();
  }, 0);
  const hasPresets = presets.length > 0;
  presetPrevButton.disabled = !hasPresets;
  presetNextButton.disabled = !hasPresets;
  applyPresetButton.disabled = !hasPresets;
  presetShuffleButton.disabled = !hasPresets;
  presetLoadProjectButton.disabled = !hasPresets;
  presetFavoriteButton.disabled = !hasPresets;
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

const updateShapeBursts = (time: number, dt: number) => {
  const activeScene =
    currentProject.scenes.find((scene) => scene.id === currentProject.activeSceneId) ??
    currentProject.scenes[0];
  const shapeBurstLayers = activeScene?.layers.filter(
    (layer) => layer.generatorId === 'gen-shape-burst'
  ) ?? [];
  const shapeBurstLayer = (() => {
    for (let i = shapeBurstLayers.length - 1; i >= 0; i -= 1) {
      if (shapeBurstLayers[i]?.enabled) return shapeBurstLayers[i];
    }
    return shapeBurstLayers[0] ?? null;
  })();
  const shapeBurstEnabled = shapeBurstLayer?.enabled ?? false;

  if (!shapeBurstEnabled) {
    for (let i = 0; i < 8; i += 1) {
      shapeBurstSlots[i].active = false;
      shapeBurstActives[i] = 0;
    }
    return;
  }

  const audioTrigger = (shapeBurstLayer?.params as any)?.audioTrigger ?? true;
  const expandSpeed =
    typeof shapeBurstLayer?.params?.expandSpeed === 'number' ? shapeBurstLayer.params.expandSpeed : 2;
  const maxSize =
    typeof shapeBurstLayer?.params?.maxSize === 'number' ? shapeBurstLayer.params.maxSize : 1.5;
  const spawnRate =
    typeof shapeBurstLayer?.params?.spawnRate === 'number' ? shapeBurstLayer.params.spawnRate : 1;

  const peak = Math.max(audioState.peak, audioState.rms ?? 0);
  const threshold = 0.15; // Lowered from 0.35 to make it more sensitive
  const timeSinceLastSpawn = time - lastShapeBurstSpawn;
  const minInterval = 200 / spawnRate;

  const shouldSpawn =
    (audioTrigger && peak > threshold && timeSinceLastSpawn > minInterval) ||
    (!audioTrigger && timeSinceLastSpawn > minInterval);
  if (shouldSpawn) {
    const slotIndex = shapeBurstSlotIndex;
    shapeBurstSlots[slotIndex] = {
      active: true,
      spawnTime: time / 1000
    };
    shapeBurstSlotIndex = (shapeBurstSlotIndex + 1) % 8;
    lastShapeBurstSpawn = time;
  }

  const currentTimeSeconds = time / 1000;
  const maxAge = maxSize / expandSpeed;

  for (let i = 0; i < 8; i += 1) {
    const slot = shapeBurstSlots[i];
    if (slot.active) {
      const age = currentTimeSeconds - slot.spawnTime;
      if (age > maxAge) {
        slot.active = false;
        shapeBurstActives[i] = 0;
      } else {
        shapeBurstSpawnTimes[i] = slot.spawnTime;
        shapeBurstActives[i] = 1;
      }
    } else {
      shapeBurstActives[i] = 0;
    }
  }
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
  if (!templateSelect) return;
  if (!window.visualSynth || !window.visualSynth.listTemplates) {
    console.log('Template API not available - skipping template initialization');
    return;
  }

  const templates = await window.visualSynth.listTemplates();
  
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

  await initializeOutputSession(window.visualSynth, {
    defaultConfig: DEFAULT_OUTPUT_CONFIG,
    applyState: async (config, isOpen) => {
      outputOpen = isOpen;
      await syncOutputConfig(config);
    },
    onOutputClosed: () => {
      outputOpen = false;
      outputConfig = { ...outputConfig, enabled: false };
      updateOutputUI();
      setStatus('Output window closed.');
    }
  });
};

// Output Manager Panel (VJ Integration - Spout/NDI)
let outputManagerPanel: ReturnType<typeof createOutputManagerPanel> | null = null;

const initOutputManagerPanel = async () => {
  // Inject styles
  injectOutputManagerStyles();

  // Create the panel
  const dummyStore = {
    getState: () => ({ project: currentProject }),
    update: () => {},
    subscribe: () => () => {}
  };
  outputManagerPanel = createOutputManagerPanel({ store: dummyStore as any });

  // Add to container
  const container = document.getElementById('output-manager-container');
  if (container) {
    container.appendChild(outputManagerPanel.getContainer());
  }

  // Refresh to get current status
  await outputManagerPanel.refresh();
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
      bpmSource = 'auto';
      bpmSourceSelect.value = 'auto';
      updateBpmSourceUI();
      updateBpmDisplay();
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
    const target = event.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable)
    ) {
      return;
    }
    if (event.ctrlKey && event.key.toLowerCase() === 's') {
      event.preventDefault();
      void saveProjectToDisk();
    }
    if (event.ctrlKey && event.key.toLowerCase() === 'o') {
      event.preventDefault();
      void loadProjectFromDisk();
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
  renderer = createGLRenderer(canvas, {
    onError: (err, type) => {
      lastShaderError = `[${type}] ${err}`;
      setStatus(`Shader error: ${err.substring(0, 40)}...`);
      updateWebglDiagnostics();
    }
  });
  cacheWarmer = new SceneCacheWarmer(renderer);
} catch (error) {
  console.error('[Init] Failed to create GL renderer:', error);
  webglInitError = error instanceof Error ? error.message : String(error);
  safeModeReasons.push('Renderer init failed');
  updateSafeModeBanner();
  setStatus('Renderer init failed. Safe mode enabled.');
  updateWebglDiagnostics();
  renderer = createSafeModeRenderer(canvas);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Debug Overlay - Press 'D' to toggle
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const debugOverlay = createDebugOverlay((flags) => {
  console.log('[Debug] Flags changed:', flags);
  // Flags: { tintLayers: boolean, fxDelta: boolean }
  // These can be used to enable visual debugging features
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Image/Text Overlay System
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
let selectedOverlayId: string | null = null;

const overlayRenderer = createOverlayRenderer({
  canvas: overlayCanvas,
  getOverlays: () => {
    const overlays = currentProject.overlays ?? [];
    const targetScene = previewSceneId ?? currentProject.activeSceneId;
    return overlays.filter(o => !o.targetSceneId || o.targetSceneId === targetScene);
  },
  onOverlayUpdate: (id, changes) => {
    const overlays = currentProject.overlays ?? [];
    const idx = overlays.findIndex(o => o.id === id);
    if (idx < 0) return;
    Object.assign(overlays[idx], changes);
    if (id === selectedOverlayId) syncOverlayProps(overlays[idx]);
  },
  onSelect: (id) => {
    selectedOverlayId = id;
    renderOverlayList();
    if (id) {
      const overlay = (currentProject.overlays ?? []).find(o => o.id === id);
      if (overlay) syncOverlayProps(overlay);
      overlayPropsEl.classList.remove('hidden');
    } else {
      overlayPropsEl.classList.add('hidden');
    }
  },
  isDesignMode: () => activeMode === 'design'
});

function generateOverlayId(): string {
  return 'ovl-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
}

function syncOverlayProps(o: OverlayConfig) {
  overlayNameInput.value = o.name;
  overlayTextGroup.classList.toggle('hidden', o.type !== 'text');
  if (o.type === 'text') {
    overlayTextInput.value = o.text ?? '';
    overlayFontSizeInput.value = String(o.fontSize ?? 24);
    overlayFontColorInput.value = o.fontColor ?? '#ffffff';
    overlayFontBoldInput.checked = o.fontWeight === 'bold';
    overlayTextShadowInput.checked = o.textShadow ?? false;
  }
  overlayOpacityInput.value = String(o.opacity);
  overlayRotationInput.value = String(o.rotation);
  overlayIncludeFxInput.checked = o.includeInFx;
  overlayPersistInput.checked = !o.targetSceneId;
}

function updateSelectedOverlay(changes: Partial<OverlayConfig>) {
  if (!selectedOverlayId) return;
  const overlays = currentProject.overlays ?? [];
  const overlay = overlays.find(o => o.id === selectedOverlayId);
  if (overlay) Object.assign(overlay, changes);
}

function renderOverlayList() {
  const overlays = currentProject.overlays ?? [];
  overlayListEl.innerHTML = '';
  for (const o of overlays) {
    const item = document.createElement('div');
    item.className = 'overlay-item' + (o.id === selectedOverlayId ? ' selected' : '');
    const icon = o.type === 'image' ? '\u{1F5BC}' : '\u{1F524}';
    item.innerHTML = `<span class="overlay-handle">${icon}</span> ${o.name}`;
    item.addEventListener('click', () => {
      selectedOverlayId = o.id;
      overlayRenderer.setSelected(o.id);
      renderOverlayList();
      syncOverlayProps(o);
      overlayPropsEl.classList.remove('hidden');
    });
    overlayListEl.appendChild(item);
  }
  if (overlays.length === 0) {
    overlayPropsEl.classList.add('hidden');
  }
}

overlayAddImageBtn.addEventListener('click', async () => {
  const result = await window.visualSynth.importAsset('texture');
  if (result.canceled || !result.filePath) return;
  const name = result.filePath.split(/[\\/]/).pop() ?? 'Image';
  currentProject.assets = [
    ...currentProject.assets,
    createAssetItem({
      name,
      kind: 'texture',
      path: result.filePath,
      tags: ['overlay'],
      metadata: {
        hash: result.hash,
        mime: result.mime,
        width: result.width,
        height: result.height,
        colorSpace: result.colorSpace
      }
    })
  ];
  const overlay: OverlayConfig = {
    id: generateOverlayId(),
    name,
    type: 'image',
    enabled: true,
    x: 0.8, y: 0.85,
    width: 0.15, height: 0.1,
    opacity: 1,
    rotation: 0,
    includeInFx: false,
    assetPath: result.filePath,
    targetSceneId: previewSceneId ?? currentProject.activeSceneId  // Scope to current scene
  };
  if (!currentProject.overlays) currentProject.overlays = [];
  currentProject.overlays.push(overlay);
  selectedOverlayId = overlay.id;
  overlayRenderer.setSelected(overlay.id);
  renderAssets();
  renderOverlayList();
  syncOverlayProps(overlay);
  overlayPropsEl.classList.remove('hidden');
  setStatus(`Overlay added: ${name} (scene: ${currentProject.scenes.find(s => s.id === (previewSceneId ?? currentProject.activeSceneId))?.name ?? 'current'})`);
});

overlayAddTextBtn.addEventListener('click', () => {
  const overlay: OverlayConfig = {
    id: generateOverlayId(),
    name: 'Text Overlay',
    type: 'text',
    enabled: true,
    x: 0.05, y: 0.9,
    width: 0.3, height: 0.08,
    opacity: 1,
    rotation: 0,
    includeInFx: false,
    text: 'Your Text',
    fontFamily: 'sans-serif',
    fontSize: 24,
    fontColor: '#ffffff',
    fontWeight: 'normal',
    textShadow: true,
    targetSceneId: previewSceneId ?? currentProject.activeSceneId  // Scope to current scene
  };
  if (!currentProject.overlays) currentProject.overlays = [];
  currentProject.overlays.push(overlay);
  selectedOverlayId = overlay.id;
  overlayRenderer.setSelected(overlay.id);
  renderOverlayList();
  syncOverlayProps(overlay);
  overlayPropsEl.classList.remove('hidden');
  setStatus('Text overlay added');
});

overlayNameInput.addEventListener('input', () => updateSelectedOverlay({ name: overlayNameInput.value }));
overlayTextInput.addEventListener('input', () => updateSelectedOverlay({ text: overlayTextInput.value }));
overlayFontSizeInput.addEventListener('input', () => updateSelectedOverlay({ fontSize: Number(overlayFontSizeInput.value) }));
overlayFontColorInput.addEventListener('input', () => updateSelectedOverlay({ fontColor: overlayFontColorInput.value }));
overlayFontBoldInput.addEventListener('change', () => updateSelectedOverlay({ fontWeight: overlayFontBoldInput.checked ? 'bold' : 'normal' }));
overlayTextShadowInput.addEventListener('change', () => updateSelectedOverlay({ textShadow: overlayTextShadowInput.checked }));
overlayOpacityInput.addEventListener('input', () => updateSelectedOverlay({ opacity: Number(overlayOpacityInput.value) }));
overlayRotationInput.addEventListener('input', () => updateSelectedOverlay({ rotation: Number(overlayRotationInput.value) }));
overlayIncludeFxInput.addEventListener('change', () => updateSelectedOverlay({ includeInFx: overlayIncludeFxInput.checked }));
overlayPersistInput.addEventListener('change', () => {
  const targetSceneId = overlayPersistInput.checked ? undefined : (previewSceneId ?? currentProject.activeSceneId);
  updateSelectedOverlay({ targetSceneId });
});

overlayDeleteBtn.addEventListener('click', () => {
  if (!selectedOverlayId) return;
  const overlays = currentProject.overlays ?? [];
  currentProject.overlays = overlays.filter(o => o.id !== selectedOverlayId);
  selectedOverlayId = null;
  overlayRenderer.setSelected(null);
  overlayPropsEl.classList.add('hidden');
  renderOverlayList();
  setStatus('Overlay deleted');
});

// Toggle overlay canvas pointer events based on mode
const updateOverlayPointerEvents = () => {
  overlayCanvas.style.pointerEvents = activeMode === 'design' ? 'auto' : 'none';
};

renderOverlayList();

let lastTime = performance.now();
let currentFps = 0;
// Per-connection modMatrix temporal low-pass state, keyed by
// `${mod.id}|${targetId}`. Owned by the render loop so the low-pass persists
// across frames. This is the live-path counterpart of RenderGraph's
// modSmoothingState (the bootstrap/test path keeps its own on the instance).
const modSmoothingState = new Map<string, ModSmoothEntry>();
// Monotonic frame counter for the modMatrix low-pass idempotency token.
let modSmoothingFrame = 0;

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
    'engine.low': audioState.energyLow,
    'engine.mid': audioState.energyMid,
    'engine.high': audioState.energyHigh,
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

const isLegacyNeutralProject = (project: VisualSynthProject) =>
  !project.activeEngineId && !project.activeModeId;

const applyRoleOpacity = (
  opacity: number,
  role: keyof typeof ROLE_SETTINGS,
  lowFreq: number,
  legacyNeutral: boolean
) => {
  if (legacyNeutral) return opacity;
  const settings = ROLE_SETTINGS[role];
  if (settings.lowFreqOnly) {
    return opacity * (0.35 + lowFreq * 0.65);
  }
  return opacity * settings.opacityBoost;
};

const getRoleAudioScale = (
  role: keyof typeof ROLE_SETTINGS,
  lowFreq: number,
  legacyNeutral: boolean
) => {
  if (legacyNeutral) return 1;
  const settings = ROLE_SETTINGS[role];
  const lowFreqScale = settings.lowFreqOnly ? 0.3 + lowFreq * 0.7 : 1;
  return settings.audioScale * lowFreqScale;
};

const getChemistryModeIndex = (tags: string[] = []) => {
  if (tags.includes('triadic')) return 1;
  if (tags.includes('complementary')) return 2;
  if (tags.includes('monochromatic')) return 3;
  return 0; // analog default
};

const render = (time: number) => {
  const delta = time - lastTime;
  lastTime = time;
  // One low-pass frame token for this animation frame, shared by all three
  // buildRenderStateForScene calls (active/preview/output) so a target
  // resolved in more than one of them is idempotent within the frame.
  const modFrame = modSmoothingFrame++;
  const fpsTick = tickFpsTracker(fpsTracker, delta);
  fpsTracker = fpsTick.tracker;
  if (fpsTick.fps !== null) {
    currentFps = fpsTick.fps;
    fpsLabel.textContent = `FPS: ${currentFps}`;
    healthFps.textContent = `FPS: ${currentFps}`;
    sessionHealthService.updateFps(currentFps, delta);
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
  const prevDropScore = frameDropScore;
  frameDropScore = nextFrameDropScore(frameDropScore, delta);
  if (frameDropScore > prevDropScore) {
    sessionHealthService.reportDroppedFrame();
  }
  const cadence = resolveFrameCadence({
    timeMs: time,
    lastWatchdogUpdateAt: lastWatchdogUpdate,
    lastAutosaveAt,
    outputOpen,
    lastBroadcastAt: lastOutputBroadcast,
    isPlaying,
    transportTimeMs,
    deltaMs: delta
  });
  if (cadence.shouldUpdateWatchdog) {
    lastWatchdogUpdate = time;
    if (frameDropScore > 0.3) {
      sessionLog.log('warn', 'perf.watchdog_alert', { frameDropScore, fps: currentFps });
      watchdogLabel.textContent = 'Watchdog: Frame drops detected — try lowering output scale.';
      watchdogLabel.classList.add('watchdog-warning');
      healthWatchdog.textContent = 'Watchdog: Warning';
      guardrailStatus.textContent = 'Guardrails: Active';
      // Persistent frame drops are a safe-mode condition: surface it through
      // the safe-mode banner (not just a debug label) so the user is told to
      // lower output scale/quality. Removed again when cadence recovers.
      if (!safeModeReasons.includes('Poor frame cadence')) {
        safeModeReasons.push('Poor frame cadence');
        updateSafeModeBanner();
      }
    } else {
      watchdogLabel.textContent = 'Watchdog: OK';
      watchdogLabel.classList.remove('watchdog-warning');
      healthWatchdog.textContent = 'Watchdog: OK';
      guardrailStatus.textContent = 'Guardrails: OK';
      const cadenceIdx = safeModeReasons.indexOf('Poor frame cadence');
      if (cadenceIdx >= 0) {
        safeModeReasons.splice(cadenceIdx, 1);
        updateSafeModeBanner();
      }
    }
  }

  if (cadence.shouldAutosave) {
    lastAutosaveAt = time;
    const payload = serializeProject();
    void window.visualSynth.autosaveProject(payload);
  }
  if (time - lastSummaryUpdate > 500) {
    lastSummaryUpdate = time;
    updateSummaryChips();
  }
  const latency = resolveLatencyDiagnostics(getAudioEngine()?.getContext() ?? null);
  if (latency.latencyMs !== null) {
    latencyLabel.textContent = `Audio Latency: ${latency.latencyMs}ms`;
    healthLatency.textContent = `Latency: ${latency.latencyMs}ms`;
    outputLatencyLabel.textContent = latency.outputLatencyMs !== null
      ? `Output Latency: ${latency.outputLatencyMs}ms`
      : 'Output Latency: --';
    latencySummary.textContent = `Audio: ${latency.latencyMs}ms | Output: ${
      latency.outputLatencyMs !== null ? `${latency.outputLatencyMs}ms` : '--'
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

  const sceneSwitch = resolveSceneSwitch(isPlaying, pendingSceneSwitch, time, getActiveBpm());
  updateQuantizeHud(sceneSwitch.quantizeHudMessage);
  if (sceneSwitch.shouldApplyScene && pendingSceneSwitch) {
    const { targetSceneId, transitionOverride } = pendingSceneSwitch;
    if (transitionOverride !== undefined) {
      applySceneWithTransitionOverride(targetSceneId, transitionOverride);
    } else {
      applyScene(targetSceneId, { transitionSource: 'slideshow' });
    }
    setStatus(`Scene switched: ${sceneSelect?.selectedOptions[0]?.textContent ?? 'Scene'}`);
    pendingSceneSwitch = null;
  }

  updateAudioAnalysis(delta);
  updateNowPlayingDiagnosticsUI();
  if (activeMode === 'mixer') {
    mixerPanel?.updateMeters(audioState.rms, audioState.peak, Array.from(audioState.bands));
  }
  if (activeMode === 'performance') {
    const updateMeter = (id: string, val: number) => {
      const el = document.getElementById(id);
      if (el) {
        const height = Math.min(100, val * 150);
        el.style.width = `${height}%`;
        if (height > 85) el.style.background = '#ff4b4b';
        else if (height > 60) el.style.background = '#ffd166';
        else el.style.background = '#1ec8ff';
      }
    };
    updateMeter('perf-meter-core', audioState.rms * 1.2);
    updateMeter('perf-meter-support', audioState.bands[3] || audioState.rms);
    updateMeter('perf-meter-atmosphere', audioState.rms * 0.6);
  }
  updateGravityWells(time, delta * 0.001);
  updatePortals(time, delta * 0.001);
  updateShapeBursts(time, delta * 0.001);
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

  if (cadence.nextTransportTime !== null) {
    transportTimeMs = cadence.nextTransportTime;
  }

  if (isPlaying && !pendingSceneSwitch) {
    const autoSceneId = sceneManager.updateAutoSwitch(transportTimeMs, {
      rms: audioState.rms,
      peak: audioState.peak
    });
    if (autoSceneId) {
      const targetName =
        currentProject.scenes.find((scene) => scene.id === autoSceneId)?.name ?? autoSceneId;
      applyScene(autoSceneId, { transitionSource: 'auto' });
      setStatus(`Auto scene switch: ${targetName}`);
    }
  }

  const activeBpm = getActiveBpm();
  if (isPlaying) {
    updateLfos(delta * 0.001, activeBpm);
    updateEnvelopes(delta * 0.001);
    updateSampleHold(delta * 0.001, activeBpm);

    // Update PlaylistManager with current BPM and audio energy
    updatePlaylistBpm(activeBpm);
    const totalEnergy = audioState.energyLow + audioState.energyMid + audioState.energyHigh;
    updatePlaylistEnergy(totalEnergy / 3);

    // Transition Decay
    if (currentTransitionAmount > 0) {
      currentTransitionAmount = Math.max(0, currentTransitionAmount - delta * currentTransitionDecay);
    } else {
      currentTransitionType = 0;
    }
  }

  resizeCanvasToDisplaySize(canvas);
  const blendSnapshot = sceneManager.getBlendSnapshot(transportTimeMs);
  const activeStyle =
    currentProject.stylePresets?.find((preset) => preset.id === currentProject.activeStylePresetId) ??
    null;

  // Global trailSpectrum update based on active scene/blend effects (not preview effects)
  const globalEffects = blendSnapshot?.effects ?? currentProject.effects ?? {
    enabled: true,
    bloom: 0.2,
    blur: 0,
    chroma: 0.1,
    posterize: 0,
    kaleidoscope: 0,
    feedback: 0,
    persistence: 0
  };
  const globalEffectiveMacros = blendSnapshot?.macros ?? currentProject.macros;
  const globalMacroSum = globalEffectiveMacros.reduce((acc, macro) => {
    macro.targets.forEach((target) => {
      const rawTarget = target.target as string | { type?: string; layerType?: string; param: string };
      let key: string | null = null;
      if (typeof rawTarget === 'string') { key = rawTarget; } 
      else if (rawTarget && rawTarget.param) {
        const layerType = rawTarget.type ?? rawTarget.layerType;
        if (layerType) key = buildLegacyTarget(layerType, rawTarget.param);
      }
      if (!key) return;
      acc[key] = (acc[key] ?? 0) + macro.value * target.amount;
    });
    return acc;
  }, {} as Record<string, number>);
  const globalPersistence = globalEffects.enabled ? (globalEffects.persistence + (globalMacroSum['effects.persistence'] ?? 0)) : 0;
  
  if (globalPersistence > 0) {
    const decay = 0.85 + globalPersistence * 0.14;
    for (let i = 0; i < trailSpectrum.length; i += 1) {
      trailSpectrum[i] = Math.max(trailSpectrum[i] * decay, audioState.spectrum[i]);
    }
  } else {
    trailSpectrum = new Float32Array(audioState.spectrum);
  }

  const activeScene =
    currentProject.scenes.find((scene) => scene.id === currentProject.activeSceneId);
  const previewScene = previewSceneId
    ? currentProject.scenes.find((scene) => scene.id === previewSceneId) ?? activeScene
    : blendSnapshot?.scene ?? activeScene;
  const outputScene = blendSnapshot?.scene ?? activeScene;
  syncRendererAssetBindingsForScene(outputScene);
  const legacyNeutral = isLegacyNeutralProject(currentProject);
  const hasActiveEngine = Boolean(currentProject.activeEngineId && currentProject.activeEngineId !== 'engine-none');

  const buildRenderStateForScene = (renderScene: typeof activeScene | undefined, dt: number, frame: number) => {
    const isBlendTarget = renderScene === activeScene || renderScene === outputScene;

    const effectiveStyleSettings = (!isBlendTarget && renderScene?.look?.stylePresets?.find((p) => p.id === renderScene.look?.activeStylePresetId)?.settings)
      ? renderScene.look.stylePresets.find((p) => p.id === renderScene.look?.activeStylePresetId)!.settings
      : (blendSnapshot?.styleSettings ?? activeStyle?.settings ?? { contrast: 1, saturation: 1, paletteShift: 0 });

    const effects = (!isBlendTarget && renderScene?.look?.effects)
      ? renderScene.look.effects
      : (blendSnapshot?.effects ?? currentProject.effects ?? {
          enabled: true, bloom: 0.2, blur: 0, chroma: 0.1, posterize: 0, kaleidoscope: 0, feedback: 0, persistence: 0
        });

    const particles = (!isBlendTarget && renderScene?.look?.particles)
      ? renderScene.look.particles
      : (blendSnapshot?.particles ?? currentProject.particles ?? { enabled: true, density: 0.35, speed: 0.3, size: 0.45, glow: 0.6 });

    const sdf = (!isBlendTarget && renderScene?.look?.sdf)
      ? renderScene.look.sdf
      : (blendSnapshot?.sdf ?? currentProject.sdf ?? { enabled: false, shape: 'circle' as const, scale: 0, edge: 0, glow: 0, rotation: 0, fill: 0 });

    const effectiveMacros = (!isBlendTarget && renderScene?.look?.macros)
      ? renderScene.look.macros
      : (blendSnapshot?.macros ?? currentProject.macros);

    const modMatrix = (!isBlendTarget && renderScene?.look?.modMatrix)
      ? renderScene.look.modMatrix
      : currentProject.modMatrix;

    const modSources = buildModSources(activeBpm, effectiveMacros);
    // Per-frame temporal low-pass context for connection `smoothing`. The state
    // Map persists at module scope across frames; dt is the frame delta (ms→s).
    const modCtx = { dt, frame, state: modSmoothingState };
    const modValue = (target: string, base: number) =>
      applyModMatrix(base, target, modSources, modMatrix, resolveModTargetRange(target), modCtx);

    // Resolve scene.next / scene.prev / scene.mix modulation targets — these are
    // trigger/blend targets the numeric applyModMatrix path can't represent, so
    // without this block a learned "scene.next" connection never advanced the
    // scene. scene.next/prev fire a debounced scene advance via the quantized
    // pendingSceneSwitch path; scene.mix drives a value-driven crossfade
    // between the active scene and the next scene.
    const sceneModConns = currentProject.modMatrix.filter(
      (c) => (c.target === 'scene.next' || c.target === 'scene.prev' || c.target === 'scene.mix') && c.enabled !== false
    );
    const scenes = currentProject.scenes;
    const activeSceneIdx = scenes.findIndex((s) => s.id === currentProject.activeSceneId);
    if (scenes.length >= 2 && activeSceneIdx !== -1) {
      // Trigger targets (next/prev): fire once per cooldown.
      const triggerConn = sceneModConns.find((c) => c.target === 'scene.next' || c.target === 'scene.prev');
      if (triggerConn && !pendingSceneSwitch && time - lastSceneModTriggerMs > SCENE_MOD_COOLDOWN_MS) {
        const sv = (modSources as Record<string, number>)[triggerConn.source] ?? 0;
        const threshold = triggerConn.amount > 0 ? triggerConn.amount : 0.7;
        if (sv >= threshold) {
          const dir = triggerConn.target === 'scene.next' ? 1 : -1;
          const nextIdx = (activeSceneIdx + dir + scenes.length) % scenes.length;
          pendingSceneSwitch = { targetSceneId: scenes[nextIdx].id, scheduledTimeMs: time, transitionOverride: undefined };
          lastSceneModTriggerMs = time;
        }
      }
      // Blend target (scene.mix): continuous crossfade toward the next scene.
      const mixConn = sceneModConns.find((c) => c.target === 'scene.mix');
      if (mixConn) {
        const fromSnap = captureSceneSnapshot(currentProject, scenes[activeSceneIdx].id);
        const toSnap = captureSceneSnapshot(currentProject, scenes[(activeSceneIdx + 1) % scenes.length].id);
        if (fromSnap && toSnap) {
          const mv = (modSources as Record<string, number>)[mixConn.source] ?? 0;
          // Bipolar remaps a [-1,1] deflection to a [0,1] mix; unipolar uses
          // the source value directly as the blend amount.
          const mixVal = mixConn.bipolar ? mv * 0.5 + 0.5 : mv;
          sceneManager.setContinuousMix(fromSnap, toSnap, mixVal);
        }
      } else {
        sceneManager.clearContinuousMix();
      }
    } else {
      sceneManager.clearContinuousMix();
    }

    const lowFreq = ((audioState.bands[0] ?? 0) + (audioState.bands[1] ?? 0)) * 0.5;
    const macroSum = effectiveMacros.reduce((acc, macro) => {
      macro.targets.forEach((target) => {
        const rawTarget = target.target as string | { type?: string; layerType?: string; param: string };
        let key: string | null = null;
        if (typeof rawTarget === 'string') { key = rawTarget; } 
        else if (rawTarget && rawTarget.param) {
          const layerType = rawTarget.type ?? rawTarget.layerType;
          if (layerType) key = buildLegacyTarget(layerType, rawTarget.param);
        }
        if (!key) return;
        acc[key] = (acc[key] ?? 0) + macro.value * target.amount;
      });
      return acc;
    }, {} as Record<string, number>);
    const macroVal = (target: string) => macroSum[target] ?? 0;

    const moddedStyle = {
      contrast: modValue('style.contrast', effectiveStyleSettings.contrast + macroVal('style.contrast')),
      saturation: modValue('style.saturation', effectiveStyleSettings.saturation + macroVal('style.saturation')),
      paletteShift: modValue('style.paletteShift', effectiveStyleSettings.paletteShift + portalShift + macroVal('style.paletteShift'))
    };

    const effectsActive = effects.enabled;
    let moddedEffects = effectsActive
      ? {
          bloom: modValue('effects.bloom', effects.bloom + macroVal('effects.bloom')),
          blur: modValue('effects.blur', effects.blur + macroVal('effects.blur')),
          chroma: modValue('effects.chroma', effects.chroma + macroVal('effects.chroma')),
          posterize: modValue('effects.posterize', effects.posterize + macroVal('effects.posterize')),
          kaleidoscope: modValue('effects.kaleidoscope', effects.kaleidoscope + macroVal('effects.kaleidoscope')),
          kaleidoscopeRotation: modValue('effects.kaleidoscopeRotation', macroVal('effects.kaleidoscopeRotation')),
          feedback: modValue('effects.feedback', effects.feedback + macroVal('effects.feedback')),
          persistence: modValue('effects.persistence', effects.persistence + macroVal('effects.persistence'))
        }
      : {
          bloom: 0, blur: 0, chroma: 0, posterize: 0, kaleidoscope: 0, kaleidoscopeRotation: 0, feedback: 0, persistence: 0
        };

    let moddedFeedbackZoom = modValue('fx-feedback.zoom', macroVal('fx-feedback.zoom'));
    let moddedFeedbackRotation = modValue('fx-feedback.rotation', macroVal('fx-feedback.rotation'));
    if (!effectsActive) {
      moddedFeedbackZoom = 0;
      moddedFeedbackRotation = 0;
    }

    let moddedParticles = {
      density: modValue('particles.density', particles.density + macroVal('particles.density')),
      speed: modValue('particles.speed', particles.speed + macroVal('particles.speed')),
      size: modValue('particles.size', particles.size + macroVal('particles.size')),
      glow: modValue('particles.glow', particles.glow + macroVal('particles.glow')),
      turbulence: modValue('particles.turbulence', (particles.turbulence ?? 0.3) + macroVal('particles.turbulence')),
      audioLift: modValue('particles.audioLift', (particles.audioLift ?? 0.5) + macroVal('particles.audioLift'))
    };

    let moddedSdf = {
      scale: modValue('sdf.scale', sdf.scale + macroVal('sdf.scale')),
      edge: modValue('sdf.edge', sdf.edge + macroVal('sdf.edge')),
      glow: modValue('sdf.glow', sdf.glow + macroVal('sdf.glow')),
      rotation: modValue('sdf.rotation', sdf.rotation + macroVal('sdf.rotation')),
      fill: modValue('sdf.fill', sdf.fill + macroVal('sdf.fill'))
    };

    const getGeneratorLayers = (scene: typeof renderScene | undefined, generatorId: string) =>
      scene?.layers.filter((layer) => layer.generatorId === generatorId) ?? [];
    type SceneLayers = NonNullable<typeof renderScene>['layers'];
    const pickTopmostEnabled = (layers: SceneLayers) => {
      for (let i = layers.length - 1; i >= 0; i -= 1) {
        if (layers[i]?.enabled) return layers[i];
      }
      return layers[0] ?? null;
    };
    const plasmaLayer = findLayerById(renderScene?.layers, 'layer-plasma');
    const spectrumLayer = findLayerById(renderScene?.layers, 'layer-spectrum');
    const origamiLayer = findLayerById(renderScene?.layers, 'layer-origami');
    const glyphLayer = findLayerById(renderScene?.layers, 'layer-glyph');
    const crystalLayer = findLayerById(renderScene?.layers, 'layer-crystal');
    const inkLayer = findLayerById(renderScene?.layers, 'layer-inkflow');
    const topoLayer = findLayerById(renderScene?.layers, 'layer-topo');
    const weatherLayer = findLayerById(renderScene?.layers, 'layer-weather');
    const portalLayer = findLayerById(renderScene?.layers, 'layer-portal');
    const mediaLayer = findLayerById(renderScene?.layers, 'layer-media');
    const oscilloLayer = findLayerById(renderScene?.layers, 'layer-oscillo');

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

  // Dynamic gen-* uniform resolution — replaces hundreds of explicit extraction lines
  const genUniforms = resolveGenUniforms({
    layers: renderScene?.layers ?? [],
    modValue,
    midiSum,
    macroSum,
    getLayerParamNumber,
    findLayerById: (layers, id) => findLayerById(layers as LayerConfig[], id),
    buildLegacyTarget,
    roleWeights: currentProject.roleWeights ?? { core: 1, support: 1, atmosphere: 1 },
  });
  const plasmaOpacity = Math.min(
    1,
    Math.max(0, (plasmaLayer?.opacity ?? 1) * (1 + (macroSum['layer-plasma.opacity'] ?? 0)))
  );
  const plasmaBaseSpeed = getLayerParamNumber(plasmaLayer, 'speed', 1.0);
  const plasmaBaseScale = getLayerParamNumber(plasmaLayer, 'scale', 1.0);
  const plasmaBaseComplexity = getLayerParamNumber(plasmaLayer, 'complexity', 0.5);
  const plasmaSpeed = Math.max(
    0.1,
    plasmaBaseSpeed + (macroSum['layer-plasma.speed'] ?? 0) + (midiSum['layer-plasma.speed'] ?? 0)
  );
  const plasmaScale = Math.max(
    0.1,
    plasmaBaseScale + (macroSum['layer-plasma.scale'] ?? 0) + (midiSum['layer-plasma.scale'] ?? 0)
  );
  const plasmaComplexity = Math.max(
    0.1,
    plasmaBaseComplexity +
      (macroSum['layer-plasma.complexity'] ?? 0) +
      (midiSum['layer-plasma.complexity'] ?? 0)
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
    lowFreq,
    legacyNeutral
  );
  const moddedPlasmaSpeed = modValue('layer-plasma.speed', plasmaSpeed);
  const moddedPlasmaScale = modValue('layer-plasma.scale', plasmaScale);
  const moddedPlasmaComplexity = modValue('layer-plasma.complexity', plasmaComplexity);
  const moddedSpectrumOpacity = applyRoleOpacity(
    modValue('layer-spectrum.opacity', spectrumOpacity),
    spectrumRole,
    lowFreq,
    legacyNeutral
  );
  const moddedOrigamiOpacity = applyRoleOpacity(
    modValue('layer-origami.opacity', origamiOpacity),
    origamiRole,
    lowFreq,
    legacyNeutral
  );
  const moddedOrigamiSpeed = modValue('layer-origami.speed', origamiSpeed);
  const moddedGlyphOpacity = applyRoleOpacity(
    modValue('layer-glyph.opacity', glyphOpacity),
    glyphRole,
    lowFreq,
    legacyNeutral
  );
  const moddedGlyphSpeed = modValue('layer-glyph.speed', glyphSpeed);
  const moddedCrystalOpacity = applyRoleOpacity(
    modValue('layer-crystal.opacity', crystalOpacity),
    crystalRole,
    lowFreq,
    legacyNeutral
  );
  const moddedCrystalScale = modValue('layer-crystal.scale', crystalScale);
  const moddedCrystalSpeed = modValue('layer-crystal.speed', crystalSpeed);
  const moddedInkOpacity = applyRoleOpacity(
    modValue('layer-inkflow.opacity', inkOpacity),
    inkRole,
    lowFreq,
    legacyNeutral
  );
  const moddedInkSpeed = modValue('layer-inkflow.speed', inkSpeed);
  const moddedInkScale = modValue('layer-inkflow.scale', inkScale);
  const moddedTopoOpacity = applyRoleOpacity(
    modValue('layer-topo.opacity', topoOpacity),
    topoRole,
    lowFreq,
    legacyNeutral
  );
  const moddedTopoScale = modValue('layer-topo.scale', topoScale);
  const moddedTopoElevation = modValue('layer-topo.elevation', topoElevation);
  const moddedWeatherOpacity = applyRoleOpacity(
    modValue('layer-weather.opacity', weatherOpacity),
    weatherRole,
    lowFreq,
    legacyNeutral
  );
  const moddedWeatherSpeed = modValue('layer-weather.speed', weatherSpeed);
  const moddedPortalOpacity = applyRoleOpacity(
    modValue('layer-portal.opacity', portalOpacity),
    portalRole,
    lowFreq,
    legacyNeutral
  );
  const moddedMediaOpacity = applyRoleOpacity(
    modValue('layer-media.opacity', mediaOpacity),
    mediaRole,
    lowFreq,
    legacyNeutral
  );
  const moddedOscilloOpacity = applyRoleOpacity(
    modValue('layer-oscillo.opacity', oscilloOpacity),
    oscilloRole,
    lowFreq,
    legacyNeutral
  );
  const plasmaEnabled = plasmaLayer?.enabled ?? true;
  const spectrumEnabled = spectrumLayer?.enabled ?? false;
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
    getAssetAudioReactValue('layer-plasma') * getRoleAudioScale(plasmaRole, lowFreq, legacyNeutral);
  const spectrumAssetBlendMode = getAssetBlendModeValue('layer-spectrum');
  const spectrumAssetAudioReact =
    getAssetAudioReactValue('layer-spectrum') * getRoleAudioScale(spectrumRole, lowFreq, legacyNeutral);
  const mediaAssetBlendMode = getAssetBlendModeValue('layer-media');
  const mediaAssetAudioReact =
    getAssetAudioReactValue('layer-media') * getRoleAudioScale(mediaRole, lowFreq, legacyNeutral);
  const expressive = currentProject.expressiveFx ?? DEFAULT_PROJECT.expressiveFx;
  const expressiveEnabled = expressive.enabled ?? true;
  const activeIntent = renderScene?.intent ?? 'ambient';
  const energyMacro = expressiveEnabled
    ? resolveExpressiveMacro(
        activeIntent,
        expressive.energyBloom.macro,
        expressive.energyBloom.intentBinding
      )
    : 0;
  const radialMacro = expressiveEnabled
    ? resolveExpressiveMacro(
        activeIntent,
        expressive.radialGravity.macro,
        expressive.radialGravity.intentBinding
      )
    : 0;
  const echoMacro = expressiveEnabled
    ? resolveExpressiveMacro(
        activeIntent,
        expressive.motionEcho.macro,
        expressive.motionEcho.intentBinding
      )
    : 0;
  const smearMacro = expressiveEnabled
    ? resolveExpressiveMacro(
        activeIntent,
        expressive.spectralSmear.macro,
        expressive.spectralSmear.intentBinding
      )
    : 0;
  const renderState: RenderState = {
    timeMs: transportTimeMs,
    rms: audioState.rms,
    peak: audioState.peak,
    bass: audioState.bass,
    mid: audioState.mid,
    treb: audioState.treb,
    bassAtt: audioState.bassAtt,
    midAtt: audioState.midAtt,
    trebAtt: audioState.trebAtt,
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
    // --- Dynamic gen-* uniform resolution — replaces hundreds of explicit extraction lines
    genUniforms,
    shapeBurstSpawnTimes,
    shapeBurstActives,
    milkDropShaderData: renderScene?._shaderData ?? null,
    spectrum: audioState.spectrum,
    contrast: moddedStyle.contrast,
    saturation: moddedStyle.saturation,
    paletteShift: moddedStyle.paletteShift,
    plasmaOpacity: moddedPlasmaOpacity,
    plasmaSpeed: moddedPlasmaSpeed,
    plasmaScale: moddedPlasmaScale,
    plasmaComplexity: moddedPlasmaComplexity,
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
    inkBrush,
    inkPressure,
    inkLifespan,
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
    motionTemplate: currentMotionTemplate,
    engineMass: (currentProject as any).engineGrammar?.mass ?? 0.5,
    engineFriction: (currentProject as any).engineGrammar?.friction ?? 0.95,
    engineElasticity: (currentProject as any).engineGrammar?.elasticity ?? 1.0,
    engineGrain: (currentProject as any).engineFinish?.grain ?? (hasActiveEngine ? 0.2 : 0),
    engineVignette: (currentProject as any).engineFinish?.vignette ?? (hasActiveEngine ? 1.0 : 0),
    engineCA: (currentProject as any).engineFinish?.ca ?? (hasActiveEngine ? 0.3 : 0),
    engineSignature: (() => {
        const id = currentProject.activeEngineId;
        if (id === 'engine-radial-core') return 1;
        if (id === 'engine-particle-flow') return 2;
        if (id === 'engine-kaleido-pulse') return 3;
        if (id === 'engine-vapor-grid') return 4;
        return 0;
    })(),
    maxBloom: ENGINE_REGISTRY[currentProject.activeEngineId as EngineId]?.constraints?.maxBloom ?? 1.0,
    forceFeedback: ENGINE_REGISTRY[currentProject.activeEngineId as EngineId]?.constraints?.forceFeedback ?? false,
    chemistryMode: getChemistryModeIndex(currentProject.colorChemistry),
    effectsEnabled: effects.enabled,
    bloom: moddedEffects.bloom,
    blur: moddedEffects.blur,
    chroma: moddedEffects.chroma,
    posterize: moddedEffects.posterize,
    kaleidoscope: moddedEffects.kaleidoscope,
    kaleidoscopeRotation: moddedEffects.kaleidoscopeRotation,
    feedback: moddedEffects.feedback,
    feedbackZoom: moddedFeedbackZoom,
    feedbackRotation: moddedFeedbackRotation,
    persistence: moddedEffects.persistence,
    trailSpectrum: trailSpectrum,
    expressiveEnergyBloom: expressiveEnabled && expressive.energyBloom.enabled ? energyMacro : 0,
    expressiveEnergyThreshold: expressiveEnabled ? expressive.energyBloom.expert.threshold : 0,
    expressiveEnergyAccumulation: expressiveEnabled ? expressive.energyBloom.expert.accumulation : 0,
    expressiveRadialGravity: expressiveEnabled && expressive.radialGravity.enabled ? radialMacro : 0,
    expressiveRadialStrength: expressiveEnabled ? expressive.radialGravity.expert.strength : 0,
    expressiveRadialRadius: expressiveEnabled ? expressive.radialGravity.expert.radius : 0,
    expressiveRadialFocusX: expressiveEnabled ? expressive.radialGravity.expert.focusX : 0,
    expressiveRadialFocusY: expressiveEnabled ? expressive.radialGravity.expert.focusY : 0,
    expressiveMotionEcho: expressiveEnabled && expressive.motionEcho.enabled ? echoMacro : 0,
    expressiveMotionEchoDecay: expressiveEnabled ? expressive.motionEcho.expert.decay : 0,
    expressiveMotionEchoWarp: expressiveEnabled ? expressive.motionEcho.expert.warp : 0,
    expressiveSpectralSmear: expressiveEnabled && expressive.spectralSmear.enabled ? smearMacro : 0,
    expressiveSpectralOffset: expressiveEnabled ? expressive.spectralSmear.expert.offset : 0,
    expressiveSpectralMix: expressiveEnabled ? expressive.spectralSmear.expert.mix : 0,
    particlesEnabled: particles.enabled,
    particleDensity: moddedParticles.density,
    particleSpeed: moddedParticles.speed,
    particleSize: moddedParticles.size,
    particleGlow: moddedParticles.glow,
    particleTurbulence: moddedParticles.turbulence,
    particleAudioLift: moddedParticles.audioLift,
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
    gravityCollapse,
    sessionHealth: sessionHealthService.getHealth(),
    performanceMode: currentProject.performanceMode?.enabled,
  };
    return { renderState };
  };

  const activeSceneData = buildRenderStateForScene(activeScene, delta / 1000, modFrame);
  const previewData = buildRenderStateForScene(previewScene, delta / 1000, modFrame);
  const outputData =
    outputOpen && outputScene?.id && outputScene?.id !== previewScene?.id
      ? buildRenderStateForScene(outputScene, delta / 1000, modFrame)
      : activeSceneData;
  lastOutputRenderState = outputData.renderState;
  const renderState = previewData.renderState;
  latestCaptureRenderSnapshot = {
    timeMs: renderState.timeMs,
    rms: renderState.rms,
    peak: renderState.peak,
    strobe: renderState.strobe,
    legacyNeutral,
    activeEngineId: currentProject.activeEngineId ?? null,
    activeModeId: currentProject.activeModeId ?? null,
    roleCoreWeight: renderState.roleWeights.core,
    roleSupportWeight: renderState.roleWeights.support,
    roleAtmosphereWeight: renderState.roleWeights.atmosphere,
    effectsEnabled: renderState.effectsEnabled,
    plasmaEnabled: renderState.plasmaEnabled,
    spectrumEnabled: renderState.spectrumEnabled,
    plasmaOpacity: renderState.plasmaOpacity,
    spectrumOpacity: renderState.spectrumOpacity,
    glyphBeat: renderState.glyphBeat,
    topoOpacity: renderState.topoOpacity,
    weatherOpacity: renderState.weatherOpacity,
    weatherMode: renderState.weatherMode,
    weatherIntensity: renderState.weatherIntensity,
    weatherSpeed: renderState.weatherSpeed,
    portalOpacity: renderState.portalOpacity,
    portalStyle: renderState.portalStyle,
    portalShift: renderState.portalShift,
    sdfEnabled: renderState.sdfEnabled,
    sdfShape: renderState.sdfShape,
    sdfScale: renderState.sdfScale,
    sdfEdge: renderState.sdfEdge,
    sdfGlow: renderState.sdfGlow,
    sdfRotation: renderState.sdfRotation,
    sdfFill: renderState.sdfFill,
    transitionAmount: renderState.transitionAmount,
    transitionType: renderState.transitionType,
    chemistryMode: renderState.chemistryMode,
    motionTemplate: renderState.motionTemplate,
    contrast: renderState.contrast,
    saturation: renderState.saturation,
    paletteShift: renderState.paletteShift,
    bloom: renderState.bloom,
    blur: renderState.blur,
    chroma: renderState.chroma,
    feedback: renderState.feedback,
    kaleidoscope: renderState.kaleidoscope,
    posterize: renderState.posterize,
  };

  if (renderState.milkDropShaderData) {
    renderer.updateMilkDropShaders?.(renderState.milkDropShaderData);
  }
   
  // console.log('[Render] Rendering scene:', activeScene?.id, 'with palette:', activeScene?.look?.activePaletteId ?? 'project default');
  renderer.render(renderState);

  if (postTransitionFramesLeft > 0 && transitionTracerSeq !== null) {
    const brightness = renderer.captureFrameBrightness?.() ?? { avgBrightness: 0, nonBlackRatio: 0 };
    const renderSnapshot = renderer.getLastRenderSnapshot?.();
    const activeScene_ = currentProject.scenes.find(s => s.id === currentProject.activeSceneId);
    const activeGens = activeScene_ ? [...collectSceneGeneratorIds(activeScene_)] : [];
    const activeFxNames: string[] = [];
    if (currentProject.effects?.enabled) {
      if (currentProject.effects.bloom > 0) activeFxNames.push('bloom');
      if (currentProject.effects.blur > 0) activeFxNames.push('blur');
      if (currentProject.effects.chroma > 0) activeFxNames.push('chroma');
      if (currentProject.effects.posterize > 0) activeFxNames.push('posterize');
    }
    transitionTracer.recordFrameSample(transitionTracerSeq, {
      drawCallCount: renderSnapshot?.drawCallCount ?? 1,
      avgBrightness: brightness.avgBrightness,
      nonBlackRatio: brightness.nonBlackRatio,
      activeGenerators: activeGens,
      activeFx: activeFxNames,
      asyncPending: renderer.hasPendingProgram?.() ?? false,
      pendingGenerators: renderer.getPendingProgramGenerators?.() ?? null,
      currentProgramGenerators: renderer.getCurrentProgramGenerators?.() ?? null,
      currentPasses: renderSnapshot?.passNames ?? null,
      currentProgramKind: renderSnapshot?.currentProgramKind ?? null,
      expectedShaderVariantKey: transitionTracer.getRecentTransitions(1)[0]?.expectedShaderVariantKey ?? null,
      currentShaderVariantKey: renderer.getCurrentShaderVariantKey?.() ?? null,
      pendingShaderVariantKey: renderer.getPendingShaderVariantKey?.() ?? null
    });
    if (renderSnapshot?.framebufferAllocated) {
      transitionTracer.recordStep(transitionTracerSeq, 'framebufferAllocated');
    }
    if (renderSnapshot?.framebufferRebound) {
      transitionTracer.recordStep(transitionTracerSeq, 'framebufferRebound');
    }
    if ((renderSnapshot?.passNames.length ?? 0) > 0) {
      transitionTracer.recordStep(transitionTracerSeq, 'fxGraphRebound');
    }
    if (renderSnapshot?.uniformsApplied || brightness.avgBrightness > 0.01) {
      transitionTracer.recordStep(transitionTracerSeq, 'uniformsApplied');
    }
    if (renderSnapshot?.finalCompositeAttached || brightness.avgBrightness > 0.01) {
      transitionTracer.recordStep(transitionTracerSeq, 'compositeAttached');
    }
    postTransitionFramesLeft--;
  }

  resizeCanvasToDisplaySize(visualizerCanvas);
  updateSceneTimelineProgress(blendSnapshot);
  drawVisualizer(blendSnapshot?.visualizer ?? currentProject.visualizer);
  overlayRenderer.draw();

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Debug Overlay Update - Shows layer/FX execution status
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const debugActiveScene = outputScene ?? currentProject.scenes.find((s) => s.id === currentProject.activeSceneId);
  const gu = outputData.renderState.genUniforms;
  debugOverlay.update(
    {
      frameId: Math.floor(time),
      activeSceneId: debugActiveScene?.id ?? '',
      activeSceneName: debugActiveScene?.name ?? '—',
      activeModeId: currentProject.activeModeId ?? '',
      activeEngineId: currentProject.activeEngineId ?? '',
      activePaletteId:
        debugActiveScene?.look?.activePaletteId ??
        currentProject.activePaletteId ??
        '',
      layerCount: debugActiveScene?.layers.length ?? 0,
      layers: (debugActiveScene?.layers ?? []).map((layer) => ({
        id: layer.id,
        idRaw: layer.id,
        generatorId: layer.generatorId ?? '',
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
      uniformsUpdatedFrameId: Math.floor(time),
      lastShaderError,
      milkdropCompileReport: renderer.getMilkDropCompileReport(),
      milkdropRuntimeReport: renderer.getMilkDropNativeRuntimeReport(),
      sessionHealth: sessionHealthService.getHealth(),
      laser: {
        enabled: (gu.LaserEnabled ?? 0) > 0,
        opacity: gu.LaserOpacity ?? 0,
        beamCount: gu.LaserBeamCount ?? 0,
        beamWidth: gu.LaserBeamWidth ?? 0,
        beamLength: gu.LaserBeamLength ?? 0,
        glow: gu.LaserGlow ?? 0,
        present: (gu.LaserEnabled ?? 0) > 0,
        enabledInScene: (gu.LaserEnabled ?? 0) > 0,
        idRaw: 'gen-laser-beam',
        idBytes: '',
        matchTarget: 'gen-laser-beam',
        matchNormalized: 'gen-laser-beam'
      },
      generators: []
    },
    currentFps
  );

  if (cadence.shouldBroadcastOutput) {
    lastOutputBroadcast = time;
    const broadcastScene = activeScene;
    const generatorIds = broadcastScene ? collectSceneGeneratorIds(broadcastScene) : new Set<string>();
    if (currentProject.sdf?.enabled) {
      generatorIds.add('gen-sdf');
    }
    outputChannel.postMessage(
      buildRendererOutputBroadcastPayload({
        renderState: outputData.renderState,
        project: currentProject,
        scene: broadcastScene,
        activePaletteId:
          broadcastScene?.look?.activePaletteId ??
          currentProject.activePaletteId,
        activeGeneratorIds: [...generatorIds],
        shaderVariantKey: getRendererShaderVariantKey(),
        transition: getLatestTransitionPayload()
      })
    );
  }

  requestAnimationFrame(render);
};

// Loading progress tracking
const updateLoadingProgress = (progress: number, status: string) => {
  const progressBar = document.getElementById('loading-progress-bar');
  const statusText = document.getElementById('loading-status');

  if (progressBar) {
    progressBar.style.width = `${progress}%`;
  }
  if (statusText) {
    statusText.textContent = status;
  }
};

const hideLoadingSplash = () => {
  const splash = document.getElementById('loading-splash');
  if (splash) {
    splash.classList.add('fade-out');
    setTimeout(() => {
      splash.style.display = 'none';
    }, 500);
  }
};

const init = async () => {
  updateLoadingProgress(0, 'Initializing application...');

  ensureVisualSynthBridge(window);

  try {
    const sessionId = await window.visualSynth.getSessionId();
    initSessionLog(sessionId);
  } catch {
    initSessionLog('unknown');
  }

  try {
    const savedNowPlayingSettings = await window.visualSynth.getNowPlayingSettings();
    applyNowPlayingSettings(savedNowPlayingSettings);
  } catch {
    updateNowPlayingStatusText();
  }
  window.setInterval(() => {
    void pollNowPlayingMetadataSource();
  }, 1000);

  updateLoadingProgress(5, 'Setting up interface...');
  initPads();
  initShortcuts();
  initSceneStrip();
  initPanelCollapse();
  initDragAndDropMapping();
  renderMappingTargets();
  if (mappingTargetSearch) {
    mappingTargetSearch.addEventListener('input', () => {
      renderMappingTargets(mappingTargetSearch.value);
    });
  }
  initMatrixTabs();
  initAssetTabs();
  initLearnables();
  initSpectrumHint();
  loadPlaylist();
  renderPlaylist();
  loadShaderDraft();
  syncVisualizerFromProject();
  setCaptureStatus('Idle');

  liveSortSelect?.addEventListener('change', () => renderLivePadGrid());
  livePlaylistPlay?.addEventListener('click', () => startLivePlaylist());
  livePlaylistStop?.addEventListener('click', () => stopLivePlaylist());
  [liveMacroEnergy, liveMacroSpeed, liveMacroColor, liveMacroDepth].forEach((control, index) => {
    control?.addEventListener('input', () => {
      const v = Number(control.value);
      const label = document.getElementById(['live-macro-energy-value', 'live-macro-speed-value', 'live-macro-color-value', 'live-macro-depth-value'][index]);
      if (label) label.textContent = v.toFixed(2);
      if (index < (currentProject.macros?.length ?? 0)) {
        updateMacroFromHero(index, v);
      }
    });
  });

  updateLoadingProgress(10, 'Loading presets...');
  console.log('[Init] Starting initPresets...');
  await initPresets();
  console.log('[Init] initPresets completed');
  if (activeMode === 'live') renderLivePadGrid();

  updateLoadingProgress(20, 'Loading templates...');
  console.log('[Init] Starting initTemplates...');
  await initTemplates();
  console.log('[Init] initTemplates completed');
  initEngineSelect();

  updateLoadingProgress(30, 'Configuring outputs...');
  console.log('[Init] Starting initOutputConfig...');
  await initOutputConfig();
  console.log('[Init] initOutputConfig completed');

  updateLoadingProgress(40, 'Setting up output manager...');
  console.log('[Init] Starting initOutputManagerPanel...');
  await initOutputManagerPanel();
  console.log('[Init] initOutputManagerPanel completed');

  updateLoadingProgress(50, 'Initializing playlist...');
  console.log('[Init] Starting initPlaylistManager...');
  initPlaylistManager();
  console.log('[Init] initPlaylistManager completed');

  refreshSceneSelect();
  applyScene(currentProject.activeSceneId);

  updateLoadingProgress(60, 'Connecting to network...');
  console.log('[Init] Starting initBpmNetworking...');
  await initBpmNetworking();
  console.log('[Init] initBpmNetworking completed');

  updateLoadingProgress(65, 'Loading generators...');
  console.log('[Init] Starting loadGeneratorLibrary...');
  loadGeneratorLibrary();
  console.log('[Init] loadGeneratorLibrary completed');

  updateLoadingProgress(70, 'Building user interface...');
  bpmSourceSelect.value = bpmSource;
  beatSensitivityInput.value = String(beatSensitivity);
  beatFilterSelect.value = beatFilterRange;
  beatHoldOffInput.value = String(beatHoldOffMs);
  updateBpmSourceUI();
  updateBpmDisplay();
  refreshGeneratorUI();
  initStylePresets();
  initPalettes();
  initMacros();
  initEffects();
  initParticles();
  initSdf();
  mixerPanel = createMixerPanel({
    store: {
      getState: () => ({ project: currentProject }),
      dispatch: (action: any) => { /* dummy */ }
    } as any,
    onLayerListChanged: () => {
      renderLayerList();
      syncPerformanceToggles();
    },
    onPaletteChange: (paletteId: string) => {
      paletteSelect.value = paletteId;
      applyPaletteSelection(paletteId);
    },
    onChemistryChange: (chemistry: string) => {
      currentProject.colorChemistry = [chemistry];
      chemistrySelect.value = chemistry;
      setStatus(`Color Chemistry set to: ${chemistry}`);
    },
    onEnvelopeChange: () => {
      // The mixer's intensity-envelope dials are a duplicate of the modulation
      // panel's envelope dials (same underlying project envelopes). Rebuild
      // the modulation list so it reflects attack/release edits made from the
      // mixer instead of showing stale values.
      renderEnvelopeList();
    },
    getProjectData: () => currentProject as any,
  });
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

  updateLoadingProgress(80, 'Initializing audio devices...');
  console.log('[Init] Starting initAudioDevices...');
  try {
    await initAudioDevices();
    console.log('[Init] initAudioDevices completed');

    updateLoadingProgress(85, 'Waiting for audio engine & microphone...');
    await setupAudio();
    console.log('[Init] setupAudio completed');

    updateLoadingProgress(90, 'Connecting MIDI...');
    await setupMIDI();
    console.log('[Init] setupMIDI completed');
  } catch (e) {
    console.error('[Init] Audio setup error:', e);
    audioEngineFailed = true;
    sessionLog.log('error', 'audio.engine_failure', { error: e instanceof Error ? e.message : String(e) });
    updateLoadingProgress(90, 'Audio setup failed (check permissions), continuing...');
  }

  // Check if recovery API is available
  updateLoadingProgress(92, 'Checking recovery session...');
  if (window.visualSynth) {
    console.log('[Init] Starting recovery check...');
    try {
      if (suppressStartupRecovery) {
        console.log('[Init] Recovery check skipped because a manual project open was requested.');
      } else {
      const startupSelection = await selectStartupProject(window.visualSynth, localStorage);
      await applyStartupSelection(startupSelection, {
        applyProject,
        setStatus,
        log: (message) => console.log(`[Init] ${message}`),
        warn: (message, detail) => console.warn(`[Init] ${message}:`, detail),
        invalidRecoveryFallbackStatus: 'Recovery session found but failed to load.',
        onRecoveryLoaded: () => {
          isRecoveryProject = true;
          projectDirty = true;
        }
      });
      }
    } catch {
      setStatus('Recovery session found but failed to load.');
    }
  } else {
    console.log('[Init] Recovery API not available - skipping');
  }

  updateLoadingProgress(95, 'Finalizing setup...');
  console.log('[Init] Starting final setup...');
  syncTempoInputs(Number(tempoInput.value));
  console.log('[Init] syncTempoInputs completed');

  setMode('performance');
  console.log('[Init] setMode completed');

  if (currentProject.activeModeId) {
    applyVisualMode(currentProject.activeModeId, {
      preservePalette: true,
      preserveEffects: true,
      preserveModMatrix: true,
      preserveMotionMacro: true
    });
  }

  updateTransportUI();
  console.log('[Init] updateTransportUI completed');

  updateLoadingProgress(98, 'Starting render engine...');
  if (!(window as any).__renderLoopStarted) {
    (window as any).__renderLoopStarted = true;
    requestAnimationFrame(render);
  }
  console.log('[Init] requestAnimationFrame completed');

  updateLoadingProgress(100, 'Ready!');
  console.log('VisualSynth init completed - render loop started');
  (window as any).__visualSynthInitialized = true;
  console.log('[Init] Initialized flag set');

  // Hide splash screen after a brief moment
  setTimeout(() => {
    hideLoadingSplash();
  }, 300);

  // Handle close request from main process (Electron only)
  try {
    if (typeof window.visualSynth?.onCloseRequested === 'function') {
      window.visualSynth.onCloseRequested(async () => {
        if (!projectDirty) {
          await window.visualSynth.confirmClose();
          return;
        }

        const { result } = await window.visualSynth.showSaveDialog(isRecoveryProject);

        if (result === 'cancel') {
          return;
        }

        if (result === 'save') {
          const payload = serializeProject();
          const saveResult = isRecoveryProject
            ? await window.visualSynth.saveProjectAs(payload)
            : await window.visualSynth.saveProject(payload);

          if (saveResult.canceled) {
            return;
          }
          projectDirty = false;
        }

        await window.visualSynth.confirmClose();
      });
    }
  } catch {
    // Running outside Electron (browser testing) — no close handler needed
  }

  // Expose capture API for screenshot automation
  (window as any).__visualSynthCaptureApi = {
    applyProject: async (project: VisualSynthProject, options: { skipRecovery?: boolean } = {}) => {
      if (options.skipRecovery) {
        console.log('[Capture API] Skipping recovery session as requested');
        // We can't easily 'cancel' the pending recovery check if it's already started,
        // but we can ensure this application takes precedence.
      }
      await applyProject(project);
    },
    getCurrentProject: () => {
      return { ...currentProject };
    },
    getDiagnostics: () => {
      return buildCaptureDiagnostics(
        currentProject,
        safeModeReasons,
        lastShaderError,
        renderer.getGeneratorDiagnostics(),
        renderer.getMissingUniforms(),
        renderer.getMilkDropCompileReport(),
        renderer.getMilkDropNativeRuntimeReport(),
        latestCaptureRenderSnapshot
      );
    },
    applyScene: (sceneId: string) => {
      applyScene(sceneId);
    },
    getTransitionDump: () => {
      return transitionTracer.getDump({
        programCacheSize: renderer.getProgramCacheSize?.() ?? -1,
        asyncCompilationSupported: renderer.asyncCompilationAvailable?.() ?? false
      });
    },
    runTransitionRegressionCycle: async (iterations = 10, delayMs = 200, sceneIds?: string[]) => {
      const pool = sceneIds?.length
        ? sceneIds.filter((sceneId) => currentProject.scenes.some((scene) => scene.id === sceneId))
        : currentProject.scenes.slice(0, 3).map(s => s.id);
      const sources: TransitionSource[] = ['slideshow', 'manual', 'recover'];
      const sceneIdsToUse = pool.length > 0 ? pool : currentProject.scenes.map(s => s.id);
      const startingCount = transitionTracer.getDump().totalTransitions;
      if (sceneIdsToUse.length < 2) {
        console.warn('[TransitionRegression] Need at least 2 scenes');
        return transitionTracer.getDump();
      }
      console.log(`[TransitionRegression] Starting ${iterations} cycles across ${sceneIdsToUse.length} scenes...`);
      for (let i = 0; i < iterations; i++) {
        const targetId = sceneIdsToUse[i % sceneIdsToUse.length];
        const source = sources[i % sources.length];
        applyScene(targetId, { transitionSource: source });
        await new Promise<void>(resolve => setTimeout(resolve, delayMs));
      }
      const dump = transitionTracer.getDump();
      const runTransitions = dump.recentTransitions.filter((transition) => transition.seq > startingCount);
      const flagged = runTransitions.filter((transition) => transition.flaggedBlack);
      console.log(
        `[TransitionRegression] Done. Run transitions: ${runTransitions.length}, Black: ${flagged.length}`,
        {
          flagged: flagged.map((transition) => ({
            seq: transition.seq,
            source: transition.source,
            prevScene: transition.prevSceneName,
            nextScene: transition.nextSceneName,
            suspectedDifferingInitStep: transition.suspectedDifferingInitStep,
            expectedShaderVariantKey: transition.expectedShaderVariantKey,
            observedShaderVariantKeys: transition.observedShaderVariantKeys
          })),
          dump
        }
      );
      return dump;
    },
    setMode: (mode: UiMode) => {
      setMode(mode);
    },
    triggerAction: (action: string, velocity: number = 1.0) => {
      if ((window as any).renderGraph) {
        (window as any).renderGraph.handlePadAction(action, velocity);
      }
    }
  };
  (window as any).__outputDump = () => {
    const dump = transitionTracer.getDump({
      programCacheSize: renderer.getProgramCacheSize?.() ?? -1,
      asyncCompilationSupported: renderer.asyncCompilationAvailable?.() ?? false
    });
    const diagnostics = buildCaptureDiagnostics(
      currentProject,
      safeModeReasons,
      lastShaderError,
      renderer.getGeneratorDiagnostics(),
      renderer.getMissingUniforms(),
      renderer.getMilkDropCompileReport(),
      renderer.getMilkDropNativeRuntimeReport(),
      latestCaptureRenderSnapshot
    );
    const result = {
      transitionDump: dump,
      renderSnapshot: diagnostics,
      firstBlackPass: dump.firstBlackPass,
      lastNonBlackPass: dump.lastNonBlackPass
    };
    console.log('[__outputDump]', JSON.stringify(result, null, 2));
    return result;
  };

  console.log('[Init] Capture API exposed');
};

// Initialize the application
void init();
