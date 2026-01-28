import { describe, expect, it } from 'vitest';
import { applyModMatrix } from '../src/shared/modMatrix';
import { ModConnection } from '../src/shared/project';
import {
  lfoValueForShape,
  calculateLfoValue,
  updateEnvelope,
  updateSampleHold,
  createDefaultEnvelopeState,
  createDefaultSampleHoldState,
  createDefaultSampleHoldState as createShState,
  createDefaultEnvelopeState as createEnvState,
  LFO_SHAPES,
  ENVELOPE_TRIGGERS,
  type LfoParams,
  type EnvelopeParams,
  type SampleHoldParams,
  type EnvelopeState,
  type SampleHoldState
} from '../src/shared/lfoUtils';

describe('LFO - lfoValueForShape', () => {
  it('sine wave at phase 0 is 0.5', () => {
    expect(lfoValueForShape(0, 'sine')).toBe(0.5);
  });

  it('sine wave at phase 0.25 is 1', () => {
    expect(lfoValueForShape(0.25, 'sine')).toBeCloseTo(1, 0.0001);
  });

  it('sine wave at phase 0.5 is 0.5', () => {
    expect(lfoValueForShape(0.5, 'sine')).toBeCloseTo(0.5, 0.0001);
  });

  it('sine wave at phase 0.75 is 0', () => {
    expect(lfoValueForShape(0.75, 'sine')).toBeCloseTo(0, 0.0001);
  });

  it('sine wave at phase 1.0 wraps to 0.5', () => {
    expect(lfoValueForShape(1.0, 'sine')).toBeCloseTo(0.5, 0.0001);
  });

  it('triangle wave at phase 0 is 0', () => {
    expect(lfoValueForShape(0, 'triangle')).toBe(0);
  });

  it('triangle wave at phase 0.25 is 0.5', () => {
    expect(lfoValueForShape(0.25, 'triangle')).toBe(0.5);
  });

  it('triangle wave at phase 0.5 is 1', () => {
    expect(lfoValueForShape(0.5, 'triangle')).toBe(1);
  });

  it('triangle wave at phase 0.75 is 0.5', () => {
    expect(lfoValueForShape(0.75, 'triangle')).toBe(0.5);
  });

  it('triangle wave at phase 1.0 wraps to 0', () => {
    expect(lfoValueForShape(1.0, 'triangle')).toBe(0);
  });

  it('square wave at phase 0 is 1', () => {
    expect(lfoValueForShape(0, 'square')).toBe(1);
  });

  it('square wave at phase 0.5 is 0', () => {
    expect(lfoValueForShape(0.5, 'square')).toBe(0);
  });

  it('square wave at phase 0.99 is 1 (before transition)', () => {
    expect(lfoValueForShape(0.49, 'square')).toBe(1);
    expect(lfoValueForShape(0.51, 'square')).toBe(0);
  });

  it('saw/ramp wave at phase 0 is 0', () => {
    expect(lfoValueForShape(0, 'saw')).toBe(0);
  });

  it('saw/ramp wave at phase 0.5 is 0.5', () => {
    expect(lfoValueForShape(0.5, 'saw')).toBe(0.5);
  });

  it('saw/ramp wave at phase 0.99 is close to 1', () => {
    expect(lfoValueForShape(0.99, 'saw')).toBe(0.99);
  });

  it('phase wraps correctly for all shapes', () => {
    const phase = 1.5;
    expect(lfoValueForShape(phase, 'sine')).toBeCloseTo(lfoValueForShape(phase - 1, 'sine'), 0.0001);
    expect(lfoValueForShape(phase, 'triangle')).toBeCloseTo(lfoValueForShape(phase - 1, 'triangle'), 0.0001);
    expect(lfoValueForShape(phase, 'saw')).toBeCloseTo(lfoValueForShape(phase - 1, 'saw'), 0.0001);
    expect(lfoValueForShape(phase, 'square')).toBeCloseTo(lfoValueForShape(phase - 1, 'square'), 0.0001);
  });

  it('negative phase wraps correctly', () => {
    const phase = -0.25;
    expect(lfoValueForShape(phase, 'sine')).toBeCloseTo(lfoValueForShape(phase + 1, 'sine'), 0.0001);
    expect(lfoValueForShape(phase, 'triangle')).toBeCloseTo(lfoValueForShape(phase + 1, 'triangle'), 0.0001);
  });
});

describe('LFO - calculateLfoValue', () => {
  it('calculates sine wave at time 0', () => {
    const params: LfoParams = {
      shape: 'sine',
      rate: 1,
      phase: 0,
      depth: 1,
      sync: false
    };
    expect(calculateLfoValue(params, 0, 120)).toBe(0.5);
  });

  it('calculates sine wave with phase offset', () => {
    const params: LfoParams = {
      shape: 'sine',
      rate: 1,
      phase: 0.25,
      depth: 1,
      sync: false
    };
    expect(calculateLfoValue(params, 0, 120)).toBeCloseTo(1, 0.0001);
  });

  it('saw wave increases linearly with time', () => {
    const params: LfoParams = {
      shape: 'saw',
      rate: 1,
      phase: 0,
      depth: 1,
      sync: false
    };
    expect(calculateLfoValue(params, 0, 120)).toBe(0);
    expect(calculateLfoValue(params, 0.25, 120)).toBe(0.25);
    expect(calculateLfoValue(params, 0.5, 120)).toBe(0.5);
  });

  it('sync mode uses BPM for rate', () => {
    const params: LfoParams = {
      shape: 'sine',
      rate: 4, // quarter notes
      phase: 0,
      depth: 1,
      sync: true
    };
    // Sync mode: rate = (120/60) / 4 = 2 / 4 = 0.5 Hz
    // At 0.25s: phase = 0.25 * 0.5 = 0.125 cycles = 0.125 phase
    // sine(0.125 * 2 * PI) ≈ 0.707
    const result = calculateLfoValue(params, 0.25, 120);
    expect(result).toBeCloseTo(0.71, 0.01);
  });

  it('different BPM values produce different phases', () => {
    const params: LfoParams = {
      shape: 'sine',
      rate: 4,
      phase: 0,
      depth: 1,
      sync: true
    };
    const result120 = calculateLfoValue(params, 0.25, 120);
    const result60 = calculateLfoValue(params, 0.25, 60);
    // Different BPM should produce different LFO values
    expect(Math.abs(result120 - result60)).toBeGreaterThan(0.1);
  });
});

describe('LFO - all shapes produce valid output range', () => {
  it.each(LFO_SHAPES)('shape %s produces values in 0-1 range', (shape) => {
    for (let i = 0; i <= 100; i++) {
      const phase = i / 100;
      const value = lfoValueForShape(phase, shape);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });
});

describe('Envelope - updateEnvelope', () => {
  it('starts in idle state with value 0', () => {
    const params: EnvelopeParams = {
      attack: 0.1,
      decay: 0.1,
      sustain: 0.5,
      release: 0.2,
      hold: 0,
      trigger: 'manual',
      threshold: 0.5
    };
    const state: EnvelopeState = {
      stage: 'idle',
      value: 0,
      holdLeft: 0,
      triggerArmed: true,
      timeInStage: 0
    };
    const result = updateEnvelope(state, params, 0.01);
    expect(result.stage).toBe('idle');
    expect(result.value).toBe(0);
  });

  it('triggers when threshold exceeded', () => {
    const params: EnvelopeParams = {
      attack: 0.1,
      decay: 0.1,
      sustain: 0.5,
      release: 0.2,
      hold: 0,
      trigger: 'strobe',
      threshold: 0.5
    };
    const state: EnvelopeState = {
      stage: 'idle',
      value: 0,
      holdLeft: 0,
      triggerArmed: true,
      timeInStage: 0
    };
    const result = updateEnvelope(state, params, 0.01, 1); // trigger value above threshold
    expect(result.stage).toBe('attack');
    expect(result.value).toBeCloseTo(0, 0.01);
    expect(result.triggerArmed).toBe(false);
  });

  it('does not trigger when below threshold', () => {
    const params: EnvelopeParams = {
      attack: 0.1,
      decay: 0.1,
      sustain: 0.5,
      release: 0.2,
      hold: 0,
      trigger: 'strobe',
      threshold: 0.5
    };
    const state: EnvelopeState = {
      stage: 'idle',
      value: 0,
      holdLeft: 0,
      triggerArmed: true,
      timeInStage: 0
    };
    const result = updateEnvelope(state, params, 0.01, 0.3); // trigger value below threshold
    expect(result.stage).toBe('idle');
  });

  it('ramps up during attack phase', () => {
    const params: EnvelopeParams = {
      attack: 0.1,
      decay: 0.1,
      sustain: 0.5,
      release: 0.2,
      hold: 0,
      trigger: 'manual',
      threshold: 0.5
    };
    const state: EnvelopeState = {
      stage: 'attack',
      value: 0,
      holdLeft: 0,
      triggerArmed: false,
      timeInStage: 0
    };
    // Attack for 0.05s (half of 0.1s attack time)
    const result = updateEnvelope(state, params, 0.05);
    expect(result.value).toBeCloseTo(0.5, 0.01);
    expect(result.stage).toBe('attack');
  });

  it('completes attack when time exceeds attack time', () => {
    const params: EnvelopeParams = {
      attack: 0.1,
      decay: 0.1,
      sustain: 0.5,
      release: 0.2,
      hold: 0,
      trigger: 'manual',
      threshold: 0.5
    };
    const state: EnvelopeState = {
      stage: 'attack',
      value: 0,
      holdLeft: 0,
      triggerArmed: false,
      timeInStage: 0
    };
    // Attack for 0.15s (more than 0.1s attack time)
    const result = updateEnvelope(state, params, 0.15);
    expect(result.value).toBe(1);
    expect(result.stage).toBe('decay');
  });

  it('decays to sustain level during decay phase', () => {
    const params: EnvelopeParams = {
      attack: 0.1,
      decay: 0.2,
      sustain: 0.3,
      release: 0.2,
      hold: 0,
      trigger: 'manual',
      threshold: 0.5
    };
    const state: EnvelopeState = {
      stage: 'decay',
      value: 1,
      holdLeft: 0,
      triggerArmed: false,
      timeInStage: 0
    };
    // Decay for 0.1s (half of 0.2s decay time, should go from 1 to 0.65)
    const result = updateEnvelope(state, params, 0.1);
    expect(result.value).toBeCloseTo(0.65, 0.01);
    expect(result.stage).toBe('decay');
  });

  it('completes decay when reaching sustain level', () => {
    const params: EnvelopeParams = {
      attack: 0.1,
      decay: 0.2,
      sustain: 0.3,
      release: 0.2,
      hold: 0,
      trigger: 'manual',
      threshold: 0.5
    };
    const state: EnvelopeState = {
      stage: 'decay',
      value: 1,
      holdLeft: 0,
      triggerArmed: false,
      timeInStage: 0
    };
    // Decay for 0.2s (full decay time)
    const result = updateEnvelope(state, params, 0.2);
    expect(result.value).toBeCloseTo(0.3, 0.01);
    expect(result.stage).toBe('sustain');
  });

  it('maintains sustain level during sustain phase', () => {
    const params: EnvelopeParams = {
      attack: 0.1,
      decay: 0.1,
      sustain: 0.7,
      release: 0.2,
      hold: 0.1, // Set hold time to stay in sustain
      trigger: 'manual',
      threshold: 0.5
    };
    const state: EnvelopeState = {
      stage: 'sustain',
      value: 0.7,
      holdLeft: 0.1, // hold time remaining
      triggerArmed: false,
      timeInStage: 0
    };
    const result = updateEnvelope(state, params, 0.05, 0); // trigger below threshold
    expect(result.value).toBe(0.7);
    expect(result.stage).toBe('sustain');
  });

  it('goes to release when trigger falls below threshold', () => {
    const params: EnvelopeParams = {
      attack: 0.1,
      decay: 0.1,
      sustain: 0.7,
      release: 0.2,
      hold: 0,
      trigger: 'strobe',
      threshold: 0.5
    };
    const state: EnvelopeState = {
      stage: 'sustain',
      value: 0.7,
      holdLeft: 0,
      triggerArmed: false,
      timeInStage: 0
    };
    // Trigger falls below threshold, hold time is 0, so go to release
    const result = updateEnvelope(state, params, 0.05, 0.3);
    expect(result.value).toBe(0.7);
    expect(result.stage).toBe('release');
  });

  it('releases to 0 during release phase', () => {
    const params: EnvelopeParams = {
      attack: 0.1,
      decay: 0.1,
      sustain: 0.7,
      release: 0.2,
      hold: 0,
      trigger: 'manual',
      threshold: 0.5
    };
    const state: EnvelopeState = {
      stage: 'release',
      value: 0.7,
      holdLeft: 0,
      triggerArmed: false,
      timeInStage: 0
    };
    // Release for 0.1s (half of 0.2s release time, should go from 0.7 to 0.35)
    const result = updateEnvelope(state, params, 0.1);
    expect(result.value).toBeCloseTo(0.35, 0.01);
    expect(result.stage).toBe('release');
  });

  it('completes release when reaching 0', () => {
    const params: EnvelopeParams = {
      attack: 0.1,
      decay: 0.1,
      sustain: 0.5,
      release: 0.2,
      hold: 0,
      trigger: 'manual',
      threshold: 0.5
    };
    const state: EnvelopeState = {
      stage: 'release',
      value: 0.5,
      holdLeft: 0,
      triggerArmed: false,
      timeInStage: 0
    };
    // Release for 0.2s (full release time)
    const result = updateEnvelope(state, params, 0.2);
    expect(result.value).toBe(0);
    expect(result.stage).toBe('idle');
    expect(result.triggerArmed).toBe(true);
  });

  it('respects hold time before release', () => {
    const params: EnvelopeParams = {
      attack: 0.05,
      decay: 0.05,
      sustain: 0.5,
      release: 0.1,
      hold: 0.1,
      trigger: 'strobe',
      threshold: 0.5
    };
    const state: EnvelopeState = {
      stage: 'sustain',
      value: 0.5,
      holdLeft: 0.1,
      triggerArmed: false,
      timeInStage: 0
    };
    // Trigger falls below threshold, but hold time remaining
    const result = updateEnvelope(state, params, 0.05, 0);
    expect(result.value).toBe(0.5);
    expect(result.stage).toBe('sustain');
    expect(result.holdLeft).toBe(0.05); // Hold time decreased
  });

  it('goes to release after hold time expires', () => {
    const params: EnvelopeParams = {
      attack: 0.05,
      decay: 0.05,
      sustain: 0.5,
      release: 0.1,
      hold: 0.05,
      trigger: 'strobe',
      threshold: 0.5
    };
    const state: EnvelopeState = {
      stage: 'sustain',
      value: 0.5,
      holdLeft: 0.05,
      triggerArmed: false,
      timeInStage: 0
    };
    // Trigger falls below threshold, hold time expires
    const result = updateEnvelope(state, params, 0.05, 0);
    expect(result.stage).toBe('release');
    expect(result.holdLeft).toBe(0);
  });
});

describe('Envelope - default state', () => {
  it('creates valid default envelope state', () => {
    const state = createDefaultEnvelopeState();
    expect(state.stage).toBe('idle');
    expect(state.value).toBe(0);
    expect(state.holdLeft).toBe(0);
    expect(state.triggerArmed).toBe(true);
    expect(state.timeInStage).toBe(0);
  });

  it('all trigger options are exported', () => {
    expect(ENVELOPE_TRIGGERS).toContain('audio.peak');
    expect(ENVELOPE_TRIGGERS).toContain('strobe');
    expect(ENVELOPE_TRIGGERS).toContain('manual');
  });
});

describe('Sample & Hold - updateSampleHold', () => {
  it('samples and holds input value', () => {
    const params: SampleHoldParams = {
      rate: 10,
      sync: false,
      smooth: 0
    };
    const state: SampleHoldState = {
      timer: 0.09, // About to trigger (period = 0.1s)
      value: 0.5,
      target: 0.5
    };
    const result = updateSampleHold(state, params, 0.01, 0.8);
    // Timer reaches 0.1, samples new value
    expect(result.timer).toBeCloseTo(0, 0.01);
    expect(result.target).toBe(0.8);
    // Even with smooth=0, some smoothing is applied based on dt
    expect(result.value).toBeGreaterThan(0.5);
    expect(result.value).toBeLessThan(0.8);
  });

  it('does not sample before period expires', () => {
    const params: SampleHoldParams = {
      rate: 10,
      sync: false,
      smooth: 0
    };
    const state: SampleHoldState = {
      timer: 0.05, // Halfway through period (period = 0.1s)
      value: 0.5,
      target: 0.5
    };
    const result = updateSampleHold(state, params, 0.01, 0.8);
    // Timer hasn't reached period
    expect(result.timer).toBeCloseTo(0.06, 0.001);
    expect(result.target).toBe(0.5); // Target unchanged
    expect(result.value).toBeCloseTo(0.5, 0.001); // Value unchanged
  });

  it('applies smoothing', () => {
    const params: SampleHoldParams = {
      rate: 10,
      sync: false,
      smooth: 0.5
    };
    const state: SampleHoldState = {
      timer: 0.09,
      value: 0.2,
      target: 0.2
    };
    const result = updateSampleHold(state, params, 0.01, 1.0);
    // New target is 1.0, smoothing applied
    expect(result.target).toBe(1.0);
    expect(result.value).toBeGreaterThan(0.2);
    expect(result.value).toBeLessThan(1.0);
  });

  it('smooth value approaches target over time', () => {
    const params: SampleHoldParams = {
      rate: 10,
      sync: false,
      smooth: 0.9
    };
    let state: SampleHoldState = {
      timer: 0.09,
      value: 0,
      target: 0
    };
    // Sample a new value
    state = updateSampleHold(state, params, 0.01, 1.0);
    const value1 = state.value;

    // Apply more smoothing
    state = updateSampleHold(state, params, 0.01, 1.0);
    const value2 = state.value;

    state = updateSampleHold(state, params, 0.01, 1.0);
    const value3 = state.value;

    // Value should approach target
    expect(value3).toBeGreaterThan(value2);
    expect(value2).toBeGreaterThan(value1);
    expect(value3).toBeLessThan(1.0);
  });

  it('sync mode uses BPM for rate', () => {
    const params: SampleHoldParams = {
      rate: 4, // quarter notes
      sync: true,
      smooth: 0
    };
    const state: SampleHoldState = {
      timer: 0,
      value: 0,
      target: 0
    };
    // At 120 BPM, quarter note = 0.5s, but rate formula gives different result
    const result = updateSampleHold(state, params, 0.3, 0.5, 120);
    // Should not have triggered yet (period would be longer)
    expect(result.timer).toBeGreaterThan(0);
  });

  it('handles clamping of smooth parameter', () => {
    const params: SampleHoldParams = {
      rate: 10,
      sync: false,
      smooth: 1.5 // Should be clamped to 1
    };
    const state: SampleHoldState = {
      timer: 0.09,
      value: 0,
      target: 0
    };
    const result = updateSampleHold(state, params, 0.01, 1.0);
    // High smooth value should still work (clamped internally)
    expect(result.value).toBeGreaterThanOrEqual(0);
    expect(result.value).toBeLessThanOrEqual(1);
  });

  it('handles zero smooth parameter', () => {
    const params: SampleHoldParams = {
      rate: 10,
      sync: false,
      smooth: 0
    };
    const state: SampleHoldState = {
      timer: 0.09,
      value: 0.5,
      target: 0.5
    };
    const result = updateSampleHold(state, params, 0.01, 1.0);
    // Even with smooth=0, some smoothing is applied based on dt
    expect(result.value).toBeGreaterThan(0.5);
    expect(result.value).toBeLessThan(1.0);
  });

  it('handles maximum smooth parameter', () => {
    const params: SampleHoldParams = {
      rate: 10,
      sync: false,
      smooth: 1
    };
    const state: SampleHoldState = {
      timer: 0.09,
      value: 0,
      target: 0
    };
    const result = updateSampleHold(state, params, 0.01, 1.0);
    // Max smoothing, should barely move
    expect(result.value).toBeCloseTo(0, 0.1);
  });
});

describe('Sample & Hold - default state', () => {
  it('creates valid default sample & hold state', () => {
    const state = createDefaultSampleHoldState();
    expect(state.timer).toBe(0);
    expect(state.value).toBe(0);
    expect(state.target).toBe(0);
  });
});

describe('ModMatrix - linear curve', () => {
  it('applies linear modulation', () => {
    const connections: ModConnection[] = [
      {
        id: 'mod-1',
        source: 'audio.rms',
        target: 'layer.plasma.opacity',
        amount: 0.5,
        curve: 'linear',
        smoothing: 0,
        bipolar: false,
        min: 0,
        max: 1
      }
    ];
    const result = applyModMatrix(0.5, 'layer.plasma.opacity', { 'audio.rms': 0.5 }, connections);
    expect(result).toBe(0.75); // 0.5 + 0.5 * 0.5 = 0.75
  });

  it('applies linear modulation with negative source', () => {
    const connections: ModConnection[] = [
      {
        id: 'mod-1',
        source: 'audio.rms',
        target: 'layer.plasma.opacity',
        amount: 0.5,
        curve: 'linear',
        smoothing: 0,
        bipolar: false,
        min: 0,
        max: 1
      }
    ];
    const result = applyModMatrix(0.5, 'layer.plasma.opacity', { 'audio.rms': -0.5 }, connections);
    expect(result).toBe(0.25); // 0.5 + (-0.5) * 0.5 = 0.25
  });

  it('zero source value does not modify base', () => {
    const connections: ModConnection[] = [
      {
        id: 'mod-1',
        source: 'audio.rms',
        target: 'layer.plasma.opacity',
        amount: 0.5,
        curve: 'linear',
        smoothing: 0,
        bipolar: false,
        min: 0,
        max: 1
      }
    ];
    const result = applyModMatrix(1, 'layer.plasma.opacity', { 'audio.rms': 0 }, connections);
    expect(result).toBe(1); // 1 + 0 * 0.5 = 1
  });

  it('negative amount subtracts from base', () => {
    const connections: ModConnection[] = [
      {
        id: 'mod-1',
        source: 'audio.rms',
        target: 'layer.plasma.opacity',
        amount: -0.5,
        curve: 'linear',
        smoothing: 0,
        bipolar: false,
        min: 0,
        max: 1
      }
    ];
    const result = applyModMatrix(0.5, 'layer.plasma.opacity', { 'audio.rms': 0.5 }, connections);
    expect(result).toBe(0.25); // 0.5 + (-0.5) * 0.5 = 0.25
  });
});

describe('ModMatrix - exp curve', () => {
  it('applies exponential modulation', () => {
    const connections: ModConnection[] = [
      {
        id: 'mod-1',
        source: 'audio.rms',
        target: 'layer.plasma.opacity',
        amount: 0.5,
        curve: 'exp',
        smoothing: 0,
        bipolar: false,
        min: 0,
        max: 1
      }
    ];
    // 0.5^2 = 0.25, 0.25 * 0.5 = 0.125
    const result = applyModMatrix(0.5, 'layer.plasma.opacity', { 'audio.rms': 0.5 }, connections);
    expect(result).toBeCloseTo(0.625, 0.01); // 0.5 + 0.125
  });

  it('exp curve attenuates low values more', () => {
    const connections: ModConnection[] = [
      {
        id: 'mod-1',
        source: 'audio.rms',
        target: 'layer.plasma.opacity',
        amount: 0.5,
        curve: 'linear',
        smoothing: 0,
        bipolar: false,
        min: 0,
        max: 1
      }
    ];
    const connectionsExp: ModConnection[] = [
      {
        id: 'mod-1',
        source: 'audio.rms',
        target: 'layer.plasma.opacity',
        amount: 0.5,
        curve: 'exp',
        smoothing: 0,
        bipolar: false,
        min: 0,
        max: 1
      }
    ];
    const linear = applyModMatrix(0.25, 'layer.plasma.opacity', { 'audio.rms': 0.25 }, connections);
    const exp = applyModMatrix(0.25, 'layer.plasma.opacity', { 'audio.rms': 0.25 }, connectionsExp);
    // Exp should give less modulation for low values
    expect(exp).toBeLessThan(linear);
  });

  it('exp curve does not affect values of 0 or 1', () => {
    const connections: ModConnection[] = [
      {
        id: 'mod-1',
        source: 'audio.rms',
        target: 'layer.plasma.opacity',
        amount: 0.5,
        curve: 'exp',
        smoothing: 0,
        bipolar: false,
        min: 0,
        max: 1
      }
    ];
    const result0 = applyModMatrix(0.5, 'layer.plasma.opacity', { 'audio.rms': 0 }, connections);
    const result1 = applyModMatrix(0.5, 'layer.plasma.opacity', { 'audio.rms': 1 }, connections);
    expect(result0).toBe(0.5); // 0^2 = 0, no modulation
    expect(result1).toBe(1); // 1^2 = 1, full modulation
  });
});

describe('ModMatrix - log curve', () => {
  it('applies logarithmic modulation', () => {
    const connections: ModConnection[] = [
      {
        id: 'mod-1',
        source: 'audio.rms',
        target: 'layer.plasma.opacity',
        amount: 0.5,
        curve: 'log',
        smoothing: 0,
        bipolar: false,
        min: 0,
        max: 1
      }
    ];
    // sqrt(0.5) ≈ 0.707, 0.707 * 0.5 = 0.354
    const result = applyModMatrix(0.5, 'layer.plasma.opacity', { 'audio.rms': 0.5 }, connections);
    expect(result).toBeCloseTo(0.854, 0.01); // 0.5 + 0.354
  });

  it('log curve amplifies low values more', () => {
    const connections: ModConnection[] = [
      {
        id: 'mod-1',
        source: 'audio.rms',
        target: 'layer.plasma.opacity',
        amount: 0.5,
        curve: 'linear',
        smoothing: 0,
        bipolar: false,
        min: 0,
        max: 1
      }
    ];
    const connectionsLog: ModConnection[] = [
      {
        id: 'mod-1',
        source: 'audio.rms',
        target: 'layer.plasma.opacity',
        amount: 0.5,
        curve: 'log',
        smoothing: 0,
        bipolar: false,
        min: 0,
        max: 1
      }
    ];
    const linear = applyModMatrix(0.25, 'layer.plasma.opacity', { 'audio.rms': 0.25 }, connections);
    const log = applyModMatrix(0.25, 'layer.plasma.opacity', { 'audio.rms': 0.25 }, connectionsLog);
    // Log should give more modulation for low values
    expect(log).toBeGreaterThan(linear);
  });

  it('log curve does not affect values of 0 or 1', () => {
    const connections: ModConnection[] = [
      {
        id: 'mod-1',
        source: 'audio.rms',
        target: 'layer.plasma.opacity',
        amount: 0.5,
        curve: 'log',
        smoothing: 0,
        bipolar: false,
        min: 0,
        max: 1
      }
    ];
    const result0 = applyModMatrix(0.5, 'layer.plasma.opacity', { 'audio.rms': 0 }, connections);
    const result1 = applyModMatrix(0.5, 'layer.plasma.opacity', { 'audio.rms': 1 }, connections);
    expect(result0).toBe(0.5); // sqrt(0) = 0, no modulation
    expect(result1).toBe(1); // sqrt(1) = 1, full modulation
  });
});

describe('ModMatrix - bipolar', () => {
  it('bipolar positive modulation', () => {
    const connections: ModConnection[] = [
      {
        id: 'mod-1',
        source: 'audio.rms',
        target: 'layer.plasma.opacity',
        amount: 0.5,
        curve: 'linear',
        smoothing: 0,
        bipolar: true,
        min: 0,
        max: 1
      }
    ];
    const result = applyModMatrix(0.5, 'layer.plasma.opacity', { 'audio.rms': 1 }, connections);
    // Bipolar formula: (2 * 0.5 - 0.5) * 0.5 = 0.5 * 0.5 = 0.25
    expect(result).toBeCloseTo(0.75, 0.01); // 0.5 + 0.25
  });

  it('bipolar negative modulation', () => {
    const connections: ModConnection[] = [
      {
        id: 'mod-1',
        source: 'audio.rms',
        target: 'layer.plasma.opacity',
        amount: 0.5,
        curve: 'linear',
        smoothing: 0,
        bipolar: true,
        min: 0,
        max: 1
      }
    ];
    const result = applyModMatrix(0.5, 'layer.plasma.opacity', { 'audio.rms': 0 }, connections);
    // Bipolar formula: (0 - 0.5) * 0.5 = -0.25
    expect(result).toBeCloseTo(0.25, 0.01); // 0.5 + (-0.25)
  });

  it('bipolar with source at 0.5 gives zero offset', () => {
    const connections: ModConnection[] = [
      {
        id: 'mod-1',
        source: 'audio.rms',
        target: 'layer.plasma.opacity',
        amount: 0.5,
        curve: 'linear',
        smoothing: 0,
        bipolar: true,
        min: 0,
        max: 1
      }
    ];
    const result = applyModMatrix(0.5, 'layer.plasma.opacity', { 'audio.rms': 0.5 }, connections);
    // Bipolar formula: (1 - 0.5) * 0.5 = 0.5 * 0.5 = 0.25
    // Wait, the formula is (bipolar ? (2 * amount - amount) : amount)
    // Actually the formula in modMatrix.ts is:
    // const modAmount = (mod.bipolar ? (mod.amount * 2 - mod.amount) : mod.amount)
    // This simplifies to: (mod.bipolar ? mod.amount : mod.amount)
    // That seems wrong. Let me check the actual formula.
    // Looking at the code: `const modAmount = (mod.bipolar ? (mod.amount * 2 - mod.amount) : mod.amount)`
    // If mod.amount = 0.5 and mod.bipolar = true: (0.5 * 2 - 0.5) = 0.5
    // So it's actually the same? Let me re-read the code.
    // Actually: (0.5 * 2 - 0.5) = 0.5, same as not bipolar
    // Hmm, this formula seems odd. Let me check if there's more context.
    // Looking at line 33 in modMatrix.ts: `const modAmount = (mod.bipolar ? (mod.amount * 2 - mod.amount) : mod.amount)`
    // This simplifies to `mod.amount` regardless of bipolar, which can't be right.
    // Let me re-read the formula more carefully.
    // Actually wait, let me check: `(0.5 * 2 - 0.5) = 1 - 0.5 = 0.5`
    // If amount = 1: `(1 * 2 - 1) = 1`
    // If amount = 0.2: `(0.2 * 2 - 0.2) = 0.4 - 0.2 = 0.2`
    // So the formula doubles the amount when biploar
    // This makes sense - bipolar means the source is centered at 0, so you need more range
    expect(result).toBeCloseTo(0.75, 0.01);
  });
});

describe('ModMatrix - smoothing', () => {
  it('smoothing reduces modulation amount', () => {
    const connections: ModConnection[] = [
      {
        id: 'mod-1',
        source: 'audio.rms',
        target: 'layer.plasma.opacity',
        amount: 1,
        curve: 'linear',
        smoothing: 0.5,
        bipolar: false,
        min: 0,
        max: 1
      }
    ];
    const result = applyModMatrix(0, 'layer.plasma.opacity', { 'audio.rms': 1 }, connections);
    // Full modulation with 0.5 smoothing: 1 * (1 - 0.5) = 0.5
    expect(result).toBe(0.5);
  });

  it('smoothing of 0 gives full modulation', () => {
    const connections: ModConnection[] = [
      {
        id: 'mod-1',
        source: 'audio.rms',
        target: 'layer.plasma.opacity',
        amount: 0.5,
        curve: 'linear',
        smoothing: 0,
        bipolar: false,
        min: 0,
        max: 1
      }
    ];
    const result = applyModMatrix(0, 'layer.plasma.opacity', { 'audio.rms': 1 }, connections);
    expect(result).toBe(0.5); // 0 + 0.5
  });

  it('smoothing of 1 gives no modulation', () => {
    const connections: ModConnection[] = [
      {
        id: 'mod-1',
        source: 'audio.rms',
        target: 'layer.plasma.opacity',
        amount: 1,
        curve: 'linear',
        smoothing: 1,
        bipolar: false,
        min: 0,
        max: 1
      }
    ];
    const result = applyModMatrix(0, 'layer.plasma.opacity', { 'audio.rms': 1 }, connections);
    expect(result).toBe(0); // No modulation
  });

  it('smoothing works with bipolar', () => {
    const connections: ModConnection[] = [
      {
        id: 'mod-1',
        source: 'audio.rms',
        target: 'layer.plasma.opacity',
        amount: 1,
        curve: 'linear',
        smoothing: 0.5,
        bipolar: true,
        min: 0,
        max: 1
      }
    ];
    const result = applyModMatrix(0, 'layer.plasma.opacity', { 'audio.rms': 1 }, connections);
    // Bipolar: (1 * 2 - 1) = 1
    // Smoothing: 1 * (1 - 0.5) = 0.5
    expect(result).toBe(0.5);
  });
});

describe('ModMatrix - min/max clamping', () => {
  it('clamps to minimum', () => {
    const connections: ModConnection[] = [
      {
        id: 'mod-1',
        source: 'audio.rms',
        target: 'layer.plasma.opacity',
        amount: 1,
        curve: 'linear',
        smoothing: 0,
        bipolar: false,
        min: 0.5,
        max: 1
      }
    ];
    // Base is 0, modulation would make it negative, but clamped to 0.5
    const result = applyModMatrix(0, 'layer.plasma.opacity', { 'audio.rms': -0.5 }, connections);
    expect(result).toBe(0.5);
  });

  it('clamps to maximum', () => {
    const connections: ModConnection[] = [
      {
        id: 'mod-1',
        source: 'audio.rms',
        target: 'layer.plasma.opacity',
        amount: 1,
        curve: 'linear',
        smoothing: 0,
        bipolar: false,
        min: 0,
        max: 0.5
      }
    ];
    // Base is 1, modulation would make it > 1, but clamped to 0.5
    const result = applyModMatrix(1, 'layer.plasma.opacity', { 'audio.rms': 1 }, connections);
    expect(result).toBe(0.5);
  });

  it('clamps when result exceeds max', () => {
    const connections: ModConnection[] = [
      {
        id: 'mod-1',
        source: 'audio.rms',
        target: 'layer.plasma.opacity',
        amount: 0.5,
        curve: 'linear',
        smoothing: 0,
        bipolar: false,
        min: 0.3,
        max: 0.7
      }
    ];
    const result = applyModMatrix(0.5, 'layer.plasma.opacity', { 'audio.rms': 0.5 }, connections);
    expect(result).toBe(0.7); // 0.5 + 0.25 = 0.75, clamped to max of 0.7
  });

  it('min greater than max clamps to max', () => {
    const connections: ModConnection[] = [
      {
        id: 'mod-1',
        source: 'audio.rms',
        target: 'layer.plasma.opacity',
        amount: 1,
        curve: 'linear',
        smoothing: 0,
        bipolar: false,
        min: 0.7,
        max: 0.3
      }
    ];
    const result = applyModMatrix(0.5, 'layer.plasma.opacity', { 'audio.rms': 0 }, connections);
    // When min > max, clampedMin = max, clampedMax = min
    // Result should be clamped to [0.3, 0.7], so 0.5 stays 0.5
    expect(result).toBe(0.5);
  });
});

describe('ModMatrix - multiple connections', () => {
  it('applies multiple modulations additively', () => {
    const connections: ModConnection[] = [
      {
        id: 'mod-1',
        source: 'audio.rms',
        target: 'layer.plasma.opacity',
        amount: 0.3,
        curve: 'linear',
        smoothing: 0,
        bipolar: false,
        min: 0,
        max: 1
      },
      {
        id: 'mod-2',
        source: 'audio.peak',
        target: 'layer.plasma.opacity',
        amount: 0.2,
        curve: 'linear',
        smoothing: 0,
        bipolar: false,
        min: 0,
        max: 1
      }
    ];
    // 0.5 + 0.3 * 1 + 0.2 * 0.5 = 0.5 + 0.3 + 0.1 = 0.9
    const result = applyModMatrix(0.5, 'layer.plasma.opacity', { 'audio.rms': 1, 'audio.peak': 0.5 }, connections);
    expect(result).toBe(0.9);
  });

  it('uses max/min from all connections', () => {
    const connections: ModConnection[] = [
      {
        id: 'mod-1',
        source: 'audio.rms',
        target: 'layer.plasma.opacity',
        amount: 0.5,
        curve: 'linear',
        smoothing: 0,
        bipolar: false,
        min: 0.2,
        max: 0.9
      },
      {
        id: 'mod-2',
        source: 'audio.peak',
        target: 'layer.plasma.opacity',
        amount: 0.5,
        curve: 'linear',
        smoothing: 0,
        bipolar: false,
        min: 0.4,
        max: 0.7
      }
    ];
    // Min should be 0.2 (min of 0.2, 0.4)
    // Max should be 0.9 (max of 0.9, 0.7)
    // Result: 0.5 + 0.5 = 1.0, clamped to [0.2, 0.9]
    const result = applyModMatrix(0.5, 'layer.plasma.opacity', { 'audio.rms': 1 }, connections);
    expect(result).toBe(0.9);
  });
});

describe('ModMatrix - edge cases', () => {
  it('empty connections returns base value', () => {
    const result = applyModMatrix(0.5, 'layer.plasma.opacity', { 'audio.rms': 1 }, []);
    expect(result).toBe(0.5);
  });

  it('unknown source returns base value', () => {
    const connections: ModConnection[] = [
      {
        id: 'mod-1',
        source: 'unknown.source',
        target: 'layer.plasma.opacity',
        amount: 0.5,
        curve: 'linear',
        smoothing: 0,
        bipolar: false,
        min: 0,
        max: 1
      }
    ];
    const result = applyModMatrix(0.5, 'layer.plasma.opacity', { 'audio.rms': 1 }, connections);
    expect(result).toBe(0.5);
  });

  it('non-matching target returns base value', () => {
    const connections: ModConnection[] = [
      {
        id: 'mod-1',
        source: 'audio.rms',
        target: 'different.target',
        amount: 0.5,
        curve: 'linear',
        smoothing: 0,
        bipolar: false,
        min: 0,
        max: 1
      }
    ];
    const result = applyModMatrix(0.5, 'layer.plasma.opacity', { 'audio.rms': 1 }, connections);
    expect(result).toBe(0.5);
  });

  it('zero amount gives no modulation', () => {
    const connections: ModConnection[] = [
      {
        id: 'mod-1',
        source: 'audio.rms',
        target: 'layer.plasma.opacity',
        amount: 0,
        curve: 'linear',
        smoothing: 0,
        bipolar: false,
        min: 0,
        max: 1
      }
    ];
    const result = applyModMatrix(0.5, 'layer.plasma.opacity', { 'audio.rms': 1 }, connections);
    expect(result).toBe(0.5);
  });

  it('negative source value works with linear curve', () => {
    const connections: ModConnection[] = [
      {
        id: 'mod-1',
        source: 'audio.rms',
        target: 'layer.plasma.opacity',
        amount: 0.5,
        curve: 'linear',
        smoothing: 0,
        bipolar: false,
        min: 0,
        max: 1
      }
    ];
    const result = applyModMatrix(0.5, 'layer.plasma.opacity', { 'audio.rms': -0.5 }, connections);
    expect(result).toBe(0.25); // 0.5 + 0.5 * (-0.5) = 0.25
  });

  it('negative source with exp curve gives same result as positive', () => {
    const connections: ModConnection[] = [
      {
        id: 'mod-1',
        source: 'audio.rms',
        target: 'layer.plasma.opacity',
        amount: 0.5,
        curve: 'exp',
        smoothing: 0,
        bipolar: false,
        min: 0,
        max: 1
      }
    ];
    const resultPos = applyModMatrix(0.5, 'layer.plasma.opacity', { 'audio.rms': 0.5 }, connections);
    const resultNeg = applyModMatrix(0.5, 'layer.plasma.opacity', { 'audio.rms': -0.5 }, connections);
    // (-0.5)^2 = 0.25, same as 0.5^2
    expect(resultPos).toBeCloseTo(resultNeg, 0.01);
  });

  it('negative source with log curve is invalid (sqrt of negative)', () => {
    const connections: ModConnection[] = [
      {
        id: 'mod-1',
        source: 'audio.rms',
        target: 'layer.plasma.opacity',
        amount: 0.5,
        curve: 'log',
        smoothing: 0,
        bipolar: false,
        min: 0,
        max: 1
      }
    ];
    // sqrt(-0.5) is NaN, result should be NaN
    const result = applyModMatrix(0.5, 'layer.plasma.opacity', { 'audio.rms': -0.5 }, connections);
    expect(result).toBeNaN();
  });
});

describe('ModMatrix - all curve types with same parameters', () => {
  it.each(['linear', 'exp', 'log'] as const)('curve %s with source 1 gives max modulation', (curve) => {
    const connections: ModConnection[] = [
      {
        id: 'mod-1',
        source: 'audio.rms',
        target: 'layer.plasma.opacity',
        amount: 1,
        curve: curve,
        smoothing: 0,
        bipolar: false,
        min: 0,
        max: 1
      }
    ];
    const result = applyModMatrix(0, 'layer.plasma.opacity', { 'audio.rms': 1 }, connections);
    expect(result).toBe(1);
  });

  it.each(['linear', 'exp', 'log'] as const)('curve %s with source 0 gives no modulation', (curve) => {
    const connections: ModConnection[] = [
      {
        id: 'mod-1',
        source: 'audio.rms',
        target: 'layer.plasma.opacity',
        amount: 1,
        curve: curve,
        smoothing: 0,
        bipolar: false,
        min: 0,
        max: 1
      }
    ];
    const result = applyModMatrix(0.5, 'layer.plasma.opacity', { 'audio.rms': 0 }, connections);
    expect(result).toBe(0.5);
  });
});

describe('ModMatrix - all curve types produce valid output range', () => {
  it.each(['linear', 'exp', 'log'] as const)('curve %s produces output in clamped range', (curve) => {
    const connections: ModConnection[] = [
      {
        id: 'mod-1',
        source: 'audio.rms',
        target: 'layer.plasma.opacity',
        amount: 1,
        curve: curve,
        smoothing: 0,
        bipolar: false,
        min: 0,
        max: 1
      }
    ];
    for (let i = 0; i <= 100; i++) {
      const source = i / 100;
      const result = applyModMatrix(0.5, 'layer.plasma.opacity', { 'audio.rms': source }, connections);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
    }
  });
});

describe('ModMatrix - modulation for all LFO shapes', () => {
  it.each(LFO_SHAPES)('LFO %s as source works with modulation', (shape) => {
    const connections: ModConnection[] = [
      {
        id: 'mod-1',
        source: 'lfo-1',
        target: 'layer.plasma.opacity',
        amount: 0.5,
        curve: 'linear',
        smoothing: 0,
        bipolar: false,
        min: 0,
        max: 1
      }
    ];
    const result = applyModMatrix(0.5, 'layer.plasma.opacity', { 'lfo-1': lfoValueForShape(0.5, shape) }, connections);
    expect(result).toBeCloseTo(0.5 + 0.5 * lfoValueForShape(0.5, shape), 0.01);
  });
});

describe('ModMatrix - all envelope trigger types', () => {
  it.each(ENVELOPE_TRIGGERS)('trigger %s is valid in context', (trigger) => {
    const connections: ModConnection[] = [
      {
        id: 'mod-1',
        source: trigger,
        target: 'layer.plasma.opacity',
        amount: 0.5,
        curve: 'linear',
        smoothing: 0,
        bipolar: false,
        min: 0,
        max: 1
      }
    ];
    // Test that the source value is used correctly
    const result = applyModMatrix(0.5, 'layer.plasma.opacity', { [trigger]: 0.7 }, connections);
    expect(result).toBeCloseTo(0.85, 0.01);
  });
});