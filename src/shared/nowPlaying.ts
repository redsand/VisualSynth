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
  endpoint: '',
  apiKey: '',
  apiSecret: '',
  host: '',
  clipDurationMs: 12000,
  cooldownMs: 15000,
  minTrackMs: 45000,
  silenceThreshold: 0.025,
  changeThreshold: 0.42,
  confirmWindows: 3,
  market: 'us',
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
