// Song-change detector v2.
//
// v1 compared amplitude-normalized spectral SHAPES (8 bands), which cannot
// discriminate real content: mastered dance tracks share nearly identical
// normalized band shapes, so measured cross-song distances (0.03–0.047
// rolling, 0.077 settled) sat far below any threshold that same-song drift
// (0.02–0.03) would not also cross — the detector never fired on real DJ
// transitions (see scripts/probe-spectral-distance.ts, the Oct-22 pre-show
// measurement). v2 adds a second feature block that IS discriminative:
//
//   shape — normalized 64-bin log-spaced spectrum mean (loudness-invariant
//           timbre; prefers the fine spectrum over the coarse 8 bands)
//   flux  — normalized per-bin mean positive RISE rate max(0, m−prev)/dt
//           (rhythmic texture: where and how fast energy enters each band)
//
// Measured on real songs via scripts/probe-song-features.ts (Danza Kuduro,
// Da' Butt, Cha Cha Slide, rAF-rate frames through an AnalyserNode set up
// exactly like AudioEngine's): cross-song window distance median ≈ 0.16
// (min 0.063, max 0.34) vs same-song adjacent-window drift median ≈ 0.12
// with the low half under 0.08. changeThreshold defaults to 0.15 — just
// under the cross-song median, so a typical transition crosses it within a
// couple of windows, while quiet stretches of the same track stay under it.
// The distributions overlap at the tails: section changes within a song can
// fire, which is an accepted trade — the now-playing lookup gate
// (shared/nowPlayingGate) dedupes same-track recognitions and the geometric
// cooldown makes repeat fires cheap, while a MISSED change costs the whole
// feature.
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
  magSums: number[];
  fluxSums: number[];
}

const normalizeVector = (values: number[]): number[] => {
  const total = values.reduce((sum, value) => sum + Math.max(0, value), 0);
  if (total <= 1e-6) {
    return values.map(() => 0);
  }
  return values.map((value) => Math.max(0, value) / total);
};

// Total-variation distance between two normalized vectors ∈ [0,1].
const spectralDistance = (a: number[], b: number[]): number => {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;
  let sum = 0;
  for (let i = 0; i < len; i += 1) {
    sum += Math.abs(a[i] - b[i]);
  }
  return sum * 0.5;
};

// Distance between two signatures (shape block ++ flux block), with the
// blocks weighted equally. `size` is the length of one block.
const signatureDistance = (a: number[], b: number[]): number => {
  const size = Math.floor(Math.min(a.length, b.length) / 2);
  if (size === 0) return 0;
  const shape = 0.5 * spectralDistance(a.slice(0, size), b.slice(0, size));
  const flux = 0.5 * spectralDistance(a.slice(size, size * 2), b.slice(size, size * 2));
  return shape + flux;
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
  return result;
};

// Flux rises are meaningless across a frame gap (render stall, silence, tab
// throttle): the spectrum moved by wall-clock time the per-second rise rate
// cannot represent. Cap the usable gap; larger gaps resync without aggregating.
const MAX_FRAME_GAP_MS = 500;

export const createSongChangeDetector = (options: SongChangeDetectorOptions = {}) => {
  // Mutable thresholds so live settings edits take effect without rebuilding
  // the detector (which would discard the learned baseline).
  let windowMs = options.windowMs ?? 2500;
  let minTrackMs = options.minTrackMs ?? 30000;
  let silenceThreshold = options.silenceThreshold ?? 0.025;
  let changeThreshold = options.changeThreshold ?? 0.15;
  let confirmWindows = Math.max(1, options.confirmWindows ?? 2);
  let cooldownMs = options.cooldownMs ?? 15000;

  let activeWindow: AggregatedWindow | null = null;
  let baselineSignature: number[] | null = null;
  let baselineStartedAt = 0;
  // The baseline is averaged over the first BASELINE_WINDOWS completed
  // windows: a single first window can be an unrepresentative sample of the
  // track (fade-in, DJ ramp) whose flux profile differs from steady-state
  // playback — then the song's own body reads as "changed" and fires once
  // right when the minTrackMs gate opens (seen live in the e2e: a 2s
  // fade-in taught a ramp baseline and steady danza fired as a false song
  // change ~35s in, before the real transition).
  let baselineAccumulator: number[] | null = null;
  let baselineWindows = 0;
  const BASELINE_WINDOWS = 2;
  let consecutiveChanges = 0;
  let pendingSignature: number[] | null = null;
  let lastDetectionAt = -Infinity;
  // Distance of the most recent completed window vs the baseline — live
  // feedback for tuning changeThreshold in the settings modal.
  let lastWindowDistance = 0;
  // Previous frame's per-band magnitudes (for the rise-rate flux); stale
  // after gaps > MAX_FRAME_GAP_MS.
  let prevMag: number[] | null = null;
  let prevMagAt = -Infinity;

  const flushWindow = (nowMs: number) => {
    if (!activeWindow || activeWindow.sampleCount === 0) return;
    const currentWindow = activeWindow;
    const shape = normalizeVector(
      currentWindow.magSums.map((value) => value / Math.max(1, currentWindow.sampleCount))
    );
    const flux = normalizeVector(
      currentWindow.fluxSums.map((value) => value / Math.max(1, currentWindow.sampleCount))
    );
    const signature = [...shape, ...flux];

    if (!baselineSignature) {
      // Accumulate the first BASELINE_WINDOWS windows into an averaged
      // baseline before the detector arms.
      if (!baselineAccumulator) {
        baselineAccumulator = signature.slice();
        baselineWindows = 1;
        // The minTrackMs clock starts at the FIRST window's start so the
        // arming delay is not extended by the extra baseline window.
        baselineStartedAt = currentWindow.startedAt;
      } else {
        for (let i = 0; i < signature.length && i < baselineAccumulator.length; i += 1) {
          baselineAccumulator[i] += signature[i];
        }
        baselineWindows += 1;
      }
      if (baselineWindows >= BASELINE_WINDOWS) {
        // Renormalize PER BLOCK: the accumulator holds [shape…, flux…]
        // concatenated, and a whole-vector normalize would halve each block's
        // mass (total mass 2) against full-mass comparison windows — every
        // same-song distance would then read inflated by the mass mismatch.
        const size = Math.floor(baselineAccumulator.length / 2);
        baselineSignature = [
          ...normalizeVector(baselineAccumulator.slice(0, size)),
          ...normalizeVector(baselineAccumulator.slice(size))
        ];
      }
      activeWindow = null;
      consecutiveChanges = 0;
      pendingSignature = null;
      return;
    }

    const distance = signatureDistance(baselineSignature, signature);
    lastWindowDistance = distance;
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
      // Hysteresis: do NOT track the baseline toward a diverging signature.
      // Only nudge the baseline for genuine near-identical drift (distance
      // well below threshold), so gradual spectral shifts accumulate distance
      // and eventually fire. Same-song drift below the nudge zone keeps the
      // baseline warm without letting a slow crossfade sneak under the gate.
      if (distance < changeThreshold * 0.4) {
        baselineSignature = normalizeVector(
          baselineSignature.map((value, index) => value * 0.9 + signature[index] * 0.1)
        );
      }
    }

    activeWindow = null;
  };

  return {
    update(frame: SongChangeAudioFrame) {
      // Silent frames are not aggregated, but their wall-clock time still
      // counts toward the window deadline — otherwise a loud-quiet-loud
      // pattern produces a window that spans a long silent gap and is
      // compared as if it were a contiguous snapshot.
      if (frame.rms < silenceThreshold) {
        prevMag = null; // rises from silence are onset artifacts, not texture
        if (activeWindow && frame.nowMs - activeWindow.startedAt >= windowMs) {
          flushWindow(frame.nowMs);
        }
        return;
      }

      // Prefer the fine spectrum (64 log-spaced bins from AudioEngine); the
      // coarse 8 musical bands wash out exactly the detail that separates
      // songs. Bands remain a fallback for callers without a spectrum.
      const mag = frame.spectrum?.length
        ? Array.from(frame.spectrum as ArrayLike<number>, (value) => Number(value ?? 0))
        : frame.bands
          ? normalizeVector(Array.from(frame.bands as ArrayLike<number>, (value) => Number(value ?? 0)))
          : downsampleSpectrum(frame.spectrum);

      const dtMs = prevMag ? frame.nowMs - prevMagAt : Infinity;
      const fluxUsable = prevMag !== null && dtMs > 0 && dtMs <= MAX_FRAME_GAP_MS;

      if (!activeWindow || activeWindow.magSums.length !== mag.length) {
        activeWindow = {
          startedAt: frame.nowMs,
          sampleCount: 0,
          magSums: new Array(mag.length).fill(0),
          fluxSums: new Array(mag.length).fill(0)
        };
      }

      for (let i = 0; i < mag.length; i += 1) {
        activeWindow.magSums[i] += mag[i];
        activeWindow.fluxSums[i] += fluxUsable
          ? Math.max(0, mag[i] - (prevMag as number[])[i]) / (dtMs / 1000)
          : 0;
      }
      activeWindow.sampleCount += 1;
      prevMag = mag;
      prevMagAt = frame.nowMs;

      if (frame.nowMs - activeWindow.startedAt >= windowMs) {
        flushWindow(frame.nowMs);
      }
    },
    setOptions(options: SongChangeDetectorOptions) {
      if (options.windowMs !== undefined) windowMs = options.windowMs;
      if (options.minTrackMs !== undefined) minTrackMs = options.minTrackMs;
      if (options.silenceThreshold !== undefined) silenceThreshold = options.silenceThreshold;
      if (options.changeThreshold !== undefined) changeThreshold = options.changeThreshold;
      if (options.confirmWindows !== undefined) confirmWindows = Math.max(1, options.confirmWindows);
      if (options.cooldownMs !== undefined) cooldownMs = options.cooldownMs;
    },
    reset() {
      activeWindow = null;
      baselineSignature = null;
      baselineAccumulator = null;
      baselineWindows = 0;
      baselineStartedAt = 0;
      consecutiveChanges = 0;
      pendingSignature = null;
      lastDetectionAt = -Infinity;
      lastWindowDistance = 0;
      prevMag = null;
      prevMagAt = -Infinity;
    },
    getState() {
      return {
        baselineSignature,
        baselineStartedAt,
        consecutiveChanges,
        pendingSignature,
        lastDetectionAt,
        lastWindowDistance
      };
    }
  };
};
