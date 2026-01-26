# VisualSynth To-Do

This document tracks the feature request list and upcoming milestones.

## Process (Per Major Feature)
- [ ] Add or update tests for the feature.
- [ ] Ensure tests pass successfully.
- [ ] Increment the version.

## Milestone 2: Visual System Expansion
- [ ] Layer effects: bloom, blur, chromatic aberration, posterize, kaleidoscope.
- [ ] Feedback tunnel + trails/persistence.
- [ ] Reorderable layer stack with drag-and-drop.
- [ ] GPU particle field and SDF shape generator.

## Pre-Milestone 2: Prioritized Feature Requests

### Performance-first Experience
- [ ] Dual output pipeline: preview window + dedicated fullscreen output with resolution scaling.
- [ ] Latency dashboard: surface input/output latency with device hints and health checks.
- [ ] Scene quantization HUD: beat-locked scene changes with explicit countdowns.

### Visual Identity
- [ ] Signature looks: ship a curated "VisualSynth DNA" pack (plasma, feedback tunnel, spectral bloom).
- [ ] Generator library: quick-add menu with favorites and recently used generators.
- [ ] Style presets: contrast + saturation + palette presets at scene or master level.

### Intuitive Control
- [ ] Macro system: 8 macros visible at all times (MIDI learn enabled by default).
- [ ] Inline learn mode: click any parameter, move a MIDI control to map instantly.
- [ ] Pad layers: on-screen 8x8 grid mirrors hardware and shows bank status.

### Content & Sharing
- [ ] Preset exchange: export/import single scenes and macro pages as shareable files.
- [ ] Template projects: genre-focused templates (Ambient, Techno, Experimental, VJ).
- [ ] Versioned migrations: automatic upgrade when loading legacy projects.

### Live Reliability
- [ ] Safe mode boot: fallback visual layer if audio or GPU initialization fails.
- [ ] Watchdog monitor: detect frame drops and propose performance adjustments.
- [ ] Session recovery: autosave a recovery snapshot every 2 minutes.

## Milestone 3: Modulation & MIDI Depth
- [ ] Mod matrix UI with smoothing, curve, min/max clamps.
- [ ] LFOs, ADSR envelopes, sample & hold.
- [ ] MIDI CC/aftertouch mapping editor.
- [ ] 4 bank pages (A/B/C/D) for pad mapping.

## Milestone 4: Output & Recording
- [ ] Dedicated output window (projector mode).
- [ ] Recording via MediaRecorder and optional ffmpeg integration.
- [ ] Screenshot export and timeline markers.

## Milestone 5: Collaboration & Pro Toolkit
- [ ] Project diff/merge tool for teams.
- [ ] Asset manager for custom shaders and textures.
- [ ] Plugin SDK for generators/effects.
