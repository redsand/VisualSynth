import { createGLRenderer, RenderState, resizeCanvasToDisplaySize } from './glRenderer';
import type { AssetItem, OverlayConfig } from '../shared/project';
import { createSafeModeRenderer } from './safeModeRenderer';
import { createOverlayRenderer } from './overlayRenderer';
import { syncRenderState } from './render/autoSync';
import type { SerializedOutputAsset } from './render/outputPayload';

const canvas = document.getElementById('output-canvas') as HTMLCanvasElement;
const outputOverlayCanvas = document.getElementById('output-overlay-canvas') as HTMLCanvasElement;
const debugOverlay = document.getElementById('output-debug') as HTMLDivElement | null;
let debugVisible = false;
let renderer: ReturnType<typeof createGLRenderer>;
type AssetLayerId = 'layer-plasma' | 'layer-spectrum' | 'layer-media';
const layerAssetIds: Partial<Record<AssetLayerId, string | null>> = {};
const layerAssetKeys: Partial<Record<AssetLayerId, string | null>> = {};

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

try {
  renderer = createGLRenderer(canvas, {});
} catch (error) {
  if (debugOverlay) {
    debugOverlay.textContent = error instanceof Error ? error.message : 'WebGL2 not supported.';
    debugOverlay.classList.remove('hidden');
  }
  renderer = createSafeModeRenderer(canvas, 'Safe mode: Output WebGL2 unavailable');
}

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
let messageCount = 0;
channel.onmessage = (event) => {
  lastMessageAt = performance.now();
  messageCount += 1;
  const data = event.data as Partial<RenderState> & {
    layerAssets?: Partial<Record<AssetLayerId, SerializedOutputAsset | null>>;
  };

  // Auto-sync all standard RenderState fields
  syncRenderState(data, state);

  // Handle special broadcast-only fields (palette, generators, assets, overlays)
  if (Array.isArray((data as any).paletteColors) && renderer?.setPalette) {
    const colors = (data as any).paletteColors as string[];
    if (colors.length >= 5) {
      renderer.setPalette(colors.slice(0, 5) as [string, string, string, string, string]);
    }
  }
  if (Array.isArray((data as any).activeGeneratorIds) && renderer?.recompileForGenerators) {
    const ids = new Set((data as any).activeGeneratorIds as string[]);
    renderer.recompileForGenerators(ids);
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
      layerAssetIds[layerId] = nextId;
      layerAssetKeys[layerId] = assetKey;
      const textCanvas = asset?.kind === 'text' ? getTextCanvas(asset) ?? undefined : undefined;
      renderer.setLayerAsset(layerId, asset as any, undefined, textCanvas);
    });
  }
  if (Array.isArray((data as any).overlays)) {
    outputOverlays = (data as any).overlays as OverlayConfig[];
  }
};

let lastDebugUpdate = 0;
let frameCount = 0;
const render = (time: number) => {
  resizeCanvasToDisplaySize(canvas);
  renderer.render({
    ...state,
    timeMs: Number.isFinite(state.timeMs) ? state.timeMs : time
  });
  outputOverlayRenderer.draw();
  frameCount += 1;
  if (debugOverlay) {
    const now = performance.now();
    if (now - lastDebugUpdate > 500) {
      lastDebugUpdate = now;
      const ageMs = lastMessageAt ? Math.round(now - lastMessageAt) : -1;
      const rect = canvas.getBoundingClientRect();
      if (debugVisible) {
        debugOverlay.textContent =
          `Output Debug\n` +
          `Size: ${Math.round(rect.width)}x${Math.round(rect.height)}\n` +
          `Frames: ${frameCount}\n` +
          `Messages: ${messageCount}\n` +
          `Last msg: ${ageMs >= 0 ? ageMs + 'ms' : 'never'}`;
      }
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
