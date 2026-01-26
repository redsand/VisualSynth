import { describe, expect, it } from 'vitest';
import { getMidiChannel, mapNoteToPad, mapPadWithBank, parseMidiMessage, scaleMidiValue } from '../src/shared/midiMapping';

describe('midi mapping', () => {
  it('parses midi bytes safely', () => {
    const message = parseMidiMessage([144, 36, 100]);
    expect(message.status).toBe(144);
    expect(message.data1).toBe(36);
    expect(message.data2).toBe(100);
  });

  it('maps notes to 0-63 pad index', () => {
    expect(mapNoteToPad(64)).toBe(0);
    expect(mapNoteToPad(127)).toBe(63);
  });

  it('extracts midi channel from status', () => {
    expect(getMidiChannel(0x90)).toBe(1);
    expect(getMidiChannel(0x9f)).toBe(16);
  });

  it('scales midi values to ranges', () => {
    expect(scaleMidiValue(0, 0, 1)).toBe(0);
    expect(scaleMidiValue(127, 0, 1)).toBe(1);
  });

  it('maps pads with bank offsets', () => {
    expect(mapPadWithBank(0, 0)).toBe(0);
    expect(mapPadWithBank(0, 1)).toBe(64);
    expect(mapPadWithBank(63, 3)).toBe(255);
  });

  it('supports aftertouch and pitchbend mapping shapes', () => {
    const aftertouchValue = 96 / 127;
    expect(aftertouchValue).toBeGreaterThan(0.7);
    const pitchbendValue = ((64 << 7) | 0) / 16383;
    expect(pitchbendValue).toBeGreaterThan(0.4);
  });
});
