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

describe('video asset handling', () => {
  it('creates video asset with playback options', () => {
    const asset = createAssetItem({
      name: 'Test Video',
      kind: 'video',
      path: '/assets/test.mp4',
      tags: ['video', 'test'],
      metadata: {
        hash: 'video-hash',
        mime: 'video/mp4',
        width: 1920,
        height: 1080,
        colorSpace: 'srgb' as AssetColorSpace
      },
      options: {
        loop: true,
        reverse: false,
        playbackRate: 1.5,
        frameBlend: 0.3,
        duration: 120.5
      }
    });

    expect(asset.kind).toBe('video');
    expect(asset.options?.loop).toBe(true);
    expect(asset.options?.reverse).toBe(false);
    expect(asset.options?.playbackRate).toBe(1.5);
    expect(asset.options?.frameBlend).toBe(0.3);
    expect(asset.options?.duration).toBe(120.5);
  });

  it('schema validates video asset with all options', () => {
    const patched = {
      ...DEFAULT_PROJECT,
      assets: [
        {
          id: 'video-asset-1',
          name: 'Sample Video',
          kind: 'video',
          path: '/assets/sample.mp4',
          tags: ['sample'],
          addedAt: new Date().toISOString(),
          hash: 'abc123',
          mime: 'video/mp4',
          width: 1280,
          height: 720,
          colorSpace: 'srgb',
          options: {
            loop: true,
            reverse: true,
            playbackRate: 0.5,
            frameBlend: 0.8,
            duration: 60
          }
        }
      ]
    };
    const parsed = projectSchema.safeParse(patched);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.assets[0].options?.loop).toBe(true);
      expect(parsed.data.assets[0].options?.reverse).toBe(true);
      expect(parsed.data.assets[0].options?.playbackRate).toBe(0.5);
      expect(parsed.data.assets[0].options?.frameBlend).toBe(0.8);
      expect(parsed.data.assets[0].options?.duration).toBe(60);
    }
  });

  it('schema handles video without optional playback options', () => {
    const patched = {
      ...DEFAULT_PROJECT,
      assets: [
        {
          id: 'video-minimal',
          name: 'Minimal Video',
          kind: 'video',
          tags: [],
          addedAt: new Date().toISOString()
        }
      ]
    };
    const parsed = projectSchema.safeParse(patched);
    expect(parsed.success).toBe(true);
  });

  it('creates video asset preserving duration metadata', () => {
    const asset = createAssetItem({
      name: 'Long Video',
      kind: 'video',
      path: '/assets/long.webm',
      tags: [],
      metadata: {
        hash: 'long-hash',
        mime: 'video/webm',
        width: 3840,
        height: 2160
      },
      options: {
        duration: 3600.25
      }
    });

    expect(asset.options?.duration).toBe(3600.25);
    expect(asset.mime).toBe('video/webm');
    expect(asset.width).toBe(3840);
    expect(asset.height).toBe(2160);
  });
});
