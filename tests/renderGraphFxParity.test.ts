import { describe, expect, it } from 'vitest';
import { RenderGraph } from '../src/renderer/render/RenderGraph';
import { createInitialState, createStore } from '../src/renderer/state/store';
import { DEFAULT_PROJECT } from '../src/shared/project';

const cloneProject = () => JSON.parse(JSON.stringify(DEFAULT_PROJECT));

describe('RenderGraph FX parity', () => {
  it('maps feedback amount to fx-feedback layer override (not visual-feedback generator layer)', () => {
    const store = createStore(createInitialState());
    const renderGraph = new RenderGraph(store);
    const project = cloneProject();
    const scene = project.scenes.find((item: any) => item.id === project.activeSceneId) ?? project.scenes[0];

    scene.layers.push({
      id: 'fx-feedback',
      name: 'FX Feedback',
      role: 'support',
      enabled: true,
      opacity: 0.9,
      blendMode: 'screen',
      transform: { x: 0, y: 0, scale: 1, rotation: 0 },
      params: {}
    });
    scene.layers.push({
      id: 'gen-visual-feedback',
      name: 'Visual Feedback',
      role: 'support',
      enabled: true,
      opacity: 0.1,
      blendMode: 'screen',
      transform: { x: 0, y: 0, scale: 1, rotation: 0 },
      params: {}
    });
    project.effects.feedback = 0.2;

    store.update((state) => {
      state.project = project;
    });

    const renderState = renderGraph.buildRenderState(0, 16, { width: 800, height: 600 });
    expect(renderState.feedback).toBeCloseTo(0.9, 6);
    expect(renderState.genUniforms.VisualFeedbackEnabled).toBe(1);
    // Dynamic resolver correctly multiplies params.opacity (1.0) by layer.opacity (0.1)
    expect(renderState.genUniforms.VisualFeedbackOpacity).toBeCloseTo(0.1, 6);
  });

  it('falls back to project effects.feedback when fx-feedback layer is absent', () => {
    const store = createStore(createInitialState());
    const renderGraph = new RenderGraph(store);
    const project = cloneProject();
    const scene = project.scenes.find((item: any) => item.id === project.activeSceneId) ?? project.scenes[0];

    scene.layers.push({
      id: 'gen-visual-feedback',
      name: 'Visual Feedback',
      role: 'support',
      enabled: true,
      opacity: 1,
      blendMode: 'screen',
      transform: { x: 0, y: 0, scale: 1, rotation: 0 },
      params: {}
    });
    project.effects.feedback = 0.27;

    store.update((state) => {
      state.project = project;
    });

    const renderState = renderGraph.buildRenderState(0, 16, { width: 800, height: 600 });
    expect(renderState.feedback).toBeCloseTo(0.27, 6);
    expect(renderState.genUniforms.VisualFeedbackEnabled).toBe(1);
  });
});

