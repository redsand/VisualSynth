# MVP Risk Audit: Live Performance Stability

This document audits the remaining risks for VisualSynth as it moves toward MVP (Safe for Live DJ Use).

## 1. Render Stability
- **Risk**: Shader compilation during scene transitions can cause frame stutters (jank).
- **Status**: `SceneCacheWarmer.ts` exists but needs verification of coverage for complex SDF scenes.
- **Risk**: GPU memory leaks over long sessions (4+ hours).
- **Status**: Resource pooling in `performanceGuardrails.ts` is implemented but needs soak testing.
- **Risk**: WebGL context loss due to OS power management or other apps.
- **Status**: Basic recovery in `glRenderer.ts` is implemented.

## 2. Project Recovery & Persistence
- **Risk**: Silent failure of autosave leaving DJ with no recovery path after a crash.
- **Status**: `project:autosave` writes to `recovery.json` every 30s. Need to ensure UI proactively offers recovery on boot.
- **Risk**: Corrupt project files preventing app start.
- **Status**: JSON schema validation is in place, but fallback to a "clean state" needs hardening.

## 3. Preset Safety & Certification
- **Risk**: Unstable imported Milkwave presets causing GPU hangs or crashes.
- **Status**: Certification levels ('certified-safe', 'unstable', etc.) defined in `certification.ts`. Many presets are still uncertified.
- **Action**: Implementation of "Club-Safe Mode" to hide 'unstable' and 'archived' presets by default.

## 4. Asset Recovery
- **Risk**: Missing video or texture assets causing empty layers or render errors.
- **Status**: `assetWarningCount` tracked in `SessionHealth`. Need clearer UI feedback for missing assets.

## 5. Audio & Song Detection
- **Risk**: Song detection failing silently, leading to stale visual states.
- **Status**: `AudioEngine.ts` has a state machine. Need to expose this in the main health dashboard.
- **Risk**: Microphone/Input permissions revoked mid-session.
- **Status**: Handled via `failed` state in `AudioEngine`, but needs "Safe Mode" trigger.

## 6. Diagnostics & Debug Visibility
- **Risk**: DJ cannot see *why* the app is struggling (e.g., thermal throttling vs. complex shader).
- **Status**: `SessionHealth` model expanded to include `degradedReason` and `failedReason`.
- **Action**: Ensure these are visible in the "Performance" UI mode.

## 7. Startup & Reset Behavior
- **Risk**: App starts in a high-complexity state that immediately hangs.
- **Status**: `startupProject.ts` exists. Need "Safe Boot" option (Shift-click or auto-detect previous crash).

---
*Last Updated: 2026-03-23*
