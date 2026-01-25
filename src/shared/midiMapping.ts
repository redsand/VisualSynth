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
