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
        smoothing: 0,
        bipolar: false,
        min: 0,
        max: 1
      }
    ];
    const result = applyModMatrix(0.2, 'layer.plasma.intensity', { 'audio.rms': 0.5 }, connections);
    expect(result).toBeCloseTo(0.6);
  });

  it('clamps to mod min/max', () => {
    const connections: ModConnection[] = [
      {
        id: 'mod-2',
        source: 'audio.rms',
        target: 'style.contrast',
        amount: 0,
        curve: 'linear',
        smoothing: 0,
        bipolar: false,
        min: 0.6,
        max: 1.4
      }
    ];
    const result = applyModMatrix(2, 'style.contrast', { 'audio.rms': 1 }, connections);
    expect(result).toBeCloseTo(1.4);
  });

  it('applies smoothing as dampening', () => {
    const connections: ModConnection[] = [
      {
        id: 'mod-3',
        source: 'audio.rms',
        target: 'style.contrast',
        amount: 1,
        curve: 'linear',
        smoothing: 0.5,
        bipolar: false,
        min: 0,
        max: 1
      }
    ];
    const result = applyModMatrix(0, 'style.contrast', { 'audio.rms': 1 }, connections);
    expect(result).toBeCloseTo(0.5);
  });
});
