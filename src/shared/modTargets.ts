/**
 * Modulation target range resolution.
 *
 * `applyModMatrix` clamps its result to each connection's `min`/`max`. The zod
 * schema defaults those to `0`/`1`, and the UI pre-fills them from the target
 * parameter's true range via `getTargetDefaults`. So UI-created connections
 * carry the correct range, but hand-edited project files — or files that were
 * hand-edited and then round-tripped through the app (which bakes the `0/1`
 * default in as explicit values) — clamp to `[0,1]` even for parameters whose
 * natural range is nothing like `[0,1]` (e.g. `style.contrast` `[0.6,1.6]`,
 * `sdf.rotation` `[-3.14,3.14]`). That silently caps the modulated value.
 *
 * `resolveModTargetRange` lets the render path hand `applyModMatrix` the
 * parameter's true range as a fallback, which `applyModMatrix` substitutes
 * when a connection still carries the `[0,1]` schema default.
 */

import { getParamDef, parseLegacyTarget } from './parameterRegistry';

/** Static global (non-layer) modulation targets and their natural ranges. */
export const GLOBAL_MOD_TARGETS: { id: string; label: string; min: number; max: number }[] = [
  { id: 'style.contrast', label: 'Style Contrast', min: 0.6, max: 1.6 },
  { id: 'style.saturation', label: 'Style Saturation', min: 0.6, max: 1.8 },
  { id: 'style.paletteShift', label: 'Palette Shift', min: -0.5, max: 0.5 },
  { id: 'effects.bloom', label: 'Bloom', min: 0, max: 1 },
  { id: 'effects.blur', label: 'Blur', min: 0, max: 1 },
  { id: 'effects.chroma', label: 'Chromatic', min: 0, max: 0.5 },
  { id: 'effects.posterize', label: 'Posterize', min: 0, max: 1 },
  { id: 'effects.kaleidoscope', label: 'Kaleidoscope', min: 0, max: 1 },
  { id: 'effects.feedback', label: 'Feedback', min: 0, max: 1 },
  { id: 'effects.persistence', label: 'Persistence', min: 0, max: 1 },
  { id: 'particles.density', label: 'Particle Density', min: 0, max: 1 },
  { id: 'particles.speed', label: 'Particle Speed', min: 0, max: 1 },
  { id: 'particles.size', label: 'Particle Size', min: 0, max: 1 },
  { id: 'particles.glow', label: 'Particle Glow', min: 0, max: 1 },
  { id: 'sdf.scale', label: 'SDF Scale', min: 0, max: 1 },
  { id: 'sdf.edge', label: 'SDF Edge', min: 0, max: 0.5 },
  { id: 'sdf.glow', label: 'SDF Glow', min: 0, max: 1 },
  { id: 'sdf.rotation', label: 'SDF Rotation', min: -3.14, max: 3.14 },
  { id: 'sdf.fill', label: 'SDF Fill', min: 0, max: 1 }
];

/**
 * Resolve the natural `[min, max]` range for a global or legacy-layer
 * modulation target id (e.g. `'style.contrast'`, `'layer-plasma.speed'`).
 * Returns `undefined` when the target is unknown or its parameter defines no
 * numeric range — in which case callers should leave the connection's own
 * clamp alone rather than substitute a guessed range.
 */
export const resolveModTargetRange = (
  targetId: string
): { min: number; max: number } | undefined => {
  const global = GLOBAL_MOD_TARGETS.find((t) => t.id === targetId);
  if (global) return { min: global.min, max: global.max };

  const parsed = parseLegacyTarget(targetId);
  if (!parsed) return undefined;
  const param = getParamDef(parsed.layerType, parsed.param);
  if (!param || param.type !== 'number') return undefined;
  if (param.min == null || param.max == null) return undefined;
  return { min: param.min, max: param.max };
};