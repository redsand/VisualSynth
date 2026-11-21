// Serato DJ now-playing, read straight from Serato's own play history.
//
// Audio fingerprinting (Shazam/AudD) cannot name DJ edits, remixes and
// mashups — they aren't in any catalog. Serato already knows exactly what
// is loaded and playing, and records every track as it starts.
//
// PRIMARY (Serato DJ Pro 3.x+): the library is SQLite at
//   ~/Library/Application Support/Serato/Library/master.sqlite
// table history_entry (name, artist, album, start_time, end_time, deck,
// played). The currently playing track has end_time = -1 (still open).
// Verified live 2026-11-20 against a running set: rows appear the moment a
// track starts, edits/remixes carry their exact titles. Read via the macOS
// /usr/bin/sqlite3 CLI, read-only (no native module in the app; ~11ms).
//
// FALLBACK (older Serato): per-session files at
//   ~/Music/_Serato_/History/Sessions/<n>.session
// Session file format (binary "atoms": 4-byte ASCII tag + 4-byte big-endian
// length + payload, nesting):
//   vrsn                      version header
//   oent                      one history entry (repeated)
//     adat                    the entry's fields, each:
//       <u32 field id BE> <u32 length BE> <payload>
// Field ids used here (text fields are UTF-16BE):
//   0x02 full path   0x06 title   0x07 artist   0x08 album
//   0x1C start time (u32 unix s)   0x1D end time (u32 unix s)
//   0x1F deck (u32)  0x32 played (u8)
//
// "Now playing" = the most recently STARTED entry: in a DJ mix the incoming
// track is the newest one brought in, which is what the room hears once the
// transition completes. Entries with no start time fall back to file order.

import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

export interface SeratoHistoryEntry {
  path?: string;
  title?: string;
  artist?: string;
  album?: string;
  startTime?: number;
  endTime?: number;
  deck?: number;
  played?: boolean;
  /** position in the session file (append order) */
  index: number;
}

export interface SeratoNowPlaying {
  matched: boolean;
  title?: string;
  artist?: string;
  album?: string;
  provider: 'Serato';
  /** where the answer came from: the SQLite library or a legacy session file */
  source?: 'library' | 'session';
  sessionFile?: string;
  deck?: number;
  startedAt?: number;
  /** absolute path of the audio file Serato is playing (for embedded art) */
  filePath?: string;
  error?: string;
}

export const defaultSeratoLibraryDb = (): string =>
  path.join(os.homedir(), 'Library', 'Application Support', 'Serato', 'Library', 'master.sqlite');

// Still-open AND played first (what the room hears), newest start first.
// end_time = -1 marks the open entry; a loaded-but-unplayed cue sorts below.
const NOW_PLAYING_SQL =
  'SELECT name, artist, album, start_time, end_time, deck, played, portable_id FROM history_entry ' +
  'WHERE start_time > 0 ORDER BY (end_time < 0 AND played = 1) DESC, start_time DESC, id DESC LIMIT 1;';

const SQLITE_BIN = '/usr/bin/sqlite3';

/** Read now-playing from Serato's SQLite library (null when unavailable). */
export const readSeratoLibraryNowPlaying = (
  dbPath = defaultSeratoLibraryDb(),
  sqliteBin = SQLITE_BIN
): Promise<SeratoNowPlaying | null> =>
  new Promise((resolve) => {
    if (!fs.existsSync(dbPath) || !fs.existsSync(sqliteBin)) {
      resolve(null);
      return;
    }
    // mode=ro + -readonly: never write or lock Serato's live database.
    execFile(
      sqliteBin,
      ['-readonly', '-json', `file:${dbPath}?mode=ro`, NOW_PLAYING_SQL],
      { timeout: 3000, maxBuffer: 64 * 1024 },
      (error, stdout) => {
        if (error) {
          resolve({ matched: false, provider: 'Serato', source: 'library', error: String(error.message).slice(0, 160) });
          return;
        }
        try {
          const rows = JSON.parse(stdout.trim() || '[]') as Array<Record<string, unknown>>;
          const row = rows[0];
          const title = String(row?.name ?? '').trim();
          const artist = String(row?.artist ?? '').trim();
          if (!row || (!title && !artist)) {
            resolve({ matched: false, provider: 'Serato', source: 'library', error: 'no history entries' });
            return;
          }
          resolve({
            matched: true,
            title: title || undefined,
            artist: artist || undefined,
            album: String(row.album ?? '').trim() || undefined,
            provider: 'Serato',
            source: 'library',
            deck: Number(row.deck) || undefined,
            startedAt: Number(row.start_time) || undefined,
            // portable_id is the volume-relative path ("Users/…"): root it.
            filePath: row.portable_id ? `/${String(row.portable_id).replace(/^\/+/, '')}` : undefined
          });
        } catch (parseError) {
          resolve({ matched: false, provider: 'Serato', source: 'library', error: String(parseError).slice(0, 160) });
        }
      }
    );
  });

const FIELD_PATH = 0x02;
const FIELD_TITLE = 0x06;
const FIELD_ARTIST = 0x07;
const FIELD_ALBUM = 0x08;
const FIELD_START = 0x1c;
const FIELD_END = 0x1d;
const FIELD_DECK = 0x1f;
const FIELD_PLAYED = 0x32;

const decodeUtf16Be = (buf: Buffer): string => {
  const even = buf.length - (buf.length % 2);
  const swapped = Buffer.alloc(even);
  for (let i = 0; i < even; i += 2) {
    swapped[i] = buf[i + 1];
    swapped[i + 1] = buf[i];
  }
  return swapped.toString('utf16le').replace(/\0+$/g, '').trim();
};

const isAsciiTag = (tag: string) => /^[a-z]{4}$/.test(tag);

/** Parse one `adat` payload into an entry. */
export const parseAdat = (buf: Buffer, index: number): SeratoHistoryEntry => {
  const entry: SeratoHistoryEntry = { index };
  let offset = 0;
  while (offset + 8 <= buf.length) {
    const field = buf.readUInt32BE(offset);
    const len = buf.readUInt32BE(offset + 4);
    if (offset + 8 + len > buf.length) break; // truncated (file mid-write)
    const value = buf.subarray(offset + 8, offset + 8 + len);
    switch (field) {
      case FIELD_PATH: entry.path = decodeUtf16Be(value); break;
      case FIELD_TITLE: entry.title = decodeUtf16Be(value); break;
      case FIELD_ARTIST: entry.artist = decodeUtf16Be(value); break;
      case FIELD_ALBUM: entry.album = decodeUtf16Be(value); break;
      case FIELD_START: if (len >= 4) entry.startTime = value.readUInt32BE(0); break;
      case FIELD_END: if (len >= 4) entry.endTime = value.readUInt32BE(0); break;
      case FIELD_DECK: if (len >= 4) entry.deck = value.readUInt32BE(0); break;
      case FIELD_PLAYED: if (len >= 1) entry.played = value[0] !== 0; break;
      default: break;
    }
    offset += 8 + len;
  }
  return entry;
};

/** Parse every `oent` entry in a session file buffer. */
export const parseSeratoSession = (buf: Buffer): SeratoHistoryEntry[] => {
  const entries: SeratoHistoryEntry[] = [];
  let offset = 0;
  while (offset + 8 <= buf.length) {
    const tag = buf.toString('ascii', offset, offset + 4);
    const len = buf.readUInt32BE(offset + 4);
    if (!isAsciiTag(tag) || offset + 8 + len > buf.length) break; // truncated tail
    if (tag === 'oent') {
      const oent = buf.subarray(offset + 8, offset + 8 + len);
      // oent holds one or more child atoms; the fields live in `adat`.
      let inner = 0;
      while (inner + 8 <= oent.length) {
        const childTag = oent.toString('ascii', inner, inner + 4);
        const childLen = oent.readUInt32BE(inner + 4);
        if (!isAsciiTag(childTag) || inner + 8 + childLen > oent.length) break;
        if (childTag === 'adat') {
          entries.push(parseAdat(oent.subarray(inner + 8, inner + 8 + childLen), entries.length));
        }
        inner += 8 + childLen;
      }
    }
    offset += 8 + len;
  }
  return entries;
};

/** "Artist - Title.mp3" → {artist, title} when tags are missing. */
const fromFilename = (filePath: string): { artist?: string; title?: string } => {
  const base = path.basename(filePath).replace(/\.[a-z0-9]{2,4}$/i, '');
  const dash = base.indexOf(' - ');
  if (dash > 0) return { artist: base.slice(0, dash).trim(), title: base.slice(dash + 3).trim() };
  return { title: base };
};

/** Pick the current track: newest start time, else last appended. */
export const pickNowPlaying = (entries: SeratoHistoryEntry[]): SeratoHistoryEntry | null => {
  const usable = entries.filter((e) => e.title || e.artist || e.path);
  if (usable.length === 0) return null;
  const timed = usable.filter((e) => typeof e.startTime === 'number' && e.startTime > 0);
  if (timed.length > 0) {
    return timed.reduce((best, e) =>
      (e.startTime! > best.startTime! || (e.startTime === best.startTime && e.index > best.index)) ? e : best);
  }
  return usable[usable.length - 1];
};

export const defaultSeratoRoots = (): string[] => {
  const roots = [path.join(os.homedir(), 'Music', '_Serato_')];
  // Serato also keeps a _Serato_ folder at the root of external drives.
  try {
    for (const vol of fs.readdirSync('/Volumes')) {
      roots.push(path.join('/Volumes', vol, '_Serato_'));
    }
  } catch { /* no /Volumes (non-mac) */ }
  return roots;
};

/** Newest .session file across all Serato roots, or null. */
export const findLatestSessionFile = (roots = defaultSeratoRoots()): string | null => {
  let best: { file: string; mtime: number } | null = null;
  for (const root of roots) {
    const dir = path.join(root, 'History', 'Sessions');
    let files: string[];
    try { files = fs.readdirSync(dir); } catch { continue; }
    for (const f of files) {
      if (!f.endsWith('.session')) continue;
      const full = path.join(dir, f);
      try {
        const mtime = fs.statSync(full).mtimeMs;
        if (!best || mtime > best.mtime) best = { file: full, mtime };
      } catch { /* vanished mid-scan */ }
    }
  }
  return best?.file ?? null;
};

/** Legacy: read now-playing from History/Sessions/*.session (never throws). */
export const readSeratoSessionNowPlaying = (roots?: string[]): SeratoNowPlaying => {
  try {
    const sessionFile = findLatestSessionFile(roots);
    if (!sessionFile) return { matched: false, provider: 'Serato', error: 'no Serato history session found' };
    const entry = pickNowPlaying(parseSeratoSession(fs.readFileSync(sessionFile)));
    if (!entry) return { matched: false, provider: 'Serato', sessionFile, error: 'session has no tracks yet' };
    const fallback = entry.path ? fromFilename(entry.path) : {};
    const title = entry.title || fallback.title;
    const artist = entry.artist || fallback.artist;
    if (!title && !artist) return { matched: false, provider: 'Serato', sessionFile, error: 'entry has no title' };
    return { matched: true, title, artist, album: entry.album, provider: 'Serato', source: 'session', sessionFile, deck: entry.deck, startedAt: entry.startTime, filePath: entry.path };
  } catch (error) {
    return { matched: false, provider: 'Serato', error: String(error).slice(0, 160) };
  }
};

/** True when the Serato DJ app is running (cached ~2s; pgrep is ~5ms). */
let seratoRunningCache: { at: number; running: boolean } | null = null;
export const isSeratoRunning = (): Promise<boolean> =>
  new Promise((resolve) => {
    if (seratoRunningCache && Date.now() - seratoRunningCache.at < 2000) {
      resolve(seratoRunningCache.running);
      return;
    }
    execFile('/usr/bin/pgrep', ['-f', 'Serato DJ'], { timeout: 2000 }, (error) => {
      const running = !error; // exit 0 = at least one match
      seratoRunningCache = { at: Date.now(), running };
      resolve(running);
    });
  });

/** A track that started longer ago than this is not "now playing". */
export const SERATO_STALE_TRACK_MS = 15 * 60 * 1000;

/**
 * Serato is LIVE (authoritative over microphone fingerprinting) only while the
 * app is running AND its current track started recently. Serato's history
 * keeps the last track as open (end_time = -1) after the app quits, so the
 * database alone said "live" forever and blocked microphone song detection
 * once Serato was closed (2026-11-20).
 */
export const isSeratoResultLive = (
  result: Pick<SeratoNowPlaying, 'matched' | 'startedAt'>,
  running: boolean,
  nowMs = Date.now()
): boolean => {
  if (!running || !result.matched) return false;
  if (!result.startedAt) return true; // legacy session files carry no clock we trust
  return nowMs - result.startedAt * 1000 < SERATO_STALE_TRACK_MS;
};

/** Serato now-playing: SQLite library first, legacy session files second. */
export const readSeratoNowPlaying = async (): Promise<SeratoNowPlaying & { live: boolean }> => {
  const running = await isSeratoRunning();
  const library = await readSeratoLibraryNowPlaying();
  let result: SeratoNowPlaying;
  if (library?.matched) result = library;
  else {
    const session = readSeratoSessionNowPlaying();
    result = session.matched ? session : library ?? session;
  }
  return { ...result, live: isSeratoResultLive(result, running) };
};

/** Recent (file, artist) pairs from Serato history — seeds pool-logo detection. */
export const readSeratoRecentTracks = (
  limit = 80,
  dbPath = defaultSeratoLibraryDb(),
  sqliteBin = SQLITE_BIN
): Promise<Array<{ filePath: string; artist: string }>> =>
  new Promise((resolve) => {
    if (!fs.existsSync(dbPath) || !fs.existsSync(sqliteBin)) { resolve([]); return; }
    execFile(
      sqliteBin,
      ['-readonly', '-json', `file:${dbPath}?mode=ro`,
        `SELECT portable_id, artist FROM history_entry WHERE portable_id != '' ORDER BY id DESC LIMIT ${Math.max(1, Math.min(500, limit))};`],
      { timeout: 5000, maxBuffer: 1024 * 1024 },
      (error, stdout) => {
        if (error) { resolve([]); return; }
        try {
          const rows = JSON.parse(stdout.trim() || '[]') as Array<{ portable_id?: string; artist?: string }>;
          resolve(rows.filter((r) => r.portable_id).map((r) => ({
            filePath: `/${String(r.portable_id).replace(/^\/+/, '')}`,
            artist: String(r.artist ?? '')
          })));
        } catch { resolve([]); }
      }
    );
  });
