/**
 * Performance Guardrails - Resource management, quality scaling, and GPU timing
 *
 * This module provides:
 * - FBO/texture pooling with lifecycle management
 * - Dynamic resolution negotiation
 * - Quality scaling based on budget constraints
 * - GPU timing instrumentation
 * - Shader compilation strategies
 * - Performance dashboard integration
 */

// ============================================================================
// Resource Pool Types
// ============================================================================

export interface FBODescriptor {
  id: string;
  width: number;
  height: number;
  format: 'rgba8' | 'rgba16f' | 'rgba32f' | 'depth24' | 'depth32f';
  samples: number; // MSAA samples (1 = no MSAA)
  lastUsedFrame: number;
  inUse: boolean;
}

export interface TextureDescriptor {
  id: string;
  width: number;
  height: number;
  format: 'rgba8' | 'rgba16f' | 'rgba32f' | 'r8' | 'rg8';
  mipLevels: number;
  lastUsedFrame: number;
  inUse: boolean;
}

export interface ResourcePoolConfig {
  maxFBOs: number;
  maxTextures: number;
  maxFBOMemoryMB: number;
  maxTextureMemoryMB: number;
  recycleAfterFrames: number; // Recycle unused resources after N frames
  enableAggressiveRecycling: boolean;
}

export const DEFAULT_RESOURCE_POOL_CONFIG: ResourcePoolConfig = {
  maxFBOs: 32,
  maxTextures: 64,
  maxFBOMemoryMB: 512,
  maxTextureMemoryMB: 1024,
  recycleAfterFrames: 60,
  enableAggressiveRecycling: false
};

export interface ResourcePoolState {
  fbos: Map<string, FBODescriptor>;
  textures: Map<string, TextureDescriptor>;
  currentFrame: number;
  fboMemoryUsedMB: number;
  textureMemoryUsedMB: number;
  config: ResourcePoolConfig;
  allocationHistory: ResourceAllocationEvent[];
}

export interface ResourceAllocationEvent {
  type: 'allocate' | 'release' | 'recycle';
  resourceType: 'fbo' | 'texture';
  resourceId: string;
  frame: number;
  memoryMB: number;
}

// ============================================================================
// Memory Calculation
// ============================================================================

const FORMAT_BYTES_PER_PIXEL: Record<string, number> = {
  rgba8: 4,
  rgba16f: 8,
  rgba32f: 16,
  r8: 1,
  rg8: 2,
  depth24: 3,
  depth32f: 4
};

export const calculateFBOMemory = (desc: FBODescriptor): number => {
  const bytesPerPixel = FORMAT_BYTES_PER_PIXEL[desc.format] ?? 4;
  const pixels = desc.width * desc.height * desc.samples;
  return (pixels * bytesPerPixel) / (1024 * 1024);
};

export const calculateTextureMemory = (desc: TextureDescriptor): number => {
  const bytesPerPixel = FORMAT_BYTES_PER_PIXEL[desc.format] ?? 4;
  let totalPixels = 0;
  let w = desc.width;
  let h = desc.height;

  for (let level = 0; level < desc.mipLevels; level++) {
    totalPixels += w * h;
    w = Math.max(1, Math.floor(w / 2));
    h = Math.max(1, Math.floor(h / 2));
  }

  return (totalPixels * bytesPerPixel) / (1024 * 1024);
};

// ============================================================================
// Resource Pool Operations
// ============================================================================

export const createResourcePool = (
  config: Partial<ResourcePoolConfig> = {}
): ResourcePoolState => ({
  fbos: new Map(),
  textures: new Map(),
  currentFrame: 0,
  fboMemoryUsedMB: 0,
  textureMemoryUsedMB: 0,
  config: { ...DEFAULT_RESOURCE_POOL_CONFIG, ...config },
  allocationHistory: []
});

export const allocateFBO = (
  pool: ResourcePoolState,
  width: number,
  height: number,
  format: FBODescriptor['format'] = 'rgba8',
  samples = 1
): { pool: ResourcePoolState; fbo: FBODescriptor | null; error?: string } => {
  // Check if we can reuse an existing FBO
  for (const [id, fbo] of pool.fbos) {
    if (
      !fbo.inUse &&
      fbo.width === width &&
      fbo.height === height &&
      fbo.format === format &&
      fbo.samples === samples
    ) {
      const updatedFbo: FBODescriptor = {
        ...fbo,
        inUse: true,
        lastUsedFrame: pool.currentFrame
      };
      const newFbos = new Map(pool.fbos);
      newFbos.set(id, updatedFbo);

      return {
        pool: { ...pool, fbos: newFbos },
        fbo: updatedFbo
      };
    }
  }

  // Check limits
  if (pool.fbos.size >= pool.config.maxFBOs) {
    // Try to recycle oldest unused FBO
    const recycled = recycleOldestUnused(pool, 'fbo');
    if (!recycled) {
      return { pool, fbo: null, error: 'FBO pool limit reached' };
    }
    pool = recycled;
  }

  const newFbo: FBODescriptor = {
    id: `fbo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    width,
    height,
    format,
    samples,
    lastUsedFrame: pool.currentFrame,
    inUse: true
  };

  const memoryMB = calculateFBOMemory(newFbo);

  if (pool.fboMemoryUsedMB + memoryMB > pool.config.maxFBOMemoryMB) {
    return { pool, fbo: null, error: 'FBO memory limit exceeded' };
  }

  const newFbos = new Map(pool.fbos);
  newFbos.set(newFbo.id, newFbo);

  const event: ResourceAllocationEvent = {
    type: 'allocate',
    resourceType: 'fbo',
    resourceId: newFbo.id,
    frame: pool.currentFrame,
    memoryMB
  };

  return {
    pool: {
      ...pool,
      fbos: newFbos,
      fboMemoryUsedMB: pool.fboMemoryUsedMB + memoryMB,
      allocationHistory: [...pool.allocationHistory.slice(-99), event]
    },
    fbo: newFbo
  };
};

export const releaseFBO = (pool: ResourcePoolState, fboId: string): ResourcePoolState => {
  const fbo = pool.fbos.get(fboId);
  if (!fbo) return pool;

  const updatedFbo: FBODescriptor = { ...fbo, inUse: false };
  const newFbos = new Map(pool.fbos);
  newFbos.set(fboId, updatedFbo);

  return { ...pool, fbos: newFbos };
};

export const allocateTexture = (
  pool: ResourcePoolState,
  width: number,
  height: number,
  format: TextureDescriptor['format'] = 'rgba8',
  mipLevels = 1
): { pool: ResourcePoolState; texture: TextureDescriptor | null; error?: string } => {
  // Check if we can reuse an existing texture
  for (const [id, tex] of pool.textures) {
    if (
      !tex.inUse &&
      tex.width === width &&
      tex.height === height &&
      tex.format === format &&
      tex.mipLevels === mipLevels
    ) {
      const updatedTex: TextureDescriptor = {
        ...tex,
        inUse: true,
        lastUsedFrame: pool.currentFrame
      };
      const newTextures = new Map(pool.textures);
      newTextures.set(id, updatedTex);

      return {
        pool: { ...pool, textures: newTextures },
        texture: updatedTex
      };
    }
  }

  // Check limits
  if (pool.textures.size >= pool.config.maxTextures) {
    const recycled = recycleOldestUnused(pool, 'texture');
    if (!recycled) {
      return { pool, texture: null, error: 'Texture pool limit reached' };
    }
    pool = recycled;
  }

  const newTex: TextureDescriptor = {
    id: `tex-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    width,
    height,
    format,
    mipLevels,
    lastUsedFrame: pool.currentFrame,
    inUse: true
  };

  const memoryMB = calculateTextureMemory(newTex);

  if (pool.textureMemoryUsedMB + memoryMB > pool.config.maxTextureMemoryMB) {
    return { pool, texture: null, error: 'Texture memory limit exceeded' };
  }

  const newTextures = new Map(pool.textures);
  newTextures.set(newTex.id, newTex);

  const event: ResourceAllocationEvent = {
    type: 'allocate',
    resourceType: 'texture',
    resourceId: newTex.id,
    frame: pool.currentFrame,
    memoryMB
  };

  return {
    pool: {
      ...pool,
      textures: newTextures,
      textureMemoryUsedMB: pool.textureMemoryUsedMB + memoryMB,
      allocationHistory: [...pool.allocationHistory.slice(-99), event]
    },
    texture: newTex
  };
};

export const releaseTexture = (pool: ResourcePoolState, texId: string): ResourcePoolState => {
  const tex = pool.textures.get(texId);
  if (!tex) return pool;

  const updatedTex: TextureDescriptor = { ...tex, inUse: false };
  const newTextures = new Map(pool.textures);
  newTextures.set(texId, updatedTex);

  return { ...pool, textures: newTextures };
};

const recycleOldestUnused = (
  pool: ResourcePoolState,
  type: 'fbo' | 'texture'
): ResourcePoolState | null => {
  const resources = type === 'fbo' ? pool.fbos : pool.textures;
  let oldest: { id: string; frame: number } | null = null;

  for (const [id, res] of resources) {
    if (!res.inUse) {
      if (!oldest || res.lastUsedFrame < oldest.frame) {
        oldest = { id, frame: res.lastUsedFrame };
      }
    }
  }

  if (!oldest) return null;

  if (type === 'fbo') {
    const fbo = pool.fbos.get(oldest.id)!;
    const memoryMB = calculateFBOMemory(fbo);
    const newFbos = new Map(pool.fbos);
    newFbos.delete(oldest.id);

    const event: ResourceAllocationEvent = {
      type: 'recycle',
      resourceType: 'fbo',
      resourceId: oldest.id,
      frame: pool.currentFrame,
      memoryMB
    };

    return {
      ...pool,
      fbos: newFbos,
      fboMemoryUsedMB: pool.fboMemoryUsedMB - memoryMB,
      allocationHistory: [...pool.allocationHistory.slice(-99), event]
    };
  } else {
    const tex = pool.textures.get(oldest.id)!;
    const memoryMB = calculateTextureMemory(tex);
    const newTextures = new Map(pool.textures);
    newTextures.delete(oldest.id);

    const event: ResourceAllocationEvent = {
      type: 'recycle',
      resourceType: 'texture',
      resourceId: oldest.id,
      frame: pool.currentFrame,
      memoryMB
    };

    return {
      ...pool,
      textures: newTextures,
      textureMemoryUsedMB: pool.textureMemoryUsedMB - memoryMB,
      allocationHistory: [...pool.allocationHistory.slice(-99), event]
    };
  }
};

export const advanceFrame = (pool: ResourcePoolState): ResourcePoolState => {
  let newPool = { ...pool, currentFrame: pool.currentFrame + 1 };

  if (newPool.config.enableAggressiveRecycling) {
    // Release resources not used for recycleAfterFrames
    const cutoff = newPool.currentFrame - newPool.config.recycleAfterFrames;

    for (const [id, fbo] of newPool.fbos) {
      if (!fbo.inUse && fbo.lastUsedFrame < cutoff) {
        newPool = releaseFBO(newPool, id);
        const memoryMB = calculateFBOMemory(fbo);
        const newFbos = new Map(newPool.fbos);
        newFbos.delete(id);
        newPool = {
          ...newPool,
          fbos: newFbos,
          fboMemoryUsedMB: newPool.fboMemoryUsedMB - memoryMB
        };
      }
    }

    for (const [id, tex] of newPool.textures) {
      if (!tex.inUse && tex.lastUsedFrame < cutoff) {
        const memoryMB = calculateTextureMemory(tex);
        const newTextures = new Map(newPool.textures);
        newTextures.delete(id);
        newPool = {
          ...newPool,
          textures: newTextures,
          textureMemoryUsedMB: newPool.textureMemoryUsedMB - memoryMB
        };
      }
    }
  }

  return newPool;
};

// ============================================================================
// Dynamic Resolution
// ============================================================================

export interface ResolutionConfig {
  baseWidth: number;
  baseHeight: number;
  minScale: number; // e.g., 0.5 for 50% minimum
  maxScale: number; // e.g., 2.0 for 200% maximum
  currentScale: number;
  targetFPS: number;
  adaptiveEnabled: boolean;
}

export const DEFAULT_RESOLUTION_CONFIG: ResolutionConfig = {
  baseWidth: 1920,
  baseHeight: 1080,
  minScale: 0.25,
  maxScale: 2.0,
  currentScale: 1.0,
  targetFPS: 60,
  adaptiveEnabled: true
};

export interface ResolutionState {
  config: ResolutionConfig;
  effectiveWidth: number;
  effectiveHeight: number;
  fpsHistory: number[];
  scaleHistory: number[];
  adjustmentCooldown: number;
}

export const createResolutionState = (
  config: Partial<ResolutionConfig> = {}
): ResolutionState => {
  const fullConfig = { ...DEFAULT_RESOLUTION_CONFIG, ...config };
  return {
    config: fullConfig,
    effectiveWidth: Math.floor(fullConfig.baseWidth * fullConfig.currentScale),
    effectiveHeight: Math.floor(fullConfig.baseHeight * fullConfig.currentScale),
    fpsHistory: [],
    scaleHistory: [],
    adjustmentCooldown: 0
  };
};

export const updateResolution = (
  state: ResolutionState,
  currentFPS: number,
  deltaMs: number
): ResolutionState => {
  if (!state.config.adaptiveEnabled) return state;

  // Track FPS history
  const fpsHistory = [...state.fpsHistory.slice(-29), currentFPS];
  const avgFPS = fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length;

  // Cooldown to prevent rapid oscillation
  const cooldown = Math.max(0, state.adjustmentCooldown - deltaMs);
  if (cooldown > 0) {
    return { ...state, fpsHistory, adjustmentCooldown: cooldown };
  }

  const { targetFPS, minScale, maxScale, currentScale, baseWidth, baseHeight } = state.config;

  let newScale = currentScale;

  // Scale down if significantly below target
  if (avgFPS < targetFPS * 0.85 && currentScale > minScale) {
    newScale = Math.max(minScale, currentScale * 0.9);
  }
  // Scale up if comfortably above target
  else if (avgFPS > targetFPS * 1.1 && currentScale < maxScale) {
    newScale = Math.min(maxScale, currentScale * 1.05);
  }

  // Round to reasonable increment
  newScale = Math.round(newScale * 20) / 20; // 5% increments

  if (newScale !== currentScale) {
    return {
      config: { ...state.config, currentScale: newScale },
      effectiveWidth: Math.floor(baseWidth * newScale),
      effectiveHeight: Math.floor(baseHeight * newScale),
      fpsHistory,
      scaleHistory: [...state.scaleHistory.slice(-99), newScale],
      adjustmentCooldown: 500 // 500ms cooldown after adjustment
    };
  }

  return { ...state, fpsHistory, adjustmentCooldown: cooldown };
};

export const getEffectiveResolution = (
  state: ResolutionState
): { width: number; height: number } => ({
  width: state.effectiveWidth,
  height: state.effectiveHeight
});

// ============================================================================
// Quality Scaling
// ============================================================================

export type QualityTier = 'ultra' | 'high' | 'medium' | 'low' | 'minimal';

export interface QualitySettings {
  tier: QualityTier;
  particleMultiplier: number;     // 0-1 particle count multiplier
  msaaSamples: number;            // 1, 2, 4, or 8
  shadowQuality: number;          // 0-1
  bloomQuality: number;           // 0-1
  maxTextureSize: number;         // Max texture dimension
  enablePostProcessing: boolean;
  enableParticles: boolean;
  enableShadows: boolean;
}

export const QUALITY_PRESETS: Record<QualityTier, QualitySettings> = {
  ultra: {
    tier: 'ultra',
    particleMultiplier: 1.0,
    msaaSamples: 8,
    shadowQuality: 1.0,
    bloomQuality: 1.0,
    maxTextureSize: 4096,
    enablePostProcessing: true,
    enableParticles: true,
    enableShadows: true
  },
  high: {
    tier: 'high',
    particleMultiplier: 0.75,
    msaaSamples: 4,
    shadowQuality: 0.75,
    bloomQuality: 0.75,
    maxTextureSize: 2048,
    enablePostProcessing: true,
    enableParticles: true,
    enableShadows: true
  },
  medium: {
    tier: 'medium',
    particleMultiplier: 0.5,
    msaaSamples: 2,
    shadowQuality: 0.5,
    bloomQuality: 0.5,
    maxTextureSize: 1024,
    enablePostProcessing: true,
    enableParticles: true,
    enableShadows: false
  },
  low: {
    tier: 'low',
    particleMultiplier: 0.25,
    msaaSamples: 1,
    shadowQuality: 0,
    bloomQuality: 0.25,
    maxTextureSize: 512,
    enablePostProcessing: true,
    enableParticles: true,
    enableShadows: false
  },
  minimal: {
    tier: 'minimal',
    particleMultiplier: 0.1,
    msaaSamples: 1,
    shadowQuality: 0,
    bloomQuality: 0,
    maxTextureSize: 256,
    enablePostProcessing: false,
    enableParticles: false,
    enableShadows: false
  }
};

export interface QualityState {
  current: QualitySettings;
  target: QualityTier;
  autoAdjust: boolean;
  gpuBudgetMs: number; // Target frame time budget
  currentFrameTimeMs: number;
  frameTimeHistory: number[];
}

export const createQualityState = (
  tier: QualityTier = 'high',
  autoAdjust = true,
  gpuBudgetMs = 16.67
): QualityState => ({
  current: { ...QUALITY_PRESETS[tier] },
  target: tier,
  autoAdjust,
  gpuBudgetMs,
  currentFrameTimeMs: 0,
  frameTimeHistory: []
});

const QUALITY_ORDER: QualityTier[] = ['minimal', 'low', 'medium', 'high', 'ultra'];

export const updateQuality = (
  state: QualityState,
  frameTimeMs: number
): QualityState => {
  const frameTimeHistory = [...state.frameTimeHistory.slice(-29), frameTimeMs];
  const avgFrameTime = frameTimeHistory.reduce((a, b) => a + b, 0) / frameTimeHistory.length;

  if (!state.autoAdjust || frameTimeHistory.length < 10) {
    return { ...state, currentFrameTimeMs: frameTimeMs, frameTimeHistory };
  }

  const currentIndex = QUALITY_ORDER.indexOf(state.current.tier);

  // Scale down if over budget
  if (avgFrameTime > state.gpuBudgetMs * 1.2 && currentIndex > 0) {
    const newTier = QUALITY_ORDER[currentIndex - 1];
    return {
      ...state,
      current: { ...QUALITY_PRESETS[newTier] },
      currentFrameTimeMs: frameTimeMs,
      frameTimeHistory
    };
  }

  // Scale up if well under budget
  if (avgFrameTime < state.gpuBudgetMs * 0.7 && currentIndex < QUALITY_ORDER.length - 1) {
    const newTier = QUALITY_ORDER[currentIndex + 1];
    // Only scale up to target, not beyond
    if (QUALITY_ORDER.indexOf(newTier) <= QUALITY_ORDER.indexOf(state.target)) {
      return {
        ...state,
        current: { ...QUALITY_PRESETS[newTier] },
        currentFrameTimeMs: frameTimeMs,
        frameTimeHistory
      };
    }
  }

  return { ...state, currentFrameTimeMs: frameTimeMs, frameTimeHistory };
};

export const setQualityTarget = (state: QualityState, tier: QualityTier): QualityState => ({
  ...state,
  target: tier,
  current: { ...QUALITY_PRESETS[tier] }
});

// ============================================================================
// GPU Timing Instrumentation
// ============================================================================

export interface GPUTimingResult {
  id: string;
  name: string;
  startMs: number;
  endMs: number;
  durationMs: number;
}

export interface GPUTimingState {
  enabled: boolean;
  extensionAvailable: boolean;
  pendingQueries: Map<string, { name: string; startQuery: unknown; endQuery: unknown }>;
  completedTimings: GPUTimingResult[];
  frameTimings: Map<string, number[]>; // Rolling average per operation
  totalFrameTimeMs: number;
}

export const createGPUTimingState = (extensionAvailable = false): GPUTimingState => ({
  enabled: extensionAvailable,
  extensionAvailable,
  pendingQueries: new Map(),
  completedTimings: [],
  frameTimings: new Map(),
  totalFrameTimeMs: 0
});

export const beginGPUTiming = (
  state: GPUTimingState,
  id: string,
  name: string
): GPUTimingState => {
  if (!state.enabled) return state;

  // In actual implementation, this would create WebGL queries
  // For now, we track with high-resolution time as a stub
  const pending = new Map(state.pendingQueries);
  pending.set(id, {
    name,
    startQuery: performance.now(),
    endQuery: null
  });

  return { ...state, pendingQueries: pending };
};

export const endGPUTiming = (state: GPUTimingState, id: string): GPUTimingState => {
  if (!state.enabled) return state;

  const query = state.pendingQueries.get(id);
  if (!query) return state;

  const endTime = performance.now();
  const startTime = query.startQuery as number;
  const durationMs = endTime - startTime;

  const result: GPUTimingResult = {
    id,
    name: query.name,
    startMs: startTime,
    endMs: endTime,
    durationMs
  };

  const pending = new Map(state.pendingQueries);
  pending.delete(id);

  // Update rolling average
  const frameTimings = new Map(state.frameTimings);
  const existing = frameTimings.get(query.name) ?? [];
  frameTimings.set(query.name, [...existing.slice(-59), durationMs]);

  return {
    ...state,
    pendingQueries: pending,
    completedTimings: [...state.completedTimings.slice(-99), result],
    frameTimings
  };
};

export const getAverageTimingMs = (state: GPUTimingState, name: string): number => {
  const timings = state.frameTimings.get(name);
  if (!timings || timings.length === 0) return 0;
  return timings.reduce((a, b) => a + b, 0) / timings.length;
};

export const resetFrameTimings = (state: GPUTimingState): GPUTimingState => ({
  ...state,
  completedTimings: [],
  totalFrameTimeMs: 0
});

// ============================================================================
// Shader Compilation Strategy
// ============================================================================

export type ShaderCompileStatus = 'pending' | 'compiling' | 'compiled' | 'failed' | 'fallback';

export interface ShaderEntry {
  id: string;
  name: string;
  vertexSource: string;
  fragmentSource: string;
  status: ShaderCompileStatus;
  compileTimeMs: number;
  error?: string;
  fallbackId?: string;
  priority: number; // Higher = compile first
}

export interface ShaderCompileState {
  shaders: Map<string, ShaderEntry>;
  compileQueue: string[];
  currentlyCompiling: string | null;
  warmupComplete: boolean;
  asyncCompileEnabled: boolean;
  fallbackShaderAvailable: boolean;
}

export const createShaderCompileState = (): ShaderCompileState => ({
  shaders: new Map(),
  compileQueue: [],
  currentlyCompiling: null,
  warmupComplete: false,
  asyncCompileEnabled: true,
  fallbackShaderAvailable: false
});

export const registerShader = (
  state: ShaderCompileState,
  entry: Omit<ShaderEntry, 'status' | 'compileTimeMs'>
): ShaderCompileState => {
  const shader: ShaderEntry = {
    ...entry,
    status: 'pending',
    compileTimeMs: 0
  };

  const shaders = new Map(state.shaders);
  shaders.set(entry.id, shader);

  // Add to queue sorted by priority
  const queue = [...state.compileQueue, entry.id].sort((a, b) => {
    const shaderA = shaders.get(a);
    const shaderB = shaders.get(b);
    return (shaderB?.priority ?? 0) - (shaderA?.priority ?? 0);
  });

  return { ...state, shaders, compileQueue: queue };
};

export const markShaderCompiling = (
  state: ShaderCompileState,
  shaderId: string
): ShaderCompileState => {
  const shader = state.shaders.get(shaderId);
  if (!shader) return state;

  const shaders = new Map(state.shaders);
  shaders.set(shaderId, { ...shader, status: 'compiling' });

  return {
    ...state,
    shaders,
    currentlyCompiling: shaderId,
    compileQueue: state.compileQueue.filter((id) => id !== shaderId)
  };
};

export const markShaderCompiled = (
  state: ShaderCompileState,
  shaderId: string,
  compileTimeMs: number
): ShaderCompileState => {
  const shader = state.shaders.get(shaderId);
  if (!shader) return state;

  const shaders = new Map(state.shaders);
  shaders.set(shaderId, {
    ...shader,
    status: 'compiled',
    compileTimeMs
  });

  const warmupComplete =
    state.compileQueue.length === 0 && state.currentlyCompiling === shaderId;

  return {
    ...state,
    shaders,
    currentlyCompiling: null,
    warmupComplete
  };
};

export const markShaderFailed = (
  state: ShaderCompileState,
  shaderId: string,
  error: string
): ShaderCompileState => {
  const shader = state.shaders.get(shaderId);
  if (!shader) return state;

  const shaders = new Map(state.shaders);
  shaders.set(shaderId, {
    ...shader,
    status: shader.fallbackId ? 'fallback' : 'failed',
    error
  });

  return {
    ...state,
    shaders,
    currentlyCompiling: null
  };
};

export const getNextShaderToCompile = (state: ShaderCompileState): string | null => {
  if (state.currentlyCompiling) return null;
  return state.compileQueue[0] ?? null;
};

export const getShaderStatus = (
  state: ShaderCompileState,
  shaderId: string
): ShaderCompileStatus | null => {
  return state.shaders.get(shaderId)?.status ?? null;
};

// ============================================================================
// Performance Dashboard State
// ============================================================================

export type PerformanceAlert = 'none' | 'warning' | 'critical';

export interface PerformanceMetrics {
  fps: number;
  frameTimeMs: number;
  gpuTimeMs: number;
  cpuTimeMs: number;
  memoryUsedMB: number;
  fboCount: number;
  textureCount: number;
  drawCalls: number;
  triangles: number;
  resolutionScale: number;
  qualityTier: QualityTier;
}

export interface PerformanceDashboardState {
  enabled: boolean;
  metrics: PerformanceMetrics;
  metricsHistory: PerformanceMetrics[];
  alertLevel: PerformanceAlert;
  alertMessage: string;
  targetFPS: number;
  gpuBudgetMs: number;
  memoryBudgetMB: number;
  autoAdjustEnabled: boolean;
  recommendations: string[];
}

export const DEFAULT_PERFORMANCE_METRICS: PerformanceMetrics = {
  fps: 60,
  frameTimeMs: 16.67,
  gpuTimeMs: 0,
  cpuTimeMs: 0,
  memoryUsedMB: 0,
  fboCount: 0,
  textureCount: 0,
  drawCalls: 0,
  triangles: 0,
  resolutionScale: 1.0,
  qualityTier: 'high'
};

export const createPerformanceDashboard = (
  targetFPS = 60,
  gpuBudgetMs = 16.67,
  memoryBudgetMB = 1024
): PerformanceDashboardState => ({
  enabled: true,
  metrics: { ...DEFAULT_PERFORMANCE_METRICS },
  metricsHistory: [],
  alertLevel: 'none',
  alertMessage: '',
  targetFPS,
  gpuBudgetMs,
  memoryBudgetMB,
  autoAdjustEnabled: true,
  recommendations: []
});

export const updatePerformanceDashboard = (
  state: PerformanceDashboardState,
  metrics: Partial<PerformanceMetrics>
): PerformanceDashboardState => {
  const newMetrics = { ...state.metrics, ...metrics };
  const metricsHistory = [...state.metricsHistory.slice(-299), newMetrics];

  // Analyze and generate alerts/recommendations
  const recommendations: string[] = [];
  let alertLevel: PerformanceAlert = 'none';
  let alertMessage = '';

  // FPS check
  if (newMetrics.fps < state.targetFPS * 0.5) {
    alertLevel = 'critical';
    alertMessage = `Critical: FPS dropped to ${newMetrics.fps.toFixed(1)}`;
    recommendations.push('Reduce resolution scale');
    recommendations.push('Lower quality tier');
  } else if (newMetrics.fps < state.targetFPS * 0.8) {
    alertLevel = 'warning';
    alertMessage = `Warning: FPS at ${newMetrics.fps.toFixed(1)}`;
    recommendations.push('Consider reducing effects');
  }

  // Memory check
  if (newMetrics.memoryUsedMB > state.memoryBudgetMB * 0.9) {
    if (alertLevel !== 'critical') {
      alertLevel = 'warning';
      alertMessage = `Warning: High memory usage (${newMetrics.memoryUsedMB.toFixed(0)}MB)`;
    }
    recommendations.push('Reduce texture sizes');
    recommendations.push('Enable aggressive resource recycling');
  }

  // GPU time check
  if (newMetrics.gpuTimeMs > state.gpuBudgetMs * 1.5) {
    if (alertLevel !== 'critical') {
      alertLevel = alertLevel === 'none' ? 'warning' : alertLevel;
    }
    recommendations.push('Reduce post-processing effects');
    recommendations.push('Lower particle counts');
  }

  return {
    ...state,
    metrics: newMetrics,
    metricsHistory,
    alertLevel,
    alertMessage,
    recommendations
  };
};

export const getPerformanceReport = (state: PerformanceDashboardState): string => {
  const { metrics } = state;
  return [
    `FPS: ${metrics.fps.toFixed(1)} (target: ${state.targetFPS})`,
    `Frame time: ${metrics.frameTimeMs.toFixed(2)}ms`,
    `GPU time: ${metrics.gpuTimeMs.toFixed(2)}ms`,
    `Memory: ${metrics.memoryUsedMB.toFixed(0)}MB / ${state.memoryBudgetMB}MB`,
    `Resolution: ${(metrics.resolutionScale * 100).toFixed(0)}%`,
    `Quality: ${metrics.qualityTier}`,
    `FBOs: ${metrics.fboCount}, Textures: ${metrics.textureCount}`,
    `Draw calls: ${metrics.drawCalls}, Triangles: ${metrics.triangles}`
  ].join('\n');
};

export const shouldTriggerAdjustment = (state: PerformanceDashboardState): boolean =>
  state.autoAdjustEnabled && state.alertLevel !== 'none';
