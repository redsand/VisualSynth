import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialState, createStore } from '../src/renderer/state/store';

const glMock = vi.hoisted(() => ({
  renderSpy: vi.fn(),
  resizeSpy: vi.fn(),
  setLayerAssetSpy: vi.fn(async () => undefined)
}));

vi.mock('../src/renderer/glRenderer', () => ({
  createGLRenderer: vi.fn(() => ({
    render: glMock.renderSpy,
    setLayerAsset: glMock.setLayerAssetSpy
  })),
  resizeCanvasToDisplaySize: glMock.resizeSpy,
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

describe('createRenderer loop integration behaviors', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    glMock.renderSpy.mockReset();
    glMock.resizeSpy.mockReset();
    glMock.setLayerAssetSpy.mockReset();

    const glCanvas = makeCanvas();
    const vizCanvas = makeCanvas();
    (globalThis as any).document = {
      getElementById: (id: string) => (id === 'gl-canvas' ? glCanvas : vizCanvas)
    };

    const posted: unknown[] = [];
    (globalThis as any).__postedOutput = posted;
    (globalThis as any).BroadcastChannel = class {
      postMessage(payload: unknown) {
        posted.push(payload);
      }
    };

    const rafCallbacks: FrameRequestCallback[] = [];
    (globalThis as any).__rafCallbacks = rafCallbacks;
    (globalThis as any).requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    });

    vi.spyOn(performance, 'now').mockReturnValue(0);

    (globalThis as any).window = {
      visualSynth: {
        autosaveProject: vi.fn(async () => undefined)
      }
    };
  });

  it('applies autosave cadence and output throttle with deterministic frame times', () => {
    const store = createStore(createInitialState());
    store.setState({ outputOpen: true }, false);

    const renderer = createRenderer({
      store,
      renderGraph: {
        buildRenderState: (time: number) => ({
          timeMs: time,
          rms: 0.2,
          peak: 0.3,
          strobe: 0.1,
          chemistryMode: 2,
          transitionAmount: 0.9,
          spectrum: new Float32Array([1, 2, 3]),
          sdfScene: { nodes: [{ id: 'node-a' }] },
          debugTint: 0.2
        }),
        getDebugState: vi.fn(() => ({}))
      } as any,
      audioEngine: {
        update: vi.fn(),
        getContext: vi.fn(() => null),
        getActiveBpm: vi.fn(() => 120)
      } as any,
      debugOverlay: { update: vi.fn() } as any,
      serializeProject: () => '{"ok":true}',
      onSceneApplied: vi.fn()
    });

    renderer.start();
    const runFrame = () => (globalThis as any).__rafCallbacks.shift() as FrameRequestCallback;

    runFrame()(40);
    expect((globalThis as any).__postedOutput).toHaveLength(1);
    const firstPayload = (globalThis as any).__postedOutput[0] as any;
    expect(firstPayload.sdfScene).toBeUndefined();
    expect(firstPayload.debugTint).toBeUndefined();

    runFrame()(60);
    expect((globalThis as any).__postedOutput).toHaveLength(1);

    runFrame()(80);
    expect((globalThis as any).__postedOutput).toHaveLength(2);

    runFrame()(120001);
    expect((globalThis as any).window.visualSynth.autosaveProject).toHaveBeenCalledTimes(1);
  });




  it('does not broadcast when output is closed and resumes after reopen', () => {
    const store = createStore(createInitialState());
    store.setState({ outputOpen: false }, false);

    const renderer = createRenderer({
      store,
      renderGraph: {
        buildRenderState: (time: number) => ({
          timeMs: time,
          rms: 0.2,
          peak: 0.3,
          strobe: 0.1,
          chemistryMode: 2,
          transitionAmount: 0.9,
          spectrum: new Float32Array([1, 2, 3])
        }),
        getDebugState: vi.fn(() => ({}))
      } as any,
      audioEngine: {
        update: vi.fn(),
        getContext: vi.fn(() => null),
        getActiveBpm: vi.fn(() => 120)
      } as any,
      debugOverlay: { update: vi.fn() } as any,
      serializeProject: () => '{}',
      onSceneApplied: vi.fn()
    });

    renderer.start();
    const runFrame = () => (globalThis as any).__rafCallbacks.shift() as FrameRequestCallback;

    runFrame()(40);
    runFrame()(80);
    expect((globalThis as any).__postedOutput).toHaveLength(0);

    store.setState({ outputOpen: true }, false);
    runFrame()(120);
    expect((globalThis as any).__postedOutput).toHaveLength(1);
  });

  it('advances transport time only while transport is playing', () => {
    const store = createStore(createInitialState());
    store.update((state) => {
      state.transport.timeMs = 100;
      state.transport.isPlaying = true;
    }, false);

    const renderer = createRenderer({
      store,
      renderGraph: {
        buildRenderState: (time: number) => ({
          timeMs: time,
          rms: 0.2,
          peak: 0.3,
          strobe: 0.1,
          chemistryMode: 2,
          transitionAmount: 0.9,
          spectrum: new Float32Array([1, 2, 3])
        }),
        getDebugState: vi.fn(() => ({}))
      } as any,
      audioEngine: {
        update: vi.fn(),
        getContext: vi.fn(() => null),
        getActiveBpm: vi.fn(() => 120)
      } as any,
      debugOverlay: { update: vi.fn() } as any,
      serializeProject: () => '{}',
      onSceneApplied: vi.fn()
    });

    renderer.start();
    const runFrame = () => (globalThis as any).__rafCallbacks.shift() as FrameRequestCallback;

    runFrame()(16);
    expect(store.getState().transport.timeMs).toBe(116);

    store.update((state) => {
      state.transport.isPlaying = false;
    }, false);
    runFrame()(32);
    expect(store.getState().transport.timeMs).toBe(116);
  });

  it('updates watchdog and latency diagnostics through renderer loop wiring', () => {
    const store = createStore(createInitialState());

    const audioContext = {
      baseLatency: 0.0123,
      outputLatency: 0.0456
    };

    const renderer = createRenderer({
      store,
      renderGraph: {
        buildRenderState: (time: number) => ({
          timeMs: time,
          rms: 0.2,
          peak: 0.3,
          strobe: 0.1,
          chemistryMode: 2,
          transitionAmount: 0.9,
          spectrum: new Float32Array([1, 2, 3])
        }),
        getDebugState: vi.fn(() => ({}))
      } as any,
      audioEngine: {
        update: vi.fn(),
        getContext: vi.fn(() => audioContext),
        getActiveBpm: vi.fn(() => 120)
      } as any,
      debugOverlay: { update: vi.fn() } as any,
      serializeProject: () => '{}',
      onSceneApplied: vi.fn()
    });

    renderer.start();
    const runFrame = () => (globalThis as any).__rafCallbacks.shift() as FrameRequestCallback;

    runFrame()(1000);
    expect(store.getState().diagnostics.lastWatchdogUpdate).toBe(0);
    expect(store.getState().diagnostics.latencyMs).toBe(12);
    expect(store.getState().diagnostics.outputLatencyMs).toBe(46);

    runFrame()(1001);
    expect(store.getState().diagnostics.lastWatchdogUpdate).toBe(1001);

    audioContext.outputLatency = undefined as any;
    runFrame()(1020);
    expect(store.getState().diagnostics.latencyMs).toBe(12);
    expect(store.getState().diagnostics.outputLatencyMs).toBeNull();
  });

  it('updates diagnostics fps and frame-drop score across frame cadence', () => {
    const store = createStore(createInitialState());

    const renderer = createRenderer({
      store,
      renderGraph: {
        buildRenderState: (time: number) => ({
          timeMs: time,
          rms: 0.2,
          peak: 0.3,
          strobe: 0.1,
          chemistryMode: 2,
          transitionAmount: 0.9,
          spectrum: new Float32Array([1, 2, 3]),
          sdfScene: { nodes: [{ id: 'node-a' }] },
          debugTint: 0.2
        }),
        getDebugState: vi.fn(() => ({}))
      } as any,
      audioEngine: {
        update: vi.fn(),
        getContext: vi.fn(() => null),
        getActiveBpm: vi.fn(() => 120)
      } as any,
      debugOverlay: { update: vi.fn() } as any,
      serializeProject: () => '{}',
      onSceneApplied: vi.fn()
    });

    renderer.start();
    const runFrame = () => (globalThis as any).__rafCallbacks.shift() as FrameRequestCallback;

    runFrame()(16);
    runFrame()(32);
    expect(store.getState().diagnostics.fps).toBe(0);
    expect(store.getState().diagnostics.frameDropScore).toBe(0);

    runFrame()(1080);
    expect(store.getState().diagnostics.fps).toBeGreaterThan(0);
    expect(store.getState().diagnostics.frameDropScore).toBeCloseTo(0.02);
  });

  it('handles quantized pending scene switch application at scheduled time', () => {
    const store = createStore(createInitialState());
    store.update((state) => {
      state.pendingSceneSwitch = { targetSceneId: 'scene-b', scheduledTimeMs: 1500 };
      state.transport.isPlaying = true;
    }, false);

    const onSceneApplied = vi.fn();
    const renderer = createRenderer({
      store,
      renderGraph: {
        buildRenderState: (time: number) => ({
          timeMs: time,
          rms: 0.2,
          peak: 0.3,
          strobe: 0.1,
          chemistryMode: 2,
          transitionAmount: 0.9,
          spectrum: new Float32Array([1, 2, 3]),
          sdfScene: { nodes: [{ id: 'node-a' }] },
          debugTint: 0.2
        }),
        getDebugState: vi.fn(() => ({}))
      } as any,
      audioEngine: {
        update: vi.fn(),
        getContext: vi.fn(() => null),
        getActiveBpm: vi.fn(() => 120)
      } as any,
      debugOverlay: { update: vi.fn() } as any,
      serializeProject: () => '{}',
      onSceneApplied
    });

    renderer.start();
    const runFrame = () => (globalThis as any).__rafCallbacks.shift() as FrameRequestCallback;

    runFrame()(1000);
    expect(store.getState().quantizeHudMessage).toBe('Switching in 1 beat');
    expect(onSceneApplied).not.toHaveBeenCalled();

    runFrame()(1500);
    expect(onSceneApplied).toHaveBeenCalledWith('scene-b');
    expect(store.getState().pendingSceneSwitch).toBeNull();
    expect(store.getState().quantizeHudMessage).toBeNull();
  });
});
