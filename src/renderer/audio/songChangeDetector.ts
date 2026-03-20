export interface SongChangeAudioFrame {
  nowMs: number;
  rms: number;
  spectrum: ArrayLike<number>;
  bands?: ArrayLike<number>;
}

export interface SongChangeDetectorOptions {
  windowMs?: number;
  minTrackMs?: number;
  silenceThreshold?: number;
  changeThreshold?: number;
  confirmWindows?: number;
  cooldownMs?: number;
  onSongChange?: (event: SongChangeEvent) => void;
}

export interface SongChangeEvent {
  detectedAt: number;
  previousSignature: number[];
  nextSignature: number[];
  distance: number;
}

interface AggregatedWindow {
  startedAt: number;
  sampleCount: number;
  sums: number[];
}

const normalizeVector = (values: number[]): number[] => {
  const total = values.reduce((sum, value) => sum + Math.max(0, value), 0);
  if (total <= 1e-6) {
    return values.map(() => 0);
  }
  return values.map((value) => Math.max(0, value) / total);
};

const spectralDistance = (a: number[], b: number[]): number => {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;
  let sum = 0;
  for (let i = 0; i < len; i += 1) {
    sum += Math.abs(a[i] - b[i]);
  }
  return sum * 0.5;
};

const downsampleSpectrum = (spectrum: ArrayLike<number>, buckets = 12): number[] => {
  const result = new Array(buckets).fill(0);
  if (!spectrum.length) return result;
  for (let bucket = 0; bucket < buckets; bucket += 1) {
    const start = Math.floor((bucket / buckets) * spectrum.length);
    const end = Math.max(start + 1, Math.floor(((bucket + 1) / buckets) * spectrum.length));
    let sum = 0;
    for (let i = start; i < end; i += 1) {
      sum += Number(spectrum[i] ?? 0);
    }
    result[bucket] = sum / Math.max(1, end - start);
  }
  return normalizeVector(result);
};

export const createSongChangeDetector = (options: SongChangeDetectorOptions = {}) => {
  const windowMs = options.windowMs ?? 2500;
  const minTrackMs = options.minTrackMs ?? 45000;
  const silenceThreshold = options.silenceThreshold ?? 0.025;
  const changeThreshold = options.changeThreshold ?? 0.42;
  const confirmWindows = Math.max(1, options.confirmWindows ?? 3);
  const cooldownMs = options.cooldownMs ?? 15000;

  let activeWindow: AggregatedWindow | null = null;
  let baselineSignature: number[] | null = null;
  let baselineStartedAt = 0;
  let consecutiveChanges = 0;
  let pendingSignature: number[] | null = null;
  let lastDetectionAt = -Infinity;

  const flushWindow = (nowMs: number) => {
    if (!activeWindow || activeWindow.sampleCount === 0) return;
    const currentWindow = activeWindow;
    const signature = normalizeVector(
      currentWindow.sums.map((value) => value / Math.max(1, currentWindow.sampleCount))
    );

    if (!baselineSignature) {
      baselineSignature = signature;
      baselineStartedAt = currentWindow.startedAt;
      activeWindow = null;
      consecutiveChanges = 0;
      pendingSignature = null;
      return;
    }

    const distance = spectralDistance(baselineSignature, signature);
    const longEnough = nowMs - baselineStartedAt >= minTrackMs;
    const cooledDown = nowMs - lastDetectionAt >= cooldownMs;

    if (distance >= changeThreshold && longEnough && cooledDown) {
      consecutiveChanges += 1;
      pendingSignature = signature;
      if (consecutiveChanges >= confirmWindows) {
        options.onSongChange?.({
          detectedAt: nowMs,
          previousSignature: baselineSignature,
          nextSignature: signature,
          distance
        });
        baselineSignature = signature;
        baselineStartedAt = nowMs;
        consecutiveChanges = 0;
        pendingSignature = null;
        lastDetectionAt = nowMs;
      }
    } else {
      consecutiveChanges = 0;
      pendingSignature = null;
      baselineSignature = normalizeVector(
        baselineSignature.map((value, index) => value * 0.8 + signature[index] * 0.2)
      );
    }

    activeWindow = null;
  };

  return {
    update(frame: SongChangeAudioFrame) {
      if (frame.rms < silenceThreshold) {
        return;
      }

      const signature = frame.bands
        ? normalizeVector(Array.from(frame.bands as ArrayLike<number>, (value) => Number(value ?? 0)))
        : downsampleSpectrum(frame.spectrum);

      if (!activeWindow) {
        activeWindow = {
          startedAt: frame.nowMs,
          sampleCount: 0,
          sums: new Array(signature.length).fill(0)
        };
      }

      for (let i = 0; i < signature.length; i += 1) {
        activeWindow.sums[i] += signature[i];
      }
      activeWindow.sampleCount += 1;

      if (frame.nowMs - activeWindow.startedAt >= windowMs) {
        flushWindow(frame.nowMs);
      }
    },
    reset() {
      activeWindow = null;
      baselineSignature = null;
      baselineStartedAt = 0;
      consecutiveChanges = 0;
      pendingSignature = null;
      lastDetectionAt = -Infinity;
    },
    getState() {
      return {
        baselineSignature,
        baselineStartedAt,
        consecutiveChanges,
        pendingSignature,
        lastDetectionAt
      };
    }
  };
};
