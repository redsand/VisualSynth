import { describe, expect, it, vi } from 'vitest';
import { buildUniformLookup, collectActiveUniformLookup, hasUniform } from '../src/renderer/uniformIntrospection';

describe('uniformIntrospection', () => {
  it('adds base-name aliases for GLSL array uniforms', () => {
    const lookup = buildUniformLookup(['uSpectrum[0]', 'uTime']);

    expect(hasUniform(lookup, 'uSpectrum[0]')).toBe(true);
    expect(hasUniform(lookup, 'uSpectrum')).toBe(true);
    expect(hasUniform(lookup, 'uTime')).toBe(true);
    expect(hasUniform(lookup, 'uMissing')).toBe(false);
  });

  it('collects active uniforms from a linked program', () => {
    const gl = {
      ACTIVE_UNIFORMS: 0x8b86,
      getProgramParameter: vi.fn().mockReturnValue(3),
      getActiveUniform: vi
        .fn()
        .mockReturnValueOnce({ name: 'uSpectrum[0]' })
        .mockReturnValueOnce({ name: 'uPalette[0]' })
        .mockReturnValueOnce({ name: 'uBloom' })
    };

    const lookup = collectActiveUniformLookup(gl as any, {} as WebGLProgram);

    expect(gl.getProgramParameter).toHaveBeenCalledOnce();
    expect(gl.getActiveUniform).toHaveBeenCalledTimes(3);
    expect([...lookup].sort()).toEqual(['uBloom', 'uPalette', 'uPalette[0]', 'uSpectrum', 'uSpectrum[0]']);
  });
});
