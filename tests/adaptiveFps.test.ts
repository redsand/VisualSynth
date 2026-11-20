import { describe, expect, it } from 'vitest';
import {
  createAdaptiveFpsState,
  tickFpsGovernor,
  shouldRenderFrame,
  ENGAGE_BELOW_FPS,
  ENGAGE_CAP,
  ENGAGE_CONSECUTIVE_S,
  MIN_DWELL_MS,
  RELEASE_STABLE_S
} from '../src/shared/adaptiveFps';

describe('adaptiveFps governor', () => {
  it('engages the cap after sustained fps sag', () => {
    const state = createAdaptiveFpsState();
    // Healthy fps: no engagement
    let d = tickFpsGovernor(state, { deliveredFps: 60, renderWorkMs: 10, nowMs: 1000, dtS: 1 });
    expect(d.cap).toBe(0);
    expect(d.transition).toBeNull();
    // Sag: below threshold each second
    for (let i = 2; i < 2 + ENGAGE_CONSECUTIVE_S; i += 1) {
      d = tickFpsGovernor(state, { deliveredFps: ENGAGE_BELOW_FPS - 5, renderWorkMs: 20, nowMs: i * 1000, dtS: 1 });
    }
    expect(d.cap).toBe(ENGAGE_CAP);
    expect(d.transition).toBe('engage');
  });

  it('does not engage on a single bad second (hysteresis)', () => {
    const state = createAdaptiveFpsState();
    const d = tickFpsGovernor(state, { deliveredFps: 20, renderWorkMs: 20, nowMs: 1000, dtS: 1 });
    expect(d.transition).toBeNull();
    expect(d.cap).toBe(0);
  });

  it('releases when frame work shows headroom at the cap', () => {
    const state = createAdaptiveFpsState();
    // Engage first (work is expensive — contended)
    for (let i = 1; i <= ENGAGE_CONSECUTIVE_S; i += 1) {
      tickFpsGovernor(state, { deliveredFps: 30, renderWorkMs: 30, nowMs: i * 1000, dtS: 1 });
    }
    expect(state.cap).toBe(ENGAGE_CAP);
    // Past the minimum dwell: cheap frames. The work EMA needs ~4-5
    // seconds to converge from the contended mean before the stability
    // streak can start, so allow convergence + the full stable window.
    const base = ENGAGE_CONSECUTIVE_S * 1000 + MIN_DWELL_MS;
    let d = { cap: state.cap, transition: null as null | string };
    let sawRelease = false;
    for (let i = 0; i < RELEASE_STABLE_S + 8; i += 1) {
      d = tickFpsGovernor(state, { deliveredFps: ENGAGE_CAP, renderWorkMs: 6, nowMs: base + i * 1000, dtS: 1 });
      if (d.transition === 'release') sawRelease = true;
    }
    expect(d.cap).toBe(0);
    expect(sawRelease).toBe(true);
  });

  it('stays capped while frames remain expensive (contention persists)', () => {
    const state = createAdaptiveFpsState();
    for (let i = 1; i <= ENGAGE_CONSECUTIVE_S; i += 1) {
      tickFpsGovernor(state, { deliveredFps: 30, renderWorkMs: 30, nowMs: i * 1000, dtS: 1 });
    }
    const base = ENGAGE_CONSECUTIVE_S * 1000 + MIN_DWELL_MS;
    let d = { transition: null as null | string, cap: state.cap };
    for (let i = 0; i < RELEASE_STABLE_S * 2; i += 1) {
      d = tickFpsGovernor(state, { deliveredFps: ENGAGE_CAP, renderWorkMs: 28, nowMs: base + i * 1000, dtS: 1 });
    }
    expect(d.transition).toBeNull();
    expect(state.cap).toBe(ENGAGE_CAP);
  });

  it('shouldRenderFrame paces to the cap and is a no-op when uncapped', () => {
    expect(shouldRenderFrame(0, 1000, 0)).toBe(true);
    expect(shouldRenderFrame(30, 1000, 983)).toBe(false); // 17ms < 33ms budget
    expect(shouldRenderFrame(30, 1067, 1000)).toBe(true);
  });
});
