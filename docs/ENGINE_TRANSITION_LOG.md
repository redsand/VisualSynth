# Visual Engine Transition Log

This document records the removal or disabling of neutral/unopinionated visual paths in favor of authored **Visual Engines**.

## The "Kill List" (Removed/Disabled Generic Behaviors)

### 1. Linear Bloom Thresholding
- **Status**: REMOVED from `glRenderer.ts`.
- **Old Path**: `color += pow(color, vec3(2.0)) * uBloom;`
- **Reason**: Linear bloom is unopinionated and leads to flat, "muddy" visuals. 
- **Replacement**: HDR-style **Energy Accumulation Glow**. It respects engine-defined `maxBloom` constraints and scales intensity based on authored spectral energy bands (Highs).

### 2. Flat FFT → Parameter Mappings
- **Status**: DE-PRIORITIZED in UI and replaced in core logic.
- **Old Path**: Mapping directly to `audio.rms` or `audio.peak`.
- **Reason**: Raw audio data is jittery and unmusical. It creates "flicker" rather than "motion."
- **Replacement**: **Inertial Energy Bands** (Low, Mid, High). These bands incorporate the Engine's **Motion Grammar** (Mass and Friction) to create organic, momentum-based responses.

### 3. Neutral Style Presets
- **Status**: REMOVED from `DEFAULT_PROJECT`.
- **Old Path**: `id: 'style-neutral'`.
- **Reason**: Neutral settings (1.0 contrast, 1.0 saturation) produce flat visuals reminiscent of legacy shader demos.
- **Replacement**: **'Signature Glow'** style. Opinionated defaults for contrast, saturation, and palette shift ensure the synthesizer always outputs high-impact visuals.

### 4. Unconstrained Macro Grids
- **Status**: DISABLED in UI (via Progressive Disclosure).
- **Old Path**: Exposing all 8 macros with generic labels.
- **Reason**: Too much choice leads to analysis paralysis and "parameter soup."
- **Replacement**: **Engine-Scoped Macros (5–7 controls)**. The UI now dims and disables unused slots, forcing focus onto the engine's curated "sweet spots."

### 5. Competing FX Stacks (Linear Summation)
- **Status**: CONSTRAINED in `glRenderer.ts`.
- **Old Path**: Generic `uExpressiveEnergyBloom` and `uExpressiveSpectralSmear` blocks stacked on top of everything.
- **Reason**: Uncontrolled stacking creates visual noise and destroys the focal hierarchy.
- **Replacement**: Integrated **Engine-Aware Glow**. Bloom and saturation are now part of the engine's final pass, ensuring a coherent "visual grammar."

---
*VisualSynth: From Toolbox to Instrument.*
