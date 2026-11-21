// Adaptive RESOLUTION governor: keep the show at full frame rate by lowering
// render resolution when the GPU is saturated (e.g. sharing it with Serato DJ).
//
// The earlier frame-cap governor (adaptiveFps.ts) halved the frame rate under
// load and released when CPU frame work looked light — but when the GPU is
// the bottleneck the CPU work is ALWAYS light, so it flipped engage/release
// every ~10-40s without ever fixing anything (live log 2026-11-20). For VJ
// visuals smooth motion matters more than pixel count, so step resolution:
//   - step DOWN when delivered fps < DOWN_BELOW_FPS for DOWN_AFTER_S
//   - step UP after UP_AFTER_S at >= UP_AT_FPS
//   - a step up that sags again within FAILED_UP_WINDOW_MS blocks further
//     step-ups for UP_BLOCK_MS (no oscillation at a marginal level)

export const RESOLUTION_LEVELS = [1, 0.85, 0.7, 0.55, 0.45] as const;
export const DOWN_BELOW_FPS = 50;
export const DOWN_AFTER_S = 2;
export const UP_AT_FPS = 58;
export const UP_AFTER_S = 10;
export const MIN_DWELL_MS = 4000;
export const FAILED_UP_WINDOW_MS = 8000;
export const UP_BLOCK_MS = 60_000;

export interface AdaptiveResolutionState {
  level: number;
  lowStreakS: number;
  highStreakS: number;
  lastChangeAt: number;
  lastStepUpAt: number;
  upBlockedUntil: number;
}

export const createAdaptiveResolutionState = (): AdaptiveResolutionState => ({
  level: 0,
  lowStreakS: 0,
  highStreakS: 0,
  lastChangeAt: 0,
  lastStepUpAt: 0,
  upBlockedUntil: 0
});

export interface ResolutionDecision {
  scale: number;
  change: 'down' | 'up' | null;
}

export const resolutionScale = (state: AdaptiveResolutionState): number =>
  RESOLUTION_LEVELS[state.level];

/** Call ~once per second with the delivered fps over that second. */
export const tickResolutionGovernor = (
  state: AdaptiveResolutionState,
  input: { deliveredFps: number; nowMs: number; dtS: number }
): ResolutionDecision => {
  const { deliveredFps, nowMs, dtS } = input;
  if (deliveredFps <= 0) return { scale: resolutionScale(state), change: null };
  state.lowStreakS = deliveredFps < DOWN_BELOW_FPS ? state.lowStreakS + dtS : 0;
  state.highStreakS = deliveredFps >= UP_AT_FPS ? state.highStreakS + dtS : 0;
  const dwellOk = state.lastChangeAt === 0 || nowMs - state.lastChangeAt >= MIN_DWELL_MS;

  if (dwellOk && state.lowStreakS >= DOWN_AFTER_S && state.level < RESOLUTION_LEVELS.length - 1) {
    if (state.lastStepUpAt > 0 && nowMs - state.lastStepUpAt < FAILED_UP_WINDOW_MS) {
      state.upBlockedUntil = nowMs + UP_BLOCK_MS;
    }
    state.level += 1;
    state.lowStreakS = 0;
    state.highStreakS = 0;
    state.lastChangeAt = nowMs;
    return { scale: resolutionScale(state), change: 'down' };
  }
  if (
    dwellOk &&
    state.highStreakS >= UP_AFTER_S &&
    state.level > 0 &&
    nowMs >= state.upBlockedUntil
  ) {
    state.level -= 1;
    state.lowStreakS = 0;
    state.highStreakS = 0;
    state.lastChangeAt = nowMs;
    state.lastStepUpAt = nowMs;
    return { scale: resolutionScale(state), change: 'up' };
  }
  return { scale: resolutionScale(state), change: null };
};
