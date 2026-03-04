import { describe, expect, it } from 'vitest';
import {
  nextFrameDropScore,
  nextTransportTime,
  resolveFrameCadence,
  resolveLatencyDiagnostics,
  resolveSceneSwitch,
  shouldAutosave,
  shouldBroadcastOutput,
  shouldUpdateWatchdog,
  tickFpsTracker
} from '../src/renderer/render/renderLoopHelpers';

describe('renderLoopHelpers', () => {
  it('enforces autosave cadence with deterministic timestamps', () => {
    expect(shouldAutosave(120000, 0)).toBe(false);
    expect(shouldAutosave(120001, 0)).toBe(true);
    expect(shouldAutosave(300000, 200001)).toBe(false);
  });


  it('updates watchdog only after deterministic interval threshold', () => {
    expect(shouldUpdateWatchdog(1000, 0)).toBe(false);
    expect(shouldUpdateWatchdog(1001, 0)).toBe(true);
    expect(shouldUpdateWatchdog(5000, 4501)).toBe(false);
  });

  it('throttles output broadcasts based on deterministic timestamps', () => {
    expect(shouldBroadcastOutput(true, 33, 0)).toBe(false);
    expect(shouldBroadcastOutput(true, 34, 0)).toBe(true);
    expect(shouldBroadcastOutput(false, 500, 0)).toBe(false);
  });

  it('resolves audio latency diagnostics deterministically', () => {
    expect(resolveLatencyDiagnostics(null)).toEqual({
      latencyMs: null,
      outputLatencyMs: null
    });

    expect(
      resolveLatencyDiagnostics({
        baseLatency: 0.0123,
        outputLatency: 0.0456
      })
    ).toEqual({
      latencyMs: 12,
      outputLatencyMs: 46
    });

    expect(resolveLatencyDiagnostics({ baseLatency: 0.01 })).toEqual({
      latencyMs: 10,
      outputLatencyMs: null
    });
  });

  it('computes next transport time only while playing', () => {
    expect(nextTransportTime(true, 1000, 16)).toBe(1016);
    expect(nextTransportTime(false, 1000, 16)).toBeNull();
  });

  it('resolves combined cadence decisions deterministically', () => {
    expect(
      resolveFrameCadence({
        timeMs: 120001,
        lastWatchdogUpdateAt: 119000,
        lastAutosaveAt: 0,
        outputOpen: true,
        lastBroadcastAt: 120000,
        isPlaying: true,
        transportTimeMs: 400,
        deltaMs: 16
      })
    ).toEqual({
      shouldUpdateWatchdog: true,
      shouldAutosave: true,
      shouldBroadcastOutput: false,
      nextTransportTime: 416
    });
  });

  it('resolves quantized scene switch HUD and apply transitions', () => {
    const waiting = resolveSceneSwitch(true, { targetSceneId: 'scene-b', scheduledTimeMs: 1500 }, 1000, 120);
    expect(waiting.shouldApplyScene).toBe(false);
    expect(waiting.quantizeHudMessage).toBe('Switching in 1 beat');

    const due = resolveSceneSwitch(true, { targetSceneId: 'scene-b', scheduledTimeMs: 1500 }, 1500, 120);
    expect(due.shouldApplyScene).toBe(true);
    expect(due.quantizeHudMessage).toBeNull();

    const stopped = resolveSceneSwitch(false, { targetSceneId: 'scene-b', scheduledTimeMs: 1500 }, 1000, 120);
    expect(stopped.shouldApplyScene).toBe(false);
    expect(stopped.quantizeHudMessage).toBeNull();
  });

  it('publishes fps only after interval and resets tracker deterministically', () => {
    const first = tickFpsTracker({ fpsAccumulatorMs: 0, frameCount: 0 }, 16);
    expect(first.fps).toBeNull();
    expect(first.tracker).toEqual({ fpsAccumulatorMs: 16, frameCount: 1 });

    const second = tickFpsTracker({ fpsAccumulatorMs: 992, frameCount: 62 }, 16);
    expect(second.fps).toBe(63);
    expect(second.tracker).toEqual({ fpsAccumulatorMs: 0, frameCount: 0 });
  });


  it('does not publish fps exactly at the publish interval boundary', () => {
    const tick = tickFpsTracker({ fpsAccumulatorMs: 984, frameCount: 61 }, 16);
    expect(tick.fps).toBeNull();
    expect(tick.tracker).toEqual({ fpsAccumulatorMs: 1000, frameCount: 62 });
  });

  it('clamps frame-drop score updates for perf guardrails', () => {
    expect(nextFrameDropScore(0.99, 40)).toBe(1);
    expect(nextFrameDropScore(0.0, 16)).toBe(0);
    expect(nextFrameDropScore(0.5, 40)).toBeCloseTo(0.52);
    expect(nextFrameDropScore(0.5, 16)).toBeCloseTo(0.49);
  });
});
