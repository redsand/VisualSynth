# Song-change detection redesign (2026-11-06)

## Why auto-detect never fired at live shows

Three independent failures, each sufficient on its own:

1. **The mic read near-silence** (first week of October and before). `getUserMedia`
   ran with Chromium's voice-call defaults (echoCancellation,
   noiseSuppression, autoGainControl). Noise suppression gates sustained tones
   and echo cancellation subtracts the music playing out of the machine's
   speakers, so the stream was "live" (mic indicator on) but the analyser saw
   ~0 — below the detector's `silenceThreshold`, meaning no windows ever
   aggregated. Fixed 2026-10-23 in d1540b0d (disable voice-call processing).

2. **The v1 feature could not discriminate songs.** The detector compared
   amplitude-normalized 8-band spectral shapes. Measured 2026-10-22 via
   `scripts/probe-spectral-distance.ts` (Danza Kuduro vs Da' Butt — two very
   different songs): settled distance 0.077 (64-bin path 0.067), rolling
   windows 0.03–0.047, vs same-song drift 0.02–0.03 — the distributions
   OVERLAP. No threshold tuning can fix features whose signal-to-noise is
   ~0.5. (During the first week of October the shipped threshold was 0.42 with
   3 confirm windows and a 45s baseline — on top of that.)

3. **The failure was invisible.** The session logs recorded ZERO song-detection
   events — no enabled/disabled record, no state changes, no distance
   telemetry. From the logs alone, "never fired" was indistinguishable from
   "was never on". (Confirmed: no `song*` event exists in any surviving
   session log. Note: the first-week-of-October logs themselves were rotated
   out by the 10-file `SESSION_MAX_FILES` cap when the 10-23/24 pre-show
   E2E sessions ran.)

## The v2 detector

`src/renderer/audio/songChangeDetector.ts` now builds a two-block signature
per 2.5s window:

- **shape** — normalized 64-bin log-spaced spectrum mean (prefers the fine
  spectrum over the coarse 8 bands; loudness-invariant timbre)
- **flux** — normalized per-bin mean positive rise rate `max(0, m−prev)/dt`
  (rhythmic texture: where and how fast energy enters each band; frame gaps
  > 500ms resync instead of aggregating a fake rise)

Distance = 0.5·TV(shape) + 0.5·TV(flux).

### Calibration (scripts/probe-song-features.ts)

rAF-rate frames through an AnalyserNode configured exactly like AudioEngine's
(fftSize 2048, smoothing 0.7), real songs (Danza Kuduro, Da' Butt, Cha Cha
Slide, foreveer-candle), 2.5s windows:

| distribution            | min  | median | max  |
|-------------------------|------|--------|------|
| same-song adjacent windows | 0.017 | 0.119 | 0.282 |
| cross-song windows      | 0.063 | 0.160 | 0.341 |

`changeThreshold` default is now **0.15** — just under the cross-song median,
so a typical transition crosses within ~2 confirm windows (5s), while steady
same-song playback sits at/below it. Tempo/beat autocorrelation was also
evaluated as a third feature and REJECTED: on 2.5s windows the periodicity
estimates flip between harmonics and do not separate same-song from
cross-song (probe prints the numbers).

The distributions overlap in the tails: section changes within a song can
fire. This is an accepted trade — the lookup gate
(`src/shared/nowPlayingGate.ts`) skips small-distance firings, dedupes
same-track recognitions, and the geometric cooldown makes repeat fires cheap,
while a MISSED change costs the whole feature. Recall is prioritized.

### Verification

- `tests/songChangeDetector.test.ts` — 7 pass (incl. new: flux-only
  discrimination where shape is identical; stall-gap resync; two-window
  baseline semantics)
- `scripts/e2e-song-smoke.ts danza.mp3 --song2 swagsurfin.mp3` — **7/7,
  full production chain on real music**: auto-detector fired on the real
  song1→song2 transition (trigger = "auto song-change detector", not the
  manual fallback); the first 6s clip was thin (38-peak fingerprint, the
  transition ramp) and no-matched; the gate's ~10s bounded retry captured a
  fresh 11.2s clip (189 peaks) and **Shazam matched the NEW song**; the
  title overlay was created with it. First recorded end-to-end auto-path
  success.

### Post-validation fixes (2026-11-06, same day)

Validation exposed three further defects, all fixed:

1. **Fade-in baselines false-fire.** The e2e's 2s fade-in taught the detector
   a "ramp" baseline whose flux profile differs from steady-state playback —
   the song's own body then read as a change and fired once right when the
   `minTrackMs` gate opened (~35s in), BEFORE the real transition. The
   baseline is now averaged over the first two completed windows
   (`BASELINE_WINDOWS`), so an unrepresentative opening can't arm the
   detector against the song's own steady state. Same protection applies to
   quiet song intros in real sets.

2. **Block mass mismatch.** The averaged baseline was normalized as one
   128-element vector, halving each block's mass against full-mass
   comparison windows — inflating EVERY same-song distance by ~0.25, which
   would have caused constant false fires. Baselines now renormalize per
   block (shape, flux).

3. **Clip straddling (the lag-one-song bug).** The 12s capture window
   exported at detection time is dominated by the PREVIOUS track — Shazam
   matched the old song, the same-track gate suppressed the overlay update,
   and the displayed title lagged one song until the next transition.
   Detector-triggered lookups now export the most recent 6s (`DETECTOR_CLIP_MS`),
   all-new-song audio; a thin first clip (quiet intro, 53-peak fingerprint)
   falls through to the gate's ~10s bounded retry with a fresh clip, which
   matches (the e2e now waits for that retry, mirroring production).

### Honest limits (measured, not guessed)

- **Bass-heavy dance ↔ bass-heavy dance transitions measure 0.065–0.15** —
  at or below the 0.15 default threshold. Danza Kuduro ↔ Da' Butt (reggaeton
  ↔ go-go funk) sits at ~0.09: the detector will NOT auto-fire on this
  class of transition; it will on well-separated pairs (dance ↔ ballad
  measured 0.15–0.24; the live meter read same-song drift ~0.11 vs
  transition ≥0.15, matching the probe distributions almost exactly).
- **Onset-flux was evaluated and REJECTED**: computing the rise-rate from an
  unsmoothed analyser (`scripts/probe-onset-flux.ts`) yields noisier windows
  — same-song median 0.079 vs cross-song 0.114, WORSE separation than the
  smoothed flux (0.106/0.148). Beat/periodicity autocorrelation was also
  rejected (harmonic flips; no separation).
- For seamless DJ sets of similar masters, the **metadata bridge (What's Now
  Playing) remains the primary source**; auto-detect supplements it for
  clearly-separated transitions and fully silent breaks. `changeThreshold` is
  exposed in the settings modal (with the live spectral-change meter) for
  per-venue tuning.

## Telemetry (the gap that hid all of this)

The session log now records:

- `song.settings` — full detection-settings snapshot on every settings change
  (boot load included): enabled, provider, freeShazamFirst,
  lookupConfigured, metadataBridge, changeThreshold, confirmWindows,
  minTrackMs, silenceThreshold
- `audio.engine_init` — now carries the same `songDetection` snapshot at
  device setup
- `song.change_detected` — fired detections with distance + threshold
- `song.detection_state` — every listening/detected/cooldown/idle transition
- `song.detection_telemetry` — 30s heartbeat while enabled: state, distance,
  threshold, confidence, detection counters

Re-tuning after a gig now means reading the log, not guessing.
