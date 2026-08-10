import { describe, expect, it } from 'vitest';
import { stepEnergyModel } from '../src/renderer/audio/energyModel';

describe('stepEnergyModel (inertial energy low-pass)', () => {
  it('steady-state gain is friction (not 10x): converges to target * friction', () => {
    // The previous `energy*friction + target*(1-mass)` integrator converged to
    // target * (1-mass)/(1-friction) = 10 * target at the default
    // mass=0.5/friction=0.95. A proper low-pass must not amplify.
    let e = { low: 0, mid: 0, high: 0 };
    const target = { low: 0.8, mid: 0.5, high: 0.3 };
    const mass = 0.5, friction = 0.95; // engine defaults
    for (let i = 0; i < 5000; i += 1) e = stepEnergyModel(e, target, mass, friction);
    expect(e.low).toBeCloseTo(0.8 * 0.95, 2);
    expect(e.mid).toBeCloseTo(0.5 * 0.95, 2);
    expect(e.high).toBeCloseTo(0.3 * 0.95, 2);
  });

  it('with friction 1, converges exactly to the target (gain 1)', () => {
    let e = { low: 0, mid: 0, high: 0 };
    const target = { low: 0.8, mid: 0.5, high: 0.3 };
    for (let i = 0; i < 5000; i += 1) e = stepEnergyModel(e, target, 0.5, 1);
    expect(e.low).toBeCloseTo(0.8, 2);
    expect(e.mid).toBeCloseTo(0.5, 2);
    expect(e.high).toBeCloseTo(0.3, 2);
  });

  it('stays within [0,1] for a sustained unit input (no 10x saturation)', () => {
    let e = { low: 0, mid: 0, high: 0 };
    const target = { low: 1, mid: 1, high: 1 };
    for (let i = 0; i < 5000; i += 1) e = stepEnergyModel(e, target, 0.5, 0.95);
    expect(e.low).toBeLessThanOrEqual(1.0001);
    expect(e.mid).toBeLessThanOrEqual(1.0001);
    expect(e.high).toBeLessThanOrEqual(1.0001);
    // And never grows toward 10 (the old buggy steady state).
    expect(e.low).toBeLessThan(1.01);
  });

  it('higher mass (more inertia) lags a step more than lower mass', () => {
    const step = { low: 1, mid: 1, high: 1 };
    const run = (mass: number, frames: number) => {
      let e = { low: 0, mid: 0, high: 0 };
      for (let i = 0; i < frames; i += 1) e = stepEnergyModel(e, step, mass, 1);
      return e.low;
    };
    // mass is the documented Inertia knob — engines differ in it. After 20
    // frames the high-inertia (0.9) filter has risen far less than the
    // low-inertia (0.4) one.
    expect(run(0.9, 20)).toBeLessThan(run(0.4, 20));
    expect(run(0.9, 20)).toBeGreaterThan(0);
  });

  it('higher friction (less decay) settles to a higher steady state', () => {
    const target = { low: 1, mid: 1, high: 1 };
    const settle = (friction: number) => {
      let e = { low: 0, mid: 0, high: 0 };
      for (let i = 0; i < 5000; i += 1) e = stepEnergyModel(e, target, 0.5, friction);
      return e.low;
    };
    // friction = motion decay; lower friction dissipates more energy.
    expect(settle(0.98)).toBeGreaterThan(settle(0.85));
    expect(settle(0.85)).toBeCloseTo(0.85, 2);
    expect(settle(0.98)).toBeCloseTo(0.98, 2);
  });

  it('mass 0 is instant (energy == target*friction on first step)', () => {
    const e = stepEnergyModel({ low: 0, mid: 0, high: 0 }, { low: 0.7, mid: 0.4, high: 0.2 }, 0, 0.9);
    expect(e.low).toBeCloseTo(0.7 * 0.9, 6);
    expect(e.mid).toBeCloseTo(0.4 * 0.9, 6);
    expect(e.high).toBeCloseTo(0.2 * 0.9, 6);
  });

  it('clamps a pole of exactly 1 so the filter still converges', () => {
    let e = { low: 0, mid: 0, high: 0 };
    for (let i = 0; i < 20000; i += 1) e = stepEnergyModel(e, { low: 1, mid: 1, high: 1 }, 1, 1);
    expect(e.low).toBeGreaterThan(0.9);
  });

  it('falls back toward 0 when the target drops to 0 (releases)', () => {
    let e = { low: 1, mid: 1, high: 1 };
    for (let i = 0; i < 5000; i += 1) e = stepEnergyModel(e, { low: 0, mid: 0, high: 0 }, 0.5, 0.95);
    expect(e.low).toBeCloseTo(0, 2);
    expect(e.mid).toBeCloseTo(0, 2);
    expect(e.high).toBeCloseTo(0, 2);
  });

  it('distinguishes engines by their grammar (mass/friction spread)', () => {
    // Engines have distinct mass (0.4..1.0) and friction (0.85..0.98).
    // High-inertia+high-decay (mass 1.0/friction 0.85) settles lower AND slower
    // than low-inertia+low-decay (mass 0.4/friction 0.98).
    const settle = (mass: number, friction: number, frames: number) => {
      let e = { low: 0, mid: 0, high: 0 };
      for (let i = 0; i < frames; i += 1) e = stepEnergyModel(e, { low: 1, mid: 1, high: 1 }, mass, friction);
      return e.low;
    };
    // After a short window the snappy engine is well ahead...
    expect(settle(0.4, 0.98, 20)).toBeGreaterThan(settle(1.0, 0.85, 20));
    // ...and even at steady state the snappy one settles higher (less decay).
    expect(settle(0.4, 0.98, 5000)).toBeGreaterThan(settle(1.0, 0.85, 5000));
  });
});