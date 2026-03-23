import { describe, expect, it, vi } from 'vitest';
import { compileActiveSceneShaders, compileSceneShaders, primeProjectShaders } from '../src/renderer/shaderLifecycle';
import { DEFAULT_PROJECT } from '../src/shared/project';

describe('shaderLifecycle', () => {
  it('compiles the provided scene and applies custom shader blocks', () => {
    const renderer = {
      recompileForGenerators: vi.fn(),
      precompileVariant: vi.fn(),
      setCustomShaderBlocks: vi.fn()
    };
    const scene = {
      ...DEFAULT_PROJECT.scenes[0],
      layers: [{
        id: 'layer-plasma',
        name: 'Plasma',
        enabled: true,
        role: 'core',
        opacity: 1,
        blendMode: 'screen',
        transform: { x: 0, y: 0, scale: 1, rotation: 0 },
        params: {}
      }]
    };
    const customBlocks = [{ id: 'custom-plasma', target: 'plasma', source: 'vec3 customPlasma(vec2 uv, float t) { return vec3(1.0); }' }] as any;
    const project = { ...DEFAULT_PROJECT, scenes: [scene as any], customShaderBlocks: customBlocks };

    const count = compileSceneShaders(renderer, scene as any, project as any, customBlocks);

    expect(count).toBe(1);
    expect(renderer.setCustomShaderBlocks).toHaveBeenCalledWith(customBlocks);
    expect(renderer.recompileForGenerators).toHaveBeenCalledTimes(1);
    expect(renderer.recompileForGenerators.mock.calls[0][0]).toEqual(new Set(['layer-plasma']));
    // Expected FX uniforms for a layer with id 'layer-plasma'
    const expectedFx = 'uniform float uscene_scene_0_bloom;\nuniform float uscene_scene_0_chroma;\nuniform float uscene_scene_0_blur;\nuniform float uscene_scene_0_posterize;\nuniform float uglobal_master_bloom;\nuniform float uglobal_master_chroma;\nuniform float uglobal_master_blur;\nuniform float uglobal_master_posterize;\nuniform float ulayer_layer_plasma_0_bloom;\nuniform float ulayer_layer_plasma_0_chroma;\nuniform float ulayer_layer_plasma_0_blur;\nuniform float ulayer_layer_plasma_0_posterize;\n';
    expect(renderer.recompileForGenerators).toHaveBeenCalledWith(new Set(['layer-plasma']), customBlocks, false, expectedFx);
  });

  it('falls back to the active scene when compiling a project', () => {
    const renderer = {
      recompileForGenerators: vi.fn(),
      precompileVariant: vi.fn(),
      setCustomShaderBlocks: vi.fn()
    };
    const project = JSON.parse(JSON.stringify(DEFAULT_PROJECT));
    project.activeSceneId = 'scene-2';
    project.scenes = [
      {
        ...project.scenes[0],
        id: 'scene-1',
        layers: []
      },
      {
        ...project.scenes[0],
        id: 'scene-2',
        layers: [{
          id: 'gen-lightning',
          name: 'Lightning',
          enabled: true,
          role: 'support',
          opacity: 1,
          blendMode: 'screen',
          transform: { x: 0, y: 0, scale: 1, rotation: 0 },
          generatorId: 'gen-lightning',
          params: {}
        }]
      }
    ];

    const count = compileActiveSceneShaders(renderer, project);

    expect(count).toBe(1);
    const expectedFx = 'uniform float uscene_scene_0_bloom;\nuniform float uscene_scene_0_chroma;\nuniform float uscene_scene_0_blur;\nuniform float uscene_scene_0_posterize;\nuniform float uglobal_master_bloom;\nuniform float uglobal_master_chroma;\nuniform float uglobal_master_blur;\nuniform float uglobal_master_posterize;\nuniform float ulayer_gen_lightning_0_bloom;\nuniform float ulayer_gen_lightning_0_chroma;\nuniform float ulayer_gen_lightning_0_blur;\nuniform float ulayer_gen_lightning_0_posterize;\n';
    expect(renderer.recompileForGenerators).toHaveBeenCalledWith(new Set(['gen-lightning']), [], false, expectedFx);
  });

  it('primes project shaders by compiling the active scene', () => {
    vi.useFakeTimers();
    try {
      const renderer = {
        recompileForGenerators: vi.fn(),
        precompileVariant: vi.fn(),
        setCustomShaderBlocks: vi.fn()
      };
      const project = JSON.parse(JSON.stringify(DEFAULT_PROJECT));
      project.activeSceneId = 'scene-2';
      project.scenes = [
        {
          ...project.scenes[0],
          id: 'scene-1',
          layers: [{
            id: 'layer-plasma',
            name: 'Plasma',
            enabled: true,
            role: 'core',
            opacity: 1,
            blendMode: 'screen',
            transform: { x: 0, y: 0, scale: 1, rotation: 0 },
            params: {}
          }]
        },
        {
          ...project.scenes[0],
          id: 'scene-2',
          layers: [{
            id: 'gen-lightning',
            name: 'Lightning',
            enabled: true,
            role: 'support',
            opacity: 1,
            blendMode: 'screen',
            transform: { x: 0, y: 0, scale: 1, rotation: 0 },
            generatorId: 'gen-lightning',
            params: {}
          }]
        }
      ];

      const count = primeProjectShaders(renderer, project, 250);

      expect(count).toBe(1);
      const expectedFx = 'uniform float uscene_scene_0_bloom;\nuniform float uscene_scene_0_chroma;\nuniform float uscene_scene_0_blur;\nuniform float uscene_scene_0_posterize;\nuniform float uglobal_master_bloom;\nuniform float uglobal_master_chroma;\nuniform float uglobal_master_blur;\nuniform float uglobal_master_posterize;\nuniform float ulayer_gen_lightning_0_bloom;\nuniform float ulayer_gen_lightning_0_chroma;\nuniform float ulayer_gen_lightning_0_blur;\nuniform float ulayer_gen_lightning_0_posterize;\n';
      expect(renderer.recompileForGenerators).toHaveBeenCalledWith(new Set(['gen-lightning']), [], false, expectedFx);
    } finally {
      vi.useRealTimers();
    }
  });
});
