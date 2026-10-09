import { describe, expect, it } from 'vitest';
import {
  createNowPlayingGateState,
  effectiveCooldownMs,
  nowPlayingTrackKey,
  recordNoMatch,
  recordRecognition,
  resetGateRetry,
  seedGateFromBridge,
  shouldSkipLookup
} from '../src/shared/nowPlayingGate';
import { DEFAULT_NOW_PLAYING_SETTINGS, normalizeNowPlayingSettings } from '../src/shared/nowPlaying';

const settings = normalizeNowPlayingSettings(null);
const TRACK_A = { title: 'Track A', artist: 'Artist A', album: 'Album A' };
const TRACK_B = { title: 'Track B', artist: 'Artist B', album: 'Album B' };

const eventWithDistance = (distance: number) => ({
  distance,
  nextSignature: [0.25, 0.25, 0.25, 0.25]
});

describe('nowPlayingTrackKey', () => {
  it('joins artist, title, and album with the existing bridge key format', () => {
    expect(nowPlayingTrackKey('Title', 'Artist', 'Album')).toBe('Artist::Title::Album');
  });
});

describe('shouldSkipLookup', () => {
  it('allows a first-ever lookup', () => {
    const state = createNowPlayingGateState();
    const verdict = shouldSkipLookup(state, settings, eventWithDistance(1), 1000);
    expect(verdict.skip).toBe(false);
  });

  it('skips while the adaptive cooldown is active', () => {
    const state = createNowPlayingGateState();
    state.adaptiveCooldownUntil = 60_000;
    const verdict = shouldSkipLookup(state, settings, eventWithDistance(1), 30_000);
    expect(verdict.skip).toBe(true);
    expect(verdict.reason).toContain('Adaptive cooldown');
  });

  it('skips small-distance firings as same-song false positives', () => {
    const state = createNowPlayingGateState();
    // changeThreshold default is 0.35; the same-song gate is 0.5 * that.
    const verdict = shouldSkipLookup(state, settings, eventWithDistance(0.10), 1000);
    expect(verdict.skip).toBe(true);
    expect(verdict.reason).toContain('same-song');
  });

  it('allows firings above the same-song gate', () => {
    const state = createNowPlayingGateState();
    const verdict = shouldSkipLookup(state, settings, eventWithDistance(0.5), 1000);
    expect(verdict.skip).toBe(false);
  });
});

describe('recordRecognition', () => {
  it('reports a new track and starts the base cooldown', () => {
    const state = createNowPlayingGateState();
    const same = recordRecognition(state, settings, TRACK_A, 10_000, eventWithDistance(0.8));

    expect(same).toBe(false);
    expect(state.currentTrackKey).toBe(nowPlayingTrackKey(TRACK_A.title, TRACK_A.artist, TRACK_A.album));
    expect(state.sameTrackStreak).toBe(0);
    expect(state.adaptiveCooldownUntil).toBe(10_000 + settings.cooldownMs);
  });

  it('reports the same track and grows the geometric cooldown', () => {
    const state = createNowPlayingGateState();
    recordRecognition(state, settings, TRACK_A, 10_000, eventWithDistance(0.8));
    const same = recordRecognition(state, settings, TRACK_A, 60_000, eventWithDistance(0.8));

    expect(same).toBe(true);
    expect(state.sameTrackStreak).toBe(1);
    expect(state.adaptiveCooldownUntil).toBe(60_000 + settings.cooldownMs * 2);
  });

  it('resets the streak when a different track is recognized', () => {
    const state = createNowPlayingGateState();
    recordRecognition(state, settings, TRACK_A, 10_000, eventWithDistance(0.8));
    recordRecognition(state, settings, TRACK_A, 60_000, eventWithDistance(0.8));
    const same = recordRecognition(state, settings, TRACK_B, 120_000, eventWithDistance(0.9));

    expect(same).toBe(false);
    expect(state.sameTrackStreak).toBe(0);
    expect(state.currentTrackKey).toBe(nowPlayingTrackKey(TRACK_B.title, TRACK_B.artist, TRACK_B.album));
  });

  it('ignores results with no recognizable content', () => {
    const state = createNowPlayingGateState();
    const same = recordRecognition(state, settings, {}, 10_000, eventWithDistance(0.8));

    expect(same).toBe(false);
    expect(state.currentTrackKey).toBeNull();
  });
});

describe('effectiveCooldownMs', () => {
  it('doubles per same-track streak and caps at five minutes', () => {
    expect(effectiveCooldownMs(settings, 0)).toBe(settings.cooldownMs);
    expect(effectiveCooldownMs(settings, 1)).toBe(settings.cooldownMs * 2);
    expect(effectiveCooldownMs(settings, 4)).toBe(settings.cooldownMs * 16);
    expect(effectiveCooldownMs(settings, 20)).toBe(5 * 60 * 1000);
  });
});

describe('seedGateFromBridge', () => {
  it('seeds a new track so detector misfires are gated off', () => {
    const state = createNowPlayingGateState();
    const introduced = seedGateFromBridge(state, TRACK_A, 5000);

    expect(introduced).toBe(true);
    expect(state.currentTrackKey).toBe(nowPlayingTrackKey(TRACK_A.title, TRACK_A.artist, TRACK_A.album));

    // The detector now fires with a small distance: same song, skip.
    const verdict = shouldSkipLookup(state, settings, eventWithDistance(0.1), 6000);
    expect(verdict.skip).toBe(true);
    expect(verdict.reason).toContain('same-song');
  });

  it('reports false when the bridge repeats the current track', () => {
    const state = createNowPlayingGateState();
    seedGateFromBridge(state, TRACK_A, 5000);
    expect(seedGateFromBridge(state, TRACK_A, 9000)).toBe(false);
  });
});

describe('recordNoMatch', () => {
  it('schedules one bounded retry on the first no-match', () => {
    const state = createNowPlayingGateState();
    const outcome = recordNoMatch(state, 10_000);

    expect(outcome.scheduleRetryInMs).toBe(10_000);
    expect(outcome.backoffUntil).toBeUndefined();
  });

  it('does not schedule a second retry for the same firing', () => {
    const state = createNowPlayingGateState();
    recordNoMatch(state, 10_000);
    const outcome = recordNoMatch(state, 25_000);

    expect(outcome.scheduleRetryInMs).toBeUndefined();
    expect(outcome.backoffUntil).toBeUndefined();
  });

  it('backs off for two minutes after repeated no-matches', () => {
    const state = createNowPlayingGateState();
    // Firing 1: the initial no-match schedules the bounded retry…
    const first = recordNoMatch(state, 10_000);
    expect(first.scheduleRetryInMs).toBe(10_000);
    // …and the retry also misses.
    const retry = recordNoMatch(state, 25_000);
    expect(retry.scheduleRetryInMs).toBeUndefined();
    expect(retry.backoffUntil).toBeUndefined();
    // Firing 2 (fresh retry budget): its no-match is the third consecutive
    // failed request — back off for two minutes instead of retrying again.
    resetGateRetry(state);
    const second = recordNoMatch(state, 50_000);

    expect(second.backoffUntil).toBe(50_000 + 120_000);
    expect(state.adaptiveCooldownUntil).toBe(second.backoffUntil);

    // During backoff, lookups are gated off entirely.
    const verdict = shouldSkipLookup(state, settings, eventWithDistance(1), 100_000);
    expect(verdict.skip).toBe(true);
  });

  it('resets the no-match streak after backing off', () => {
    const state = createNowPlayingGateState();
    recordNoMatch(state, 10_000);
    recordNoMatch(state, 25_000);
    resetGateRetry(state);
    recordNoMatch(state, 50_000);

    expect(state.noMatchStreak).toBe(0);
    expect(state.retryCount).toBe(0);
  });
});

describe('recordRecognition clears failure state', () => {
  it('resets the no-match streak and retry budget on a match', () => {
    const state = createNowPlayingGateState();
    recordNoMatch(state, 10_000);
    recordRecognition(state, settings, TRACK_A, 30_000, eventWithDistance(0.8));

    expect(state.noMatchStreak).toBe(0);
    expect(state.retryCount).toBe(0);
  });
});

describe('settings normalization', () => {
  it('defaults freeShazamFirst to on for legacy stored settings', () => {
    const normalized = normalizeNowPlayingSettings({ enabled: true, provider: 'audd' });
    expect(normalized.freeShazamFirst).toBe(true);
    expect(DEFAULT_NOW_PLAYING_SETTINGS.freeShazamFirst).toBe(true);
  });
});