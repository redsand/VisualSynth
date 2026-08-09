import { ModConnection } from './project';

export interface ModSourceValues {
  [key: string]: number;
}

export const applyModMatrix = (
  baseValue: number,
  targetId: string,
  sources: ModSourceValues,
  connections: ModConnection[]
) => {
  const mods = connections.filter((conn) => conn.target === targetId && conn.enabled !== false);
  if (mods.length === 0) {
    return baseValue;
  }
  let value = baseValue;
  let minClamp: number | null = null;
  let maxClamp: number | null = null;
  for (const mod of mods) {
    minClamp = minClamp === null ? mod.min : Math.min(minClamp, mod.min);
    maxClamp = maxClamp === null ? mod.max : Math.max(maxClamp, mod.max);
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
