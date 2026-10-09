import * as fs from 'fs';
import * as path from 'path';

export const SESSION_MAX_FILES = 10;
export const SESSION_MAX_BYTES = 20 * 1024 * 1024; // 20 MB

export interface SessionLogEntry {
  ts: number;
  session: string;
  level: 'info' | 'warn' | 'error';
  event: string;
  data: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Session ID
// ---------------------------------------------------------------------------
export const createSessionId = (): string => {
  const now = new Date().toISOString().replace(/[:.]/g, '-').replace('Z', 'Z');
  const hex = Math.floor(Math.random() * 0xfffff)
    .toString(16)
    .padStart(5, '0');
  return `${now}-${hex}`;
};

// ---------------------------------------------------------------------------
// Serialisation
// ---------------------------------------------------------------------------
export const formatLogEntry = (entry: SessionLogEntry): string =>
  JSON.stringify(entry) + '\n';

// ---------------------------------------------------------------------------
// Payload sanitisation
// ---------------------------------------------------------------------------
export const sanitizePayload = (
  data: Record<string, unknown>
): Record<string, unknown> => {
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
// Path helpers
// ---------------------------------------------------------------------------
export const resolveLogPath = (userData: string, sessionId: string): string =>
  path.join(userData, 'logs', `session-${sessionId}.jsonl`);

export const pruneOldSessions = (userData: string): void => {
  const logsDir = path.join(userData, 'logs');
  if (!fs.existsSync(logsDir)) return;

  const files = fs
    .readdirSync(logsDir)
    .filter((f) => f.endsWith('.jsonl'))
    .map((f) => ({
      name: f,
      full: path.join(logsDir, f),
      mtime: fs.statSync(path.join(logsDir, f)).mtime.getTime(),
    }))
    .sort((a, b) => b.mtime - a.mtime); // newest first

  const toDelete = files.slice(SESSION_MAX_FILES);
  for (const file of toDelete) {
    try {
      fs.unlinkSync(file.full);
    } catch {
      // best-effort
    }
  }
};

// ---------------------------------------------------------------------------
// SessionLogger class
// ---------------------------------------------------------------------------
class SessionLogger {
  private sessionId: string;
  private userData: string;
  private logPath: string;
  private stream: fs.WriteStream | null = null;
  private bytesWritten = 0;
  private partIndex = 1;

  constructor(userData: string) {
    this.sessionId = createSessionId();
    this.userData = userData;
    const logsDir = path.join(userData, 'logs');
    fs.mkdirSync(logsDir, { recursive: true });
    pruneOldSessions(userData);
    this.logPath = resolveLogPath(userData, this.sessionId);
    this.stream = fs.createWriteStream(this.logPath, {
      flags: 'a',
      encoding: 'utf-8',
    });
  }

  getSessionId(): string {
    return this.sessionId;
  }

  writeEntry(
    entry: Omit<SessionLogEntry, 'ts' | 'session'> & {
      ts?: number;
      session?: string;
    }
  ): void {
    if (!this.stream || this.stream.destroyed) return;

    const full: SessionLogEntry = {
      ts: entry.ts ?? Date.now(),
      session: entry.session ?? this.sessionId,
      level: entry.level,
      event: entry.event,
      data: sanitizePayload(entry.data ?? {}),
    };

    const line = formatLogEntry(full);
    try {
      this.stream.write(line);
      this.bytesWritten += line.length;
      if (this.bytesWritten >= SESSION_MAX_BYTES) {
        this.rollover();
      }
    } catch {
      // never crash the app due to logging
    }
  }

  writeFailureSnapshot(snapshot: Record<string, unknown>): void {
    this.writeEntry({ level: 'error', event: 'failure.snapshot', data: snapshot });
  }

  private rollover(): void {
    this.stream?.end();
    this.partIndex++;
    const rolledPath = this.logPath.replace(
      '.jsonl',
      `_part${this.partIndex}.jsonl`
    );
    this.stream = fs.createWriteStream(rolledPath, {
      flags: 'a',
      encoding: 'utf-8',
    });
    this.bytesWritten = 0;
    // pruneOldSessions only ran at construction, so rollover-created part
    // files (_part2, _part3, …) accumulated without bound for the lifetime of
    // a long session. Re-prune after each rollover so the SESSION_MAX_FILES
    // cap is enforced continuously, not just at startup. Cheap: rollover
    // fires only every SESSION_MAX_BYTES (20 MB) of log output.
    try {
      pruneOldSessions(this.userData);
    } catch {
      // best-effort — never crash the app due to log pruning
    }
  }

  async flushAndClose(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.stream || this.stream.destroyed) {
        resolve();
        return;
      }
      this.stream.end(resolve);
    });
  }
}

// ---------------------------------------------------------------------------
// Module-level singleton — initialised by initSessionLogger()
// ---------------------------------------------------------------------------
let _logger: SessionLogger | null = null;

export const initSessionLogger = (userData: string): void => {
  _logger = new SessionLogger(userData);
};

export const sessionLogger = {
  getSessionId: (): string => _logger?.getSessionId() ?? 'uninitialised',
  writeEntry: (
    entry: Omit<SessionLogEntry, 'ts' | 'session'> & {
      ts?: number;
      session?: string;
    }
  ): void => _logger?.writeEntry(entry),
  writeFailureSnapshot: (snapshot: Record<string, unknown>): void =>
    _logger?.writeFailureSnapshot(snapshot),
  flushAndClose: (): Promise<void> => _logger?.flushAndClose() ?? Promise.resolve(),
};
