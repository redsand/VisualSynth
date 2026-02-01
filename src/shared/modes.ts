import { ColorPalette, SceneTransition, COLOR_PALETTES } from './project';

export type MotionTemplate = 'linear' | 'radial' | 'vortex' | 'fractal' | 'grid' | 'organic' | 'data' | 'strobe';
export type TransitionType = 'fade' | 'crossfade' | 'warp' | 'glitch';

export interface AudioMappingDefault {
  source: string;
  target: string;
  amount: number;
}

export interface VisualMode {
  id: string;
  name: string;
  description: string;
  motionTemplate: MotionTemplate;
  palette: ColorPalette;
  audioMappings: AudioMappingDefault[];
  intensityEnvelopes: {
    attack: number;
    release: number;
  };
  glowDepth: {
    glow: number;
    depth: number;
  };
  transition: SceneTransition & { type: TransitionType };
}

export const VISUAL_MODES: VisualMode[] = [
  {
    id: 'mode-cosmic',
    name: 'Cosmic',
    description: 'Deep space ambient with slow orbital motion.',
    motionTemplate: 'radial',
    palette: COLOR_PALETTES.find(p => p.id === 'ocean') || COLOR_PALETTES[1],
    audioMappings: [
      { source: 'audio.rms', target: 'layer-plasma.speed', amount: 0.3 },
      { source: 'audio.peak', target: 'effects.bloom', amount: 0.4 }
    ],
    intensityEnvelopes: { attack: 0.2, release: 0.8 },
    glowDepth: { glow: 0.6, depth: 0.8 },
    transition: { durationMs: 2000, curve: 'easeInOut', type: 'crossfade' }
  },
  {
    id: 'mode-ignite',
    name: 'Ignite',
    description: 'High-energy rhythmic vortex for techno and house.',
    motionTemplate: 'vortex',
    palette: COLOR_PALETTES.find(p => p.id === 'heat') || COLOR_PALETTES[0],
    audioMappings: [
      { source: 'audio.peak', target: 'layer-plasma.opacity', amount: 0.8 },
      { source: 'audio.strobe', target: 'effects.chroma', amount: 0.5 }
    ],
    intensityEnvelopes: { attack: 0.05, release: 0.2 },
    glowDepth: { glow: 0.8, depth: 0.4 },
    transition: { durationMs: 400, curve: 'linear', type: 'warp' }
  },
  {
    id: 'mode-minimal',
    name: 'Minimal',
    description: 'Clean geometric grid with subtle reactivity.',
    motionTemplate: 'grid',
    palette: COLOR_PALETTES.find(p => p.id === 'grayscale') || COLOR_PALETTES[5],
    audioMappings: [
      { source: 'audio.rms', target: 'sdf.scale', amount: 0.2 }
    ],
    intensityEnvelopes: { attack: 0.1, release: 0.4 },
    glowDepth: { glow: 0.2, depth: 0.2 },
    transition: { durationMs: 800, curve: 'easeInOut', type: 'fade' }
  },
  {
    id: 'mode-acid',
    name: 'Acid',
    description: 'Fractal distortion and vibrant shifting palettes.',
    motionTemplate: 'fractal',
    palette: COLOR_PALETTES.find(p => p.id === 'synthwave') || COLOR_PALETTES[3],
    audioMappings: [
      { source: 'audio.rms', target: 'style.paletteShift', amount: 1.0 },
      { source: 'audio.peak', target: 'effects.feedback', amount: 0.6 }
    ],
    intensityEnvelopes: { attack: 0.1, release: 0.1 },
    glowDepth: { glow: 0.5, depth: 0.6 },
    transition: { durationMs: 600, curve: 'easeInOut', type: 'warp' }
  },
  {
    id: 'mode-neural',
    name: 'Neural',
    description: 'Generative growth patterns inspired by biological networks.',
    motionTemplate: 'organic',
    palette: COLOR_PALETTES.find(p => p.id === 'forest') || COLOR_PALETTES[2],
    audioMappings: [
      { source: 'audio.rms', target: 'layer-inkflow.speed', amount: 0.4 },
      { source: 'audio.peak', target: 'layer-crystal.scale', amount: 0.5 }
    ],
    intensityEnvelopes: { attack: 0.3, release: 0.6 },
    glowDepth: { glow: 0.4, depth: 0.7 },
    transition: { durationMs: 1500, curve: 'easeInOut', type: 'crossfade' }
  },
  {
    id: 'mode-pulse',
    name: 'Pulse',
    description: 'Stroboscopic energy flashes for intense rhythmic segments.',
    motionTemplate: 'strobe',
    palette: COLOR_PALETTES.find(p => p.id === 'industrial') || COLOR_PALETTES[4],
    audioMappings: [
      { source: 'audio.strobe', target: 'effects.posterize', amount: 0.9 },
      { source: 'audio.peak', target: 'effects.bloom', amount: 1.0 }
    ],
    intensityEnvelopes: { attack: 0.01, release: 0.1 },
    glowDepth: { glow: 1.0, depth: 0.1 },
    transition: { durationMs: 200, curve: 'linear', type: 'glitch' }
  },
  {
    id: 'mode-liquid',
    name: 'Liquid',
    description: 'Fluid ink dynamics with smooth, flowing transitions.',
    motionTemplate: 'organic',
    palette: COLOR_PALETTES.find(p => p.id === 'ocean') || COLOR_PALETTES[1],
    audioMappings: [
      { source: 'audio.rms', target: 'layer-inkflow.opacity', amount: 0.7 },
      { source: 'audio.peak', target: 'effects.blur', amount: 0.3 }
    ],
    intensityEnvelopes: { attack: 0.5, release: 1.2 },
    glowDepth: { glow: 0.3, depth: 0.9 },
    transition: { durationMs: 2500, curve: 'easeInOut', type: 'fade' }
  },
  {
    id: 'mode-cyber',
    name: 'Cyber',
    description: 'Wireframe terrain and data-driven glitch aesthetics.',
    motionTemplate: 'data',
    palette: COLOR_PALETTES.find(p => p.id === 'synthwave') || COLOR_PALETTES[3],
    audioMappings: [
      { source: 'audio.rms', target: 'layer-topo.elevation', amount: 0.6 },
      { source: 'audio.peak', target: 'effects.chroma', amount: 0.8 }
    ],
    intensityEnvelopes: { attack: 0.05, release: 0.3 },
    glowDepth: { glow: 0.7, depth: 0.5 },
    transition: { durationMs: 500, curve: 'linear', type: 'glitch' }
  }
];
