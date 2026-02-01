# Performance System: Modes, Macros, and Roadmaps

This document outlines the high-level visual expressions (Modes), the unified control scheme (Macros), and the engineering path forward for VisualSynth.

## 1. Signature Visual Modes
These 8 modes represent the primary "performances" available at launch.

| Mode | Visual Identity | Music Style | Transition |
| :--- | :--- | :--- | :--- |
| **Cosmic** | Radial orbital motion, deep gradients | Ambient / Chill | Crossfade (Slow) |
| **Ignite** | Vortex-driven high-energy shapes | Techno / House | Warp (Fast) |
| **Minimal** | Geometric grids, monochromatic focus | IDM / Glitch | Fade (Medium) |
| **Acid** | Fractal feedback, shifting chemistry | Acid / Trance | Warp (Fast) |
| **Neural** | Organic growth, biological networks | Experimental | Crossfade (Medium) |
| **Pulse** | Stroboscopic flashes, peak intensity | Hardcore / D&B | Glitch (Instant) |
| **Liquid** | Fluid ink dynamics, smooth flow | Liquid / Soul | Fade (Slow) |
| **Cyber** | Wireframe terrain, data artifacts | Synthwave | Glitch (Fast) |

## 2. Macro Mapping Table
Core macros provide consistent control across all modes.

| Macro | Cross-Mode Purpose | Primary Target | Secondary Effect |
| :--- | :--- | :--- | :--- |
| **Energy** | Intensity & Brightness | `effects.bloom` | `layer-*.opacity` |
| **Motion** | Speed & Flow | `layer-*.speed` | `particles.speed` |
| **Color** | Chemistry & Saturation | `style.paletteShift` | `effects.chroma` |
| **Density** | Visual Complexity | `particles.density` | `sdf.scale` |

## 3. Expressive Preset Metadata (V5 Template)
Presets are now **Performances** (narrative states).

```json
{
  "version": 5,
  "metadata": {
    "name": "Midnight Feedback Loop",
    "activeModeId": "mode-acid",
    "intendedMusicStyle": "Deep Techno",
    "visualIntentTags": ["dark", "feedback", "intense"],
    "colorChemistry": ["analog", "triadic"],
    "defaultTransition": { "durationMs": 600, "curve": "easeInOut" }
  },
  "roleWeights": {
    "core": 1.0,
    "support": 0.6,
    "atmosphere": 0.4
  },
  "tempoSync": {
    "bpm": 126,
    "source": "auto"
  },
  "scenes": [ ... ],
  "activeSceneId": "scene-intro"
}
```

## 4. Engineering Roadmap

### Phase 1: Engine Hardening (Effort: 2 Weeks)
- [ ] **Unified Transition Service**: Implementation of the `Warp` and `Glitch` transition shaders.
- [ ] **Role-Based Mixing**: Finalize the `roleWeights` logic in the `glRenderer` to scale layer intensities.
- [ ] **Performance Validation**: Stress test with 8+ active layers across 4 modes.

### Phase 2: User Experience (Effort: 3 Weeks)
- [ ] **Visual Mode Dashboard**: A dedicated panel to customize the 8 modes.
- [ ] **Macro Learning HUD**: Visual feedback when mapping hardware to macro hero controls.
- [ ] **Preset Audition Pro**: Real-time thumbnail generation and "Hover to Preview" in browser.

### Phase 3: Content Expansion (Effort: 2 Weeks)
- [ ] **The "Performers" Pack**: 20 factory presets using the V5 standard.
- [ ] **Chemistry Presets**: 12 pre-defined color chemistry combinations.
- [ ] **Official Documentation**: Tutorial videos and VJ handbook.

---
*Priority: P0 = Critical for launch, P1 = High value, P2 = Future polish.*
