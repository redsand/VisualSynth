/**
 * Transport System - Play/stop, BPM, time signature, beat phase/quantization
 *
 * This module provides a unified transport for timing and synchronization
 * across scenes and visual elements.
 */

// ============================================================================
// Time Signature
// ============================================================================

export interface TimeSignature {
  numerator: number;   // Beats per bar (e.g., 4)
  denominator: number; // Note value per beat (e.g., 4 for quarter note)
}

export const DEFAULT_TIME_SIGNATURE: TimeSignature = {
  numerator: 4,
  denominator: 4
};

// ============================================================================
// Transport State
// ============================================================================

export type TransportState = 'stopped' | 'playing' | 'paused';

export interface TransportConfig {
  state: TransportState;
  bpm: number;
  timeSignature: TimeSignature;
  loopEnabled: boolean;
  loopStart: number;    // In beats
  loopEnd: number;      // In beats
  countIn: boolean;     // Enable count-in before play
  countInBars: number;  // Number of bars to count in
  metronomeEnabled: boolean;
  metronomeVolume: number;
}

export const DEFAULT_TRANSPORT_CONFIG: TransportConfig = {
  state: 'stopped',
  bpm: 120,
  timeSignature: { ...DEFAULT_TIME_SIGNATURE },
  loopEnabled: false,
  loopStart: 0,
  loopEnd: 16,
  countIn: false,
  countInBars: 1,
  metronomeEnabled: false,
  metronomeVolume: 0.5
};

// ============================================================================
// Beat Position
// ============================================================================

export interface BeatPosition {
  bar: number;          // Current bar (1-indexed)
  beat: number;         // Current beat within bar (1-indexed)
  tick: number;         // Sub-beat position (0-1)
  totalBeats: number;   // Total beats from start
  phase: number;        // 0-1 phase within current beat
}

export const createBeatPosition = (totalBeats: number, timeSignature: TimeSignature): BeatPosition => {
  const beatsPerBar = timeSignature.numerator;
  const bar = Math.floor(totalBeats / beatsPerBar) + 1;
  const beatInBar = (totalBeats % beatsPerBar) + 1;
  const beat = Math.floor(beatInBar);
  const tick = beatInBar - beat;
  const phase = totalBeats - Math.floor(totalBeats);

  return {
    bar,
    beat,
    tick,
    totalBeats,
    phase
  };
};

// ============================================================================
// Beat Grid
// ============================================================================

export interface BeatGridMarker {
  id: string;
  beat: number;         // Position in beats
  type: 'downbeat' | 'beat' | 'offbeat' | 'custom';
  label?: string;
  color?: string;
}

export interface BeatGrid {
  markers: BeatGridMarker[];
  snapResolution: number; // Snap to 1/snapResolution beats
  showGrid: boolean;
  gridColor: string;
}

export const DEFAULT_BEAT_GRID: BeatGrid = {
  markers: [],
  snapResolution: 4,  // 16th notes
  showGrid: true,
  gridColor: '#4a4a4a'
};

export const snapToBeat = (beat: number, resolution: number): number => {
  const step = 1 / resolution;
  return Math.round(beat / step) * step;
};

// ============================================================================
// Tap Tempo
// ============================================================================

export interface TapTempoState {
  taps: number[];       // Timestamps of taps
  maxTaps: number;      // Maximum taps to consider
  timeoutMs: number;    // Reset after this much inactivity
  lastTapTime: number;
  currentBpm: number | null;
  confidence: number;   // 0-1 confidence in the detected BPM
}

export const DEFAULT_TAP_TEMPO_STATE: TapTempoState = {
  taps: [],
  maxTaps: 8,
  timeoutMs: 2000,
  lastTapTime: 0,
  currentBpm: null,
  confidence: 0
};

export const processTap = (state: TapTempoState, timestamp: number): TapTempoState => {
  // Reset if too much time has passed
  if (timestamp - state.lastTapTime > state.timeoutMs) {
    return {
      ...state,
      taps: [timestamp],
      lastTapTime: timestamp,
      currentBpm: null,
      confidence: 0
    };
  }

  // Add new tap
  const taps = [...state.taps, timestamp].slice(-state.maxTaps);

  // Calculate BPM if we have enough taps
  if (taps.length < 2) {
    return { ...state, taps, lastTapTime: timestamp };
  }

  // Calculate intervals between taps
  const intervals: number[] = [];
  for (let i = 1; i < taps.length; i++) {
    intervals.push(taps[i] - taps[i - 1]);
  }

  // Average interval
  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const bpm = Math.round(60000 / avgInterval);

  // Calculate confidence based on consistency
  const variance = intervals.reduce((sum, interval) => {
    return sum + Math.pow(interval - avgInterval, 2);
  }, 0) / intervals.length;
  const stdDev = Math.sqrt(variance);
  const confidence = Math.max(0, 1 - (stdDev / avgInterval));

  return {
    ...state,
    taps,
    lastTapTime: timestamp,
    currentBpm: Math.max(30, Math.min(300, bpm)),
    confidence
  };
};

export const resetTapTempo = (): TapTempoState => ({ ...DEFAULT_TAP_TEMPO_STATE });

// ============================================================================
// Quantized Scene Clips
// ============================================================================

export interface SceneClip {
  id: string;
  sceneId: string;
  startBeat: number;
  duration: number;     // In beats, 0 = infinite/until next clip
  fadeInBeats: number;
  fadeOutBeats: number;
  quantize: 'immediate' | 'beat' | 'bar' | '2bar' | '4bar' | '8bar';
}

export interface ClipScheduler {
  clips: SceneClip[];
  activeClipId: string | null;
  pendingClipId: string | null;
  pendingTriggerBeat: number | null;
}

export const DEFAULT_CLIP_SCHEDULER: ClipScheduler = {
  clips: [],
  activeClipId: null,
  pendingClipId: null,
  pendingTriggerBeat: null
};

export const getQuantizeBeatOffset = (
  currentBeat: number,
  quantize: SceneClip['quantize'],
  timeSignature: TimeSignature
): number => {
  const beatsPerBar = timeSignature.numerator;

  switch (quantize) {
    case 'immediate':
      return 0;
    case 'beat':
      return Math.ceil(currentBeat) - currentBeat;
    case 'bar': {
      const nextBar = Math.ceil(currentBeat / beatsPerBar) * beatsPerBar;
      return nextBar - currentBeat;
    }
    case '2bar': {
      const next2Bar = Math.ceil(currentBeat / (beatsPerBar * 2)) * (beatsPerBar * 2);
      return next2Bar - currentBeat;
    }
    case '4bar': {
      const next4Bar = Math.ceil(currentBeat / (beatsPerBar * 4)) * (beatsPerBar * 4);
      return next4Bar - currentBeat;
    }
    case '8bar': {
      const next8Bar = Math.ceil(currentBeat / (beatsPerBar * 8)) * (beatsPerBar * 8);
      return next8Bar - currentBeat;
    }
    default:
      return 0;
  }
};

export const scheduleClip = (
  scheduler: ClipScheduler,
  clip: SceneClip,
  currentBeat: number,
  timeSignature: TimeSignature
): ClipScheduler => {
  const offset = getQuantizeBeatOffset(currentBeat, clip.quantize, timeSignature);
  const triggerBeat = currentBeat + offset;

  return {
    ...scheduler,
    pendingClipId: clip.id,
    pendingTriggerBeat: triggerBeat
  };
};

// ============================================================================
// Automation Lanes
// ============================================================================

export interface AutomationPoint {
  beat: number;
  value: number;
  curve: 'linear' | 'step' | 'smooth' | 'exponential';
}

export interface AutomationLane {
  id: string;
  parameterId: string;
  parameterName: string;
  points: AutomationPoint[];
  enabled: boolean;
  recording: boolean;
  minValue: number;
  maxValue: number;
}

export const DEFAULT_AUTOMATION_LANE: Omit<AutomationLane, 'id' | 'parameterId' | 'parameterName'> = {
  points: [],
  enabled: true,
  recording: false,
  minValue: 0,
  maxValue: 1
};

export const getAutomationValue = (lane: AutomationLane, beat: number): number | null => {
  if (!lane.enabled || lane.points.length === 0) return null;

  // Find surrounding points
  const sortedPoints = [...lane.points].sort((a, b) => a.beat - b.beat);

  // Before first point
  if (beat <= sortedPoints[0].beat) {
    return sortedPoints[0].value;
  }

  // After last point
  if (beat >= sortedPoints[sortedPoints.length - 1].beat) {
    return sortedPoints[sortedPoints.length - 1].value;
  }

  // Find surrounding points
  let prevPoint = sortedPoints[0];
  let nextPoint = sortedPoints[1];

  for (let i = 1; i < sortedPoints.length; i++) {
    if (sortedPoints[i].beat >= beat) {
      prevPoint = sortedPoints[i - 1];
      nextPoint = sortedPoints[i];
      break;
    }
  }

  // Interpolate based on curve type
  const t = (beat - prevPoint.beat) / (nextPoint.beat - prevPoint.beat);

  switch (prevPoint.curve) {
    case 'step':
      return prevPoint.value;
    case 'linear':
      return prevPoint.value + (nextPoint.value - prevPoint.value) * t;
    case 'smooth':
      // Smoothstep interpolation
      const smoothT = t * t * (3 - 2 * t);
      return prevPoint.value + (nextPoint.value - prevPoint.value) * smoothT;
    case 'exponential':
      // Exponential interpolation
      const expT = Math.pow(t, 2);
      return prevPoint.value + (nextPoint.value - prevPoint.value) * expT;
    default:
      return prevPoint.value;
  }
};

export const addAutomationPoint = (
  lane: AutomationLane,
  beat: number,
  value: number,
  curve: AutomationPoint['curve'] = 'linear'
): AutomationLane => {
  const clampedValue = Math.max(lane.minValue, Math.min(lane.maxValue, value));

  // Check if point already exists at this beat
  const existingIndex = lane.points.findIndex(
    (p) => Math.abs(p.beat - beat) < 0.001
  );

  if (existingIndex >= 0) {
    const points = [...lane.points];
    points[existingIndex] = { beat, value: clampedValue, curve };
    return { ...lane, points };
  }

  return {
    ...lane,
    points: [...lane.points, { beat, value: clampedValue, curve }]
  };
};

export const removeAutomationPoint = (lane: AutomationLane, beat: number): AutomationLane => ({
  ...lane,
  points: lane.points.filter((p) => Math.abs(p.beat - beat) >= 0.001)
});

export const clearAutomationLane = (lane: AutomationLane): AutomationLane => ({
  ...lane,
  points: []
});

// ============================================================================
// BPM Smoothing
// ============================================================================

export interface BpmSmoother {
  targetBpm: number;
  currentBpm: number;
  smoothingFactor: number; // 0-1, higher = faster response
  minBpm: number;
  maxBpm: number;
  lastUpdateTime: number;
  history: { bpm: number; time: number; source: string }[];
  maxHistoryLength: number;
}

export const DEFAULT_BPM_SMOOTHER: BpmSmoother = {
  targetBpm: 120,
  currentBpm: 120,
  smoothingFactor: 0.1,
  minBpm: 60,
  maxBpm: 200,
  lastUpdateTime: 0,
  history: [],
  maxHistoryLength: 10
};

export const updateBpmSmoother = (
  smoother: BpmSmoother,
  newBpm: number,
  source: string,
  timestamp: number
): BpmSmoother => {
  // Clamp to valid range
  const clampedBpm = Math.max(smoother.minBpm, Math.min(smoother.maxBpm, newBpm));

  // Add to history
  const history = [
    { bpm: clampedBpm, time: timestamp, source },
    ...smoother.history
  ].slice(0, smoother.maxHistoryLength);

  // Apply smoothing
  const deltaTime = timestamp - smoother.lastUpdateTime;
  const effectiveSmoothing = Math.min(1, smoother.smoothingFactor * Math.min(deltaTime / 16, 1));
  const smoothedBpm = smoother.currentBpm + (clampedBpm - smoother.currentBpm) * effectiveSmoothing;

  return {
    ...smoother,
    targetBpm: clampedBpm,
    currentBpm: smoothedBpm,
    lastUpdateTime: timestamp,
    history
  };
};

export const getSmoothedBpm = (smoother: BpmSmoother): number => smoother.currentBpm;

export const setBpmSmoothing = (smoother: BpmSmoother, factor: number): BpmSmoother => ({
  ...smoother,
  smoothingFactor: Math.max(0.01, Math.min(1, factor))
});

// ============================================================================
// Transport Utilities
// ============================================================================

export const beatsToMs = (beats: number, bpm: number): number => (beats / bpm) * 60000;

export const msToBeats = (ms: number, bpm: number): number => (ms / 60000) * bpm;

export const barsToBeats = (bars: number, timeSignature: TimeSignature): number =>
  bars * timeSignature.numerator;

export const beatsToSeconds = (beats: number, bpm: number): number => (beats / bpm) * 60;

export const secondsToBeats = (seconds: number, bpm: number): number => (seconds / 60) * bpm;

export const getBeatsPerBar = (timeSignature: TimeSignature): number => timeSignature.numerator;

export const formatBeatPosition = (position: BeatPosition): string =>
  `${position.bar}.${position.beat}.${Math.floor(position.tick * 100).toString().padStart(2, '0')}`;

// ============================================================================
// Transport Controller
// ============================================================================

export interface TransportController {
  config: TransportConfig;
  startTime: number;
  pauseTime: number;
  currentBeat: number;
  beatPosition: BeatPosition;
  tapTempo: TapTempoState;
  beatGrid: BeatGrid;
  clipScheduler: ClipScheduler;
  automationLanes: AutomationLane[];
  bpmSmoother: BpmSmoother;
}

export const createTransportController = (
  config: Partial<TransportConfig> = {}
): TransportController => ({
  config: { ...DEFAULT_TRANSPORT_CONFIG, ...config },
  startTime: 0,
  pauseTime: 0,
  currentBeat: 0,
  beatPosition: createBeatPosition(0, DEFAULT_TIME_SIGNATURE),
  tapTempo: { ...DEFAULT_TAP_TEMPO_STATE },
  beatGrid: { ...DEFAULT_BEAT_GRID },
  clipScheduler: { ...DEFAULT_CLIP_SCHEDULER },
  automationLanes: [],
  bpmSmoother: { ...DEFAULT_BPM_SMOOTHER, currentBpm: config.bpm ?? 120, targetBpm: config.bpm ?? 120 }
});

export const updateTransport = (
  controller: TransportController,
  timestamp: number
): TransportController => {
  if (controller.config.state !== 'playing') {
    return controller;
  }

  const elapsedMs = timestamp - controller.startTime;
  const bpm = getSmoothedBpm(controller.bpmSmoother);
  const currentBeat = msToBeats(elapsedMs, bpm);

  // Handle loop
  let adjustedBeat = currentBeat;
  if (controller.config.loopEnabled) {
    const loopLength = controller.config.loopEnd - controller.config.loopStart;
    if (loopLength > 0 && currentBeat >= controller.config.loopEnd) {
      adjustedBeat = controller.config.loopStart + ((currentBeat - controller.config.loopStart) % loopLength);
    }
  }

  return {
    ...controller,
    currentBeat: adjustedBeat,
    beatPosition: createBeatPosition(adjustedBeat, controller.config.timeSignature)
  };
};

export const playTransport = (controller: TransportController, timestamp: number): TransportController => {
  const startTime = controller.config.state === 'paused'
    ? timestamp - beatsToMs(controller.currentBeat, getSmoothedBpm(controller.bpmSmoother))
    : timestamp;

  return {
    ...controller,
    config: { ...controller.config, state: 'playing' },
    startTime
  };
};

export const pauseTransport = (controller: TransportController, timestamp: number): TransportController => ({
  ...controller,
  config: { ...controller.config, state: 'paused' },
  pauseTime: timestamp
});

export const stopTransport = (controller: TransportController): TransportController => ({
  ...controller,
  config: { ...controller.config, state: 'stopped' },
  currentBeat: 0,
  beatPosition: createBeatPosition(0, controller.config.timeSignature)
});

export const seekTransport = (controller: TransportController, beat: number, timestamp: number): TransportController => {
  const bpm = getSmoothedBpm(controller.bpmSmoother);
  const startTime = timestamp - beatsToMs(beat, bpm);

  return {
    ...controller,
    startTime,
    currentBeat: beat,
    beatPosition: createBeatPosition(beat, controller.config.timeSignature)
  };
};

export const setBpm = (controller: TransportController, bpm: number, timestamp: number): TransportController => ({
  ...controller,
  config: { ...controller.config, bpm },
  bpmSmoother: updateBpmSmoother(controller.bpmSmoother, bpm, 'manual', timestamp)
});
