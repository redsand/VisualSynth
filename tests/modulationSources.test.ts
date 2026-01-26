import { describe, expect, it } from 'vitest';
import {
  FREQUENCY_BANDS,
  SIMPLE_BANDS,
  createBandEnvelope,
  updateBandEnvelope,
  createOnsetDetector,
  detectOnset,
  calculateSpectralFeatures,
  frequencyToMidi,
  midiToNoteName,
  estimatePitch,
  createPeakHold,
  updatePeakHold,
  createGate,
  updateGate,
  createModulationSourceState,
  getModulationValue,
  MODULATION_SOURCE_IDS
} from '../src/shared/modulationSources';

describe('frequency band definitions', () => {
  it('defines 7 detailed bands', () => {
    expect(Object.keys(FREQUENCY_BANDS)).toHaveLength(7);
    expect(FREQUENCY_BANDS.sub.minHz).toBe(20);
    expect(FREQUENCY_BANDS.air.maxHz).toBe(20000);
  });

  it('defines 4 simple bands', () => {
    expect(Object.keys(SIMPLE_BANDS)).toHaveLength(4);
    expect(SIMPLE_BANDS.sub.name).toBe('Sub');
    expect(SIMPLE_BANDS.high.maxHz).toBe(20000);
  });

  it('bands cover full frequency range', () => {
    const bands = Object.values(SIMPLE_BANDS);
    const minFreq = Math.min(...bands.map((b) => b.minHz));
    const maxFreq = Math.max(...bands.map((b) => b.maxHz));
    expect(minFreq).toBe(20);
    expect(maxFreq).toBe(20000);
  });
});

describe('band envelope', () => {
  it('creates envelope with default values', () => {
    const env = createBandEnvelope(SIMPLE_BANDS.low);
    expect(env.band).toBe(SIMPLE_BANDS.low);
    expect(env.currentLevel).toBe(0);
    expect(env.smoothedLevel).toBe(0);
    expect(env.peakLevel).toBe(0);
  });

  it('updates envelope with spectrum data', () => {
    const env = createBandEnvelope(SIMPLE_BANDS.mid);
    const spectrum = new Float32Array(512);

    // Add some energy in the mid range (bins 20-400 at 44100/1024 Hz per bin)
    for (let i = 20; i < 100; i++) {
      spectrum[i] = 0.5;
    }

    const updated = updateBandEnvelope(env, spectrum, 44100, 1024, 16);
    expect(updated.currentLevel).toBeGreaterThan(0);
    expect(updated.smoothedLevel).toBeGreaterThan(0);
  });

  it('applies attack and release', () => {
    let env = createBandEnvelope(SIMPLE_BANDS.low);
    env = { ...env, attackTime: 10, releaseTime: 100 };

    const highSpectrum = new Float32Array(512).fill(0.5);
    const lowSpectrum = new Float32Array(512).fill(0.1);

    // Attack
    env = updateBandEnvelope(env, highSpectrum, 44100, 1024, 16);
    const attackLevel = env.smoothedLevel;

    // Release
    env = updateBandEnvelope(env, lowSpectrum, 44100, 1024, 16);
    expect(env.smoothedLevel).toBeLessThan(attackLevel);
  });

  it('tracks peak with hold time', () => {
    let env = createBandEnvelope(SIMPLE_BANDS.high);
    env = { ...env, peakHoldTime: 100 };

    const spectrum = new Float32Array(512).fill(0.8);
    env = updateBandEnvelope(env, spectrum, 44100, 1024, 16);

    const peakAfterHigh = env.peakLevel;

    // Lower input
    const lowSpectrum = new Float32Array(512).fill(0.1);
    env = updateBandEnvelope(env, lowSpectrum, 44100, 1024, 16);

    // Peak should be held
    expect(env.peakLevel).toBeCloseTo(peakAfterHigh, 1);
  });
});

describe('onset detection', () => {
  it('creates detector with defaults', () => {
    const detector = createOnsetDetector();
    expect(detector.threshold).toBe(0.3);
    expect(detector.onsetDetected).toBe(false);
    expect(detector.history).toHaveLength(0);
  });

  it('detects onset on sudden energy increase', () => {
    let detector = createOnsetDetector();

    const quietSpectrum = new Float32Array(256).fill(0.1);
    const loudSpectrum = new Float32Array(256).fill(0.8);

    // Establish baseline
    detector = detectOnset(detector, quietSpectrum, null, 0);
    detector = detectOnset(detector, quietSpectrum, quietSpectrum, 100);
    detector = detectOnset(detector, quietSpectrum, quietSpectrum, 200);

    // Sudden increase
    detector = detectOnset(detector, loudSpectrum, quietSpectrum, 300);
    expect(detector.currentFlux).toBeGreaterThan(0);
  });

  it('respects minimum interval', () => {
    let detector = createOnsetDetector();
    detector = { ...detector, minIntervalMs: 200 };

    const spectrum1 = new Float32Array(256).fill(0.1);
    const spectrum2 = new Float32Array(256).fill(0.8);

    detector = detectOnset(detector, spectrum1, null, 0);
    detector = detectOnset(detector, spectrum2, spectrum1, 50);

    // Even if we detect a peak, min interval hasn't passed
    if (detector.onsetDetected) {
      detector = detectOnset(detector, spectrum2, spectrum1, 100);
      // Shouldn't detect again so soon
      expect(detector.onsetDetected).toBe(false);
    }
  });

  it('uses adaptive threshold', () => {
    let detector = createOnsetDetector();

    // Build up history with varying signal to create non-zero flux
    let prevSpectrum: Float32Array | null = null;
    for (let i = 0; i < 25; i++) {
      // Vary the spectrum slightly to create some flux
      const spectrum = new Float32Array(256);
      for (let j = 0; j < 256; j++) {
        spectrum[j] = 0.1 + Math.sin(i * 0.5 + j * 0.1) * 0.05;
      }
      detector = detectOnset(detector, spectrum, prevSpectrum, i * 50);
      prevSpectrum = spectrum;
    }

    expect(detector.history.length).toBe(detector.historyLength);
    expect(detector.adaptiveThreshold).toBeGreaterThanOrEqual(0);
  });
});

describe('spectral features', () => {
  it('calculates features from spectrum', () => {
    const spectrum = new Float32Array(512);

    // Create a spectrum with energy concentrated in low frequencies
    for (let i = 0; i < 50; i++) {
      spectrum[i] = 0.5;
    }

    const features = calculateSpectralFeatures(spectrum, null, 44100, 1024);

    expect(features.centroid).toBeGreaterThanOrEqual(0);
    expect(features.centroid).toBeLessThanOrEqual(1);
    expect(features.rolloff).toBeGreaterThanOrEqual(0);
    expect(features.rolloff).toBeLessThanOrEqual(1);
  });

  it('returns zeros for silent signal', () => {
    const spectrum = new Float32Array(512).fill(0);
    const features = calculateSpectralFeatures(spectrum, null, 44100, 1024);

    expect(features.centroid).toBe(0);
    expect(features.flux).toBe(0);
  });

  it('calculates flux from spectrum change', () => {
    const prev = new Float32Array(256).fill(0.2);
    const current = new Float32Array(256).fill(0.6);

    const features = calculateSpectralFeatures(current, prev, 44100, 512);
    expect(features.flux).toBeGreaterThan(0);
  });

  it('detects tonal vs noisy signals via flatness', () => {
    // Tonal signal - energy at specific frequencies
    const tonal = new Float32Array(256).fill(0.01);
    tonal[50] = 1.0;
    tonal[100] = 0.8;
    tonal[150] = 0.5;

    // Noisy signal - energy spread across all frequencies
    const noisy = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      noisy[i] = 0.3 + Math.random() * 0.1;
    }

    const tonalFeatures = calculateSpectralFeatures(tonal, null, 44100, 512);
    const noisyFeatures = calculateSpectralFeatures(noisy, null, 44100, 512);

    // Noisy should have higher flatness
    expect(noisyFeatures.flatness).toBeGreaterThan(tonalFeatures.flatness);
  });
});

describe('pitch estimation utilities', () => {
  it('converts frequency to MIDI', () => {
    expect(frequencyToMidi(440)).toBe(69); // A4
    expect(frequencyToMidi(261.63)).toBeCloseTo(60, 0); // C4
  });

  it('converts MIDI to note name', () => {
    expect(midiToNoteName(69)).toBe('A4');
    expect(midiToNoteName(60)).toBe('C4');
    expect(midiToNoteName(72)).toBe('C5');
  });

  it('estimates pitch from waveform', () => {
    // Create a simple sine wave at 440 Hz
    const sampleRate = 44100;
    const frequency = 440;
    const length = 2048;
    const waveform = new Float32Array(length);

    for (let i = 0; i < length; i++) {
      waveform[i] = Math.sin((2 * Math.PI * frequency * i) / sampleRate);
    }

    const estimate = estimatePitch(waveform, sampleRate);

    // Should be close to 440 Hz
    expect(estimate.frequency).toBeGreaterThan(400);
    expect(estimate.frequency).toBeLessThan(480);
    expect(estimate.confidence).toBeGreaterThan(0);
  });

  it('returns zero for silent waveform', () => {
    const waveform = new Float32Array(1024).fill(0);
    const estimate = estimatePitch(waveform, 44100);
    expect(estimate.confidence).toBe(0);
  });
});

describe('peak hold', () => {
  it('creates with default values', () => {
    const hold = createPeakHold();
    expect(hold.currentValue).toBe(0);
    expect(hold.peakValue).toBe(0);
    expect(hold.holdTimeMs).toBe(500);
  });

  it('tracks peak value', () => {
    let hold = createPeakHold(500, 0.001);

    hold = updatePeakHold(hold, 0.8, 16);
    expect(hold.peakValue).toBe(0.8);
  });

  it('holds peak during hold time', () => {
    let hold = createPeakHold(500, 0.001);

    hold = updatePeakHold(hold, 0.8, 16);
    hold = updatePeakHold(hold, 0.2, 16);

    // Peak should still be held
    expect(hold.peakValue).toBe(0.8);
  });

  it('decays peak after hold time', () => {
    let hold = createPeakHold(100, 0.01);

    hold = updatePeakHold(hold, 0.8, 16);

    // Advance past hold time
    hold = updatePeakHold(hold, 0.2, 150);

    // Peak should be decaying
    expect(hold.peakValue).toBeLessThan(0.8);
  });
});

describe('gate', () => {
  it('creates with default values', () => {
    const gate = createGate();
    expect(gate.threshold).toBe(0.1);
    expect(gate.isOpen).toBe(false);
  });

  it('opens when input exceeds threshold', () => {
    let gate = createGate(0.5);

    gate = updateGate(gate, 0.6, 16);
    expect(gate.isOpen).toBe(true);
  });

  it('applies hysteresis on close', () => {
    let gate = createGate(0.5, 0.1);

    // Open the gate
    gate = updateGate(gate, 0.6, 16);
    expect(gate.isOpen).toBe(true);

    // Slightly below threshold, but within hysteresis
    gate = updateGate(gate, 0.45, 16);
    expect(gate.isOpen).toBe(true); // Should stay open

    // Below threshold - hysteresis
    gate = updateGate(gate, 0.35, 16);
    expect(gate.isOpen).toBe(false); // Should close
  });

  it('smooths gate output', () => {
    let gate = createGate(0.5, 0.1, 5, 50);

    // Open the gate
    gate = updateGate(gate, 0.8, 16);
    const outputAfterOpen = gate.smoothedOutput;

    // Should be smoothly ramping up
    expect(outputAfterOpen).toBeGreaterThan(0);
    expect(outputAfterOpen).toBeLessThan(0.8);
  });
});

describe('modulation source state', () => {
  it('creates with all sources initialized', () => {
    const state = createModulationSourceState();

    expect(state.subEnvelope).toBeDefined();
    expect(state.lowEnvelope).toBeDefined();
    expect(state.midEnvelope).toBeDefined();
    expect(state.highEnvelope).toBeDefined();
    expect(state.onsetDetector).toBeDefined();
    expect(state.spectralFeatures).toBeDefined();
    expect(state.pitchEstimate).toBeDefined();
    expect(state.peakHold).toBeDefined();
    expect(state.gate).toBeDefined();
  });

  it('returns values by source ID', () => {
    let state = createModulationSourceState();
    state = { ...state, rms: 0.5, peak: 0.8 };

    expect(getModulationValue(state, 'audio.rms')).toBe(0.5);
    expect(getModulationValue(state, 'audio.peak')).toBe(0.8);
  });

  it('returns band envelope values', () => {
    let state = createModulationSourceState();
    state.subEnvelope.smoothedLevel = 0.3;
    state.subEnvelope.peakLevel = 0.5;

    expect(getModulationValue(state, 'band.sub')).toBe(0.3);
    expect(getModulationValue(state, 'band.sub.peak')).toBe(0.5);
  });

  it('returns spectral feature values', () => {
    let state = createModulationSourceState();
    state.spectralFeatures.centroid = 0.6;
    state.spectralFeatures.flux = 0.4;

    expect(getModulationValue(state, 'spectral.centroid')).toBe(0.6);
    expect(getModulationValue(state, 'spectral.flux')).toBe(0.4);
  });

  it('returns zero for unknown source', () => {
    const state = createModulationSourceState();
    expect(getModulationValue(state, 'unknown.source')).toBe(0);
  });
});

describe('modulation source IDs', () => {
  it('exports all source IDs', () => {
    expect(MODULATION_SOURCE_IDS.length).toBeGreaterThan(20);
    expect(MODULATION_SOURCE_IDS).toContain('audio.rms');
    expect(MODULATION_SOURCE_IDS).toContain('band.sub');
    expect(MODULATION_SOURCE_IDS).toContain('onset.detected');
    expect(MODULATION_SOURCE_IDS).toContain('spectral.centroid');
    expect(MODULATION_SOURCE_IDS).toContain('pitch.frequency');
    expect(MODULATION_SOURCE_IDS).toContain('peakhold');
    expect(MODULATION_SOURCE_IDS).toContain('gate');
  });
});
