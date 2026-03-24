# Investigation: Intermittent Black Output Bug — Scene Transition Tracing

## Bug Summary

The renderer intermittently produces fully black output after scene transitions. The output is **valid-but-black**: the render loop runs, draw calls are issued, the canvas and shader program references appear intact, yet the final sampled frame is all-black. The issue is inconsistent across transitions to the same scene, and previewing a scene is not a reliable fix.

---

## Affected Components

- [`src/renderer/glRenderer.ts`](../../../../src/renderer/glRenderer.ts) — WebGL shader program lifecycle, async compilation, `setCustomShaderBlocks`, `render()`
- [`src/renderer/shaderLifecycle.ts`](../../../../src/renderer/shaderLifecycle.ts) — `compileSceneShaders`, called on every scene activation
- [`src/renderer/index.ts`](../../../../src/renderer/index.ts) — Main render loop, `applyScene()`, blend transition management, `isPlaying` guard
- [`src/renderer/scene/SceneManager.ts`](../../../../src/renderer/scene/SceneManager.ts) — `getBlendSnapshot()`, `startTransition()`, cross-scene layer blending
- [`src/renderer/render/Renderer.ts`](../../../../src/renderer/render/Renderer.ts) — Secondary render loop (bootstrap path), `renderGraph.dispose()` call
- [`src/renderer/bootstrap.ts`](../../../../src/renderer/bootstrap.ts) — `applySceneById()`, `renderGraph.dispose()` duplication

---

## Root Cause Analysis

### Primary Root Cause: `setCustomShaderBlocks` Clears Program Cache On Every Scene Transition

**Location:** `src/renderer/shaderLifecycle.ts:compileSceneShaders` → `glRenderer.ts:setCustomShaderBlocks`

**Flow:**
```
applyScene(sceneId)
  → compileSceneShaders(renderer, scene, project, customBlocks, sdfEnabled)
      → renderer.setCustomShaderBlocks(customBlocks)   // ← clears entire cache
      → renderer.recompileForGenerators(activeIds, ...)  // ← always misses cache
```

`compileSceneShaders` (in `shaderLifecycle.ts`) **always** calls `setCustomShaderBlocks` before `recompileForGenerators`. Even when custom blocks have not changed (most scene transitions), `setCustomShaderBlocks` unconditionally:

1. Iterates `programCache` and calls `gl.deleteProgram()` on every cached program
2. Calls `programCache.clear()`, `activeUniformLookupCache.clear()`, `uniformLocationCache.clear()`

After this, `recompileForGenerators` is called. The cache is always empty (just cleared), so it **always** starts async compilation via `KHR_parallel_shader_compile` when available. The old program handle in `standardProgram` points to a program that has been marked for GL deletion.

**WebGL deletion behavior (the mechanism of black output):**

Per the WebGL spec, a program that is "currently in use" (the currently-bound program) is not immediately deleted; it stays bound until `gl.useProgram(other)` is called. So `standardProgram` continues to work for the current binding. However, **it is the old scene's shader**: it handles the old scene's generators and uniforms. When the new scene's uniforms are sent to the old shader:
- Generators present in the new scene but absent in the old shader have no corresponding uniforms
- These generators render as zero (black) contribution
- If the new scene's primary generators differ from the old scene's, the output is fully black

The async compilation window is typically **100–500ms** (several frames at 60 fps). During this window:
- `gl.drawArrays()` runs each frame (draw calls are present — this is why the bug looks "valid")
- The old shader renders the new scene's uniforms → black for unrecognized generators
- Once async compilation finishes and `finalizeProgramSwap` is called, the correct shader is bound and output recovers

**Why it is intermittent:**
- If both the old and new scenes happen to share the same active generator set, the old shader accidentally handles the new scene correctly (or partially) → no black frames visible
- If the custom blocks haven't changed AND the program was in the cache before `setCustomShaderBlocks` cleared it, a cache hit would have avoided async compilation — but the cache was just cleared, so this never fires in practice
- Transition duration affects visibility: short transitions may complete before multiple black frames accumulate; longer transitions expose more black frames

---

### Secondary Root Cause: Cross-Scene Layer Blending During Async Shader Window

**Location:** `src/renderer/scene/SceneManager.ts:getBlendSnapshot` + `src/renderer/index.ts:render` (blend transition read at line 12630)

During a blend transition (`sceneManager.startTransition` → `sceneManager.getBlendSnapshot`), `outputScene` contains **layers from both the old and new scenes**, blended by mix factor `t`.

The shader is compiled for the **new scene's generators**. During the async compilation window:
- Old shader runs
- Blend snapshot includes new-scene layers with increasing opacity (as `t` increases)
- Old shader does not know the new generators → those layers render as black
- As `mix → 1.0`, the output becomes dominated by the (black) new-scene layers

This compounds the primary bug: not only is the shader stale during compilation, but the blend itself progressively emphasizes the missing generators.

---

### Tertiary Issue: `isPlaying` Guard Halts All Rendering

**Location:** `src/renderer/index.ts:render` (line 12476)

```typescript
if (!isPlaying) {
  requestAnimationFrame(render);
  return;
}
```

When the transport is paused (`isPlaying = false`), the render loop exits immediately after scheduling the next RAF. No rendering, no scene-switch processing, no blend-transition ticks occur. If a scene switch is pending and `isPlaying` becomes false before the switch fires, it remains stalled indefinitely. This is a separate failure mode (permanent black/stale frame, not just during transitions), but it contributes to difficulty recovering from a bad state.

---

### Additional Issue: Double `renderGraph.dispose()` in Bootstrap Path

**Location:** `src/renderer/render/Renderer.ts` + `src/renderer/bootstrap.ts`

In the minimal bootstrap entrypoint:
1. `Renderer.ts:renderLoop` calls `renderGraph.dispose()` when a scene switch fires
2. Then calls `onSceneApplied(sceneId)` → `applySceneById(sceneId)` which calls `renderGraph.dispose()` **again**

This clears `activeFxNodes`, resets `lastSceneId`, and re-clears burst SDF state twice. Not directly causing black output in the main index.ts path (which does not use this flow), but introduces unnecessary redundant work.

---

## Transition Flow Diagram (Main `index.ts` Path)

```
render(time)
  ├─ resolveSceneSwitch → pendingSceneSwitch? → applyScene(targetSceneId)
  ├─ sceneManager.updateAutoSwitch → applyScene(autoSceneId)
  │
  applyScene(sceneId)
    ├─ resolveSceneActivationRuntime(currentProject, sceneId)
    │    ├─ captureSceneSnapshot (from)
    │    ├─ captureSceneSnapshot (to)
    │    └─ resolveTransitionDuration → blendTransition
    ├─ currentProject = activation.project  [activeSceneId updated]
    ├─ applySceneActivationRuntime(activation, {
    │    startBlendTransition → sceneManager.startTransition()
    │    markSceneActivated
    │    compileSceneShaders(targetScene, targetProject)
    │      → setCustomShaderBlocks([])     ← CLEARS CACHE
    │      → recompileForGenerators(newIds) ← ASYNC, misses cache
    │  })
    └─ void applyPlasmaShaderFromScene(scene)  ← async, fire-and-forget
  │
  [NEXT FRAME(S) during async compilation window]
  │
  sceneManager.getBlendSnapshot(transportTimeMs)
    → blended layers (old + new generators)
  │
  buildRenderStateForScene(blendSnapshot.scene)
    → old shader + new generator uniforms → BLACK generators
  │
  renderer.render(renderState)
    → gl.clear(COLOR_BUFFER_BIT)
    → updateStandardUniforms(standardProgram /* old shader */)
    → gl.drawArrays(gl.TRIANGLES, 0, 6)  ← DRAW CALL PRESENT (looks valid)
    → Output: black for unrecognized generators
  │
  [finalizeProgramSwap fires when async compile completes]
    → standardProgram = newProgram
    → currentProgram = newProgram
    → Output recovers
```

---

## Distinguishing Successful vs Failed Transitions

The following transition-level init steps determine whether a transition is successful or black:

| Step | Successful Transition | Failed Transition |
|---|---|---|
| Scene state swap | ✅ `currentProject` updated | ✅ Same |
| Generator init (shader compile) | ✅ **Cache hit** → instant swap | ❌ **Cache miss** → async compile |
| Layer state apply | ✅ Blend snapshot correct | ✅ Same |
| Shader/program selection | ✅ New shader active before first frame | ❌ Old shader active during async window |
| Framebuffer allocation | ✅ No change needed | ✅ Same |
| FX graph rebuild | ✅ `rebuildFxNodes` on next frame | ✅ Same |
| Uniform application | ✅ New uniforms → new shader | ❌ New uniforms → old shader → black generators |
| Final composite attach | ✅ Output correct | ❌ Output black during async window |

**Differentiating condition:** Whether the new scene's shader program (keyed on generator set + SDF + plasma source + custom blocks + FX declarations) is found in `programCache` when `recompileForGenerators` runs. Since `setCustomShaderBlocks` always clears the cache, this is **never a cache hit** in practice.

---

## Proposed Fixes

### Fix 1 (Highest Priority): Avoid Cache Invalidation on Unchanged Custom Blocks

In `glRenderer.ts:setCustomShaderBlocks`, compare the new blocks to the current before clearing:

```typescript
const setCustomShaderBlocks = (blocks: CustomShaderBlock[]): void => {
  const newHash = blocks
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(b => b.id + (b.uniforms ?? '') + (b.functions ?? '') + (b.mainCall ?? ''))
    .join('|');
  if (newHash === currentCustomBlocksHash) return;  // No change — preserve cache
  currentCustomBlocksHash = newHash;
  currentCustomBlocks = blocks;
  programCache.forEach(prog => { untrackProgram(prog); gl.deleteProgram(prog); });
  programCache.clear();
  activeUniformLookupCache.clear();
  uniformLocationCache.clear();
};
```

This preserves the program cache across scene transitions when custom blocks haven't changed, enabling cache hits and instant shader swaps.

### Fix 2: Use Synchronous Compilation for Scene Transitions

In `shaderLifecycle.ts:compileSceneShaders`, pass `forceSync = true` to ensure the new shader is ready before the first frame renders the new scene:

```typescript
export const compileSceneShaders = (
  renderer: ShaderCompiler,
  scene: SceneConfig | undefined,
  project: VisualSynthProject,
  customBlocks: CustomShaderBlock[] = [],
  sdfEnabled = false,
  forceSync = true  // Default to sync for correctness on transition
): number => {
  ...
  renderer.recompileForGenerators(activeIds, customBlocks, forceSync, fxUniforms);
  ...
};
```

Sync compilation has a one-frame stall (~1-5ms for simple scenes, up to 50ms for complex shaders), but eliminates black frames entirely.

### Fix 3: Invalidate `standardProgram` After Cache Clear

If async compilation is desired, after `setCustomShaderBlocks` clears the cache, set `standardProgram = null` in `glRenderer.ts`. This forces the "Render program unavailable; skipping frame" code path (line 1071-1074) until the new program is ready — producing consistent 1-2 black frames rather than random black windows.

### Fix 4: Separate Blend Transition Timing from Shader Compilation

Start the blend transition **only after** the new shader is confirmed ready:
1. Call `compileSceneShaders` with `forceSync = true`
2. THEN call `startBlendTransition`

This ensures the blend never runs with an incompatible shader.

### Fix 5: Render When Transport Paused (Reduced Mode)

Remove or relax the hard early-return in `index.ts:render` when `!isPlaying`. At minimum, still process scene switches and blend transitions so they don't stall permanently.

---

## Instrumentation Plan for Implementation Step

The following should be instrumented per the task specification:

### Transition Tracing
- **Where:** `applyScene()` in `index.ts` (line 6271), `applySceneWithTransitionOverride()` (line 6345), `sceneManager.updateAutoSwitch()` call site (line 12598)
- **Emit:** `{ seq, prevSceneId, prevSceneName, nextSceneId, nextSceneName, source, timestamp }`
- **Source tag:** `manual` (UI click), `slideshow` (`pendingSceneSwitch`), `auto` (`updateAutoSwitch`), `preview`, `recover`

### Per-Step Instrumentation Flags
Add boolean flags to a transition record for each of the 8 steps:
1. `sceneStateSwapped` — `currentProject` updated in `applyScene`
2. `generatorInitStarted` / `generatorInitSync` — whether `recompileForGenerators` used sync or async
3. `layerStateApplied` — `activation.project` contains new layers
4. `shaderProgramSelected` — which program handle is `standardProgram` after transition
5. `framebufferAllocated` — (currently not explicit; FBOs are created on demand in glRenderer)
6. `fxGraphRebuilt` — `rebuildFxNodes` called in `buildRenderState`
7. `uniformsApplied` — `updateStandardUniforms` ran without error
8. `compositeAttached` — final `gl.drawArrays` ran

### Post-Transition Frame Sampling
For frames 1–5 after each transition, record:
- Draw call count (hook `gl.drawArrays`)
- Average brightness (sample output framebuffer pixels via `gl.readPixels`)
- Non-black ratio (pixels with any channel > 0.02)
- Active generators (from `collectSceneGeneratorIds`)
- Active FX nodes (from render state)
- Program handle in use (standardProgram ID)

### Black-Frame Detection
Flag transition as failed when:
- `initSuccess = true` (scene applied, draw calls issued)
- `avgBrightness < 0.01` for 3+ consecutive frames in the first-5-frame window

### Regression Harness
In `src/renderer/render/Renderer.ts:runStressTest` (already exists but needs enhancement):
- Record per-transition brightness samples
- Report transitions where brightness was zero for 2+ frames
- Compare successful vs failed transitions to the same target scene
- Check whether the shader program handle changes between frames (async swap timing)

---

## Summary

The intermittent black output is caused by **unconditional program cache invalidation** (`setCustomShaderBlocks`) on every scene transition, combined with **async shader compilation** that takes several frames to complete. During the async window, the renderer issues valid draw calls using the **old scene's shader** against the **new scene's uniforms**, producing black output for generators not present in the old shader. The fix is to avoid cache invalidation when custom blocks haven't changed, and/or use synchronous compilation for scene-switch transitions.

---

## Implementation Notes (Session 2)

### Changes Made

#### `src/renderer/glRenderer.ts`
- **`setCustomShaderBlocks` cache preservation** — added `currentCustomBlocksHash` state and `computeCustomBlocksHash()`. Early-returns without clearing `programCache` when new blocks hash matches current hash. Resets hash on context restore.
- **`captureFrameBrightness()`** — reads 64×64 pixel sample from canvas center via `gl.readPixels`, returns `{ avgBrightness, nonBlackRatio }`.
- **New diagnostic getters added to return object:**
  - `hasPendingProgram()` — true if async compile is in flight
  - `getProgramCacheSize()` — current number of cached programs
  - `asyncCompilationAvailable()` — true if `KHR_parallel_shader_compile` extension present
  - `getCurrentProgramGenerators()` — generator IDs of the currently active compiled program
  - `getPendingProgramGenerators()` — generator IDs being async-compiled, or null

#### `src/renderer/render/transitionTracer.ts`
- **New module** implementing `TransitionTracer` interface with `createTransitionTracer(maxHistory)` factory.
- Tracks per-transition: seq, source (`manual|slideshow|auto|preview|recover`), prev/next scene IDs and names, generator sets, 9 per-step boolean flags, frame samples, async compile results, blend state.
- **`TransitionFrameSample`** captures: `frameTimestampMs`, `drawCallCount`, `avgBrightness`, `nonBlackRatio`, `activeGenerators`, `activeFx`, `asyncPending`, `pendingGenerators`, `currentProgramGenerators`.
- **`TransitionRecord`** additional fields: `compilePendingGenerators` (what was being async-compiled at transition start), `wasCacheHit`, `wasAsync`, `blendTransitionStarted`, `customBlocksChanged`, `brightnessRecoveryFrame`.
- Auto-flags transitions as `flaggedBlack` when ≥3 consecutive black frames with valid draw calls and init steps present.
- `getDump(state?)` returns recent transitions, counts, `firstBlackPass`/`lastNonBlackPass`, `successVsFailAnalysis` comparing successful vs failed transitions to same scene.
- `setBlendTransitionStarted(seq)` updates the record when a cross-fade actually fires.
- `recordCompileResult(seq, wasCacheHit, wasAsync)` records post-compile shader state.

#### `src/renderer/index.ts`
- Added `createTransitionTracer` import and singleton instance.
- Added `lastKnownCustomBlocksHash` to track custom-block changes across transitions.
- `applyScene()` calls `beginTransition()` with full `fromGenerators`, `toGenerators`, `compilePendingGenerators`, `customBlocksChanged`, `blendTransitionStarted=false`.
- `startBlendTransition` callback additionally calls `setBlendTransitionStarted()`.
- `compileSceneShaders` callback calls `recordCompileResult()` using `hasPendingProgram()` to determine `wasAsync`.
- Render loop samples 5 frames post-transition with `asyncPending`, `pendingGenerators`, `currentProgramGenerators`.
- `window.__outputDump()` global returns `{ transitionDump, renderSnapshot, firstBlackPass, lastNonBlackPass }` — callable from browser DevTools console.

### Test Results

**`tests/transitionTracer.test.ts`** — 8 unit tests: all pass
**`tests/stressTransition.test.ts`** — 4 tests including cache preservation regression and intermittent-black regression harness: all pass
**Total: 12/12 new/updated tests pass**

Zero new TypeScript errors introduced (pre-existing errors in `rollingAudioCapture.test.ts` remain unchanged).

### Debug Usage

In the Electron DevTools console:
```js
__outputDump()
// Returns: { transitionDump, renderSnapshot, firstBlackPass, lastNonBlackPass }
// transitionDump.recentTransitions[N].frameSamples shows per-frame asyncPending + brightness
// transitionDump.successVsFailAnalysis shows which init steps differed between good/bad transitions
// transitionDump.recentTransitions[N].compilePendingGenerators shows what was being compiled at transition start
// transitionDump.recentTransitions[N].frameSamples[F].pendingGenerators shows mid-frame async state
// transitionDump.recentTransitions[N].frameSamples[F].currentProgramGenerators shows what the bound shader knows
```

**Confirming the bug:** If `currentProgramGenerators` in frame samples contains old-scene generators while `activeGenerators` contains new-scene generators, and `asyncPending=true`, that is the async-window black-output bug in action.
