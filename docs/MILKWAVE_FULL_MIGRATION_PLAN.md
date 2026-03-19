# Milkwave Full Migration Plan

## Purpose

This document defines the full migration path for bringing broad Milkwave preset support into VisualSynth on a GLSL/WebGL2 runtime.

It exists for two reasons:

1. The current Milkwave integration is a failing prototype rather than a reliable production path.
2. This work is large enough that multiple LLM sessions and human contributors must be able to resume it without re-discovery.

This document is the handoff source of truth for Milkwave migration work until native support reaches production readiness.

## Current State

### Current codepaths

- Parsing: `src/shared/milkwaveParser.ts`
- Import-time conversion: `src/shared/hlslToGlsl.ts`
- Offline translation pipeline: `src/shared/milkwaveOfflineTranslation.ts`
- Preset import script: `scripts/importMilkwavePresets.ts`
- Preset migration / `_shaderData` preservation: `src/shared/presetMigration.ts`
- Runtime compile / render path: `src/renderer/milkdropRenderer.ts`
- Main renderer composite: `src/renderer/glRenderer.ts`
- Runtime diagnostics: `src/shared/milkwaveDiagnostics.ts`
- CLI debug helper: `scripts/debug-milkwave-preset.ts`

### What the current implementation actually is

The current implementation is not a full generator-source integration.

Imported Milkwave presets currently work like this:

1. A `.milk` file is parsed into strings and basic config fields.
2. `hlslToGlsl.ts` performs regex-based token replacement and wraps the result as GLSL.
3. The generated strings are serialized into preset `_shaderData`.
4. At runtime, `milkdropRenderer.ts` patches the GLSL again and attempts to compile warp/comp passes.
5. If that fails, VisualSynth falls back to a simple `gen-milkwave` generator effect.

That means the imported preset library was generated from a weak compatibility layer, not from a real Milkwave runtime contract.

### Current migration baseline

The first Milkwave-specific offline translation pipeline is now in place.

Current behavior:

1. `.milk` parses into Milkwave IR via `buildMilkwaveIR(...)`
2. `translateMilkwavePresetOffline(...)` builds an offline translation artifact
3. The artifact persists:
   - generated offline GLSL for `warp` / `comp`
   - per-pass diagnostics / warnings / errors
   - `runtimePatchRecommended`
   - translation pipeline identifier
4. `scripts/importMilkwavePresets.ts` now writes presets from that shared artifact instead of calling `transpileMilkDropShader(...)` directly

This is still using the legacy transpiler backend internally (`legacy-hlsl-to-glsl`), but the architectural control point has moved into a shared Milkwave-specific pipeline that can be upgraded without rewriting the importer again.

### Why the current implementation is insufficient

- It assumes Milkwave shader code can be handled by simple regex transpilation.
- It treats `_shaderData` as if it were enough to recreate preset behavior.
- It only approximates part of the non-shader runtime.
- It does not implement full custom wave, custom shape, texture-slot, or expression-runtime parity.
- Its tests mostly prove schema validity and string presence, not runtime correctness.

## Migration Goals

The goal is not “make some presets work.”

The goal is:

- broad imported Milkwave preset coverage
- deterministic compatibility classification
- diagnosable failures
- explicit support tiers
- testable shader generation and runtime behavior
- safe fallback behavior when features are unsupported

The final system must answer:

- Did the preset parse?
- Did it normalize into a supported IR?
- Which features does it require?
- Can the runtime provide those features?
- Did warp compile?
- Did comp compile?
- Which resources were bound?
- Did native execution run, degrade, or fall back?

## Architectural Direction

### Long-term model

Milkwave must become a first-class source format with its own execution contract.

The target architecture is:

1. `.milk` -> normalized Milkwave IR
2. IR -> capability analysis / support classification
3. IR -> native Milkwave runtime config
4. native runtime -> GLSL generation, pass setup, expression execution, resource binding
5. fallback runtime -> `gen-milkwave` when native execution is unavailable

### Explicit compatibility tiers

Every imported preset must be classified into one of these tiers:

- `native-supported`
- `supported-with-degradation`
- `fallback-only`
- `unsupported`

These are not cosmetic labels. They drive runtime behavior.

### Core principle

Do not keep expanding the legacy regex transpiler and runtime patcher into an ad hoc translator.

Instead:

- parse the Milkwave dialect properly
- normalize it into an intermediate representation
- implement a Milkwave-specific GLSL/runtime pipeline
- support a clearly defined subset well
- degrade or fall back explicitly for the rest

## Upstream Contract We Must Respect

The upstream Milkwave runtime in `../milkwave` establishes the real contract.

Important source files:

- `../milkwave/Visualizer/resources/data/include.fx`
- `../milkwave/Visualizer/vis_milk2/state.cpp`
- `../milkwave/Visualizer/vis_milk2/texmgr.cpp`
- `../milkwave/Visualizer/vis_milk2/milkdropfs.cpp`

These imply support for:

- `_c0.._c17`
- `_qa.._qh`
- `q1..q32`
- `float4x3` rotation matrices
- previous-frame main texture aliases
- blur1/2/3 textures
- 2D and 3D noise samplers
- texture slot samplers
- preset init/per-frame/per-pixel expressions
- custom wave init/per-frame/per-point expressions
- custom shape init/per-frame expressions
- texture manager expressions

This is much broader than the current VisualSynth implementation.

## Major Workstreams

### Workstream 1: IR and normalization

Create a proper Milkwave IR that captures:

- metadata
- scalar parameters
- preset expressions
- warp pass
- comp pass
- custom waves
- custom shapes
- texture slots
- declared samplers
- feature requirements
- inferred capabilities

This IR becomes the shared contract between importer, diagnostics, classifier, runtime, and tests.

### Workstream 2: Capability analysis

Before execution, every preset must be analyzed for:

- shader-language requirements
- expression-runtime requirements
- texture/sampler requirements
- custom geometry requirements
- unsupported builtins or intrinsics

The analyzer determines:

- required features
- blocked features
- degradation options
- compatibility tier

### Workstream 3: Native Milkwave runtime

Build a dedicated runtime under something like:

- `src/renderer/milkwave/runtime/*`

Expected subsystems:

- pass manager
- builtin uniform binder
- previous-frame manager
- blur pyramid manager
- noise texture manager
- sampler alias binder
- expression runtime
- custom wave renderer
- custom shape renderer
- texture-slot manager

### Workstream 4: Milkwave-specific GLSL generation

Replace generic HLSL token replacement with a Milkwave-specific normalization and GLSL generation path.

The generator must handle:

- HLSL scalar aliases like `float1`
- HLSL texture calls
- MilkDrop helper macros
- q bank references
- builtin constant banks
- matrix conversion rules
- GLSL ES strict typing rules

### Workstream 5: Observability

Add stage-by-stage structured reporting:

- parse status
- normalization status
- feature requirements
- compatibility tier
- generated GLSL summary
- per-pass compile/link status
- fallback usage
- resource-binding status

### Workstream 6: Testing

Testing must prove runtime viability, not just schema validity.

Required layers:

- parser tests
- IR normalization tests
- capability classification tests
- GLSL generation snapshot tests
- compile validation tests
- runtime smoke tests
- regression tests for known failing presets
- full-library audit reporting

## Phased Plan

## Phase 0: Freeze the prototype

Status:

- Partially done.
- Diagnostics were added.
- `gen-milkwave` remains available as fallback.

Phase 0 rules:

- No more broadening the regex transpiler as the main strategy.
- Keep the current runtime alive only as fallback / reference / compatibility bridge.
- All new design should point toward IR + classifier + native runtime.

## Phase 1: Define the Milkwave IR

Goal:

- Introduce a stable, explicit Milkwave IR and normalization path.

Status:

- In progress, foundation implemented.
- Offline translation layer now added on top of IR:
  - `src/shared/milkwaveOfflineTranslation.ts`
  - importer persists `_shaderData.translation`
  - preset metadata persists `metadata.milkwave.translation`
- `src/shared/milkwaveIr.ts` exists and normalizes parsed presets into IR.
- IR currently captures metadata, shader passes, expression blocks, waves, shapes, feature requirements, and initial capability assessment.

Deliverables:

- `src/shared/milkwaveIr.ts`
- parser-to-IR conversion layer
- typed feature flags
- typed support tier types
- initial classification-ready shape

Acceptance criteria:

- a parsed `.milk` preset can be converted into IR deterministically
- tests cover representative preset structures
- no runtime behavior change required yet

## Phase 2: Capability classifier

Goal:

- Determine support level before runtime execution.

Status:

- In progress, first classifier implemented.
- `src/shared/milkwaveCapability.ts` exists.
- `scripts/audit-milkwave-support.ts` exists and has already produced an audit baseline.
- Import-time metadata persistence is now started: imported presets can carry `metadata.milkwave` with support tier, feature summary, and classifier reasons.

Deliverables:

- feature inventory model
- support-tier classifier
- diagnostic reasons for downgrade/blocking
- batch audit script over imported preset library

Acceptance criteria:

- every imported Milkwave preset can be classified
- top blockers can be summarized by count

## Phase 3: Native runtime resource contract

Goal:

- Implement the actual runtime resources Milkwave shaders expect.

Status:

- Started.
- `src/renderer/milkwave/runtime/milkwaveContract.ts` defines the current runtime contract scaffold.
- Builtin and sampler binders now exist in:
  - `src/renderer/milkwave/runtime/milkwaveBuiltins.ts`
  - `src/renderer/milkwave/runtime/milkwaveSamplers.ts`
- `src/renderer/milkdropRenderer.ts` has begun delegating uniform/sampler binding to those modules.
- Native custom shape execution is now started through:
  - `src/renderer/milkwave/runtime/milkwaveShapes.ts`
  - `src/renderer/milkwave/runtime/milkwaveShapeRenderer.ts`
- Native custom wave execution is now started through:
  - `src/renderer/milkwave/runtime/milkwaveWaveRenderer.ts`
- The runtime now tracks native pass execution counts in `getLastNativeRuntimeReport()` so failures are diagnosable pass-by-pass.

Deliverables:

- previous frame bindings
- blur textures and scaling data
- `_c` banks
- q banks
- supported sampler aliases
- noise samplers

Acceptance criteria:

- native runtime can bind the common builtin contract without patch-time guessing

## Phase 4: GLSL generation path

Goal:

- Generate GLSL ES for Milkwave shader dialect from normalized IR.

Deliverables:

- shader normalizer
- warp GLSL generator
- comp GLSL generator
- compile-validation tests

Acceptance criteria:

- curated representative presets generate valid GLSL for supported features

## Phase 5: Expression runtime parity

Goal:

- Support preset behavior beyond shader code.

Priority order:

1. preset init and per-frame
2. wave and shape init/per-frame
3. wave per-point
4. texture-slot expressions

Status:

- Partially started through the native geometry runtime.
- Shape init, per-frame, and per-point execution are implemented in the custom shape path.
- Wave init, per-frame, and per-point execution are implemented in the custom wave path.
- Preset-level per-pixel logic and texture-slot expressions are still missing.

Acceptance criteria:

- curated presets that depend on expression-driven state transitions behave plausibly and deterministically

## Phase 6: Custom waves, shapes, and texture slots

Goal:

- Recover large preset classes that depend on extra geometry and texture infrastructure.

Acceptance criteria:

- representative wave-heavy, shape-heavy, and texture-heavy presets render in native or degraded mode

## Phase 7: Library-wide verification

Goal:

- quantify support across the full imported Milkwave library.

Deliverables:

- batch audit results
- curated native-supported list
- curated degraded list
- known-blocked list

Acceptance criteria:

- support is measurable
- production rollout can be scoped by actual coverage

## Immediate Next Tasks

The next coding steps after this document are:

1. Expand the runtime contract beyond builtin/sampler binding into explicit pass-state management
2. Add native runtime reporting to renderer debug surfaces and CLI inspection tooling
3. Implement true textured custom shapes instead of flat-color fallback geometry
4. Start native preset per-pixel execution against the new runtime contract
5. Start texture-slot infrastructure and sampler/resource plumbing for presets that depend on it
6. Keep `gen-milkwave` as the guaranteed fallback while native path coverage expands

Do not start native runtime rewrites before IR and capability classification exist.

## Code Ownership Map

Files that are part of the legacy prototype and should be treated carefully:

- `src/shared/hlslToGlsl.ts`
- `src/renderer/milkdropRenderer.ts`
- `scripts/importMilkwavePresets.ts`

Files that are part of the new direction:

- `src/shared/milkwaveDiagnostics.ts`
- `src/shared/milkwaveIr.ts`
- future classifier/runtime modules under `src/shared/milkwave*` and `src/renderer/milkwave/*`

## Risks

### High risk

- Trying to reach broad compatibility with regex-only translation
- Conflating generator fallback with native support
- Expanding runtime patching faster than diagnostics and tests

### Medium risk

- Underestimating texture-slot and expression-runtime requirements
- Mixing migration work with unrelated renderer refactors

### Lower risk

- Maintaining `gen-milkwave` as a fallback path during migration

## Non-goals for early phases

These should not block Phase 1 or Phase 2:

- image-perfect parity for all imported presets
- full EEL parity on day one
- eliminating the fallback path immediately
- reimporting the entire preset library before classifier support exists

## Definition of “Done”

Milkwave migration is not done when some presets compile.

It is done when:

- the runtime has an explicit Milkwave contract
- support tiers are deterministic
- unsupported features are surfaced clearly
- curated representative presets pass parser, classifier, compile, and render smoke tests
- full-library coverage can be measured
- live runtime behavior is stable enough for production use
