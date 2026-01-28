import { describe, expect, it } from 'vitest';
import { plasmaGenerator } from '../src/shared/fxCatalog';
import { createNodeInstance } from '../src/shared/renderGraph';

describe('Plasma Generator', () => {
  it('should have new parameters in the definition', () => {
    const complexity = plasmaGenerator.parameters.find(p => p.id === 'complexity');
    const audioReact = plasmaGenerator.parameters.find(p => p.id === 'audioReact');
    
    expect(complexity).toBeDefined();
    expect(audioReact).toBeDefined();
    expect(complexity?.defaultValue).toBe(3.0);
  });

  it('should create instance with new parameters', () => {
    const instance = createNodeInstance(plasmaGenerator);
    expect(instance.parameterValues['complexity']).toBe(3.0);
    expect(instance.parameterValues['audioReact']).toBe(0.5);
  });

  it('should support modulation of complexity', () => {
    const mod = plasmaGenerator.modulationTargets.find(m => m.parameterId === 'complexity');
    expect(mod).toBeDefined();
  });
});
