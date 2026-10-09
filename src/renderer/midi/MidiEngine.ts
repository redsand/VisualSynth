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

  // --- MIDI clock transport state -------------------------------------------
  // MIDI clock is 24 pulses per quarter note (PPQ). We derive the network BPM
  // from the interval between clocks and drive transport from start/stop/
  // continue. The previous handler ignored system-realtime bytes entirely
  // (0xF8 clock, 0xFA start, 0xFB continue, 0xFC stop) so an external sequencer
  // had no effect on tempo or transport.
  let lastClockTime = 0;
  let clockIntervalSamples: number[] = [];
  let networkBpmPrimed = false;
  const CLOCK_PULSES_PER_QUARTER = 24;
  const STABLE_SAMPLES = 8;

  const handleClock = (eventTime: number) => {
    if (lastClockTime > 0) {
      const intervalMs = eventTime - lastClockTime;
      // Reject absurd intervals (jitter/gaps) so a paused clock doesn't
      // contaminate the tempo estimate.
      if (intervalMs > 1 && intervalMs < 250) {
        clockIntervalSamples.push(intervalMs);
        if (clockIntervalSamples.length > STABLE_SAMPLES) {
          clockIntervalSamples.shift();
        }
        if (clockIntervalSamples.length >= STABLE_SAMPLES) {
          const avgMs =
            clockIntervalSamples.reduce((sum, v) => sum + v, 0) / clockIntervalSamples.length;
          const bpm = (CLOCK_PULSES_PER_QUARTER * 60000) / avgMs;
          if (Number.isFinite(bpm) && bpm >= 40 && bpm <= 300) {
            actions.setNetworkBpm(store, Math.round(bpm));
            actions.setNetworkActive(store, true);
            networkBpmPrimed = true;
          }
        }
      }
    }
    lastClockTime = eventTime;
  };

  const resetClockTracking = () => {
    lastClockTime = 0;
    clockIntervalSamples = [];
    networkBpmPrimed = false;
  };

  const initDevices = async (select: HTMLSelectElement) => {
    try {
      midiAccess = await navigator.requestMIDIAccess();
      const inputs = Array.from((midiAccess.inputs as unknown as Map<string, MIDIInput>).values());
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

    // System-realtime / system-common messages are status-only (or have a
    // fixed data length) and must be handled before the channel-voice switch
    // below, which masks the status with 0xf0.
    if (status === 0xf8) {
      // Timing clock — 24 PPQ
      handleClock(eventTime);
      return;
    }
    if (status === 0xfa) {
      // Start: reset clock baseline and roll transport
      resetClockTracking();
      actions.setTransportPlaying(store, true);
      if (networkBpmPrimed) actions.setBpmSource(store, 'network');
      return;
    }
    if (status === 0xfb) {
      // Continue
      actions.setTransportPlaying(store, true);
      return;
    }
    if (status === 0xfc) {
      // Stop
      actions.setTransportPlaying(store, false);
      return;
    }
    if (status === 0xfe || status === 0xff) {
      // Active sensing / reset — no transport action needed
      return;
    }
    if (status === 0xf2) {
      // Song Position Pointer — 14-bit position in "MIDI beats" (6 clocks each)
      const spp = (((data2 ?? 0) << 7) | (data1 ?? 0)) * 6;
      const bpm = store.getState().bpm.networkBpm ?? store.getState().bpm.manualBpm;
      if (Number.isFinite(bpm) && bpm > 0) {
        const beatMs = 60000 / bpm;
        actions.setTransportTime(store, (spp / CLOCK_PULSES_PER_QUARTER) * beatMs);
      }
      return;
    }

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
          callbacks.onMidiTarget(mapping.target, data2, false);
        }
        if (mapping.message === 'aftertouch' && messageType === 0xd0) {
          callbacks.onMidiTarget(mapping.target, data1 / 127, false);
        }
        if (mapping.message === 'pitchbend' && messageType === 0xe0) {
          // Pitch bend is a 14-bit value centered at 8192. Map it bipolarly to
          // [-1, 1] so center (no bend) yields 0 — the previous /16383 mapping
          // yielded 0.5 at center, so a target bound to pitch bend idled at
          // half-deflection instead of neutral.
          const combined = ((data2 ?? 0) << 7) | (data1 ?? 0);
          const bipolar = (combined - 8192) / 8192;
          callbacks.onMidiTarget(mapping.target, bipolar, false);
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
      const input = Array.from((midiAccess.inputs as unknown as Map<string, MIDIInput>).values()).find((item) => item.id === inputId);
      if (!input) return;
      input.onmidimessage = (event) => handleMessage(Array.from(event.data ?? []), event.timeStamp ?? performance.now());
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
