export type GeneratorId =
  | 'layer-plasma'
  | 'layer-spectrum'
  | 'layer-origami'
  | 'layer-glyph'
  | 'layer-crystal'
  | 'layer-inkflow'
  | 'layer-topo'
  | 'layer-weather'
  | 'layer-portal'
  | 'layer-oscillo'
  | 'gen-particles'
  | 'gen-sdf'
  | 'viz-off'
  | 'viz-spectrum'
  | 'viz-waveform'
  | 'viz-oscilloscope'
  | 'fx-bloom'
  | 'fx-feedback'
  | 'fx-kaleidoscope'
  | 'fx-chroma'
  | 'fx-posterize'
  | 'fx-blur'
  | 'fx-trails';

export interface GeneratorEntry {
  id: GeneratorId;
  name: string;
}

export const GENERATORS: GeneratorEntry[] = [
  { id: 'layer-plasma', name: 'Shader Plasma' },
  { id: 'layer-spectrum', name: 'Spectrum Bars' },
  { id: 'layer-origami', name: 'Origami Fold' },
  { id: 'layer-glyph', name: 'Glyph Language' },
  { id: 'layer-crystal', name: 'Crystal Harmonics' },
  { id: 'layer-inkflow', name: 'Ink Flow' },
  { id: 'layer-topo', name: 'Topo Terrain' },
  { id: 'layer-weather', name: 'Audio Weather' },
  { id: 'layer-portal', name: 'Wormhole Portal' },
  { id: 'layer-oscillo', name: 'Sacred Oscilloscope' },
  { id: 'gen-particles', name: 'Particle Field' },
  { id: 'gen-sdf', name: 'SDF Shapes (Simple)' },
  { id: 'gen-sdf-scene', name: 'SDF Scene (Advanced)' },
  { id: 'viz-off', name: 'Visualizer: Off' },
  { id: 'viz-spectrum', name: 'Visualizer: Spectrum' },
  { id: 'viz-waveform', name: 'Visualizer: Waveform' },
  { id: 'viz-oscilloscope', name: 'Visualizer: Oscilloscope' },
  { id: 'fx-bloom', name: 'Effect: Bloom' },
  { id: 'fx-feedback', name: 'Effect: Feedback Tunnel' },
  { id: 'fx-kaleidoscope', name: 'Effect: Kaleidoscope' },
  { id: 'fx-chroma', name: 'Effect: Chromatic Aberration' },
  { id: 'fx-posterize', name: 'Effect: Posterize' },
  { id: 'fx-blur', name: 'Effect: Blur' },
  { id: 'fx-trails', name: 'Effect: Trails' }
];

export const updateRecents = (recents: GeneratorId[], next: GeneratorId, limit = 5) => {
  const filtered = recents.filter((item) => item !== next);
  const updated = [next, ...filtered];
  return updated.slice(0, limit);
};

export const toggleFavorite = (favorites: GeneratorId[], id: GeneratorId) => {
  if (favorites.includes(id)) {
    return favorites.filter((item) => item !== id);
  }
  return [...favorites, id];
};
