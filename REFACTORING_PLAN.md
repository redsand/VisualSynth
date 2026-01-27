# VisualSynth Refactoring Plan

## Executive Summary
index.ts is 5,707 lines (201KB) and contains all application logic. This refactoring will split it into focused modules without changing behavior, add observability, and fix critical bugs identified in the audit.

## Critical Bugs Identified (To Fix During Refactoring)

### 1. Layer Toggle Initialization Race
**Location:** renderLayerList() initializes plasmaToggle/spectrumToggle references
**Risk:** If renderLayerList not called before render loop, toggles are null
**Fix:** Ensure bootstrap calls renderLayerList before starting render loop

### 2. Effect Controls Missing Event Listeners
**Location:** initEffects() reads UI but doesn't attach listeners
**Risk:** Effect sliders don't update currentProject
**Fix:** Add event listeners in FxPanel

### 3. applyProject Async Race Conditions
**Location:** Multiple applyProject calls without await
**Risk:** Project state corruption
**Fix:** Add loading lock in projectIO

### 4. applyScene Early Return Failure
**Location:** applyScene returns silently if scene not found
**Risk:** Layer toggles never initialized
**Fix:** Add error handling and fallback

## File Structure (Before)
```
src/renderer/
├── index.ts (5,707 lines) ← EVERYTHING IS HERE
├── glRenderer.ts
├── output.ts
├── state/
│   ├── store.ts (exists, partial)
│   ├── actions.ts (exists, partial)
│   └── events.ts (exists)
├── render/ (exists, partial)
├── audio/ (exists, partial)
├── midi/ (exists, partial)
├── ui/ (exists, partial)
└── persistence/ (exists, partial)
```

## File Structure (After)
```
src/renderer/
├── index.ts (~50 lines) ← Thin entrypoint
├── bootstrap.ts (~300 lines) ← Initialization orchestration
├── glRenderer.ts
├── output.ts
├── state/
│   ├── store.ts (complete)
│   ├── actions.ts (complete)
│   └── events.ts
├── render/
│   ├── Renderer.ts (complete)
│   ├── RenderGraph.ts (complete)
│   └── debugOverlay.ts (complete)
├── audio/
│   └── AudioEngine.ts (complete)
├── midi/
│   └── MidiEngine.ts (complete)
├── ui/
│   ├── App.ts (complete ~400 lines)
│   ├── assetService.ts
│   └── panels/
│       ├── LayerPanel.ts (complete ~600 lines)
│       ├── FxPanel.ts (complete ~400 lines)
│       ├── PerformancePanel.ts (complete ~300 lines)
│       ├── ScenePanel.ts (new ~300 lines)
│       ├── SystemPanel.ts (new ~400 lines)
│       └── ModulationPanel.ts (new ~400 lines)
└── persistence/
    └── projectIO.ts (complete ~200 lines)
```

## Extraction Order (To Prevent Breakage)

### Phase 1: Complete Existing Modules
1. ✅ state/store.ts - Already good
2. ✅ state/actions.ts - Already good
3. ✅ render/RenderGraph.ts - Already good
4. ✅ render/debugOverlay.ts - Already good
5. ⚠️ persistence/projectIO.ts - Needs serializeProject extraction
6. ⚠️ audio/AudioEngine.ts - Needs BPM networking extraction
7. ⚠️ midi/MidiEngine.ts - Already good
8. ⚠️ ui/panels/LayerPanel.ts - Needs full renderLayerList extraction

### Phase 2: Create New UI Panels
1. ui/panels/ScenePanel.ts - Scene management, playlist, presets
2. ui/panels/SystemPanel.ts - Output, capture, diff/merge
3. ui/panels/ModulationPanel.ts - LFO, Env, S&H, Mod Matrix, MIDI Map

### Phase 3: Create Bootstrap
1. bootstrap.ts - Orchestrates initialization in correct order
2. Ensures layer toggles initialized before render
3. Handles recovery project loading
4. Sets up all event listeners in correct order

### Phase 4: Thin Entrypoint
1. index.ts becomes ~50 lines
2. Imports bootstrap
3. Calls bootstrap.init()

## Critical Dependencies to Preserve

### Initialization Order (MUST NOT CHANGE)
```
1. initPads()
2. initShortcuts()
3. await initPresets()
4. await initTemplates()
5. await initOutputConfig()
6. refreshSceneSelect()
7. applyScene(activeSceneId)  ← MUST happen before render
8. renderLayerList()  ← MUST happen before render
9. initModulators()  ← MUST happen before render
10. setupAudio()
11. setupMIDI()
12. requestAnimationFrame(render)
```

### Data Flow (MUST NOT BREAK)
```
User Action → Event Handler → Store Action → State Update → Notify Listeners → UI Re-render
MIDI Input → MidiEngine → Callback → Store Update → Render Loop
Audio Input → AudioEngine → Analysis → Store Update → Render Loop
Render Loop → RenderGraph → Build State → GPU Render → Output Broadcast
```

## Testing Strategy

### Unit Tests (Where Practical)
- store/actions.ts - Layer add/remove/reorder
- persistence/projectIO.ts - Save/load roundtrip
- render/RenderGraph.ts - Mod matrix application (mocked GPU)

### Integration Tests
1. Boot app with empty project
2. Add layer via generator
3. Toggle layer on/off
4. Enable effect
5. Verify debug overlay shows execution
6. Save and reload project
7. Verify layer state preserved

### Regression Checks
1. Build passes (npm run build)
2. No runtime errors on startup
3. Layers visible and respond to toggles
4. FX visible and respond to sliders
5. Debug overlay (press D) shows correct data
6. Output window receives frames
7. MIDI input triggers pads
8. Audio analysis updates spectrum

## Observability Additions

### Debug Overlay (Press 'D')
- FPS
- Active scene name
- Layer count
- Per-layer: enabled, opacity, blend, FBO size, lastRenderedFrameId, non-empty check
- FX: enabled, bypassed, lastAppliedFrameId
- Master bus frame ID
- Uniforms updated frame ID

### Layer Tint Debug Mode
- Each layer renders with unique subtle tint
- Makes stacking visually obvious
- Toggle via debug overlay checkbox

### FX Delta Test
- When enabling FX, temporarily boost parameter for 200ms
- User sees immediate visual feedback
- Toggle via debug overlay checkbox

## Success Criteria

### Code Quality
- ✅ No file over 600 lines
- ✅ Clear module boundaries
- ✅ No circular dependencies
- ✅ Proper TypeScript types
- ✅ No any types

### Functionality
- ✅ Build passes without errors
- ✅ All features work as before
- ✅ No new bugs introduced
- ✅ Performance unchanged

### Observability
- ✅ Debug overlay shows layer execution
- ✅ Debug overlay shows FX execution
- ✅ Layer tint mode works
- ✅ FX delta test works

## Rollback Plan
If refactoring breaks something critical:
1. Git revert to pre-refactoring commit
2. Fix the specific issue in isolation
3. Re-attempt refactoring with fix applied

## Timeline Estimate
- Phase 1: Complete existing modules (2-3 hours)
- Phase 2: Create new panels (3-4 hours)
- Phase 3: Bootstrap orchestration (1-2 hours)
- Phase 4: Testing and fixes (2-3 hours)
- **Total: 8-12 hours**

## Next Steps
1. ✅ Create this plan
2. Extract projectIO serialization logic
3. Complete LayerPanel
4. Create remaining panels
5. Create bootstrap
6. Reduce index.ts
7. Test thoroughly
8. Document changes
