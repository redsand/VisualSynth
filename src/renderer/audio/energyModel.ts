/**
 * One-pole exponential low-pass — the "Inertial Energy Accumulation" of the
 * engine-grammar energy bands.
 *
 *   pole    = clamp(mass, 0, 0.999)     // mass = Inertia (engines.ts)
 *   alpha   = 1 - pole
 *   energy  = energy * pole + target * alpha * friction
 *
 * Two engine-grammar knobs, both meaningful and both bounded:
 *  - `mass` (inertia) is the smoothing pole: 0 = instant, ->1 = very slow.
 *    Engine grammars differ in mass (0.4..1.0) to give each engine a distinct
 *    "feel", so mass must be the pole — using anything else here would make the
 *    documented Inertia knob a no-op.
 *  - `friction` (motion decay, 0.8..0.99) scales the input, so the steady
 *    state is `target * friction` — friction < 1 dissipates energy (a damped
 *    system), exactly the "decay" its doc string describes.
 *
 * Steady-state gain is `friction` (≤ 1), so the energy bands never exceed the
 * [0,1] range of the bass/mid/treb bands they follow — which the default
 * `env-1` 'engine.low' threshold of 0.65 and the 'engine.low/mid/high'
 * modMatrix sources all assume.
 *
 * The previous implementation mixed the two knobs into a leaky integrator
 * `energy*friction + target*(1-mass)` whose steady-state gain was
 * (1-mass)/(1-friction) — 10x at the default mass=0.5/friction=0.95 — which
 * saturated the energy bands and made the 0.65 threshold fire on any
 * bass >= ~0.065.
 */
export type EnergyBands = { low: number; mid: number; high: number };

export const stepEnergyModel = (
  prev: EnergyBands,
  target: EnergyBands,
  mass: number,
  friction: number
): EnergyBands => {
  // Clamp mass to [0, 0.999] so alpha > 0 (a pole of exactly 1 would never
  // converge and a negative pole would oscillate). Clamp friction to [0,1] so
  // the steady-state gain stays ≤ 1 (no amplification, no sign flip).
  const pole = Math.min(Math.max(mass, 0), 0.999);
  const alpha = 1 - pole;
  const gain = Math.min(Math.max(friction, 0), 1);
  return {
    low: prev.low * pole + target.low * alpha * gain,
    mid: prev.mid * pole + target.mid * alpha * gain,
    high: prev.high * pole + target.high * alpha * gain
  };
};