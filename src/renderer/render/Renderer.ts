import { createGLRenderer, resizeCanvasToDisplaySize, RenderState } from '../glRenderer';
import type { CustomShaderBlock } from '../../shared/customShaderBlock';
import type { Store } from '../state/store';
import { actions } from '../state/actions';
import { setStatus } from '../state/events';
import { createSafeModeRenderer } from '../safeModeRenderer';
import type { RenderGraph } from './RenderGraph';
import type { AudioEngine } from '../audio/AudioEngine';
import type { DebugOverlay } from './debugOverlay';
import {
  nextFrameDropScore,
  resolveFrameCadence,
  resolveLatencyDiagnostics,
  resolveSceneSwitch,
  tickFpsTracker
} from './renderLoopHelpers';
import { buildRendererOutputBroadcastPayload } from './outputPayload';
import { collectSceneGeneratorIds } from '../../shared/shaderUtils';

export interface RendererDeps {
  store: Store;
  renderGraph: RenderGraph;
  audioEngine: AudioEngine;
  debugOverlay: DebugOverlay;
  serializeProject: () => string;
  onSceneApplied: (sceneId: string) => void;
}

export interface Renderer {
  start: () => void;
  dispose: () => void;
  setLayerAsset: ReturnType<typeof createGLRenderer>['setLayerAsset'];
  getLastShaderError: () => string | null;
  getGeneratorDiagnostics: ReturnType<typeof createGLRenderer>['getGeneratorDiagnostics'];
  getMissingUniforms: ReturnType<typeof createGLRenderer>['getMissingUniforms'];
  recompileForGenerators: (activeIds: Set<string>, customBlocks?: CustomShaderBlock[]) => boolean;
  precompileVariant: (ids: Set<string>) => void;
  setCustomShaderBlocks: (blocks: CustomShaderBlock[]) => void;
  getMilkDropCompileReport: ReturnType<typeof createGLRenderer>['getMilkDropCompileReport'];
  getMilkDropNativeRuntimeReport: ReturnType<typeof createGLRenderer>['getMilkDropNativeRuntimeReport'];
  runStressTest: (iterations?: number, intervalMs?: number) => Promise<void>;
}

export const createRenderer = ({
  store,
  renderGraph,
  audioEngine,
  debugOverlay,
  serializeProject,
  onSceneApplied
}: RendererDeps): Renderer => {
  const canvas = document.getElementById('gl-canvas') as HTMLCanvasElement;
  const visualizerCanvas = document.getElementById('visualizer-canvas') as HTMLCanvasElement;
  const outputChannel = new BroadcastChannel('visualsynth-output');
  let lastOutputBroadcast = 0;

  let renderer: ReturnType<typeof createGLRenderer>;
  try {
    renderer = createGLRenderer(canvas, {});
  } catch (error) {
    actions.setWebglInitError(store, error instanceof Error ? error.message : String(error));
    actions.addSafeModeReason(store, 'Renderer init failed');
    setStatus('Renderer init failed. Safe mode enabled.');
    renderer = createSafeModeRenderer(canvas);
  }

  let lastTime = performance.now();
  let fpsTracker = { fpsAccumulatorMs: 0, frameCount: 0 };

  const drawVisualizer = () => {
    const ctx = visualizerCanvas.getContext('2d');
    if (!ctx) return;
    const { project, audio } = store.getState();
    const width = visualizerCanvas.width;
    const height = visualizerCanvas.height;
    ctx.clearRect(0, 0, width, height);
    if (project.visualizer.mode === 'off' || !project.visualizer.enabled) return;

    let visualizerAlpha = project.visualizer.opacity;
    if (project.visualizer.macroEnabled) {
      const macroId = Math.min(Math.max(Math.round(project.visualizer.macroId), 1), 8);
      const macroValue = project.macros[macroId - 1]?.value ?? 1;
      visualizerAlpha *= Math.min(Math.max(macroValue, 0), 1);
    }
    ctx.globalAlpha = visualizerAlpha;
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#8fd6ff';
    ctx.beginPath();
    if (project.visualizer.mode === 'spectrum') {
      const barCount = audio.spectrum.length;
      for (let i = 0; i < barCount; i += 1) {
        const value = audio.spectrum[i];
        const x = (i / (barCount - 1)) * width;
        const y = height - value * height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    } else {
      const data = audio.waveform;
      for (let i = 0; i < data.length; i += 1) {
        const x = (i / (data.length - 1)) * width;
        const y = height / 2 + data[i] * (height * 0.45);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      if (project.visualizer.mode === 'oscilloscope') {
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

  const renderLoop = (time: number) => {
    const delta = time - lastTime;
    lastTime = time;
    const fpsTick = tickFpsTracker(fpsTracker, delta);
    fpsTracker = fpsTick.tracker;
    if (fpsTick.fps !== null) {
      const fps = fpsTick.fps;
      store.update((state) => {
        state.diagnostics.fps = fps;
      }, false);
    }

    store.update((state) => {
      state.diagnostics.lastRenderTimeMs = time;
    }, false);

    store.update((state) => {
      state.diagnostics.frameDropScore = nextFrameDropScore(state.diagnostics.frameDropScore, delta);
    }, false);

    const state = store.getState();
    const cadence = resolveFrameCadence({
      timeMs: time,
      lastWatchdogUpdateAt: state.diagnostics.lastWatchdogUpdate,
      lastAutosaveAt: state.diagnostics.lastAutosaveAt,
      outputOpen: state.outputOpen,
      lastBroadcastAt: lastOutputBroadcast,
      isPlaying: state.transport.isPlaying,
      transportTimeMs: state.transport.timeMs,
      deltaMs: delta
    });

    if (cadence.shouldUpdateWatchdog) {
      store.update((current) => {
        current.diagnostics.lastWatchdogUpdate = time;
      }, false);
    }

    if (cadence.shouldAutosave) {
      store.update((current) => {
        current.diagnostics.lastAutosaveAt = time;
      }, false);
      const payload = serializeProject();
      void window.visualSynth.autosaveProject(payload);
    }

    audioEngine.update(delta);

    const latency = resolveLatencyDiagnostics(audioEngine.getContext());
    store.update((current) => {
      current.diagnostics.latencyMs = latency.latencyMs;
      current.diagnostics.outputLatencyMs = latency.outputLatencyMs;
    }, false);

    if (cadence.nextTransportTime !== null) {
      actions.setTransportTime(store, cadence.nextTransportTime);
    }

    const pending = state.pendingSceneSwitch;
    const sceneSwitch = resolveSceneSwitch(
      state.transport.isPlaying,
      pending,
      time,
      audioEngine.getActiveBpm()
    );

    actions.setQuantizeHud(store, sceneSwitch.quantizeHudMessage);
    if (sceneSwitch.shouldApplyScene && pending) {
      actions.setPendingSceneSwitch(store, null);
      renderGraph.dispose(); // Recreate FX nodes cleanly on scene switch
      
      // Prune unused assets from GL renderer to prevent resource leaks (e.g. video elements)
      const project = store.getState().project;
      const targetScene = project.scenes.find(s => s.id === pending.targetSceneId);
      if (targetScene && renderer.pruneUnusedAssets) {
        const activeAssetIds = new Set<string>();
        targetScene.layers.forEach(layer => {
          if (layer.assetId) activeAssetIds.add(layer.assetId);
        });
        project.overlays?.forEach(overlay => {
          if (overlay.assetPath) {
            // Find asset by path to get ID, or use path as ID if that's how it's cached
            const asset = project.assets.find(a => a.path === overlay.assetPath);
            if (asset) activeAssetIds.add(asset.id);
            else activeAssetIds.add(overlay.assetPath);
          }
        });
        renderer.pruneUnusedAssets(activeAssetIds);
      }

      onSceneApplied(pending.targetSceneId);
    }

    resizeCanvasToDisplaySize(canvas);
    resizeCanvasToDisplaySize(visualizerCanvas);

    const renderState = renderGraph.buildRenderState(time, delta, {
      width: canvas.width,
      height: canvas.height
    }, renderer.getResourceCounts?.()) as RenderState & { debugTint?: number };

    renderer.render(renderState);
    drawVisualizer();

    const debugState = renderGraph.getDebugState();
    debugOverlay.update(debugState, store.getState().diagnostics.fps);

    if (cadence.shouldBroadcastOutput) {
      lastOutputBroadcast = time;
      const outputState = store.getState();
      const outputScene = outputState.project.scenes.find(
        (scene) => scene.id === outputState.project.activeSceneId
      );
      outputChannel.postMessage(
        buildRendererOutputBroadcastPayload({
          renderState,
          project: outputState.project,
          scene: outputScene,
          activeGeneratorIds: outputScene
            ? [...collectSceneGeneratorIds(outputScene)]
            : undefined
        })
      );
    }

    if (!isDisposed) {
      requestAnimationFrame(renderLoop);
    }
  };

  let isDisposed = false;

  return {
    start: () => {
      requestAnimationFrame(renderLoop);
    },
    dispose: () => {
      isDisposed = true;
      renderer.dispose?.();
      renderGraph.dispose();
      outputChannel.close();
    },
    setLayerAsset: renderer.setLayerAsset,
    getLastShaderError: renderer.getLastShaderError,
    getGeneratorDiagnostics: renderer.getGeneratorDiagnostics,
    getMissingUniforms: renderer.getMissingUniforms,
    recompileForGenerators: (activeIds: Set<string>, customBlocks?: CustomShaderBlock[]) =>
      renderer.recompileForGenerators ? renderer.recompileForGenerators(activeIds, customBlocks, false) : false,
    precompileVariant: (ids: Set<string>) =>
      renderer.precompileVariant ? renderer.precompileVariant(ids) : undefined,
    setCustomShaderBlocks: (blocks: CustomShaderBlock[]) =>
      renderer.setCustomShaderBlocks ? renderer.setCustomShaderBlocks(blocks) : undefined,
    getMilkDropCompileReport: renderer.getMilkDropCompileReport,
    getMilkDropNativeRuntimeReport: renderer.getMilkDropNativeRuntimeReport,
    runStressTest: async (iterations = 100, intervalMs = 100) => {
      console.log(`[StressTest] Starting stress test: ${iterations} transitions...`);
      const { project } = store.getState();
      const sceneIds = project.scenes.map(s => s.id);
      if (sceneIds.length === 0) {
        console.warn('[StressTest] No scenes available for stress test');
        return;
      }

      const initialResources = renderer.getResourceCounts?.();
      console.log('[StressTest] Initial resources:', initialResources);

      for (let i = 0; i < iterations; i++) {
        const sceneId = sceneIds[i % sceneIds.length];
        const sceneName = project.scenes.find(s => s.id === sceneId)?.name;
        console.log(`[StressTest] Transition ${i + 1}/${iterations} to scene: ${sceneName}`);
        onSceneApplied(sceneId);
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }

      const finalResources = renderer.getResourceCounts?.();
      console.log('[StressTest] Final resources after stress test:', finalResources);
      console.log('[StressTest] Resource delta:', {
        textures: (finalResources?.textures ?? 0) - (initialResources?.textures ?? 0),
        framebuffers: (finalResources?.framebuffers ?? 0) - (initialResources?.framebuffers ?? 0),
        programs: (finalResources?.programs ?? 0) - (initialResources?.programs ?? 0),
        shaders: (finalResources?.shaders ?? 0) - (initialResources?.shaders ?? 0)
      });
      console.log('[StressTest] Stress test complete.');
    }
  };
};
