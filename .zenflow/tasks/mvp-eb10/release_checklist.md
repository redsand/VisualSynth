# MVP Release Checklist

## 1. Stability & Diagnostics
- [ ] **FPS Benchmark**: Run a "Soak Test" (simulating 100+ scene transitions) and verify FPS > 60 for 95% of the session.
- [ ] **No Unhandled Shader Errors**: Verify `glRenderer` console is clear of "undeclared identifier" errors for all 100+ scenes.
- [ ] **Audio Engine Health**: Check `sessionHealthService` and verify `audioStatus: 'healthy'` after session start.
- [ ] **Memory Usage**: Confirm memory usage stays below 2GB after a 1-hour session with 50+ preset changes.

## 2. Performance Mode
- [ ] **Safe Preset Filtering**: Verify that only `safe` certified presets are visible in the "Club-Safe" preset library.
- [ ] **Guardrails**: Test that "Safe Mode" correctly kicks in (hiding unstable FX) if artificial load is applied.

## 3. Project Persistence
- [ ] **Auto-Recovery**: Force-quit the application during a session and verify that the next startup recovers the project state correctly.
- [ ] **Empty Save/Load**: Save a new project, reload it, and verify all layer IDs match exactly.

## 4. Final Review
- [ ] **Asset Missing State**: Verify that missing assets (images/videos) show a placeholder instead of crashing the renderer.
- [ ] **Diagnostics UI**: Ensure the session health HUD is readable and correctly reflects real-time performance.

## Scriptable Checks
You can run the following commands to automate key parts of this checklist:
- `npm test tests/soak.test.ts` (Soak test simulation)
- `npm run check:shaders` (Offline shader validation script)
- `npm run check:health` (Session health data export check)
