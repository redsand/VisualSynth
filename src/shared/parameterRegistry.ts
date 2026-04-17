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
    id: 'nebula-cloud',
    name: 'Nebula Cloud',
    description: 'Volumetric glowing gas clouds',
    sinceVersion: '1.4.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'density', name: 'Density', type: 'number', min: 0.1, max: 2, default: 1, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Drift Speed', type: 'number', min: 0.1, max: 3, default: 0.5, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'circuit-board',
    name: 'Circuit Board',
    description: 'Growing digital traces and pulsing nodes',
    sinceVersion: '1.4.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'growth', name: 'Growth Rate', type: 'number', min: 0.1, max: 2, default: 1, modulatable: true, midiMappable: true },
      { id: 'complexity', name: 'Detail Level', type: 'number', min: 1, max: 10, default: 5, modulatable: false, midiMappable: true }
    ]
  },
  {
    id: 'lorenz-attractor',
    name: 'Lorenz Attractor',
    description: 'Chaotic mathematical line trails',
    sinceVersion: '1.4.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Evolution Speed', type: 'number', min: 0.1, max: 5, default: 1, modulatable: true, midiMappable: true },
      { id: 'chaos', name: 'Chaos Amount', type: 'number', min: 0.1, max: 3, default: 1, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'mandala-spinner',
    name: 'Mandala Spinner',
    description: 'Recursive mirrored radial geometry',
    sinceVersion: '1.4.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'sides', name: 'Symmetry Sides', type: 'number', min: 3, max: 12, default: 6, modulatable: false, midiMappable: true },
      { id: 'speed', name: 'Spin Speed', type: 'number', min: 0.1, max: 5, default: 1, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'starburst-galaxy',
    name: 'Starburst Galaxy',
    description: 'Explosive radial particle clusters',
    sinceVersion: '1.4.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'force', name: 'Explosion Force', type: 'number', min: 0.1, max: 5, default: 1, modulatable: true, midiMappable: true },
      { id: 'count', name: 'Star Count', type: 'number', min: 10, max: 500, default: 100, modulatable: false, midiMappable: true }
    ]
  },
  {
    id: 'digital-rain-v2',
    name: 'Digital Rain V2',
    description: 'Cascading glyphs with perspective depth',
    sinceVersion: '1.4.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Drop Speed', type: 'number', min: 0.1, max: 5, default: 1, modulatable: true, midiMappable: true },
      { id: 'density', name: 'Stream Density', type: 'number', min: 0.1, max: 3, default: 1, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'lava-flow',
    name: 'Lava Flow',
    description: 'Viscous glowing fluid movement',
    sinceVersion: '1.4.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'heat', name: 'Lava Heat', type: 'number', min: 0.1, max: 2, default: 1, modulatable: true, midiMappable: true },
      { id: 'viscosity', name: 'Fluid Viscosity', type: 'number', min: 0.1, max: 5, default: 1, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'crystal-growth',
    name: 'Crystal Growth',
    description: 'Procedural branching crystal structures',
    sinceVersion: '1.4.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'rate', name: 'Growth Rate', type: 'number', min: 0.1, max: 2, default: 0.5, modulatable: true, midiMappable: true },
      { id: 'sharpness', name: 'Edge Sharpness', type: 'number', min: 0.1, max: 1, default: 0.8, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'techno-grid',
    name: 'Techno Grid',
    description: '3D perspective grid with pulsing towers',
    sinceVersion: '1.4.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'height', name: 'Tower Height', type: 'number', min: 0.1, max: 5, default: 1, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Scroll Speed', type: 'number', min: 0.1, max: 5, default: 1, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'magnetic-field',
    name: 'Magnetic Field',
    description: 'Flux lines reacting to audio energy',
    sinceVersion: '1.4.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'strength', name: 'Field Strength', type: 'number', min: 0.1, max: 5, default: 1, modulatable: true, midiMappable: true },
      { id: 'density', name: 'Line Density', type: 'number', min: 1, max: 50, default: 20, modulatable: false, midiMappable: true }
    ]
  },
  {
    id: 'prism-shards',
    name: 'Prism Shards',
    description: 'Refractive flying glass geometry',
    sinceVersion: '1.4.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'refraction', name: 'Refraction Index', type: 'number', min: 0.1, max: 2, default: 0.5, modulatable: true, midiMappable: true },
      { id: 'count', name: 'Shard Count', type: 'number', min: 1, max: 20, default: 5, modulatable: false, midiMappable: true }
    ]
  },
  {
    id: 'neural-net',
    name: 'Neural Net',
    description: 'Pulsing nodes and synapse connections',
    sinceVersion: '1.4.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'activity', name: 'Neural Activity', type: 'number', min: 0.1, max: 5, default: 1, modulatable: true, midiMappable: true },
      { id: 'density', name: 'Node Density', type: 'number', min: 0.1, max: 3, default: 1, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'aurora-chord',
    name: 'Aurora Chord',
    description: 'Audio-driven waving curtains of light',
    sinceVersion: '1.4.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'waviness', name: 'Wave Strength', type: 'number', min: 0.1, max: 5, default: 1, modulatable: true, midiMappable: true },
      { id: 'colorRange', name: 'Color Range', type: 'number', min: 0.1, max: 2, default: 1, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'vhs-glitch',
    name: 'VHS Glitch',
    description: 'Advanced analog tape distortion and jitter',
    sinceVersion: '1.4.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'jitter', name: 'Frame Jitter', type: 'number', min: 0, max: 1, default: 0.2, modulatable: true, midiMappable: true },
      { id: 'noise', name: 'Static Noise', type: 'number', min: 0, max: 1, default: 0.3, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'vhs-scanline',
    name: 'VHS Scanline',
    description: 'Classic VHS scanline effect with bands',
    sinceVersion: '1.4.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'moire-pattern',
    name: 'Moire Pattern',
    description: 'Interference patterns from rotating grids',
    sinceVersion: '1.4.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'scale', name: 'Grid Scale', type: 'number', min: 0.1, max: 10, default: 5, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Rotation Speed', type: 'number', min: 0.1, max: 5, default: 1, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'hypercube',
    name: 'Hypercube',
    description: 'Rotating 4D geometric projection',
    sinceVersion: '1.4.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'projection', name: '4D Projection', type: 'number', min: 0.1, max: 5, default: 1, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Spin Speed', type: 'number', min: 0.1, max: 5, default: 1, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'fluid-swirl',
    name: 'Fluid Swirl',
    description: 'Swirling ink and vortex simulation',
    sinceVersion: '1.4.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'vorticity', name: 'Vortex Strength', type: 'number', min: 0.1, max: 5, default: 1, modulatable: true, midiMappable: true },
      { id: 'colorMix', name: 'Color Blending', type: 'number', min: 0.1, max: 2, default: 1, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'ascii-stream',
    name: 'ASCII Stream',
    description: 'Real-time text-character pixelation',
    sinceVersion: '1.4.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'resolution', name: 'Char Resolution', type: 'number', min: 10, max: 100, default: 40, modulatable: false, midiMappable: true },
      { id: 'contrast', name: 'Text Contrast', type: 'number', min: 0.1, max: 2, default: 1, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'retro-wave',
    name: 'Retro Wave',
    description: 'Classic 80s sun and neon grid horizon',
    sinceVersion: '1.4.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'sunSize', name: 'Sun Scale', type: 'number', min: 0.1, max: 2, default: 1, modulatable: true, midiMappable: true },
      { id: 'gridSpeed', name: 'Scroll Speed', type: 'number', min: 0.1, max: 5, default: 1, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'bubble-pop',
    name: 'Bubble Pop',
    description: 'Expanding and bursting audio-synced cells',
    sinceVersion: '1.4.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'popRate', name: 'Burst Frequency', type: 'number', min: 0.1, max: 5, default: 1, modulatable: true, midiMappable: true },
      { id: 'size', name: 'Max Bubble Size', type: 'number', min: 0.1, max: 2, default: 0.5, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'sound-wave-3d',
    name: 'Sound Wave 3D',
    description: 'Extruded 3D spectral terrain',
    sinceVersion: '1.4.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'amplitude', name: 'Wave Height', type: 'number', min: 0.1, max: 5, default: 1, modulatable: true, midiMappable: true },
      { id: 'smoothness', name: 'Wave Smoothing', type: 'number', min: 0.1, max: 2, default: 1, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'particle-vortex',
    name: 'Particle Vortex',
    description: 'Massive swarm spiraling into a core',
    sinceVersion: '1.4.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'suction', name: 'Pull Strength', type: 'number', min: 0.1, max: 5, default: 1, modulatable: true, midiMappable: true },
      { id: 'spin', name: 'Vortex Spin', type: 'number', min: 0.1, max: 5, default: 1, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'glow-worms',
    name: 'Glow Worms',
    description: 'Wandering bioluminescent light trails',
    sinceVersion: '1.4.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'length', name: 'Trail Length', type: 'number', min: 0.1, max: 2, default: 1, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Worm Speed', type: 'number', min: 0.1, max: 5, default: 1, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'mirror-maze',
    name: 'Mirror Maze',
    description: 'Infinite geometric reflections',
    sinceVersion: '1.4.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'recursion', name: 'Mirror Depth', type: 'number', min: 1, max: 8, default: 4, modulatable: false, midiMappable: true },
      { id: 'angle', name: 'Mirror Angle', type: 'number', min: 0, max: 3.14, default: 0.78, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'pulse-heart',
    name: 'Pulse Heart',
    description: 'Expanding geometric central core',
    sinceVersion: '1.4.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'beats', name: 'Pulse Strength', type: 'number', min: 0.1, max: 5, default: 1, modulatable: true, midiMappable: true },
      { id: 'layers', name: 'Heart Layers', type: 'number', min: 1, max: 10, default: 5, modulatable: false, midiMappable: true }
    ]
  },
  {
    id: 'data-shards',
    name: 'Data Shards',
    description: 'Flying sharp polygons with data noise',
    sinceVersion: '1.4.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Fly Speed', type: 'number', min: 0.1, max: 5, default: 1, modulatable: true, midiMappable: true },
      { id: 'sharpness', name: 'Shard Detail', type: 'number', min: 0.1, max: 2, default: 1, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'hex-cell',
    name: 'Hex Cell',
    description: 'Pulsing hexagonal hive structure',
    sinceVersion: '1.4.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'pulse', name: 'Hive Pulse', type: 'number', min: 0.1, max: 5, default: 1, modulatable: true, midiMappable: true },
      { id: 'scale', name: 'Hex Scale', type: 'number', min: 0.1, max: 5, default: 1, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'plasma-ball',
    name: 'Plasma Ball',
    description: 'Electric filaments reacting to touch',
    sinceVersion: '1.4.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'voltage', name: 'Arc Energy', type: 'number', min: 0.1, max: 5, default: 1, modulatable: true, midiMappable: true },
      { id: 'filaments', name: 'Arc Count', type: 'number', min: 1, max: 20, default: 5, modulatable: false, midiMappable: true }
    ]
  },
  {
    id: 'warp-drive',
    name: 'Warp Drive',
    description: 'Hyper-speed star streaking',
    sinceVersion: '1.4.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'warp', name: 'Warp Factor', type: 'number', min: 0.1, max: 10, default: 1, modulatable: true, midiMappable: true },
      { id: 'glow', name: 'Streak Glow', type: 'number', min: 0.1, max: 2, default: 1, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'visual-feedback',
    name: 'Visual Feedback',
    description: 'Internal recursive buffer loops',
    sinceVersion: '1.4.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'zoom', name: 'Feedback Zoom', type: 'number', min: 0.9, max: 1.1, default: 1.01, modulatable: true, midiMappable: true },
      { id: 'rotation', name: 'Feedback Twist', type: 'number', min: -0.1, max: 0.1, default: 0.01, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'mycelium-growth',
    name: 'Mycelium Growth',
    description: 'Procedural organic branching network',
    sinceVersion: '1.4.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'spread', name: 'Spread Rate', type: 'number', min: 0.1, max: 5, default: 1, modulatable: true, midiMappable: true },
      { id: 'decay', name: 'Decay Speed', type: 'number', min: 0.1, max: 2, default: 0.5, modulatable: true, midiMappable: true }
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
        min: 0.1,
        max: 0.9,
        default: 0.3,
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
  },
  {
    id: 'cellular-growth',
    name: 'Cellular Growth',
    description: 'Biologically-inspired cellular automaton with organic expansion',
    sinceVersion: '1.5.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'rate', name: 'Growth Rate', type: 'number', min: 0.1, max: 2, default: 1, modulatable: true, midiMappable: true },
      { id: 'density', name: 'Cell Density', type: 'number', min: 0.1, max: 3, default: 0.8, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'bio-luminescent-forest',
    name: 'Bio-Luminescent Forest',
    description: 'Glowing organic forest with pulsing light patterns',
    sinceVersion: '1.5.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'pulse', name: 'Pulse Speed', type: 'number', min: 0.1, max: 5, default: 1, modulatable: true, midiMappable: true },
      { id: 'density', name: 'Tree Density', type: 'number', min: 0.1, max: 2, default: 0.7, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'crystalline',
    name: 'Crystalline',
    description: 'Dynamic crystal formation with light refraction',
    sinceVersion: '1.5.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'rotation', name: 'Rotation Speed', type: 'number', min: 0.1, max: 5, default: 1, modulatable: true, midiMappable: true },
      { id: 'refraction', name: 'Refraction Index', type: 'number', min: 0.1, max: 2, default: 0.5, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'audio-dna',
    name: 'Audio DNA',
    description: 'Audio-reactive double helix visualization',
    sinceVersion: '1.5.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'rotation', name: 'Rotation Speed', type: 'number', min: 0.1, max: 5, default: 1, modulatable: true, midiMappable: true },
      { id: 'segments', name: 'DNA Segments', type: 'number', min: 5, max: 50, default: 20, modulatable: false, midiMappable: true }
    ]
  },
  {
    id: 'liquid-metal',
    name: 'Liquid Metal',
    description: 'Fluid metallic surfaces with reflective properties',
    sinceVersion: '1.5.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'flow', name: 'Flow Speed', type: 'number', min: 0.1, max: 5, default: 1, modulatable: true, midiMappable: true },
      { id: 'shimmer', name: 'Metallic Shimmer', type: 'number', min: 0, max: 2, default: 0.5, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'neon-cityscape',
    name: 'Neon Cityscape',
    description: 'Cyberpunk city skyline with neon lights',
    sinceVersion: '1.5.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'City Speed', type: 'number', min: 0.1, max: 5, default: 1, modulatable: true, midiMappable: true },
      { id: 'density', name: 'Building Density', type: 'number', min: 0.1, max: 2, default: 0.6, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'cosmic-nebula',
    name: 'Cosmic Nebula',
    description: 'Deep space nebula with star formations',
    sinceVersion: '1.5.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'expansion', name: 'Nebula Expansion', type: 'number', min: 0.1, max: 3, default: 1, modulatable: true, midiMappable: true },
      { id: 'turbulence', name: 'Gas Turbulence', type: 'number', min: 0, max: 2, default: 0.5, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'sonic-rain',
    name: 'Sonic Rain',
    description: 'Audio-reactive falling particles with color gradients',
    sinceVersion: '1.5.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Fall Speed', type: 'number', min: 0.1, max: 5, default: 1, modulatable: true, midiMappable: true },
      { id: 'density', name: 'Particle Density', type: 'number', min: 0.1, max: 2, default: 0.8, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'morphing-geometry',
    name: 'Morphing Geometry',
    description: 'Shapeshifting geometric forms',
    sinceVersion: '1.5.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Morph Speed', type: 'number', min: 0.1, max: 5, default: 1, modulatable: true, midiMappable: true },
      { id: 'complexity', name: 'Shape Complexity', type: 'number', min: 0, max: 1, default: 0.7, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'urban-rhythm',
    name: 'Urban Rhythm',
    description: 'Beat-synchronized urban visualization',
    sinceVersion: '1.5.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'bpm', name: 'BPM Factor', type: 'number', min: 0.1, max: 5, default: 1, modulatable: true, midiMappable: true },
      { id: 'intensity', name: 'Beat Intensity', type: 'number', min: 0, max: 2, default: 0.6, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'crimson-veil',
    name: 'Crimson Veil',
    description: 'Dark crimson flowing fabric effect',
    sinceVersion: '1.6.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'flow', name: 'Flow', type: 'number', min: 0, max: 3, default: 1, modulatable: true, midiMappable: true },
      { id: 'darkness', name: 'Darkness', type: 'number', min: 0, max: 1, default: 0.5, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'victorian-crypt',
    name: 'Victorian Crypt',
    description: 'Gothic cathedral arches and vaulted ceilings',
    sinceVersion: '1.6.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'complexity', name: 'Complexity', type: 'number', min: 0, max: 5, default: 0.5, modulatable: true, midiMappable: true },
      { id: 'decay', name: 'Decay', type: 'number', min: 0, max: 1, default: 0.5, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'spectral-apparition',
    name: 'Spectral Apparition',
    description: 'Ghostly figures drifting',
    sinceVersion: '1.6.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'density', name: 'Density', type: 'number', min: 0, max: 2, default: 0.5, modulatable: true, midiMappable: true },
      { id: 'fade', name: 'Fade', type: 'number', min: 0, max: 1, default: 0.5, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'gothic-cobwebs',
    name: 'Gothic Cobwebs',
    description: 'Spider webs with dew drops',
    sinceVersion: '1.6.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'density', name: 'Density', type: 'number', min: 0, max: 2, default: 0.5, modulatable: true, midiMappable: true },
      { id: 'decay', name: 'Decay', type: 'number', min: 0, max: 1, default: 0.5, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'blood-moon-rise',
    name: 'Blood Moon Rise',
    description: 'Eerie red moon rising over dark landscape',
    sinceVersion: '1.6.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'eclipse', name: 'Eclipse', type: 'number', min: 0, max: 1, default: 0.5, modulatable: true, midiMappable: true },
      { id: 'glow', name: 'Glow', type: 'number', min: 0, max: 2, default: 0.5, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'candlelight-vigil',
    name: 'Candlelight Vigil',
    description: 'Flickering candles in darkness',
    sinceVersion: '1.6.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'flicker', name: 'Flicker', type: 'number', min: 0, max: 2, default: 0.5, modulatable: true, midiMappable: true },
      { id: 'decay', name: 'Decay', type: 'number', min: 0, max: 1, default: 0.5, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'gargoyles-awake',
    name: 'Gargoyles Awake',
    description: 'Stone gargoyles with animated shadows',
    sinceVersion: '1.6.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'animation', name: 'Animation', type: 'number', min: 0, max: 1, default: 0.5, modulatable: true, midiMappable: true },
      { id: 'shadow', name: 'Shadow', type: 'number', min: 0, max: 1, default: 0.5, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'crypt-shadows',
    name: 'Crypt Shadows',
    description: 'Dark shadows in catacombs',
    sinceVersion: '1.6.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'depth', name: 'Depth', type: 'number', min: 0, max: 2, default: 0.5, modulatable: true, midiMappable: true },
      { id: 'movement', name: 'Movement', type: 'number', min: 0, max: 1, default: 0.5, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'gothic-rose',
    name: 'Gothic Rose',
    description: 'Dark wilted roses with falling petals',
    sinceVersion: '1.6.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'decay', name: 'Decay', type: 'number', min: 0, max: 1, default: 0.5, modulatable: true, midiMappable: true },
      { id: 'thorns', name: 'Thorns', type: 'number', min: 0, max: 1, default: 0.5, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'eternal-darkness',
    name: 'Eternal Darkness',
    description: 'Pure black void with subtle gothic elements',
    sinceVersion: '1.6.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'void', name: 'Void', type: 'number', min: 0, max: 1, default: 0.5, modulatable: true, midiMappable: true },
      { id: 'traces', name: 'Traces', type: 'number', min: 0, max: 2, default: 0.5, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'pixel-dust',
    name: 'Pixel Dust',
    description: 'Floating pixel particles with 8-bit aesthetic',
    sinceVersion: '1.7.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'density', name: 'Density', type: 'number', min: 0, max: 2, default: 0.5, modulatable: true, midiMappable: true },
      { id: 'pixelSize', name: 'Pixel Size', type: 'number', min: 0.005, max: 0.1, default: 0.02, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'retro-starfield',
    name: 'Retro Starfield',
    description: 'Classic scrolling space background',
    sinceVersion: '1.7.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Speed', type: 'number', min: 0, max: 3, default: 1, modulatable: true, midiMappable: true },
      { id: 'size', name: 'Star Size', type: 'number', min: 0.005, max: 0.05, default: 0.01, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: '8bit-grid',
    name: '8-Bit Grid',
    description: 'Pixelated grid pattern with game-style movement',
    sinceVersion: '1.7.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Speed', type: 'number', min: 0, max: 3, default: 1, modulatable: true, midiMappable: true },
      { id: 'pixelSize', name: 'Pixel Size', type: 'number', min: 0.005, max: 0.1, default: 0.02, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'arcade-invaders',
    name: 'Arcade Invaders',
    description: 'Retro alien invasion patterns',
    sinceVersion: '1.7.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'density', name: 'Density', type: 'number', min: 0, max: 2, default: 0.5, modulatable: true, midiMappable: true },
      { id: 'animation', name: 'Animation', type: 'number', min: 0, max: 1, default: 0.5, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'power-up-pulse',
    name: 'Power-Up Pulse',
    description: 'Glowing power-up orbs with retro colors',
    sinceVersion: '1.7.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'intensity', name: 'Intensity', type: 'number', min: 0, max: 2, default: 0.5, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Speed', type: 'number', min: 0, max: 3, default: 1, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'dungeon-tiles',
    name: 'Dungeon Tiles',
    description: 'Retro RPG dungeon floor pattern',
    sinceVersion: '1.7.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'pattern', name: 'Pattern', type: 'number', min: 0, max: 1, default: 0.5, modulatable: true, midiMappable: true },
      { id: 'animation', name: 'Animation', type: 'number', min: 0, max: 1, default: 0.5, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'chiptune-wave',
    name: 'Chiptune Wave',
    description: 'Audio-reactive 8-bit wave visualization',
    sinceVersion: '1.7.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'bits', name: 'Bits', type: 'number', min: 1, max: 8, default: 4, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Speed', type: 'number', min: 0, max: 3, default: 1, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'score-counter',
    name: 'Score Counter',
    description: 'Retro game score display elements',
    sinceVersion: '1.7.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'digits', name: 'Digits', type: 'number', min: 3, max: 10, default: 6, modulatable: true, midiMappable: true },
      { id: 'animation', name: 'Animation', type: 'number', min: 0, max: 3, default: 1, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'pixel-rain',
    name: 'Pixel Rain',
    description: 'Falling pixels like Matrix but game-style',
    sinceVersion: '1.7.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'density', name: 'Density', type: 'number', min: 0, max: 2, default: 0.5, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Speed', type: 'number', min: 0, max: 3, default: 1, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'boss-health',
    name: 'Boss Health',
    description: 'Retro boss health bar visualization',
    sinceVersion: '1.7.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'value', name: 'Health Value', type: 'number', min: 0, max: 1, default: 0.5, modulatable: true, midiMappable: true },
      { id: 'bars', name: 'Health Bars', type: 'number', min: 1, max: 5, default: 3, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'milkwave',
    name: 'Milkwave Import',
    description: 'Imported Milkwave/MilkDrop preset with custom shader',
    sinceVersion: '1.4.0',
    params: [
      { id: 'enabled', name: 'Enabled', type: 'boolean', default: true, modulatable: false, midiMappable: false },
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'zoom', name: 'Zoom', type: 'number', min: 0.5, max: 2, default: 1, modulatable: true, midiMappable: true },
      { id: 'rotation', name: 'Rotation', type: 'number', min: -3.14, max: 3.14, default: 0, modulatable: true, midiMappable: true },
      { id: 'warp', name: 'Warp', type: 'number', min: 0, max: 1, default: 0.01, modulatable: true, midiMappable: true },
      { id: 'decay', name: 'Decay', type: 'number', min: 0.8, max: 1, default: 0.95, modulatable: true, midiMappable: true },
      { id: 'gamma', name: 'Gamma', type: 'number', min: 0.5, max: 2, default: 1.0, modulatable: true, midiMappable: true },
      { id: 'bassSensitivity', name: 'Bass Sensitivity', type: 'number', min: 0, max: 2, default: 1, modulatable: true, midiMappable: true },
      { id: 'midSensitivity', name: 'Mid Sensitivity', type: 'number', min: 0, max: 2, default: 1, modulatable: true, midiMappable: true },
      { id: 'trebSensitivity', name: 'Treble Sensitivity', type: 'number', min: 0, max: 2, default: 1, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'sdf',
    name: 'SDF Shapes',
    description: 'Signed distance field shapes with glow',
    sinceVersion: '1.0.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'shape', name: 'Shape', type: 'number', min: 0, max: 5, default: 0, modulatable: true, midiMappable: true },
      { id: 'scale', name: 'Scale', type: 'number', min: 0.1, max: 1, default: 0.5, modulatable: true, midiMappable: true },
      { id: 'edge', name: 'Edge', type: 'number', min: 0, max: 0.5, default: 0.05, modulatable: true, midiMappable: true },
      { id: 'glow', name: 'Glow', type: 'number', min: 0, max: 1, default: 0.5, modulatable: true, midiMappable: true },
      { id: 'rotation', name: 'Rotation', type: 'number', min: 0, max: 6.28, default: 0, modulatable: true, midiMappable: true },
      { id: 'fill', name: 'Fill', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'sdf-scene',
    name: 'SDF Scene',
    description: 'Advanced 3D signed distance field scene with raymarching',
    sinceVersion: '1.0.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'tunnel-warp',
    name: 'Tunnel Warp',
    description: 'Warped tunnel effect with grid lines',
    sinceVersion: '1.0.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'nebula-drift',
    name: 'Nebula Drift',
    description: 'Drifting nebula cloud effect',
    sinceVersion: '1.0.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'fractal-bloom',
    name: 'Fractal Bloom',
    description: 'Fractal blooming pattern',
    sinceVersion: '1.0.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'kaleido-shard',
    name: 'Kaleido Shard',
    description: 'Kaleidoscopic shard pattern',
    sinceVersion: '1.0.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'glitch-datamosh',
    name: 'Glitch Datamosh',
    description: 'Datamoshing glitch effect',
    sinceVersion: '1.0.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'particle-swarm',
    name: 'Particle Swarm',
    description: 'Swarming particle system',
    sinceVersion: '1.0.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'particles',
    name: 'Particles',
    description: 'Basic particle system',
    sinceVersion: '1.0.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'neon-wireframe',
    name: 'Neon Wireframe',
    description: 'Neon wireframe geometry',
    sinceVersion: '1.0.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'organic-fluid',
    name: 'Organic Fluid',
    description: 'Organic fluid simulation',
    sinceVersion: '1.0.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'cosmic-aurora',
    name: 'Cosmic Aurora',
    description: 'Cosmic aurora effect',
    sinceVersion: '1.0.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'typography-reveal',
    name: 'Typography Reveal',
    description: 'Animated text reveal',
    sinceVersion: '1.0.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'moire-pattern',
    name: 'Moire Pattern',
    description: 'Interference patterns from rotating grids',
    sinceVersion: '1.4.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'scale', name: 'Grid Scale', type: 'number', min: 0.1, max: 10, default: 5, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Rotation Speed', type: 'number', min: 0.1, max: 5, default: 1, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'audio-geometry',
    name: 'Audio Geometry',
    description: 'Audio-reactive geometry',
    sinceVersion: '1.0.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'asset-vortex',
    name: 'Asset Vortex',
    description: 'Warp asset into a swirling vortex',
    sinceVersion: '1.8.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 0.8, modulatable: true, midiMappable: true },
      { id: 'strength', name: 'Strength', type: 'number', min: 0, max: 5, default: 2.0, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Speed', type: 'number', min: 0, max: 5, default: 1.0, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'asset-slices',
    name: 'Asset Slices',
    description: 'Slice asset into audio-reactive bands',
    sinceVersion: '1.8.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 0.8, modulatable: true, midiMappable: true },
      { id: 'count', name: 'Slices', type: 'number', min: 2, max: 64, default: 16.0, modulatable: true, midiMappable: true },
      { id: 'shift', name: 'Shift Amount', type: 'number', min: 0, max: 2, default: 0.3, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'asset-polar',
    name: 'Asset Polar Warp',
    description: 'Warp asset into polar coordinates',
    sinceVersion: '1.8.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 0.8, modulatable: true, midiMappable: true },
      { id: 'radius', name: 'Radius', type: 'number', min: 0.1, max: 2, default: 0.5, modulatable: true, midiMappable: true },
      { id: 'twist', name: 'Twist', type: 'number', min: -5, max: 5, default: 1.0, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'asset-mosaic',
    name: 'Asset Mosaic',
    description: 'Tile and flip asset in a grid',
    sinceVersion: '1.8.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 0.8, modulatable: true, midiMappable: true },
      { id: 'tiles', name: 'Tiles', type: 'number', min: 1, max: 20, default: 8.0, modulatable: true, midiMappable: true },
      { id: 'flip', name: 'Audio Flip', type: 'number', min: 0, max: 1, default: 0.5, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'asset-ripple',
    name: 'Asset Ripples',
    description: 'Concentric ripples on asset',
    sinceVersion: '1.8.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 0.8, modulatable: true, midiMappable: true },
      { id: 'amplitude', name: 'Amplitude', type: 'number', min: 0, max: 0.5, default: 0.03, modulatable: true, midiMappable: true },
      { id: 'frequency', name: 'Frequency', type: 'number', min: 1, max: 100, default: 20.0, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'asset-scatter',
    name: 'Asset Scatter',
    description: 'Randomly scatter pixels of asset',
    sinceVersion: '1.8.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 0.8, modulatable: true, midiMappable: true },
      { id: 'amount', name: 'Amount', type: 'number', min: 0, max: 0.5, default: 0.02, modulatable: true, midiMappable: true },
      { id: 'seed', name: 'Seed', type: 'number', min: 0, max: 100, default: 1.0, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'asset-echo',
    name: 'Asset Echo Ghosts',
    description: 'Multiple delayed ghost copies of asset',
    sinceVersion: '1.8.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 0.8, modulatable: true, midiMappable: true },
      { id: 'count', name: 'Echo Count', type: 'number', min: 1, max: 5, default: 3.0, modulatable: true, midiMappable: true },
      { id: 'spread', name: 'Spread', type: 'number', min: 0, max: 1, default: 0.15, modulatable: true, midiMappable: true },
      { id: 'fade', name: 'Fade', type: 'number', min: 0.1, max: 1, default: 0.6, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'signal-noise',
    name: 'Signal Noise',
    description: 'Generative signal noise and scanlines',
    sinceVersion: '1.8.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1.0, modulatable: true, midiMappable: true },
      { id: 'amount', name: 'Amount', type: 'number', min: 0, max: 1, default: 0.5, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'voronoi-tessellation',
    name: 'Voronoi Tessellation',
    description: 'Cell-based Voronoi diagram with audio-reactive coloring',
    sinceVersion: '2.0.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Speed', type: 'number', min: 0.1, max: 3, default: 1, modulatable: true, midiMappable: true },
      { id: 'scale', name: 'Scale', type: 'number', min: 2, max: 20, default: 8, modulatable: true, midiMappable: true },
      { id: 'edgeWidth', name: 'Edge Width', type: 'number', min: 0.01, max: 0.3, default: 0.05, modulatable: true, midiMappable: true },
      { id: 'colorMode', name: 'Color Mode', type: 'enum', default: 0, options: [{value: 0, label: 'Spectrum'}, {value: 1, label: 'Heat'}, {value: 2, label: 'Neon'}], modulatable: false, midiMappable: true }
    ]
  },
  {
    id: 'choropleth-wave',
    name: 'Choropleth Wave',
    description: 'Heatmap-style grid with spectrum-driven color bands',
    sinceVersion: '2.0.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Speed', type: 'number', min: 0.1, max: 3, default: 1, modulatable: true, midiMappable: true },
      { id: 'gridSize', name: 'Grid Size', type: 'number', min: 4, max: 32, default: 12, modulatable: true, midiMappable: true },
      { id: 'heatMode', name: 'Heat Mode', type: 'enum', default: 0, options: [{value: 0, label: 'Spectrum'}, {value: 1, label: 'RMS'}, {value: 2, label: 'Peak'}], modulatable: false, midiMappable: true },
      { id: 'smoothing', name: 'Border Smooth', type: 'number', min: 0.01, max: 0.2, default: 0.05, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'sankey-flow',
    name: 'Sankey Flow',
    description: 'Flowing sankey diagram with audio-driven stream widths',
    sinceVersion: '2.0.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Speed', type: 'number', min: 0.1, max: 3, default: 1, modulatable: true, midiMappable: true },
      { id: 'flowCount', name: 'Flow Count', type: 'number', min: 2, max: 8, default: 5, modulatable: false, midiMappable: true },
      { id: 'spread', name: 'Spread', type: 'number', min: 0.5, max: 3, default: 1.5, modulatable: true, midiMappable: true },
      { id: 'colorSeed', name: 'Color Seed', type: 'number', min: 0, max: 1, default: 0.3, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'scatter-plot',
    name: 'Scatter Plot',
    description: 'Audio-reactive scattered data points with trails',
    sinceVersion: '2.0.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Speed', type: 'number', min: 0.1, max: 3, default: 1, modulatable: true, midiMappable: true },
      { id: 'density', name: 'Density', type: 'number', min: 0.1, max: 1, default: 0.5, modulatable: true, midiMappable: true },
      { id: 'pointSize', name: 'Point Size', type: 'number', min: 0.002, max: 0.03, default: 0.008, modulatable: true, midiMappable: true },
      { id: 'trail', name: 'Trail Length', type: 'number', min: 0, max: 1, default: 0.3, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'radial-bar',
    name: 'Radial Bar',
    description: 'Circular bar chart with spectrum-driven arc lengths',
    sinceVersion: '2.0.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Speed', type: 'number', min: 0.1, max: 3, default: 1, modulatable: true, midiMappable: true },
      { id: 'count', name: 'Bar Count', type: 'number', min: 4, max: 64, default: 24, modulatable: false, midiMappable: true },
      { id: 'width', name: 'Bar Width', type: 'number', min: 0.01, max: 0.1, default: 0.04, modulatable: true, midiMappable: true },
      { id: 'innerRadius', name: 'Inner Radius', type: 'number', min: 0.05, max: 0.5, default: 0.2, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'reaction-diffusion',
    name: 'Reaction Diffusion',
    description: 'Turing-pattern reaction-diffusion simulation',
    sinceVersion: '2.0.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Speed', type: 'number', min: 0.1, max: 3, default: 1, modulatable: true, midiMappable: true },
      { id: 'feed', name: 'Feed Rate', type: 'number', min: 0.01, max: 0.1, default: 0.055, modulatable: true, midiMappable: true },
      { id: 'kill', name: 'Kill Rate', type: 'number', min: 0.01, max: 0.1, default: 0.062, modulatable: true, midiMappable: true },
      { id: 'scale', name: 'Scale', type: 'number', min: 2, max: 10, default: 5, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'penrose-tiling',
    name: 'Penrose Tiling',
    description: 'Aperiodic golden-ratio tiling with audio color shifts',
    sinceVersion: '2.0.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Speed', type: 'number', min: 0.1, max: 3, default: 1, modulatable: true, midiMappable: true },
      { id: 'scale', name: 'Scale', type: 'number', min: 1, max: 10, default: 3, modulatable: true, midiMappable: true },
      { id: 'rotation', name: 'Rotation', type: 'number', min: 0, max: 6.28, default: 0, modulatable: true, midiMappable: true },
      { id: 'highlight', name: 'Highlight', type: 'number', min: 0.1, max: 0.8, default: 0.4, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'strange-attractor',
    name: 'Strange Attractor',
    description: 'De Jong/Clifford strange attractor with luminous trails',
    sinceVersion: '2.0.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Speed', type: 'number', min: 0.1, max: 3, default: 1, modulatable: true, midiMappable: true },
      { id: 'type', name: 'Attractor Type', type: 'enum', default: 0, options: [{value: 0, label: 'Clifford'}, {value: 1, label: 'De Jong'}, {value: 2, label: 'Bedhead'}], modulatable: false, midiMappable: true },
      { id: 'trail', name: 'Trail Length', type: 'number', min: 0.1, max: 1, default: 0.5, modulatable: true, midiMappable: true },
      { id: 'color', name: 'Color Offset', type: 'number', min: 0, max: 1, default: 0.5, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'l-system',
    name: 'L-System',
    description: 'Recursive fractal branching with audio growth',
    sinceVersion: '2.0.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Speed', type: 'number', min: 0.1, max: 3, default: 1, modulatable: true, midiMappable: true },
      { id: 'generations', name: 'Generations', type: 'number', min: 2, max: 8, default: 5, modulatable: false, midiMappable: true },
      { id: 'angle', name: 'Branch Angle', type: 'number', min: 0.2, max: 1.5, default: 0.78, modulatable: true, midiMappable: true },
      { id: 'branchScale', name: 'Branch Scale', type: 'number', min: 0.3, max: 0.9, default: 0.7, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'raymarch-terrain',
    name: 'Raymarch Terrain',
    description: '3D raymarched terrain with fog and height coloring',
    sinceVersion: '2.0.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Speed', type: 'number', min: 0.1, max: 3, default: 1, modulatable: true, midiMappable: true },
      { id: 'height', name: 'Height Scale', type: 'number', min: 0.1, max: 2, default: 0.8, modulatable: true, midiMappable: true },
      { id: 'detail', name: 'Detail Octaves', type: 'number', min: 2, max: 8, default: 5, modulatable: false, midiMappable: true },
      { id: 'fog', name: 'Fog Density', type: 'number', min: 0.01, max: 0.3, default: 0.08, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'spirograph',
    name: 'Spirograph',
    description: 'Harmonograph spirograph with parametric curve rendering',
    sinceVersion: '2.0.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Speed', type: 'number', min: 0.1, max: 3, default: 1, modulatable: true, midiMappable: true },
      { id: 'innerRatio', name: 'Inner Ratio', type: 'number', min: 0.1, max: 0.9, default: 0.35, modulatable: true, midiMappable: true },
      { id: 'penOffset', name: 'Pen Offset', type: 'number', min: 0.1, max: 2, default: 0.8, modulatable: true, midiMappable: true },
      { id: 'rotations', name: 'Rotations', type: 'number', min: 1, max: 20, default: 8, modulatable: false, midiMappable: true }
    ]
  },
  {
    id: 'uv-feedback',
    name: 'UV Feedback',
    description: 'Recursive UV distortion feedback loop',
    sinceVersion: '2.0.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Speed', type: 'number', min: 0.1, max: 3, default: 1, modulatable: true, midiMappable: true },
      { id: 'iterations', name: 'Iterations', type: 'number', min: 2, max: 10, default: 5, modulatable: false, midiMappable: true },
      { id: 'distortion', name: 'Distortion', type: 'number', min: 0, max: 5, default: 1, modulatable: true, midiMappable: true },
      { id: 'zoom', name: 'Zoom', type: 'number', min: 0, max: 3, default: 0.5, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'droste-effect',
    name: 'Droste Effect',
    description: 'Recursive picture-in-picture infinite zoom',
    sinceVersion: '2.0.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Speed', type: 'number', min: 0.1, max: 3, default: 1, modulatable: true, midiMappable: true },
      { id: 'zoomRate', name: 'Zoom Rate', type: 'number', min: 0.05, max: 0.5, default: 0.15, modulatable: true, midiMappable: true },
      { id: 'rotations', name: 'Rotations', type: 'number', min: 0, max: 3, default: 0.5, modulatable: true, midiMappable: true },
      { id: 'frameCount', name: 'Frame Count', type: 'number', min: 2, max: 12, default: 6, modulatable: false, midiMappable: true }
    ]
  },
  {
    id: 'equalizer-matrix',
    name: 'Equalizer Matrix',
    description: 'Multi-row perspective equalizer with depth',
    sinceVersion: '2.0.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Speed', type: 'number', min: 0.1, max: 3, default: 1, modulatable: true, midiMappable: true },
      { id: 'rows', name: 'Rows', type: 'number', min: 4, max: 16, default: 8, modulatable: false, midiMappable: true },
      { id: 'gap', name: 'Row Gap', type: 'number', min: 0, max: 0.5, default: 0.1, modulatable: true, midiMappable: true },
      { id: 'depth', name: 'Perspective Depth', type: 'number', min: 0, max: 1, default: 0.5, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'metaball',
    name: 'Metaball',
    description: 'Isosurface metaball blob merging with audio-reactive radii',
    sinceVersion: '2.0.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Speed', type: 'number', min: 0.1, max: 3, default: 1, modulatable: true, midiMappable: true },
      { id: 'count', name: 'Ball Count', type: 'number', min: 2, max: 8, default: 5, modulatable: false, midiMappable: true },
      { id: 'threshold', name: 'Threshold', type: 'number', min: 0.5, max: 3, default: 1.5, modulatable: true, midiMappable: true },
      { id: 'scale', name: 'Scale', type: 'number', min: 1, max: 4, default: 2, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'interference-pattern',
    name: 'Interference Pattern',
    description: 'Wave interference from multiple point sources',
    sinceVersion: '2.0.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Speed', type: 'number', min: 0.1, max: 3, default: 1, modulatable: true, midiMappable: true },
      { id: 'sourceCount', name: 'Sources', type: 'number', min: 2, max: 8, default: 4, modulatable: false, midiMappable: true },
      { id: 'wavelength', name: 'Wavelength', type: 'number', min: 0.05, max: 0.5, default: 0.2, modulatable: true, midiMappable: true },
      { id: 'mode', name: 'Decay Mode', type: 'enum', default: 0, options: [{value: 0, label: 'None'}, {value: 1, label: 'Exponential'}, {value: 2, label: 'Inverse'}], modulatable: false, midiMappable: true }
    ]
  },
  {
    id: 'terrain-hypsometric',
    name: 'Terrain Hypsometric',
    description: 'Color-banded hypsometric terrain with contour lines',
    sinceVersion: '2.0.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Speed', type: 'number', min: 0.1, max: 3, default: 1, modulatable: true, midiMappable: true },
      { id: 'scale', name: 'Scale', type: 'number', min: 1, max: 10, default: 3, modulatable: true, midiMappable: true },
      { id: 'contourInterval', name: 'Contour Interval', type: 'number', min: 0.05, max: 0.3, default: 0.12, modulatable: true, midiMappable: true },
      { id: 'elevation', name: 'Elevation', type: 'number', min: 0.1, max: 2, default: 1, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'phyllotaxis',
    name: 'Phyllotaxis',
    description: 'Fibonacci sunflower spiral phyllotaxis arrangement',
    sinceVersion: '2.0.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Speed', type: 'number', min: 0.1, max: 3, default: 1, modulatable: true, midiMappable: true },
      { id: 'count', name: 'Element Count', type: 'number', min: 20, max: 300, default: 150, modulatable: false, midiMappable: true },
      { id: 'pointSize', name: 'Point Size', type: 'number', min: 0.002, max: 0.03, default: 0.01, modulatable: true, midiMappable: true },
      { id: 'spread', name: 'Spread Radius', type: 'number', min: 0.3, max: 1, default: 0.7, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'deep-ocean',
    name: 'Deep Ocean',
    description: 'Bioluminescent deep ocean with caustic light shafts',
    sinceVersion: '2.0.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Speed', type: 'number', min: 0.1, max: 3, default: 1, modulatable: true, midiMappable: true },
      { id: 'depth', name: 'Depth', type: 'number', min: 0, max: 1, default: 0.5, modulatable: true, midiMappable: true },
      { id: 'biolum', name: 'Bioluminescence', type: 'number', min: 0, max: 2, default: 1, modulatable: true, midiMappable: true },
      { id: 'caustic', name: 'Caustic Strength', type: 'number', min: 0, max: 2, default: 1, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'holographic-prism',
    name: 'Holographic Prism',
    description: 'Rainbow prism refraction with holographic scanlines',
    sinceVersion: '2.0.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Speed', type: 'number', min: 0.1, max: 3, default: 1, modulatable: true, midiMappable: true },
      { id: 'dispersion', name: 'Dispersion', type: 'number', min: 0.1, max: 3, default: 1, modulatable: true, midiMappable: true },
      { id: 'angle', name: 'Prism Angle', type: 'number', min: 0, max: 6.28, default: 0, modulatable: true, midiMappable: true },
      { id: 'facets', name: 'Facets', type: 'number', min: 3, max: 12, default: 6, modulatable: false, midiMappable: true }
    ]
  },
  {
    id: 'boids',
    name: 'Boids',
    description: 'Flocking simulation with separation, alignment, and cohesion',
    sinceVersion: '2.0.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Speed', type: 'number', min: 0.1, max: 3, default: 1, modulatable: true, midiMappable: true },
      { id: 'count', name: 'Boid Count', type: 'number', min: 10, max: 60, default: 30, modulatable: false, midiMappable: true },
      { id: 'cohesion', name: 'Cohesion', type: 'number', min: 0, max: 2, default: 1, modulatable: true, midiMappable: true },
      { id: 'visualRange', name: 'Visual Range', type: 'number', min: 0.1, max: 1, default: 0.5, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'flow-field',
    name: 'Flow Field',
    description: 'Curl noise flow field with visible streamlines',
    sinceVersion: '2.0.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Speed', type: 'number', min: 0.1, max: 3, default: 1, modulatable: true, midiMappable: true },
      { id: 'scale', name: 'Noise Scale', type: 'number', min: 0.5, max: 5, default: 2, modulatable: true, midiMappable: true },
      { id: 'curlIntensity', name: 'Curl Intensity', type: 'number', min: 0.5, max: 5, default: 2, modulatable: true, midiMappable: true },
      { id: 'lineCount', name: 'Streamlines', type: 'number', min: 20, max: 80, default: 40, modulatable: false, midiMappable: true }
    ]
  },
  {
    id: 'stained-glass',
    name: 'Stained Glass',
    description: 'Voronoi stained glass with directional light transmission',
    sinceVersion: '2.0.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Speed', type: 'number', min: 0.1, max: 3, default: 1, modulatable: true, midiMappable: true },
      { id: 'scale', name: 'Scale', type: 'number', min: 3, max: 15, default: 6, modulatable: true, midiMappable: true },
      { id: 'lightAngle', name: 'Light Angle', type: 'number', min: 0, max: 6.28, default: 0.8, modulatable: true, midiMappable: true },
      { id: 'leadWidth', name: 'Lead Width', type: 'number', min: 0.01, max: 0.15, default: 0.05, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'hillshade',
    name: 'Hillshade',
    description: 'Directional hillshading with normal-based lighting',
    sinceVersion: '2.0.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Speed', type: 'number', min: 0.1, max: 3, default: 1, modulatable: true, midiMappable: true },
      { id: 'scale', name: 'Scale', type: 'number', min: 1, max: 10, default: 3, modulatable: true, midiMappable: true },
      { id: 'lightAzimuth', name: 'Light Azimuth', type: 'number', min: 0, max: 6.28, default: 2.5, modulatable: true, midiMappable: true },
      { id: 'vertical', name: 'Relief Height', type: 'number', min: 0.5, max: 5, default: 2, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'truchet-tiles',
    name: 'Truchet Tiles',
    description: 'Arc-based Truchet tile patterns with audio-reactive nodes',
    sinceVersion: '2.0.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Speed', type: 'number', min: 0.1, max: 3, default: 1, modulatable: true, midiMappable: true },
      { id: 'scale', name: 'Scale', type: 'number', min: 3, max: 20, default: 8, modulatable: true, midiMappable: true },
      { id: 'arcWidth', name: 'Arc Width', type: 'number', min: 0.01, max: 0.15, default: 0.06, modulatable: true, midiMappable: true },
      { id: 'style', name: 'Style', type: 'enum', default: 0, options: [{value: 0, label: 'Diagonal'}, {value: 1, label: 'Cross'}, {value: 2, label: 'Mixed'}], modulatable: false, midiMappable: true }
    ]
  },
  {
    id: 'spectrogram',
    name: 'Spectrogram',
    description: 'Scrolling time-frequency spectrogram display',
    sinceVersion: '2.0.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Speed', type: 'number', min: 0.5, max: 5, default: 2, modulatable: true, midiMappable: true },
      { id: 'freqScale', name: 'Freq Scale', type: 'number', min: 0.5, max: 3, default: 1, modulatable: true, midiMappable: true },
      { id: 'history', name: 'History Depth', type: 'number', min: 2, max: 20, default: 10, modulatable: false, midiMappable: true },
      { id: 'colorMap', name: 'Color Map', type: 'enum', default: 0, options: [{value: 0, label: 'Heat'}, {value: 1, label: 'Palette'}, {value: 2, label: 'Viridis'}], modulatable: false, midiMappable: true }
    ]
  },
  {
    id: 'crosshatch',
    name: 'Crosshatch',
    description: 'Crosshatch and stipple engraving pattern',
    sinceVersion: '2.0.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Speed', type: 'number', min: 0.1, max: 3, default: 1, modulatable: true, midiMappable: true },
      { id: 'density', name: 'Density', type: 'number', min: 5, max: 40, default: 15, modulatable: true, midiMappable: true },
      { id: 'angle1', name: 'Angle 1', type: 'number', min: 0, max: 3.14, default: 0.78, modulatable: true, midiMappable: true },
      { id: 'angle2', name: 'Angle 2', type: 'number', min: 0, max: 3.14, default: 2.35, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'shatter',
    name: 'Shatter',
    description: 'Voronoi shatter fracture with crack propagation',
    sinceVersion: '2.0.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Speed', type: 'number', min: 0.1, max: 3, default: 1, modulatable: true, midiMappable: true },
      { id: 'spread', name: 'Spread', type: 'number', min: 0.1, max: 1, default: 0.4, modulatable: true, midiMappable: true },
      { id: 'shardCount', name: 'Shard Count', type: 'number', min: 5, max: 20, default: 12, modulatable: false, midiMappable: true },
      { id: 'rotation', name: 'Rotation', type: 'number', min: 0, max: 3, default: 1, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'seigaiha',
    name: 'Seigaiha',
    description: 'Japanese seigaiha overlapping concentric wave pattern',
    sinceVersion: '2.0.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Speed', type: 'number', min: 0.1, max: 3, default: 1, modulatable: true, midiMappable: true },
      { id: 'scale', name: 'Scale', type: 'number', min: 3, max: 15, default: 6, modulatable: true, midiMappable: true },
      { id: 'waveCount', name: 'Rings', type: 'number', min: 2, max: 6, default: 4, modulatable: false, midiMappable: true },
      { id: 'lineWeight', name: 'Line Weight', type: 'number', min: 0.01, max: 0.1, default: 0.04, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'sierpinski',
    name: 'Sierpinski',
    description: 'Recursive Sierpinski fractal subdivision',
    sinceVersion: '2.0.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Speed', type: 'number', min: 0.1, max: 3, default: 1, modulatable: true, midiMappable: true },
      { id: 'depth', name: 'Depth', type: 'number', min: 1, max: 8, default: 5, modulatable: false, midiMappable: true },
      { id: 'rotation', name: 'Rotation', type: 'number', min: 0, max: 6.28, default: 0, modulatable: true, midiMappable: true },
      { id: 'variant', name: 'Variant', type: 'enum', default: 0, options: [{value: 0, label: 'Triangle'}, {value: 1, label: 'Carpet'}, {value: 2, label: 'Chaos'}], modulatable: false, midiMappable: true }
    ]
  },
  {
    id: 'orbital',
    name: 'Orbital',
    description: 'Planetary orbital mechanics simulation with gravity wells',
    sinceVersion: '2.0.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Speed', type: 'number', min: 0.1, max: 3, default: 1, modulatable: true, midiMappable: true },
      { id: 'count', name: 'Body Count', type: 'number', min: 2, max: 8, default: 5, modulatable: false, midiMappable: true },
      { id: 'trailLen', name: 'Trail Length', type: 'number', min: 0, max: 1, default: 0.5, modulatable: true, midiMappable: true },
      { id: 'gravity', name: 'Gravity', type: 'number', min: 0, max: 2, default: 1, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'conic-gradient',
    name: 'Conic Gradient',
    description: 'Conic/radial sweep gradient with audio reactivity',
    sinceVersion: '2.0.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Speed', type: 'number', min: 0.1, max: 3, default: 1, modulatable: true, midiMappable: true },
      { id: 'segments', name: 'Segments', type: 'number', min: 2, max: 32, default: 8, modulatable: false, midiMappable: true },
      { id: 'rotation', name: 'Rotation', type: 'number', min: 0, max: 6.28, default: 0, modulatable: true, midiMappable: true },
      { id: 'sharpness', name: 'Sharpness', type: 'number', min: 0, max: 1, default: 0.5, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'barcode',
    name: 'Barcode',
    description: 'Audio spectrum driven barcode/strip visualization',
    sinceVersion: '2.0.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Speed', type: 'number', min: 0.1, max: 3, default: 1, modulatable: true, midiMappable: true },
      { id: 'density', name: 'Density', type: 'number', min: 5, max: 80, default: 30, modulatable: true, midiMappable: true },
      { id: 'thickness', name: 'Thickness', type: 'number', min: 0, max: 1, default: 0.5, modulatable: true, midiMappable: true },
      { id: 'mirror', name: 'Mirror', type: 'number', min: 0, max: 1, default: 0, modulatable: false, midiMappable: true }
    ]
  },
  {
    id: 'ferrofluid',
    name: 'Ferrofluid',
    description: 'Magnetic fluid simulation with spike formations',
    sinceVersion: '2.0.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Speed', type: 'number', min: 0.1, max: 3, default: 1, modulatable: true, midiMappable: true },
      { id: 'spikes', name: 'Spike Count', type: 'number', min: 3, max: 12, default: 6, modulatable: false, midiMappable: true },
      { id: 'magnetism', name: 'Magnetism', type: 'number', min: 0, max: 2, default: 1, modulatable: true, midiMappable: true },
      { id: 'smooth', name: 'Smoothness', type: 'number', min: 0, max: 1, default: 0.3, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'halftone',
    name: 'Halftone',
    description: 'Halftone dot pattern print simulation',
    sinceVersion: '2.0.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Speed', type: 'number', min: 0.1, max: 3, default: 1, modulatable: true, midiMappable: true },
      { id: 'scale', name: 'Scale', type: 'number', min: 5, max: 60, default: 20, modulatable: true, midiMappable: true },
      { id: 'angle', name: 'Angle', type: 'number', min: 0, max: 6.28, default: 0.785, modulatable: true, midiMappable: true },
      { id: 'style', name: 'Style', type: 'enum', default: 0, options: [{value: 0, label: 'Dots'}, {value: 0.33, label: 'Diamonds'}, {value: 0.66, label: 'Lines'}], modulatable: false, midiMappable: true }
    ]
  },
  {
    id: 'pixel-sort',
    name: 'Pixel Sort',
    description: 'Pixel sorting glitch art effect driven by audio',
    sinceVersion: '2.0.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Speed', type: 'number', min: 0.1, max: 3, default: 1, modulatable: true, midiMappable: true },
      { id: 'threshold', name: 'Threshold', type: 'number', min: 0, max: 1, default: 0.5, modulatable: true, midiMappable: true },
      { id: 'direction', name: 'Direction', type: 'number', min: 0, max: 1, default: 0, modulatable: false, midiMappable: true },
      { id: 'glitch', name: 'Glitch Amount', type: 'number', min: 0, max: 1, default: 0.3, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'ripple-pond',
    name: 'Ripple Pond',
    description: 'Ripple interference pattern on water surface',
    sinceVersion: '2.0.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Speed', type: 'number', min: 0.1, max: 3, default: 1, modulatable: true, midiMappable: true },
      { id: 'drops', name: 'Drop Sources', type: 'number', min: 1, max: 8, default: 3, modulatable: false, midiMappable: true },
      { id: 'decay', name: 'Decay', type: 'number', min: 0.1, max: 2, default: 0.8, modulatable: true, midiMappable: true },
      { id: 'refraction', name: 'Refraction', type: 'number', min: 0, max: 2, default: 1, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'hex-grid',
    name: 'Hex Grid',
    description: 'Hexagonal grid with audio-reactive cells',
    sinceVersion: '2.0.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Speed', type: 'number', min: 0.1, max: 3, default: 1, modulatable: true, midiMappable: true },
      { id: 'scale', name: 'Scale', type: 'number', min: 3, max: 30, default: 10, modulatable: true, midiMappable: true },
      { id: 'pulse', name: 'Pulse', type: 'number', min: 0, max: 1, default: 0.5, modulatable: true, midiMappable: true },
      { id: 'border', name: 'Border', type: 'number', min: 0, max: 1, default: 0.3, modulatable: true, midiMappable: true }
    ]
  },
  {
    id: 'woven',
    name: 'Woven',
    description: 'Woven textile/fabric pattern generator',
    sinceVersion: '2.0.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Speed', type: 'number', min: 0.1, max: 3, default: 1, modulatable: true, midiMappable: true },
      { id: 'scale', name: 'Scale', type: 'number', min: 5, max: 40, default: 15, modulatable: true, midiMappable: true },
      { id: 'threadWidth', name: 'Thread Width', type: 'number', min: 0.1, max: 0.9, default: 0.6, modulatable: true, midiMappable: true },
      { id: 'pattern', name: 'Pattern', type: 'enum', default: 0, options: [{value: 0, label: 'Plain'}, {value: 0.5, label: 'Twill'}, {value: 1, label: 'Satin'}], modulatable: false, midiMappable: true }
    ]
  },
  {
    id: 'chromatic-aberr',
    name: 'Chromatic Aberr',
    description: 'Chromatic aberration and prismatic light dispersion',
    sinceVersion: '2.0.0',
    params: [
      { id: 'opacity', name: 'Opacity', type: 'number', min: 0, max: 1, default: 1, modulatable: true, midiMappable: true },
      { id: 'speed', name: 'Speed', type: 'number', min: 0.1, max: 3, default: 1, modulatable: true, midiMappable: true },
      { id: 'dispersion', name: 'Dispersion', type: 'number', min: 0, max: 2, default: 0.5, modulatable: true, midiMappable: true },
      { id: 'rings', name: 'Rings', type: 'number', min: 1, max: 10, default: 3, modulatable: false, midiMappable: true },
      { id: 'intensity', name: 'Intensity', type: 'number', min: 0, max: 2, default: 1, modulatable: true, midiMappable: true }
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
    'gen-asset-vortex': 'asset-vortex',
    'gen-asset-slices': 'asset-slices',
    'gen-asset-polar': 'asset-polar',
    'gen-asset-mosaic': 'asset-mosaic',
    'gen-asset-ripple': 'asset-ripple',
    'gen-asset-scatter': 'asset-scatter',
    'gen-asset-echo': 'asset-echo',
    'gen-infinite-wormhole': 'infinite-wormhole',
    'gen-ribbon-tunnel': 'ribbon-tunnel',
    'gen-fractal-tunnel': 'fractal-tunnel',
    'gen-circuit-conduit': 'circuit-conduit',
    'gen-aura-portal': 'aura-portal',
    'gen-freq-terrain': 'freq-terrain',
    'gen-data-stream': 'data-stream',
    'gen-caustic-liquid': 'caustic-liquid',
    'gen-shimmer-veil': 'shimmer-veil',
    'gen-nebula-cloud': 'nebula-cloud',
    'gen-circuit-board': 'circuit-board',
    'gen-lorenz-attractor': 'lorenz-attractor',
    'gen-mandala-spinner': 'mandala-spinner',
    'gen-starburst-galaxy': 'starburst-galaxy',
    'gen-digital-rain-v2': 'digital-rain-v2',
    'gen-lava-flow': 'lava-flow',
    'gen-crystal-growth': 'crystal-growth',
    'gen-techno-grid': 'techno-grid',
    'gen-magnetic-field': 'magnetic-field',
    'gen-prism-shards': 'prism-shards',
    'gen-neural-net': 'neural-net',
    'gen-aurora-chord': 'aurora-chord',
    'gen-vhs-glitch': 'vhs-glitch',
    'gen-vhs-scanline': 'vhs-scanline',
    'gen-moire-pattern': 'moire-pattern',
    'gen-hypercube': 'hypercube',
    'gen-fluid-swirl': 'fluid-swirl',
    'gen-ascii-stream': 'ascii-stream',
    'gen-retro-wave': 'retro-wave',
    'gen-bubble-pop': 'bubble-pop',
    'gen-sound-wave-3d': 'sound-wave-3d',
    'gen-particle-vortex': 'particle-vortex',
    'gen-glow-worms': 'glow-worms',
    'gen-mirror-maze': 'mirror-maze',
    'gen-pulse-heart': 'pulse-heart',
    'gen-data-shards': 'data-shards',
    'gen-hex-cell': 'hex-cell',
    'gen-plasma-ball': 'plasma-ball',
    'gen-warp-drive': 'warp-drive',
    'gen-visual-feedback': 'visual-feedback',
    'gen-mycelium-growth': 'mycelium-growth',
    'gen-cellular-growth': 'cellular-growth',
    'gen-bio-luminescent-forest': 'bio-luminescent-forest',
    'gen-crystalline': 'crystalline',
    'gen-audio-dna': 'audio-dna',
    'gen-liquid-metal': 'liquid-metal',
    'gen-neon-cityscape': 'neon-cityscape',
    'gen-cosmic-nebula': 'cosmic-nebula',
    'gen-sonic-rain': 'sonic-rain',
    'gen-morphing-geometry': 'morphing-geometry',
    'gen-urban-rhythm': 'urban-rhythm',
    'gen-crimson-veil': 'crimson-veil',
    'gen-victorian-crypt': 'victorian-crypt',
    'gen-spectral-apparition': 'spectral-apparition',
    'gen-gothic-cobwebs': 'gothic-cobwebs',
    'gen-blood-moon-rise': 'blood-moon-rise',
    'gen-candlelight-vigil': 'candlelight-vigil',
    'gen-gargoyles-awake': 'gargoyles-awake',
    'gen-crypt-shadows': 'crypt-shadows',
    'gen-gothic-rose': 'gothic-rose',
    'gen-eternal-darkness': 'eternal-darkness',
    'gen-pixel-dust': 'pixel-dust',
    'gen-retro-starfield': 'retro-starfield',
    'gen-8bit-grid': '8bit-grid',
    'gen-arcade-invaders': 'arcade-invaders',
    'gen-power-up-pulse': 'power-up-pulse',
    'gen-dungeon-tiles': 'dungeon-tiles',
    'gen-chiptune-wave': 'chiptune-wave',
    'gen-score-counter': 'score-counter',
    'gen-pixel-rain': 'pixel-rain',
    'gen-boss-health': 'boss-health',
    'gen-milkwave': 'milkwave',
    'gen-sdf': 'sdf',
    'gen-sdf-scene': 'sdf-scene',
    'gen-tunnel-warp': 'tunnel-warp',
    'gen-wormhole-core': 'wormhole-core',
    'gen-nebula-drift': 'nebula-drift',
    'gen-fractal-bloom': 'fractal-bloom',
    'gen-kaleido-shard': 'kaleido-shard',
    'gen-glitch-datamosh': 'glitch-datamosh',
    'gen-particle-swarm': 'particle-swarm',
    'gen-particles': 'particles',
    'gen-neon-wireframe': 'neon-wireframe',
    'gen-organic-fluid': 'organic-fluid',
    'gen-cosmic-aurora': 'cosmic-aurora',
    'gen-typography-reveal': 'typography-reveal',
    'gen-radar-hud': 'radar-hud',
    'gen-audio-geometry': 'audio-geometry',
    'gen-voronoi-tessellation': 'voronoi-tessellation',
    'gen-choropleth-wave': 'choropleth-wave',
    'gen-sankey-flow': 'sankey-flow',
    'gen-scatter-plot': 'scatter-plot',
    'gen-radial-bar': 'radial-bar',
    'gen-reaction-diffusion': 'reaction-diffusion',
    'gen-penrose-tiling': 'penrose-tiling',
    'gen-strange-attractor': 'strange-attractor',
    'gen-l-system': 'l-system',
    'gen-raymarch-terrain': 'raymarch-terrain',
    'gen-spirograph': 'spirograph',
    'gen-uv-feedback': 'uv-feedback',
    'gen-droste-effect': 'droste-effect',
    'gen-equalizer-matrix': 'equalizer-matrix',
    'gen-metaball': 'metaball',
    'gen-interference-pattern': 'interference-pattern',
    'gen-terrain-hypsometric': 'terrain-hypsometric',
    'gen-phyllotaxis': 'phyllotaxis',
    'gen-deep-ocean': 'deep-ocean',
    'gen-holographic-prism': 'holographic-prism',
    'gen-boids': 'boids',
    'gen-flow-field': 'flow-field',
    'gen-stained-glass': 'stained-glass',
    'gen-hillshade': 'hillshade',
    'gen-truchet-tiles': 'truchet-tiles',
    'gen-spectrogram': 'spectrogram',
    'gen-crosshatch': 'crosshatch',
    'gen-shatter': 'shatter',
    'gen-seigaiha': 'seigaiha',
    'gen-sierpinski': 'sierpinski',
    'gen-orbital': 'orbital',
    'gen-conic-gradient': 'conic-gradient',
    'gen-barcode': 'barcode',
    'gen-ferrofluid': 'ferrofluid',
    'gen-halftone': 'halftone',
    'gen-pixel-sort': 'pixel-sort',
    'gen-ripple-pond': 'ripple-pond',
    'gen-hex-grid': 'hex-grid',
    'gen-woven': 'woven',
    'gen-chromatic-aberr': 'chromatic-aberr',
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
    'oscillo': 'layer-oscillo',
    'cellular-growth': 'layer-cellular-growth',
    'bio-luminescent-forest': 'layer-bio-luminescent-forest',
    'crystalline': 'layer-crystalline',
    'audio-dna': 'layer-audio-dna',
    'liquid-metal': 'layer-liquid-metal',
    'neon-cityscape': 'layer-neon-cityscape',
    'cosmic-nebula': 'layer-cosmic-nebula',
    'sonic-rain': 'layer-sonic-rain',
    'morphing-geometry': 'layer-morphing-geometry',
    'urban-rhythm': 'layer-urban-rhythm',
    'crimson-veil': 'layer-crimson-veil',
    'victorian-crypt': 'layer-victorian-crypt',
    'spectral-apparition': 'layer-spectral-apparition',
    'gothic-cobwebs': 'layer-gothic-cobwebs',
    'blood-moon-rise': 'layer-blood-moon-rise',
    'candlelight-vigil': 'layer-candlelight-vigil',
    'gargoyles-awake': 'layer-gargoyles-awake',
    'crypt-shadows': 'layer-crypt-shadows',
    'gothic-rose': 'layer-gothic-rose',
    'eternal-darkness': 'layer-eternal-darkness',
    'pixel-dust': 'layer-pixel-dust',
    'retro-starfield': 'layer-retro-starfield',
    '8bit-grid': 'layer-8bit-grid',
    'arcade-invaders': 'layer-arcade-invaders',
    'power-up-pulse': 'layer-power-up-pulse',
    'dungeon-tiles': 'layer-dungeon-tiles',
    'chiptune-wave': 'layer-chiptune-wave',
    'score-counter': 'layer-score-counter',
    'pixel-rain': 'layer-pixel-rain',
    'boss-health': 'layer-boss-health',
    'milkwave': 'layer-milkwave',
    'voronoi-tessellation': 'gen-voronoi-tessellation',
    'choropleth-wave': 'gen-choropleth-wave',
    'sankey-flow': 'gen-sankey-flow',
    'scatter-plot': 'gen-scatter-plot',
    'radial-bar': 'gen-radial-bar',
    'reaction-diffusion': 'gen-reaction-diffusion',
    'penrose-tiling': 'gen-penrose-tiling',
    'strange-attractor': 'gen-strange-attractor',
    'l-system': 'gen-l-system',
    'raymarch-terrain': 'gen-raymarch-terrain',
    'spirograph': 'gen-spirograph',
    'uv-feedback': 'gen-uv-feedback',
    'droste-effect': 'gen-droste-effect',
    'equalizer-matrix': 'gen-equalizer-matrix',
    'metaball': 'gen-metaball',
    'interference-pattern': 'gen-interference-pattern',
    'terrain-hypsometric': 'gen-terrain-hypsometric',
    'phyllotaxis': 'gen-phyllotaxis',
    'deep-ocean': 'gen-deep-ocean',
    'holographic-prism': 'gen-holographic-prism',
    'boids': 'gen-boids',
    'flow-field': 'gen-flow-field',
    'stained-glass': 'gen-stained-glass',
    'hillshade': 'gen-hillshade',
    'truchet-tiles': 'gen-truchet-tiles',
    'spectrogram': 'gen-spectrogram',
    'crosshatch': 'gen-crosshatch',
    'shatter': 'gen-shatter',
    'seigaiha': 'gen-seigaiha',
    'sierpinski': 'gen-sierpinski',
    'orbital': 'gen-orbital',
    'conic-gradient': 'gen-conic-gradient',
    'barcode': 'gen-barcode',
    'ferrofluid': 'gen-ferrofluid',
    'halftone': 'gen-halftone',
    'pixel-sort': 'gen-pixel-sort',
    'ripple-pond': 'gen-ripple-pond',
    'hex-grid': 'gen-hex-grid',
    'woven': 'gen-woven',
    'chromatic-aberr': 'gen-chromatic-aberr'
  };

  const layerId = reverseMapping[layerType] || `layer-${layerType}`;
  return `${layerId}.${param}`;
};
