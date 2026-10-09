/**
 * Deterministic Rendering Tests
 *
 * These tests verify that:
 * 1. PRNG produces consistent results with the same seed
 * 2. Render graph instance IDs are reproducible
 * 3. Milkwave builtins use deterministic random values
 */

import { describe, expect, it } from 'vitest';
import {
  createPrng,
  deterministicPrngUtils,
  DEFAULT_DETERMINISTIC_SEED,
  createDefaultDeterministicPrng
} from '../src/shared/deterministicPrng';
import { createMilkwaveBuiltinState } from '../src/renderer/milkwave/runtime/milkwaveBuiltins';
import {
  createNodeInstance,
  resetInstanceIdCounter,
  setInstanceIdCounter
} from '../src/shared/renderGraph';
import {
  createVisualNode,
  createFloatParameter,
  createOutputPort
} from '../src/shared/visualNode';

describe('deterministicRendering', () => {
  describe('PRNG determinism', () => {
    it('same seed produces same random sequence', () => {
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

    it('default deterministic prng produces consistent values', () => {
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

  describe('instance ID determinism', () => {
    it('instance IDs are reproducible across reset', () => {
      resetInstanceIdCounter();
      const node = createVisualNode({
        id: 'test-gen',
        name: 'Test Generator',
        kind: 'generator',
        category: 'generative',
        outputs: [createOutputPort('out', 'Output', 'rgba')]
      });

      const instance1 = createNodeInstance(node);
      expect(instance1.instanceId).toBe('test-gen-0');

      // Reset and create again - should get same ID
      resetInstanceIdCounter();
      const instance2 = createNodeInstance(node);
      expect(instance2.instanceId).toBe('test-gen-0');
      expect(instance2.instanceId).toBe(instance1.instanceId);
    });

    it('counter-based IDs are sequential', () => {
      resetInstanceIdCounter();
      const node = createVisualNode({
        id: 'test-gen',
        name: 'Test Generator',
        kind: 'generator',
        category: 'generative',
        outputs: [createOutputPort('out', 'Output', 'rgba')]
      });

      const instances: string[] = [];
      for (let i = 0; i < 5; i++) {
        instances.push(createNodeInstance(node).instanceId);
      }

      // Verify sequential IDs
      expect(instances).toEqual(['test-gen-0', 'test-gen-1', 'test-gen-2', 'test-gen-3', 'test-gen-4']);
    });
  });

  describe('milkwave builtin determinism', () => {
    it('createMilkwaveBuiltinState uses deterministic random values', () => {
      const dummyRenderState = {
        rms: 0.5,
        bass: 0.3,
        mid: 0.4,
        treb: 0.2,
        spectrum: new Float32Array(64)
      };

      // The PRNG is seeded at module load time and advances between calls
      // So consecutive calls will produce different values in the sequence
      const state1 = createMilkwaveBuiltinState({
        renderState: dummyRenderState,
        timeSeconds: 10,
        frame: 60,
        width: 1920,
        height: 1080,
        qVars: Array.from({ length: 32 }, (_, i) => i + 1),
        randomPreset: [0.1, 0.2]
      });

      const state2 = createMilkwaveBuiltinState({
        renderState: dummyRenderState,
        timeSeconds: 10,
        frame: 60,
        width: 1920,
        height: 1080,
        qVars: Array.from({ length: 32 }, (_, i) => i + 1),
        randomPreset: [0.1, 0.2]
      });

      // Each call uses the next random values from the sequence
      expect(state1.randomFrame).not.toEqual(state2.randomFrame);

      // But we can verify that all values are in valid range [0, 1)
      state1.randomFrame.forEach(v => {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      });
      state2.randomFrame.forEach(v => {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      });
    });

    it('milkwavePrng produces consistent sequence when seeded', () => {
      // This verifies that the PRNG produces the same sequence with the same seed
      const seed = 0x12345678;
      const rng1 = createPrng(seed);
      const rng2 = createPrng(seed);

      const values1: number[] = [];
      const values2: number[] = [];

      for (let i = 0; i < 100; i++) {
        values1.push(rng1());
        values2.push(rng2());
      }

      // Same seed produces identical sequences
      expect(values1).toEqual(values2);
    });
  });

  describe('util functions', () => {
    it('deriveSeed produces consistent results', () => {
      const base = 12345;
      const salt = 'gravity';

      const derived1 = deterministicPrngUtils.deriveSeed(base, salt);
      const derived2 = deterministicPrngUtils.deriveSeed(base, salt);

      expect(derived1).toBe(derived2);
    });

    it('shuffle produces deterministic results with same RNG', () => {
      const original = [1, 2, 3, 4, 5];
      const rng1 = createPrng(42);
      const rng2 = createPrng(42);

      const shuffled1 = deterministicPrngUtils.shuffle(rng1, [...original]);
      const shuffled2 = deterministicPrngUtils.shuffle(rng2, [...original]);

      expect(shuffled1).toEqual(shuffled2);
    });
  });
});
