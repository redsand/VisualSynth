import { getMidiChannel, mapPadWithBank } from '../../shared/midiMapping';
import type { Store } from '../state/store';
import { actions } from '../state/actions';
import { setStatus } from '../state/events';

export interface MidiLearnMapping {
  message: 'cc' | 'note';
  channel: number;
  control: number;
  target: string;
  mode: 'toggle' | 'momentary';
  label: string;
}

export interface MidiEngineCallbacks {
  onPadTrigger: (logicalIndex: number, velocity: number) => void;
  onMidiTarget: (target: string, value: number, isToggle: boolean) => void;
  onLearnMapping: (mapping: MidiLearnMapping) => void;
}

export interface MidiEngine {
  initDevices: (select: HTMLSelectElement) => Promise<void>;
  startInput: (select: HTMLSelectElement) => Promise<void>;
  armLearn: (target: string, label: string) => void;
}

export const createMidiEngine = (store: Store, callbacks: MidiEngineCallbacks): MidiEngine => {
  let midiAccess: MIDIAccess | null = null;
  let learnTarget: { target: string; label: string } | null = null;

  const initDevices = async (select: HTMLSelectElement) => {
    try {
      midiAccess = await navigator.requestMIDIAccess();
      const inputs = Array.from(midiAccess.inputs.values());
      select.innerHTML = '';
      inputs.forEach((input, index) => {
        const option = document.createElement('option');
        option.value = input.id;
        option.textContent = input.name ?? `MIDI ${index + 1}`;
        select.appendChild(option);
      });
    } catch {
      setStatus('WebMIDI unavailable. Using node-midi fallback.');
    }
  };

  const handleMessage = (message: number[], eventTime: number) => {
    const [status, data1, data2 = 0] = message;
    actions.setMidiLatency(store, Math.max(0, performance.now() - eventTime));
    const messageType = status & 0xf0;
    const channel = getMidiChannel(status);

    if (learnTarget && (messageType === 0x90 || messageType === 0xb0)) {
      const mapping: MidiLearnMapping = {
        message: messageType === 0x90 ? 'note' : 'cc',
        channel,
        control: data1,
        target: learnTarget.target,
        mode: messageType === 0x90 ? 'toggle' : 'momentary',
        label: learnTarget.label
      };
      callbacks.onLearnMapping(mapping);
      learnTarget = null;
      return;
    }

    const applyMappings = () => {
      const { project } = store.getState();
      project.midiMappings.forEach((mapping) => {
        if (mapping.channel !== channel) return;
        if (mapping.message === 'note' && messageType === 0x90) {
          if (mapping.control !== data1) return;
          if (data2 === 0) return;
          callbacks.onMidiTarget(mapping.target, data2 / 127, mapping.mode === 'toggle');
        }
        if (mapping.message === 'cc' && messageType === 0xb0) {
          if (mapping.control !== data1) return;
          callbacks.onMidiTarget(mapping.target, data2);
        }
        if (mapping.message === 'aftertouch' && messageType === 0xd0) {
          callbacks.onMidiTarget(mapping.target, data1 / 127, false);
        }
        if (mapping.message === 'pitchbend' && messageType === 0xe0) {
          const combined = ((data2 ?? 0) << 7) | (data1 ?? 0);
          callbacks.onMidiTarget(mapping.target, combined / 16383, false);
        }
      });
    };

    applyMappings();

    if (messageType === 0x90 && data2 > 0) {
      callbacks.onPadTrigger(mapPadWithBank(data1, store.getState().pad.activeBank), data2 / 127);
    }
  };

  const startInput = async (select: HTMLSelectElement) => {
    if (midiAccess) {
      const inputId = select.value;
      const input = Array.from(midiAccess.inputs.values()).find((item) => item.id === inputId);
      if (!input) return;
      input.onmidimessage = (event) => handleMessage(Array.from(event.data), event.timeStamp ?? performance.now());
      setStatus(`MIDI connected: ${input.name ?? 'Unknown'}`);
    } else {
      const ports = await window.visualSynth.listNodeMidi();
      if (ports.length === 0) {
        setStatus('No node-midi devices found.');
        return;
      }
      select.innerHTML = '';
      ports.forEach((port) => {
        const option = document.createElement('option');
        option.value = String(port.index);
        option.textContent = port.name;
        select.appendChild(option);
      });
      const portIndex = Number(select.value);
      const result = await window.visualSynth.openNodeMidi(portIndex);
      if (result.opened) {
        setStatus(`node-midi connected: ${ports[0].name}`);
      }
      window.visualSynth.onNodeMidiMessage((msg) => handleMessage(msg, performance.now()));
    }
  };

  const armLearn = (target: string, label: string) => {
    learnTarget = { target, label };
    setStatus(`MIDI Learn: move a control for ${label}`);
  };

  return {
    initDevices,
    startInput,
    armLearn
  };
};
