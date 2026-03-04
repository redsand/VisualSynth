import { describe, expect, it } from 'vitest';
import {
  nextFrameDropScore,
  shouldAutosave,
  shouldBroadcastOutput,
  tickFpsTracker
} from '../src/renderer/render/renderLoopHelpers';

describe('render loop performance guardrails', () => {
  it('keeps frame-drop score clamped across long-running frame sequences', () => {
    let score = 0;
    for (let i = 0; i < 50000; i += 1) {
      const delta = i % 5 === 0 ? 40 : 16;
      score = nextFrameDropScore(score, delta);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });

  it('produces stable fps publications during sustained 60fps simulation', () => {
    let tracker = { fpsAccumulatorMs: 0, frameCount: 0 };
    const published: number[] = [];

    for (let i = 0; i < 600; i += 1) {
      const tick = tickFpsTracker(tracker, 16.6667);
      tracker = tick.tracker;
      if (tick.fps !== null) published.push(tick.fps);
    }

    expect(published.length).toBeGreaterThan(8);
    for (const fps of published) {
      expect(fps).toBeGreaterThanOrEqual(58);
      expect(fps).toBeLessThanOrEqual(61);
    }
  });

  it('enforces deterministic output throttle rate under fixed-frame cadence', () => {
    let lastBroadcast = 0;
    let broadcasts = 0;

    for (let time = 0; time <= 1008; time += 16) {
      if (shouldBroadcastOutput(true, time, lastBroadcast)) {
        broadcasts += 1;
        lastBroadcast = time;
      }
    }

    expect(broadcasts).toBe(21);
  });

  it('keeps throttle behavior deterministic at exact boundary and over-boundary ticks', () => {
    expect(shouldBroadcastOutput(true, 33, 0)).toBe(false);
    expect(shouldBroadcastOutput(true, 34, 0)).toBe(true);
    expect(shouldBroadcastOutput(true, 66, 33)).toBe(false);
    expect(shouldBroadcastOutput(true, 67, 33)).toBe(true);
  });

  it('enforces deterministic autosave cadence over long sessions', () => {
    let lastAutosave = 0;
    let autosaveCount = 0;

    for (let time = 0; time <= 600000; time += 1000) {
      if (shouldAutosave(time, lastAutosave)) {
        autosaveCount += 1;
        lastAutosave = time;
      }
    }

    expect(autosaveCount).toBe(4);
  });
});
