/**
 * SDF Runtime
 *
 * Handles uniform packing, parameter binding, and modulation for SDF shaders.
 */

import type {
  SdfSceneConfig,
  SdfNodeInstance,
  SdfCompiledShader,
  SdfUniformBinding,
  SdfParameter
} from '../api';
import { sdfRegistry } from '../registry';

// ============================================================================
// Types
// ============================================================================

export interface SdfRuntimeState {
  gl: WebGL2RenderingContext;
  program: WebGLProgram | null;
  uniformLocations: Map<string, WebGLUniformLocation>;
  currentValues: Map<string, number | number[]>;
  modValues: Map<string, number>;
  lastCompileTime: number;
  frameCount: number;
  fps: number;
  lastFrameTime: number;
}

export interface ModulationSource {
  id: string;
  getValue: () => number;
}

export interface SdfRuntimeConfig {
  enableModulation: boolean;
  modulationSources: Map<string, ModulationSource>;
  autoRecompile: boolean;
  maxUniformUpdatesPerFrame: number;
}

// ============================================================================
// Runtime State Management
// ============================================================================

export const createRuntimeState = (gl: WebGL2RenderingContext): SdfRuntimeState => ({
  gl,
  program: null,
  uniformLocations: new Map(),
  currentValues: new Map(),
  modValues: new Map(),
  lastCompileTime: 0,
  frameCount: 0,
  fps: 60,
  lastFrameTime: performance.now()
});

export const defaultRuntimeConfig: SdfRuntimeConfig = {
  enableModulation: true,
  modulationSources: new Map(),
  autoRecompile: true,
  maxUniformUpdatesPerFrame: 100
};

// ============================================================================
// Shader Program Management
// ============================================================================

const VERTEX_SHADER_SOURCE = `#version 300 es
precision highp float;

in vec2 aPosition;
out vec2 vUv;

void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

export const compileProgram = (
  state: SdfRuntimeState,
  fragmentSource: string
): { success: boolean; error?: string } => {
  const { gl } = state;

  // Compile vertex shader
  const vertexShader = gl.createShader(gl.VERTEX_SHADER);
  if (!vertexShader) return { success: false, error: 'Failed to create vertex shader' };

  gl.shaderSource(vertexShader, VERTEX_SHADER_SOURCE);
  gl.compileShader(vertexShader);

  if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(vertexShader);
    gl.deleteShader(vertexShader);
    return { success: false, error: `Vertex shader error: ${log}` };
  }

  // Compile fragment shader
  const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
  if (!fragmentShader) {
    gl.deleteShader(vertexShader);
    return { success: false, error: 'Failed to create fragment shader' };
  }

  gl.shaderSource(fragmentShader, fragmentSource);
  gl.compileShader(fragmentShader);

  if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(fragmentShader);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    return { success: false, error: `Fragment shader error: ${log}` };
  }

  // Link program
  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    return { success: false, error: 'Failed to create program' };
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  // Clean up shaders (they're now part of the program)
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    return { success: false, error: `Program link error: ${log}` };
  }

  // Clean up old program
  if (state.program) {
    gl.deleteProgram(state.program);
  }

  state.program = program;
  state.uniformLocations.clear();
  state.lastCompileTime = performance.now();

  return { success: true };
};

// ============================================================================
// Uniform Management
// ============================================================================

export const cacheUniformLocations = (
  state: SdfRuntimeState,
  uniforms: SdfUniformBinding[]
): void => {
  const { gl, program } = state;
  if (!program) return;

  state.uniformLocations.clear();

  for (const uniform of uniforms) {
    const location = gl.getUniformLocation(program, uniform.glslName);
    if (location !== null) {
      state.uniformLocations.set(uniform.glslName, location);
    }
  }

  // Cache built-in uniforms
  const builtins = ['uTime', 'uResolution', 'uMouse', 'uAspect'];
  for (const name of builtins) {
    const location = gl.getUniformLocation(program, name);
    if (location !== null) {
      state.uniformLocations.set(name, location);
    }
  }
};

export const setUniform = (
  state: SdfRuntimeState,
  name: string,
  value: number | number[]
): void => {
  const { gl, uniformLocations, currentValues } = state;
  const location = uniformLocations.get(name);
  if (!location) return;

  // Skip if value hasn't changed
  const current = currentValues.get(name);
  if (current !== undefined) {
    if (typeof value === 'number' && value === current) return;
    if (Array.isArray(value) && Array.isArray(current)) {
      if (value.length === current.length && value.every((v, i) => v === current[i])) return;
    }
  }

  // Update the uniform
  if (typeof value === 'number') {
    gl.uniform1f(location, value);
  } else if (value.length === 2) {
    gl.uniform2f(location, value[0], value[1]);
  } else if (value.length === 3) {
    gl.uniform3f(location, value[0], value[1], value[2]);
  } else if (value.length === 4) {
    gl.uniform4f(location, value[0], value[1], value[2], value[3]);
  }

  currentValues.set(name, value);
};

export const setUniformInt = (
  state: SdfRuntimeState,
  name: string,
  value: number
): void => {
  const { gl, uniformLocations, currentValues } = state;
  const location = uniformLocations.get(name);
  if (!location) return;

  const current = currentValues.get(name);
  if (current === value) return;

  gl.uniform1i(location, value);
  currentValues.set(name, value);
};

// ============================================================================
// Parameter Binding
// ============================================================================

export interface ParameterUpdate {
  uniformName: string;
  value: number | number[];
}

export const computeParameterUpdates = (
  scene: SdfSceneConfig,
  compiled: SdfCompiledShader,
  config: SdfRuntimeConfig
): ParameterUpdate[] => {
  const updates: ParameterUpdate[] = [];

  for (const uniform of compiled.uniforms) {
    const instance = scene.nodes.find(n => n.instanceId === uniform.instanceId);
    if (!instance) continue;

    const nodeDef = sdfRegistry.get(instance.nodeId);
    if (!nodeDef) continue;

    // Get base value from instance params or defaults
    let value = instance.params[uniform.parameterId];
    if (value === undefined) {
      value = nodeDef.defaults[uniform.parameterId];
    }
    if (value === undefined) {
      const param = nodeDef.parameters.find(p => p.id === uniform.parameterId);
      value = param?.default;
    }

    if (value === undefined) continue;

    // Apply modulation if enabled
    if (config.enableModulation && uniform.modSourceId) {
      const modSource = config.modulationSources.get(uniform.modSourceId);
      if (modSource) {
        const modValue = modSource.getValue();
        const param = nodeDef.parameters.find(p => p.id === uniform.parameterId);
        if (param && typeof value === 'number') {
          value = applyModulation(value, modValue, param);
        }
      }
    }

    updates.push({
      uniformName: uniform.glslName,
      value: value as number | number[]
    });
  }

  return updates;
};

const applyModulation = (
  baseValue: number,
  modValue: number,
  param: SdfParameter
): number => {
  // Modulation is typically -1 to 1 range
  const modAmount = modValue;

  // Scale to parameter range if defined
  const min = param.min ?? 0;
  const max = param.max ?? 1;
  const range = max - min;

  // Apply modulation as offset scaled by range
  let result = baseValue + modAmount * range * 0.5;

  // Clamp to parameter bounds
  if (param.min !== undefined) result = Math.max(result, param.min);
  if (param.max !== undefined) result = Math.min(result, param.max);

  return result;
};

// ============================================================================
// Frame Update
// ============================================================================

export const updateFrame = (
  state: SdfRuntimeState,
  scene: SdfSceneConfig,
  compiled: SdfCompiledShader,
  config: SdfRuntimeConfig,
  time: number,
  resolution: [number, number],
  mouse?: [number, number]
): void => {
  const { gl, program } = state;
  if (!program) return;

  gl.useProgram(program);

  // Update built-in uniforms
  setUniform(state, 'uTime', time);
  setUniform(state, 'uResolution', resolution);
  setUniform(state, 'uAspect', resolution[0] / resolution[1]);

  if (mouse) {
    setUniform(state, 'uMouse', mouse);
  }

  // Compute and apply parameter updates
  const updates = computeParameterUpdates(scene, compiled, config);
  const maxUpdates = Math.min(updates.length, config.maxUniformUpdatesPerFrame);

  for (let i = 0; i < maxUpdates; i++) {
    const { uniformName, value } = updates[i];
    setUniform(state, uniformName, value);
  }

  // Update FPS counter
  const now = performance.now();
  const delta = now - state.lastFrameTime;
  state.fps = state.fps * 0.9 + (1000 / delta) * 0.1; // Smoothed FPS
  state.lastFrameTime = now;
  state.frameCount++;
};

// ============================================================================
// Rendering
// ============================================================================

export const renderSdfScene = (
  state: SdfRuntimeState,
  scene: SdfSceneConfig,
  compiled: SdfCompiledShader,
  config: SdfRuntimeConfig,
  time: number,
  resolution: [number, number],
  mouse?: [number, number]
): void => {
  const { gl, program } = state;
  if (!program) return;

  // Update uniforms
  updateFrame(state, scene, compiled, config, time, resolution, mouse);

  // Set viewport
  gl.viewport(0, 0, resolution[0], resolution[1]);

  // Draw fullscreen quad
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
};

// ============================================================================
// Fullscreen Quad Setup
// ============================================================================

let quadVAO: WebGLVertexArrayObject | null = null;
let quadVBO: WebGLBuffer | null = null;

export const setupFullscreenQuad = (gl: WebGL2RenderingContext): void => {
  if (quadVAO) return;

  quadVAO = gl.createVertexArray();
  quadVBO = gl.createBuffer();

  gl.bindVertexArray(quadVAO);
  gl.bindBuffer(gl.ARRAY_BUFFER, quadVBO);

  const vertices = new Float32Array([
    -1, -1,
     1, -1,
    -1,  1,
     1,  1
  ]);

  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  gl.bindVertexArray(null);
};

export const bindFullscreenQuad = (gl: WebGL2RenderingContext): void => {
  if (!quadVAO) setupFullscreenQuad(gl);
  gl.bindVertexArray(quadVAO);
};

// ============================================================================
// Resource Cleanup
// ============================================================================

export const disposeRuntime = (state: SdfRuntimeState): void => {
  const { gl, program } = state;

  if (program) {
    gl.deleteProgram(program);
    state.program = null;
  }

  state.uniformLocations.clear();
  state.currentValues.clear();
  state.modValues.clear();
};

export const disposeQuad = (gl: WebGL2RenderingContext): void => {
  if (quadVAO) {
    gl.deleteVertexArray(quadVAO);
    quadVAO = null;
  }
  if (quadVBO) {
    gl.deleteBuffer(quadVBO);
    quadVBO = null;
  }
};

// ============================================================================
// Utility Functions
// ============================================================================

export const getGpuMemoryUsage = (state: SdfRuntimeState): number => {
  // Estimate based on uniform count and program size
  const uniformBytes = state.uniformLocations.size * 4 * 4; // Assume vec4 worst case
  return uniformBytes;
};

export const getShaderComplexity = (compiled: SdfCompiledShader): {
  uniformCount: number;
  nodeCount: number;
  estimatedCost: number;
} => ({
  uniformCount: compiled.uniforms.length,
  nodeCount: compiled.nodeOrder.length,
  estimatedCost: compiled.totalCost
});
