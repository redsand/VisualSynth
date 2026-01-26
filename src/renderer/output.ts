import { createGLRenderer, RenderState, resizeCanvasToDisplaySize } from './glRenderer';

const canvas = document.getElementById('output-canvas') as HTMLCanvasElement;
let renderer: ReturnType<typeof createGLRenderer>;

try {
  renderer = createGLRenderer(canvas);
} catch (error) {
  document.body.textContent = 'WebGL2 not supported.';
  throw error;
}

const state: RenderState = {
  timeMs: 0,
  rms: 0,
  peak: 0,
  strobe: 0,
  plasmaEnabled: true,
  spectrumEnabled: true,
  spectrum: new Float32Array(64),
  contrast: 1,
  saturation: 1,
  paletteShift: 0,
  plasmaOpacity: 1,
  spectrumOpacity: 1,
  plasmaAssetBlendMode: 3,
  plasmaAssetAudioReact: 0.6,
  spectrumAssetBlendMode: 1,
  spectrumAssetAudioReact: 0.8,
  effectsEnabled: true,
  bloom: 0.2,
  blur: 0,
  chroma: 0.1,
  posterize: 0,
  kaleidoscope: 0,
  feedback: 0,
  persistence: 0,
  trailSpectrum: new Float32Array(64),
  particlesEnabled: true,
  particleDensity: 0.35,
  particleSpeed: 0.3,
  particleSize: 0.45,
  particleGlow: 0.6,
  sdfEnabled: true,
  sdfShape: 0,
  sdfScale: 0.45,
  sdfEdge: 0.08,
  sdfGlow: 0.5,
  sdfRotation: 0,
  sdfFill: 0.35
};

const channel = new BroadcastChannel('visualsynth-output');
channel.onmessage = (event) => {
  const data = event.data as Partial<RenderState> & { spectrum?: Float32Array };
  if (typeof data.rms === 'number') state.rms = data.rms;
  if (typeof data.peak === 'number') state.peak = data.peak;
  if (typeof data.strobe === 'number') state.strobe = data.strobe;
  if (typeof data.plasmaEnabled === 'boolean') state.plasmaEnabled = data.plasmaEnabled;
  if (typeof data.spectrumEnabled === 'boolean') state.spectrumEnabled = data.spectrumEnabled;
  if (typeof data.contrast === 'number') state.contrast = data.contrast;
  if (typeof data.saturation === 'number') state.saturation = data.saturation;
  if (typeof data.paletteShift === 'number') state.paletteShift = data.paletteShift;
  if (typeof data.plasmaOpacity === 'number') state.plasmaOpacity = data.plasmaOpacity;
  if (typeof data.spectrumOpacity === 'number') state.spectrumOpacity = data.spectrumOpacity;
  if (typeof data.plasmaAssetBlendMode === 'number') state.plasmaAssetBlendMode = data.plasmaAssetBlendMode;
  if (typeof data.plasmaAssetAudioReact === 'number') state.plasmaAssetAudioReact = data.plasmaAssetAudioReact;
  if (typeof data.spectrumAssetBlendMode === 'number') state.spectrumAssetBlendMode = data.spectrumAssetBlendMode;
  if (typeof data.spectrumAssetAudioReact === 'number') state.spectrumAssetAudioReact = data.spectrumAssetAudioReact;
  if (typeof data.effectsEnabled === 'boolean') state.effectsEnabled = data.effectsEnabled;
  if (typeof data.bloom === 'number') state.bloom = data.bloom;
  if (typeof data.blur === 'number') state.blur = data.blur;
  if (typeof data.chroma === 'number') state.chroma = data.chroma;
  if (typeof data.posterize === 'number') state.posterize = data.posterize;
  if (typeof data.kaleidoscope === 'number') state.kaleidoscope = data.kaleidoscope;
  if (typeof data.feedback === 'number') state.feedback = data.feedback;
  if (typeof data.persistence === 'number') state.persistence = data.persistence;
  if (typeof data.particlesEnabled === 'boolean') state.particlesEnabled = data.particlesEnabled;
  if (typeof data.particleDensity === 'number') state.particleDensity = data.particleDensity;
  if (typeof data.particleSpeed === 'number') state.particleSpeed = data.particleSpeed;
  if (typeof data.particleSize === 'number') state.particleSize = data.particleSize;
  if (typeof data.particleGlow === 'number') state.particleGlow = data.particleGlow;
  if (typeof data.sdfEnabled === 'boolean') state.sdfEnabled = data.sdfEnabled;
  if (typeof data.sdfShape === 'number') state.sdfShape = data.sdfShape;
  if (typeof data.sdfScale === 'number') state.sdfScale = data.sdfScale;
  if (typeof data.sdfEdge === 'number') state.sdfEdge = data.sdfEdge;
  if (typeof data.sdfGlow === 'number') state.sdfGlow = data.sdfGlow;
  if (typeof data.sdfRotation === 'number') state.sdfRotation = data.sdfRotation;
  if (typeof data.sdfFill === 'number') state.sdfFill = data.sdfFill;
  if (data.trailSpectrum) state.trailSpectrum = new Float32Array(data.trailSpectrum);
  if (data.spectrum) {
    state.spectrum = new Float32Array(data.spectrum);
  }
};

const render = (time: number) => {
  resizeCanvasToDisplaySize(canvas);
  renderer.render({
    ...state,
    timeMs: time
  });
  requestAnimationFrame(render);
};

requestAnimationFrame(render);
