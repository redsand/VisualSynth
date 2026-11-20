// Adaptive frame-rate governor: shares the GPU automatically.
//
// When another GPU-heavy app (Serato DJ) runs alongside VisualSynth on the
// same machine, both compete per vsync. The governor watches the DELIVERED
// frame rate and our own render work-time and, when contention is detected
// (sustained fps sag), engages a render cap so each frame we submit costs
// the contending app less GPU — without the user touching anything. When
// headroom returns (Serato closed), the cap releases and the show returns
// to display refresh.
//
// AIMD (multiplicative decrease, additive-ish increase) with hysteresis so
// it never oscillates visibly:
//   ENGAGE:   uncapped AND delivered fps < ENGAGE_BELOW_FPS for
//             ENGAGE_CONSECUTIVE_S seconds → cap 30 fps
//   RELEASE:  capped AND mean render work < RELEASE_WORK_MS (frame body
//             costs far less than the capped budget) for RELEASE_STABLE_S
//             seconds → uncapped. If fps sags again right after, the
//             re-engage counter picks it back up quickly.

export interface AdaptiveFpsState {
  /** Current effective cap; 0 = uncapped (display refresh) */
  cap: number;
  /** consecutive seconds under the current phase's condition */
  conditionStreakS: number;
  /** last transition time (ms) — used for minimum-dwell hysteresis */
  lastTransitionAt: number;
  /** rolling mean of our own render work per frame (ms) */
  workMeanMs: number;
  /** samples behind workMeanMs */
  workSamples: number;
}

export const ENGAGE_BELOW_FPS = 45;
export const ENGAGE_CONSECUTIVE_S = 3;
export const ENGAGE_CAP = 30;
export const RELEASE_WORK_MS = 12;      // frame body well under the 33ms budget
export const RELEASE_STABLE_S = 8;
export const MIN_DWELL_MS = 10_000;      // never flip more often than 10s

export const createAdaptiveFpsState = (): AdaptiveFpsState => ({
  cap: 0,
  conditionStreakS: 0,
  lastTransitionAt: 0,
  workMeanMs: 0,
  workSamples: 0
});

export interface FpsGovernorInput {
  /** delivered fps over the last window (0 when unknown) */
  deliveredFps: number;
  /** this frame's own heavy-work duration (ms) */
  renderWorkMs: number;
  /** wall clock ms */
  nowMs: number;
  /** seconds this tick represents (the fps measurement cadence) */
  dtS: number;
}

export interface FpsGovernorDecision {
  cap: number;
  /** 'engage' | 'release' when a transition happened this tick */
  transition: 'engage' | 'release' | null;
}

export const tickFpsGovernor = (
  state: AdaptiveFpsState,
  input: FpsGovernorInput
): FpsGovernorDecision => {
  // Track mean render work regardless of phase. EMA at 0.25 converges in
  // ~4 frames so the release signal reacts within a second of headroom
  // appearing, while a single compile-stall spike washes out just as fast.
  state.workSamples += 1;
  state.workMeanMs += (input.renderWorkMs - state.workMeanMs) * 0.25;

  if (input.nowMs - state.lastTransitionAt < MIN_DWELL_MS && state.lastTransitionAt > 0) {
    return { cap: state.cap, transition: null };
  }

  if (state.cap === 0) {
    const sagging = input.deliveredFps > 0 && input.deliveredFps < ENGAGE_BELOW_FPS;
    state.conditionStreakS = sagging ? state.conditionStreakS + input.dtS : 0;
    if (sagging && state.conditionStreakS >= ENGAGE_CONSECUTIVE_S) {
      state.cap = ENGAGE_CAP;
      state.conditionStreakS = 0;
      state.lastTransitionAt = input.nowMs;
      return { cap: state.cap, transition: 'engage' };
    }
  } else {
    // Headroom = our own frame body costs a fraction of the capped budget.
    // (Delivered fps alone can't show headroom while capped — it pins at
    // the cap — so work-time is the release signal.)
    const hasHeadroom = state.workMeanMs > 0 && state.workMeanMs < RELEASE_WORK_MS;
    state.conditionStreakS = hasHeadroom ? state.conditionStreakS + input.dtS : 0;
    if (hasHeadroom && state.conditionStreakS >= RELEASE_STABLE_S) {
      state.cap = 0;
      state.conditionStreakS = 0;
      state.lastTransitionAt = input.nowMs;
      return { cap: state.cap, transition: 'release' };
    }
  }
  return { cap: state.cap, transition: null };
};

/**
 * Frame pacing: true when the heavy per-frame work should run this tick.
 * The ~1ms tolerance keeps the effective rate from undershooting the cap.
 */
export const shouldRenderFrame = (
  cap: number,
  nowMs: number,
  lastRenderedMs: number
): boolean => cap <= 0 || nowMs - lastRenderedMs >= 1000 / cap - 1;
