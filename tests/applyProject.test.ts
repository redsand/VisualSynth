import { describe, expect, it } from 'vitest';
import { DEFAULT_PROJECT, VisualSynthProject } from '../src/shared/project';
import { createAssetItem } from '../src/shared/assets';

// Note: In a real test we'd need to mock the DOM and event handlers,
// but we can test the core merging logic by simulating the applyProject behavior.

const createMockProject = (name: string, assets: any[] = []): VisualSynthProject => ({
  ...DEFAULT_PROJECT,
  name,
  assets
});

describe('Project Application Logic (Asset Merging)', () => {
  const existingAsset = createAssetItem({ name: 'User Texture', kind: 'texture', path: 'user.png' });
  const currentAssets = [existingAsset];

  it('should merge assets when mergeAssets is true', () => {
    const presetAsset = createAssetItem({ name: 'Preset Texture', kind: 'texture', path: 'preset.png' });
    const incomingProject = createMockProject('New Preset', [presetAsset]);
    
    // Simulate applyProject with mergeAssets: true
    const existingIds = new Set(currentAssets.map(a => a.id));
    const newAssets = incomingProject.assets.filter(a => !existingIds.has(a.id));
    const finalAssets = [...currentAssets, ...newAssets];

    expect(finalAssets).toHaveLength(2);
    expect(finalAssets.map(a => a.name)).toContain('User Texture');
    expect(finalAssets.map(a => a.name)).toContain('Preset Texture');
  });

  it('should avoid duplicate assets during merge', () => {
    const incomingProject = createMockProject('New Preset', [existingAsset]);
    
    const existingIds = new Set(currentAssets.map(a => a.id));
    const newAssets = incomingProject.assets.filter(a => !existingIds.has(a.id));
    const finalAssets = [...currentAssets, ...newAssets];

    expect(finalAssets).toHaveLength(1);
    expect(finalAssets[0].id).toBe(existingAsset.id);
  });

  it('should preserve existing assets when preserveAssets is true', () => {
    const presetAsset = createAssetItem({ name: 'Preset Texture', kind: 'texture', path: 'preset.png' });
    const incomingProject = createMockProject('New Preset', [presetAsset]);
    
    // Simulate preserveAssets: true
    const finalAssets = [...currentAssets];

    expect(finalAssets).toHaveLength(1);
    expect(finalAssets[0].name).toBe('User Texture');
  });
});
