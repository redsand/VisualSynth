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
});
