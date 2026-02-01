# Expressive FX

Expressive FX sit above the standard FX stack and operate on perceived meaning rather than raw pixels. Each effect exposes a single Macro knob for fast performance control, with additional Expert parameters hidden behind a disclosure. Effects can also be bound to Scene intent so they automatically intensify during specific moments.

## Core Concepts

- Macro: Primary performance control (0-1). Defaults to the only visible knob.
- Expert: Advanced parameters for tuning the effect character.
- Intent Binding: Optional boost when the active Scene intent matches (calm, pulse, build, chaos, ambient).
- Crossfades: Values are blended by the Scene system when switching.

## Available Expressive FX

### Energy Bloom
- Macro: Overall energy bloom intensity.
- Expert:
  - Threshold: Luminance/audio threshold required to bloom.
  - Accumulation: How aggressively bloom builds as energy rises.
- Behavior: Accumulates glow based on luminance and RMS/peak energy to make high-intent moments feel radiant.

### Radial Gravity
- Macro: Overall gravity strength.
- Expert:
  - Strength: Pull intensity toward the focus point.
  - Radius: Radius of influence (falloff range).
  - Focus X / Focus Y: Focal point (0-1 screen space).
- Behavior: Pulls visuals toward a focal point to suggest mass, intention, or convergence.

### Motion Echo
- Macro: Overall echo strength.
- Expert:
  - Decay: How quickly the echo fades.
  - Warp: Warping strength of the echoing motion.
- Behavior: Generates temporal ghosting using audio trail energy and time-based phase to create trailing motion.

### Spectral Smear
- Macro: Overall smear amount.
- Expert:
  - Offset: Band-driven displacement strength.
  - Mix: Blend between original and smeared color.
- Behavior: Uses FFT band energy to displace color channels, creating audio-reactive spectral diffusion.

## Intent Binding

Each FX can be bound to a Scene intent. When the active Scene intent matches, the binding amount is added to the Macro value (clamped to 0-1). This allows expressive boosts without manual intervention.

## Data Model

```
expressiveFx: {
  energyBloom: {
    enabled: boolean,
    macro: number,
    intentBinding: { enabled: boolean, intent: SceneIntent, amount: number },
    expert: { threshold: number, accumulation: number }
  },
  radialGravity: {
    enabled: boolean,
    macro: number,
    intentBinding: { enabled: boolean, intent: SceneIntent, amount: number },
    expert: { strength: number, radius: number, focusX: number, focusY: number }
  },
  motionEcho: {
    enabled: boolean,
    macro: number,
    intentBinding: { enabled: boolean, intent: SceneIntent, amount: number },
    expert: { decay: number, warp: number }
  },
  spectralSmear: {
    enabled: boolean,
    macro: number,
    intentBinding: { enabled: boolean, intent: SceneIntent, amount: number },
    expert: { offset: number, mix: number }
  }
}
```

## UI Notes

- Expressive FX live in the Design panel under a dedicated section.
- Macro controls stay front-and-center for performance use.
- Expert parameters are hidden behind a summary disclosure.
- Intent binding UI mirrors Scene intent values and adds a boost amount slider.
