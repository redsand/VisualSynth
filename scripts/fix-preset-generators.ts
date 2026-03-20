import * as fs from 'fs';

interface LayerConfig {
  id: string;
  name: string;
  role?: string;
  enabled: boolean;
  opacity: number;
  blendMode: string;
  transform: { x: number; y: number; scale: number; rotation: number };
  params?: Record<string, any>;
  generatorId?: string;
}

interface SceneConfig {
  id: string;
  name: string;
  layers: LayerConfig[];
  assigned_layers?: { core: string[]; support: string[]; atmosphere: string[] };
}

interface Project {
  name: string;
  scenes: SceneConfig[];
}

const GENERATOR_MAPPINGS: Record<string, { layerId: string; layerName: string; role: string }> = {
  'gen-sdf': { layerId: 'gen-sdf', layerName: 'SDF Shapes', role: 'core' },
  'gen-sdf-scene': { layerId: 'gen-sdf-scene', layerName: 'SDF Scene', role: 'core' },
  'gen-lightning': { layerId: 'gen-lightning', layerName: 'Lightning', role: 'support' },
  'gen-particle-swarm': { layerId: 'gen-particle-swarm', layerName: 'Particle Swarm', role: 'support' },
  'gen-particle-vortex': { layerId: 'gen-particle-vortex', layerName: 'Particle Vortex', role: 'support' },
  'gen-particles': { layerId: 'gen-particles', layerName: 'Particles', role: 'support' },
  'gen-tunnel-warp': { layerId: 'gen-tunnel-warp', layerName: 'Tunnel Warp', role: 'core' },
  'gen-wormhole-core': { layerId: 'gen-wormhole-core', layerName: 'Wormhole', role: 'core' },
  'gen-infinite-wormhole': { layerId: 'gen-infinite-wormhole', layerName: 'Infinite Wormhole', role: 'core' },
  'gen-nebula-drift': { layerId: 'gen-nebula-drift', layerName: 'Nebula', role: 'support' },
  'gen-nebula-cloud': { layerId: 'gen-nebula-cloud', layerName: 'Nebula Cloud', role: 'support' },
  'gen-fractal-bloom': { layerId: 'gen-fractal-bloom', layerName: 'Fractal Bloom', role: 'core' },
  'gen-kaleido-shard': { layerId: 'gen-kaleido-shard', layerName: 'Kaleido Shard', role: 'support' },
  'gen-glitch-datamosh': { layerId: 'gen-glitch-datamosh', layerName: 'Glitch', role: 'support' },
  'gen-glitch-scanline': { layerId: 'gen-glitch-scanline', layerName: 'Glitch Scanline', role: 'support' },
  'gen-vhs-glitch': { layerId: 'gen-vhs-glitch', layerName: 'VHS Glitch', role: 'support' },
  'gen-vhs-scanline': { layerId: 'gen-vhs-scanline', layerName: 'VHS Scanline', role: 'support' },
  'gen-laser-starfield': { layerId: 'gen-laser-starfield', layerName: 'Laser Starfield', role: 'support' },
  'gen-laser-beam': { layerId: 'gen-laser-beam', layerName: 'Laser Beam', role: 'support' },
  'gen-electric-arc': { layerId: 'gen-electric-arc', layerName: 'Electric Arc', role: 'support' },
  'gen-pyro-burst': { layerId: 'gen-pyro-burst', layerName: 'Pyro Burst', role: 'support' },
  'gen-aura-portal': { layerId: 'gen-aura-portal', layerName: 'Aura Portal', role: 'core' },
  'gen-mandala-spinner': { layerId: 'gen-mandala-spinner', layerName: 'Mandala', role: 'core' },
  'gen-starburst-galaxy': { layerId: 'gen-starburst-galaxy', layerName: 'Starburst', role: 'support' },
  'gen-geo-wireframe': { layerId: 'gen-geo-wireframe', layerName: 'Geo Wireframe', role: 'support' },
  'gen-neon-wireframe': { layerId: 'gen-neon-wireframe', layerName: 'Neon Wireframe', role: 'support' },
  'gen-ribbon-tunnel': { layerId: 'gen-ribbon-tunnel', layerName: 'Ribbon Tunnel', role: 'core' },
  'gen-fractal-tunnel': { layerId: 'gen-fractal-tunnel', layerName: 'Fractal Tunnel', role: 'core' },
  'gen-hypercube': { layerId: 'gen-hypercube', layerName: 'Hypercube', role: 'core' },
  'gen-crystal-growth': { layerId: 'gen-crystal-growth', layerName: 'Crystal Growth', role: 'support' },
  'gen-fluid-swirl': { layerId: 'gen-fluid-swirl', layerName: 'Fluid Swirl', role: 'support' },
  'gen-caustic-liquid': { layerId: 'gen-caustic-liquid', layerName: 'Caustic Liquid', role: 'support' },
  'gen-organic-fluid': { layerId: 'gen-organic-fluid', layerName: 'Organic Fluid', role: 'core' },
  'gen-magnetic-field': { layerId: 'gen-magnetic-field', layerName: 'Magnetic Field', role: 'support' },
  'gen-lorenz-attractor': { layerId: 'gen-lorenz-attractor', layerName: 'Lorenz Attractor', role: 'core' },
  'gen-aurora-chord': { layerId: 'gen-aurora-chord', layerName: 'Aurora Chord', role: 'support' },
  'gen-cosmic-aurora': { layerId: 'gen-cosmic-aurora', layerName: 'Cosmic Aurora', role: 'support' },
  'gen-digital-rain-v2': { layerId: 'gen-digital-rain-v2', layerName: 'Digital Rain', role: 'support' },
  'gen-ascii-stream': { layerId: 'gen-ascii-stream', layerName: 'ASCII Stream', role: 'support' },
  'gen-data-stream': { layerId: 'gen-data-stream', layerName: 'Data Stream', role: 'support' },
  'gen-circuit-board': { layerId: 'gen-circuit-board', layerName: 'Circuit Board', role: 'support' },
  'gen-circuit-conduit': { layerId: 'gen-circuit-conduit', layerName: 'Circuit Conduit', role: 'support' },
  'gen-techno-grid': { layerId: 'gen-techno-grid', layerName: 'Techno Grid', role: 'support' },
  'gen-sound-wave-3d': { layerId: 'gen-sound-wave-3d', layerName: 'Sound Wave 3D', role: 'support' },
  'gen-analog-oscillo': { layerId: 'gen-analog-oscillo', layerName: 'Analog Oscillo', role: 'support' },
  'gen-speaker-cone': { layerId: 'gen-speaker-cone', layerName: 'Speaker Cone', role: 'support' },
  'gen-pulse-heart': { layerId: 'gen-pulse-heart', layerName: 'Pulse Heart', role: 'support' },
  'gen-bubble-pop': { layerId: 'gen-bubble-pop', layerName: 'Bubble Pop', role: 'support' },
  'gen-glow-worms': { layerId: 'gen-glow-worms', layerName: 'Glow Worms', role: 'support' },
  'gen-mycelium-growth': { layerId: 'gen-mycelium-growth', layerName: 'Mycelium', role: 'support' },
  'gen-plasma-ball': { layerId: 'gen-plasma-ball', layerName: 'Plasma Ball', role: 'core' },
  'gen-warp-drive': { layerId: 'gen-warp-drive', layerName: 'Warp Drive', role: 'core' },
  'gen-visual-feedback': { layerId: 'gen-visual-feedback', layerName: 'Visual Feedback', role: 'core' },
  'gen-strobe': { layerId: 'gen-strobe', layerName: 'Strobe', role: 'support' },
  'gen-shape-burst': { layerId: 'gen-shape-burst', layerName: 'Shape Burst', role: 'support' },
  'gen-lava-flow': { layerId: 'gen-lava-flow', layerName: 'Lava Flow', role: 'support' },
  'gen-prism-shards': { layerId: 'gen-prism-shards', layerName: 'Prism Shards', role: 'support' },
  'gen-mirror-maze': { layerId: 'gen-mirror-maze', layerName: 'Mirror Maze', role: 'core' },
  'gen-moire-pattern': { layerId: 'gen-moire-pattern', layerName: 'Moire Pattern', role: 'support' },
  'gen-neural-net': { layerId: 'gen-neural-net', layerName: 'Neural Net', role: 'support' },
  'gen-retro-wave': { layerId: 'gen-retro-wave', layerName: 'Retro Wave', role: 'core' },
  'gen-hex-cell': { layerId: 'gen-hex-cell', layerName: 'Hex Cell', role: 'support' },
  'gen-data-shards': { layerId: 'gen-data-shards', layerName: 'Data Shards', role: 'support' },
  'gen-typography-reveal': { layerId: 'gen-typography-reveal', layerName: 'Typography', role: 'support' },
  'gen-radar-hud': { layerId: 'gen-radar-hud', layerName: 'Radar HUD', role: 'support' },
  'gen-signal-noise': { layerId: 'gen-signal-noise', layerName: 'Signal Noise', role: 'support' },
  'gen-audio-geometry': { layerId: 'gen-audio-geometry', layerName: 'Audio Geometry', role: 'core' },
  'gen-freq-terrain': { layerId: 'gen-freq-terrain', layerName: 'Freq Terrain', role: 'core' },
  'gen-pulsing-ribbons': { layerId: 'gen-pulsing-ribbons', layerName: 'Pulsing Ribbons', role: 'support' },
  'gen-shimmer-veil': { layerId: 'gen-shimmer-veil', layerName: 'Shimmer Veil', role: 'support' },
};

const PRESET_NAME_TO_GENERATOR: Array<{ pattern: RegExp; generator: string }> = [
  { pattern: /SDF.*Monolith|SDF.*Space|SDF.*Scene|SDF.*Advanced/i, generator: 'gen-sdf-scene' },
  { pattern: /SDF.*Pulse|SDF.*Morph|SDF.*Industrial|SDF.*Neon|SDF.*Kaleido|SDF.*Prism|SDF.*Geometry|SDF.*Torus|SDF.*Metaball|SDF.*Crosshatch|SDF.*Wire|SDF.*Chain|SDF.*Matrix|SDF.*Crater|SDF.*Ember/i, generator: 'gen-sdf' },
  { pattern: /Lightning|Electric.*Arc|Thunder/i, generator: 'gen-lightning' },
  { pattern: /Particle.*Swarm|Swarm/i, generator: 'gen-particle-swarm' },
  { pattern: /Particle.*Vortex|Vortex/i, generator: 'gen-particle-vortex' },
  { pattern: /Particle.*Halo|Particles|Glow.*Worm/i, generator: 'gen-particles' },
  { pattern: /Tunnel.*Warp|Warp.*Tunnel/i, generator: 'gen-tunnel-warp' },
  { pattern: /Wormhole|Portal|Aura.*Portal/i, generator: 'gen-wormhole-core' },
  { pattern: /Infinite.*Worm|Depth.*Tunnel/i, generator: 'gen-infinite-wormhole' },
  { pattern: /Nebula|Cosmic.*Drift/i, generator: 'gen-nebula-drift' },
  { pattern: /Fractal.*Bloom|Bloom/i, generator: 'gen-fractal-bloom' },
  { pattern: /Kaleido|Shard/i, generator: 'gen-kaleido-shard' },
  { pattern: /Glitch|Datamosh|Scanline/i, generator: 'gen-glitch-datamosh' },
  { pattern: /VHS|Retro.*Glitch/i, generator: 'gen-vhs-glitch' },
  { pattern: /Laser|Starfield/i, generator: 'gen-laser-starfield' },
  { pattern: /Pyro|Burst|Fire/i, generator: 'gen-pyro-burst' },
  { pattern: /Mandala|Spinner/i, generator: 'gen-mandala-spinner' },
  { pattern: /Starburst|Galaxy/i, generator: 'gen-starburst-galaxy' },
  { pattern: /Wireframe|Geo.*Wire/i, generator: 'gen-geo-wireframe' },
  { pattern: /Neon.*Wire|Neon.*Grid/i, generator: 'gen-neon-wireframe' },
  { pattern: /Ribbon|Flow.*Tunnel/i, generator: 'gen-ribbon-tunnel' },
  { pattern: /Hypercube|4D|Tesseract/i, generator: 'gen-hypercube' },
  { pattern: /Crystal.*Growth|Growing.*Crystal/i, generator: 'gen-crystal-growth' },
  { pattern: /Fluid|Liquid|Swirl/i, generator: 'gen-fluid-swirl' },
  { pattern: /Caustic|Water.*Surface/i, generator: 'gen-caustic-liquid' },
  { pattern: /Magnetic|Field.*Line/i, generator: 'gen-magnetic-field' },
  { pattern: /Lorenz|Attractor|Chaos/i, generator: 'gen-lorenz-attractor' },
  { pattern: /Aurora|Chord/i, generator: 'gen-aurora-chord' },
  { pattern: /Digital.*Rain|Matrix.*Rain/i, generator: 'gen-digital-rain-v2' },
  { pattern: /ASCII|Text.*Stream/i, generator: 'gen-ascii-stream' },
  { pattern: /Data.*Stream|Binary/i, generator: 'gen-data-stream' },
  { pattern: /Circuit|Board|Conduit/i, generator: 'gen-circuit-board' },
  { pattern: /Techno.*Grid|Cyber.*Grid/i, generator: 'gen-techno-grid' },
  { pattern: /Sound.*Wave|Audio.*Wave/i, generator: 'gen-sound-wave-3d' },
  { pattern: /Oscillo|Oscilloscope/i, generator: 'gen-analog-oscillo' },
  { pattern: /Speaker|Cone|Bass/i, generator: 'gen-speaker-cone' },
  { pattern: /Heart|Pulse.*Beat/i, generator: 'gen-pulse-heart' },
  { pattern: /Bubble|Pop/i, generator: 'gen-bubble-pop' },
  { pattern: /Mycelium|Fungal|Network/i, generator: 'gen-mycelium-growth' },
  { pattern: /Plasma.*Ball|Energy.*Sphere/i, generator: 'gen-plasma-ball' },
  { pattern: /Warp.*Drive|Hyperspace/i, generator: 'gen-warp-drive' },
  { pattern: /Feedback|Echo.*Visual/i, generator: 'gen-visual-feedback' },
  { pattern: /Strobe|Flash/i, generator: 'gen-strobe' },
  { pattern: /Shape.*Burst|Explosion/i, generator: 'gen-shape-burst' },
  { pattern: /Lava|Flow.*Fire/i, generator: 'gen-lava-flow' },
  { pattern: /Prism|Refract/i, generator: 'gen-prism-shards' },
  { pattern: /Mirror|Maze|Reflection/i, generator: 'gen-mirror-maze' },
  { pattern: /Moire|Pattern/i, generator: 'gen-moire-pattern' },
  { pattern: /Neural|Network.*Mind/i, generator: 'gen-neural-net' },
  { pattern: /Retro.*Wave|Synthwave|Outrun/i, generator: 'gen-retro-wave' },
  { pattern: /Hex|Cellular|Honeycomb/i, generator: 'gen-hex-cell' },
  { pattern: /Radar|HUD|Display/i, generator: 'gen-radar-hud' },
  { pattern: /Signal|Noise|Static/i, generator: 'gen-signal-noise' },
  { pattern: /Audio.*Geometry|Freq.*Geo/i, generator: 'gen-audio-geometry' },
  { pattern: /Freq.*Terrain|Audio.*Terrain/i, generator: 'gen-freq-terrain' },
  { pattern: /Ribbon.*Pulse|Pulsing/i, generator: 'gen-pulsing-ribbons' },
  { pattern: /Shimmer|Veil|Curtain/i, generator: 'gen-shimmer-veil' },
];

function createLayer(generatorId: string, opacity: number = 0.9, blendMode: string = 'screen'): LayerConfig {
  const mapping = GENERATOR_MAPPINGS[generatorId];
  return {
    id: generatorId,
    name: mapping?.layerName || generatorId,
    role: mapping?.role || 'support',
    enabled: true,
    opacity,
    blendMode,
    transform: { x: 0, y: 0, scale: 1, rotation: 0 },
  };
}

function findGeneratorForPreset(presetName: string): string | null {
  for (const { pattern, generator } of PRESET_NAME_TO_GENERATOR) {
    if (pattern.test(presetName)) {
      return generator;
    }
  }
  return null;
}

function fixScene(scene: SceneConfig): { changed: boolean; reason: string } {
  const presetName = scene.name;
  const generator = findGeneratorForPreset(presetName);
  
  if (!generator) {
    return { changed: false, reason: 'No matching generator pattern' };
  }
  
  const hasCorrectGenerator = scene.layers.some(l => l.id === generator);
  if (hasCorrectGenerator) {
    return { changed: false, reason: 'Already has correct generator' };
  }
  
  const mapping = GENERATOR_MAPPINGS[generator];
  if (!mapping) {
    return { changed: false, reason: `No mapping for ${generator}` };
  }
  
  const newLayer = createLayer(generator);
  
  const existingCorrectLayer = scene.layers.find(l => l.id === generator);
  if (!existingCorrectLayer) {
    if (mapping.role === 'core') {
      scene.layers.unshift(newLayer);
    } else {
      scene.layers.push(newLayer);
    }
    
    if (scene.assigned_layers) {
      if (mapping.role === 'core' && !scene.assigned_layers.core.includes(generator)) {
        scene.assigned_layers.core.push(generator);
      } else if (mapping.role === 'support' && !scene.assigned_layers.support.includes(generator)) {
        scene.assigned_layers.support.push(generator);
      } else if (mapping.role === 'atmosphere' && !scene.assigned_layers.atmosphere.includes(generator)) {
        scene.assigned_layers.atmosphere.push(generator);
      }
    }
    
    return { changed: true, reason: `Added ${generator} for "${presetName}"` };
  }
  
  return { changed: false, reason: 'No changes needed' };
}

function main() {
  const projectPath = 'non-milkwave-bank-01.project.json';
  const content = fs.readFileSync(projectPath, 'utf-8');
  const project: Project = JSON.parse(content);
  
  let changedCount = 0;
  const changes: string[] = [];
  
  for (const scene of project.scenes) {
    const result = fixScene(scene);
    if (result.changed) {
      changedCount++;
      changes.push(`  - Scene "${scene.name}": ${result.reason}`);
    }
  }
  
  if (changedCount > 0) {
    console.log(`Fixed ${changedCount} scenes:\n`);
    changes.forEach(c => console.log(c));
    
    fs.writeFileSync(projectPath, JSON.stringify(project, null, 2));
    console.log(`\nWrote updated project to ${projectPath}`);
  } else {
    console.log('No changes needed');
  }
}

main();
