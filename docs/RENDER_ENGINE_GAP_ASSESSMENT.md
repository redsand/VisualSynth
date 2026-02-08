# Render Engine Gap Assessment

This assessment focuses on the current render-engine path centered around `createRenderer`, `RenderGraph`, and `glRenderer`.

## Scope Reviewed
- `src/renderer/render/Renderer.ts`
- `src/renderer/glRenderer.ts`
- `tests/renderGraph.test.ts`
- `tests/e2e/edmFeatures.e2e.test.ts`

## High-Impact Gaps

### 1) Render contract drift risk (manual field fan-out)
`Renderer.ts` manually copies a very large set of `renderState` fields into the output-channel payload. This is high risk for drift when `RenderState` evolves because there is no compiler-enforced mapping layer or schema guard between source and broadcast payload.

**Impact:** Output window regressions and silent missing fields after adding generators/effects.

### 2) Overgrown `RenderState` interface with weak segmentation
`glRenderer.ts` defines a very large `RenderState` interface spanning core timing, post FX, SDF, particles, EDM, and rock generators. The structure is feature-rich but hard to reason about and validate as a stable contract.

**Impact:** Low maintainability, difficult onboarding, and difficult targeted regression testing.

### 3) Missing unit tests for renderer loop behavior
There is good test depth for shared render-graph utilities, but no direct unit tests for `createRenderer` loop behavior such as:
- safe-mode fallback path when WebGL init fails,
- autosave interval behavior,
- output channel throttling,
- quantized scene switch HUD behavior.

**Impact:** Core runtime behavior can regress without test failures.

### 4) No explicit performance budget tests
Code targets realtime behavior, but there are no automated guardrails in tests for timing-sensitive pathways (frame-loop overhead, large payload churn, broadcast cadence).

**Impact:** Performance regressions likely caught late or manually.

## Recommended Maturity Tracks

### Track A: Contract hardening
- Introduce a typed output snapshot builder (`buildOutputSnapshot(renderState)`), used in one place.
- Add schema or compile-time assertion tests for required fields.
- Split `RenderState` into composable sections (`Core`, `FX`, `SDF`, `EDM`, `Rock`, etc.) and re-export a merged type.

### Track B: Renderer loop testability
- Extract small pure helpers from `createRenderer`:
  - FPS/frame-drop update helper,
  - autosave scheduler helper,
  - pending scene quantization helper,
  - output payload throttle helper.
- Unit-test these helpers with deterministic time values.

### Track C: Runtime confidence
- Add smoke tests for safe-mode fallback and output payload cadence.
- Add one integration test around scene quantized switching and HUD messaging.

### Track D: Performance budget checks
- Add lightweight benchmark-style checks (bounded per-frame helper time, bounded payload generation).
- Fail CI when core loop helper regressions exceed threshold.

## Suggested Prioritization
1. Contract hardening (Track A)
2. Renderer loop testability (Track B)
3. Runtime confidence tests (Track C)
4. Performance budget checks (Track D)

This order gives quick risk reduction with minimal architecture churn.
