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

// ============================================================================
// BURST ENVELOPE SYSTEM
// One-shot envelopes for beat-triggered expanding shapes
// ============================================================================

/**
 * Burst trigger types
 */
export type BurstTrigger = 'audio.peak' | 'audio.bass' | 'audio.mid' | 'audio.high' | 'manual';

/**
 * Burst envelope parameters
 */
export interface BurstEnvelopeParams {
  attack: number;         // 0.01-0.1s (quick expand)
  hold: number;           // 0-0.2s (optional hold at peak)
  decay: number;          // 0.1-1s (fade out)
  trigger: BurstTrigger;
  threshold: number;      // 0-1 trigger threshold
  maxConcurrent: number;  // 1-8 simultaneous bursts
}

/**
 * Individual burst state
 */
export interface BurstInstance {
  active: boolean;
  stage: 'attack' | 'hold' | 'decay' | 'done';
  value: number;          // 0-1 envelope output
  timeInStage: number;
  spawnTime: number;      // Time when burst was triggered
}

/**
 * Burst envelope state (manages multiple concurrent bursts)
 */
export interface BurstEnvelopeState {
  instances: BurstInstance[];
  triggerArmed: boolean;
  lastTriggerTime: number;
  minRetriggerTime: number; // Prevent rapid re-triggering
}

/**
 * Create default burst instance
 */
export const createBurstInstance = (): BurstInstance => ({
  active: false,
  stage: 'done',
  value: 0,
  timeInStage: 0,
  spawnTime: 0
});

/**
 * Create default burst envelope state
 */
export const createDefaultBurstState = (maxConcurrent: number = 8): BurstEnvelopeState => ({
  instances: Array.from({ length: maxConcurrent }, () => createBurstInstance()),
  triggerArmed: true,
  lastTriggerTime: -1,
  minRetriggerTime: 0.05 // 50ms minimum between triggers
});

/**
 * Find an inactive slot for a new burst
 */
const findInactiveSlot = (instances: BurstInstance[]): number => {
  // First, look for completely inactive slots
  for (let i = 0; i < instances.length; i++) {
    if (!instances[i].active) return i;
  }
  // If all active, find the oldest (furthest along in decay)
  let oldestIdx = 0;
  let oldestProgress = 0;
  for (let i = 0; i < instances.length; i++) {
    const inst = instances[i];
    if (inst.stage === 'decay') {
      const progress = 1 - inst.value;
      if (progress > oldestProgress) {
        oldestProgress = progress;
        oldestIdx = i;
      }
    }
  }
  return oldestIdx;
};

/**
 * Trigger a new burst
 */
export const triggerBurst = (
  state: BurstEnvelopeState,
  currentTime: number
): BurstEnvelopeState => {
  const slotIdx = findInactiveSlot(state.instances);
  const newInstances = [...state.instances];

  newInstances[slotIdx] = {
    active: true,
    stage: 'attack',
    value: 0,
    timeInStage: 0,
    spawnTime: currentTime
  };

  return {
    ...state,
    instances: newInstances,
    triggerArmed: false,
    lastTriggerTime: currentTime
  };
};

/**
 * Update a single burst instance
 */
const updateBurstInstance = (
  instance: BurstInstance,
  params: BurstEnvelopeParams,
  dt: number
): BurstInstance => {
  if (!instance.active) return instance;

  const newInstance = { ...instance, timeInStage: instance.timeInStage + dt };
  const attack = Math.max(params.attack, 0.001);
  const hold = Math.max(params.hold, 0);
  const decay = Math.max(params.decay, 0.001);

  if (newInstance.stage === 'attack') {
    newInstance.value += dt / attack;
    if (newInstance.value >= 1) {
      newInstance.value = 1;
      newInstance.stage = hold > 0 ? 'hold' : 'decay';
      newInstance.timeInStage = 0;
    }
  } else if (newInstance.stage === 'hold') {
    newInstance.value = 1;
    if (newInstance.timeInStage >= hold) {
      newInstance.stage = 'decay';
      newInstance.timeInStage = 0;
    }
  } else if (newInstance.stage === 'decay') {
    newInstance.value -= dt / decay;
    if (newInstance.value <= 0) {
      newInstance.value = 0;
      newInstance.stage = 'done';
      newInstance.active = false;
    }
  }

  return newInstance;
};

/**
 * Update burst envelope state
 * @param state - Current burst state
 * @param params - Burst parameters
 * @param dt - Time delta in seconds
 * @param currentTime - Current time in seconds
 * @param triggerInput - Trigger value (0-1) based on trigger type
 * @returns Updated burst state
 */
export const updateBurstEnvelope = (
  state: BurstEnvelopeState,
  params: BurstEnvelopeParams,
  dt: number,
  currentTime: number,
  triggerInput: number = 0
): BurstEnvelopeState => {
  let newState = { ...state };

  // Check for trigger (if enough time has passed since last trigger)
  const canRetrigger = currentTime - state.lastTriggerTime >= state.minRetriggerTime;

  if (params.trigger !== 'manual' && canRetrigger) {
    if (triggerInput >= params.threshold && state.triggerArmed) {
      newState = triggerBurst(newState, currentTime);
    }
    if (triggerInput < params.threshold * 0.6) {
      newState.triggerArmed = true;
    }
  }

  // Update all instances
  newState.instances = newState.instances.map(inst =>
    updateBurstInstance(inst, params, dt)
  );

  return newState;
};

/**
 * Get trigger input value for burst trigger type
 * @param trigger - Burst trigger type
 * @param audioData - Audio data object with peak, bass, mid, high values
 * @returns Trigger input value (0-1)
 */
export const getBurstTriggerValue = (
  trigger: BurstTrigger,
  audioData: { peak: number; bass: number; mid: number; high: number }
): number => {
  switch (trigger) {
    case 'audio.peak': return audioData.peak;
    case 'audio.bass': return audioData.bass;
    case 'audio.mid': return audioData.mid;
    case 'audio.high': return audioData.high;
    case 'manual': return 0;
    default: return 0;
  }
};

/**
 * Get active burst values (for shader uniforms)
 * Returns array of [value, age] pairs for active bursts
 */
export const getActiveBurstValues = (
  state: BurstEnvelopeState,
  currentTime: number
): { values: number[]; ages: number[]; actives: number[] } => {
  const values: number[] = [];
  const ages: number[] = [];
  const actives: number[] = [];

  for (const inst of state.instances) {
    values.push(inst.value);
    ages.push(inst.active ? currentTime - inst.spawnTime : 0);
    actives.push(inst.active ? 1 : 0);
  }

  return { values, ages, actives };
};

/**
 * Default burst envelope parameters
 */
export const DEFAULT_BURST_PARAMS: BurstEnvelopeParams = {
  attack: 0.05,
  hold: 0.05,
  decay: 0.5,
  trigger: 'audio.peak',
  threshold: 0.6,
  maxConcurrent: 8
};

/**
 * Get available burst triggers
 */
export const BURST_TRIGGERS: BurstTrigger[] = ['audio.peak', 'audio.bass', 'audio.mid', 'audio.high', 'manual'];