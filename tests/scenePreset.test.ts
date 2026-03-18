import { describe, expect, it } from 'vitest';
import { DEFAULT_PROJECT } from '../src/shared/project';
import { createScenePreset } from '../src/shared/scenePreset';

describe('createScenePreset', () => {
  it('builds a standalone preset from a single scene and carries referenced assets', () => {
    const project = JSON.parse(JSON.stringify(DEFAULT_PROJECT));
    const scene = project.scenes[0];
    scene.name = 'Saved Scene';
    scene.layers = [
      {
        id: 'layer-media',
        name: 'Media',
        role: 'core',
        enabled: true,
        opacity: 1,
        blendMode: 'normal',
        transform: { x: 0, y: 0, scale: 1, rotation: 0 },
        assetId: 'asset-title-card'
      }
    ];
    project.assets.push({
      id: 'asset-title-card',
      name: 'Title Card',
      kind: 'text',
      tags: ['preset'],
      addedAt: new Date().toISOString(),
      options: { text: 'Saved Scene', fontSize: 96, fontColor: '#ffffff' }
    });

    const preset = createScenePreset(project, scene.id);

    expect(preset.version).toBe(6);
    expect(preset.metadata.name).toBe('Saved Scene');
    expect(preset.scenes).toHaveLength(1);
    expect(preset.project.scenes).toHaveLength(1);
    expect(preset.assets.some((asset: any) => asset.id === 'asset-title-card')).toBe(true);
    expect(preset.assets.some((asset: any) => asset.id === 'internal-waveform')).toBe(true);
    expect(preset.scenes[0].layers[0].assetId).toBe('asset-title-card');
  });
});
