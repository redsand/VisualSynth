import { describe, expect, it } from 'vitest';
import { deriveMilkDropSeedColor } from '../src/renderer/milkdropRenderer';

describe('MilkDrop feedback seeding', () => {
  it('prefers explicit wave color parameters when present', () => {
    const seed = deriveMilkDropSeedColor(
      {
        wave_r: 0.8,
        wave_g: 0.4,
        wave_b: 0.2
      },
      [0.1, 0.9]
    );

    expect(seed).toEqual([0.8, 0.4, 0.2]);
  });

  it('falls back to deterministic non-black color when preset colors are absent', () => {
    const seed = deriveMilkDropSeedColor({}, [0.2, 0.6]);

    expect(seed[0]).toBeGreaterThan(0.1);
    expect(seed[1]).toBeGreaterThan(0.1);
    expect(seed[2]).toBeGreaterThan(0.1);
  });
});
