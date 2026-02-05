import { describe, expect, it } from 'vitest';
import {
  easingFunctions,
  DROP_CLASSIC,
  DROP_HARD,
  DROP_SUBTLE,
  BUILD_8BAR,
  BUILD_4BAR,
  BUILD_EPIC,
  BREAKDOWN_CALM,
  BREAKDOWN_ATMOSPHERIC,
  BREAKDOWN_TRANCE,
  TRANSITION_FLASH,
  TRANSITION_FADE_OUT,
  TRANSITION_FADE_IN,
  TRANSITION_BLUR,
  SCENE_MACROS,
  getSceneMacro,
  getMacrosByCategory,
  getMacrosByTag,
  createMacroExecutionState,
  interpolateMacroValue,
  SceneMacro,
  MacroParamChange
} from '../src/shared/sceneMacros';

// ============================================================================
// Easing Functions Tests
// ============================================================================

describe('easingFunctions', () => {
  describe('linear', () => {
    it('returns input unchanged', () => {
      expect(easingFunctions.linear(0)).toBe(0);
      expect(easingFunctions.linear(0.5)).toBe(0.5);
      expect(easingFunctions.linear(1)).toBe(1);
    });
  });

  describe('easeIn', () => {
    it('starts slow and accelerates', () => {
      expect(easingFunctions.easeIn(0)).toBe(0);
      expect(easingFunctions.easeIn(0.5)).toBe(0.25); // 0.5^2
      expect(easingFunctions.easeIn(1)).toBe(1);
    });

    it('is below linear in middle', () => {
      expect(easingFunctions.easeIn(0.5)).toBeLessThan(0.5);
    });
  });

  describe('easeOut', () => {
    it('starts fast and decelerates', () => {
      expect(easingFunctions.easeOut(0)).toBe(0);
      expect(easingFunctions.easeOut(0.5)).toBe(0.75); // 1 - (1-0.5)^2
      expect(easingFunctions.easeOut(1)).toBe(1);
    });

    it('is above linear in middle', () => {
      expect(easingFunctions.easeOut(0.5)).toBeGreaterThan(0.5);
    });
  });

  describe('easeInOut', () => {
    it('handles start and end', () => {
      expect(easingFunctions.easeInOut(0)).toBe(0);
      expect(easingFunctions.easeInOut(1)).toBe(1);
    });

    it('is at 0.5 at midpoint', () => {
      expect(easingFunctions.easeInOut(0.5)).toBe(0.5);
    });

    it('is symmetric', () => {
      const at25 = easingFunctions.easeInOut(0.25);
      const at75 = easingFunctions.easeInOut(0.75);
      expect(at25 + at75).toBeCloseTo(1, 5);
    });
  });
});

// ============================================================================
// Drop Macro Tests
// ============================================================================

describe('Drop Macros', () => {
  describe('DROP_CLASSIC', () => {
    it('has correct metadata', () => {
      expect(DROP_CLASSIC.id).toBe('drop-classic');
      expect(DROP_CLASSIC.category).toBe('drop');
      expect(DROP_CLASSIC.durationBeats).toBe(0); // Instant
    });

    it('enables strobe at high intensity', () => {
      const strobeChange = DROP_CLASSIC.changes.find(c => c.target === 'strobe.intensity');
      expect(strobeChange?.value).toBeGreaterThanOrEqual(0.8);
    });

    it('enables burst shapes', () => {
      const burstChange = DROP_CLASSIC.changes.find(c => c.target === 'burst.enabled');
      expect(burstChange?.value).toBe(true);
    });

    it('sets high bloom', () => {
      const bloomChange = DROP_CLASSIC.changes.find(c => c.target === 'effects.bloom');
      expect(bloomChange?.value).toBeGreaterThan(0.4);
    });

    it('has impact-related tags', () => {
      expect(DROP_CLASSIC.tags).toContain('drop');
      expect(DROP_CLASSIC.tags).toContain('impact');
    });
  });

  describe('DROP_HARD', () => {
    it('has higher intensity than classic', () => {
      const classicStrobe = DROP_CLASSIC.changes.find(c => c.target === 'strobe.intensity')?.value as number;
      const hardStrobe = DROP_HARD.changes.find(c => c.target === 'strobe.intensity')?.value as number;
      expect(hardStrobe).toBeGreaterThanOrEqual(classicStrobe);
    });

    it('has faster strobe rate', () => {
      const classicRate = DROP_CLASSIC.changes.find(c => c.target === 'strobe.rate')?.value as number;
      const hardRate = DROP_HARD.changes.find(c => c.target === 'strobe.rate')?.value as number;
      expect(hardRate).toBeGreaterThan(classicRate);
    });

    it('uses high-energy burst preset', () => {
      const burstPreset = DROP_HARD.changes.find(c => c.target === 'burst.preset');
      expect(burstPreset?.value).toBe('high-energy');
    });
  });

  describe('DROP_SUBTLE', () => {
    it('has lower intensity than classic', () => {
      const classicStrobe = DROP_CLASSIC.changes.find(c => c.target === 'strobe.intensity')?.value as number;
      const subtleStrobe = DROP_SUBTLE.changes.find(c => c.target === 'strobe.intensity')?.value as number;
      expect(subtleStrobe).toBeLessThan(classicStrobe);
    });

    it('uses minimal burst preset', () => {
      const burstPreset = DROP_SUBTLE.changes.find(c => c.target === 'burst.preset');
      expect(burstPreset?.value).toBe('minimal');
    });
  });
});

// ============================================================================
// Build Macro Tests
// ============================================================================

describe('Build Macros', () => {
  describe('BUILD_8BAR', () => {
    it('has correct duration', () => {
      expect(BUILD_8BAR.durationBeats).toBe(32); // 8 bars x 4 beats
    });

    it('uses easeIn for gradual acceleration', () => {
      expect(BUILD_8BAR.easing).toBe('easeIn');
    });

    it('has from/to values for interpolation', () => {
      const bloomChange = BUILD_8BAR.changes.find(c => c.target === 'effects.bloom');
      expect(bloomChange?.from).toBeDefined();
      expect(bloomChange?.to).toBeDefined();
      expect(bloomChange?.from).toBeLessThan(bloomChange?.to as number);
    });

    it('increases intensity across all parameters', () => {
      for (const change of BUILD_8BAR.changes) {
        if (change.from !== undefined && change.to !== undefined) {
          expect(change.to).toBeGreaterThan(change.from);
        }
      }
    });

    it('has build-related tags', () => {
      expect(BUILD_8BAR.tags).toContain('build');
      expect(BUILD_8BAR.tags).toContain('riser');
    });
  });

  describe('BUILD_4BAR', () => {
    it('is shorter than 8 bar build', () => {
      expect(BUILD_4BAR.durationBeats).toBeLessThan(BUILD_8BAR.durationBeats);
      expect(BUILD_4BAR.durationBeats).toBe(16); // 4 bars x 4 beats
    });
  });

  describe('BUILD_EPIC', () => {
    it('is longer than 8 bar build', () => {
      expect(BUILD_EPIC.durationBeats).toBeGreaterThan(BUILD_8BAR.durationBeats);
      expect(BUILD_EPIC.durationBeats).toBe(64); // 16 bars x 4 beats
    });

    it('has wider value ranges', () => {
      const epicBloom = BUILD_EPIC.changes.find(c => c.target === 'effects.bloom');
      const regularBloom = BUILD_8BAR.changes.find(c => c.target === 'effects.bloom');

      const epicRange = (epicBloom?.to as number) - (epicBloom?.from as number);
      const regularRange = (regularBloom?.to as number) - (regularBloom?.from as number);

      expect(epicRange).toBeGreaterThanOrEqual(regularRange);
    });
  });
});

// ============================================================================
// Breakdown Macro Tests
// ============================================================================

describe('Breakdown Macros', () => {
  describe('BREAKDOWN_CALM', () => {
    it('has instant duration', () => {
      expect(BREAKDOWN_CALM.durationBeats).toBe(0);
    });

    it('disables strobe', () => {
      const strobeChange = BREAKDOWN_CALM.changes.find(c => c.target === 'strobe.intensity');
      expect(strobeChange?.value).toBe(0);
    });

    it('disables burst shapes', () => {
      const burstChange = BREAKDOWN_CALM.changes.find(c => c.target === 'burst.enabled');
      expect(burstChange?.value).toBe(false);
    });

    it('reduces visual intensity', () => {
      const bloomChange = BREAKDOWN_CALM.changes.find(c => c.target === 'effects.bloom');
      expect(bloomChange?.value).toBeLessThan(0.2);
    });

    it('slows down particles', () => {
      const particleSpeed = BREAKDOWN_CALM.changes.find(c => c.target === 'particles.speed');
      expect(particleSpeed?.value).toBeLessThan(0.3);
    });
  });

  describe('BREAKDOWN_ATMOSPHERIC', () => {
    it('enables blur effect', () => {
      const blurChange = BREAKDOWN_ATMOSPHERIC.changes.find(c => c.target === 'effects.blur');
      expect(blurChange?.value).toBeGreaterThan(0);
    });

    it('enables persistence', () => {
      const persistChange = BREAKDOWN_ATMOSPHERIC.changes.find(c => c.target === 'effects.persistence');
      expect(persistChange?.value).toBeGreaterThan(0);
    });
  });

  describe('BREAKDOWN_TRANCE', () => {
    it('enables kaleidoscope effect', () => {
      const kaleidoChange = BREAKDOWN_TRANCE.changes.find(c => c.target === 'effects.kaleidoscope');
      expect(kaleidoChange?.value).toBeGreaterThan(0);
    });

    it('has trance tag', () => {
      expect(BREAKDOWN_TRANCE.tags).toContain('trance');
      expect(BREAKDOWN_TRANCE.tags).toContain('hypnotic');
    });
  });
});

// ============================================================================
// Transition Macro Tests
// ============================================================================

describe('Transition Macros', () => {
  describe('TRANSITION_FLASH', () => {
    it('is very short', () => {
      expect(TRANSITION_FLASH.durationBeats).toBe(1);
    });

    it('uses easeOut for quick flash decay', () => {
      expect(TRANSITION_FLASH.easing).toBe('easeOut');
    });

    it('sets maximum strobe and bloom', () => {
      const strobeChange = TRANSITION_FLASH.changes.find(c => c.target === 'strobe.intensity');
      const bloomChange = TRANSITION_FLASH.changes.find(c => c.target === 'effects.bloom');

      expect(strobeChange?.value).toBe(1.0);
      expect(bloomChange?.value).toBe(1.0);
    });
  });

  describe('TRANSITION_FADE_OUT', () => {
    it('has from/to values going to zero', () => {
      for (const change of TRANSITION_FADE_OUT.changes) {
        if (change.from !== undefined && change.to !== undefined) {
          expect(change.to).toBe(0);
        }
      }
    });

    it('uses easeOut for natural fade', () => {
      expect(TRANSITION_FADE_OUT.easing).toBe('easeOut');
    });
  });

  describe('TRANSITION_FADE_IN', () => {
    it('has from/to values starting from zero', () => {
      for (const change of TRANSITION_FADE_IN.changes) {
        if (change.from !== undefined && change.to !== undefined) {
          expect(change.from).toBe(0);
        }
      }
    });

    it('uses easeIn for natural fade in', () => {
      expect(TRANSITION_FADE_IN.easing).toBe('easeIn');
    });
  });

  describe('TRANSITION_BLUR', () => {
    it('increases blur', () => {
      const blurChange = TRANSITION_BLUR.changes.find(c => c.target === 'effects.blur');
      expect(blurChange?.to).toBeGreaterThan(blurChange?.from as number);
    });

    it('uses easeInOut for smooth transition', () => {
      expect(TRANSITION_BLUR.easing).toBe('easeInOut');
    });
  });
});

// ============================================================================
// Registry Tests
// ============================================================================

describe('SCENE_MACROS', () => {
  it('contains all expected macros', () => {
    expect(SCENE_MACROS.length).toBe(13);
  });

  it('has unique IDs', () => {
    const ids = SCENE_MACROS.map(m => m.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('includes macros from all categories', () => {
    const categories = new Set(SCENE_MACROS.map(m => m.category));
    expect(categories).toContain('drop');
    expect(categories).toContain('build');
    expect(categories).toContain('breakdown');
    expect(categories).toContain('transition');
  });
});

describe('getSceneMacro', () => {
  it('finds macro by ID', () => {
    const macro = getSceneMacro('drop-classic');
    expect(macro).toBe(DROP_CLASSIC);
  });

  it('returns undefined for unknown ID', () => {
    const macro = getSceneMacro('nonexistent');
    expect(macro).toBeUndefined();
  });
});

describe('getMacrosByCategory', () => {
  it('returns all drop macros', () => {
    const drops = getMacrosByCategory('drop');
    expect(drops.length).toBe(3);
    expect(drops).toContain(DROP_CLASSIC);
    expect(drops).toContain(DROP_HARD);
    expect(drops).toContain(DROP_SUBTLE);
  });

  it('returns all build macros', () => {
    const builds = getMacrosByCategory('build');
    expect(builds.length).toBe(3);
  });

  it('returns all breakdown macros', () => {
    const breakdowns = getMacrosByCategory('breakdown');
    expect(breakdowns.length).toBe(3);
  });

  it('returns all transition macros', () => {
    const transitions = getMacrosByCategory('transition');
    expect(transitions.length).toBe(4);
  });

  it('returns empty for custom category', () => {
    const custom = getMacrosByCategory('custom');
    expect(custom.length).toBe(0);
  });
});

describe('getMacrosByTag', () => {
  it('finds macros by tag', () => {
    const drops = getMacrosByTag('drop');
    expect(drops.length).toBeGreaterThan(0);
    drops.forEach(m => expect(m.tags).toContain('drop'));
  });

  it('finds macros by riser tag', () => {
    const risers = getMacrosByTag('riser');
    expect(risers.length).toBeGreaterThanOrEqual(2);
  });

  it('returns empty for unknown tag', () => {
    const unknown = getMacrosByTag('nonexistent-tag');
    expect(unknown.length).toBe(0);
  });
});

// ============================================================================
// Execution State Tests
// ============================================================================

describe('createMacroExecutionState', () => {
  it('creates default state', () => {
    const state = createMacroExecutionState();

    expect(state.activeMacro).toBeNull();
    expect(state.startTime).toBe(0);
    expect(state.startBeat).toBe(0);
    expect(state.progress).toBe(0);
    expect(state.isRunning).toBe(false);
  });
});

// ============================================================================
// Interpolation Tests
// ============================================================================

describe('interpolateMacroValue', () => {
  it('returns value directly for instant changes', () => {
    const change: MacroParamChange = {
      target: 'effects.bloom',
      value: 0.5
    };

    expect(interpolateMacroValue(change, 0, 'linear')).toBe(0.5);
    expect(interpolateMacroValue(change, 0.5, 'linear')).toBe(0.5);
    expect(interpolateMacroValue(change, 1, 'linear')).toBe(0.5);
  });

  it('interpolates between from and to with linear easing', () => {
    const change: MacroParamChange = {
      target: 'effects.bloom',
      value: 0.6,
      from: 0.2,
      to: 0.6
    };

    expect(interpolateMacroValue(change, 0, 'linear')).toBe(0.2);
    expect(interpolateMacroValue(change, 0.5, 'linear')).toBe(0.4);
    expect(interpolateMacroValue(change, 1, 'linear')).toBe(0.6);
  });

  it('applies easeIn curve', () => {
    const change: MacroParamChange = {
      target: 'effects.bloom',
      value: 1,
      from: 0,
      to: 1
    };

    const atMid = interpolateMacroValue(change, 0.5, 'easeIn');
    expect(atMid).toBe(0.25); // easeIn(0.5) = 0.25
  });

  it('applies easeOut curve', () => {
    const change: MacroParamChange = {
      target: 'effects.bloom',
      value: 1,
      from: 0,
      to: 1
    };

    const atMid = interpolateMacroValue(change, 0.5, 'easeOut');
    expect(atMid).toBe(0.75); // easeOut(0.5) = 0.75
  });

  it('applies easeInOut curve', () => {
    const change: MacroParamChange = {
      target: 'effects.bloom',
      value: 1,
      from: 0,
      to: 1
    };

    const atMid = interpolateMacroValue(change, 0.5, 'easeInOut');
    expect(atMid).toBe(0.5);
  });

  it('handles non-numeric values by returning 0', () => {
    const change: MacroParamChange = {
      target: 'burst.preset',
      value: 'drop-classic'
    };

    expect(interpolateMacroValue(change, 0.5, 'linear')).toBe(0);
  });

  it('handles decreasing values (from > to)', () => {
    const change: MacroParamChange = {
      target: 'effects.bloom',
      value: 0,
      from: 1,
      to: 0
    };

    expect(interpolateMacroValue(change, 0, 'linear')).toBe(1);
    expect(interpolateMacroValue(change, 0.5, 'linear')).toBe(0.5);
    expect(interpolateMacroValue(change, 1, 'linear')).toBe(0);
  });
});

// ============================================================================
// Macro Structure Validation Tests
// ============================================================================

describe('Macro structure validation', () => {
  it('all macros have required fields', () => {
    for (const macro of SCENE_MACROS) {
      expect(macro.id).toBeTruthy();
      expect(macro.name).toBeTruthy();
      expect(macro.description).toBeTruthy();
      expect(Array.isArray(macro.changes)).toBe(true);
      expect(typeof macro.durationBeats).toBe('number');
      expect(['linear', 'easeIn', 'easeOut', 'easeInOut']).toContain(macro.easing);
      expect(['drop', 'build', 'breakdown', 'transition', 'custom']).toContain(macro.category);
      expect(Array.isArray(macro.tags)).toBe(true);
    }
  });

  it('all changes have valid targets', () => {
    const validTargets = [
      'effects.bloom', 'effects.blur', 'effects.chroma', 'effects.feedback',
      'effects.persistence', 'effects.kaleidoscope', 'strobe.intensity', 'strobe.rate',
      'burst.enabled', 'burst.preset', 'laser.opacity', 'laser.glow',
      'shapeBurst.opacity', 'gridTunnel.opacity', 'gridTunnel.speed',
      'particles.density', 'particles.speed', 'particles.glow'
    ];

    for (const macro of SCENE_MACROS) {
      for (const change of macro.changes) {
        expect(validTargets).toContain(change.target);
      }
    }
  });

  it('build macros have from/to values', () => {
    const buildMacros = getMacrosByCategory('build');

    for (const macro of buildMacros) {
      // At least some changes should have from/to
      const hasTimedChanges = macro.changes.some(c => c.from !== undefined && c.to !== undefined);
      expect(hasTimedChanges).toBe(true);
    }
  });

  it('instant macros have zero duration', () => {
    const instantMacros = [...getMacrosByCategory('drop'), ...getMacrosByCategory('breakdown')];

    for (const macro of instantMacros) {
      expect(macro.durationBeats).toBe(0);
    }
  });
});
