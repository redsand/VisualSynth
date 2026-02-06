import { applyModMatrix } from '../../shared/modMatrix';
import { buildLegacyTarget } from '../../shared/parameterRegistry';
import { DEFAULT_PROJECT } from '../../shared/project';
import { ENGINE_REGISTRY, type EngineId } from '../../shared/engines';
import type { Store } from '../state/store';
import type { RenderState } from '../glRenderer';
import { burstSdfManager } from '../sdf/runtime/burstSdfManager';
import { EDM_DROP_COLLECTION, getEdmPreset } from '../sdf/presets/edmPresets';
import {
  SceneMacro,
  MacroExecutionState,
  createMacroExecutionState,
  getSceneMacro,
  interpolateMacroValue
} from '../../shared/sceneMacros';
import {
  MidiSceneConfig,
  MidiTriggerResult,
  processMidiNote,
  processMidiCC,
  createLaunchpadLayout,
  DEFAULT_MIDI_SCENE_CONFIG
} from '../../shared/midiSceneTriggers';
import {
  DROP_CLASSIC,
  DROP_HARD,
  BREAKDOWN_CALM,
  BREAKDOWN_ATMOSPHERIC,
  BUILD_8BAR,
  BUILD_4BAR,
  TRANSITION_FLASH
} from '../../shared/sceneMacros';

export interface LayerDebugInfo {
  id: string;
  idRaw: string;
  generatorId: string;
  name: string;
  enabled: boolean;
  opacity: number;
  blendMode: string;
  fboSize: string;
  lastRenderedFrameId: number;
  nonEmpty: boolean;
}

export interface FxDebugInfo {
  id: string;
  enabled: boolean;
  bypassed: boolean;
  lastAppliedFrameId: number;
}

export interface RenderDebugState {
  frameId: number;
  activeSceneId: string;
  activeSceneName: string;
  activeModeId: string;
  activeEngineId: string;
  activePaletteId: string;
  layerCount: number;
  layers: LayerDebugInfo[];
  fx: FxDebugInfo[];
  masterBusFrameId: number;
  uniformsUpdatedFrameId: number;
  laser: {
    enabled: boolean;
    opacity: number;
    beamCount: number;
    beamWidth: number;
    beamLength: number;
    glow: number;
    present: boolean;
    enabledInScene: boolean;
    idRaw: string;
    idBytes: string;
    matchTarget: string;
    matchNormalized: string;
  };
}

type FxId = 'bloom' | 'blur' | 'chroma' | 'posterize' | 'kaleidoscope' | 'feedback' | 'persistence';
type LayerRole = 'core' | 'support' | 'atmosphere';

const ROLE_SETTINGS: Record<LayerRole, { audioScale: number; fxCap: number; bloomBoost: number; opacityBoost: number; lowFreqOnly: boolean }> = {
  core: { audioScale: 1.0, fxCap: 1.0, bloomBoost: 1.15, opacityBoost: 1.05, lowFreqOnly: false },
  support: { audioScale: 0.75, fxCap: 0.75, bloomBoost: 1.0, opacityBoost: 1.0, lowFreqOnly: false },
  atmosphere: { audioScale: 0.45, fxCap: 0.5, bloomBoost: 0.9, opacityBoost: 0.95, lowFreqOnly: true }
};

const getChemistryModeIndex = (tags: string[] = []) => {
  if (tags.includes('triadic')) return 1;
  if (tags.includes('complementary')) return 2;
  if (tags.includes('monochromatic')) return 3;
  return 0;
};

const getLayerRole = (layer?: { role?: LayerRole; id?: string }): LayerRole => {
  if (layer?.role) return layer.role;
  if (layer?.id === 'layer-plasma') return 'core';
  if (layer?.id === 'layer-spectrum') return 'support';
  if (layer?.id === 'layer-origami') return 'support';
  if (layer?.id === 'layer-glyph') return 'support';
  if (layer?.id === 'layer-crystal') return 'support';
  if (layer?.id === 'layer-inkflow') return 'atmosphere';
  if (layer?.id === 'layer-topo') return 'atmosphere';
  if (layer?.id === 'layer-weather') return 'atmosphere';
  if (layer?.id === 'layer-portal') return 'atmosphere';
  if (layer?.id === 'layer-media') return 'support';
  if (layer?.id === 'layer-oscillo') return 'support';
  // EDM Generators
  if (layer?.id === 'gen-laser-beam') return 'support'; // High visibility, audio reactive
  if (layer?.id === 'gen-strobe') return 'core'; // Full screen flash, high impact
  if (layer?.id === 'gen-shape-burst') return 'support'; // Beat-synced shapes
  if (layer?.id === 'gen-grid-tunnel') return 'atmosphere'; // Background grid effect
  
  // New 31 Generators Roles
  if (layer?.id === 'gen-nebula-cloud') return 'atmosphere';
  if (layer?.id === 'gen-circuit-board') return 'support';
  if (layer?.id === 'gen-lorenz-attractor') return 'support';
  if (layer?.id === 'gen-mandala-spinner') return 'support';
  if (layer?.id === 'gen-starburst-galaxy') return 'support';
  if (layer?.id === 'gen-digital-rain-v2') return 'atmosphere';
  if (layer?.id === 'gen-lava-flow') return 'atmosphere';
  if (layer?.id === 'gen-crystal-growth') return 'atmosphere';
  if (layer?.id === 'gen-techno-grid') return 'atmosphere';
  if (layer?.id === 'gen-magnetic-field') return 'atmosphere';
  if (layer?.id === 'gen-prism-shards') return 'support';
  if (layer?.id === 'gen-neural-net') return 'atmosphere';
  if (layer?.id === 'gen-aurora-chord') return 'atmosphere';
  if (layer?.id === 'gen-vhs-glitch') return 'atmosphere';
  if (layer?.id === 'gen-moire-pattern') return 'support';
  if (layer?.id === 'gen-hypercube') return 'core';
  if (layer?.id === 'gen-fluid-swirl') return 'atmosphere';
  if (layer?.id === 'gen-ascii-stream') return 'atmosphere';
  if (layer?.id === 'gen-retro-wave') return 'core';
  if (layer?.id === 'gen-bubble-pop') return 'support';
  if (layer?.id === 'gen-sound-wave-3d') return 'support';
  if (layer?.id === 'gen-particle-vortex') return 'atmosphere';
  if (layer?.id === 'gen-glow-worms') return 'atmosphere';
  if (layer?.id === 'gen-mirror-maze') return 'support';
  if (layer?.id === 'gen-pulse-heart') return 'core';
  if (layer?.id === 'gen-data-shards') return 'atmosphere';
  if (layer?.id === 'gen-hex-cell') return 'atmosphere';
  if (layer?.id === 'gen-plasma-ball') return 'atmosphere';
  if (layer?.id === 'gen-warp-drive') return 'core';
  if (layer?.id === 'gen-visual-feedback') return 'support';
  if (layer?.id === 'gen-mycelium-growth') return 'atmosphere';

  return 'support';
};

const applyRoleOpacity = (opacity: number, role: LayerRole, lowFreq: number) => {
  const settings = ROLE_SETTINGS[role];
  if (settings.lowFreqOnly) {
    return opacity * (0.35 + lowFreq * 0.65);
  }
  return opacity * settings.opacityBoost;
};

const getRoleAudioScale = (role: LayerRole, lowFreq: number) => {
  const settings = ROLE_SETTINGS[role];
  const lowFreqScale = settings.lowFreqOnly ? 0.3 + lowFreq * 0.7 : 1;
  return settings.audioScale * lowFreqScale;
};

const normalizeLayerId = (value: string) =>
  value
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const findLayerById = (
  layers: { id?: string; generatorId?: string }[] | undefined,
  id: string
) => {
  const target = normalizeLayerId(id);
  return layers?.find((layer) => {
    const layerId = normalizeLayerId(layer.id ?? '');
    if (layerId === target) return true;
    const generatorId = normalizeLayerId(layer.generatorId ?? '');
    return generatorId === target;
  });
};

export class RenderGraph {
  private trailSpectrum = new Float32Array(64);
  private gravityWells = Array.from({ length: 8 }, () => ({
    x: 0,
    y: 0,
    baseX: 0,
    baseY: 0,
    strength: 0,
    polarity: 1,
    active: false,
    phase: Math.random() * Math.PI * 2
  }));
  private gravityPositions = new Float32Array(16);
  private gravityStrengths = new Float32Array(8);
  private gravityPolarities = new Float32Array(8);
  private gravityActives = new Float32Array(8);
  private gravityFixedSlots = [
    { x: -0.45, y: -0.35 },
    { x: 0.45, y: -0.35 },
    { x: -0.45, y: 0.35 },
    { x: 0.45, y: 0.35 },
    { x: 0, y: -0.5 },
    { x: 0, y: 0.5 },
    { x: -0.6, y: 0 },
    { x: 0.6, y: 0 }
  ];
  private portals = Array.from({ length: 4 }, () => ({
    x: 0,
    y: 0,
    radius: 0.2,
    active: false,
    phase: Math.random() * Math.PI * 2
  }));
  private portalPositions = new Float32Array(8);
  private portalRadii = new Float32Array(4);
  private portalActives = new Float32Array(4);
  private lastPortalAutoSpawn = 0;
  private mediaBurstPositions = new Float32Array(16);
  private mediaBurstRadii = new Float32Array(8);
  private mediaBurstTypes = new Float32Array(8);
  private mediaBurstActives = new Float32Array(8);
  private oscilloCapture = new Float32Array(256);
  // Shape Burst state management
  private shapeBurstSlots = Array.from({ length: 8 }, () => ({
    active: false,
    spawnTime: 0
  }));
  private shapeBurstSpawnTimes = new Float32Array(8);
  private shapeBurstActives = new Float32Array(8);
  private lastShapeBurstSpawn = 0;
  private shapeBurstSlotIndex = 0;
  private debugState: RenderDebugState = {
    frameId: 0,
    activeSceneName: '',
    activeModeId: '',
    activeEngineId: '',
    activePaletteId: '',
    layerCount: 0,
    layers: [],
    fx: [],
    masterBusFrameId: 0,
    uniformsUpdatedFrameId: 0,
    laser: {
      enabled: false,
      opacity: 0,
      beamCount: 0,
      beamWidth: 0,
      beamLength: 0,
      glow: 0,
      present: false,
      enabledInScene: false,
      idRaw: '',
      idBytes: ''
    }
  };
  private fxDeltaUntil: Record<FxId, number> = {
    bloom: 0,
    blur: 0,
    chroma: 0,
    posterize: 0,
    kaleidoscope: 0,
    feedback: 0,
    persistence: 0
  };
  private debugTint = false;
  private debugFxDelta = false;
  private burstSdfInitialized = false;
  private macroState: MacroExecutionState = createMacroExecutionState();
  private midiSceneConfig: MidiSceneConfig = DEFAULT_MIDI_SCENE_CONFIG;
  private onLoadPreset: ((path: string, name: string, crossfade: number) => Promise<void>) | null = null;
  private onPlaylistControl: ((control: string) => void) | null = null;

  constructor(private store: Store) {
    // Initialize with Launchpad layout by default
    this.midiSceneConfig = createLaunchpadLayout();
  }

  /**
   * Initialize burst SDF presets for beat-triggered expanding shapes
   */
  private initBurstSdfPresets() {
    if (this.burstSdfInitialized) return;

    // Load the EDM drop collection presets by default
    for (const config of EDM_DROP_COLLECTION) {
      burstSdfManager.addBurst(config);
    }

    this.burstSdfInitialized = true;
    console.log('[RenderGraph] EDM burst SDF presets initialized');
  }

  /**
   * Load a specific EDM preset collection by ID
   */
  loadEdmPreset(presetId: string): boolean {
    const preset = getEdmPreset(presetId);
    if (!preset) {
      console.warn(`[RenderGraph] EDM preset "${presetId}" not found`);
      return false;
    }

    burstSdfManager.clearBursts();
    for (const config of preset.configs) {
      burstSdfManager.addBurst(config);
    }
    console.log(`[RenderGraph] Loaded EDM preset: ${preset.name}`);
    return true;
  }

  /**
   * Trigger a scene macro
   */
  triggerMacro(macroId: string): boolean {
    const macro = getSceneMacro(macroId);
    if (!macro) {
      console.warn(`[RenderGraph] Scene macro "${macroId}" not found`);
      return false;
    }

    const state = this.store.getState();
    const runtime = state.runtime;

    this.macroState = {
      activeMacro: macro,
      startTime: runtime.time,
      startBeat: runtime.beatCount ?? 0,
      progress: 0,
      isRunning: macro.durationBeats > 0
    };

    // Apply instant changes
    if (macro.durationBeats === 0) {
      this.applyMacroChanges(macro, 1.0);
    }

    console.log(`[RenderGraph] Triggered macro: ${macro.name}`);
    return true;
  }

  /**
   * Apply macro parameter changes
   */
  private applyMacroChanges(macro: SceneMacro, progress: number): void {
    const state = this.store.getState();
    const runtime = state.runtime;
    const project = state.project;

    for (const change of macro.changes) {
      const value = macro.durationBeats > 0
        ? interpolateMacroValue(change, progress, macro.easing)
        : change.value;

      this.applyMacroParam(change.target, value);
    }
  }

  /**
   * Apply a single macro parameter
   */
  private applyMacroParam(target: string, value: number | string | boolean): void {
    const state = this.store.getState();
    const runtime = state.runtime;

    // Map target paths to actual state updates
    switch (target) {
      case 'effects.bloom':
        if (state.project.effects && typeof value === 'number') {
          state.project.effects.bloom = value;
        }
        break;
      case 'effects.blur':
        if (state.project.effects && typeof value === 'number') {
          state.project.effects.blur = value;
        }
        break;
      case 'effects.chroma':
        if (state.project.effects && typeof value === 'number') {
          state.project.effects.chroma = value;
        }
        break;
      case 'effects.feedback':
        if (state.project.effects && typeof value === 'number') {
          state.project.effects.feedback = value;
        }
        break;
      case 'effects.persistence':
        if (state.project.effects && typeof value === 'number') {
          state.project.effects.persistence = value;
        }
        break;
      case 'effects.kaleidoscope':
        if (state.project.effects && typeof value === 'number') {
          state.project.effects.kaleidoscope = value;
        }
        break;
      case 'strobe.intensity':
        if (typeof value === 'number') {
          runtime.strobeIntensity = value;
        }
        break;
      case 'strobe.rate':
        // Store in runtime for reference
        if (typeof value === 'number') {
          (runtime as any).strobeRate = value;
        }
        break;
      case 'burst.enabled':
        if (typeof value === 'boolean') {
          burstSdfManager.setEnabled(value);
        }
        break;
      case 'burst.preset':
        if (typeof value === 'string') {
          this.loadEdmPreset(value);
        }
        break;
      // Note: Layer-specific params would need to go through the project mutation
      // For now, we handle the runtime-accessible ones
      default:
        // Store as runtime property for shader access
        const key = target.replace('.', '_');
        (runtime as any)[`macro_${key}`] = value;
        break;
    }
  }

  /**
   * Update running macro progress
   */
  private updateMacro(time: number, currentBeat: number): void {
    if (!this.macroState.isRunning || !this.macroState.activeMacro) {
      return;
    }

    const macro = this.macroState.activeMacro;
    const elapsedBeats = currentBeat - this.macroState.startBeat;
    const progress = Math.min(1, elapsedBeats / macro.durationBeats);

    this.macroState.progress = progress;
    this.applyMacroChanges(macro, progress);

    if (progress >= 1) {
      this.macroState.isRunning = false;
      console.log(`[RenderGraph] Macro completed: ${macro.name}`);
    }
  }

  /**
   * Get current macro state (for UI)
   */
  getMacroState(): MacroExecutionState {
    return this.macroState;
  }

  // ============================================================================
  // MIDI Scene Trigger Methods
  // ============================================================================

  /**
   * Set callback for loading presets (from MIDI triggers)
   */
  setPresetLoader(handler: (path: string, name: string, crossfade: number) => Promise<void>): void {
    this.onLoadPreset = handler;
  }

  /**
   * Set callback for playlist controls
   */
  setPlaylistController(handler: (control: string) => void): void {
    this.onPlaylistControl = handler;
  }

  /**
   * Set MIDI scene trigger configuration
   */
  setMidiSceneConfig(config: MidiSceneConfig): void {
    this.midiSceneConfig = config;
    console.log('[RenderGraph] MIDI scene config updated');
  }

  /**
   * Get current MIDI scene config
   */
  getMidiSceneConfig(): MidiSceneConfig {
    return this.midiSceneConfig;
  }

  /**
   * Handle MIDI note trigger for scene actions
   */
  handleMidiNote(channel: number, note: number, velocity: number, bank: number = 0): boolean {
    const result = processMidiNote(this.midiSceneConfig, channel, note, velocity, bank);

    if (!result.handled || !result.action) {
      return false;
    }

    const { type, value, velocity: actionVelocity } = result.action;

    switch (type) {
      case 'macro':
        this.triggerMacro(value as string);
        break;

      case 'preset':
        if (this.onLoadPreset) {
          const path = value as string;
          const name = path.split('/').pop()?.replace('.json', '') ?? 'Preset';
          this.onLoadPreset(path, name, 2); // 2 second crossfade default
        }
        break;

      case 'scene':
        // Scene switching would be handled by the main app
        console.log('[RenderGraph] Scene switch:', value);
        break;

      case 'playlist-slot':
        if (this.onPlaylistControl) {
          this.onPlaylistControl(`jump:${value}`);
        }
        break;

      case 'playlist-control':
        if (this.onPlaylistControl) {
          this.onPlaylistControl(value as string);
        }
        break;

      case 'burst-preset':
        this.loadEdmPreset(value as string);
        break;

      case 'action':
        this.handlePadAction(value as string, actionVelocity);
        break;
    }

    return true;
  }

  /**
   * Handle MIDI CC for scene parameter control
   */
  handleMidiCC(channel: number, cc: number, value: number): boolean {
    const result = processMidiCC(this.midiSceneConfig, channel, cc, value);

    if (!result.handled || !result.target || result.value === undefined) {
      return false;
    }

    // Apply the CC value to the target
    this.applyMacroParam(result.target, result.value);
    return true;
  }

  /**
   * Update burst SDF manager with current audio data
   */
  private updateBurstSdf(time: number, dt: number) {
    const state = this.store.getState();
    const audio = state.audio;

    // Get audio data for burst triggers
    const audioData = {
      peak: audio.peak ?? 0,
      bass: audio.bands?.[0] ?? 0,
      mid: audio.bands?.[2] ?? 0,
      high: audio.bands?.[6] ?? 0
    };

    burstSdfManager.update(dt, time / 1000, audioData);
  }

  getDebugState() {
    return this.debugState;
  }

  setDebugFlags(flags: { tintLayers: boolean; fxDelta: boolean }) {
    this.debugTint = flags.tintLayers;
    this.debugFxDelta = flags.fxDelta;
  }

  armFxDelta(id: FxId, now: number) {
    this.fxDeltaUntil[id] = now + 200;
  }

  handlePadAction(action: string, velocity: number) {
    const state = this.store.getState();
    const runtime = state.runtime;
    if (action.startsWith('origami-')) {
      const foldMap: Record<string, number> = {
        'origami-mountain': 0,
        'origami-valley': 1,
        'origami-collapse': 2,
        'origami-explode': 3
      };
      runtime.origamiFoldState = foldMap[action] ?? 0;
      runtime.origamiFoldSharpness = Math.min(1, Math.max(0.2, velocity));
      return;
    }
    if (action === 'gravity-spawn-fixed') {
      this.spawnGravityWell('fixed');
      return;
    }
    if (action === 'gravity-spawn-audio') {
      this.spawnGravityWell('audio');
      return;
    }
    if (action === 'gravity-destroy') {
      this.destroyGravityWell();
      return;
    }
    if (action === 'gravity-toggle-polarity') {
      this.flipGravityPolarity(true);
      return;
    }
    if (action === 'gravity-flip-last') {
      this.flipGravityPolarity(false);
      return;
    }
    if (action === 'gravity-collapse') {
      runtime.gravityCollapse = 1;
      return;
    }
    if (action === 'glyph-stack') {
      runtime.glyphMode = 0;
      runtime.glyphSeed = (runtime.glyphSeed + 11.1) % 1000;
      return;
    }
    if (action === 'glyph-orbit') {
      runtime.glyphMode = 1;
      runtime.glyphSeed = (runtime.glyphSeed + 17.7) % 1000;
      return;
    }
    if (action === 'glyph-explode') {
      runtime.glyphMode = 2;
      runtime.glyphSeed = (runtime.glyphSeed + 23.3) % 1000;
      return;
    }
    if (action === 'glyph-sentence') {
      runtime.glyphMode = 3;
      runtime.glyphSeed = (runtime.glyphSeed + 31.9) % 1000;
      return;
    }
    if (action === 'crystal-seed') {
      runtime.crystalMode = 0;
      runtime.crystalBrittleness = Math.min(1, Math.max(0.1, velocity));
      return;
    }
    if (action === 'crystal-grow') {
      runtime.crystalMode = 1;
      runtime.crystalBrittleness = Math.min(1, Math.max(0.1, velocity));
      return;
    }
    if (action === 'crystal-fracture') {
      runtime.crystalMode = 2;
      runtime.crystalBrittleness = Math.min(1, Math.max(0.1, velocity));
      return;
    }
    if (action === 'crystal-melt') {
      runtime.crystalMode = 3;
      runtime.crystalBrittleness = Math.min(1, Math.max(0.1, velocity));
      return;
    }
    if (action === 'ink-fine') {
      runtime.inkBrush = 0;
      runtime.inkPressure = Math.min(1, Math.max(0.2, velocity));
      return;
    }
    if (action === 'ink-dry') {
      runtime.inkBrush = 1;
      runtime.inkPressure = Math.min(1, Math.max(0.2, velocity));
      return;
    }
    if (action === 'ink-neon') {
      runtime.inkBrush = 2;
      runtime.inkPressure = Math.min(1, Math.max(0.2, velocity));
      return;
    }
    if (action === 'ink-lifespan') {
      runtime.inkLifespan = Math.min(1, Math.max(0.1, velocity));
      return;
    }
    if (action === 'ink-pressure') {
      runtime.inkPressure = Math.min(1, Math.max(0.1, velocity));
      return;
    }
    if (action === 'topo-quake') {
      runtime.topoQuake = Math.min(1, Math.max(0.2, velocity));
      return;
    }
    if (action === 'topo-landslide') {
      runtime.topoSlide = Math.min(1, Math.max(0.2, velocity));
      return;
    }
    if (action === 'topo-plate') {
      runtime.topoPlate = Math.min(1, Math.max(0.2, velocity));
      return;
    }
    if (action === 'weather-storm') {
      runtime.weatherMode = 0;
      runtime.weatherIntensity = Math.min(1, Math.max(0.2, velocity));
      return;
    }
    if (action === 'weather-fog') {
      runtime.weatherMode = 1;
      runtime.weatherIntensity = Math.min(1, Math.max(0.2, velocity));
      return;
    }
    if (action === 'weather-calm') {
      runtime.weatherMode = 2;
      runtime.weatherIntensity = Math.min(1, Math.max(0.2, velocity));
      return;
    }
    if (action === 'weather-hurricane') {
      runtime.weatherMode = 3;
      runtime.weatherIntensity = Math.min(1, Math.max(0.2, velocity));
      return;
    }
    if (action === 'portal-spawn') {
      this.spawnPortal();
      return;
    }
    if (action === 'portal-collapse') {
      this.collapsePortal();
      return;
    }
    if (action === 'portal-transition') {
      this.triggerPortalTransition();
      return;
    }
    if (action === 'oscillo-capture') {
      runtime.oscilloMode = (runtime.oscilloMode + 1) % 3;
      this.oscilloCapture.set(state.audio.waveform);
      return;
    }
    if (action === 'oscillo-freeze') {
      runtime.oscilloFreeze = runtime.oscilloFreeze > 0.5 ? 0 : 1;
      if (runtime.oscilloFreeze > 0.5) {
        this.oscilloCapture.set(state.audio.waveform);
      }
      return;
    }
    if (action === 'oscillo-rotate') {
      runtime.oscilloRotate = (runtime.oscilloRotate + 1) % 6;
      return;
    }
    if (action === 'strobe') {
      runtime.strobeIntensity = Math.max(runtime.strobeIntensity, velocity);
    }
    // Burst SDF manual triggers
    if (action === 'burst-ring') {
      const state = this.store.getState();
      burstSdfManager.triggerManual(0, state.runtime.time);
      return;
    }
    if (action === 'burst-star') {
      const state = this.store.getState();
      burstSdfManager.triggerManual(1, state.runtime.time);
      return;
    }
    if (action === 'burst-toggle') {
      burstSdfManager.setEnabled(!burstSdfManager.getState().enabled);
      return;
    }
    // EDM preset switching
    if (action === 'burst-preset-drop') {
      this.loadEdmPreset('drop-classic');
      return;
    }
    if (action === 'burst-preset-energy') {
      this.loadEdmPreset('high-energy');
      return;
    }
    if (action === 'burst-preset-tech') {
      this.loadEdmPreset('tech-future');
      return;
    }
    if (action === 'burst-preset-minimal') {
      this.loadEdmPreset('minimal');
      return;
    }
    // Scene macro triggers
    if (action === 'macro-drop') {
      this.triggerMacro('drop-classic');
      return;
    }
    if (action === 'macro-drop-hard') {
      this.triggerMacro('drop-hard');
      return;
    }
    if (action === 'macro-drop-subtle') {
      this.triggerMacro('drop-subtle');
      return;
    }
    if (action === 'macro-breakdown') {
      this.triggerMacro('breakdown-calm');
      return;
    }
    if (action === 'macro-breakdown-atmospheric') {
      this.triggerMacro('breakdown-atmospheric');
      return;
    }
    if (action === 'macro-build-8bar') {
      this.triggerMacro('build-8bar');
      return;
    }
    if (action === 'macro-build-4bar') {
      this.triggerMacro('build-4bar');
      return;
    }
    if (action === 'macro-build-epic') {
      this.triggerMacro('build-epic');
      return;
    }
    if (action === 'macro-transition-flash') {
      this.triggerMacro('transition-flash');
      return;
    }
    if (action === 'macro-transition-fade-out') {
      this.triggerMacro('transition-fade-out');
      return;
    }
    if (action === 'macro-transition-fade-in') {
      this.triggerMacro('transition-fade-in');
      return;
    }
  }

  private computeAudioCentroid() {
    const { spectrum, bands } = this.store.getState().audio;
    let sum = 0;
    let weighted = 0;
    for (let i = 0; i < spectrum.length; i += 1) {
      const value = spectrum[i];
      sum += value;
      weighted += value * i;
    }
    const index = sum > 0 ? weighted / sum : 0;
    const x = ((index / (spectrum.length - 1)) - 0.5) * 1.2;
    const bass = bands[0] ?? 0;
    const y = 0.45 - bass * 0.6;
    return { x: Math.min(0.7, Math.max(-0.7, x)), y: Math.min(0.7, Math.max(-0.7, y)) };
  }

  private spawnGravityWell(mode: 'fixed' | 'audio') {
    const state = this.store.getState();
    const runtime = state.runtime;
    const slotIndex = this.gravityWells.findIndex((well) => !well.active);
    const index = slotIndex === -1 ? 0 : slotIndex;
    const slot = this.gravityFixedSlots[runtime.gravityFixedIndex % this.gravityFixedSlots.length];
    const spawn = mode === 'audio' ? this.computeAudioCentroid() : slot;
    const bass = state.audio.bands[0] ?? 0;
    const strength = 0.35 + bass * 0.8;
    this.gravityWells[index] = {
      ...this.gravityWells[index],
      x: spawn.x,
      y: spawn.y,
      baseX: spawn.x,
      baseY: spawn.y,
      strength,
      polarity: runtime.gravityGlobalPolarity,
      active: true
    };
    runtime.gravityFixedIndex = (runtime.gravityFixedIndex + 1) % this.gravityFixedSlots.length;
    runtime.lastGravityIndex = index;
  }

  private destroyGravityWell() {
    const runtime = this.store.getState().runtime;
    if (runtime.lastGravityIndex >= 0 && this.gravityWells[runtime.lastGravityIndex]?.active) {
      this.gravityWells[runtime.lastGravityIndex].active = false;
      return;
    }
    const activeIndex = this.gravityWells.map((well, i) => (well.active ? i : -1)).filter((i) => i >= 0);
    if (activeIndex.length > 0) {
      this.gravityWells[activeIndex[activeIndex.length - 1]].active = false;
    }
  }

  private flipGravityPolarity(all = true) {
    const runtime = this.store.getState().runtime;
    if (all) {
      runtime.gravityGlobalPolarity *= -1;
      this.gravityWells.forEach((well) => {
        if (well.active) {
          well.polarity *= -1;
        }
      });
      return;
    }
    if (runtime.lastGravityIndex >= 0 && this.gravityWells[runtime.lastGravityIndex]?.active) {
      this.gravityWells[runtime.lastGravityIndex].polarity *= -1;
    }
  }

  private spawnPortal() {
    const state = this.store.getState();
    const index = this.portals.findIndex((portal) => !portal.active);
    const slot = index === -1 ? 0 : index;
    const x = (Math.random() - 0.5) * 1.2;
    const y = (Math.random() - 0.5) * 1.2;
    this.portals[slot] = {
      ...this.portals[slot],
      x,
      y,
      radius: 0.18 + (state.audio.bands[2] ?? 0) * 0.35,
      active: true,
      phase: Math.random() * Math.PI * 2
    };
  }

  private collapsePortal() {
    const activeIndex = this.portals.map((portal, i) => (portal.active ? i : -1)).filter((i) => i >= 0);
    if (activeIndex.length > 0) {
      this.portals[activeIndex[activeIndex.length - 1]].active = false;
    }
  }

  private triggerPortalTransition() {
    const runtime = this.store.getState().runtime;
    runtime.portalShift = 0.2 + (this.store.getState().audio.bands[4] ?? 0) * 0.4;
    runtime.portalSeed = (runtime.portalSeed + 17.3) % 1000;
  }

  private updateGravityWells(time: number, dt: number) {
    const state = this.store.getState();
    const runtime = state.runtime;
    runtime.gravityCollapse = Math.max(0, runtime.gravityCollapse - dt * 0.18);
    const bass = state.audio.bands[0] ?? 0;
    const mid = state.audio.bands[3] ?? 0;
    const orbitRate = 0.2 + mid * 0.6;
    this.gravityWells.forEach((well, index) => {
      if (!well.active) {
        this.gravityPositions[index * 2] = 0;
        this.gravityPositions[index * 2 + 1] = 0;
        this.gravityStrengths[index] = 0;
        this.gravityPolarities[index] = 0;
        this.gravityActives[index] = 0;
        return;
      }
      const angle = time * 0.00015 * orbitRate + well.phase;
      const orbitRadius = 0.05 + mid * 0.18;
      const targetX = well.baseX + Math.cos(angle) * orbitRadius;
      const targetY = well.baseY + Math.sin(angle * 1.1) * orbitRadius;
      const collapseMix = runtime.gravityCollapse * 0.85;
      well.x = well.x + (targetX - well.x) * 0.08;
      well.y = well.y + (targetY - well.y) * 0.08;
      if (collapseMix > 0) {
        well.x = well.x * (1 - collapseMix);
        well.y = well.y * (1 - collapseMix);
      }
      const strength = well.strength + bass * 0.45 + runtime.gravityCollapse * 0.6;
      this.gravityPositions[index * 2] = Math.min(0.9, Math.max(-0.9, well.x));
      this.gravityPositions[index * 2 + 1] = Math.min(0.9, Math.max(-0.9, well.y));
      this.gravityStrengths[index] = strength;
      this.gravityPolarities[index] = well.polarity;
      this.gravityActives[index] = 1;
    });
  }

  private updateShapeBursts(time: number, dt: number) {
    const state = this.store.getState();
    const project = state.project;
    const activeScene =
      project.scenes.find((scene) => scene.id === project.activeSceneId) ?? project.scenes[0];
    const shapeBurstLayer = findLayerById(activeScene?.layers, 'gen-shape-burst');
    const shapeBurstEnabled = shapeBurstLayer?.enabled ?? false;

    if (!shapeBurstEnabled) {
      // Reset all bursts when disabled
      for (let i = 0; i < 8; i++) {
        this.shapeBurstSlots[i].active = false;
        this.shapeBurstActives[i] = 0;
      }
      return;
    }

    const audioTrigger = (shapeBurstLayer?.params as any)?.audioTrigger ?? true;
    const expandSpeed = (typeof shapeBurstLayer?.params?.expandSpeed === 'number')
      ? shapeBurstLayer.params.expandSpeed : 2;
    const maxSize = (typeof shapeBurstLayer?.params?.maxSize === 'number')
      ? shapeBurstLayer.params.maxSize : 1.5;
    const spawnRate = (typeof shapeBurstLayer?.params?.spawnRate === 'number')
      ? shapeBurstLayer.params.spawnRate : 1;

    // Spawn new burst on audio peak
    const peak = state.audio.peak;
    const threshold = 0.5;
    const timeSinceLastSpawn = time - this.lastShapeBurstSpawn;
    const minInterval = 200 / spawnRate; // Milliseconds between spawns

    if (audioTrigger && peak > threshold && timeSinceLastSpawn > minInterval) {
      // Find an inactive slot or the oldest one
      let slotIndex = this.shapeBurstSlotIndex;
      this.shapeBurstSlots[slotIndex] = {
        active: true,
        spawnTime: time / 1000 // Convert to seconds for shader
      };
      this.shapeBurstSlotIndex = (this.shapeBurstSlotIndex + 1) % 8;
      this.lastShapeBurstSpawn = time;
    }

    // Update burst arrays for shader
    const currentTimeSeconds = time / 1000;
    const maxAge = maxSize / expandSpeed; // Time to reach max size

    for (let i = 0; i < 8; i++) {
      const slot = this.shapeBurstSlots[i];
      if (slot.active) {
        const age = currentTimeSeconds - slot.spawnTime;
        if (age > maxAge) {
          slot.active = false;
          this.shapeBurstActives[i] = 0;
        } else {
          this.shapeBurstSpawnTimes[i] = slot.spawnTime;
          this.shapeBurstActives[i] = 1;
        }
      } else {
        this.shapeBurstActives[i] = 0;
      }
    }
  }

  private updatePortals(time: number, dt: number) {
    const state = this.store.getState();
    const project = state.project;
    const activeScene =
      project.scenes.find((scene) => scene.id === project.activeSceneId) ?? project.scenes[0];
    const portalLayer = findLayerById(activeScene?.layers, 'layer-portal');
    const portalEnabled = portalLayer?.enabled ?? false;
    const autoSpawn = (typeof portalLayer?.params?.autoSpawn === 'number'
      ? portalLayer?.params?.autoSpawn
      : 1) > 0.5;
    if (portalEnabled && autoSpawn) {
      const activeCount = this.portals.filter((portal) => portal.active).length;
      const energy = (state.audio.bands[2] ?? 0) + (state.audio.bands[3] ?? 0);
      const interval = Math.max(600, 1600 - energy * 800);
      if (activeCount === 0 || time - this.lastPortalAutoSpawn > interval) {
        this.spawnPortal();
        this.lastPortalAutoSpawn = time;
      }
    }
    const bands = state.audio.bands;
    const base = bands[1] ?? 0;
    const harmonic = Math.abs((bands[2] ?? 0) - base * 0.66) + Math.abs((bands[3] ?? 0) - base * 0.5);
    const energy = Math.min(1, (bands[2] ?? 0) + (bands[3] ?? 0) + (bands[4] ?? 0));
    this.portals.forEach((portal, index) => {
      if (!portal.active) {
        this.portalPositions[index * 2] = 0;
        this.portalPositions[index * 2 + 1] = 0;
        this.portalRadii[index] = 0;
        this.portalActives[index] = 0;
        return;
      }
      const pulse = 0.02 * Math.sin(time * 0.001 + portal.phase) + energy * 0.08;
      portal.radius = Math.min(0.45, portal.radius + (pulse - portal.radius) * 0.02);
      this.portalPositions[index * 2] = portal.x;
      this.portalPositions[index * 2 + 1] = portal.y;
      this.portalRadii[index] = portal.radius * (0.8 + harmonic * 0.8);
      this.portalActives[index] = 1;
    });
  }

  private getModdedSdfScene(scene: any, modSources: any, modMatrix: any[]) {
    if (!scene) return undefined;

    // Deep clone the scene to avoid mutating the original project state
    const cloned = JSON.parse(JSON.stringify(scene));

    // Apply modulation to each node's parameters
    if (cloned.nodes) {
      cloned.nodes.forEach((node: any) => {
        if (!node.params) return;

        Object.keys(node.params).forEach(paramId => {
          const targetId = `${node.instanceId}.${paramId}`;
          const baseValue = node.params[paramId];

          if (typeof baseValue === 'number') {
            node.params[paramId] = applyModMatrix(baseValue, targetId, modSources, modMatrix);
          } else if (Array.isArray(baseValue)) {
            // Support modulating vector components like 'nodeId.paramId.x'
            const components = ['x', 'y', 'z', 'w'];
            const modded = [...baseValue];
            for (let i = 0; i < Math.min(baseValue.length, 4); i++) {
                const subTargetId = `${targetId}.${components[i]}`;
                modded[i] = applyModMatrix(baseValue[i], subTargetId, modSources, modMatrix);
            }
            node.params[paramId] = modded;
          }
        });
      });
    }

    // Inject burst SDF nodes from the beat-triggered system
    const burstNodes = burstSdfManager.getActiveNodes();
    if (burstNodes.length > 0) {
      if (!cloned.nodes) cloned.nodes = [];
      cloned.nodes.push(...burstNodes);
    }

    return cloned;
  }

  buildRenderState(time: number, deltaMs: number, canvasSize: { width: number; height: number }): RenderState {
    const state = this.store.getState();
    const runtime = state.runtime;
    const deltaSeconds = deltaMs * 0.001;

    this.updateGravityWells(time, deltaSeconds);
    this.updatePortals(time, deltaSeconds);
    this.updateShapeBursts(time, deltaSeconds);

    // Initialize and update burst SDF system
    this.initBurstSdfPresets();
    this.updateBurstSdf(time, deltaSeconds);

    // Update running scene macros
    const currentBeat = runtime.beatCount ?? Math.floor(time / 1000 * (runtime.bpm ?? 120) / 60);
    this.updateMacro(time, currentBeat);

    if (runtime.glyphBeatPulse > 0) {
      runtime.glyphBeatPulse = Math.max(0, runtime.glyphBeatPulse - deltaMs * 0.006);
    }
    runtime.portalShift = Math.max(0, runtime.portalShift - deltaMs * 0.0003);
    runtime.topoQuake = Math.max(0, runtime.topoQuake - deltaMs * 0.002);
    runtime.topoSlide = Math.max(0, runtime.topoSlide - deltaMs * 0.002);
    runtime.topoPlate = Math.max(0, runtime.topoPlate - deltaMs * 0.002);
    runtime.topoTravel += deltaMs * 0.0002;
    runtime.strobeIntensity *= runtime.strobeDecay;

    const activeStyle =
      state.project.stylePresets?.find((preset) => preset.id === state.project.activeStylePresetId) ?? null;
    const styleSettings = activeStyle?.settings ?? { contrast: 1, saturation: 1, paletteShift: 0 };
    const effects = state.project.effects ?? {
      enabled: true,
      bloom: 0.2,
      blur: 0,
      chroma: 0.1,
      posterize: 0,
      kaleidoscope: 0,
      feedback: 0,
      persistence: 0
    };
    const particles = state.project.particles ?? {
      enabled: true,
      density: 0.35,
      speed: 0.3,
      size: 0.45,
      glow: 0.6
    };
    const sdf = state.project.sdf ?? {
      enabled: false,
      shape: 'circle' as const,
      scale: 0,
      edge: 0,
      glow: 0,
      rotation: 0,
      fill: 0
    };
    const expressiveFx = state.project.expressiveFx ?? DEFAULT_PROJECT.expressiveFx;
    const expressiveEnabled = expressiveFx.enabled ?? true;
    const energyFx = {
      ...DEFAULT_PROJECT.expressiveFx.energyBloom,
      ...expressiveFx.energyBloom,
      intentBinding: {
        ...DEFAULT_PROJECT.expressiveFx.energyBloom.intentBinding,
        ...(expressiveFx.energyBloom?.intentBinding ?? {})
      },
      expert: {
        ...DEFAULT_PROJECT.expressiveFx.energyBloom.expert,
        ...(expressiveFx.energyBloom?.expert ?? {})
      }
    };
    const radialFx = {
      ...DEFAULT_PROJECT.expressiveFx.radialGravity,
      ...expressiveFx.radialGravity,
      intentBinding: {
        ...DEFAULT_PROJECT.expressiveFx.radialGravity.intentBinding,
        ...(expressiveFx.radialGravity?.intentBinding ?? {})
      },
      expert: {
        ...DEFAULT_PROJECT.expressiveFx.radialGravity.expert,
        ...(expressiveFx.radialGravity?.expert ?? {})
      }
    };
    const motionFx = {
      ...DEFAULT_PROJECT.expressiveFx.motionEcho,
      ...expressiveFx.motionEcho,
      intentBinding: {
        ...DEFAULT_PROJECT.expressiveFx.motionEcho.intentBinding,
        ...(expressiveFx.motionEcho?.intentBinding ?? {})
      },
      expert: {
        ...DEFAULT_PROJECT.expressiveFx.motionEcho.expert,
        ...(expressiveFx.motionEcho?.expert ?? {})
      }
    };
    const smearFx = {
      ...DEFAULT_PROJECT.expressiveFx.spectralSmear,
      ...expressiveFx.spectralSmear,
      intentBinding: {
        ...DEFAULT_PROJECT.expressiveFx.spectralSmear.intentBinding,
        ...(expressiveFx.spectralSmear?.intentBinding ?? {})
      },
      expert: {
        ...DEFAULT_PROJECT.expressiveFx.spectralSmear.expert,
        ...(expressiveFx.spectralSmear?.expert ?? {})
      }
    };

    const bpm = this.getActiveBpm();
    const modSources = this.buildModSources(bpm);
    const modValue = (target: string, base: number) =>
      applyModMatrix(base, target, modSources, state.project.modMatrix);
    const lowFreq = ((state.audio.bands[0] ?? 0) + (state.audio.bands[1] ?? 0)) * 0.5;

    const moddedStyle = {
      contrast: modValue('style.contrast', styleSettings.contrast),
      saturation: modValue('style.saturation', styleSettings.saturation),
      paletteShift: modValue('style.paletteShift', styleSettings.paletteShift + runtime.portalShift)
    };
    const roleWeights = state.project.roleWeights ?? { core: 1, support: 1, atmosphere: 1 };
    const engineId = state.project.activeEngineId as EngineId;
    const engine = ENGINE_REGISTRY[engineId];
    const templates = ['linear', 'radial', 'vortex', 'fractal', 'grid', 'organic', 'data', 'strobe', 'vapor'];
    const motionTemplate = engine?.constraints?.preferredMotion
      ? Math.max(0, templates.indexOf(engine.constraints.preferredMotion))
      : 0;
    const engineGrammar = (state.project as any).engineGrammar ?? {};
    const engineFinish = (state.project as any).engineFinish ?? {};
    const engineSignature = (() => {
      if (engineId === 'engine-radial-core') return 1;
      if (engineId === 'engine-particle-flow') return 2;
      if (engineId === 'engine-kaleido-pulse') return 3;
      if (engineId === 'engine-vapor-grid') return 4;
      return 0;
    })();
    const maxBloom = engine?.constraints?.maxBloom ?? 1.0;
    const forceFeedback = engine?.constraints?.forceFeedback ?? false;
    const chemistryMode = getChemistryModeIndex(state.project.colorChemistry ?? ['analog', 'balanced']);
    const transitionAmount = 0;
    const transitionType = 0;

    const fxDeltaNow = performance.now();
    const fxDelta = (id: FxId, base: number, boost: number) =>
      this.debugFxDelta && fxDeltaNow < this.fxDeltaUntil[id] ? Math.min(1, base + boost) : base;

    let moddedEffects = {
      bloom: fxDelta('bloom', modValue('effects.bloom', effects.bloom), 0.35),
      blur: fxDelta('blur', modValue('effects.blur', effects.blur), 0.35),
      chroma: fxDelta('chroma', modValue('effects.chroma', effects.chroma), 0.2),
      posterize: fxDelta('posterize', modValue('effects.posterize', effects.posterize), 0.35),
      kaleidoscope: fxDelta('kaleidoscope', modValue('effects.kaleidoscope', effects.kaleidoscope), 0.35),
      feedback: fxDelta('feedback', modValue('effects.feedback', effects.feedback), 0.35),
      persistence: fxDelta('persistence', modValue('effects.persistence', effects.persistence), 0.35)
    };
    if (!effects.enabled) {
      moddedEffects = {
        bloom: 0,
        blur: 0,
        chroma: 0,
        posterize: 0,
        kaleidoscope: 0,
        feedback: 0,
        persistence: 0
      };
    }

    let moddedParticles = {
      density: modValue('particles.density', particles.density),
      speed: modValue('particles.speed', particles.speed),
      size: modValue('particles.size', particles.size),
      glow: modValue('particles.glow', particles.glow),
      turbulence: modValue('particles.turbulence', particles.turbulence ?? 0.3),
      audioLift: modValue('particles.audioLift', particles.audioLift ?? 0.5)
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
      for (let i = 0; i < this.trailSpectrum.length; i += 1) {
        this.trailSpectrum[i] = Math.max(this.trailSpectrum[i] * decay, state.audio.spectrum[i]);
      }
    } else {
      this.trailSpectrum = new Float32Array(state.audio.spectrum);
    }

    const macroSum = state.project.macros.reduce(
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

    const activeScene = state.project.scenes.find((scene) => scene.id === state.project.activeSceneId);
    const activeIntent = activeScene?.intent ?? 'ambient';
    const resolveExpressiveMacro = (
      macro: number,
      binding: { enabled: boolean; intent: typeof activeIntent; amount: number }
    ) => {
      let value = macro;
      if (binding?.enabled && binding.intent === activeIntent) {
        value = Math.min(1, Math.max(0, value + binding.amount));
      }
      return Math.min(1, Math.max(0, value));
    };
    const energyMacro = resolveExpressiveMacro(energyFx.macro, energyFx.intentBinding);
    const radialMacro = resolveExpressiveMacro(radialFx.macro, radialFx.intentBinding);
    const echoMacro = resolveExpressiveMacro(motionFx.macro, motionFx.intentBinding);
    const smearMacro = resolveExpressiveMacro(smearFx.macro, smearFx.intentBinding);
    const energyEnabled = expressiveEnabled && energyFx.enabled;
    const radialEnabled = expressiveEnabled && radialFx.enabled;
    const motionEnabled = expressiveEnabled && motionFx.enabled;
    const smearEnabled = expressiveEnabled && smearFx.enabled;
    const plasmaLayer = findLayerById(activeScene?.layers, 'layer-plasma');
    const spectrumLayer = findLayerById(activeScene?.layers, 'layer-spectrum');
    const origamiLayer = findLayerById(activeScene?.layers, 'layer-origami');
    const glyphLayer = findLayerById(activeScene?.layers, 'layer-glyph');
    const crystalLayer = findLayerById(activeScene?.layers, 'layer-crystal');
    const inkLayer = findLayerById(activeScene?.layers, 'layer-inkflow');
    const topoLayer = findLayerById(activeScene?.layers, 'layer-topo');
    const weatherLayer = findLayerById(activeScene?.layers, 'layer-weather');
    const portalLayer = findLayerById(activeScene?.layers, 'layer-portal');
    const mediaLayer = findLayerById(activeScene?.layers, 'layer-media');
    const oscilloLayer = findLayerById(activeScene?.layers, 'layer-oscillo');
    const advancedSdfLayer = findLayerById(activeScene?.layers, 'gen-sdf-scene');
    // EDM Generator Layers
    const rawLaserLayer =
      activeScene?.layers.find((layer) => normalizeLayerId(layer.id ?? '').includes('laser')) ??
      activeScene?.layers.find((layer) => normalizeLayerId(layer.generatorId ?? '').includes('laser')) ??
      activeScene?.layers.find((layer) => (layer.name ?? '').toLowerCase().includes('laser'));
    const laserLayer = findLayerById(activeScene?.layers, 'gen-laser-beam') ?? rawLaserLayer;
    const laserIdRaw = rawLaserLayer?.id ?? '';
    const laserIdBytes = laserIdRaw
      ? Array.from(laserIdRaw).map((ch) => ch.charCodeAt(0)).join(' ')
      : '';
    const strobeLayer = findLayerById(activeScene?.layers, 'gen-strobe');
    const shapeBurstLayer = findLayerById(activeScene?.layers, 'gen-shape-burst');
    const gridTunnelLayer = findLayerById(activeScene?.layers, 'gen-grid-tunnel');
    // Rock Generator Layers
    const lightningLayer = findLayerById(activeScene?.layers, 'gen-lightning');
    const analogOscilloLayer = findLayerById(activeScene?.layers, 'gen-analog-oscillo');
    const speakerConeLayer = findLayerById(activeScene?.layers, 'gen-speaker-cone');
    const glitchScanlineLayer = findLayerById(activeScene?.layers, 'gen-glitch-scanline');
    const laserStarfieldLayer = findLayerById(activeScene?.layers, 'gen-laser-starfield');
    const pulsingRibbonsLayer = findLayerById(activeScene?.layers, 'gen-pulsing-ribbons');
    const electricArcLayer = findLayerById(activeScene?.layers, 'gen-electric-arc');
    const pyroBurstLayer = findLayerById(activeScene?.layers, 'gen-pyro-burst');
    const geoWireframeLayer = findLayerById(activeScene?.layers, 'gen-geo-wireframe');
    const signalNoiseLayer = findLayerById(activeScene?.layers, 'gen-signal-noise');
    const wormholeLayer = findLayerById(activeScene?.layers, 'gen-infinite-wormhole');
    const ribbonTunnelLayer = findLayerById(activeScene?.layers, 'gen-ribbon-tunnel');
    const fractalTunnelLayer = findLayerById(activeScene?.layers, 'gen-fractal-tunnel');
    const circuitConduitLayer = findLayerById(activeScene?.layers, 'gen-circuit-conduit');
    const auraPortalLayer = findLayerById(activeScene?.layers, 'gen-aura-portal');
    const freqTerrainLayer = findLayerById(activeScene?.layers, 'gen-freq-terrain');
    const dataStreamLayer = findLayerById(activeScene?.layers, 'gen-data-stream');
    const causticLiquidLayer = findLayerById(activeScene?.layers, 'gen-caustic-liquid');
    const shimmerVeilLayer = findLayerById(activeScene?.layers, 'gen-shimmer-veil');
    const nebulaCloudLayer = findLayerById(activeScene?.layers, 'gen-nebula-cloud');
    const circuitBoardLayer = findLayerById(activeScene?.layers, 'gen-circuit-board');
    const lorenzLayer = findLayerById(activeScene?.layers, 'gen-lorenz-attractor');
    const mandalaLayer = findLayerById(activeScene?.layers, 'gen-mandala-spinner');
    const starburstLayer = findLayerById(activeScene?.layers, 'gen-starburst-galaxy');
    const rainV2Layer = findLayerById(activeScene?.layers, 'gen-digital-rain-v2');
    const lavaLayer = findLayerById(activeScene?.layers, 'gen-lava-flow');
    const crystalGrowthLayer = findLayerById(activeScene?.layers, 'gen-crystal-growth');
    const technoGridLayer = findLayerById(activeScene?.layers, 'gen-techno-grid');
    const magneticLayer = findLayerById(activeScene?.layers, 'gen-magnetic-field');
    const prismShardsLayer = findLayerById(activeScene?.layers, 'gen-prism-shards');
    const neuralNetLayer = findLayerById(activeScene?.layers, 'gen-neural-net');
    const auroraChordLayer = findLayerById(activeScene?.layers, 'gen-aurora-chord');
    const vhsGlitchLayer = findLayerById(activeScene?.layers, 'gen-vhs-glitch');
    const moireLayer = findLayerById(activeScene?.layers, 'gen-moire-pattern');
    const hypercubeLayer = findLayerById(activeScene?.layers, 'gen-hypercube');
    const fluidSwirlLayer = findLayerById(activeScene?.layers, 'gen-fluid-swirl');
    const asciiLayer = findLayerById(activeScene?.layers, 'gen-ascii-stream');
    const retroWaveLayer = findLayerById(activeScene?.layers, 'gen-retro-wave');
    const bubblePopLayer = findLayerById(activeScene?.layers, 'gen-bubble-pop');
    const soundWave3DLayer = findLayerById(activeScene?.layers, 'gen-sound-wave-3d');
    const particleVortexLayer = findLayerById(activeScene?.layers, 'gen-particle-vortex');
    const glowWormsLayer = findLayerById(activeScene?.layers, 'gen-glow-worms');
    const mirrorMazeLayer = findLayerById(activeScene?.layers, 'gen-mirror-maze');
    const pulseHeartLayer = findLayerById(activeScene?.layers, 'gen-pulse-heart');
    const dataShardsLayer = findLayerById(activeScene?.layers, 'gen-data-shards');
    const hexCellLayer = findLayerById(activeScene?.layers, 'gen-hex-cell');
    const plasmaBallLayer = findLayerById(activeScene?.layers, 'gen-plasma-ball');
    const warpDriveLayer = findLayerById(activeScene?.layers, 'gen-warp-drive');
    const feedbackLayer = findLayerById(activeScene?.layers, 'gen-visual-feedback');
    const myceliumLayer = findLayerById(activeScene?.layers, 'gen-mycelium-growth');
    
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
      if (!activeScene) return 'support' as LayerRole;
      const enabledLayers = activeScene.layers.filter((layer) => layer.enabled);
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
      feedback: Math.min(moddedEffects.feedback, fxCap),
      persistence: Math.min(moddedEffects.persistence, fxCap)
    };

    const coreEnabled = Boolean(activeScene?.layers.some((layer) => layer.enabled && getLayerRole(layer) === 'core'));
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
    
    // Effect layers
    const feedbackLayer = activeScene?.layers.find((layer) => layer.id === 'fx-feedback');
    const chromaLayer = activeScene?.layers.find((layer) => layer.id === 'fx-chroma');
    const bloomLayer = activeScene?.layers.find((layer) => layer.id === 'fx-bloom');
    const blurLayer = activeScene?.layers.find((layer) => layer.id === 'fx-blur');
    const posterizeLayer = activeScene?.layers.find((layer) => layer.id === 'fx-posterize');
    const kaleidoLayer = activeScene?.layers.find((layer) => layer.id === 'fx-kaleidoscope');
    const trailsLayer = activeScene?.layers.find((layer) => layer.id === 'fx-trails' || layer.id === 'fx-persistence');

    const macroVal = (target: string) => macroSum[target] ?? 0;
    const getLayerParamNumber = (layer: any, key: string, fallback: number) => {
      const value = layer?.params?.[key];
      return typeof value === 'number' ? value : fallback;
    };

    const layerOpacity = (layer: any, macroTarget: string, defaultVal: number) => {
      const base = layer ? layer.opacity : defaultVal;
      return Math.min(1, Math.max(0, base * (1 + macroVal(macroTarget))));
    };

    const plasmaBaseSpeed = getLayerParamNumber(plasmaLayer, 'speed', 1.0);
    const plasmaBaseScale = getLayerParamNumber(plasmaLayer, 'scale', 1.0);
    const plasmaBaseComplexity = getLayerParamNumber(plasmaLayer, 'complexity', 0.5);
    const plasmaSpeed = Math.max(0.1, plasmaBaseSpeed + macroVal('layer-plasma.speed'));
    const plasmaScale = Math.max(0.1, plasmaBaseScale + macroVal('layer-plasma.scale'));
    const plasmaComplexity = Math.max(0.1, plasmaBaseComplexity + macroVal('layer-plasma.complexity'));

    const origamiBaseSpeed = getLayerParamNumber(origamiLayer, 'speed', 1.0);
    const origamiSpeed = Math.max(0.1, origamiBaseSpeed + macroVal('layer-origami.speed'));

    const glyphBaseSpeed = getLayerParamNumber(glyphLayer, 'speed', 1.0);
    const glyphSpeed = Math.max(0.1, glyphBaseSpeed + macroVal('layer-glyph.speed'));

    const crystalBaseScale = getLayerParamNumber(crystalLayer, 'scale', 1.0);
    const crystalBaseSpeed = getLayerParamNumber(crystalLayer, 'speed', 1.0);
    const crystalScale = Math.max(0.1, crystalBaseScale + macroVal('layer-crystal.scale'));
    const crystalSpeed = Math.max(0.1, crystalBaseSpeed + macroVal('layer-crystal.speed'));

    const inkBaseSpeed = getLayerParamNumber(inkLayer, 'speed', 1.0);
    const inkBaseScale = getLayerParamNumber(inkLayer, 'scale', 1.0);
    const inkSpeed = Math.max(0.1, inkBaseSpeed + macroVal('layer-inkflow.speed'));
    const inkScale = Math.max(0.1, inkBaseScale + macroVal('layer-inkflow.scale'));

    const topoBaseScale = getLayerParamNumber(topoLayer, 'scale', 1.0);
    const topoBaseElevation = getLayerParamNumber(topoLayer, 'elevation', 0.5);
    const topoScale = Math.max(0.1, topoBaseScale + macroVal('layer-topo.scale'));
    const topoElevation = Math.max(0.1, topoBaseElevation + macroVal('layer-topo.elevation'));

    const weatherBaseSpeed = getLayerParamNumber(weatherLayer, 'speed', 1.0);
    const weatherSpeed = Math.max(0.1, weatherBaseSpeed + macroVal('layer-weather.speed'));

    const moddedPlasmaOpacity = applyRoleOpacity(
      modValue('layer-plasma.opacity', layerOpacity(plasmaLayer, 'layer-plasma.opacity', 1)),
      plasmaRole,
      lowFreq
    );
    const moddedSpectrumOpacity = applyRoleOpacity(
      modValue('layer-spectrum.opacity', layerOpacity(spectrumLayer, 'layer-spectrum.opacity', 1)),
      spectrumRole,
      lowFreq
    );
    const moddedOrigamiOpacity = applyRoleOpacity(
      modValue('layer-origami.opacity', layerOpacity(origamiLayer, 'layer-origami.opacity', 0)),
      origamiRole,
      lowFreq
    );
    const moddedGlyphOpacity = applyRoleOpacity(
      modValue('layer-glyph.opacity', layerOpacity(glyphLayer, 'layer-glyph.opacity', 0)),
      glyphRole,
      lowFreq
    );
    const moddedCrystalOpacity = applyRoleOpacity(
      modValue('layer-crystal.opacity', layerOpacity(crystalLayer, 'layer-crystal.opacity', 0)),
      crystalRole,
      lowFreq
    );
    const moddedInkOpacity = applyRoleOpacity(
      modValue('layer-inkflow.opacity', layerOpacity(inkLayer, 'layer-inkflow.opacity', 0)),
      inkRole,
      lowFreq
    );
    const moddedTopoOpacity = applyRoleOpacity(
      modValue('layer-topo.opacity', layerOpacity(topoLayer, 'layer-topo.opacity', 0)),
      topoRole,
      lowFreq
    );
    const moddedWeatherOpacity = applyRoleOpacity(
      modValue('layer-weather.opacity', layerOpacity(weatherLayer, 'layer-weather.opacity', 0)),
      weatherRole,
      lowFreq
    );
    const moddedPortalOpacity = applyRoleOpacity(
      modValue('layer-portal.opacity', layerOpacity(portalLayer, 'layer-portal.opacity', 0)),
      portalRole,
      lowFreq
    );
    const moddedMediaOpacity = applyRoleOpacity(
      modValue('layer-media.opacity', layerOpacity(mediaLayer, 'layer-media.opacity', 0)),
      mediaRole,
      lowFreq
    );
    const moddedOscilloOpacity = applyRoleOpacity(
      modValue('layer-oscillo.opacity', layerOpacity(oscilloLayer, 'layer-oscillo.opacity', 0)),
      oscilloRole,
      lowFreq
    );
    const portalStyle = Math.max(
      0,
      Math.min(2, typeof portalLayer?.params?.style === 'number' ? portalLayer?.params?.style : 0)
    );

    const moddedPlasmaSpeed = modValue('layer-plasma.speed', plasmaSpeed);
    const moddedPlasmaScale = modValue('layer-plasma.scale', plasmaScale);
    const moddedPlasmaComplexity = modValue('layer-plasma.complexity', plasmaComplexity);
    const moddedOrigamiSpeed = modValue('layer-origami.speed', origamiSpeed);
    const moddedGlyphSpeed = modValue('layer-glyph.speed', glyphSpeed);
    const moddedCrystalScale = modValue('layer-crystal.scale', crystalScale);
    const moddedCrystalSpeed = modValue('layer-crystal.speed', crystalSpeed);
    const moddedInkSpeed = modValue('layer-inkflow.speed', inkSpeed);
    const moddedInkScale = modValue('layer-inkflow.scale', inkScale);
    const moddedTopoScale = modValue('layer-topo.scale', topoScale);
    const moddedTopoElevation = modValue('layer-topo.elevation', topoElevation);
    const moddedWeatherSpeed = modValue('layer-weather.speed', weatherSpeed);

    // Effect Mappings - More consistent handling
    const getFxVal = (layer: any, macroTarget: string, globalVal: number) => {
      const base = layer && layer.enabled ? layer.opacity : globalVal;
      return base + macroVal(macroTarget);
    };

    const moddedFeedback = getFxVal(feedbackLayer, 'fx-feedback.amount', effects.feedback);
    const moddedFeedbackZoom = modValue('fx-feedback.zoom', macroVal('fx-feedback.zoom'));
    const moddedFeedbackRotation = modValue('fx-feedback.rotation', macroVal('fx-feedback.rotation'));
    
    const moddedChromaValue = getFxVal(chromaLayer, 'fx-chroma.amount', effects.chroma);
    const moddedBloom = getFxVal(bloomLayer, 'fx-bloom.intensity', effects.bloom);
    const moddedBlur = getFxVal(blurLayer, 'fx-blur.radius', effects.blur);
    const moddedPosterize = getFxVal(posterizeLayer, 'fx-posterize.levels', effects.posterize);
    const moddedKaleido = getFxVal(kaleidoLayer, 'fx-kaleidoscope.amount', effects.kaleidoscope);
    const moddedKaleidoRotation = modValue('fx-kaleidoscope.rotation', macroVal('fx-kaleidoscope.rotation'));
    const moddedPersistence = getFxVal(trailsLayer, 'fx-trails.persistence', effects.persistence);

    const hasActiveScene = Boolean(activeScene);
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
    const advancedSdfEnabled = advancedSdfLayer?.enabled ?? false;

    if (runtime.oscilloFreeze < 0.5) {
      this.oscilloCapture.set(state.audio.waveform);
    }

    const renderState: RenderState & { debugTint?: number } = {
      timeMs: state.transport.timeMs,
      rms: state.audio.rms,
      peak: state.audio.peak,
      strobe: runtime.strobeIntensity,
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
      spectrum: state.audio.spectrum,
      contrast: moddedStyle.contrast,
      saturation: moddedStyle.saturation,
      paletteShift: moddedStyle.paletteShift,
      plasmaOpacity: moddedPlasmaOpacity,
      plasmaSpeed: moddedPlasmaSpeed,
      plasmaScale: moddedPlasmaScale,
      plasmaComplexity: moddedPlasmaComplexity,
      plasmaAudioReact:
        state.renderSettings.assetLayerAudioReact['layer-plasma'] * getRoleAudioScale(plasmaRole, lowFreq),
      spectrumOpacity: moddedSpectrumOpacity,
      origamiOpacity: moddedOrigamiOpacity,
      origamiFoldState: runtime.origamiFoldState,
      origamiFoldSharpness: runtime.origamiFoldSharpness,
      origamiSpeed: moddedOrigamiSpeed,
      glyphOpacity: moddedGlyphOpacity,
      glyphMode: runtime.glyphMode,
      glyphSeed: runtime.glyphSeed,
      glyphBeat: runtime.glyphBeatPulse,
      glyphSpeed: moddedGlyphSpeed,
      crystalOpacity: moddedCrystalOpacity,
      crystalMode: runtime.crystalMode,
      crystalBrittleness: runtime.crystalBrittleness,
      crystalScale: moddedCrystalScale,
      crystalSpeed: moddedCrystalSpeed,
      inkOpacity: moddedInkOpacity,
      inkBrush: runtime.inkBrush,
      inkPressure: runtime.inkPressure,
      inkLifespan: runtime.inkLifespan,
      inkSpeed: moddedInkSpeed,
      inkScale: moddedInkScale,
      topoOpacity: moddedTopoOpacity,
      topoQuake: runtime.topoQuake,
      topoSlide: runtime.topoSlide,
      topoPlate: runtime.topoPlate,
      topoTravel: runtime.topoTravel,
      topoScale: moddedTopoScale,
      topoElevation: moddedTopoElevation,
      weatherOpacity: moddedWeatherOpacity,
      weatherMode: runtime.weatherMode,
      weatherIntensity: runtime.weatherIntensity,
      weatherSpeed: moddedWeatherSpeed,
      portalOpacity: moddedPortalOpacity,
      portalShift: runtime.portalShift,
      portalStyle,
      portalPositions: this.portalPositions,
      portalRadii: this.portalRadii,
      portalActives: this.portalActives,
      mediaOpacity: moddedMediaOpacity,
      mediaBurstPositions: this.mediaBurstPositions,
      mediaBurstRadii: this.mediaBurstRadii,
      mediaBurstTypes: this.mediaBurstTypes,
      mediaBurstActives: this.mediaBurstActives,
      oscilloOpacity: moddedOscilloOpacity,
      oscilloMode: runtime.oscilloMode,
      oscilloFreeze: runtime.oscilloFreeze,
      oscilloRotate: runtime.oscilloRotate,
      oscilloData: this.oscilloCapture,
      modulatorValues: new Float32Array(16),
      midiData: new Float32Array(256),
      plasmaAssetBlendMode: state.renderSettings.assetLayerBlendModes['layer-plasma'],
      plasmaAssetAudioReact:
        state.renderSettings.assetLayerAudioReact['layer-plasma'] * getRoleAudioScale(plasmaRole, lowFreq),
      spectrumAssetBlendMode: state.renderSettings.assetLayerBlendModes['layer-spectrum'],
      spectrumAssetAudioReact:
        state.renderSettings.assetLayerAudioReact['layer-spectrum'] * getRoleAudioScale(spectrumRole, lowFreq),
      mediaAssetBlendMode: state.renderSettings.assetLayerBlendModes['layer-media'],
      mediaAssetAudioReact:
        state.renderSettings.assetLayerAudioReact['layer-media'] * getRoleAudioScale(mediaRole, lowFreq),
      roleWeights,
      transitionAmount,
      transitionType,
      motionTemplate,
      engineMass: engineGrammar.mass ?? 0.5,
      engineFriction: engineGrammar.friction ?? 0.95,
      engineElasticity: engineGrammar.elasticity ?? 1.0,
      engineGrain: engineFinish.grain ?? 0.2,
      engineVignette: engineFinish.vignette ?? 1.0,
      engineCA: engineFinish.ca ?? 0.3,
      engineSignature,
      maxBloom,
      forceFeedback,
      chemistryMode,
      effectsEnabled: effects.enabled,
      bloom: moddedBloom,
      blur: moddedBlur,
      chroma: moddedChromaValue,
      posterize: moddedPosterize,
      kaleidoscope: moddedKaleido,
      kaleidoscopeRotation: moddedKaleidoRotation,
      feedback: moddedFeedback,
      feedbackZoom: moddedFeedbackZoom,
      feedbackRotation: moddedFeedbackRotation,
      persistence: moddedPersistence,
      trailSpectrum: this.trailSpectrum,
      expressiveEnergyBloom: energyEnabled ? energyMacro : 0,
      expressiveEnergyThreshold: energyFx.expert.threshold,
      expressiveEnergyAccumulation: energyFx.expert.accumulation,
      expressiveRadialGravity: radialEnabled ? radialMacro : 0,
      expressiveRadialStrength: radialFx.expert.strength,
      expressiveRadialRadius: radialFx.expert.radius,
      expressiveRadialFocusX: radialFx.expert.focusX,
      expressiveRadialFocusY: radialFx.expert.focusY,
      expressiveMotionEcho: motionEnabled ? echoMacro : 0,
      expressiveMotionEchoDecay: motionFx.expert.decay,
      expressiveMotionEchoWarp: motionFx.expert.warp,
      expressiveSpectralSmear: smearEnabled ? smearMacro : 0,
      expressiveSpectralOffset: smearFx.expert.offset,
      expressiveSpectralMix: smearFx.expert.mix,
      particlesEnabled: particles.enabled,
      particleDensity: moddedParticles.density,
      particleSpeed: moddedParticles.speed,
      particleSize: moddedParticles.size,
      particleGlow: moddedParticles.glow,
      particleTurbulence: moddedParticles.turbulence,
      particleAudioLift: moddedParticles.audioLift,
      sdfEnabled: advancedSdfEnabled || (activeScene ? (activeScene.layers.some(l => l.id === 'layer-sdf' && l.enabled && l.opacity > 0.01)) : (sdf.enabled && (sdf.fill > 0.01 || sdf.glow > 0.01))),
      sdfShape: sdf.shape === 'circle' ? 0 : sdf.shape === 'box' ? 1 : 2,
      sdfScale: moddedSdf.scale,
      sdfEdge: moddedSdf.edge,
      sdfGlow: moddedSdf.glow,
      sdfRotation: moddedSdf.rotation,
      sdfFill: moddedSdf.fill,
      sdfScene: this.getModdedSdfScene((advancedSdfLayer as any)?.sdfScene, modSources, state.project.modMatrix),
      gravityPositions: this.gravityPositions,
      gravityStrengths: this.gravityStrengths,
      gravityPolarities: this.gravityPolarities,
      gravityActives: this.gravityActives,
      gravityCollapse: runtime.gravityCollapse,
      debugTint: this.debugTint ? 1 : 0,
      // EDM Generators
      laserEnabled: laserLayer?.enabled ?? false,
      laserOpacity: getLayerParamNumber(laserLayer, 'opacity', 1.0),
      laserBeamCount: getLayerParamNumber(laserLayer, 'beamCount', 4),
      laserBeamWidth: getLayerParamNumber(laserLayer, 'beamWidth', 0.02),
      laserBeamLength: getLayerParamNumber(laserLayer, 'beamLength', 1.0),
      laserRotation: getLayerParamNumber(laserLayer, 'rotation', 0),
      laserRotationSpeed: getLayerParamNumber(laserLayer, 'rotationSpeed', 0.5),
      laserSpread: getLayerParamNumber(laserLayer, 'spread', 1.57),
      laserMode: getLayerParamNumber(laserLayer, 'mode', 0),
      laserColorShift: getLayerParamNumber(laserLayer, 'colorShift', 0),
      laserAudioReact: getLayerParamNumber(laserLayer, 'audioReact', 0.7),
      laserGlow: getLayerParamNumber(laserLayer, 'glow', 0.5),
      strobeEnabled: strobeLayer?.enabled ?? false,
      strobeOpacity: getLayerParamNumber(strobeLayer, 'opacity', 1.0),
      strobeRate: getLayerParamNumber(strobeLayer, 'rate', 4),
      strobeDutyCycle: getLayerParamNumber(strobeLayer, 'dutyCycle', 0.1),
      strobeMode: getLayerParamNumber(strobeLayer, 'mode', 0),
      strobeAudioTrigger: (strobeLayer?.params as any)?.audioTrigger ?? true,
      strobeThreshold: getLayerParamNumber(strobeLayer, 'threshold', 0.6),
      strobeFadeOut: getLayerParamNumber(strobeLayer, 'fadeOut', 0.1),
      strobePattern: getLayerParamNumber(strobeLayer, 'pattern', 0),
      shapeBurstEnabled: shapeBurstLayer?.enabled ?? false,
      shapeBurstOpacity: getLayerParamNumber(shapeBurstLayer, 'opacity', 1.0),
      shapeBurstShape: getLayerParamNumber(shapeBurstLayer, 'shape', 0),
      shapeBurstExpandSpeed: getLayerParamNumber(shapeBurstLayer, 'expandSpeed', 2),
      shapeBurstStartSize: getLayerParamNumber(shapeBurstLayer, 'startSize', 0.05),
      shapeBurstMaxSize: getLayerParamNumber(shapeBurstLayer, 'maxSize', 1.5),
      shapeBurstThickness: getLayerParamNumber(shapeBurstLayer, 'thickness', 0.03),
      shapeBurstFadeMode: getLayerParamNumber(shapeBurstLayer, 'fadeMode', 2),
      shapeBurstSpawnTimes: this.shapeBurstSpawnTimes,
      shapeBurstActives: this.shapeBurstActives,
      gridTunnelEnabled: gridTunnelLayer?.enabled ?? false,
      gridTunnelOpacity: getLayerParamNumber(gridTunnelLayer, 'opacity', 1.0),
      gridTunnelSpeed: getLayerParamNumber(gridTunnelLayer, 'speed', 1),
      gridTunnelGridSize: getLayerParamNumber(gridTunnelLayer, 'gridSize', 20),
      gridTunnelLineWidth: getLayerParamNumber(gridTunnelLayer, 'lineWidth', 0.02),
      gridTunnelPerspective: getLayerParamNumber(gridTunnelLayer, 'perspective', 1),
      gridTunnelHorizonY: getLayerParamNumber(gridTunnelLayer, 'horizonY', 0.5),
      gridTunnelGlow: getLayerParamNumber(gridTunnelLayer, 'glow', 0.5),
      gridTunnelAudioReact: getLayerParamNumber(gridTunnelLayer, 'audioReact', 0.3),
      gridTunnelMode: getLayerParamNumber(gridTunnelLayer, 'mode', 0),
      // Rock Generators
      lightningEnabled: lightningLayer?.enabled ?? false,
      lightningOpacity: getLayerParamNumber(lightningLayer, 'opacity', 1.0),
      lightningSpeed: getLayerParamNumber(lightningLayer, 'speed', 1.0),
      lightningBranches: getLayerParamNumber(lightningLayer, 'branches', 3.0),
      lightningThickness: getLayerParamNumber(lightningLayer, 'thickness', 0.02),
      lightningColor: getLayerParamNumber(lightningLayer, 'color', 0),
      analogOscilloEnabled: analogOscilloLayer?.enabled ?? false,
      analogOscilloOpacity: getLayerParamNumber(analogOscilloLayer, 'opacity', 1.0),
      analogOscilloThickness: getLayerParamNumber(analogOscilloLayer, 'thickness', 0.01),
      analogOscilloGlow: getLayerParamNumber(analogOscilloLayer, 'glow', 0.5),
      analogOscilloColor: getLayerParamNumber(analogOscilloLayer, 'color', 0),
      analogOscilloMode: getLayerParamNumber(analogOscilloLayer, 'mode', 0),
      speakerConeEnabled: speakerConeLayer?.enabled ?? false,
      speakerConeOpacity: getLayerParamNumber(speakerConeLayer, 'opacity', 1.0),
      speakerConeForce: getLayerParamNumber(speakerConeLayer, 'force', 1.0),
      glitchScanlineEnabled: glitchScanlineLayer?.enabled ?? false,
      glitchScanlineOpacity: getLayerParamNumber(glitchScanlineLayer, 'opacity', 1.0),
      glitchScanlineSpeed: getLayerParamNumber(glitchScanlineLayer, 'speed', 1.0),
      glitchScanlineCount: getLayerParamNumber(glitchScanlineLayer, 'count', 1.0),
      laserStarfieldEnabled: laserStarfieldLayer?.enabled ?? false,
      laserStarfieldOpacity: getLayerParamNumber(laserStarfieldLayer, 'opacity', 1.0),
      laserStarfieldSpeed: getLayerParamNumber(laserStarfieldLayer, 'speed', 1.0),
      laserStarfieldDensity: getLayerParamNumber(laserStarfieldLayer, 'density', 1.0),
      pulsingRibbonsEnabled: pulsingRibbonsLayer?.enabled ?? false,
      pulsingRibbonsOpacity: getLayerParamNumber(pulsingRibbonsLayer, 'opacity', 1.0),
      pulsingRibbonsCount: getLayerParamNumber(pulsingRibbonsLayer, 'count', 3.0),
      pulsingRibbonsWidth: getLayerParamNumber(pulsingRibbonsLayer, 'width', 0.05),
      electricArcEnabled: electricArcLayer?.enabled ?? false,
      electricArcOpacity: getLayerParamNumber(electricArcLayer, 'opacity', 1.0),
      electricArcRadius: getLayerParamNumber(electricArcLayer, 'radius', 0.5),
      electricArcChaos: getLayerParamNumber(electricArcLayer, 'chaos', 1.0),
      pyroBurstEnabled: pyroBurstLayer?.enabled ?? false,
      pyroBurstOpacity: getLayerParamNumber(pyroBurstLayer, 'opacity', 1.0),
      pyroBurstForce: getLayerParamNumber(pyroBurstLayer, 'force', 1.0),
      geoWireframeEnabled: geoWireframeLayer?.enabled ?? false,
      geoWireframeOpacity: getLayerParamNumber(geoWireframeLayer, 'opacity', 1.0),
      geoWireframeShape: getLayerParamNumber(geoWireframeLayer, 'shape', 0),
      geoWireframeScale: getLayerParamNumber(geoWireframeLayer, 'scale', 0.5),
      signalNoiseEnabled: signalNoiseLayer?.enabled ?? false,
      signalNoiseOpacity: getLayerParamNumber(signalNoiseLayer, 'opacity', 1.0),
      signalNoiseAmount: getLayerParamNumber(signalNoiseLayer, 'amount', 1.0),
      wormholeEnabled: wormholeLayer?.enabled ?? false,
      wormholeOpacity: getLayerParamNumber(wormholeLayer, 'opacity', 1.0),
      wormholeSpeed: getLayerParamNumber(wormholeLayer, 'speed', 1.0),
      wormholeWeave: getLayerParamNumber(wormholeLayer, 'weave', 0.2),
      wormholeIter: getLayerParamNumber(wormholeLayer, 'iter', 3.0),
      ribbonTunnelEnabled: ribbonTunnelLayer?.enabled ?? false,
      ribbonTunnelOpacity: getLayerParamNumber(ribbonTunnelLayer, 'opacity', 1.0),
      ribbonTunnelSpeed: getLayerParamNumber(ribbonTunnelLayer, 'speed', 1.0),
      ribbonTunnelTwist: getLayerParamNumber(ribbonTunnelLayer, 'twist', 1.0),
      fractalTunnelEnabled: fractalTunnelLayer?.enabled ?? false,
      fractalTunnelOpacity: getLayerParamNumber(fractalTunnelLayer, 'opacity', 1.0),
      fractalTunnelSpeed: getLayerParamNumber(fractalTunnelLayer, 'speed', 1.0),
      fractalTunnelComplexity: getLayerParamNumber(fractalTunnelLayer, 'complexity', 3.0),
      circuitConduitEnabled: circuitConduitLayer?.enabled ?? false,
      circuitConduitOpacity: getLayerParamNumber(circuitConduitLayer, 'opacity', 1.0),
      circuitConduitSpeed: getLayerParamNumber(circuitConduitLayer, 'speed', 1.0),
      auraPortalEnabled: auraPortalLayer?.enabled ?? false,
      auraPortalOpacity: getLayerParamNumber(auraPortalLayer, 'opacity', 1.0),
      auraPortalColor: getLayerParamNumber(auraPortalLayer, 'color', 0),
      freqTerrainEnabled: freqTerrainLayer?.enabled ?? false,
      freqTerrainOpacity: getLayerParamNumber(freqTerrainLayer, 'opacity', 1.0),
      freqTerrainScale: getLayerParamNumber(freqTerrainLayer, 'scale', 1.0),
      dataStreamEnabled: dataStreamLayer?.enabled ?? false,
      dataStreamOpacity: getLayerParamNumber(dataStreamLayer, 'opacity', 1.0),
      dataStreamSpeed: getLayerParamNumber(dataStreamLayer, 'speed', 1.0),
      causticLiquidEnabled: causticLiquidLayer?.enabled ?? false,
      causticLiquidOpacity: getLayerParamNumber(causticLiquidLayer, 'opacity', 1.0),
      causticLiquidSpeed: getLayerParamNumber(causticLiquidLayer, 'speed', 1.0),
      shimmerVeilEnabled: shimmerVeilLayer?.enabled ?? false,
      shimmerVeilOpacity: getLayerParamNumber(shimmerVeilLayer, 'opacity', 1.0),
      shimmerVeilComplexity: getLayerParamNumber(shimmerVeilLayer, 'complexity', 10.0),
      // --- New 31 Generators Parameters ---
      nebulaCloudEnabled: nebulaCloudLayer?.enabled ?? false,
      nebulaCloudOpacity: getLayerParamNumber(nebulaCloudLayer, 'opacity', 1.0),
      nebulaCloudDensity: getLayerParamNumber(nebulaCloudLayer, 'density', 1.0),
      nebulaCloudSpeed: getLayerParamNumber(nebulaCloudLayer, 'speed', 0.5),
      circuitBoardEnabled: circuitBoardLayer?.enabled ?? false,
      circuitBoardOpacity: getLayerParamNumber(circuitBoardLayer, 'opacity', 1.0),
      circuitBoardGrowth: getLayerParamNumber(circuitBoardLayer, 'growth', 1.0),
      circuitBoardComplexity: getLayerParamNumber(circuitBoardLayer, 'complexity', 5.0),
      lorenzAttractorEnabled: lorenzLayer?.enabled ?? false,
      lorenzAttractorOpacity: getLayerParamNumber(lorenzLayer, 'opacity', 1.0),
      lorenzAttractorSpeed: getLayerParamNumber(lorenzLayer, 'speed', 1.0),
      lorenzAttractorChaos: getLayerParamNumber(lorenzLayer, 'chaos', 1.0),
      mandalaSpinnerEnabled: mandalaLayer?.enabled ?? false,
      mandalaSpinnerOpacity: getLayerParamNumber(mandalaLayer, 'opacity', 1.0),
      mandalaSpinnerSides: getLayerParamNumber(mandalaLayer, 'sides', 6.0),
      mandalaSpinnerSpeed: getLayerParamNumber(mandalaLayer, 'speed', 1.0),
      starburstGalaxyEnabled: starburstLayer?.enabled ?? false,
      starburstGalaxyOpacity: getLayerParamNumber(starburstLayer, 'opacity', 1.0),
      starburstGalaxyForce: getLayerParamNumber(starburstLayer, 'force', 1.0),
      starburstGalaxyCount: getLayerParamNumber(starburstLayer, 'count', 100.0),
      digitalRainV2Enabled: rainV2Layer?.enabled ?? false,
      digitalRainV2Opacity: getLayerParamNumber(rainV2Layer, 'opacity', 1.0),
      digitalRainV2Speed: getLayerParamNumber(rainV2Layer, 'speed', 1.0),
      digitalRainV2Density: getLayerParamNumber(rainV2Layer, 'density', 1.0),
      lavaFlowEnabled: lavaLayer?.enabled ?? false,
      lavaFlowOpacity: getLayerParamNumber(lavaLayer, 'opacity', 1.0),
      lavaFlowHeat: getLayerParamNumber(lavaLayer, 'heat', 1.0),
      lavaFlowViscosity: getLayerParamNumber(lavaLayer, 'viscosity', 1.0),
      crystalGrowthEnabled: crystalGrowthLayer?.enabled ?? false,
      crystalGrowthOpacity: getLayerParamNumber(crystalGrowthLayer, 'opacity', 1.0),
      crystalGrowthRate: getLayerParamNumber(crystalGrowthLayer, 'rate', 0.5),
      crystalGrowthSharpness: getLayerParamNumber(crystalGrowthLayer, 'sharpness', 0.8),
      technoGridEnabled: technoGridLayer?.enabled ?? false,
      technoGridOpacity: getLayerParamNumber(technoGridLayer, 'opacity', 1.0),
      technoGridHeight: getLayerParamNumber(technoGridLayer, 'height', 1.0),
      technoGridSpeed: getLayerParamNumber(technoGridLayer, 'speed', 1.0),
      magneticFieldEnabled: magneticLayer?.enabled ?? false,
      magneticFieldOpacity: getLayerParamNumber(magneticLayer, 'opacity', 1.0),
      magneticFieldStrength: getLayerParamNumber(magneticLayer, 'strength', 1.0),
      magneticFieldDensity: getLayerParamNumber(magneticLayer, 'density', 20.0),
      prismShardsEnabled: prismShardsLayer?.enabled ?? false,
      prismShardsOpacity: getLayerParamNumber(prismShardsLayer, 'opacity', 1.0),
      prismShardsRefraction: getLayerParamNumber(prismShardsLayer, 'refraction', 0.5),
      prismShardsCount: getLayerParamNumber(prismShardsLayer, 'count', 5.0),
      neuralNetEnabled: neuralNetLayer?.enabled ?? false,
      neuralNetOpacity: getLayerParamNumber(neuralNetLayer, 'opacity', 1.0),
      neuralNetActivity: getLayerParamNumber(neuralNetLayer, 'activity', 1.0),
      neuralNetDensity: getLayerParamNumber(neuralNetLayer, 'density', 1.0),
      auroraChordEnabled: auroraChordLayer?.enabled ?? false,
      auroraChordOpacity: getLayerParamNumber(auroraChordLayer, 'opacity', 1.0),
      auroraChordWaviness: getLayerParamNumber(auroraChordLayer, 'waviness', 1.0),
      auroraChordColorRange: getLayerParamNumber(auroraChordLayer, 'colorRange', 1.0),
      vhsGlitchEnabled: vhsGlitchLayer?.enabled ?? false,
      vhsGlitchOpacity: getLayerParamNumber(vhsGlitchLayer, 'opacity', 1.0),
      vhsGlitchJitter: getLayerParamNumber(vhsGlitchLayer, 'jitter', 0.2),
      vhsGlitchNoise: getLayerParamNumber(vhsGlitchLayer, 'noise', 0.3),
      moirePatternEnabled: moireLayer?.enabled ?? false,
      moirePatternOpacity: getLayerParamNumber(moireLayer, 'opacity', 1.0),
      moirePatternScale: getLayerParamNumber(moireLayer, 'scale', 5.0),
      moirePatternSpeed: getLayerParamNumber(moireLayer, 'speed', 1.0),
      hypercubeEnabled: hypercubeLayer?.enabled ?? false,
      hypercubeOpacity: getLayerParamNumber(hypercubeLayer, 'opacity', 1.0),
      hypercubeProjection: getLayerParamNumber(hypercubeLayer, 'projection', 1.0),
      hypercubeSpeed: getLayerParamNumber(hypercubeLayer, 'speed', 1.0),
      fluidSwirlEnabled: fluidSwirlLayer?.enabled ?? false,
      fluidSwirlOpacity: getLayerParamNumber(fluidSwirlLayer, 'opacity', 1.0),
      fluidSwirlVorticity: getLayerParamNumber(fluidSwirlLayer, 'vorticity', 1.0),
      fluidSwirlColorMix: getLayerParamNumber(fluidSwirlLayer, 'colorMix', 1.0),
      asciiStreamEnabled: asciiLayer?.enabled ?? false,
      asciiStreamOpacity: getLayerParamNumber(asciiLayer, 'opacity', 1.0),
      asciiStreamResolution: getLayerParamNumber(asciiLayer, 'resolution', 40.0),
      asciiStreamContrast: getLayerParamNumber(asciiLayer, 'contrast', 1.0),
      retroWaveEnabled: retroWaveLayer?.enabled ?? false,
      retroWaveOpacity: getLayerParamNumber(retroWaveLayer, 'opacity', 1.0),
      retroWaveSunSize: getLayerParamNumber(retroWaveLayer, 'sunSize', 1.0),
      retroWaveGridSpeed: getLayerParamNumber(retroWaveLayer, 'gridSpeed', 1.0),
      bubblePopEnabled: bubblePopLayer?.enabled ?? false,
      bubblePopOpacity: getLayerParamNumber(bubblePopLayer, 'opacity', 1.0),
      bubblePopPopRate: getLayerParamNumber(bubblePopLayer, 'popRate', 1.0),
      bubblePopSize: getLayerParamNumber(bubblePopLayer, 'size', 0.5),
      soundWave3DEnabled: soundWave3DLayer?.enabled ?? false,
      soundWave3DOpacity: getLayerParamNumber(soundWave3DLayer, 'opacity', 1.0),
      soundWave3DAmplitude: getLayerParamNumber(soundWave3DLayer, 'amplitude', 1.0),
      soundWave3DSmoothness: getLayerParamNumber(soundWave3DLayer, 'smoothness', 1.0),
      particleVortexEnabled: particleVortexLayer?.enabled ?? false,
      particleVortexOpacity: getLayerParamNumber(particleVortexLayer, 'opacity', 1.0),
      particleVortexSuction: getLayerParamNumber(particleVortexLayer, 'suction', 1.0),
      particleVortexSpin: getLayerParamNumber(particleVortexLayer, 'spin', 1.0),
      glowWormsEnabled: glowWormsLayer?.enabled ?? false,
      glowWormsOpacity: getLayerParamNumber(glowWormsLayer, 'opacity', 1.0),
      glowWormsLength: getLayerParamNumber(glowWormsLayer, 'length', 1.0),
      glowWormsSpeed: getLayerParamNumber(glowWormsLayer, 'speed', 1.0),
      mirrorMazeEnabled: mirrorMazeLayer?.enabled ?? false,
      mirrorMazeOpacity: getLayerParamNumber(mirrorMazeLayer, 'opacity', 1.0),
      mirrorMazeRecursion: getLayerParamNumber(mirrorMazeLayer, 'recursion', 4.0),
      mirrorMazeAngle: getLayerParamNumber(mirrorMazeLayer, 'angle', 0.78),
      pulseHeartEnabled: pulseHeartLayer?.enabled ?? false,
      pulseHeartOpacity: getLayerParamNumber(pulseHeartLayer, 'opacity', 1.0),
      pulseHeartBeats: getLayerParamNumber(pulseHeartLayer, 'beats', 1.0),
      pulseHeartLayers: getLayerParamNumber(pulseHeartLayer, 'layers', 5.0),
      dataShardsEnabled: dataShardsLayer?.enabled ?? false,
      dataShardsOpacity: getLayerParamNumber(dataShardsLayer, 'opacity', 1.0),
      dataShardsSpeed: getLayerParamNumber(dataShardsLayer, 'speed', 1.0),
      dataShardsSharpness: getLayerParamNumber(dataShardsLayer, 'sharpness', 1.0),
      hexCellEnabled: hexCellLayer?.enabled ?? false,
      hexCellOpacity: getLayerParamNumber(hexCellLayer, 'opacity', 1.0),
      hexCellPulse: getLayerParamNumber(hexCellLayer, 'pulse', 1.0),
      hexCellScale: getLayerParamNumber(hexCellLayer, 'scale', 1.0),
      plasmaBallEnabled: plasmaBallLayer?.enabled ?? false,
      plasmaBallOpacity: getLayerParamNumber(plasmaBallLayer, 'opacity', 1.0),
      plasmaBallVoltage: getLayerParamNumber(plasmaBallLayer, 'voltage', 1.0),
      plasmaBallFilaments: getLayerParamNumber(plasmaBallLayer, 'filaments', 5.0),
      warpDriveEnabled: warpDriveLayer?.enabled ?? false,
      warpDriveOpacity: getLayerParamNumber(warpDriveLayer, 'opacity', 1.0),
      warpDriveWarp: getLayerParamNumber(warpDriveLayer, 'warp', 1.0),
      warpDriveGlow: getLayerParamNumber(warpDriveLayer, 'glow', 1.0),
      visualFeedbackEnabled: feedbackLayer?.enabled ?? false,
      visualFeedbackOpacity: getLayerParamNumber(feedbackLayer, 'opacity', 1.0),
      visualFeedbackZoom: getLayerParamNumber(feedbackLayer, 'zoom', 1.01),
      visualFeedbackRotation: getLayerParamNumber(feedbackLayer, 'rotation', 0.01),
      myceliumGrowthEnabled: myceliumLayer?.enabled ?? false,
      myceliumGrowthOpacity: getLayerParamNumber(myceliumLayer, 'opacity', 1.0),
      myceliumGrowthSpread: getLayerParamNumber(myceliumLayer, 'spread', 1.0),
      myceliumGrowthDecay: getLayerParamNumber(myceliumLayer, 'decay', 0.5)
    };

    this.updateDebug(activeScene, canvasSize, renderState);
    return renderState;
  }

  private updateDebug(
    activeScene: {
      name: string;
      layers: {
        id: string;
        generatorId?: string;
        name: string;
        enabled: boolean;
        opacity: number;
        blendMode: string;
      }[];
    } | undefined,
    canvasSize: { width: number; height: number },
    renderState: RenderState
  ) {
    const frameId = this.debugState.frameId + 1;
    this.debugState.frameId = frameId;
    this.debugState.activeSceneName = activeScene?.name ?? '—';
    this.debugState.activeSceneId = activeScene?.id ?? '';
    const project = this.store.getState().project;
    this.debugState.activeModeId = project.activeModeId ?? '';
    this.debugState.activeEngineId = project.activeEngineId ?? '';
    this.debugState.activePaletteId =
      activeScene?.look?.activePaletteId ??
      project.activePaletteId ??
      '';
    const fboSize = `${canvasSize.width}x${canvasSize.height}`;
    const layers = (activeScene?.layers ?? []).map((layer) => {
      const idRaw = layer.id ?? '';
      const id = normalizeLayerId(idRaw);
      return {
        id,
        idRaw,
        generatorId: layer.generatorId ?? '',
        name: layer.name,
        enabled: layer.enabled,
        opacity: layer.opacity,
        blendMode: layer.blendMode,
        fboSize,
        lastRenderedFrameId: layer.enabled ? frameId : this.debugState.layers.find((l) => l.id === id)?.lastRenderedFrameId ?? 0,
        nonEmpty: layer.enabled && layer.opacity > 0.01
      };
    });
    this.debugState.layers = layers;
    this.debugState.layerCount = layers.length;

    const fx: FxDebugInfo[] = [
      { id: 'bloom', enabled: renderState.effectsEnabled && renderState.bloom > 0, bypassed: !renderState.effectsEnabled, lastAppliedFrameId: frameId },
      { id: 'blur', enabled: renderState.effectsEnabled && renderState.blur > 0, bypassed: !renderState.effectsEnabled, lastAppliedFrameId: frameId },
      { id: 'chroma', enabled: renderState.effectsEnabled && renderState.chroma > 0, bypassed: !renderState.effectsEnabled, lastAppliedFrameId: frameId },
      { id: 'posterize', enabled: renderState.effectsEnabled && renderState.posterize > 0, bypassed: !renderState.effectsEnabled, lastAppliedFrameId: frameId },
      { id: 'kaleidoscope', enabled: renderState.effectsEnabled && renderState.kaleidoscope > 0, bypassed: !renderState.effectsEnabled, lastAppliedFrameId: frameId },
      { id: 'feedback', enabled: renderState.effectsEnabled && renderState.feedback > 0, bypassed: !renderState.effectsEnabled, lastAppliedFrameId: frameId },
      { id: 'persistence', enabled: renderState.effectsEnabled && renderState.persistence > 0, bypassed: !renderState.effectsEnabled, lastAppliedFrameId: frameId }
    ];
    this.debugState.fx = fx;
    const rawLaserLayer =
      (activeScene?.layers ?? []).find((layer) => normalizeLayerId(layer.id ?? '').includes('laser')) ??
      (activeScene?.layers ?? []).find((layer) => normalizeLayerId(layer.generatorId ?? '').includes('laser')) ??
      (activeScene?.layers ?? []).find((layer) => (layer.name ?? '').toLowerCase().includes('laser'));
    const laserIdRaw = rawLaserLayer?.id ?? '';
    const laserIdBytes = laserIdRaw
      ? Array.from(laserIdRaw).map((ch) => ch.charCodeAt(0)).join(' ')
      : '';
    const laserLayer = findLayerById(activeScene?.layers, 'gen-laser-beam') ?? rawLaserLayer;
    const laserTarget = 'gen-laser-beam';
    const laserNormalized = normalizeLayerId(laserIdRaw);
    this.debugState.laser = {
      enabled: renderState.laserEnabled,
      opacity: renderState.laserOpacity ?? 0,
      beamCount: renderState.laserBeamCount ?? 0,
      beamWidth: renderState.laserBeamWidth ?? 0,
      beamLength: renderState.laserBeamLength ?? 0,
      glow: renderState.laserGlow ?? 0,
      present: Boolean(laserLayer),
      enabledInScene: laserLayer?.enabled ?? false,
      idRaw: laserIdRaw,
      idBytes: laserIdBytes,
      matchTarget: laserTarget,
      matchNormalized: laserNormalized
    };
    this.debugState.masterBusFrameId = frameId;
    this.debugState.uniformsUpdatedFrameId = frameId;
  }

  private buildModSources(bpm: number) {
    const state = this.store.getState();
    const bpmNormalized = Math.min(Math.max((bpm - 60) / 140, 0), 1);
    const lfoValues = state.project.lfos.map((lfo, index) =>
      this.lfoValueForShape(state.modulators.lfoPhases[index] ?? lfo.phase ?? 0, lfo.shape)
    );
    const envValues = state.modulators.envStates.map((env) => env.value);
    const shValues = state.modulators.shStates.map((sh) => sh.value);
    return {
      'audio.rms': state.audio.rms,
      'audio.peak': state.audio.peak,
      'audio.strobe': state.runtime.strobeIntensity,
      'tempo.bpm': bpmNormalized,
      'lfo-1': lfoValues[0] ?? 0,
      'lfo-2': lfoValues[1] ?? 0,
      'env-1': envValues[0] ?? 0,
      'env-2': envValues[1] ?? 0,
      'sh-1': shValues[0] ?? 0,
      'sh-2': shValues[1] ?? 0,
      'macro-1': state.project.macros[0]?.value ?? 0,
      'macro-2': state.project.macros[1]?.value ?? 0,
      'macro-3': state.project.macros[2]?.value ?? 0,
      'macro-4': state.project.macros[3]?.value ?? 0,
      'macro-5': state.project.macros[4]?.value ?? 0,
      'macro-6': state.project.macros[5]?.value ?? 0,
      'macro-7': state.project.macros[6]?.value ?? 0,
      'macro-8': state.project.macros[7]?.value ?? 0
    };
  }

  private lfoValueForShape(phase: number, shape: 'sine' | 'triangle' | 'saw' | 'square') {
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
  }

  private getActiveBpm() {
    const state = this.store.getState();
    if (state.bpm.source === 'network' && state.bpm.networkBpm) return state.bpm.networkBpm;
    if (state.bpm.source === 'auto' && state.bpm.autoBpm) return state.bpm.autoBpm;
    return state.bpm.manualBpm || 120;
  }
}
