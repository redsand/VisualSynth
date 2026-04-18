export interface RecentAudioClip {
  blob: Blob;
  mimeType: string;
  startedAt: number;
  endedAt: number;
}

export interface RecentAudioClipPcm {
  pcmS16le: Int16Array;
  numSamples: number;
  durationMs: number;
  startedAt: number;
  endedAt: number;
}

export interface DecodeResult {
  success: boolean;
  pcm?: RecentAudioClipPcm;
  error?: string;
  errorDetail?: {
    blobSize: number;
    mimeType: string;
    decodeSucceeded: boolean;
    sampleCount?: number;
    minRequiredSamples: number;
  };
}

export interface CaptureStats {
  isActive: boolean;
  totalChunks: number;
  totalBytes: number;
  oldestChunkAge: number;
  newestChunkAge: number;
  captureDurationMs: number;
  mimeType: string;
  averageChunkSize: number;
}

export interface ExportResult {
  success: boolean;
  clip?: RecentAudioClip;
  error?: string;
  errorDetail?: {
    totalChunks: number;
    selectedChunks: number;
    totalBytes: number;
    requestedDurationMs: number;
    minRequiredBytes: number;
    minRequiredChunks: number;
  };
}

// AudioWorklet processor — loaded once as a blob URL to avoid file-system / CSP issues.
const PCM_WORKLET_CODE = `
class PcmCaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (channel && channel.length > 0) {
      this.port.postMessage(channel.slice());
    }
    return true; // stay alive until explicitly disconnected
  }
}
registerProcessor('pcm-capture-processor', PcmCaptureProcessor);
`;

let _workletBlobUrl: string | null = null;
const getWorkletUrl = (): string => {
  if (!_workletBlobUrl) {
    _workletBlobUrl = URL.createObjectURL(new Blob([PCM_WORKLET_CODE], { type: 'application/javascript' }));
  }
  return _workletBlobUrl;
};

const MIN_SAMPLES_FOR_SHAZAM = 48000; // 3 seconds at 16kHz
const MIN_BYTES_PER_SECOND = 6000;
const MIN_CHUNKS_FOR_6_SECONDS = 5;
const MIN_CHUNKS_FOR_12_SECONDS = 10;

async function decodeAudioDataUniversal(blob: Blob): Promise<AudioBuffer | null> {
  const arrayBuffer = await blob.arrayBuffer();

  try {
    const audioCtx = new AudioContext();
    const decoded = await audioCtx.decodeAudioData(arrayBuffer);
    await audioCtx.close();
    return decoded;
  } catch (e) {
    console.warn('[Now Playing] decodeAudioData failed, blob may be in unsupported format:', (e as Error).message);
    return null;
  }
}

/**
 * Decodes a blob that may contain concatenated MediaRecorder chunks.
 * Tries decodeAudioData first, then falls back to decoding individual chunks.
 */
async function decodeConcatenatedChunks(blob: Blob, mimeType: string): Promise<AudioBuffer | null> {
  console.log(`[Now Playing] decodeConcatenatedChunks: ${blob.size} bytes, mimeType=${mimeType}`);

  // First attempt: try decoding the whole blob (works for some formats like wav)
  try {
    console.log('[Now Playing] Attempt 1: decodeAudioDataUniversal on full blob...');
    const decoded = await decodeAudioDataUniversal(blob);
    if (decoded) {
      console.log(`[Now Playing] Attempt 1 SUCCESS: ${decoded.duration.toFixed(1)}s at ${decoded.sampleRate}Hz`);
      return decoded;
    }
    console.log('[Now Playing] Attempt 1 FAILED: decodeAudioDataUniversal returned null');
  } catch (e) {
    console.log('[Now Playing] Attempt 1 FAILED: decodeAudioDataUniversal threw:', (e as Error).message);
    // Expected to fail for concatenated webm chunks
  }

  // Second attempt: decode as concatenated webm via audio element
  try {
    console.log('[Now Playing] Attempt 2: capturePcmFromAudioElement...');
    const result = await capturePcmFromAudioElement(blob);
    if (result) {
      console.log(`[Now Playing] Attempt 2 SUCCESS: ${result.duration.toFixed(1)}s at ${result.sampleRate}Hz`);
      return result;
    }
    console.log('[Now Playing] Attempt 2 FAILED: capturePcmFromAudioElement returned null');
  } catch (e) {
    console.log('[Now Playing] Attempt 2 FAILED: capturePcmFromAudioElement threw:', (e as Error).message);
  }

  // Third attempt (fallback for webm): decode individual chunks and stitch them
  if (mimeType.includes('webm')) {
    console.log('[Now Playing] Attempt 3: per-chunk decode and stitch...');
    return await decodeChunksIndividually(blob);
  }

  console.log('[Now Playing] All decode attempts failed');
  return null;
}

/**
 * Splits a concatenated webm blob into individual chunks and decodes each one.
 * MediaRecorder produces self-contained webm files; we need to find chunk boundaries.
 * Since we can't easily split a raw blob, we use a workaround:
 * - Split the blob at approximate boundaries (each ~1s chunk starts with '\x1a\x45\xdf\xa3' EBML header)
 * - Decode each chunk separately
 * - Stitch the resulting AudioBuffers together
 */
async function decodeChunksIndividually(blob: Blob): Promise<AudioBuffer | null> {
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  console.log(`[Now Playing] decodeChunksIndividually: scanning ${bytes.length} bytes for EBML headers...`);

  // Find EBML header positions (webm chunk boundaries)
  const EBML_MAGIC = [0x1a, 0x45, 0xdf, 0xa3];
  const chunkBoundaries: number[] = [0];

  for (let i = 0; i < bytes.length - 4; i++) {
    if (bytes[i] === EBML_MAGIC[0] &&
        bytes[i + 1] === EBML_MAGIC[1] &&
        bytes[i + 2] === EBML_MAGIC[2] &&
        bytes[i + 3] === EBML_MAGIC[3]) {
      if (i > 100) { // Skip the first header
        chunkBoundaries.push(i);
      }
    }
  }

  console.log(`[Now Playing] Found ${chunkBoundaries.length} EBML headers at positions: ${chunkBoundaries.join(', ')}`);

  if (chunkBoundaries.length <= 1) {
    // Only one chunk found, try direct decode
    console.log('[Now Playing] Only one webm chunk found, trying direct decode...');
    const result = await decodeAudioDataUniversal(blob);
    if (result) {
      console.log(`[Now Playing] Direct decode SUCCESS: ${result.duration.toFixed(1)}s`);
    } else {
      console.log('[Now Playing] Direct decode FAILED');
    }
    return result;
  }

  console.log(`[Now Playing] Found ${chunkBoundaries.length} webm chunks, decoding each...`);

  const decodedChunks: AudioBuffer[] = [];
  let targetSampleRate = 16000;

  for (let i = 0; i < chunkBoundaries.length; i++) {
    const start = chunkBoundaries[i];
    const end = i + 1 < chunkBoundaries.length ? chunkBoundaries[i + 1] : bytes.length;
    const chunkSize = end - start;
    const chunkBlob = blob.slice(start, end);

    try {
      console.log(`[Now Playing] Decoding chunk ${i + 1}/${chunkBoundaries.length} (${chunkSize} bytes)...`);
      const decoded = await decodeAudioDataUniversal(chunkBlob);
      if (decoded) {
        console.log(`[Now Playing] Chunk ${i + 1} SUCCESS: ${decoded.duration.toFixed(2)}s at ${decoded.sampleRate}Hz`);
        if (i === 0) targetSampleRate = decoded.sampleRate;
        decodedChunks.push(decoded);
      } else {
        console.warn(`[Now Playing] Chunk ${i + 1} returned null`);
      }
    } catch (e) {
      console.warn(`[Now Playing] Chunk ${i + 1} decode failed:`, (e as Error).message);
    }
  }

  if (decodedChunks.length === 0) {
    console.error('[Now Playing] All chunk decodes failed');
    return null;
  }

  console.log(`[Now Playing] Successfully decoded ${decodedChunks.length}/${chunkBoundaries.length} chunks, stitching...`);

  // Stitch chunks together at target sample rate
  const stitched = await stitchAudioBuffers(decodedChunks, targetSampleRate);
  if (stitched) {
    console.log(`[Now Playing] Stitch SUCCESS: ${stitched.duration.toFixed(1)}s at ${stitched.sampleRate}Hz`);
  } else {
    console.error('[Now Playing] Stitch FAILED');
  }
  return stitched;
}

/**
 * Stitches multiple AudioBuffers into one, resampling if necessary.
 */
async function stitchAudioBuffers(buffers: AudioBuffer[], targetSampleRate = 16000): Promise<AudioBuffer | null> {
  if (buffers.length === 0) return null;
  if (buffers.length === 1) {
    // Just resample if needed
    const buf = buffers[0];
    if (buf.sampleRate === targetSampleRate) return buf;
    return await resampleAudioBuffer(buf, targetSampleRate);
  }

  // Calculate total samples needed
  let totalSamples = 0;
  for (const buf of buffers) {
    const ratio = targetSampleRate / buf.sampleRate;
    totalSamples += Math.ceil(buf.length * ratio);
  }

  // Create output buffer
  const outputCtx = new OfflineAudioContext(1, totalSamples, targetSampleRate);
  const outputBuffer = outputCtx.createBuffer(1, totalSamples, targetSampleRate);
  const outputData = outputBuffer.getChannelData(0);

  let writePos = 0;
  for (const buf of buffers) {
    const resampled = buf.sampleRate === targetSampleRate ? buf : await resampleAudioBuffer(buf, targetSampleRate);
    const channelData = resampled.getChannelData(0);
    outputData.set(channelData, writePos);
    writePos += resampled.length;
  }

  return outputBuffer;
}

/**
 * Resamples an AudioBuffer to the target sample rate using OfflineAudioContext.
 */
async function resampleAudioBuffer(buffer: AudioBuffer, targetSampleRate: number): Promise<AudioBuffer> {
  const numSamples = Math.ceil(buffer.duration * targetSampleRate);
  const offlineCtx = new OfflineAudioContext(1, numSamples, targetSampleRate);
  const source = offlineCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(offlineCtx.destination);
  source.start(0);
  return offlineCtx.startRendering();
}

async function capturePcmFromAudioElement(blob: Blob, targetSampleRate = 16000): Promise<AudioBuffer | null> {
  let audioCtx: AudioContext | null = null;

  console.log(`[Now Playing] Attempting webm decode via Audio element: ${blob.size} bytes, type=${blob.type}`);

  try {
    // Use blob URL instead of data URL for better compatibility with opus
    const blobUrl = URL.createObjectURL(blob);
    console.log(`[Now Playing] Created blob URL: ${blobUrl.substring(0, 50)}...`);

    const audio = new Audio();
    audio.src = blobUrl;
    // Don't mute - we need the actual audio data flowing through the Web Audio graph
    // Use very low volume instead of mute to avoid feedback while still capturing
    audio.volume = 0.01;

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
        reject(new Error('Audio load timeout (15s)'));
      }, 15000);
      audio.oncanplaythrough = () => {
        clearTimeout(timeout);
        resolve();
      };
      audio.onerror = () => {
        clearTimeout(timeout);
        const error = audio.error;
        URL.revokeObjectURL(blobUrl);
        reject(new Error(`Audio load error: code=${error?.code ?? 'unknown'}, message=${error?.message ?? ''}`));
      };
      audio.load();
    });

    const duration = audio.duration;
    console.log(`[Now Playing] Audio element loaded: ${duration.toFixed(1)}s`);
    if (!isFinite(duration) || duration <= 0 || duration > 60) {
      URL.revokeObjectURL(blobUrl);
      throw new Error(`Invalid audio duration: ${duration}`);
    }

    audioCtx = new AudioContext({ sampleRate: targetSampleRate });

    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }

    await audioCtx.audioWorklet.addModule(getWorkletUrl());

    const source = audioCtx.createMediaElementSource(audio);

    const numSamples = Math.ceil(duration * targetSampleRate);
    const channelData = new Float32Array(numSamples);

    let writeIndex = 0;
    const workletNode = new AudioWorkletNode(audioCtx, 'pcm-capture-processor');

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.log(`[Now Playing] AudioWorklet timeout: wrote ${writeIndex}/${numSamples} samples`);
        URL.revokeObjectURL(blobUrl);
        resolve();
      }, (duration + 2) * 1000);

      workletNode.port.onmessage = (e: MessageEvent<Float32Array>) => {
        const inputData: Float32Array = e.data;
        const samplesToWrite = Math.min(inputData.length, numSamples - writeIndex);
        if (samplesToWrite > 0) {
          channelData.set(inputData.subarray(0, samplesToWrite), writeIndex);
          writeIndex += samplesToWrite;
        }
        if (writeIndex >= numSamples) {
          audio.pause();
          clearTimeout(timeout);
          URL.revokeObjectURL(blobUrl);
          resolve();
        }
      };

      audio.onended = () => {
        clearTimeout(timeout);
        URL.revokeObjectURL(blobUrl);
        resolve();
      };

      audio.onerror = () => {
        clearTimeout(timeout);
        URL.revokeObjectURL(blobUrl);
        reject(new Error('Audio playback error'));
      };

      source.connect(workletNode);

      audio.play().catch((e) => {
        URL.revokeObjectURL(blobUrl);
        reject(e);
      });
    });

    source.disconnect();
    workletNode.disconnect();
    workletNode.port.onmessage = null;
    audio.pause();

    const actualBuffer = audioCtx.createBuffer(1, writeIndex, targetSampleRate);
    actualBuffer.getChannelData(0).set(channelData.subarray(0, writeIndex));

    await audioCtx.close();

    // Verify we captured non-silent audio
    let energy = 0;
    const data = actualBuffer.getChannelData(0);
    for (let i = 0; i < Math.min(data.length, 16000); i++) {
      energy += data[i] * data[i];
    }
    energy = Math.sqrt(energy / Math.min(data.length, 16000));
    console.log(`[Now Playing] Audio element capture: ${writeIndex} samples, energy=${energy.toFixed(6)}`);

    if (energy < 0.0001) {
      console.warn('[Now Playing] Audio element capture produced near-silence, may be invalid');
      return null;
    }

    return actualBuffer;
  } catch (error) {
    console.warn('[Now Playing] PCM capture from audio element failed:', error);
    if (audioCtx && audioCtx.state !== 'closed') {
      await audioCtx.close().catch(() => {});
    }
    return null;
  }
}

export async function decodeClipToPcm(clip: RecentAudioClip): Promise<RecentAudioClipPcm | null> {
  const result = await decodeClipToPcmWithDiagnostics(clip);
  return result.success ? result.pcm ?? null : null;
}

export async function decodeClipToPcmWithDiagnostics(clip: RecentAudioClip): Promise<DecodeResult> {
  const minRequiredSamples = MIN_SAMPLES_FOR_SHAZAM;
  const errorDetail: DecodeResult['errorDetail'] = {
    blobSize: clip.blob.size,
    mimeType: clip.mimeType,
    decodeSucceeded: false,
    minRequiredSamples
  };

  try {
    let decoded: AudioBuffer | undefined;

    const isWebm = clip.mimeType.includes('webm');

    console.log(`[Now Playing] decodeClipToPcmWithDiagnostics: blob=${clip.blob.size} bytes, mimeType=${clip.mimeType}, duration=${clip.endedAt - clip.startedAt}ms`);

    if (isWebm) {
      // Use hybrid approach for webm (handles concatenated chunks)
      decoded = await decodeConcatenatedChunks(clip.blob, clip.mimeType) ?? undefined;
      if (!decoded) {
        console.error('[Now Playing] All decode attempts failed for webm blob');
        return {
          success: false,
          error: 'Failed to decode webm audio. The browser may not support this format.',
          errorDetail
        };
      }
      errorDetail.decodeSucceeded = true;
    } else {
      const arrayBuffer = await clip.blob.arrayBuffer();
      const audioCtx = new OfflineAudioContext(1, 1, 16000);
      try {
        decoded = await audioCtx.decodeAudioData(arrayBuffer);
        errorDetail.decodeSucceeded = true;
      } catch (decodeError) {
        return {
          success: false,
          error: 'Failed to decode audio data. The audio format may be unsupported or corrupt.',
          errorDetail
        };
      }
    }

    if (!decoded) {
      return {
        success: false,
        error: 'Failed to decode audio.',
        errorDetail
      };
    }

    const targetSampleRate = 16000;
    let f32: Float32Array;
    
    if (decoded.sampleRate === targetSampleRate && decoded.numberOfChannels >= 1) {
      f32 = decoded.getChannelData(0);
    } else {
      const numOutputSamples = Math.ceil(decoded.duration * targetSampleRate);
      const offlineCtx = new OfflineAudioContext(1, numOutputSamples, targetSampleRate);
      const srcNode = offlineCtx.createBufferSource();
      srcNode.buffer = decoded;
      srcNode.connect(offlineCtx.destination);
      srcNode.start(0);
      const resampled = await offlineCtx.startRendering();
      f32 = resampled.getChannelData(0);
    }
    const s16 = new Int16Array(f32.length);
    for (let i = 0; i < f32.length; i++) {
      const clamped = Math.max(-1, Math.min(1, f32[i]));
      s16[i] = Math.round(clamped * 32767);
    }

    errorDetail.sampleCount = s16.length;

    if (s16.length < minRequiredSamples) {
      const actualDuration = (s16.length / 16000).toFixed(1);
      const minDuration = (minRequiredSamples / 16000).toFixed(1);
      return {
        success: false,
        error: `Audio too short: ${actualDuration}s captured, need at least ${minDuration}s.`,
        errorDetail
      };
    }

    const energy = calculateAudioEnergy(s16);
    if (energy < 0.001) {
      return {
        success: false,
        error: 'Audio appears to be silent or near-silent. Ensure audio is playing.',
        errorDetail: { ...errorDetail, sampleCount: s16.length }
      };
    }

    return {
      success: true,
      pcm: {
        pcmS16le: s16,
        numSamples: s16.length,
        durationMs: Math.round(s16.length / targetSampleRate * 1000),
        startedAt: clip.startedAt,
        endedAt: clip.endedAt
      }
    };
  } catch (error) {
    return {
      success: false,
      error: `Unexpected error: ${(error as Error).message}`,
      errorDetail
    };
  }
}

function calculateAudioEnergy(samples: Int16Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i];
  }
  return Math.sqrt(sum / samples.length) / 32768;
}

interface TimedChunk {
  at: number;
  blob: Blob;
}

const PICKED_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4'
];

const pickMimeType = (): string => {
  for (const mimeType of PICKED_MIME_TYPES) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }
  return '';
};

export const createRollingAudioCapture = (historyMs = 20000) => {
  let recorder: MediaRecorder | null = null;
  let chunks: TimedChunk[] = [];
  let activeStream: MediaStream | null = null;
  let mimeType = '';
  let firstChunkAt: number | null = null;

  // ── Parallel raw PCM capture for Shazam (bypasses WebM/Opus encoding) ──
  let pcmAudioCtx: AudioContext | null = null;
  let pcmSource: MediaStreamAudioSourceNode | null = null;
  let pcmProcessor: AudioWorkletNode | null = null;
  let pcmRing: Float32Array = new Float32Array(16000 * 30); // 30 seconds at 16kHz
  let pcmWritePos = 0;
  let pcmStartedAt = 0;
  const PCM_SAMPLE_RATE = 16000;

  const trim = (now = Date.now()) => {
    chunks = chunks.filter((chunk) => now - chunk.at <= historyMs);
  };

  const stopPcmCapture = () => {
    if (pcmProcessor) {
      pcmProcessor.port.onmessage = null;
      pcmProcessor.disconnect();
      pcmProcessor = null;
    }
    if (pcmSource) { pcmSource.disconnect(); pcmSource = null; }
    if (pcmAudioCtx && pcmAudioCtx.state !== 'closed') { pcmAudioCtx.close(); }
    pcmAudioCtx = null;
  };

  const startPcmCapture = (stream: MediaStream) => {
    stopPcmCapture();
    const ctx = new AudioContext({ sampleRate: PCM_SAMPLE_RATE });
    pcmAudioCtx = ctx;
    if (ctx.state === 'suspended') ctx.resume();

    ctx.audioWorklet.addModule(getWorkletUrl()).then(() => {
      if (pcmAudioCtx !== ctx) return; // stopped before module loaded
      pcmSource = ctx.createMediaStreamSource(stream);
      pcmProcessor = new AudioWorkletNode(ctx, 'pcm-capture-processor');
      pcmProcessor.port.onmessage = (e: MessageEvent<Float32Array>) => {
        const inputData: Float32Array = e.data;
        if (pcmStartedAt === 0) pcmStartedAt = Date.now();
        for (let i = 0; i < inputData.length; i++) {
          pcmRing[pcmWritePos] = inputData[i];
          pcmWritePos = (pcmWritePos + 1) % pcmRing.length;
        }
      };
      pcmSource.connect(pcmProcessor);
      // No destination connection needed — AudioWorkletNode processes without it
      console.log('[Now Playing] Raw PCM capture started at 16kHz (AudioWorklet)');
    }).catch((e) => {
      console.warn('[Now Playing] Failed to start PCM capture:', e);
      stopPcmCapture();
    });
  };

  /**
   * Exports recent PCM samples as Int16 for Shazam.
   * @param durationMs How many milliseconds of audio to export (default 12000)
   */
  const exportRecentPcm = (durationMs = 12000): RecentAudioClipPcm | null => {
    if (pcmStartedAt === 0 || !pcmAudioCtx) {
      console.warn('[Now Playing] PCM capture not started');
      return null;
    }

    const numSamples = Math.floor(durationMs / 1000 * PCM_SAMPLE_RATE);
    const availableSamples = Math.min(numSamples, pcmRing.length);

    // Read backwards from current write position
    const pcmS16le = new Int16Array(availableSamples);
    let readPos = (pcmWritePos - availableSamples + pcmRing.length) % pcmRing.length;
    for (let i = 0; i < availableSamples; i++) {
      const clamped = Math.max(-1, Math.min(1, pcmRing[readPos]));
      pcmS16le[i] = Math.round(clamped * 32767);
      readPos = (readPos + 1) % pcmRing.length;
    }

    // Calculate energy
    let energy = 0;
    for (let i = 0; i < Math.min(availableSamples, PCM_SAMPLE_RATE); i++) {
      const val = pcmS16le[i] / 32768;
      energy += val * val;
    }
    energy = Math.sqrt(energy / Math.min(availableSamples, PCM_SAMPLE_RATE));

    const endedAt = Date.now();
    const startedAt = endedAt - Math.round(availableSamples / PCM_SAMPLE_RATE * 1000);

    console.log(`[Now Playing] Exported PCM: ${availableSamples} samples, ${durationMs}ms, energy=${energy.toFixed(4)}`);

    if (energy < 0.001) {
      console.warn('[Now Playing] PCM appears to be near-silent');
      return null;
    }

    return {
      pcmS16le,
      numSamples: availableSamples,
      durationMs: Math.round(availableSamples / PCM_SAMPLE_RATE * 1000),
      startedAt,
      endedAt
    };
  };

  const stop = () => {
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    recorder = null;
    chunks = [];
    activeStream = null;
    mimeType = '';
    firstChunkAt = null;
    stopPcmCapture();
    pcmStartedAt = 0;
  };

  return {
    attach(stream: MediaStream | null) {
      if (!stream) {
        stop();
        return false;
      }
      if (activeStream === stream && recorder) {
        return true;
      }

      stop();

      if (typeof MediaRecorder === 'undefined') {
        return false;
      }

      mimeType = pickMimeType();
      try {
        recorder = mimeType
          ? new MediaRecorder(stream, { mimeType })
          : new MediaRecorder(stream);
      } catch {
        recorder = null;
        mimeType = '';
        return false;
      }

      activeStream = stream;
      recorder.addEventListener('dataavailable', (event) => {
        if (!event.data || event.data.size === 0) return;
        if (firstChunkAt === null) {
          firstChunkAt = Date.now();
        }
        chunks.push({ at: Date.now(), blob: event.data });
        trim();
      });
      recorder.start(1000);

      // Start parallel PCM capture for Shazam
      startPcmCapture(stream);

      return true;
    },
    async exportRecentClip(durationMs: number): Promise<RecentAudioClip | null> {
      const result = await this.exportRecentClipWithDiagnostics(durationMs);
      return result.success ? result.clip ?? null : null;
    },
    async exportRecentClipWithDiagnostics(durationMs: number): Promise<ExportResult> {
      if (!recorder) {
        return {
          success: false,
          error: 'Audio capture not started. Start audio input first.',
          errorDetail: {
            totalChunks: 0,
            selectedChunks: 0,
            totalBytes: 0,
            requestedDurationMs: durationMs,
            minRequiredBytes: MIN_BYTES_PER_SECOND * Math.ceil(durationMs / 1000),
            minRequiredChunks: MIN_CHUNKS_FOR_6_SECONDS
          }
        };
      }

      const now = Date.now();
      trim(now);

      if (chunks.length === 0) {
        return {
          success: false,
          error: 'No audio chunks captured yet. Wait a few seconds after starting audio input.',
          errorDetail: {
            totalChunks: 0,
            selectedChunks: 0,
            totalBytes: 0,
            requestedDurationMs: durationMs,
            minRequiredBytes: MIN_BYTES_PER_SECOND * Math.ceil(durationMs / 1000),
            minRequiredChunks: MIN_CHUNKS_FOR_6_SECONDS
          }
        };
      }

      const selected = chunks.filter((chunk) => now - chunk.at <= durationMs);
      if (selected.length === 0) {
        return {
          success: false,
          error: `No audio chunks within the last ${Math.round(durationMs / 1000)} seconds.`,
          errorDetail: {
            totalChunks: chunks.length,
            selectedChunks: 0,
            totalBytes: chunks.reduce((sum, c) => sum + c.blob.size, 0),
            requestedDurationMs: durationMs,
            minRequiredBytes: MIN_BYTES_PER_SECOND * Math.ceil(durationMs / 1000),
            minRequiredChunks: MIN_CHUNKS_FOR_6_SECONDS
          }
        };
      }

      const totalBytes = selected.reduce((sum, c) => sum + c.blob.size, 0);
      const minRequiredBytes = MIN_BYTES_PER_SECOND * Math.ceil(durationMs / 1000);

      if (selected.length < MIN_CHUNKS_FOR_6_SECONDS) {
        const oldestAge = Math.round((now - selected[0].at) / 1000);
        return {
          success: false,
          error: `Only ${selected.length} chunks captured over ${oldestAge}s. Wait longer for more audio data.`,
          errorDetail: {
            totalChunks: chunks.length,
            selectedChunks: selected.length,
            totalBytes,
            requestedDurationMs: durationMs,
            minRequiredBytes,
            minRequiredChunks: MIN_CHUNKS_FOR_6_SECONDS
          }
        };
      }

      if (totalBytes < minRequiredBytes) {
        const actualKb = (totalBytes / 1024).toFixed(1);
        const minKb = (minRequiredBytes / 1024).toFixed(1);
        return {
          success: false,
          error: `Insufficient audio data: ${actualKb}KB captured, need at least ${minKb}KB.`,
          errorDetail: {
            totalChunks: chunks.length,
            selectedChunks: selected.length,
            totalBytes,
            requestedDurationMs: durationMs,
            minRequiredBytes,
            minRequiredChunks: MIN_CHUNKS_FOR_6_SECONDS
          }
        };
      }

      const startedAt = selected[0].at;
      const endedAt = selected[selected.length - 1].at;
      const blob = new Blob(
        selected.map((chunk) => chunk.blob),
        { type: recorder.mimeType || mimeType || 'audio/webm' }
      );

      return {
        success: true,
        clip: {
          blob,
          mimeType: blob.type || recorder.mimeType || mimeType || 'audio/webm',
          startedAt,
          endedAt
        }
      };
    },
    stop,
    exportRecentPcm,
    isActive() {
      return Boolean(recorder && recorder.state !== 'inactive');
    },
    getStats(): CaptureStats {
      const now = Date.now();
      const active = this.isActive();
      const totalChunks = chunks.length;
      const totalBytes = chunks.reduce((sum, c) => sum + c.blob.size, 0);

      let oldestChunkAge = 0;
      let newestChunkAge = 0;
      let captureDurationMs = 0;

      if (chunks.length > 0) {
        oldestChunkAge = now - chunks[0].at;
        newestChunkAge = now - chunks[chunks.length - 1].at;
        captureDurationMs = chunks[chunks.length - 1].at - chunks[0].at;
      }

      return {
        isActive: active,
        totalChunks,
        totalBytes,
        oldestChunkAge,
        newestChunkAge,
        captureDurationMs,
        mimeType: recorder?.mimeType || mimeType || '',
        averageChunkSize: totalChunks > 0 ? Math.round(totalBytes / totalChunks) : 0
      };
    }
  };
};
