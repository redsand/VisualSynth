# Visual Regression Workflow

## Goal

Compare the shipped `main` renderer against `v1.0` using the same legacy preset inputs and produce capture artifacts plus a diff report.

## Commands

Prepare both branches:

```bash
npm run visual-regression:v1:prepare
```

Run the curated parity matrix:

```bash
npm run visual-regression:v1
```

Run every `v1.0` preset:

```bash
npm run visual-regression:v1:all
```

Target a specific preset:

```bash
node scripts/compare-v1-visuals.js --preset assets/presets/preset-01-cosmic.json
```

Run with repeat variance diagnostics:

```bash
node scripts/compare-v1-visuals.js --preset assets/presets/preset-109-weather-hurricane.json --repeat 3 --repeat-spread 0.1
```

## Output

Artifacts are written to `docs/visual-regression` by default.

For each preset, the harness writes:

- `v1.0.png`
- `main.png`
- `diff.ppm`

It also writes:

- `report.json`
- `report.md`

## Notes

- The harness creates a temporary git worktree at `.worktrees/v1-parity`.
- It applies the original `v1.0` preset JSON to both branches so preset renames on `main` do not invalidate the comparison.
- The harness now seeds deterministic timing/randomness (`performance.now`, `Date.now`, `Math.random`) and resets clock at preset-apply to reduce run-to-run drift.
- Captures are taken after a fixed settle window so transition decay can reach steady state before screenshot diffing.
- Repeat runs now emit per-attempt diff metrics and `unstable` flags (`spreadDiffRatio > --repeat-spread`) in both `report.json` and preset `diagnostics.json`.
- The current diff is threshold-based and intended for regression triage, not strict pixel-perfect certification.
- Known residual instability: weather-heavy presets (for example `preset-109-weather-hurricane`) can still produce intermittent high-diff outliers in batch runs. Use repeat diagnostics and treat `unstable: true` presets as non-gating until variance is reduced or root-caused.
