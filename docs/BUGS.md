# VisualSynth Bug Registry

**Last Updated:** 2026-03-21
**Branch:** main (post-v1.0)

---

## Summary of Findings

**Root Cause Identified:** BUG-004 (Engine settings not applied when loading presets) is the primary cause of many presets looking identical. When presets are loaded, `applyVisualEngine()` is never called, so engine-specific grammar, finish, palette, and macros are never applied.

**Secondary Issue:** BUG-005 (Missing parameter registry entries) causes generators to produce no output because `genUniformResolver.ts` skips setting uniforms for generators without registry entries.

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

### BUG-004: Engine Settings Not Applied When Loading Presets (ROOT CAUSE - FIXED)

**Status:** **FIXED** (commit cd24efbe)
**Severity:** Critical
**Component:** Preset Loading / Visual Engine

**Description:**
When a preset is loaded that specifies an `activeEngineId`, the engine's settings were NOT applied to the project. Only the `activeEngineId` string was set, the engine's grammar, finish, palette, and macros were never applied.

**Root Cause:**
In `applyProject()` (index.ts:10320), when a preset is loaded:
1. The preset's `activeEngineId` is set on `currentProject`
2. The UI select is updated to show the correct engine
3. BUT `applyVisualEngine()` was NEVER called

**Fix Applied:**
```typescript
if (engineSelect) {
  const engineId = currentProject.activeEngineId || 'engine-radial-core';
  engineSelect.value = engineId;
  applyVisualEngine(engineId as EngineId);  // ADDED THIS LINE
}
```

**Impact:**
This fix should resolve many presets looking identical because engine-specific visual parameters (grammar, finish, palette, macros) are now properly applied.

---

### BUG-005: Generator Uniforms Not Being Set (PARTIALLY FIXED)

**Status:** **PARTIALLY FIXED** (vhs-scanline added)
**Severity:** High  
**Component:** Shader Uniforms / Parameter Registry

**Description:**
Many generator shader blocks define uniforms but `genUniformResolver.ts` skips setting uniforms for generators without parameter registry entries. The resolver only sets `Enabled` flag and skips all other params if `getLayerType()` returns undefined.

**Code Location:** `src/shared/genUniformResolver.ts:165-169`
```typescript
const layerType = getLayerType(blockId);
if (!layerType) {
  // No registry entry — just set enabled and skip
  continue;
}
```

**Fix Applied:**
- Added `'gen-vhs-scanline': 'vhs-scanline'` to idMapping
- Added `vhs-scanline` entry to PARAMETER_REGISTRY

**Still Missing from Parameter Registry (41 entries):**

| Category | IDs |
|----------|-----|
| **gen-asset-*** | `gen-asset-echo`, `gen-asset-mosaic`, `gen-asset-polar`, `gen-asset-ripple`, `gen-asset-scatter`, `gen-asset-slices`, `gen-asset-vortex` |
| **fx-*** | `fx-bloom`, `fx-blur`, `fx-chroma`, `fx-feedback`, `fx-kaleidoscope`, `fx-posterize`, `fx-trails` |
| **variant-*** | `variant-audio-geometry-prism`, `variant-crystal-fracture`, `variant-fractal-bloom-ember`, `variant-glitch-datamosh-hard`, `variant-glyph-orbit`, `variant-ink-neon`, `variant-kaleido-shard-iris`, `variant-nebula-drift-cold`, `variant-neon-wireframe-grid`, `variant-organic-fluid-ink`, `variant-origami-canyon`, `variant-particle-swarm-bloom`, `variant-plasma-liquid`, `variant-plasma-vortex`, `variant-portal-echo`, `variant-radar-hud-deep`, `variant-spectrum-neon`, `variant-topo-rift`, `variant-tunnel-warp-spiral`, `variant-typography-reveal-glow`, `variant-vhs-scanline-warp`, `variant-weather-stormcells`, `variant-wormhole-core-echo` |
| **viz-*** | `viz-off`, `viz-oscilloscope`, `viz-spectrum`, `viz-waveform` |

---

## Naming Convention Analysis

### Generator ID Patterns

| Prefix | Purpose | Has Shader Block | Needs Registry |
|--------|---------|------------------|----------------|
| `gen-*` | Core generators | Yes | Yes |
| `variant-*` | Preset-specific variations | Yes | Yes (for params) |
| `fx-*` | Effect shortcuts | Yes | Yes |
| `viz-*` | Visualizer modes | Yes | Yes |
| `layer-*` | Legacy layer IDs | Mapped to gen-* | Already mapped |

### Uniform Naming Convention

Shader blocks follow this pattern:
- `u{Prefix}Enabled` - Enable flag (e.g., `uVhsScanlineGenEnabled`)
- `u{Prefix}Opacity` - Opacity value (e.g., `uVhsScanlineGenOpacity`)
- `u{Prefix}{ParamName}` - Additional params (e.g., `uLaserBeamCount`)

The prefix is extracted from the shader block's `uniforms` string by parsing `uniform float u{Prefix}Enabled;`

---

## Preset Analysis

### Presets with No Output (Need Investigation)

These presets have layers defined but produce no visual output:

| Preset | Layer ID | Status |
|--------|----------|--------|
| VHS Scanline | `gen-vhs-scanline` | Registry entry added |
| VHS Scanline Warp | `variant-vhs-scanline-warp` | Missing registry |
| Tunnel Warp | `gen-tunnel-warp` | Has registry entry - investigate |

### Presets Missing Keystone Layers

**IMPORTANT:** If a preset has ONLY a `layer-plasma` (or any single layer), it is likely missing key components and needs investigation. A single-layer preset should have unique params that differentiate it, or additional effect layers.

Presets that appear plain/boring may be missing their primary visual layer:

| Preset | Current Layers | Likely Missing |
|--------|---------------|----------------|
| Prism Wake | ink | Unique ink params |
| Aurora Chord | ink | Unique ink params |
| Ember Pulse | ink | Unique ink params |
| Voltage Bloom | ink | Unique ink params |
| Fractal Coil | ink | Unique ink params |
| Tunnel Warp | plasma | Tunnel-specific layer |
| Wormhole Core | portal | Additional portal params |
| Radar HUD | (unknown) | Additional visual elements |
| Kaleido Trails | (unknown) | Missing elements |

### Single-Layer Presets (Need Investigation)

Presets with ONLY a `layer-plasma` or single layer are likely incomplete:

| Preset | Current Layer | Likely Missing |
|--------|---------------|----------------|
| Prism Wake | plasma (or ink) | Unique params or additional effect layer |
| Aurora Chord | plasma (or ink) | Unique params or additional effect layer |
| Ember Pulse | plasma (or ink) | Unique params or additional effect layer |
| Voltage Bloom | plasma (or ink) | Unique params or additional effect layer |
| Fractal Coil | plasma (or ink) | Unique params or additional effect layer |
| Hyper Plasma | plasma | Additional plasma params or effect layer |
| Soft Spectrum | spectrum | Additional spectrum params or effect layer |

**Action Required:** Review each preset JSON to verify layer composition and unique parameters.

### Presets That Look Identical (Likely BUG-004 Related)

After BUG-004 fix, these should be retested:

- Obsidian Pulse vs Visual Synth DNA
- Circuit Pulse vs Particle Swarm
- All ink-based presets (Prism Wake, Aurora Chord, etc.)
- All SDF presets
- All portal presets

---

## Files to Modify for Complete Fix

### 1. Parameter Registry (`src/shared/parameterRegistry.ts`)

Need to add:

**idMapping entries (line ~2090):**
```typescript
// Asset effect generators
'gen-asset-vortex': 'asset-vortex',
'gen-asset-slices': 'asset-slices',
'gen-asset-polar': 'asset-polar',
'gen-asset-mosaic': 'asset-mosaic',
'gen-asset-ripple': 'asset-ripple',
'gen-asset-scatter': 'asset-scatter',
'gen-asset-echo': 'asset-echo',

// Effect shortcuts
'fx-bloom': 'bloom',
'fx-blur': 'blur',
'fx-chroma': 'chroma',
'fx-feedback': 'feedback',
'fx-kaleidoscope': 'kaleidoscope',
'fx-posterize': 'posterize',
'fx-trails': 'trails',

// Variants (23 entries)
'variant-audio-geometry-prism': 'audio-geometry-prism',
'variant-crystal-fracture': 'crystal-fracture',
// ... etc

// Visualizers
'viz-off': 'viz-off',
'viz-spectrum': 'viz-spectrum',
'viz-waveform': 'viz-waveform',
'viz-oscilloscope': 'viz-oscilloscope',
```

**PARAMETER_REGISTRY entries (around line 780):**
Each new ID needs a corresponding registry entry with at minimum:
```typescript
{
  id: 'asset-vortex',
  name: 'Asset Vortex',
  description: 'Vortex warp effect for asset layers',
  sinceVersion: '1.4.0',
  params: [
    { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true }
  ]
},
```

### 2. Preset Files (`assets/presets/preset-*.json`)

Review each preset that looks plain/identical and verify:
- All intended layers are present in `scenes[].layers`
- Layer `params` include unique values
- `activeEngineId` is set correctly

---

## Testing Checklist

When investigating, test:
- [ ] Load each affected preset
- [ ] Check if layer params are correctly set in state
- [ ] Check if shader uniforms are correctly bound
- [ ] Compare with v1.0 branch behavior
- [ ] Check browser console for shader errors
- [ ] Verify RenderGraph state includes all expected values
- [ ] After BUG-004 fix, retest all "identical" presets
- [ ] Verify engine grammar/finish are set after loading preset

---

## Next Steps

1. **Add missing parameter registry entries** for all 41 missing generators
2. **Retest presets** after BUG-004 fix to verify visual differentiation
3. **Review preset JSON files** to ensure keystone layers are included
4. **Investigate SDF rendering** (BUG-002)
5. **Investigate particle rendering** (BUG-003)
6. **Fix layer enable/disable** in preview (BUG-001)
