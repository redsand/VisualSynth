import type { NowPlayingSettings } from './nowPlaying';

// Token-saving gate for the now-playing recognition path. Paid providers
// (AudD / ACRCloud) meter every request, so the gate answers two questions:
//  1. BEFORE a lookup: is this detector firing even worth a request?
//     (adaptive cooldown active, or the spectral distance says "same song")
//  2. AFTER a lookup: did we just pay to re-identify the track we already
//     display? (same-track dedup + geometric cooldown so repeats cost less
//     each time)
//
// All functions are pure with respect to the outside world — they mutate the
// caller-owned NowPlayingGateState so the renderer (index.ts) stays thin and
// this stays unit-testable.

export interface NowPlayingGateState {
  /** artist::title::album of the currently displayed track (null = none) */
  currentTrackKey: string | null;
  currentTrackAt: number;
  /** Detector signature of the window that identified the current track */
  lastSignature: number[] | null;
  /** Consecutive recognitions of the same track (drives geometric cooldown) */
  sameTrackStreak: number;
  /** Consecutive no-matches (drives the 120s backoff) */
  noMatchStreak: number;
  /** Wall-clock ms before which lookups are skipped entirely */
  adaptiveCooldownUntil: number;
  /** Retries used for the current detector firing (bounded to 1) */
  retryCount: number;
}

export interface NowPlayingTrackLike {
  title?: string;
  artist?: string;
  album?: string;
}

export interface GateSongChangeEvent {
  distance: number;
  nextSignature: number[];
}

const MAX_ADAPTIVE_COOLDOWN_MS = 5 * 60 * 1000;
const NO_MATCH_RETRY_DELAY_MS = 10_000;
const NO_MATCH_BACKOFF_MS = 120_000;
const NO_MATCH_BACKOFF_STREAK = 3;
const MAX_RETRY_PER_DETECTION = 1;
/** Fraction of changeThreshold below which a firing reads as "same song" */
const SAME_SONG_DISTANCE_FACTOR = 0.5;

export const createNowPlayingGateState = (): NowPlayingGateState => ({
  currentTrackKey: null,
  currentTrackAt: 0,
  lastSignature: null,
  sameTrackStreak: 0,
  noMatchStreak: 0,
  adaptiveCooldownUntil: 0,
  retryCount: 0
});

export const nowPlayingTrackKey = (
  title?: string,
  artist?: string,
  album?: string
): string => [artist ?? '', title ?? '', album ?? ''].join('::');

const hasTrackContent = (track: NowPlayingTrackLike): boolean =>
  !!(track.title?.trim() || track.artist?.trim() || track.album?.trim());

/**
 * Cooldown after a recognition, growing geometrically with each consecutive
 * same-track hit (15s → 30s → 60s … capped at 5 minutes) so a flapping
 * detector costs at most a couple of requests before going quiet.
 */
export const effectiveCooldownMs = (
  settings: NowPlayingSettings,
  sameTrackStreak: number
): number => {
  const base = Math.max(5000, settings.cooldownMs || 15000);
  return Math.min(base * Math.pow(2, sameTrackStreak), MAX_ADAPTIVE_COOLDOWN_MS);
};

export interface NowPlayingGateSkip {
  skip: boolean;
  reason?: string;
}

/**
 * Pre-lookup gate. The detector's learned baseline IS the signature of the
 * currently-displayed track, so a small `distance` means the firing is a
 * false positive (same song) — skip before exporting a clip or touching IPC.
 */
export const shouldSkipLookup = (
  state: NowPlayingGateState,
  settings: NowPlayingSettings,
  event: GateSongChangeEvent,
  nowMs: number
): NowPlayingGateSkip => {
  if (nowMs < state.adaptiveCooldownUntil) {
    const secondsLeft = Math.round((state.adaptiveCooldownUntil - nowMs) / 1000);
    return { skip: true, reason: `Adaptive cooldown active (${secondsLeft}s left)` };
  }
  const threshold = Math.max(0.01, settings.changeThreshold || 0.35);
  if (event.distance < threshold * SAME_SONG_DISTANCE_FACTOR) {
    return { skip: true, reason: 'Spectral change below same-song gate' };
  }
  return { skip: false };
};

/**
 * Record a successful recognition. Returns true when the result is the SAME
 * track already displayed — the caller should skip overlay/artwork updates
 * (nothing changed) and let the extended cooldown do its work.
 */
export const recordRecognition = (
  state: NowPlayingGateState,
  settings: NowPlayingSettings,
  result: NowPlayingTrackLike,
  nowMs: number,
  event?: GateSongChangeEvent
): boolean => {
  if (!hasTrackContent(result)) return false;
  const trackKey = nowPlayingTrackKey(result.title, result.artist, result.album);
  const sameTrack = trackKey === state.currentTrackKey;
  if (sameTrack) {
    state.sameTrackStreak += 1;
  } else {
    state.currentTrackKey = trackKey;
    state.currentTrackAt = nowMs;
    state.sameTrackStreak = 0;
  }
  state.noMatchStreak = 0;
  state.retryCount = 0;
  if (event) state.lastSignature = event.nextSignature;
  state.adaptiveCooldownUntil = nowMs + effectiveCooldownMs(settings, state.sameTrackStreak);
  return sameTrack;
};

/**
 * Seed the gate from the (free, authoritative) metadata bridge so a later
 * detector misfire doesn't burn a paid request re-identifying a track we
 * already know. Returns true when the bridge introduced a NEW track.
 */
export const seedGateFromBridge = (
  state: NowPlayingGateState,
  result: NowPlayingTrackLike,
  nowMs: number
): boolean => {
  if (!hasTrackContent(result)) return false;
  const trackKey = nowPlayingTrackKey(result.title, result.artist, result.album);
  if (trackKey === state.currentTrackKey) return false;
  state.currentTrackKey = trackKey;
  state.currentTrackAt = nowMs;
  state.sameTrackStreak = 0;
  state.noMatchStreak = 0;
  state.retryCount = 0;
  return true;
};

export interface NoMatchOutcome {
  /** Schedule one bounded retry with a fresh clip (cancelled by new firings) */
  scheduleRetryInMs?: number;
  /** Extended backoff after repeated no-matches */
  backoffUntil?: number;
}

/**
 * Record a failed recognition. First failure per firing earns a single retry
 * (~10s, fresh clip). Three consecutive no-matches back the whole pipeline
 * off for two minutes — the audio is probably talk/ambience, not music.
 */
export const recordNoMatch = (
  state: NowPlayingGateState,
  nowMs: number
): NoMatchOutcome => {
  state.noMatchStreak += 1;
  // Backoff takes precedence over another retry: three consecutive failed
  // requests means the audio is probably not music — stop spending.
  if (state.noMatchStreak >= NO_MATCH_BACKOFF_STREAK) {
    state.noMatchStreak = 0;
    state.retryCount = 0;
    state.adaptiveCooldownUntil = nowMs + NO_MATCH_BACKOFF_MS;
    return { backoffUntil: state.adaptiveCooldownUntil };
  }
  if (state.retryCount < MAX_RETRY_PER_DETECTION) {
    state.retryCount += 1;
    return { scheduleRetryInMs: NO_MATCH_RETRY_DELAY_MS };
  }
  return {};
};

/** A new detector firing starts a fresh retry budget for this detection. */
export const resetGateRetry = (state: NowPlayingGateState): void => {
  state.retryCount = 0;
};