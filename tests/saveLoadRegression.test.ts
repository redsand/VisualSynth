/**
 * Save/Load Regression Tests for Asset/Layer Bindings
 *
 * Tests ensure that:
 * 1. Asset assignments persist through save/load cycles
 * 2. Layer IDs remain stable across save/load
 * 3. Scene layer order is preserved
 * 4. Missing asset references remain diagnosable, not silently removed
 * 5. Old project versions are properly migrated
 */

import { describe, expect, it } from 'vitest';
import {
  serializeProject,
  deserializeProject,
  upgradeProject,
  ensureSceneDefaults
} from '../src/shared/serialization';
import type { VisualSynthProject, SceneConfig, LayerConfig, AssetItem } from '../src/shared/project';
import { projectSchema } from '../src/shared/projectSchema';

// ============================================================================
// Test Fixtures
// ============================================================================

// Canonical default layer transform (matches DEFAULT_PROJECT / shared/layers.ts fallback).
const defaultTransform = { x: 0, y: 0, scale: 1, rotation: 0 };

/**
 * Complete an intentionally-minimal project fixture. Runtime values are
 * unchanged; only the compile-time shape is filled in.
 */
const asProject = (fixture: Partial<VisualSynthProject>): VisualSynthProject => fixture as VisualSynthProject;

/**
 * Create a project with multiple assets and layers with various binding states.
 * Intentionally minimal — the zod schema fills defaults on deserialize.
 */
const createTestProjectWithAssets = (): VisualSynthProject => {
  const assets: AssetItem[] = [
    { id: 'asset-texture-a', name: 'Texture A', kind: 'texture', tags: [], addedAt: '2024-01-01' },
    { id: 'asset-texture-b', name: 'Texture B', kind: 'texture', tags: [], addedAt: '2024-01-01' },
    { id: 'asset-video-clip', name: 'Video Clip', kind: 'video', tags: [], addedAt: '2024-01-01' },
    { id: 'asset-texture-c', name: 'Texture C', kind: 'texture', tags: [], addedAt: '2024-01-01' }
  ];

  const layers: LayerConfig[] = [
    // Layer with asset binding - should persist
    { id: 'layer-plasma', name: 'Plasma', role: 'core', enabled: true, opacity: 0.75, blendMode: 'screen', transform: { ...defaultTransform }, assetId: 'asset-texture-a' },
    // Layer with different asset binding - should persist
    { id: 'layer-spectrum', name: 'Spectrum', role: 'support', enabled: true, opacity: 0.75, blendMode: 'add', transform: { ...defaultTransform }, assetId: 'asset-texture-b' },
    // Layer with video asset - should persist
    { id: 'layer-media', name: 'Media', role: 'support', enabled: true, opacity: 1, blendMode: 'screen', transform: { ...defaultTransform }, assetId: 'asset-video-clip' },
    // Layer with no asset binding - should persist with no-binding state
    { id: 'layer-no-asset', name: 'Atmosphere Layer', role: 'atmosphere', enabled: true, opacity: 0.8, blendMode: 'screen', transform: { ...defaultTransform } },
    // Disabled layer with asset - asset binding should persist even if not rendered
    { id: 'layer-disabled', name: 'Disabled Layer', role: 'support', enabled: false, opacity: 0.5, blendMode: 'normal', transform: { ...defaultTransform }, assetId: 'asset-texture-a' },
    // Layer with generator instead of asset - should persist
    { id: 'layer-generator', name: 'Generator Layer', role: 'support', enabled: true, opacity: 1, blendMode: 'normal', transform: { ...defaultTransform }, generatorId: 'gen-plasma' }
  ];

  const scenes: SceneConfig[] = [
    {
      id: 'scene-main',
      name: 'Main Scene',
      layers: [...layers]
    },
    {
      id: 'scene-secondary',
      name: 'Secondary Scene',
      layers: [
        { id: 'layer-plasma', name: 'Plasma', role: 'core', enabled: true, opacity: 0.75, blendMode: 'screen', transform: { ...defaultTransform }, assetId: 'asset-texture-c' },
        { id: 'layer-alt', name: 'Alt Layer', role: 'support', enabled: true, opacity: 1, blendMode: 'screen', transform: { ...defaultTransform }, generatorId: 'gen-vortex' }
      ]
    }
  ];

  return asProject({
    version: 6,
    name: 'Asset Binding Test Project',
    category: 'test',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    assets,
    scenes,
    activeSceneId: 'scene-main'
  });
};

// ============================================================================
// Round-trip Serialization Tests
// ============================================================================

describe('saveLoadRegression', () => {
  describe('serializeProject and deserializeProject', () => {
    it('preserves asset-layer bindings through full cycle', () => {
      const originalProject = createTestProjectWithAssets();

      // Serialize
      const serialized = serializeProject(originalProject);
      expect(serialized).toContain('asset-texture-a');
      expect(serialized).toContain('asset-texture-b');
      expect(serialized).toContain('asset-video-clip');

      // Deserialize
      const deserializedProject = deserializeProject(serialized);

      // Verify assets are preserved
      expect(deserializedProject.assets.length).toBe(4);
      expect(deserializedProject.assets.find(a => a.id === 'asset-texture-a')).toBeDefined();
      expect(deserializedProject.assets.find(a => a.id === 'asset-texture-b')).toBeDefined();

      // Verify scene layer bindings are preserved
      const mainScene = deserializedProject.scenes.find(s => s.id === 'scene-main');
      expect(mainScene).toBeDefined();

      if (mainScene) {
        // Check plasma layer binding
        const plasmaLayer = mainScene.layers.find(l => l.id === 'layer-plasma');
        expect(plasmaLayer?.assetId).toBe('asset-texture-a');

        // Check spectrum layer binding
        const spectrumLayer = mainScene.layers.find(l => l.id === 'layer-spectrum');
        expect(spectrumLayer?.assetId).toBe('asset-texture-b');

        // Check media layer binding
        const mediaLayer = mainScene.layers.find(l => l.id === 'layer-media');
        expect(mediaLayer?.assetId).toBe('asset-video-clip');

        // Check layer with no asset binding
        const noAssetLayer = mainScene.layers.find(l => l.id === 'layer-no-asset');
        expect(noAssetLayer?.assetId).toBeUndefined();
        expect(noAssetLayer?.generatorId).toBeUndefined();

        // Check disabled layer's asset binding
        const disabledLayer = mainScene.layers.find(l => l.id === 'layer-disabled');
        expect(disabledLayer?.assetId).toBe('asset-texture-a');

        // Check generator-bound layer
        const genLayer = mainScene.layers.find(l => l.id === 'layer-generator');
        expect(genLayer?.generatorId).toBe('gen-plasma');
      }
    });

    it('preserves activeSceneId through cycle', () => {
      const originalProject = createTestProjectWithAssets();

      const serialized = serializeProject(originalProject);
      const deserializedProject = deserializeProject(serialized);

      expect(deserializedProject.activeSceneId).toBe('scene-main');
    });

    it('preserves scene order through cycle', () => {
      const originalProject = createTestProjectWithAssets();

      const serialized = serializeProject(originalProject);
      const deserializedProject = deserializeProject(serialized);

      expect(deserializedProject.scenes.length).toBe(2);
      expect(deserializedProject.scenes[0].id).toBe('scene-main');
      expect(deserializedProject.scenes[1].id).toBe('scene-secondary');
    });

    it('preserves layer order within scenes', () => {
      const originalProject = createTestProjectWithAssets();
      const originalLayerIds = originalProject.scenes[0].layers.map(l => l.id);

      const serialized = serializeProject(originalProject);
      const deserializedProject = deserializeProject(serialized);

      const deserializedLayerIds = deserializedProject.scenes[0].layers.map(l => l.id);
      expect(deserializedLayerIds).toEqual(originalLayerIds);
    });

    it('preserves layer IDs through cycle', () => {
      const originalProject = createTestProjectWithAssets();
      const originalLayerIds = new Set(
        originalProject.scenes.flatMap(s => s.layers.map(l => l.id))
      );

      const serialized = serializeProject(originalProject);
      const deserializedProject = deserializeProject(serialized);

      const deserializedLayerIds = new Set(
        deserializedProject.scenes.flatMap(s => s.layers.map(l => l.id))
      );

      expect(deserializedLayerIds).toEqual(originalLayerIds);
    });

    it('handles layer reorder preservation', () => {
      // Create project, serialize, deserialize, reorder, serialize again
      const originalProject = createTestProjectWithAssets();

      // First cycle
      const serialized1 = serializeProject(originalProject);
      const deserialized1 = deserializeProject(serialized1);

      // Reorder layers in the deserialized project
      const scene = deserialized1.scenes[0];
      const originalLayerIds = scene.layers.map(l => l.id);
      const reorderedLayerIds = [...originalLayerIds].reverse();
      scene.layers = scene.layers.sort((a, b) => {
        const aIdx = reorderedLayerIds.indexOf(a.id);
        const bIdx = reorderedLayerIds.indexOf(b.id);
        return aIdx - bIdx;
      });

      // Verify layer IDs are preserved after reordering
      expect(scene.layers.map(l => l.id)).toEqual(reorderedLayerIds);

      // Second cycle - serialize the reordered project
      const serialized2 = serializeProject(deserialized1);
      const deserialized2 = deserializeProject(serialized2);

      // Verify reordering is preserved
      expect(deserialized2.scenes[0].layers.map(l => l.id)).toEqual(reorderedLayerIds);
    });
  });

  describe('missing asset handling', () => {
    it('preserves missing asset references as missing-asset status', () => {
      const projectWithMissingAssets = asProject({
        version: 6,
        name: 'Project with Missing Assets',
        createdAt: '2024-01-01T00:00:00.000Z',
        assets: [
          { id: 'asset-a', name: 'Asset A', kind: 'texture', tags: [], addedAt: '2024-01-01' }
        ],
        scenes: [
          {
            id: 'scene-main',
            name: 'Main',
            layers: [
              { id: 'layer-valid', name: 'Valid Layer', role: 'core', enabled: true, opacity: 1, blendMode: 'screen', transform: { ...defaultTransform }, assetId: 'asset-a' },
              { id: 'layer-missing', name: 'Missing Layer', role: 'support', enabled: true, opacity: 1, blendMode: 'screen', transform: { ...defaultTransform }, assetId: 'asset-does-not-exist' }
            ]
          }
        ],
        activeSceneId: 'scene-main'
      });

      const serialized = serializeProject(projectWithMissingAssets);
      const deserialized = deserializeProject(serialized);

      // The layer should still reference the missing asset ID
      const missingLayer = deserialized.scenes[0].layers.find(l => l.id === 'layer-missing');
      expect(missingLayer?.assetId).toBe('asset-does-not-exist');
    });

    it('does not silently remove missing asset references', () => {
      const projectWithMissingAssets = asProject({
        version: 6,
        name: 'Project with Missing Assets',
        createdAt: '2024-01-01T00:00:00.000Z',
        assets: [],
        scenes: [
          {
            id: 'scene-main',
            name: 'Main',
            layers: [
              { id: 'layer-orphan', name: 'Orphan Layer', role: 'support', enabled: true, opacity: 1, blendMode: 'screen', transform: { ...defaultTransform }, assetId: 'asset-never-existed' }
            ]
          }
        ],
        activeSceneId: 'scene-main'
      });

      const serialized = serializeProject(projectWithMissingAssets);
      const deserialized = deserializeProject(serialized);

      // Orphan reference should still be there - not silently removed
      const orphanLayer = deserialized.scenes[0].layers.find(l => l.id === 'layer-orphan');
      expect(orphanLayer?.assetId).toBe('asset-never-existed');
    });
  });

  describe('cross-scene asset references', () => {
    it('preserves asset references across multiple scenes', () => {
      const project = asProject({
        version: 6,
        name: 'Multi-Scene Project',
        createdAt: '2024-01-01T00:00:00.000Z',
        assets: [
          { id: 'shared-asset', name: 'Shared Asset', kind: 'texture', tags: [], addedAt: '2024-01-01' }
        ],
        scenes: [
          {
            id: 'scene-1',
            name: 'Scene 1',
            layers: [
              { id: 'layer-1', name: 'Layer 1', role: 'core', enabled: true, opacity: 1, blendMode: 'screen', transform: { ...defaultTransform }, assetId: 'shared-asset' }
            ]
          },
          {
            id: 'scene-2',
            name: 'Scene 2',
            layers: [
              { id: 'layer-2', name: 'Layer 2', role: 'support', enabled: true, opacity: 1, blendMode: 'add', transform: { ...defaultTransform }, assetId: 'shared-asset' }
            ]
          }
        ],
        activeSceneId: 'scene-1'
      });

      const serialized = serializeProject(project);
      const deserialized = deserializeProject(serialized);

      const scene1 = deserialized.scenes.find(s => s.id === 'scene-1');
      const scene2 = deserialized.scenes.find(s => s.id === 'scene-2');

      expect(scene1?.layers[0].assetId).toBe('shared-asset');
      expect(scene2?.layers[0].assetId).toBe('shared-asset');
    });
  });

  describe('project version migration', () => {
    it('migrates version 1 projects to current version', () => {
      // Create a version 1 project (very old format) with required fields
      const v1Project: any = {
        version: 1,
        name: 'Legacy Project',
        createdAt: '2024-01-01T00:00:00.000Z',
        scenes: [
          {
            id: 'scene-1',
            name: 'Scene 1',
            layers: [
              { id: 'layer-1', name: 'Layer 1', enabled: true, opacity: 1, blendMode: 'screen', assetId: 'asset-a' }
            ]
          }
        ],
        activeSceneId: 'scene-1'
      };

      const serialized = serializeProject(v1Project as VisualSynthProject);
      const deserialized = deserializeProject(serialized);

      // Should be upgraded to current version
      expect(deserialized.version).toBe(6);
      expect(deserialized.scenes[0].layers[0].assetId).toBe('asset-a');
    });

    it('migrates version 3 projects with proper scene defaults', () => {
      // Version 3 project might not have all scene defaults
      const v3Project: any = {
        version: 3,
        name: 'Version 3 Project',
        createdAt: '2024-01-01T00:00:00.000Z',
        scenes: [
          {
            id: 'scene-1',
            name: 'Scene 1',
            layers: [
              { id: 'layer-1', name: 'Layer 1', enabled: true, opacity: 1, blendMode: 'screen', assetId: 'asset-a' }
            ]
          }
        ],
        activeSceneId: 'scene-1'
      };

      const serialized = serializeProject(v3Project as VisualSynthProject);
      const deserialized = deserializeProject(serialized);

      // Scene defaults should be applied
      expect(deserialized.version).toBe(6);
      const scene = deserialized.scenes[0];
      expect(scene.intent).toBe('ambient'); // Default intent
      expect(scene.transition_in).toBeDefined();
      expect(scene.transition_out).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('handles project with minimal layers', () => {
      const minimalProject = asProject({
        version: 6,
        name: 'Minimal',
        createdAt: '2024-01-01T00:00:00.000Z',
        assets: [
          { id: 'asset-1', name: 'Asset', kind: 'texture', tags: [], addedAt: '2024-01-01' }
        ],
        scenes: [
          {
            id: 'scene-1',
            name: 'Scene',
            layers: [
              { id: 'layer-1', name: 'Layer 1', role: 'core', enabled: true, opacity: 1, blendMode: 'screen', transform: { ...defaultTransform } }
            ]
          }
        ],
        activeSceneId: 'scene-1'
      });

      const serialized = serializeProject(minimalProject);
      const deserialized = deserializeProject(serialized);

      expect(deserialized.scenes.length).toBe(1);
      expect(deserialized.scenes[0].layers.length).toBe(1);
    });

    it('handles project with no asset bindings', () => {
      const project = asProject({
        version: 6,
        name: 'No Bindings',
        createdAt: '2024-01-01T00:00:00.000Z',
        assets: [
          { id: 'asset-1', name: 'Asset 1', kind: 'texture', tags: [], addedAt: '2024-01-01' }
        ],
        scenes: [
          {
            id: 'scene-1',
            name: 'Scene 1',
            layers: [
              { id: 'layer-1', name: 'Layer 1', role: 'core', enabled: true, opacity: 1, blendMode: 'screen', transform: { ...defaultTransform } }
            ]
          }
        ],
        activeSceneId: 'scene-1'
      });

      const serialized = serializeProject(project);
      const deserialized = deserializeProject(serialized);

      const layer = deserialized.scenes[0].layers[0];
      expect(layer.assetId).toBeUndefined();
    });

    it('handles duplicate layer IDs across scenes correctly', () => {
      const project = asProject({
        version: 6,
        name: 'Duplicate IDs',
        createdAt: '2024-01-01T00:00:00.000Z',
        assets: [
          { id: 'asset-a', name: 'Asset A', kind: 'texture', tags: [], addedAt: '2024-01-01' },
          { id: 'asset-b', name: 'Asset B', kind: 'texture', tags: [], addedAt: '2024-01-01' }
        ],
        scenes: [
          {
            id: 'scene-1',
            name: 'Scene 1',
            layers: [
              { id: 'layer-shared', name: 'Layer 1', role: 'core', enabled: true, opacity: 1, blendMode: 'screen', transform: { ...defaultTransform }, assetId: 'asset-a' }
            ]
          },
          {
            id: 'scene-2',
            name: 'Scene 2',
            layers: [
              { id: 'layer-shared', name: 'Layer 2', role: 'support', enabled: true, opacity: 1, blendMode: 'add', transform: { ...defaultTransform }, assetId: 'asset-b' }
            ]
          }
        ],
        activeSceneId: 'scene-1'
      });

      const serialized = serializeProject(project);
      const deserialized = deserializeProject(serialized);

      // Each scene should have correct binding for the shared layer ID
      const scene1 = deserialized.scenes.find(s => s.id === 'scene-1');
      const scene2 = deserialized.scenes.find(s => s.id === 'scene-2');

      expect(scene1?.layers[0].assetId).toBe('asset-a');
      expect(scene2?.layers[0].assetId).toBe('asset-b');
    });
  });
});

describe('schema validation', () => {
  it('rejects invalid project schema', () => {
    const invalidProject = {
      version: 6,
      name: 'Invalid Project',
      scenes: 'not-an-array' // Invalid - should be array
    };

    expect(() => serializeProject(invalidProject as any)).toThrow('Invalid project data');
  });

  it('accepts valid project with all asset binding types', () => {
    const validProject = asProject({
      version: 6,
      name: 'Valid Project',
      createdAt: '2024-01-01T00:00:00.000Z',
      assets: [
        { id: 'asset-1', name: 'Asset', kind: 'texture', tags: [], addedAt: '2024-01-01' }
      ],
      scenes: [
        {
          id: 'scene-1',
          name: 'Scene',
          layers: [
            { id: 'layer-bound', name: 'Bound', role: 'core', enabled: true, opacity: 1, blendMode: 'screen', transform: { ...defaultTransform }, assetId: 'asset-1' },
            { id: 'layer-gen', name: 'Gen', role: 'support', enabled: true, opacity: 1, blendMode: 'screen', transform: { ...defaultTransform }, generatorId: 'gen-test' },
            { id: 'layer-none', name: 'None', role: 'atmosphere', enabled: true, opacity: 1, blendMode: 'screen', transform: { ...defaultTransform } }
          ]
        }
      ],
      activeSceneId: 'scene-1'
    });

    expect(() => serializeProject(validProject)).not.toThrow();
  });
});
