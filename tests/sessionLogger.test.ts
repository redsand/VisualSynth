import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// We test the pure logic extracted from sessionLogger — file I/O is tested
// against a real temp directory so we exercise actual disk behaviour.

import {
  createSessionId,
  formatLogEntry,
  sanitizePayload,
  resolveLogPath,
  pruneOldSessions,
  SESSION_MAX_FILES,
  SESSION_MAX_BYTES,
} from '../src/main/sessionLogger';

// ---------------------------------------------------------------------------
// createSessionId
// ---------------------------------------------------------------------------
describe('createSessionId', () => {
  it('returns a non-empty string', () => {
    expect(typeof createSessionId()).toBe('string');
    expect(createSessionId().length).toBeGreaterThan(0);
  });

  it('includes a 5-char hex suffix', () => {
    const id = createSessionId();
    const suffix = id.split('-').pop()!;
    expect(suffix).toMatch(/^[0-9a-f]{5}$/);
  });

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 20 }, () => createSessionId()));
    expect(ids.size).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// formatLogEntry
// ---------------------------------------------------------------------------
describe('formatLogEntry', () => {
  it('serialises to valid JSON followed by newline', () => {
    const line = formatLogEntry({
      ts: 1000,
      session: 'test-session',
      level: 'info',
      event: 'session.start',
      data: { appVersion: '1.0.0' },
    });
    expect(line.endsWith('\n')).toBe(true);
    const parsed = JSON.parse(line.trimEnd());
    expect(parsed.ts).toBe(1000);
    expect(parsed.event).toBe('session.start');
  });

  it('does not throw on circular-free payloads', () => {
    expect(() =>
      formatLogEntry({ ts: 1, session: 's', level: 'warn', event: 'x', data: { a: 1 } })
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// sanitizePayload
// ---------------------------------------------------------------------------
describe('sanitizePayload', () => {
  it('truncates strings longer than 2048 chars', () => {
    const long = 'x'.repeat(3000);
    const result = sanitizePayload({ msg: long });
    expect((result.msg as string).length).toBeLessThanOrEqual(2048 + 15); // +15 for truncation marker
    expect(result.msg as string).toContain('...<truncated>');
  });

  it('leaves short strings untouched', () => {
    const result = sanitizePayload({ msg: 'hello' });
    expect(result.msg).toBe('hello');
  });

  it('returns a truncation notice when total payload exceeds 8 KB', () => {
    const big = 'y'.repeat(9000);
    const result = sanitizePayload({ a: big });
    // Either the string was truncated before reaching 8 KB, or the whole payload
    // was replaced with the size notice.
    const serialized = JSON.stringify(result);
    expect(serialized.length).toBeLessThanOrEqual(8192 + 200);
  });

  it('handles nested objects one level deep', () => {
    const result = sanitizePayload({ outer: { inner: 'z'.repeat(3000) } });
    expect(JSON.stringify(result).length).toBeLessThan(9000);
  });

  it('passes numbers and booleans through unchanged', () => {
    const result = sanitizePayload({ n: 42, b: true });
    expect(result.n).toBe(42);
    expect(result.b).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// resolveLogPath
// ---------------------------------------------------------------------------
describe('resolveLogPath', () => {
  it('places log inside userData/logs/', () => {
    const p = resolveLogPath('/tmp/vs-test', 'session-abc');
    expect(p).toContain('logs');
    expect(p).toContain('session-abc');
    expect(p.endsWith('.jsonl')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// pruneOldSessions
// ---------------------------------------------------------------------------
describe('pruneOldSessions', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-prune-'));
    const logsDir = path.join(tmpDir, 'logs');
    fs.mkdirSync(logsDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('does not delete files when count is within limit', () => {
    const logsDir = path.join(tmpDir, 'logs');
    for (let i = 0; i < SESSION_MAX_FILES - 1; i++) {
      fs.writeFileSync(path.join(logsDir, `session-00${i}.jsonl`), '');
    }
    pruneOldSessions(tmpDir);
    const remaining = fs.readdirSync(logsDir).filter((f) => f.endsWith('.jsonl'));
    expect(remaining.length).toBe(SESSION_MAX_FILES - 1);
  });

  it('removes oldest files when count exceeds SESSION_MAX_FILES', () => {
    const logsDir = path.join(tmpDir, 'logs');
    const count = SESSION_MAX_FILES + 3;
    for (let i = 0; i < count; i++) {
      const file = path.join(logsDir, `session-${String(i).padStart(3, '0')}.jsonl`);
      fs.writeFileSync(file, '');
      // stagger mtimes so sort order is deterministic
      const t = new Date(Date.now() - (count - i) * 1000);
      fs.utimesSync(file, t, t);
    }
    pruneOldSessions(tmpDir);
    const remaining = fs.readdirSync(logsDir).filter((f) => f.endsWith('.jsonl'));
    expect(remaining.length).toBe(SESSION_MAX_FILES);
  });
});

// ---------------------------------------------------------------------------
// SESSION_MAX_FILES / SESSION_MAX_BYTES constants are sensible
// ---------------------------------------------------------------------------
describe('constants', () => {
  it('SESSION_MAX_FILES is between 5 and 30', () => {
    expect(SESSION_MAX_FILES).toBeGreaterThanOrEqual(5);
    expect(SESSION_MAX_FILES).toBeLessThanOrEqual(30);
  });

  it('SESSION_MAX_BYTES is at least 10 MB', () => {
    expect(SESSION_MAX_BYTES).toBeGreaterThanOrEqual(10 * 1024 * 1024);
  });
});
