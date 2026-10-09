import { ModConnection } from './project';

export interface ModSourceValues {
  [key: string]: number;
}

/**
 * Optional temporal context. When supplied, a connection's `smoothing` is
 * applied as a per-connection exponential low-pass over time (a real
 * smoothing/lag), rather than the legacy behavior of a static depth cut
 * `(1 - smoothing)` that simply attenuated the modulation magnitude and
 * where smoothing=1 killed modulation entirely.
 *
 * The low-pass is stateful: `state` carries each connection's last output
 * between frames, keyed by `${mod.id}|${targetId}`, tagged with the frame it
 * was computed on. Callers that own a render loop allocate one such Map and
 * pass it every frame with a monotonically increasing `frame` (RenderGraph
 * keeps `this.modSmoothingState` + a frame counter; the live index.ts path
 * keeps a module-level Map + counter). Stateless callers (tests, one-shot
 * value lookups) omit the context and receive the raw, un-smoothed
 * contribution — a single sample cannot be smoothed.
 *
 * The `frame` token makes the low-pass idempotent within a single frame: a
 * connection's contribution depends only on its source value + amount (NOT
 * on the base parameter value), and the render paths legitimately call
 * `modValue` more than once per frame for the same target (e.g. RenderGraph
 * resolves `effects.bloom` for both the global-master uniform and the scene
 * FX block). Without the token, each repeat call would advance the low-pass
 * again and compound the smoothing rate. With it, the second call reuses the
 * value the first call stored this frame.
 */
export interface ModMatrixContext {
  /** Frame delta in seconds (deltaMs / 1000). */
  dt: number;
  /** Monotonic per-frame counter; repeated calls in the same frame reuse the
   *  stored smoothed value instead of re-smoothing. */
  frame: number;
  /** Persistent per-connection low-pass state, keyed by `${mod.id}|${targetId}`. */
  state: Map<string, ModSmoothEntry>;
}

/** One connection's last low-pass output and the frame it was computed on. */
export interface ModSmoothEntry {
  value: number;
  frame: number;
}

// Low-pass rate mapping. smoothing=0 → rate=RATE_MAX (effectively no lag,
// full depth on frame 1); smoothing=1 → rate=RATE_MIN (very slow). The curve
// is exponential in smoothing so most of the slider range stays responsive
// and only the top end gets genuinely sluggish.
const RATE_MAX = 100; // per-second rate at smoothing=0 (≈instant)
const RATE_MIN = 0.5; // per-second rate at smoothing=1 (≈2s time constant)

export const applyModMatrix = (
  baseValue: number,
  targetId: string,
  sources: ModSourceValues,
  connections: ModConnection[],
  fallbackRange?: { min: number; max: number },
  ctx?: ModMatrixContext
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
    
    // Bipolar remaps amount from [0,1] to [-1,1] so the modulation can deflect
    // in either direction. The previous expression `(amount*2 - amount)`
    // simplifies to `amount`, so bipolar mode was a no-op identical to unipolar.
    const modAmount = mod.bipolar ? (mod.amount * 2 - 1) : mod.amount;
    // `raw` is this connection's instantaneous contribution to `value`. It is
    // NOT attenuated by smoothing — the old code multiplied by (1 - smoothing),
    // which was a static depth cut (and smoothing=1 silenced the modulation
    // entirely, despite "smoothing" suggesting a temporal lag, not a kill).
    // Smoothing is now a genuine per-connection exponential low-pass: the raw
    // contribution is settled toward its previous output at a rate that falls
    // as smoothing rises. With no ctx (stateless one-shot / tests) there is no
    // prior sample to smooth against, so the raw contribution is used as-is.
    const raw = shaped * modAmount;
    let contribution = raw;
    const smoothing = Math.min(Math.max(mod.smoothing, 0), 1);
    if (ctx && smoothing > 0 && ctx.dt > 0) {
      const key = `${mod.id}|${targetId}`;
      const entry = ctx.state.get(key);
      if (entry && entry.frame === ctx.frame) {
        // Idempotent within a frame: this (connection, target) was already
        // smoothed this frame (a render path re-asked for the same target).
        // Reuse the stored contribution instead of advancing the low-pass
        // again, which would compound the smoothing rate.
        contribution = entry.value;
      } else {
        const prev = entry ? entry.value : raw;
        // No-lag-at-0 rate curve: smoothing=0 → RATE_MAX (instant), smoothing=1
        // → RATE_MIN (slow). The exponential interpolation converges toward raw
        // with time constant 1/rate. On the first ever sample (no prior entry)
        // prev = raw, so contribution = raw — lag-free, full depth.
        const rate = RATE_MAX * Math.pow(RATE_MIN / RATE_MAX, smoothing);
        const alpha = 1 - Math.exp(-ctx.dt * rate);
        contribution = prev + (raw - prev) * alpha;
        ctx.state.set(key, { value: contribution, frame: ctx.frame });
      }
    }
    value += contribution;
  }
  const minValue = minClamp ?? 0;
  const maxValue = maxClamp ?? 1;
  const clampedMin = Math.min(minValue, maxValue);
  const clampedMax = Math.max(minValue, maxValue);
  return Math.min(Math.max(value, clampedMin), clampedMax);
};
