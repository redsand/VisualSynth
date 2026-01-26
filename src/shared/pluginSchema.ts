import { z } from 'zod';
import {
  parameterTypeSchema,
  portTypeSchema,
  nodeKindSchema,
  gpuCostTierSchema
} from './visualNode';

/**
 * Plugin Schema - Versioned plugin API with capability flags and sandbox boundaries
 *
 * Plugins can extend VisualSynth with custom generators, effects, and compositors.
 * This schema validates plugin manifests and ensures compatibility.
 */

// ============================================================================
// Plugin API Version
// ============================================================================

export const PLUGIN_API_VERSION = '1.0.0';

// ============================================================================
// Capability Flags
// ============================================================================

export const capabilityFlagsSchema = z.object({
  // Rendering capabilities
  requiresWebGL2: z.boolean().default(true),
  requiresFloatTextures: z.boolean().default(false),
  requiresComputeShaders: z.boolean().default(false),

  // Resource access
  canAccessAudio: z.boolean().default(false),
  canAccessMidi: z.boolean().default(false),
  canAccessNetwork: z.boolean().default(false),
  canAccessFileSystem: z.boolean().default(false),

  // Feature flags
  supportsHotReload: z.boolean().default(false),
  supportsDeterministicMode: z.boolean().default(true),
  supportsResolutionScaling: z.boolean().default(true)
});

export type CapabilityFlags = z.infer<typeof capabilityFlagsSchema>;

// ============================================================================
// Sandbox Configuration
// ============================================================================

export const sandboxConfigSchema = z.object({
  // Memory limits
  maxTextureMemoryMB: z.number().default(256),
  maxUniformBufferSizeKB: z.number().default(64),

  // Execution limits
  maxShaderInstructionCount: z.number().default(10000),
  maxLoopIterations: z.number().default(1000),
  timeoutMs: z.number().default(100),

  // Resource limits
  maxFramebuffers: z.number().default(4),
  maxTextures: z.number().default(8),
  maxUniforms: z.number().default(64),

  // Isolation
  isolatedContext: z.boolean().default(true),
  crashIsolation: z.boolean().default(true)
});

export type SandboxConfig = z.infer<typeof sandboxConfigSchema>;

// ============================================================================
// Plugin Parameter Schema (for manifest)
// ============================================================================

export const pluginParameterSchema = z.object({
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
  group: z.string().optional()
});

export type PluginParameter = z.infer<typeof pluginParameterSchema>;

// ============================================================================
// Plugin Port Schema
// ============================================================================

export const pluginInputPortSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: portTypeSchema,
  required: z.boolean().default(false),
  description: z.string().optional()
});

export const pluginOutputPortSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: portTypeSchema,
  description: z.string().optional()
});

// ============================================================================
// Asset Access Rules
// ============================================================================

export const assetAccessRulesSchema = z.object({
  allowedAssetTypes: z.array(z.enum(['texture', 'video', 'audio', 'shader'])).default(['texture']),
  maxAssetSizeMB: z.number().default(64),
  canCreateAssets: z.boolean().default(false),
  canModifyAssets: z.boolean().default(false),
  canDeleteAssets: z.boolean().default(false)
});

export type AssetAccessRules = z.infer<typeof assetAccessRulesSchema>;

// ============================================================================
// Plugin Manifest Schema (Extended)
// ============================================================================

export const pluginManifestSchema = z.object({
  // Identity
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  author: z.string().default('Unknown'),
  description: z.string().optional(),
  license: z.string().default('MIT'),
  homepage: z.string().url().optional(),
  repository: z.string().url().optional(),

  // API compatibility
  apiVersion: z.string().default(PLUGIN_API_VERSION),
  minHostVersion: z.string().optional(),
  maxHostVersion: z.string().optional(),

  // Classification
  kind: nodeKindSchema,
  category: z.string().optional(),
  tags: z.array(z.string()).default([]),

  // Entry point
  entry: z.string(),
  shaderEntry: z.string().optional(),

  // Ports
  inputs: z.array(pluginInputPortSchema).default([]),
  outputs: z.array(pluginOutputPortSchema).default([{ id: 'out', name: 'Output', type: 'rgba' }]),

  // Parameters
  parameters: z.array(pluginParameterSchema).default([]),

  // Performance
  gpuCostTier: gpuCostTierSchema.default('moderate'),
  preferredResolution: z.enum(['full', 'half', 'quarter', 'eighth', 'dynamic']).default('full'),

  // Capabilities and sandbox
  capabilities: capabilityFlagsSchema.default({}),
  sandbox: sandboxConfigSchema.default({}),
  assetAccess: assetAccessRulesSchema.default({}),

  // Dependencies
  dependencies: z.array(z.string()).default([]),
  optionalDependencies: z.array(z.string()).default([])
});

export type PluginManifest = z.infer<typeof pluginManifestSchema>;

// ============================================================================
// Plugin Runtime State
// ============================================================================

export interface PluginRuntimeState {
  manifest: PluginManifest;
  loaded: boolean;
  enabled: boolean;
  error: string | null;
  lastLoadTime: number;
  parameterValues: Record<string, number | boolean | string | number[]>;
  resourceUsage: {
    textureMemoryMB: number;
    framebufferCount: number;
    textureCount: number;
  };
}

// ============================================================================
// Validation Helpers
// ============================================================================

export const validatePluginManifest = (
  manifest: unknown
): { valid: boolean; errors: string[]; manifest?: PluginManifest } => {
  const result = pluginManifestSchema.safeParse(manifest);

  if (!result.success) {
    return {
      valid: false,
      errors: result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`)
    };
  }

  const errors: string[] = [];

  // Check API version compatibility
  const [major] = result.data.apiVersion.split('.').map(Number);
  const [currentMajor] = PLUGIN_API_VERSION.split('.').map(Number);
  if (major !== currentMajor) {
    errors.push(`Incompatible API version: ${result.data.apiVersion} (current: ${PLUGIN_API_VERSION})`);
  }

  // Check for required outputs
  if (result.data.outputs.length === 0) {
    errors.push('Plugin must have at least one output port');
  }

  // Validate parameter IDs are unique
  const paramIds = new Set<string>();
  for (const param of result.data.parameters) {
    if (paramIds.has(param.id)) {
      errors.push(`Duplicate parameter ID: ${param.id}`);
    }
    paramIds.add(param.id);
  }

  // Validate port IDs are unique
  const inputIds = new Set<string>();
  for (const input of result.data.inputs) {
    if (inputIds.has(input.id)) {
      errors.push(`Duplicate input port ID: ${input.id}`);
    }
    inputIds.add(input.id);
  }

  const outputIds = new Set<string>();
  for (const output of result.data.outputs) {
    if (outputIds.has(output.id)) {
      errors.push(`Duplicate output port ID: ${output.id}`);
    }
    outputIds.add(output.id);
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, errors: [], manifest: result.data };
};

// ============================================================================
// Plugin Shader Validation (Stub)
// ============================================================================

export interface ShaderValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  uniformBindings: { name: string; type: string; location: number }[];
  estimatedCost: number;
}

export const validatePluginShader = (
  _shaderSource: string,
  _manifest: PluginManifest
): ShaderValidationResult => {
  // This is a stub - actual shader validation would involve:
  // 1. Parsing GLSL
  // 2. Checking uniform declarations match parameters
  // 3. Validating against sandbox limits
  // 4. Estimating instruction count

  return {
    valid: true,
    errors: [],
    warnings: [],
    uniformBindings: [],
    estimatedCost: 1.0
  };
};

// ============================================================================
// Plugin Loading Helpers
// ============================================================================

export const createPluginRuntimeState = (manifest: PluginManifest): PluginRuntimeState => ({
  manifest,
  loaded: false,
  enabled: false,
  error: null,
  lastLoadTime: 0,
  parameterValues: Object.fromEntries(
    manifest.parameters.map((p) => [p.id, p.defaultValue])
  ),
  resourceUsage: {
    textureMemoryMB: 0,
    framebufferCount: 0,
    textureCount: 0
  }
});

export const checkPluginCompatibility = (
  manifest: PluginManifest,
  hostCapabilities: Partial<CapabilityFlags>
): { compatible: boolean; missingCapabilities: string[] } => {
  const missing: string[] = [];
  const caps = manifest.capabilities;

  if (caps.requiresWebGL2 && !hostCapabilities.requiresWebGL2) {
    missing.push('WebGL2');
  }
  if (caps.requiresFloatTextures && !hostCapabilities.requiresFloatTextures) {
    missing.push('Float Textures');
  }
  if (caps.requiresComputeShaders && !hostCapabilities.requiresComputeShaders) {
    missing.push('Compute Shaders');
  }

  return {
    compatible: missing.length === 0,
    missingCapabilities: missing
  };
};
