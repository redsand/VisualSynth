# MVP Risk Summary - Visual Synth

## Overview
This document summarizes the remaining technical risks for the MVP of the visual synthesizer, specifically focusing on stability for live performance.

## Critical Risks

### 1. Render Stability
- **Risk**: Shader compilation can fail during live performance when switching scenes, leading to a black screen or "silent failure".
- **Mitigation**: 
    - Implemented `SceneCacheWarmer` to pre-compile all generators in the background.
    - Standardized FX uniform injection to prevent "undeclared identifier" errors.
    - Renamed engine-internal `palette()` to `getPaletteColor()` to avoid name collisions with MilkDrop presets.
- **Residual Risk**: Ultra-complex custom shader blocks might still cause driver-level crashes if they exceed hardware limits.

### 2. Audio Engine Synchronization
- **Risk**: Audio analysis state can desynchronize from the render loop, causing visual stuttering or incorrect reactive behavior.
- **Mitigation**: 
    - Introduced `audioStoreBridge` to provide a single, stable source of truth for audio analysis data.
    - Added health checks to detect and report when the audio engine is uninitialized.
- **Residual Risk**: High-latency audio devices (ASIO) might still show slight lag without explicit latency compensation.

### 3. Project Persistence
- **Risk**: Project state corruption during save/load could lead to loss of work or "un-openable" project files.
- **Mitigation**: 
    - Added automated stress tests for repeated open/recover cycles.
    - Implemented a "Club-Safe" project recovery path that skips experimental/unstable layers if the previous session crashed.
- **Residual Risk**: Disk full or write-permission errors are not yet fully handled with user-friendly diagnostics.

### 4. Long-Session Degradation
- **Risk**: GPU memory leaks or accumulation of shader objects could lead to performance degradation over a 2-4 hour DJ set.
- **Mitigation**: 
    - Added "Soak Tests" that simulate 100+ scene transitions.
    - Implemented real-time FPS and dropped-frame monitoring via `sessionHealthService`.
- **Residual Risk**: Third-party plugins or assets (large video files) might still leak memory if not properly disposed of by the user.

## Club-Safe Performance Mode
The implementation now includes a "Club-Safe" mode that:
- Hides presets marked as `unstable` or `degraded`.
- Disables expensive post-processing if FPS drops below 30.
- Prefers reliable, cached shader paths.
