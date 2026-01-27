# VisualSynth UX Reimagination

This document redesigns the product experience without removing any features. It reorganizes all existing and planned capabilities into four modes with progressive disclosure, performance-safe defaults, and zero hidden state.

## Product UX Architecture

### Global Shell (Always Visible)
- Mode switcher: Performance, Scene, Design, System.
- Transport: play/stop, BPM, tap.
- Output routing: Preview vs Output.
- Health strip: FPS, latency, watchdog.
- Project/session name + autosave status.

### Mode Isolation
- Every feature lives in exactly one mode.
- Cross-mode breadcrumbs show where to find active systems.
- No duplication of features across modes.

### Progressive Disclosure
- Each mode has a primary surface and optional depth drawers.
- Summary chips surface active hidden systems (e.g., "Mod: 3", "FX: 5").
- One obvious action available at all times.

### Safety Stack
- Performance guardrails cap GPU risk.
- Safe-mode fallback auto-engages on watchdog events.
- Deterministic defaults visible in Design Mode.

## Modes (Mandatory Structure)

### 1) Performance Mode (Default)
Purpose: Live performance, zero cognitive load, safe/locked behavior.

Layout (no scrolling, no nested panels):
- Center: Always-visible 8x8 pad grid with A/B/C/D bank indicator.
- Right: Always-visible 8 macros.
- Left: Scene strip with quantization countdown HUD.
- Top: Transport (play/stop/BPM/tap).
- Bottom: Output routing (Preview vs Output) + health indicators (FPS/latency/watchdog).

Exposed features:
- Macro system (8 always visible).
- Pad layers with 8x8 grid and 4 banks.
- Scene switcher with quantization HUD.
- Transport.
- Output routing.
- Performance health indicators and watchdog.

Hidden but accessible:
- Render graph, mod matrix, FX internals, asset management.
- Access via Mode switcher (no embedded panels).

Failure behavior:
- Safe-mode fallback visual auto-engages.
- Watchdog suggests corrective actions, with one-tap fixes.

### 2) Scene Mode
Purpose: Scene composition and musical structure.

Layout:
- Left: Scene list (beat-quantized switching).
- Center: Layer stack (drag and drop).
- Right: Scene inspector (style, palette/LUT, tempo, automation).

Exposed features:
- Reorderable layers.
- Generator quick-add (favorites + recent).
- Style presets (contrast/sat/palette).
- Scene quantization and automation clips.
- Scene export/import (shareable files).
- Signature VisualSynth DNA presets.

### 3) Design Mode
Purpose: Deep system access and power-user workflows.

Layout:
- Center: Generator → FX → Compositor graph.
- Left: Sources (LFOs, ADSRs, S&H, audio analysis, MIDI).
- Right: Parameter inspector (grouping + search).
- Bottom: Modulation view (animated source → target lines).

Exposed features:
- Full mod matrix.
- LFOs, ADSRs, S&H.
- MIDI CC / aftertouch editor.
- Audio analysis sources.
- Render graph routing (sends/returns/feedback taps).
- Node-level parameters + GPU cost tiers.
- Render node API + FX catalog.
- Plugin toolkit + generative content.

UX requirements:
- Click-anything-to-learn MIDI.
- Deterministic defaults visible.
- Clear source → target relationships.

### 4) System Mode
Purpose: Reliability, performance, infrastructure.

Layout:
- Top: Audio/MIDI device management.
- Center: Latency dashboard + GPU timing instrumentation.
- Right: Autosave/session recovery + watchdog logs.
- Bottom: Asset ingestion pipeline + caching + diagnostics.

Exposed features:
- Audio/MIDI device management.
- Latency dashboard.
- GPU timing instrumentation.
- Resolution negotiation.
- Asset manager + caching.
- Network clock sources (DJ Link, audio, manual).
- Autosave/session recovery.
- Versioned migrations & diagnostics.
- Deterministic testing modes.

## Mental Models

New users:
- Performance: "Play the instrument."
- Scene: "Build a visual instrument."
- Design: "Patch bay for deep control."
- System: "Mission control."

Expert users:
- Performance: "Stable live surface."
- Scene: "Musical structure and timing."
- Design: "Full render/modulation graph."
- System: "Timing, budgets, recovery."

## Default Onboarding Flow (First 60 Seconds)

0-10s: Launch into Performance Mode with a safe "DNA Starter" scene.
10-20s: Audio device picker with live meters; auto-assign input.
20-30s: Tap a MIDI pad (or click a pad) to trigger a vivid response.
30-45s: Move any macro; on-screen label shows its effect.
45-60s: Scene switch with quantized countdown HUD.

## Advanced Feature Reveal (Without Intimidation)
- Summary chips show active systems (e.g., "Mod: 3", "FX: 5", "Auto: 2").
- One-tap jump to owning mode for any chip.
- Favorites + recent in generator quick-add.
- GPU cost badges with hover hint to open System Mode.
- Inline MIDI learn on any parameter (no modal).

## Beginner → Expert Progression Path
1. Perform with pads and macros (Performance Mode).
2. Reorder layers and apply style presets (Scene Mode).
3. Add automation clips and scene quantization (Scene Mode).
4. Add LFO modulation to a parameter (Design Mode).
5. Build a feedback tunnel + FX chain (Design Mode).
6. Tune GPU budget and latency (System Mode).
7. Customize MIDI CC/aftertouch mapping (Design Mode).

## Safety & Performance Enforcement (Invisible)
- Guardrails clamp unsafe GPU tiers per scene.
- Watchdog auto-enables safe-mode visual if FPS/latency spikes.
- Autosave snapshot rotation with recovery prompt on boot.
- Deterministic test mode for reproducible performance validation.

## Feature Retention Map (All Features, Exactly One Mode)

Performance Mode:
- Macro system (8 always visible)
- Pad layers with 8x8 grid + 4 banks
- Scene quantization HUD
- Transport (play/stop/BPM/tap)
- Output routing (Preview vs Output)
- Performance health indicators
- Performance guardrails + safe-mode fallback

Scene Mode:
- Layer stack with reorder
- Generator library + favorites
- Signature VisualSynth DNA presets
- Style presets + palette/LUT
- Scene quantization & automation clips
- Preset & scene sharing
- Template projects
- Recording & screenshots

Design Mode:
- Full mod matrix
- LFOs, ADSRs, S&H
- MIDI CC / aftertouch editor
- Audio analysis sources
- Generator → FX → Compositor graph
- Node-level parameters
- GPU cost tiers per node
- Render graph routing
- Render node API + FX catalog
- Plugin toolkit + generative content
- Feedback tunnel + trails
- Layer FX (bloom, blur, chromatic aberration, posterize, kaleidoscope)
- GPU particle field + SDF shapes
- Text/SDF typography layers
- Color management + LUTs

System Mode:
- Audio/MIDI device management
- Latency dashboard
- GPU timing instrumentation
- Resolution negotiation
- Asset ingestion pipeline
- Asset manager + caching
- Network clock sources (DJ Link, audio, manual)
- Advanced tempo analysis
- Autosave + recovery
- Watchdog logs
- Versioned migrations & diagnostics
- Deterministic testing modes
- Collaboration tooling (future-ready)

