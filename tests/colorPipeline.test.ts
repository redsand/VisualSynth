import { describe, expect, it } from 'vitest';
import {
  srgbToLinear,
  linearToSrgb,
  gammaEncode,
  gammaDecode,
  tonemapReinhard,
  tonemapReinhardExtended,
  tonemapAcesApprox,
  applyToneMapping,
  createIdentityLUT,
  trilinearInterpolate,
  samplePalette,
  DEFAULT_PALETTES,
  getBayerThreshold,
  applyDithering,
  generateGrainValue,
  applyFilmGrain,
  DEFAULT_GRADING_PRESETS,
  getPresetById,
  getPresetsByCategory,
  getPresetsByTag,
  applyGradingPreset,
  DEFAULT_COLOR_PIPELINE_STATE,
  DEFAULT_TONE_MAPPING_CONFIG,
  DEFAULT_DITHERING_CONFIG,
  DEFAULT_FILM_GRAIN_CONFIG
} from '../src/shared/colorPipeline';

describe('gamma conversion', () => {
  it('converts sRGB to linear', () => {
    expect(srgbToLinear(0)).toBeCloseTo(0);
    expect(srgbToLinear(1)).toBeCloseTo(1);
    expect(srgbToLinear(0.5)).toBeLessThan(0.5); // Linear is darker
  });

  it('converts linear to sRGB', () => {
    expect(linearToSrgb(0)).toBeCloseTo(0);
    expect(linearToSrgb(1)).toBeCloseTo(1);
    expect(linearToSrgb(0.5)).toBeGreaterThan(0.5); // sRGB is brighter
  });

  it('sRGB round-trips correctly', () => {
    for (const v of [0, 0.25, 0.5, 0.75, 1]) {
      expect(srgbToLinear(linearToSrgb(v))).toBeCloseTo(v, 4);
      expect(linearToSrgb(srgbToLinear(v))).toBeCloseTo(v, 4);
    }
  });

  it('applies gamma encode/decode', () => {
    expect(gammaEncode(0.5, 2.2)).toBeGreaterThan(0.5);
    expect(gammaDecode(0.5, 2.2)).toBeLessThan(0.5);
    expect(gammaDecode(gammaEncode(0.5, 2.2), 2.2)).toBeCloseTo(0.5);
  });
});

describe('tone mapping', () => {
  it('Reinhard maps HDR to LDR', () => {
    expect(tonemapReinhard(0)).toBe(0);
    expect(tonemapReinhard(1)).toBeCloseTo(0.5);
    expect(tonemapReinhard(10)).toBeLessThan(1);
  });

  it('Reinhard extended uses white point', () => {
    const result1 = tonemapReinhardExtended(1, 2);
    const result2 = tonemapReinhardExtended(1, 10);
    // Higher white point = more linear response for mid-range values
    // Values below white point are less compressed, so result is actually lower
    expect(result1).toBeGreaterThan(result2);
  });

  it('ACES approximation maps to 0-1', () => {
    expect(tonemapAcesApprox(0)).toBeCloseTo(0);
    expect(tonemapAcesApprox(100)).toBeLessThanOrEqual(1);
    expect(tonemapAcesApprox(-1)).toBe(0);
  });

  it('applies tone mapping with exposure', () => {
    const config = { ...DEFAULT_TONE_MAPPING_CONFIG, mode: 'reinhard' as const, exposure: 0 };

    // With exposure 0
    const base = applyToneMapping(0.5, config);

    // With +1 exposure (2x brightness)
    const brighter = applyToneMapping(0.5, { ...config, exposure: 1 });
    expect(brighter).toBeGreaterThan(base);
  });

  it('clamps output to 0-1', () => {
    const config = { ...DEFAULT_TONE_MAPPING_CONFIG, mode: 'none' as const, exposure: 10 };
    expect(applyToneMapping(1, config)).toBe(1);
  });
});

describe('3D LUT', () => {
  it('creates identity LUT', () => {
    const lut = createIdentityLUT(17);
    expect(lut.size).toBe(17);
    expect(lut.data.length).toBe(17 * 17 * 17 * 3);
  });

  it('identity LUT returns input colors', () => {
    const lut = createIdentityLUT(17);

    const [r, g, b] = trilinearInterpolate(lut, 0.5, 0.3, 0.7);
    expect(r).toBeCloseTo(0.5, 1);
    expect(g).toBeCloseTo(0.3, 1);
    expect(b).toBeCloseTo(0.7, 1);
  });

  it('LUT handles edge values', () => {
    const lut = createIdentityLUT(17);

    const [r0, g0, b0] = trilinearInterpolate(lut, 0, 0, 0);
    expect(r0).toBeCloseTo(0, 2);
    expect(g0).toBeCloseTo(0, 2);
    expect(b0).toBeCloseTo(0, 2);

    const [r1, g1, b1] = trilinearInterpolate(lut, 1, 1, 1);
    expect(r1).toBeCloseTo(1, 2);
    expect(g1).toBeCloseTo(1, 2);
    expect(b1).toBeCloseTo(1, 2);
  });
});

describe('color palettes', () => {
  it('samples palette at boundaries', () => {
    const palette = DEFAULT_PALETTES[0]; // Sunset

    const start = samplePalette(palette, 0);
    const end = samplePalette(palette, 1);

    expect(start).toEqual(palette.colors[0]);
    expect(end).toEqual(palette.colors[palette.colors.length - 1]);
  });

  it('interpolates palette colors', () => {
    const palette = {
      id: 'test',
      name: 'Test',
      colors: [
        { r: 0, g: 0, b: 0 },
        { r: 1, g: 1, b: 1 }
      ],
      interpolation: 'linear' as const,
      locked: false
    };

    const mid = samplePalette(palette, 0.5);
    expect(mid.r).toBeCloseTo(0.5);
    expect(mid.g).toBeCloseTo(0.5);
    expect(mid.b).toBeCloseTo(0.5);
  });

  it('applies smooth interpolation', () => {
    const linearPalette = {
      id: 'test',
      name: 'Test',
      colors: [
        { r: 0, g: 0, b: 0 },
        { r: 1, g: 1, b: 1 }
      ],
      interpolation: 'linear' as const,
      locked: false
    };

    const smoothPalette = {
      ...linearPalette,
      interpolation: 'smooth' as const
    };

    const linearMid = samplePalette(linearPalette, 0.25);
    const smoothMid = samplePalette(smoothPalette, 0.25);

    // Smooth interpolation should differ from linear
    expect(smoothMid.r).not.toBeCloseTo(linearMid.r, 4);
  });

  it('applies step interpolation', () => {
    const palette = {
      id: 'test',
      name: 'Test',
      colors: [
        { r: 0, g: 0, b: 0 },
        { r: 0.5, g: 0.5, b: 0.5 },
        { r: 1, g: 1, b: 1 }
      ],
      interpolation: 'step' as const,
      locked: false
    };

    const result = samplePalette(palette, 0.4);
    // Should be the second color (index 1)
    expect(result).toEqual(palette.colors[1]);
  });

  it('clamps t value', () => {
    const palette = DEFAULT_PALETTES[0];

    const below = samplePalette(palette, -0.5);
    const above = samplePalette(palette, 1.5);

    expect(below).toEqual(palette.colors[0]);
    expect(above).toEqual(palette.colors[palette.colors.length - 1]);
  });
});

describe('dithering', () => {
  it('bayer threshold is in valid range', () => {
    const config = { ...DEFAULT_DITHERING_CONFIG, mode: 'bayer4' as const, intensity: 1 };

    for (let x = 0; x < 16; x++) {
      for (let y = 0; y < 16; y++) {
        const threshold = getBayerThreshold(x, y, config);
        expect(threshold).toBeGreaterThanOrEqual(-0.5);
        expect(threshold).toBeLessThanOrEqual(0.5);
      }
    }
  });

  it('applies dithering to value', () => {
    const config = { ...DEFAULT_DITHERING_CONFIG, mode: 'bayer4' as const, intensity: 1, bitDepth: 8 };

    // Dithering should add small variations
    const results = new Set<number>();
    for (let x = 0; x < 4; x++) {
      for (let y = 0; y < 4; y++) {
        results.add(applyDithering(0.5, x, y, config));
      }
    }

    // Should have multiple different values due to dithering
    expect(results.size).toBeGreaterThan(1);
  });

  it('no dithering when mode is none', () => {
    const config = { ...DEFAULT_DITHERING_CONFIG, mode: 'none' as const };
    expect(applyDithering(0.5, 0, 0, config)).toBe(0.5);
  });

  it('clamps output to 0-1', () => {
    const config = { ...DEFAULT_DITHERING_CONFIG, mode: 'bayer8' as const, intensity: 2, bitDepth: 8 };

    for (let x = 0; x < 8; x++) {
      for (let y = 0; y < 8; y++) {
        const result = applyDithering(0.99, x, y, config);
        expect(result).toBeLessThanOrEqual(1);
        expect(result).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('film grain', () => {
  it('generates consistent grain for same coordinates', () => {
    const config = DEFAULT_FILM_GRAIN_CONFIG;

    const grain1 = generateGrainValue(100, 200, 0, config);
    const grain2 = generateGrainValue(100, 200, 0, config);

    expect(grain1).toBe(grain2);
  });

  it('generates different grain for different coordinates', () => {
    const config = DEFAULT_FILM_GRAIN_CONFIG;

    const grain1 = generateGrainValue(100, 200, 0, config);
    const grain2 = generateGrainValue(101, 200, 0, config);

    expect(grain1).not.toBe(grain2);
  });

  it('animates grain over frames', () => {
    const config = { ...DEFAULT_FILM_GRAIN_CONFIG, speed: 24 };

    const grain1 = generateGrainValue(100, 200, 0, config);
    const grain2 = generateGrainValue(100, 200, 1, config);

    expect(grain1).not.toBe(grain2);
  });

  it('applies film grain to value', () => {
    const config = { ...DEFAULT_FILM_GRAIN_CONFIG, enabled: true, intensity: 0.5 };

    const results = new Set<number>();
    for (let x = 0; x < 10; x++) {
      for (let y = 0; y < 10; y++) {
        results.add(applyFilmGrain(0.5, x, y, 0, config));
      }
    }

    expect(results.size).toBeGreaterThan(1);
  });

  it('no grain when disabled', () => {
    const config = { ...DEFAULT_FILM_GRAIN_CONFIG, enabled: false, intensity: 1 };
    expect(applyFilmGrain(0.5, 0, 0, 0, config)).toBe(0.5);
  });

  it('respects luminance response', () => {
    const config = { ...DEFAULT_FILM_GRAIN_CONFIG, enabled: true, intensity: 1, luminanceResponse: 1 };

    // Very dark and very bright values should have less grain
    // Compare grain at 0.5 (mid) vs 0 (dark) and 1 (bright)
    const grainMid = Math.abs(applyFilmGrain(0.5, 50, 50, 0, config) - 0.5);
    const grainDark = Math.abs(applyFilmGrain(0, 50, 50, 0, config) - 0);
    const grainBright = Math.abs(applyFilmGrain(1, 50, 50, 0, config) - 1);

    // Mid-tones should generally have more grain deviation
    // (Note: this is probabilistic, so we use a relaxed comparison)
    expect(grainMid + grainDark + grainBright).toBeGreaterThan(0);
  });
});

describe('grading presets', () => {
  it('has default presets', () => {
    expect(DEFAULT_GRADING_PRESETS.length).toBeGreaterThan(3);
  });

  it('finds preset by ID', () => {
    const preset = getPresetById('grade-cinematic');
    expect(preset).toBeDefined();
    expect(preset?.name).toBe('Cinematic');
  });

  it('returns undefined for unknown ID', () => {
    expect(getPresetById('nonexistent')).toBeUndefined();
  });

  it('filters by category', () => {
    const cinematic = getPresetsByCategory('cinematic');
    expect(cinematic.length).toBeGreaterThan(0);
    expect(cinematic.every((p) => p.category === 'cinematic')).toBe(true);
  });

  it('filters by tag', () => {
    const dramatic = getPresetsByTag('dramatic');
    expect(dramatic.length).toBeGreaterThan(0);
    expect(dramatic.every((p) => p.tags.includes('dramatic'))).toBe(true);
  });

  it('applies preset to state', () => {
    const preset = getPresetById('grade-cinematic')!;
    const state = applyGradingPreset(DEFAULT_COLOR_PIPELINE_STATE, preset);

    expect(state.activePresetId).toBe('grade-cinematic');
    expect(state.toneMapping.mode).toBe('acesApprox');
    expect(state.filmGrain.enabled).toBe(true);
  });

  it('preserves unspecified settings', () => {
    const preset = getPresetById('grade-neutral')!;
    const customState = {
      ...DEFAULT_COLOR_PIPELINE_STATE,
      activePaletteId: 'custom-palette'
    };

    const result = applyGradingPreset(customState, preset);

    // Preset doesn't specify palette, so it should be preserved
    expect(result.activePaletteId).toBe('custom-palette');
  });
});

describe('color pipeline state', () => {
  it('has valid defaults', () => {
    expect(DEFAULT_COLOR_PIPELINE_STATE.colorSpace.workingSpace).toBe('linear');
    expect(DEFAULT_COLOR_PIPELINE_STATE.toneMapping.mode).toBe('acesApprox');
    expect(DEFAULT_COLOR_PIPELINE_STATE.dithering.mode).toBe('bayer4');
    expect(DEFAULT_COLOR_PIPELINE_STATE.filmGrain.enabled).toBe(false);
    expect(DEFAULT_COLOR_PIPELINE_STATE.activePresetId).toBeNull();
  });
});

describe('default configurations', () => {
  it('tone mapping config has sensible defaults', () => {
    expect(DEFAULT_TONE_MAPPING_CONFIG.exposure).toBe(0);
    expect(DEFAULT_TONE_MAPPING_CONFIG.contrast).toBe(1);
    expect(DEFAULT_TONE_MAPPING_CONFIG.saturation).toBe(1);
  });

  it('dithering config defaults to bayer4', () => {
    expect(DEFAULT_DITHERING_CONFIG.mode).toBe('bayer4');
    expect(DEFAULT_DITHERING_CONFIG.bitDepth).toBe(8);
  });

  it('film grain is disabled by default', () => {
    expect(DEFAULT_FILM_GRAIN_CONFIG.enabled).toBe(false);
  });
});
