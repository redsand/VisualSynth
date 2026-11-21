import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';
import {
  findLatestSessionFile,
  parseSeratoSession,
  pickNowPlaying,
  readSeratoSessionNowPlaying,
  readSeratoLibraryNowPlaying
} from '../src/main/seratoNowPlaying';
import { execFileSync } from 'child_process';

// Builders for Serato's history session format: ASCII-tagged atoms with
// big-endian lengths; `adat` fields are <u32 id><u32 len><payload>.
const atom = (tag: string, payload: Buffer) => {
  const head = Buffer.alloc(8);
  head.write(tag, 0, 'ascii');
  head.writeUInt32BE(payload.length, 4);
  return Buffer.concat([head, payload]);
};
const utf16be = (s: string) => {
  const le = Buffer.from(`${s}\0`, 'utf16le');
  for (let i = 0; i < le.length; i += 2) [le[i], le[i + 1]] = [le[i + 1], le[i]];
  return le;
};
const field = (id: number, payload: Buffer) => {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(id, 0);
  head.writeUInt32BE(payload.length, 4);
  return Buffer.concat([head, payload]);
};
const u32 = (n: number) => { const b = Buffer.alloc(4); b.writeUInt32BE(n, 0); return b; };
const entry = (o: { path?: string; title?: string; artist?: string; start?: number; deck?: number }) =>
  atom('oent', atom('adat', Buffer.concat([
    ...(o.path ? [field(0x02, utf16be(o.path))] : []),
    ...(o.title ? [field(0x06, utf16be(o.title))] : []),
    ...(o.artist ? [field(0x07, utf16be(o.artist))] : []),
    ...(o.start ? [field(0x1c, u32(o.start))] : []),
    ...(o.deck !== undefined ? [field(0x1f, u32(o.deck))] : []),
    field(0x32, Buffer.from([1]))
  ])));
const session = (...entries: Buffer[]) =>
  Buffer.concat([atom('vrsn', utf16be('2.0/Serato Scratch LIVE Review')), ...entries]);

describe('Serato now-playing reader', () => {
  it('parses titles, artists, decks and start times from adat fields', () => {
    const entries = parseSeratoSession(session(
      entry({ path: '/Music/a.mp3', title: 'I LIKE IT (Intro - Dirty)', artist: 'BigXthaPlug & Loe Shimmy', start: 1000, deck: 1 })
    ));
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ title: 'I LIKE IT (Intro - Dirty)', artist: 'BigXthaPlug & Loe Shimmy', startTime: 1000, deck: 1, played: true });
  });

  it('picks the most recently STARTED track across decks (the incoming mix-in)', () => {
    const entries = parseSeratoSession(session(
      entry({ title: 'Older', artist: 'A', start: 1000, deck: 1 }),
      entry({ title: 'Incoming edit', artist: 'B', start: 1300, deck: 2 }),
      entry({ title: 'Loaded earlier on deck 1', artist: 'C', start: 1200, deck: 1 })
    ));
    expect(pickNowPlaying(entries)?.title).toBe('Incoming edit');
  });

  it('falls back to "Artist - Title" from the file name when tags are missing', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-serato-'));
    const sessions = path.join(dir, '_Serato_', 'History', 'Sessions');
    fs.mkdirSync(sessions, { recursive: true });
    fs.writeFileSync(path.join(sessions, '1.session'), session(
      entry({ path: '/Music/Pop Smoke - Dior (Lincoln Baio Halloween Remix).mp3', start: 50 })
    ));
    const now = readSeratoSessionNowPlaying([path.join(dir, '_Serato_')]);
    expect(now).toMatchObject({ matched: true, artist: 'Pop Smoke', title: 'Dior (Lincoln Baio Halloween Remix)', provider: 'Serato' });
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('tolerates a session file truncated mid-write (Serato appends live)', () => {
    const full = session(entry({ title: 'Complete', artist: 'X', start: 10 }), entry({ title: 'Half', artist: 'Y', start: 20 }));
    const entries = parseSeratoSession(full.subarray(0, full.length - 7));
    expect(entries.map((e) => e.title)).toEqual(['Complete']);
  });

  it('reads the newest session across roots and reports cleanly when none exist', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-serato-'));
    expect(readSeratoSessionNowPlaying([path.join(dir, 'missing')])).toMatchObject({ matched: false, provider: 'Serato' });
    const sessions = path.join(dir, '_Serato_', 'History', 'Sessions');
    fs.mkdirSync(sessions, { recursive: true });
    fs.writeFileSync(path.join(sessions, 'old.session'), session(entry({ title: 'Old', start: 1 })));
    const newer = path.join(sessions, 'new.session');
    fs.writeFileSync(newer, session(entry({ title: 'New', start: 2 })));
    fs.utimesSync(newer, new Date(), new Date(Date.now() + 5000));
    expect(findLatestSessionFile([path.join(dir, '_Serato_')])).toBe(newer);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  // Serato DJ Pro 3.x keeps history in SQLite (master.sqlite history_entry).
  const makeLibrary = (rows: string): string => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-serato-lib-'));
    const db = path.join(dir, 'master.sqlite');
    execFileSync('/usr/bin/sqlite3', [db,
      'CREATE TABLE history_entry (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL DEFAULT \'\', ' +
      'artist TEXT NOT NULL DEFAULT \'\', album TEXT NOT NULL DEFAULT \'\', session_id INTEGER, ' +
      'start_time INTEGER, end_time INTEGER, played INTEGER, deck TEXT, portable_id TEXT NOT NULL DEFAULT \'\');' + rows]);
    return db;
  };
  const hasSqlite = fs.existsSync('/usr/bin/sqlite3');

  it.skipIf(!hasSqlite)('library: the still-open played track is now playing (end_time = -1)', async () => {
    const db = makeLibrary(
      "INSERT INTO history_entry (name, artist, start_time, end_time, played, deck) VALUES " +
      "('Dior - Lincoln Baio Remix', 'Pop Smoke', 1000, 1300, 1, '1')," +
      "('All N My Grill (Clean)', 'Missy Elliott', 1300, -1, 1, '1');"
    );
    const now = await readSeratoLibraryNowPlaying(db);
    expect(now).toMatchObject({ matched: true, title: 'All N My Grill (Clean)', artist: 'Missy Elliott', source: 'library' });
  });

  it.skipIf(!hasSqlite)('library: a cued-but-unplayed track on the other deck does not steal now-playing', async () => {
    const db = makeLibrary(
      "INSERT INTO history_entry (name, artist, start_time, end_time, played, deck) VALUES " +
      "('Playing now', 'A', 1000, -1, 1, '1')," +
      "('Cued next', 'B', 1100, -1, 0, '2');"
    );
    expect((await readSeratoLibraryNowPlaying(db))?.title).toBe('Playing now');
  });

  it.skipIf(!hasSqlite)('library: newest open track wins during a two-deck blend', async () => {
    const db = makeLibrary(
      "INSERT INTO history_entry (name, artist, start_time, end_time, played, deck) VALUES " +
      "('Outgoing', 'A', 1000, -1, 1, '1')," +
      "('Incoming', 'B', 1200, -1, 1, '2');"
    );
    expect((await readSeratoLibraryNowPlaying(db))?.title).toBe('Incoming');
  });

  it('library: missing database returns null so the session fallback runs', async () => {
    expect(await readSeratoLibraryNowPlaying('/nonexistent/master.sqlite')).toBeNull();
  });
});

describe('Serato liveness (who owns song detection)', () => {
  it('is live only while Serato runs and the current track started recently', async () => {
    const { isSeratoResultLive, SERATO_STALE_TRACK_MS } = await import('../src/main/seratoNowPlaying');
    const now = 2_000_000_000_000;
    const startedSec = (agoMs: number) => Math.floor((now - agoMs) / 1000);
    expect(isSeratoResultLive({ matched: true, startedAt: startedSec(60_000) }, true, now)).toBe(true);
    // Serato quit: its history still shows the last track as open → NOT live
    expect(isSeratoResultLive({ matched: true, startedAt: startedSec(60_000) }, false, now)).toBe(false);
    // Running but idle for longer than any track → NOT live (mic takes over)
    expect(isSeratoResultLive({ matched: true, startedAt: startedSec(SERATO_STALE_TRACK_MS + 1000) }, true, now)).toBe(false);
    expect(isSeratoResultLive({ matched: false }, true, now)).toBe(false);
    // Still loaded on a deck (replayed without reloading → no new history
    // entry): live however old, while Serato runs; not live once it quits.
    expect(isSeratoResultLive({ matched: true, open: true, startedAt: startedSec(SERATO_STALE_TRACK_MS * 3) }, true, now)).toBe(true);
    expect(isSeratoResultLive({ matched: true, open: true, startedAt: startedSec(SERATO_STALE_TRACK_MS * 3) }, false, now)).toBe(false);
  });
});
