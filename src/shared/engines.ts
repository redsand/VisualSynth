import { LayerConfig, SceneLook, ColorPalette, COLOR_PALETTES } from './project';

export type EngineId =
  | 'engine-none'
  | 'engine-radial-core'
  | 'engine-particle-flow'
  | 'engine-kaleido-pulse'
  | 'engine-vapor-grid';

export interface EngineMacro {
  id: string;
  name: string;
  defaultValue: number;
  description: string;
  target: string;
}

export interface VisualEngine {
  id: EngineId;
  name: string;
  description: string;
  curatedPalette: ColorPalette;
  // Audio Interpretation
  semantics: {
    kick: string;   // Internal routing for low-end energy (e.g. "sdf.scale.contract")
    mids: string;   // Internal routing for melodic/harmonic content
    highs: string;  // Internal routing for rhythmic detail
  };
  // Motion Grammar
  grammar: {
    mass: number;       // Inertia (0.1 to 1.0)
    friction: number;   // Motion decay (0.8 to 0.99)
    elasticity: number; // Audio response curve
  };
  // Visual Constraints
  constraints: {
    maxBloom: number;
    forceFeedback: boolean;
    preferredMotion: string;
    lockSymmetry?: number;
  };
  // Engine-specific Post-Process
  finish: {
    grain: number;
    vignette: number;
    ca: number; // Chromatic Aberration
  };
  macros: EngineMacro[];
  baseLayers: LayerConfig[];
}

export const ENGINE_REGISTRY: Record<EngineId, VisualEngine> = {
  'engine-none': {
    id: 'engine-none',
    name: 'None (Keep Current Layers)',
    description: 'Leaves existing layers and macros untouched.',
    curatedPalette: COLOR_PALETTES[0],
    semantics: {
      kick: 'none',
      mids: 'none',
      highs: 'none'
    },
    grammar: {
      mass: 0.5,
      friction: 0.95,
      elasticity: 1.0
    },
    constraints: {
      maxBloom: 1.0,
      forceFeedback: false,
      preferredMotion: 'linear'
    },
    finish: {
      grain: 0.0,
      vignette: 0.0,
      ca: 0.0
    },
    macros: [],
    baseLayers: []
  },
  'engine-radial-core': {
    id: 'engine-radial-core',
    name: 'Radial Energy Core',
    description: 'Focal gravity system. Kick causes compression; Mids drive torque.',
    curatedPalette: COLOR_PALETTES.find(p => p.id === 'heat') || COLOR_PALETTES[0],
    semantics: {
      kick: 'sdf.scale.contract',
      mids: 'layer-plasma.speed.torque',
      highs: 'effects.bloom.jitter'
    },
    grammar: {
      mass: 0.8,
      friction: 0.92,
      elasticity: 1.2
    },
    constraints: {
      maxBloom: 1.0,
      forceFeedback: false,
      preferredMotion: 'radial'
    },
    finish: {
      grain: 0.2,
      vignette: 1.2,
      ca: 0.4
    },
    macros: [
      { id: 'rad-energy', name: 'Energy', defaultValue: 0.75, description: 'Core intensity', target: 'layer-plasma.opacity' },
      { id: 'rad-gravity', name: 'Gravity', defaultValue: 0.55, description: 'Radial pull', target: 'sdf.scale' },
      { id: 'rad-torque', name: 'Torque', defaultValue: 0.45, description: 'Rotational speed', target: 'layer-plasma.speed' },
      { id: 'rad-aura', name: 'Aura', defaultValue: 0.85, description: 'Bloom release', target: 'effects.bloom' },
      { id: 'rad-density', name: 'Density', defaultValue: 0.65, description: 'Plasma complexity', target: 'layer-plasma.complexity' }
    ],
    baseLayers: [
      {
        id: 'layer-plasma',
        name: 'Energy Plasma',
        role: 'core',
        enabled: true,
        opacity: 0.9,
        blendMode: 'screen',
        transform: { x: 0, y: 0, scale: 1.8, rotation: 0 },
        params: { speed: 1.4, scale: 1.2, complexity: 0.85 }
      }
    ]
  },
  'engine-particle-flow': {
    id: 'engine-particle-flow',
    name: 'Particle Flow Field',
    description: 'Mass-based particle system. Motion decays with momentum.',
    curatedPalette: COLOR_PALETTES.find(p => p.id === 'ocean') || COLOR_PALETTES[1],
    semantics: {
      kick: 'particles.speed.thrust',
      mids: 'particles.turbulence.bend',
      highs: 'particles.density.burst'
    },
    grammar: {
      mass: 0.4,
      friction: 0.98,
      elasticity: 0.5
    },
    constraints: {
      maxBloom: 0.4,
      forceFeedback: true,
      preferredMotion: 'organic'
    },
    finish: {
      grain: 0.4,
      vignette: 0.8,
      ca: 0.2
    },
    macros: [
      { id: 'part-flow', name: 'Flow', defaultValue: 0.8, description: 'Global velocity', target: 'particles.speed' },
      { id: 'part-mass', name: 'Mass', defaultValue: 0.65, description: 'Inertia/Drag', target: 'particles.turbulence' },
      { id: 'part-echo', name: 'Echo', defaultValue: 0.75, description: 'Trail persistence', target: 'effects.persistence' },
      { id: 'part-density', name: 'Density', defaultValue: 0.55, description: 'Particle count', target: 'particles.density' },
      { id: 'part-drift', name: 'Drift', defaultValue: 0.45, description: 'Horizontal bias', target: 'layer-inkflow.speed' }
    ],
    baseLayers: [
      {
        id: 'layer-inkflow',
        name: 'Flow Map',
        role: 'core',
        enabled: true,
        opacity: 0.65,
        blendMode: 'multiply',
        transform: { x: 0, y: 0, scale: 1.2, rotation: 0 }
      }
    ]
  },
  'engine-kaleido-pulse': {
    id: 'engine-kaleido-pulse',
    name: 'Kaleidoscopic Pulse',
    description: 'Symmetry-locked rhythmic system. No scale spam.',
    curatedPalette: COLOR_PALETTES.find(p => p.id === 'synthwave') || COLOR_PALETTES[3],
    semantics: {
      kick: 'effects.kaleidoscope.phase',
      mids: 'layer-spectrum.opacity.pulse',
      highs: 'style.paletteShift.step'
    },
    grammar: {
      mass: 1.0,
      friction: 0.85,
      elasticity: 2.0
    },
    constraints: {
      maxBloom: 0.6,
      forceFeedback: false,
      preferredMotion: 'grid',
      lockSymmetry: 6
    },
    finish: {
      grain: 0.1,
      vignette: 1.0,
      ca: 0.3
    },
    macros: [
      { id: 'kal-mirrors', name: 'Symmetry', defaultValue: 0.65, description: 'Mirror count', target: 'effects.kaleidoscope' },
      { id: 'kal-rhythm', name: 'Rhythm', defaultValue: 0.9, description: 'Audio pulse', target: 'layer-spectrum.opacity' },
      { id: 'kal-shift', name: 'Phase Shift', defaultValue: 0.35, description: 'Mirror rotation', target: 'effects.kaleidoscopeRotation' },
      { id: 'kal-prism', name: 'Prism', defaultValue: 0.55, description: 'Harmonic color shift', target: 'style.paletteShift' },
      { id: 'kal-strobe', name: 'Strobe', defaultValue: 0.1, description: 'Rhythmic glitch', target: 'effects.posterize' }
    ],
    baseLayers: [
      {
        id: 'layer-spectrum',
        name: 'Rhythmic Bars',
        role: 'core',
        enabled: true,
        opacity: 1.0,
        blendMode: 'add',
        transform: { x: 0, y: 0, scale: 1.5, rotation: 0 }
      }
    ]
  },
  'engine-vapor-grid': {
    id: 'engine-vapor-grid',
    name: 'Vapor Grid Shift',
    description: 'Perspective-warped retro system.',
    curatedPalette: COLOR_PALETTES.find(p => p.id === 'synthwave') || COLOR_PALETTES[3],
    semantics: {
      kick: 'layer-topo.elevation.bounce',
      mids: 'effects.chroma.jitter',
      highs: 'layer-topo.opacity.flicker'
    },
    grammar: {
      mass: 0.9,
      friction: 0.95,
      elasticity: 0.3
    },
    constraints: {
      maxBloom: 0.5,
      forceFeedback: false,
      preferredMotion: 'vapor'
    },
    finish: {
      grain: 0.35,
      vignette: 1.1,
      ca: 0.8
    },
    macros: [
      { id: 'vap-depth', name: 'Depth', defaultValue: 0.6, description: 'Perspective warp', target: 'layer-topo.scale' },
      { id: 'vap-speed', name: 'Scroll', defaultValue: 0.4, description: 'Grid velocity', target: 'layer-topo.elevation' },
      { id: 'vap-glow', name: 'Retro Glow', defaultValue: 0.7, description: 'Bloom intensity', target: 'effects.bloom' },
      { id: 'vap-vhs', name: 'VHS Jitter', defaultValue: 0.5, description: 'Chromatic aberration', target: 'effects.chroma' },
      { id: 'vap-grid', name: 'Grid', defaultValue: 0.5, description: 'Density', target: 'layer-topo.opacity' }
    ],
    baseLayers: [
      {
        id: 'layer-topo',
        name: 'Perspective Grid',
        role: 'core',
        enabled: true,
        opacity: 0.9,
        blendMode: 'screen',
        transform: { x: 0, y: 0, scale: 1.8, rotation: 0 },
        params: { scale: 1.2, elevation: 0.6 }
      }
    ]
  }
};
