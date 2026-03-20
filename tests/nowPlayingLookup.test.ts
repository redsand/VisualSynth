import { describe, expect, it, vi } from 'vitest';
import {
  cacheRemoteArtwork,
  enrichNowPlayingArtwork,
  fetchNowPlayingMetadataBridge,
  identifyNowPlaying
} from '../src/main/nowPlayingLookup';

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

  it('returns a targeted message for HTTP 413 custom responses', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 413
    });

    const result = await identifyNowPlaying(
      {
        provider: 'custom',
        endpoint: 'https://example.com/hook',
        audioBase64: 'abc',
        mimeType: 'audio/webm',
        durationMs: 12000,
        detectedAt: 123
      },
      fetchImpl as unknown as typeof fetch
    );

    expect(result.matched).toBe(false);
    expect(result.error).toBe('Custom endpoint rejected the clip size.');
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

  it('shortens verbose AudD fingerprint errors', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'error',
        error: {
          error_message:
            "Recognition failed: there's been a problem with creating an audio fingerprint. Keep in mind that you should send only audio files."
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

    expect(result.matched).toBe(false);
    expect(result.error).toBe('AudD could not fingerprint this clip. Try a cleaner 6-12 second section.');
  });

  it('returns an error for shazam mode when audio is not PCM', async () => {
    const result = await identifyNowPlaying({
      provider: 'shazam',
      audioBase64: 'abc',
      mimeType: 'audio/webm',
      durationMs: 12000,
      detectedAt: 123
    });

    expect(result.matched).toBe(false);
    expect(result.error).toContain('PCM audio');
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

  it('shortens ACRCloud no-match responses', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: { code: 3003, msg: 'No result' },
        metadata: {}
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

    expect(result.matched).toBe(false);
    expect(result.error).toBe('ACRCloud found no match.');
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

describe('fetchNowPlayingMetadataBridge', () => {
  it('normalizes a bridge response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        artist: 'Daft Punk',
        title: 'Around the World',
        album: 'Homework',
        coverurl: '/artwork/homework.jpg'
      })
    });

    const result = await fetchNowPlayingMetadataBridge(
      'http://127.0.0.1:8899/v1/last',
      '',
      fetchImpl as unknown as typeof fetch
    );

    expect(result.matched).toBe(true);
    expect(result.artist).toBe('Daft Punk');
    expect(result.artworkUrl).toBe('http://127.0.0.1:8899/artwork/homework.jpg');
  });

  it('shortens metadata bridge HTTP errors', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 404
    });

    const result = await fetchNowPlayingMetadataBridge(
      'http://127.0.0.1:8899/v1/last',
      '',
      fetchImpl as unknown as typeof fetch
    );

    expect(result.matched).toBe(false);
    expect(result.error).toBe('Metadata bridge endpoint not found.');
  });
});

describe('enrichNowPlayingArtwork', () => {
  it('uses Cover Art Archive when MusicBrainz returns a matching release with art', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          releases: [
            {
              id: 'release-123',
              title: 'Discovery',
              score: 100,
              'artist-credit': [{ name: 'Daft Punk' }]
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true
      });

    const result = await enrichNowPlayingArtwork(
      {
        artist: 'Daft Punk',
        album: 'Discovery',
        title: 'One More Time'
      },
      fetchImpl as unknown as typeof fetch
    );

    expect(result.provider).toBe('Cover Art Archive');
    expect(result.artworkUrl).toBe('https://coverartarchive.org/release/release-123/front-500');
  });

  it('falls back to iTunes search when MusicBrainz does not return usable art', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          releases: []
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              trackName: 'Titanium',
              artistName: 'David Guetta feat. Sia',
              collectionName: 'Nothing but the Beat',
              artworkUrl100: 'https://example.com/titanium-100.jpg'
            }
          ]
        })
      });

    const result = await enrichNowPlayingArtwork(
      {
        artist: 'David Guetta feat. Sia',
        title: 'Titanium',
        album: 'Nothing but the Beat',
        market: 'us'
      },
      fetchImpl as unknown as typeof fetch
    );

    expect(result.provider).toBe('iTunes Search');
    expect(result.artworkUrl).toBe('https://example.com/titanium-100.jpg');
  });
});
