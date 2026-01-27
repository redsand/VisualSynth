# VisualSynth

## LLM Implementation Prompt (Keep at Top)
You are the VisualSynth implementation assistant. Build features in small, shippable increments with test coverage where practical. Follow the product principles (one-screen launch, safe defaults, muscle memory, clear feedback, progressive disclosure) and keep performance-first constraints (GPU-first rendering, 60 FPS target, low-latency audio/MIDI). For each feature, produce a clear plan, update documentation, and add or update tests when possible. Avoid breaking the installer pipeline or project format. Prefer deterministic, testable code paths and document any known tradeoffs or limitations.

Realtime audio + MIDI reactive visual synthesizer for live performance and creative coding.

## Features (Milestone 1)
- Electron + TypeScript architecture.
- GPU-accelerated WebGL2 renderer with plasma + spectrum layers.
- Audio input device selection with realtime RMS + FFT analysis.
- MIDI input (WebMIDI with node-midi fallback) and 8x8 pad grid.
- Save/load project JSON and apply bundled presets.
- Electron-builder packaging with NSIS installer + portable build.

## Product Principles (Make it Intuitive)
- **One-screen launch:** audio input, MIDI input, and scene/preset selection are visible immediately.
- **Safe defaults:** every new project renders visuals with meaningful audio response.
- **Muscle memory:** shortcuts and pad behavior are consistent across modes.
- **Clear feedback:** status bar always reports audio/MIDI state, recording, and performance.
- **Progressive disclosure:** simple mode for performers, advanced mode for deep control.

## UX Reimagination (Four-Mode Architecture)
See the full product experience redesign in `docs/UX_REIMAGINE.md`.

## Differentiators & Feature Exploration

### Performance-first Experience
- **Dual output pipeline:** preview window + dedicated fullscreen output with resolution scaling.
- **Latency dashboard:** surface input/output latency with device hints and health checks.
- **Scene quantization HUD:** beat-locked scene changes with explicit countdowns.

### Visual Identity
- **Signature looks:** ship a curated “VisualSynth DNA” pack (plasma, feedback tunnel, spectral bloom).
- **Generator library:** quick-add menu with favorites and recently used generators.
- **Style presets:** contrast + saturation + palette presets that can be applied at scene or master level.

### Intuitive Control
- **Macro system:** 8 macros visible at all times (MIDI learn enabled by default).
- **Inline learn mode:** click any parameter, move a MIDI control, mapping is applied instantly.
- **Pad layers:** on-screen 8x8 grid mirrors hardware and shows bank status.

### Content & Sharing
- **Preset exchange:** export/import single scenes and macro pages as shareable files.
- **Template projects:** genre-focused templates (Ambient, Techno, Experimental, VJ).
- **Versioned migrations:** automatic upgrade when loading legacy projects.

### Live Reliability
- **Safe mode boot:** fallback visual layer if audio or GPU initialization fails.
- **Watchdog monitor:** detect frame drops and propose performance adjustments.
- **Session recovery:** autosave a recovery snapshot every 2 minutes.

## Feature Roadmap (Next Milestones)

### Milestone 2: Visual System Expansion
- Layer effects: bloom, blur, chromatic aberration, posterize, kaleidoscope.
- Feedback tunnel + trails/persistence.
- Reorderable layer stack with drag-and-drop.
- GPU particle field and SDF shape generator.

### Milestone 3: Modulation & MIDI Depth
- Mod matrix UI with smoothing, curve, min/max clamps.
- LFOs, ADSR envelopes, sample & hold.
- MIDI CC/aftertouch mapping editor.
- 4 bank pages (A/B/C/D) for pad mapping.

### Milestone 4: Output & Recording
- Dedicated output window (projector mode).
- Recording via MediaRecorder and optional ffmpeg integration.
- Screenshot export and timeline markers.

### Milestone 5: Collaboration & Pro Toolkit
- Project diff/merge tool for teams.
- Asset manager for custom shaders and textures.
- Plugin SDK for generators/effects.

## Detailed Implementation Guides (Tracking Success)

### Performance-first Experience

#### Dual Output Pipeline (Preview + Dedicated Fullscreen Output)
**Goal:** Separate operator UI from projector output while allowing resolution scaling.  
**Implementation Plan:**
1. Add an `OutputWindow` manager in the main process to spawn a second BrowserWindow.
2. Create a shared render service that renders to an offscreen canvas or shared texture.
3. Allow output window to select a resolution scale and fullscreen toggle.
4. Expose output configuration via IPC and persist in project settings.
**Success Criteria:**
- Preview maintains UI responsiveness while output renders at target FPS.
**Tests:**
- IPC integration test for output window creation and config serialization.

#### Latency Dashboard
**Goal:** Show audio input latency and MIDI event latency in diagnostics.  
**Implementation Plan:**
1. Measure `AudioContext.baseLatency` and `outputLatency` where supported.
2. Track MIDI event timestamp vs render timestamp to estimate event latency.
3. Render in Diagnostics panel and update every second.
**Success Criteria:**
- Diagnostics reflect changes when switching devices.
**Tests:**
- Unit test for latency formatting utilities.

#### Scene Quantization HUD
**Goal:** Quantized scene switches with beat countdown.  
**Implementation Plan:**
1. Add a tempo clock service with beat grid (internal or tap tempo).
2. Queue scene change requests with quantization (1/4, 1/2, 1 bar).
3. HUD overlay shows “Switching in X beats.”
**Success Criteria:**
- Scene switches align with beat grid in a metronome test.
**Tests:**
- Unit tests for quantization scheduling logic.

### Visual Identity

#### Signature Looks Pack
**Goal:** Ship uniquely branded visual generators.  
**Implementation Plan:**
1. Add new shader generators: feedback tunnel, spectral bloom, plasma variants.
2. Provide curated presets that combine these with known good settings.
3. Tag presets as “VisualSynth DNA.”
**Success Criteria:**
- Dedicated preset category is visible and loadable.
**Tests:**
- Preset schema validation test (already in place).

#### Generator Library
**Goal:** Quick-add UI for generators with favorites.  
**Implementation Plan:**
1. Add a “+ Generator” menu with search.
2. Persist favorites and recent generators in app settings.
3. Provide thumbnail previews or static icons.
**Success Criteria:**
- Users can add a generator without leaving the main screen.
**Tests:**
- Unit test for favorites persistence.

#### Style Presets
**Goal:** Master color grading/palette presets.  
**Implementation Plan:**
1. Implement a master grading shader pass (contrast/saturation/curve).
2. Define preset JSON for palettes and grading settings.
3. Allow scene-level override or master-only.
**Success Criteria:**
- Applying a style preset updates visuals instantly.
**Tests:**
- Serialization test for style preset schema.

### Intuitive Control

#### Macro System (8 Always-visible Macros)
**Goal:** One control surface mapped to multiple parameters.  
**Implementation Plan:**
1. Define macro data structure in project schema (macros, ranges, targets).
2. Create macro UI row and MIDI learn per macro.
3. Apply macro values to mapped parameters in render loop.
**Success Criteria:**
- Macro slider updates multiple params in real-time.
**Tests:**
- Unit test for macro-to-parameter mapping logic.

#### Inline Learn Mode
**Goal:** Click parameter → move MIDI control to auto-map.  
**Implementation Plan:**
1. Add learn state machine in renderer.
2. Capture next MIDI message and store mapping.
3. Provide inline confirmation and undo.
**Success Criteria:**
- Mapping persists and responds immediately.
**Tests:**
- Unit test for learn mode state transitions.

#### Pad Layers + Bank Status
**Goal:** 8x8 pad grid with A/B/C/D banks.  
**Implementation Plan:**
1. Add bank state and UI switcher.
2. Map MIDI notes to pads by bank offset.
3. Visualize bank status and active pads.
**Success Criteria:**
- Banks switch without losing mappings.
**Tests:**
- Unit test for bank-to-pad mapping.

### Content & Sharing

#### Preset Exchange (Scene/Macro Export)
**Goal:** Shareable files for scenes and macros.  
**Implementation Plan:**
1. Add export format for scene-only and macro-only JSON.
2. Add import flow with preview and merge options.
3. Validate version and migrate on load.
**Success Criteria:**
- Exported files can be imported into new projects.
**Tests:**
- Serialization tests for scene-only payloads.

#### Template Projects
**Goal:** Genre-based templates to start quickly.  
**Implementation Plan:**
1. Add templates folder in assets.
2. Provide a “New from Template” dialog.
3. Tag templates with genre metadata.
**Success Criteria:**
- Templates appear in new project modal.
**Tests:**
- Template schema validation tests.

#### Versioned Migrations
**Goal:** Seamless loading of older project versions.  
**Implementation Plan:**
1. Introduce `project.version` migrations in shared module.
2. Apply sequential migrations on load.
3. Log migration report in console.
**Success Criteria:**
- Older presets load without manual edits.
**Tests:**
- Unit tests for migration functions.

### Live Reliability

#### Safe Mode Boot
**Goal:** Fallback visual if GPU/audio fails.  
**Implementation Plan:**
1. Add boot-time checks for WebGL2 and audio input access.
2. If failure, load a basic fallback visual with error banner.
3. Allow retry button to reinitialize.
**Success Criteria:**
- App stays usable even with failures.
**Tests:**
- Unit test for boot state machine.

#### Watchdog Monitor
**Goal:** Detect FPS drops and suggest actions.  
**Implementation Plan:**
1. Track rolling FPS average and variance.
2. If below threshold, prompt to lower resolution or disable effects.
3. Log a diagnostics report.
**Success Criteria:**
- Warning appears after sustained drops.
**Tests:**
- Unit test for watchdog thresholds.

#### Session Recovery Autosave
**Goal:** Autosave recovery snapshots every 2 minutes.  
**Implementation Plan:**
1. Add autosave timer in renderer; save to app data.
2. On boot, check for recovery file and prompt restore.
3. Keep last N snapshots with rotation.
**Success Criteria:**
- Recovery appears after crash simulation.
**Tests:**
- Unit test for snapshot rotation logic.

### Milestone 2: Visual System Expansion

#### Bloom / Blur / Chromatic Aberration / Posterize / Kaleidoscope
**Goal:** GPU shader effects with reorderable stack.  
**Implementation Plan:**
1. Implement a post-processing pipeline with ping-pong framebuffers.
2. Create shader modules for each effect with parameter bindings.
3. Add effect stack UI with reorder and bypass controls.
**Success Criteria:**
- Effects stack updates live without reloading.
**Tests:**
- Unit test for effect stack ordering and serialization.

#### Feedback Tunnel + Trails
**Goal:** Utilize previous frame feedback with trail decay.  
**Implementation Plan:**
1. Store previous frame texture using framebuffer ping-pong.
2. Apply decay multiplier per frame.
3. Allow modulation of feedback strength.
**Success Criteria:**
- Trails respond to audio/midi modulation.
**Tests:**
- Snapshot test for parameter config.

#### Reorderable Layer Stack (Drag-and-drop)
**Goal:** Manage layer order intuitively.  
**Implementation Plan:**
1. Add drag-and-drop UI using pointer events.
2. Update render order based on layer indices.
3. Persist layer ordering in project schema.
**Success Criteria:**
- UI order matches render order after reload.
**Tests:**
- Serialization test for layer order.

#### GPU Particle Field
**Goal:** High-performance particle generator.  
**Implementation Plan:**
1. Use instanced rendering with GPU-based particle update.
2. Drive particle velocity with audio bands.
3. Provide presets for density and motion.
**Success Criteria:**
- 60 FPS with default particle count.
**Tests:**
- Performance benchmark (optional).

#### SDF Shape Generator
**Goal:** Efficient 2D shape rendering.  
**Implementation Plan:**
1. Implement SDF-based shader for circles/lines/polygons.
2. Allow shape count and animation parameters.
3. Integrate with layer system.
**Success Criteria:**
- Shapes are crisp at multiple resolutions.
**Tests:**
- Unit tests for parameter schema.

### Milestone 3: Modulation & MIDI Depth

#### Mod Matrix UI
**Goal:** Visual mod routing with curve and smoothing controls.  
**Implementation Plan:**
1. Render a table of source → target with editable rows.
2. Implement curve and smoothing in modulation engine.
3. Support enable/disable per row.
**Success Criteria:**
- Mod routing affects parameters immediately.
**Tests:**
- Unit test for modulation evaluation.

#### LFOs / ADSR / Sample & Hold
**Goal:** Comprehensive modulation sources.  
**Implementation Plan:**
1. Implement LFO waveforms in shared module.
2. Add ADSR triggered by MIDI notes.
3. Add sample & hold with adjustable rate.
**Success Criteria:**
- LFOs are phase-consistent across frames.
**Tests:**
- Unit tests for waveform generation.

#### MIDI CC / Aftertouch Editor
**Goal:** Full mapping UI with filters.  
**Implementation Plan:**
1. Display active MIDI inputs and message stream.
2. Allow mapping of CC and aftertouch to parameters.
3. Provide range and curve settings per mapping.
**Success Criteria:**
- CC mapping persists across sessions.
**Tests:**
- Unit test for mapping serialization.

#### 4 Bank Pages (A/B/C/D)
**Goal:** Expand pad capacity for performance.  
**Implementation Plan:**
1. Add bank selector and mapping layer.
2. Support bank-specific actions for pads.
3. Visual feedback for active bank and pad.
**Success Criteria:**
- Bank switches do not interrupt active notes.
**Tests:**
- Unit test for bank state transitions.

### Milestone 4: Output & Recording

#### Dedicated Output Window
**Goal:** Projector-friendly fullscreen output.  
**Implementation Plan:**
1. Create separate BrowserWindow with minimal UI.
2. Mirror the render output to that window.
3. Provide hotkey to toggle fullscreen on output.
**Success Criteria:**
- Output window remains stable during UI interactions.
**Tests:**
- IPC tests for output window lifecycle.

#### Recording (MediaRecorder + ffmpeg)
**Goal:** Record visual output to video.  
**Implementation Plan:**
1. Use `MediaRecorder` for WebM recording of canvas stream.
2. Optional ffmpeg integration for MP4 conversion.
3. Provide recording HUD and save path selector.
**Success Criteria:**
- Recording starts/stops reliably and saves a valid file.
**Tests:**
- Integration test for recorder state transitions.

#### Screenshot Export (PNG)
**Goal:** Export canvas snapshots.  
**Implementation Plan:**
1. Expose a UI button and hotkey for screenshot.
2. Use `canvas.toBlob` and save via IPC.
3. Show status confirmation.
**Success Criteria:**
- PNG file saved to user-selected path.
**Tests:**
- Unit test for screenshot path handling.

### Milestone 5: Collaboration & Pro Toolkit

#### Project Diff/Merge
**Goal:** Compare and merge project changes.  
**Implementation Plan:**
1. Implement a JSON diff viewer for project files.
2. Provide conflict resolution UI for scenes/layers.
3. Export merged result as new project.
**Success Criteria:**
- Conflicts can be resolved without data loss.
**Tests:**
- Unit tests for merge strategy.

#### Asset Manager
**Goal:** Manage custom shaders and textures.  
**Implementation Plan:**
1. Add asset import pipeline with metadata (type, size).
2. Cache assets in app data with versioning.
3. Provide asset browser UI and search.
**Success Criteria:**
- Assets persist across app restarts.
**Tests:**
- Unit tests for asset registry.

#### Plugin SDK
**Goal:** Allow third-party generators/effects.  
**Implementation Plan:**
1. Define plugin manifest schema and loading API.
2. Sandbox plugin execution to avoid renderer crashes.
3. Provide developer docs and sample plugin.
**Success Criteria:**
- Sample plugin loads and renders.
**Tests:**
- Plugin manifest validation tests.

### Innovative FX (Standout Differentiators)

#### Dissolve FX (Audio/MIDI Driven)
**Goal:** Dramatic dissolving transitions using noise thresholds.  
**Implementation Plan:**
1. Add a noise-driven dissolve shader (Perlin/Voronoi).
2. Expose threshold, edge glow, and noise scale parameters.
3. Modulate threshold by `audio.rms` and MIDI pad triggers.
**Success Criteria:**
- Dissolve visible at low/medium/high energy.
**Tests:**
- Unit test for dissolve parameter serialization.

#### Temporal Echo Displacement
**Goal:** Swirling memory trails using displaced feedback.  
**Implementation Plan:**
1. Add feedback texture sampling in a post-process pass.
2. Displace UVs with a flow field texture.
3. Allow audio-band modulation of displacement strength.
**Success Criteria:**
- Trails follow audio changes smoothly.
**Tests:**
- Snapshot test for effect config.

#### Frequency-Sliced Glitch
**Goal:** Slice the spectrum into bins and distort each slice.  
**Implementation Plan:**
1. Partition screen into vertical slices tied to spectrum bins.
2. Apply offsets, rotation, and color separation per slice.
3. Map higher band energy to greater distortion.
**Success Criteria:**
- Distortion intensity matches spectrum movement.
**Tests:**
- Unit test for bin-to-slice mapping.

#### Vector Field Warper
**Goal:** Organic warping via curl noise or flow maps.  
**Implementation Plan:**
1. Create a flow map texture updated over time.
2. Warp UV coordinates in a post-process pass.
3. Use MIDI XY pad or mouse to “paint” flow intensity.
**Success Criteria:**
- Visible flow interactions on user input.
**Tests:**
- Unit test for flow parameter bounds.

#### Beat-Quantized Tile Dissolve
**Goal:** Dissolve into tiles, reassemble on beat.  
**Implementation Plan:**
1. Segment frame into tiles with per-tile delay.
2. Use beat clock to trigger tile dissolve and return.
3. Allow tile rotation/scale effects.
**Success Criteria:**
- Tiles reassemble precisely on beat.
**Tests:**
- Quantization tests for tile timing.

#### Spectrum Reprojection (Ribbon/Tunnel)
**Goal:** Reproject spectrum into 3D-inspired geometry.  
**Implementation Plan:**
1. Convert spectrum into a ribbon mesh or polar tunnel.
2. Animate depth or rotation based on tempo.
3. Blend with plasma layer for brand identity.
**Success Criteria:**
- Geometry is stable and audio-reactive.
**Tests:**
- Parameter serialization tests.

#### Feedback Kaleidoscope (Freeze Mode)
**Goal:** Feedback loop with kaleidoscope and MIDI freeze.  
**Implementation Plan:**
1. Add kaleidoscope shader with adjustable segments.
2. Freeze feedback on MIDI pad press.
3. Provide decay controls for gradual release.
**Success Criteria:**
- Freeze toggles immediately and releases gracefully.
**Tests:**
- Unit test for freeze state toggling.

#### Dissolve-to-Particle Explosion
**Goal:** Emit particles along dissolve edge.  
**Implementation Plan:**
1. Detect dissolve edge in shader.
2. Emit particles into a GPU particle system.
3. Tie emission to audio peak events.
**Success Criteria:**
- Explosion triggers on high energy.
**Tests:**
- Unit test for emission rate mapping.

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Create Windows Installer

```bash
npm run dist
```

This generates:
- `VisualSynth-Setup-<version>.exe` (NSIS installer)
- Portable `.exe`

## Performance Tips
- Use dedicated audio interfaces when possible.
- Run in fullscreen (`F`) for maximum GPU throughput.
- Avoid running heavy background apps during performance.
- Use ASIO drivers if available on Windows for lower latency.

## Project Format
Projects are JSON with versioned schema stored in `src/shared/projectSchema.ts`.

## Example Presets
Bundled in `assets/presets` and accessible via the Preset dropdown.
