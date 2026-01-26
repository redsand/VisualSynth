import { describe, expect, it } from 'vitest';
import { createAssetItem, normalizeAssetTags } from '../src/shared/assets';
import { DEFAULT_PROJECT } from '../src/shared/project';
import type { AssetColorSpace } from '../src/shared/project';
import { projectSchema } from '../src/shared/projectSchema';

describe('asset manager defaults', () => {
  it('starts with no assets', () => {
    expect(DEFAULT_PROJECT.assets.length).toBe(0);
  });

  it('schema supplies asset defaults', () => {
    const { assets, ...rest } = DEFAULT_PROJECT;
    const parsed = projectSchema.safeParse(rest);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.assets.length).toBe(0);
  });
});

describe('asset helper utilities', () => {
  it('normalizes comma separated tags', () => {
    const tags = normalizeAssetTags('alpha, beta, gamma');
    expect(tags).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('creates an asset item with metadata and options', () => {
const metadata = {
  hash: 'test-hash',
  mime: 'image/png',
  width: 128,
  height: 256,
  colorSpace: 'linear' as AssetColorSpace,
  thumbnail: 'data:image/png;base64,ABCD'
};
  const asset = createAssetItem({
    name: 'Test Texture',
    kind: 'texture',
    path: '/assets/test.png',
    tags: ['test'],
    metadata,
    options: { textureSampling: 'nearest', generateMipmaps: true }
  });

  expect(asset.id).toMatch(/^asset-/);
  expect(asset.name).toBe('Test Texture');
  expect(asset.tags).toEqual(['test']);
  expect(asset.hash).toBe('test-hash');
  expect(asset.colorSpace).toBe('linear');
  expect(asset.options?.textureSampling).toBe('nearest');
  expect(asset.options?.generateMipmaps).toBe(true);
  expect(asset.thumbnail).toBe('data:image/png;base64,ABCD');
});
});

it('schema accepts rich asset options', () => {
  const patched = {
    ...DEFAULT_PROJECT,
    assets: [
      {
        id: 'asset-test',
        name: 'Demo Texture',
        kind: 'texture',
        tags: ['demo'],
        addedAt: new Date().toISOString(),
        options: {
          loop: true,
          playbackRate: 1.2,
          frameBlend: 0.3,
          textureSampling: 'linear',
          generateMipmaps: true,
          duration: 12
        }
      }
    ]
  };
  const parsed = projectSchema.safeParse(patched);
  expect(parsed.success).toBe(true);
});
