export interface RecentAudioClip {
  blob: Blob;
  mimeType: string;
  startedAt: number;
  endedAt: number;
}

export interface RecentAudioClipPcm {
  pcmS16le: Int16Array;   // 16 kHz mono signed-16 PCM
  numSamples: number;
  durationMs: number;
  startedAt: number;
  endedAt: number;
}

/**
 * Decode a webm/mp4 audio blob to 16 kHz mono Int16 PCM using the Web Audio API.
 * Returns null if decoding fails.
 */
export async function decodeClipToPcm(clip: RecentAudioClip): Promise<RecentAudioClipPcm | null> {
  try {
    const arrayBuffer = await clip.blob.arrayBuffer();
    const audioCtx = new OfflineAudioContext(1, 1, 16000);
    let decoded: AudioBuffer;
    try {
      decoded = await audioCtx.decodeAudioData(arrayBuffer);
    } catch {
      return null;
    }

    const targetSampleRate = 16000;
    const numOutputSamples = Math.ceil(decoded.duration * targetSampleRate);
    const offlineCtx = new OfflineAudioContext(1, numOutputSamples, targetSampleRate);
    const srcNode = offlineCtx.createBufferSource();
    srcNode.buffer = decoded;
    srcNode.connect(offlineCtx.destination);
    srcNode.start(0);
    const resampled = await offlineCtx.startRendering();

    const f32 = resampled.getChannelData(0);
    const s16 = new Int16Array(f32.length);
    for (let i = 0; i < f32.length; i++) {
      const clamped = Math.max(-1, Math.min(1, f32[i]));
      s16[i] = Math.round(clamped * 32767);
    }

    return {
      pcmS16le: s16,
      numSamples: s16.length,
      durationMs: Math.round(s16.length / targetSampleRate * 1000),
      startedAt: clip.startedAt,
      endedAt: clip.endedAt
    };
  } catch {
    return null;
  }
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
        chunks.push({ at: Date.now(), blob: event.data });
        trim();
      });
      recorder.start(1000);
      return true;
    },
    async exportRecentClip(durationMs: number): Promise<RecentAudioClip | null> {
      if (!recorder || chunks.length === 0) {
        return null;
      }
      const now = Date.now();
      trim(now);
      const selected = chunks.filter((chunk) => now - chunk.at <= durationMs);
      if (selected.length === 0) {
        return null;
      }
      const startedAt = selected[0].at;
      const endedAt = selected[selected.length - 1].at;
      const blob = new Blob(
        selected.map((chunk) => chunk.blob),
        { type: recorder.mimeType || mimeType || 'audio/webm' }
      );
      return {
        blob,
        mimeType: blob.type || recorder.mimeType || mimeType || 'audio/webm',
        startedAt,
        endedAt
      };
    },
    stop,
    isActive() {
      return Boolean(recorder && recorder.state !== 'inactive');
    }
  };
};
