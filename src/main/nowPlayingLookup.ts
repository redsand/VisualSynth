import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { NowPlayingRecognitionRequest, NowPlayingRecognitionResponse } from '../shared/nowPlaying';

const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp'
};

const MUSICBRAINZ_HEADERS = {
  accept: 'application/json',
  'user-agent': 'VisualSynth/0.9.0 (Now Playing Artwork Lookup)'
};

export interface NowPlayingArtworkLookupRequest {
  title?: string;
  artist?: string;
  album?: string;
  market?: string;
}

export interface NowPlayingArtworkLookupResponse {
  artworkUrl?: string;
  artistImageUrl?: string;
  provider?: string;
  error?: string;
}

const normalizeComparable = (value: string | undefined): string =>
  (value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const scoreCandidate = (
  candidate: { title?: string; artist?: string; album?: string },
  request: NowPlayingArtworkLookupRequest
): number => {
  let score = 0;
  const candidateTitle = normalizeComparable(candidate.title);
  const candidateArtist = normalizeComparable(candidate.artist);
  const candidateAlbum = normalizeComparable(candidate.album);
  const requestTitle = normalizeComparable(request.title);
  const requestArtist = normalizeComparable(request.artist);
  const requestAlbum = normalizeComparable(request.album);

  if (requestTitle && candidateTitle === requestTitle) score += 6;
  else if (requestTitle && candidateTitle.includes(requestTitle)) score += 3;

  if (requestArtist && candidateArtist === requestArtist) score += 6;
  else if (requestArtist && candidateArtist.includes(requestArtist)) score += 3;

  if (requestAlbum && candidateAlbum === requestAlbum) score += 4;
  else if (requestAlbum && candidateAlbum.includes(requestAlbum)) score += 2;

  return score;
};

const imageUrlIsReachable = async (imageUrl: string, fetchImpl: typeof fetch): Promise<boolean> => {
  try {
    const response = await fetchImpl(imageUrl, { method: 'HEAD' });
    if (response.ok) {
      return true;
    }
  } catch {
    // Fall back to GET if HEAD is unsupported by the host.
  }

  try {
    const response = await fetchImpl(imageUrl, { method: 'GET' });
    return response.ok;
  } catch {
    return false;
  }
};

const lookupMusicBrainzArtwork = async (
  request: NowPlayingArtworkLookupRequest,
  fetchImpl: typeof fetch
): Promise<NowPlayingArtworkLookupResponse | null> => {
  if (!request.artist?.trim() || !request.album?.trim()) {
    return null;
  }

  const query = `release:"${request.album.trim()}" AND artist:"${request.artist.trim()}"`;
  const url = `https://musicbrainz.org/ws/2/release/?query=${encodeURIComponent(query)}&fmt=json&limit=5`;
  const response = await fetchImpl(url, {
    method: 'GET',
    headers: MUSICBRAINZ_HEADERS
  });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json() as {
    releases?: Array<{
      id?: string;
      title?: string;
      score?: number | string;
      'artist-credit'?: Array<{ name?: string }>;
    }>;
  };

  const releases = payload.releases ?? [];
  const ranked = releases
    .map((release) => ({
      release,
      score:
        Number(release.score ?? 0) +
        scoreCandidate(
          {
            title: release.title,
            artist: release['artist-credit']?.map((artist) => artist.name).filter(Boolean).join(', '),
            album: release.title
          },
          request
        )
    }))
    .sort((a, b) => b.score - a.score);

  for (const item of ranked) {
    if (!item.release.id) continue;
    const artworkUrl = `https://coverartarchive.org/release/${item.release.id}/front-500`;
    if (await imageUrlIsReachable(artworkUrl, fetchImpl)) {
      return {
        artworkUrl,
        provider: 'Cover Art Archive'
      };
    }
  }

  return null;
};

const lookupItunesArtwork = async (
  request: NowPlayingArtworkLookupRequest,
  fetchImpl: typeof fetch
): Promise<NowPlayingArtworkLookupResponse | null> => {
  const term = [request.artist, request.title, request.album].filter(Boolean).join(' ').trim();
  if (!term) {
    return null;
  }

  const url = new URL('https://itunes.apple.com/search');
  url.searchParams.set('term', term);
  url.searchParams.set('media', 'music');
  url.searchParams.set('entity', 'song');
  url.searchParams.set('limit', '5');
  url.searchParams.set('country', (request.market || 'us').toLowerCase());

  const response = await fetchImpl(url.toString(), {
    method: 'GET',
    headers: { accept: 'application/json' }
  });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json() as {
    results?: Array<{
      trackName?: string;
      artistName?: string;
      collectionName?: string;
      artworkUrl100?: string;
    }>;
  };

  const ranked = (payload.results ?? [])
    .map((item) => ({
      item,
      score: scoreCandidate(
        {
          title: item.trackName,
          artist: item.artistName,
          album: item.collectionName
        },
        request
      )
    }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0]?.item;
  if (!best?.artworkUrl100) {
    return null;
  }

  return {
    artworkUrl: best.artworkUrl100,
    provider: 'iTunes Search'
  };
};

const decodeAudioBlob = (request: NowPlayingRecognitionRequest): Blob =>
  new Blob([Buffer.from(request.audioBase64, 'base64')], {
    type: request.mimeType || 'audio/webm'
  });

const postCustomLookup = async (
  request: NowPlayingRecognitionRequest,
  fetchImpl: typeof fetch
): Promise<NowPlayingRecognitionResponse> => {
  if (!request.endpoint?.trim()) {
    return { matched: false, error: 'Custom provider requires an endpoint.' };
  }

  const response = await fetchImpl(request.endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(request.apiKey ? { authorization: `Bearer ${request.apiKey}` } : {})
    },
    body: JSON.stringify({
      audioBase64: request.audioBase64,
      mimeType: request.mimeType,
      durationMs: request.durationMs,
      detectedAt: request.detectedAt,
      provider: request.provider,
      market: request.market
    })
  });

  if (!response.ok) {
    return { matched: false, error: `Lookup failed with HTTP ${response.status}` };
  }

  const payload = (await response.json()) as NowPlayingRecognitionResponse;
  return {
    matched: Boolean(payload.matched),
    title: payload.title,
    artist: payload.artist,
    album: payload.album,
    artworkUrl: payload.artworkUrl,
    artistImageUrl: payload.artistImageUrl,
    confidence: payload.confidence,
    provider: payload.provider,
    raw: payload.raw
  };
};

const postAudDLookup = async (
  request: NowPlayingRecognitionRequest,
  fetchImpl: typeof fetch
): Promise<NowPlayingRecognitionResponse> => {
  if (!request.apiKey?.trim()) {
    return { matched: false, error: 'AudD requires an API token.' };
  }

  const form = new FormData();
  form.set('api_token', request.apiKey);
  form.set('return', 'apple_music,spotify');
  form.set('file', decodeAudioBlob(request), 'clip.webm');

  const response = await fetchImpl('https://api.audd.io/', {
    method: 'POST',
    body: form
  });

  if (!response.ok) {
    return { matched: false, error: `AudD failed with HTTP ${response.status}` };
  }

  const payload = await response.json() as {
    status?: string;
    result?: {
      title?: string;
      artist?: string;
      album?: string;
      song_link?: string;
      apple_music?: { artwork?: { url?: string } };
      spotify?: { album?: { images?: { url?: string }[] }; artists?: { name?: string }[] };
    } | null;
    error?: { error_message?: string };
  };

  if (payload.status !== 'success' || !payload.result) {
    return {
      matched: false,
      error: payload.error?.error_message || 'AudD did not return a match.'
    };
  }

  const artworkUrl =
    payload.result.apple_music?.artwork?.url ||
    payload.result.spotify?.album?.images?.[0]?.url;

  return {
    matched: true,
    title: payload.result.title,
    artist: payload.result.artist,
    album: payload.result.album,
    artworkUrl,
    confidence: 1,
    provider: 'AudD',
    raw: payload
  };
};

const buildAcrCloudSignature = (request: NowPlayingRecognitionRequest, timestamp: number) => {
  const method = 'POST';
  const uri = '/v1/identify';
  const dataType = 'audio';
  const signatureVersion = '1';
  const stringToSign = [
    method,
    uri,
    request.apiKey ?? '',
    dataType,
    signatureVersion,
    String(timestamp)
  ].join('\n');

  return crypto
    .createHmac('sha1', request.apiSecret ?? '')
    .update(stringToSign)
    .digest('base64');
};

const postAcrCloudLookup = async (
  request: NowPlayingRecognitionRequest,
  fetchImpl: typeof fetch
): Promise<NowPlayingRecognitionResponse> => {
  if (!request.host?.trim() || !request.apiKey?.trim() || !request.apiSecret?.trim()) {
    return {
      matched: false,
      error: 'ACRCloud requires host, access key, and access secret.'
    };
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const signature = buildAcrCloudSignature(request, timestamp);
  const form = new FormData();
  const audioBlob = decodeAudioBlob(request);
  form.set('sample', audioBlob, 'clip.webm');
  form.set('sample_bytes', String(Buffer.from(request.audioBase64, 'base64').byteLength));
  form.set('access_key', request.apiKey);
  form.set('data_type', 'audio');
  form.set('signature_version', '1');
  form.set('signature', signature);
  form.set('timestamp', String(timestamp));

  const host = request.host.startsWith('http') ? request.host : `https://${request.host}`;
  const response = await fetchImpl(`${host.replace(/\/$/, '')}/v1/identify`, {
    method: 'POST',
    body: form
  });

  if (!response.ok) {
    return { matched: false, error: `ACRCloud failed with HTTP ${response.status}` };
  }

  const payload = await response.json() as {
    status?: { code?: number; msg?: string };
    metadata?: {
      music?: Array<{
        title?: string;
        album?: { name?: string };
        artists?: Array<{ name?: string }>;
        external_metadata?: {
          spotify?: { album?: { images?: Array<{ url?: string }> } };
          youtube?: { vid?: string };
        };
      }>;
    };
  };

  const top = payload.metadata?.music?.[0];
  if (!top) {
    return {
      matched: false,
      error: payload.status?.msg || 'ACRCloud did not return a match.'
    };
  }

  const artworkUrl = top.external_metadata?.spotify?.album?.images?.[0]?.url;

  return {
    matched: true,
    title: top.title,
    artist: top.artists?.map((artist) => artist.name).filter(Boolean).join(', '),
    album: top.album?.name,
    artworkUrl,
    confidence: 1,
    provider: 'ACRCloud',
    raw: payload
  };
};

const postShazamLookup = async (
  request: NowPlayingRecognitionRequest,
  fetchImpl: typeof fetch
): Promise<NowPlayingRecognitionResponse> => {
  if (!request.endpoint?.trim()) {
    return {
      matched: false,
      error:
        'Shazam support in Electron requires a proxy endpoint. Apple ShazamKit does not expose a direct Node/Electron HTTP API.'
    };
  }
  return postCustomLookup(request, fetchImpl);
};

export const fetchNowPlayingMetadataBridge = async (
  endpoint: string,
  secret: string | undefined,
  fetchImpl: typeof fetch = fetch
): Promise<NowPlayingRecognitionResponse> => {
  try {
    const url = new URL(endpoint);
    if (secret?.trim()) {
      url.searchParams.set('token', secret);
    }

    const response = await fetchImpl(url.toString(), {
      method: 'GET',
      headers: { accept: 'application/json' }
    });

    if (!response.ok) {
      return { matched: false, error: `Metadata bridge failed with HTTP ${response.status}` };
    }

    const payload = await response.json() as Record<string, unknown>;
    const title = typeof payload.title === 'string' ? payload.title : undefined;
    const artist = typeof payload.artist === 'string' ? payload.artist : undefined;
    const album = typeof payload.album === 'string' ? payload.album : undefined;
    const artworkUrlRaw =
      typeof payload.coverurl === 'string'
        ? payload.coverurl
        : typeof payload.artworkUrl === 'string'
          ? payload.artworkUrl
          : typeof payload.image === 'string'
            ? payload.image
            : undefined;
    const artworkUrl = artworkUrlRaw
      ? new URL(artworkUrlRaw, url).toString()
      : undefined;

    if (!title && !artist) {
      return { matched: false, provider: 'Metadata Bridge', raw: payload };
    }

    return {
      matched: true,
      title,
      artist,
      album,
      artworkUrl,
      provider: 'Metadata Bridge',
      raw: payload
    };
  } catch (error) {
    return {
      matched: false,
      error: (error as Error).message
    };
  }
};

export const identifyNowPlaying = async (
  request: NowPlayingRecognitionRequest,
  fetchImpl: typeof fetch = fetch
): Promise<NowPlayingRecognitionResponse> => {
  try {
    if (request.provider === 'audd') {
      return await postAudDLookup(request, fetchImpl);
    }
    if (request.provider === 'acrcloud') {
      return await postAcrCloudLookup(request, fetchImpl);
    }
    if (request.provider === 'shazam') {
      return await postShazamLookup(request, fetchImpl);
    }
    return await postCustomLookup(request, fetchImpl);
  } catch (error) {
    return {
      matched: false,
      error: (error as Error).message
    };
  }
};

export const enrichNowPlayingArtwork = async (
  request: NowPlayingArtworkLookupRequest,
  fetchImpl: typeof fetch = fetch
): Promise<NowPlayingArtworkLookupResponse> => {
  try {
    const musicBrainzResult = await lookupMusicBrainzArtwork(request, fetchImpl);
    if (musicBrainzResult?.artworkUrl || musicBrainzResult?.artistImageUrl) {
      return musicBrainzResult;
    }

    const itunesResult = await lookupItunesArtwork(request, fetchImpl);
    if (itunesResult?.artworkUrl || itunesResult?.artistImageUrl) {
      return itunesResult;
    }

    return {};
  } catch (error) {
    return {
      error: (error as Error).message
    };
  }
};

export const cacheRemoteArtwork = async (
  imageUrl: string,
  assetStorage: string,
  fetchImpl: typeof fetch = fetch
): Promise<{ cached: boolean; filePath?: string; error?: string }> => {
  try {
    const response = await fetchImpl(imageUrl);
    if (!response.ok) {
      return { cached: false, error: `Artwork fetch failed with HTTP ${response.status}` };
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get('content-type')?.split(';')[0]?.trim() ?? 'image/jpeg';
    const ext = IMAGE_EXTENSIONS[contentType] || path.extname(new URL(imageUrl).pathname) || '.jpg';
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    fs.mkdirSync(assetStorage, { recursive: true });
    const filePath = path.join(assetStorage, `${hash}${ext.startsWith('.') ? ext : `.${ext}`}`);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, buffer);
    }
    return { cached: true, filePath };
  } catch (error) {
    return { cached: false, error: (error as Error).message };
  }
};
