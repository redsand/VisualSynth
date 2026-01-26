import { describe, expect, it } from 'vitest';

const updateScore = (score: number, delta: number) => {
  if (delta > 24) return Math.min(1, score + 0.02);
  return Math.max(0, score - 0.01);
};

describe('watchdog scoring', () => {
  it('increases score on frame drops', () => {
    expect(updateScore(0, 40)).toBeGreaterThan(0);
  });

  it('decays score on stable frames', () => {
    expect(updateScore(0.5, 16)).toBeLessThan(0.5);
  });
});
