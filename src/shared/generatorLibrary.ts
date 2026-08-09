export type GeneratorId =
  | 'layer-plasma'
  | 'gen-cellular-growth'
  | 'gen-bioluminescent-forest'
  | 'gen-crystalline-structures'
  | 'gen-liquid-metal'
  | 'gen-neon-cityscape'
  | 'gen-cosmic-aurora'
  | 'gen-sonic-rain'
  | 'gen-morphing-geometry'
  | 'gen-urban-rhythm'
  | 'gen-crimson-veil'
  | 'gen-victorian-crypt'
  | 'gen-spectral-apparition'
  | 'gen-gothic-cobwebs'
  | 'gen-blood-moon-rise'
  | 'gen-candlelight-vigil'
  | 'gen-gargoyles-awake'
  | 'gen-crypt-shadows'
  | 'gen-gothic-rose'
  | 'gen-eternal-darkness'
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
  | 'gen-nebula-cloud'
  | 'gen-circuit-board'
  | 'gen-lorenz-attractor'
  | 'gen-mandala-spinner'
  | 'gen-starburst-galaxy'
  | 'gen-digital-rain-v2'
  | 'gen-lava-flow'
  | 'gen-crystal-growth'
  | 'gen-techno-grid'
  | 'gen-magnetic-field'
  | 'gen-prism-shards'
  | 'gen-neural-net'
  | 'gen-aurora-chord'
  | 'gen-vhs-glitch'
  | 'gen-moire-pattern'
  | 'gen-hypercube'
  | 'gen-fluid-swirl'
  | 'gen-ascii-stream'
  | 'gen-retro-wave'
  | 'gen-bubble-pop'
  | 'gen-sound-wave-3d'
  | 'gen-particle-vortex'
  | 'gen-glow-worms'
  | 'gen-mirror-maze'
  | 'gen-pulse-heart'
  | 'gen-data-shards'
  | 'gen-hex-cell'
  | 'gen-plasma-ball'
  | 'gen-warp-drive'
  | 'gen-visual-feedback'
  | 'gen-mycelium-growth'
  | 'gen-laser-beam'
  | 'gen-strobe'
  | 'gen-shape-burst'
  | 'gen-grid-tunnel'
  | 'gen-cellular-growth'
  | 'gen-bio-luminescent-forest'
  | 'gen-crystalline'
  | 'gen-audio-dna'
  | 'gen-liquid-metal'
  | 'gen-neon-cityscape'
  | 'gen-cosmic-nebula'
  | 'gen-sonic-rain'
  | 'gen-morphing-geometry'
  | 'gen-urban-rhythm'
  | 'gen-crimson-veil'
  | 'gen-victorian-crypt'
  | 'gen-spectral-apparition'
  | 'gen-gothic-cobwebs'
  | 'gen-blood-moon-rise'
  | 'gen-candlelight-vigil'
  | 'gen-gargoyles-awake'
  | 'gen-crypt-shadows'
  | 'gen-gothic-rose'
  | 'gen-eternal-darkness'
  | 'gen-pixel-dust'
  | 'gen-retro-starfield'
  | 'gen-8bit-grid'
  | 'gen-arcade-invaders'
  | 'gen-power-up-pulse'
  | 'gen-dungeon-tiles'
  | 'gen-chiptune-wave'
  | 'gen-score-counter'
  | 'gen-pixel-rain'
  | 'gen-boss-health'
  | 'gen-milkwave'
  | 'viz-off'
  | 'viz-spectrum'
  | 'viz-waveform'
  | 'viz-oscilloscope'
  // FX effect IDs (src/shared/fxCatalog.ts). These are real selectable IDs:
  // the quick-add handlers (index.ts / LayerPanel) compare against them to
  // boost the matching effect, and RenderGraph uses them as effect-layer IDs
  // (scene.layers.find(layer => layer.id === 'fx-bloom')). The union
  // previously omitted them, so every `id === 'fx-*'` comparison failed to
  // type-check (TS2367: no overlap with GeneratorId).
  | 'fx-bloom'
  | 'fx-blur'
  | 'fx-chroma'
  | 'fx-posterize'
  | 'fx-kaleidoscope'
  | 'fx-feedback'
  | 'fx-trails'
  | 'fx-color'
  | 'fx-glitch'
  | 'fx-vignette'
  | 'fx-grain'
  | 'gen-asset-vortex'
  | 'gen-asset-slices'
  | 'gen-asset-polar'
  | 'gen-asset-mosaic'
  | 'gen-asset-ripple'
  | 'gen-asset-scatter'
  | 'gen-asset-echo'
  | 'gen-voronoi-tessellation'
  | 'gen-choropleth-wave'
  | 'gen-sankey-flow'
  | 'gen-scatter-plot'
  | 'gen-radial-bar'
  | 'gen-reaction-diffusion'
  | 'gen-penrose-tiling'
  | 'gen-strange-attractor'
  | 'gen-l-system'
  | 'gen-raymarch-terrain'
  | 'gen-spirograph'
  | 'gen-uv-feedback'
  | 'gen-droste-effect'
  | 'gen-equalizer-matrix'
  | 'gen-metaball'
  | 'gen-interference-pattern'
  | 'gen-terrain-hypsometric'
  | 'gen-phyllotaxis'
  | 'gen-deep-ocean'
  | 'gen-holographic-prism'
  | 'gen-boids'
  | 'gen-flow-field'
  | 'gen-stained-glass'
  | 'gen-hillshade'
  | 'gen-truchet-tiles'
  | 'gen-spectrogram'
  | 'gen-crosshatch'
  | 'gen-shatter'
  | 'gen-seigaiha'
  | 'gen-sierpinski'
  | 'gen-orbital'
  | 'gen-conic-gradient'
  | 'gen-barcode'
  | 'gen-ferrofluid'
  | 'gen-halftone'
  | 'gen-pixel-sort'
  | 'gen-ripple-pond'
  | 'gen-hex-grid'
  | 'gen-woven'
  | 'gen-chromatic-aberr'
  | 'gen-solar-flare'
  | 'gen-clockwork'
  | 'gen-god-rays'
  | 'gen-dust-storm'
  | 'gen-constellation'
  | 'gen-mandelbrot'
  | 'gen-whirlpool'
  | 'gen-firework'
  | 'gen-crystal-cave'
  | 'gen-volcano';

export interface GeneratorEntry {
  id: GeneratorId;
  name: string;
  visible?: boolean;
  supportsAsset?: boolean;
  inputRequired?: boolean;
}

export const GENERATORS: GeneratorEntry[] = [
  { id: 'layer-plasma', name: 'Shader Plasma', supportsAsset: true, inputRequired: true },
  { id: 'layer-spectrum', name: 'Spectrum Bars', supportsAsset: true, inputRequired: true },
  { id: 'layer-origami', name: 'Origami Fold' },
  { id: 'layer-glyph', name: 'Glyph Language' },
  { id: 'layer-crystal', name: 'Crystal Harmonics' },
  { id: 'layer-inkflow', name: 'Ink Flow' },
  { id: 'layer-topo', name: 'Topo Terrain' },
  { id: 'layer-weather', name: 'Audio Weather' },
  { id: 'layer-portal', name: 'Wormhole Portal' },
  { id: 'layer-media', name: 'Media Overlay', supportsAsset: true, inputRequired: true },
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
  { id: 'gen-signal-noise', name: 'Generator: Signal Noise', supportsAsset: true, inputRequired: true },
  { id: 'gen-infinite-wormhole', name: 'Generator: Infinite Wormhole' },
  { id: 'gen-ribbon-tunnel', name: 'Generator: Ribbon Tunnel' },
  { id: 'gen-fractal-tunnel', name: 'Generator: Fractal Tunnel' },
  { id: 'gen-circuit-conduit', name: 'Generator: Circuit Conduit' },
  { id: 'gen-aura-portal', name: 'Generator: Aura Portal' },
  { id: 'gen-freq-terrain', name: 'Generator: Frequency Terrain' },
  { id: 'gen-data-stream', name: 'Generator: Data Stream' },
  { id: 'gen-caustic-liquid', name: 'Generator: Caustic Liquid' },
  { id: 'gen-shimmer-veil', name: 'Generator: Shimmer Veil' },
  { id: 'gen-nebula-cloud', name: 'Generator: Nebula Cloud' },
  { id: 'gen-circuit-board', name: 'Generator: Circuit Board' },
  { id: 'gen-lorenz-attractor', name: 'Generator: Lorenz Attractor' },
  { id: 'gen-mandala-spinner', name: 'Generator: Mandala Spinner' },
  { id: 'gen-starburst-galaxy', name: 'Generator: Starburst Galaxy' },
  { id: 'gen-digital-rain-v2', name: 'Generator: Digital Rain V2' },
  { id: 'gen-lava-flow', name: 'Generator: Lava Flow' },
  { id: 'gen-crystal-growth', name: 'Generator: Crystal Growth' },
  { id: 'gen-techno-grid', name: 'Generator: Techno Grid' },
  { id: 'gen-magnetic-field', name: 'Generator: Magnetic Field' },
  { id: 'gen-prism-shards', name: 'Generator: Prism Shards' },
  { id: 'gen-neural-net', name: 'Generator: Neural Net' },
  { id: 'gen-aurora-chord', name: 'Generator: Aurora Chord' },
  { id: 'gen-vhs-glitch', name: 'Generator: VHS Glitch' },
  { id: 'gen-moire-pattern', name: 'Generator: Moire Pattern' },
  { id: 'gen-hypercube', name: 'Generator: Hypercube' },
  { id: 'gen-fluid-swirl', name: 'Generator: Fluid Swirl' },
  { id: 'gen-ascii-stream', name: 'Generator: ASCII Stream' },
  { id: 'gen-retro-wave', name: 'Generator: Retro Wave' },
  { id: 'gen-bubble-pop', name: 'Generator: Bubble Pop' },
  { id: 'gen-sound-wave-3d', name: 'Generator: Sound Wave 3D' },
  { id: 'gen-particle-vortex', name: 'Generator: Particle Vortex' },
  { id: 'gen-glow-worms', name: 'Generator: Glow Worms' },
  { id: 'gen-mirror-maze', name: 'Generator: Mirror Maze' },
  { id: 'gen-pulse-heart', name: 'Generator: Pulse Heart' },
  { id: 'gen-data-shards', name: 'Generator: Data Shards' },
  { id: 'gen-hex-cell', name: 'Generator: Hex Cell' },
  { id: 'gen-plasma-ball', name: 'Generator: Plasma Ball' },
  { id: 'gen-warp-drive', name: 'Generator: Warp Drive' },
  { id: 'gen-visual-feedback', name: 'Generator: Visual Feedback' },
  { id: 'gen-mycelium-growth', name: 'Generator: Mycelium Growth' },
  { id: 'gen-laser-beam', name: 'Generator: Laser Beam' },
  { id: 'gen-strobe', name: 'Generator: Strobe Flash' },
  { id: 'gen-shape-burst', name: 'Generator: Shape Burst' },
  { id: 'gen-grid-tunnel', name: 'Generator: Grid Tunnel' },
  { id: 'viz-off', name: 'Visualizer: Off' },
  { id: 'viz-spectrum', name: 'Visualizer: Spectrum' },
  { id: 'viz-waveform', name: 'Visualizer: Waveform' },
  { id: 'viz-oscilloscope', name: 'Visualizer: Oscilloscope' },
  { id: 'gen-cellular-growth', name: 'Generator: Cellular Growth' },
  { id: 'gen-bio-luminescent-forest', name: 'Generator: Bio-Luminescent Forest' },
  { id: 'gen-crystalline', name: 'Generator: Crystalline' },
  { id: 'gen-audio-dna', name: 'Generator: Audio DNA' },
  { id: 'gen-liquid-metal', name: 'Generator: Liquid Metal' },
  { id: 'gen-neon-cityscape', name: 'Generator: Neon Cityscape' },
  { id: 'gen-cosmic-nebula', name: 'Generator: Cosmic Nebula' },
  { id: 'gen-sonic-rain', name: 'Generator: Sonic Rain' },
  { id: 'gen-morphing-geometry', name: 'Generator: Morphing Geometry' },
  { id: 'gen-urban-rhythm', name: 'Generator: Urban Rhythm' },
  { id: 'gen-crimson-veil', name: 'Generator: Crimson Veil' },
  { id: 'gen-victorian-crypt', name: 'Generator: Victorian Crypt' },
  { id: 'gen-spectral-apparition', name: 'Generator: Spectral Apparition' },
  { id: 'gen-gothic-cobwebs', name: 'Generator: Gothic Cobwebs' },
  { id: 'gen-blood-moon-rise', name: 'Generator: Blood Moon Rise' },
  { id: 'gen-candlelight-vigil', name: 'Generator: Candlelight Vigil' },
  { id: 'gen-gargoyles-awake', name: 'Generator: Gargoyles Awake' },
  { id: 'gen-crypt-shadows', name: 'Generator: Crypt Shadows' },
  { id: 'gen-gothic-rose', name: 'Generator: Gothic Rose' },
  { id: 'gen-eternal-darkness', name: 'Generator: Eternal Darkness' },
  { id: 'gen-pixel-dust', name: 'Generator: Pixel Dust' },
  { id: 'gen-retro-starfield', name: 'Generator: Retro Starfield' },
  { id: 'gen-8bit-grid', name: 'Generator: 8-Bit Grid' },
  { id: 'gen-arcade-invaders', name: 'Generator: Arcade Invaders' },
  { id: 'gen-power-up-pulse', name: 'Generator: Power-Up Pulse' },
  { id: 'gen-dungeon-tiles', name: 'Generator: Dungeon Tiles' },
  { id: 'gen-chiptune-wave', name: 'Generator: Chiptune Wave' },
  { id: 'gen-score-counter', name: 'Generator: Score Counter' },
  { id: 'gen-pixel-rain', name: 'Generator: Pixel Rain' },
  { id: 'gen-boss-health', name: 'Generator: Boss Health' },
  { id: 'gen-asset-vortex', name: 'Asset Vortex', supportsAsset: true, inputRequired: true },
  { id: 'gen-asset-slices', name: 'Asset Slices', supportsAsset: true, inputRequired: true },
  { id: 'gen-asset-polar', name: 'Asset Polar Warp', supportsAsset: true, inputRequired: true },
  { id: 'gen-asset-mosaic', name: 'Asset Mosaic', supportsAsset: true, inputRequired: true },
  { id: 'gen-asset-ripple', name: 'Asset Ripples', supportsAsset: true, inputRequired: true },
  { id: 'gen-asset-scatter', name: 'Asset Scatter', supportsAsset: true, inputRequired: true },
  { id: 'gen-asset-echo', name: 'Asset Echo Ghosts', supportsAsset: true, inputRequired: true },
  { id: 'gen-milkwave', name: 'Generator: Milkwave Import', visible: false },
  { id: 'gen-voronoi-tessellation', name: 'Generator: Voronoi Tessellation' },
  { id: 'gen-choropleth-wave', name: 'Generator: Choropleth Wave' },
  { id: 'gen-sankey-flow', name: 'Generator: Sankey Flow' },
  { id: 'gen-scatter-plot', name: 'Generator: Scatter Plot' },
  { id: 'gen-radial-bar', name: 'Generator: Radial Bar' },
  { id: 'gen-reaction-diffusion', name: 'Generator: Reaction Diffusion' },
  { id: 'gen-penrose-tiling', name: 'Generator: Penrose Tiling' },
  { id: 'gen-strange-attractor', name: 'Generator: Strange Attractor' },
  { id: 'gen-l-system', name: 'Generator: L-System' },
  { id: 'gen-raymarch-terrain', name: 'Generator: Raymarch Terrain' },
  { id: 'gen-spirograph', name: 'Generator: Spirograph' },
  { id: 'gen-uv-feedback', name: 'Generator: UV Feedback' },
  { id: 'gen-droste-effect', name: 'Generator: Droste Effect' },
  { id: 'gen-equalizer-matrix', name: 'Generator: Equalizer Matrix' },
  { id: 'gen-metaball', name: 'Generator: Metaball' },
  { id: 'gen-interference-pattern', name: 'Generator: Interference Pattern' },
  { id: 'gen-terrain-hypsometric', name: 'Generator: Terrain Hypsometric' },
  { id: 'gen-phyllotaxis', name: 'Generator: Phyllotaxis' },
  { id: 'gen-deep-ocean', name: 'Generator: Deep Ocean' },
  { id: 'gen-holographic-prism', name: 'Generator: Holographic Prism' },
  { id: 'gen-boids', name: 'Generator: Boids' },
  { id: 'gen-flow-field', name: 'Generator: Flow Field' },
  { id: 'gen-stained-glass', name: 'Generator: Stained Glass' },
  { id: 'gen-hillshade', name: 'Generator: Hillshade' },
  { id: 'gen-truchet-tiles', name: 'Generator: Truchet Tiles' },
  { id: 'gen-spectrogram', name: 'Generator: Spectrogram' },
  { id: 'gen-crosshatch', name: 'Generator: Crosshatch' },
  { id: 'gen-shatter', name: 'Generator: Shatter' },
  { id: 'gen-seigaiha', name: 'Generator: Seigaiha' },
  { id: 'gen-sierpinski', name: 'Generator: Sierpinski' },
  { id: 'gen-orbital', name: 'Generator: Orbital' },
  { id: 'gen-conic-gradient', name: 'Generator: Conic Gradient' },
  { id: 'gen-barcode', name: 'Generator: Barcode' },
  { id: 'gen-ferrofluid', name: 'Generator: Ferrofluid' },
  { id: 'gen-halftone', name: 'Generator: Halftone' },
  { id: 'gen-pixel-sort', name: 'Generator: Pixel Sort' },
  { id: 'gen-ripple-pond', name: 'Generator: Ripple Pond' },
  { id: 'gen-hex-grid', name: 'Generator: Hex Grid' },
  { id: 'gen-woven', name: 'Generator: Woven' },
  { id: 'gen-chromatic-aberr', name: 'Generator: Chromatic Aberr' },
  { id: 'gen-solar-flare', name: 'Generator: Solar Flare' },
  { id: 'gen-clockwork', name: 'Generator: Clockwork' },
  { id: 'gen-god-rays', name: 'Generator: God Rays' },
  { id: 'gen-dust-storm', name: 'Generator: Dust Storm' },
  { id: 'gen-constellation', name: 'Generator: Constellation' },
  { id: 'gen-mandelbrot', name: 'Generator: Mandelbrot' },
  { id: 'gen-whirlpool', name: 'Generator: Whirlpool' },
  { id: 'gen-firework', name: 'Generator: Firework' },
  { id: 'gen-crystal-cave', name: 'Generator: Geode' },
  { id: 'gen-volcano', name: 'Generator: Volcano' }
];

export const isVisibleGeneratorEntry = (entry: GeneratorEntry) => entry.visible !== false;

export const getVisibleGenerators = () => GENERATORS.filter(isVisibleGeneratorEntry);

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

export const supportsAsset = (generatorId: string): boolean => {
  const entry = GENERATORS.find((g) => g.id === generatorId);
  return entry?.supportsAsset === true;
};

export const needsInput = (generatorId: string): boolean => {
  const entry = GENERATORS.find((g) => g.id === generatorId);
  return entry?.inputRequired === true;
};
