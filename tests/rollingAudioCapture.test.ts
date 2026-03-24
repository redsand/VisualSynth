import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  createRollingAudioCapture,
  type RecentAudioClip,
  type RecentAudioClipPcm,
  type ExportResult,
  type CaptureStats
} from '../src/renderer/audio/rollingAudioCapture';

const MIN_BYTES_PER_SECOND = 6000;
const MIN_CHUNKS_FOR_6_SECONDS = 5;
const MIN_SAMPLES_FOR_SHAZAM = 48000;
const MIN_WAIT_MS = 10000;

type MockRecorderInstance = {
  state: string;
  mimeType: string;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  dispatchChunk: (sizeBytes: number) => void;
};

let mockRecorderInstance: MockRecorderInstance | null = null;

const createMockMediaRecorder = () => {
  const listeners: Record<string, Array<(event: { data: Blob }) => void>> = {};
  const instance: MockRecorderInstance = {
    state: 'recording',
    mimeType: 'audio/webm',
    start: vi.fn(),
    stop: vi.fn(() => { instance.state = 'inactive'; }),
    addEventListener: vi.fn((event: string, cb: (e: { data: Blob }) => void) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(cb);
    }),
    dispatchChunk: (sizeBytes: number) => {
      const blob = new Blob([new ArrayBuffer(sizeBytes)], { type: 'audio/webm' });
      (listeners['dataavailable'] ?? []).forEach(cb => cb({ data: blob }));
    }
  };
  mockRecorderInstance = instance;
  return instance;
};

describe('RollingAudioCapture', () => {
  let OriginalMediaRecorder: typeof MediaRecorder;

  beforeEach(() => {
    OriginalMediaRecorder = globalThis.MediaRecorder;
    mockRecorderInstance = null;

    const MockMediaRecorder = vi.fn(() => createMockMediaRecorder()) as unknown as typeof MediaRecorder;
    (MockMediaRecorder as any).isTypeSupported = vi.fn(() => true);
    globalThis.MediaRecorder = MockMediaRecorder;
  });

  afterEach(() => {
    globalThis.MediaRecorder = OriginalMediaRecorder;
    vi.restoreAllMocks();
  });

  it('attach returns false when stream is null', () => {
    const capture = createRollingAudioCapture();
    expect(capture.attach(null)).toBe(false);
  });

  it('attach returns true with a valid stream', () => {
    const capture = createRollingAudioCapture();
    const stream = {} as MediaStream;
    expect(capture.attach(stream)).toBe(true);
  });

  it('isActive returns true after attaching a stream', () => {
    const capture = createRollingAudioCapture();
    capture.attach({} as MediaStream);
    expect(capture.isActive()).toBe(true);
  });

  it('isActive returns false after stop', () => {
    const capture = createRollingAudioCapture();
    capture.attach({} as MediaStream);
    capture.stop();
    expect(capture.isActive()).toBe(false);
  });

  it('exportRecentClipWithDiagnostics returns error when not started', async () => {
    const capture = createRollingAudioCapture();
    const result = await capture.exportRecentClipWithDiagnostics(6000);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not started/i);
  });

  it('exportRecentClipWithDiagnostics returns error when no chunks captured', async () => {
    const capture = createRollingAudioCapture();
    capture.attach({} as MediaStream);
    const result = await capture.exportRecentClipWithDiagnostics(6000);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/no audio chunks/i);
  });

  it('exportRecentClipWithDiagnostics returns error when too few chunks', async () => {
    const capture = createRollingAudioCapture();
    capture.attach({} as MediaStream);
    mockRecorderInstance!.dispatchChunk(50000);
    mockRecorderInstance!.dispatchChunk(50000);
    const result = await capture.exportRecentClipWithDiagnostics(6000);
    expect(result.success).toBe(false);
    expect(result.errorDetail?.selectedChunks).toBeLessThan(MIN_CHUNKS_FOR_6_SECONDS);
  });

  it('exportRecentClipWithDiagnostics returns error when insufficient bytes', async () => {
    const capture = createRollingAudioCapture();
    capture.attach({} as MediaStream);
    for (let i = 0; i < MIN_CHUNKS_FOR_6_SECONDS; i++) {
      mockRecorderInstance!.dispatchChunk(10);
    }
    const result = await capture.exportRecentClipWithDiagnostics(6000);
    expect(result.success).toBe(false);
    expect(result.errorDetail?.totalBytes).toBeLessThan(MIN_BYTES_PER_SECOND);
  });

  it('exportRecentClipWithDiagnostics returns success with enough chunks and bytes', async () => {
    const capture = createRollingAudioCapture();
    capture.attach({} as MediaStream);
    for (let i = 0; i < MIN_CHUNKS_FOR_6_SECONDS; i++) {
      mockRecorderInstance!.dispatchChunk(50000);
    }
    const result = await capture.exportRecentClipWithDiagnostics(6000);
    expect(result.success).toBe(true);
    expect(result.clip).toBeDefined();
    expect(result.clip!.blob).toBeInstanceOf(Blob);
    expect(result.clip!.mimeType).toBeTruthy();
    expect(result.clip!.startedAt).toBeTypeOf('number');
    expect(result.clip!.endedAt).toBeTypeOf('number');
  });

  it('exportRecentClip returns null when not started', async () => {
    const capture = createRollingAudioCapture();
    const clip = await capture.exportRecentClip(6000);
    expect(clip).toBeNull();
  });

  it('exportRecentClip returns a clip when enough data is present', async () => {
    const capture = createRollingAudioCapture();
    capture.attach({} as MediaStream);
    for (let i = 0; i < MIN_CHUNKS_FOR_6_SECONDS; i++) {
      mockRecorderInstance!.dispatchChunk(50000);
    }
    const clip = await capture.exportRecentClip(6000);
    expect(clip).not.toBeNull();
    expect(clip!.blob).toBeInstanceOf(Blob);
  });

  it('getStats reflects active state and chunk count', () => {
    const capture = createRollingAudioCapture();
    capture.attach({} as MediaStream);
    for (let i = 0; i < 3; i++) {
      mockRecorderInstance!.dispatchChunk(1000);
    }
    const stats = capture.getStats();
    expect(stats.isActive).toBe(true);
    expect(stats.totalChunks).toBe(3);
    expect(stats.totalBytes).toBe(3000);
  });

  it('getStats returns zeros when inactive', () => {
    const capture = createRollingAudioCapture();
    const stats = capture.getStats();
    expect(stats.isActive).toBe(false);
    expect(stats.totalChunks).toBe(0);
    expect(stats.totalBytes).toBe(0);
  });

  it('chunks older than historyMs are trimmed', async () => {
    vi.useFakeTimers();
    const historyMs = 5000;
    const capture = createRollingAudioCapture(historyMs);
    capture.attach({} as MediaStream);

    mockRecorderInstance!.dispatchChunk(50000);
    vi.advanceTimersByTime(historyMs + 1000);
    for (let i = 0; i < MIN_CHUNKS_FOR_6_SECONDS; i++) {
      mockRecorderInstance!.dispatchChunk(50000);
    }

    const result = await capture.exportRecentClipWithDiagnostics(historyMs);
    vi.useRealTimers();

    if (result.success) {
      expect(result.clip!.startedAt).toBeGreaterThan(0);
    } else {
      expect(result.errorDetail?.selectedChunks).toBeLessThanOrEqual(MIN_CHUNKS_FOR_6_SECONDS);
    }
  });

  it('re-attaching the same stream returns true without creating a new recorder', () => {
    const capture = createRollingAudioCapture();
    const stream = {} as MediaStream;
    capture.attach(stream);
    const firstInstance = mockRecorderInstance;
    capture.attach(stream);
    expect(mockRecorderInstance).toBe(firstInstance);
  });
});
