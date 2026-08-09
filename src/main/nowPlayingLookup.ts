import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { NowPlayingRecognitionRequest, NowPlayingRecognitionResponse } from '../shared/nowPlaying';
import { ShazamSignatureGenerator, SHAZAM_SAMPLE_RATE } from '../shared/shazamSignature';

// SSRF guard for user-supplied recognition/metadata endpoints. Enforces
// http/https and blocks the link-local 169.254.0.0/16 range (which includes the
// 169.254.169.254 cloud-metadata endpoint — the classic SSRF prize) and its IPv6
// counterpart, plus the wildcard "any" addresses. Loopback (127.0.0.0/8, ::1,
// "localhost") and private ranges (10/192.168/172.16) are deliberately ALLOWED:
// a user pointing at their own self-hosted recognition server on the LAN is a
// supported use case, and the test suite runs against a local mock server.
const isSsrfDisallowedHost = (hostname: string): boolean => {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === '0.0.0.0' || h === '::') return true; // wildcard "any" — never a real target
  const ipv4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (a === 0) return true;                // 0.0.0.0/8 "this" network
    if (a === 169 && b === 254) return true;  // 169.254.0.0/16 link-local (cloud metadata)
  }
  if (h.startsWith('fe80:') && h.indexOf('.') < 0) return true; // IPv6 link-local
  return false;
};

const safeHttpUrl = (raw: string, defaultScheme = 'https:'): URL => {
  let candidate = raw;
  if (!/^https?:\/\//i.test(candidate)) candidate = `${defaultScheme}//${candidate}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error('Invalid endpoint URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only http/https endpoints are allowed');
  }
  if (isSsrfDisallowedHost(url.hostname)) {
    throw new Error('Requests to link-local or wildcard addresses are not allowed');
  }
  return url;
};

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

const summarizeAudDError = (message: string | undefined): string => {
  const normalized = (message ?? '').toLowerCase();
  if (!normalized) {
    return 'AudD did not return a match.';
  }
  if (normalized.includes('audio fingerprint')) {
    return 'AudD could not fingerprint this clip. Try a cleaner 6-12 second section.';
  }
  if (normalized.includes('too large') || normalized.includes('large audio files')) {
    return 'AudD rejected the clip size. Use a shorter clip.';
  }
  if (normalized.includes('api token') || normalized.includes('token')) {
    return 'AudD authentication failed. Check the API token.';
  }
  if (normalized.includes('limit') || normalized.includes('quota')) {
    return 'AudD rate limit reached.';
  }
  return 'AudD recognition failed.';
};

const summarizeCustomHttpError = (status: number): string => {
  if (status === 400) return 'Custom endpoint rejected the request.';
  if (status === 401 || status === 403) return 'Custom endpoint authorization failed.';
  if (status === 404) return 'Custom endpoint not found.';
  if (status === 413) return 'Custom endpoint rejected the clip size.';
  if (status === 429) return 'Custom endpoint rate limit reached.';
  if (status >= 500) return 'Custom endpoint is unavailable.';
  return `Custom endpoint failed (${status}).`;
};

const summarizeAcrCloudError = (status: number | undefined, message: string | undefined): string => {
  const normalized = (message ?? '').toLowerCase();
  if (status === 3003 || normalized.includes('no result')) {
    return 'ACRCloud found no match.';
  }
  if (status === 1001 || normalized.includes('access key')) {
    return 'ACRCloud authentication failed.';
  }
  if (status === 3015 || normalized.includes('limit')) {
    return 'ACRCloud rate limit reached.';
  }
  if (normalized.includes('fingerprint')) {
    return 'ACRCloud could not fingerprint this clip.';
  }
  return 'ACRCloud recognition failed.';
};

const summarizeMetadataBridgeError = (status: number): string => {
  if (status === 401 || status === 403) return 'Metadata bridge authorization failed.';
  if (status === 404) return 'Metadata bridge endpoint not found.';
  if (status === 429) return 'Metadata bridge rate limit reached.';
  if (status >= 500) return 'Metadata bridge is unavailable.';
  return `Metadata bridge failed (${status}).`;
};

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
    return {
      matched: false,
      error: summarizeCustomHttpError(response.status)
    };
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

  const audioBlob = decodeAudioBlob(request);
  const clipSizeKb = Math.round(audioBlob.size / 1024 * 10) / 10;
  console.log(`[AudD] Sending lookup: ${clipSizeKb}KB, ${request.durationMs}ms, mimeType=${request.mimeType}`);

  const form = new FormData();
  form.set('api_token', request.apiKey);
  form.set('return', 'apple_music,spotify');
  form.set('file', audioBlob, 'clip.webm');

  const startTime = Date.now();
  const response = await fetchImpl('https://api.audd.io/', {
    method: 'POST',
    body: form
  });
  const elapsedMs = Date.now() - startTime;

  // Extract rate limit headers
  const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
  const rateLimitLimit = response.headers.get('X-RateLimit-Limit');
  const rateLimitReset = response.headers.get('X-RateLimit-Reset');

  if (!response.ok) {
    console.error(`[AudD] HTTP ${response.status} (${elapsedMs}ms)`);
    return {
      matched: false,
      error:
        response.status === 401 || response.status === 403
          ? 'AudD authentication failed. Check the API token.'
          : response.status === 429
            ? 'AudD rate limit reached. Wait a moment and try again.'
            : response.status >= 500
              ? 'AudD is unavailable.'
              : `AudD request failed (${response.status}).`,
      raw: { rateLimitRemaining, rateLimitLimit, rateLimitReset }
    };
  }

  const payload = await response.json() as {
    status?: string;
    result?: {
      title?: string;
      artist?: string;
      album?: string;
      label?: string;
      date?: string;
      release_date?: string;
      genres?: string[];
      song_link?: string;
      lyrics?: { lyrics?: string; copyright?: string };
      apple_music?: {
        artwork?: { url?: string; width?: number; height?: number };
        url?: string;
        previews?: Array<{ url?: string }>;
      };
      spotify?: {
        album?: {
          images?: { url?: string; height?: number; width?: number }[];
          name?: string;
          release_date?: string;
        };
        artists?: { name?: string; external_urls?: { spotify?: string } }[];
        external_urls?: { spotify?: string };
        preview_url?: string;
      };
      deezer?: {
        album?: { cover_xl?: string; cover?: string };
        artist?: { name?: string };
      };
    } | null;
    error?: { error_message?: string; error_code?: string };
  };

  if (payload.status !== 'success' || !payload.result) {
    console.log(`[AudD] No match (${elapsedMs}ms): ${payload.error?.error_message || 'unknown'}`);
    return {
      matched: false,
      error: summarizeAudDError(payload.error?.error_message),
      raw: { ...payload, rateLimitRemaining, rateLimitLimit, rateLimitReset }
    };
  }

  const result = payload.result;

  // Extract comprehensive metadata
  const artworkUrl =
    result.apple_music?.artwork?.url ||
    result.spotify?.album?.images?.[0]?.url ||
    result.deezer?.album?.cover_xl ||
    result.deezer?.album?.cover;

  const spotifyUrl = result.spotify?.external_urls?.spotify;
  const appleMusicUrl = result.apple_music?.url;

  const releaseDate = result.date || result.release_date || result.spotify?.album?.release_date;
  const genres = result.genres?.filter(Boolean) || [];
  const lyrics = result.lyrics?.lyrics;
  const label = result.label;

  const spotifyArtists = result.spotify?.artists?.map(a => a.name).filter(Boolean) || [];
  const artistName = result.artist || spotifyArtists.join(', ') || result.deezer?.artist?.name;

  console.log(`[AudD] Match found: ${artistName} - ${result.title} (${elapsedMs}ms)`);
  if (genres.length > 0) console.log(`[AudD] Genres: ${genres.join(', ')}`);
  if (releaseDate) console.log(`[AudD] Release: ${releaseDate}`);
  if (lyrics) console.log(`[AudD] Lyrics available: ${lyrics.length} chars`);

  return {
    matched: true,
    title: result.title,
    artist: artistName,
    album: result.album || result.spotify?.album?.name,
    artworkUrl,
    artistImageUrl: result.apple_music?.artwork?.url,
    confidence: 1,
    provider: 'AudD',
    raw: {
      ...payload,
      rateLimitRemaining,
      rateLimitLimit,
      rateLimitReset,
      // Extended metadata
      externalUrls: {
        spotify: spotifyUrl,
        appleMusic: appleMusicUrl
      },
      releaseDate,
      genres,
      lyrics: lyrics ? { text: lyrics, copyright: result.lyrics?.copyright } : undefined,
      label,
      previewUrl: result.spotify?.preview_url || result.apple_music?.previews?.[0]?.url
    }
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

  let identifyUrl: URL;
  try {
    identifyUrl = safeHttpUrl(`${request.host.replace(/\/$/, '')}/v1/identify`);
  } catch (err) {
    return { matched: false, error: err instanceof Error ? err.message : 'Invalid recognition host' };
  }
  const response = await fetchImpl(identifyUrl.toString(), {
    method: 'POST',
    body: form
  });

  if (!response.ok) {
    return {
      matched: false,
      error:
        response.status === 401 || response.status === 403
          ? 'ACRCloud authentication failed.'
          : response.status === 429
            ? 'ACRCloud rate limit reached.'
            : response.status >= 500
              ? 'ACRCloud is unavailable.'
              : `ACRCloud request failed (${response.status}).`
    };
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
      error: summarizeAcrCloudError(payload.status?.code, payload.status?.msg),
      raw: payload
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

const SHAZAM_USER_AGENTS = [
  'Dalvik/2.1.0 (Linux; U; Android 9; SM-G960F Build/PPR1.180610.011)',
  'Dalvik/2.1.0 (Linux; U; Android 10; SM-G973F Build/QP1A.190711.020)',
  'Dalvik/2.1.0 (Linux; U; Android 11; Pixel 4 Build/RQ3A.210905.001)',
  'Dalvik/2.1.0 (Linux; U; Android 12; SM-S908B Build/SP1A.210812.016)',
];

const postShazamLookup = async (
  request: NowPlayingRecognitionRequest,
  fetchImpl: typeof fetch
): Promise<NowPlayingRecognitionResponse> => {
  if (request.mimeType !== 'audio/pcm-s16le') {
    return {
      matched: false,
      error: 'Shazam provider requires PCM audio (audio/pcm-s16le). Ensure the renderer sent PCM.'
    };
  }

  // Decode base64 → Int16Array
  const rawBuf = Buffer.from(request.audioBase64, 'base64');
  const s16 = new Int16Array(rawBuf.buffer, rawBuf.byteOffset, rawBuf.byteLength / 2);

  console.log(`[Shazam] Received PCM: ${s16.length} samples (${(s16.length / 16000).toFixed(1)}s)`);

  // Build signature
  const gen = new ShazamSignatureGenerator();
  gen.feed(s16);
  const sigBytes = gen.encode();
  const sigBase64 = Buffer.from(sigBytes).toString('base64');
  const sampleMs = Math.trunc(gen.numSamples / SHAZAM_SAMPLE_RATE * 1000);

  console.log(`[Shazam] Generated fingerprint: ${gen.totalPeaks} peaks, ${sampleMs}ms duration`);

  if (gen.totalPeaks < 30) {
    console.warn('[Shazam] Warning: very few peaks detected, recognition may fail');
  }

  const sigUri = `data:audio/vnd.shazam.sig;base64,${sigBase64}`;

  // Build request URL with two random UUIDs
  const uuid1 = crypto.randomUUID().toUpperCase();
  const uuid2 = crypto.randomUUID().toUpperCase();
  const market = request.market?.trim() || 'US';
  const qs = 'sync=true&webv3=true&sampling=true&connected=&shazamapiversion=v3&sharehub=true&hubv5minorversion=v5.1&hidelb=true&video=v3';
  const url = `https://amp.shazam.com/discovery/v5/en-US/${market}/iphone/-/tag/${uuid1}/${uuid2}?${qs}`;

  const ua = SHAZAM_USER_AGENTS[Math.floor(Math.random() * SHAZAM_USER_AGENTS.length)];

  const body = JSON.stringify({
    timezone: 'America/Chicago',
    signature: { uri: sigUri, samplems: sampleMs },
    timestamp: Date.now(),
    context: {},
    geolocation: {}
  });

  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shazam-Platform': 'IPHONE',
      'X-Shazam-AppVersion': '14.1.0',
      'Accept': '*/*',
      'Accept-Language': 'en-US',
      'User-Agent': ua
    },
    body
  });

  if (!response.ok) {
    return {
      matched: false,
      error: `Shazam request failed (HTTP ${response.status}).`
    };
  }

  const payload = await response.json() as {
    matches?: unknown[];
    track?: {
      title?: string;
      subtitle?: string;
      images?: { coverarthq?: string; coverart?: string };
      sections?: Array<{ type?: string; metadata?: Array<{ title?: string; text?: string }> }>;
    } | null;
  };

  if (!payload.matches?.length || !payload.track) {
    return { matched: false, provider: 'Shazam', raw: payload };
  }

  const track = payload.track;

  // Extract album from SONG section metadata
  const songSection = track.sections?.find((s) => s.type === 'SONG');
  const albumMeta = songSection?.metadata?.find((m) => m.title?.toLowerCase() === 'album');
  const album = albumMeta?.text;

  return {
    matched: true,
    title: track.title,
    artist: track.subtitle,
    album,
    artworkUrl: track.images?.coverarthq ?? track.images?.coverart,
    confidence: 1,
    provider: 'Shazam',
    raw: payload
  };
};

export const fetchNowPlayingMetadataBridge = async (
  endpoint: string,
  secret: string | undefined,
  fetchImpl: typeof fetch = fetch
): Promise<NowPlayingRecognitionResponse> => {
  try {
    let url: URL;
    try {
      url = safeHttpUrl(endpoint);
    } catch (err) {
      return { matched: false, error: err instanceof Error ? err.message : 'Invalid metadata endpoint' };
    }
    if (secret?.trim()) {
      url.searchParams.set('token', secret);
    }

    const response = await fetchImpl(url.toString(), {
      method: 'GET',
      headers: { accept: 'application/json' }
    });

    if (!response.ok) {
      return { matched: false, error: summarizeMetadataBridgeError(response.status) };
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
      error: 'Metadata bridge is unavailable.'
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
