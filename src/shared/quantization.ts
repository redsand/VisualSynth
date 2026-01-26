export type QuantizationUnit = 'quarter' | 'half' | 'bar';

export const getBeatMs = (bpm: number) => {
  const safeBpm = Math.min(240, Math.max(40, bpm));
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
  const nextBeat = Math.ceil(currentBeat / quantBeats) * quantBeats;
  const scheduledBeat = nextBeat === currentBeat ? nextBeat + quantBeats : nextBeat;
  return scheduledBeat * beatMs;
};

export const getBeatsUntil = (nowMs: number, targetMs: number, bpm: number) => {
  const beatMs = getBeatMs(bpm);
  return Math.max(0, Math.ceil((targetMs - nowMs) / beatMs));
};
