# Milkwave Audit Baseline

## Purpose

This document records the first classifier-driven Milkwave support baseline so future work can be prioritized by actual preset coverage instead of assumptions.

## Command

Audit sample command used:

```powershell
.\node_modules\.bin\ts-node.cmd scripts\audit-milkwave-support.ts --limit 500 --json
```

## Sample Size

- 500 presets
- folders sampled:
  - `BeatDrop`
  - `Butterchurn`
  - `Incubo_`
  - `Incubo_ Picks`
  - `Milkdrop2077`
  - `Milkwave`

## Tier Counts

- `native-supported`: 10
- `supported-with-degradation`: 417
- `fallback-only`: 73

## Top Blockers

1. `Uses custom shapes that require a native geometry/rendering path.`: 376
2. `Uses preset per-pixel expression code, which is not yet mapped into native execution.`: 358
3. `Uses custom wave per-point code.`: 220
4. `Requires custom texture-slot sampler binding and texture-manager evaluation.`: 62
5. `Uses HLSL scalar aliases that must be normalized before GLSL generation.`: 29
6. `Requires Milkwave volume-noise samplers that are not currently provided by the native runtime.`: 11

## Immediate Interpretation

The highest-coverage blockers are not isolated shader syntax issues.

The dominant missing capabilities are:

- custom shape rendering
- preset per-pixel execution semantics
- custom wave per-point execution
- texture-slot / texture-manager support

This means the migration should prioritize the native runtime contract and expression/geometry support before spending large effort on syntax-only cleanup.

## Planning Consequence

Priority order for broad coverage should be:

1. native runtime contract
2. custom shapes
3. preset per-pixel semantics
4. wave per-point support
5. texture-slot system
6. shader normalization edge cases like `float1`, `tex2Dbias`, and matrix conversion

Shader normalization still matters, but it is not the highest-leverage blocker by preset count.
