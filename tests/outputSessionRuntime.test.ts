import { describe, expect, it, vi } from 'vitest';
import type { OutputConfig } from '../src/shared/project';
import { initializeOutputSession } from '../src/renderer/outputSessionRuntime';

describe('initializeOutputSession', () => {
  it('loads saved output state and applies merged config', async () => {
    const applyState = vi.fn().mockResolvedValue(undefined);
    const onOutputClosed = vi.fn();
    const closedHandlers: Array<() => void> = [];

    const result = await initializeOutputSession(
      {
        getOutputConfig: async () => ({ enabled: false, fullscreen: true, scale: 0.75 } as OutputConfig),
        isOutputOpen: async () => true,
        onOutputClosed: (handler) => {
          closedHandlers.push(handler);
        }
      },
      {
        defaultConfig: { enabled: false, fullscreen: false, scale: 1 },
        applyState,
        onOutputClosed
      }
    );

    expect(result.outputOpen).toBe(true);
    expect(result.config).toEqual({ enabled: true, fullscreen: true, scale: 0.75 });
    expect(applyState).toHaveBeenCalledWith({ enabled: true, fullscreen: true, scale: 0.75 }, true);
    expect(closedHandlers).toHaveLength(1);

    closedHandlers[0]();
    expect(onOutputClosed).toHaveBeenCalledTimes(1);
  });

  it('keeps saved enabled flag when output window is closed', async () => {
    const applyState = vi.fn().mockResolvedValue(undefined);

    const result = await initializeOutputSession(
      {
        getOutputConfig: async () => ({ enabled: true, fullscreen: false, scale: 0.5 } as OutputConfig),
        isOutputOpen: async () => false,
        onOutputClosed: () => {}
      },
      {
        defaultConfig: { enabled: false, fullscreen: false, scale: 1 },
        applyState
      }
    );

    expect(result.outputOpen).toBe(false);
    expect(result.config).toEqual({ enabled: true, fullscreen: false, scale: 0.5 });
    expect(applyState).toHaveBeenCalledWith({ enabled: true, fullscreen: false, scale: 0.5 }, false);
  });
});
