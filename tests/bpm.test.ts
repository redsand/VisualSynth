import { describe, expect, it } from 'vitest';
import { clampBpmRange, fitBpmToRange } from '../src/shared/bpm';

describe('bpm helpers', () => {
  it('clamps bpm ranges and swaps if needed', () => {
    expect(clampBpmRange({ min: 20, max: 500 })).toEqual({ min: 40, max: 300 });
    expect(clampBpmRange({ min: 150, max: 80 })).toEqual({ min: 80, max: 150 });
  });

  it('fits bpm into range using halving/doubling', () => {
    expect(fitBpmToRange(240, { min: 80, max: 150 })).toBeCloseTo(120);
    expect(fitBpmToRange(60, { min: 80, max: 150 })).toBeCloseTo(120);
  });

  it('returns null when bpm cannot be fit', () => {
    expect(fitBpmToRange(40, { min: 95, max: 105 })).toBeNull();
  });
});
