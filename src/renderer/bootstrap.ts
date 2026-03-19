/**
 * Bootstrap: Minimal entrypoint for basic renderer initialization.
 *
 * NOTE: This module is a minimal/fallback entrypoint. The default entrypoint
 * is now src/renderer/index.ts which includes full UI initialization.
 *
 * Use this entrypoint only for:
 * - Debugging minimal renderer startup
 * - Headless testing scenarios
 * - Custom builds that don't need full UI
 *
 * To build with this entrypoint: node scripts/build-renderer.js --entry=bootstrap
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
 * 6. Initialize preset library
 * 7. Handle recovery (if available)
 * 8. Start render loop
 */

import { createStore, createInitialState, type Store } from './state/store';
import { actions } from './state/actions';
import { setStatus } from './state/events';
import { createAudioEngine } from './audio/AudioEngine';
import { createMidiEngine } from './midi/MidiEngine';
import { RenderGraph } from './render/RenderGraph';
import { createDebugOverlay } from './render/debugOverlay';
import { createRenderer } from './render/Renderer';
import { createProjectIO } from './persistence/projectIO';
import { DEFAULT_OUTPUT_CONFIG, OUTPUT_BASE_WIDTH, OUTPUT_BASE_HEIGHT } from '../shared/project';
import type { VisualSynthProject } from '../shared/project';
import { compileSceneShaders, primeProjectShaders } from './shaderLifecycle';
 import { selectStartupProject } from './startupProject';
 import { applyStartupSelection } from './startupProjectApply';
 import { applySceneActivationRuntime, resolveSceneActivationRuntime } from './sceneRuntime';
 import { initializeOutputSession } from './outputSessionRuntime';
 import { buildCaptureDiagnostics } from './captureDiagnostics';
 import { ensureVisualSynthBridge } from './visualSynthBridge';
 import { migratePreset, validatePreset } from '../shared/presetMigration';

export interface BootstrapResult {
  store: Store;
  cleanup: () => void;
}

declare global {
  interface Window {
    __visualSynthBootstrapStarted?: boolean;
  }
}

/**
 * Initialize the application.
 * This is the single entry point for the renderer process.
 */
export const bootstrap = async (): Promise<BootstrapResult> => {
  console.log('[Bootstrap] Starting VisualSynth initialization...');
  ensureVisualSynthBridge(window);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PHASE 1: Create Core Services
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('[Bootstrap] Phase 1: Creating core services...');

  const store = createStore(createInitialState());
  const audioEngine = createAudioEngine(store);
  const renderGraph = new RenderGraph(store);
  (window as any).renderGraph = renderGraph;

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
      // Try to handle as MIDI scene trigger first
      const padState = store.getState().pad;
      const channel = 1; // Default MIDI channel
      const note = logicalIndex; // Use logical index as note number
      const bank = padState.activeBank ?? 0;

      // Check if this triggers a scene macro/preset
      const handled = renderGraph.handleMidiNote(channel, note, velocity * 127, bank);

      if (!handled) {
        // Fall back to standard pad action handling
        const padConfig = padState.config?.[logicalIndex];
        if (padConfig?.action) {
          renderGraph.handlePadAction(padConfig.action, velocity);
        }
      }
    },
    onMidiTarget: (target, value, isToggle) => {
      // Check if this is a scene CC parameter
      const channel = 1; // Default channel
      // Extract CC number from target if it's in format "cc.N"
      const ccMatch = target.match(/^cc\.(\d+)$/);
      if (ccMatch) {
        const cc = parseInt(ccMatch[1], 10);
        const handled = renderGraph.handleMidiCC(channel, cc, value * 127);
        if (handled) return;
      }

      // Handle mod matrix enable/disable toggle
      const modEnableMatch = target.match(/^modMatrix\.(\d+)\.enabled$/);
      if (modEnableMatch) {
        const modIndex = parseInt(modEnableMatch[1], 10);
        const project = store.getState().project;
        if (modIndex >= 0 && modIndex < project.modMatrix.length) {
          if (isToggle) {
            project.modMatrix[modIndex].enabled = !project.modMatrix[modIndex].enabled;
          } else {
            project.modMatrix[modIndex].enabled = value >= 0.5;
          }
        }
        return;
      }

      // Fall back to standard MIDI target handling (modulation, etc.)
      console.log('[MIDI] Target:', target, value, isToggle);
    },
    onLearnMapping: (mapping) => {
      // Add the learned mapping to the project
      actions.mutateProject(store, (project) => {
        // Remove any existing mapping for this target
        project.midiMappings = project.midiMappings.filter(m => m.target !== mapping.target);
        // Add the new mapping
        project.midiMappings.push({
          id: `midi_${Date.now()}`,
          message: mapping.message,
          channel: mapping.channel,
          control: mapping.control,
          target: mapping.target,
          mode: mapping.mode
        });
      });
      setStatus(`MIDI mapped: ${mapping.label} -> ${mapping.message} ${mapping.control}`);
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
      const project = store.getState().project;
      const activeGeneratorCount = primeProjectShaders(renderer, project, 500);
      console.log(`[Bootstrap] Project applied, modulators reinitialized, active scene shader primed for ${activeGeneratorCount} generators`);
    }
  });

  // Renderer with dependencies
  const applySceneById = (sceneId: string) => {
    const activation = resolveSceneActivationRuntime(store.getState().project, sceneId);
    if (!activation) return;
    actions.setProject(store, activation.project);
    const runtime = applySceneActivationRuntime(activation, {
      transportTimeMs: store.getState().transport.timeMs,
      onVisualTransition: () => {},
      startBlendTransition: () => {},
      clearBlendTransition: () => {},
      markSceneActivated: () => {},
      setPaletteApplied: () => {},
      compileSceneShaders: (scene, project) =>
        compileSceneShaders(renderer, scene, project.customShaderBlocks ?? [], project.sdf?.enabled ?? false)
    });
    console.log(
      `[Bootstrap] Scene applied ${activation.scene.name}, recompiled shaders for ${runtime.activeGeneratorCount ?? 0} active generators`
    );
    setStatus(`Scene applied: ${activation.scene.name}`);
  };

  const renderer = createRenderer({
    store,
    renderGraph,
    audioEngine,
    debugOverlay,
    serializeProject: projectIO.serializeProject,
    onSceneApplied: applySceneById
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

  const outputSession = await initializeOutputSession(window.visualSynth, {
    defaultConfig: DEFAULT_OUTPUT_CONFIG,
    applyState: (config, outputOpen) => {
      actions.setOutputConfig(store, config);
      actions.setOutputOpen(store, outputOpen);
    },
    onOutputClosed: () => {
      actions.setOutputOpen(store, false);
      actions.setOutputConfig(store, { ...store.getState().outputConfig, enabled: false });
      setStatus('Output window closed.');
    }
  });

  console.log('[Bootstrap] Output config loaded:', outputSession.config);

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

   // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   // PHASE 5: Initialize Preset Library
   // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   console.log('[Bootstrap] Phase 5: Initializing preset library...');

   try {
     if (!window.visualSynth?.listPresets) {
       console.error('[Bootstrap] window.visualSynth.listPresets not available!');
     } else {
       console.log('[Bootstrap] Calling listPresets()...');
       const presets = await window.visualSynth.listPresets();
       console.log(`[Bootstrap] Loaded ${presets.length} presets`);

       const presetSelect = document.getElementById('preset-select') as HTMLSelectElement;

       if (presetSelect && presets.length > 0) {
         presetSelect.innerHTML = '';
         presets.sort((a, b) => a.name.localeCompare(b.name)).forEach(preset => {
           const option = document.createElement('option');
           option.value = preset.path;
           option.textContent = preset.name;
           presetSelect.appendChild(option);
         });
         console.log('[Bootstrap] Preset dropdown populated');
       }
     }
   } catch (error) {
     console.error('[Bootstrap] Preset library initialization failed:', error);
   }

   // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   // PHASE 7: Start Render Loop
   // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   console.log('[Bootstrap] Phase 7: Starting render loop...');

  renderer.start();

  const startupGeneratorCount = primeProjectShaders(renderer, store.getState().project, 500);
  console.log(`[Bootstrap] Startup shaders primed for ${startupGeneratorCount} generators`);

  console.log('[Bootstrap] ✓ Initialization complete');
  setStatus('VisualSynth ready.');

  // Hide loading splash screen
  const splash = document.getElementById('loading-splash');
  if (splash) {
    splash.classList.add('fade-out');
    setTimeout(() => {
      splash.style.display = 'none';
    }, 500);
  }

  (window as any).__visualSynthCaptureApi = {
    applyProject: async (project: VisualSynthProject, options: { skipRecovery?: boolean } = {}) => {
      if (options.skipRecovery) {
        console.log('[Capture API] Skipping recovery session as requested');
      }
      await projectIO.applyProject(project);
    },
    getCurrentProject: () => {
      return { ...store.getState().project };
    },
    getDiagnostics: () => {
      const state = store.getState();
      return buildCaptureDiagnostics(
        state.project,
        state.safeMode.reasons,
        renderer.getLastShaderError(),
        renderer.getGeneratorDiagnostics(),
        renderer.getMissingUniforms(),
        renderer.getMilkDropCompileReport(),
        renderer.getMilkDropNativeRuntimeReport()
      );
    },
    applyScene: (sceneId: string) => {
      applySceneById(sceneId);
    },
    setMode: (mode: 'performance' | 'scene' | 'design' | 'system') => {
      actions.setUiMode(store, mode);
    },
    triggerAction: (action: string, velocity = 1.0) => {
      renderGraph.handlePadAction(action, velocity);
    }
  };
  (window as any).__visualSynthInitialized = true;
  console.log('[Bootstrap] Capture API exposed');

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

const startBootstrapEntrypoint = () => {
  if (window.__visualSynthBootstrapStarted) {
    return;
  }
  window.__visualSynthBootstrapStarted = true;
  void bootstrap().catch((error) => {
    console.error('[Bootstrap] Fatal initialization error:', error);
  });
};

startBootstrapEntrypoint();
