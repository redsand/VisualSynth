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
});
