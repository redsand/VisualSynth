/**
 * Bootstrap: Orchestrates application initialization in correct order.
 *
 * CRITICAL: The initialization order MUST be preserved to prevent:
 * - Layer toggle null references (renderLayerList must run before render loop)
 * - Modulator array undefined errors (initModulators before render loop)
 * - Audio/MIDI setup failures (async operations must complete before use)
 *
 * Initialization Flow:
 * 1. Create core services (store, engines, renderer)
 * 2. Setup UI panels
 * 3. Load persisted state (presets, templates, output config)
 * 4. Apply initial scene (initializes layer toggles)
 * 5. Setup audio/MIDI (async operations)
 * 6. Handle recovery (if available)
 * 7. Start render loop
 */

import { createStore, createInitialState, type Store } from './state/store';
import { actions } from './state/actions';
import { setStatus } from './state/events';
import { createAudioEngine } from './audio/AudioEngine';
import { createMidiEngine } from './midi/MidiEngine';
import { createRenderGraph } from './render/RenderGraph';
import { createDebugOverlay } from './render/debugOverlay';
import { createRenderer } from './render/Renderer';
import { createProjectIO } from './persistence/projectIO';
import { DEFAULT_OUTPUT_CONFIG, OUTPUT_BASE_WIDTH, OUTPUT_BASE_HEIGHT } from '../shared/project';
import type { VisualSynthProject } from '../shared/project';
import { projectSchema } from '../shared/projectSchema';

export interface BootstrapResult {
  store: Store;
  cleanup: () => void;
}

/**
 * Initialize the application.
 * This is the single entry point for the renderer process.
 */
export const bootstrap = async (): Promise<BootstrapResult> => {
  console.log('[Bootstrap] Starting VisualSynth initialization...');

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PHASE 1: Create Core Services
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('[Bootstrap] Phase 1: Creating core services...');

  const store = createStore(createInitialState());
  const audioEngine = createAudioEngine(store);
  const renderGraph = new RenderGraph(store);

  // Debug overlay with callback to update render graph flags
  const debugOverlay = createDebugOverlay((flags) => {
    renderGraph.setDebugFlags(flags);
    store.update((state) => {
      state.debug.tintLayers = flags.tintLayers;
      state.debug.fxDelta = flags.fxDelta;
    }, false);
  });

  // MIDI engine with callbacks for pad triggers and MIDI learn
  const midiEngine = createMidiEngine(store, {
    onPadTrigger: (logicalIndex, velocity) => {
      // TODO: Implement pad trigger handling
      console.log('[MIDI] Pad trigger:', logicalIndex, velocity);
    },
    onMidiTarget: (target, value, isToggle) => {
      // TODO: Implement MIDI target handling
      console.log('[MIDI] Target:', target, value, isToggle);
    },
    onLearnMapping: (mapping) => {
      // TODO: Implement MIDI learn mapping
      console.log('[MIDI] Learn mapping:', mapping);
    }
  });

  // Output configuration helpers
  const syncOutputConfig = async (config: any) => {
    actions.setOutputConfig(store, config);
    if (store.getState().outputOpen) {
      await window.visualSynth.setOutputConfig(config);
    }
  };

  const setOutputEnabled = async (enabled: boolean) => {
    const config = { ...store.getState().outputConfig, enabled };
    if (enabled && !store.getState().outputOpen) {
      const result = await window.visualSynth.openOutput(config);
      if (result.opened) {
        actions.setOutputOpen(store, true);
        actions.setOutputConfig(store, result.config);
        setStatus('Output window opened.');
      }
    } else if (!enabled && store.getState().outputOpen) {
      const result = await window.visualSynth.closeOutput();
      if (result.closed) {
        actions.setOutputOpen(store, false);
        actions.setOutputConfig(store, result.config);
        setStatus('Output window closed.');
      }
    }
  };

  // Project I/O with callbacks
  const projectIO = createProjectIO({
    store,
    syncOutputConfig,
    setOutputEnabled,
    onProjectApplied: () => {
      // Re-initialize modulators when project changes
      audioEngine.initModulators();
      console.log('[Bootstrap] Project applied, modulators reinitialized');
    }
  });

  // Renderer with dependencies
  const renderer = createRenderer({
    store,
    renderGraph,
    audioEngine,
    debugOverlay,
    serializeProject: projectIO.serializeProject,
    onSceneApplied: (sceneId) => {
      const scene = store.getState().project.scenes.find((s) => s.id === sceneId);
      if (scene) {
        actions.mutateProject(store, (project) => {
          project.activeSceneId = sceneId;
        });
        setStatus(`Scene applied: ${scene.name}`);
      }
    }
  });

  console.log('[Bootstrap] Core services created');

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PHASE 2: Initialize UI Shortcuts
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('[Bootstrap] Phase 2: Setting up keyboard shortcuts...');

  window.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.key.toLowerCase() === 's') {
      event.preventDefault();
      void projectIO.saveProject();
    }
    if (event.ctrlKey && event.key.toLowerCase() === 'o') {
      event.preventDefault();
      void projectIO.loadProject();
    }
    if (event.key.toLowerCase() === 'f') {
      void document.documentElement.requestFullscreen().catch(() => undefined);
    }
    if (event.code === 'Space') {
      event.preventDefault();
      const current = store.getState().transport.isPlaying;
      actions.setTransportPlaying(store, !current);
      setStatus(current ? 'Transport stopped.' : 'Transport playing.');
    }
  });

  console.log('[Bootstrap] Keyboard shortcuts registered');

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PHASE 3: Load Persisted Configuration
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('[Bootstrap] Phase 3: Loading persisted configuration...');

  // Load output configuration
  const savedOutputConfig = await window.visualSynth.getOutputConfig();
  const outputOpen = await window.visualSynth.isOutputOpen();
  actions.setOutputConfig(store, { ...DEFAULT_OUTPUT_CONFIG, ...savedOutputConfig });
  actions.setOutputOpen(store, outputOpen);

  // Setup output window close handler
  window.visualSynth.onOutputClosed(() => {
    actions.setOutputOpen(store, false);
    actions.setOutputConfig(store, { ...store.getState().outputConfig, enabled: false });
    setStatus('Output window closed.');
  });

  console.log('[Bootstrap] Output config loaded:', store.getState().outputConfig);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PHASE 4: Initialize Audio & MIDI
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('[Bootstrap] Phase 4: Initializing audio and MIDI...');

  // Find and setup audio device selector
  const audioSelect = document.getElementById('audio-device') as HTMLSelectElement;
  if (audioSelect) {
    await audioEngine.initDevices(audioSelect);
    await audioEngine.setup();
  }

  // Find and setup MIDI device selector
  const midiSelect = document.getElementById('midi-device') as HTMLSelectElement;
  if (midiSelect) {
    await midiEngine.initDevices(midiSelect);
  }

  // Initialize modulators BEFORE render loop
  audioEngine.initModulators();

  console.log('[Bootstrap] Audio and MIDI initialized');

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PHASE 5: Handle Recovery Project
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('[Bootstrap] Phase 5: Checking for recovery project...');

  const recovery = await window.visualSynth.getRecovery();
  if (recovery.found && recovery.payload) {
    try {
      const parsed = projectSchema.safeParse(JSON.parse(recovery.payload));
      if (parsed.success) {
        await projectIO.applyProject(parsed.data);
        setStatus('Recovery session loaded.');
        console.log('[Bootstrap] Recovery project applied');
      } else {
        console.warn('[Bootstrap] Recovery project invalid:', parsed.error);
        setStatus('Recovery session found but invalid.');
      }
    } catch (error) {
      console.error('[Bootstrap] Recovery project parse failed:', error);
      setStatus('Recovery session found but failed to load.');
    }
  } else {
    console.log('[Bootstrap] No recovery project found');
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PHASE 6: Start Render Loop
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('[Bootstrap] Phase 6: Starting render loop...');

  renderer.start();

  console.log('[Bootstrap] ✓ Initialization complete');
  setStatus('VisualSynth ready.');

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Cleanup Function
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const cleanup = () => {
    console.log('[Bootstrap] Cleaning up...');
    // Audio context cleanup would go here
    // MIDI cleanup would go here
  };

  return { store, cleanup };
};
