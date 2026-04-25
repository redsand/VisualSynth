import { describe, expect, it, beforeEach, vi } from 'vitest';

// sessionLog.ts is a renderer-side module. It calls
// window.visualSynth.writeSessionLog via IPC (fire-and-forget).  We stub that
// surface so we can test in a Node environment.

import {
  createSessionLogClient,
  type SessionLogEntry,
  type SessionLogClient,
} from '../src/renderer/sessionLog';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const makeClient = (overrides?: { performanceMode?: boolean }): {
  client: SessionLogClient;
  written: SessionLogEntry[];
  flush: () => void;
} => {
  const written: SessionLogEntry[] = [];
  const writeSessionLog = (entry: SessionLogEntry) => written.push(entry);
  const client = createSessionLogClient({
    sessionId: 'test-session-001',
    writeSessionLog,
    performanceMode: overrides?.performanceMode ?? false,
  });
  return { client, written, flush: () => client.flush() };
};

// ---------------------------------------------------------------------------
// Basic logging
// ---------------------------------------------------------------------------
describe('sessionLog — basic logging', () => {
  it('writes an error entry immediately (no batching)', () => {
    const { client, written } = makeClient();
    client.log('error', 'preset.load_failure', { path: 'x.json', error: 'boom' });
    expect(written.length).toBe(1);
    expect(written[0].level).toBe('error');
    expect(written[0].event).toBe('preset.load_failure');
  });

  it('flushes info entries on explicit flush()', () => {
    const { client, written, flush } = makeClient();
    client.log('info', 'scene.switch', { toSceneId: 'scene-2' });
    expect(written.length).toBe(0); // not yet flushed
    flush();
    expect(written.length).toBe(1);
    expect(written[0].event).toBe('scene.switch');
  });

  it('flushes warn entries on explicit flush()', () => {
    const { client, written, flush } = makeClient();
    client.log('warn', 'perf.watchdog_alert', { frameDropScore: 0.5 });
    flush();
    expect(written.length).toBe(1);
    expect(written[0].level).toBe('warn');
  });

  it('attaches session ID to every entry', () => {
    const { client, written, flush } = makeClient();
    client.log('info', 'session.start', {});
    flush();
    expect(written[0].session).toBe('test-session-001');
  });

  it('attaches a ts timestamp to every entry', () => {
    const { client, written } = makeClient();
    const before = Date.now();
    client.log('error', 'error.unhandled', { message: 'oops' });
    const after = Date.now();
    expect(written[0].ts).toBeGreaterThanOrEqual(before);
    expect(written[0].ts).toBeLessThanOrEqual(after);
  });
});

// ---------------------------------------------------------------------------
// Performance mode gating
// ---------------------------------------------------------------------------
describe('sessionLog — performance mode', () => {
  it('drops info events when performanceMode is true', () => {
    const { client, written, flush } = makeClient({ performanceMode: true });
    client.log('info', 'scene.switch', { toSceneId: 'scene-3' });
    flush();
    expect(written.length).toBe(0);
  });

  it('still writes warn events in performance mode', () => {
    const { client, written, flush } = makeClient({ performanceMode: true });
    client.log('warn', 'perf.fps_drop', { fps: 20 });
    flush();
    expect(written.length).toBe(1);
  });

  it('still writes error events in performance mode', () => {
    const { client, written } = makeClient({ performanceMode: true });
    client.log('error', 'output.fallback_triggered', { blankDurationMs: 8000 });
    expect(written.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------
describe('sessionLog — rate limiting', () => {
  it('suppresses duplicate rate-limited events within cooldown window', () => {
    const { client, written, flush } = makeClient();
    client.log('warn', 'perf.fps_drop', { fps: 20 });
    client.log('warn', 'perf.fps_drop', { fps: 18 }); // within cooldown
    client.log('warn', 'perf.fps_drop', { fps: 15 }); // within cooldown
    flush();
    expect(written.length).toBe(1);
  });

  it('allows a rate-limited event after cooldown has expired', () => {
    vi.useFakeTimers();
    const { client, written, flush } = makeClient();
    client.log('warn', 'perf.fps_drop', { fps: 20 });
    vi.advanceTimersByTime(6000); // past the 5s cooldown
    client.log('warn', 'perf.fps_drop', { fps: 18 });
    flush();
    vi.useRealTimers();
    expect(written.length).toBe(2);
  });

  it('does not rate-limit error events', () => {
    const { client, written } = makeClient();
    client.log('error', 'preset.load_failure', { path: 'a.json' });
    client.log('error', 'preset.load_failure', { path: 'b.json' });
    expect(written.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Ring buffer
// ---------------------------------------------------------------------------
describe('sessionLog — ring buffer', () => {
  it('getRecentEntries returns entries after flush', () => {
    const { client, flush } = makeClient();
    client.log('info', 'scene.switch', { toSceneId: 's1' });
    client.log('error', 'preset.load_failure', { path: 'x' });
    flush();
    const recent = client.getRecentEntries();
    expect(recent.length).toBeGreaterThanOrEqual(2);
  });

  it('caps ring buffer at 100 entries', () => {
    const { client, flush } = makeClient();
    // errors bypass batch, so this fills the ring buffer directly
    for (let i = 0; i < 120; i++) {
      client.log('error', 'error.unhandled', { i });
    }
    const recent = client.getRecentEntries();
    expect(recent.length).toBeLessThanOrEqual(100);
  });

  it('returns entries in chronological order', () => {
    const { client, flush } = makeClient();
    client.log('error', 'preset.load_failure', { path: 'first' });
    client.log('error', 'output.fallback_triggered', { blankDurationMs: 1 });
    const recent = client.getRecentEntries();
    expect(recent[0].event).toBe('preset.load_failure');
    expect(recent[1].event).toBe('output.fallback_triggered');
  });
});

// ---------------------------------------------------------------------------
// Payload sanitisation (via log path)
// ---------------------------------------------------------------------------
describe('sessionLog — payload sanitisation', () => {
  it('truncates long string fields before writing', () => {
    const { client, written } = makeClient();
    const longStr = 'z'.repeat(5000);
    client.log('error', 'error.unhandled', { message: longStr });
    const payload = written[0].data as Record<string, string>;
    expect(payload.message.length).toBeLessThan(5000);
  });
});

// ---------------------------------------------------------------------------
// flush clears pending batch
// ---------------------------------------------------------------------------
describe('sessionLog — flush behaviour', () => {
  it('calling flush twice does not double-write', () => {
    const { client, written, flush } = makeClient();
    client.log('info', 'session.start', {});
    flush();
    flush();
    expect(written.filter((e) => e.event === 'session.start').length).toBe(1);
  });

  it('flush is a no-op when batch is empty', () => {
    const { client, written, flush } = makeClient();
    expect(() => flush()).not.toThrow();
    expect(written.length).toBe(0);
  });
});
