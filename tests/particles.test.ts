import { describe, expect, it } from 'vitest';
import { particleFieldGenerator } from '../src/shared/fxCatalog';
import { createNodeInstance } from '../src/shared/renderGraph';

describe('Particle Field Generator', () => {
  it('should have new parameters in the definition', () => {
    const turbulence = particleFieldGenerator.parameters.find(p => p.id === 'turbulence');
    const audioLift = particleFieldGenerator.parameters.find(p => p.id === 'audioLift');
    
    expect(turbulence).toBeDefined();
    expect(audioLift).toBeDefined();
  });

  it('should create instance with new parameters', () => {
    const instance = createNodeInstance(particleFieldGenerator);
    expect(instance.parameterValues['turbulence']).toBe(0.3);
    expect(instance.parameterValues['audioLift']).toBe(0.5);
  });

  it('should support modulation of turbulence', () => {
    const mod = particleFieldGenerator.modulationTargets.find(m => m.parameterId === 'turbulence');
    expect(mod).toBeDefined();
  });
});
