/**
 * Tests for Asset Binding Diagnostics Integration
 *
 * Tests ensure that:
 * 1. Asset binding diagnostics are correctly computed
 * 2. Layer status is accurately reported (resolved, missing, no-binding, generator-bound)
 * 3. Render skip reasons are provided for non-renderable layers
 * 4. Output path serialization works correctly
 */

import { describe, expect, it } from 'vitest';
import {
  getSceneAssetDiagnostics,
  getStatusDescription,
  getStatusClass,
  getRenderSkippedReason,
  canLayerRender,
  serializeAssetForOutput,
  resolveOutputAsset,
  getAssetLayerIdMap,
  getRenderableLayers,
  getLayerVisibilityDiagnostic,
  getSceneLayerVisibilityDiagnostics,
  UNSUPPORTED_ASSET_KINDS,
  getSeverityDescription,
  getSeverityClass
} from '../src/renderer/render/assetBinding';
import type { VisualSynthProject, SceneConfig, LayerConfig, AssetItem } from '../src/shared/project';

// Helper to create a test project
const createTestProject = (): VisualSynthProject => {
  const assets = [
    { id: 'asset-a', name: 'Texture A', kind: 'texture', tags: [], addedAt: '2024-01-01' },
    { id: 'asset-b', name: 'Texture B', kind: 'texture', tags: [], addedAt: '2024-01-01' },
    { id: 'asset-video', name: 'Video Clip', kind: 'video', tags: [], addedAt: '2024-01-01' }
  ];

  const layers: LayerConfig[] = [
    { id: 'layer-plasma', name: 'Plasma', role: 'core', enabled: true, opacity: 0.75, blendMode: 'screen', assetId: 'asset-a' },
    { id: 'layer-spectrum', name: 'Spectrum', role: 'support', enabled: true, opacity: 0.75, blendMode: 'add', assetId: 'asset-b' },
    { id: 'layer-media', name: 'Media', role: 'support', enabled: true, opacity: 1, blendMode: 'screen', assetId: 'asset-video' },
    { id: 'layer-no-asset', name: 'No Asset', role: 'atmosphere', enabled: true, opacity: 0.8, blendMode: 'screen' },
    { id: 'layer-disabled', name: 'Disabled Layer', role: 'support', enabled: false, opacity: 0.5, blendMode: 'normal', assetId: 'asset-a' },
    { id: 'layer-missing', name: 'Missing Asset Layer', role: 'support', enabled: true, opacity: 1, blendMode: 'normal', assetId: 'asset-does-not-exist' },
    { id: 'layer-generator', name: 'Generator Layer', role: 'support', enabled: true, opacity: 1, blendMode: 'normal', generatorId: 'gen-plasma' }
  ];

  const scenes: SceneConfig[] = [
    {
      id: 'scene-main',
      name: 'Main Scene',
      layers: [...layers],
      activeSceneId: 'scene-main'
    }
  ];

  return {
    version: 6,
    name: 'Test Project',
    assets,
    scenes,
    activeSceneId: 'scene-main'
  };
};

describe('assetBindingDiagnostics', () => {
  describe('status description', () => {
    it('returns correct description for resolved status', () => {
      expect(getStatusDescription('resolved')).toBe('Bound');
    });

    it('returns correct description for no-binding status', () => {
      expect(getStatusDescription('no-binding')).toBe('No asset assigned');
    });

    it('returns correct description for missing-asset status', () => {
      expect(getStatusDescription('missing-asset')).toBe('Asset not found');
    });

    it('returns correct description for generator-bound status', () => {
      expect(getStatusDescription('generator-bound')).toBe('Using generator');
    });

    it('returns correct description for not-found status', () => {
      expect(getStatusDescription('not-found')).toBe('Layer not found');
    });
  });

  describe('status class', () => {
    it('returns correct CSS class for resolved', () => {
      expect(getStatusClass('resolved')).toBe('status-bound');
    });

    it('returns correct CSS class for no-binding', () => {
      expect(getStatusClass('no-binding')).toBe('status-none');
    });

    it('returns correct CSS class for missing-asset', () => {
      expect(getStatusClass('missing-asset')).toBe('status-missing');
    });

    it('returns correct CSS class for generator-bound', () => {
      expect(getStatusClass('generator-bound')).toBe('status-generator');
    });

    it('returns correct CSS class for not-found', () => {
      expect(getStatusClass('not-found')).toBe('status-error');
    });
  });

  describe('canLayerRender', () => {
    it('returns true only for resolved status', () => {
      expect(canLayerRender('resolved')).toBe(true);
      expect(canLayerRender('no-binding')).toBe(false);
      expect(canLayerRender('missing-asset')).toBe(false);
      expect(canLayerRender('generator-bound')).toBe(false);
      expect(canLayerRender('not-found')).toBe(false);
    });
  });

  describe('getRenderSkippedReason', () => {
    it('returns skip reason for no-binding', () => {
      expect(getRenderSkippedReason('no-binding', {} as any)).toBe('Layer has no asset binding');
    });

    it('returns skip reason for missing-asset', () => {
      expect(getRenderSkippedReason('missing-asset', { assetId: 'missing-id' } as any)).toBe('Asset "missing-id" not found in project');
    });

    it('returns skip reason for generator-bound', () => {
      expect(getRenderSkippedReason('generator-bound', {} as any)).toBe('Layer uses generator instead of asset');
    });

    it('returns skip reason for not-found', () => {
      expect(getRenderSkippedReason('not-found', {} as any)).toBe('Layer not found in scene');
    });

    it('returns undefined for resolved status', () => {
      expect(getRenderSkippedReason('resolved', {} as any)).toBeUndefined();
    });
  });

  describe('getSceneAssetDiagnostics', () => {
    it('returns diagnostics for all layers in scene', () => {
      const project = createTestProject();
      const scene = project.scenes[0];

      const diagnostics = getSceneAssetDiagnostics(project, scene);

      expect(diagnostics.sceneId).toBe('scene-main');
      expect(diagnostics.sceneName).toBe('Main Scene');
      expect(diagnostics.layerCount).toBe(7);
      expect(Object.keys(diagnostics.bindings).length).toBe(7);
    });

    it('correctly identifies resolved bindings', () => {
      const project = createTestProject();
      const scene = project.scenes[0];

      const diagnostics = getSceneAssetDiagnostics(project, scene);

      expect(diagnostics.bindings['layer-plasma'].status).toBe('resolved');
      expect(diagnostics.bindings['layer-plasma'].assetId).toBe('asset-a');
      expect(diagnostics.bindings['layer-plasma'].assetName).toBe('Texture A');

      expect(diagnostics.bindings['layer-spectrum'].status).toBe('resolved');
      expect(diagnostics.bindings['layer-spectrum'].assetId).toBe('asset-b');
    });

    it('correctly identifies no-binding layers', () => {
      const project = createTestProject();
      const scene = project.scenes[0];

      const diagnostics = getSceneAssetDiagnostics(project, scene);

      expect(diagnostics.bindings['layer-no-asset'].status).toBe('no-binding');
      expect(diagnostics.bindings['layer-no-asset'].renderSkipped).toBe(true);
      expect(diagnostics.bindings['layer-no-asset'].skippedReason).toBe('Layer has no asset binding');
    });

    it('correctly identifies missing-asset layers', () => {
      const project = createTestProject();
      const scene = project.scenes[0];

      const diagnostics = getSceneAssetDiagnostics(project, scene);

      expect(diagnostics.bindings['layer-missing'].status).toBe('missing-asset');
      expect(diagnostics.bindings['layer-missing'].assetId).toBe('asset-does-not-exist');
      expect(diagnostics.bindings['layer-missing'].renderSkipped).toBe(true);
    });

    it('correctly identifies generator-bound layers', () => {
      const project = createTestProject();
      const scene = project.scenes[0];

      const diagnostics = getSceneAssetDiagnostics(project, scene);

      expect(diagnostics.bindings['layer-generator'].status).toBe('generator-bound');
      // Generator-bound layers don't have assetId
      expect(diagnostics.bindings['layer-generator'].assetId).toBeUndefined();
      expect(diagnostics.bindings['layer-generator'].renderSkipped).toBe(true);
      expect(diagnostics.bindings['layer-generator'].skippedReason).toBe('Layer uses generator instead of asset');
    });

    it('provides summary counts', () => {
      const project = createTestProject();
      const scene = project.scenes[0];

      const diagnostics = getSceneAssetDiagnostics(project, scene);

      // 4 resolved: layer-plasma, layer-spectrum, layer-media, layer-disabled (all have valid assets)
      expect(diagnostics.summary.resolved).toBe(4);
      expect(diagnostics.summary.noBinding).toBe(1); // layer-no-asset
      expect(diagnostics.summary.missingAsset).toBe(1); // layer-missing
      expect(diagnostics.summary.generatorBound).toBe(1); // layer-generator
      expect(diagnostics.summary.notFound).toBe(0);
      expect(diagnostics.summary.total).toBe(7);
    });
  });

  describe('getRenderableLayers', () => {
    it('returns only layers with resolved asset bindings', () => {
      const project = createTestProject();
      const scene = project.scenes[0];

      const renderable = getRenderableLayers(project, scene);

      // 4 resolved: layer-plasma, layer-spectrum, layer-media, layer-disabled
      expect(renderable.length).toBe(4);
      expect(renderable.map(l => l.id)).toEqual([
        'layer-plasma',
        'layer-spectrum',
        'layer-media',
        'layer-disabled'
      ]);
    });
  });

  describe('getAssetLayerIdMap', () => {
    it('returns mapping of layer IDs to asset IDs for renderable layers', () => {
      const project = createTestProject();
      const scene = project.scenes[0];

      const mapping = getAssetLayerIdMap(project, scene);

      expect(mapping['layer-plasma']).toBe('asset-a');
      expect(mapping['layer-spectrum']).toBe('asset-b');
      expect(mapping['layer-media']).toBe('asset-video');
      expect(mapping['layer-disabled']).toBe('asset-a');
      expect(Object.keys(mapping).length).toBe(4);
    });
  });

  describe('serializeAssetForOutput', () => {
    it('serializes asset correctly', () => {
      const asset = {
        id: 'asset-a',
        name: 'Texture A',
        kind: 'texture' as const,
        path: '/path/to/texture.png',
        width: 1920,
        height: 1080
      };

      const result = serializeAssetForOutput(asset);

      expect(result).toEqual({
        id: 'asset-a',
        name: 'Texture A',
        kind: 'texture',
        path: '/path/to/texture.png',
        width: 1920,
        height: 1080,
        options: undefined
      });
    });

    it('handles null asset', () => {
      expect(serializeAssetForOutput(null)).toBeNull();
    });
  });

  describe('resolveOutputAsset', () => {
    it('resolves and serializes asset for output', () => {
      const project = createTestProject();
      const scene = project.scenes[0];

      const result = resolveOutputAsset(project, scene, 'layer-plasma');

      expect(result).toEqual({
        id: 'asset-a',
        name: 'Texture A',
        kind: 'texture',
        path: '', // path is serialized as empty string when undefined
        width: undefined,
        height: undefined,
        internalSource: undefined,
        options: undefined
      });
    });

    it('returns null for no-binding layer', () => {
      const project = createTestProject();
      const scene = project.scenes[0];

      const result = resolveOutputAsset(project, scene, 'layer-no-asset');

      expect(result).toBeNull();
    });

    it('returns null for missing-asset layer', () => {
      const project = createTestProject();
      const scene = project.scenes[0];

      const result = resolveOutputAsset(project, scene, 'layer-missing');

      expect(result).toBeNull();
    });
  });

  describe('integration with null/missing project/scene', () => {
    it('handles null project', () => {
      const scene = createTestProject().scenes[0];

      const diagnostics = getSceneAssetDiagnostics(null, scene);

      expect(diagnostics.sceneId).toBe('scene-main');
      expect(diagnostics.bindings).toEqual({});
      expect(diagnostics.summary.total).toBe(0);
    });

    it('handles null scene', () => {
      const project = createTestProject();

      const diagnostics = getSceneAssetDiagnostics(project, null);

      expect(diagnostics.sceneId).toBe('unknown');
      expect(diagnostics.bindings).toEqual({});
    });

    it('handles both null', () => {
      const diagnostics = getSceneAssetDiagnostics(null, null);

      expect(diagnostics.sceneId).toBe('unknown');
      expect(diagnostics.bindings).toEqual({});
    });
  });
});

// ============================================================================
// Layer Visibility Diagnostic Tests
// ============================================================================

describe('layerVisibilityDiagnostic', () => {
  // Helper to create test project
  const createVisibilityTestProject = (): VisualSynthProject => {
    const assets: AssetItem[] = [
      { id: 'asset-good', name: 'Good Texture', kind: 'texture', tags: [], addedAt: '2024-01-01' },
      { id: 'asset-missing', name: 'Missing File', kind: 'texture', tags: [], addedAt: '2024-01-01', missing: true },
      { id: 'asset-video', name: 'Video Clip', kind: 'video', tags: [], addedAt: '2024-01-01' },
      { id: 'asset-internal', name: 'Waveform', kind: 'internal', internalSource: 'audio-waveform', tags: [], addedAt: '2024-01-01' }
    ];

    const layers: LayerConfig[] = [
      { id: 'layer-visible', name: 'Visible Layer', role: 'core', enabled: true, opacity: 0.75, blendMode: 'screen', assetId: 'asset-good' },
      { id: 'layer-disabled', name: 'Disabled Layer', role: 'support', enabled: false, opacity: 0.5, blendMode: 'normal', assetId: 'asset-good' },
      { id: 'layer-zero-opacity', name: 'Zero Opacity', role: 'support', enabled: true, opacity: 0, blendMode: 'screen', assetId: 'asset-good' },
      { id: 'layer-no-asset', name: 'No Asset', role: 'atmosphere', enabled: true, opacity: 0.8, blendMode: 'screen' },
      { id: 'layer-missing-asset', name: 'Missing Asset', role: 'support', enabled: true, opacity: 1, blendMode: 'normal', assetId: 'asset-does-not-exist' },
      { id: 'layer-file-missing', name: 'File Missing', role: 'support', enabled: true, opacity: 1, blendMode: 'normal', assetId: 'asset-missing' },
      { id: 'layer-generator', name: 'Generator Layer', role: 'support', enabled: true, opacity: 1, blendMode: 'normal', generatorId: 'gen-plasma' }
    ];

    return {
      version: 6,
      name: 'Visibility Test Project',
      createdAt: '2024-01-01T00:00:00.000Z',
      assets,
      scenes: [{
        id: 'scene-test',
        name: 'Test Scene',
        layers,
        activeSceneId: 'scene-test'
      }],
      activeSceneId: 'scene-test'
    };
  };

  describe('getSeverityDescription', () => {
    it('returns descriptions for all severity levels', () => {
      expect(getSeverityDescription('ok')).toBe('Layer is visible');
      expect(getSeverityDescription('info')).toBe('Layer may be visible');
      expect(getSeverityDescription('warning')).toBe('Layer visibility affected');
      expect(getSeverityDescription('error')).toBe('Layer not visible');
    });
  });

  describe('getSeverityClass', () => {
    it('returns CSS classes for all severity levels', () => {
      expect(getSeverityClass('ok')).toBe('visibility-ok');
      expect(getSeverityClass('info')).toBe('visibility-info');
      expect(getSeverityClass('warning')).toBe('visibility-warning');
      expect(getSeverityClass('error')).toBe('visibility-error');
    });
  });

  describe('getLayerVisibilityDiagnostic', () => {
    it('returns error for null project', () => {
      const result = getLayerVisibilityDiagnostic(null, 'scene-test', 'layer-visible');
      expect(result.visible).toBe(false);
      expect(result.severity).toBe('error');
      expect(result.reasonCode).toBe('project-not-found');
    });

    it('returns error for scene not found', () => {
      const project = createVisibilityTestProject();
      const result = getLayerVisibilityDiagnostic(project, 'scene-does-not-exist', 'layer-visible');
      expect(result.visible).toBe(false);
      expect(result.severity).toBe('error');
      expect(result.reasonCode).toBe('scene-not-found');
    });

    it('returns error for layer not found', () => {
      const project = createVisibilityTestProject();
      const result = getLayerVisibilityDiagnostic(project, 'scene-test', 'layer-does-not-exist');
      expect(result.visible).toBe(false);
      expect(result.severity).toBe('error');
      expect(result.reasonCode).toBe('layer-not-found');
    });

    it('returns info for disabled layer', () => {
      const project = createVisibilityTestProject();
      const result = getLayerVisibilityDiagnostic(project, 'scene-test', 'layer-disabled');
      expect(result.visible).toBe(false);
      expect(result.severity).toBe('info');
      expect(result.reasonCode).toBe('layer-disabled');
    });

    it('returns warning for zero opacity', () => {
      const project = createVisibilityTestProject();
      const result = getLayerVisibilityDiagnostic(project, 'scene-test', 'layer-zero-opacity');
      expect(result.visible).toBe(false);
      expect(result.severity).toBe('warning');
      expect(result.reasonCode).toBe('opacity-zero');
    });

    it('returns warning for no asset binding', () => {
      const project = createVisibilityTestProject();
      const result = getLayerVisibilityDiagnostic(project, 'scene-test', 'layer-no-asset');
      expect(result.visible).toBe(false);
      expect(result.severity).toBe('warning');
      expect(result.reasonCode).toBe('no-asset-binding');
    });

    it('returns error for missing asset reference', () => {
      const project = createVisibilityTestProject();
      const result = getLayerVisibilityDiagnostic(project, 'scene-test', 'layer-missing-asset');
      expect(result.visible).toBe(false);
      expect(result.severity).toBe('error');
      expect(result.reasonCode).toBe('asset-missing');
    });

    it('returns error for file missing', () => {
      const project = createVisibilityTestProject();
      const result = getLayerVisibilityDiagnostic(project, 'scene-test', 'layer-file-missing');
      expect(result.visible).toBe(false);
      expect(result.severity).toBe('error');
      expect(result.reasonCode).toBe('asset-file-missing');
    });

    it('returns ok for visible layer with valid asset', () => {
      const project = createVisibilityTestProject();
      const result = getLayerVisibilityDiagnostic(project, 'scene-test', 'layer-visible');
      expect(result.visible).toBe(true);
      expect(result.severity).toBe('ok');
      expect(result.reasonCode).toBe('layer-visible');
    });

    it('returns ok for generator-bound layer', () => {
      const project = createVisibilityTestProject();
      const result = getLayerVisibilityDiagnostic(project, 'scene-test', 'layer-generator');
      expect(result.visible).toBe(true);
      expect(result.severity).toBe('ok');
      expect(result.reasonCode).toBe('layer-visible');
    });
  });

  describe('getSceneLayerVisibilityDiagnostics', () => {
    it('returns diagnostics for all layers in scene', () => {
      const project = createVisibilityTestProject();
      const diagnostics = getSceneLayerVisibilityDiagnostics(project, 'scene-test');

      expect(Object.keys(diagnostics).length).toBe(7);
      expect(diagnostics['layer-visible'].visible).toBe(true);
      expect(diagnostics['layer-disabled'].visible).toBe(false);
      expect(diagnostics['layer-zero-opacity'].visible).toBe(false);
      expect(diagnostics['layer-no-asset'].visible).toBe(false);
    });
  });

  describe('UNSUPPORTED_ASSET_KINDS', () => {
    it('defines unsupported asset kinds', () => {
      expect(UNSUPPORTED_ASSET_KINDS).toContain('shader');
      expect(UNSUPPORTED_ASSET_KINDS).toContain('live');
      expect(UNSUPPORTED_ASSET_KINDS).toContain('text');
    });
  });
});
