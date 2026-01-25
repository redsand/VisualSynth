import { describe, expect, it } from 'vitest';
import { applyModMatrix } from '../src/shared/modMatrix';
import { ModConnection } from '../src/shared/project';

describe('applyModMatrix', () => {
  it('applies linear modulation and clamps output', () => {
    const connections: ModConnection[] = [
      {
        id: 'mod-1',
        source: 'audio.rms',
        target: 'layer.plasma.intensity',
        amount: 0.8,
        curve: 'linear',
        smoothing: 0.1,
        bipolar: false,
        min: 0,
        max: 1
      }
    ];
    const result = applyModMatrix(0.2, 'layer.plasma.intensity', { 'audio.rms': 0.5 }, connections);
    expect(result).toBeCloseTo(0.6);
  });
});
