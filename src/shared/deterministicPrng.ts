/**
 * Deterministic PRNG Module
 *
 * Provides a seeded pseudo-random number generator for deterministic,
 * reproducible rendering. This replaces Math.random() in contexts
 * where consistent output across runs is required.
 *
 * Algorithm: Mulberry32 - a fast, high-quality 32-bit PRNG
 * @see https://github.com/bryc/code/blob/master/jswin/prng/mulberry32.js
 */

// ============================================================================
// Seeded PRNG Implementation
// ============================================================================

/**
 * Create a deterministic PRNG with the given seed.
 * Returns a function that produces uniform [0, 1) floats.
 */
export const createPrng = (seed: number): (() => number) => {
  // Ensure seed is a positive 32-bit integer
  let state = seed >>> 0;

  /**
   * Mulberry32 algorithm - returns [0, 1) float
   * Period: 2^32
   */
  const next = (): number => {
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // Return a function that produces numbers in [0, 1)
  return () => next();
};

/**
 * Utility functions for common PRNG operations
 */
export const deterministicPrngUtils = {
  /**
   * Generate a random integer in [min, max] inclusive
   */
  int: (rng: () => number, min: number, max: number): number => {
    const range = max - min + 1;
    return min + Math.floor(rng() * range);
  },

  /**
   * Generate a random float in [min, max)
   */
  float: (rng: () => number, min: number, max: number): number => {
    return min + rng() * (max - min);
  },

  /**
   * Pick a random element from an array
   */
  choice: <T>(rng: () => number, items: T[]): T | undefined => {
    if (items.length === 0) return undefined;
    const index = Math.floor(rng() * items.length);
    return items[index];
  },

  /**
   * Shuffle an array in place using Fisher-Yates algorithm
   * Deterministic when used with the same PRNG seed.
   */
  shuffle: <T>(rng: () => number, array: T[]): T[] => {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  },

  /**
   * Generate a random seed from a base seed + salt
   * Useful for creating sub-seeds for different systems
   */
  deriveSeed: (baseSeed: number, salt: string): number => {
    // Simple hash function to derive a new seed
    let hash = 0x811c9dc5; // FNV-1a offset basis
    for (let i = 0; i < salt.length; i++) {
      hash ^= salt.charCodeAt(i);
      hash = (hash * 0x01000193) | 0;
    }
    // Combine with base seed
    return (baseSeed + hash) | 0;
  }
};

/**
 * Default seed value for deterministic rendering
 * Using a fixed value ensures reproducible renders
 */
export const DEFAULT_DETERMINISTIC_SEED = 0x12345678;

/**
 * Create a default deterministic PRNG
 */
export const createDefaultDeterministicPrng = (): (() => number) => {
  return createPrng(DEFAULT_DETERMINISTIC_SEED);
};
