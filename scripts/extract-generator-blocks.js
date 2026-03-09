const fs = require('fs');
const path = require('path');

// Read the glRenderer.ts file
const glRendererPath = path.join(__dirname, '../src/renderer/glRenderer.ts');
const content = fs.readFileSync(glRendererPath, 'utf8');
const lines = content.split('\n').map(line => line.replace(/\r$/, '')); // Remove Windows \r

// Generator IDs from generatorLibrary.ts - manually mapped to their uniform base name
// The uniform base name is the prefix after 'u' and before 'Enabled' (e.g., uLaserEnabled -> 'Laser')
const GENERATOR_MAP = [
  { id: 'layer-plasma', uniformBase: 'Plasma' },
  { id: 'layer-spectrum', uniformBase: 'Spectrum' },
  { id: 'layer-origami', uniformBase: 'Origami' },
  { id: 'layer-glyph', uniformBase: 'Glyph' },
  { id: 'layer-crystal', uniformBase: 'Crystal' },
  { id: 'layer-inkflow', uniformBase: 'Ink' },
  { id: 'layer-topo', uniformBase: 'Topo' },
  { id: 'layer-weather', uniformBase: 'Weather' },
  { id: 'layer-portal', uniformBase: 'Portal' },
  { id: 'layer-media', uniformBase: 'Media' },
  { id: 'layer-oscillo', uniformBase: 'Oscillo' },
  { id: 'gen-audio-geometry', uniformBase: 'AudioGeometry', func: 'audioGeometry' },
  { id: 'gen-organic-fluid', uniformBase: 'OrganicFluid', func: 'organicFluid' },
  { id: 'gen-neon-wireframe', uniformBase: 'NeonWireframe', func: 'neonWireframe' },
  { id: 'gen-glitch-datamosh', uniformBase: 'GlitchDatamosh', func: 'glitchDatamosh' },
  { id: 'gen-particle-swarm', uniformBase: 'ParticleSwarm', func: 'particleSwarm' },
  { id: 'gen-typography-reveal', uniformBase: 'TypographyReveal', func: 'typographyReveal' },
  { id: 'gen-kaleido-shard', uniformBase: 'KaleidoShard', func: 'kaleidoShard' },
  { id: 'gen-radar-hud', uniformBase: 'RadarHud', func: 'radarHud' },
  { id: 'gen-fractal-bloom', uniformBase: 'FractalBloom', func: 'fractalBloom' },
  { id: 'gen-vhs-scanline', uniformBase: 'VhsScanline', func: 'vhsScanline' },
  { id: 'gen-tunnel-warp', uniformBase: 'TunnelWarp', func: 'tunnelWarp' },
  { id: 'gen-wormhole-core', uniformBase: 'WormholeCore', func: 'wormholeCore' },
  { id: 'gen-nebula-drift', uniformBase: 'NebulaDrift', func: 'nebulaDrift' },
  { id: 'gen-particles', uniformBase: 'Particles', func: 'particles' },
  { id: 'gen-sdf', uniformBase: 'Sdf', func: 'sdf' },
  { id: 'gen-sdf-scene', uniformBase: 'SdfScene', func: 'sdfScene' },
  { id: 'gen-lightning', uniformBase: 'Lightning', func: 'lightningBolt' },
  { id: 'gen-analog-oscillo', uniformBase: 'AnalogOscillo', func: 'analogOscillo' },
  { id: 'gen-speaker-cone', uniformBase: 'SpeakerCone', func: 'speakerPulse' },
  { id: 'gen-glitch-scanline', uniformBase: 'GlitchScanline', func: 'glitchScanline' },
  { id: 'gen-laser-starfield', uniformBase: 'LaserStarfield', func: 'laserStarfield' },
  { id: 'gen-pulsing-ribbons', uniformBase: 'PulsingRibbons', func: 'pulsingRibbons' },
  { id: 'gen-electric-arc', uniformBase: 'ElectricArc', func: 'electricArc' },
  { id: 'gen-pyro-burst', uniformBase: 'PyroBurst', func: 'pyroBurst' },
  { id: 'gen-geo-wireframe', uniformBase: 'GeoWireframe', func: 'geoWireframe' },
  { id: 'gen-signal-noise', uniformBase: 'SignalNoise', func: 'signalNoise' },
  { id: 'gen-infinite-wormhole', uniformBase: 'InfiniteWormhole', func: 'infiniteWormhole' },
  { id: 'gen-ribbon-tunnel', uniformBase: 'RibbonTunnel', func: 'ribbonTunnel' },
  { id: 'gen-fractal-tunnel', uniformBase: 'FractalTunnel', func: 'fractalTunnel' },
  { id: 'gen-circuit-conduit', uniformBase: 'CircuitConduit', func: 'circuitConduit' },
  { id: 'gen-aura-portal', uniformBase: 'AuraPortal', func: 'auraPortal' },
  { id: 'gen-freq-terrain', uniformBase: 'FreqTerrain', func: 'frequencyTerrain' },
  { id: 'gen-data-stream', uniformBase: 'DataStream', func: 'dataStream' },
  { id: 'gen-caustic-liquid', uniformBase: 'CausticLiquid', func: 'causticLiquid' },
  { id: 'gen-shimmer-veil', uniformBase: 'ShimmerVeil', func: 'shimmerVeil' },
  { id: 'gen-nebula-cloud', uniformBase: 'NebulaCloud', func: 'nebulaCloud' },
  { id: 'gen-circuit-board', uniformBase: 'CircuitBoard', func: 'circuitBoard' },
  { id: 'gen-lorenz-attractor', uniformBase: 'LorenzAttractor', func: 'lorenzAttractor' },
  { id: 'gen-mandala-spinner', uniformBase: 'MandalaSpinner', func: 'mandalaSpinner' },
  { id: 'gen-starburst-galaxy', uniformBase: 'StarburstGalaxy', func: 'starburstGalaxy' },
  { id: 'gen-digital-rain-v2', uniformBase: 'DigitalRainV2', func: 'digitalRainV2' },
  { id: 'gen-lava-flow', uniformBase: 'LavaFlow', func: 'lavaFlow' },
  { id: 'gen-crystal-growth', uniformBase: 'CrystalGrowth', func: 'crystalGrowth' },
  { id: 'gen-techno-grid', uniformBase: 'TechnoGrid', func: 'technoGrid3D' },
  { id: 'gen-magnetic-field', uniformBase: 'MagneticField', func: 'magneticField' },
  { id: 'gen-prism-shards', uniformBase: 'PrismShards', func: 'prismShards' },
  { id: 'gen-neural-net', uniformBase: 'NeuralNet', func: 'neuralNet' },
  { id: 'gen-aurora-chord', uniformBase: 'AuroraChord', func: 'auroraChord' },
  { id: 'gen-vhs-glitch', uniformBase: 'VhsGlitch', func: 'vhsGlitch' },
  { id: 'gen-moire-pattern', uniformBase: 'MoirePattern', func: 'moirePattern' },
  { id: 'gen-hypercube', uniformBase: 'Hypercube', func: 'hypercube' },
  { id: 'gen-fluid-swirl', uniformBase: 'FluidSwirl', func: 'fluidSwirl' },
  { id: 'gen-ascii-stream', uniformBase: 'AsciiStream', func: 'asciiStream' },
  { id: 'gen-retro-wave', uniformBase: 'RetroWave', func: 'retroWave' },
  { id: 'gen-bubble-pop', uniformBase: 'BubblePop', func: 'bubblePop' },
  { id: 'gen-sound-wave-3d', uniformBase: 'SoundWave3D', func: 'soundWave3D' },
  { id: 'gen-particle-vortex', uniformBase: 'ParticleVortex', func: 'particleVortex' },
  { id: 'gen-glow-worms', uniformBase: 'GlowWorms', func: 'glowWorms' },
  { id: 'gen-mirror-maze', uniformBase: 'MirrorMaze', func: 'mirrorMaze' },
  { id: 'gen-pulse-heart', uniformBase: 'PulseHeart', func: 'pulseHeart' },
  { id: 'gen-data-shards', uniformBase: 'DataShards', func: 'dataShards' },
  { id: 'gen-hex-cell', uniformBase: 'HexCell', func: 'hexCell' },
  { id: 'gen-plasma-ball', uniformBase: 'PlasmaBall', func: 'plasmaBall' },
  { id: 'gen-warp-drive', uniformBase: 'WarpDrive', func: 'warpDrive' },
  { id: 'gen-visual-feedback', uniformBase: 'VisualFeedback', func: 'visualFeedback' },
  { id: 'gen-mycelium-growth', uniformBase: 'MyceliumGrowth', func: 'myceliumGrowth' },
  { id: 'gen-laser-beam', uniformBase: 'Laser', func: 'laserBeam' },
  { id: 'gen-strobe', uniformBase: 'Strobe', func: 'strobeFlash' },
  { id: 'gen-shape-burst', uniformBase: 'ShapeBurst', func: 'shapeBurst' },
  { id: 'gen-grid-tunnel', uniformBase: 'GridTunnel', func: 'gridTunnel' },
  { id: 'gen-cellular-growth', uniformBase: 'CellularGrowth', func: 'cellularGrowth' },
  { id: 'gen-bio-luminescent-forest', uniformBase: 'BioLuminescentForest', func: 'bioLuminescentForest' },
  { id: 'gen-crystalline', uniformBase: 'Crystalline', func: 'crystalline' },
  { id: 'gen-audio-dna', uniformBase: 'AudioDna', func: 'audioDna' },
  { id: 'gen-liquid-metal', uniformBase: 'LiquidMetal', func: 'liquidMetal' },
  { id: 'gen-neon-cityscape', uniformBase: 'NeonCityscape', func: 'neonCityscape' },
  { id: 'gen-cosmic-nebula', uniformBase: 'CosmicNebula', func: 'cosmicNebula' },
  { id: 'gen-sonic-rain', uniformBase: 'SonicRain', func: 'sonicRain' },
  { id: 'gen-morphing-geometry', uniformBase: 'MorphingGeometry', func: 'morphingGeometry' },
  { id: 'gen-urban-rhythm', uniformBase: 'UrbanRhythm', func: 'urbanRhythm' },
  { id: 'gen-crimson-veil', uniformBase: 'CrimsonVeil', func: 'crimsonVeil' },
  { id: 'gen-victorian-crypt', uniformBase: 'VictorianCrypt', func: 'victorianCrypt' },
  { id: 'gen-spectral-apparition', uniformBase: 'SpectralApparition', func: 'spectralApparition' },
  { id: 'gen-gothic-cobwebs', uniformBase: 'GothicCobwebs', func: 'gothicCobwebs' },
  { id: 'gen-blood-moon-rise', uniformBase: 'BloodMoonRise', func: 'bloodMoonRise' },
  { id: 'gen-candlelight-vigil', uniformBase: 'CandlelightVigil', func: 'candlelightVigil' },
  { id: 'gen-gargoyles-awake', uniformBase: 'GargoylesAwake', func: 'gargoylesAwake' },
  { id: 'gen-crypt-shadows', uniformBase: 'CryptShadows', func: 'cryptShadows' },
  { id: 'gen-gothic-rose', uniformBase: 'GothicRose', func: 'gothicRose' },
  { id: 'gen-eternal-darkness', uniformBase: 'EternalDarkness', func: 'eternalDarkness' },
  { id: 'gen-pixel-dust', uniformBase: 'PixelDust', func: 'pixelDust' },
  { id: 'gen-retro-starfield', uniformBase: 'RetroStarfield', func: 'retroStarfield' },
  { id: 'gen-8bit-grid', uniformBase: '8BitGrid', func: 'eightBitGrid' },
  { id: 'gen-arcade-invaders', uniformBase: 'ArcadeInvaders', func: 'arcadeInvaders' },
  { id: 'gen-power-up-pulse', uniformBase: 'PowerUpPulse', func: 'powerUpPulse' },
  { id: 'gen-dungeon-tiles', uniformBase: 'DungeonTiles', func: 'dungeonTiles' },
  { id: 'gen-chiptune-wave', uniformBase: 'ChiptuneWave', func: 'chiptuneWave' },
  { id: 'gen-score-counter', uniformBase: 'ScoreCounter', func: 'scoreCounter' },
  { id: 'gen-pixel-rain', uniformBase: 'PixelRain', func: 'pixelRain' },
  { id: 'gen-boss-health', uniformBase: 'BossHealth', func: 'bossHealth' },
];

// Find function definitions in the file
function findFunctions() {
  const functions = {};
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Match function definition: vec3 or float followed by function name and params
    const match = line.match(/^(vec3|float)\s+([a-zA-Z][a-zA-Z0-9]*)\(([^)]*)\)\s*\{?$/);
    if (match) {
      const returnType = match[1];
      const funcName = match[2];
      const params = match[3];

      // Find the end of this function
      let braceCount = 0;
      let funcLines = [];
      let started = false;

      for (let j = i; j < lines.length; j++) {
        const funcLine = lines[j];
        funcLines.push(funcLine);

        // Count braces
        for (const char of funcLine) {
          if (char === '{') braceCount++;
          if (char === '}') braceCount--;
        }

        if (braceCount === 0 && started) {
          break;
        }
        started = true;
      }

      functions[funcName] = {
        name: funcName,
        returnType: returnType,
        params: params,
        body: funcLines.join('\n')
      };

      i += funcLines.length;
      continue;
    }

    i++;
  }
  return functions;
}

// Find main calls - look for pattern: if (uXxxEnabled > 0.5) { ... color += func(...) ... }
function findMainCalls() {
  const calls = {};
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match the if statement line
    const ifMatch = line.match(/^\s*if \(u([A-Z][a-zA-Z0-9]+)Enabled > 0\.5\)\s*\{/);
    if (ifMatch) {
      const baseName = ifMatch[1];
      const indent = line.match(/^(\s*)/)[1];

      // Collect lines until we find the matching closing brace
      const blockLines = [line];
      let braceCount = 1;
      let j = i + 1;

      for (; j < lines.length && braceCount > 0; j++) {
        const blockLine = lines[j];
        blockLines.push(blockLine);

        // Count braces
        for (const char of blockLine) {
          if (char === '{') braceCount++;
          if (char === '}') braceCount--;
        }
      }

      // Find the color += line within the block
      const blockText = blockLines.join('\n');
      const colorMatch = blockText.match(/color \+=\s+([a-zA-Z][a-zA-Z0-9]*)\(/);

      if (colorMatch) {
        const funcName = colorMatch[1];
        if (!calls[baseName]) {
          calls[baseName] = [];
        }
        // Store the entire if block as the mainCall
        calls[baseName].push({
          baseName: baseName,
          funcName: funcName,
          call: blockLines.join('\n') + '\n'
        });
      }

      // Skip ahead past this block
      i = j - 1;
    }
  }
  return calls;
}

// Find uniform blocks - group uniforms by their base name
function findUniformBlocks() {
  const blocks = {};
  let currentBlock = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Match generator uniforms like uniform float uXxxEnabled;
    const match = line.match(/^uniform float u([A-Z][a-zA-Z0-9]+)Enabled;/);
    if (match) {
      const baseName = match[1];

      // Start a new block if different base name
      if (!currentBlock || currentBlock.baseName !== baseName) {
        currentBlock = {
          baseName: baseName,
          uniforms: []
        };
        blocks[baseName] = currentBlock;
      }

      currentBlock.uniforms.push(line);
    }
  }

  return blocks;
}

// Main extraction function
function extract() {
  console.log('Extracting generator blocks...');

  // Find all functions
  const functions = findFunctions();
  console.log(`Found ${Object.keys(functions).length} functions`);

  // Find main calls
  const mainCalls = findMainCalls();
  console.log(`Found ${Object.keys(mainCalls).length} main call patterns`);

  // Find uniform blocks
  const uniformBlocks = findUniformBlocks();
  console.log(`Found ${Object.keys(uniformBlocks).length} uniform blocks`);

  // Create output blocks for each generator ID
  const outputBlocks = [];
  const missing = [];

  for (const gen of GENERATOR_MAP) {
    const id = gen.id;
    const baseName = gen.uniformBase;
    const funcName = gen.func || baseName.replace(/[A-Z]/g, c => '-' + c.toLowerCase()).replace(/^-/, '');

    const uniformBlock = uniformBlocks[baseName];
    const mainCallGroup = mainCalls[baseName];
    const funcDef = functions[funcName];

    if (!uniformBlock) {
      missing.push({ id, reason: 'no uniform block', baseName });
      continue;
    }

    // Get the main call line
    const mainCallLine = mainCallGroup ? mainCallGroup[mainCallGroup.length - 1].call : '';

    // Check if function exists
    if (!funcDef) {
      missing.push({ id, reason: 'no function def', funcName, baseName });
      continue;
    }

    outputBlocks.push({
      id: id,
      uniforms: uniformBlock.uniforms.join('\n') + '\n',
      functions: funcDef.body,
      mainCall: mainCallLine
    });
  }

  console.log(`\nCreated ${outputBlocks.length} output blocks`);
  console.log(`Missing: ${missing.length} generators`);

  if (missing.length > 0) {
    console.log('\nMissing generators:');
    missing.forEach(m => console.log(`  - ${m.id}: ${m.reason} (${m.funcName || m.baseName})`));
  }

  return outputBlocks;
}

// Generate TypeScript code
function generateTypeScript(blocks) {
  let tsCode = `export interface GeneratorShaderBlock {
  /** Generator ID matching an entry in GENERATORS from generatorLibrary.ts */
  id: string;
  /** GLSL uniform declarations for this generator */
  uniforms: string;
  /** Complete GLSL function definition(s) for this generator */
  functions: string;
  /** Single conditional call line for main(), e.g. "  if (uXxxEnabled > 0.5) color += generatorName(...);\\\\n" */
  mainCall: string;
}

/**
 * Registry of generator shader blocks extracted from glRenderer.ts
 * Each block contains the uniforms, functions, and main call for a single generator.
 */
export const GENERATOR_SHADER_BLOCKS: GeneratorShaderBlock[] = [\n`;

  for (const block of blocks) {
    tsCode += `  {\n`;
    tsCode += `    id: '${block.id}',\n`;
    tsCode += `    uniforms: \`${block.uniforms.replace(/`/g, '\\`')}\`,\n`;
    tsCode += `    functions: \`${block.functions.replace(/`/g, '\\`')}\`,\n`;
    // Escape backticks and newlines in mainCall
    const escapedMainCall = block.mainCall.replace(/`/g, '\\`').replace(/\\n/g, '\\n');
    tsCode += `    mainCall: \`${escapedMainCall}\`,\n`;
    tsCode += `  },\n\n`;
  }

  tsCode += `];\n\n`;

  // Export helper function
  tsCode += `/** Returns the block for a given generator ID, or null if not found */\n`;
  tsCode += `export const findGeneratorShaderBlock = (id: string): GeneratorShaderBlock | null =>\n`;
  tsCode += `  GENERATOR_SHADER_BLOCKS.find(b => b.id === id) ?? null;\n`;

  return tsCode;
}

// Run and output
const blocks = extract();
const tsCode = generateTypeScript(blocks);

// Write to output file
const outputPath = path.join(__dirname, '../src/shared/generatorShaderBlocks.ts');
fs.writeFileSync(outputPath, tsCode);

console.log(`\nWrote ${outputPath}`);
console.log(`Total generators in registry: ${blocks.length}`);
