# VisualSynth To-Do

This document tracks the feature request list and upcoming milestones.

## Process (Per Major Feature)
- [ ] Add or update tests for the feature.
- [ ] Ensure tests pass successfully.
- [ ] Increment the version.

## Milestone 2: Visual System Expansion
- [x] Layer effects: bloom, blur, chromatic aberration, posterize, kaleidoscope.
- [x] Feedback tunnel + trails/persistence.
- [x] Reorderable layer stack with drag-and-drop.
- [x] GPU particle field and SDF shape generator.

## Pre-Milestone 2: Prioritized Feature Requests

### Performance-first Experience
- [x] Dual output pipeline: preview window + dedicated fullscreen output with resolution scaling.
- [x] Latency dashboard: surface input/output latency with device hints and health checks.
- [x] Scene quantization HUD: beat-locked scene changes with explicit countdowns.

### Visual Identity
- [x] Signature looks: ship a curated "VisualSynth DNA" pack (plasma, feedback tunnel, spectral bloom).
- [x] Generator library: quick-add menu with favorites and recently used generators.
- [x] Style presets: contrast + saturation + palette presets at scene or master level.

### Intuitive Control
- [x] Macro system: 8 macros visible at all times (MIDI learn enabled by default).
- [x] Inline learn mode: click any parameter, move a MIDI control to map instantly.
- [x] Pad layers: on-screen 8x8 grid mirrors hardware and shows bank status.

### Content & Sharing
- [x] Preset exchange: export/import single scenes and macro pages as shareable files.
- [x] Template projects: genre-focused templates (Ambient, Techno, Experimental, VJ).
- [x] Versioned migrations: automatic upgrade when loading legacy projects.

### Live Reliability
- [x] Safe mode boot: fallback visual layer if audio or GPU initialization fails.
- [x] Watchdog monitor: detect frame drops and propose performance adjustments.
- [x] Session recovery: autosave a recovery snapshot every 2 minutes.

## Milestone 3: Modulation & MIDI Depth
- [x] Mod matrix UI with smoothing, curve, min/max clamps.
- [x] LFOs, ADSR envelopes, sample & hold.
- [x] MIDI CC/aftertouch mapping editor.
- [x] 4 bank pages (A/B/C/D) for pad mapping.

## Milestone 4: Output & Recording
- [x] Dedicated output window (projector mode).
- [x] Recording via MediaRecorder and optional ffmpeg integration.
- [x] Screenshot export and timeline markers.

- ## Input & Content Sources (Post-Milestone 4)
- [x] Image ingestion pipeline (import PNG/JPG/WebP, textures, mipmaps, color space handling).
  - [x] Capture texture color space metadata alongside dimensions.
  - [x] Surface texture sampling/mipmap toggles in the UI.
- [x] Video ingestion pipeline (file playback, frame-accurate seek, looping, reverse, blend modes).
  - [x] Store playback preferences (loop, reverse, playback rate, frame blend) with each asset.
  - [x] Capture duration/metadata for accurate frame-sync tooling.
  - [x] Asset blend modes (Normal, Add, Multiply, Screen, Overlay, Difference) for layer composition.
  - [x] Audio reactivity for assets (scale/brightness modulated by RMS, peak, and spectrum bands).
  - [x] UV effects applied to assets (kaleidoscope, feedback transforms match procedural layers).
- [x] Live capture support (webcam/capture card + NDI/Spout/Syphon + screen capture).
- [x] Text input layer (SDF typography, captions, lyrics, dynamic text overlays).
- [x] Asset pipeline enhancements (hashing, caching, thumbnails, recovery for missing assets).
- [x] Asset manager UI (thumbnails/previews, tagging/metadata editing, live-source handling, ingest state control before output window opens).
- [x] Bind cached textures/videos to the renderer (upload textures, bind video frames, link layer selectors) so the ingestion pipeline feeds visuals.

## Networking & Clock Systems
- [x] Integrate a Pro DJ Link listener (using `prolink-connect`) so the engine can surface Pioneer network state.
- [x] Expose a BPM detection interface that can read via Pioneer protocol, via internal audio analysis, and via user-configurable presets (ranges such as 40-120, 80-150, 100-200).
- [x] Provide a stub network service so future DJ-link data sources can be replayed or simulated.
- [x] Replace the fast/simple FFT mode with a more stable tempo analyzer (onset smoothing, confidence gating, hysteresis) that can act as a fallback audio clock source.

## Render Graph & FX System
- [x] Define and document a strict Visual Node API for Generators/Effects/Compositors (parameter schema, modulation targets, deterministic defaults, GPU cost tiers, test hooks).
- [x] Build the FX catalog standard so every effect declares inputs/outputs, default values, modulation targets, GPU cost tier, and verification guidance.
- [x] Implement a generator -> FX -> compositor node model with sends/returns, multi-output routing, and feedback taps.
- [x] Track resource lifecycle requirements (FBO/texture pooling, resolution negotiation per node, shared texture reuse).

## Timing, Automation & Modulation
- [ ] Expand the transport to cover play/stop, BPM, time signature, and shared beat phase/quantization across scenes.
- [ ] Add beat grid, tap-tempo, quantized scene clips, and lightweight automation lanes that can record+play back parameter moves.
- [ ] Strengthen the modulation source list: onset detection, band-limited envelopes (sub/low/mid/high), spectral centroid/flux/rolloff, pitch estimates, peak hold/gating/hysteresis utilities.
- [ ] Ensure BPM ranges sourced from networking or analysis can be smoothed before driving FX.

## Visual Identity & Color Pipeline
- [ ] Formalize color management (sRGB vs linear assets, gamma-correct blending, tone mapping controls).
- [ ] Add LUT (3D LUT) support plus palette/ramp presets with locking options and consistent dithering/film-grain helpers.
- [ ] Create high-level palette/system presets that can be applied per scene or master layer for a professional finish.

## Performance & Safety Engineering
- [ ] Build guardrails such as FBO/texture pooling, dynamic resolution negotiation, and quality scaling (sample counts, particle detail) when budgets are exceeded.
- [ ] Introduce GPU timing instrumentation (EXT_disjoint_timer_query or equivalent) and shader compilation strategies (warm-up, async compile, fallback shaders).
- [ ] Surface a performance dashboard (watchdog) that triggers adjustments and logs metrics.

## Testing & Validation
- [ ] Author deterministic render modes (fixed seed, fixed timestep) for golden-image captures and regression tests.
- [ ] Create shader validation checks (compile-time + uniform binding) and schema validators for project files.
- [ ] Establish pixel/pipeline regression harnesses (golden image diff with tolerance, buffer snapshot comparison).

## Plugin Toolkit & Generative Content
- [ ] Define a versioned plugin API with capability flags, sandbox boundaries, crash isolation, and asset access rules.
- [ ] Scope generative content beyond shaders (procedural noise, fractals, SDF worlds, particles, typographic generators, optional ML-assisted modules like optical flow/style transfer if realtime-safe).
- [ ] Provide seeded randomness controls so saved scenes can replay deterministically or mutate from the same seed.

## Templates, Presets & Libraries
- [ ] Expand generator/effect libraries with many templates (neuro bass tunnel, liquid chrome field, glitch cathedral, data storm, psychedelic mandala, cinematic slow-burn, aggressive DnB/dubstep mode, ambient generative art).
- [ ] Ship signature presets per FX category and curated packs inspired by Redsand Networks/Note Sniffer DNA.
## Milestone 5: Collaboration & Pro Toolkit
- [x] Project diff/merge tool for teams.
- [x] Asset manager for custom shaders and textures.
- [x] Plugin SDK for generators/effects.
