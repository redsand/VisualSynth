import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createStore, createInitialState } from '../src/renderer/state/store';
import { RenderGraph } from '../src/renderer/render/RenderGraph';
import { deserializeProject, serializeProject } from '../src/shared/serialization';
import { DEFAULT_PROJECT } from '../src/shared/project';
import { createAudioEngine } from '../src/renderer/audio/AudioEngine';

describe('MVP Soak and Stress Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Long-session render stability (5,000 frames)', async () => {
    const store = createStore(createInitialState());
    const renderGraph = new RenderGraph(store);
    
    console.log('Starting long-session stability test (5,000 frames)...');
    
    for (let i = 0; i < 5000; i++) {
      // Simulate time moving forward
      const timeMs = i * 16.66;
      const renderState = renderGraph.buildRenderState(timeMs, 16.66, { width: 1920, height: 1080 });
      expect(renderState).toBeDefined();
      
      if (i % 1000 === 0) {
        const stats = renderGraph.getDebugStats();
        // Check for leaks (though difficult in JS without full GC control)
        // At least ensure texture/FBO counts don't grow indefinitely
        expect(stats.activeTextures).toBeLessThan(100);
        expect(stats.activeFramebuffers).toBeLessThan(50);
      }
    }
    console.log('Long-session stability test passed.');
  });

  it('Repeated project open/recover cycles (20 cycles)', () => {
    let currentProject = { ...DEFAULT_PROJECT, name: 'Initial' };
    
    console.log('Starting repeated project open/recover cycles (20 cycles)...');
    
    for (let i = 0; i < 20; i++) {
      const serialized = serializeProject(currentProject);
      const recovered = deserializeProject(serialized);
      
      expect(recovered.name).toBe(currentProject.name);
      
      // Mutate for next cycle to increase complexity
      currentProject = {
        ...recovered,
        name: `Project iteration ${i}`,
        scenes: [
          ...recovered.scenes, 
          { 
            id: `new-scene-${i}`, 
            name: `Scene ${i}`, 
            layers: [
              {
                id: `layer-${i}`,
                name: `Layer ${i}`,
                enabled: true,
                opacity: 1,
                blendMode: 'normal',
                role: 'core',
                transform: { x: 0, y: 0, scale: 1, rotation: 0 }
              }
            ] 
          }
        ]
      };
    }
    console.log('Project cycles test passed.');
  });

  it('Repeated audio detection start/stop (50 cycles)', () => {
    const store = createStore(createInitialState());
    const audioEngine = createAudioEngine(store);
    
    console.log('Starting repeated audio detection start/stop (50 cycles)...');
    
    for (let i = 0; i < 50; i++) {
      // Start
      audioEngine.updateNowPlayingSettings({ enabled: true });
      let diagnostics = audioEngine.getSongDetectionDiagnostics();
      expect(diagnostics.settings.enabled).toBe(true);
      
      // Stop
      audioEngine.updateNowPlayingSettings({ enabled: false });
      diagnostics = audioEngine.getSongDetectionDiagnostics();
      expect(diagnostics.settings.enabled).toBe(false);
    }
    console.log('Audio detection start/stop test passed.');
  });
});
