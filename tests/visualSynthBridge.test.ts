import { describe, expect, it, vi } from 'vitest';
import { ensureVisualSynthBridge } from '../src/renderer/visualSynthBridge';

describe('ensureVisualSynthBridge', () => {
  it('installs a fallback bridge when visualSynth is unavailable', async () => {
    const target = {} as Window & typeof globalThis;
    const warn = vi.fn();

    ensureVisualSynthBridge(target, warn);

    expect(warn).toHaveBeenCalledWith('[Init] window.visualSynth not found, providing mock API');
    expect(typeof (target as any).visualSynth.getOutputConfig).toBe('function');
    await expect((target as any).visualSynth.isOutputOpen()).resolves.toBe(false);
  });

  it('does not override an existing bridge', () => {
    const existing = { listPresets: vi.fn() };
    const target = { visualSynth: existing } as unknown as Window & typeof globalThis;

    ensureVisualSynthBridge(target);

    expect((target as any).visualSynth).toBe(existing);
  });
});
