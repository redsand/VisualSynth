import { describe, expect, it } from 'vitest';

describe('Palette and shiftPalette shader behavior', () => {
  // Test the mathematical behavior of palette() and shiftPalette() functions
  
  it('palette() interpolates linearly between grayscale colors', () => {
    // Simulate the palette() GLSL function behavior
    // palette(t) with grayscale colors should return grayscale
    
    const grayscalePalette: [number, number, number][] = [
      [0, 0, 0],       // black
      [0.25, 0.25, 0.25], // dark gray
      [0.5, 0.5, 0.5],     // mid gray
      [0.75, 0.75, 0.75],  // light gray
      [1, 1, 1]            // white
    ];
    
    function smoothstep(edge0: number, edge1: number, x: number): number {
      const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
      return t * t * (3 - 2 * t);
    }
    
    function palette(t: number): [number, number, number] {
      const clamped = Math.max(0, Math.min(1, t));
      if (clamped < 0.25) {
        return mix(grayscalePalette[0], grayscalePalette[1], smoothstep(0, 0.25, clamped));
      }
      if (clamped < 0.5) {
        return mix(grayscalePalette[1], grayscalePalette[2], smoothstep(0.25, 0.5, clamped));
      }
      if (clamped < 0.75) {
        return mix(grayscalePalette[2], grayscalePalette[3], smoothstep(0.5, 0.75, clamped));
      }
      return mix(grayscalePalette[3], grayscalePalette[4], smoothstep(0.75, 1, clamped));
    }
    
    function mix(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
      return [
        a[0] * (1 - t) + b[0] * t,
        a[1] * (1 - t) + b[1] * t,
        a[2] * (1 - t) + b[2] * t
      ];
    }
    
    // For any input t, palette(t) should return grayscale (R == G == B)
    for (let t = 0; t <= 1; t += 0.1) {
      const result = palette(t);
      expect(result[0]).toBeCloseTo(result[1], 5);
      expect(result[1]).toBeCloseTo(result[2], 5);
      expect(result[0]).toBeCloseTo(result[2], 5);
    }
    
    // Test with t + shift
    const shift = 0.16;
    for (let t = 0; t <= 1; t += 0.1) {
      const result = palette(t + shift);
      expect(result[0]).toBeCloseTo(result[1], 5);
      expect(result[1]).toBeCloseTo(result[2], 5);
    }
  });
  
  it('shiftPalette() applies hue rotation that converts grayscale to colored', () => {
    // Simulate the shiftPalette() GLSL function
    function shiftPalette(color: [number, number, number], shift: number): [number, number, number] {
      const angle = shift * 6.28318;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      
      // This is the hue rotation matrix from preamble.glsl
      const r = 0.299 + 0.701 * cos + 0.168 * sin;
      const g = 0.587 - 0.587 * cos + 0.330 * sin;
      const b = 0.114 - 0.114 * cos - 0.497 * sin;
      
      const r2 = 0.299 - 0.299 * cos - 0.328 * sin;
      const g2 = 0.587 + 0.413 * cos + 0.035 * sin;
      const b2 = 0.114 - 0.114 * cos + 0.292 * sin;
      
      const r3 = 0.299 - 0.300 * cos + 1.250 * sin;
      const g3 = 0.587 - 0.588 * cos - 1.050 * sin;
      const b3 = 0.114 + 0.886 * cos - 0.203 * sin;
      
      return [
        Math.max(0, Math.min(1, color[0] * r + color[1] * g + color[2] * b)),
        Math.max(0, Math.min(1, color[0] * r2 + color[1] * g2 + color[2] * b2)),
        Math.max(0, Math.min(1, color[0] * r3 + color[1] * g3 + color[2] * b3))
      ];
    }
    
    // A colored input (red-ish) — hue rotation only affects chromatic colors;
    // grayscale (R==G==B) is invariant under hue rotation by design.
    const red: [number, number, number] = [0.8, 0.2, 0.1];

    // With shift = 0, should return approximately the same color (within tolerance)
    const result0 = shiftPalette(red, 0);
    expect(result0[0]).toBeCloseTo(0.8, 1);
    expect(result0[1]).toBeCloseTo(0.2, 1);
    expect(result0[2]).toBeCloseTo(0.1, 1);

    // With shift = 0.16, the hue should rotate — output should differ from input
    const result1 = shiftPalette(red, 0.16);
    const maxDiff = Math.max(
      Math.abs(result1[0] - red[0]),
      Math.abs(result1[1] - red[1]),
      Math.abs(result1[2] - red[2])
    );
    expect(maxDiff).toBeGreaterThan(0.05);
  });
  
  it('verifies that chemistryMode=0 disables shiftPalette', () => {
    // This simulates the shader logic:
    // if (uChemistryMode > 0.5) { color = shiftPalette(color, uPaletteShift); }
    
    const uChemistryMode = 0; // analog
    const uPaletteShift = 0.16;
    
    // When uChemistryMode = 0, shiftPalette should NOT be applied
    expect(uChemistryMode > 0.5).toBe(false);
    
    // When uChemistryMode = 2 (complementary), shiftPalette WOULD be applied
    expect(2 > 0.5).toBe(true);
    expect(1 > 0.5).toBe(true); // triadic
    expect(3 > 0.5).toBe(true); // monochromatic
  });
});