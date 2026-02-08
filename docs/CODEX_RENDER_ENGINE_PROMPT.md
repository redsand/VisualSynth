# Codex Prompt: Mature the VisualSynth Render Engine

Use this prompt with Codex when you want focused, test-driven render-engine improvements.

```text
You are working in the VisualSynth repository. Your goal is to mature the render engine with measurable reliability and maintainability gains while preserving behavior.

Context and constraints:
- Keep changes incremental and shippable.
- Preserve existing project format and installer/build scripts.
- Prioritize deterministic logic and testability.
- Every change must include tests that prove the behavior.
- Prefer small pure helpers over large monolithic runtime functions.

Current known gaps to address:
1) Render contract drift risk: `src/renderer/render/Renderer.ts` manually fans out a large output payload from `renderState`.
2) Overgrown render contract: `src/renderer/glRenderer.ts` uses a very large `RenderState` interface with mixed concerns.
3) Missing renderer loop unit tests: no direct coverage for safe mode fallback, autosave cadence, output throttling, and quantized scene switch behavior.
4) Missing performance guardrails in tests for frame-loop related helper logic.

Task:
Implement a phased improvement plan and complete Phase 1 in this PR.

Required workflow:
1. Analyze current render engine architecture and propose a concise plan (max 5 steps).
2. Implement Phase 1:
   - Extract at least one pure helper from `createRenderer` that reduces loop complexity.
   - Introduce a typed mapping helper for output payload generation.
   - Keep behavior unchanged unless a bug is explicitly fixed.
3. Add or update tests to prove correctness.
4. Run tests and report exact commands + results.
5. Document what remains for next phases.

Test requirements (must include):
- Unit tests for extracted helper(s) with deterministic timestamp inputs.
- Unit test verifying output payload mapping for critical fields.
- Unit test for safe-mode fallback path or an equivalent renderer initialization guard.
- Existing relevant test suite still passes.

Acceptance criteria:
- Clear reduction in complexity for `createRenderer` (fewer inlined responsibilities).
- Typed, centralized output payload builder exists and is tested.
- New tests fail before the fix and pass after the fix (explain logically if not demonstrating pre-fix run).
- No breaking changes to public project schema.

Output format:
- Summary of architecture decisions.
- File-by-file change list.
- Risk and rollback notes.
- Test evidence with commands and pass/fail status.
```

## Quick Usage Tip
For best results, paste this prompt and then add one extra sentence specifying your immediate focus (example: “Focus first on output payload mapping + tests”).
