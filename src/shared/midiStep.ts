// Turn a CC stream from a dial into discrete ±steps (scene/palette/engine
// browsing), for EITHER kind of dial, with no controller configuration:
//
//  - endless encoders in relative mode send a delta per detent:
//      two's complement: 1..63 = +n, 65..127 = -(128-n)   (Arturia "Relative 1",
//                                                          Akai, Novation, NI)
//      binary offset:    65 = +1, 63 = -1 (64 ± n)        (Arturia "Relative 2")
//  - ordinary knobs / encoders in absolute mode send a position 0..127.
//
// Treating an absolute knob as relative makes every tick a large jump; the
// reverse makes an endless dial stuck. So each mapping keeps a little state
// and decides from what it has seen: values hugging the relative bands
// (≤ 8, ≥ 120, or 60..68) on consecutive messages mean relative; small
// position changes in the middle of the range mean absolute.

export interface MidiStepState {
  last: number | null;
  relativeVotes: number;
  absoluteVotes: number;
  /** Accumulated absolute-knob travel not yet turned into a step. */
  carry: number;
}

/** Absolute-knob travel (in CC counts) per step: ~16 steps across the knob. */
export const ABSOLUTE_COUNTS_PER_STEP = 8;
/** Relative steps per message are capped so a fast spin can't skip a whole list. */
export const MAX_STEPS_PER_MESSAGE = 4;

export const createMidiStepState = (): MidiStepState => ({ last: null, relativeVotes: 0, absoluteVotes: 0, carry: 0 });

const inRelativeBand = (v: number) => v <= 8 || v >= 120 || (v >= 60 && v <= 68);

const decodeRelative = (v: number): number => {
  if (v === 64 || v === 0) return 0;
  if (v >= 60 && v <= 68) return v - 64;       // binary offset
  return v < 64 ? v : v - 128;                  // two's complement
};

/** Feed one CC value; returns the number of steps to move (negative = back). */
export const stepFromCc = (state: MidiStepState, value: number): number => {
  const v = Math.max(0, Math.min(127, Math.round(value)));
  const last = state.last;
  state.last = v;
  if (last !== null) {
    if (inRelativeBand(v) && inRelativeBand(last)) state.relativeVotes += 1;
    else if (Math.abs(v - last) <= 6) state.absoluteVotes += 1;
  }
  // Default to relative (most "dials" are endless encoders) until absolute
  // evidence clearly wins.
  const absolute = state.absoluteVotes > state.relativeVotes + 1;
  if (!absolute) {
    // Relative encoders send small deltas (the bands above); a mid-range value
    // is an absolute knob's position — learn from it, never jump on it.
    if (!inRelativeBand(v)) return 0;
    const d = decodeRelative(v);
    return Math.max(-MAX_STEPS_PER_MESSAGE, Math.min(MAX_STEPS_PER_MESSAGE, d));
  }
  if (last === null) return 0;
  state.carry += v - last;
  const steps = Math.trunc(state.carry / ABSOLUTE_COUNTS_PER_STEP);
  state.carry -= steps * ABSOLUTE_COUNTS_PER_STEP;
  return steps;
};

/** Wrap an index stepped through a list of `length` items. */
export const stepIndex = (index: number, steps: number, length: number): number =>
  length <= 0 ? 0 : (((index + steps) % length) + length) % length;
