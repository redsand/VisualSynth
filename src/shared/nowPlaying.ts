export interface NowPlayingRecognitionRequest {
  audioBase64: string;
  /** 'audio/pcm-s16le' when provider is 'shazam' (16 kHz mono Int16 PCM) */
  mimeType: string;
  durationMs: number;
  detectedAt: number;
  provider: 'custom' | 'audd' | 'acrcloud' | 'shazam';
  endpoint?: string;
  apiKey?: string;
  apiSecret?: string;
  host?: string;
  market?: string;
  /** Number of PCM samples — only set when mimeType is audio/pcm-s16le */
  numSamples?: number;
}

export interface NowPlayingRecognitionResponse {
  matched: boolean;
  title?: string;
  artist?: string;
  album?: string;
  artworkUrl?: string;
  artistImageUrl?: string;
  confidence?: number;
  /** Offset of the matched sample within the submitted clip (ACRCloud) */
  timeOffsetMs?: number;
  provider?: string;
  raw?: unknown;
  error?: string;
}

export interface NowPlayingSettings {
  enabled: boolean;
  metadataSourceEnabled: boolean;
  metadataSourceUrl: string;
  metadataSourceSecret: string;
  metadataSourcePollMs: number;
  provider: 'custom' | 'audd' | 'acrcloud' | 'shazam';
  /**
   * Try the free Shazam path before the configured provider when a song
   * change is detected. A successful Shazam match costs zero paid
   * (AudD/ACRCloud) quota; the configured provider is only hit when Shazam
   * fails or returns no match.
   */
  freeShazamFirst: boolean;
  endpoint: string;
  apiKey: string;
  apiSecret: string;
  host: string;
  market: string;
  clipDurationMs: number;
  cooldownMs: number;
  minTrackMs: number;
  silenceThreshold: number;
  changeThreshold: number;
  confirmWindows: number;
  artworkPreference: 'album' | 'artist';
  autoCreateOverlays: boolean;
  titleOverlayId: string;
  artworkOverlayId: string;
  slideshowEnabled: boolean;
  slideshowSceneIds: string[];
}

export const DEFAULT_NOW_PLAYING_SETTINGS: NowPlayingSettings = {
  enabled: false,
  metadataSourceEnabled: false,
  metadataSourceUrl: 'http://127.0.0.1:8899/v1/last',
  metadataSourceSecret: '',
  metadataSourcePollMs: 1500,
  provider: 'custom',
  freeShazamFirst: true,
  endpoint: '',
  apiKey: '',
  apiSecret: '',
  host: '',
  clipDurationMs: 12000,
  cooldownMs: 15000,
  // Auto-detection defaults. These are not currently exposed in the settings UI,
  // so the defaults ARE the user's only out-of-box experience. The previous
  // values (45s baseline, 0.42 threshold, 3 confirm windows = 7.5s of sustained
  // change) were conservative enough that the detector essentially never fired
  // for typical live/DJ listening.
  minTrackMs: 30000,
  silenceThreshold: 0.025,
  // Calibrated 2026-11-06 via scripts/probe-song-features.ts against the
  // detector v2 features (spectral shape + rise-rate flux, 2.5s windows):
  // cross-song window distance median ≈ 0.16 (min 0.063), same-song
  // adjacent-window drift median ≈ 0.12 with the low half under 0.08. 0.15
  // sits just under the cross-song median so a typical transition fires
  // within ~2 windows, while steady same-song playback stays under it.
  // (The pre-v2 feature produced cross-song 0.03–0.08 — under ANY sane
  // threshold — which is why auto-detect never fired at shows.)
  changeThreshold: 0.15,
  confirmWindows: 2,
  // Shazam market codes are case-sensitive at the edge ('us' → HTTP 400);
  // the main-process lookup also normalizes to uppercase as a belt-and-braces.
  market: 'US',
  artworkPreference: 'album',
  autoCreateOverlays: true,
  titleOverlayId: 'now-playing-title',
  artworkOverlayId: 'now-playing-artwork',
  slideshowEnabled: false,
  slideshowSceneIds: []
};

export const normalizeNowPlayingSettings = (
  value: Partial<NowPlayingSettings> | null | undefined
): NowPlayingSettings => ({
  ...DEFAULT_NOW_PLAYING_SETTINGS,
  ...(value ?? {})
});

export const isNowPlayingLookupConfigured = (settings: NowPlayingSettings): boolean =>
  settings.enabled &&
  (
    // Free-first Shazam needs no credentials, so recognition is possible
    // even when the configured paid provider has empty keys.
    settings.freeShazamFirst ||
    (settings.provider === 'custom' && settings.endpoint.trim().length > 0) ||
    (settings.provider === 'audd' && settings.apiKey.trim().length > 0) ||
    (
      settings.provider === 'acrcloud' &&
      settings.host.trim().length > 0 &&
      settings.apiKey.trim().length > 0 &&
      settings.apiSecret.trim().length > 0
    ) ||
    settings.provider === 'shazam'
  );

export const isNowPlayingMetadataSourceConfigured = (settings: NowPlayingSettings): boolean =>
  settings.enabled && settings.metadataSourceEnabled && settings.metadataSourceUrl.trim().length > 0;
