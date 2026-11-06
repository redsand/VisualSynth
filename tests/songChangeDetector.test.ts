import { describe, expect, it } from 'vitest';
import { createSongChangeDetector } from '../src/renderer/audio/songChangeDetector';

const makeSpectrum = (value: number) => new Array(64).fill(value);

describe('songChangeDetector', () => {
  it('does not trigger before minimum track duration', () => {
    const hits: number[] = [];
    const detector = createSongChangeDetector({
      windowMs: 1000,
      minTrackMs: 5000,
      confirmWindows: 2,
      changeThreshold: 0.2,
      onSongChange: ({ detectedAt }) => hits.push(detectedAt)
    });

    for (let i = 0; i < 4; i += 1) {
      detector.update({ nowMs: i * 500, rms: 0.4, spectrum: makeSpectrum(0.8) });
    }
    for (let i = 4; i < 10; i += 1) {
      detector.update({
        nowMs: i * 500,
        rms: 0.4,
        spectrum: [...new Array(32).fill(1), ...new Array(32).fill(0)]
      });
    }

    expect(hits).toHaveLength(0);
  });

  it('triggers after sustained signature change', () => {
    const hits: number[] = [];
    const detector = createSongChangeDetector({
      windowMs: 1000,
      minTrackMs: 2000,
      confirmWindows: 2,
      changeThreshold: 0.2,
      onSongChange: ({ detectedAt }) => hits.push(detectedAt)
    });

    for (let i = 0; i < 8; i += 1) {
      detector.update({ nowMs: i * 500, rms: 0.45, spectrum: makeSpectrum(0.8) });
    }
    for (let i = 8; i < 18; i += 1) {
      detector.update({
        nowMs: i * 500,
        rms: 0.45,
        spectrum: [...new Array(32).fill(1), ...new Array(32).fill(0)]
      });
    }

    expect(hits).toHaveLength(1);
    expect(hits[0]).toBeGreaterThanOrEqual(5000);
  });

  it('ignores silent frames', () => {
    const hits: number[] = [];
    const detector = createSongChangeDetector({
      windowMs: 1000,
      minTrackMs: 1000,
      confirmWindows: 1,
      silenceThreshold: 0.1,
      changeThreshold: 0.2,
      onSongChange: ({ detectedAt }) => hits.push(detectedAt)
    });

    detector.update({ nowMs: 0, rms: 0.01, spectrum: makeSpectrum(1) });
    detector.update({ nowMs: 1000, rms: 0.01, spectrum: makeSpectrum(0) });

    expect(hits).toHaveLength(0);
    expect(detector.getState().baselineSignature).toBeNull();
  });

  it('exposes the last window distance in getState for live tuning feedback', () => {
    const detector = createSongChangeDetector({
      windowMs: 1000,
      minTrackMs: 1000,
      confirmWindows: 1,
      changeThreshold: 0.2
    });

    expect(detector.getState().lastWindowDistance).toBe(0);

    // Signatures are amplitude-normalized, so the divergence must be a
    // spectral SHAPE change (low-heavy vs high-heavy), not a loudness change.
    const lowHeavy = [...new Array(32).fill(1), ...new Array(32).fill(0)];
    const highHeavy = [...new Array(32).fill(0), ...new Array(32).fill(1)];

    // Learn the baseline — TWO windows (the baseline averages the first two
    // completed windows so an unrepresentative opening can't arm the
    // detector against the song's own steady state).
    for (let i = 0; i < 6; i += 1) {
      detector.update({ nowMs: i * 500, rms: 0.4, spectrum: lowHeavy });
    }
    expect(detector.getState().baselineSignature).not.toBeNull();
    // …then diverge. The next flushed window reports the shape-block half of
    // the distance (constant spectra produce no flux, so flux adds 0).
    for (let i = 6; i < 9; i += 1) {
      detector.update({ nowMs: i * 500, rms: 0.4, spectrum: highHeavy });
    }

    expect(detector.getState().lastWindowDistance).toBeGreaterThanOrEqual(0.5 - 1e-9);
  });

  it('applies setOptions to a live detector without discarding the baseline', () => {
    const hits: number[] = [];
    const detector = createSongChangeDetector({
      windowMs: 1000,
      minTrackMs: 5000,
      confirmWindows: 2,
      changeThreshold: 0.9,
      onSongChange: ({ detectedAt }) => hits.push(detectedAt)
    });

    const lowHeavy = [...new Array(32).fill(1), ...new Array(32).fill(0)];
    const highHeavy = [...new Array(32).fill(0), ...new Array(32).fill(1)];

    // Learn a baseline (two windows).
    for (let i = 0; i < 6; i += 1) {
      detector.update({ nowMs: i * 500, rms: 0.4, spectrum: lowHeavy });
    }
    const baseline = detector.getState().baselineSignature;

    // Loosen the threshold live (the settings modal does this on save).
    detector.setOptions({ changeThreshold: 0.2, minTrackMs: 1000, confirmWindows: 1 });

    expect(detector.getState().baselineSignature).toBe(baseline);

    // The divergent signature now crosses the loosened threshold and fires.
    for (let i = 6; i < 9; i += 1) {
      detector.update({ nowMs: i * 500, rms: 0.4, spectrum: highHeavy });
    }

    expect(hits).toHaveLength(1);
  });

  it('discriminates songs that share a spectral shape but differ in rise-rate texture', () => {
    // Two "songs" with the same AVERAGE spectrum but different rhythmic
    // texture: song A pulses in the low half, song B pulses in the high
    // half. The shape block alone cannot tell them apart (v1's failure
    // mode on mastered dance tracks); the flux block must.
    const flat = new Array(64).fill(0.5);
    const makePulse = (low: boolean, t: number) =>
      new Array(64).fill(0).map((_, i) =>
        (low ? i < 32 : i >= 32) && t % 2 === 0 ? 1 : (low ? i < 32 : i >= 32) && t % 2 === 1 ? 0.2 : 0.5
      );

    const detector = createSongChangeDetector({
      windowMs: 2000,
      minTrackMs: 2000,
      // The shipped default: a single mixed transition window must not fire
      // (it would reset the baseline to the mix and destroy the comparison).
      confirmWindows: 2,
      silenceThreshold: 0.1,
      changeThreshold: 0.15
    });

    // Song A: learn its baseline (shape identical to song B's average).
    // A window only flushes on the first frame AT/after its 2s deadline, and
    // the next window starts at that frame — so the second baseline window
    // completes only once frames pass 4.1s.
    for (let t = 0; t < 45; t += 1) {
      detector.update({ nowMs: t * 100, rms: 0.4, spectrum: t === 0 ? flat : makePulse(true, t) });
    }
    expect(detector.getState().baselineSignature).not.toBeNull();

    // Song B: same average shape, texture moved to the high half.
    for (let t = 45; t < 85; t += 1) {
      detector.update({ nowMs: t * 100, rms: 0.4, spectrum: makePulse(false, t) });
    }

    // The flux block carries the discrimination: the reported distance
    // must exceed what the (identical) shape block could ever produce.
    expect(detector.getState().lastWindowDistance).toBeGreaterThan(0.15);
  });

  it('does not count a flux spike across a render stall as texture change', () => {
    // After a long frame gap (background tab, watchdog stall) the spectrum
    // has moved by wall-clock time the rise-rate feature cannot represent —
    // v2 must resync instead of aggregating an enormous fake rise rate.
    const detector = createSongChangeDetector({
      windowMs: 1000,
      minTrackMs: 1000,
      confirmWindows: 1,
      silenceThreshold: 0.1,
      changeThreshold: 0.15
    });

    const lowHeavy = new Array(64).fill(0).map((_, i) => (i < 32 ? 1 : 0.2));
    // Learn a two-window baseline of steady low-heavy (frames at 100ms; the
    // second window completes once frames pass 2.1s).
    for (let i = 0; i <= 21; i += 1) {
      detector.update({ nowMs: i * 100, rms: 0.4, spectrum: lowHeavy });
    }
    expect(detector.getState().baselineSignature).not.toBeNull();
    // A 2s stall, then the same steady low-heavy continues.
    detector.update({ nowMs: 4300, rms: 0.4, spectrum: lowHeavy });
    for (let i = 0; i <= 12; i += 1) {
      detector.update({ nowMs: 4400 + i * 100, rms: 0.4, spectrum: lowHeavy });
    }

    // The post-stall window (which spans the gap) must NOT read as a change:
    // the fake flux spike across the stall was skipped, so the steady-state
    // window stays close to the baseline.
    expect(detector.getState().lastWindowDistance).toBeLessThan(0.15);
  });
});
