import { describe, expect, it } from 'vitest';
import {
  createAdaptiveResolutionState,
  RESOLUTION_LEVELS,
  tickResolutionGovernor
} from '../src/shared/adaptiveResolution';

const run = (state: ReturnType<typeof createAdaptiveResolutionState>, fps: number, seconds: number, startMs: number) => {
  let now = startMs;
  const changes: string[] = [];
  for (let i = 0; i < seconds; i++) {
    now += 1000;
    const d = tickResolutionGovernor(state, { deliveredFps: fps, nowMs: now, dtS: 1 });
    if (d.change) changes.push(`${d.change}@${d.scale}`);
  }
  return { now, changes };
};

describe('adaptive resolution governor', () => {
  it('holds full resolution while the frame rate is healthy', () => {
    const s = createAdaptiveResolutionState();
    expect(run(s, 60, 60, 0).changes).toEqual([]);
    expect(RESOLUTION_LEVELS[s.level]).toBe(1);
  });

  it('steps down under sustained GPU saturation, respecting the dwell', () => {
    const s = createAdaptiveResolutionState();
    const { changes } = run(s, 26, 12, 0);
    expect(changes[0]).toBe('down@0.85');
    expect(changes.length).toBe(3); // 2s, then every >=4s dwell
  });

  it('never steps below the lowest level', () => {
    const s = createAdaptiveResolutionState();
    run(s, 10, 120, 0);
    expect(s.level).toBe(RESOLUTION_LEVELS.length - 1);
  });

  it('recovers resolution once there is headroom', () => {
    const s = createAdaptiveResolutionState();
    const a = run(s, 26, 3, 0);
    expect(s.level).toBe(1);
    const b = run(s, 60, 12, a.now);
    expect(b.changes).toEqual(['up@1']);
  });

  it('blocks re-trying a level that sagged right after stepping up', () => {
    const s = createAdaptiveResolutionState();
    let t = run(s, 26, 3, 0).now;          // down to 0.85
    t = run(s, 60, 10, t).now;               // up to 1
    expect(s.level).toBe(0);
    t = run(s, 30, 5, t).now;                // sags right away → down after dwell, block
    expect(s.level).toBe(1);
    const retry = run(s, 60, 30, t);         // headroom, but blocked for 60s
    expect(retry.changes).toEqual([]);
    const later = run(s, 60, 40, retry.now); // block expires
    expect(later.changes).toEqual(['up@1']);
  });
});
