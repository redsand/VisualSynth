# Milkwave grading: engines, palettes, and gamma on MilkDrop scenes

Fixed 2026-11-06. Before this, the milkwave (MilkDrop) render pipeline was a
completely separate path from the generator pipeline: switching **visual
engines** or **color palettes** had *zero* effect on milkwave scenes
(measured pixel-exact), and MilkDrop's comp-stage gamma (`fGammaAdj`) was
never applied at all — which made bright presets render searing white and
let feedback-amplifying presets drift to blowout over minutes of continuous
single-scene dwell.

## Where it happens

The single point where milkwave output reaches the canvas is the composite
draw in `src/renderer/glRenderer.ts` (milkdrop main texture → canvas). That
composite shader now applies, in order:

1. **MilkDrop comp gamma** (`fGammaAdj`, per-preset from
   `originalParameters`, 1.0 = unchanged, >1 darkens) — a fidelity fix: most
   presets ship fGammaAdj ≈ 1.9–2.0 and expect that darkening. This is the
   primary mitigation for the long-dwell white drift (feedback-amplifying
   presets previously hit YAVG ≥ 200 after ~2–3 minutes).
2. **Palette grade** — luminance is remapped through the active palette ramp
   (the same 5-color ramp the generator shaders use), at `uPaletteMix`
   0.65: strong enough that switching palettes visibly recolors milkwave
   scenes, gentle enough that the preset's own shading shows through.
3. **Engine finish** — grain, vignette, and chromatic aberration with the
   same formulas and uniform values as `mainTemplate.glsl` (the generator
   pipeline), so an engine looks consistent across scene types.

Both windows get it: the preview renders it directly, the output window
receives the engine finish values and palette via the BroadcastChannel
state (output.ts already consumed those messages).

Also fixed alongside: the EEL per-frame `decay` variable is now uploaded to
the default and native per-pixel warp meshes (`uBaseDecay`) instead of being
baked at compile time from `fDecay` — per-frame decay modifications take
effect (see the milkwave EEL built-in reset fix for the rest of that story).

## Verification

- `scripts/probe-milkwave-grading.ts` — palette-switch diff vs the scene's
  own animation baseline, and engine none-vs-vapor diff. Post-fix: palette
  57.3 vs baseline 39.9 (effective), engine 104.6 (effective).
- `scripts/probe-long-dwell.ts` — holds one scene for minutes and tracks
  YAVG against the certification chain's BLOWN threshold (200).
- Not applied to patched custom warp shaders: framework decay after the
  body would double-decay presets that carry their own decay line (real
  MilkDrop doesn't do that either); those presets ride the gamma fix.
