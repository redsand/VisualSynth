import { describe, expect, it, vi } from 'vitest';
import { cacheRemoteArtwork, identifyNowPlaying } from '../src/main/nowPlayingLookup';

describe('identifyNowPlaying', () => {
  it('normalizes a successful webhook response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        matched: true,
        title: 'Levels',
        artist: 'Avicii',
        artworkUrl: 'https://example.com/levels.jpg',
        confidence: 0.98
      })
    });

    const result = await identifyNowPlaying(
      {
        provider: 'custom',
        endpoint: 'https://example.com/hook',
        apiKey: 'secret',
        audioBase64: 'abc',
        mimeType: 'audio/webm',
        durationMs: 12000,
        detectedAt: 123
      },
      fetchImpl as unknown as typeof fetch
    );

    expect(result.matched).toBe(true);
    expect(result.title).toBe('Levels');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('builds an AudD multipart request', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'success',
        result: {
          title: 'Titanium',
          artist: 'David Guetta feat. Sia',
          album: 'Nothing but the Beat',
          spotify: {
            album: {
              images: [{ url: 'https://example.com/titanium.jpg' }]
            }
          }
        }
      })
    });

    const result = await identifyNowPlaying(
      {
        provider: 'audd',
        apiKey: 'audd-token',
        audioBase64: 'YWJj',
        mimeType: 'audio/webm',
        durationMs: 12000,
        detectedAt: 123
      },
      fetchImpl as unknown as typeof fetch
    );

    expect(result.matched).toBe(true);
    expect(result.provider).toBe('AudD');
    expect(fetchImpl.mock.calls[0][0]).toBe('https://api.audd.io/');
  });

  it('requires a proxy endpoint for shazam mode', async () => {
    const result = await identifyNowPlaying({
      provider: 'shazam',
      audioBase64: 'abc',
      mimeType: 'audio/webm',
      durationMs: 12000,
      detectedAt: 123
    });

    expect(result.matched).toBe(false);
    expect(result.error).toContain('proxy endpoint');
  });

  it('normalizes an ACRCloud match', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: { code: 0, msg: 'Success' },
        metadata: {
          music: [
            {
              title: 'One More Time',
              album: { name: 'Discovery' },
              artists: [{ name: 'Daft Punk' }],
              external_metadata: {
                spotify: {
                  album: {
                    images: [{ url: 'https://example.com/discovery.jpg' }]
                  }
                }
              }
            }
          ]
        }
      })
    });

    const result = await identifyNowPlaying(
      {
        provider: 'acrcloud',
        host: 'identify-eu-west-1.acrcloud.com',
        apiKey: 'access-key',
        apiSecret: 'access-secret',
        audioBase64: 'YWJj',
        mimeType: 'audio/webm',
        durationMs: 12000,
        detectedAt: 123
      },
      fetchImpl as unknown as typeof fetch
    );

    expect(result.matched).toBe(true);
    expect(result.title).toBe('One More Time');
    expect(result.provider).toBe('ACRCloud');
  });
});

describe('cacheRemoteArtwork', () => {
  it('returns an error for non-ok responses', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 404
    });

    const result = await cacheRemoteArtwork(
      'https://example.com/missing.jpg',
      'C:\\art-cache',
      fetchImpl as unknown as typeof fetch
    );

    expect(result.cached).toBe(false);
    expect(result.error).toContain('404');
  });
});
