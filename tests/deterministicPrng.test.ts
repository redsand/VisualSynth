import { describe, expect, it } from 'vitest';
import {
  createPrng,
  deterministicPrngUtils,
  DEFAULT_DETERMINISTIC_SEED,
  createDefaultDeterministicPrng
} from '../src/shared/deterministicPrng';

describe('deterministicPrng', () => {
  it('creates a deterministic PRNG that produces same sequence with same seed', () => {
    const seed = 12345;
    const rng1 = createPrng(seed);
    const rng2 = createPrng(seed);

    const values1: number[] = [];
    const values2: number[] = [];

    for (let i = 0; i < 100; i++) {
      values1.push(rng1());
      values2.push(rng2());
    }

    expect(values1).toEqual(values2);
  });

  it('produces different sequences with different seeds', () => {
    const rng1 = createPrng(12345);
    const rng2 = createPrng(54321);

    const values1: number[] = [];
    const values2: number[] = [];

    for (let i = 0; i < 100; i++) {
      values1.push(rng1());
      values2.push(rng2());
    }

    // Very unlikely to be identical, but check first few
    expect(values1[0]).not.toEqual(values2[0]);
  });

  it('generates numbers in range [0, 1)', () => {
    const rng = createPrng(42);
    for (let i = 0; i < 1000; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('int utility generates integers in range', () => {
    const rng = createPrng(12345);
    for (let i = 0; i < 100; i++) {
      const value = deterministicPrngUtils.int(rng, 5, 15);
      expect(value).toBeGreaterThanOrEqual(5);
      expect(value).toBeLessThanOrEqual(15);
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it('float utility generates floats in range', () => {
    const rng = createPrng(12345);
    for (let i = 0; i < 100; i++) {
      const value = deterministicPrngUtils.float(rng, 1.5, 3.5);
      expect(value).toBeGreaterThanOrEqual(1.5);
      expect(value).toBeLessThan(3.5);
    }
  });

  it('choice utility picks from array', () => {
    const rng = createPrng(42);
    const items = ['a', 'b', 'c', 'd'];
    const choices: string[] = [];

    for (let i = 0; i < 20; i++) {
      const choice = deterministicPrngUtils.choice(rng, items);
      expect(choice).toBeDefined();
      if (choice) {
        choices.push(choice);
        expect(items).toContain(choice);
      }
    }
  });

  it('choice returns undefined for empty array', () => {
    const rng = createPrng(42);
    const result = deterministicPrngUtils.choice(rng, []);
    expect(result).toBeUndefined();
  });

  it('shuffle utility deterministically shuffles array', () => {
    // First test: same RNG produces same shuffle results
    const original = [1, 2, 3, 4, 5];

    // Create two separate RNGs with same seed
    const rng1 = createPrng(42);
    const shuffled1 = deterministicPrngUtils.shuffle(rng1, original);

    const rng2 = createPrng(42);
    const shuffled2 = deterministicPrngUtils.shuffle(rng2, original);

    // Same seed should produce same shuffle
    expect(shuffled1).toEqual(shuffled2);

    // Original should not be modified (returns copy)
    expect(original).toEqual([1, 2, 3, 4, 5]);

    // But with different seed, different shuffle
    const rng3 = createPrng(999);
    const shuffled3 = deterministicPrngUtils.shuffle(rng3, original);
    expect(shuffled1).not.toEqual(shuffled3);
  });

  it('deriveSeed produces consistent derived seeds', () => {
    const base = 12345;
    const salt1 = 'gravity';
    const salt2 = 'portal';

    const derived1 = deterministicPrngUtils.deriveSeed(base, salt1);
    const derived2 = deterministicPrngUtils.deriveSeed(base, salt1);
    const derived3 = deterministicPrngUtils.deriveSeed(base, salt2);

    expect(derived1).toBe(derived2);
    expect(derived1).not.toBe(derived3);
  });

  it('default deterministic prng is consistent across calls', () => {
    const rng1 = createDefaultDeterministicPrng();
    const rng2 = createDefaultDeterministicPrng();

    const values1: number[] = [];
    const values2: number[] = [];

    for (let i = 0; i < 50; i++) {
      values1.push(rng1());
      values2.push(rng2());
    }

    expect(values1).toEqual(values2);
  });
});
