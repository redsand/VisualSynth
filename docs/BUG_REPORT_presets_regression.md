# Preset Regression Bug Report

**Date:** 2026-01-30  
**Reporter:** VisualSynth stability & correctness audit  
**Scope:** Preset loading and rendering after “preset/static-config separation”

## Repro Steps (Dev)
1. Run the app in dev (`npm run dev` or the equivalent in `package.json`).
2. Open **Performance** mode.
3. Load 3–5 presets via **Add Preset as Scene**:
   - `Cosmic Plasma` (preset-01)
   - `Glyph Matrix` (preset-107)
   - `SDF Monolith` (preset-100)
   - `Kaleido Shapes` (preset-115)
4. Observe the visuals and the preset browser labels.
5. Open DevTools Console and watch for preset logs/errors.

## Expected
- Each preset changes the scene to match its definition (layers, opacity, FX, and parameters).
- Presets with single-layer intent do not retain unrelated layers.
- SDF presets activate SDF visuals instead of leaving default plasma/spectrum.
- If a preset is invalid or missing data, a clear error is shown and a safe visual fallback is applied.

## Observed (Code-Based Repro)
> Note: UI execution was not possible in this environment; these observations are derived from code paths and automated checks.

- V3 presets are loaded and then converted through v2 → v3 again in the renderer, which previously discarded `layer.params` values. This causes preset-specific parameters (speed/scale/etc.) to revert to defaults.  
  Evidence: `src/shared/presetMigration.ts` v2→v3 migration ignored `layer.params`.
- Applying a v3 preset preserved previously enabled layers instead of disabling non‑preset layers. This makes presets appear “stuck” or blended with earlier visuals.  
  Evidence: `src/shared/presetMigration.ts` applyPresetV3 kept existing layers not in preset.
- Renderer render loop used fixed defaults (1.0) for speed/scale rather than preset layer params, so presets rendered inaccurately even when params existed.  
  Evidence: `src/renderer/index.ts` plasma/origami/glyph/etc. base values were hard-coded.
- Several presets have empty `layers` arrays (notably SDF presets), which results in no preset-specific layer change.  
  Evidence: `assets/presets/preset-100-sdf-monolith.json`, `assets/presets/preset-115-kaleido-shapes.json`.

## Checklist: Regression Pattern Verification

### A. Pathing / packaging
- **Status:** PASS (no direct evidence of path break)  
- Evidence: main process uses `app.getAppPath()` for dev and `process.resourcesPath` for packaged paths in `src/main/main.ts`.

### B. Merge semantics changed
- **Status:** FAIL  
- Evidence: `applyPresetV3` previously preserved non‑preset layers from existing project. This conflicts with preset-only data and causes layer bleed.

### C. Unit/scaling differences
- **Status:** FAIL  
- Evidence: renderer used constant base values (1.0) rather than preset params.

### D. Schema/migration mismatch
- **Status:** FAIL  
- Evidence: v2 → v3 migration dropped `layer.params` (speed/scale/etc.), causing defaults.

### E. Renderer state lifecycle
- **Status:** UNKNOWN  
- No explicit state reset issues confirmed yet.

### F. Asset references
- **Status:** PASS (no assetId references in presets)  
- Evidence: no `assetId` in `assets/presets/*.json`.

## Diagnostics Added
Preset debug logging with trace IDs and structured payloads:
- Log path + trace ID for each preset load.
- Log migration/validation warnings.
- Log resolved project config (truncated) in debug mode.
- Log missing asset resolution summary.

Enable with:
```
localStorage.setItem('vs.presetDebug', '1')
```
or:
```
window.__VS_PRESET_DEBUG = true
```

## Root Cause Summary
Preset data was separated from static config, but the preset application pipeline:
1) preserved non‑preset layers, and  
2) discarded layer params during v2→v3 migration, and  
3) ignored layer params in render loop.  

This combination made presets appear unchanged or inaccurate.

