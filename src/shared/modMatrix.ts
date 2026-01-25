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
  let value = baseValue;
  const mods = connections.filter((conn) => conn.target === targetId);
  for (const mod of mods) {
    const sourceValue = sources[mod.source] ?? 0;
    const scaled = mod.bipolar ? (sourceValue * 2 - 1) : sourceValue;
    let shaped = scaled;
    if (mod.curve === 'exp') {
      shaped = Math.sign(scaled) * Math.pow(Math.abs(scaled), 2);
    }
    if (mod.curve === 'log') {
      shaped = Math.sign(scaled) * Math.sqrt(Math.abs(scaled));
    }
    value += shaped * mod.amount;
  }
  return Math.min(Math.max(value, 0), 1);
};
