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
  if (!Number.isFinite(bpm) || bpm <= 0) return null;
  const clampedRange = clampBpmRange(range);

  // First try octave relationships (×2 / ÷2 / ×4 / ÷4 …), which is the standard
  // "same tempo, different meter feel" fold and what callers expect (e.g.
  // 240→120, 60→120). Only if NO octave multiple lands in range do we fall
  // back to triplet/dotted relationships (×3/2, ×2/3, ×3, ×1/3 …) so a
  // detection that's genuinely related by a triplet — not an octave — can
  // still be fit. The previous octave-only version returned null for those.
  const findBest = (multipliers: number[]): number | null => {
    let best: number | null = null;
    let bestDist = Infinity;
    for (const m of multipliers) {
      const candidate = bpm * m;
      if (candidate >= clampedRange.min && candidate <= clampedRange.max) {
        const dist = Math.abs(candidate - bpm);
        if (dist < bestDist) {
          bestDist = dist;
          best = candidate;
        }
      }
    }
    return best;
  };

  const octave = findBest([1, 2, 0.5, 4, 0.25, 8, 0.125]);
  if (octave !== null) return octave;
  return findBest([1.5, 2 / 3, 3, 1 / 3, 4.5, 1 / 4.5]);
};
