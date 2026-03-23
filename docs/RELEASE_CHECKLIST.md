# MVP Release Checklist

This checklist defines the "Club-Safe" gate for the MVP release.
All items MUST be checked before a release is considered stable for live performance.

## 1. Safety & Stability (Manual)
- [ ] Run the app for 2 hours in "Performance Mode" (Soak test)
- [ ] Verify FPS stays above 55 consistently on target hardware
- [ ] Verify no "Critical" health warnings occur during the session
- [ ] Test scene transitions (at least 50) manually without visual glitches
- [ ] Verify that toggling "Restrict to Safe Presets" correctly hides/shows presets

## 2. Project & Recovery (Manual)
- [ ] Save and reopen a complex project 5 times
- [ ] Verify project recovery after a simulated crash (kill process and restart)
- [ ] Verify asset paths are correctly restored across different environments

## 3. Automated Gates (Scriptable)
- [ ] `npm run test:soak` - All soak tests pass
- [ ] `npm run check:mvp-health` - App health audit script passes
- [ ] `npm run lint` - No linting errors
- [ ] `npm run typecheck` - No TypeScript errors

## 4. Audio & Song Detection (Manual)
- [ ] Verify audio input is detected on first startup
- [ ] Verify song change detection works with at least 3 different tracks
- [ ] Verify "Now Playing" UI correctly reflects current song state

## 5. Asset Certification (Manual)
- [ ] Ensure all presets in the "Essential" pack are marked as `safe`
- [ ] Ensure `unstable` presets are correctly hidden in Performance Mode

---

## Performance Mode Reference
When enabled, the following constraints are active:
- Only `safe` presets are visible in the browser.
- Expensive FX (Particles, Topo, Ink) are automatically disabled if FPS drops below 40.
- Automatic recovery is enabled (restarts engine if it hangs).
