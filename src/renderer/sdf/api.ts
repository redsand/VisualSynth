/**
 * VisualSynth SDF Node API
 *
 * This module defines the comprehensive SDF (Signed Distance Field) system types,
 * interfaces, and contracts for the node-based SDF scene graph.
 */

// ============================================================================
// GPU Cost Tiers
// ============================================================================

export type SdfGpuCostTier = 'LOW' | 'MED' | 'HIGH';

export const GPU_COST_ESTIMATES: Record<SdfGpuCostTier, number> = {
  LOW: 0.1,   // Simple primitives, basic ops
  MED: 1.0,   // Warps, voronoi 2D, moderate complexity
  HIGH: 5.0   // Raymarch heavy, fractals, complex fields
};

// ============================================================================
// Coordinate Space
// ============================================================================

export type SdfCoordSpace = '2d' | '3d' | 'both';

// ============================================================================
// Node Categories
// ============================================================================

export type SdfNodeCategory =
  | 'shapes2d'
  | 'shapes2d-advanced'
  | 'shapes3d'
  | 'shapes3d-advanced'
  | 'ops'
  | 'ops-smooth'
  | 'domain'
  | 'domain-warp'
  | 'fields'
  | 'composition'
  | 'utils';

export const SDF_CATEGORY_LABELS: Record<SdfNodeCategory, string> = {
  'shapes2d': '2D Primitives',
  'shapes2d-advanced': '2D Advanced',
  'shapes3d': '3D Primitives',
  'shapes3d-advanced': '3D Advanced',
  'ops': 'Boolean Operations',
  'ops-smooth': 'Smooth Operations',
  'domain': 'Domain Transforms',
  'domain-warp': 'Domain Warps',
  'fields': 'Fields & Patterns',
  'composition': 'Composition Tools',
  'utils': 'Utilities'
};

// ============================================================================
// Parameter Types
// ============================================================================

export type SdfParamType =
  | 'float'
  | 'int'
  | 'bool'
  | 'vec2'
  | 'vec3'
  | 'vec4'
  | 'color'
  | 'enum'
  | 'angle';

export interface SdfEnumOption {
  value: number;
  label: string;
}

export interface SdfParameter {
  id: string;
  name: string;
  type: SdfParamType;
  default: number | number[] | boolean;
  min?: number;
  max?: number;
  step?: number;
  options?: SdfEnumOption[];  // For enum type
  group?: string;
  tooltip?: string;
  modulatable: boolean;
}

// ============================================================================
// Modulation Target
// ============================================================================

export interface SdfModTarget {
  parameterId: string;
  minRange: number;
  maxRange: number;
  bipolar: boolean;
  curve: 'linear' | 'exp' | 'log';
}

// ============================================================================
// GLSL Code Definition
// ============================================================================

export interface SdfGlslCode {
  /** Function signature, e.g., "float sdCircle(vec2 p, float r)" */
  signature: string;
  /** Function body (without braces) */
  body: string;
  /** Other functions this depends on */
  dependencies?: string[];
  /** Required utility functions (hash, rotate2d, etc.) */
  requires?: string[];
}

// ============================================================================
// SDF Node Definition (Static Metadata)
// ============================================================================

export interface SdfNodeDefinition {
  /** Unique identifier, e.g., "circle", "smoothUnion" */
  id: string;
  /** Display name, e.g., "Circle", "Smooth Union" */
  name: string;
  /** Semantic version */
  version: string;
  /** Category for UI grouping */
  category: SdfNodeCategory;
  /** 2D, 3D, or both */
  coordSpace: SdfCoordSpace;
  /** Performance cost tier */
  gpuCostTier: SdfGpuCostTier;
  /** Parameter definitions */
  parameters: SdfParameter[];
  /** Which parameters can be modulated */
  modTargets: SdfModTarget[];
  /** GLSL function code */
  glsl: SdfGlslCode;
  /** Default parameter values */
  defaults: Record<string, number | number[] | boolean>;
  /** Whether output is deterministic for same inputs */
  deterministic: boolean;
  /** Tooltip description */
  description?: string;
  /** Search tags */
  tags?: string[];
  /** Icon identifier (optional) */
  icon?: string;
}

// ============================================================================
// SDF Node Instance (Runtime State)
// ============================================================================

export interface SdfNodeInstance {
  /** Unique instance ID */
  instanceId: string;
  /** Reference to node definition ID */
  nodeId: string;
  /** Current parameter values */
  params: Record<string, number | number[] | boolean>;
  /** Custom label for this node */
  label?: string;
  /** Custom color for this specific instance */
  color?: [number, number, number];
  /** Whether this node is enabled */
  enabled: boolean;
  /** Position in node list (for ordering) */
  order: number;
  /** Custom label (optional) */
  label?: string;
}

// ============================================================================
// SDF Connections (for operations)
// ============================================================================

export interface SdfConnection {
  /** Source node instance ID */
  from: string;
  /** Target node instance ID */
  to: string;
  /** Input slot on target (0 = primary, 1 = secondary for subtract, etc.) */
  slot: number;
}

// ============================================================================
// Rendering Configuration
// ============================================================================

export interface SdfRenderConfig2D {
  antialiasing: boolean;
  aaSmoothing: number;      // Smoothstep width
  strokeEnabled: boolean;
  strokeWidth: number;
  strokeColor: [number, number, number, number];
  fillEnabled: boolean;
  fillOpacity: number;
  fillColor: [number, number, number, number];
  glowEnabled: boolean;
  glowIntensity: number;
  glowRadius: number;
  glowColor: [number, number, number, number];
  gradientEnabled: boolean;
  gradientMode: 'distance' | 'normal' | 'angle';
  gradientColors: [number, number, number, number][];
}

export interface SdfLightingConfig {
  direction: [number, number, number];
  color: [number, number, number];
  intensity: number;
  ambient: number;
  specularPower: number;
  specularIntensity: number;
}

export interface SdfRenderConfig3D {
  // Raymarching
  maxSteps: number;
  maxDistance: number;
  epsilon: number;
  normalEpsilon: number;

  // Lighting
  lighting: SdfLightingConfig;

  // Effects
  aoEnabled: boolean;
  aoSteps: number;
  aoIntensity: number;
  aoRadius: number;

  softShadowsEnabled: boolean;
  shadowSoftness: number;
  shadowSteps: number;

  fogEnabled: boolean;
  fogDensity: number;
  fogColor: [number, number, number];

  // Background
  backgroundColor: [number, number, number];
  backgroundGradient: boolean;

  // Quality
  adaptiveQuality: boolean;
  qualityBias: number;  // -1 to 1, negative = faster, positive = higher quality

  // Camera
  cameraPosition?: [number, number, number];
  cameraTarget?: [number, number, number];
  cameraFov?: number;
}

// ============================================================================
// Debug Configuration
// ============================================================================

export interface SdfDebugConfig {
  showDistance: boolean;
  distanceScale: number;
  showNormals: boolean;
  showSteps: boolean;
  stepsColorScale: number;
  showCostTier: boolean;
  showBounds: boolean;
  wireframe: boolean;
}

// ============================================================================
// SDF Scene Configuration
// ============================================================================

export interface SdfSceneConfig {
  /** Schema version for migrations */
  version: 1;
  /** 2D or 3D mode */
  mode: '2d' | '3d';
  /** Node instances in the scene */
  nodes: SdfNodeInstance[];
  /** Connections between nodes */
  connections: SdfConnection[];
  /** 2D rendering config (when mode='2d') */
  render2d: SdfRenderConfig2D;
  /** 3D rendering config (when mode='3d') */
  render3d: SdfRenderConfig3D;
  /** Debug visualization options */
  debug: SdfDebugConfig;
  /** Camera position for 3D (optional) */
  camera?: {
    position: [number, number, number];
    target: [number, number, number];
    fov: number;
  };
}

// ============================================================================
// Default Configurations
// ============================================================================

export const DEFAULT_RENDER_2D: SdfRenderConfig2D = {
  antialiasing: true,
  aaSmoothing: 0.01,
  strokeEnabled: true,
  strokeWidth: 0.02,
  strokeColor: [1.0, 0.6, 0.25, 1.0],
  fillEnabled: true,
  fillOpacity: 0.5,
  fillColor: [1.0, 0.6, 0.25, 1.0],
  glowEnabled: true,
  glowIntensity: 0.5,
  glowRadius: 0.1,
  glowColor: [1.0, 0.8, 0.4, 1.0],
  gradientEnabled: false,
  gradientMode: 'distance',
  gradientColors: [
    [0.2, 0.4, 0.8, 1.0],
    [0.8, 0.4, 0.2, 1.0]
  ]
};

export const DEFAULT_LIGHTING: SdfLightingConfig = {
  direction: [0.5, 0.8, 0.6],
  color: [1.0, 0.98, 0.95],
  intensity: 1.0,
  ambient: 0.15,
  specularPower: 32.0,
  specularIntensity: 0.5
};

export const DEFAULT_RENDER_3D: SdfRenderConfig3D = {
  maxSteps: 64,
  maxDistance: 20.0,
  epsilon: 0.001,
  normalEpsilon: 0.0005,
  lighting: DEFAULT_LIGHTING,
  aoEnabled: true,
  aoSteps: 5,
  aoIntensity: 0.5,
  aoRadius: 0.2,
  softShadowsEnabled: true,
  shadowSoftness: 8.0,
  shadowSteps: 16,
  fogEnabled: false,
  fogDensity: 0.05,
  fogColor: [0.6, 0.7, 0.8],
  backgroundColor: [0, 0, 0],
  backgroundGradient: false,
  adaptiveQuality: true,
  qualityBias: 0,
  cameraPosition: [0, 0, 2],
  cameraTarget: [0, 0, 0],
  cameraFov: 1.0
};

export const DEFAULT_DEBUG: SdfDebugConfig = {
  showDistance: false,
  distanceScale: 5.0,
  showNormals: false,
  showSteps: false,
  stepsColorScale: 64.0,
  showCostTier: false,
  showBounds: false,
  wireframe: false
};

export const DEFAULT_SDF_SCENE: SdfSceneConfig = {
  version: 1,
  mode: '2d',
  nodes: [],
  connections: [],
  render2d: { ...DEFAULT_RENDER_2D },
  render3d: { ...DEFAULT_RENDER_3D },
  debug: { ...DEFAULT_DEBUG }
};

// ============================================================================
// Registry Interface
// ============================================================================

export interface SdfNodeRegistry {
  /** Register a new node definition */
  register(node: SdfNodeDefinition): void;
  /** Get a node by ID */
  get(id: string): SdfNodeDefinition | undefined;
  /** Get all nodes */
  getAll(): SdfNodeDefinition[];
  /** Get nodes by category */
  getByCategory(category: SdfNodeCategory): SdfNodeDefinition[];
  /** Get nodes by coordinate space */
  getByCoordSpace(space: SdfCoordSpace): SdfNodeDefinition[];
  /** Search nodes by name/tags */
  search(query: string): SdfNodeDefinition[];
  /** Check if a node exists */
  has(id: string): boolean;
}

// ============================================================================
// Compiled Shader Info
// ============================================================================

export interface SdfCompiledShader {
  /** Complete GLSL fragment shader source */
  fragmentSource: string;
  /** Extracted GLSL functions for primitives and ops */
  functionsCode: string;
  /** Extracted body logic for the map() function */
  mapBody: string;
  /** Uniform bindings for parameters */
  uniforms: SdfUniformBinding[];
  /** Total estimated GPU cost */
  totalCost: number;
  /** Whether shader uses 3D raymarching */
  uses3D: boolean;
  /** Validation errors (if any) */
  errors: string[];
  /** Warnings (if any) */
  warnings: string[];
}

export interface SdfUniformBinding {
  /** Uniform name in shader */
  name: string;
  /** Node instance ID */
  instanceId: string;
  /** Parameter ID on the node */
  parameterId: string;
  /** GLSL type */
  type: 'float' | 'int' | 'vec2' | 'vec3' | 'vec4';
  /** Offset in uniform buffer (for UBO packing) */
  offset: number;
}

// ============================================================================
// Runtime State
// ============================================================================

export interface SdfRuntimeState {
  /** Current time in seconds */
  time: number;
  /** Delta time since last frame */
  deltaTime: number;
  /** Audio RMS level */
  audioRms: number;
  /** Audio peak level */
  audioPeak: number;
  /** Audio frequency bands [0-7] */
  audioBands: number[];
  /** Beat trigger (0 or 1) */
  beat: number;
  /** BPM-synced phase (0-1) */
  bpmPhase: number;
  /** Resolution width */
  width: number;
  /** Resolution height */
  height: number;
  /** Aspect ratio */
  aspect: number;
}

// ============================================================================
// Utility Type Guards
// ============================================================================

export const isSdfSceneConfig = (obj: unknown): obj is SdfSceneConfig => {
  if (typeof obj !== 'object' || obj === null) return false;
  const scene = obj as SdfSceneConfig;
  return (
    typeof scene.version === 'number' &&
    (scene.mode === '2d' || scene.mode === '3d') &&
    Array.isArray(scene.nodes) &&
    Array.isArray(scene.connections)
  );
};

export const isValidNodeId = (id: string): boolean => {
  return /^[a-z][a-z0-9_-]*$/.test(id);
};

export const isValidInstanceId = (id: string): boolean => {
  return /^[a-z0-9_-]+$/.test(id);
};

// ============================================================================
// Factory Functions
// ============================================================================

export const createSdfParameter = (
  id: string,
  name: string,
  type: SdfParamType,
  defaultValue: number | number[] | boolean,
  options?: Partial<Omit<SdfParameter, 'id' | 'name' | 'type' | 'default'>>
): SdfParameter => ({
  id,
  name,
  type,
  default: defaultValue,
  modulatable: true,
  ...options
});

export const createFloatParam = (
  id: string,
  name: string,
  defaultValue: number,
  min: number,
  max: number,
  options?: Partial<SdfParameter>
): SdfParameter => createSdfParameter(id, name, 'float', defaultValue, {
  min,
  max,
  step: (max - min) / 100,
  ...options
});

export const createAngleParam = (
  id: string,
  name: string,
  defaultValue: number,
  options?: Partial<SdfParameter>
): SdfParameter => createSdfParameter(id, name, 'angle', defaultValue, {
  min: 0,
  max: Math.PI * 2,
  step: 0.01,
  ...options
});

export const createIntParam = (
  id: string,
  name: string,
  defaultValue: number,
  min: number,
  max: number,
  options?: Partial<SdfParameter>
): SdfParameter => createSdfParameter(id, name, 'int', defaultValue, {
  min,
  max,
  step: 1,
  ...options
});

export const createBoolParam = (
  id: string,
  name: string,
  defaultValue: boolean,
  options?: Partial<SdfParameter>
): SdfParameter => createSdfParameter(id, name, 'bool', defaultValue, options);

export const createVec2Param = (
  id: string,
  name: string,
  defaultValue: [number, number],
  options?: Partial<SdfParameter>
): SdfParameter => createSdfParameter(id, name, 'vec2', defaultValue, options);

export const createVec3Param = (
  id: string,
  name: string,
  defaultValue: [number, number, number],
  options?: Partial<SdfParameter>
): SdfParameter => createSdfParameter(id, name, 'vec3', defaultValue, options);

export const createColorParam = (
  id: string,
  name: string,
  defaultValue: [number, number, number, number],
  options?: Partial<SdfParameter>
): SdfParameter => createSdfParameter(id, name, 'color', defaultValue, options);

export const createEnumParam = (
  id: string,
  name: string,
  defaultValue: number,
  enumOptions: SdfEnumOption[],
  options?: Partial<SdfParameter>
): SdfParameter => createSdfParameter(id, name, 'enum', defaultValue, {
  options: enumOptions,
  ...options
});

export const createModTarget = (
  parameterId: string,
  minRange = 0,
  maxRange = 1,
  options?: Partial<Omit<SdfModTarget, 'parameterId'>>
): SdfModTarget => ({
  parameterId,
  minRange,
  maxRange,
  bipolar: false,
  curve: 'linear',
  ...options
});

export const createNodeInstance = (
  nodeId: string,
  params?: Record<string, number | number[] | boolean>,
  options?: Partial<Omit<SdfNodeInstance, 'instanceId' | 'nodeId' | 'params'>>
): SdfNodeInstance => ({
  instanceId: `${nodeId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  nodeId,
  params: params ?? {},
  enabled: true,
  order: 0,
  ...options
});

// ============================================================================
// Seed Utilities for Deterministic Rendering
// ============================================================================

export const hashSeed = (seed: number, x: number, y: number): number => {
  const h = seed + x * 374761393 + y * 668265263;
  return ((h ^ (h >> 13)) * 1274126177) >>> 0;
};

export const seedToFloat = (seed: number): number => {
  return (seed % 2147483647) / 2147483647;
};
