import { createGLRenderer, RenderState, resizeCanvasToDisplaySize } from './glRenderer';
import type { AssetItem, OverlayConfig } from '../shared/project';
import { createSafeModeRenderer } from './safeModeRenderer';
import { createOverlayRenderer } from './overlayRenderer';
import { syncRenderState } from './render/autoSync';
import type {
  OutputShaderVariantPayload,
  OutputTransitionPayload,
  SerializedOutputAsset
} from './render/outputPayload';
import { OutputDiagnostics } from './outputDiagnostics';

const canvas = document.getElementById('output-canvas') as HTMLCanvasElement;
const outputOverlayCanvas = document.getElementById('output-overlay-canvas') as HTMLCanvasElement;
const debugOverlay = document.getElementById('output-debug') as HTMLDivElement | null;
let debugVisible = false;
let renderer: ReturnType<typeof createGLRenderer>;
type AssetLayerId = 'layer-plasma' | 'layer-spectrum' | 'layer-media';
const layerAssetIds: Partial<Record<AssetLayerId, string | null>> = {};
const layerAssetKeys: Partial<Record<AssetLayerId, string | null>> = {};
const layerVideoElements: Partial<Record<AssetLayerId, HTMLVideoElement>> = {};

const diag = new OutputDiagnostics();
const recentTransitions: OutputTransitionPayload[] = [];
const MAX_RECENT_TRANSITIONS = 20;
let lastTransition: OutputTransitionPayload | null = null;
let lastShaderVariant: OutputShaderVariantPayload | null = null;

// Expose diagnostics globally for DevTools inspection
(window as any).__outputDiagnostics = diag;
(window as any).__outputDump = () => {
  const snap = diag.captureForensicSnapshot({
    activeGenerators: lastActiveGeneratorIds,
    canvasWidth: canvas.width,
    canvasHeight: canvas.height,
    lastMessageAgeMs: lastMessageAt ? performance.now() - lastMessageAt : -1,
    messageCount: diag.messageCount,
    lastShaderError: renderer?.getLastShaderError?.() ?? null,
    contextLost: renderer?.isContextLost?.() ?? false,
    programCacheSize: renderer?.getProgramCacheSize?.() ?? -1,
  });
  const result = {
    snapshot: snap,
    recentTransitions: [...recentTransitions],
    lastTransition,
    shaderVariant: lastShaderVariant,
    renderSnapshot: renderer?.getLastRenderSnapshot?.() ?? null,
    firstBlackPass: recentTransitions.find((transition) => transition.flaggedBlack)?.seq ?? null,
    lastNonBlackPass: [...recentTransitions].reverse().find((transition) => !transition.flaggedBlack)?.seq ?? null
  };
  console.log('[OutputDiag] Manual dump:', result);
  console.table(snap?.recentEvents ?? []);
  console.table(snap?.recentMetrics ?? []);
  return result;
};

const hiddenVideoContainer = document.createElement('div');
hiddenVideoContainer.style.position = 'absolute';
hiddenVideoContainer.style.width = '1px';
hiddenVideoContainer.style.height = '1px';
hiddenVideoContainer.style.opacity = '0';
hiddenVideoContainer.style.pointerEvents = 'none';
hiddenVideoContainer.style.overflow = 'hidden';
document.body.appendChild(hiddenVideoContainer);

const toFileUrl = (filePath: string) => {
  if (filePath.startsWith('file://')) return filePath;
  if (/^[A-Za-z]:/.test(filePath)) return `file:///${filePath.replace(/\\/g, '/')}`;
  return `file://${filePath}`;
};

const createVideoElement = (asset: SerializedOutputAsset): HTMLVideoElement => {
  const video = document.createElement('video');
  video.crossOrigin = 'anonymous';
  video.muted = true;
  video.loop = asset.options?.loop ?? true;
  video.playsInline = true;
  video.preload = 'auto';
  video.autoplay = true;
  video.playbackRate = asset.options?.playbackRate ?? 1;
  if (asset.path) {
    video.src = toFileUrl(asset.path);
  }
  video.addEventListener('error', () => {
    diag.logEvent('video-error', `asset=${asset.id} src=${asset.path}`);
  });
  hiddenVideoContainer.appendChild(video);
  return video;
};

const createLiveVideoElement = async (asset: SerializedOutputAsset): Promise<HTMLVideoElement> => {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.autoplay = true;

  const liveSource = asset.options?.liveSource;
  try {
    let stream: MediaStream;
    if (liveSource === 'screen') {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    } else {
      stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: false });
    }
    video.srcObject = stream;
    const track = stream.getVideoTracks()[0];
    track.addEventListener('ended', () => {
      video.srcObject = null;
    });
  } catch (err) {
    console.warn('[Output] Failed to create live stream:', err);
    diag.logEvent('video-error', `live stream failed: ${err}`);
  }
  hiddenVideoContainer.appendChild(video);
  return video;
};

const cleanupLayerVideo = (layerId: AssetLayerId) => {
  const existing = layerVideoElements[layerId];
  if (existing) {
    existing.pause();
    if (existing.srcObject) {
      (existing.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      existing.srcObject = null;
    }
    existing.src = '';
    existing.load();
    existing.remove();
    delete layerVideoElements[layerId];
    diag.logEvent('asset-unbound', layerId);
  }
};

let outputOverlays: OverlayConfig[] = [];
const outputOverlayRenderer = createOverlayRenderer({
  canvas: outputOverlayCanvas,
  getOverlays: () => outputOverlays,
  onOverlayUpdate: () => {},
  onSelect: () => {},
  isDesignMode: () => false
});

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

const getTextCanvas = (asset: SerializedOutputAsset): HTMLCanvasElement | null => {
  if (asset.kind !== 'text' || !asset.options?.text) return null;
  const font = asset.options.font || '48px Arial';
  const color = asset.options.fontColor || '#ffffff';
  const cacheKey = `${asset.id}-${asset.options.text}-${font}-${color}`;
  if (textCanvasCache.has(cacheKey)) {
    return textCanvasCache.get(cacheKey)!;
  }
  const canvas = renderTextToCanvas(asset.options.text, font, color);
  textCanvasCache.set(cacheKey, canvas);
  return canvas;
};

// ----- Generator deduplication: only call recompileForGenerators when the
//       active set actually changes.  Calling it 30×/sec with the same set
//       is wasteful and shadows the cache-hit log spam.
let lastActiveGeneratorsKey = '';
let lastActiveGeneratorIds: string[] = [];

const applyGeneratorIds = (ids: string[], shaderVariant?: OutputShaderVariantPayload | null) => {
  const key = shaderVariant?.key ?? [...ids].sort().join(',');
  if (key === lastActiveGeneratorsKey) return;
  lastActiveGeneratorsKey = key;
  lastActiveGeneratorIds = ids;
  lastShaderVariant = shaderVariant ?? null;
  diag.logEvent('generators-changed', `ids=[${[...ids].sort().join(',')}] variant=${shaderVariant?.sceneId ?? 'none'}`);

  if (renderer?.recompileForGenerators) {
    renderer.recompileForGenerators(
      new Set(ids),
      shaderVariant?.customBlocks ?? [],
      false,
      shaderVariant?.fxUniforms ?? ''
    );
  }

  // Cap the output renderer's program cache to prevent GPU resource exhaustion
  // over long slideshows.  Keep 4 programs: the active one plus a buffer for
  // scenes that cycle back to earlier generator sets.
  if ((renderer as any).trimProgramCache) {
    const evicted = (renderer as any).trimProgramCache(4) as number;
    if (evicted > 0) {
      diag.logEvent('program-cache-pruned', `evicted ${evicted} programs`);
    }
  }
};

// ----- Canvas resize heartbeat
canvas.addEventListener('visualsynth-contextlost', () => {
  diag.logEvent('context-lost');
});
canvas.addEventListener('visualsynth-contextrestored', () => {
  diag.logEvent('context-restored');
});

// Track last known canvas dimensions to detect resize events
let lastCanvasWidth = 0;
let lastCanvasHeight = 0;

try {
  renderer = createGLRenderer(canvas, {
    onError: (msg, type) => {
      diag.logEvent('shader-compile-failed', `${type}: ${msg.slice(0, 120)}`);
      console.error(`[Output] Shader ${type} error:`, msg);
    }
  });
} catch (error) {
  if (debugOverlay) {
    debugOverlay.textContent = error instanceof Error ? error.message : 'WebGL2 not supported.';
    debugOverlay.classList.remove('hidden');
  }
  renderer = createSafeModeRenderer(canvas, 'Safe mode: Output WebGL2 unavailable');
}

// Grab the GL context for pixel sampling (preserveDrawingBuffer:true was set by createGLRenderer)
const gl = canvas.getContext('webgl2');

const requestExitFullscreen = async () => {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
  } catch {
    // Ignore
  }
};

document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement) {
    canvas.style.width = '100%';
    canvas.style.height = '100%';
  }
});

const state: RenderState = {
  timeMs: 0,
  rms: 0,
  peak: 0,
  strobe: 0,
  spectrum: new Float32Array(64),
  plasmaEnabled: true,
  spectrumEnabled: true,
  origamiEnabled: true,
  glyphEnabled: true,
  crystalEnabled: true,
  inkEnabled: true,
  topoEnabled: true,
  weatherEnabled: true,
  portalEnabled: true,
  mediaEnabled: true,
  oscilloEnabled: true,
  contrast: 0.5,
  saturation: 1.0,
  paletteShift: 0,
  transitionAmount: 0,
  transitionType: 0,
  chemistryMode: 0,
  motionTemplate: 0,
  engineMass: 0.5,
  engineFriction: 0.95,
  engineElasticity: 1.0,
  maxBloom: 1,
  forceFeedback: false,
  engineGrain: 0,
  engineVignette: 0,
  engineCA: 0,
  engineSignature: 0,
  plasmaOpacity: 0.85,
  plasmaSpeed: 1.0,
  plasmaScale: 1.0,
  plasmaComplexity: 0.5,
  plasmaAudioReact: 0.6,
  spectrumOpacity: 0.85,
  origamiOpacity: 0.85,
  origamiFoldState: 0,
  origamiFoldSharpness: 0.5,
  origamiSpeed: 1.0,
  glyphOpacity: 0.85,
  glyphMode: 0,
  glyphSeed: 0,
  glyphBeat: 0,
  glyphSpeed: 1.0,
  crystalOpacity: 0.85,
  crystalMode: 0,
  crystalBrittleness: 0.5,
  crystalScale: 1.0,
  crystalSpeed: 1.0,
  inkOpacity: 0.85,
  inkBrush: 0,
  inkPressure: 0.5,
  inkLifespan: 1.0,
  inkSpeed: 1.0,
  inkScale: 1.0,
  topoOpacity: 0.85,
  topoQuake: 0,
  topoSlide: 0,
  topoPlate: 0,
  topoTravel: 0,
  topoScale: 1,
  topoElevation: 0.5,
  weatherOpacity: 0.85,
  weatherMode: 0,
  weatherIntensity: 0.6,
  weatherSpeed: 1,
  portalOpacity: 0.85,
  portalShift: 0,
  portalStyle: 0,
  portalPositions: new Float32Array(8),
  portalRadii: new Float32Array(4),
  portalActives: new Float32Array(4),
  mediaOpacity: 0.9,
  mediaBurstPositions: new Float32Array(16),
  mediaBurstRadii: new Float32Array(8),
  mediaBurstTypes: new Float32Array(8),
  mediaBurstActives: new Float32Array(8),
  oscilloOpacity: 0.85,
  oscilloMode: 0,
  oscilloFreeze: 0,
  oscilloRotate: 0,
  oscilloData: new Float32Array(256),
  modulatorValues: new Float32Array(16),
  midiData: new Float32Array(256),
  plasmaAssetBlendMode: 3,
  plasmaAssetAudioReact: 0.6,
  spectrumAssetBlendMode: 1,
  spectrumAssetAudioReact: 0.8,
  mediaAssetBlendMode: 3,
  mediaAssetAudioReact: 0.5,
  assetVortexEnabled: false,
  assetVortexOpacity: 0.8,
  assetVortexStrength: 2.0,
  assetVortexSpeed: 1.0,
  assetSlicesEnabled: false,
  assetSlicesOpacity: 0.8,
  assetSlicesCount: 16.0,
  assetSlicesShift: 0.3,
  assetPolarEnabled: false,
  assetPolarOpacity: 0.8,
  assetPolarRadius: 0.5,
  assetPolarTwist: 1.0,
  assetMosaicEnabled: false,
  assetMosaicOpacity: 0.8,
  assetMosaicTiles: 8.0,
  assetMosaicFlip: 0.5,
  assetRippleEnabled: false,
  assetRippleOpacity: 0.8,
  assetRippleAmplitude: 0.03,
  assetRippleFrequency: 20.0,
  assetScatterEnabled: false,
  assetScatterOpacity: 0.8,
  assetScatterAmount: 0.02,
  assetScatterSeed: 1.0,
  assetEchoEnabled: false,
  assetEchoOpacity: 0.8,
  assetEchoCount: 3.0,
  assetEchoSpread: 0.15,
  assetEchoFade: 0.6,
  effectsEnabled: true,
  bloom: 0.2,
  blur: 0,
  chroma: 0.1,
  posterize: 0,
  kaleidoscope: 0,
  kaleidoscopeRotation: 0,
  feedback: 0,
  feedbackZoom: 0,
  feedbackRotation: 0,
  persistence: 0,
  trailSpectrum: new Float32Array(64),
  expressiveEnergyBloom: 0,
  expressiveEnergyThreshold: 0.55,
  expressiveEnergyAccumulation: 0.65,
  expressiveRadialGravity: 0,
  expressiveRadialStrength: 0.6,
  expressiveRadialRadius: 0.65,
  expressiveRadialFocusX: 0.5,
  expressiveRadialFocusY: 0.5,
  expressiveMotionEcho: 0,
  expressiveMotionEchoDecay: 0.6,
  expressiveMotionEchoWarp: 0.35,
  expressiveSpectralSmear: 0,
  expressiveSpectralOffset: 0.4,
  expressiveSpectralMix: 0.6,
  particlesEnabled: true,
  particleDensity: 0.35,
  particleSpeed: 0.3,
  particleSize: 0.45,
  particleGlow: 0.6,
  particleTurbulence: 0.3,
  particleAudioLift: 0.5,
  sdfEnabled: false,
  sdfShape: 0,
  sdfScale: 0,
  sdfEdge: 0,
  sdfGlow: 0,
  sdfRotation: 0,
  sdfFill: 0,
  sdfColor: [1.0, 0.6, 0.25],
  gravityPositions: new Float32Array(16),
  gravityStrengths: new Float32Array(8),
  gravityPolarities: new Float32Array(8),
  gravityActives: new Float32Array(8),
  gravityCollapse: 0,
  roleWeights: {
    core: 1,
    support: 1,
    atmosphere: 1
  },
  shapeBurstSpawnTimes: new Float32Array(8),
  shapeBurstActives: new Float32Array(8),
  milkDropShaderData: null,
  genUniforms: {}
};

const channel = new BroadcastChannel('visualsynth-output');
let lastMessageAt = 0;

channel.onmessage = (event) => {
  lastMessageAt = performance.now();
  diag.messageCount += 1;
  const data = event.data as Partial<RenderState> & {
    layerAssets?: Partial<Record<AssetLayerId, SerializedOutputAsset | null>>;
    shaderVariant?: OutputShaderVariantPayload;
    transition?: OutputTransitionPayload | null;
  };

  // Auto-sync all standard RenderState fields
  syncRenderState(data, state);

  if (data.transition) {
    lastTransition = data.transition;
    recentTransitions.push(data.transition);
    if (recentTransitions.length > MAX_RECENT_TRANSITIONS) {
      recentTransitions.shift();
    }
  }
  if (data.shaderVariant) {
    lastShaderVariant = data.shaderVariant;
  }

  // Handle special broadcast-only fields (palette, generators, assets, overlays)
  if (Array.isArray((data as any).paletteColors) && renderer?.setPalette) {
    const colors = (data as any).paletteColors as string[];
    if (colors.length >= 5) {
      renderer.setPalette(colors.slice(0, 5) as [string, string, string, string, string]);
    }
  }
  if (Array.isArray((data as any).activeGeneratorIds)) {
    applyGeneratorIds((data as any).activeGeneratorIds as string[], data.shaderVariant);
  }
  if (data.layerAssets) {
    (Object.keys(data.layerAssets) as AssetLayerId[]).forEach((layerId) => {
      const asset = data.layerAssets?.[layerId] ?? null;
      const nextId = asset?.id ?? null;
      const assetKey =
        asset?.kind === 'text'
          ? `${asset.id}-${asset.options?.text ?? ''}-${asset.options?.font ?? ''}-${asset.options?.fontColor ?? ''}`
          : asset?.id ?? null;
      if (layerAssetIds[layerId] === nextId && layerAssetKeys[layerId] === assetKey) return;

      cleanupLayerVideo(layerId);
      layerAssetIds[layerId] = nextId;
      layerAssetKeys[layerId] = assetKey;

      const textCanvas = asset?.kind === 'text' ? getTextCanvas(asset) ?? undefined : undefined;

      if (asset?.kind === 'live') {
        createLiveVideoElement(asset).then((videoElement) => {
          layerVideoElements[layerId] = videoElement;
          void videoElement.play().catch(() => undefined);
          renderer.setLayerAsset(layerId, asset as any, videoElement, textCanvas);
          diag.logEvent('asset-bound', `${layerId} live`);
        });
      } else if (asset?.kind === 'video') {
        const videoElement = createVideoElement(asset);
        layerVideoElements[layerId] = videoElement;
        void videoElement.play().catch(() => undefined);
        renderer.setLayerAsset(layerId, asset as any, videoElement, textCanvas);
        diag.logEvent('asset-bound', `${layerId} video`);
      } else {
        renderer.setLayerAsset(layerId, asset as any, undefined, textCanvas);
        if (asset) diag.logEvent('asset-bound', `${layerId} ${asset.kind}`);
      }
    });
  }
  if (Array.isArray((data as any).overlays)) {
    outputOverlays = (data as any).overlays as OverlayConfig[];
  }
};

// Stale-message watchdog: warn when no message received for 3+ seconds while
// rendering.  This disambiguates "render loop alive but channel died" from
// "render loop died".
const MESSAGE_STALE_THRESHOLD_MS = 3000;
let lastStaleWarningAt = 0;

const checkMessageStaleness = (now: number) => {
  if (lastMessageAt === 0) return; // never received any — not started yet
  if (now - lastMessageAt > MESSAGE_STALE_THRESHOLD_MS) {
    if (now - lastStaleWarningAt > MESSAGE_STALE_THRESHOLD_MS) {
      lastStaleWarningAt = now;
      diag.logEvent('message-stale', `${Math.round(now - lastMessageAt)}ms since last message`);
    }
  }
};

// Blank-for-too-long protective fallback: after 8 seconds of confirmed blank
// output, inform the main control program so it can show a visual indicator.
const BLANK_FALLBACK_THRESHOLD_MS = 8000;
let fallbackActive = false;
let lastFallbackBroadcastAt = 0;

const updateFallbackState = (now: number) => {
  const blankDuration = diag.isCurrentlyBlank && diag.lastGoodFrameMs > 0
    ? now - diag.lastGoodFrameMs
    : 0;

  const isDegraded = blankDuration > BLANK_FALLBACK_THRESHOLD_MS;

  // Broadcast whenever state changes, OR every second if degraded (to update timer)
  if (isDegraded !== fallbackActive || (isDegraded && now - lastFallbackBroadcastAt > 1000)) {
    if (isDegraded && !fallbackActive) {
      diag.logEvent('fallback-triggered', `blank for ${Math.round(blankDuration)}ms`);
      console.warn(`[Output] DEGRADED — blank output for ${Math.round(blankDuration / 1000)}s`);
    }

    fallbackActive = isDegraded;
    lastFallbackBroadcastAt = now;

    channel.postMessage({
      type: 'output-health',
      isCurrentlyBlank: diag.isCurrentlyBlank,
      blankDurationMs: blankDuration,
      isDegraded: fallbackActive
    });
  }
};

let lastDebugUpdate = 0;
let frameCount = 0;
let lastVariantMismatchKey = '';

const render = (time: number) => {
  const now = performance.now();
  const didResize = resizeCanvasToDisplaySize(canvas);
  if (didResize) {
    diag.logEvent('canvas-resize', `${canvas.width}x${canvas.height}`);
    lastCanvasWidth  = canvas.width;
    lastCanvasHeight = canvas.height;
  }

  renderer.render({
    ...state,
    timeMs: Number.isFinite(state.timeMs) ? state.timeMs : time
  });
  diag.drawCallCount += 1;
  const renderSnapshot = renderer?.getLastRenderSnapshot?.() ?? null;
  if (
    lastShaderVariant?.key &&
    renderSnapshot?.shaderVariantKey &&
    lastShaderVariant.key !== renderSnapshot.shaderVariantKey
  ) {
    const mismatchKey = `${lastShaderVariant.key}=>${renderSnapshot.shaderVariantKey}`;
    if (mismatchKey !== lastVariantMismatchKey) {
      lastVariantMismatchKey = mismatchKey;
      diag.logEvent(
        'draw-call-skipped',
        `shader-variant-mismatch expected=${lastShaderVariant.key} actual=${renderSnapshot.shaderVariantKey}`
      );
    }
  } else {
    lastVariantMismatchKey = '';
  }

  outputOverlayRenderer.draw();
  frameCount += 1;
  diag.frameCount += 1;

  // --- Frame watchdog: periodically sample pixels ---
  if (gl && diag.shouldSample()) {
    const metrics = diag.sampleFrame(gl, canvas);

    // On blank detection, emit a forensic snapshot (throttled)
    if (diag.isCurrentlyBlank) {
      const snap = diag.captureForensicSnapshot({
        activeGenerators: lastActiveGeneratorIds,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        lastMessageAgeMs: lastMessageAt ? now - lastMessageAt : -1,
        messageCount: diag.messageCount,
        lastShaderError: renderer?.getLastShaderError?.() ?? null,
        contextLost: renderer?.isContextLost?.() ?? false,
        programCacheSize: renderer?.getProgramCacheSize?.() ?? -1,
      });
      if (snap) {
        console.warn('[Output] Blank frame detected — forensic snapshot:', {
          ...snap,
          transition: lastTransition,
          shaderVariant: lastShaderVariant,
          renderSnapshot
        });
        console.table(snap.recentEvents);
      }
    }
  }

  // --- Stale message / fallback checks ---
  checkMessageStaleness(now);
  updateFallbackState(now);

  // --- Debug overlay update (every 500 ms) ---
  if (debugOverlay && now - lastDebugUpdate > 500) {
    lastDebugUpdate = now;
    const ageMs = lastMessageAt ? Math.round(now - lastMessageAt) : -1;
    const rect = canvas.getBoundingClientRect();
    if (debugVisible) {
      const cacheSize = renderer?.getProgramCacheSize?.() ?? '?';
      debugOverlay.textContent =
        `Output Debug\n` +
        `Canvas: ${canvas.width}x${canvas.height} (display ${Math.round(rect.width)}x${Math.round(rect.height)})\n` +
        `Frames: ${frameCount}  DrawCalls: ${diag.drawCallCount}\n` +
        `Messages: ${diag.messageCount}  Last: ${ageMs >= 0 ? ageMs + 'ms' : 'never'}\n` +
        `Generators (${lastActiveGeneratorIds.length}): ${lastActiveGeneratorIds.join(', ') || 'none'}\n` +
        `Transition: ${lastTransition ? `#${lastTransition.seq} ${lastTransition.prevSceneName ?? '—'} -> ${lastTransition.nextSceneName} (${lastTransition.source})` : 'none'}\n` +
        `Variant: ${lastShaderVariant?.sceneId ?? 'none'}\n` +
        `ProgramCache: ${cacheSize}\n` +
        `\n` +
        diag.getDebugText() +
        `\n\nPress D to hide  |  __outputDump() to dump forensics`;
    }
  }

  requestAnimationFrame(render);
};

requestAnimationFrame(render);

window.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() !== 'd') return;
  debugVisible = !debugVisible;
  if (debugOverlay) {
    debugOverlay.classList.toggle('hidden', !debugVisible);
  }
});
