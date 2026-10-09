# Test Suite Audit — 2026-10-09

One-time audit of the full vitest suite (152 test files, excluding `tests/e2e/`).
Results saved here so we don't have to re-run the full sweep repeatedly —
work through the open items below when ready.

## Final tally

| Category | Files |
|---|---|
| Verified passing | 147 |
| Stalled before first test completes (see below) | 5 |

## Fixed during this audit

- `tests/outputPayload.test.ts` — 1 test failed: the broadcast payload resolved
  layer assets via `resolveSceneAssetBindings(project, scene.id)`, which looks the
  scene up in `project.scenes` and returns `{}` when the caller passes a scene
  that isn't in that list (e.g. mid-transition). `outputPayload.ts` now resolves
  against the scene in hand via the shared `resolveLayerAsset`. 3/3 pass.
- 89 pre-existing `tsc -p tsconfig.json --noEmit` errors → **0**:
  - `src/shared/project.ts` — `AssetKind` widened with `'internal'` (it was
    already a valid `AssetItem.kind`, used by the built-in internal assets).
  - `src/renderer/render/assetBinding.ts` — dynamic summary-key index needed a
    guarded `as keyof typeof summary` cast.
  - `src/renderer/renderState.ts` — `assetBindingDiagnostics` retyped to
    `SceneAssetDiagnostics` (what RenderGraph actually assigns).
  - `src/shared/serialization.ts` — exported `upgradeProject` / `ensureSceneDefaults`.
  - Test fixtures across 6 files: layer literals given the required `transform`,
    `activeSceneId` removed from scene literals (it's a project field),
    `createOutputPort` → `createInputPort` in renderGraphDeterminism, and a
    `asProject()` Partial-helper for intentionally-minimal project fixtures
    (runtime values unchanged).

## Known-stalled test files (work when ready — related to task: fix broken milkwave presets)

These five iterate every file in `assets/presets/` (7,558 tracked presets,
171 MB) and stall after the vitest banner — no test ever completes, process
idle, no error output. They do not fail the suite's other files; they just
never finish. Not reproducible as a simple "slow test" — the process goes
silent during collection/first-test with ~0% CPU. Suspects: pathological preset
payload(s) triggering an infinite/quadratic path in schema validation or
migration, or vitest collection behavior at 7k+ registered `it()` blocks.

- `tests/presets.test.ts`
- `tests/milkywavePresets.test.ts`
- `tests/presetAssets.test.ts`
- `tests/presetSmokeRenderState.test.ts`
- `tests/renderGraphEntryParity.test.ts`

Bisection notes:
- Importing the source modules alone is fine (probe importing
  `presetMigration` passes in 175 ms) — the stall needs the full preset sweep.
- The stall reproduces solo per file; 120 s and 180 s caps both stall at the
  same point with zero test output.
- 3 other slow files pass given headroom and are NOT problems:
  `expressiveFx.dom`, `integration/playlistIntegration`, `sceneTimeline.dom`.

## Operational notes

- The unmodified full-suite `vitest run` appears to "hang" near
  `presetAuthor.test.ts` for the same reason — it is grinding through (or
  stalling in) the preset sweep files.
- Run subsets directly with `./node_modules/.bin/vitest run <files>` —
  `npx vitest` gets mangled by the rtk hook.