import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TIME_SIGNATURE,
  createBeatPosition,
  snapToBeat,
  processTap,
  resetTapTempo,
  getQuantizeBeatOffset,
  scheduleClip,
  getAutomationValue,
  addAutomationPoint,
  removeAutomationPoint,
  clearAutomationLane,
  updateBpmSmoother,
  getSmoothedBpm,
  setBpmSmoothing,
  beatsToMs,
  msToBeats,
  barsToBeats,
  formatBeatPosition,
  createTransportController,
  updateTransport,
  playTransport,
  pauseTransport,
  stopTransport,
  seekTransport,
  setBpm,
  DEFAULT_TAP_TEMPO_STATE,
  DEFAULT_CLIP_SCHEDULER,
  DEFAULT_BPM_SMOOTHER
} from '../src/shared/transport';

describe('beat position', () => {
  it('creates beat position from total beats', () => {
    const pos = createBeatPosition(4.5, DEFAULT_TIME_SIGNATURE);
    expect(pos.bar).toBe(2);
    expect(pos.beat).toBe(1);
    expect(pos.totalBeats).toBe(4.5);
    expect(pos.phase).toBeCloseTo(0.5);
  });

  it('handles bar boundaries correctly', () => {
    const pos = createBeatPosition(8, DEFAULT_TIME_SIGNATURE);
    expect(pos.bar).toBe(3);
    expect(pos.beat).toBe(1);
  });

  it('handles zero beats', () => {
    const pos = createBeatPosition(0, DEFAULT_TIME_SIGNATURE);
    expect(pos.bar).toBe(1);
    expect(pos.beat).toBe(1);
  });
});

describe('beat grid snapping', () => {
  it('snaps to quarter note grid', () => {
    expect(snapToBeat(1.3, 1)).toBe(1);
    expect(snapToBeat(1.7, 1)).toBe(2);
  });

  it('snaps to 16th note grid', () => {
    // resolution=4 means step=0.25 (4 divisions per beat)
    // 1.1/0.25 = 4.4 -> rounds to 4 -> 4*0.25 = 1.0
    // 1.38/0.25 = 5.52 -> rounds to 6 -> 6*0.25 = 1.5
    expect(snapToBeat(1.1, 4)).toBe(1.0);
    expect(snapToBeat(1.38, 4)).toBe(1.5);
  });

  it('snaps to 32nd note grid', () => {
    // resolution=8 means step=0.125 (8 divisions per beat)
    // 1.06/0.125 = 8.48 -> rounds to 8 -> 8*0.125 = 1.0
    // 1.19/0.125 = 9.52 -> rounds to 10 -> 10*0.125 = 1.25
    expect(snapToBeat(1.06, 8)).toBeCloseTo(1.0);
    expect(snapToBeat(1.19, 8)).toBeCloseTo(1.25);
  });
});

describe('tap tempo', () => {
  it('calculates BPM from taps', () => {
    let state = { ...DEFAULT_TAP_TEMPO_STATE };

    // Tap at 120 BPM (500ms intervals)
    state = processTap(state, 0);
    state = processTap(state, 500);
    state = processTap(state, 1000);
    state = processTap(state, 1500);

    expect(state.currentBpm).toBe(120);
    expect(state.confidence).toBeGreaterThan(0.9);
  });

  it('resets after timeout', () => {
    let state = { ...DEFAULT_TAP_TEMPO_STATE };

    state = processTap(state, 0);
    state = processTap(state, 500);

    // Wait longer than timeout
    state = processTap(state, 5000);

    expect(state.taps).toHaveLength(1);
    expect(state.currentBpm).toBeNull();
  });

  it('limits tap history', () => {
    let state = { ...DEFAULT_TAP_TEMPO_STATE };

    for (let i = 0; i < 20; i++) {
      state = processTap(state, i * 500);
    }

    expect(state.taps.length).toBeLessThanOrEqual(state.maxTaps);
  });

  it('resets tap tempo state', () => {
    const state = resetTapTempo();
    expect(state.taps).toHaveLength(0);
    expect(state.currentBpm).toBeNull();
  });
});

describe('quantized scene clips', () => {
  it('quantizes to next beat', () => {
    const offset = getQuantizeBeatOffset(1.5, 'beat', DEFAULT_TIME_SIGNATURE);
    expect(offset).toBeCloseTo(0.5);
  });

  it('quantizes to next bar', () => {
    const offset = getQuantizeBeatOffset(2, 'bar', DEFAULT_TIME_SIGNATURE);
    expect(offset).toBe(2); // Next bar is at beat 4
  });

  it('quantizes to next 2 bars', () => {
    const offset = getQuantizeBeatOffset(2, '2bar', DEFAULT_TIME_SIGNATURE);
    expect(offset).toBe(6); // Next 2-bar is at beat 8
  });

  it('returns 0 for immediate', () => {
    const offset = getQuantizeBeatOffset(3.7, 'immediate', DEFAULT_TIME_SIGNATURE);
    expect(offset).toBe(0);
  });

  it('schedules clip at quantized time', () => {
    const clip = {
      id: 'clip-1',
      sceneId: 'scene-1',
      startBeat: 0,
      duration: 16,
      fadeInBeats: 0.5,
      fadeOutBeats: 0.5,
      quantize: 'bar' as const
    };

    const scheduler = scheduleClip(DEFAULT_CLIP_SCHEDULER, clip, 2, DEFAULT_TIME_SIGNATURE);
    expect(scheduler.pendingClipId).toBe('clip-1');
    expect(scheduler.pendingTriggerBeat).toBe(4); // Next bar
  });
});

describe('automation lanes', () => {
  it('returns null for empty lane', () => {
    const lane = {
      id: 'lane-1',
      parameterId: 'intensity',
      parameterName: 'Intensity',
      points: [],
      enabled: true,
      recording: false,
      minValue: 0,
      maxValue: 1
    };

    expect(getAutomationValue(lane, 5)).toBeNull();
  });

  it('returns constant for single point', () => {
    const lane = {
      id: 'lane-1',
      parameterId: 'intensity',
      parameterName: 'Intensity',
      points: [{ beat: 0, value: 0.5, curve: 'linear' as const }],
      enabled: true,
      recording: false,
      minValue: 0,
      maxValue: 1
    };

    expect(getAutomationValue(lane, 0)).toBe(0.5);
    expect(getAutomationValue(lane, 10)).toBe(0.5);
  });

  it('interpolates between points linearly', () => {
    const lane = {
      id: 'lane-1',
      parameterId: 'intensity',
      parameterName: 'Intensity',
      points: [
        { beat: 0, value: 0, curve: 'linear' as const },
        { beat: 10, value: 1, curve: 'linear' as const }
      ],
      enabled: true,
      recording: false,
      minValue: 0,
      maxValue: 1
    };

    expect(getAutomationValue(lane, 5)).toBeCloseTo(0.5);
    expect(getAutomationValue(lane, 2.5)).toBeCloseTo(0.25);
  });

  it('supports step interpolation', () => {
    const lane = {
      id: 'lane-1',
      parameterId: 'intensity',
      parameterName: 'Intensity',
      points: [
        { beat: 0, value: 0, curve: 'step' as const },
        { beat: 10, value: 1, curve: 'linear' as const }
      ],
      enabled: true,
      recording: false,
      minValue: 0,
      maxValue: 1
    };

    expect(getAutomationValue(lane, 5)).toBe(0);
  });

  it('adds automation points', () => {
    let lane = {
      id: 'lane-1',
      parameterId: 'intensity',
      parameterName: 'Intensity',
      points: [] as { beat: number; value: number; curve: 'linear' | 'step' | 'smooth' | 'exponential' }[],
      enabled: true,
      recording: false,
      minValue: 0,
      maxValue: 1
    };

    lane = addAutomationPoint(lane, 0, 0.5);
    lane = addAutomationPoint(lane, 10, 1);

    expect(lane.points).toHaveLength(2);
  });

  it('clamps values to min/max', () => {
    let lane = {
      id: 'lane-1',
      parameterId: 'intensity',
      parameterName: 'Intensity',
      points: [] as { beat: number; value: number; curve: 'linear' | 'step' | 'smooth' | 'exponential' }[],
      enabled: true,
      recording: false,
      minValue: 0,
      maxValue: 1
    };

    lane = addAutomationPoint(lane, 0, 2); // Over max
    expect(lane.points[0].value).toBe(1);
  });

  it('removes automation points', () => {
    let lane = {
      id: 'lane-1',
      parameterId: 'intensity',
      parameterName: 'Intensity',
      points: [{ beat: 5, value: 0.5, curve: 'linear' as const }],
      enabled: true,
      recording: false,
      minValue: 0,
      maxValue: 1
    };

    lane = removeAutomationPoint(lane, 5);
    expect(lane.points).toHaveLength(0);
  });

  it('clears all points', () => {
    let lane = {
      id: 'lane-1',
      parameterId: 'intensity',
      parameterName: 'Intensity',
      points: [
        { beat: 0, value: 0, curve: 'linear' as const },
        { beat: 10, value: 1, curve: 'linear' as const }
      ],
      enabled: true,
      recording: false,
      minValue: 0,
      maxValue: 1
    };

    lane = clearAutomationLane(lane);
    expect(lane.points).toHaveLength(0);
  });
});

describe('BPM smoother', () => {
  it('smooths BPM changes', () => {
    let smoother = { ...DEFAULT_BPM_SMOOTHER, smoothingFactor: 0.5 };

    smoother = updateBpmSmoother(smoother, 140, 'manual', 16);
    expect(smoother.targetBpm).toBe(140);
    expect(smoother.currentBpm).toBeGreaterThan(120);
    expect(smoother.currentBpm).toBeLessThan(140);
  });

  it('clamps to min/max range', () => {
    let smoother = { ...DEFAULT_BPM_SMOOTHER, minBpm: 60, maxBpm: 180 };

    smoother = updateBpmSmoother(smoother, 300, 'manual', 16);
    expect(smoother.targetBpm).toBe(180);

    smoother = updateBpmSmoother(smoother, 30, 'manual', 32);
    expect(smoother.targetBpm).toBe(60);
  });

  it('tracks history', () => {
    let smoother = { ...DEFAULT_BPM_SMOOTHER };

    smoother = updateBpmSmoother(smoother, 120, 'manual', 0);
    smoother = updateBpmSmoother(smoother, 125, 'network', 100);
    smoother = updateBpmSmoother(smoother, 128, 'auto', 200);

    expect(smoother.history).toHaveLength(3);
    expect(smoother.history[0].source).toBe('auto');
  });

  it('adjusts smoothing factor', () => {
    let smoother = { ...DEFAULT_BPM_SMOOTHER };

    smoother = setBpmSmoothing(smoother, 0.8);
    expect(smoother.smoothingFactor).toBe(0.8);

    smoother = setBpmSmoothing(smoother, 2);
    expect(smoother.smoothingFactor).toBe(1);

    smoother = setBpmSmoothing(smoother, 0);
    expect(smoother.smoothingFactor).toBe(0.01);
  });
});

describe('time conversion utilities', () => {
  it('converts beats to ms', () => {
    expect(beatsToMs(1, 120)).toBe(500);
    expect(beatsToMs(4, 60)).toBe(4000);
  });

  it('converts ms to beats', () => {
    expect(msToBeats(500, 120)).toBe(1);
    expect(msToBeats(1000, 60)).toBe(1);
  });

  it('converts bars to beats', () => {
    expect(barsToBeats(2, DEFAULT_TIME_SIGNATURE)).toBe(8);
    expect(barsToBeats(1, { numerator: 3, denominator: 4 })).toBe(3);
  });

  it('formats beat position', () => {
    const pos = createBeatPosition(5.5, DEFAULT_TIME_SIGNATURE);
    const formatted = formatBeatPosition(pos);
    expect(formatted).toMatch(/^\d+\.\d+\.\d{2}$/);
  });
});

describe('transport controller', () => {
  it('creates with defaults', () => {
    const controller = createTransportController();
    expect(controller.config.state).toBe('stopped');
    expect(controller.config.bpm).toBe(120);
    expect(controller.currentBeat).toBe(0);
  });

  it('creates with custom config', () => {
    const controller = createTransportController({ bpm: 140 });
    expect(controller.config.bpm).toBe(140);
    expect(controller.bpmSmoother.currentBpm).toBe(140);
  });

  it('plays transport', () => {
    let controller = createTransportController();
    controller = playTransport(controller, 1000);
    expect(controller.config.state).toBe('playing');
    expect(controller.startTime).toBe(1000);
  });

  it('pauses transport', () => {
    let controller = createTransportController();
    controller = playTransport(controller, 1000);
    controller = pauseTransport(controller, 2000);
    expect(controller.config.state).toBe('paused');
    expect(controller.pauseTime).toBe(2000);
  });

  it('stops and resets transport', () => {
    let controller = createTransportController();
    controller = playTransport(controller, 1000);
    controller = updateTransport(controller, 2000);
    controller = stopTransport(controller);
    expect(controller.config.state).toBe('stopped');
    expect(controller.currentBeat).toBe(0);
  });

  it('updates beat position when playing', () => {
    let controller = createTransportController({ bpm: 120 });
    controller = playTransport(controller, 0);
    controller = updateTransport(controller, 500); // 500ms = 1 beat at 120 BPM
    expect(controller.currentBeat).toBeCloseTo(1, 1);
  });

  it('does not update when stopped', () => {
    let controller = createTransportController();
    controller = updateTransport(controller, 5000);
    expect(controller.currentBeat).toBe(0);
  });

  it('seeks to position', () => {
    let controller = createTransportController({ bpm: 120 });
    controller = playTransport(controller, 0);
    controller = seekTransport(controller, 8, 1000);
    expect(controller.currentBeat).toBe(8);
  });

  it('sets BPM', () => {
    let controller = createTransportController();
    controller = setBpm(controller, 140, 0);
    expect(controller.config.bpm).toBe(140);
  });

  it('handles looping', () => {
    let controller = createTransportController({
      bpm: 120,
      loopEnabled: true,
      loopStart: 0,
      loopEnd: 4
    });
    controller = playTransport(controller, 0);

    // Play past loop end (4 beats = 2000ms at 120 BPM)
    controller = updateTransport(controller, 2500); // Should loop back
    expect(controller.currentBeat).toBeLessThan(4);
  });
});
