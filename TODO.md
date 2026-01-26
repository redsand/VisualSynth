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

## Milestone 5: Collaboration & Pro Toolkit
- [x] Project diff/merge tool for teams.
- [x] Asset manager for custom shaders and textures.
- [x] Plugin SDK for generators/effects.
