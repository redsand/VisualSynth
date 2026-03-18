import { describe, expect, it } from 'vitest';
import { bindMilkwaveBuiltins } from '../src/renderer/milkwave/runtime/milkwaveBuiltins';

describe('Milkwave builtin binder', () => {
  it('binds q-vars, c-banks, and random banks through a uniform lookup callback', () => {
    const calls: Array<{ fn: string; args: unknown[] }> = [];
    const gl = {
      uniform1f: (...args: unknown[]) => calls.push({ fn: 'uniform1f', args }),
      uniform4f: (...args: unknown[]) => calls.push({ fn: 'uniform4f', args })
    };
    const known = new Set(['q1', '_c0', '_c2', '_c3', '_c15', '_qa', 'rand_frame', 'rand_preset']);
    const loc = (name: string) => (known.has(name) ? ({ name } as unknown as WebGLUniformLocation) : null);

    bindMilkwaveBuiltins({
      gl,
      loc,
      state: {
        timeSeconds: 12,
        frame: 24,
        width: 1920,
        height: 1080,
        rms: 0.5,
        bass: 0.2,
        mid: 0.3,
        treb: 0.4,
        bassAtt: 0.25,
        midAtt: 0.35,
        trebAtt: 0.45,
        qVars: Array.from({ length: 32 }, (_, index) => index + 1),
        randomPreset: [0.1, 0.2],
        randomFrame: [0.6, 0.7, 0.8, 0.9]
      }
    });

    expect(calls.some((call) => call.fn === 'uniform1f' && (call.args[0] as any).name === 'q1' && call.args[1] === 1)).toBe(true);
    expect(calls.some((call) => call.fn === 'uniform4f' && (call.args[0] as any).name === '_c3')).toBe(true);
    expect(calls.some((call) => call.fn === 'uniform4f' && (call.args[0] as any).name === '_qa')).toBe(true);
    expect(calls.some((call) => call.fn === 'uniform4f' && (call.args[0] as any).name === 'rand_preset')).toBe(true);
  });
});
