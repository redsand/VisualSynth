/**
 * Parameter Registry
 *
 * Central registry of all available layer types, their parameters, and metadata.
 * This is the source of truth for what parameters exist and their constraints.
 */

export type ParamType = 'number' | 'boolean' | 'string' | 'enum' | 'color';

export interface ParamDef {
  /** Parameter identifier */
  id: string;
  /** Display name */
  name: string;
  /** Parameter type */
  type: ParamType;
  /** Minimum value (for number type) */
  min?: number;
  /** Maximum value (for number type) */
  max?: number;
  /** Default value */
  default: any;
  /** Description of what the parameter does */
  description?: string;
  /** Allowed values (for enum type) */
  options?: { value: any; label: string }[];
  /** Whether parameter is modulatable via modulation matrix */
  modulatable: boolean;
  /** Whether parameter can be mapped to MIDI */
  midiMappable: boolean;
  /** Version when parameter was added (for compatibility) */
  sinceVersion?: string;
  /** Version when parameter was deprecated (for compatibility) */
  deprecatedIn?: string;
  /** If deprecated, what to use instead */
  replacedBy?: string;
}

export interface LayerTypeDef {
  /** Layer type identifier */
  id: string;
  /** Display name */
  name: string;
  /** Description */
  description: string;
  /** Available parameters */
  params: ParamDef[];
  /** Version when layer type was added */
  sinceVersion: string;
}

/**
 * Parameter registry - all available layer types and their parameters
 */
export const PARAMETER_REGISTRY: LayerTypeDef[] = [
  {
    id: 'plasma',
    name: 'Plasma',
    description: 'Shader-based plasma effect',
    sinceVersion: '0.1.0',
    params: [
      {
        id: 'opacity',
        name: 'Opacity',
        type: 'number',
        min: 0,
        max: 1,
        default: 1,
        description: 'Layer visibility',
        modulatable: true,
        midiMappable: true,
        sinceVersion: '0.1.0'
      },
      {
        id: 'speed',
        name: 'Speed',
        type: 'number',
        min: 0.1,
        max: 3,
        default: 1,
        description: 'Animation speed',
        modulatable: true,
        midiMappable: true,
        sinceVersion: '0.1.0'
      },
      {
        id: 'scale',
        name: 'Scale',
        type: 'number',
        min: 0.1,
        max: 3,
        default: 1,
        description: 'Visual scale',
        modulatable: true,
        midiMappable: true,
        sinceVersion: '0.1.0'
      },
      {
        id: 'complexity',
        name: 'Complexity',
        type: 'number',
        min: 0,
        max: 1,
        default: 0.5,
        description: 'Pattern complexity',
        modulatable: true,
        midiMappable: true,
        sinceVersion: '0.1.0'
      }
    ]
  },
  {
    id: 'spectrum',
    name: 'Spectrum',
    description: 'Audio frequency visualization',
    sinceVersion: '0.1.0',
    params: [
      {
        id: 'opacity',
        name: 'Opacity',
        type: 'number',
        min: 0,
        max: 1,
        default: 1,
        description: 'Layer visibility',
        modulatable: true,
        midiMappable: true,
        sinceVersion: '0.1.0'
      }
    ]
  },
  {
    id: 'origami',
    name: 'Origami',
    description: 'Folding geometry effect',
    sinceVersion: '0.5.0',
    params: [
      {
        id: 'opacity',
        name: 'Opacity',
        type: 'number',
        min: 0,
        max: 1,
        default: 1,
        description: 'Layer visibility',
        modulatable: true,
        midiMappable: true,
        sinceVersion: '0.5.0'
      },
      {
        id: 'speed',
        name: 'Speed',
        type: 'number',
        min: 0.1,
        max: 3,
        default: 1,
        description: 'Animation speed',
        modulatable: true,
        midiMappable: true,
        sinceVersion: '0.5.0'
      }
    ]
  },
  {
    id: 'glyph',
    name: 'Glyph',
    description: 'Character/glyph visualization',
    sinceVersion: '0.6.0',
    params: [
      {
        id: 'opacity',
        name: 'Opacity',
        type: 'number',
        min: 0,
        max: 1,
        default: 1,
        description: 'Layer visibility',
        modulatable: true,
        midiMappable: true,
        sinceVersion: '0.6.0'
      },
      {
        id: 'speed',
        name: 'Speed',
        type: 'number',
        min: 0.1,
        max: 3,
        default: 1,
        description: 'Animation speed',
        modulatable: true,
        midiMappable: true,
        sinceVersion: '0.6.0'
      }
    ]
  },
  {
    id: 'crystal',
    name: 'Crystal',
    description: 'Crystal/harmonic effect',
    sinceVersion: '0.7.0',
    params: [
      {
        id: 'opacity',
        name: 'Opacity',
        type: 'number',
        min: 0,
        max: 1,
        default: 1,
        description: 'Layer visibility',
        modulatable: true,
        midiMappable: true,
        sinceVersion: '0.7.0'
      },
      {
        id: 'scale',
        name: 'Scale',
        type: 'number',
        min: 0.1,
        max: 3,
        default: 1,
        description: 'Visual scale',
        modulatable: true,
        midiMappable: true,
        sinceVersion: '0.7.0'
      },
      {
        id: 'speed',
        name: 'Speed',
        type: 'number',
        min: 0.1,
        max: 3,
        default: 1,
        description: 'Animation speed',
        modulatable: true,
        midiMappable: true,
        sinceVersion: '0.7.0'
      }
    ]
  },
  {
    id: 'inkflow',
    name: 'Ink Flow',
    description: 'Fluid ink simulation',
    sinceVersion: '0.7.0',
    params: [
      {
        id: 'opacity',
        name: 'Opacity',
        type: 'number',
        min: 0,
        max: 1,
        default: 1,
        description: 'Layer visibility',
        modulatable: true,
        midiMappable: true,
        sinceVersion: '0.7.0'
      },
      {
        id: 'speed',
        name: 'Speed',
        type: 'number',
        min: 0.1,
        max: 3,
        default: 1,
        description: 'Animation speed',
        modulatable: true,
        midiMappable: true,
        sinceVersion: '0.7.0'
      },
      {
        id: 'scale',
        name: 'Scale',
        type: 'number',
        min: 0.1,
        max: 3,
        default: 1,
        description: 'Visual scale',
        modulatable: true,
        midiMappable: true,
        sinceVersion: '0.7.0'
      }
    ]
  },
  {
    id: 'topo',
    name: 'Topo',
    description: 'Topographic terrain effect',
    sinceVersion: '0.7.0',
    params: [
      {
        id: 'opacity',
        name: 'Opacity',
        type: 'number',
        min: 0,
        max: 1,
        default: 1,
        description: 'Layer visibility',
        modulatable: true,
        midiMappable: true,
        sinceVersion: '0.7.0'
      },
      {
        id: 'scale',
        name: 'Scale',
        type: 'number',
        min: 0.1,
        max: 3,
        default: 1,
        description: 'Visual scale',
        modulatable: true,
        midiMappable: true,
        sinceVersion: '0.7.0'
      },
      {
        id: 'elevation',
        name: 'Elevation',
        type: 'number',
        min: 0,
        max: 1,
        default: 0.5,
        description: 'Terrain elevation',
        modulatable: true,
        midiMappable: true,
        sinceVersion: '0.7.0'
      }
    ]
  },
  {
    id: 'weather',
    name: 'Weather',
    description: 'Weather/atmospheric effect',
    sinceVersion: '0.8.0',
    params: [
      {
        id: 'opacity',
        name: 'Opacity',
        type: 'number',
        min: 0,
        max: 1,
        default: 1,
        description: 'Layer visibility',
        modulatable: true,
        midiMappable: true,
        sinceVersion: '0.8.0'
      },
      {
        id: 'speed',
        name: 'Speed',
        type: 'number',
        min: 0.1,
        max: 3,
        default: 1,
        description: 'Animation speed',
        modulatable: true,
        midiMappable: true,
        sinceVersion: '0.8.0'
      }
    ]
  },
  {
    id: 'portal',
    name: 'Portal',
    description: 'Warp portal effect',
    sinceVersion: '0.8.0',
    params: [
      {
        id: 'opacity',
        name: 'Opacity',
        type: 'number',
        min: 0,
        max: 1,
        default: 1,
        description: 'Layer visibility',
        modulatable: true,
        midiMappable: true,
        sinceVersion: '0.8.0'
      }
    ]
  },
  {
    id: 'media',
    name: 'Media',
    description: 'Image/video overlay layer',
    sinceVersion: '0.9.0',
    params: [
      {
        id: 'opacity',
        name: 'Opacity',
        type: 'number',
        min: 0,
        max: 1,
        default: 1,
        description: 'Layer visibility',
        modulatable: true,
        midiMappable: true,
        sinceVersion: '0.9.0'
      }
    ]
  },
  {
    id: 'oscillo',
    name: 'Oscilloscope',
    description: 'Waveform visualization',
    sinceVersion: '0.8.0',
    params: [
      {
        id: 'opacity',
        name: 'Opacity',
        type: 'number',
        min: 0,
        max: 1,
        default: 1,
        description: 'Layer visibility',
        modulatable: true,
        midiMappable: true,
        sinceVersion: '0.8.0'
      }
    ]
  },
  {
    id: 'lightning',
    name: 'Lightning Bolt',
    description: 'High-voltage lightning generator',
    sinceVersion: '1.1.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Speed', type: 'number', min: 0.1, max: 5, default: 1, modulatable: true, midiMappable: true },
      { id: 'branches', name: 'Branches', type: 'number', min: 1, max: 5, default: 3, modulatable: false, midiMappable: true },
      { id: 'thickness', name: 'Thickness', type: 'number', min: 0.01, max: 0.1, default: 0.02, modulatable: true, midiMappable: true },
      { id: 'color', name: 'Color Mode', type: 'enum', default: 0, options: [{value: 0, label: 'Blue'}, {value: 1, label: 'Yellow'}, {value: 2, label: 'Purple'}], modulatable: false, midiMappable: true }
    ]
  },
  {
    id: 'analog-oscillo',
    name: 'Analog Oscillo',
    description: 'Gritty CRT oscilloscope',
    sinceVersion: '1.1.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'thickness', name: 'Thickness', type: 'number', min: 0.005, max: 0.05, default: 0.01, modulatable: true, midiMappable: true },
      { id: 'glow', name: 'Glow', type: 'number', min: 0, max: 1, default: 0.5, modulatable: true, midiMappable: true },
      { id: 'color', name: 'Color', type: 'enum', default: 0, options: [{value: 0, label: 'White'}, {value: 1, label: 'Red'}, {value: 2, label: 'Green'}], modulatable: false, midiMappable: true },
      { id: 'mode', name: 'Mode', type: 'enum', default: 0, options: [{value: 0, label: 'Line'}, {value: 1, label: 'Dots'}], modulatable: false, midiMappable: true }
    ]
  },
  {
    id: 'speaker-cone',
    name: 'Speaker Cone',
    description: 'Bass-driven radial distortion',
    sinceVersion: '1.1.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'force', name: 'Force', type: 'number', min: 0, max: 2, default: 1, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'glitch-scanline',
    name: 'Glitch Scanline',
    description: 'VHS tracking and glitch artifacts',
    sinceVersion: '1.1.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Speed', type: 'number', min: 0.1, max: 5, default: 1, modulatable: true, midiMappable: true },
      { id: 'count', name: 'Line Count', type: 'number', min: 1, max: 10, default: 1, modulatable: false, midiMappable: true }
    ]
  },
  {
    id: 'laser-starfield',
    name: 'Laser Starfield',
    description: 'Geometric starfield with high-frequency reaction',
    sinceVersion: '1.1.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Speed', type: 'number', min: 0.1, max: 5, default: 1, modulatable: true, midiMappable: true },
      { id: 'density', name: 'Density', type: 'number', min: 0.1, max: 5, default: 1, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'pulsing-ribbons',
    name: 'Pulsing Ribbons',
    description: 'Flowing frequency ribbons',
    sinceVersion: '1.1.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'count', name: 'Ribbon Count', type: 'number', min: 1, max: 10, default: 3, modulatable: false, midiMappable: true },
      { id: 'width', name: 'Ribbon Width', type: 'number', min: 0.01, max: 0.2, default: 0.05, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'electric-arc',
    name: 'Electric Arc',
    description: 'Circular high-voltage arcs',
    sinceVersion: '1.1.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'radius', name: 'Arc Radius', type: 'number', min: 0.1, max: 1, default: 0.5, modulatable: true, midiMappable: true },
      { id: 'chaos', name: 'Arc Chaos', type: 'number', min: 0.1, max: 5, default: 1, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'pyro-burst',
    name: 'Pyro Burst',
    description: 'Firework-style bursts on transients',
    sinceVersion: '1.1.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'force', name: 'Burst Force', type: 'number', min: 0.1, max: 5, default: 1, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'geo-wireframe',
    name: 'Geo Wireframe',
    description: 'Rotating 3D wireframe shapes',
    sinceVersion: '1.1.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'shape', name: 'Shape Type', type: 'enum', default: 0, options: [{value: 0, label: 'Box'}, {value: 1, label: 'Triangle'}], modulatable: false, midiMappable: true },
      { id: 'scale', name: 'Shape Scale', type: 'number', min: 0.1, max: 2, default: 0.5, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'signal-noise',
    name: 'Signal Noise',
    description: 'Radio interference and static',
    sinceVersion: '1.1.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'amount', name: 'Noise Amount', type: 'number', min: 0.1, max: 5, default: 1, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'infinite-wormhole',
    name: 'Infinite Wormhole',
    description: 'Organic weaving tunnel',
    sinceVersion: '1.2.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Travel Speed', type: 'number', min: 0.1, max: 5, default: 1, modulatable: true, midiMappable: true },
      { id: 'weave', name: 'Weave Strength', type: 'number', min: 0, max: 1, default: 0.2, modulatable: true, midiMappable: true },
      { id: 'iter', name: 'Iterations', type: 'number', min: 1, max: 8, default: 3, modulatable: false, midiMappable: true }
    ]
  },
  {
    id: 'ribbon-tunnel',
    name: 'Ribbon Tunnel',
    description: 'Twisting neon ribbon path',
    sinceVersion: '1.2.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Rotation Speed', type: 'number', min: 0.1, max: 5, default: 1, modulatable: true, midiMappable: true },
      { id: 'twist', name: 'Spiral Twist', type: 'number', min: 0.1, max: 5, default: 1, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'fractal-tunnel',
    name: 'Fractal Tunnel',
    description: 'Recursive geometric tunnel',
    sinceVersion: '1.2.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Zoom Speed', type: 'number', min: 0.1, max: 5, default: 1, modulatable: true, midiMappable: true },
      { id: 'complexity', name: 'Recursion Depth', type: 'number', min: 1, max: 5, default: 3, modulatable: false, midiMappable: true }
    ]
  },
  {
    id: 'circuit-conduit',
    name: 'Circuit Conduit',
    description: 'Square data-flow tunnel',
    sinceVersion: '1.2.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Data Flow Speed', type: 'number', min: 0.1, max: 5, default: 1, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'aura-portal',
    name: 'Aura Portal',
    description: 'Volumetric glowing void',
    sinceVersion: '1.3.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'color', name: 'Color Style', type: 'enum', default: 0, options: [{value: 0, label: 'Cool'}, {value: 1, label: 'Warm'}], modulatable: false, midiMappable: true }
    ]
  },
  {
    id: 'freq-terrain',
    name: 'Frequency Terrain',
    description: 'Audio-spectrum based landscape',
    sinceVersion: '1.3.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'scale', name: 'Height Scale', type: 'number', min: 0.1, max: 5, default: 1, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'data-stream',
    name: 'Data Stream',
    description: 'Cyberpunk digital rainfall',
    sinceVersion: '1.3.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Stream Speed', type: 'number', min: 0.1, max: 5, default: 1, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'caustic-liquid',
    name: 'Caustic Liquid',
    description: 'Underwater light refraction',
    sinceVersion: '1.3.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Flow Speed', type: 'number', min: 0.1, max: 5, default: 1, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'shimmer-veil',
    name: 'Shimmer Veil',
    description: 'Rippling curtain of light',
    sinceVersion: '1.3.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'complexity', name: 'Veil Complexity', type: 'number', min: 1, max: 20, default: 10, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'laser-beam',
    name: 'Laser Beam',
    description: 'EDM-style laser beams with audio reactivity',
    sinceVersion: '1.0.0',
    params: [
      {
        id: 'opacity',
        name: 'Opacity',
        type: 'number',
        min: 0,
        max: 1,
        default: 1,
        description: 'Layer visibility',
        modulatable: true,
        midiMappable: true,
        sinceVersion: '1.0.0'
      },
      {
        id: 'beamCount',
        name: 'Beam Count',
        type: 'number',
        min: 1,
        max: 16,
        default: 4,
        description: 'Number of laser beams',
        modulatable: true,
        midiMappable: true,
        sinceVersion: '1.0.0'
      },
      {
        id: 'beamWidth',
        name: 'Beam Width',
        type: 'number',
        min: 0.005,
        max: 0.1,
        default: 0.02,
        description: 'Laser thickness',
        modulatable: true,
        midiMappable: true,
        sinceVersion: '1.0.0'
      },
      {
        id: 'beamLength',
        name: 'Beam Length',
        type: 'number',
        min: 0.3,
        max: 2.0,
        default: 1.0,
        description: 'Beam reach',
        modulatable: true,
        midiMappable: true,
        sinceVersion: '1.0.0'
      },
      {
        id: 'rotation',
        name: 'Rotation',
        type: 'number',
        min: 0,
        max: 6.28,
        default: 0,
        description: 'Base rotation angle',
        modulatable: true,
        midiMappable: true,
        sinceVersion: '1.0.0'
      },
      {
        id: 'rotationSpeed',
        name: 'Rotation Speed',
        type: 'number',
        min: 0,
        max: 3,
        default: 0.5,
        description: 'Auto-rotation speed',
        modulatable: true,
        midiMappable: true,
        sinceVersion: '1.0.0'
      },
      {
        id: 'spread',
        name: 'Spread',
        type: 'number',
        min: 0,
        max: 6.28,
        default: 1.57,
        description: 'Angular spread of beams',
        modulatable: true,
        midiMappable: true,
        sinceVersion: '1.0.0'
      },
      {
        id: 'mode',
        name: 'Mode',
        type: 'enum',
        default: 0,
        options: [
          { value: 0, label: 'Radial' },
          { value: 1, label: 'Parallel' },
          { value: 2, label: 'Crossing' },
          { value: 3, label: 'Scanning' },
          { value: 4, label: 'Distance Sweep' }
        ],
        description: 'Beam arrangement mode',
        modulatable: false,
        midiMappable: true,
        sinceVersion: '1.0.0'
      },
      {
        id: 'colorShift',
        name: 'Color Shift',
        type: 'number',
        min: 0,
        max: 1,
        default: 0,
        description: 'Rainbow shift on audio',
        modulatable: true,
        midiMappable: true,
        sinceVersion: '1.0.0'
      },
      {
        id: 'audioReact',
        name: 'Audio React',
        type: 'number',
        min: 0,
        max: 1,
        default: 0.7,
        description: 'Audio sensitivity',
        modulatable: true,
        midiMappable: true,
        sinceVersion: '1.0.0'
      },
      {
        id: 'glow',
        name: 'Glow',
        type: 'number',
        min: 0,
        max: 1,
        default: 0.5,
        description: 'Bloom/glow intensity',
        modulatable: true,
        midiMappable: true,
        sinceVersion: '1.0.0'
      }
    ]
  },
  {
    id: 'strobe',
    name: 'Strobe Flash',
    description: 'Full-screen strobe/flash effects synced to beat',
    sinceVersion: '1.0.0',
    params: [
      {
        id: 'opacity',
        name: 'Opacity',
        type: 'number',
        min: 0,
        max: 1,
        default: 1,
        description: 'Maximum flash intensity',
        modulatable: true,
        midiMappable: true,
        sinceVersion: '1.0.0'
      },
      {
        id: 'rate',
        name: 'Rate',
        type: 'number',
        min: 0.5,
        max: 20,
        default: 4,
        description: 'Flashes per beat',
        modulatable: true,
        midiMappable: true,
        sinceVersion: '1.0.0'
      },
      {
        id: 'dutyCycle',
        name: 'Duty Cycle',
        type: 'number',
        min: 0.05,
        max: 0.5,
        default: 0.1,
        description: 'Flash duration ratio',
        modulatable: true,
        midiMappable: true,
        sinceVersion: '1.0.0'
      },
      {
        id: 'mode',
        name: 'Mode',
        type: 'enum',
        default: 0,
        options: [
          { value: 0, label: 'White' },
          { value: 1, label: 'Color' },
          { value: 2, label: 'Rainbow' },
          { value: 3, label: 'Invert' }
        ],
        description: 'Flash type',
        modulatable: false,
        midiMappable: true,
        sinceVersion: '1.0.0'
      },
      {
        id: 'audioTrigger',
        name: 'Audio Trigger',
        type: 'boolean',
        default: true,
        description: 'Trigger on audio peaks',
        modulatable: false,
        midiMappable: true,
        sinceVersion: '1.0.0'
      },
      {
        id: 'threshold',
        name: 'Threshold',
        type: 'number',
        min: 0.3,
        max: 0.9,
        default: 0.6,
        description: 'Peak detection threshold',
        modulatable: true,
        midiMappable: true,
        sinceVersion: '1.0.0'
      },
      {
        id: 'fadeOut',
        name: 'Fade Out',
        type: 'number',
        min: 0,
        max: 0.5,
        default: 0.1,
        description: 'Flash decay time',
        modulatable: true,
        midiMappable: true,
        sinceVersion: '1.0.0'
      },
      {
        id: 'pattern',
        name: 'Pattern',
        type: 'enum',
        default: 0,
        options: [
          { value: 0, label: 'Solid' },
          { value: 1, label: 'Scanline' },
          { value: 2, label: 'Radial' }
        ],
        description: 'Flash pattern',
        modulatable: false,
        midiMappable: true,
        sinceVersion: '1.0.0'
      }
    ]
  },
  {
    id: 'shape-burst',
    name: 'Shape Burst',
    description: 'Shapes that spawn on beat and expand outward',
    sinceVersion: '1.0.0',
    params: [
      {
        id: 'opacity',
        name: 'Opacity',
        type: 'number',
        min: 0,
        max: 1,
        default: 1,
        description: 'Layer visibility',
        modulatable: true,
        midiMappable: true,
        sinceVersion: '1.0.0'
      },
      {
        id: 'shape',
        name: 'Shape',
        type: 'enum',
        default: 0,
        options: [
          { value: 0, label: 'Ring' },
          { value: 1, label: 'Circle' },
          { value: 2, label: 'Hexagon' },
          { value: 3, label: 'Star' },
          { value: 4, label: 'Triangle' }
        ],
        description: 'Shape type',
        modulatable: false,
        midiMappable: true,
        sinceVersion: '1.0.0'
      },
      {
        id: 'burstCount',
        name: 'Burst Count',
        type: 'number',
        min: 1,
        max: 8,
        default: 3,
        description: 'Concurrent expanding shapes',
        modulatable: false,
        midiMappable: true,
        sinceVersion: '1.0.0'
      },
      {
        id: 'expandSpeed',
        name: 'Expand Speed',
        type: 'number',
        min: 0.5,
        max: 5,
        default: 2,
        description: 'Expansion velocity',
        modulatable: true,
        midiMappable: true,
        sinceVersion: '1.0.0'
      },
      {
        id: 'startSize',
        name: 'Start Size',
        type: 'number',
        min: 0.01,
        max: 0.3,
        default: 0.05,
        description: 'Initial size',
        modulatable: true,
        midiMappable: true,
        sinceVersion: '1.0.0'
      },
      {
        id: 'maxSize',
        name: 'Max Size',
        type: 'number',
        min: 0.5,
        max: 3.0,
        default: 1.5,
        description: 'Maximum expansion',
        modulatable: true,
        midiMappable: true,
        sinceVersion: '1.0.0'
      },
      {
        id: 'thickness',
        name: 'Thickness',
        type: 'number',
        min: 0.01,
        max: 0.2,
        default: 0.03,
        description: 'Ring/outline thickness',
        modulatable: true,
        midiMappable: true,
        sinceVersion: '1.0.0'
      },
      {
        id: 'fadeMode',
        name: 'Fade Mode',
        type: 'enum',
        default: 2,
        options: [
          { value: 0, label: 'Size' },
          { value: 1, label: 'Opacity' },
          { value: 2, label: 'Both' }
        ],
        description: 'How shapes fade',
        modulatable: false,
        midiMappable: true,
        sinceVersion: '1.0.0'
      },
      {
        id: 'audioTrigger',
        name: 'Audio Trigger',
        type: 'boolean',
        default: true,
        description: 'Spawn on audio peaks',
        modulatable: false,
        midiMappable: true,
        sinceVersion: '1.0.0'
      },
      {
        id: 'spawnRate',
        name: 'Spawn Rate',
        type: 'number',
        min: 0.5,
        max: 4,
        default: 1,
        description: 'Spawns per beat',
        modulatable: true,
        midiMappable: true,
        sinceVersion: '1.0.0'
      }
    ]
  },
  {
    id: 'grid-tunnel',
    name: 'Grid Tunnel',
    description: 'Retro Tron-style infinite grid traveling through space',
    sinceVersion: '1.0.0',
    params: [
      {
        id: 'opacity',
        name: 'Opacity',
        type: 'number',
        min: 0,
        max: 1,
        default: 1,
        description: 'Layer visibility',
        modulatable: true,
        midiMappable: true,
        sinceVersion: '1.0.0'
      },
      {
        id: 'speed',
        name: 'Speed',
        type: 'number',
        min: 0.5,
        max: 5,
        default: 1,
        description: 'Travel speed',
        modulatable: true,
        midiMappable: true,
        sinceVersion: '1.0.0'
      },
      {
        id: 'gridSize',
        name: 'Grid Size',
        type: 'number',
        min: 5,
        max: 50,
        default: 20,
        description: 'Grid cell count',
        modulatable: true,
        midiMappable: true,
        sinceVersion: '1.0.0'
      },
      {
        id: 'lineWidth',
        name: 'Line Width',
        type: 'number',
        min: 0.01,
        max: 0.1,
        default: 0.02,
        description: 'Grid line thickness',
        modulatable: true,
        midiMappable: true,
        sinceVersion: '1.0.0'
      },
      {
        id: 'perspective',
        name: 'Perspective',
        type: 'number',
        min: 0.5,
        max: 2,
        default: 1,
        description: 'Perspective strength',
        modulatable: true,
        midiMappable: true,
        sinceVersion: '1.0.0'
      },
      {
        id: 'horizonY',
        name: 'Horizon Y',
        type: 'number',
        min: 0.3,
        max: 0.7,
        default: 0.5,
        description: 'Horizon line position',
        modulatable: true,
        midiMappable: true,
        sinceVersion: '1.0.0'
      },
      {
        id: 'glow',
        name: 'Glow',
        type: 'number',
        min: 0,
        max: 1,
        default: 0.5,
        description: 'Line glow intensity',
        modulatable: true,
        midiMappable: true,
        sinceVersion: '1.0.0'
      },
      {
        id: 'audioReact',
        name: 'Audio React',
        type: 'number',
        min: 0,
        max: 1,
        default: 0.3,
        description: 'Bass drives speed',
        modulatable: true,
        midiMappable: true,
        sinceVersion: '1.0.0'
      },
      {
        id: 'mode',
        name: 'Mode',
        type: 'enum',
        default: 0,
        options: [
          { value: 0, label: 'Floor' },
          { value: 1, label: 'Tunnel' },
          { value: 2, label: 'Box' }
        ],
        description: 'Grid arrangement',
        modulatable: false,
        midiMappable: true,
        sinceVersion: '1.0.0'
      }
    ]
  }
];

/**
 * Get layer type definition by ID
 */
export const getLayerType = (layerId: string): LayerTypeDef | undefined => {
  // Map old hardcoded IDs to layer types
  const idMapping: Record<string, string> = {
    'layer-plasma': 'plasma',
    'layer-spectrum': 'spectrum',
    'layer-origami': 'origami',
    'layer-glyph': 'glyph',
    'layer-crystal': 'crystal',
    'layer-inkflow': 'inkflow',
    'layer-topo': 'topo',
    'layer-weather': 'weather',
    'layer-portal': 'portal',
    'layer-media': 'media',
    'layer-oscillo': 'oscillo',
    'gen-laser-beam': 'laser-beam',
    'gen-strobe': 'strobe',
    'gen-shape-burst': 'shape-burst',
    'gen-grid-tunnel': 'grid-tunnel',
    'gen-lightning': 'lightning',
    'gen-analog-oscillo': 'analog-oscillo',
    'gen-speaker-cone': 'speaker-cone',
    'gen-glitch-scanline': 'glitch-scanline',
    'gen-laser-starfield': 'laser-starfield',
    'gen-pulsing-ribbons': 'pulsing-ribbons',
    'gen-electric-arc': 'electric-arc',
    'gen-pyro-burst': 'pyro-burst',
    'gen-geo-wireframe': 'geo-wireframe',
    'gen-signal-noise': 'signal-noise',
    'gen-infinite-wormhole': 'infinite-wormhole',
    'gen-ribbon-tunnel': 'ribbon-tunnel',
    'gen-fractal-tunnel': 'fractal-tunnel',
    'gen-circuit-conduit': 'circuit-conduit',
    'gen-aura-portal': 'aura-portal',
    'gen-freq-terrain': 'freq-terrain',
    'gen-data-stream': 'data-stream',
    'gen-caustic-liquid': 'caustic-liquid',
    'gen-shimmer-veil': 'shimmer-veil'
  };

  const type = idMapping[layerId] || layerId;
  return PARAMETER_REGISTRY.find(l => l.id === type);
};

/**
 * Get parameter definition for a layer type
 */
export const getParamDef = (layerType: string, paramId: string): ParamDef | undefined => {
  const layer = getLayerType(layerType);
  return layer?.params.find(p => p.id === paramId);
};

/**
 * Get parameter definition from full path (e.g., "layer-plasma.speed")
 */
export const getParamDefFromPath = (path: string): { layerType: string; param: ParamDef } | undefined => {
  const parts = path.split('.');
  if (parts.length < 2) return undefined;

  const layerId = parts[0];
  const paramId = parts.slice(1).join('.');

  const layerType = getLayerType(layerId);
  if (!layerType) return undefined;

  const param = layerType.params.find(p => p.id === paramId);
  if (!param) return undefined;

  return { layerType: layerType.id, param };
};

/**
 * Check if a parameter exists for a layer type
 */
export const paramExists = (layerType: string, paramId: string): boolean => {
  return getParamDef(layerType, paramId) !== undefined;
};

/**
 * Get all modulatable parameters for a layer type
 */
export const getModulatableParams = (layerType: string): ParamDef[] => {
  const layer = getLayerType(layerType);
  return layer?.params.filter(p => p.modulatable) ?? [];
};

/**
 * Get all MIDI-mappable parameters for a layer type
 */
export const getMidiMappableParams = (layerType: string): ParamDef[] => {
  const layer = getLayerType(layerType);
  return layer?.params.filter(p => p.midiMappable) ?? [];
};

/**
 * Validate parameter value against its definition
 */
export const validateParamValue = (layerType: string, paramId: string, value: any): { valid: boolean; error?: string } => {
  const param = getParamDef(layerType, paramId);
  if (!param) {
    return { valid: false, error: `Parameter ${paramId} not found for layer ${layerType}` };
  }

  if (param.type === 'number') {
    if (typeof value !== 'number') {
      return { valid: false, error: `Parameter ${paramId} must be a number` };
    }
    if (param.min !== undefined && value < param.min) {
      return { valid: false, error: `Parameter ${paramId} must be >= ${param.min}` };
    }
    if (param.max !== undefined && value > param.max) {
      return { valid: false, error: `Parameter ${paramId} must be <= ${param.max}` };
    }
  }

  if (param.type === 'boolean' && typeof value !== 'boolean') {
    return { valid: false, error: `Parameter ${paramId} must be a boolean` };
  }

  if (param.type === 'enum' && param.options) {
    const valid = param.options.some(opt => opt.value === value);
    if (!valid) {
      return { valid: false, error: `Parameter ${paramId} must be one of: ${param.options.map(o => o.value).join(', ')}` };
    }
  }

  return { valid: true };
};

/**
 * Clamp a value to parameter bounds
 */
export const clampParamValue = (layerType: string, paramId: string, value: number): number => {
  const param = getParamDef(layerType, paramId);
  if (!param || param.type !== 'number') return value;

  if (param.min !== undefined) value = Math.max(value, param.min);
  if (param.max !== undefined) value = Math.min(value, param.max);

  return value;
};

/**
 * Get default value for a parameter
 */
export const getParamDefault = (layerType: string, paramId: string): any => {
  const param = getParamDef(layerType, paramId);
  return param?.default;
};

/**
 * Get all available layer types
 */
export const getLayerTypes = (): LayerTypeDef[] => {
  return [...PARAMETER_REGISTRY];
};

/**
 * Check if a layer type exists
 */
export const layerTypeExists = (layerType: string): boolean => {
  return getLayerType(layerType) !== undefined;
};

/**
 * Parse a legacy target string (e.g., "layer-plasma.speed") into structured target
 */
export const parseLegacyTarget = (target: string): { layerType: string; param: string } | null => {
  const result = getParamDefFromPath(target);
  if (!result) return null;
  return { layerType: result.layerType, param: result.param.id };
};

/**
 * Build a legacy target string from structured target
 */
export const buildLegacyTarget = (layerType: string, param: string): string => {
  // Reverse the ID mapping
  const reverseMapping: Record<string, string> = {
    'plasma': 'layer-plasma',
    'spectrum': 'layer-spectrum',
    'origami': 'layer-origami',
    'glyph': 'layer-glyph',
    'crystal': 'layer-crystal',
    'inkflow': 'layer-inkflow',
    'topo': 'layer-topo',
    'weather': 'layer-weather',
    'portal': 'layer-portal',
    'oscillo': 'layer-oscillo'
  };

  const layerId = reverseMapping[layerType] || `layer-${layerType}`;
  return `${layerId}.${param}`;
};
