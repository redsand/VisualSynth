# VisualSynth Scenes

Scenes are the top-level visual moments in VisualSynth. Each scene sits above layers and FX, describing the intent, timing, and transitions between visual states.

## Scene Data Model

Every scene includes the following fields (defaults are injected when missing to keep older project files compatible):

- `id`: Internal scene identifier (existing field, still required).
- `scene_id`: Stable identifier for external references. Defaults to `id`.
- `intent`: One of `calm`, `pulse`, `build`, `chaos`, `ambient`.
- `duration`: Scene length in milliseconds. `0` means manual-only (no auto time switch).
- `transition_in`: `{ durationMs, curve }` crossfade into the scene.
- `transition_out`: `{ durationMs, curve }` crossfade out of the scene.
- `assigned_layers`: `{ core, support, atmosphere }` layer IDs grouped by role.
- `trigger`: `{ type, threshold?, minIntervalMs? }` (optional)
  - `type: "manual"` = only manual switches.
  - `type: "time"` = auto-advance when `duration` elapses.
  - `type: "audio"` = auto-advance when audio peak exceeds `threshold`.

## Scene Switching

Scene switching now crossfades parameters instead of hard cutting:

- Layer opacity/transform/params blend between scenes.
- FX/particles/SDF/visualizer intensities blend over the transition window.
- Transition duration is computed from `transition_out` and `transition_in`.

## Time + Audio Triggers

The scene manager supports automatic scene switching:

- **Time-based:** set `duration > 0` (and optionally `trigger.type = "time"`).
- **Audio-based:** set `trigger.type = "audio"` and tune `threshold` + `minIntervalMs`.

Manual switches always work, regardless of trigger settings.

## Timeline UI

The Scene Timeline at the top of the UI visualizes scene order and timing:

- Each segment scales by `duration` (or equal widths if durations are zero).
- The active segment shows progress and transition state.
- Click a segment to switch immediately.

## Backward Compatibility

Older project JSON files without the new fields still load:

- Defaults are injected on load/deserialize.
- `scene_id` is generated from `id` when absent.
