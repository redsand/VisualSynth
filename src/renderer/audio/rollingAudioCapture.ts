export interface RecentAudioClip {
  blob: Blob;
  mimeType: string;
  startedAt: number;
  endedAt: number;
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
