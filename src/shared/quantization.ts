export type QuantizationUnit = 'quarter' | 'half' | 'bar';

export const getBeatMs = (bpm: number) => {
  // Clamp to the same [40, 300] range used by clampBpmRange so beat timing
  // stays consistent with the BPM validation layer (previously [40, 240],
  // which silently diverged for tempos in 240..300).
  const safeBpm = Math.min(300, Math.max(40, bpm));
  return 60000 / safeBpm;
};

export const getQuantizedBeatCount = (unit: QuantizationUnit, beatsPerBar = 4) => {
  if (unit === 'quarter') return 1;
  if (unit === 'half') return 2;
  return beatsPerBar;
};

export const getNextQuantizedTimeMs = (
  nowMs: number,
  bpm: number,
  unit: QuantizationUnit,
  beatsPerBar = 4
) => {
  const beatMs = getBeatMs(bpm);
  const quantBeats = getQuantizedBeatCount(unit, beatsPerBar);
  const currentBeat = nowMs / beatMs;
  // Schedule the first quantization boundary strictly after the current beat.
  // Using floor + 1 (with an epsilon to tolerate float error) avoids the
  // previous exact-equality check (`nextBeat === currentBeat`) which could
  // misbehave under floating-point rounding and schedule at offset ~0.
  const idx = Math.floor(currentBeat / quantBeats + 1e-9);
  const scheduledBeat = (idx + 1) * quantBeats;
  return scheduledBeat * beatMs;
};

export const getBeatsUntil = (nowMs: number, targetMs: number, bpm: number) => {
  const beatMs = getBeatMs(bpm);
  return Math.max(0, Math.ceil((targetMs - nowMs) / beatMs));
};
