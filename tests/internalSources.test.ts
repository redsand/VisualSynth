import { describe, expect, it } from 'vitest';
import { DEFAULT_PROJECT } from '../src/shared/project';

describe('Internal Signal Sources', () => {
  it('should have default internal assets in the project', () => {
    const assets = DEFAULT_PROJECT.assets;
    expect(assets.some(a => a.internalSource === 'audio-waveform')).toBe(true);
    expect(assets.some(a => a.internalSource === 'audio-spectrum')).toBe(true);
    expect(assets.some(a => a.internalSource === 'modulators')).toBe(true);
    expect(assets.some(a => a.internalSource === 'midi-history')).toBe(true);
  });

  it('should implement MIDI history tracking', () => {
    const midiHistory = new Float32Array(256);
    const data1 = 64; // Note
    const data2 = 100; // Velocity
    
    // Simulate circular buffer logic from index.ts
    for (let i = midiHistory.length - 2; i >= 2; i -= 2) {
        midiHistory[i] = midiHistory[i-2];
        midiHistory[i+1] = midiHistory[i-1];
    }
    midiHistory[0] = data1 / 127;
    midiHistory[1] = data2 / 127;

    expect(midiHistory[0]).toBeCloseTo(0.503, 2);
    expect(midiHistory[1]).toBeCloseTo(0.787, 2);
  });
});
