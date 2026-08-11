# Robustness Review — Pending Work

This file tracks the residual items from the multi-session critical code review of
VisualSynth (Electron + WebGL2 real-time audio/MIDI-reactive visual synthesizer).

**Status as of 2026-08-11:** All **HIGH** (H1–H4) and **MEDIUM** (M1–M20) severity
items are fixed, validated, and pushed. The full test suite is green
(15945 passed / 34 skipped / 0 failed / 0 errors; `REAL_VITEST_EXIT=0`) and `tsc`
reports 0 errors. The only remaining items are **LOW severity** — latent,
defensive, or cosmetic. None are known live bugs.

---

## 1. Verifiable pending low-severity items

These were identified directly against the source and can be confirmed without
the original audit text.

### L-a: MediaRecorder not finalized on unload
- **Where:** `src/renderer/index.ts` — the `pagehide` handler added in M9
  (commit `621f92f0`) calls `stopAllLiveStreams()` + `AudioEngine.dispose()` but
  does **not** stop an in-progress `MediaRecorder`.
- **Impact:** If the user closes/refreshes while a capture is recording, the
  recorder and its dedicated `MediaStream` persist until the renderer process
  dies; the recording is abandoned without finalizing the `.webm`. Process death
  reclaims the resources, so this is not a sustained leak — but the in-flight
  capture is lost.
- **Caveat:** `stopRecording()` (line ~6637) fires `mediaRecorder.onstop`, whose
  async save/transcode work would not complete during unload. A clean fix likely
  needs to stop the recorder's tracks (synchronous) without relying on `onstop`
  completing, or to prompt "stop recording before quit" in `onCloseRequested`.
- **Severity:** Low.

### L-b: BroadcastChannel never closed
- **Where:** `src/renderer/index.ts:788` — `const outputChannel = new BroadcastChannel('visualsynth-output');`
  is opened at module load and never `.close()`d.
- **Impact:** Harmless — GC'd on process death. A clean `.close()` in the
  `pagehide` handler is tidy but functional only when multiple renderer windows
  share the channel.
- **Severity:** Low / cosmetic.

### L-c: Non-atomic capture / screenshot writes
- **Where:** `src/main/main.ts` — `saveCapture` (line ~888) and the automated
  screenshot path (line ~1704) use direct `fs.writeFileSync` to the user-chosen /
  app-data path. (Project autosave/recovery already uses the atomic
  `writeFileAtomic` helper at line ~607, so the important saves are covered.)
- **Impact:** A crash or power loss mid-write corrupts the capture/screenshot
  file; the user must re-capture. Low value (one-shot captures, easily redone),
  but the fix is mechanical: reuse the existing `writeFileAtomic` helper.
- **Severity:** Low.

### L-d: Live GPU smoke test for the SDF advanced scene-graph
- **Where:** The SDF scene-graph rebuild (commits `232c5ab9` / `57526f2f` /
  `09fc3597`) was verified via a 15-test GLSL parse harness, **not** a live GPU
  render.
- **Impact:** A parse-correct shader could still misrender on real hardware.
  See `docs/RENDER_ENGINE_GAP_ASSESSMENT.md` and the memory note
  `sdf-advanced-scene-graph-broken`.
- **Severity:** Low (verification gap, not a known defect). Needs a real GPU.

---

## 2. Low-severity audit items without confirmed text

The original review produced a numbered low-severity list (L1–L30). The
following were **fixed** this session:

| Item | Commit | Summary |
|------|--------|---------|
| L12  | `967d7d97` | `void video.play().catch()` (index.ts:664/6338) |
| L13  | `967d7d97` | `takeScreenshot` `toBlob` async callback try/catch |
| L22  | `967d7d97` | `assets:checkPaths` sync loop capped at 2000 |
| L30  | `967d7d97` | `plugins:import` `readFileSync` guard |
| L24  | `2e45254d` | session logger part files pruned on rollover |
| L23  | `7816bbe4` | atomic write for now-playing settings |
| L7   | (verified already done) | `onSongChange` callback is guarded by `runNowPlayingLookup`'s try/catch |
| L17  | `6675f9ca` | AudioEngine setup closes old analyser/context (bonus, with M20) |

The remaining original L-items (L1–L6, L8–L11, L14–L16, L18–L21, L25–L29) were
**not** fixed because their exact original descriptions are not reliably
reproducible from the current context and I will not fabricate findings.
**To enumerate them precisely, retrieve the original audit text** from the
session transcript:

```
C:\Users\champ\.claude\projects\C--Users-champ-source-repos-VisualSynth\e76885c8-db1d-41cf-b57c-f9e3e5ce44ee.jsonl
```

Search that transcript for the audit table (the severity-tiered H/M/L listing).
A future session should re-derive each remaining L-item against the current
source (the codebase has moved since the audit) and confirm it is still real
before fixing.

---

## 3. Deliberate non-fixes (do not re-address)

- **Spout / NDI output** — unfinished feature, not a defect. `createOutputManager`
  is never instantiated; the Spout path is a no-pixel stub gated on
  `electron-spout` / `grandiose`, which are not in `package.json`. Implementing
  it is feature work, not a robustness fix.
- **Audio finding 3 (RMS from frequency bins)** — internally consistent, low
  value; skipped deliberately.
- **SSRF guard in `nowPlayingLookup`** — deliberately **allows** loopback
  (127.x, ::1) and private ranges (10/192.168/172.16) so a self-hosted LAN
  recognition server works; **blocks** link-local (169.254/16, fe80::) and
  wildcard (0.0.0.0/::). Error message: *"Requests to link-local or wildcard
  addresses are not allowed."* Do not change this to block loopback — the test
  suite runs against a local mock server.
- **`applyProject` loads from project-level, not `scene.look`** — deliberate,
  user-confirmed. Project-level = the active scene's look at save time;
  reversing the load direction would clobber saved edits.

---

## 4. Already fixed — do not redo

All H and M items are done. The commit map is in the project memory
`robustness-audit-completion.md`. Highlights (commits on `main`, pushed):

- **H1** AudioEngine.setup re-entrancy guard — `88112c5e`
- **H3** init() fatal-startup try/catch — `88112c5e`
- **H4** main-canvas WebGL context-loss asset recovery — `3e62d7c0`
- **M2/M3** path confinement (`isPathWithinRoots`) — `1e8d0031`, `5682eed0`
- **M4** ffmpeg timeout — `1e8d0031`
- **M5/M6** GL asset-cache dispose — `6675f9ca`
- **M8** AudioEngine catch closes context — `6675f9ca`
- **M9** `AudioEngine.dispose()` + `pagehide` media release — `621f92f0`
- **M11/M12/M13** Electron will-quit + render-process-gone + close races — `5682eed0`
- **M15** prolink re-entrancy — `5682eed0`
- **M16** applyProject load-generation token — `6675f9ca`
- **M17/M19/M20** mediaRecorder.onstop, MIDI input dedup, setup teardown — `6675f9ca`
- **recovery readFileSync guard** — `e41a2a64`

Prior-session fixes: H2, M1, M7, M10, M14, M18 (commits `ae43c167` / `9a51dffc`).

---

## Validation notes for future work

- The renderer (`src/renderer/**`, including `index.ts`) is **NOT typechecked** by
  `npm test` / `npm run build` (vitest uses esbuild, which strips types). Run
  `npx tsc -p tsconfig.json --noEmit` manually; baseline is **0 errors**. Use the
  real exit code: `npx tsc -p tsconfig.json --noEmit > /tmp/tsc_out.txt 2>&1; echo "REAL_TSC_EXIT=$?"`
  (piping through `tail` captures `tail`'s exit, not tsc's).
- Full suite: `node_modules/.bin/vitest run --reporter=dot` (~30 min,
  `fileParallelism: false`). `presetAssets.test.ts` alone is 7140 tests (~8 min).
- After a full run, `tests/__snapshots__/presetRegression.test.ts.snap` and
  `renderStatePresetSnapshot.test.ts.snap` show as modified from CRLF churn —
  verify with `git -c core.whitespace=cr-at-eol diff --ignore-cr-at-eol` and
  restore with `git checkout -- tests/__snapshots__/` before committing.
- Commit messages containing backticks/parens/code: use a file
  (`git commit -F .git/COMMIT_MSG.txt`) — PowerShell here-strings leak a stray
  `@` and bash command-substitution strips backticks.