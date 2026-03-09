# Dynamic Shader Compilation Plan

**Goal:** Eliminate the performance cost of compiling and running all ~100 generator functions in a single monolithic shader. Instead, compile a shader containing only the generator functions actually present in the loaded project's scenes.

**Status Legend:** 🔲 Pending | 🔄 In Progress | ✅ Done | ❌ Blocked

---

## Problem

`glRenderer.ts` contains a single `createFragmentShaderSrc()` function that produces a ~4200-line GLSL string with ALL generator functions embedded unconditionally. This means:

- GPU compiles all ~100 functions on every startup/SDF update
- All function code occupies register space even when disabled
- `if (uEnabled > 0.5)` checks happen per-fragment but cannot eliminate compiled code
- Adding more generators makes this linearly worse

---

## Architecture Overview

```
GeneratorShaderBlocks registry  (new file: src/shared/generatorShaderBlocks.ts)
  ↓ consulted by
ShaderBuilder                   (new file: src/renderer/render/shaderBuilder.ts)
  ↓ called by
glRenderer.ts                   (modified: recompileForGenerators(), shader cache)
  ↓ called by
index.ts / Renderer.ts          (modified: call recompile on project/scene load)
```

### Key Concepts

1. **`GeneratorShaderBlock`** — A plain data object per generator containing three GLSL string fragments: its uniform declarations, its function body, and its `main()` call line.

2. **`ShaderBuilder`** — A pure function that accepts a `Set<string>` of active generator IDs and assembles the three-part shader (preamble + generator blocks + main body).

3. **Shader cache** — A `Map<string, WebGLProgram>` keyed by the sorted, joined set of active generator IDs. Switching between known presets = zero recompile cost.

4. **`recompileForGenerators(ids)`** — New method on the renderer API. Called when a project loads or when scenes change enough to add new generator types. Returns a Promise that resolves when the new program is active.

---

## Phase 1 — Data Layer (no GPU, fully testable)

### Step 1.1 — Define `GeneratorShaderBlock` type 🔲

**File:** `src/shared/generatorShaderBlocks.ts` (new)

```typescript
export interface GeneratorShaderBlock {
  /** Generator ID matching GeneratorId in generatorLibrary.ts */
  id: string;
  /** GLSL uniform declarations, e.g. "uniform float uFooEnabled;\nuniform float uFooOpacity;\n" */
  uniforms: string;
  /** Complete GLSL function definition, e.g. "vec3 foo(vec2 uv, float t, float audio) { ... }" */
  functions: string;
  /** Single line for main(), e.g. "  if (uFooEnabled > 0.5) color += foo(effectUv, uTime, mid) * uRoleWeights.z;" */
  mainCall: string;
}

export const GENERATOR_SHADER_BLOCKS: GeneratorShaderBlock[] = [
  // populated in Step 1.2
];

/** Returns the block for a given generator ID, or null if not found */
export const findGeneratorShaderBlock = (id: string): GeneratorShaderBlock | null =>
  GENERATOR_SHADER_BLOCKS.find(b => b.id === id) ?? null;
```

**Test file:** `tests/generatorShaderBlocks.test.ts`

```typescript
describe('GeneratorShaderBlocks registry', () => {
  it('has an entry for every GeneratorId in GENERATORS array', () => { ... })
  it('every block has non-empty uniforms, functions, and mainCall', () => { ... })
  it('every uniforms block declares exactly one uXxxEnabled uniform', () => { ... })
  it('every mainCall references the enabled uniform and the function', () => { ... })
  it('findGeneratorShaderBlock returns null for unknown id', () => { ... })
  it('findGeneratorShaderBlock returns correct block for known id', () => { ... })
})
```

**TDD order:** Write failing tests → create file with empty array → populate → tests pass.

---

### Step 1.2 — Populate the registry 🔲

Extract each generator's three fragments from `glRenderer.ts` into the `GENERATOR_SHADER_BLOCKS` array.

**Script approach (one-time):** Write a Node.js extraction script `scripts/extract-generator-blocks.js` that:
1. Reads `glRenderer.ts` as a string
2. For each generator, finds the uniform block, function body, and main call via regex
3. Outputs the `GENERATOR_SHADER_BLOCKS` array as TypeScript

**Manual verification:** After extraction, run tests from Step 1.1 to confirm completeness.

**Invariant:** Every entry in `GENERATORS` (from `generatorLibrary.ts`) must have a corresponding entry in `GENERATOR_SHADER_BLOCKS`. The test in Step 1.1 enforces this.

---

### Step 1.3 — `ShaderBuilder` pure module 🔲

**File:** `src/renderer/render/shaderBuilder.ts` (new)

```typescript
import type { GeneratorShaderBlock } from '../../shared/generatorShaderBlocks';

export interface ShaderParts {
  /** Static preamble: version, precision, non-generator uniforms, utility functions */
  preamble: string;
  /** Static main() body template with {{GENERATOR_UNIFORMS}}, {{GENERATOR_FUNCTIONS}},
      {{GENERATOR_CALLS}} insertion points */
  mainTemplate: string;
}

/**
 * Builds a complete fragment shader source including only the specified generators.
 * Pure function — no side effects, no WebGL calls.
 */
export const buildFragmentShader = (
  parts: ShaderParts,
  blocks: GeneratorShaderBlock[],
  activeIds: Set<string>,
  sdfUniforms = '',
  sdfFunctions = '',
  sdfMapBody = '10.0',
  plasmaSource: string | null = null
): string => { ... }

/**
 * Produces a canonical cache key for a set of active generator IDs.
 * Sorted so order doesn't matter.
 */
export const shaderCacheKey = (
  activeIds: Set<string>,
  sdfMapBody: string,
  plasmaSource: string | null
): string => [...activeIds].sort().join(',') + '|' + sdfMapBody + '|' + (plasmaSource ?? '');
```

**Test file:** `tests/shaderBuilder.test.ts`

```typescript
describe('buildFragmentShader', () => {
  it('includes only uniforms for active generators', () => { ... })
  it('includes only functions for active generators', () => { ... })
  it('includes only mainCalls for active generators', () => { ... })
  it('always includes preamble content', () => { ... })
  it('injects sdfUniforms and sdfFunctions at correct insertion points', () => { ... })
  it('produces valid GLSL version header', () => { ... })
  it('with empty activeIds produces shader with no generator code', () => { ... })
})

describe('shaderCacheKey', () => {
  it('is order-independent (same result regardless of Set insertion order)', () => { ... })
  it('two different generator sets produce different keys', () => { ... })
  it('same generators + different sdfMapBody produce different keys', () => { ... })
})
```

---

### Step 1.4 — `collectActiveGeneratorIds` utility 🔲

**File:** `src/shared/shaderUtils.ts` (new)

```typescript
import type { VisualSynthProject } from './project';
import { GENERATORS } from './generatorLibrary';

/**
 * Scans all scenes in a project and returns the Set of generator IDs
 * that appear in at least one layer across any scene.
 */
export const collectActiveGeneratorIds = (project: VisualSynthProject): Set<string> => { ... }
```

**Test file:** `tests/shaderUtils.test.ts`

```typescript
describe('collectActiveGeneratorIds', () => {
  it('returns empty set for project with no scenes', () => { ... })
  it('returns generator ids from all scenes, not just the active one', () => { ... })
  it('deduplicates generator ids that appear in multiple scenes', () => { ... })
  it('ignores layer ids that are not generator ids (effect layers, etc.)', () => { ... })
  it('returns only ids that exist in GENERATORS registry', () => { ... })
})
```

---

## Phase 2 — Renderer Integration

### Step 2.1 — Split `createFragmentShaderSrc` into preamble + template 🔲

**File:** `src/renderer/glRenderer.ts` (modified)

Refactor `createFragmentShaderSrc` to produce two exported string constants:
- `SHADER_PREAMBLE` — everything before generator uniforms: `#version 300 es`, precision, non-generator uniforms, utility functions (hash, fbm, palette, rotate2d, noise helpers, etc.)
- `SHADER_MAIN_TEMPLATE` — the `main()` function body with three placeholder strings:
  - `/* @@GENERATOR_UNIFORMS */`
  - `/* @@GENERATOR_FUNCTIONS */`
  - `/* @@GENERATOR_CALLS */`

The existing `createFragmentShaderSrc` becomes a compatibility wrapper:
```typescript
// Backward compat during transition — builds the "full" shader with ALL generators
export const createFragmentShaderSrc = (sdfUniforms = '', sdfFunctions = '', sdfMapBody = '10.0', plasmaSource = null) =>
  buildFragmentShader(
    { preamble: SHADER_PREAMBLE, mainTemplate: SHADER_MAIN_TEMPLATE },
    GENERATOR_SHADER_BLOCKS,
    new Set(GENERATOR_SHADER_BLOCKS.map(b => b.id)), // all generators
    sdfUniforms, sdfFunctions, sdfMapBody, plasmaSource
  );
```

---

### Step 2.2 — Add shader program cache to `createGLRenderer` 🔲

**File:** `src/renderer/glRenderer.ts` (modified)

```typescript
// Inside createGLRenderer closure:
const programCache = new Map<string, WebGLProgram>();

const getOrCompileProgram = (
  activeIds: Set<string>,
  sdfUniforms = '',
  sdfFunctions = '',
  sdfMapBody = '10.0',
  plasmaSource: string | null = null
): WebGLProgram | null => {
  const key = shaderCacheKey(activeIds, sdfMapBody, plasmaSource ?? '');
  if (programCache.has(key)) return programCache.get(key)!;
  const fSrc = buildFragmentShader(...);
  const prog = createProgram(vertexShaderSrc, fSrc);
  if (prog) programCache.set(key, prog);
  return prog ?? null;
};
```

---

### Step 2.3 — Expose `recompileForGenerators` on renderer API 🔲

**File:** `src/renderer/glRenderer.ts` (modified)

Add to the returned renderer object:
```typescript
recompileForGenerators: (activeIds: Set<string>): boolean => {
  const prog = getOrCompileProgram(activeIds, currentSdfUniforms, currentSdfFunctions, currentSdfMapBody, currentPlasmaSource);
  if (!prog) return false;
  standardProgram = prog;
  // Re-fetch all uniform locations for new program
  uniformLocationCache.clear();
  return true;
}
```

Return type in the public interface expands to include this method.

---

### Step 2.4 — Call `recompileForGenerators` on project load 🔲

**File:** `src/renderer/render/Renderer.ts` (modified)

In `Renderer`, after `applyScene()` or `applyProject()` completes:
```typescript
const activeIds = collectActiveGeneratorIds(store.getState().project);
glRenderer.recompileForGenerators(activeIds);
```

Also call at initial startup after the project is loaded (in `bootstrap.ts` Phase 5, after `applyProject`).

---

## Phase 3 — Extraction Script (one-time migration)

### Step 3.1 — Write extraction script 🔲

**File:** `scripts/extract-generator-blocks.js` (new)

Parses `glRenderer.ts` to extract each generator's three fragments:

```
Uniform block:   lines between previous generator's last uniform and this generator's last uniform
Function body:   lines from `vec3 generatorName(` to closing `}`
Main call:       line `if (uXxxEnabled > 0.5) color += generatorName(...)`
```

Outputs to stdout as a TypeScript array literal, piped into `generatorShaderBlocks.ts`.

Run: `node scripts/extract-generator-blocks.js > src/shared/generatorShaderBlocks.ts`

---

### Step 3.2 — Remove extracted code from glRenderer.ts 🔲

After confirming tests pass:
1. Remove all generator `uniform float uXxx...` declarations from the monolithic shader (they now come from `GeneratorShaderBlock.uniforms`)
2. Remove all generator function bodies (they now come from `GeneratorShaderBlock.functions`)
3. Remove all `if (uXxxEnabled > 0.5) color += ...` lines (they now come from `GeneratorShaderBlock.mainCall`)
4. Insert the three placeholder comments at the correct positions

---

## Phase 4 — Progressive Loading (stretch goal)

### Step 4.1 — Precompile variants at load time 🔲

In `bootstrap.ts`, after initial project load:
```typescript
// Precompile shader variants for all scenes in background (non-blocking)
const allSceneIds = new Set(project.scenes.flatMap(s => collectActiveGeneratorIds(project)));
// Each scene gets its own compile — done in idle time via setTimeout chain
```

This ensures that switching between scenes never triggers an on-demand recompile.

---

## Phase 5 — Cleanup & Validation

### Step 5.1 — Remove fallback full-shader path 🔲

Once all tests pass and the dynamic path is confirmed working:
- Remove the compatibility `createFragmentShaderSrc` wrapper
- Remove the now-empty generator sections from the shader preamble/template

### Step 5.2 — Performance benchmark 🔲

Add a dev-only timing log:
```typescript
console.log(`[Shader] Compiled ${activeIds.size} generators in ${elapsed}ms (cached: ${wasCached})`);
```

Compare startup time and per-frame render time before/after.

---

## File Change Summary

| File | Change |
|------|--------|
| `src/shared/generatorShaderBlocks.ts` | **NEW** — registry of per-generator GLSL fragments |
| `src/shared/shaderUtils.ts` | **NEW** — `collectActiveGeneratorIds` |
| `src/renderer/render/shaderBuilder.ts` | **NEW** — `buildFragmentShader`, `shaderCacheKey` |
| `src/renderer/glRenderer.ts` | **MODIFIED** — split shader, add cache, add `recompileForGenerators` |
| `src/renderer/render/Renderer.ts` | **MODIFIED** — call `recompileForGenerators` on project/scene apply |
| `src/renderer/bootstrap.ts` | **MODIFIED** — call `recompileForGenerators` after initial load |
| `scripts/extract-generator-blocks.js` | **NEW** — one-time extraction script |
| `tests/generatorShaderBlocks.test.ts` | **NEW** |
| `tests/shaderBuilder.test.ts` | **NEW** |
| `tests/shaderUtils.test.ts` | **NEW** |

---

## TDD Execution Order

1. `tests/shaderUtils.test.ts` → `src/shared/shaderUtils.ts` ← **Start here** (no GPU, pure logic)
2. `tests/shaderBuilder.test.ts` → `src/renderer/render/shaderBuilder.ts`
3. `tests/generatorShaderBlocks.test.ts` → `scripts/extract-generator-blocks.js` → `src/shared/generatorShaderBlocks.ts`
4. `src/renderer/glRenderer.ts` refactor (no new tests — existing behavior preserved by construction)
5. Integration: `Renderer.ts` + `bootstrap.ts` wiring
6. `npm test` — all existing tests still pass
7. Manual: load a 2-generator preset, confirm only 2 generators compiled; load a 10-generator preset, confirm cache miss then hit

---

## Risk & Mitigations

| Risk | Mitigation |
|------|-----------|
| Extraction script misses a generator | Step 1.1 test enforces 1:1 with GENERATORS array |
| Shader insertion order breaks GLSL | Tests verify version header, placeholder positions |
| Recompile stall on scene switch | Phase 4 precompiles all scene variants at load time |
| SDF recompile still needed separately | SDF path already uses `createProgram` on demand — integrate with same cache |
| Breaking existing uniform setters | Uniform location cache clears on program switch; existing setters unchanged |
