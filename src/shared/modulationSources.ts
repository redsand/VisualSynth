/**
 * Modulation Sources - Advanced audio analysis and modulation utilities
 *
 * This module provides:
 * - Onset detection
 * - Band-limited envelopes (sub/low/mid/high)
 * - Spectral features (centroid, flux, rolloff)
 * - Pitch estimation
 * - Peak hold/gating/hysteresis utilities
 */

// ============================================================================
// Frequency Band Definitions
// ============================================================================

export interface FrequencyBand {
  name: string;
  minHz: number;
  maxHz: number;
}

export const FREQUENCY_BANDS: Record<string, FrequencyBand> = {
  sub: { name: 'Sub Bass', minHz: 20, maxHz: 60 },
  bass: { name: 'Bass', minHz: 60, maxHz: 250 },
  lowMid: { name: 'Low Mid', minHz: 250, maxHz: 500 },
  mid: { name: 'Mid', minHz: 500, maxHz: 2000 },
  highMid: { name: 'High Mid', minHz: 2000, maxHz: 4000 },
  high: { name: 'High', minHz: 4000, maxHz: 12000 },
  air: { name: 'Air', minHz: 12000, maxHz: 20000 }
};

// Simplified 4-band version
export const SIMPLE_BANDS: Record<string, FrequencyBand> = {
  sub: { name: 'Sub', minHz: 20, maxHz: 80 },
  low: { name: 'Low', minHz: 80, maxHz: 400 },
  mid: { name: 'Mid', minHz: 400, maxHz: 4000 },
  high: { name: 'High', minHz: 4000, maxHz: 20000 }
};

// ============================================================================
// Band-Limited Envelope Follower
// ============================================================================

export interface BandEnvelope {
  band: FrequencyBand;
  currentLevel: number;
  attackTime: number;    // ms
  releaseTime: number;   // ms
  smoothedLevel: number;
  peakLevel: number;
  peakHoldTime: number;  // ms
  peakHoldCounter: number;
}

export const createBandEnvelope = (band: FrequencyBand): BandEnvelope => ({
  band,
  currentLevel: 0,
  attackTime: 5,
  releaseTime: 100,
  smoothedLevel: 0,
  peakLevel: 0,
  peakHoldTime: 500,
  peakHoldCounter: 0
});

export const updateBandEnvelope = (
  envelope: BandEnvelope,
  spectrum: Float32Array,
  sampleRate: number,
  fftSize: number,
  deltaMs: number
): BandEnvelope => {
  // Calculate bin indices for the frequency band
  const binHz = sampleRate / fftSize;
  const startBin = Math.floor(envelope.band.minHz / binHz);
  const endBin = Math.min(spectrum.length - 1, Math.ceil(envelope.band.maxHz / binHz));

  // Calculate average energy in the band
  let energy = 0;
  let count = 0;
  for (let i = startBin; i <= endBin; i++) {
    energy += spectrum[i] * spectrum[i];
    count++;
  }
  const rmsLevel = count > 0 ? Math.sqrt(energy / count) : 0;

  // Apply envelope follower with attack/release
  const attackCoef = 1 - Math.exp(-deltaMs / envelope.attackTime);
  const releaseCoef = 1 - Math.exp(-deltaMs / envelope.releaseTime);

  let smoothedLevel = envelope.smoothedLevel;
  if (rmsLevel > smoothedLevel) {
    smoothedLevel += (rmsLevel - smoothedLevel) * attackCoef;
  } else {
    smoothedLevel += (rmsLevel - smoothedLevel) * releaseCoef;
  }

  // Peak hold
  let peakLevel = envelope.peakLevel;
  let peakHoldCounter = envelope.peakHoldCounter;
  if (smoothedLevel > peakLevel) {
    peakLevel = smoothedLevel;
    peakHoldCounter = envelope.peakHoldTime;
  } else {
    peakHoldCounter = Math.max(0, peakHoldCounter - deltaMs);
    if (peakHoldCounter === 0) {
      peakLevel *= 0.95; // Decay peak
    }
  }

  return {
    ...envelope,
    currentLevel: rmsLevel,
    smoothedLevel,
    peakLevel,
    peakHoldCounter
  };
};

// ============================================================================
// Onset Detection
// ============================================================================

export interface OnsetDetector {
  threshold: number;
  minIntervalMs: number;
  lastOnsetTime: number;
  currentFlux: number;
  previousFlux: number;
  smoothedFlux: number;
  adaptiveThreshold: number;
  onsetDetected: boolean;
  onsetStrength: number;
  history: number[];
  historyLength: number;
}

export const createOnsetDetector = (): OnsetDetector => ({
  threshold: 0.3,
  minIntervalMs: 100,
  lastOnsetTime: 0,
  currentFlux: 0,
  previousFlux: 0,
  smoothedFlux: 0,
  adaptiveThreshold: 0.3,
  onsetDetected: false,
  onsetStrength: 0,
  history: [],
  historyLength: 20
});

export const detectOnset = (
  detector: OnsetDetector,
  spectrum: Float32Array,
  previousSpectrum: Float32Array | null,
  timestamp: number
): OnsetDetector => {
  // Calculate spectral flux (positive difference only - onset-like changes)
  let flux = 0;
  if (previousSpectrum && previousSpectrum.length === spectrum.length) {
    for (let i = 0; i < spectrum.length; i++) {
      const diff = spectrum[i] - previousSpectrum[i];
      if (diff > 0) {
        flux += diff;
      }
    }
    flux /= spectrum.length;
  }

  // Smooth the flux
  const smoothingFactor = 0.3;
  const smoothedFlux = detector.smoothedFlux * (1 - smoothingFactor) + flux * smoothingFactor;

  // Update history and adaptive threshold
  const history = [...detector.history, flux].slice(-detector.historyLength);
  const mean = history.reduce((a, b) => a + b, 0) / history.length;
  const std = Math.sqrt(
    history.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / history.length
  );
  const adaptiveThreshold = mean + std * 1.5;

  // Detect onset
  const timeSinceLastOnset = timestamp - detector.lastOnsetTime;
  const aboveThreshold = flux > Math.max(detector.threshold, adaptiveThreshold);
  const enoughTimePassed = timeSinceLastOnset >= detector.minIntervalMs;
  const isPeak = flux > detector.previousFlux && flux > smoothedFlux;

  const onsetDetected = aboveThreshold && enoughTimePassed && isPeak;
  const onsetStrength = onsetDetected ? Math.min(1, flux / Math.max(0.001, adaptiveThreshold)) : 0;

  return {
    ...detector,
    currentFlux: flux,
    previousFlux: detector.currentFlux,
    smoothedFlux,
    adaptiveThreshold,
    onsetDetected,
    onsetStrength,
    lastOnsetTime: onsetDetected ? timestamp : detector.lastOnsetTime,
    history
  };
};

// ============================================================================
// Spectral Features
// ============================================================================

export interface SpectralFeatures {
  centroid: number;      // 0-1 normalized spectral centroid
  spread: number;        // 0-1 spectral spread
  flux: number;          // 0-1 spectral flux
  rolloff: number;       // 0-1 rolloff frequency
  flatness: number;      // 0-1 spectral flatness (tonal vs noisy)
  crest: number;         // 0-1 spectral crest factor
}

export const calculateSpectralFeatures = (
  spectrum: Float32Array,
  previousSpectrum: Float32Array | null,
  sampleRate: number,
  fftSize: number
): SpectralFeatures => {
  const binHz = sampleRate / fftSize;
  const nyquist = sampleRate / 2;

  // Calculate total energy
  let totalEnergy = 0;
  for (let i = 0; i < spectrum.length; i++) {
    totalEnergy += spectrum[i] * spectrum[i];
  }
  totalEnergy = Math.sqrt(totalEnergy);

  if (totalEnergy < 0.0001) {
    return { centroid: 0, spread: 0, flux: 0, rolloff: 0, flatness: 0, crest: 0 };
  }

  // Spectral centroid (center of mass)
  let centroidSum = 0;
  let magnitudeSum = 0;
  for (let i = 0; i < spectrum.length; i++) {
    const freq = i * binHz;
    const mag = spectrum[i];
    centroidSum += freq * mag;
    magnitudeSum += mag;
  }
  const centroidHz = magnitudeSum > 0 ? centroidSum / magnitudeSum : 0;
  const centroid = Math.min(1, centroidHz / nyquist);

  // Spectral spread (standard deviation around centroid)
  let spreadSum = 0;
  for (let i = 0; i < spectrum.length; i++) {
    const freq = i * binHz;
    const mag = spectrum[i];
    spreadSum += Math.pow(freq - centroidHz, 2) * mag;
  }
  const spreadHz = magnitudeSum > 0 ? Math.sqrt(spreadSum / magnitudeSum) : 0;
  const spread = Math.min(1, spreadHz / nyquist);

  // Spectral flux
  let flux = 0;
  if (previousSpectrum && previousSpectrum.length === spectrum.length) {
    for (let i = 0; i < spectrum.length; i++) {
      flux += Math.pow(spectrum[i] - previousSpectrum[i], 2);
    }
    flux = Math.sqrt(flux / spectrum.length);
  }
  flux = Math.min(1, flux * 10); // Scale to 0-1

  // Spectral rolloff (frequency below which 85% of energy is contained)
  const rolloffThreshold = 0.85;
  let cumulativeEnergy = 0;
  let rolloffBin = spectrum.length - 1;
  for (let i = 0; i < spectrum.length; i++) {
    cumulativeEnergy += spectrum[i] * spectrum[i];
    if (cumulativeEnergy >= totalEnergy * totalEnergy * rolloffThreshold) {
      rolloffBin = i;
      break;
    }
  }
  const rolloffHz = rolloffBin * binHz;
  const rolloff = Math.min(1, rolloffHz / nyquist);

  // Spectral flatness (geometric mean / arithmetic mean)
  let logSum = 0;
  let arithmeticSum = 0;
  let validBins = 0;
  for (let i = 1; i < spectrum.length; i++) { // Skip DC
    if (spectrum[i] > 0.0001) {
      logSum += Math.log(spectrum[i]);
      arithmeticSum += spectrum[i];
      validBins++;
    }
  }
  let flatness = 0;
  if (validBins > 0 && arithmeticSum > 0) {
    const geometricMean = Math.exp(logSum / validBins);
    const arithmeticMean = arithmeticSum / validBins;
    flatness = Math.min(1, geometricMean / arithmeticMean);
  }

  // Spectral crest factor (peak / RMS)
  let peak = 0;
  for (let i = 0; i < spectrum.length; i++) {
    peak = Math.max(peak, spectrum[i]);
  }
  const rms = totalEnergy / Math.sqrt(spectrum.length);
  const crest = rms > 0 ? Math.min(1, (peak / rms) / 10) : 0;

  return { centroid, spread, flux, rolloff, flatness, crest };
};

// ============================================================================
// Pitch Estimation (Simple autocorrelation-based)
// ============================================================================

export interface PitchEstimate {
  frequency: number;     // Hz
  confidence: number;    // 0-1
  midiNote: number;
  noteName: string;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const frequencyToMidi = (freq: number): number =>
  12 * Math.log2(freq / 440) + 69;

export const midiToNoteName = (midi: number): string => {
  const note = Math.round(midi) % 12;
  const octave = Math.floor(Math.round(midi) / 12) - 1;
  return `${NOTE_NAMES[note]}${octave}`;
};

export const estimatePitch = (
  waveform: Float32Array,
  sampleRate: number,
  minFreq = 50,
  maxFreq = 2000
): PitchEstimate => {
  // Simple autocorrelation pitch detection
  const minPeriod = Math.floor(sampleRate / maxFreq);
  const maxPeriod = Math.floor(sampleRate / minFreq);
  const length = Math.min(waveform.length, maxPeriod * 2);

  let bestPeriod = 0;
  let bestCorrelation = 0;

  for (let period = minPeriod; period <= Math.min(maxPeriod, length / 2); period++) {
    let correlation = 0;
    for (let i = 0; i < length - period; i++) {
      correlation += waveform[i] * waveform[i + period];
    }
    correlation /= (length - period);

    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestPeriod = period;
    }
  }

  // Calculate confidence based on correlation strength
  let energy = 0;
  for (let i = 0; i < length; i++) {
    energy += waveform[i] * waveform[i];
  }
  energy /= length;

  const frequency = bestPeriod > 0 ? sampleRate / bestPeriod : 0;
  const confidence = energy > 0.0001 ? Math.min(1, bestCorrelation / energy) : 0;
  const midiNote = frequency > 0 ? frequencyToMidi(frequency) : 0;
  const noteName = frequency > 0 ? midiToNoteName(midiNote) : '-';

  return { frequency, confidence, midiNote, noteName };
};

// ============================================================================
// Peak Hold / Gating / Hysteresis
// ============================================================================

export interface PeakHold {
  currentValue: number;
  peakValue: number;
  holdTimeMs: number;
  holdCounter: number;
  decayRate: number;     // Units per ms
}

export const createPeakHold = (holdTimeMs = 500, decayRate = 0.001): PeakHold => ({
  currentValue: 0,
  peakValue: 0,
  holdTimeMs,
  holdCounter: 0,
  decayRate
});

export const updatePeakHold = (
  hold: PeakHold,
  value: number,
  deltaMs: number
): PeakHold => {
  if (value > hold.peakValue) {
    return {
      ...hold,
      currentValue: value,
      peakValue: value,
      holdCounter: hold.holdTimeMs
    };
  }

  const holdCounter = Math.max(0, hold.holdCounter - deltaMs);
  const peakValue = holdCounter > 0
    ? hold.peakValue
    : Math.max(value, hold.peakValue - hold.decayRate * deltaMs);

  return {
    ...hold,
    currentValue: value,
    peakValue,
    holdCounter
  };
};

// ============================================================================
// Gate
// ============================================================================

export interface Gate {
  threshold: number;
  hysteresis: number;    // Difference between open and close thresholds
  attackMs: number;
  releaseMs: number;
  isOpen: boolean;
  smoothedOutput: number;
}

export const createGate = (
  threshold = 0.1,
  hysteresis = 0.05,
  attackMs = 5,
  releaseMs = 50
): Gate => ({
  threshold,
  hysteresis,
  attackMs,
  releaseMs,
  isOpen: false,
  smoothedOutput: 0
});

export const updateGate = (
  gate: Gate,
  input: number,
  deltaMs: number
): Gate => {
  // Hysteresis gating
  let isOpen = gate.isOpen;
  if (!isOpen && input > gate.threshold) {
    isOpen = true;
  } else if (isOpen && input < gate.threshold - gate.hysteresis) {
    isOpen = false;
  }

  // Smooth the gate output
  const targetOutput = isOpen ? input : 0;
  const coef = isOpen
    ? 1 - Math.exp(-deltaMs / gate.attackMs)
    : 1 - Math.exp(-deltaMs / gate.releaseMs);
  const smoothedOutput = gate.smoothedOutput + (targetOutput - gate.smoothedOutput) * coef;

  return {
    ...gate,
    isOpen,
    smoothedOutput
  };
};

// ============================================================================
// Modulation Source Registry
// ============================================================================

export interface ModulationSourceState {
  // Band envelopes
  subEnvelope: BandEnvelope;
  lowEnvelope: BandEnvelope;
  midEnvelope: BandEnvelope;
  highEnvelope: BandEnvelope;

  // Onset detection
  onsetDetector: OnsetDetector;

  // Spectral features
  spectralFeatures: SpectralFeatures;

  // Pitch
  pitchEstimate: PitchEstimate;

  // Utility states
  peakHold: PeakHold;
  gate: Gate;

  // Raw audio state
  rms: number;
  peak: number;

  // Previous spectrum for flux calculation
  previousSpectrum: Float32Array | null;
}

export const createModulationSourceState = (): ModulationSourceState => ({
  subEnvelope: createBandEnvelope(SIMPLE_BANDS.sub),
  lowEnvelope: createBandEnvelope(SIMPLE_BANDS.low),
  midEnvelope: createBandEnvelope(SIMPLE_BANDS.mid),
  highEnvelope: createBandEnvelope(SIMPLE_BANDS.high),
  onsetDetector: createOnsetDetector(),
  spectralFeatures: { centroid: 0, spread: 0, flux: 0, rolloff: 0, flatness: 0, crest: 0 },
  pitchEstimate: { frequency: 0, confidence: 0, midiNote: 0, noteName: '-' },
  peakHold: createPeakHold(),
  gate: createGate(),
  rms: 0,
  peak: 0,
  previousSpectrum: null
});

export const updateModulationSources = (
  state: ModulationSourceState,
  spectrum: Float32Array,
  waveform: Float32Array | null,
  rms: number,
  peak: number,
  sampleRate: number,
  fftSize: number,
  timestamp: number,
  deltaMs: number
): ModulationSourceState => {
  // Update band envelopes
  const subEnvelope = updateBandEnvelope(state.subEnvelope, spectrum, sampleRate, fftSize, deltaMs);
  const lowEnvelope = updateBandEnvelope(state.lowEnvelope, spectrum, sampleRate, fftSize, deltaMs);
  const midEnvelope = updateBandEnvelope(state.midEnvelope, spectrum, sampleRate, fftSize, deltaMs);
  const highEnvelope = updateBandEnvelope(state.highEnvelope, spectrum, sampleRate, fftSize, deltaMs);

  // Update onset detection
  const onsetDetector = detectOnset(state.onsetDetector, spectrum, state.previousSpectrum, timestamp);

  // Update spectral features
  const spectralFeatures = calculateSpectralFeatures(spectrum, state.previousSpectrum, sampleRate, fftSize);

  // Update pitch estimation (only if we have waveform data)
  const pitchEstimate = waveform
    ? estimatePitch(waveform, sampleRate)
    : state.pitchEstimate;

  // Update peak hold and gate
  const peakHold = updatePeakHold(state.peakHold, rms, deltaMs);
  const gate = updateGate(state.gate, rms, deltaMs);

  // Store current spectrum for next frame
  const previousSpectrum = new Float32Array(spectrum);

  return {
    subEnvelope,
    lowEnvelope,
    midEnvelope,
    highEnvelope,
    onsetDetector,
    spectralFeatures,
    pitchEstimate,
    peakHold,
    gate,
    rms,
    peak,
    previousSpectrum
  };
};

// ============================================================================
// Get Modulation Value by ID
// ============================================================================

export const getModulationValue = (
  state: ModulationSourceState,
  sourceId: string
): number => {
  switch (sourceId) {
    // Basic audio
    case 'audio.rms':
      return state.rms;
    case 'audio.peak':
      return state.peak;

    // Band envelopes
    case 'band.sub':
      return state.subEnvelope.smoothedLevel;
    case 'band.sub.peak':
      return state.subEnvelope.peakLevel;
    case 'band.low':
      return state.lowEnvelope.smoothedLevel;
    case 'band.low.peak':
      return state.lowEnvelope.peakLevel;
    case 'band.mid':
      return state.midEnvelope.smoothedLevel;
    case 'band.mid.peak':
      return state.midEnvelope.peakLevel;
    case 'band.high':
      return state.highEnvelope.smoothedLevel;
    case 'band.high.peak':
      return state.highEnvelope.peakLevel;

    // Onset
    case 'onset.detected':
      return state.onsetDetector.onsetDetected ? 1 : 0;
    case 'onset.strength':
      return state.onsetDetector.onsetStrength;
    case 'onset.flux':
      return Math.min(1, state.onsetDetector.currentFlux * 5);

    // Spectral features
    case 'spectral.centroid':
      return state.spectralFeatures.centroid;
    case 'spectral.spread':
      return state.spectralFeatures.spread;
    case 'spectral.flux':
      return state.spectralFeatures.flux;
    case 'spectral.rolloff':
      return state.spectralFeatures.rolloff;
    case 'spectral.flatness':
      return state.spectralFeatures.flatness;
    case 'spectral.crest':
      return state.spectralFeatures.crest;

    // Pitch
    case 'pitch.frequency':
      return Math.min(1, state.pitchEstimate.frequency / 1000);
    case 'pitch.confidence':
      return state.pitchEstimate.confidence;
    case 'pitch.midi':
      return Math.min(1, state.pitchEstimate.midiNote / 127);

    // Utilities
    case 'peakhold':
      return state.peakHold.peakValue;
    case 'gate':
      return state.gate.smoothedOutput;

    default:
      return 0;
  }
};

export const MODULATION_SOURCE_IDS = [
  'audio.rms',
  'audio.peak',
  'band.sub',
  'band.sub.peak',
  'band.low',
  'band.low.peak',
  'band.mid',
  'band.mid.peak',
  'band.high',
  'band.high.peak',
  'onset.detected',
  'onset.strength',
  'onset.flux',
  'spectral.centroid',
  'spectral.spread',
  'spectral.flux',
  'spectral.rolloff',
  'spectral.flatness',
  'spectral.crest',
  'pitch.frequency',
  'pitch.confidence',
  'pitch.midi',
  'peakhold',
  'gate'
] as const;

export type ModulationSourceId = typeof MODULATION_SOURCE_IDS[number];
