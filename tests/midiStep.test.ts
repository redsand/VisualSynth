import { describe, expect, it } from 'vitest';
import { createMidiStepState, stepFromCc, stepIndex } from '../src/shared/midiStep';

const feed = (values: number[]) => {
  const s = createMidiStepState();
  return values.map((v) => stepFromCc(s, v));
};

describe('MIDI dial → steps', () => {
  it('two\'s-complement endless encoder: 1 = +1, 127 = -1', () => {
    expect(feed([1, 1, 1, 127, 127])).toEqual([1, 1, 1, -1, -1]);
  });

  it('binary-offset endless encoder: 65 = +1, 63 = -1', () => {
    expect(feed([65, 65, 63])).toEqual([1, 1, -1]);
  });

  it('caps a fast spin so it cannot skip the whole list', () => {
    expect(feed([1, 20])[1]).toBeLessThanOrEqual(4);
  });

  it('absolute knob: steps every 8 counts in the direction turned, no jumps', () => {
    // a knob slowly turned up from mid-range, then back down
    const up = Array.from({ length: 24 }, (_, i) => 40 + i);       // 40..63
    const down = Array.from({ length: 24 }, (_, i) => 63 - i);     // 63..40
    const steps = feed([...up, ...down]);
    const total = steps.reduce((a, b) => a + b, 0);
    expect(Math.max(...steps.map(Math.abs))).toBeLessThanOrEqual(1);
    expect(Math.abs(total)).toBeLessThanOrEqual(1);                // came back where it started
    expect(steps.slice(0, 24).reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(2);
  });

  it('wraps indices in both directions', () => {
    expect(stepIndex(0, -1, 5)).toBe(4);
    expect(stepIndex(4, 1, 5)).toBe(0);
    expect(stepIndex(2, 7, 5)).toBe(4);
  });
});
