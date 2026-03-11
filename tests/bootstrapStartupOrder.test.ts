import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '..');
const bootstrapPath = path.join(repoRoot, 'src', 'renderer', 'bootstrap.ts');

describe('bootstrap startup order', () => {
  it('keeps critical runtime initialization sequencing', () => {
    const source = fs.readFileSync(bootstrapPath, 'utf-8');

    const phase3 = source.indexOf('Phase 3: Loading persisted configuration');
    const outputInit = source.indexOf('await initializeOutputSession(window.visualSynth', phase3);
    const phase4 = source.indexOf('Phase 4: Initializing audio and MIDI');
    const audioInit = source.indexOf('audioEngine.initModulators();', phase4);
    const phase5 = source.indexOf('Phase 5: Checking for recovery project');
    const startupSelection = source.indexOf(
      'await selectStartupProject(window.visualSynth, localStorage)',
      phase5
    );
    const phase6 = source.indexOf('Phase 6: Starting render loop');
    const renderStart = source.indexOf('renderer.start();', phase6);

    expect(phase3).toBeGreaterThan(-1);
    expect(outputInit).toBeGreaterThan(phase3);
    expect(phase4).toBeGreaterThan(outputInit);
    expect(audioInit).toBeGreaterThan(phase4);
    expect(phase5).toBeGreaterThan(audioInit);
    expect(startupSelection).toBeGreaterThan(phase5);
    expect(phase6).toBeGreaterThan(startupSelection);
    expect(renderStart).toBeGreaterThan(phase6);
  });
});
