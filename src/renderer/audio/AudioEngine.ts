import { fitBpmToRange } from '../../shared/bpm';
import type { Store } from '../state/store';
import { actions } from '../state/actions';
import { setStatus } from '../state/events';
import { createRollingAudioCapture } from './rollingAudioCapture';
import { createSongChangeDetector, SongChangeEvent } from './songChangeDetector';
import { SongDetectionDiagnostics, SongDetectionStatus } from '../../shared/songDetectionStatus';
import { NowPlayingSettings, DEFAULT_NOW_PLAYING_SETTINGS } from '../../shared/nowPlaying';
import { ENGINE_REGISTRY, EngineId } from '../../shared/engines';

export interface AudioEngine {
  initDevices: (select: HTMLSelectElement) => Promise<void>;
  setup: (deviceId?: string) => Promise<void>;
  update: (deltaMs: number) => void;
  initModulators: () => void;
  getContext: () => AudioContext | null;
  getActiveBpm: () => number;
  getState: () => {
    rms: number;
    peak: number;
    bands: number[];
    spectrum: Float32Array;
    waveform: Float32Array;
    bass: number;
    mid: number;
    treb: number;
    bassAtt: number;
    midAtt: number;
    trebAtt: number;
    energyLow: number;
    energyMid: number;
    energyHigh: number;
  };
  // Song Detection
  getSongDetectionDiagnostics: () => SongDetectionDiagnostics;
  updateNowPlayingSettings: (settings: Partial<NowPlayingSettings>) => void;
  onSongChange: (handler: (event: SongChangeEvent) => void) => void;
  getRollingAudioCapture: () => ReturnType<typeof createRollingAudioCapture>;
}

let instance: AudioEngine | null = null;

export const getAudioEngine = () => instance;

export const createAudioEngine = (store: Store): AudioEngine => {
  if (instance) return instance;
  
  let audioContext: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  // Dedicated onset analyser with no smoothing so transient flux is sharp.
  // The visual analyser above uses smoothing for stable visuals; onset
  // detection needs per-frame deltas, which smoothing flattens.
  let onsetAnalyser: AnalyserNode | null = null;
  let mediaStream: MediaStream | null = null;
  let lastTempoEstimateTime = 0;
  let fluxPrev = 0;
  let fluxPrevPrev = 0;
  let fluxPrevTime = 0;
  let fluxHistory: { time: number; value: number }[] = [];
  let onsetTimes: number[] = [];
  let spectrumPrev: Float32Array | null = null;
  let currentDeviceId: string | null = null;

  // Reusable hot-path buffers (avoid per-frame allocation / GC pressure).
  let freqBuf: Uint8Array | null = null;
  let timeBuf: Uint8Array | null = null;
  let onsetBuf: Uint8Array | null = null;

  // 8 log-spaced musical band edges (Hz). Index 0 = sub-bass, 7 = air.
  // These replace the old linear 8-bin split where "bass" spanned 0–~3 kHz.
  const BAND_EDGES_HZ = [20, 60, 150, 400, 1000, 2500, 6000, 12000, 20000];

  // Persistent slow-attacking followers for the MilkDrop "_att" idiom.
  let bassAttState = 0;
  let midAttState = 0;
  let trebAttState = 0;

  // Song Detection State
  let nowPlayingSettings: NowPlayingSettings = { ...DEFAULT_NOW_PLAYING_SETTINGS };
  let songChangeHandler: ((event: SongChangeEvent) => void) | null = null;
  const rollingAudioCapture = createRollingAudioCapture(30000);
  
  let totalDetections = 0;
  let failedDetections = 0;
  let lastSuccessAt: number | undefined;
  let lastFailureAt: number | undefined;

  let detectionStatus: SongDetectionStatus = {
    state: 'idle',
    enteredAt: Date.now(),
    lastUpdateAt: Date.now(),
    reason: 'Initial state'
  };

  const transitionTo = (state: SongDetectionStatus['state'], reason?: string, lastError?: string) => {
    if (detectionStatus.state === state && !reason && !lastError) return;
    
    detectionStatus = {
      ...detectionStatus,
      state,
      enteredAt: detectionStatus.state === state ? detectionStatus.enteredAt : Date.now(),
      lastUpdateAt: Date.now(),
      reason: reason || detectionStatus.reason,
      lastError: lastError || detectionStatus.lastError
    };

    if (lastError) {
      console.error(`[Song Detection] Error (${state}): ${lastError}${reason ? ` - ${reason}` : ''}`);
    } else {
      console.log(`[Song Detection] State: ${state}${reason ? ` (${reason})` : ''}`);
    }
  };

  const songChangeDetector = createSongChangeDetector({
    minTrackMs: nowPlayingSettings.minTrackMs,
    silenceThreshold: nowPlayingSettings.silenceThreshold,
    changeThreshold: nowPlayingSettings.changeThreshold,
    confirmWindows: nowPlayingSettings.confirmWindows,
    cooldownMs: nowPlayingSettings.cooldownMs,
    onSongChange: (event) => {
      totalDetections++;
      lastSuccessAt = Date.now();
      transitionTo('detected', 'Song change detected');
      songChangeHandler?.(event);
      
      // Return to listening after detection (cooldown is handled by detector internally, 
      // but we reflect it in our state machine too)
      setTimeout(() => {
        if (detectionStatus.state === 'detected') {
          transitionTo('listening');
        }
      }, 2000);
    }
  });

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
    currentDeviceId = deviceId || null;
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
    }
    rollingAudioCapture.stop();
    audioContext?.close();
    transitionTo('initializing', `Opening audio device: ${deviceId || 'default'}`);

    try {
      audioContext = new AudioContext({ latencyHint: 'interactive' });
      // A freshly created AudioContext can start (or fall back to) 'suspended'
      // — especially when mic permission is auto-granted without a user gesture.
      // Without resume(), getByteFrequencyData returns all zeros and reactivity
      // silently dies. Await so we never analyze a suspended context.
      if (audioContext.state === 'suspended') {
        try { await audioContext.resume(); } catch { /* resume can reject if interrupted */ }
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: deviceId ? { deviceId: { exact: deviceId } } : true
      });
      mediaStream = stream;
      const source = audioContext.createMediaStreamSource(stream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.7;
      source.connect(analyser);

      // Second analyser for onset detection: no smoothing so per-frame spectral
      // flux preserves transients (smoothing flattens kicks into long ramps).
      onsetAnalyser = audioContext.createAnalyser();
      onsetAnalyser.fftSize = 2048;
      onsetAnalyser.smoothingTimeConstant = 0;
      source.connect(onsetAnalyser);

      // Reset onset/tempo state for the new stream so stale history from a
      // previous device doesn't poison the BPM estimate.
      fluxPrev = 0;
      fluxPrevPrev = 0;
      fluxPrevTime = 0;
      fluxHistory = [];
      onsetTimes = [];
      spectrumPrev = null;
      lastTempoEstimateTime = 0;

      songChangeDetector.reset();
      rollingAudioCapture.attach(stream);
      transitionTo('listening', 'Audio input connected');
    } catch (error) {
      analyser = null;
      onsetAnalyser = null;
      audioContext = null;
      rollingAudioCapture.stop();
      songChangeDetector.reset();

      const errorMsg = (error as Error).message || 'Audio input unavailable';
      transitionTo('failed', 'Setup failed', errorMsg);
      
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
    if (!analyser || !audioContext) return;
    const bufferLength = analyser.frequencyBinCount;
    if (!freqBuf || freqBuf.length !== bufferLength) freqBuf = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(freqBuf);
    if (!timeBuf || timeBuf.length !== analyser.fftSize) timeBuf = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(timeBuf);
    const data = freqBuf;
    const timeData = timeBuf;

    const sampleRate = audioContext.sampleRate;
    const binHz = sampleRate / analyser.fftSize; // Hz per bin

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

    // 8 log-spaced musical bands (sub/bass/low-mid/mid/high-mid/presence/brilliance/air).
    // Skip bin 0 (DC, 0 Hz) — it is not audio and was previously read as "bass",
    // making reactivity track the DC offset. The old linear split made "bass"
    // span 0–~3 kHz (the entire low-mid/vocal range).
    const bandFor = (loHz: number, hiHz: number) => {
      const start = Math.max(1, Math.floor(loHz / binHz));
      const end = Math.min(bufferLength - 1, Math.ceil(hiHz / binHz));
      if (end < start) return 0;
      let s = 0;
      for (let i = start; i <= end; i += 1) s += data[i] / 255;
      return s / (end - start + 1);
    };
    for (let band = 0; band < 8; band += 1) {
      audioState.bands[band] = bandFor(BAND_EDGES_HZ[band], BAND_EDGES_HZ[band + 1]);
    }

    // Musical aggregates consumed by the render graph and Milkdrop emulation.
    const bass = (audioState.bands[0] + audioState.bands[1]) * 0.5;            // sub + bass
    const midAgg = (audioState.bands[2] + audioState.bands[3] + audioState.bands[4]) / 3; // low-mid..high-mid
    const treb = (audioState.bands[5] + audioState.bands[6] + audioState.bands[7]) / 3;  // presence..air
    audioState.bass = bass;
    audioState.mid = midAgg;
    audioState.treb = treb;

    // Slow-attacking followers — the MilkDrop "_att" idiom for slow blooms vs.
    // fast transients. Time constant ~0.3 s at 60 fps.
    const attAlpha = 1 - Math.exp(-(1 / 60) / 0.3);
    bassAttState += (bass - bassAttState) * attAlpha;
    midAttState += (midAgg - midAttState) * attAlpha;
    trebAttState += (treb - trebAttState) * attAlpha;
    audioState.bassAtt = bassAttState;
    audioState.midAtt = midAttState;
    audioState.trebAtt = trebAttState;

    // 64 log-spaced averaged spectrum buckets (20 Hz–20 kHz), excluding DC.
    // Previously this picked 64 individual single bins linearly, aliasing high
    // frequencies and reading the DC bin at index 0.
    const minHz = 20, maxHz = 20000;
    for (let i = 0; i < 64; i += 1) {
      const lo = minHz * Math.pow(maxHz / minHz, i / 64);
      const hi = minHz * Math.pow(maxHz / minHz, (i + 1) / 64);
      audioState.spectrum[i] = bandFor(lo, hi);
    }
    for (let i = 0; i < audioState.waveform.length; i += 1) {
      const sample = timeData[Math.floor((i / audioState.waveform.length) * timeData.length)];
      audioState.waveform[i] = (sample - 128) / 128;
    }

    if (nowPlayingSettings.enabled) {
      songChangeDetector.update({
        nowMs: performance.now(),
        rms: audioState.rms,
        spectrum: audioState.spectrum,
        bands: audioState.bands
      });
    }

    // Engine Grammar: Inertial Energy Accumulation — now driven by musical bands.
    const state = store.getState();
    const engine = ENGINE_REGISTRY[state.project.activeEngineId as EngineId];
    if (engine) {
      const mass = engine.grammar.mass;
      const friction = engine.grammar.friction;
      const elastic = engine.grammar.elasticity;

      const rawLow = bass;
      const rawMid = midAgg;
      const rawHigh = treb;

      const targetLow = Math.pow(rawLow, 2.0 / elastic);
      const targetMid = Math.pow(rawMid, 1.5 / elastic);
      const targetHigh = Math.pow(rawHigh, 1.0 / elastic);

      // Apply smoothing based on Mass (inertia)
      audioState.energyLow = audioState.energyLow * friction + targetLow * (1.0 - mass);
      audioState.energyMid = audioState.energyMid * friction + targetMid * (1.0 - mass);
      audioState.energyHigh = audioState.energyHigh * friction + targetHigh * (1.0 - mass);
    } else {
      audioState.energyLow = audioState.rms;
      audioState.energyMid = audioState.rms;
      audioState.energyHigh = audioState.rms;
    }

    // Onset detection from the UNSMOOTHED onset analyser so transients stay
    // sharp (the 0.7-smoothed visual analyser flattens kicks into long ramps).
    const now = performance.now();
    if (!onsetBuf || onsetBuf.length !== bufferLength) onsetBuf = new Uint8Array(bufferLength);
    if (onsetAnalyser) onsetAnalyser.getByteFrequencyData(onsetBuf);
    if (!spectrumPrev || spectrumPrev.length !== bufferLength) {
      spectrumPrev = new Float32Array(bufferLength);
    }
    const onsetData = onsetAnalyser ? onsetBuf : data;
    let flux = 0;

    // Filter range now in real Hz, matching the UI labels ("bass" 150–250 Hz
    // kick body, "mids" 150 Hz–2 kHz). Previously these were bin-index slices
    // that didn't match the displayed ranges.
    const beatFilterRange = state.bpm.filterRange || 'full';
    const startBin = beatFilterRange === 'bass' ? Math.max(1, Math.floor(150 / binHz))
      : beatFilterRange === 'mids' ? Math.max(1, Math.floor(150 / binHz))
      : 1;
    const endBin = beatFilterRange === 'bass' ? Math.min(bufferLength, Math.ceil(250 / binHz))
      : beatFilterRange === 'mids' ? Math.min(bufferLength, Math.ceil(2000 / binHz))
      : bufferLength;

    for (let i = startBin; i < endBin; i += 1) {
      const value = onsetData[i] / 255;
      const delta = value - spectrumPrev[i];
      if (delta > 0) flux += delta;
      spectrumPrev[i] = value;
    }
    // Keep the rest of the spectrum history current for next frame.
    for (let i = 0; i < bufferLength; i += 1) {
      if (i >= startBin && i < endBin) continue;
      spectrumPrev[i] = onsetData[i] / 255;
    }

    // Tempo-aware flux window (~3 s covers ~4 beats at 80 BPM; the old 1 s
    // window made the adaptive threshold statistically unstable at low tempo).
    const fluxWindowMs = 3000;
    fluxHistory.push({ time: now, value: flux });
    if (fluxHistory.length && now - fluxHistory[0].time > fluxWindowMs) {
      fluxHistory = fluxHistory.filter((entry) => now - entry.time < fluxWindowMs);
    }

    const mean =
      fluxHistory.reduce((sumEntry, entry) => sumEntry + entry.value, 0) /
      Math.max(1, fluxHistory.length);
    const variance =
      fluxHistory.reduce((sumEntry, entry) => sumEntry + (entry.value - mean) ** 2, 0) /
      Math.max(1, fluxHistory.length);
    const std = Math.sqrt(variance);
    const beatSensitivity = state.bpm.sensitivity || 1.5;
    const threshold = mean + std * beatSensitivity;

    // Tempo-aware hold-off: clamp the fixed hold-off to 75% of one beat so fast
    // tempos (>300 BPM, beat < 200 ms) don't drop every other onset.
    const beatMs = 60000 / Math.max(40, getActiveBpm());
    const configuredHoldOff = state.bpm.holdOffMs || 200;
    const beatHoldOffMs = Math.min(configuredHoldOff, beatMs * 0.75);
    const lastBeatTime = state.runtime.lastBeatTime || 0;

    if (fluxPrev > fluxPrevPrev && fluxPrev > flux && fluxPrev > threshold) {
      if (now - lastBeatTime > beatHoldOffMs) {
        onsetTimes.push(fluxPrevTime);
        onsetTimes = onsetTimes.filter((time) => now - time < 8000);

        state.runtime.glyphBeatPulse = 1;
        state.runtime.lastBeatTime = now;
      }
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
      // In sync mode `rate` is the period in beats (the S&H UI's rate dial is a
      // per-beat period; the LFO division selector sets lfo.rate = div.beats,
      // e.g. 1/4 → 1 beat, 1/16 → 0.25). Frequency in Hz is therefore
      // (bpm/60) / rate. A prior edit multiplied instead, which inverted the
      // knob — 1/16 ran slower than 1/4 instead of 4x faster.
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
      // In sync mode `rate` is the period in beats (the LFO division selector
      // sets lfo.rate = div.beats, e.g. 1/4 → 1 beat, 1/16 → 0.25). Frequency in
      // Hz is therefore (bpm/60) / rate — matching src/shared/lfoUtils.ts and
      // the legacy index.ts updateLfos. A prior edit multiplied instead, which
      // inverted the knob (1/16 ran slower than 1/4 instead of 4x faster).
      const rateHz = lfo.sync ? Math.max(bpm / 60 / Math.max(lfo.rate, 0.05), 0.1) : Math.max(lfo.rate, 0.05);
      state.modulators.lfoPhases[index] = (state.modulators.lfoPhases[index] + dt * rateHz) % 1;
    });
  };

  const update = (deltaMs: number) => {
    // Clamp the frame delta so a tab background / long stall can't make LFO
    // phases, envelopes, and transport time jump by seconds at once.
    const clampedMs = Math.max(0, Math.min(deltaMs, 100));
    updateAnalysis();
    const bpm = getActiveBpm();
    if (store.getState().transport.isPlaying) {
      const dt = clampedMs * 0.001;
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

  const getSongDetectionDiagnostics = (): SongDetectionDiagnostics => {
    const stats = rollingAudioCapture.getStats();
    const detectorState = songChangeDetector.getState();
    const now = Date.now();
    
    // Enrich detection status with details
    const currentStatus = { ...detectionStatus };
    if (nowPlayingSettings.enabled && currentStatus.state === 'listening') {
      const cooldownRemainingMs = Math.max(0, (detectorState.lastDetectionAt + nowPlayingSettings.cooldownMs) - performance.now());
      currentStatus.details = {
        confidence: detectorState.consecutiveChanges / nowPlayingSettings.confirmWindows,
        lastDetectionTime: detectorState.lastDetectionAt,
        cooldownRemainingMs,
        bufferHealth: Math.min(1, stats.captureDurationMs / (nowPlayingSettings.clipDurationMs || 12000)),
        activeChunks: stats.totalChunks,
        totalBytes: stats.totalBytes
      };
      
      if (cooldownRemainingMs > 0) {
        currentStatus.state = 'cooldown';
      }
    }

    return {
      status: currentStatus,
      captureActive: rollingAudioCapture.isActive(),
      streamActive: !!mediaStream,
      deviceId: currentDeviceId,
      settings: {
        enabled: nowPlayingSettings.enabled,
        minTrackMs: nowPlayingSettings.minTrackMs,
        changeThreshold: nowPlayingSettings.changeThreshold,
        cooldownMs: nowPlayingSettings.cooldownMs
      },
      metrics: {
        totalDetections,
        failedDetections,
        lastSuccessAt,
        lastFailureAt
      }
    };
  };

  const updateNowPlayingSettings = (settings: Partial<NowPlayingSettings>) => {
    const oldEnabled = nowPlayingSettings.enabled;
    nowPlayingSettings = { ...nowPlayingSettings, ...settings };

    // Push the (possibly changed) thresholds into the live detector so edits
    // take effect immediately, without a restart. Previously these were
    // captured in the detector's closure at construction and never updated.
    songChangeDetector.setOptions({
      minTrackMs: nowPlayingSettings.minTrackMs,
      silenceThreshold: nowPlayingSettings.silenceThreshold,
      changeThreshold: nowPlayingSettings.changeThreshold,
      confirmWindows: nowPlayingSettings.confirmWindows,
      cooldownMs: nowPlayingSettings.cooldownMs
    });

    if (nowPlayingSettings.enabled && !oldEnabled) {
      songChangeDetector.reset();
      transitionTo('listening', 'Song detection enabled');
    } else if (!nowPlayingSettings.enabled && oldEnabled) {
      transitionTo('idle', 'Song detection disabled');
    }
  };

  const onSongChange = (handler: (event: SongChangeEvent) => void) => {
    songChangeHandler = handler;
  };

  const engine: AudioEngine = {
    initDevices,
    setup,
    update,
    initModulators,
    getContext: () => audioContext,
    getActiveBpm,
    getState: () => store.getState().audio,
    getSongDetectionDiagnostics,
    updateNowPlayingSettings,
    onSongChange,
    getRollingAudioCapture: () => rollingAudioCapture
  };
  instance = engine;

  return engine;
};
