import { describe, expect, it } from 'vitest';
import { mapNoteToPad, parseMidiMessage } from '../src/shared/midiMapping';

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
});
