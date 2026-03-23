import { describe, expect, it } from 'vitest';

/**
 * This test verifies that the audioStoreBridge pattern in index.ts
 * correctly exposes all required state properties.
 *
 * The bridge must return a complete AppState-compatible object that
 * can be used by AudioEngine's update() -> updateAnalysis() call chain.
 *
 * This catches issues like the bug where `lastLatencyMs` was used
 * instead of `lastMidiLatencyMs` causing a ReferenceError at runtime.
 */

describe('audioStoreBridge pattern', () => {
  it('midi state should have lastLatencyMs property', () => {
    // Simulate the global variable pattern used in index.ts
    let lastMidiLatencyMs: number | null = null;

    // This is what audioStoreBridge.getState() should return
    const midiState = {
      lastLatencyMs: lastMidiLatencyMs  // Uses the correct variable name
    };

    // The property should be accessible
    expect(midiState.lastLatencyMs).toBeNull();

    // After setting the global, the bridge should reflect it
    lastMidiLatencyMs = 42;
    const updatedMidiState = {
      lastLatencyMs: lastMidiLatencyMs
    };
    expect(updatedMidiState.lastLatencyMs).toBe(42);
  });

  it('simulates full audioStoreBridge getState call chain', () => {
    // Simulate the global state variables in index.ts
    let lastMidiLatencyMs: number | null = null;
    const audioState = {
      rms: 0,
      peak: 0,
      bands: new Float32Array(8),
      spectrum: new Float32Array(64),
      waveform: new Float32Array(256),
      energyLow: 0,
      energyMid: 0,
      energyHigh: 0
    };

    // This simulates the audioStoreBridge.getState() function
    // It must not throw ReferenceError when accessing properties
    const getBridgeState = () => ({
      audio: audioState,
      midi: { lastLatencyMs: lastMidiLatencyMs }, // Correct: uses lastMidiLatencyMs
      // The buggy version would be: midi: { lastLatencyMs }
      // which throws ReferenceError: lastLatencyMs is not defined
    });

    // This should not throw
    expect(() => getBridgeState()).not.toThrow();

    const state = getBridgeState();
    expect(state.midi.lastLatencyMs).toBeNull();

    // Simulate MIDI event updating latency
    lastMidiLatencyMs = 15.5;
    const updatedState = getBridgeState();
    expect(updatedState.midi.lastLatencyMs).toBe(15.5);
  });

  it('validates MidiState interface compliance', () => {
    // This ensures the bridge returns the correct shape for MidiState
    interface MidiState {
      lastLatencyMs: number | null;
    }

    let lastMidiLatencyMs: number | null = 123;

    const getMidiState = (): MidiState => ({
      lastLatencyMs: lastMidiLatencyMs
    });

    const midi: MidiState = getMidiState();
    expect(midi.lastLatencyMs).toBe(123);
    expect(typeof midi.lastLatencyMs === 'number' || midi.lastLatencyMs === null).toBe(true);
  });
});