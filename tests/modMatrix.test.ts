import { describe, expect, it } from 'vitest';
import { applyModMatrix, ModSmoothEntry } from '../src/shared/modMatrix';
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

  it('does NOT attenuate depth on a stateless one-shot (smoothing is temporal, not a depth cut)', () => {
    // Smoothing is now a per-connection exponential low-pass over TIME, which
    // requires a temporal context (dt + persistent state). A stateless one-shot
    // call has no prior sample to smooth against, so the raw contribution is
    // used as-is — full depth. The legacy behavior multiplied by (1 - smoothing),
    // a static depth cut that halved the modulation here (0.5) and, at smoothing=1,
    // silenced it entirely. That depth-killing semantics is gone.
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
    expect(result).toBeCloseTo(1);
  });

  it('temporal low-pass starts at full depth on the first frame (no lag without history)', () => {
    // With an empty state Map, prev defaults to raw, so contribution = raw
    // regardless of smoothing — the first frame is lag-free and at full depth.
    const connections: ModConnection[] = [
      {
        id: 'mod-3a',
        source: 'audio.rms',
        target: 'style.contrast',
        amount: 1,
        curve: 'linear',
        smoothing: 0.9,
        bipolar: false,
        min: 0,
        max: 1
      }
    ];
    const state = new Map<string, ModSmoothEntry>();
    const result = applyModMatrix(0, 'style.contrast', { 'audio.rms': 1 }, connections, undefined, {
      dt: 1 / 60,
      frame: 0,
      state
    });
    expect(result).toBeCloseTo(1);
    // State now holds the first-frame output for the next frame to smooth from.
    expect(state.get('mod-3a|style.contrast')!.value).toBeCloseTo(1);
  });

  it('temporal low-pass lags a step input and converges to full depth (no depth loss)', () => {
    // Prime the state as if last frame's output was 0, then step the input to 1.
    // The low-pass should settle toward 1 over frames — never reaching it in one
    // frame (that is the smoothing) but eventually arriving at full depth (that
    // is the fix: smoothing no longer caps the steady-state value).
    const connections: ModConnection[] = [
      {
        id: 'mod-3b',
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
    const state = new Map<string, ModSmoothEntry>([['mod-3b|style.contrast', { value: 0, frame: -1 }]]);
    // One frame after the step: partially settled, strictly between 0 and 1.
    const afterOne = applyModMatrix(0, 'style.contrast', { 'audio.rms': 1 }, connections, undefined, {
      dt: 1 / 60,
      frame: 0,
      state
    });
    expect(afterOne).toBeGreaterThan(0);
    expect(afterOne).toBeLessThan(1);
    // Simulate 120 more frames at the same input; the low-pass converges to ~1.
    // Each iteration must advance the frame token, otherwise the idempotency
    // guard would reuse frame 0's value and never progress.
    for (let f = 1; f <= 120; f++) {
      applyModMatrix(0, 'style.contrast', { 'audio.rms': 1 }, connections, undefined, {
        dt: 1 / 60,
        frame: f,
        state
      });
    }
    const settled = applyModMatrix(0, 'style.contrast', { 'audio.rms': 1 }, connections, undefined, {
      dt: 1 / 60,
      frame: 121,
      state
    });
    expect(settled).toBeCloseTo(1, 2);
  });

  it('higher smoothing lags more than lower smoothing over the same frames', () => {
    const make = (smoothing: number): ModConnection[] => [
      {
        id: 'mod-3c',
        source: 'audio.rms',
        target: 'style.contrast',
        amount: 1,
        curve: 'linear',
        smoothing,
        bipolar: false,
        min: 0,
        max: 1
      }
    ];
    const run = (smoothing: number) => {
      const state = new Map<string, ModSmoothEntry>([['mod-3c|style.contrast', { value: 0, frame: -1 }]]);
      let v = 0;
      for (let f = 0; f < 10; f++) {
        v = applyModMatrix(0, 'style.contrast', { 'audio.rms': 1 }, make(smoothing), undefined, {
          dt: 1 / 60,
          frame: f,
          state
        });
      }
      return v;
    };
    const low = run(0.3);
    const high = run(0.9);
    // Lower smoothing settles faster, so its 10-frame value is larger.
    expect(low).toBeGreaterThan(high);
    // Both are still progressing (neither has fully arrived in 10 frames).
    expect(low).toBeLessThan(1);
    expect(high).toBeGreaterThan(0);
  });

  it('is idempotent within a frame: repeated calls for the same (connection, target) reuse the smoothed value', () => {
    // A render path may resolve the same target twice in one frame (e.g. the
    // global-master and scene FX both read `effects.bloom`). The contribution
    // is independent of the base value, so both calls must return the SAME
    // smoothed contribution — the second call must NOT advance the low-pass
    // again (which would compound the smoothing rate).
    const connections: ModConnection[] = [
      {
        id: 'mod-3d',
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
    const state = new Map<string, ModSmoothEntry>([['mod-3d|style.contrast', { value: 0, frame: -1 }]]);
    const ctx = { dt: 1 / 60, frame: 5, state };
    const first = applyModMatrix(0, 'style.contrast', { 'audio.rms': 1 }, connections, undefined, ctx);
    const second = applyModMatrix(0, 'style.contrast', { 'audio.rms': 1 }, connections, undefined, ctx);
    expect(second).toBe(first);
    // The stored frame tag stays the shared frame, not bumped by the repeat.
    expect(state.get('mod-3d|style.contrast')!.frame).toBe(5);
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
