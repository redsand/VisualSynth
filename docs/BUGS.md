# VisualSynth Bug Registry

**Last Updated:** 2026-03-21
**Branch:** main (post-v1.0)

---

## Critical Bugs

### BUG-001: Layer Enable/Disable Toggle Not Working in Design Tab

**Status:** Open
**Severity:** High
**Component:** UI / Layer Management

**Description:**
The checkbox toggles to enable/disable layers in the Design tab's Layer Details card do not visually affect the preview. However:
- Opacity slider DOES work
- Solo/Mute buttons in Mixer panel DO work
- Output window shows correct behavior when layers are muted

**Observed Behavior:**
When toggling a layer (e.g., plasma, spectrum) on/off in the Design tab, the preview still shows the video/webcam/asset input even when the layer is muted. The output window correctly hides the asset input.

**Suspected Root Cause:**
The `applyLayerBinding` function in `glRenderer.ts:917` sets asset enabled flags based on asset binding existence, NOT on layer enabled state.

**Files to Investigate:**
- `src/renderer/glRenderer.ts` - `applyLayerBinding` function

---

### BUG-002: SDF Not Rendering in Preview or Output

**Status:** Open
**Severity:** High
**Component:** SDF Renderer

**Description:**
SDF (Signed Distance Field) shapes do not appear in either preview or output when enabled in Design mode. This feature worked in the v1.0 branch.

**Suspected Root Cause:**
SDF rendering pipeline may have regressed during shader refactoring or state management changes.

**Files to Investigate:**
- `src/renderer/render/RenderGraph.ts` - SDF state building
- `src/renderer/glRenderer.ts` - SDF uniform handling
- `src/renderer/sdf/` - entire SDF module

---

### BUG-003: Particle Fields Not Rendering

**Status:** Open
**Severity:** High
**Component:** Particle System

**Description:**
Particle fields do not appear in preview or output when enabled. This feature worked previously.

**Suspected Root Cause:**
Similar to SDF issue - may be a state propagation or shader issue.

**Files to Investigate:**
- `src/renderer/render/RenderGraph.ts` - particle state
- `src/renderer/glRenderer.ts` - particle uniforms

---

### BUG-004: Engine Settings Not Applied When Loading Presets (ROOT CAUSE)

**Status:** Open - **LIKELY ROOT CAUSE FOR MANY ISSUES**
**Severity:** Critical
**Component:** Preset Loading / Visual Engine

**Description:**
When a preset is loaded that specifies an `activeEngineId`, the engine's settings are NOT applied to the project. Only the `activeEngineId` string is set, The engine's grammar, finish, palette, and macros are never applied.

**Root Cause:**
In `applyProject()` (index.ts:10320), when a preset is loaded:
1. The preset's `activeEngineId` is set on `currentProject`
2. The UI select is updated to show the correct engine (line 10360)
3. BUT `applyVisualEngine()` is NEVER called

This means:
- `currentProject.engineGrammar` is never set (defaults to `{}`)
- `currentProject.engineFinish` is never set (defaults to `{}`)
- The engine's curated palette is never applied
- The engine's macros are never mapped

**Why Presets Look Identical:**
Since engine grammar/finish are never applied, all presets that use the same base layers (e.g., plasma-only presets) render identically because:
- `engineMass`, `engineFriction`, `engineElasticity` all default to generic values
- `engineGrain`, `engineVignette`, `engineCA` all default to 0 or generic values
- The engine's unique visual signature is lost

**Fix Location:**
`src/renderer/index.ts` line ~10359-10365

**Fix:**
```typescript
if (engineSelect) {
  const engineId = currentProject.activeEngineId || 'engine-radial-core';
  engineSelect.value = engineId;
  applyVisualEngine(engineId as EngineId);  // ADD THIS LINE
}
```

---

### BUG-005: Generator Uniforms Not Being Set

**Status:** Open
**Severity:** High  
**Component:** Shader Uniforms

**Description:**
Many generator shader blocks define uniforms (e.g., `uVhsScanlineGenEnabled`, `uTunnelWarpEnabled`) but these uniforms are not being set in `glRenderer.ts`. This causes generators like VHS Scanline to produce no output.

**Example:**
- `gen-vhs-scanline` defines `uVhsScanlineGenEnabled` but this uniform is never set
- `gen-tunnel-warp` defines `uTunnelWarpEnabled` but this uniform is never set

**Files to Investigate:**
- `src/renderer/glRenderer.ts` - `updateStandardUniforms` function
- `src/shared/generatorShaderBlocks.ts` - all generator blocks

---

## Preset Similarity Issues

Many presets appear identical or very similar to each other, suggesting layers or unique parameters are not loading or rendering correctly.

### Ink Layer Presets (All Look Identical)
These presets all look the same despite using the ink layer:
- Prism Wake
- Aurora Chord
- Ember Pulse
- Voltage Bloom
- Fractal Coil

**Suspected Issue:** Ink layer parameters not being applied uniquely per preset.

---

### Missing Layer/Effect Components

| Preset | Missing Component |
|--------|-------------------|
| Tunnel Warp | Tunnel layer/effect |
| Wormhole Core | Interesting portal element |
| All Nebula Drift variants | Unique nebula elements |
| Obsidian Pulse | Looks same as "Visual Synth DNA" |
| Circuit Pulse | Missing unique elements (looks like Particle Swarm) |

---

### Presets That Look Identical to Others

| Preset | Same As |
|--------|---------|
| Obsidian Pulse | Visual Synth DNA |
| Circuit Pulse | Particle Swarm |
| Vapor Grid | Other presets |
| Red Code | Other glyph presets |
| Crystal Void | Other crystal presets |
| Data Stream | Other presets |
| Soft Spectrum | Other presets |
| Echo Chamber | Other presets |
| Prismatic Core | Other presets |
| Ice Tunnel | Other presets |
| SDF Geometry | Other SDF presets |
| SDF 3D Torus | Other SDF presets |
| SDF Metaballs | Other SDF presets |
| Hyper Plasma | Other plasma presets |
| SDF Neon Crosshatch | Other presets |
| SDF Wire Grid | Other presets |
| SDF Chain Links | Other presets |
| SDF Matrix Field | Other presets |
| SDF Crater Moon | Other presets |
| Cosmic Wormhole | Other portal presets |
| Cloud Corridor (Topo Terra) | Other topo presets |

---

### Presets with No Output (Regression)

These presets produced output before but now show nothing:
- VHS Scanline
- VHS Scanline Warp

**Last Working:** Earlier today (same branch)
**Root Cause:** Generator uniforms (`uVhsScanlineGenEnabled`) not being set

---

### Presets That Are Plain/Boring (Need Enhancement)

| Preset | Issue |
|--------|-------|
| Radar HUD | Just a moving circle - needs more visual interest |
| Radar HUD Deep | Same as above |
| Fractal Bloom | Looks same as Fractal Bloom Ember |
| SDF Prism | Plain, lacking visual depth |
| Kaleido Trails | Plain, missing elements |
| Posterize Strobe | Looks same as others |
| Wormhole Portals | No longer looks like a wormhole |
| Sacred Oscilloscope | Plain, lacks visual complexity |
| Cyber Rain | Boring visual |
| Shape Burst Pulse | Plain |

---

## Testing Checklist

When investigating, test:
- [ ] Load each affected preset
- [ ] Check if layer params are correctly set in state
- [ ] Check if shader uniforms are correctly bound
- [ ] Compare with v1.0 branch behavior
- [ ] Check browser console for shader errors
- [ ] Verify RenderGraph state includes all expected values
