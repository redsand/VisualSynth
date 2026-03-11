import { describe, expect, it } from 'vitest';
import {
  buildRendererOutputBroadcastPayload,
  buildRendererOutputPayload
} from '../src/renderer/render/outputPayload';

describe('buildRendererOutputPayload', () => {
  it('maps critical render fields, clones spectrum data, and excludes non-output fields', () => {
    const spectrum = new Float32Array([0.1, 0.2, 0.3]);
    const payload = buildRendererOutputPayload({
      timeMs: 42,
      rms: 0.7,
      strobe: 0.4,
      chemistryMode: 2,
      transitionAmount: 0.9,
      spectrum,
      sdfScene: { nodes: [{ id: 'n1' }] },
      debugTint: 0.5
    } as any);

    expect(payload.timeMs).toBe(42);
    expect(payload.rms).toBe(0.7);
    expect(payload.strobe).toBe(0.4);
    expect(payload.chemistryMode).toBe(2);
    expect(payload.transitionAmount).toBe(0.9);
    expect(Array.from(payload.spectrum)).toEqual(expect.arrayContaining([
      expect.closeTo(0.1, 6),
      expect.closeTo(0.2, 6),
      expect.closeTo(0.3, 6)
    ]));
    expect(payload.spectrum).not.toBe(spectrum);
    expect((payload as any).sdfScene).toBeUndefined();
    expect((payload as any).debugTint).toBeUndefined();
  });

  it('builds output broadcast metadata with palette colors and layer assets from the active scene', () => {
    const payload = buildRendererOutputBroadcastPayload({
      renderState: {
        spectrum: new Float32Array([0.5]),
        sdfScene: { nodes: [] }
      } as any,
      project: {
        activePaletteId: 'p-main',
        palettes: [
          { id: 'p-main', colors: ['#111111', '#222222'] },
          { id: 'p-alt', colors: ['#333333', '#444444'] }
        ],
        assets: [
          { id: 'asset-plasma', name: 'Plasma Asset', kind: 'texture', path: '/tmp/plasma.png' },
          { id: 'asset-spectrum', name: 'Spectrum Asset', kind: 'video', path: '/tmp/spec.mp4' }
        ],
        scenes: []
      } as any,
      scene: {
        id: 'scene-a',
        name: 'Scene A',
        layers: [
          { id: 'layer-plasma', assetId: 'asset-plasma' },
          { id: 'layer-spectrum', assetId: 'asset-spectrum' },
          { id: 'layer-media' }
        ]
      } as any
    });

    expect(payload.paletteColors).toEqual(['#111111', '#222222']);
    expect(payload.layerAssets?.['layer-plasma']).toMatchObject({
      id: 'asset-plasma',
      name: 'Plasma Asset',
      kind: 'texture',
      path: '/tmp/plasma.png'
    });
    expect(payload.layerAssets?.['layer-spectrum']).toMatchObject({
      id: 'asset-spectrum',
      name: 'Spectrum Asset',
      kind: 'video',
      path: '/tmp/spec.mp4'
    });
    expect(payload.layerAssets?.['layer-media']).toBeNull();
    expect((payload as any).sdfScene).toBeUndefined();
  });
});
