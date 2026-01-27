# UX Reimagination Implementation Plan

This plan maps the four-mode UX redesign to concrete code modules and test coverage in the current VisualSynth repo.

## Phase 0: Mode Skeleton + Global Shell

Goals:
- Replace Advanced/Simple toggle with explicit mode switcher.
- Add global transport, health strip, and output routing.
- Wrap UI blocks into four mode containers.

Primary files:
- `src/renderer/index.html` (mode containers, global shell, component placement)
- `src/renderer/index.ts` (mode state + visibility)
- `src/renderer/style.css` (layout for mode shells)

Tests:
- Add UI state unit tests in `tests/transport.test.ts` and `tests/safeMode.test.ts` for global strip values.
- Add a renderer state test for mode switching (new test file, e.g. `tests/uiModes.test.ts`).

## Phase 1: Performance Mode Surface

Goals:
- Performance Mode becomes the default view with zero scroll.
- Macros and 8x8 pad grid always visible.
- Scene strip + quantization HUD in Performance.

Primary files:
- `src/renderer/index.html` (move `#macro-list`, `#pad-grid`, `#pad-bank`, `#scene-select`, `#queue-scene`)
- `src/renderer/index.ts` (mode-aware render/update)
- `src/renderer/style.css` (performance layout, full-screen canvas)

Tests:
- Update `tests/padMappings.test.ts` to ensure bank A/B/C/D is visible in Performance mode.
- Update `tests/macros.test.ts` to ensure macros are always present in Performance mode.
- Update `tests/quantization.test.ts` to assert HUD visibility in Performance mode.

## Phase 2: Scene Mode Surface

Goals:
- Layer stack, generator quick-add, style presets, and scene export/import live in Scene mode.
- Scene automation clips integrated with existing marker timeline.

Primary files:
- `src/renderer/index.html` (move layer stack, generator library, style presets, exchange UI)
- `src/renderer/index.ts` (scene automation list binding)
- `src/shared/project.ts` or `src/shared/projectSchema.ts` (if automation structure needs expansion)

Tests:
- Update `tests/layers.test.ts`, `tests/generatorLibrary.test.ts`, `tests/stylePresets.test.ts`.
- Update `tests/exchange.test.ts` for scene export/import location.
- Update `tests/timelineMarkers.test.ts` for scene automation mapping.

## Phase 3: Design Mode Surface

Goals:
- Mod matrix, modulators, MIDI mapping editor, render graph routing in Design mode.
- Add a render graph surface placeholder (`#render-graph`) for future graph UI.

Primary files:
- `src/renderer/index.html` (place mod matrix + modulators + midi mapping under Design)
- `src/renderer/index.ts` (Design mode gating and readouts)
- `src/shared/renderGraph.ts` (existing graph data)

Tests:
- Update `tests/modMatrix.test.ts`, `tests/modulators.test.ts`, `tests/midiMapping.test.ts`.
- Add `tests/renderGraph.test.ts` cases for graph visibility state (if UI state is testable).

## Phase 4: System Mode Surface

Goals:
- Device management, diagnostics, output settings, assets, plugins, diff/merge live in System mode.
- System mode is "mission control": dense but predictable.

Primary files:
- `src/renderer/index.html` (move diagnostics/output/assets/plugins/diff sections into System)
- `src/renderer/index.ts` (mode-aware device + diagnostics updates)
- `src/shared/safeMode.ts`, `src/shared/watchdog.ts` (if summary chips or global health uses shared data)

Tests:
- Update `tests/outputConfig.test.ts`, `tests/assets.test.ts`, `tests/plugins.test.ts`, `tests/projectMerge.test.ts`.
- Update `tests/watchdog.test.ts` for System mode status surfaces.

## Phase 5: UX Polish + Progressive Disclosure

Goals:
- Add summary chips to show hidden active systems.
- Add one-tap jump to owning mode.
- Add performance guardrails badges and cost tiers in Design/Scene.

Primary files:
- `src/renderer/index.html`, `src/renderer/index.ts`, `src/renderer/style.css`
- `src/shared/visualNode.ts` (GPU cost tiers)
- `src/shared/fxCatalog.ts` (FX metadata)

Tests:
- Add `tests/uiChips.test.ts` for summary chip visibility.
- Update `tests/visualNode.test.ts` to ensure cost tiers surface correctly.

## Sequencing Notes

- Keep render loop and engine logic unchanged; only reorganize UI and surface controls by mode.
- Preserve existing IDs where possible to avoid reworking event handlers.
- Introduce new IDs only for mode containers and global shell.

## Quick Start Task List

1) Implement mode containers and global shell (Phase 0).
2) Relocate macros/pads/scenes into Performance (Phase 1).
3) Relocate layer stack + generator library + style + exchange into Scene (Phase 2).
4) Relocate mod matrix + modulators + MIDI map into Design (Phase 3).
5) Relocate diagnostics + output + assets + plugins + diff into System (Phase 4).
6) Add summary chips + mode jump shortcuts (Phase 5).

