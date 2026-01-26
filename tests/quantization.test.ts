import { describe, expect, it } from 'vitest';
import { getBeatsUntil, getNextQuantizedTimeMs, getQuantizedBeatCount } from '../src/shared/quantization';

describe('quantization helpers', () => {
  it('computes quantized beat counts', () => {
    expect(getQuantizedBeatCount('quarter', 4)).toBe(1);
    expect(getQuantizedBeatCount('half', 4)).toBe(2);
    expect(getQuantizedBeatCount('bar', 4)).toBe(4);
  });

  it('schedules the next quantized time in the future', () => {
    const bpm = 120;
    const nowMs = 1000;
    const nextMs = getNextQuantizedTimeMs(nowMs, bpm, 'bar');
    expect(nextMs).toBeGreaterThan(nowMs);
  });

  it('calculates beats remaining', () => {
    const bpm = 120;
    const nowMs = 0;
    const targetMs = 1000;
    expect(getBeatsUntil(nowMs, targetMs, bpm)).toBeGreaterThan(0);
  });
});
