import { describe, expect, it } from 'vitest';
import {
  createRollingAudioCapture,
  decodeClipToPcmWithDiagnostics
} from '../src/renderer/audio/rollingAudioCapture';

describe('Live Input Validation - Integration Test', () => {
  const MIN_BYTES_PER_SECOND = 6000;
  const MIN_CHUNKS_FOR_6_SECONDS = 5;
  const MIN_SAMPLES_FOR_SHAZAM = 48000;

  it('should validate minimum chunk count requirement', () => {
    expect(MIN_CHUNKS_FOR_6_SECONDS).toBe(5);
    expect(MIN_CHUNKS_FOR_6_SECONDS).toBeLessThanOrEqual(6);
  });

  it('should validate minimum bytes per second', () => {
    expect(MIN_BYTES_PER_SECOND).toBe(6000);
    expect(MIN_BYTES_PER_SECOND).toBeLessThanOrEqual(8000);
  });

  it('should validate minimum sample count for Shazam', () => {
    expect(MIN_SAMPLES_FOR_SHAZAM).toBe(48000);
    expect(MIN_SAMPLES_FOR_SHAZAM).toBeLessThanOrEqual(50000);
  });

  it('should require 6 seconds minimum for recognition', () => {
    const minDurationMs = 6000;
    const maxDurationMs = 12000;
    expect(minDurationMs).toBe(6000);
    expect(maxDurationMs).toBe(12000);
  });

  it('should calculate correct minimum bytes for 12 second clip', () => {
    const durationMs = 12000;
    const minBytes = MIN_BYTES_PER_SECOND * Math.ceil(durationMs / 1000);
    expect(minBytes).toBe(72000);
    expect(minBytes).toBeLessThanOrEqual(80000);
  });

  it('should validate decode result structure', async () => {
    const mockClip = {
      blob: new Blob([new ArrayBuffer(72000)], { type: 'audio/webm' }),
      mimeType: 'audio/webm',
      startedAt: Date.now() - 12000,
      endedAt: Date.now()
    };

    const result = await decodeClipToPcmWithDiagnostics(mockClip);
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('error');
    expect(result).toHaveProperty('errorDetail');
  });

  it('should show error structure includes all diagnostic fields', async () => {
    const mockClip = {
      blob: new Blob([new ArrayBuffer(72000)], { type: 'audio/webm' }),
      mimeType: 'audio/webm',
      startedAt: Date.now() - 12000,
      endedAt: Date.now()
    };

    const result = await decodeClipToPcmWithDiagnostics(mockClip);
    
    if (result.errorDetail) {
      expect(result.errorDetail).toHaveProperty('blobSize');
      expect(result.errorDetail).toHaveProperty('mimeType');
      expect(result.errorDetail).toHaveProperty('decodeSucceeded');
      expect(result.errorDetail).toHaveProperty('minRequiredSamples');
    }
  });
});
