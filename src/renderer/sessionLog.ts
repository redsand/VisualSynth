/**
 * Renderer-side session log client.
 *
 * - Batches info/warn entries and flushes every 500 ms (or on explicit flush())
 * - Flushes error entries immediately (no batching)
 * - Rate-limits repeat events per cooldown map
 * - Maintains an in-memory ring buffer of the last 100 entries
 * - Never blocks the render loop — all IPC sends are fire-and-forget
 */

export interface SessionLogEntry {
  ts: number;
  session: string;
  level: 'info' | 'warn' | 'error';
  event: string;
  data: Record<string, unknown>;
}

export interface SessionLogClient {
  log(
    level: 'info' | 'warn' | 'error',
    event: string,
    data: Record<string, unknown>
  ): void;
  flush(): void;
  getRecentEntries(): SessionLogEntry[];
  captureFailureSnapshot(context: Record<string, unknown>): void;
}

interface SessionLogClientOptions {
  sessionId: string;
  writeSessionLog: (entry: SessionLogEntry) => void;
  writeFailureSnapshot?: (snapshot: Record<string, unknown>) => void;
  performanceMode?: boolean;
  batchIntervalMs?: number;
}

// ---------------------------------------------------------------------------
// Rate-limit cooldowns (ms) per event type
// ---------------------------------------------------------------------------
const RATE_LIMIT_MS: Partial<Record<string, number>> = {
  'perf.fps_drop': 5000,
  'perf.watchdog_alert': 5000,
  'output.blank_detected': 2000,
  'output.message_stale': 3000,
  'perf.frame_drop_score_alert': 5000,
};

const RING_BUFFER_SIZE = 100;

// ---------------------------------------------------------------------------
// Payload sanitisation
// ---------------------------------------------------------------------------
const sanitizeValue = (value: unknown): unknown => {
  if (typeof value === 'string' && value.length > 2048) {
    return value.slice(0, 2048) + '...<truncated>';
  }
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const nested: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      nested[k] = sanitizeValue(v);
    }
    return nested;
  }
  return value;
};

export const sanitizePayload = (
  data: Record<string, unknown>
): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    result[key] = sanitizeValue(value);
  }
  const serialized = JSON.stringify(result);
  if (serialized.length > 8192) {
    return { _truncated: true, _originalSize: serialized.length };
  }
  return result;
};

// ---------------------------------------------------------------------------
// Factory — testable, no global state
// ---------------------------------------------------------------------------
export const createSessionLogClient = (
  options: SessionLogClientOptions
): SessionLogClient => {
  const {
    sessionId,
    writeSessionLog,
    writeFailureSnapshot,
    performanceMode = false,
    batchIntervalMs = 500,
  } = options;

  const pending: SessionLogEntry[] = [];
  const ring: SessionLogEntry[] = [];
  const rateLimitAt = new Map<string, number>();
  let batchTimer: ReturnType<typeof setTimeout> | null = null;

  const addToRing = (entry: SessionLogEntry): void => {
    if (ring.length >= RING_BUFFER_SIZE) ring.shift();
    ring.push(entry);
  };

  const sendEntry = (entry: SessionLogEntry): void => {
    writeSessionLog(entry);
    addToRing(entry);
  };

  const flush = (): void => {
    if (batchTimer !== null) {
      clearTimeout(batchTimer);
      batchTimer = null;
    }
    if (pending.length === 0) return;
    const toSend = pending.splice(0);
    for (const entry of toSend) {
      sendEntry(entry);
    }
  };

  const scheduleBatch = (): void => {
    if (batchTimer !== null) return;
    batchTimer = setTimeout(flush, batchIntervalMs);
  };

  const log = (
    level: 'info' | 'warn' | 'error',
    event: string,
    data: Record<string, unknown>
  ): void => {
    // Performance mode gates info events
    if (performanceMode && level === 'info') return;

    // Error events are never rate-limited
    if (level !== 'error') {
      const cooldown = RATE_LIMIT_MS[event];
      if (cooldown !== undefined) {
        const last = rateLimitAt.get(event) ?? 0;
        const now = Date.now();
        if (now - last < cooldown) return;
        rateLimitAt.set(event, now);
      }
    }

    const entry: SessionLogEntry = {
      ts: Date.now(),
      session: sessionId,
      level,
      event,
      data: sanitizePayload(data),
    };

    if (level === 'error') {
      // Errors flush immediately
      sendEntry(entry);
    } else {
      pending.push(entry);
      scheduleBatch();
    }
  };

  const getRecentEntries = (): SessionLogEntry[] => [...ring];

  const captureFailureSnapshot = (context: Record<string, unknown>): void => {
    if (!writeFailureSnapshot) return;
    writeFailureSnapshot({
      ts: Date.now(),
      session: sessionId,
      recentEntries: getRecentEntries(),
      ...context,
    });
  };

  return { log, flush, getRecentEntries, captureFailureSnapshot };
};

// ---------------------------------------------------------------------------
// Module-level singleton used by the renderer
// ---------------------------------------------------------------------------
let _client: SessionLogClient | null = null;

export const initSessionLog = (
  sessionId: string,
  performanceMode = false
): void => {
  const writeSessionLog = (entry: SessionLogEntry): void => {
    (window as any).visualSynth?.writeSessionLog?.(entry);
  };
  const writeFailureSnapshot = (snapshot: Record<string, unknown>): void => {
    (window as any).visualSynth?.writeFailureSnapshot?.(snapshot);
  };
  _client = createSessionLogClient({ sessionId, writeSessionLog, writeFailureSnapshot, performanceMode });
};

export const sessionLog = {
  log: (
    level: 'info' | 'warn' | 'error',
    event: string,
    data: Record<string, unknown> = {}
  ): void => _client?.log(level, event, data),

  flush: (): void => _client?.flush(),

  getRecentEntries: (): SessionLogEntry[] =>
    _client?.getRecentEntries() ?? [],

  captureFailureSnapshot: (context: Record<string, unknown> = {}): void =>
    _client?.captureFailureSnapshot(context),
};
