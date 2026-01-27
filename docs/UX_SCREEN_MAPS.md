# VisualSynth UI Screen Maps (Renderer Alignment)

This document translates the four-mode UX architecture into concrete screen maps and component naming aligned to `src/renderer/index.html`, `src/renderer/index.ts`, and `src/renderer/style.css`.

## Goals
- Preserve all features, reorganize by mode.
- Make it trivial to locate each feature in the renderer.
- Define a minimal, explicit UI structure to implement.

## Current Renderer Structure (Baseline)

Top Bar (`.top-bar`):
- `#audio-device`, `#midi-device`, `#toggle-midi`
- `#btn-save`, `#btn-load`
- `#preset-select`, `#btn-apply-preset`
- `#template-select`, `#btn-apply-template`
- `#toggle-mode` (Advanced/Simple)

Left Panel (`.left-panel`):
- Layers: `#layer-list`
- Scenes + BPM + Quantize + HUD: `#scene-select`, `#queue-scene`, `#bpm-*`, `#quantize-select`, `#bpm-display`
- Pad grid: `#pad-bank`, `#pad-grid`
- Generator library: `#generator-select`, `#generator-add`, `#generator-favorites`, `#generator-recents`
- Style: `#style-select`, `#style-contrast`, `#style-saturation`, `#style-shift`
- Effects: `#effect-*`, `#effects-enabled`
- Particle field: `#particles-*`
- SDF: `#sdf-*`
- Macros: `#macro-list`
- Preset exchange: `#export-scene`, `#import-scene`, `#export-macros`, `#import-macros`

Center Panel (`.center-panel`):
- Render canvas: `#gl-canvas`
- `#quantize-hud`
- `#safe-mode-banner`

Right Panel (`#advanced-panel`):
- Mod Matrix: `#mod-matrix-list`, `#mod-matrix-add`
- MIDI Mapping: `#midi-map-list`, `#midi-map-add`
- Modulators: `#lfo-list`, `#env-list`, `#sh-list`
- Diagnostics: `#diag-*`
- Output: `#output-*`
- Pad Mapping: `#pad-map-bank`, `#pad-map-grid`
- Capture: `#capture-*`
- Timeline: `#marker-*`
- Assets: `#asset-*`
- Plugins: `#plugin-*`
- Project Diff/Merge: `#diff-*`

Footer (`.status-bar`):
- `#status`, shortcuts text

## Proposed Four-Mode Structure (Renderer Map)

### Global Shell (Always Visible)
New/updated components:
- Mode switcher: `#mode-switcher` (Performance / Scene / Design / System)
- Transport: `#transport-play`, `#transport-stop`, `#transport-bpm`, `#transport-tap`
- Output routing: `#output-route` (Preview / Output)
- Health strip: `#health-fps`, `#health-latency`, `#health-watchdog`
- Project/session: `#session-name`, `#session-autosave`

Mapping notes:
- Replace `#toggle-mode` with `#mode-switcher`.
- Move `#diag-fps`, `#diag-latency`, `#diag-watchdog` summary values into the global health strip.

### Mode Containers
Add top-level sections so each mode can be shown/hidden without reflow:
- `#mode-performance`
- `#mode-scene`
- `#mode-design`
- `#mode-system`

Each mode container is a single layout root that owns its panels and subcomponents. All existing features move into exactly one container.

## Performance Mode (Default)

Layout:
- Left: Scene strip + quantization HUD.
- Center: `#gl-canvas` + `#quantize-hud` + `#safe-mode-banner`.
- Right: `#macro-list` (8 macros always visible).
- Bottom: `#pad-bank`, `#pad-grid`.

Component mapping:
- Scene strip: `#scene-select`, `#queue-scene`, `#quantize-hud`.
- Transport: `#transport-*` (new).
- Output routing: `#output-route` (new).
- Health strip: `#health-*` (new).
- Macro list: `#macro-list` (move from left panel).
- Pad grid: `#pad-bank`, `#pad-grid` (move from left panel).

Components not shown in Performance Mode:
- Layers, generator library, style presets, FX, particles, SDF, mod matrix, MIDI mapping, diagnostics, output settings, assets, plugins, diff/merge.

## Scene Mode

Layout:
- Left: Scene list + quantized switching (reuses `#scene-select`, `#queue-scene`).
- Center: Layer stack + generator quick-add.
- Right: Scene inspector (style presets, palette/LUT, quantize/tempo behavior, automation clips, scene export/import).

Component mapping:
- Scene list: `#scene-select`, `#queue-scene`, `#quantize-select`, `#bpm-*`, `#bpm-display`.
- Layer stack: `#layer-list`.
- Generator library: `#generator-select`, `#generator-add`, `#generator-favorites`, `#generator-recents`.
- Style presets: `#style-select`, `#style-contrast`, `#style-saturation`, `#style-shift`.
- Scene export/import: `#export-scene`, `#import-scene`.
- Automation clips: `#marker-*` (repurpose timeline as scene automation list).

Components not shown in Scene Mode:
- Macro list (Performance only), mod matrix, MIDI mapping editor, diagnostics, output settings, assets, plugins.

## Design Mode

Layout:
- Center: Render graph canvas (new `#render-graph`).
- Left: Mod sources (LFO/ADSR/S&H/audio/MIDI).
- Right: Parameter inspector + search.
- Bottom: Modulation routing viewer.

Component mapping:
- Mod matrix: `#mod-matrix-list`, `#mod-matrix-add`.
- MIDI mapping editor: `#midi-map-list`, `#midi-map-add`.
- Modulators: `#lfo-list`, `#env-list`, `#sh-list`.
- FX and generators: `#effect-*`, `#effects-enabled`, `#particles-*`, `#sdf-*`.
- Render graph: new `#render-graph` (represents generator → FX → compositor).
- Node parameters: reuse existing controls as inspector inputs.

Components not shown in Design Mode:
- Output settings, device management, diagnostics dashboard, asset ingestion pipeline.

## System Mode

Layout:
- Top: Audio/MIDI device management + network clock.
- Center: Latency dashboard + GPU timing.
- Right: Autosave/recovery + watchdog logs.
- Bottom: Asset manager + caching + diagnostics + migrations.

Component mapping:
- Audio/MIDI devices: `#audio-device`, `#midi-device`, `#toggle-midi`.
- Network clock: `#bpm-source`, `#bpm-interface`, `#bpm-network-toggle`.
- Latency dashboard: `#diag-latency`, `#diag-output-latency`, `#diag-midi-latency`.
- GPU timing: `#diag-fps`, `#diag-gpu`.
- Watchdog: `#diag-watchdog`, `#safe-mode-banner` (status mirrored in System).
- Autosave/recovery: `#session-autosave` (new), plus existing project load/save `#btn-save`, `#btn-load`.
- Asset pipeline: `#asset-*`.
- Plugin management: `#plugin-*`.
- Output settings: `#output-*`.
- Project diff/merge: `#diff-*`.

## Component Renames / Additions (Recommended)

New IDs:
- `#mode-switcher`, `#mode-performance`, `#mode-scene`, `#mode-design`, `#mode-system`
- `#transport-play`, `#transport-stop`, `#transport-bpm`, `#transport-tap`
- `#output-route` (Preview/Output)
- `#health-fps`, `#health-latency`, `#health-watchdog`
- `#session-name`, `#session-autosave`
- `#render-graph` (Design Mode canvas)

Renames (optional for clarity):
- `#advanced-panel` → `#mode-design`
- `.left-panel` → `#mode-scene-left`
- `.right-panel` → `#mode-design-right`

## Immediate UI Migration Plan (Renderer-Only)

1) Replace Advanced/Simple toggle with Mode switcher.
2) Wrap existing blocks in the four mode containers.
3) Move macro list and pad grid into Performance Mode.
4) Move layer stack, generator library, style presets into Scene Mode.
5) Keep mod matrix and modulators in Design Mode.
6) Move diagnostics, output, assets, plugins, diff/merge to System Mode.
7) Add global health strip and transport in the top bar.

This plan is purely structural and does not remove features.

