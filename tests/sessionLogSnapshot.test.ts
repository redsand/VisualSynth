/**
 * Phase 3: Failure snapshot tests.
 *
 * Verifies that captureFailureSnapshot() bundles the ring buffer entries,
 * context metadata, and forwards the snapshot to writeFailureSnapshot.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import {
  createSessionLogClient,
  type SessionLogEntry,
  type SessionLogClient,
} from '../src/renderer/sessionLog';

let written: SessionLogEntry[];
let snapshots: object[];
let client: SessionLogClient;

beforeEach(() => {
  written = [];
  snapshots = [];
  client = createSessionLogClient({
    sessionId: 'snap-test',
    writeSessionLog: (e) => written.push(e),
    writeFailureSnapshot: (s) => snapshots.push(s),
    performanceMode: false,
  });
});

// ---------------------------------------------------------------------------
// captureFailureSnapshot — basic structure
// ---------------------------------------------------------------------------
describe('captureFailureSnapshot', () => {
  it('calls writeFailureSnapshot with a snapshot object', () => {
    client.log('error', 'output.context_lost', { frameCount: 100 });
    client.captureFailureSnapshot({ reason: 'context_lost' });
    expect(snapshots.length).toBe(1);
  });

  it('snapshot includes session id', () => {
    client.captureFailureSnapshot({ reason: 'test' });
    const snap = snapshots[0] as Record<string, unknown>;
    expect(snap.session).toBe('snap-test');
  });

  it('snapshot includes a ts timestamp', () => {
    client.captureFailureSnapshot({ reason: 'test' });
    const snap = snapshots[0] as Record<string, unknown>;
    expect(typeof snap.ts).toBe('number');
    expect(snap.ts as number).toBeGreaterThan(0);
  });

  it('snapshot includes reason from context', () => {
    client.captureFailureSnapshot({ reason: 'blank_output' });
    const snap = snapshots[0] as Record<string, unknown>;
    expect(snap.reason).toBe('blank_output');
  });

  it('snapshot includes recentEntries array', () => {
    client.log('error', 'output.fallback_triggered', { blankDurationMs: 9000, activeGenerators: [] });
    client.captureFailureSnapshot({ reason: 'fallback' });
    const snap = snapshots[0] as Record<string, unknown>;
    expect(Array.isArray(snap.recentEntries)).toBe(true);
  });

  it('recentEntries contains previously flushed errors', () => {
    client.log('error', 'output.context_lost', { frameCount: 50 });
    client.captureFailureSnapshot({ reason: 'context_lost' });
    const snap = snapshots[0] as Record<string, unknown>;
    const entries = snap.recentEntries as SessionLogEntry[];
    expect(entries.some((e) => e.event === 'output.context_lost')).toBe(true);
  });

  it('recentEntries contains batched info entries after explicit flush', () => {
    client.log('info', 'scene.switch', { fromSceneId: 's1', fromSceneName: 'A', toSceneId: 's2', toSceneName: 'B', source: 'manual' });
    client.flush();
    client.captureFailureSnapshot({ reason: 'test' });
    const snap = snapshots[0] as Record<string, unknown>;
    const entries = snap.recentEntries as SessionLogEntry[];
    expect(entries.some((e) => e.event === 'scene.switch')).toBe(true);
  });

  it('snapshot can carry arbitrary context fields', () => {
    client.captureFailureSnapshot({ reason: 'test', activeGenerators: ['gen-boids'], fps: 12 });
    const snap = snapshots[0] as Record<string, unknown>;
    expect(snap.activeGenerators).toEqual(['gen-boids']);
    expect(snap.fps).toBe(12);
  });
});

// ---------------------------------------------------------------------------
// Multiple snapshots are independent
// ---------------------------------------------------------------------------
describe('multiple snapshots', () => {
  it('each snapshot call produces a separate snapshot', () => {
    client.captureFailureSnapshot({ reason: 'first' });
    client.captureFailureSnapshot({ reason: 'second' });
    expect(snapshots.length).toBe(2);
    expect((snapshots[0] as Record<string, unknown>).reason).toBe('first');
    expect((snapshots[1] as Record<string, unknown>).reason).toBe('second');
  });

  it('later snapshot includes entries logged between calls', () => {
    client.captureFailureSnapshot({ reason: 'before' });
    client.log('error', 'output.fallback_triggered', { blankDurationMs: 10000, activeGenerators: [] });
    client.captureFailureSnapshot({ reason: 'after' });

    const before = (snapshots[0] as Record<string, unknown>).recentEntries as SessionLogEntry[];
    const after = (snapshots[1] as Record<string, unknown>).recentEntries as SessionLogEntry[];
    expect(before.some((e) => e.event === 'output.fallback_triggered')).toBe(false);
    expect(after.some((e) => e.event === 'output.fallback_triggered')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// writeFailureSnapshot not provided — no throw
// ---------------------------------------------------------------------------
describe('graceful no-op when writeFailureSnapshot not configured', () => {
  it('does not throw when writeFailureSnapshot is omitted', () => {
    const clientNoSnap = createSessionLogClient({
      sessionId: 'no-snap',
      writeSessionLog: () => {},
      performanceMode: false,
    });
    expect(() => clientNoSnap.captureFailureSnapshot({ reason: 'test' })).not.toThrow();
  });
});
