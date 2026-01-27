import { applyModMatrix } from '../../shared/modMatrix';
import type { Store } from '../state/store';
import type { RenderState } from '../glRenderer';

export interface LayerDebugInfo {
  id: string;
  name: string;
  enabled: boolean;
  opacity: number;
  blendMode: string;
  fboSize: string;
  lastRenderedFrameId: number;
  nonEmpty: boolean;
}

export interface FxDebugInfo {
  id: string;
  enabled: boolean;
  bypassed: boolean;
  lastAppliedFrameId: number;
}

export interface RenderDebugState {
  frameId: number;
  activeSceneName: string;
  layerCount: number;
  layers: LayerDebugInfo[];
  fx: FxDebugInfo[];
  masterBusFrameId: number;
  uniformsUpdatedFrameId: number;
}

type FxId = 'bloom' | 'blur' | 'chroma' | 'posterize' | 'kaleidoscope' | 'feedback' | 'persistence';

export class RenderGraph {
  private trailSpectrum = new Float32Array(64);
  private gravityWells = Array.from({ length: 8 }, () => ({
    x: 0,
    y: 0,
    baseX: 0,
    baseY: 0,
    strength: 0,
    polarity: 1,
    active: false,
    phase: Math.random() * Math.PI * 2
  }));
  private gravityPositions = new Float32Array(16);
  private gravityStrengths = new Float32Array(8);
  private gravityPolarities = new Float32Array(8);
  private gravityActives = new Float32Array(8);
  private gravityFixedSlots = [
    { x: -0.45, y: -0.35 },
    { x: 0.45, y: -0.35 },
    { x: -0.45, y: 0.35 },
    { x: 0.45, y: 0.35 },
    { x: 0, y: -0.5 },
    { x: 0, y: 0.5 },
    { x: -0.6, y: 0 },
    { x: 0.6, y: 0 }
  ];
  private portals = Array.from({ length: 4 }, () => ({
    x: 0,
    y: 0,
    radius: 0.2,
    active: false,
    phase: Math.random() * Math.PI * 2
  }));
  private portalPositions = new Float32Array(8);
  private portalRadii = new Float32Array(4);
  private portalActives = new Float32Array(4);
  private oscilloCapture = new Float32Array(256);
  private debugState: RenderDebugState = {
    frameId: 0,
    activeSceneName: '',
    layerCount: 0,
    layers: [],
    fx: [],
    masterBusFrameId: 0,
    uniformsUpdatedFrameId: 0
  };
  private fxDeltaUntil: Record<FxId, number> = {
    bloom: 0,
    blur: 0,
    chroma: 0,
    posterize: 0,
    kaleidoscope: 0,
    feedback: 0,
    persistence: 0
  };
  private debugTint = false;
  private debugFxDelta = false;

  constructor(private store: Store) {}

  getDebugState() {
    return this.debugState;
  }

  setDebugFlags(flags: { tintLayers: boolean; fxDelta: boolean }) {
    this.debugTint = flags.tintLayers;
    this.debugFxDelta = flags.fxDelta;
  }

  armFxDelta(id: FxId, now: number) {
    this.fxDeltaUntil[id] = now + 200;
  }

  handlePadAction(action: string, velocity: number) {
    const state = this.store.getState();
    const runtime = state.runtime;
    if (action.startsWith('origami-')) {
      const foldMap: Record<string, number> = {
        'origami-mountain': 0,
        'origami-valley': 1,
        'origami-collapse': 2,
        'origami-explode': 3
      };
      runtime.origamiFoldState = foldMap[action] ?? 0;
      runtime.origamiFoldSharpness = Math.min(1, Math.max(0.2, velocity));
      return;
    }
    if (action === 'gravity-spawn-fixed') {
      this.spawnGravityWell('fixed');
      return;
    }
    if (action === 'gravity-spawn-audio') {
      this.spawnGravityWell('audio');
      return;
    }
    if (action === 'gravity-destroy') {
      this.destroyGravityWell();
      return;
    }
    if (action === 'gravity-toggle-polarity') {
      this.flipGravityPolarity(true);
      return;
    }
    if (action === 'gravity-flip-last') {
      this.flipGravityPolarity(false);
      return;
    }
    if (action === 'gravity-collapse') {
      runtime.gravityCollapse = 1;
      return;
    }
    if (action === 'glyph-stack') {
      runtime.glyphMode = 0;
      runtime.glyphSeed = (runtime.glyphSeed + 11.1) % 1000;
      return;
    }
    if (action === 'glyph-orbit') {
      runtime.glyphMode = 1;
      runtime.glyphSeed = (runtime.glyphSeed + 17.7) % 1000;
      return;
    }
    if (action === 'glyph-explode') {
      runtime.glyphMode = 2;
      runtime.glyphSeed = (runtime.glyphSeed + 23.3) % 1000;
      return;
    }
    if (action === 'glyph-sentence') {
      runtime.glyphMode = 3;
      runtime.glyphSeed = (runtime.glyphSeed + 31.9) % 1000;
      return;
    }
    if (action === 'crystal-seed') {
      runtime.crystalMode = 0;
      runtime.crystalBrittleness = Math.min(1, Math.max(0.1, velocity));
      return;
    }
    if (action === 'crystal-grow') {
      runtime.crystalMode = 1;
      runtime.crystalBrittleness = Math.min(1, Math.max(0.1, velocity));
      return;
    }
    if (action === 'crystal-fracture') {
      runtime.crystalMode = 2;
      runtime.crystalBrittleness = Math.min(1, Math.max(0.1, velocity));
      return;
    }
    if (action === 'crystal-melt') {
      runtime.crystalMode = 3;
      runtime.crystalBrittleness = Math.min(1, Math.max(0.1, velocity));
      return;
    }
    if (action === 'ink-fine') {
      runtime.inkBrush = 0;
      runtime.inkPressure = Math.min(1, Math.max(0.2, velocity));
      return;
    }
    if (action === 'ink-dry') {
      runtime.inkBrush = 1;
      runtime.inkPressure = Math.min(1, Math.max(0.2, velocity));
      return;
    }
    if (action === 'ink-neon') {
      runtime.inkBrush = 2;
      runtime.inkPressure = Math.min(1, Math.max(0.2, velocity));
      return;
    }
    if (action === 'ink-lifespan') {
      runtime.inkLifespan = Math.min(1, Math.max(0.1, velocity));
      return;
    }
    if (action === 'ink-pressure') {
      runtime.inkPressure = Math.min(1, Math.max(0.1, velocity));
      return;
    }
    if (action === 'topo-quake') {
      runtime.topoQuake = Math.min(1, Math.max(0.2, velocity));
      return;
    }
    if (action === 'topo-landslide') {
      runtime.topoSlide = Math.min(1, Math.max(0.2, velocity));
      return;
    }
    if (action === 'topo-plate') {
      runtime.topoPlate = Math.min(1, Math.max(0.2, velocity));
      return;
    }
    if (action === 'weather-storm') {
      runtime.weatherMode = 0;
      runtime.weatherIntensity = Math.min(1, Math.max(0.2, velocity));
      return;
    }
    if (action === 'weather-fog') {
      runtime.weatherMode = 1;
      runtime.weatherIntensity = Math.min(1, Math.max(0.2, velocity));
      return;
    }
    if (action === 'weather-calm') {
      runtime.weatherMode = 2;
      runtime.weatherIntensity = Math.min(1, Math.max(0.2, velocity));
      return;
    }
    if (action === 'weather-hurricane') {
      runtime.weatherMode = 3;
      runtime.weatherIntensity = Math.min(1, Math.max(0.2, velocity));
      return;
    }
    if (action === 'portal-spawn') {
      this.spawnPortal();
      return;
    }
    if (action === 'portal-collapse') {
      this.collapsePortal();
      return;
    }
    if (action === 'portal-transition') {
      this.triggerPortalTransition();
      return;
    }
    if (action === 'oscillo-capture') {
      runtime.oscilloMode = (runtime.oscilloMode + 1) % 3;
      this.oscilloCapture.set(state.audio.waveform);
      return;
    }
    if (action === 'oscillo-freeze') {
      runtime.oscilloFreeze = runtime.oscilloFreeze > 0.5 ? 0 : 1;
      if (runtime.oscilloFreeze > 0.5) {
        this.oscilloCapture.set(state.audio.waveform);
      }
      return;
    }
    if (action === 'oscillo-rotate') {
      runtime.oscilloRotate = (runtime.oscilloRotate + 1) % 6;
      return;
    }
    if (action === 'strobe') {
      runtime.strobeIntensity = Math.max(runtime.strobeIntensity, velocity);
    }
  }

  private computeAudioCentroid() {
    const { spectrum, bands } = this.store.getState().audio;
    let sum = 0;
    let weighted = 0;
    for (let i = 0; i < spectrum.length; i += 1) {
      const value = spectrum[i];
      sum += value;
      weighted += value * i;
    }
    const index = sum > 0 ? weighted / sum : 0;
    const x = ((index / (spectrum.length - 1)) - 0.5) * 1.2;
    const bass = bands[0] ?? 0;
    const y = 0.45 - bass * 0.6;
    return { x: Math.min(0.7, Math.max(-0.7, x)), y: Math.min(0.7, Math.max(-0.7, y)) };
  }

  private spawnGravityWell(mode: 'fixed' | 'audio') {
    const state = this.store.getState();
    const runtime = state.runtime;
    const slotIndex = this.gravityWells.findIndex((well) => !well.active);
    const index = slotIndex === -1 ? 0 : slotIndex;
    const slot = this.gravityFixedSlots[runtime.gravityFixedIndex % this.gravityFixedSlots.length];
    const spawn = mode === 'audio' ? this.computeAudioCentroid() : slot;
    const bass = state.audio.bands[0] ?? 0;
    const strength = 0.35 + bass * 0.8;
    this.gravityWells[index] = {
      ...this.gravityWells[index],
      x: spawn.x,
      y: spawn.y,
      baseX: spawn.x,
      baseY: spawn.y,
      strength,
      polarity: runtime.gravityGlobalPolarity,
      active: true
    };
    runtime.gravityFixedIndex = (runtime.gravityFixedIndex + 1) % this.gravityFixedSlots.length;
    runtime.lastGravityIndex = index;
  }

  private destroyGravityWell() {
    const runtime = this.store.getState().runtime;
    if (runtime.lastGravityIndex >= 0 && this.gravityWells[runtime.lastGravityIndex]?.active) {
      this.gravityWells[runtime.lastGravityIndex].active = false;
      return;
    }
    const activeIndex = this.gravityWells.map((well, i) => (well.active ? i : -1)).filter((i) => i >= 0);
    if (activeIndex.length > 0) {
      this.gravityWells[activeIndex[activeIndex.length - 1]].active = false;
    }
  }

  private flipGravityPolarity(all = true) {
    const runtime = this.store.getState().runtime;
    if (all) {
      runtime.gravityGlobalPolarity *= -1;
      this.gravityWells.forEach((well) => {
        if (well.active) {
          well.polarity *= -1;
        }
      });
      return;
    }
    if (runtime.lastGravityIndex >= 0 && this.gravityWells[runtime.lastGravityIndex]?.active) {
      this.gravityWells[runtime.lastGravityIndex].polarity *= -1;
    }
  }

  private spawnPortal() {
    const state = this.store.getState();
    const index = this.portals.findIndex((portal) => !portal.active);
    const slot = index === -1 ? 0 : index;
    const x = (Math.random() - 0.5) * 1.2;
    const y = (Math.random() - 0.5) * 1.2;
    this.portals[slot] = {
      ...this.portals[slot],
      x,
      y,
      radius: 0.18 + (state.audio.bands[2] ?? 0) * 0.35,
      active: true,
      phase: Math.random() * Math.PI * 2
    };
  }

  private collapsePortal() {
    const activeIndex = this.portals.map((portal, i) => (portal.active ? i : -1)).filter((i) => i >= 0);
    if (activeIndex.length > 0) {
      this.portals[activeIndex[activeIndex.length - 1]].active = false;
    }
  }

  private triggerPortalTransition() {
    const runtime = this.store.getState().runtime;
    runtime.portalShift = 0.2 + (this.store.getState().audio.bands[4] ?? 0) * 0.4;
    runtime.portalSeed = (runtime.portalSeed + 17.3) % 1000;
  }

  private updateGravityWells(time: number, dt: number) {
    const state = this.store.getState();
    const runtime = state.runtime;
    runtime.gravityCollapse = Math.max(0, runtime.gravityCollapse - dt * 0.18);
    const bass = state.audio.bands[0] ?? 0;
    const mid = state.audio.bands[3] ?? 0;
    const orbitRate = 0.2 + mid * 0.6;
    this.gravityWells.forEach((well, index) => {
      if (!well.active) {
        this.gravityPositions[index * 2] = 0;
        this.gravityPositions[index * 2 + 1] = 0;
        this.gravityStrengths[index] = 0;
        this.gravityPolarities[index] = 0;
        this.gravityActives[index] = 0;
        return;
      }
      const angle = time * 0.00015 * orbitRate + well.phase;
      const orbitRadius = 0.05 + mid * 0.18;
      const targetX = well.baseX + Math.cos(angle) * orbitRadius;
      const targetY = well.baseY + Math.sin(angle * 1.1) * orbitRadius;
      const collapseMix = runtime.gravityCollapse * 0.85;
      well.x = well.x + (targetX - well.x) * 0.08;
      well.y = well.y + (targetY - well.y) * 0.08;
      if (collapseMix > 0) {
        well.x = well.x * (1 - collapseMix);
        well.y = well.y * (1 - collapseMix);
      }
      const strength = well.strength + bass * 0.45 + runtime.gravityCollapse * 0.6;
      this.gravityPositions[index * 2] = Math.min(0.9, Math.max(-0.9, well.x));
      this.gravityPositions[index * 2 + 1] = Math.min(0.9, Math.max(-0.9, well.y));
      this.gravityStrengths[index] = strength;
      this.gravityPolarities[index] = well.polarity;
      this.gravityActives[index] = 1;
    });
  }

  private updatePortals(time: number, dt: number) {
    const bands = this.store.getState().audio.bands;
    const base = bands[1] ?? 0;
    const harmonic = Math.abs((bands[2] ?? 0) - base * 0.66) + Math.abs((bands[3] ?? 0) - base * 0.5);
    const energy = Math.min(1, (bands[2] ?? 0) + (bands[3] ?? 0) + (bands[4] ?? 0));
    this.portals.forEach((portal, index) => {
      if (!portal.active) {
        this.portalPositions[index * 2] = 0;
        this.portalPositions[index * 2 + 1] = 0;
        this.portalRadii[index] = 0;
        this.portalActives[index] = 0;
        return;
      }
      const pulse = 0.02 * Math.sin(time * 0.001 + portal.phase) + energy * 0.08;
      portal.radius = Math.min(0.45, portal.radius + (pulse - portal.radius) * 0.02);
      this.portalPositions[index * 2] = portal.x;
      this.portalPositions[index * 2 + 1] = portal.y;
      this.portalRadii[index] = portal.radius * (0.8 + harmonic * 0.8);
      this.portalActives[index] = 1;
    });
  }

  private getModdedSdfScene(scene: any, modSources: any, modMatrix: any[]) {
    if (!scene) return undefined;
    
    // Deep clone the scene to avoid mutating the original project state
    const cloned = JSON.parse(JSON.stringify(scene));
    
    // Apply modulation to each node's parameters
    if (cloned.nodes) {
      cloned.nodes.forEach((node: any) => {
        if (!node.params) return;
        
        Object.keys(node.params).forEach(paramId => {
          const targetId = `${node.instanceId}.${paramId}`;
          const baseValue = node.params[paramId];
          
          // Only modulate numbers for now
          if (typeof baseValue === 'number') {
            node.params[paramId] = applyModMatrix(baseValue, targetId, modSources, modMatrix);
          }
        });
      });
    }
    
    return cloned;
  }

  buildRenderState(time: number, deltaMs: number, canvasSize: { width: number; height: number }): RenderState {
    const state = this.store.getState();
    const runtime = state.runtime;
    const deltaSeconds = deltaMs * 0.001;

    this.updateGravityWells(time, deltaSeconds);
    this.updatePortals(time, deltaSeconds);

    if (runtime.glyphBeatPulse > 0) {
      runtime.glyphBeatPulse = Math.max(0, runtime.glyphBeatPulse - deltaMs * 0.006);
    }
    runtime.portalShift = Math.max(0, runtime.portalShift - deltaMs * 0.0003);
    runtime.topoQuake = Math.max(0, runtime.topoQuake - deltaMs * 0.002);
    runtime.topoSlide = Math.max(0, runtime.topoSlide - deltaMs * 0.002);
    runtime.topoPlate = Math.max(0, runtime.topoPlate - deltaMs * 0.002);
    runtime.topoTravel += deltaMs * 0.0002;
    runtime.strobeIntensity *= runtime.strobeDecay;

    const activeStyle =
      state.project.stylePresets?.find((preset) => preset.id === state.project.activeStylePresetId) ?? null;
    const styleSettings = activeStyle?.settings ?? { contrast: 1, saturation: 1, paletteShift: 0 };
    const effects = state.project.effects ?? {
      enabled: true,
      bloom: 0.2,
      blur: 0,
      chroma: 0.1,
      posterize: 0,
      kaleidoscope: 0,
      feedback: 0,
      persistence: 0
    };
    const particles = state.project.particles ?? {
      enabled: true,
      density: 0.35,
      speed: 0.3,
      size: 0.45,
      glow: 0.6
    };
    const sdf = state.project.sdf ?? {
      enabled: true,
      shape: 'circle' as const,
      scale: 0.45,
      edge: 0.08,
      glow: 0.5,
      rotation: 0,
      fill: 0.35
    };

    const bpm = this.getActiveBpm();
    const modSources = this.buildModSources(bpm);
    const modValue = (target: string, base: number) =>
      applyModMatrix(base, target, modSources, state.project.modMatrix);

    const moddedStyle = {
      contrast: modValue('style.contrast', styleSettings.contrast),
      saturation: modValue('style.saturation', styleSettings.saturation),
      paletteShift: modValue('style.paletteShift', styleSettings.paletteShift + runtime.portalShift)
    };

    const fxDeltaNow = performance.now();
    const fxDelta = (id: FxId, base: number, boost: number) =>
      this.debugFxDelta && fxDeltaNow < this.fxDeltaUntil[id] ? Math.min(1, base + boost) : base;

    const moddedEffects = {
      bloom: fxDelta('bloom', modValue('effects.bloom', effects.bloom), 0.35),
      blur: fxDelta('blur', modValue('effects.blur', effects.blur), 0.35),
      chroma: fxDelta('chroma', modValue('effects.chroma', effects.chroma), 0.2),
      posterize: fxDelta('posterize', modValue('effects.posterize', effects.posterize), 0.35),
      kaleidoscope: fxDelta('kaleidoscope', modValue('effects.kaleidoscope', effects.kaleidoscope), 0.35),
      feedback: fxDelta('feedback', modValue('effects.feedback', effects.feedback), 0.35),
      persistence: fxDelta('persistence', modValue('effects.persistence', effects.persistence), 0.35)
    };

    const moddedParticles = {
      density: modValue('particles.density', particles.density),
      speed: modValue('particles.speed', particles.speed),
      size: modValue('particles.size', particles.size),
      glow: modValue('particles.glow', particles.glow)
    };

    const moddedSdf = {
      scale: modValue('sdf.scale', sdf.scale),
      edge: modValue('sdf.edge', sdf.edge),
      glow: modValue('sdf.glow', sdf.glow),
      rotation: modValue('sdf.rotation', sdf.rotation),
      fill: modValue('sdf.fill', sdf.fill)
    };

    if (moddedEffects.persistence > 0) {
      const decay = 0.85 + moddedEffects.persistence * 0.14;
      for (let i = 0; i < this.trailSpectrum.length; i += 1) {
        this.trailSpectrum[i] = Math.max(this.trailSpectrum[i] * decay, state.audio.spectrum[i]);
      }
    } else {
      this.trailSpectrum = new Float32Array(state.audio.spectrum);
    }

    const macroSum = state.project.macros.reduce(
      (acc, macro) => {
        macro.targets.forEach((target) => {
          acc[target.target] = (acc[target.target] ?? 0) + macro.value * target.amount;
        });
        return acc;
      },
      {} as Record<string, number>
    );

    const activeScene = state.project.scenes.find((scene) => scene.id === state.project.activeSceneId);
    const plasmaLayer = activeScene?.layers.find((layer) => layer.id === 'layer-plasma');
    const spectrumLayer = activeScene?.layers.find((layer) => layer.id === 'layer-spectrum');
    const origamiLayer = activeScene?.layers.find((layer) => layer.id === 'layer-origami');
    const glyphLayer = activeScene?.layers.find((layer) => layer.id === 'layer-glyph');
    const crystalLayer = activeScene?.layers.find((layer) => layer.id === 'layer-crystal');
    const inkLayer = activeScene?.layers.find((layer) => layer.id === 'layer-inkflow');
    const topoLayer = activeScene?.layers.find((layer) => layer.id === 'layer-topo');
    const weatherLayer = activeScene?.layers.find((layer) => layer.id === 'layer-weather');
    const portalLayer = activeScene?.layers.find((layer) => layer.id === 'layer-portal');
    const oscilloLayer = activeScene?.layers.find((layer) => layer.id === 'layer-oscillo');
    const advancedSdfLayer = activeScene?.layers.find((layer) => layer.id === 'gen-sdf-scene');
    const feedbackLayer = activeScene?.layers.find((layer) => layer.id === 'fx-feedback');
    const chromaLayer = activeScene?.layers.find((layer) => layer.id === 'fx-chroma');

    const plasmaOpacity = Math.min(
      1,
      Math.max(0, (plasmaLayer?.opacity ?? 1) * (1 + (macroSum['layer-plasma.opacity'] ?? 0)))
    );
    const spectrumOpacity = Math.min(
      1,
      Math.max(0, (spectrumLayer?.opacity ?? 1) * (1 + (macroSum['layer-spectrum.opacity'] ?? 0)))
    );
    const origamiOpacity = Math.min(
      1,
      Math.max(0, (origamiLayer?.opacity ?? 1) * (1 + (macroSum['layer-origami.opacity'] ?? 0)))
    );
    const glyphOpacity = Math.min(
      1,
      Math.max(0, (glyphLayer?.opacity ?? 1) * (1 + (macroSum['layer-glyph.opacity'] ?? 0)))
    );
    const crystalOpacity = Math.min(
      1,
      Math.max(0, (crystalLayer?.opacity ?? 1) * (1 + (macroSum['layer-crystal.opacity'] ?? 0)))
    );
    const inkOpacity = Math.min(
      1,
      Math.max(0, (inkLayer?.opacity ?? 1) * (1 + (macroSum['layer-inkflow.opacity'] ?? 0)))
    );
    const topoOpacity = Math.min(
      1,
      Math.max(0, (topoLayer?.opacity ?? 1) * (1 + (macroSum['layer-topo.opacity'] ?? 0)))
    );
    const weatherOpacity = Math.min(
      1,
      Math.max(0, (weatherLayer?.opacity ?? 1) * (1 + (macroSum['layer-weather.opacity'] ?? 0)))
    );
    const portalOpacity = Math.min(
      1,
      Math.max(0, (portalLayer?.opacity ?? 1) * (1 + (macroSum['layer-portal.opacity'] ?? 0)))
    );
    const oscilloOpacity = Math.min(
      1,
      Math.max(0, (oscilloLayer?.opacity ?? 1) * (1 + (macroSum['layer-oscillo.opacity'] ?? 0)))
    );

    const moddedPlasmaOpacity = modValue('layer-plasma.opacity', plasmaOpacity);
    const moddedSpectrumOpacity = modValue('layer-spectrum.opacity', spectrumOpacity);
    const moddedOrigamiOpacity = modValue('layer-origami.opacity', origamiOpacity);
    const moddedGlyphOpacity = modValue('layer-glyph.opacity', glyphOpacity);
    const moddedCrystalOpacity = modValue('layer-crystal.opacity', crystalOpacity);
    const moddedInkOpacity = modValue('layer-inkflow.opacity', inkOpacity);
    const moddedTopoOpacity = modValue('layer-topo.opacity', topoOpacity);
    const moddedWeatherOpacity = modValue('layer-weather.opacity', weatherOpacity);
    const moddedPortalOpacity = modValue('layer-portal.opacity', portalOpacity);
    const moddedOscilloOpacity = modValue('layer-oscillo.opacity', oscilloOpacity);

    // Feedback and Chroma can be layers or global.
    const baseFeedback = feedbackLayer ? feedbackLayer.opacity : effects.feedback;
    const moddedFeedback = modValue('fx-feedback.amount', modValue('effects.feedback', baseFeedback));
    const moddedFeedbackZoom = modValue('fx-feedback.zoom', 0.0);
    const moddedFeedbackRotation = modValue('fx-feedback.rotation', 0.0);

    const baseChroma = chromaLayer ? chromaLayer.opacity : effects.chroma;
    const moddedChromaValue = modValue('fx-chroma.amount', modValue('effects.chroma', baseChroma));

    const plasmaEnabled = plasmaLayer ? plasmaLayer.enabled : false;
    const spectrumEnabled = spectrumLayer ? spectrumLayer.enabled : false;
    const origamiEnabled = origamiLayer?.enabled ?? false;
    const glyphEnabled = glyphLayer?.enabled ?? false;
    const crystalEnabled = crystalLayer?.enabled ?? false;
    const inkEnabled = inkLayer?.enabled ?? false;
    const topoEnabled = topoLayer?.enabled ?? false;
    const weatherEnabled = weatherLayer?.enabled ?? false;
    const portalEnabled = portalLayer?.enabled ?? false;
    const oscilloEnabled = oscilloLayer?.enabled ?? false;
    const advancedSdfEnabled = advancedSdfLayer?.enabled ?? false;

    if (runtime.oscilloFreeze < 0.5) {
      this.oscilloCapture.set(state.audio.waveform);
    }

    const renderState: RenderState & { debugTint?: number } = {
      timeMs: state.transport.timeMs,
      rms: state.audio.rms,
      peak: state.audio.peak,
      strobe: runtime.strobeIntensity,
      plasmaEnabled,
      spectrumEnabled,
      origamiEnabled,
      glyphEnabled,
      crystalEnabled,
      inkEnabled,
      topoEnabled,
      weatherEnabled,
      portalEnabled,
      oscilloEnabled,
      spectrum: state.audio.spectrum,
      contrast: moddedStyle.contrast,
      saturation: moddedStyle.saturation,
      paletteShift: moddedStyle.paletteShift,
      plasmaOpacity: moddedPlasmaOpacity,
      spectrumOpacity: moddedSpectrumOpacity,
      origamiOpacity: moddedOrigamiOpacity,
      origamiFoldState: runtime.origamiFoldState,
      origamiFoldSharpness: runtime.origamiFoldSharpness,
      glyphOpacity: moddedGlyphOpacity,
      glyphMode: runtime.glyphMode,
      glyphSeed: runtime.glyphSeed,
      glyphBeat: runtime.glyphBeatPulse,
      crystalOpacity: moddedCrystalOpacity,
      crystalMode: runtime.crystalMode,
      crystalBrittleness: runtime.crystalBrittleness,
      inkOpacity: moddedInkOpacity,
      inkBrush: runtime.inkBrush,
      inkPressure: runtime.inkPressure,
      inkLifespan: runtime.inkLifespan,
      topoOpacity: moddedTopoOpacity,
      topoQuake: runtime.topoQuake,
      topoSlide: runtime.topoSlide,
      topoPlate: runtime.topoPlate,
      topoTravel: runtime.topoTravel,
      weatherOpacity: moddedWeatherOpacity,
      weatherMode: runtime.weatherMode,
      weatherIntensity: runtime.weatherIntensity,
      portalOpacity: moddedPortalOpacity,
      portalShift: runtime.portalShift,
      portalPositions: this.portalPositions,
      portalRadii: this.portalRadii,
      portalActives: this.portalActives,
      oscilloOpacity: moddedOscilloOpacity,
      oscilloMode: runtime.oscilloMode,
      oscilloFreeze: runtime.oscilloFreeze,
      oscilloRotate: runtime.oscilloRotate,
      oscilloData: this.oscilloCapture,
      plasmaAssetBlendMode: state.renderSettings.assetLayerBlendModes['layer-plasma'],
      plasmaAssetAudioReact: state.renderSettings.assetLayerAudioReact['layer-plasma'],
      spectrumAssetBlendMode: state.renderSettings.assetLayerBlendModes['layer-spectrum'],
      spectrumAssetAudioReact: state.renderSettings.assetLayerAudioReact['layer-spectrum'],
      effectsEnabled: effects.enabled,
      bloom: moddedEffects.bloom,
      blur: moddedEffects.blur,
      chroma: moddedChromaValue,
      posterize: moddedEffects.posterize,
      kaleidoscope: moddedEffects.kaleidoscope,
      feedback: moddedFeedback,
      feedbackZoom: moddedFeedbackZoom,
      feedbackRotation: moddedFeedbackRotation,
      persistence: moddedEffects.persistence,
      trailSpectrum: this.trailSpectrum,
      particlesEnabled: particles.enabled,
      particleDensity: moddedParticles.density,
      particleSpeed: moddedParticles.speed,
      particleSize: moddedParticles.size,
      particleGlow: moddedParticles.glow,
      sdfEnabled: advancedSdfEnabled || (activeScene ? false : sdf.enabled),
      sdfShape: sdf.shape === 'circle' ? 0 : sdf.shape === 'box' ? 1 : 2,
      sdfScale: moddedSdf.scale,
      sdfEdge: moddedSdf.edge,
      sdfGlow: moddedSdf.glow,
      sdfRotation: moddedSdf.rotation,
      sdfFill: moddedSdf.fill,
      sdfScene: this.getModdedSdfScene((advancedSdfLayer as any)?.sdfScene, modSources, state.project.modMatrix),
      gravityPositions: this.gravityPositions,
      gravityStrengths: this.gravityStrengths,
      gravityPolarities: this.gravityPolarities,
      gravityActives: this.gravityActives,
      gravityCollapse: runtime.gravityCollapse,
      debugTint: this.debugTint ? 1 : 0
    };

    this.updateDebug(activeScene, canvasSize, renderState);
    return renderState;
  }

  private updateDebug(
    activeScene: { name: string; layers: { id: string; name: string; enabled: boolean; opacity: number; blendMode: string }[] } | undefined,
    canvasSize: { width: number; height: number },
    renderState: RenderState
  ) {
    const frameId = this.debugState.frameId + 1;
    this.debugState.frameId = frameId;
    this.debugState.activeSceneName = activeScene?.name ?? '—';
    const fboSize = `${canvasSize.width}x${canvasSize.height}`;
    const layers = (activeScene?.layers ?? []).map((layer) => ({
      id: layer.id,
      name: layer.name,
      enabled: layer.enabled,
      opacity: layer.opacity,
      blendMode: layer.blendMode,
      fboSize,
      lastRenderedFrameId: layer.enabled ? frameId : this.debugState.layers.find((l) => l.id === layer.id)?.lastRenderedFrameId ?? 0,
      nonEmpty: layer.enabled && layer.opacity > 0.01
    }));
    this.debugState.layers = layers;
    this.debugState.layerCount = layers.length;

    const fx: FxDebugInfo[] = [
      { id: 'bloom', enabled: renderState.effectsEnabled && renderState.bloom > 0, bypassed: !renderState.effectsEnabled, lastAppliedFrameId: frameId },
      { id: 'blur', enabled: renderState.effectsEnabled && renderState.blur > 0, bypassed: !renderState.effectsEnabled, lastAppliedFrameId: frameId },
      { id: 'chroma', enabled: renderState.effectsEnabled && renderState.chroma > 0, bypassed: !renderState.effectsEnabled, lastAppliedFrameId: frameId },
      { id: 'posterize', enabled: renderState.effectsEnabled && renderState.posterize > 0, bypassed: !renderState.effectsEnabled, lastAppliedFrameId: frameId },
      { id: 'kaleidoscope', enabled: renderState.effectsEnabled && renderState.kaleidoscope > 0, bypassed: !renderState.effectsEnabled, lastAppliedFrameId: frameId },
      { id: 'feedback', enabled: renderState.effectsEnabled && renderState.feedback > 0, bypassed: !renderState.effectsEnabled, lastAppliedFrameId: frameId },
      { id: 'persistence', enabled: renderState.effectsEnabled && renderState.persistence > 0, bypassed: !renderState.effectsEnabled, lastAppliedFrameId: frameId }
    ];
    this.debugState.fx = fx;
    this.debugState.masterBusFrameId = frameId;
    this.debugState.uniformsUpdatedFrameId = frameId;
  }

  private buildModSources(bpm: number) {
    const state = this.store.getState();
    const bpmNormalized = Math.min(Math.max((bpm - 60) / 140, 0), 1);
    const lfoValues = state.project.lfos.map((lfo, index) =>
      this.lfoValueForShape(state.modulators.lfoPhases[index] ?? lfo.phase ?? 0, lfo.shape)
    );
    const envValues = state.modulators.envStates.map((env) => env.value);
    const shValues = state.modulators.shStates.map((sh) => sh.value);
    return {
      'audio.rms': state.audio.rms,
      'audio.peak': state.audio.peak,
      'audio.strobe': state.runtime.strobeIntensity,
      'tempo.bpm': bpmNormalized,
      'lfo-1': lfoValues[0] ?? 0,
      'lfo-2': lfoValues[1] ?? 0,
      'env-1': envValues[0] ?? 0,
      'env-2': envValues[1] ?? 0,
      'sh-1': shValues[0] ?? 0,
      'sh-2': shValues[1] ?? 0,
      'macro-1': state.project.macros[0]?.value ?? 0,
      'macro-2': state.project.macros[1]?.value ?? 0,
      'macro-3': state.project.macros[2]?.value ?? 0,
      'macro-4': state.project.macros[3]?.value ?? 0,
      'macro-5': state.project.macros[4]?.value ?? 0,
      'macro-6': state.project.macros[5]?.value ?? 0,
      'macro-7': state.project.macros[6]?.value ?? 0,
      'macro-8': state.project.macros[7]?.value ?? 0
    };
  }

  private lfoValueForShape(phase: number, shape: 'sine' | 'triangle' | 'saw' | 'square') {
    const wrapped = phase % 1;
    if (shape === 'sine') {
      return 0.5 + 0.5 * Math.sin(wrapped * Math.PI * 2);
    }
    if (shape === 'triangle') {
      return wrapped < 0.5 ? wrapped * 2 : 1 - (wrapped - 0.5) * 2;
    }
    if (shape === 'square') {
      return wrapped < 0.5 ? 1 : 0;
    }
    return wrapped;
  }

  private getActiveBpm() {
    const state = this.store.getState();
    if (state.bpm.source === 'network' && state.bpm.networkBpm) return state.bpm.networkBpm;
    if (state.bpm.source === 'auto' && state.bpm.autoBpm) return state.bpm.autoBpm;
    return state.bpm.manualBpm || 120;
  }
}
