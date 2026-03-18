import { describe, expect, it } from 'vitest';
import {
  MILKWAVE_RUNTIME_CONTRACT,
  MILKWAVE_SAMPLER_BINDINGS,
  MILKWAVE_VEC4_BUILTINS
} from '../src/renderer/milkwave/runtime/milkwaveContract';

describe('Milkwave runtime contract', () => {
  it('defines the expected q-bank and c-bank builtin inventory', () => {
    expect(MILKWAVE_RUNTIME_CONTRACT.qVariableCount).toBe(32);
    expect(MILKWAVE_VEC4_BUILTINS.some((entry) => entry.name === '_c15')).toBe(true);
    expect(MILKWAVE_VEC4_BUILTINS.some((entry) => entry.name === '_qh')).toBe(true);
    expect(MILKWAVE_VEC4_BUILTINS.some((entry) => entry.name === 'rand_preset')).toBe(true);
  });

  it('defines previous-frame and blur samplers explicitly', () => {
    const samplerMain = MILKWAVE_SAMPLER_BINDINGS.find((entry) => entry.name === 'sampler_main');
    expect(samplerMain?.aliases).toContain('sampler_fc_main');
    expect(MILKWAVE_SAMPLER_BINDINGS.some((entry) => entry.name === 'sampler_blur1')).toBe(true);
    expect(MILKWAVE_SAMPLER_BINDINGS.some((entry) => entry.name === 'sampler_noisevol_lq' && entry.kind === '3d')).toBe(true);
  });
});
