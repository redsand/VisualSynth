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

    // Learn the baseline…
    for (let i = 0; i < 3; i += 1) {
      detector.update({ nowMs: i * 500, rms: 0.4, spectrum: lowHeavy });
    }
    // …then diverge. The next flushed window should report distance ~1.
    for (let i = 3; i < 6; i += 1) {
      detector.update({ nowMs: i * 500, rms: 0.4, spectrum: highHeavy });
    }

    expect(detector.getState().lastWindowDistance).toBeGreaterThan(0.5);
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

    // Learn a baseline.
    for (let i = 0; i < 3; i += 1) {
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
});
