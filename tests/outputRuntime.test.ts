import { describe, expect, it } from 'vitest';
import { resolveProjectOutputConfig, rebindLayerAssets } from '../src/renderer/outputRuntime';
import { DEFAULT_OUTPUT_CONFIG, DEFAULT_PROJECT } from '../src/shared/project';

describe('resolveProjectOutputConfig', () => {
  it('merges project output over defaults', () => {
    const project = {
      ...DEFAULT_PROJECT,
      output: {
        enabled: true,
        fullscreen: true,
        scale: 2
      }
    };

    const result = resolveProjectOutputConfig(project);

    expect(result).toEqual({
      ...DEFAULT_OUTPUT_CONFIG,
      enabled: true,
      fullscreen: true,
      scale: 2
    });
  });

  it('preserves current runtime output fields until the project overrides them', () => {
    const project: any = {
      ...DEFAULT_PROJECT,
      output: {
        enabled: true
      }
    };

    const result = resolveProjectOutputConfig(project, {
      fullscreen: true,
      scale: 0.5
    });

    expect(result).toEqual({
      ...DEFAULT_OUTPUT_CONFIG,
      enabled: true,
      fullscreen: true,
      scale: 0.5
    });
  });

  it('lets the project output override the current runtime window for fields it sets', () => {
    // resolveProjectOutputConfig is project-wins: the loaded project's output
    // takes precedence over the current runtime window config (the current
    // runtime only fills fields the project leaves unset). This is what makes
    // output travel with a project/preset on load.
    const project: any = {
      ...DEFAULT_PROJECT,
      output: { ...DEFAULT_OUTPUT_CONFIG, scale: 0.25, fullscreen: true }
    };

    const result = resolveProjectOutputConfig(project, {
      scale: 0.5,
      fullscreen: false
    });

    expect(result.scale).toBe(0.25);
    expect(result.fullscreen).toBe(true);
  });
});

describe('rebindLayerAssets', () => {
  type Call = { layerId: string; kind: string; video?: any; textCanvas?: any };

  const run = (layerAssets: Record<string, any>, videoElements: Record<string, any>) => {
    const calls: Call[] = [];
    rebindLayerAssets({
      layerAssets,
      videoElements,
      setLayerAsset: (layerId, asset, videoOverride, textCanvas) =>
        calls.push({ layerId, kind: asset.kind, video: videoOverride, textCanvas }),
      getTextCanvas: (asset) => ({ isTextCanvas: true, for: asset.id } as any),
      onRebind: (layerId, kind) => calls.find((c) => c.layerId === layerId) && void 0
    });
    return calls;
  };

  it('reuses the existing video element for live assets (no re-acquire)', () => {
    const liveVideo = { isLiveStream: true } as any;
    const calls = run(
      { 'layer-plasma': { id: 'a1', kind: 'live', options: {} } },
      { 'layer-plasma': liveVideo }
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].kind).toBe('live');
    expect(calls[0].video).toBe(liveVideo);
  });

  it('reuses the existing video element for video assets', () => {
    const vid = { isVideoEl: true } as any;
    const calls = run(
      { 'layer-media': { id: 'a2', kind: 'video', options: {} } },
      { 'layer-media': vid }
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].kind).toBe('video');
    expect(calls[0].video).toBe(vid);
  });

  it('passes undefined video and a text canvas for text assets', () => {
    const calls = run(
      { 'layer-spectrum': { id: 'a3', kind: 'text', options: { text: 'hi' } } },
      {}
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].kind).toBe('text');
    expect(calls[0].video).toBeUndefined();
    expect((calls[0].textCanvas as any).isTextCanvas).toBe(true);
  });

  it('passes undefined video for image assets', () => {
    const calls = run(
      { 'gen-asset-vortex': { id: 'a4', kind: 'image', options: {} } },
      {}
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].kind).toBe('image');
    expect(calls[0].video).toBeUndefined();
  });

  it('skips null (unbound) layer entries', () => {
    const calls = run(
      {
        'layer-plasma': null,
        'layer-media': { id: 'a2', kind: 'video', options: {} }
      },
      {}
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].layerId).toBe('layer-media');
  });

  it('issues a setLayerAsset for every bound layer', () => {
    const calls = run(
      {
        'layer-plasma': { id: 'a1', kind: 'image', options: {} },
        'layer-media': { id: 'a2', kind: 'video', options: {} },
        'gen-asset-echo': { id: 'a3', kind: 'text', options: { text: 'x' } }
      },
      { 'layer-media': { v: 1 } as any }
    );
    expect(calls.map((c) => c.layerId).sort()).toEqual([
      'gen-asset-echo',
      'layer-media',
      'layer-plasma'
    ]);
  });
});
