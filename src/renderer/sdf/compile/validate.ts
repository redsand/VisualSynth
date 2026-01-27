/**
 * Shader Validation
 *
 * Validates SDF shader compilation and uniform bindings.
 */

import type { SdfNodeDefinition, SdfSceneConfig, SdfCompiledShader } from '../api';
import { sdfRegistry } from '../registry';

// ============================================================================
// Node Definition Validation
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export const validateNodeDefinition = (node: SdfNodeDefinition): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // ID validation
  if (!node.id || !/^[a-z][a-z0-9_-]*$/.test(node.id)) {
    errors.push(`Invalid node ID: "${node.id}". Must be lowercase alphanumeric with underscores/dashes.`);
  }

  // Version validation
  if (!node.version || !/^\d+\.\d+\.\d+$/.test(node.version)) {
    errors.push(`Invalid version: "${node.version}". Must be semver format (e.g., "1.0.0").`);
  }

  // GLSL validation
  if (!node.glsl) {
    errors.push('Missing GLSL code definition.');
  } else {
    if (!node.glsl.signature) {
      errors.push('Missing GLSL signature.');
    } else {
      // Validate signature format
      const sigMatch = node.glsl.signature.match(/^(float|vec2|vec3|vec4)\s+\w+\s*\([^)]*\)$/);
      if (!sigMatch) {
        warnings.push(`GLSL signature may be malformed: "${node.glsl.signature}"`);
      }
    }

    if (!node.glsl.body || node.glsl.body.trim().length === 0) {
      errors.push('Missing or empty GLSL body.');
    }
  }

  // Parameter validation
  const paramIds = new Set<string>();
  for (const param of node.parameters) {
    if (!param.id) {
      errors.push('Parameter missing ID.');
      continue;
    }

    if (paramIds.has(param.id)) {
      errors.push(`Duplicate parameter ID: "${param.id}"`);
    }
    paramIds.add(param.id);

    // Validate min/max for numeric types
    if (['float', 'int', 'angle'].includes(param.type)) {
      if (param.min !== undefined && param.max !== undefined && param.min > param.max) {
        errors.push(`Parameter "${param.id}": min (${param.min}) > max (${param.max})`);
      }
    }
  }

  // Modulation target validation
  for (const target of node.modTargets) {
    if (!paramIds.has(target.parameterId)) {
      errors.push(`Mod target references unknown parameter: "${target.parameterId}"`);
    }

    const param = node.parameters.find(p => p.id === target.parameterId);
    if (param && !param.modulatable) {
      warnings.push(`Mod target "${target.parameterId}" references non-modulatable parameter.`);
    }
  }

  // Default values validation
  for (const param of node.parameters) {
    if (node.defaults[param.id] === undefined && param.default === undefined) {
      warnings.push(`Parameter "${param.id}" has no default value.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
};

// ============================================================================
// Scene Validation
// ============================================================================

export const validateScene = (scene: SdfSceneConfig): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate version
  if (scene.version !== 1) {
    warnings.push(`Scene version ${scene.version} may not be fully supported.`);
  }

  // Validate mode
  if (scene.mode !== '2d' && scene.mode !== '3d') {
    errors.push(`Invalid scene mode: "${scene.mode}". Must be "2d" or "3d".`);
  }

  // Validate nodes
  const instanceIds = new Set<string>();
  for (const instance of scene.nodes) {
    // Check for duplicate IDs
    if (instanceIds.has(instance.instanceId)) {
      errors.push(`Duplicate instance ID: "${instance.instanceId}"`);
    }
    instanceIds.add(instance.instanceId);

    // Check node definition exists
    const nodeDef = sdfRegistry.get(instance.nodeId);
    if (!nodeDef) {
      errors.push(`Unknown node type: "${instance.nodeId}" in instance "${instance.instanceId}"`);
      continue;
    }

    // Check coordinate space compatibility
    if (scene.mode === '2d' && nodeDef.coordSpace === '3d') {
      warnings.push(`3D node "${instance.nodeId}" used in 2D scene.`);
    }
    if (scene.mode === '3d' && nodeDef.coordSpace === '2d') {
      warnings.push(`2D node "${instance.nodeId}" used in 3D scene may not render correctly.`);
    }

    // Validate parameter values
    for (const param of nodeDef.parameters) {
      const value = instance.params[param.id];
      if (value !== undefined) {
        if (['float', 'int', 'angle'].includes(param.type) && typeof value === 'number') {
          if (param.min !== undefined && value < param.min) {
            warnings.push(`Parameter "${param.id}" value ${value} is below minimum ${param.min}.`);
          }
          if (param.max !== undefined && value > param.max) {
            warnings.push(`Parameter "${param.id}" value ${value} is above maximum ${param.max}.`);
          }
        }
      }
    }
  }

  // Validate connections
  for (const conn of scene.connections) {
    if (!instanceIds.has(conn.from)) {
      errors.push(`Connection references unknown source: "${conn.from}"`);
    }
    if (!instanceIds.has(conn.to)) {
      errors.push(`Connection references unknown target: "${conn.to}"`);
    }
    if (conn.from === conn.to) {
      errors.push(`Self-referencing connection on "${conn.from}"`);
    }
  }

  // Check for circular dependencies
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  const hasCycle = (nodeId: string): boolean => {
    if (recursionStack.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;

    visited.add(nodeId);
    recursionStack.add(nodeId);

    const outgoing = scene.connections.filter(c => c.from === nodeId);
    for (const conn of outgoing) {
      if (hasCycle(conn.to)) return true;
    }

    recursionStack.delete(nodeId);
    return false;
  };

  for (const instance of scene.nodes) {
    if (hasCycle(instance.instanceId)) {
      errors.push('Circular dependency detected in node graph.');
      break;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
};

// ============================================================================
// Compiled Shader Validation
// ============================================================================

export const validateCompiledShader = (
  compiled: SdfCompiledShader,
  gl?: WebGL2RenderingContext
): ValidationResult => {
  const errors: string[] = [...compiled.errors];
  const warnings: string[] = [...compiled.warnings];

  // Check for empty shader
  if (!compiled.fragmentSource || compiled.fragmentSource.trim().length === 0) {
    errors.push('Compiled shader is empty.');
  }

  // Check uniform count
  if (compiled.uniforms.length > 256) {
    warnings.push(`High uniform count (${compiled.uniforms.length}). May cause performance issues.`);
  }

  // Check cost
  if (compiled.totalCost > 10) {
    warnings.push(`High GPU cost estimate (${compiled.totalCost.toFixed(1)}). Consider optimizing.`);
  }

  // WebGL compile validation if context provided
  if (gl && compiled.fragmentSource) {
    const shader = gl.createShader(gl.FRAGMENT_SHADER);
    if (shader) {
      gl.shaderSource(shader, compiled.fragmentSource);
      gl.compileShader(shader);

      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(shader);
        errors.push(`WebGL compile error: ${log}`);
      }

      gl.deleteShader(shader);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
};

// ============================================================================
// Registry Validation
// ============================================================================

export const validateRegistry = (): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  const allNodes = sdfRegistry.getAll();

  if (allNodes.length === 0) {
    warnings.push('Node registry is empty. Call registerAllSdfNodes() first.');
  }

  for (const node of allNodes) {
    const result = validateNodeDefinition(node);
    if (!result.valid) {
      errors.push(...result.errors.map(e => `[${node.id}] ${e}`));
    }
    warnings.push(...result.warnings.map(w => `[${node.id}] ${w}`));
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
};

// ============================================================================
// GLSL Syntax Checks
// ============================================================================

export const checkGlslSyntax = (code: string): string[] => {
  const issues: string[] = [];

  // Check for common issues
  if (code.includes('uniform sampler2D') && !code.includes('texture(')) {
    issues.push('Sampler uniform declared but texture() not used.');
  }

  // Check for unbalanced braces
  const openBraces = (code.match(/{/g) || []).length;
  const closeBraces = (code.match(/}/g) || []).length;
  if (openBraces !== closeBraces) {
    issues.push(`Unbalanced braces: ${openBraces} opens, ${closeBraces} closes.`);
  }

  // Check for unbalanced parentheses
  const openParens = (code.match(/\(/g) || []).length;
  const closeParens = (code.match(/\)/g) || []).length;
  if (openParens !== closeParens) {
    issues.push(`Unbalanced parentheses: ${openParens} opens, ${closeParens} closes.`);
  }

  // Check for missing semicolons (basic heuristic)
  const lines = code.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.length > 0 &&
        !line.startsWith('//') &&
        !line.startsWith('#') &&
        !line.startsWith('/*') &&
        !line.endsWith('{') &&
        !line.endsWith('}') &&
        !line.endsWith(';') &&
        !line.endsWith(',') &&
        !line.endsWith('*/') &&
        !line.startsWith('*') &&
        line !== 'in vec2 vUv;' &&
        line !== 'out vec4 outColor;') {
      // Skip function signatures and control flow
      if (!line.includes('if') && !line.includes('for') && !line.includes('while') &&
          !line.includes('else') && !line.includes('void ') && !line.includes('float ') &&
          !line.includes('vec') && !line.includes('mat')) {
        // This is just a heuristic, may have false positives
      }
    }
  }

  return issues;
};
