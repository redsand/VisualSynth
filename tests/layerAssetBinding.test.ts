/**
 * Tests for Layer Asset Binding Resolution
 *
 * Tests ensure that:
 * 1. Asset assignments use stable layer IDs, not array positions
 * 2. Asset bindings persist through layer reordering
 * 3. Status chips show correct binding state
 * 4. Missing assets are properly detected and displayed
 */

import { describe, expect, it } from 'vitest';
import {
  resolveScene,
  resolveLayer,
  resolveLayerAsset,
  resolveSceneAssetBindings,
  ResolutionStatus
} from '../src/shared/resolvers';
import type { VisualSynthProject, SceneConfig, LayerConfig, AssetItem } from '../src/shared/project';

// Canonical default layer transform (matches DEFAULT_PROJECT / shared/layers.ts fallback).
const defaultTransform = { x: 0, y: 0, scale: 1, rotation: 0 };

// Helper to create a test project. Intentionally minimal — only the fields
// the resolvers read — cast to VisualSynthProject.
const createTestProject = (): VisualSynthProject => {
  const assets: AssetItem[] = [
    { id: 'asset-a', name: 'Texture A', kind: 'texture', tags: [], addedAt: '2024-01-01' },
    { id: 'asset-b', name: 'Texture B', kind: 'texture', tags: [], addedAt: '2024-01-01' },
    { id: 'asset-video', name: 'Video Clip', kind: 'video', tags: [], addedAt: '2024-01-01' }
  ];

  // Create layers with explicit IDs (simulating real UI state)
  const layers: LayerConfig[] = [
    { id: 'layer-plasma', name: 'Plasma', role: 'core', enabled: true, opacity: 0.75, blendMode: 'screen', transform: { ...defaultTransform }, assetId: 'asset-a' },
    { id: 'layer-spectrum', name: 'Spectrum', role: 'support', enabled: true, opacity: 0.75, blendMode: 'add', transform: { ...defaultTransform }, assetId: 'asset-b' },
    { id: 'layer-media', name: 'Media', role: 'support', enabled: true, opacity: 1, blendMode: 'screen', transform: { ...defaultTransform }, assetId: 'asset-video' },
    { id: 'layer-no-asset', name: 'No Asset', role: 'atmosphere', enabled: true, opacity: 0.8, blendMode: 'screen', transform: { ...defaultTransform } },
    { id: 'layer-disabled', name: 'Disabled Layer', role: 'support', enabled: false, opacity: 0.5, blendMode: 'normal', transform: { ...defaultTransform }, assetId: 'asset-a' }
  ];

  const scenes: SceneConfig[] = [
    {
      id: 'scene-main',
      name: 'Main Scene',
      layers: [...layers]
    },
    {
      id: 'scene-alt',
      name: 'Alternative Scene',
      layers: [
        { id: 'layer-plasma', name: 'Plasma', role: 'core', enabled: true, opacity: 0.75, blendMode: 'screen', transform: { ...defaultTransform }, assetId: 'asset-a' },
        { id: 'layer-alt', name: 'Alt Layer', role: 'support', enabled: true, opacity: 1, blendMode: 'screen', transform: { ...defaultTransform }, generatorId: 'gen-plasma' }
      ]
    }
  ];

  return {
    version: 6,
    name: 'Test Project',
    assets,
    scenes,
    activeSceneId: 'scene-main'
  } as VisualSynthProject;
};

describe('layerAssetBinding', () => {
  describe('stable ID resolution', () => {
    it('resolves asset binding using stable layer ID', () => {
      const project = createTestProject();
      const sceneRes = resolveScene(project, 'scene-main');
      expect(sceneRes.status).toBe('resolved');

      const layerRes = resolveLayer(sceneRes.scene, 'layer-plasma');
      expect(layerRes.status).toBe('resolved');

      const assetRes = resolveLayerAsset(layerRes.layer, project.assets);
      expect(assetRes.status).toBe('resolved');
      expect(assetRes.asset?.id).toBe('asset-a');
      expect(assetRes.asset?.name).toBe('Texture A');
    });

    it('resolves correct asset when multiple layers have bindings', () => {
      const project = createTestProject();
      const scene = project.scenes[0];

      // Verify each layer gets its correct asset
      const plasmaRes = resolveLayerAsset(scene.layers.find(l => l.id === 'layer-plasma')!, project.assets);
      expect(plasmaRes.asset?.id).toBe('asset-a');

      const spectrumRes = resolveLayerAsset(scene.layers.find(l => l.id === 'layer-spectrum')!, project.assets);
      expect(spectrumRes.asset?.id).toBe('asset-b');

      const mediaRes = resolveLayerAsset(scene.layers.find(l => l.id === 'layer-media')!, project.assets);
      expect(mediaRes.asset?.id).toBe('asset-video');
    });
  });

  describe('reorder protection', () => {
    it('asset binding persists after layer reorder', () => {
      const project = createTestProject();
      const scene = project.scenes[0];

      // Record original bindings by ID
      const originalPlasmaAsset = scene.layers.find(l => l.id === 'layer-plasma')!.assetId;
      const originalSpectrumAsset = scene.layers.find(l => l.id === 'layer-spectrum')!.assetId;

      // Simulate reordering (swapping plasma and spectrum)
      const plasmaLayer = scene.layers.find(l => l.id === 'layer-plasma')!;
      const spectrumLayer = scene.layers.find(l => l.id === 'layer-spectrum')!;

      const plasmaIndex = scene.layers.indexOf(plasmaLayer);
      const spectrumIndex = scene.layers.indexOf(spectrumLayer);

      const reordered = [...scene.layers];
      reordered[plasmaIndex] = spectrumLayer;
      reordered[spectrumIndex] = plasmaLayer;
      scene.layers = reordered;

      // Verify asset bindings are preserved (not swapped)
      const newPlasmaAsset = scene.layers.find(l => l.id === 'layer-plasma')!.assetId;
      const newSpectrumAsset = scene.layers.find(l => l.id === 'layer-spectrum')!.assetId;

      expect(newPlasmaAsset).toBe(originalPlasmaAsset);
      expect(newSpectrumAsset).toBe(originalSpectrumAsset);
    });

    it('using stable IDs prevents binding corruption', () => {
      const project = createTestProject();
      const scene = project.scenes[0];

      // Store layer IDs before reordering
      const layerIds = scene.layers.map(l => ({ id: l.id, assetId: l.assetId }));

      // Reorder layers
      scene.layers.reverse();

      // After reordering, verify layer IDs still reference the same assets
      scene.layers.forEach(layer => {
        const original = layerIds.find(l => l.id === layer.id);
        expect(original).toBeDefined();
        expect(layer.assetId).toBe(original?.assetId);
      });
    });
  });

  describe('status detection', () => {
    it('detects missing asset correctly', () => {
      const project = createTestProject();
      const scene = project.scenes[0];

      // Add a layer with a non-existent asset ID
      const missingAssetLayer: LayerConfig = {
        id: 'layer-missing',
        name: 'Missing Asset Layer',
        role: 'support',
        enabled: true,
        opacity: 1,
        blendMode: 'normal',
        transform: { ...defaultTransform },
        assetId: 'asset-does-not-exist'
      };
      scene.layers.push(missingAssetLayer);

      const layerRes = resolveLayer(scene, 'layer-missing');
      expect(layerRes.status).toBe('resolved');

      const assetRes = resolveLayerAsset(layerRes.layer, project.assets);
      expect(assetRes.status).toBe('missing-asset');
      expect(assetRes.assetId).toBe('asset-does-not-exist');
    });

    it('detects no-binding layers', () => {
      const project = createTestProject();
      const scene = project.scenes[0];
      const noAssetLayer = scene.layers.find(l => l.id === 'layer-no-asset')!;

      const assetRes = resolveLayerAsset(noAssetLayer, project.assets);
      expect(assetRes.status).toBe('no-binding');
    });

    it('detects generator-bound layers', () => {
      const project = createTestProject();
      const scene = project.scenes[1]; // scene-alt has generator-bound layer
      const genLayer = scene.layers.find(l => l.id === 'layer-alt')!;

      const assetRes = resolveLayerAsset(genLayer, project.assets);
      expect(assetRes.status).toBe('generator-bound');
      expect(assetRes.generatorId).toBe('gen-plasma');
    });
  });

  describe('all asset bindings in scene', () => {
    it('gets all asset bindings for a scene', () => {
      const project = createTestProject();
      const sceneRes = resolveScene(project, 'scene-main');
      expect(sceneRes.status).toBe('resolved');

      const bindings = resolveSceneAssetBindings(project, 'scene-main');

      expect(Object.keys(bindings).length).toBe(5);

      // Check specific bindings
      expect(bindings['layer-plasma'].status).toBe('resolved');
      expect(bindings['layer-plasma'].asset?.id).toBe('asset-a');

      expect(bindings['layer-no-asset'].status).toBe('no-binding');

      expect(bindings['layer-disabled'].status).toBe('resolved');
      expect(bindings['layer-disabled'].asset?.id).toBe('asset-a');
    });

    it('scene with missing assets shows all statuses', () => {
      const project = createTestProject();
      const scene = project.scenes[0];

      // Add a layer with a missing asset
      const missingAssetLayer: LayerConfig = {
        id: 'layer-broken',
        name: 'Broken Layer',
        role: 'support',
        enabled: true,
        opacity: 1,
        blendMode: 'normal',
        transform: { ...defaultTransform },
        assetId: 'missing-id-12345'
      };
      scene.layers.push(missingAssetLayer);

      const bindings = resolveSceneAssetBindings(project, 'scene-main');

      expect(bindings['layer-broken'].status).toBe('missing-asset');
      expect(bindings['layer-broken'].assetId).toBe('missing-id-12345');
    });
  });

  describe('integration with UI state patterns', () => {
    it('simulates layer selection with stable IDs', () => {
      const project = createTestProject();
      const scene = project.scenes[0];

      // Simulate UI selecting a layer by ID
      const selectedLayerId = 'layer-plasma';
      const selectedLayer = scene.layers.find(l => l.id === selectedLayerId);
      expect(selectedLayer).toBeDefined();
      expect(selectedLayer?.assetId).toBe('asset-a');

      // Simulate changing asset for this layer
      const newAssetId = 'asset-b';
      if (selectedLayer) {
        selectedLayer.assetId = newAssetId;
      }

      // Verify the change persisted
      const updatedLayer = scene.layers.find(l => l.id === selectedLayerId);
      expect(updatedLayer?.assetId).toBe(newAssetId);
    });

    it('handles layer removal without affecting other bindings', () => {
      const project = createTestProject();
      const scene = project.scenes[0];

      // Record binding for layer-spectrum
      const spectrumLayer = scene.layers.find(l => l.id === 'layer-spectrum')!;
      const spectrumAsset = spectrumLayer.assetId;

      // Remove a different layer (layer-media)
      const mediaIndex = scene.layers.findIndex(l => l.id === 'layer-media');
      if (mediaIndex >= 0) {
        scene.layers.splice(mediaIndex, 1);
      }

      // Verify spectrum layer binding is unchanged
      const remainingSpectrum = scene.layers.find(l => l.id === 'layer-spectrum');
      expect(remainingSpectrum?.assetId).toBe(spectrumAsset);
    });
  });
});
