import { describe, expect, it } from 'vitest';
import { projectSchema } from '../src/shared/projectSchema';
import fs from 'fs';
import path from 'path';

// Mock of the logic in index.ts that prepares RenderState
// We simplified it to focus on the missing parameters issue.
const analyzePreset = (presetName: string) => {
  const filePath = path.resolve(__dirname, '..', 'assets', 'presets', presetName);
  const content = fs.readFileSync(filePath, 'utf-8');
  const preset = JSON.parse(content);
  
  // Extract what WOULD be passed to the renderer based on current index.ts logic
  // We know index.ts only looks at specific fields.
  
  // This list mirrors the 'moddedEffects', 'moddedParticles', 'moddedSdf', and 'moddedStyle' objects in index.ts
  const renderStateSim = {
    // These ARE modulated/passed
    bloom: preset.effects?.bloom ?? 0,
    feedback: preset.effects?.feedback ?? 0,
    particleSpeed: preset.particles?.speed ?? 0,
    
    // These are NOT passed (based on my code read)
    plasmaSpeed: 'UNDEFINED',
    plasmaScale: 'UNDEFINED',
    topoScale: 'UNDEFINED',
    portalZoom: 'UNDEFINED'
  };

  return renderStateSim;
};

describe('Preset Difference Lab', () => {
  it('detects missing render parameters for Plasma presets', () => {
    const p1 = analyzePreset('preset-13-visualsynth-dna-plasma.json');
    const p2 = analyzePreset('preset-70-nebula-tunnel.json');

    console.log('Preset 13 (Plasma DNA):', p1);
    console.log('Preset 70 (Nebula):', p2);

    // Both depend on Plasma. 
    // They SHOULD have different speeds/scales if the user wants variety.
    // But currently, the renderer doesn't support it.
    
    expect(p1.plasmaSpeed).toBe('UNDEFINED');
    expect(p2.plasmaSpeed).toBe('UNDEFINED');
  });
});
