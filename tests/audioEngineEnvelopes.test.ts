import { describe, expect, it } from 'vitest';
import { createStore, createInitialState } from '../src/renderer/state/store';
import { createAudioEngine } from '../src/renderer/audio/AudioEngine';
import type { EnvelopeConfig } from '../src/shared/project';

// createAudioEngine is a module-level singleton (returns the existing instance
// if one is already bound to a store), so a single store + engine is shared
// across all scenarios here. Reconfigure the project/audio between cases and
// re-call initModulators to rebuild envStates from the current envelopes.

const makeEnv = (trigger: EnvelopeConfig['trigger'], threshold: number): EnvelopeConfig => ({
  id: 'env-1',
  name: 'Env 1',
  attack: 0.05,
  decay: 0.1,
  sustain: 0.8,
  release: 0.3,
  hold: 0.1,
  trigger,
  threshold
});

describe('AudioEngine envelope triggers (bootstrap path)', () => {
  const store = createStore(createInitialState());
  const state = store.getState();
  state.transport.isPlaying = true;
  const audioEngine = createAudioEngine(store);

  it('engine.low fires an envelope when energyLow crosses the threshold', () => {
    // engine.low is the DEFAULT env-1 trigger (project.ts). The bootstrap path
    // (RenderGraph reads state.modulators.envStates) drives envelopes through
    // AudioEngine.updateEnvelopes, which previously fell through to 0 for
    // engine.low — leaving env-1 permanently dead. It must now resolve to
    // state.audio.energyLow, matching index.ts updateEnvelopes.
    state.project.envelopes = [makeEnv('engine.low', 0.5)];
    audioEngine.initModulators();
    state.audio.energyLow = 0.8; // above threshold

    audioEngine.update(16);

    const envState = store.getState().modulators.envStates[0];
    expect(envState).toBeDefined();
    expect(envState.stage).toBe('attack');
    expect(envState.triggerArmed).toBe(false);
  });

  it('engine.low does not fire below the threshold', () => {
    state.project.envelopes = [makeEnv('engine.low', 0.5)];
    audioEngine.initModulators();
    state.audio.energyLow = 0.2; // below threshold

    audioEngine.update(16);

    const envState = store.getState().modulators.envStates[0];
    expect(envState.stage).toBe('idle');
    expect(envState.triggerArmed).toBe(true);
  });

  it('engine.low rearms after the signal drops back below 60% of threshold', () => {
    state.project.envelopes = [makeEnv('engine.low', 0.5)];
    audioEngine.initModulators();

    // Fire it.
    state.audio.energyLow = 0.9;
    audioEngine.update(16);
    expect(store.getState().modulators.envStates[0].stage).toBe('attack');
    expect(store.getState().modulators.envStates[0].triggerArmed).toBe(false);

    // Drop well below 0.6 * threshold (0.3) to re-arm.
    state.audio.energyLow = 0.1;
    audioEngine.update(16);
    expect(store.getState().modulators.envStates[0].triggerArmed).toBe(true);
  });
});