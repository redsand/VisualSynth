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
  spectrum: new Float32Array(64)
};

const channel = new BroadcastChannel('visualsynth-output');
channel.onmessage = (event) => {
  const data = event.data as Partial<RenderState> & { spectrum?: Float32Array };
  if (typeof data.rms === 'number') state.rms = data.rms;
  if (typeof data.peak === 'number') state.peak = data.peak;
  if (typeof data.strobe === 'number') state.strobe = data.strobe;
  if (typeof data.plasmaEnabled === 'boolean') state.plasmaEnabled = data.plasmaEnabled;
  if (typeof data.spectrumEnabled === 'boolean') state.spectrumEnabled = data.spectrumEnabled;
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
