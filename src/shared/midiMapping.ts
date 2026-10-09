export interface MidiMessage {
  status: number;
  data1: number;
  data2: number;
}

export const parseMidiMessage = (bytes: number[]): MidiMessage => {
  const [status = 0, data1 = 0, data2 = 0] = bytes;
  return { status, data1, data2 };
};

export const mapNoteToPad = (note: number) => {
  // Wrap the note into the 0..63 pad grid using modulo-64. The wrap is made
  // negative-tolerant (`((n % 64) + 64) % 64`) so a malformed negative note
  // maps into range instead of clamping to 0 and colliding with pad 0.
  const normalized = ((note % 64) + 64) % 64;
  return Math.max(0, Math.min(63, normalized));
};

export const getMidiChannel = (status: number) => (status & 0x0f) + 1;

export const scaleMidiValue = (value: number, min: number, max: number) => {
  const clamped = Math.max(0, Math.min(127, value));
  const normalized = clamped / 127;
  return min + (max - min) * normalized;
};

export const mapPadWithBank = (note: number, bankIndex: number) => {
  const base = mapNoteToPad(note);
  const offset = Math.max(0, Math.min(3, bankIndex)) * 64;
  return base + offset;
};
