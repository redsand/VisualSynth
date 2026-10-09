/**
 * Unit tests for the canonical asset/layer binding resolvers.
 *
 * Tests cover:
 * - Scene resolution by ID and active scene
 * - Layer resolution by ID within a scene
 * - Asset binding resolution from layers
 * - Generator-bound layers (no assetId)
 * - Missing asset handling
 * - Nested resolution helpers
 */

import { describe, expect, it } from 'vitest';
import {
  // Scene resolvers
  resolveScene,
  resolveActiveScene,
  // Layer resolvers
  resolveLayer,
  resolveSceneLayer,
  resolveActiveSceneLayer,
  // Asset resolvers
  resolveLayerAsset,
  resolveProjectLayerAsset,
  resolveActiveSceneLayerAsset,
  resolveProjectAsset,
  resolveSceneAssetBindings,
  // Error helpers
  ensureResolution,
  withFallback,
  // Status types
  type ResolutionStatus,
  type SceneResolution,
  type LayerResolution,
  type LayerAssetResolution
} from '../src/shared/resolvers';
import { createPrng, DEFAULT_DETERMINISTIC_SEED } from '../src/shared/deterministicPrng';
import type { VisualSynthProject, SceneConfig, AssetItem } from '../src/shared/project';

/**
 * Complete an intentionally-minimal project fixture. Runtime values are
 * unchanged; only the compile-time shape is filled in.
 */
const asProject = (fixture: Partial<VisualSynthProject>): VisualSynthProject => fixture as VisualSynthProject;

// Canonical default layer transform (matches DEFAULT_PROJECT / shared/layers.ts fallback).
const defaultTransform = { x: 0, y: 0, scale: 1, rotation: 0 };

// Helper to create a test project with scenes, layers, and assets.
// The project is an intentionally minimal fixture — only the fields the
// resolvers read — cast to VisualSynthProject.
const createTestProject = () => {
  const assets: AssetItem[] = [
    { id: 'asset-1', name: 'Texture A', kind: 'texture', tags: [], addedAt: '2024-01-01' },
    { id: 'asset-2', name: 'Texture B', kind: 'texture', tags: [], addedAt: '2024-01-01' },
    { id: 'asset-missing', name: 'Missing Asset', kind: 'texture', tags: [], addedAt: '2024-01-01' },
    { id: 'asset-video', name: 'Video Clip', kind: 'video', tags: [], addedAt: '2024-01-01' }
  ];

  const scenes: SceneConfig[] = [
    {
      id: 'scene-1',
      name: 'Main Scene',
      layers: [
        { id: 'layer-with-asset', name: 'Layer With Asset', role: 'core', enabled: true, opacity: 1, blendMode: 'normal', transform: { ...defaultTransform }, assetId: 'asset-1' },
        { id: 'layer-with-asset-2', name: 'Layer With Asset 2', role: 'support', enabled: true, opacity: 1, blendMode: 'normal', transform: { ...defaultTransform }, assetId: 'asset-2' },
        { id: 'layer-no-binding', name: 'Layer No Binding', role: 'atmosphere', enabled: true, opacity: 1, blendMode: 'normal', transform: { ...defaultTransform } },
        { id: 'layer-with-generator', name: 'Layer With Generator', role: 'support', enabled: true, opacity: 1, blendMode: 'normal', transform: { ...defaultTransform }, generatorId: 'gen-plasma' },
        { id: 'layer-missing-asset', name: 'Layer Missing Asset', role: 'core', enabled: true, opacity: 1, blendMode: 'normal', transform: { ...defaultTransform }, assetId: 'asset-does-not-exist' }
      ]
    },
    {
      id: 'scene-2',
      name: 'Secondary Scene',
      layers: [
        { id: 'layer-scene2', name: 'Layer Scene 2', role: 'core', enabled: true, opacity: 1, blendMode: 'normal', transform: { ...defaultTransform }, assetId: 'asset-video' }
      ]
    }
  ];

  return {
    assets,
    scenes,
    project: asProject({
      version: 6,
      name: 'Test Project',
      assets,
      scenes,
      activeSceneId: 'scene-1'
    })
  };
};

describe('resolvers', () => {
  describe('resolveScene', () => {
    it('resolves scene by ID when it exists', () => {
      const { project } = createTestProject();
      const result = resolveScene(project, 'scene-1');
      expect(result.status).toBe('resolved');
      expect(result.scene?.id).toBe('scene-1');
      expect(result.scene?.name).toBe('Main Scene');
    });

    it('returns not-found when scene ID does not exist', () => {
      const { project } = createTestProject();
      const result = resolveScene(project, 'nonexistent-scene');
      expect(result.status).toBe('not-found');
      expect(result.reason).toBe('Scene "nonexistent-scene" not found');
    });

    it('returns not-found when project is null', () => {
      const result = resolveScene(null, 'scene-1');
      expect(result.status).toBe('not-found');
      expect(result.reason).toBe('No scenes in project');
    });

    it('returns not-found when project is undefined', () => {
      const result = resolveScene(undefined, 'scene-1');
      expect(result.status).toBe('not-found');
    });

    it('returns not-found when scenes array is empty', () => {
      const project = asProject({
        version: 6,
        name: 'Empty Project',
        assets: [],
        scenes: []
      });
      const result = resolveScene(project, 'scene-1');
      expect(result.status).toBe('not-found');
    });
  });

  describe('resolveActiveScene', () => {
    it('resolves active scene by project.activeSceneId', () => {
      const { project } = createTestProject();
      const result = resolveActiveScene(project);
      expect(result.status).toBe('resolved');
      expect(result.scene?.id).toBe('scene-1');
    });

    it('returns not-found when activeSceneId is missing', () => {
      const project = asProject({
        version: 6,
        name: 'No Active Scene',
        assets: [],
        scenes: [{ id: 'scene-1', name: 'Scene 1', layers: [] }]
      });
      const result = resolveActiveScene(project);
      expect(result.status).toBe('not-found');
      expect(result.reason).toBe('No active scene ID');
    });

    it('returns not-found when project is null', () => {
      const result = resolveActiveScene(null);
      expect(result.status).toBe('not-found');
    });
  });

  describe('resolveLayer', () => {
    it('resolves layer by ID within a scene', () => {
      const { project } = createTestProject();
      const scene = project.scenes[0];
      const result = resolveLayer(scene, 'layer-with-asset');
      expect(result.status).toBe('resolved');
      expect(result.layer?.id).toBe('layer-with-asset');
    });

    it('returns not-found when layer ID does not exist', () => {
      const { project } = createTestProject();
      const scene = project.scenes[0];
      const result = resolveLayer(scene, 'nonexistent-layer');
      expect(result.status).toBe('not-found');
      expect(result.reason).toBe('Layer "nonexistent-layer" not found in scene');
    });

    it('returns not-found when scene is null', () => {
      const result = resolveLayer(null, 'layer-with-asset');
      expect(result.status).toBe('not-found');
      expect(result.reason).toBe('No layers in scene');
    });

    it('returns not-found when scene has no layers array', () => {
      const scene = { id: 'scene-1', name: 'Scene', layers: [] as any };
      // Remove layers to test
      delete (scene as any).layers;
      const result = resolveLayer(scene, 'layer-with-asset');
      expect(result.status).toBe('not-found');
    });
  });

  describe('resolveSceneLayer', () => {
    it('combines resolveScene + resolveLayer successfully', () => {
      const { project } = createTestProject();
      const result = resolveSceneLayer(project, 'scene-1', 'layer-with-asset');
      expect(result.status).toBe('resolved');
      expect(result.layer?.id).toBe('layer-with-asset');
    });

    it('returns not-found when scene not found', () => {
      const { project } = createTestProject();
      const result = resolveSceneLayer(project, 'nonexistent', 'layer-with-asset');
      expect(result.status).toBe('not-found');
      expect(result.reason).toContain('Scene not found');
    });

    it('returns not-found when layer not found in scene', () => {
      const { project } = createTestProject();
      const result = resolveSceneLayer(project, 'scene-1', 'nonexistent-layer');
      expect(result.status).toBe('not-found');
      expect(result.reason).toContain('not found in scene');
    });
  });

  describe('resolveActiveSceneLayer', () => {
    it('resolves layer in active scene', () => {
      const { project } = createTestProject();
      const result = resolveActiveSceneLayer(project, 'layer-with-asset');
      expect(result.status).toBe('resolved');
      expect(result.layer?.id).toBe('layer-with-asset');
    });

    it('returns not-found when no active scene', () => {
      const project = asProject({
        version: 6,
        name: 'No Active',
        assets: [],
        scenes: []
      });
      const result = resolveActiveSceneLayer(project, 'layer-with-asset');
      expect(result.status).toBe('not-found');
      expect(result.reason).toBe('No active scene');
    });
  });

  describe('resolveLayerAsset', () => {
    it('resolves asset when layer has valid assetId', () => {
      const { project } = createTestProject();
      const layer = project.scenes[0].layers[0]; // layer-with-asset
      const result = resolveLayerAsset(layer, project.assets);
      expect(result.status).toBe('resolved');
      expect(result.asset?.id).toBe('asset-1');
      expect(result.assetId).toBe('asset-1');
      expect(result.layer?.id).toBe('layer-with-asset');
    });

    it('returns no-binding when layer has no assetId or generatorId', () => {
      const { project } = createTestProject();
      const layer = project.scenes[0].layers[2]; // layer-no-binding
      const result = resolveLayerAsset(layer, project.assets);
      expect(result.status).toBe('no-binding');
      expect(result.reason).toBe('Layer has no assetId or generatorId binding');
    });

    it('returns generator-bound when layer uses generatorId', () => {
      const { project } = createTestProject();
      const layer = project.scenes[0].layers[3]; // layer-with-generator
      const result = resolveLayerAsset(layer, project.assets);
      expect(result.status).toBe('generator-bound');
      expect(result.generatorId).toBe('gen-plasma');
      expect(result.reason).toBe('Layer uses generatorId instead of assetId');
    });

    it('returns missing-asset when assetId references non-existent asset', () => {
      const { project } = createTestProject();
      const layer = project.scenes[0].layers[4]; // layer-missing-asset
      const result = resolveLayerAsset(layer, project.assets);
      expect(result.status).toBe('missing-asset');
      expect(result.assetId).toBe('asset-does-not-exist');
      expect(result.reason).toBe('Asset "asset-does-not-exist" not found in project');
    });

    it('returns not-found when layer is null', () => {
      const result = resolveLayerAsset(null, []);
      expect(result.status).toBe('not-found');
      expect(result.reason).toBe('Layer not found');
    });
  });

  describe('resolveProjectLayerAsset', () => {
    it('resolves asset from project via scene and layer IDs', () => {
      const { project } = createTestProject();
      const result = resolveProjectLayerAsset(project, 'scene-1', 'layer-with-asset');
      expect(result.status).toBe('resolved');
      expect(result.asset?.id).toBe('asset-1');
    });

    it('returns not-found when scene not found', () => {
      const { project } = createTestProject();
      const result = resolveProjectLayerAsset(project, 'nonexistent', 'layer-with-asset');
      expect(result.status).toBe('not-found');
    });

    it('returns not-found when layer not found', () => {
      const { project } = createTestProject();
      const result = resolveProjectLayerAsset(project, 'scene-1', 'nonexistent-layer');
      expect(result.status).toBe('not-found');
    });
  });

  describe('resolveActiveSceneLayerAsset', () => {
    it('resolves asset from active scene', () => {
      const { project } = createTestProject();
      const result = resolveActiveSceneLayerAsset(project, 'layer-with-asset');
      expect(result.status).toBe('resolved');
      expect(result.asset?.id).toBe('asset-1');
    });
  });

  describe('resolveProjectAsset', () => {
    it('resolves asset by ID from project', () => {
      const { project } = createTestProject();
      const result = resolveProjectAsset(project, 'asset-1');
      expect(result.status).toBe('resolved');
      expect(result.asset?.id).toBe('asset-1');
    });

    it('returns not-found when asset not found', () => {
      const { project } = createTestProject();
      const result = resolveProjectAsset(project, 'nonexistent-asset');
      expect(result.status).toBe('not-found');
    });
  });

  describe('resolveSceneAssetBindings', () => {
    it('returns all asset bindings for a scene', () => {
      const { project } = createTestProject();
      const result = resolveSceneAssetBindings(project, 'scene-1');
      expect(Object.keys(result).length).toBe(5);

      // Check layer-with-asset binding
      expect(result['layer-with-asset'].status).toBe('resolved');
      expect(result['layer-with-asset'].asset?.id).toBe('asset-1');

      // Check layer-no-binding
      expect(result['layer-no-binding'].status).toBe('no-binding');

      // Check layer-with-generator
      expect(result['layer-with-generator'].status).toBe('generator-bound');
    });

    it('returns empty object when scene not found', () => {
      const { project } = createTestProject();
      const result = resolveSceneAssetBindings(project, 'nonexistent');
      expect(result).toEqual({});
    });
  });

  describe('ensureResolution', () => {
    it('returns result if status is resolved', () => {
      const { project } = createTestProject();
      const sceneRes = resolveScene(project, 'scene-1');
      const result = ensureResolution(sceneRes);
      expect(result).toBe(sceneRes);
    });

    it('throws error if status is not-found', () => {
      const { project } = createTestProject();
      const sceneRes = resolveScene(project, 'nonexistent');
      expect(() => ensureResolution(sceneRes)).toThrow('Resolution failed: not-found');
    });

    it('throws error with custom message if provided', () => {
      const { project } = createTestProject();
      const sceneRes = resolveScene(project, 'nonexistent');
      expect(() => ensureResolution(sceneRes, 'Custom error message')).toThrow('Custom error message');
    });
  });

  describe('withFallback', () => {
    it('returns original result if resolved', () => {
      const { project } = createTestProject();
      const sceneRes = resolveScene(project, 'scene-1');
      const fallback: SceneResolution = { status: 'not-found' };
      const result = withFallback(sceneRes, fallback);
      expect(result).toBe(sceneRes);
    });

    it('returns fallback if not resolved', () => {
      const { project } = createTestProject();
      const sceneRes = resolveScene(project, 'nonexistent');
      const fallback: SceneResolution = {
        status: 'resolved',
        scene: { id: 'fallback', name: 'Fallback', layers: [] }
      };
      const result = withFallback(sceneRes, fallback);
      expect(result).toBe(fallback);
    });
  });

  describe('integration with deterministic PRNG', () => {
    it('uses seeded PRNG for asset creation consistency', () => {
      const rng1 = createPrng(DEFAULT_DETERMINISTIC_SEED);
      const rng2 = createPrng(DEFAULT_DETERMINISTIC_SEED);

      // Simulate asset ID generation pattern from assets.ts
      const generateId = () => `asset-${rng1() * 1000000 | 0}-${Math.floor(rng1() * 1000)}`;
      const id1 = generateId();
      const id2 = generateId();

      // With same seed, IDs should be identical
      expect(id1).toBe(`asset-${rng2() * 1000000 | 0}-${Math.floor(rng2() * 1000)}`);

      // Re-run with fresh seed to verify reproducibility
      const freshRng = createPrng(DEFAULT_DETERMINISTIC_SEED);
      const freshId = `asset-${freshRng() * 1000000 | 0}-${Math.floor(freshRng() * 1000)}`;
      expect(id1).toBe(freshId);
    });
  });
});
