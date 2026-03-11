# Residual Risk Remediation Plan

Date: 2026-03-11

## Current Gate Status

- `npm run release:check` passed (bootstrap default path).
- `npm run release:check:index` passed (fallback index path).
- `npm run test:bootstrap-readiness` passed (`17` files, `64` tests).
- Curated visual regression passed structurally with no safe mode/shader errors:
  - report: `docs/visual-regression-curated-bootstrap-cutover/report.md`
  - average diff: `11.275%`
  - top residual presets: `60`, `85`, `83`, `54`, `109`

## Remaining Production Blockers

1. `preset-60-warp-core` visual drift (`27.275%`)
2. `preset-85-sdf-3d-torus` visual drift (`22.981%`)
3. `preset-83-sdf-geometry-101` visual drift (`22.979%`)
4. `preset-54-vapor-grid` visual drift (`22.954%`)
5. `preset-109-weather-hurricane` visual drift (`17.086%`)

## Blocker Baseline (Repeat-3)

Source: `docs/visual-regression-blockers-repeat3/report.md`

- `preset-60-warp-core`: `27.275%` diff, `10.146%` spread, `unstable: true`
- `preset-54-vapor-grid`: `22.954%` diff, `0.000%` spread, `unstable: false`
- `preset-83-sdf-geometry-101`: `22.981%` diff, `0.000%` spread, `unstable: false`
- `preset-85-sdf-3d-torus`: `22.981%` diff, `0.000%` spread, `unstable: false`
- `preset-109-weather-hurricane`: `17.086%` diff, `0.000%` spread, `unstable: false`

## Execution Plan

1. Freeze a baseline matrix for the five blocker presets with `--repeat 3` and `--repeat-spread 0.1`.
2. Add per-preset parity diagnostics capture helpers to record render-state deltas at capture time.
3. Resolve SDF-only drift (`83`/`85`) by tracing entrypoint/runtime differences that affect SDF render path with no active generator layers.
4. Resolve portal/topo drift (`60`/`54`) by verifying generator uniforms/defaults and post-FX order against v1 behavior.
5. Resolve weather drift (`109`) by isolating deterministic-state sources and enforcing stable capture state before compare.
6. Re-run the five-preset blocker set with repeats and verify spread + median improvements.
7. Re-run curated 12-preset matrix and update parity assessment docs.

## Acceptance Criteria

- No safe mode reasons in curated matrix.
- No shader errors in curated matrix.
- No missing uniforms in curated matrix.
- Curated average diff stays at or below current baseline (`11.275%`) and top-five preset diffs trend down.
- No blocker preset reports `unstable: true` in 3-repeat diagnostic runs.
