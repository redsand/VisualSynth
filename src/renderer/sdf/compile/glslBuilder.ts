import { SdfNodeInstance, SdfConnection, SdfNodeDefinition, SdfUniformBinding, SdfCompiledShader, SdfParamType } from '../api';
import { sdfRegistry } from '../registry';

interface BuildContext {
  instances: Map<string, SdfNodeInstance>;
  inputs: Map<string, SdfConnection[]>; // NodeID -> Incoming Connections
  uniforms: SdfUniformBinding[];
  functions: Set<string>;
  calculatedVars: Map<string, string>; // InstanceID -> Variable Name
}

export const buildSdfShader = (
  nodes: SdfNodeInstance[],
  connections: SdfConnection[],
  mode: '2d' | '3d'
): SdfCompiledShader => {
  const ctx: BuildContext = {
    instances: new Map(nodes.map(n => [n.instanceId, n])),
    inputs: new Map(),
    uniforms: [],
    functions: new Set(),
    calculatedVars: new Map()
  };

  // Map inputs
  for (const conn of connections) {
    if (!ctx.inputs.has(conn.to)) ctx.inputs.set(conn.to, []);
    ctx.inputs.get(conn.to)!.push(conn);
  }

  // Find Root (last node)
  if (nodes.length === 0) {
    return {
      fragmentSource: '',
      functionsCode: '',
      mapBody: 'return 10.0;',
      uniforms: [],
      totalCost: 0,
      uses3D: false,
      errors: [],
      warnings: []
    };
  }
  const root = nodes[nodes.length - 1];

  let body = '';
  try {
    const resultVar = emitNode(ctx, root.instanceId, 'p', body);
    body += `    return ${resultVar};`;
  } catch (e: any) {
    return {
      fragmentSource: '',
      functionsCode: '',
      mapBody: 'return 10.0;',
      uniforms: [],
      totalCost: 0,
      uses3D: false,
      errors: [e.message],
      warnings: []
    };
  }

  const uniformsCode = ctx.uniforms.map(u => `uniform ${u.type} ${u.name};`).join('\n');
  const functionsCode = Array.from(ctx.functions).join('\n\n');

  const fragmentSource = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform float uTime;
uniform vec2 uResolution;
${uniformsCode}

// SDF Primitives & Ops
${functionsCode}

float map(vec3 p) {
${body}
}

void main() {
    vec2 uv = (vUv - 0.5) * uResolution / uResolution.y;
    vec3 p = vec3(uv, 0.0);
    float d = map(p);
    
    vec3 col = vec3(1.0) - sign(d)*vec3(0.1,0.4,0.7);
    col *= 1.0 - exp(-3.0*abs(d));
    col *= 0.8 + 0.2*cos(150.0*d);
    col = mix(col, vec3(1.0), 1.0-smoothstep(0.0,0.015,abs(d)));
    outColor = vec4(col, 1.0);
}`;

  return {
    fragmentSource,
    functionsCode,
    mapBody: body,
    uniforms: ctx.uniforms,
    totalCost: 0,
    uses3D: mode === '3d',
    errors: [],
    warnings: []
  };
};

// Recursive emitter
// Returns the expression string for the node result
const emitNode = (ctx: BuildContext, instanceId: string, currentDomainVar: string, codeAccumulator: string): string => {
  const instance = ctx.instances.get(instanceId)!;
  const def = sdfRegistry.get(instance.nodeId)!;

  // Register Function if not already present
  if (!ctx.functions.has(def.glsl.body)) {
      ctx.functions.add(`${def.glsl.signature} {
${def.glsl.body}
}`);
  }

  // Collect and register parameters as uniforms
  const paramArgs: string[] = [];
  for (const param of def.parameters) {
      const uName = `u_${instanceId.replace(/-/g, '_')}_${param.id}`;
      addUniform(ctx, uName, instanceId, param.id, param.type);
      paramArgs.push(uName);
  }

  const inputs = ctx.inputs.get(instanceId) || [];
  inputs.sort((a, b) => a.slot - b.slot);
  const funcName = getFuncName(def.glsl.signature);

  // 1. Domain Transforms: These modify the coordinate space for their children
  if (def.category.startsWith('domain')) {
      // Typically: opTranslate(p, offset) returns new p
      const newP = `${funcName}(${currentDomainVar}, ${paramArgs.join(', ')})`;
      
      const childConn = inputs[0];
      if (childConn) {
          return emitNode(ctx, childConn.from, newP, codeAccumulator);
      }
      return '10.0'; // Default distance if no child
  }
  
  // 2. Operations: Boolean unions, subtractions, etc.
  if (def.category.startsWith('ops')) {
      // Operations take distance results from children as inputs
      const childResults = inputs.map(conn => emitNode(ctx, conn.from, currentDomainVar, codeAccumulator));
      
      if (childResults.length === 0) return '10.0';
      if (childResults.length === 1) return childResults[0];

      // Combine children using the operation function
      // e.g., opUnion(d1, d2, ...)
      return `${funcName}(${childResults.join(', ')}${paramArgs.length ? ', ' + paramArgs.join(', ') : ''})`;
  }
  
  // 3. Primitives: 2D or 3D shapes
  if (def.category.startsWith('shapes')) {
      let pArg = currentDomainVar;
      // Cast p to vec2 if it's a 2D shape being rendered in a 3D context
      if (def.coordSpace === '2d') pArg = `${currentDomainVar}.xy`;
      
      return `${funcName}(${pArg}, ${paramArgs.join(', ')})`;
  }

  // 4. Fields: Noise or other distance fields
  if (def.category === 'fields') {
      let pArg = currentDomainVar;
      if (def.coordSpace === '2d') pArg = `${currentDomainVar}.xy`;
      return `${funcName}(${pArg}, ${paramArgs.join(', ')})`;
  }

  return '10.0';
};

const addUniform = (ctx: BuildContext, name: string, instId: string, paramId: string, type: SdfParamType) => {
    // Basic type mapping
    let glType = type;
    if (type === 'angle') glType = 'float';
    if (type === 'color') glType = 'vec4';
    
    ctx.uniforms.push({ name, instanceId: instId, parameterId: paramId, type: glType as any, offset: 0 });
};

const getFuncName = (sig: string) => sig.split('(')[0].split(' ').pop()!;