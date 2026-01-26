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
  const normalized = note % 64;
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
