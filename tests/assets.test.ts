import { describe, expect, it } from 'vitest';
import { createAssetItem, normalizeAssetTags } from '../src/shared/assets';
import { DEFAULT_PROJECT } from '../src/shared/project';
import type { AssetColorSpace } from '../src/shared/project';
import { projectSchema } from '../src/shared/projectSchema';

describe('asset manager defaults', () => {
  it('starts with default internal assets', () => {
    expect(DEFAULT_PROJECT.assets.length).toBe(4);
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

describe('live capture assets', () => {
  it('creates live webcam asset', () => {
    const asset = createAssetItem({
      name: 'Webcam (Built-in)',
      kind: 'live',
      tags: ['webcam'],
      metadata: {
        width: 1280,
        height: 720,
        colorSpace: 'srgb' as AssetColorSpace
      },
      options: {
        liveSource: 'webcam'
      }
    });

    expect(asset.kind).toBe('live');
    expect(asset.options?.liveSource).toBe('webcam');
    expect(asset.width).toBe(1280);
    expect(asset.height).toBe(720);
  });

  it('creates live screen capture asset', () => {
    const asset = createAssetItem({
      name: 'Screen (Monitor 1)',
      kind: 'live',
      tags: ['screen'],
      metadata: {
        width: 1920,
        height: 1080,
        colorSpace: 'srgb' as AssetColorSpace
      },
      options: {
        liveSource: 'screen'
      }
    });

    expect(asset.kind).toBe('live');
    expect(asset.options?.liveSource).toBe('screen');
  });

  it('schema validates live asset with all options', () => {
    const patched = {
      ...DEFAULT_PROJECT,
      assets: [
        {
          id: 'live-asset-1',
          name: 'Live Webcam',
          kind: 'live',
          tags: ['live', 'webcam'],
          addedAt: new Date().toISOString(),
          width: 1280,
          height: 720,
          colorSpace: 'srgb',
          options: {
            liveSource: 'webcam'
          }
        }
      ]
    };
    const parsed = projectSchema.safeParse(patched);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.assets[0].kind).toBe('live');
      expect(parsed.data.assets[0].options?.liveSource).toBe('webcam');
    }
  });
});

describe('text asset handling', () => {
  it('creates text asset with font options', () => {
    const asset = createAssetItem({
      name: 'Hello World',
      kind: 'text',
      tags: ['caption'],
      metadata: {
        width: 512,
        height: 128,
        colorSpace: 'srgb' as AssetColorSpace
      },
      options: {
        text: 'Hello World',
        font: '48px Arial',
        fontSize: 48,
        fontColor: '#ffffff'
      }
    });

    expect(asset.kind).toBe('text');
    expect(asset.options?.text).toBe('Hello World');
    expect(asset.options?.font).toBe('48px Arial');
    expect(asset.options?.fontSize).toBe(48);
    expect(asset.options?.fontColor).toBe('#ffffff');
  });

  it('schema validates text asset with all options', () => {
    const patched = {
      ...DEFAULT_PROJECT,
      assets: [
        {
          id: 'text-asset-1',
          name: 'Caption Text',
          kind: 'text',
          tags: ['lyrics'],
          addedAt: new Date().toISOString(),
          width: 800,
          height: 100,
          colorSpace: 'srgb',
          options: {
            text: 'Sample Lyrics Here',
            font: '64px Impact',
            fontSize: 64,
            fontColor: '#ffff00'
          }
        }
      ]
    };
    const parsed = projectSchema.safeParse(patched);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.assets[0].kind).toBe('text');
      expect(parsed.data.assets[0].options?.text).toBe('Sample Lyrics Here');
      expect(parsed.data.assets[0].options?.fontColor).toBe('#ffff00');
    }
  });
});

describe('missing asset handling', () => {
  it('creates asset with missing flag', () => {
    const asset = createAssetItem({
      name: 'Missing Texture',
      kind: 'texture',
      path: '/assets/missing.png',
      tags: [],
      metadata: {}
    });
    asset.missing = true;

    expect(asset.missing).toBe(true);
  });

  it('schema accepts asset with missing flag', () => {
    const patched = {
      ...DEFAULT_PROJECT,
      assets: [
        {
          id: 'missing-asset-1',
          name: 'Missing Asset',
          kind: 'texture',
          path: '/nonexistent/path.png',
          tags: [],
          addedAt: new Date().toISOString(),
          missing: true
        }
      ]
    };
    const parsed = projectSchema.safeParse(patched);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.assets[0].missing).toBe(true);
    }
  });
});
