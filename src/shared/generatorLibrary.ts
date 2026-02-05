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
  | 'layer-media'
  | 'layer-oscillo'
  | 'variant-plasma-vortex'
  | 'variant-plasma-liquid'
  | 'variant-spectrum-neon'
  | 'variant-origami-canyon'
  | 'variant-glyph-orbit'
  | 'variant-crystal-fracture'
  | 'variant-ink-neon'
  | 'variant-topo-rift'
  | 'variant-weather-stormcells'
  | 'variant-portal-echo'
  | 'gen-audio-geometry'
  | 'variant-audio-geometry-prism'
  | 'gen-organic-fluid'
  | 'variant-organic-fluid-ink'
  | 'gen-neon-wireframe'
  | 'variant-neon-wireframe-grid'
  | 'gen-glitch-datamosh'
  | 'variant-glitch-datamosh-hard'
  | 'gen-particle-swarm'
  | 'variant-particle-swarm-bloom'
  | 'gen-typography-reveal'
  | 'variant-typography-reveal-glow'
  | 'gen-kaleido-shard'
  | 'variant-kaleido-shard-iris'
  | 'gen-radar-hud'
  | 'variant-radar-hud-deep'
  | 'gen-fractal-bloom'
  | 'variant-fractal-bloom-ember'
  | 'gen-vhs-scanline'
  | 'variant-vhs-scanline-warp'
  | 'gen-tunnel-warp'
  | 'variant-tunnel-warp-spiral'
  | 'gen-wormhole-core'
  | 'variant-wormhole-core-echo'
  | 'gen-nebula-drift'
  | 'variant-nebula-drift-cold'
  | 'gen-particles'
  | 'gen-sdf'
  | 'gen-sdf-scene'
  | 'gen-lightning'
  | 'gen-analog-oscillo'
  | 'gen-speaker-cone'
  | 'gen-glitch-scanline'
  | 'gen-laser-starfield'
  | 'gen-pulsing-ribbons'
  | 'gen-electric-arc'
  | 'gen-pyro-burst'
  | 'gen-geo-wireframe'
  | 'gen-signal-noise'
  | 'gen-infinite-wormhole'
  | 'gen-ribbon-tunnel'
  | 'gen-fractal-tunnel'
  | 'gen-circuit-conduit'
  | 'gen-aura-portal'
  | 'gen-freq-terrain'
  | 'gen-data-stream'
  | 'gen-caustic-liquid'
  | 'gen-shimmer-veil'
  | 'gen-laser-beam'
  | 'gen-strobe'
  | 'gen-shape-burst'
  | 'gen-grid-tunnel'
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
  { id: 'layer-media', name: 'Media Overlay' },
  { id: 'layer-oscillo', name: 'Sacred Oscilloscope' },
  { id: 'variant-plasma-vortex', name: 'Plasma: Vortex' },
  { id: 'variant-plasma-liquid', name: 'Plasma: Liquid Metal' },
  { id: 'variant-spectrum-neon', name: 'Spectrum: Neon Bars' },
  { id: 'variant-origami-canyon', name: 'Origami: Canyon Fold' },
  { id: 'variant-glyph-orbit', name: 'Glyph: Orbit Field' },
  { id: 'variant-crystal-fracture', name: 'Crystal: Fracture Bloom' },
  { id: 'variant-ink-neon', name: 'Ink: Neon Flow' },
  { id: 'variant-topo-rift', name: 'Topo: Rift Lines' },
  { id: 'variant-weather-stormcells', name: 'Weather: Storm Cells' },
  { id: 'variant-portal-echo', name: 'Portal: Echo Rings' },
  { id: 'gen-audio-geometry', name: 'Generator: Audio Geometry' },
  { id: 'variant-audio-geometry-prism', name: 'Generator: Audio Geometry (Prism)' },
  { id: 'gen-organic-fluid', name: 'Generator: Organic Fluid' },
  { id: 'variant-organic-fluid-ink', name: 'Generator: Organic Fluid (Ink)' },
  { id: 'gen-neon-wireframe', name: 'Generator: Neon Wireframe' },
  { id: 'variant-neon-wireframe-grid', name: 'Generator: Neon Wireframe (Grid)' },
  { id: 'gen-glitch-datamosh', name: 'Generator: Glitch Datamosh' },
  { id: 'variant-glitch-datamosh-hard', name: 'Generator: Glitch Datamosh (Hard)' },
  { id: 'gen-particle-swarm', name: 'Generator: Particle Swarm' },
  { id: 'variant-particle-swarm-bloom', name: 'Generator: Particle Swarm (Bloom)' },
  { id: 'gen-typography-reveal', name: 'Generator: Typography Reveal' },
  { id: 'variant-typography-reveal-glow', name: 'Generator: Typography Reveal (Glow)' },
  { id: 'gen-kaleido-shard', name: 'Generator: Kaleido Shards' },
  { id: 'variant-kaleido-shard-iris', name: 'Generator: Kaleido Shards (Iris)' },
  { id: 'gen-radar-hud', name: 'Generator: Radar HUD' },
  { id: 'variant-radar-hud-deep', name: 'Generator: Radar HUD (Deep)' },
  { id: 'gen-fractal-bloom', name: 'Generator: Fractal Bloom' },
  { id: 'variant-fractal-bloom-ember', name: 'Generator: Fractal Bloom (Ember)' },
  { id: 'gen-vhs-scanline', name: 'Generator: VHS Scanline' },
  { id: 'variant-vhs-scanline-warp', name: 'Generator: VHS Scanline (Warp)' },
  { id: 'gen-tunnel-warp', name: 'Generator: Tunnel Warp' },
  { id: 'variant-tunnel-warp-spiral', name: 'Generator: Tunnel Warp (Spiral)' },
  { id: 'gen-wormhole-core', name: 'Generator: Wormhole Core' },
  { id: 'variant-wormhole-core-echo', name: 'Generator: Wormhole Core (Echo)' },
  { id: 'gen-nebula-drift', name: 'Generator: Nebula Drift' },
  { id: 'variant-nebula-drift-cold', name: 'Generator: Nebula Drift (Cold)' },
  { id: 'gen-particles', name: 'Particle Field' },
  { id: 'gen-sdf', name: 'SDF Shapes (Simple)' },
  { id: 'gen-sdf-scene', name: 'SDF Scene (Advanced)' },
  { id: 'gen-lightning', name: 'Generator: Lightning Bolt' },
  { id: 'gen-analog-oscillo', name: 'Generator: Analog Oscilloscope' },
  { id: 'gen-speaker-cone', name: 'Generator: Speaker Cone' },
  { id: 'gen-glitch-scanline', name: 'Generator: Glitch Scanline' },
  { id: 'gen-laser-starfield', name: 'Generator: Laser Starfield' },
  { id: 'gen-pulsing-ribbons', name: 'Generator: Pulsing Ribbons' },
  { id: 'gen-electric-arc', name: 'Generator: Electric Arc' },
  { id: 'gen-pyro-burst', name: 'Generator: Pyro Burst' },
  { id: 'gen-geo-wireframe', name: 'Generator: Geo Wireframe' },
  { id: 'gen-signal-noise', name: 'Generator: Signal Noise' },
  { id: 'gen-infinite-wormhole', name: 'Generator: Infinite Wormhole' },
  { id: 'gen-ribbon-tunnel', name: 'Generator: Ribbon Tunnel' },
  { id: 'gen-fractal-tunnel', name: 'Generator: Fractal Tunnel' },
  { id: 'gen-circuit-conduit', name: 'Generator: Circuit Conduit' },
  { id: 'gen-aura-portal', name: 'Generator: Aura Portal' },
  { id: 'gen-freq-terrain', name: 'Generator: Frequency Terrain' },
  { id: 'gen-data-stream', name: 'Generator: Data Stream' },
  { id: 'gen-caustic-liquid', name: 'Generator: Caustic Liquid' },
  { id: 'gen-shimmer-veil', name: 'Generator: Shimmer Veil' },
  { id: 'gen-laser-beam', name: 'Generator: Laser Beam' },
  { id: 'gen-strobe', name: 'Generator: Strobe Flash' },
  { id: 'gen-shape-burst', name: 'Generator: Shape Burst' },
  { id: 'gen-grid-tunnel', name: 'Generator: Grid Tunnel' },
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
