import { fitBpmToRange } from '../../shared/bpm';
import type { Store } from '../state/store';
import { actions } from '../state/actions';
import { setStatus } from '../state/events';

export interface AudioEngine {
  initDevices: (select: HTMLSelectElement) => Promise<void>;
  setup: (deviceId?: string) => Promise<void>;
  update: (deltaMs: number) => void;
  initModulators: () => void;
  getContext: () => AudioContext | null;
  getActiveBpm: () => number;
}

export const createAudioEngine = (store: Store): AudioEngine => {
  let audioContext: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let mediaStream: MediaStream | null = null;
  let lastTempoEstimateTime = 0;
  let fluxPrev = 0;
  let fluxPrevPrev = 0;
  let fluxPrevTime = 0;
  let fluxHistory: { time: number; value: number }[] = [];
  let onsetTimes: number[] = [];
  let spectrumPrev: Float32Array | null = null;

  const initDevices = async (select: HTMLSelectElement) => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const inputs = devices.filter((device) => device.kind === 'audioinput');
    select.innerHTML = '';
    inputs.forEach((device, index) => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.textContent = device.label || `Input ${index + 1}`;
      select.appendChild(option);
    });
  };

  const setup = async (deviceId?: string) => {
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
    }
    audioContext?.close();

    try {
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
    } catch (error) {
      analyser = null;
      audioContext = null;
      actions.addSafeModeReason(store, 'Audio input unavailable');
      setStatus('Audio input unavailable. Safe mode enabled.');
    }
  };

  const initModulators = () => {
    const state = store.getState();
    state.modulators.lfoPhases = state.project.lfos.map((lfo) => lfo.phase ?? 0);
    state.modulators.envStates = state.project.envelopes.map(() => ({
      stage: 'idle',
      value: 0,
      holdLeft: 0,
      triggerArmed: true
    }));
    state.modulators.shStates = state.project.sampleHold.map(() => ({
      timer: 0,
      value: Math.random(),
      target: Math.random()
    }));
  };

  const updateAnalysis = () => {
    if (!analyser) return;
    const bufferLength = analyser.frequencyBinCount;
    const data = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(data);
    const timeData = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(timeData);

    let sum = 0;
    let peak = 0;
    for (let i = 0; i < bufferLength; i += 1) {
      const value = data[i] / 255;
      sum += value * value;
      if (value > peak) peak = value;
    }
    const rms = Math.sqrt(sum / bufferLength);
    const audioState = store.getState().audio;
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
    for (let i = 0; i < audioState.waveform.length; i += 1) {
      const sample = timeData[Math.floor((i / audioState.waveform.length) * timeData.length)];
      audioState.waveform[i] = (sample - 128) / 128;
    }

    const now = performance.now();
    if (!spectrumPrev || spectrumPrev.length !== bufferLength) {
      spectrumPrev = new Float32Array(bufferLength);
    }
    let flux = 0;
    for (let i = 0; i < bufferLength; i += 1) {
      const value = data[i] / 255;
      const delta = value - spectrumPrev[i];
      if (delta > 0) flux += delta;
      spectrumPrev[i] = value;
    }
    fluxHistory.push({ time: now, value: flux });
    fluxHistory = fluxHistory.filter((entry) => now - entry.time < 1000);

    const mean =
      fluxHistory.reduce((sumEntry, entry) => sumEntry + entry.value, 0) /
      Math.max(1, fluxHistory.length);
    const variance =
      fluxHistory.reduce((sumEntry, entry) => sumEntry + (entry.value - mean) ** 2, 0) /
      Math.max(1, fluxHistory.length);
    const std = Math.sqrt(variance);
    const threshold = mean + std * 1.5;

    if (fluxPrev > fluxPrevPrev && fluxPrev > flux && fluxPrev > threshold) {
      onsetTimes.push(fluxPrevTime);
      onsetTimes = onsetTimes.filter((time) => now - time < 8000);
      store.getState().runtime.glyphBeatPulse = 1;
    }
    fluxPrevPrev = fluxPrev;
    fluxPrev = flux;
    fluxPrevTime = now;

    if (now - lastTempoEstimateTime > 500 && onsetTimes.length >= 4) {
      const intervals: number[] = [];
      for (let i = 1; i < onsetTimes.length; i += 1) {
        intervals.push(onsetTimes[i] - onsetTimes[i - 1]);
      }
      const histogram = new Map<number, number>();
      for (const interval of intervals) {
        const bpm = 60000 / interval;
        const fitted = fitBpmToRange(bpm, store.getState().bpm.range);
        if (!fitted) continue;
        const rounded = Math.round(fitted);
        histogram.set(rounded, (histogram.get(rounded) ?? 0) + 1);
      }
      let bestBpm: number | null = null;
      let bestScore = 0;
      for (const [bpm, score] of histogram) {
        if (score > bestScore) {
          bestScore = score;
          bestBpm = bpm;
        }
      }
      if (bestBpm) {
        const current = store.getState().bpm.autoBpm;
        actions.setAutoBpm(store, current ? current * 0.85 + bestBpm * 0.15 : bestBpm);
      }
      lastTempoEstimateTime = now;
    }
  };

  const lfoValueForShape = (phase: number, shape: 'sine' | 'triangle' | 'saw' | 'square') => {
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
  };

  const updateEnvelopes = (dt: number) => {
    const state = store.getState();
    state.project.envelopes.forEach((env, index) => {
      const envState = state.modulators.envStates[index];
      if (!envState) return;

      const triggerValue =
        env.trigger === 'audio.peak'
          ? state.audio.peak
          : env.trigger === 'strobe'
            ? state.runtime.strobeIntensity
            : 0;
      if (env.trigger !== 'manual') {
        if (triggerValue >= env.threshold && envState.triggerArmed) {
          envState.stage = 'attack';
          envState.value = 0;
          envState.holdLeft = env.hold;
          envState.triggerArmed = false;
        }
        if (triggerValue < env.threshold * 0.6) {
          envState.triggerArmed = true;
        }
      }

      const attack = Math.max(env.attack, 0.001);
      const decay = Math.max(env.decay, 0.001);
      const release = Math.max(env.release, 0.001);

      if (envState.stage === 'attack') {
        envState.value += dt / attack;
        if (envState.value >= 1) {
          envState.value = 1;
          envState.stage = 'decay';
        }
        return;
      }
      if (envState.stage === 'decay') {
        envState.value -= dt * (1 - env.sustain) / decay;
        if (envState.value <= env.sustain) {
          envState.value = env.sustain;
          envState.stage = 'sustain';
        }
        return;
      }
      if (envState.stage === 'sustain') {
        if (envState.holdLeft > 0) {
          envState.holdLeft -= dt;
        } else {
          envState.stage = 'release';
        }
        return;
      }
      if (envState.stage === 'release') {
        envState.value -= dt * env.sustain / release;
        if (envState.value <= 0) {
          envState.value = 0;
          envState.stage = 'idle';
        }
      }
    });
  };

  const updateSampleHold = (dt: number, bpm: number) => {
    const state = store.getState();
    state.project.sampleHold.forEach((sh, index) => {
      const shState = state.modulators.shStates[index];
      if (!shState) return;
      const rateHz = sh.sync ? Math.max(bpm / 60 / Math.max(sh.rate, 0.05), 0.1) : Math.max(sh.rate, 0.05);
      const interval = 1 / rateHz;
      shState.timer += dt;
      if (shState.timer >= interval) {
        shState.timer = 0;
        shState.target = Math.random();
      }
      const smoothing = Math.min(Math.max(sh.smooth, 0), 1);
      shState.value += (shState.target - shState.value) * (1 - Math.exp(-dt * (2 + smoothing * 8)));
    });
  };

  const updateLfos = (dt: number, bpm: number) => {
    const state = store.getState();
    state.project.lfos.forEach((lfo, index) => {
      const rateHz = lfo.sync ? Math.max(bpm / 60 / Math.max(lfo.rate, 0.05), 0.1) : Math.max(lfo.rate, 0.05);
      state.modulators.lfoPhases[index] = (state.modulators.lfoPhases[index] + dt * rateHz) % 1;
    });
  };

  const update = (deltaMs: number) => {
    updateAnalysis();
    const bpm = getActiveBpm();
    if (store.getState().transport.isPlaying) {
      const dt = deltaMs * 0.001;
      updateLfos(dt, bpm);
      updateEnvelopes(dt);
      updateSampleHold(dt, bpm);
    }
  };

  const getActiveBpm = () => {
    const state = store.getState();
    if (state.bpm.source === 'network' && state.bpm.networkBpm) return state.bpm.networkBpm;
    if (state.bpm.source === 'auto' && state.bpm.autoBpm) return state.bpm.autoBpm;
    return state.bpm.manualBpm || 120;
  };

  return {
    initDevices,
    setup,
    update,
    initModulators,
    getContext: () => audioContext,
    getActiveBpm
  };
};
