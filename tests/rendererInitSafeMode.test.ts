import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialState, createStore } from '../src/renderer/state/store';

vi.mock('../src/renderer/glRenderer', () => ({
  createGLRenderer: vi.fn(() => {
    throw new Error('WebGL disabled for test');
  }),
  resizeCanvasToDisplaySize: vi.fn(),
  RenderState: {}
}));

import { createRenderer } from '../src/renderer/render/Renderer';

const makeCanvas = () => ({
  width: 640,
  height: 360,
  getContext: vi.fn(() => ({
    fillStyle: '',
    font: '',
    fillRect: vi.fn(),
    fillText: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    globalAlpha: 1,
    lineWidth: 1,
    strokeStyle: ''
  }))
});

describe('createRenderer safe-mode init guard', () => {
  beforeEach(() => {
    const glCanvas = makeCanvas();
    const vizCanvas = makeCanvas();
    (globalThis as any).document = {
      getElementById: (id: string) => (id === 'gl-canvas' ? glCanvas : vizCanvas)
    };
    (globalThis as any).BroadcastChannel = class {
      postMessage() {}
    };
  });

  it('captures WebGL init errors and records safe mode reason', () => {
    const store = createStore(createInitialState());

    createRenderer({
      store,
      renderGraph: { buildRenderState: vi.fn(), getDebugState: vi.fn() } as any,
      audioEngine: { update: vi.fn(), getContext: vi.fn(), getActiveBpm: vi.fn(() => 120) } as any,
      debugOverlay: { update: vi.fn() } as any,
      serializeProject: () => '{}',
      onSceneApplied: vi.fn()
    });

    const state = store.getState();
    expect(state.safeMode.webglInitError).toBe('WebGL disabled for test');
    expect(state.safeMode.reasons).toContain('Renderer init failed');
  });
});
