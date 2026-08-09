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

  it('substitutes the fallback range when a connection carries the [0,1] schema default', () => {
    // Hand-edited / round-tripped file: connection omits the true range, so the
    // schema defaulted min/max to [0,1]. For a parameter whose natural range is
    // [0.6, 1.6] (style.contrast), clamping to [0,1] would cap the modulated
    // value at 1. With the fallback, the [0,1] default is replaced by [0.6,1.6].
    const connections: ModConnection[] = [
      {
        id: 'mod-4',
        source: 'audio.rms',
        target: 'style.contrast',
        amount: 1,
        curve: 'linear',
        smoothing: 0,
        bipolar: false,
        min: 0,
        max: 1
      }
    ];
    // base 0.6 + amount 1 * source 1 = 1.6 → clamped to fallback [0.6, 1.6] = 1.6.
    // Without the fallback it would clamp to [0,1] = 1.
    const result = applyModMatrix(0.6, 'style.contrast', { 'audio.rms': 1 }, connections, {
      min: 0.6,
      max: 1.6
    });
    expect(result).toBeCloseTo(1.6);
  });

  it('does not override an explicitly set non-[0,1] clamp with the fallback', () => {
    // The user deliberately narrowed the clamp to [0.8, 1.2]; fallback must not
    // widen it back to the parameter's full [0.6, 1.6] range.
    const connections: ModConnection[] = [
      {
        id: 'mod-5',
        source: 'audio.rms',
        target: 'style.contrast',
        amount: 1,
        curve: 'linear',
        smoothing: 0,
        bipolar: false,
        min: 0.8,
        max: 1.2
      }
    ];
    const result = applyModMatrix(0.6, 'style.contrast', { 'audio.rms': 1 }, connections, {
      min: 0.6,
      max: 1.6
    });
    expect(result).toBeCloseTo(1.2);
  });

  it('treats the fallback as a no-op when the parameter range is genuinely [0,1]', () => {
    // A genuine [0,1] parameter (e.g. opacity): connection clamp [0,1] equals
    // the fallback [0,1], so the substitution is a no-op and the explicit clamp
    // is preserved exactly.
    const connections: ModConnection[] = [
      {
        id: 'mod-6',
        source: 'audio.rms',
        target: 'layer-plasma.opacity',
        amount: 1,
        curve: 'linear',
        smoothing: 0,
        bipolar: false,
        min: 0,
        max: 1
      }
    ];
    const result = applyModMatrix(0.5, 'layer-plasma.opacity', { 'audio.rms': 1 }, connections, {
      min: 0,
      max: 1
    });
    expect(result).toBeCloseTo(1);
  });

  it('ignores the fallback entirely when none is provided (preserves legacy behavior)', () => {
    // No fallback: the connection's own [0,1] clamp is used as before, so a
    // modulated value of 1.6 clamps to 1. This is the behavior all pre-existing
    // callers (and the test suite) rely on.
    const connections: ModConnection[] = [
      {
        id: 'mod-7',
        source: 'audio.rms',
        target: 'style.contrast',
        amount: 1,
        curve: 'linear',
        smoothing: 0,
        bipolar: false,
        min: 0,
        max: 1
      }
    ];
    const result = applyModMatrix(0.6, 'style.contrast', { 'audio.rms': 1 }, connections);
    expect(result).toBeCloseTo(1);
  });
});
