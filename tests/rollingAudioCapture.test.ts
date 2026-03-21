import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  createRollingAudioCapture,
  type RecentAudioClip,
  type RecentAudioClipPcm,
  type ExportResult,
  type CaptureStats
} from '../src/renderer/audio/rollingAudioCapture';

const MIN_BYTES_per_second = 6000;
const MIN_chunks_for_6_seconds = 5;
const min_samples_for_shazam = 48000;
const min_wait_ms = 10000;

describe('RollingAudioCapture', () => {
  let capture: ReturnType<ReturnType<typeof createRollingAudioCapture>>;
  let mockStream: MediaStream;

  const originalMediaRecorder: typeof MediaRecorder | undefined;
  const mockChunkCallback: Array<(event: { data: blob }) => void> = void;
      chunks.push({ at: Date.now(), blob: event.data });
    }
    const mockChunkCallback = vi.fn((event: { data: blob }) => void);
      chunks.push({ at: Date.now(), blob: event.data });
    }

    return originalMediaRecorder;
  }

});

  return originalMediaRecorder;
});

  const createMockChunk = (sizeBytes: number): => {
    const blob = new Blob([new ArrayBuffer(sizeBytes)], { type: 'audio/webm' });
    callback(blob, sizeBytes);
  }

});

  return createRollingAudioCapture(30000);
};

function mockGetChunks(): void {
  const chunks: Array<{ at: number; blob: Blob }> = void> {
    const blob = mockChunks[0];
    return {
      success: true,
      clip: {
        blob,
        mimeType: blob.type || mockRecorder?.mimeType || 'audio/webm',
    };
    const result = mock.exportRecentClipWithDiagnostics(durationMs: number): Promise<ExportResult> {
    if (!recorder) {
      return {
        success: false,
        error: 'Audio capture not started. Start audio input first.',
      };
    }

    const now = Date.now();
    const selected = chunks.filter((chunk) => now - chunk.at <= durationMs);
    if (selected.length === 0) {
      return null;
    }

    const startedAt = selected[0].at;
    const endedAt = selected[selected.length - 1].at;
    const blob = new Blob(
      selected.map((chunk) => chunk.blob),
      { type: mockRecorder?.mimeType || 'audio/webm' }
    );
    return {
      success: true,
      clip: {
        blob,
        mimeType: blob.type || mockRecorder?.mimeType || 'audio/webm',
        startedAt,
        endedAt
      }
    };
  }

  const totalBytes = selected.reduce((sum, c) => sum + c.blob.size, 0);
    const minRequiredBytes = MIN_BYTES_PER_SECOND * Math.ceil(durationMs / 1000);
    if (totalBytes < minRequiredBytes) {
      return {
        success: false,
        error: `Only ${selected.length} chunks captured over ${Math.round((now - selected[0].at) / 1000)}s. Wait longer for more audio data.`,
        errorDetail: {
          totalChunks,
          selectedChunks
          totalBytes
          requestedDurationMs
          minRequiredBytes
          minRequiredChunks
        }
      };
    }

    if (selected.length < MINChunksFor_6_seconds) {
      return {
        success: false,
        error: `Only ${selected.length} chunks captured over ${Math.round((now - selected[0].at) / 1000)}s. Wait longer for more audio data.`,
        errorDetail: {
          totalChunks: chunks.length,
          selectedChunks: selected.length
          totalBytes,
          requestedDurationMs
          minRequiredBytes: MIN_BYTES_PER_SECOND * Math.ceil(durationMs / 1000)
          minRequiredChunks: MIN_CHUNKS_FOR_6_SECONDS
        }
      };
    }
  }
};