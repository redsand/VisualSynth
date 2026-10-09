import { describe, expect, it } from 'vitest';
import { SHAZAM_SAMPLE_RATE, ShazamSignatureGenerator } from '../src/shared/shazamSignature';

/**
 * Regression tests for the Shazam fingerprint generator.
 *
 * The generator historically normalized input samples to ±1 while its
 * magnitude scaling (/2^17) and peak threshold (1/64) came from the
 * reference algorithm operating on RAW int16 values. The mismatch made
 * every magnitude ~2^30 too small, so the threshold rejected all bins and
 * every fingerprint shipped with ZERO peaks — Shazam could never match.
 */

// A sweeping tone (750 Hz → 2250 Hz) crosses several frequency bands so
// peak detection has material to find in more than one band.
const makeSweepTone = (durationSec: number, amplitude: number): Int16Array => {
  const n = Math.floor(durationSec * SHAZAM_SAMPLE_RATE);
  const out = new Int16Array(n);
  let phase = 0;
  for (let i = 0; i < n; i += 1) {
    const freqHz = 750 + (1500 * i) / n;
    phase += (2 * Math.PI * freqHz) / SHAZAM_SAMPLE_RATE;
    out[i] = Math.trunc(Math.sin(phase) * amplitude);
  }
  return out;
};

describe('ShazamSignatureGenerator', () => {
  it('detects peaks from int16-scale audio', () => {
    const gen = new ShazamSignatureGenerator();
    gen.feed(makeSweepTone(3.2, 20000));

    expect(gen.totalPeaks).toBeGreaterThan(10);
  });

  it('detects no peaks from unit-scale audio (documents the required input scale)', () => {
    // ±1 amplitude is what the old normalization bug produced: power is
    // ~2^30 below the reference scale, so every bin falls under the 1/64
    // threshold and the fingerprint ends up empty.
    const gen = new ShazamSignatureGenerator();
    gen.feed(makeSweepTone(3.2, 1));

    expect(gen.totalPeaks).toBe(0);
  });

  it('stops ingesting at 3.1 seconds', () => {
    const gen = new ShazamSignatureGenerator();
    gen.feed(makeSweepTone(10, 20000));

    expect(gen.numSamples).toBeLessThanOrEqual(Math.ceil(3.1 * SHAZAM_SAMPLE_RATE));
    expect(gen.durationSeconds).toBeLessThanOrEqual(3.2);
  });

  it('encodes the fixed magic header and a non-trivial payload', () => {
    const gen = new ShazamSignatureGenerator();
    gen.feed(makeSweepTone(3.2, 20000));
    const sig = gen.encode();

    // 48-byte fixed header + 8-byte TLV preamble + at least one band block.
    expect(sig.byteLength).toBeGreaterThan(48 + 8);

    const view = new DataView(sig);
    expect(view.getUint32(0, true)).toBe(0xcafe2580);
    expect(view.getUint32(12, true)).toBe(0x94119c00);
  });
});