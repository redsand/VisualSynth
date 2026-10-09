/**
 * Output window runtime diagnostics.
 *
 * Provides:
 *  - RingBuffer<T>       — fixed-capacity circular event/metric log
 *  - FrameMetrics        — per-sample pixel analysis (brightness, coverage, frozen detection)
 *  - DiagnosticEvent     — typed runtime events (shader swap, scene change, blank detected, …)
 *  - ForensicSnapshot    — full state dump captured the moment blank output is detected
 *  - OutputDiagnostics   — orchestrator: owns the buffers, drives sampling, emits snapshots
 */

// ---------------------------------------------------------------------------
// Ring buffer
// ---------------------------------------------------------------------------

export class RingBuffer<T> {
  private buf: (T | undefined)[];
  private head = 0;
  private count = 0;

  constructor(readonly capacity: number) {
    this.buf = new Array(capacity);
  }

  push(item: T): void {
    this.buf[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) this.count++;
  }

  /** Returns items in insertion order (oldest first). */
  toArray(): T[] {
    if (this.count < this.capacity) {
      return this.buf.slice(0, this.count) as T[];
    }
    const result: T[] = [];
    for (let i = 0; i < this.capacity; i++) {
      result.push(this.buf[(this.head + i) % this.capacity] as T);
    }
    return result;
  }

  get length(): number { return this.count; }
}

// ---------------------------------------------------------------------------
// Frame metrics
// ---------------------------------------------------------------------------

export type FrameClassification = 'healthy' | 'low-content' | 'blank' | 'frozen';

export interface FrameMetrics {
  frameIndex: number;
  timestamp: number;
  avgBrightness: number;    // 0–255
  alphaCoverage: number;    // 0–1 fraction of sampled pixels with alpha > 0
  nonBlackPercent: number;  // 0–1 fraction with (r|g|b) > 5
  changedFromPrevious: boolean;
  classification: FrameClassification;
}

// ---------------------------------------------------------------------------
// Diagnostic events
// ---------------------------------------------------------------------------

export type DiagnosticEventType =
  | 'generators-changed'
  | 'shader-compile-start'
  | 'shader-compile-ok'
  | 'shader-compile-failed'
  | 'shader-swapped'
  | 'asset-bound'
  | 'asset-unbound'
  | 'asset-rebound'
  | 'video-play'
  | 'video-pause'
  | 'video-error'
  | 'canvas-resize'
  | 'context-lost'
  | 'context-restored'
  | 'blank-detected'
  | 'blank-recovered'
  | 'message-received'
  | 'message-stale'
  | 'draw-call-skipped'
  | 'render-error'
  | 'program-cache-pruned'
  | 'fallback-triggered';

export interface DiagnosticEvent {
  type: DiagnosticEventType;
  timestamp: number;
  detail?: string;
}

// ---------------------------------------------------------------------------
// Forensic snapshot
// ---------------------------------------------------------------------------

export interface ForensicSnapshot {
  timestamp: number;
  frameCount: number;
  drawCallCount: number;
  blankFrameCount: number;
  blankIncidentCount: number;
  lastGoodFrameMs: number;
  activeGenerators: string[];
  canvasWidth: number;
  canvasHeight: number;
  lastMessageAgeMs: number;
  messageCount: number;
  lastShaderError: string | null;
  contextLost: boolean;
  programCacheSize: number;
  recentMetrics: FrameMetrics[];
  recentEvents: DiagnosticEvent[];
}

// ---------------------------------------------------------------------------
// OutputDiagnostics class
// ---------------------------------------------------------------------------

const SAMPLE_DIM = 16;                  // 16×16 pixel sample taken from canvas center
const SAMPLE_PERIOD_FRAMES = 60;        // sample once per this many frames (~2 s @ 30 fps)
const BLANK_FORENSIC_THROTTLE_MS = 5000; // minimum ms between forensic dumps for the same incident

export class OutputDiagnostics {
  private readonly eventBuf   = new RingBuffer<DiagnosticEvent>(256);
  private readonly metricsBuf = new RingBuffer<FrameMetrics>(60);

  // Heartbeat counters
  frameCount     = 0;
  drawCallCount  = 0;
  messageCount   = 0;

  // Blank-frame tracking
  blankFrameCount    = 0;
  blankIncidentCount = 0;
  isCurrentlyBlank   = false;
  lastGoodFrameMs    = 0;
  // Initialise well before t=0 so the first call always succeeds regardless of
  // how early in the process lifecycle it fires.
  private lastForensicDumpMs = -BLANK_FORENSIC_THROTTLE_MS;

  // Per-sample state
  private readonly sampleBuf  = new Uint8Array(SAMPLE_DIM * SAMPLE_DIM * 4);
  private          lastPixels: Uint8Array | null = null;

  // ---------------------------------------------------------------------------
  logEvent(type: DiagnosticEventType, detail?: string): void {
    this.eventBuf.push({ type, timestamp: performance.now(), detail });
  }

  // ---------------------------------------------------------------------------
  /**
   * Read a SAMPLE_DIM × SAMPLE_DIM region from the centre of the canvas and
   * classify the frame.  Uses gl.readPixels which is synchronous; call
   * sparingly (every SAMPLE_PERIOD_FRAMES frames is fine).
   */
  sampleFrame(gl: WebGL2RenderingContext, canvas: HTMLCanvasElement): FrameMetrics {
    const w = SAMPLE_DIM;
    const h = SAMPLE_DIM;

    if (canvas.width > 0 && canvas.height > 0) {
      const cx = Math.max(0, Math.floor((canvas.width  - w) / 2));
      const cy = Math.max(0, Math.floor((canvas.height - h) / 2));
      try {
        gl.readPixels(cx, cy, w, h, gl.RGBA, gl.UNSIGNED_BYTE, this.sampleBuf);
      } catch {
        // readPixels can throw if the canvas was resized since the last draw
      }
    }

    let totalBrightness = 0;
    let alphaCount = 0;
    let nonBlackCount = 0;
    const pixelCount = w * h;

    for (let i = 0; i < pixelCount; i++) {
      const r = this.sampleBuf[i * 4];
      const g = this.sampleBuf[i * 4 + 1];
      const b = this.sampleBuf[i * 4 + 2];
      const a = this.sampleBuf[i * 4 + 3];
      totalBrightness += (r + g + b) / 3;
      if (a > 0)           alphaCount++;
      if (r > 5 || g > 5 || b > 5) nonBlackCount++;
    }

    const avgBrightness   = totalBrightness / pixelCount;
    const alphaCoverage   = alphaCount    / pixelCount;
    const nonBlackPercent = nonBlackCount / pixelCount;

    // Detect whether frame content changed since last sample
    let changedFromPrevious = this.lastPixels === null;
    if (this.lastPixels) {
      for (let i = 0; i < this.sampleBuf.length; i++) {
        if (Math.abs(this.sampleBuf[i] - this.lastPixels[i]) > 2) {
          changedFromPrevious = true;
          break;
        }
      }
    }
    if (!this.lastPixels) this.lastPixels = new Uint8Array(this.sampleBuf.length);
    this.lastPixels.set(this.sampleBuf);

    // Classify
    let classification: FrameClassification;
    if (nonBlackPercent < 0.01 && avgBrightness < 2) {
      classification = 'blank';
    } else if (!changedFromPrevious && nonBlackPercent < 0.05) {
      classification = 'frozen';
    } else if (avgBrightness < 4) {
      classification = 'low-content';
    } else {
      classification = 'healthy';
    }

    const metrics: FrameMetrics = {
      frameIndex: this.frameCount,
      timestamp: performance.now(),
      avgBrightness,
      alphaCoverage,
      nonBlackPercent,
      changedFromPrevious,
      classification,
    };

    this.metricsBuf.push(metrics);

    // Update blank-frame state machine
    const isProblematic = classification === 'blank' || classification === 'frozen';
    if (isProblematic) {
      this.blankFrameCount++;
      if (!this.isCurrentlyBlank) {
        this.isCurrentlyBlank = true;
        this.blankIncidentCount++;
        this.logEvent('blank-detected',
          `${classification} bright=${avgBrightness.toFixed(1)} nonBlack=${(nonBlackPercent * 100).toFixed(1)}%`);
      }
    } else {
      this.lastGoodFrameMs = performance.now();
      if (this.isCurrentlyBlank) {
        this.isCurrentlyBlank = false;
        this.logEvent('blank-recovered',
          `${classification} bright=${avgBrightness.toFixed(1)}`);
      }
    }

    return metrics;
  }

  // ---------------------------------------------------------------------------
  /**
   * Should a frame be sampled right now?  Returns true once every
   * SAMPLE_PERIOD_FRAMES frames.
   */
  shouldSample(): boolean {
    return (this.frameCount % SAMPLE_PERIOD_FRAMES) === 0;
  }

  // ---------------------------------------------------------------------------
  /**
   * Capture a full forensic snapshot.  Throttled: won't produce a new snapshot
   * more than once per BLANK_FORENSIC_THROTTLE_MS.
   */
  captureForensicSnapshot(params: {
    activeGenerators: string[];
    canvasWidth: number;
    canvasHeight: number;
    lastMessageAgeMs: number;
    messageCount: number;
    lastShaderError: string | null;
    contextLost: boolean;
    programCacheSize: number;
  }): ForensicSnapshot | null {
    const now = performance.now();
    if (now - this.lastForensicDumpMs < BLANK_FORENSIC_THROTTLE_MS) return null;
    this.lastForensicDumpMs = now;

    return {
      timestamp: now,
      frameCount:         this.frameCount,
      drawCallCount:      this.drawCallCount,
      blankFrameCount:    this.blankFrameCount,
      blankIncidentCount: this.blankIncidentCount,
      lastGoodFrameMs:    this.lastGoodFrameMs,
      recentMetrics:      this.metricsBuf.toArray(),
      recentEvents:       this.eventBuf.toArray(),
      ...params,
    };
  }

  // ---------------------------------------------------------------------------
  /**
   * Multi-line summary for the debug overlay.
   */
  getDebugText(): string {
    const metrics = this.metricsBuf.toArray();
    const last = metrics[metrics.length - 1];
    const now = performance.now();
    const blankAgeMs = this.lastGoodFrameMs > 0
      ? Math.round(now - this.lastGoodFrameMs)
      : -1;

    const lines: string[] = [
      `Diagnostics`,
      `Frames: ${this.frameCount}  DrawCalls: ${this.drawCallCount}`,
      `Messages: ${this.messageCount}`,
      `Blank: ${this.blankFrameCount} frames  Incidents: ${this.blankIncidentCount}`,
    ];

    if (this.isCurrentlyBlank) {
      lines.push(`⚠ BLANK ACTIVE — last good ${blankAgeMs >= 0 ? blankAgeMs + 'ms ago' : 'never'}`);
    } else if (blankAgeMs >= 0) {
      lines.push(`Last good: ${blankAgeMs}ms ago`);
    }

    if (last) {
      lines.push(
        `Sample: ${last.classification} ` +
        `bright=${last.avgBrightness.toFixed(0)} ` +
        `nonBlk=${(last.nonBlackPercent * 100).toFixed(0)}%`
      );
    }

    return lines.join('\n');
  }
}

// Re-export the sample period so output.ts can use it in debug text
export { SAMPLE_PERIOD_FRAMES };
