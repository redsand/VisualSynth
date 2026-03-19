import fs from 'fs';
import path from 'path';
import { app, safeStorage } from 'electron';
import {
  DEFAULT_NOW_PLAYING_SETTINGS,
  normalizeNowPlayingSettings,
  type NowPlayingSettings
} from '../shared/nowPlaying';

const SETTINGS_DIR = path.join(app.getPath('userData'), 'settings');
const SETTINGS_PATH = path.join(SETTINGS_DIR, 'now-playing.json');

interface StoredNowPlayingSettings {
  version: 1;
  encrypted: boolean;
  payload: string;
}

const serialize = (settings: NowPlayingSettings): StoredNowPlayingSettings => {
  const json = JSON.stringify(settings);
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(json);
    return {
      version: 1,
      encrypted: true,
      payload: encrypted.toString('base64')
    };
  }

  return {
    version: 1,
    encrypted: false,
    payload: json
  };
};

const deserialize = (stored: StoredNowPlayingSettings): NowPlayingSettings => {
  if (stored.encrypted) {
    const decrypted = safeStorage.decryptString(Buffer.from(stored.payload, 'base64'));
    return normalizeNowPlayingSettings(JSON.parse(decrypted) as Partial<NowPlayingSettings>);
  }
  return normalizeNowPlayingSettings(JSON.parse(stored.payload) as Partial<NowPlayingSettings>);
};

export const loadNowPlayingSettings = (): NowPlayingSettings => {
  try {
    if (!fs.existsSync(SETTINGS_PATH)) {
      return { ...DEFAULT_NOW_PLAYING_SETTINGS };
    }
    const raw = fs.readFileSync(SETTINGS_PATH, 'utf-8');
    return deserialize(JSON.parse(raw) as StoredNowPlayingSettings);
  } catch {
    return { ...DEFAULT_NOW_PLAYING_SETTINGS };
  }
};

export const saveNowPlayingSettings = (settings: Partial<NowPlayingSettings>): NowPlayingSettings => {
  const normalized = normalizeNowPlayingSettings(settings);
  fs.mkdirSync(SETTINGS_DIR, { recursive: true });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(serialize(normalized), null, 2), 'utf-8');
  return normalized;
};
