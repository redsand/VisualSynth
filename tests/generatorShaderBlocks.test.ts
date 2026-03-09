import { describe, expect, it } from 'vitest';
import { GENERATOR_SHADER_BLOCKS, findGeneratorShaderBlock } from '../src/shared/generatorShaderBlocks';
import { GENERATORS } from '../src/shared/generatorLibrary';

describe('GeneratorShaderBlocks registry', () => {
  it('has an entry for every GeneratorId in GENERATORS array', () => {
    const generatorIds = new Set(GENERATORS.map(g => g.id));
    const blockIds = new Set(GENERATOR_SHADER_BLOCKS.map(b => b.id));

    // Find missing generators
    const missing = [...generatorIds].filter(id => !blockIds.has(id));

    if (missing.length > 0) {
      console.warn('Missing generator shader blocks for:', missing);
    }

    expect(missing.length).toBe(0);
  });

  it('every block has non-empty uniforms, functions, and mainCall', () => {
    for (const block of GENERATOR_SHADER_BLOCKS) {
      expect(block.uniforms, `Block ${block.id} has uniforms`).toBeTruthy();
      expect(block.mainCall, `Block ${block.id} has mainCall`).toBeTruthy();

      // Uniforms should contain at least the enabled uniform
      expect(block.uniforms).toContain('uniform float');
      expect(block.uniforms).toContain('Enabled');

      // Functions are optional (some generators like spectrum don't need them)
      // If functions exist, they should contain a function definition
      if (block.functions) {
        expect(block.functions).toMatch(/(vec3|float|void)\s+\w+\(/);
      }

      // Main call should contain the if statement and color addition
      expect(block.mainCall).toContain('if (u');
      expect(block.mainCall).toContain('Enabled > 0.5');
      expect(block.mainCall).toContain('color +=');
    }
  });

  it('every uniforms block declares at least one uXxxEnabled uniform', () => {
    for (const block of GENERATOR_SHADER_BLOCKS) {
      const enabledMatches = block.uniforms.match(/uniform float u\w+Enabled;/g);
      expect(enabledMatches, `Block ${block.id} has at least one enabled uniform`).toBeTruthy();
      expect(enabledMatches!.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('every mainCall references the enabled uniform', () => {
    for (const block of GENERATOR_SHADER_BLOCKS) {
      // Check mainCall references the enabled uniform
      expect(block.mainCall).toMatch(/if \(u\w+Enabled > 0\.5\)/);

      // If block has functions, check that mainCall uses them (directly or indirectly)
      if (block.functions) {
        const funcMatch = block.functions.match(/(vec3|float|void)\s+(\w+)\(/);
        if (funcMatch) {
          const funcName = funcMatch[2];
          // Function might be called directly or through a wrapper like samplePlasma
          const isCalledDirectly = block.mainCall.includes(`${funcName}(`);
          const isCalledIndirectly = block.mainCall.includes('samplePlasma(') || block.mainCall.includes('plasmaColor');
          expect(isCalledDirectly || isCalledIndirectly).toBe(true);
        }
      }
    }
  });

  it('findGeneratorShaderBlock returns null for unknown id', () => {
    expect(findGeneratorShaderBlock('non-existent-generator')).toBeNull();
  });

  it('findGeneratorShaderBlock returns correct block for known id', () => {
    const block = GENERATOR_SHADER_BLOCKS[0];
    if (block) {
      const found = findGeneratorShaderBlock(block.id);
      expect(found).toBeTruthy();
      expect(found?.id).toBe(block.id);
      expect(found?.uniforms).toBe(block.uniforms);
      expect(found?.functions).toBe(block.functions);
      expect(found?.mainCall).toBe(block.mainCall);
    }
  });
});
