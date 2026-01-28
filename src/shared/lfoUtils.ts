/**
 * LFO Utilities
 *
 * Shared LFO shape functions for modulation.
 */

export type LfoShape = 'sine' | 'triangle' | 'saw' | 'square';

/**
 * Calculate LFO value for a given phase and shape
 * @param phase - Phase value (0-1, but can wrap)
 * @param shape - LFO waveform shape
 * @returns LFO value (0-1 for most shapes)
 */
export const lfoValueForShape = (phase: number, shape: LfoShape): number => {
  // Handle negative phase by wrapping
  const wrapped = ((phase % 1) + 1) % 1;
  if (shape === 'sine') {
    return 0.5 + 0.5 * Math.sin(wrapped * Math.PI * 2);
  }
  if (shape === 'triangle') {
    return wrapped < 0.5 ? wrapped * 2 : 1 - (wrapped - 0.5) * 2;
  }
  if (shape === 'square') {
    return wrapped < 0.5 ? 1 : 0;
  }
  return wrapped; // saw/ramp
};

/**
 * LFO parameter interface
 */
export interface LfoParams {
  shape: LfoShape;
  rate: number;      // Hz
  phase: number;     // 0-1
  depth: number;     // modulation depth (usually 0-1)
  sync: boolean;     // tempo sync
}

/**
 * Calculate LFO value at a given time
 * @param params - LFO parameters
 * @param timeSeconds - Time in seconds
 * @param bpm - BPM if sync is enabled
 * @returns LFO value (0-1)
 */
export const calculateLfoValue = (params: LfoParams, timeSeconds: number, bpm: number = 120): number => {
  const rate = params.sync ? Math.max(bpm / 60 / Math.max(params.rate, 0.05), 0.1) : Math.max(params.rate, 0.05);
  const phase = ((params.phase + timeSeconds * rate) % 1 + 1) % 1;
  return lfoValueForShape(phase, params.shape);
};

/**
 * Envelope stage
 */
export type EnvelopeStage = 'idle' | 'attack' | 'decay' | 'sustain' | 'release';

/**
 * Envelope state
 */
export interface EnvelopeState {
  stage: EnvelopeStage;
  value: number;
  holdLeft: number;
  triggerArmed: boolean;
  timeInStage: number;
}

/**
 * Envelope parameters (ADSR)
 */
export interface EnvelopeParams {
  attack: number;   // seconds
  decay: number;    // seconds
  sustain: number;  // 0-1
  release: number;  // seconds
  hold: number;     // seconds
  trigger: 'audio.peak' | 'strobe' | 'manual';
  threshold: number; // 0-1 trigger threshold
}

/**
 * Calculate next envelope state
 * @param state - Current envelope state
 * @param params - Envelope parameters
 * @param dt - Time delta in seconds
 * @param triggerInput - Current trigger value (0-1)
 * @returns Updated envelope state
 */
export const updateEnvelope = (
  state: EnvelopeState,
  params: EnvelopeParams,
  dt: number,
  triggerInput: number = 0
): EnvelopeState => {
  let newState = { ...state, timeInStage: state.timeInStage + dt };

  // Check for trigger in idle or sustain stage
  if (params.trigger !== 'manual') {
    if (triggerInput >= params.threshold && state.triggerArmed) {
      newState.stage = 'attack';
      newState.value = 0;
      newState.holdLeft = params.hold;
      newState.timeInStage = 0;
      newState.triggerArmed = false;
    }
    if (triggerInput < params.threshold * 0.6) {
      newState.triggerArmed = true;
    }
  }

  const attack = Math.max(params.attack, 0.001);
  const decay = Math.max(params.decay, 0.001);
  const release = Math.max(params.release, 0.001);

  if (newState.stage === 'idle') {
    newState.value = 0;
  } else if (newState.stage === 'attack') {
    newState.value += dt / attack;
    if (newState.value >= 1) {
      newState.value = 1;
      newState.stage = 'decay';
      newState.timeInStage = 0;
    }
  } else if (newState.stage === 'decay') {
    newState.value -= dt * (1 - params.sustain) / decay;
    if (newState.value <= params.sustain + 1e-10) {
      newState.value = params.sustain;
      newState.stage = 'sustain';
      newState.timeInStage = 0;
    }
  } else if (newState.stage === 'sustain') {
    newState.value = params.sustain;
    if (newState.holdLeft > 0) {
      newState.holdLeft -= dt;
    }
    if (newState.holdLeft <= 0) {
      newState.stage = 'release';
      newState.timeInStage = 0;
    }
  } else if (newState.stage === 'release') {
    newState.value -= dt * params.sustain / release;
    if (newState.value <= 0) {
      newState.value = 0;
      newState.stage = 'idle';
      newState.triggerArmed = true;
    }
  }

  return newState;
};

/**
 * Sample & Hold state
 */
export interface SampleHoldState {
  timer: number;
  value: number;
  target: number;
}

/**
 * Sample & Hold parameters
 */
export interface SampleHoldParams {
  rate: number;    // Hz
  sync: boolean;   // tempo sync
  smooth: number;  // 0-1 smoothing factor
}

/**
 * Update sample & hold state
 * @param state - Current state
 * @param params - Parameters
 * @param dt - Time delta in seconds
 * @param inputValue - Current input value to sample from
 * @param bpm - BPM if sync is enabled
 * @returns Updated state
 */
export const updateSampleHold = (
  state: SampleHoldState,
  params: SampleHoldParams,
  dt: number,
  inputValue: number,
  bpm: number = 120
): SampleHoldState => {
  const rate = params.sync ? Math.max(bpm / 60 / Math.max(params.rate, 0.05), 0.1) : Math.max(params.rate, 0.05);
  const period = 1 / rate;

  let newTimer = state.timer + dt;
  let newTarget = state.target;

  // Use small epsilon for floating point comparison
  if (newTimer >= period - 1e-10) {
    newTimer = 0;
    newTarget = inputValue;
  }

  // Apply smoothing - using the same formula as the renderer
  const smoothing = Math.min(Math.max(params.smooth, 0), 1);
  const smoothingFactor = 1 - Math.exp(-dt * (2 + smoothing * 8));
  const newValue = state.value + (newTarget - state.value) * smoothingFactor;

  return {
    timer: newTimer,
    target: newTarget,
    value: newValue
  };
};

/**
 * Create default envelope state
 */
export const createDefaultEnvelopeState = (): EnvelopeState => ({
  stage: 'idle',
  value: 0,
  holdLeft: 0,
  triggerArmed: true,
  timeInStage: 0
});

/**
 * Create default sample & hold state
 */
export const createDefaultSampleHoldState = (): SampleHoldState => ({
  timer: 0,
  value: 0,
  target: 0
});

/**
 * Get available LFO shapes
 */
export const LFO_SHAPES: LfoShape[] = ['sine', 'triangle', 'saw', 'square'];

/**
 * Get envelope trigger options
 */
export const ENVELOPE_TRIGGERS: EnvelopeParams['trigger'][] = ['audio.peak', 'strobe', 'manual'];