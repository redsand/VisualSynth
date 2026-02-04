# Preset Pipeline Map

## Storage
- Presets: `assets/presets/*.json` (v3 legacy layer-only + v4 scene/performance)
- Templates: `assets/templates/*.json` (v2 full project configs)

## Load Path (Main → Renderer)
1. **UI** requests presets list  
   - `src/renderer/index.ts` → `window.visualSynth.listPresets()`
2. **Main process** lists preset files  
   - `src/main/main.ts` `ipcMain.handle('presets:list')`
3. **UI** user selects preset, presses **Add Preset as Scene** or uses playlist  
   - `src/renderer/index.ts` `addSceneFromPreset()` or `applyPresetPath()`
4. **Main process** loads preset JSON  
   - `src/main/main.ts` `ipcMain.handle('presets:load')`  
   - Validates and returns preset payload
5. **Renderer** migrates + validates preset  
   - `src/renderer/index.ts` → `presetMigration.migratePreset()`  
   - `presetMigration.validatePreset()`
6. **Renderer** applies preset to project  
   - `presetMigration.applyPresetV4()` (v4 scene/performance → project)
   - `presetMigration.applyPresetV3()` (v3 → v2 project merge)
7. **Renderer** applies project  
   - `applyProject()` updates state, UI, renderer

## Merge Semantics (current behavior)
- V4 performance preset loads a full project; v4 scene preset rebuilds a project from scenes.
- V3 presets are migrated to v4 and then applied.
- `applyProject()` updates the active scene/layers and makes the set ready to perform.

## Render Consumption
- `src/renderer/index.ts` render loop extracts layer + FX state  
  - Layer IDs: `layer-plasma`, `layer-spectrum`, etc.
  - Layer params respected for speed/scale/elevation

## Key Functions & Files
- Preset I/O: `src/main/main.ts` (`presets:list`, `presets:load`)
- Preset migration & apply: `src/shared/presetMigration.ts`
- Project schema & defaults: `src/shared/project.ts`, `src/shared/projectSchema.ts`
- Renderer preset apply: `src/renderer/index.ts`

## Diagram (Flow)
- `assets/presets/*.json`
  → `main.ts: presets:list/load`
  → `renderer/index.ts: addSceneFromPreset() | applyPresetPath()`
  → `presetMigration.migratePreset()`
  → `presetMigration.applyPresetV4()`
  → `applyProject()`
  → `render loop`
