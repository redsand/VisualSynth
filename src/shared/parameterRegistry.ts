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
    'layer-oscillo': 'oscillo'
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
