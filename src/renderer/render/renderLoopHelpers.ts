import { getBeatsUntil } from '../../shared/quantization';

export const AUTOSAVE_INTERVAL_MS = 120000;
export const OUTPUT_BROADCAST_INTERVAL_MS = 33;
export const WATCHDOG_UPDATE_INTERVAL_MS = 1000;

export interface FpsTracker {
  fpsAccumulatorMs: number;
  frameCount: number;
}

export interface FpsTickResult {
  tracker: FpsTracker;
  fps: number | null;
}

export const tickFpsTracker = (
  tracker: FpsTracker,
  deltaMs: number,
  publishIntervalMs = 1000
): FpsTickResult => {
  const nextAccumulator = tracker.fpsAccumulatorMs + deltaMs;
  const nextFrameCount = tracker.frameCount + 1;

  if (nextAccumulator <= publishIntervalMs) {
    return {
      tracker: {
        fpsAccumulatorMs: nextAccumulator,
        frameCount: nextFrameCount
      },
      fps: null
    };
  }

  return {
    tracker: {
      fpsAccumulatorMs: 0,
      frameCount: 0
    },
    fps: Math.round((nextFrameCount / nextAccumulator) * 1000)
  };
};

export interface AudioLatencySource {
  baseLatency: number;
  outputLatency?: number;
}

export interface LatencyDiagnostics {
  latencyMs: number | null;
  outputLatencyMs: number | null;
}

export const resolveLatencyDiagnostics = (
  audioContext: AudioLatencySource | null
): LatencyDiagnostics => {
  if (!audioContext) {
    return {
      latencyMs: null,
      outputLatencyMs: null
    };
  }

  return {
    latencyMs: Math.round(audioContext.baseLatency * 1000),
    outputLatencyMs: audioContext.outputLatency
      ? Math.round(audioContext.outputLatency * 1000)
      : null
  };
};

export const nextFrameDropScore = (currentScore: number, deltaMs: number): number => {
  if (deltaMs > 24) {
    return Math.min(1, currentScore + 0.02);
  }

  return Math.max(0, currentScore - 0.01);
};


export const shouldUpdateWatchdog = (
  timeMs: number,
  lastWatchdogUpdateAt: number,
  intervalMs = WATCHDOG_UPDATE_INTERVAL_MS
): boolean => timeMs - lastWatchdogUpdateAt > intervalMs;

export const shouldAutosave = (
  timeMs: number,
  lastAutosaveAt: number,
  intervalMs = AUTOSAVE_INTERVAL_MS
): boolean => timeMs - lastAutosaveAt > intervalMs;

export const shouldBroadcastOutput = (
  outputOpen: boolean,
  timeMs: number,
  lastBroadcastAt: number,
  intervalMs = OUTPUT_BROADCAST_INTERVAL_MS
): boolean => outputOpen && timeMs - lastBroadcastAt > intervalMs;

export const nextTransportTime = (
  isPlaying: boolean,
  currentTimeMs: number,
  deltaMs: number
): number | null => (isPlaying ? currentTimeMs + deltaMs : null);

export interface FrameCadenceInput {
  timeMs: number;
  lastWatchdogUpdateAt: number;
  lastAutosaveAt: number;
  outputOpen: boolean;
  lastBroadcastAt: number;
  isPlaying: boolean;
  transportTimeMs: number;
  deltaMs: number;
}

export interface FrameCadenceResolution {
  shouldUpdateWatchdog: boolean;
  shouldAutosave: boolean;
  shouldBroadcastOutput: boolean;
  nextTransportTime: number | null;
}

export const resolveFrameCadence = (input: FrameCadenceInput): FrameCadenceResolution => ({
  shouldUpdateWatchdog: shouldUpdateWatchdog(input.timeMs, input.lastWatchdogUpdateAt),
  shouldAutosave: shouldAutosave(input.timeMs, input.lastAutosaveAt),
  shouldBroadcastOutput: shouldBroadcastOutput(
    input.outputOpen,
    input.timeMs,
    input.lastBroadcastAt
  ),
  nextTransportTime: nextTransportTime(input.isPlaying, input.transportTimeMs, input.deltaMs)
});

export interface PendingSceneSwitch {
  targetSceneId: string;
  scheduledTimeMs: number;
}

export interface SceneSwitchResolution {
  quantizeHudMessage: string | null;
  shouldApplyScene: boolean;
  beatsLeft: number | null;
}

export const resolveSceneSwitch = (
  isPlaying: boolean,
  pending: PendingSceneSwitch | null,
  timeMs: number,
  bpm: number
): SceneSwitchResolution => {
  if (!isPlaying || !pending) {
    return {
      quantizeHudMessage: null,
      shouldApplyScene: false,
      beatsLeft: null
    };
  }

  const beatsLeft = getBeatsUntil(timeMs, pending.scheduledTimeMs, bpm);
  if (timeMs >= pending.scheduledTimeMs) {
    return {
      quantizeHudMessage: null,
      shouldApplyScene: true,
      beatsLeft
    };
  }

  return {
    quantizeHudMessage: `Switching in ${beatsLeft} beat${beatsLeft === 1 ? '' : 's'}`,
    shouldApplyScene: false,
    beatsLeft
  };
};
