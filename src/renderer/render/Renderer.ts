import { createGLRenderer, resizeCanvasToDisplaySize, RenderState } from '../glRenderer';
import type { Store } from '../state/store';
import { actions } from '../state/actions';
import { setStatus } from '../state/events';
import type { RenderGraph } from './RenderGraph';
import type { AudioEngine } from '../audio/AudioEngine';
import type { DebugOverlay } from './debugOverlay';
import { getBeatsUntil } from '../../shared/quantization';

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
  setLayerAsset: ReturnType<typeof createGLRenderer>['setLayerAsset'];
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
    fpsAccumulator += delta;
    frameCount += 1;
    if (fpsAccumulator > 1000) {
      const fps = Math.round((frameCount / fpsAccumulator) * 1000);
      store.update((state) => {
        state.diagnostics.fps = fps;
      }, false);
      fpsAccumulator = 0;
      frameCount = 0;
    }

    store.update((state) => {
      state.diagnostics.lastRenderTimeMs = time;
    }, false);

    if (delta > 24) {
      store.update((state) => {
        state.diagnostics.frameDropScore = Math.min(1, state.diagnostics.frameDropScore + 0.02);
      }, false);
    } else {
      store.update((state) => {
        state.diagnostics.frameDropScore = Math.max(0, state.diagnostics.frameDropScore - 0.01);
      }, false);
    }

    const state = store.getState();
    if (time - state.diagnostics.lastWatchdogUpdate > 1000) {
      store.update((current) => {
        current.diagnostics.lastWatchdogUpdate = time;
      }, false);
    }

    if (time - state.diagnostics.lastAutosaveAt > 120000) {
      store.update((current) => {
        current.diagnostics.lastAutosaveAt = time;
      }, false);
      const payload = serializeProject();
      void window.visualSynth.autosaveProject(payload);
    }

    audioEngine.update(delta);

    const audioContext = audioEngine.getContext();
    if (audioContext) {
      store.update((current) => {
        current.diagnostics.latencyMs = Math.round(audioContext.baseLatency * 1000);
        current.diagnostics.outputLatencyMs = audioContext.outputLatency
          ? Math.round(audioContext.outputLatency * 1000)
          : null;
      }, false);
    } else {
      store.update((current) => {
        current.diagnostics.latencyMs = null;
        current.diagnostics.outputLatencyMs = null;
      }, false);
    }

    if (state.transport.isPlaying) {
      actions.setTransportTime(store, state.transport.timeMs + delta);
    }

    const pending = state.pendingSceneSwitch;
    if (!state.transport.isPlaying) {
      actions.setQuantizeHud(store, null);
    } else if (pending) {
      const bpm = audioEngine.getActiveBpm();
      const beatsLeft = getBeatsUntil(time, pending.scheduledTimeMs, bpm);
      if (time >= pending.scheduledTimeMs) {
        actions.setPendingSceneSwitch(store, null);
        actions.setQuantizeHud(store, null);
        onSceneApplied(pending.targetSceneId);
      } else {
        actions.setQuantizeHud(
          store,
          `Switching in ${beatsLeft} beat${beatsLeft === 1 ? '' : 's'}`
        );
      }
    } else {
      actions.setQuantizeHud(store, null);
    }

    resizeCanvasToDisplaySize(canvas);
    resizeCanvasToDisplaySize(visualizerCanvas);

    const renderState = renderGraph.buildRenderState(time, delta, {
      width: canvas.width,
      height: canvas.height
    }) as RenderState & { debugTint?: number };

    renderer.render(renderState);
    drawVisualizer();

    const debugState = renderGraph.getDebugState();
    debugOverlay.update(debugState, store.getState().diagnostics.fps);

    const outputOpen = store.getState().outputOpen;
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
        chemistryMode: renderState.chemistryMode,
        transitionAmount: renderState.transitionAmount,
        transitionType: renderState.transitionType,
        motionTemplate: renderState.motionTemplate,
        engineMass: renderState.engineMass,
        engineFriction: renderState.engineFriction,
        engineElasticity: renderState.engineElasticity,
        engineGrain: renderState.engineGrain,
        engineVignette: renderState.engineVignette,
        engineCA: renderState.engineCA,
        engineSignature: renderState.engineSignature,
        maxBloom: renderState.maxBloom,
        forceFeedback: renderState.forceFeedback,
        plasmaOpacity: renderState.plasmaOpacity,
        plasmaSpeed: renderState.plasmaSpeed,
        plasmaScale: renderState.plasmaScale,
        plasmaComplexity: renderState.plasmaComplexity,
        plasmaAudioReact: renderState.plasmaAudioReact,
        spectrumOpacity: renderState.spectrumOpacity,
        origamiOpacity: renderState.origamiOpacity,
        origamiSpeed: renderState.origamiSpeed,
        origamiFoldState: renderState.origamiFoldState,
        origamiFoldSharpness: renderState.origamiFoldSharpness,
        glyphOpacity: renderState.glyphOpacity,
        glyphSpeed: renderState.glyphSpeed,
        glyphMode: renderState.glyphMode,
        glyphSeed: renderState.glyphSeed,
        glyphBeat: renderState.glyphBeat,
        crystalOpacity: renderState.crystalOpacity,
        crystalMode: renderState.crystalMode,
        crystalBrittleness: renderState.crystalBrittleness,
        crystalScale: renderState.crystalScale,
        crystalSpeed: renderState.crystalSpeed,
        inkOpacity: renderState.inkOpacity,
        inkBrush: renderState.inkBrush,
        inkPressure: renderState.inkPressure,
        inkLifespan: renderState.inkLifespan,
        inkSpeed: renderState.inkSpeed,
        inkScale: renderState.inkScale,
        topoOpacity: renderState.topoOpacity,
        topoQuake: renderState.topoQuake,
        topoSlide: renderState.topoSlide,
        topoPlate: renderState.topoPlate,
        topoTravel: renderState.topoTravel,
        topoScale: renderState.topoScale,
        topoElevation: renderState.topoElevation,
        weatherOpacity: renderState.weatherOpacity,
        weatherMode: renderState.weatherMode,
        weatherIntensity: renderState.weatherIntensity,
        weatherSpeed: renderState.weatherSpeed,
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
        modulatorValues: renderState.modulatorValues,
        midiData: renderState.midiData,
        plasmaAssetBlendMode: renderState.plasmaAssetBlendMode,
        plasmaAssetAudioReact: renderState.plasmaAssetAudioReact,
        spectrumAssetBlendMode: renderState.spectrumAssetBlendMode,
        spectrumAssetAudioReact: renderState.spectrumAssetAudioReact,
        mediaAssetBlendMode: renderState.mediaAssetBlendMode,
        mediaAssetAudioReact: renderState.mediaAssetAudioReact,
        roleWeights: renderState.roleWeights,
        effectsEnabled: renderState.effectsEnabled,
        bloom: renderState.bloom,
        blur: renderState.blur,
        chroma: renderState.chroma,
        posterize: renderState.posterize,
        kaleidoscope: renderState.kaleidoscope,
        kaleidoscopeRotation: renderState.kaleidoscopeRotation,
        feedback: renderState.feedback,
        feedbackZoom: renderState.feedbackZoom,
        feedbackRotation: renderState.feedbackRotation,
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
        particleTurbulence: renderState.particleTurbulence,
        particleAudioLift: renderState.particleAudioLift,
        sdfEnabled: renderState.sdfEnabled,
        sdfShape: renderState.sdfShape,
        sdfScale: renderState.sdfScale,
        sdfEdge: renderState.sdfEdge,
        sdfGlow: renderState.sdfGlow,
        sdfRotation: renderState.sdfRotation,
        sdfFill: renderState.sdfFill,
        sdfColor: renderState.sdfColor,
        gravityPositions: renderState.gravityPositions,
        gravityStrengths: renderState.gravityStrengths,
        gravityPolarities: renderState.gravityPolarities,
        gravityActives: renderState.gravityActives,
        gravityCollapse: renderState.gravityCollapse,
        // EDM Generators
        laserEnabled: renderState.laserEnabled,
        laserOpacity: renderState.laserOpacity,
        laserBeamCount: renderState.laserBeamCount,
        laserBeamWidth: renderState.laserBeamWidth,
        laserBeamLength: renderState.laserBeamLength,
        laserRotation: renderState.laserRotation,
        laserRotationSpeed: renderState.laserRotationSpeed,
        laserSpread: renderState.laserSpread,
        laserMode: renderState.laserMode,
        laserColorShift: renderState.laserColorShift,
        laserAudioReact: renderState.laserAudioReact,
        laserGlow: renderState.laserGlow,
        strobeEnabled: renderState.strobeEnabled,
        strobeOpacity: renderState.strobeOpacity,
        strobeRate: renderState.strobeRate,
        strobeDutyCycle: renderState.strobeDutyCycle,
        strobeMode: renderState.strobeMode,
        strobeAudioTrigger: renderState.strobeAudioTrigger,
        strobeThreshold: renderState.strobeThreshold,
        strobeFadeOut: renderState.strobeFadeOut,
        strobePattern: renderState.strobePattern,
        shapeBurstEnabled: renderState.shapeBurstEnabled,
        shapeBurstOpacity: renderState.shapeBurstOpacity,
        shapeBurstShape: renderState.shapeBurstShape,
        shapeBurstExpandSpeed: renderState.shapeBurstExpandSpeed,
        shapeBurstStartSize: renderState.shapeBurstStartSize,
        shapeBurstMaxSize: renderState.shapeBurstMaxSize,
        shapeBurstThickness: renderState.shapeBurstThickness,
        shapeBurstFadeMode: renderState.shapeBurstFadeMode,
        shapeBurstSpawnTimes: renderState.shapeBurstSpawnTimes,
        shapeBurstActives: renderState.shapeBurstActives,
        gridTunnelEnabled: renderState.gridTunnelEnabled,
        gridTunnelOpacity: renderState.gridTunnelOpacity,
        gridTunnelSpeed: renderState.gridTunnelSpeed,
        gridTunnelGridSize: renderState.gridTunnelGridSize,
        gridTunnelLineWidth: renderState.gridTunnelLineWidth,
        gridTunnelPerspective: renderState.gridTunnelPerspective,
        gridTunnelHorizonY: renderState.gridTunnelHorizonY,
        gridTunnelGlow: renderState.gridTunnelGlow,
        gridTunnelAudioReact: renderState.gridTunnelAudioReact,
        gridTunnelMode: renderState.gridTunnelMode
      });
    }

    requestAnimationFrame(renderLoop);
  };

  return {
    start: () => {
      requestAnimationFrame(renderLoop);
    },
    setLayerAsset: renderer.setLayerAsset
  };
};
