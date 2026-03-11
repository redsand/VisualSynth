# Renderer Entrypoint Unification

## Current State

Production builds now default to [`src/renderer/bootstrap.ts`](../src/renderer/bootstrap.ts) through [`scripts/build-renderer.js`](../scripts/build-renderer.js), with explicit fallback override to `index.ts` via `--entry=index` or `VS_RENDERER_ENTRY=index`.

The repository also contains an alternate runtime path built around:
- [`src/renderer/bootstrap.ts`](../src/renderer/bootstrap.ts)
- [`src/renderer/render/Renderer.ts`](../src/renderer/render/Renderer.ts)
- store-driven services under [`src/renderer/state`](../src/renderer/state)

That means the codebase currently has two browser-side renderer entry architectures:
- `bootstrap.ts`: shipped modular entrypoint that composes services and a store-driven renderer
- `index.ts`: fallback monolithic entrypoint with direct DOM ownership and render loop

## Concrete Drift Risks

The split matters because the two entrypaths have historically owned overlapping behavior:
- startup project selection and recovery handling
- project validation and runtime normalization
- project output configuration resolution
- scene activation and transition bookkeeping
- shader warmup / scene variant precompile behavior
- safe-mode fallback behavior
- render loop ownership and diagnostics exposure

Several of these are now shared, but the entrypoint split still exists.

## What Has Already Been Unified

Shared runtime helpers now cover:
- loadable project resolution in [`src/renderer/loadableProject.ts`](../src/renderer/loadableProject.ts)
- startup project selection in [`src/renderer/startupProject.ts`](../src/renderer/startupProject.ts)
- startup selection application in [`src/renderer/startupProjectApply.ts`](../src/renderer/startupProjectApply.ts)
- loadable project runtime application in [`src/renderer/projectApplyRuntime.ts`](../src/renderer/projectApplyRuntime.ts)
- output config resolution in [`src/renderer/outputRuntime.ts`](../src/renderer/outputRuntime.ts)
- output session startup initialization in [`src/renderer/outputSessionRuntime.ts`](../src/renderer/outputSessionRuntime.ts)
- output broadcast payload composition in [`src/renderer/render/outputPayload.ts`](../src/renderer/render/outputPayload.ts)
- VisualSynth API bridge fallback guard in [`src/renderer/visualSynthBridge.ts`](../src/renderer/visualSynthBridge.ts)
- scene activation runtime resolution in [`src/renderer/sceneRuntime.ts`](../src/renderer/sceneRuntime.ts)
- shader warmup / variant precompile in [`src/renderer/shaderLifecycle.ts`](../src/renderer/shaderLifecycle.ts)
- safe-mode renderer fallback in [`src/renderer/safeModeRenderer.ts`](../src/renderer/safeModeRenderer.ts)

## Target End State

The target architecture is:
- one shared runtime startup/apply surface
- `index.ts` reduced to shipped DOM wiring plus a thin call into shared runtime helpers
- `bootstrap.ts` reduced to an alternate wrapper over the same shared runtime helpers
- packaging tests that clearly describe which wrapper is shipped

At that point, changing startup/project/scene/render behavior should require edits in one shared runtime layer rather than parallel fixes in both entrypaths.

## Remaining Work

1. Extract the remaining project-apply and scene-apply side effects out of `index.ts`.
2. Align render-loop ownership expectations and diagnostics across both paths.
3. Reduce both entrypoints to thin wrappers.
4. Re-verify build, focused runtime tests, and release gate.

## Drift Inventory (Current)

### Runtime-Critical (Must Be Shared Before Bootstrap Cutover)

- `index.ts` still owns full project/scene apply orchestration tied to renderer + UI update ordering.
- `index.ts` still owns startup/loading progress flow and initialization sequencing around audio/MIDI setup.
- `index.ts` still owns capture API wiring and direct render loop trigger behavior.
- `bootstrap.ts` still uses store/service orchestration that is not yet equivalent to `index.ts` side effects.

### DOM/UI Wiring (Wrapper-Local, Not a Cutover Blocker)

- Panel initialization and DOM event wiring for controls.
- Mode dashboard and panel refresh plumbing.
- Most direct element updates (`textContent`, selects, toggles).

### Legacy-Only / Transitional

- `index.ts` remains a supported fallback renderer entrypoint.
- `bootstrap.ts` is now shipped by default and must stay behavior-aligned with `index.ts` until fallback removal.

## Bootstrap Cutover Plan (Tracked)

1. `completed` Complete inventory of `index.ts`-only runtime-critical behaviors and keep this list current.
2. `completed` Keep startup/recovery/showcase behavior on one shared path (`startupProject.ts` + `startupProjectApply.ts`).
3. `completed` Extract project-apply runtime orchestration from `index.ts` into shared helpers callable by both wrappers (`projectApplyRuntime.ts`).
4. `completed` Extract scene-apply runtime orchestration from `index.ts` into shared helpers callable by both wrappers.
Completed scope:
- Shared scene activation apply helper in `sceneRuntime.ts` (`applySceneActivationRuntime`).
- `index.ts` scene apply path now uses the shared runtime helper for transition bookkeeping, palette apply flag updates, and scene shader warmup.
- `bootstrap.ts` scene switch callback now resolves activation via `sceneRuntime.ts` and recompiles scene-specific shaders after activation.
5. `completed` Move remaining render-loop runtime decisions to shared helpers, leaving wrapper-only diagnostics/UI updates local.
Completed scope so far:
- output payload fan-out now routes through `buildRendererOutputBroadcastPayload` in `render/outputPayload.ts` for both `index.ts` and `render/Renderer.ts` (palette + layer asset metadata included).
- shared `ensureVisualSynthBridge(window)` fallback guard now runs in both wrappers, removing wrapper-specific mock bridge setup drift.
- bootstrap now exposes capture parity hooks (`__visualSynthCaptureApi` scene/project apply, diagnostics, mode set, trigger action) plus `__visualSynthInitialized` for automation parity.
6. `completed` Add bootstrap-readiness architecture tests that fail if shared runtime helpers are bypassed.
7. `in_progress` Add focused parity integration tests for startup selection, project load, scene switch, safe mode, and output behavior across both wrappers.
8. `completed` Flip shipped entrypoint from `index.ts` to `bootstrap.ts` behind a branch-local packaging change.
9. `pending` Run release gate and visual regression gate, then remove stale wrapper-only runtime code.

## Readiness Gates (Must Pass Before Step 9)

- `npm run build`
- `npm run test:bootstrap-readiness`
- `npm run release:check`
- `npm run visual-regression:v1 -- --limit 3 --skip-build`

Current tooling note: instrumented coverage (`vitest --coverage`) is not yet available because `@vitest/coverage-v8` is not installed. Functional coverage is tracked through the focused bootstrap-readiness suite above.

Latest validation snapshot (2026-03-11):
- `npm run test:bootstrap-readiness` passed: 17 files, 64 tests.
- `npm run build:bootstrap` passed (`[build-renderer] entrypoint: bootstrap.ts`).
- `npm run release:check:bootstrap` passed: packaging + bootstrap build + full test suite.
- `npm run release:check` passed: packaging + build + full test suite.
- `npm run release:check:index` passed: packaging + index fallback build + full test suite.
- `npm run visual-regression:v1 -- --limit 3 --skip-build --output docs/visual-regression-bootstrap-preflight` completed.
- `npm run visual-regression:v1 -- --output docs/visual-regression-curated-5` completed.
- `node scripts/compare-v1-visuals.js --preset assets/presets/preset-109-weather-hurricane.json --repeat 3 --repeat-spread 0.1 --skip-build --output docs/visual-regression-109-repeat3-rerun` completed with explicit repeat instability diagnostics.
Latest full gate totals:
- 102 test files passed
- 16,345 tests passed
- 29 skipped

Visual preflight note:
- Startup safety and shader/runtime diagnostics are clean (no safe mode, no shader errors, no missing uniforms) in the curated visual run.
- Curated 12-preset bank currently averages `11.932%` diff, with largest residuals in `preset-60-warp-core`, `preset-83`, `preset-85`, `preset-54`, and `preset-109`.
- RenderGraph entry parity gap patched: `spectrumEnabled` fallback now matches shipped `index.ts` (`false` when `layer-spectrum` is absent) and `gen-8bit-grid` is now resolved in the split renderer path.
- Repeat-variance diagnostics now flag unstable captures; latest `preset-109` repeat run shows `56.390%` spread and is marked unstable in report + diagnostics output.

## Functional Coverage Focus

- Startup selection and application:
  - `tests/startupProject.test.ts`
  - `tests/startupProjectApply.test.ts`
- Project load normalization and output behavior:
  - `tests/projectApplyRuntime.test.ts`
  - `tests/loadableProject.test.ts`
  - `tests/outputRuntime.test.ts`
  - `tests/outputSessionRuntime.test.ts`
- Scene activation and shader warmup:
  - `tests/sceneRuntime.test.ts`
  - `tests/shaderLifecycle.test.ts`
- Render loop cadence and guardrails:
  - `tests/renderLoopHelpers.test.ts`
  - `tests/rendererLoop.integration.test.ts`
- Entrypoint architecture assertions:
  - `tests/rendererArchitecture.test.ts`
- Split-renderer runtime parity:
  - `tests/renderGraphEntryParity.test.ts`
