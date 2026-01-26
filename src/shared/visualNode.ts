import { z } from 'zod';

/**
 * Visual Node API - Strict specification for Generators, Effects, and Compositors
 *
 * This module defines the core rendering node system for VisualSynth.
 * All visual nodes (generators, effects, compositors) must conform to this API.
 */

// ============================================================================
// Parameter Schema Types
// ============================================================================

export const parameterTypeSchema = z.enum([
  'float',      // Continuous value with min/max
  'int',        // Integer value with min/max
  'bool',       // Toggle on/off
  'enum',       // Discrete choice from options
  'color',      // RGB/RGBA color value
  'vec2',       // 2D vector (x, y)
  'vec3',       // 3D vector (x, y, z)
  'vec4',       // 4D vector (x, y, z, w)
  'texture',    // Texture/image input
  'audio'       // Audio data input
]);

export type ParameterType = z.infer<typeof parameterTypeSchema>;

export const parameterSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: parameterTypeSchema,
  defaultValue: z.union([z.number(), z.boolean(), z.string(), z.array(z.number())]),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  options: z.array(z.object({
    value: z.union([z.number(), z.string()]),
    label: z.string()
  })).optional(),
  modulatable: z.boolean().default(true),
  description: z.string().optional(),
  group: z.string().optional(),
  uiHint: z.enum(['slider', 'knob', 'toggle', 'dropdown', 'color-picker', 'xy-pad']).optional()
});

export type Parameter = z.infer<typeof parameterSchema>;

// ============================================================================
// Modulation Target Schema
// ============================================================================

export const modulationTargetSchema = z.object({
  parameterId: z.string(),
  minRange: z.number().default(0),
  maxRange: z.number().default(1),
  bipolar: z.boolean().default(false),
  smoothingMs: z.number().default(0),
  curve: z.enum(['linear', 'exponential', 'logarithmic', 'sigmoid']).default('linear')
});

export type ModulationTarget = z.infer<typeof modulationTargetSchema>;

// ============================================================================
// GPU Cost Tiers
// ============================================================================

export const gpuCostTierSchema = z.enum([
  'trivial',      // < 0.1ms, simple blits/copies
  'light',        // 0.1-0.5ms, basic shaders
  'moderate',     // 0.5-2ms, complex shaders, small textures
  'heavy',        // 2-5ms, multi-pass, large textures
  'extreme'       // > 5ms, real-time not guaranteed
]);

export type GpuCostTier = z.infer<typeof gpuCostTierSchema>;

export const gpuCostEstimate = {
  trivial: 0.1,
  light: 0.3,
  moderate: 1.0,
  heavy: 3.0,
  extreme: 8.0
} as const;

// ============================================================================
// Input/Output Port Definitions
// ============================================================================

export const portTypeSchema = z.enum([
  'color',        // RGB color buffer
  'rgba',         // RGBA color buffer with alpha
  'depth',        // Depth buffer
  'normal',       // Normal map
  'mask',         // Single-channel mask
  'audio',        // Audio data (spectrum, waveform)
  'data'          // Generic data buffer
]);

export type PortType = z.infer<typeof portTypeSchema>;

export const inputPortSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: portTypeSchema,
  required: z.boolean().default(false),
  description: z.string().optional()
});

export type InputPort = z.infer<typeof inputPortSchema>;

export const outputPortSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: portTypeSchema,
  description: z.string().optional()
});

export type OutputPort = z.infer<typeof outputPortSchema>;

// ============================================================================
// Node Category Types
// ============================================================================

export const nodeKindSchema = z.enum([
  'generator',    // Creates visuals from nothing (plasma, particles, noise)
  'effect',       // Processes input visuals (blur, bloom, color correction)
  'compositor',   // Combines multiple inputs (blend, layer, mask)
  'source',       // External input (video, image, camera, NDI)
  'output'        // Final output destination
]);

export type NodeKind = z.infer<typeof nodeKindSchema>;

// ============================================================================
// Resource Requirements
// ============================================================================

export const resourceRequirementsSchema = z.object({
  framebuffers: z.number().default(0),
  textures: z.number().default(0),
  preferredResolution: z.enum(['full', 'half', 'quarter', 'eighth', 'dynamic']).default('full'),
  requiresDoubleBuffer: z.boolean().default(false),
  supportsResolutionScaling: z.boolean().default(true),
  maxTextureSize: z.number().optional(),
  sharedTextureAllowed: z.boolean().default(true)
});

export type ResourceRequirements = z.infer<typeof resourceRequirementsSchema>;

// ============================================================================
// Test Hooks
// ============================================================================

export const testHooksSchema = z.object({
  deterministicSeed: z.boolean().default(true),
  fixedTimestep: z.boolean().default(true),
  snapshotPoints: z.array(z.string()).default([]),
  toleranceThreshold: z.number().default(0.01),
  referenceImagePath: z.string().optional()
});

export type TestHooks = z.infer<typeof testHooksSchema>;

// ============================================================================
// Visual Node Schema (Complete Node Definition)
// ============================================================================

export const visualNodeSchema = z.object({
  // Identity
  id: z.string(),
  name: z.string(),
  version: z.string().default('1.0.0'),
  author: z.string().default('VisualSynth'),
  description: z.string().optional(),

  // Classification
  kind: nodeKindSchema,
  category: z.string().optional(), // e.g., "color", "distortion", "blur", "generative"
  tags: z.array(z.string()).default([]),

  // Ports
  inputs: z.array(inputPortSchema).default([]),
  outputs: z.array(outputPortSchema).default([]),

  // Parameters
  parameters: z.array(parameterSchema).default([]),
  modulationTargets: z.array(modulationTargetSchema).default([]),

  // Performance
  gpuCostTier: gpuCostTierSchema.default('moderate'),
  resourceRequirements: resourceRequirementsSchema.default({}),

  // Testing
  testHooks: testHooksSchema.default({}),

  // Shader source (for built-in nodes)
  shaderSource: z.object({
    vertex: z.string().optional(),
    fragment: z.string()
  }).optional(),

  // Entry point for plugin nodes
  entry: z.string().optional(),

  // Feature flags
  supportsAudioReactivity: z.boolean().default(false),
  supportsFeedback: z.boolean().default(false),
  supportsMultiSampling: z.boolean().default(true)
});

export type VisualNode = z.infer<typeof visualNodeSchema>;

// ============================================================================
// Node Instance (Runtime State)
// ============================================================================

export interface NodeInstance {
  nodeId: string;
  instanceId: string;
  parameterValues: Record<string, number | boolean | string | number[]>;
  inputConnections: Record<string, { nodeInstanceId: string; outputId: string }>;
  enabled: boolean;
  bypass: boolean;
  soloPreview: boolean;
}

// ============================================================================
// Render Graph Types
// ============================================================================

export interface RenderGraphNode {
  instanceId: string;
  node: VisualNode;
  instance: NodeInstance;
  framebufferIds: string[];
  textureIds: string[];
}

export interface RenderGraphConnection {
  fromInstanceId: string;
  fromOutputId: string;
  toInstanceId: string;
  toInputId: string;
}

export interface RenderGraph {
  id: string;
  name: string;
  nodes: RenderGraphNode[];
  connections: RenderGraphConnection[];
  outputNodeId: string;
  resolution: { width: number; height: number };
  frameRate: number;
}

// ============================================================================
// FBO Pool Resource Tracking
// ============================================================================

export interface FBOResource {
  id: string;
  framebuffer: WebGLFramebuffer | null;
  texture: WebGLTexture | null;
  width: number;
  height: number;
  inUse: boolean;
  lastUsedFrame: number;
  ownerNodeId: string | null;
}

export interface TextureResource {
  id: string;
  texture: WebGLTexture | null;
  width: number;
  height: number;
  format: 'rgba8' | 'rgba16f' | 'rgba32f';
  inUse: boolean;
  lastUsedFrame: number;
  ownerNodeId: string | null;
}

export interface ResourcePool {
  fbos: Map<string, FBOResource>;
  textures: Map<string, TextureResource>;
  maxFBOs: number;
  maxTextures: number;
  currentFrame: number;
}

// ============================================================================
// Node Factory Functions
// ============================================================================

export const createParameter = (
  id: string,
  name: string,
  type: ParameterType,
  defaultValue: number | boolean | string | number[],
  options?: Partial<Omit<Parameter, 'id' | 'name' | 'type' | 'defaultValue'>>
): Parameter => ({
  id,
  name,
  type,
  defaultValue,
  modulatable: true,
  ...options
});

export const createFloatParameter = (
  id: string,
  name: string,
  defaultValue: number,
  min: number,
  max: number,
  options?: Partial<Parameter>
): Parameter => createParameter(id, name, 'float', defaultValue, { min, max, ...options });

export const createBoolParameter = (
  id: string,
  name: string,
  defaultValue: boolean,
  options?: Partial<Parameter>
): Parameter => createParameter(id, name, 'bool', defaultValue, options);

export const createEnumParameter = (
  id: string,
  name: string,
  defaultValue: string | number,
  enumOptions: { value: string | number; label: string }[],
  options?: Partial<Parameter>
): Parameter => createParameter(id, name, 'enum', defaultValue, { options: enumOptions, ...options });

export const createInputPort = (
  id: string,
  name: string,
  type: PortType,
  required = false
): InputPort => ({ id, name, type, required });

export const createOutputPort = (
  id: string,
  name: string,
  type: PortType
): OutputPort => ({ id, name, type });

export const createVisualNode = (partial: Partial<VisualNode> & { id: string; name: string; kind: NodeKind }): VisualNode => {
  const result = visualNodeSchema.parse(partial);
  return result;
};

// ============================================================================
// Modulation Target Helpers
// ============================================================================

export const createModulationTarget = (
  parameterId: string,
  options?: Partial<Omit<ModulationTarget, 'parameterId'>>
): ModulationTarget => ({
  parameterId,
  minRange: 0,
  maxRange: 1,
  bipolar: false,
  smoothingMs: 0,
  curve: 'linear',
  ...options
});

// ============================================================================
// Resource Requirement Helpers
// ============================================================================

export const createResourceRequirements = (
  options?: Partial<ResourceRequirements>
): ResourceRequirements => ({
  framebuffers: 0,
  textures: 0,
  preferredResolution: 'full',
  requiresDoubleBuffer: false,
  supportsResolutionScaling: true,
  sharedTextureAllowed: true,
  ...options
});

// ============================================================================
// Test Hook Helpers
// ============================================================================

export const createTestHooks = (
  options?: Partial<TestHooks>
): TestHooks => ({
  deterministicSeed: true,
  fixedTimestep: true,
  snapshotPoints: [],
  toleranceThreshold: 0.01,
  ...options
});
