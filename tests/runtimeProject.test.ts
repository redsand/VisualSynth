import { describe, expect, it } from 'vitest';
import { prepareProjectForRuntime } from '../src/renderer/runtimeProject';
import { DEFAULT_PROJECT } from '../src/shared/project';

describe('prepareProjectForRuntime', () => {
  it('fills missing palettes and activePaletteId', () => {
    const project = JSON.parse(JSON.stringify(DEFAULT_PROJECT));
    project.palettes = [];
    project.activePaletteId = '';

    const prepared = prepareProjectForRuntime(project);

    expect(prepared.palettes.length).toBeGreaterThan(0);
    expect(prepared.activePaletteId).toBe(prepared.palettes[0].id);
  });

  it('assigns a single core layer and default params for known generators', () => {
    const project = JSON.parse(JSON.stringify(DEFAULT_PROJECT));
    project.scenes = [{
      ...project.scenes[0],
      id: 'scene-1',
      layers: [
        {
          id: 'gen-lightning',
          name: 'Lightning',
          enabled: true,
          opacity: 1,
          blendMode: 'screen',
          transform: { x: 0, y: 0, scale: 1, rotation: 0 },
          params: {}
        },
        {
          id: 'gen-shimmer-veil',
          name: 'Shimmer',
          enabled: true,
          opacity: 1,
          blendMode: 'screen',
          transform: { x: 0, y: 0, scale: 1, rotation: 0 },
          params: {}
        }
      ]
    }];

    const prepared = prepareProjectForRuntime(project);

    expect(prepared.scenes[0].layers.filter((layer: any) => layer.role === 'core')).toHaveLength(1);
    expect(prepared.scenes[0].layers[0].params!.opacity).toBe(1);
  });

  it('backfills overlay image paths into the asset list without duplicating existing assets', () => {
    const project = JSON.parse(JSON.stringify(DEFAULT_PROJECT));
    project.assets = [
      ...project.assets,
      {
        id: 'asset-existing-overlay',
        name: 'existing.png',
        kind: 'texture',
        path: '/show/existing.png',
        tags: [],
        addedAt: new Date().toISOString()
      }
    ];
    project.overlays = [
      {
        id: 'overlay-existing',
        name: 'Existing Overlay',
        type: 'image',
        enabled: true,
        x: 0,
        y: 0,
        width: 0.2,
        height: 0.2,
        opacity: 1,
        rotation: 0,
        includeInFx: false,
        assetPath: '/show/existing.png'
      },
      {
        id: 'overlay-new',
        name: 'Flyer Overlay',
        type: 'image',
        enabled: true,
        x: 0.2,
        y: 0.2,
        width: 0.2,
        height: 0.2,
        opacity: 1,
        rotation: 0,
        includeInFx: false,
        assetPath: '/show/flyer.png'
      }
    ];

    const prepared = prepareProjectForRuntime(project);
    const overlayAssets = prepared.assets.filter((asset: any) => asset.path === '/show/flyer.png');
    const existingAssets = prepared.assets.filter((asset: any) => asset.path === '/show/existing.png');

    expect(overlayAssets).toHaveLength(1);
    expect(overlayAssets[0].kind).toBe('texture');
    expect(overlayAssets[0].tags).toContain('overlay');
    expect(existingAssets).toHaveLength(1);
  });
});
