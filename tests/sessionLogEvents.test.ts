/**
 * Phase 2: Event taxonomy contract tests.
 *
 * These tests verify that the event helpers exported from sessionLog produce
 * entries with the correct event name and required data fields.  They do NOT
 * test side-effects in index.ts / output.ts — those are integration concerns.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import {
  createSessionLogClient,
  type SessionLogEntry,
  type SessionLogClient,
} from '../src/renderer/sessionLog';

// ---------------------------------------------------------------------------
// Helper — creates a client that captures everything synchronously
// ---------------------------------------------------------------------------
let written: SessionLogEntry[];
let client: SessionLogClient;

beforeEach(() => {
  written = [];
  client = createSessionLogClient({
    sessionId: 'evt-test',
    writeSessionLog: (e) => written.push(e),
    performanceMode: false,
  });
});

const lastEntry = () => written[written.length - 1];

// ---------------------------------------------------------------------------
// Preset events
// ---------------------------------------------------------------------------
describe('preset events', () => {
  it('preset.trigger has path, traceId and reason', () => {
    client.log('info', 'preset.trigger', {
      path: 'assets/presets/acid-rain.json',
      traceId: 'abc-123',
      reason: 'Live Trigger',
    });
    client.flush();
    expect(lastEntry().event).toBe('preset.trigger');
    const d = lastEntry().data as Record<string, unknown>;
    expect(d.path).toBe('assets/presets/acid-rain.json');
    expect(d.traceId).toBe('abc-123');
    expect(d.reason).toBe('Live Trigger');
  });

  it('preset.load_failure is level error and has path + error', () => {
    client.log('error', 'preset.load_failure', {
      path: 'assets/presets/bad.json',
      traceId: 'xyz',
      error: 'File not found',
    });
    expect(lastEntry().level).toBe('error');
    expect(lastEntry().event).toBe('preset.load_failure');
    const d = lastEntry().data as Record<string, unknown>;
    expect(d.error).toBe('File not found');
  });

  it('preset.migration_failed is level error and contains errors array', () => {
    client.log('error', 'preset.migration_failed', {
      path: 'x.json',
      traceId: 't1',
      errors: ['Unknown field', 'Bad version'],
    });
    expect(lastEntry().level).toBe('error');
    const d = lastEntry().data as Record<string, unknown>;
    expect(Array.isArray(d.errors)).toBe(true);
    expect((d.errors as string[]).length).toBe(2);
  });

  it('preset.validation_failed is level error', () => {
    client.log('error', 'preset.validation_failed', {
      path: 'x.json',
      traceId: 't2',
      errors: ['Missing scenes'],
    });
    expect(lastEntry().level).toBe('error');
    expect(lastEntry().event).toBe('preset.validation_failed');
  });

  it('preset.safe_visuals_fallback is level error with reason', () => {
    client.log('error', 'preset.safe_visuals_fallback', {
      traceId: 't3',
      reason: 'Preset migration failed',
      hadValidProject: true,
    });
    expect(lastEntry().level).toBe('error');
    expect(lastEntry().event).toBe('preset.safe_visuals_fallback');
    const d = lastEntry().data as Record<string, unknown>;
    expect(d.reason).toBe('Preset migration failed');
  });
});

// ---------------------------------------------------------------------------
// Scene events
// ---------------------------------------------------------------------------
describe('scene events', () => {
  it('scene.switch has fromSceneId, toSceneId and source', () => {
    client.log('info', 'scene.switch', {
      fromSceneId: 'scene-1',
      fromSceneName: 'Acid Rain',
      toSceneId: 'scene-2',
      toSceneName: 'Crystal Wave',
      source: 'manual',
    });
    client.flush();
    expect(lastEntry().event).toBe('scene.switch');
    const d = lastEntry().data as Record<string, unknown>;
    expect(d.fromSceneId).toBe('scene-1');
    expect(d.toSceneId).toBe('scene-2');
    expect(d.source).toBe('manual');
  });
});

// ---------------------------------------------------------------------------
// Performance events
// ---------------------------------------------------------------------------
describe('performance events', () => {
  it('perf.fps_drop is level warn with fps and frameDropScore', () => {
    client.log('warn', 'perf.fps_drop', { fps: 18, frameDropScore: 0.6, threshold: 45, severity: 'critical' });
    client.flush();
    expect(lastEntry().level).toBe('warn');
    expect(lastEntry().event).toBe('perf.fps_drop');
    const d = lastEntry().data as Record<string, unknown>;
    expect(typeof d.fps).toBe('number');
    expect(typeof d.frameDropScore).toBe('number');
  });

  it('perf.watchdog_alert is level warn', () => {
    client.log('warn', 'perf.watchdog_alert', { frameDropScore: 0.72, fps: 22 });
    client.flush();
    expect(lastEntry().level).toBe('warn');
    expect(lastEntry().event).toBe('perf.watchdog_alert');
  });
});

// ---------------------------------------------------------------------------
// Output window events
// ---------------------------------------------------------------------------
describe('output events', () => {
  it('output.blank_detected is level warn with blankDurationMs', () => {
    client.log('warn', 'output.blank_detected', {
      classification: 'black',
      avgBrightness: 0.001,
      nonBlackPercent: 0.2,
      blankDurationMs: 1500,
    });
    client.flush();
    expect(lastEntry().level).toBe('warn');
    expect(lastEntry().event).toBe('output.blank_detected');
    const d = lastEntry().data as Record<string, unknown>;
    expect(typeof d.blankDurationMs).toBe('number');
  });

  it('output.fallback_triggered is level error', () => {
    client.log('error', 'output.fallback_triggered', {
      blankDurationMs: 8000,
      activeGenerators: ['gen-boids'],
    });
    expect(lastEntry().level).toBe('error');
    expect(lastEntry().event).toBe('output.fallback_triggered');
  });

  it('output.context_lost is level error', () => {
    client.log('error', 'output.context_lost', { frameCount: 1200 });
    expect(lastEntry().level).toBe('error');
    expect(lastEntry().event).toBe('output.context_lost');
  });

  it('output.shader_compile_failed is level error', () => {
    client.log('error', 'output.shader_compile_failed', { detail: 'syntax error on line 12' });
    expect(lastEntry().level).toBe('error');
  });

  it('output.message_stale is level warn and rate-limited', () => {
    client.log('warn', 'output.message_stale', { ageMs: 200 });
    client.log('warn', 'output.message_stale', { ageMs: 400 }); // within cooldown
    client.flush();
    const stale = written.filter((e) => e.event === 'output.message_stale');
    expect(stale.length).toBe(1); // second suppressed by rate limit
  });
});

// ---------------------------------------------------------------------------
// Audio events
// ---------------------------------------------------------------------------
describe('audio events', () => {
  it('audio.engine_init is level info with deviceId', () => {
    client.log('info', 'audio.engine_init', { deviceId: 'default', deviceLabel: 'Built-in Mic' });
    client.flush();
    expect(lastEntry().event).toBe('audio.engine_init');
    expect(lastEntry().level).toBe('info');
  });

  it('audio.engine_failure is level error', () => {
    client.log('error', 'audio.engine_failure', { error: 'No device' });
    expect(lastEntry().level).toBe('error');
  });

  it('audio.bpm_changed carries bpm, source, prevBpm', () => {
    client.log('info', 'audio.bpm_changed', { bpm: 140, source: 'auto', prevBpm: 120 });
    client.flush();
    const d = lastEntry().data as Record<string, unknown>;
    expect(d.bpm).toBe(140);
    expect(d.source).toBe('auto');
    expect(d.prevBpm).toBe(120);
  });
});

// ---------------------------------------------------------------------------
// Live mode events
// ---------------------------------------------------------------------------
describe('live mode events', () => {
  it('live.preset_triggered is level info with presetPath and presetName', () => {
    client.log('info', 'live.preset_triggered', {
      presetPath: 'assets/presets/acid-rain.json',
      presetName: 'Acid Rain',
      category: 'Desert',
      traceId: 'live-001',
    });
    client.flush();
    expect(lastEntry().event).toBe('live.preset_triggered');
    const d = lastEntry().data as Record<string, unknown>;
    expect(d.presetName).toBe('Acid Rain');
  });

  it('live.playlist_started is level info', () => {
    client.log('info', 'live.playlist_started', { duration: 8, transition: 200 });
    client.flush();
    expect(lastEntry().event).toBe('live.playlist_started');
    expect(lastEntry().level).toBe('info');
  });

  it('live.playlist_stopped is level info', () => {
    client.log('info', 'live.playlist_stopped', {});
    client.flush();
    expect(lastEntry().event).toBe('live.playlist_stopped');
  });
});

// ---------------------------------------------------------------------------
// Error events
// ---------------------------------------------------------------------------
describe('error events', () => {
  it('error.unhandled is level error with message', () => {
    client.log('error', 'error.unhandled', { message: 'TypeError: x is not a function', stack: 'at ...' });
    expect(lastEntry().level).toBe('error');
    expect(lastEntry().event).toBe('error.unhandled');
  });

  it('error.shader_compile is level error with type and message', () => {
    client.log('error', 'error.shader_compile', { type: 'FRAGMENT', message: 'undeclared identifier' });
    expect(lastEntry().level).toBe('error');
    const d = lastEntry().data as Record<string, unknown>;
    expect(d.type).toBe('FRAGMENT');
  });
});
