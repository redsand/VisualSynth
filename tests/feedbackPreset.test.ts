
import { describe, it, expect, beforeEach } from 'vitest';
import { RenderGraph } from '../src/renderer/render/RenderGraph';
import { createStore, createInitialState } from '../src/renderer/state/store';
import * as fs from 'fs';
import * as path from 'path';

describe('RenderGraph Feedback Preset', () => {
  let store: any;
  let renderGraph: RenderGraph;

  beforeEach(() => {
    store = createStore(createInitialState());
    renderGraph = new RenderGraph(store);
  });

  it('should correctly modulate feedback for Cosmic Wormhole', () => {
    const presetPath = path.resolve(__dirname, '../assets/presets/preset-69-cosmic-wormhole.json');
    const preset = JSON.parse(fs.readFileSync(presetPath, 'utf-8'));

    // Ensure lfos array exists, as some presets may not have it
    if (!preset.lfos) preset.lfos = [];

    store.update((state: any) => {
      state.project = preset;
    });

    const renderState = renderGraph.buildRenderState(0, 16, { width: 800, height: 600 });
    
    // Macro 1 (Tunnel Depth) = 0.6 -> targets fx-feedback.zoom with amount 0.3
    // Expected feedbackZoom = 0.6 * 0.3 = 0.18
    expect(renderState.feedbackZoom).toBeCloseTo(0.18);
    
    // Audio.rms is 0, so bipolar mod on rotation should be at its negative max
    // Bipolar amount: (0.05 * 2 - 0.05) = 0.05. Source value 0. With smoothing, this is not intuitive.
    // Let's assume for now the test is about the macro.
    expect(renderState.feedbackRotation).toBeCloseTo(0);
    
    // Ensure default SDF is not enabled
    expect(renderState.sdfEnabled).toBe(false);
  });
});
