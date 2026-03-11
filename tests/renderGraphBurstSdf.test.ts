import { describe, expect, it, vi } from 'vitest';
import { RenderGraph } from '../src/renderer/render/RenderGraph';
import { createStore, createInitialState } from '../src/renderer/state/store';

describe('RenderGraph burst SDF initialization', () => {
  it('registers built-in SDF nodes before loading burst presets', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      const store = createStore(createInitialState());
      const renderGraph = new RenderGraph(store);
      renderGraph.buildRenderState(0, 16, { width: 800, height: 600 });

      const burstWarnings = warnSpy.mock.calls.filter(([message]) =>
        String(message).includes('BurstSdfManager: Shape')
      );

      expect(burstWarnings).toEqual([]);
    } finally {
      warnSpy.mockRestore();
    }
  });
});
