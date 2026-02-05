/**
 * MIDI Scene System Integration Tests
 *
 * Tests the full flow from MIDI input through processing to action output.
 * Simulates realistic MIDI controller scenarios.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  MidiSceneConfig,
  MidiSceneTrigger,
  MidiCCParameter,
  createMacroTrigger,
  createPresetTrigger,
  createPlaylistControlTrigger,
  createBurstPresetTrigger,
  createCCParameter,
  createLaunchpadLayout,
  createMinimalLayout,
  processMidiNote,
  processMidiCC,
  DEFAULT_MIDI_SCENE_CONFIG
} from '../../src/shared/midiSceneTriggers';
import {
  getSceneMacro,
  interpolateMacroValue,
  SCENE_MACROS,
  DROP_CLASSIC,
  BUILD_8BAR
} from '../../src/shared/sceneMacros';

// ============================================================================
// Test Helpers
// ============================================================================

interface ActionHandler {
  triggerMacro: ReturnType<typeof vi.fn>;
  loadPreset: ReturnType<typeof vi.fn>;
  jumpToPlaylistSlot: ReturnType<typeof vi.fn>;
  controlPlaylist: ReturnType<typeof vi.fn>;
  triggerBurst: ReturnType<typeof vi.fn>;
  setParameter: ReturnType<typeof vi.fn>;
}

const createActionHandler = (): ActionHandler => ({
  triggerMacro: vi.fn(),
  loadPreset: vi.fn(),
  jumpToPlaylistSlot: vi.fn(),
  controlPlaylist: vi.fn(),
  triggerBurst: vi.fn(),
  setParameter: vi.fn()
});

/**
 * Process a MIDI note and dispatch to appropriate handler
 */
const dispatchMidiNote = (
  config: MidiSceneConfig,
  handler: ActionHandler,
  channel: number,
  note: number,
  velocity: number,
  bank: number = 0
) => {
  const result = processMidiNote(config, channel, note, velocity, bank);

  if (!result.handled || !result.action) return result;

  switch (result.action.type) {
    case 'macro':
      handler.triggerMacro(result.action.value, result.action.velocity);
      break;
    case 'preset':
      handler.loadPreset(result.action.value, result.action.velocity);
      break;
    case 'playlist-slot':
      handler.jumpToPlaylistSlot(result.action.value);
      break;
    case 'playlist-control':
      handler.controlPlaylist(result.action.value);
      break;
    case 'burst-preset':
      handler.triggerBurst(result.action.value);
      break;
  }

  return result;
};

/**
 * Process a MIDI CC and dispatch to handler
 */
const dispatchMidiCC = (
  config: MidiSceneConfig,
  handler: ActionHandler,
  channel: number,
  cc: number,
  value: number
) => {
  const result = processMidiCC(config, channel, cc, value);

  if (result.handled && result.target !== undefined && result.value !== undefined) {
    handler.setParameter(result.target, result.value);
  }

  return result;
};

// ============================================================================
// Launchpad Controller Simulation Tests
// ============================================================================

describe('Launchpad Controller Simulation', () => {
  let config: MidiSceneConfig;
  let handler: ActionHandler;

  beforeEach(() => {
    config = createLaunchpadLayout();
    handler = createActionHandler();
  });

  describe('Drop Macro Row (notes 36-43)', () => {
    it('triggers drop-classic macro on note 36', () => {
      dispatchMidiNote(config, handler, 1, 36, 127);

      expect(handler.triggerMacro).toHaveBeenCalledWith('drop-classic', 1);
    });

    it('triggers drop-hard macro on note 37', () => {
      dispatchMidiNote(config, handler, 1, 37, 127);

      expect(handler.triggerMacro).toHaveBeenCalledWith('drop-hard', 1);
    });

    it('triggers drop-subtle macro on note 38', () => {
      dispatchMidiNote(config, handler, 1, 38, 127);

      expect(handler.triggerMacro).toHaveBeenCalledWith('drop-subtle', 1);
    });

    it('applies velocity sensitivity to macro triggers', () => {
      dispatchMidiNote(config, handler, 1, 36, 64); // Half velocity

      expect(handler.triggerMacro).toHaveBeenCalledWith(
        'drop-classic',
        expect.closeTo(64 / 127, 2)
      );
    });
  });

  describe('Build Macro Row (notes 44-46)', () => {
    it('triggers build-4bar macro on note 44', () => {
      dispatchMidiNote(config, handler, 1, 44, 127);

      expect(handler.triggerMacro).toHaveBeenCalledWith('build-4bar', 1);
    });

    it('triggers build-8bar macro on note 45', () => {
      dispatchMidiNote(config, handler, 1, 45, 127);

      expect(handler.triggerMacro).toHaveBeenCalledWith('build-8bar', 1);
    });

    it('triggers build-epic macro on note 46', () => {
      dispatchMidiNote(config, handler, 1, 46, 127);

      expect(handler.triggerMacro).toHaveBeenCalledWith('build-epic', 1);
    });
  });

  describe('Breakdown Macro Row (notes 52-54)', () => {
    it('triggers breakdown-calm macro on note 52', () => {
      dispatchMidiNote(config, handler, 1, 52, 127);

      expect(handler.triggerMacro).toHaveBeenCalledWith('breakdown-calm', 1);
    });

    it('triggers breakdown-atmospheric macro on note 53', () => {
      dispatchMidiNote(config, handler, 1, 53, 127);

      expect(handler.triggerMacro).toHaveBeenCalledWith('breakdown-atmospheric', 1);
    });

    it('triggers breakdown-trance macro on note 54', () => {
      dispatchMidiNote(config, handler, 1, 54, 127);

      expect(handler.triggerMacro).toHaveBeenCalledWith('breakdown-trance', 1);
    });
  });

  describe('Transition Macro Row (notes 60-62)', () => {
    it('triggers transition-flash macro on note 60', () => {
      dispatchMidiNote(config, handler, 1, 60, 127);

      expect(handler.triggerMacro).toHaveBeenCalledWith('transition-flash', 1);
    });

    it('triggers transition-fade-out macro on note 61', () => {
      dispatchMidiNote(config, handler, 1, 61, 127);

      expect(handler.triggerMacro).toHaveBeenCalledWith('transition-fade-out', 1);
    });

    it('triggers transition-fade-in macro on note 62', () => {
      dispatchMidiNote(config, handler, 1, 62, 127);

      expect(handler.triggerMacro).toHaveBeenCalledWith('transition-fade-in', 1);
    });
  });

  describe('Burst Preset Row (notes 68-71)', () => {
    it('triggers burst preset on note 68', () => {
      dispatchMidiNote(config, handler, 1, 68, 127);

      expect(handler.triggerBurst).toHaveBeenCalledWith('drop-classic');
    });

    it('triggers burst preset on note 69', () => {
      dispatchMidiNote(config, handler, 1, 69, 127);

      expect(handler.triggerBurst).toHaveBeenCalledWith('high-energy');
    });
  });

  describe('Playlist Control Row (notes 76-79)', () => {
    it('triggers play on note 76', () => {
      dispatchMidiNote(config, handler, 1, 76, 127);

      expect(handler.controlPlaylist).toHaveBeenCalledWith('play');
    });

    it('triggers stop on note 77', () => {
      dispatchMidiNote(config, handler, 1, 77, 127);

      expect(handler.controlPlaylist).toHaveBeenCalledWith('stop');
    });

    it('triggers previous on note 78', () => {
      dispatchMidiNote(config, handler, 1, 78, 127);

      expect(handler.controlPlaylist).toHaveBeenCalledWith('previous');
    });

    it('triggers next on note 79', () => {
      dispatchMidiNote(config, handler, 1, 79, 127);

      expect(handler.controlPlaylist).toHaveBeenCalledWith('next');
    });
  });

  describe('CC Parameter Control', () => {
    it('maps CC1 to bloom', () => {
      dispatchMidiCC(config, handler, 1, 1, 64);

      expect(handler.setParameter).toHaveBeenCalledWith(
        'effects.bloom',
        expect.closeTo(64 / 127, 2)
      );
    });

    it('maps CC2 to chroma', () => {
      dispatchMidiCC(config, handler, 1, 2, 127);

      expect(handler.setParameter).toHaveBeenCalledWith(
        'effects.chroma',
        0.5 // Max value for chroma
      );
    });

    it('maps CC3 to blur', () => {
      dispatchMidiCC(config, handler, 1, 3, 0);

      expect(handler.setParameter).toHaveBeenCalledWith(
        'effects.blur',
        0
      );
    });

    it('maps CC7 to laser opacity', () => {
      dispatchMidiCC(config, handler, 1, 7, 100);

      expect(handler.setParameter).toHaveBeenCalledWith(
        'laser.opacity',
        expect.closeTo(100 / 127, 2)
      );
    });
  });
});

// ============================================================================
// Bank Switching Tests
// ============================================================================

describe('Bank Switching', () => {
  let config: MidiSceneConfig;
  let handler: ActionHandler;

  beforeEach(() => {
    // Create config with triggers at specific notes
    config = {
      triggers: [
        createMacroTrigger(36, 'macro-bank0'),
        createMacroTrigger(37, 'macro-bank1-adjusted')
      ],
      parameters: [],
      defaultBank: 0,
      bankCount: 4
    };
    handler = createActionHandler();
  });

  it('matches note directly in bank 0', () => {
    dispatchMidiNote(config, handler, 1, 36, 127, 0);

    expect(handler.triggerMacro).toHaveBeenCalledWith('macro-bank0', 1);
  });

  it('adjusts note for bank offset', () => {
    // In bank 1, note 52 (36 + 16) should match trigger at 36
    dispatchMidiNote(config, handler, 1, 52, 127, 1);

    expect(handler.triggerMacro).toHaveBeenCalledWith('macro-bank0', 1);
  });

  it('handles multiple banks correctly', () => {
    // Bank 2: note 68 (36 + 32) should match trigger at 36
    dispatchMidiNote(config, handler, 1, 68, 127, 2);

    expect(handler.triggerMacro).toHaveBeenCalledWith('macro-bank0', 1);
  });
});

// ============================================================================
// Macro to Visual Change Flow Tests
// ============================================================================

describe('Macro to Visual Change Flow', () => {
  it('macro trigger leads to correct parameter changes', () => {
    const config = createLaunchpadLayout();
    const handler = createActionHandler();

    // Trigger drop-classic macro
    dispatchMidiNote(config, handler, 1, 36, 127);

    // Verify the macro was triggered
    expect(handler.triggerMacro).toHaveBeenCalledWith('drop-classic', 1);

    // Look up the macro and verify its changes
    const macro = getSceneMacro('drop-classic');
    expect(macro).toBeDefined();
    expect(macro!.changes).toContainEqual(
      expect.objectContaining({ target: 'strobe.intensity' })
    );
    expect(macro!.changes).toContainEqual(
      expect.objectContaining({ target: 'burst.enabled', value: true })
    );
  });

  it('build macro has interpolatable changes', () => {
    const config = createLaunchpadLayout();
    const handler = createActionHandler();

    // Trigger build-8bar macro
    dispatchMidiNote(config, handler, 1, 45, 127);

    expect(handler.triggerMacro).toHaveBeenCalledWith('build-8bar', 1);

    // Verify the build macro has from/to values
    const macro = getSceneMacro('build-8bar');
    expect(macro).toBeDefined();
    expect(macro!.durationBeats).toBe(32);

    // Verify interpolation works
    const bloomChange = macro!.changes.find(c => c.target === 'effects.bloom');
    expect(bloomChange?.from).toBeDefined();
    expect(bloomChange?.to).toBeDefined();

    // Test interpolation at different progress points
    const at0 = interpolateMacroValue(bloomChange!, 0, macro!.easing);
    const at50 = interpolateMacroValue(bloomChange!, 0.5, macro!.easing);
    const at100 = interpolateMacroValue(bloomChange!, 1, macro!.easing);

    expect(at0).toBe(bloomChange!.from);
    expect(at100).toBe(bloomChange!.to);
    expect(at50).toBeGreaterThan(at0);
    expect(at50).toBeLessThan(at100);
  });
});

// ============================================================================
// Multi-Controller Scenario Tests
// ============================================================================

describe('Multi-Controller Scenarios', () => {
  it('handles rapid consecutive triggers', () => {
    const config = createLaunchpadLayout();
    const handler = createActionHandler();

    // Simulate rapid button presses
    dispatchMidiNote(config, handler, 1, 36, 127); // Drop
    dispatchMidiNote(config, handler, 1, 36, 0);   // Note off
    dispatchMidiNote(config, handler, 1, 52, 127); // Breakdown
    dispatchMidiNote(config, handler, 1, 52, 0);   // Note off

    expect(handler.triggerMacro).toHaveBeenCalledTimes(2);
    expect(handler.triggerMacro).toHaveBeenCalledWith('drop-classic', 1);
    expect(handler.triggerMacro).toHaveBeenCalledWith('breakdown-calm', 1);
  });

  it('handles simultaneous CC movements', () => {
    const config = createLaunchpadLayout();
    const handler = createActionHandler();

    // Simulate moving multiple knobs at once
    dispatchMidiCC(config, handler, 1, 1, 100); // Bloom
    dispatchMidiCC(config, handler, 1, 2, 80);  // Chroma
    dispatchMidiCC(config, handler, 1, 7, 127); // Laser

    expect(handler.setParameter).toHaveBeenCalledTimes(3);
    expect(handler.setParameter).toHaveBeenCalledWith('effects.bloom', expect.any(Number));
    expect(handler.setParameter).toHaveBeenCalledWith('effects.chroma', expect.any(Number));
    expect(handler.setParameter).toHaveBeenCalledWith('laser.opacity', expect.any(Number));
  });

  it('ignores unmapped notes', () => {
    const config = createLaunchpadLayout();
    const handler = createActionHandler();

    // Note 100 is not mapped
    const result = dispatchMidiNote(config, handler, 1, 100, 127);

    expect(result.handled).toBe(false);
    expect(handler.triggerMacro).not.toHaveBeenCalled();
    expect(handler.loadPreset).not.toHaveBeenCalled();
  });

  it('ignores unmapped CCs', () => {
    const config = createLaunchpadLayout();
    const handler = createActionHandler();

    // CC 99 is not mapped
    const result = dispatchMidiCC(config, handler, 1, 99, 64);

    expect(result.handled).toBe(false);
    expect(handler.setParameter).not.toHaveBeenCalled();
  });
});

// ============================================================================
// Custom Configuration Tests
// ============================================================================

describe('Custom Configuration', () => {
  it('supports custom preset triggers', () => {
    const config: MidiSceneConfig = {
      triggers: [
        createPresetTrigger(36, '/presets/EDM/drop-heavy.vsp', 'Heavy Drop'),
        createPresetTrigger(37, '/presets/Ambient/calm.vsp', 'Calm Ambient')
      ],
      parameters: [],
      defaultBank: 0,
      bankCount: 1
    };
    const handler = createActionHandler();

    dispatchMidiNote(config, handler, 1, 36, 127);

    expect(handler.loadPreset).toHaveBeenCalledWith('/presets/EDM/drop-heavy.vsp', 1);
  });

  it('supports custom parameter ranges', () => {
    const config: MidiSceneConfig = {
      triggers: [],
      parameters: [
        createCCParameter(1, 'custom.param', 'Custom', { min: -1, max: 1 })
      ],
      defaultBank: 0,
      bankCount: 1
    };
    const handler = createActionHandler();

    // CC at 0 should map to -1
    dispatchMidiCC(config, handler, 1, 1, 0);
    expect(handler.setParameter).toHaveBeenCalledWith('custom.param', -1);

    // CC at 127 should map to 1
    dispatchMidiCC(config, handler, 1, 1, 127);
    expect(handler.setParameter).toHaveBeenCalledWith('custom.param', 1);

    // CC at 64 should map to ~0
    dispatchMidiCC(config, handler, 1, 1, 64);
    expect(handler.setParameter).toHaveBeenLastCalledWith(
      'custom.param',
      expect.closeTo(64 / 127 * 2 - 1, 2)
    );
  });

  it('supports disabled triggers', () => {
    const trigger = createMacroTrigger(36, 'test-macro');
    trigger.enabled = false;

    const config: MidiSceneConfig = {
      triggers: [trigger],
      parameters: [],
      defaultBank: 0,
      bankCount: 1
    };
    const handler = createActionHandler();

    const result = dispatchMidiNote(config, handler, 1, 36, 127);

    expect(result.handled).toBe(false);
    expect(handler.triggerMacro).not.toHaveBeenCalled();
  });

  it('supports multiple channels', () => {
    const config: MidiSceneConfig = {
      triggers: [
        createMacroTrigger(36, 'channel-1-macro', { channel: 1 }),
        createMacroTrigger(36, 'channel-2-macro', { channel: 2 })
      ],
      parameters: [],
      defaultBank: 0,
      bankCount: 1
    };
    const handler = createActionHandler();

    dispatchMidiNote(config, handler, 1, 36, 127);
    expect(handler.triggerMacro).toHaveBeenCalledWith('channel-1-macro', 1);

    handler.triggerMacro.mockClear();

    dispatchMidiNote(config, handler, 2, 36, 127);
    expect(handler.triggerMacro).toHaveBeenCalledWith('channel-2-macro', 1);
  });
});

// ============================================================================
// Minimal Layout Tests
// ============================================================================

describe('Minimal Layout', () => {
  let config: MidiSceneConfig;
  let handler: ActionHandler;

  beforeEach(() => {
    config = createMinimalLayout();
    handler = createActionHandler();
  });

  it('has fewer triggers than launchpad layout', () => {
    const launchpad = createLaunchpadLayout();
    expect(config.triggers.length).toBeLessThan(launchpad.triggers.length);
  });

  it('includes essential macros', () => {
    dispatchMidiNote(config, handler, 1, 36, 127); // Drop
    expect(handler.triggerMacro).toHaveBeenCalledWith('drop-classic', 1);

    handler.triggerMacro.mockClear();

    dispatchMidiNote(config, handler, 1, 37, 127); // Breakdown
    expect(handler.triggerMacro).toHaveBeenCalledWith('breakdown-calm', 1);
  });

  it('includes playlist controls', () => {
    dispatchMidiNote(config, handler, 1, 40, 127);
    expect(handler.controlPlaylist).toHaveBeenCalledWith('play');

    dispatchMidiNote(config, handler, 1, 41, 127);
    expect(handler.controlPlaylist).toHaveBeenCalledWith('stop');
  });

  it('has single bank', () => {
    expect(config.bankCount).toBe(1);
  });
});

// ============================================================================
// Full Performance Scenario Tests
// ============================================================================

describe('Full Performance Scenario', () => {
  it('simulates complete DJ set workflow', () => {
    const config = createLaunchpadLayout();
    const handler = createActionHandler();
    const parameterValues: Record<string, number> = {};

    // Track parameter changes
    handler.setParameter.mockImplementation((target: string, value: number) => {
      parameterValues[target] = value;
    });

    // 1. Start playlist
    dispatchMidiNote(config, handler, 1, 76, 127); // Play
    expect(handler.controlPlaylist).toHaveBeenCalledWith('play');

    // 2. Raise bloom during intro
    dispatchMidiCC(config, handler, 1, 1, 80);
    expect(parameterValues['effects.bloom']).toBeCloseTo(80 / 127, 2);

    // 3. Trigger build for the drop
    dispatchMidiNote(config, handler, 1, 45, 127); // 8-bar build
    expect(handler.triggerMacro).toHaveBeenCalledWith('build-8bar', 1);

    // 4. Drop! Maximum impact
    dispatchMidiNote(config, handler, 1, 36, 127); // Drop classic
    expect(handler.triggerMacro).toHaveBeenCalledWith('drop-classic', 1);

    // 5. Lower intensity during breakdown
    dispatchMidiNote(config, handler, 1, 52, 127); // Calm breakdown
    expect(handler.triggerMacro).toHaveBeenCalledWith('breakdown-calm', 1);

    // 6. Bring up laser for next section
    dispatchMidiCC(config, handler, 1, 7, 127);
    expect(parameterValues['laser.opacity']).toBe(1);

    // 7. Advance playlist to next track
    dispatchMidiNote(config, handler, 1, 79, 127); // Next
    expect(handler.controlPlaylist).toHaveBeenCalledWith('next');

    // Verify all expected calls were made
    expect(handler.controlPlaylist).toHaveBeenCalledTimes(2); // play, next
    expect(handler.triggerMacro).toHaveBeenCalledTimes(3); // build, drop, breakdown
    expect(handler.setParameter).toHaveBeenCalledTimes(2); // bloom, laser
  });
});
