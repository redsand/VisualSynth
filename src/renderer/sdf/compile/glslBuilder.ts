/**
 * GLSL Builder
 *
 * Compiles SDF node graphs into GLSL shader code.
 * Handles dependency resolution, uniform generation, and code assembly.
 */

import type {
  SdfNodeDefinition,
  SdfNodeInstance,
  SdfConnection,
  SdfSceneConfig,
  SdfCompiledShader,
  SdfUniformBinding,
  SdfRenderConfig2D,
  SdfRenderConfig3D,
  SdfDebugConfig
} from '../api';
import { sdfRegistry } from '../registry';
import { ALL_GLSL_UTILS_WITH_NOISE } from '../nodes/utils/glslUtils';

// ============================================================================
// Uniform Name Generation
// ============================================================================

const sanitizeId = (id: string): string => {
  return id.replace(/[^a-zA-Z0-9]/g, '_');
};

const uniformName = (instanceId: string, paramId: string): string => {
  return `u_${sanitizeId(instanceId)}_${sanitizeId(paramId)}`;
};

const functionName = (nodeId: string): string => {
  return `sdf_${sanitizeId(nodeId)}`;
};

// ============================================================================
// Dependency Resolution
// ============================================================================

interface DependencyGraph {
  nodes: Map<string, Set<string>>;  // node -> depends on
}

const buildDependencyGraph = (
  instances: SdfNodeInstance[],
  connections: SdfConnection[]
): DependencyGraph => {
  const graph: DependencyGraph = { nodes: new Map() };

  for (const instance of instances) {
    graph.nodes.set(instance.instanceId, new Set());
  }

  for (const conn of connections) {
    const deps = graph.nodes.get(conn.to);
    if (deps) {
      deps.add(conn.from);
    }
  }

  return graph;
};

const topologicalSort = (
  instances: SdfNodeInstance[],
  graph: DependencyGraph
): SdfNodeInstance[] => {
  const sorted: SdfNodeInstance[] = [];
  const visited = new Set<string>();
  const temp = new Set<string>();

  const visit = (instanceId: string) => {
    if (temp.has(instanceId)) {
      throw new Error(`Circular dependency detected at node ${instanceId}`);
    }
    if (visited.has(instanceId)) return;

    temp.add(instanceId);
    const deps = graph.nodes.get(instanceId);
    if (deps) {
      for (const dep of deps) {
        visit(dep);
      }
    }
    temp.delete(instanceId);
    visited.add(instanceId);

    const instance = instances.find(i => i.instanceId === instanceId);
    if (instance) {
      sorted.push(instance);
    }
  };

  for (const instance of instances) {
    visit(instance.instanceId);
  }

  return sorted;
};

// ============================================================================
// Uniform Binding Generation
// ============================================================================

const generateUniformBindings = (
  instances: SdfNodeInstance[]
): SdfUniformBinding[] => {
  const bindings: SdfUniformBinding[] = [];
  let offset = 0;

  for (const instance of instances) {
    const nodeDef = sdfRegistry.get(instance.nodeId);
    if (!nodeDef) continue;

    for (const param of nodeDef.parameters) {
      const uName = uniformName(instance.instanceId, param.id);
      let glslType: 'float' | 'int' | 'vec2' | 'vec3' | 'vec4' = 'float';

      switch (param.type) {
        case 'float':
        case 'angle':
          glslType = 'float';
          break;
        case 'int':
        case 'enum':
        case 'bool':
          glslType = 'float'; // Use float for uniformity
          break;
        case 'vec2':
          glslType = 'vec2';
          break;
        case 'vec3':
          glslType = 'vec3';
          break;
        case 'vec4':
        case 'color':
          glslType = 'vec4';
          break;
      }

      bindings.push({
        name: uName,
        instanceId: instance.instanceId,
        parameterId: param.id,
        type: glslType,
        offset
      });

      // Update offset based on type size
      switch (glslType) {
        case 'float':
        case 'int':
          offset += 4;
          break;
        case 'vec2':
          offset += 8;
          break;
        case 'vec3':
          offset += 12;
          break;
        case 'vec4':
          offset += 16;
          break;
      }
    }
  }

  return bindings;
};

// ============================================================================
// GLSL Code Generation
// ============================================================================

const generateUniformDeclarations = (bindings: SdfUniformBinding[]): string => {
  const lines: string[] = [];
  for (const binding of bindings) {
    lines.push(`uniform ${binding.type} ${binding.name};`);
  }
  return lines.join('\n');
};

const generateNodeFunctions = (instances: SdfNodeInstance[]): string => {
  const generated = new Set<string>();
  const lines: string[] = [];

  for (const instance of instances) {
    const nodeDef = sdfRegistry.get(instance.nodeId);
    if (!nodeDef || generated.has(instance.nodeId)) continue;

    generated.add(instance.nodeId);

    // Generate the function with the original name from the signature
    lines.push(`// ${nodeDef.name}`);
    lines.push(`${nodeDef.glsl.signature} {`);
    lines.push(`  ${nodeDef.glsl.body}`);
    lines.push('}');
    lines.push('');
  }

  return lines.join('\n');
};

const generateSceneFunction2D = (
  sortedInstances: SdfNodeInstance[],
  connections: SdfConnection[]
): string => {
  if (sortedInstances.length === 0) {
    return `float sdfScene(vec2 p) {
  return length(p) - 0.5; // Default circle
}`;
  }

  const lines: string[] = [];
  lines.push('float sdfScene(vec2 p) {');
  lines.push('  vec2 q = p;');
  lines.push('  float d = 1e10;');
  lines.push('  float d1, d2;');
  lines.push('');

  // Build a map of instance outputs
  const outputMap = new Map<string, string>();
  let varCounter = 0;

  for (const instance of sortedInstances) {
    if (!instance.enabled) continue;

    const nodeDef = sdfRegistry.get(instance.nodeId);
    if (!nodeDef) continue;

    // Get inputs from connections
    const inputs = connections.filter(c => c.to === instance.instanceId);
    const inputVars: string[] = [];
    for (const input of inputs.sort((a, b) => a.slot - b.slot)) {
      const srcVar = outputMap.get(input.from);
      if (srcVar) {
        inputVars.push(srcVar);
      }
    }

    // Generate the call based on node category
    const varName = `v${varCounter++}`;

    if (nodeDef.category === 'domain' || nodeDef.category === 'domain-warp') {
      // Domain transforms modify coordinates
      const params = generateParamList(instance, nodeDef);
      lines.push(`  // ${nodeDef.name}`);

      // Special handling for different coordinate transforms
      if (nodeDef.glsl.signature.includes('vec2')) {
        const fnName = extractFunctionName(nodeDef.glsl.signature);
        lines.push(`  q = ${fnName}(q${params ? ', ' + params : ''});`);
      }
    } else if (nodeDef.category === 'ops' || nodeDef.category === 'ops-smooth') {
      // Operations combine distances
      if (inputVars.length >= 2) {
        const params = generateParamList(instance, nodeDef);
        const fnName = extractFunctionName(nodeDef.glsl.signature);
        lines.push(`  // ${nodeDef.name}`);
        lines.push(`  float ${varName} = ${fnName}(${inputVars[0]}, ${inputVars[1]}${params ? ', ' + params : ''});`);
        outputMap.set(instance.instanceId, varName);
        lines.push(`  d = ${varName};`);
      } else if (inputVars.length === 1) {
        // Unary ops like onion, round
        const params = generateParamList(instance, nodeDef);
        const fnName = extractFunctionName(nodeDef.glsl.signature);
        lines.push(`  // ${nodeDef.name}`);
        lines.push(`  float ${varName} = ${fnName}(${inputVars[0]}${params ? ', ' + params : ''});`);
        outputMap.set(instance.instanceId, varName);
        lines.push(`  d = ${varName};`);
      }
    } else if (nodeDef.category.startsWith('shapes') || nodeDef.category === 'fields') {
      // Shape nodes generate distances
      const params = generateParamList(instance, nodeDef);
      const fnName = extractFunctionName(nodeDef.glsl.signature);
      lines.push(`  // ${nodeDef.name}`);
      lines.push(`  float ${varName} = ${fnName}(q${params ? ', ' + params : ''});`);
      outputMap.set(instance.instanceId, varName);

      // Union with previous result
      if (varCounter > 1) {
        lines.push(`  d = min(d, ${varName});`);
      } else {
        lines.push(`  d = ${varName};`);
      }
    }

    lines.push('');
  }

  lines.push('  return d;');
  lines.push('}');

  return lines.join('\n');
};

const extractFunctionName = (signature: string): string => {
  const match = signature.match(/\s+(\w+)\s*\(/);
  return match ? match[1] : 'unknown';
};

const generateParamList = (instance: SdfNodeInstance, nodeDef: SdfNodeDefinition): string => {
  const parts: string[] = [];

  for (const param of nodeDef.parameters) {
    const uName = uniformName(instance.instanceId, param.id);

    // Handle different param types
    if (param.type === 'vec2') {
      parts.push(uName);
    } else if (param.type === 'vec3') {
      parts.push(uName);
    } else if (param.type === 'vec4' || param.type === 'color') {
      parts.push(uName);
    } else {
      parts.push(uName);
    }
  }

  return parts.join(', ');
};

// ============================================================================
// 2D Render Mode GLSL
// ============================================================================

const generate2DRenderCode = (config: SdfRenderConfig2D, debug: SdfDebugConfig): string => {
  return `
vec4 render2D(vec2 uv, float time, float audioRms, float audioPeak) {
  vec2 p = uv * 2.0 - 1.0;
  p.x *= uAspect;

  float d = sdfScene(p);

  vec3 col = vec3(0.0);
  float alpha = 0.0;

  // Debug: Distance visualization
  ${debug.showDistance ? `
  float distViz = d * ${debug.distanceScale.toFixed(2)};
  col = mix(vec3(0.0, 0.5, 1.0), vec3(1.0, 0.5, 0.0), step(0.0, distViz));
  col *= 0.8 + 0.2 * sin(distViz * 40.0);
  alpha = 1.0;
  ` : ''}

  // Fill
  ${config.fillEnabled ? `
  float fillMask = smoothstep(${config.aaSmoothing.toFixed(4)}, -${config.aaSmoothing.toFixed(4)}, d);
  col += vec3(${config.fillColor[0].toFixed(3)}, ${config.fillColor[1].toFixed(3)}, ${config.fillColor[2].toFixed(3)}) * fillMask * ${config.fillOpacity.toFixed(3)};
  alpha = max(alpha, fillMask * ${config.fillColor[3].toFixed(3)} * ${config.fillOpacity.toFixed(3)});
  ` : ''}

  // Stroke
  ${config.strokeEnabled ? `
  float strokeDist = abs(d) - ${config.strokeWidth.toFixed(4)};
  float strokeMask = smoothstep(${config.aaSmoothing.toFixed(4)}, -${config.aaSmoothing.toFixed(4)}, strokeDist);
  col += vec3(${config.strokeColor[0].toFixed(3)}, ${config.strokeColor[1].toFixed(3)}, ${config.strokeColor[2].toFixed(3)}) * strokeMask;
  alpha = max(alpha, strokeMask * ${config.strokeColor[3].toFixed(3)});
  ` : ''}

  // Glow
  ${config.glowEnabled ? `
  float glowDist = max(0.0, d);
  float glowMask = exp(-glowDist / ${config.glowRadius.toFixed(4)}) * ${config.glowIntensity.toFixed(3)};
  col += vec3(${config.glowColor[0].toFixed(3)}, ${config.glowColor[1].toFixed(3)}, ${config.glowColor[2].toFixed(3)}) * glowMask;
  alpha = max(alpha, glowMask * ${config.glowColor[3].toFixed(3)});
  ` : ''}

  // Audio reactivity
  float pulse = 0.85 + audioPeak * 0.3;
  col *= pulse;

  return vec4(col, alpha);
}
`;
};

// ============================================================================
// 3D Raymarch Mode GLSL
// ============================================================================

const generate3DRenderCode = (config: SdfRenderConfig3D, debug: SdfDebugConfig): string => {
  return `
vec3 calcNormal(vec3 p) {
  const float eps = ${config.normalEpsilon.toFixed(6)};
  const vec2 h = vec2(eps, 0.0);
  return normalize(vec3(
    sdfScene3D(p + h.xyy) - sdfScene3D(p - h.xyy),
    sdfScene3D(p + h.yxy) - sdfScene3D(p - h.yxy),
    sdfScene3D(p + h.yyx) - sdfScene3D(p - h.yyx)
  ));
}

${config.aoEnabled ? `
float calcAO(vec3 pos, vec3 nor) {
  float occ = 0.0;
  float sca = 1.0;
  for (int i = 0; i < ${config.aoSteps}; i++) {
    float h = 0.01 + ${config.aoRadius.toFixed(4)} * float(i) / float(${config.aoSteps});
    float d = sdfScene3D(pos + h * nor);
    occ += (h - d) * sca;
    sca *= 0.95;
  }
  return clamp(1.0 - ${config.aoIntensity.toFixed(3)} * occ, 0.0, 1.0);
}
` : ''}

${config.softShadowsEnabled ? `
float calcShadow(vec3 ro, vec3 rd) {
  float res = 1.0;
  float t = 0.02;
  for (int i = 0; i < ${config.shadowSteps}; i++) {
    float h = sdfScene3D(ro + t * rd);
    res = min(res, ${config.shadowSoftness.toFixed(2)} * h / t);
    t += clamp(h, 0.02, 0.2);
    if (res < 0.001 || t > ${config.maxDistance.toFixed(2)}) break;
  }
  return clamp(res, 0.0, 1.0);
}
` : ''}

vec4 render3D(vec2 uv, float time, float audioRms, float audioPeak) {
  // Camera setup
  vec3 ro = vec3(0.0, 0.0, 3.0);
  vec3 rd = normalize(vec3((uv * 2.0 - 1.0) * vec2(uAspect, 1.0), -1.5));

  // Raymarch
  float t = 0.0;
  int steps = 0;
  for (int i = 0; i < ${config.maxSteps}; i++) {
    vec3 p = ro + t * rd;
    float d = sdfScene3D(p);
    if (d < ${config.epsilon.toFixed(6)} || t > ${config.maxDistance.toFixed(2)}) break;
    t += d;
    steps = i;
  }

  vec3 col = vec3(${config.backgroundColor[0].toFixed(3)}, ${config.backgroundColor[1].toFixed(3)}, ${config.backgroundColor[2].toFixed(3)});
  float alpha = 0.0;

  ${debug.showSteps ? `
  // Debug: Step count visualization
  float stepRatio = float(steps) / ${config.maxSteps.toFixed(1)};
  col = mix(vec3(0.0, 0.5, 0.0), vec3(1.0, 0.0, 0.0), stepRatio);
  alpha = 1.0;
  ` : `
  if (t < ${config.maxDistance.toFixed(2)}) {
    vec3 p = ro + t * rd;
    vec3 n = calcNormal(p);

    ${debug.showNormals ? `
    col = n * 0.5 + 0.5;
    alpha = 1.0;
    ` : `
    // Lighting
    vec3 lightDir = normalize(vec3(${config.lighting.direction[0].toFixed(3)}, ${config.lighting.direction[1].toFixed(3)}, ${config.lighting.direction[2].toFixed(3)}));
    vec3 lightCol = vec3(${config.lighting.color[0].toFixed(3)}, ${config.lighting.color[1].toFixed(3)}, ${config.lighting.color[2].toFixed(3)});

    float diff = max(dot(n, lightDir), 0.0);
    vec3 h = normalize(lightDir - rd);
    float spec = pow(max(dot(n, h), 0.0), ${config.lighting.specularPower.toFixed(1)}) * ${config.lighting.specularIntensity.toFixed(3)};

    col = vec3(0.7, 0.75, 0.8); // Base material color
    col *= (${config.lighting.ambient.toFixed(3)} + diff * ${config.lighting.intensity.toFixed(3)}) * lightCol;
    col += spec * lightCol;

    ${config.aoEnabled ? `
    float ao = calcAO(p, n);
    col *= ao;
    ` : ''}

    ${config.softShadowsEnabled ? `
    float sha = calcShadow(p + n * 0.002, lightDir);
    col *= 0.5 + 0.5 * sha;
    ` : ''}

    ${config.fogEnabled ? `
    float fog = 1.0 - exp(-t * ${config.fogDensity.toFixed(4)});
    col = mix(col, vec3(${config.fogColor[0].toFixed(3)}, ${config.fogColor[1].toFixed(3)}, ${config.fogColor[2].toFixed(3)}), fog);
    ` : ''}

    alpha = 1.0;
    `}
  }
  `}

  // Audio pulse
  float pulse = 0.9 + audioPeak * 0.2;
  col *= pulse;

  return vec4(col, alpha);
}
`;
};

// ============================================================================
// Full Shader Assembly
// ============================================================================

export const compileShader = (scene: SdfSceneConfig): SdfCompiledShader => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Filter enabled nodes
  const enabledInstances = scene.nodes.filter(n => n.enabled);

  // Build dependency graph and sort
  const graph = buildDependencyGraph(enabledInstances, scene.connections);
  let sortedInstances: SdfNodeInstance[];

  try {
    sortedInstances = topologicalSort(enabledInstances, graph);
  } catch (e) {
    errors.push((e as Error).message);
    sortedInstances = enabledInstances;
  }

  // Generate uniform bindings
  const uniforms = generateUniformBindings(sortedInstances);

  // Calculate total cost
  let totalCost = 0;
  for (const instance of enabledInstances) {
    const nodeDef = sdfRegistry.get(instance.nodeId);
    if (nodeDef) {
      const costMap = { LOW: 0.1, MED: 1.0, HIGH: 5.0 };
      totalCost += costMap[nodeDef.gpuCostTier];
    }
  }

  // Generate shader source
  const is3D = scene.mode === '3d';

  const fragmentSource = `#version 300 es
precision highp float;

// Built-in uniforms
uniform float uTime;
uniform float uAspect;
uniform float uRms;
uniform float uPeak;

// Node parameter uniforms
${generateUniformDeclarations(uniforms)}

in vec2 vUv;
out vec4 outColor;

// Utility functions
${ALL_GLSL_UTILS_WITH_NOISE}

// Node functions
${generateNodeFunctions(sortedInstances)}

// Scene SDF function
${is3D ? generateSceneFunction3D(sortedInstances, scene.connections) : generateSceneFunction2D(sortedInstances, scene.connections)}

// Render function
${is3D ? generate3DRenderCode(scene.render3d, scene.debug) : generate2DRenderCode(scene.render2d, scene.debug)}

void main() {
  vec4 result = ${is3D ? 'render3D' : 'render2D'}(vUv, uTime, uRms, uPeak);
  outColor = result;
}
`;

  return {
    fragmentSource,
    uniforms,
    totalCost,
    uses3D: is3D,
    errors,
    warnings
  };
};

// ============================================================================
// 3D Scene Function Generation
// ============================================================================

const generateSceneFunction3D = (
  sortedInstances: SdfNodeInstance[],
  connections: SdfConnection[]
): string => {
  if (sortedInstances.length === 0) {
    return `float sdfScene3D(vec3 p) {
  return length(p) - 0.5; // Default sphere
}`;
  }

  const lines: string[] = [];
  lines.push('float sdfScene3D(vec3 p) {');
  lines.push('  vec3 q = p;');
  lines.push('  float d = 1e10;');
  lines.push('  float d1, d2;');
  lines.push('');

  const outputMap = new Map<string, string>();
  let varCounter = 0;

  for (const instance of sortedInstances) {
    if (!instance.enabled) continue;

    const nodeDef = sdfRegistry.get(instance.nodeId);
    if (!nodeDef) continue;
    if (nodeDef.coordSpace === '2d') continue; // Skip 2D-only nodes

    const inputs = connections.filter(c => c.to === instance.instanceId);
    const inputVars: string[] = [];
    for (const input of inputs.sort((a, b) => a.slot - b.slot)) {
      const srcVar = outputMap.get(input.from);
      if (srcVar) {
        inputVars.push(srcVar);
      }
    }

    const varName = `v${varCounter++}`;

    if (nodeDef.category === 'domain' || nodeDef.category === 'domain-warp') {
      const params = generateParamList(instance, nodeDef);
      if (nodeDef.glsl.signature.includes('vec3')) {
        const fnName = extractFunctionName(nodeDef.glsl.signature);
        lines.push(`  // ${nodeDef.name}`);
        lines.push(`  q = ${fnName}(q${params ? ', ' + params : ''});`);
      }
    } else if (nodeDef.category === 'ops' || nodeDef.category === 'ops-smooth') {
      if (inputVars.length >= 2) {
        const params = generateParamList(instance, nodeDef);
        const fnName = extractFunctionName(nodeDef.glsl.signature);
        lines.push(`  // ${nodeDef.name}`);
        lines.push(`  float ${varName} = ${fnName}(${inputVars[0]}, ${inputVars[1]}${params ? ', ' + params : ''});`);
        outputMap.set(instance.instanceId, varName);
        lines.push(`  d = ${varName};`);
      } else if (inputVars.length === 1) {
        const params = generateParamList(instance, nodeDef);
        const fnName = extractFunctionName(nodeDef.glsl.signature);
        lines.push(`  // ${nodeDef.name}`);
        lines.push(`  float ${varName} = ${fnName}(${inputVars[0]}${params ? ', ' + params : ''});`);
        outputMap.set(instance.instanceId, varName);
        lines.push(`  d = ${varName};`);
      }
    } else if (nodeDef.category.startsWith('shapes3d') || nodeDef.category === 'fields') {
      const params = generateParamList(instance, nodeDef);
      const fnName = extractFunctionName(nodeDef.glsl.signature);
      lines.push(`  // ${nodeDef.name}`);
      lines.push(`  float ${varName} = ${fnName}(q${params ? ', ' + params : ''});`);
      outputMap.set(instance.instanceId, varName);

      if (varCounter > 1) {
        lines.push(`  d = min(d, ${varName});`);
      } else {
        lines.push(`  d = ${varName};`);
      }
    }

    lines.push('');
  }

  lines.push('  return d;');
  lines.push('}');

  return lines.join('\n');
};

// ============================================================================
// Shader Validation
// ============================================================================

export const validateShader = (source: string, gl: WebGL2RenderingContext): {
  valid: boolean;
  error?: string;
} => {
  const shader = gl.createShader(gl.FRAGMENT_SHADER);
  if (!shader) {
    return { valid: false, error: 'Failed to create shader' };
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (!success) {
    const error = gl.getShaderInfoLog(shader) || 'Unknown shader compilation error';
    gl.deleteShader(shader);
    return { valid: false, error };
  }

  gl.deleteShader(shader);
  return { valid: true };
};

// ============================================================================
// Quick Scene Compilation
// ============================================================================

export const compileQuickScene2D = (
  shapes: Array<{ nodeId: string; params?: Record<string, number | number[] | boolean> }>
): string => {
  const instances: SdfNodeInstance[] = shapes.map((s, i) => ({
    instanceId: `shape_${i}`,
    nodeId: s.nodeId,
    params: s.params || {},
    enabled: true,
    order: i
  }));

  const scene: SdfSceneConfig = {
    version: 1,
    mode: '2d',
    nodes: instances,
    connections: [],
    render2d: {
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
      gradientColors: [[0.2, 0.4, 0.8, 1.0], [0.8, 0.4, 0.2, 1.0]]
    },
    render3d: {} as SdfRenderConfig3D,
    debug: {
      showDistance: false,
      distanceScale: 5.0,
      showNormals: false,
      showSteps: false,
      stepsColorScale: 64.0,
      showCostTier: false,
      showBounds: false,
      wireframe: false
    }
  };

  return compileShader(scene).fragmentSource;
};
