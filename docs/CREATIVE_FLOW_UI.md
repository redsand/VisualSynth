# Creative Flow UI (2026 Refresh)

## Intent
This layout re-centers VisualSynth around immediate visual feedback and macro-first performance control, while preserving the full depth of the existing toolset through progressive disclosure.

## Principles
- One-screen launch to a beautiful result: scene strip + canvas + macros are always visible.
- Macro controls first, details later: the macro dock is the primary control surface.
- Visual feedback on every interaction: focus/active states, visible HUDs, and live canvas response.

## Layout Overview

1) Scene Strip (Top)
- Always visible across all modes.
- Scene selection, quantize controls, and preset explorer are surfaced above everything else.
- Designed for rapid scene iteration without digging into menus.

2) Visual Canvas (Center)
- The main render canvas remains centered with the visualizer overlay.
- Scene transitions and cues (quantize HUD, safe-mode banner) stay on the canvas.

3) Scene Macro Dock (Bottom of Canvas)
- Four high-signal macros: Energy, Motion, Color, Density.
- These map to Macro 1–4 for performance-first control.
- Scene name is shown for context and confidence while performing.

4) Advanced Panel (Right, Collapsible)
- Contains the full existing UI (Performance, Scene, Design, Matrix, System) without removal.
- Collapsible to reduce cognitive load during performance.
- Progressive disclosure: use it to configure, then collapse to perform.

## Behavior Notes

- Macro Dock updates with the current scene and macro values.
- Mode switching still works; the advanced panel shows the same mode panes as before.
- All original controls remain accessible; they are just grouped under Advanced.

## Design Rationale

- The Scene Strip at top provides immediate navigation and context.
- Centered canvas prioritizes visual confirmation on every gesture.
- Macro dock keeps the “flow layer” within thumb reach and supports one-screen launch.
- Advanced panel houses depth without hijacking focus.
