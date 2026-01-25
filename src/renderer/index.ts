import { DEFAULT_PROJECT, VisualSynthProject } from '../shared/project';
import { projectSchema } from '../shared/projectSchema';

declare global {
  interface Window {
    visualSynth: {
      saveProject: (payload: string) => Promise<{ canceled: boolean; filePath?: string }>;
      openProject: () => Promise<{ canceled: boolean; project?: VisualSynthProject; error?: string }>;
      listPresets: () => Promise<{ name: string; path: string }[]>;
      loadPreset: (presetPath: string) => Promise<{ project?: VisualSynthProject; error?: string }>;
      listNodeMidi: () => Promise<{ index: number; name: string }[]>;
      openNodeMidi: (portIndex: number) => Promise<{ opened: boolean; error?: string }>;
      onNodeMidiMessage: (handler: (message: number[]) => void) => void;
    };
  }
}

const audioSelect = document.getElementById('audio-device') as HTMLSelectElement;
const midiSelect = document.getElementById('midi-device') as HTMLSelectElement;
const toggleMidiButton = document.getElementById('toggle-midi') as HTMLButtonElement;
const saveButton = document.getElementById('btn-save') as HTMLButtonElement;
const loadButton = document.getElementById('btn-load') as HTMLButtonElement;
const presetSelect = document.getElementById('preset-select') as HTMLSelectElement;
const applyPresetButton = document.getElementById('btn-apply-preset') as HTMLButtonElement;
const plasmaToggle = document.getElementById('layer-plasma') as HTMLInputElement;
const spectrumToggle = document.getElementById('layer-spectrum') as HTMLInputElement;
const statusLabel = document.getElementById('status') as HTMLDivElement;
const padGrid = document.getElementById('pad-grid') as HTMLDivElement;
const advancedPanel = document.getElementById('advanced-panel') as HTMLDivElement;
const toggleMode = document.getElementById('toggle-mode') as HTMLButtonElement;

const fpsLabel = document.getElementById('diag-fps') as HTMLDivElement;
const latencyLabel = document.getElementById('diag-latency') as HTMLDivElement;

let currentProject: VisualSynthProject = DEFAULT_PROJECT;
let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let mediaStream: MediaStream | null = null;
let midiAccess: MIDIAccess | null = null;
let strobeIntensity = 0;
let strobeDecay = 0.92;
let isAdvanced = true;

const audioState = {
  rms: 0,
  peak: 0,
  bands: new Array(8).fill(0),
  spectrum: new Float32Array(64)
};

const padStates = Array.from({ length: 64 }, () => false);

const setStatus = (message: string) => {
  statusLabel.textContent = message;
};

const initPads = () => {
  padGrid.innerHTML = '';
  padStates.forEach((_state, index) => {
    const pad = document.createElement('div');
    pad.className = 'pad';
    pad.dataset.index = String(index);
    const label = document.createElement('div');
    label.className = 'pad-label';
    label.textContent = String(index + 1);
    pad.appendChild(label);
    pad.addEventListener('click', () => handlePadTrigger(index, 1));
    padGrid.appendChild(pad);
  });
};

const updatePadUI = (index: number, active: boolean) => {
  const pad = padGrid.querySelector(`[data-index="${index}"]`);
  if (pad) {
    pad.classList.toggle('active', active);
  }
};

const handlePadTrigger = (index: number, velocity: number) => {
  if (index < 32) {
    padStates[index] = !padStates[index];
    updatePadUI(index, padStates[index]);
    plasmaToggle.checked = padStates[index];
  } else {
    strobeIntensity = Math.max(strobeIntensity, velocity);
    updatePadUI(index, true);
    setTimeout(() => updatePadUI(index, false), 120);
  }
};

const initAudioDevices = async () => {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const inputs = devices.filter((device) => device.kind === 'audioinput');
  audioSelect.innerHTML = '';
  inputs.forEach((device, index) => {
    const option = document.createElement('option');
    option.value = device.deviceId;
    option.textContent = device.label || `Input ${index + 1}`;
    audioSelect.appendChild(option);
  });
};

const setupAudio = async (deviceId?: string) => {
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
  }
  audioContext?.close();

  audioContext = new AudioContext({ latencyHint: 'interactive' });
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: deviceId ? { deviceId: { exact: deviceId } } : true
  });
  mediaStream = stream;
  const source = audioContext.createMediaStreamSource(stream);
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.7;
  source.connect(analyser);
  latencyLabel.textContent = `Audio Latency: ${Math.round(audioContext.baseLatency * 1000)}ms`;
};

const updateAudioAnalysis = () => {
  if (!analyser) return;
  const bufferLength = analyser.frequencyBinCount;
  const data = new Uint8Array(bufferLength);
  analyser.getByteFrequencyData(data);

  let sum = 0;
  let peak = 0;
  for (let i = 0; i < bufferLength; i += 1) {
    const value = data[i] / 255;
    sum += value * value;
    if (value > peak) peak = value;
  }
  const rms = Math.sqrt(sum / bufferLength);
  audioState.rms = rms;
  audioState.peak = peak;

  const bandSize = Math.floor(bufferLength / 8);
  for (let band = 0; band < 8; band += 1) {
    let bandSum = 0;
    for (let i = 0; i < bandSize; i += 1) {
      bandSum += data[band * bandSize + i] / 255;
    }
    audioState.bands[band] = bandSum / bandSize;
  }

  for (let i = 0; i < 64; i += 1) {
    const index = Math.floor((i / 64) * bufferLength);
    audioState.spectrum[i] = data[index] / 255;
  }
};

const setupMIDI = async () => {
  try {
    midiAccess = await navigator.requestMIDIAccess();
    const inputs = Array.from(midiAccess.inputs.values());
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
    const inputId = midiSelect.value;
    const input = Array.from(midiAccess.inputs.values()).find((item) => item.id === inputId);
    if (!input) return;
    input.onmidimessage = (event) => handleMidiMessage(Array.from(event.data));
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
    window.visualSynth.onNodeMidiMessage((message) => handleMidiMessage(message));
  }
};

const handleMidiMessage = (message: number[]) => {
  const [status, data1, data2] = message;
  const messageType = status & 0xf0;
  if (messageType === 0x90 && data2 > 0) {
    handlePadTrigger(data1 % 64, data2 / 127);
  }
  if (messageType === 0xb0) {
    // CC mapping placeholder
  }
};

const serializeProject = () => {
  const now = new Date().toISOString();
  currentProject = {
    ...currentProject,
    updatedAt: now,
    scenes: currentProject.scenes.map((scene) => ({
      ...scene,
      layers: scene.layers.map((layer) => {
        if (layer.id === 'layer-plasma') {
          return { ...layer, enabled: plasmaToggle.checked };
        }
        if (layer.id === 'layer-spectrum') {
          return { ...layer, enabled: spectrumToggle.checked };
        }
        return layer;
      })
    }))
  };
  return JSON.stringify(currentProject, null, 2);
};

const applyProject = (project: VisualSynthProject) => {
  const parsed = projectSchema.safeParse(project);
  if (!parsed.success) {
    setStatus('Invalid project loaded.');
    return;
  }
  currentProject = parsed.data;
  const scene = currentProject.scenes.find((item) => item.id === currentProject.activeSceneId);
  if (scene) {
    const plasma = scene.layers.find((layer) => layer.id === 'layer-plasma');
    const spectrum = scene.layers.find((layer) => layer.id === 'layer-spectrum');
    plasmaToggle.checked = plasma?.enabled ?? true;
    spectrumToggle.checked = spectrum?.enabled ?? true;
  }
  setStatus(`Loaded project: ${currentProject.name}`);
};

saveButton.addEventListener('click', async () => {
  const payload = serializeProject();
  await window.visualSynth.saveProject(payload);
});

loadButton.addEventListener('click', async () => {
  const result = await window.visualSynth.openProject();
  if (!result.canceled && result.project) {
    applyProject(result.project);
  }
});

applyPresetButton.addEventListener('click', async () => {
  const presetPath = presetSelect.value;
  const result = await window.visualSynth.loadPreset(presetPath);
  if (result.project) {
    applyProject(result.project);
  }
});

plasmaToggle.addEventListener('change', () => {
  setStatus(`Plasma ${plasmaToggle.checked ? 'enabled' : 'disabled'}`);
});

spectrumToggle.addEventListener('change', () => {
  setStatus(`Spectrum ${spectrumToggle.checked ? 'enabled' : 'disabled'}`);
});

audioSelect.addEventListener('change', async () => {
  await setupAudio(audioSelect.value);
});

toggleMidiButton.addEventListener('click', async () => {
  await startMidiInput();
});

toggleMode.addEventListener('click', () => {
  isAdvanced = !isAdvanced;
  advancedPanel.classList.toggle('hidden', !isAdvanced);
  toggleMode.textContent = isAdvanced ? 'Advanced' : 'Simple';
});

const initPresets = async () => {
  const presets = await window.visualSynth.listPresets();
  presetSelect.innerHTML = '';
  presets.forEach((preset) => {
    const option = document.createElement('option');
    option.value = preset.path;
    option.textContent = preset.name;
    presetSelect.appendChild(option);
  });
};

const initShortcuts = () => {
  window.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.key.toLowerCase() === 's') {
      event.preventDefault();
      void saveButton.click();
    }
    if (event.ctrlKey && event.key.toLowerCase() === 'o') {
      event.preventDefault();
      void loadButton.click();
    }
    if (event.key.toLowerCase() === 'f') {
      document.documentElement.requestFullscreen().catch(() => undefined);
    }
    if (event.key.toLowerCase() === 'r') {
      setStatus('Recording toggle placeholder.');
    }
    if (event.code === 'Space') {
      setStatus('Tempo play/pause placeholder.');
    }
  });
};

const canvas = document.getElementById('gl-canvas') as HTMLCanvasElement;
const gl = canvas.getContext('webgl2');

if (!gl) {
  setStatus('WebGL2 not supported.');
  throw new Error('WebGL2 required');
}

const vertexShaderSrc = `#version 300 es
in vec2 position;
out vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const fragmentShaderSrc = `#version 300 es
precision highp float;

uniform float uTime;
uniform float uRms;
uniform float uPeak;
uniform float uStrobe;
uniform float uPlasmaEnabled;
uniform float uSpectrumEnabled;
uniform float uSpectrum[64];

in vec2 vUv;
out vec4 outColor;

float plasma(vec2 uv, float t) {
  float v = sin(uv.x * 8.0 + t) + sin(uv.y * 6.0 - t * 1.1);
  v += sin((uv.x + uv.y) * 4.0 + t * 0.7);
  return v * 0.5 + 0.5;
}

void main() {
  vec2 uv = vUv;
  vec3 color = vec3(0.02, 0.04, 0.08);
  if (uPlasmaEnabled > 0.5) {
    float p = plasma(uv, uTime);
    color += vec3(0.1 + p * 0.4, 0.2 + p * 0.5, 0.3 + p * 0.6);
  }

  if (uSpectrumEnabled > 0.5) {
    float band = floor(uv.x * 64.0);
    int index = int(clamp(band, 0.0, 63.0));
    float amp = uSpectrum[index];
    float bar = step(uv.y, amp);
    color += vec3(0.1, 0.6, 1.0) * bar * 0.8;
  }

  float flash = uStrobe * 1.5;
  color += vec3(flash);
  color += vec3(uPeak * 0.2, uRms * 0.5, uRms * 0.8);

  outColor = vec4(color, 1.0);
}`;

const compileShader = (type: number, source: string) => {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Shader creation failed');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) || 'Shader compile error');
  }
  return shader;
};

const vertexShader = compileShader(gl.VERTEX_SHADER, vertexShaderSrc);
const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentShaderSrc);

const program = gl.createProgram();
if (!program) throw new Error('Program creation failed');

gl.attachShader(program, vertexShader);

gl.attachShader(program, fragmentShader);

gl.linkProgram(program);

if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
  throw new Error(gl.getProgramInfoLog(program) || 'Program link error');
}

gl.useProgram(program);

const positionBuffer = gl.createBuffer();
if (!positionBuffer) throw new Error('Buffer creation failed');

gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
const vertices = new Float32Array([
  -1, -1,
  1, -1,
  -1, 1,
  -1, 1,
  1, -1,
  1, 1
]);

gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
const positionLocation = gl.getAttribLocation(program, 'position');

gl.enableVertexAttribArray(positionLocation);

gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

const timeLocation = gl.getUniformLocation(program, 'uTime');
const rmsLocation = gl.getUniformLocation(program, 'uRms');
const peakLocation = gl.getUniformLocation(program, 'uPeak');
const strobeLocation = gl.getUniformLocation(program, 'uStrobe');
const plasmaLocation = gl.getUniformLocation(program, 'uPlasmaEnabled');
const spectrumLocation = gl.getUniformLocation(program, 'uSpectrumEnabled');
const spectrumArrayLocation = gl.getUniformLocation(program, 'uSpectrum');

let lastTime = performance.now();
let fpsAccumulator = 0;
let frameCount = 0;

const render = (time: number) => {
  const delta = time - lastTime;
  lastTime = time;
  fpsAccumulator += delta;
  frameCount += 1;
  if (fpsAccumulator > 1000) {
    const fps = Math.round((frameCount / fpsAccumulator) * 1000);
    fpsLabel.textContent = `FPS: ${fps}`;
    fpsAccumulator = 0;
    frameCount = 0;
  }

  updateAudioAnalysis();
  strobeIntensity *= strobeDecay;

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0.02, 0.03, 0.06, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(program);
  gl.uniform1f(timeLocation, time * 0.001);
  gl.uniform1f(rmsLocation, audioState.rms);
  gl.uniform1f(peakLocation, audioState.peak);
  gl.uniform1f(strobeLocation, strobeIntensity);
  gl.uniform1f(plasmaLocation, plasmaToggle.checked ? 1 : 0);
  gl.uniform1f(spectrumLocation, spectrumToggle.checked ? 1 : 0);
  if (spectrumArrayLocation) {
    gl.uniform1fv(spectrumArrayLocation, audioState.spectrum);
  }

  gl.drawArrays(gl.TRIANGLES, 0, 6);

  requestAnimationFrame(render);
};

const init = async () => {
  initPads();
  initShortcuts();
  await initPresets();
  await initAudioDevices();
  await setupAudio();
  await setupMIDI();
  requestAnimationFrame(render);
};

void init();
