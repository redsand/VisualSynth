# Main vs v1.0 Parity Assessment

Date: 2026-03-11

## Scope

This assessment verifies that `main` preserves the functional surface of `v1.0` while adding dynamic shader compilation and fixing the startup safe-mode regression introduced during the migration.

## Verified

- The shipped renderer no longer compiles the full generator registry at startup.
- Active-scene shader compilation is scoped to the active scene instead of the union of all project scenes.
- Scene shader lifecycle behavior is shared between `index.ts` and `bootstrap.ts`.
- Runtime project normalization is shared between the renderer and persistence paths.
- Non-rendering placeholder ids such as `viz-*` and `fx-*` are excluded from active shader compilation.
- Burst SDF presets register built-in nodes before loading runtime presets.
- Split-renderer (`RenderGraph`) defaults now match shipped `index.ts` for missing-spectrum fallback and 8-bit grid id resolution.
- All `v1.0` generator ids still exist in the current generator library.
- All `v1.0` parameter registry ids still exist in the current parameter registry.
- Every `v1.0` preset loads on current `main`, applies successfully, and produces render state.
- Every `v1.0` template loads on current `main`.
- Every `v1.0` preset can build a scene-scoped dynamic fragment shader on current `main`.

## Intentional Differences From v1.0

- `main` adds dynamic shader compilation and scene-scoped shader variants.
- `main` adds a large imported Milkwave preset library.
- Imported Milkwave custom `warp` and `comp` shader payload is not executed by the runtime. This is now explicitly warned and falls back to `gen-milkwave` instead of silently implying support.

## Evidence

- Compatibility test: `tests/v1Compatibility.test.ts`
- Legacy compatibility test: `tests/legacyPresetCompatibility.test.ts`
- Startup regression test: `tests/glRendererStartup.test.ts`
- Shared shader lifecycle test: `tests/shaderLifecycle.test.ts`
- Runtime project normalization test: `tests/runtimeProject.test.ts`
- Burst SDF registration test: `tests/renderGraphBurstSdf.test.ts`
- Split-renderer parity test: `tests/renderGraphEntryParity.test.ts`
- Milkwave fallback contract test: `tests/milkwaveImport.test.ts`
- Visual regression preflight: `docs/visual-regression-curated-bootstrap-cutover/report.md`

Latest verification run:

- `npm run release:check:bootstrap`
- `npm run release:check:index`
- `npx vitest run tests/v1Compatibility.test.ts tests/legacyPresetCompatibility.test.ts tests/presetSmokeRenderState.test.ts`
- `npm run test:bootstrap-readiness`
- `npm run visual-regression:v1 -- --skip-build --output docs/visual-regression-curated-bootstrap-cutover`
- `node scripts/compare-v1-visuals.js --preset assets/presets/preset-109-weather-hurricane.json --repeat 3 --repeat-spread 0.1 --skip-build --output docs/visual-regression-109-repeat3-rerun`

Result:

- `17` bootstrap-readiness files passed (`64` tests)
- No safe mode, shader errors, or missing uniforms in curated parity run
- Curated 12-preset visual regression average diff: `11.275%`
- Highest residual drift in curated bank:
  - `preset-60-warp-core`: `27.275%`
  - `preset-85-sdf-3d-torus`: `22.981%`
  - `preset-83-sdf-geometry-101`: `22.979%`
  - `preset-54-vapor-grid`: `22.954%`
  - `preset-109-weather-hurricane`: `17.086%`

## Remaining Residual Risk

- Visual parity has been validated structurally and behaviorally, not by pixel-perfect screenshot diffing against a live `v1.0` renderer session.
- Curated parity still has critical outliers (portal/topo/SDF/weather families) that are not release-ready.
- Legacy SDF presets with empty legacy layer payloads (`preset-83`, `preset-85`) still require migration/runtime parity hardening.
- The repo still carries dual renderer entry architecture (`bootstrap.ts` shipping path and `index.ts` fallback path), even though the highest-risk shader behavior is now shared.
- Weather preset diff variance is real and measurable (`preset-109` repeat spread reached `56.390%` in a 3-run sample), so unstable presets require repeated capture before go/no-go calls.

## Readiness Call

`main` is functionally stable for startup/runtime compatibility and dynamic shader compilation behavior. It is **not yet production visual-parity-ready** because curated high-drift presets remain in portal/topo/SDF/weather families.

Based on current evidence, core v1 functionality coverage is preserved in tests, major drift is reduced, and the remaining risk is concentrated in a smaller set of preset families that still need parity fixes.
