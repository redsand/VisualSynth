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

async function capturePcmFromAudioElement(blob: Blob, targetSampleRate = 16000): Promise<AudioBuffer | null> {
  const objectUrl = URL.createObjectURL(blob);
  const audio = new Audio();
  audio.src = objectUrl;
  audio.muted = true;
  
  let audioCtx: AudioContext | null = null;
  
  console.log('[Now Playing] Attempting webm decode via Audio element...');
  
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Audio load timeout')), 15000);
      audio.oncanplaythrough = () => {
        clearTimeout(timeout);
        resolve();
      };
      audio.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Audio load error'));
      };
      audio.load();
    });

    const duration = audio.duration;
    if (!isFinite(duration) || duration <= 0 || duration > 60) {
      throw new Error(`Invalid audio duration: ${duration}`);
    }
    
    audioCtx = new AudioContext({ sampleRate: targetSampleRate });
    
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }
    
    const source = audioCtx.createMediaElementSource(audio);
    
    const numSamples = Math.ceil(duration * targetSampleRate);
    const buffer = audioCtx.createBuffer(1, numSamples, targetSampleRate);
    const channelData = buffer.getChannelData(0);
    
    let writeIndex = 0;
    
    const scriptProcessor = audioCtx.createScriptProcessor(4096, 1, 1);
    
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        resolve();
      }, (duration + 2) * 1000);
      
      scriptProcessor.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0);
        const samplesToWrite = Math.min(inputData.length, numSamples - writeIndex);
        if (samplesToWrite > 0) {
          channelData.set(inputData.subarray(0, samplesToWrite), writeIndex);
          writeIndex += samplesToWrite;
        }
        if (writeIndex >= numSamples) {
          audio.pause();
          clearTimeout(timeout);
          resolve();
        }
      };
      
      audio.onended = () => {
        clearTimeout(timeout);
        resolve();
      };
      
      audio.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Audio playback error'));
      };
      
      source.connect(scriptProcessor);
      scriptProcessor.connect(audioCtx!.destination);
      
      audio.play().catch(reject);
    });
    
    source.disconnect();
    scriptProcessor.disconnect();
    audio.pause();
    
    const actualBuffer = audioCtx.createBuffer(1, writeIndex, targetSampleRate);
    actualBuffer.copyToChannel(channelData.subarray(0, writeIndex), 0);
    
    await audioCtx.close();
    
    return actualBuffer;
  } catch (error) {
    console.warn('[Now Playing] PCM capture from audio element failed:', error);
    if (audioCtx && audioCtx.state !== 'closed') {
      await audioCtx.close().catch(() => {});
    }
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
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
    
    if (isWebm) {
      decoded = await capturePcmFromAudioElement(clip.blob) ?? undefined;
      if (!decoded) {
        decoded = await decodeAudioDataUniversal(clip.blob) ?? undefined;
      }
      if (!decoded) {
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

  const trim = (now = Date.now()) => {
    chunks = chunks.filter((chunk) => now - chunk.at <= historyMs);
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
