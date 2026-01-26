export interface BpmRange {
  min: number;
  max: number;
}

export const clampBpmRange = (range: BpmRange): BpmRange => {
  const min = Math.min(300, Math.max(40, range.min));
  const max = Math.min(300, Math.max(40, range.max));
  if (min <= max) return { min, max };
  return { min: max, max: min };
};

export const fitBpmToRange = (bpm: number, range: BpmRange) => {
  if (!Number.isFinite(bpm)) return null;
  const clampedRange = clampBpmRange(range);
  let candidate = bpm;
  while (candidate < clampedRange.min && candidate > 0) {
    candidate *= 2;
  }
  while (candidate > clampedRange.max) {
    candidate /= 2;
  }
  if (candidate >= clampedRange.min && candidate <= clampedRange.max) {
    return candidate;
  }
  return null;
};
