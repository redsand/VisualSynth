import { ModConnection } from './project';

export interface ModSourceValues {
  [key: string]: number;
}

export const applyModMatrix = (
  baseValue: number,
  targetId: string,
  sources: ModSourceValues,
  connections: ModConnection[],
  fallbackRange?: { min: number; max: number }
) => {
  const mods = connections.filter((conn) => conn.target === targetId && conn.enabled !== false);
  if (mods.length === 0) {
    return baseValue;
  }
  let value = baseValue;
  let minClamp: number | null = null;
  let maxClamp: number | null = null;
  for (const mod of mods) {
    // A connection whose min/max are still the schema default [0,1] is almost
    // always a hand-edited or round-tripped file where the true parameter range
    // was never filled in. Clamping to [0,1] is wrong for any parameter whose
    // natural range differs (contrast [0.6,1.6], rotation [-3.14,3.14], etc.),
    // so when the caller supplies the parameter's true range, substitute it.
    // The substitution is a no-op for genuine [0,1] parameters (opacity, etc.)
    // because the fallback equals the default there — so a deliberate [0,1]
    // clamp on a [0,1] parameter is preserved. A hand-edited deliberate
    // narrowing of a non-[0,1] parameter to exactly [0,1] would be widened back
    // to its true range; narrow to any other bound (e.g. [0, 0.99]) to keep it.
    const useFallback =
      !!fallbackRange &&
      mod.min === 0 &&
      mod.max === 1 &&
      (fallbackRange.min !== 0 || fallbackRange.max !== 1);
    const effMin = useFallback ? fallbackRange.min : mod.min;
    const effMax = useFallback ? fallbackRange.max : mod.max;
    minClamp = minClamp === null ? effMin : Math.min(minClamp, effMin);
    maxClamp = maxClamp === null ? effMax : Math.max(maxClamp, effMax);
    const sourceValue = sources[mod.source] ?? 0;
    let shaped = sourceValue;
    if (mod.curve === 'exp') {
      shaped = Math.pow(sourceValue, 2);
    }
    if (mod.curve === 'log') {
      shaped = Math.sqrt(sourceValue);
    }
    
    const smoothing = Math.min(Math.max(mod.smoothing, 0), 1);
    // Bipolar remaps amount from [0,1] to [-1,1] so the modulation can deflect
    // in either direction. The previous expression `(amount*2 - amount)`
    // simplifies to `amount`, so bipolar mode was a no-op identical to unipolar.
    const modAmount = (mod.bipolar ? (mod.amount * 2 - 1) : mod.amount) * (1 - smoothing);
    value += shaped * modAmount;
  }
  const minValue = minClamp ?? 0;
  const maxValue = maxClamp ?? 1;
  const clampedMin = Math.min(minValue, maxValue);
  const clampedMax = Math.max(minValue, maxValue);
  return Math.min(Math.max(value, clampedMin), clampedMax);
};
