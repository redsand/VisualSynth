/**
 * Shazam audio fingerprint signature generator.
 *
 * Implements the Shazam Landmark fingerprinting algorithm as reverse-engineered
 * by independent researchers and documented in the ShazamIO project.
 * No API key required — uses the same internal endpoint as the Shazam mobile app.
 *
 * Input: signed 16-bit PCM at 16 000 Hz mono (Int16Array)
 * Output: ArrayBuffer containing the vnd.shazam.sig binary signature
 */

// ---------------------------------------------------------------------------
// CRC-32
// ---------------------------------------------------------------------------

const CRC32_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    t[i] = c;
  }
  return t;
})();

function crc32(buf: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC32_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ---------------------------------------------------------------------------
// Hanning window — np.hanning(2050)[1:-1], length 2048
// ---------------------------------------------------------------------------

const HANNING_WINDOW = (() => {
  const w = new Float64Array(2048);
  for (let i = 0; i < 2048; i++) {
    w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * (i + 1)) / 2049));
  }
  return w;
})();

// ---------------------------------------------------------------------------
// In-place radix-2 Cooley-Tukey complex FFT (size must be power of 2)
// ---------------------------------------------------------------------------

function fftInPlace(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  // Bit-reversal permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  // Cooley-Tukey butterfly
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curRe = 1.0;
      let curIm = 0.0;
      for (let j = 0; j < len / 2; j++) {
        const uRe = re[i + j];
        const uIm = im[i + j];
        const vRe = re[i + j + len / 2] * curRe - im[i + j + len / 2] * curIm;
        const vIm = re[i + j + len / 2] * curIm + im[i + j + len / 2] * curRe;
        re[i + j] = uRe + vRe;
        im[i + j] = uIm + vIm;
        re[i + j + len / 2] = uRe - vRe;
        im[i + j + len / 2] = uIm - vIm;
        const nextRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FFT_SIZE = 2048;
const HOP_SIZE = 128;
const FFT_OUT_BINS = FFT_SIZE / 2 + 1; // 1025
const RING_SIZE = 256;
const INV_32768 = 1 / 32768;

// Frequency band Hz ranges
const BAND_RANGES = [
  [250, 520],
  [520, 1450],
  [1450, 3500],
  [3500, 5500],
] as const;

// Each band tag = 0x60030040 + bandIndex
const BAND_TAG_BASE = 0x60030040;

// Frequency resolution: 16000 / 2048 Hz per bin
const HZ_PER_BIN = 16000 / 2048;

// Log-magnitude scaling factor
const LOG_SCALE = 1477.3;
const LOG_OFFSET = 6144;

// ---------------------------------------------------------------------------
// Ring-buffer helper
// ---------------------------------------------------------------------------

function ringIdx(absolute: number): number {
  return ((absolute % RING_SIZE) + RING_SIZE) % RING_SIZE;
}

// ---------------------------------------------------------------------------
// ShazamSignatureGenerator
// ---------------------------------------------------------------------------

interface Peak {
  fftPass: number;
  magnitude: number;   // int, log-scaled
  freqBin: number;     // int, sub-bin corrected (multiply by 64)
  bandIndex: number;
}

export class ShazamSignatureGenerator {
  // Sample ring buffer (2048 samples)
  private readonly sampleRing = new Float64Array(FFT_SIZE);
  private ringWritePos = 0;
  private numSamplesIngested = 0;

  // FFT history rings (RING_SIZE × FFT_OUT_BINS)
  private readonly fftOutRing: Float64Array[] = Array.from({ length: RING_SIZE }, () => new Float64Array(FFT_OUT_BINS));
  private readonly spreadRing: Float64Array[] = Array.from({ length: RING_SIZE }, () => new Float64Array(FFT_OUT_BINS));

  // Scratch buffers
  private readonly fftRe = new Float64Array(FFT_SIZE);
  private readonly fftIm = new Float64Array(FFT_SIZE);
  private readonly freqSpread = new Float64Array(FFT_OUT_BINS);

  // Total FFT passes executed (= write pointer for both rings)
  private numFFTPasses = 0;

  // Collected peaks per band (in order of fftPass ascending)
  private readonly peaksByBand: Peak[][] = [[], [], [], []];

  // Whether we have enough history to start detecting peaks. detectPeaks reads
  // spreadRing[ringIdx(p - 49)] as the frequency-local-max baseline (spdM49);
  // that slot is only written once pass (p - 49) has executed, i.e. p >= 49.
  // Gating at 46 (the fftM46 lookback) left p=46,47,48 reading never-written
  // (zero) spread slots, making the freq-local-max check vacuous and admitting
  // spurious peaks on the first 3 detection passes.
  private get canDetectPeaks(): boolean {
    return this.numFFTPasses >= 49;
  }

  // ---------------------------------------------------------------------------
  // Public interface
  // ---------------------------------------------------------------------------

  get numSamples(): number {
    return this.numSamplesIngested;
  }

  get totalPeaks(): number {
    return this.peaksByBand.reduce((s, b) => s + b.length, 0);
  }

  get durationSeconds(): number {
    return this.numSamplesIngested / 16000;
  }

  /** Returns true once we've processed enough to stop (3.1 s or 255 peaks). */
  get isFull(): boolean {
    return this.durationSeconds >= 3.1 || this.totalPeaks >= 255;
  }

  /**
   * Feed signed 16-bit mono PCM samples at 16 000 Hz.
   * Processes in HOP_SIZE (128) sample batches.
   */
  feed(samples: Int16Array): void {
    let offset = 0;
    while (offset < samples.length && !this.isFull) {
      const remaining = Math.ceil((3.1 * 16000) - this.numSamplesIngested);
      const batch = Math.min(HOP_SIZE, samples.length - offset, remaining);
      for (let i = 0; i < batch; i++) {
        this.sampleRing[this.ringWritePos] = samples[offset + i] * INV_32768;
        this.ringWritePos = (this.ringWritePos + 1) & (FFT_SIZE - 1);
      }
      offset += batch;
      this.numSamplesIngested += batch;

      if (batch < HOP_SIZE) break; // Last partial batch — don't run FFT yet
      this.runFFTPass();
    }
  }

  // ---------------------------------------------------------------------------
  // Core DSP
  // ---------------------------------------------------------------------------

  private runFFTPass(): void {
    // --- 1. Unroll ring buffer into FFT scratch, apply Hanning window ---
    const startPos = this.ringWritePos; // oldest sample
    for (let i = 0; i < FFT_SIZE; i++) {
      const sampleIdx = (startPos + i) & (FFT_SIZE - 1);
      this.fftRe[i] = this.sampleRing[sampleIdx] * HANNING_WINDOW[i];
    }
    this.fftIm.fill(0);

    // --- 2. FFT ---
    fftInPlace(this.fftRe, this.fftIm);

    // --- 3. Magnitude: (re² + im²) / 2^17, floor-clamped to 1e-10 ---
    const fftOut = this.fftOutRing[ringIdx(this.numFFTPasses)];
    for (let k = 0; k < FFT_OUT_BINS; k++) {
      const mag = (this.fftRe[k] * this.fftRe[k] + this.fftIm[k] * this.fftIm[k]) / 131072.0;
      fftOut[k] = mag < 1e-10 ? 1e-10 : mag;
    }

    // --- 4. Frequency spreading (max of bins [i], [i+1], [i+2]) ---
    for (let i = 0; i < FFT_OUT_BINS - 3; i++) {
      this.freqSpread[i] = Math.max(fftOut[i], fftOut[i + 1], fftOut[i + 2]);
    }
    // Last 3 bins not spread
    this.freqSpread[FFT_OUT_BINS - 3] = fftOut[FFT_OUT_BINS - 3];
    this.freqSpread[FFT_OUT_BINS - 2] = fftOut[FFT_OUT_BINS - 2];
    this.freqSpread[FFT_OUT_BINS - 1] = fftOut[FFT_OUT_BINS - 1];

    // --- 5. Time spreading: update ring entries at -1, -3, -6 from current ---
    const p = this.numFFTPasses;
    const sp1 = this.spreadRing[ringIdx(p - 1)];
    const sp3 = this.spreadRing[ringIdx(p - 3)];
    const sp6 = this.spreadRing[ringIdx(p - 6)];
    const curSpread = this.spreadRing[ringIdx(p)];

    for (let i = 0; i < FFT_OUT_BINS; i++) {
      let runMax = this.freqSpread[i];
      if (sp1[i] > runMax) runMax = sp1[i]; else sp1[i] = runMax;
      if (sp3[i] > runMax) runMax = sp3[i]; else sp3[i] = runMax;
      if (sp6[i] > runMax) runMax = sp6[i]; else sp6[i] = runMax;
    }
    // Store the freq-spread (not time-spread) result as the new ring entry
    curSpread.set(this.freqSpread);

    this.numFFTPasses++;

    // --- 6. Peak detection ---
    if (this.canDetectPeaks) {
      this.detectPeaks();
    }
  }

  private detectPeaks(): void {
    // We detect peaks at FFT pass (numFFTPasses - 46 - 1) using:
    //   fft_minus_46  = fftOutRing[(numFFTPasses - 46) % RING_SIZE]
    //   spread_minus_49 = spreadRing[(numFFTPasses - 49) % RING_SIZE]
    const p = this.numFFTPasses;
    const fftM46 = this.fftOutRing[ringIdx(p - 46)];
    const spdM49 = this.spreadRing[ringIdx(p - 49)];
    const peakPass = p - 46;

    // Time-axis spread history pointers (offsets relative to current p)
    // Negative: p-53, p-45
    // Wrapped positive in 256-ring: p+165=p-91, p+172=p-84, p+179=p-77,
    //   p+186=p-70, p+193=p-63, p+200=p-56, p+214=p-42, p+221=p-35,
    //   p+228=p-28, p+235=p-21, p+242=p-14, p+249=p-7
    const timeOffsets = [-53, -45, -91, -84, -77, -70, -63, -56, -42, -35, -28, -21, -14, -7];

    for (let bin = 10; bin <= 1014; bin++) {
      const mag = fftM46[bin];

      // Threshold
      if (mag < 1 / 64) continue;
      if (mag < spdM49[bin - 1]) continue;

      // Frequency-domain local maximum
      let isFreqMax = true;
      // Offsets: range(-10, -3, 3) = -10, -7, -4; then -3; then 1; then range(2, 9, 3) = 2, 5, 8
      const freqOffsets = [-10, -7, -4, -3, 1, 2, 5, 8];
      for (const fo of freqOffsets) {
        if (spdM49[bin + fo] >= mag) { isFreqMax = false; break; }
      }
      if (!isFreqMax) continue;

      // Time-domain local maximum
      let isTimeMax = true;
      for (const to of timeOffsets) {
        const spdT = this.spreadRing[ringIdx(p + to)];
        if (spdT[bin - 1] >= mag) { isTimeMax = false; break; }
      }
      if (!isTimeMax) continue;

      // Parabolic interpolation for sub-bin frequency correction
      const magC = Math.log(Math.max(1 / 64, fftM46[bin])) * LOG_SCALE + LOG_OFFSET;
      const magB = Math.log(Math.max(1 / 64, fftM46[bin - 1])) * LOG_SCALE + LOG_OFFSET;
      const magA = Math.log(Math.max(1 / 64, fftM46[bin + 1])) * LOG_SCALE + LOG_OFFSET;

      const variation1 = magC * 2 - magB - magA;
      if (variation1 === 0) continue; // prevent division by zero

      const variation2 = ((magA - magB) * 32) / variation1;
      const correctedBin = bin * 64 + variation2;
      const freqHz = correctedBin * (16000 / 2 / 1024 / 64);

      // Band assignment
      let bandIndex = -1;
      for (let b = 0; b < BAND_RANGES.length; b++) {
        const [lo, hi] = BAND_RANGES[b];
        if (freqHz > lo && freqHz <= hi) { bandIndex = b; break; }
      }
      if (bandIndex < 0) continue;

      this.peaksByBand[bandIndex].push({
        fftPass: peakPass,
        magnitude: Math.trunc(magC),
        freqBin: Math.trunc(correctedBin),
        bandIndex
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Binary encoding
  // ---------------------------------------------------------------------------

  encode(): ArrayBuffer {
    const numSamples = this.numSamplesIngested;
    const sampleRateCode = 3; // 16 000 Hz

    // Compute content size (after the 48-byte fixed header):
    // 8 bytes TLV preamble + sum of band blocks
    const bandBuffers: Uint8Array[] = [];
    for (let b = 0; b < 4; b++) {
      bandBuffers.push(this.encodeBand(this.peaksByBand[b]));
    }

    const tlvPreambleSize = 8;
    let contentSize = tlvPreambleSize;
    for (const bb of bandBuffers) {
      if (bb.length > 0) {
        const paddedSize = bb.length + ((-bb.length) & 3); // round up to 4-byte alignment
        contentSize += 8 + paddedSize; // 4 tag + 4 length + data + padding
      }
    }

    const totalSize = 48 + contentSize;
    const buf = new ArrayBuffer(totalSize);
    const view = new DataView(buf);
    const bytes = new Uint8Array(buf);

    // --- Fixed header (48 bytes) ---
    view.setUint32(0, 0xcafe2580, true);  // magic1
    // CRC at offset 4 — filled in later
    view.setUint32(8, contentSize, true); // size_minus_header
    view.setUint32(12, 0x94119c00, true); // magic2
    // 12 bytes of zeros at 16-27 (void1)
    view.setUint32(28, sampleRateCode << 27, true); // shifted_sample_rate_id
    // 8 bytes of zeros at 32-39 (void2)
    view.setUint32(40, Math.trunc(numSamples + 16000 * 0.24), true); // number_samples_plus_...
    view.setUint32(44, 0x007c0000, true); // fixed_value

    // --- TLV preamble (8 bytes at offset 48) ---
    view.setUint32(48, 0x40000000, true);
    view.setUint32(52, contentSize, true);

    // --- Frequency band TLV sections ---
    let offset = 56;
    for (let b = 0; b < 4; b++) {
      const data = bandBuffers[b];
      if (data.length === 0) continue;

      view.setUint32(offset, BAND_TAG_BASE + b, true); // frequency_band_tag
      offset += 4;
      view.setUint32(offset, data.length, true); // peaks_data_size (unpadded)
      offset += 4;
      bytes.set(data, offset);
      offset += data.length;
      // Padding to 4-byte boundary
      const pad = (-data.length) & 3;
      offset += pad; // zeros already (ArrayBuffer initialized to 0)
    }

    // --- CRC-32 over bytes[8..end] ---
    const crcValue = crc32(bytes.subarray(8));
    view.setUint32(4, crcValue, true);

    return buf;
  }

  private encodeBand(peaks: Peak[]): Uint8Array {
    if (peaks.length === 0) return new Uint8Array(0);

    // Sort ascending by fftPass (should already be, but ensure)
    peaks.sort((a, b) => a.fftPass - b.fftPass);

    // Estimate max byte size: 5 bytes/peak + possible 5-byte reset markers
    const maxSize = peaks.length * 10 + 5;
    const tmp = new Uint8Array(maxSize);
    let pos = 0;
    let prevPass = -1;

    for (const peak of peaks) {
      const delta = prevPass < 0 ? 0 : peak.fftPass - prevPass;
      if (delta >= 255) {
        // Write reset marker
        tmp[pos++] = 0xff;
        new DataView(tmp.buffer).setUint32(pos, peak.fftPass, true);
        pos += 4;
        prevPass = peak.fftPass;
        // Then write delta of 0
        tmp[pos++] = 0;
      } else {
        tmp[pos++] = delta;
      }
      // peak_magnitude (uint16 LE)
      new DataView(tmp.buffer).setUint16(pos, peak.magnitude & 0xffff, true);
      pos += 2;
      // corrected_peak_frequency_bin (uint16 LE)
      new DataView(tmp.buffer).setUint16(pos, peak.freqBin & 0xffff, true);
      pos += 2;
      prevPass = peak.fftPass;
    }

    return tmp.slice(0, pos);
  }
}

// ---------------------------------------------------------------------------
// Public helper: build signature URI from Int16 PCM
// ---------------------------------------------------------------------------

export function buildShazamSignatureUri(pcmS16le: Int16Array, numSamples: number): string {
  const gen = new ShazamSignatureGenerator();
  gen.feed(pcmS16le);
  const sigBytes = gen.encode();
  const base64 = bufferToBase64(sigBytes);
  return `data:audio/vnd.shazam.sig;base64,${base64}`;
}

function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export const SHAZAM_SAMPLE_RATE = 16000;
