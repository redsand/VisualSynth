import { SdfNodeInstance, SdfConnection, SdfNodeDefinition, SdfUniformBinding, SdfCompiledShader, SdfParamType } from '../api';
import { sdfRegistry } from '../registry';

interface BuildContext {
  instances: Map<string, SdfNodeInstance>;
  inputs: Map<string, SdfConnection[]>; // NodeID -> Incoming Connections
  uniforms: SdfUniformBinding[];
  functions: Set<string>;
  calculatedVars: Map<string, string>; // InstanceID -> Variable Name
  nodeColors: Map<string, [number, number, number]>;
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
    calculatedVars: new Map(),
    nodeColors: new Map()
  };

  // Map colors and indices
  nodes.forEach((node) => {
      ctx.nodeColors.set(node.instanceId, node.color || [1, 1, 1]);
  });

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
      mapBody: 'return vec2(10.0, 0.0);',
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
      mapBody: 'return vec2(10.0, 0.0);',
      uniforms: [],
      totalCost: 0,
      uses3D: false,
      errors: [e.message],
      warnings: []
    };
  }

  const functionsCode = Array.from(ctx.functions).join('\n\n');

  // Inject color lookup helper
  const colorBranches = Array.from(ctx.nodeColors.keys()).map((id, idx) => `    if (id < ${idx}.5) return uColor_${id.replace(/-/g, '_')};`).join('\n');
  const colorLookup = `
vec3 getSdfColor(float id) {
${colorBranches}
    return vec3(1.0);
}`;

  return {
    fragmentSource: '', 
    functionsCode: functionsCode + '\n' + colorLookup,
    mapBody: body,
    uniforms: [
        ...ctx.uniforms,
        ...Array.from(ctx.nodeColors.keys()).map(id => ({
            name: `uColor_${id.replace(/-/g, '_')}`,
            instanceId: id,
            parameterId: 'color',
            type: 'vec3' as const,
            offset: 0
        }))
    ],
    totalCost: 0,
    uses3D: mode === '3d',
    errors: [],
    warnings: []
  };
};

// Recursive emitter
// Returns the expression string for the node result (vec2: dist, id)
const emitNode = (ctx: BuildContext, instanceId: string, currentDomainVar: string, codeAccumulator: string): string => {
  const instance = ctx.instances.get(instanceId)!;
  const def = sdfRegistry.get(instance.nodeId)!;
  const nodeIndex = Array.from(ctx.instances.keys()).indexOf(instanceId);

  // Register Function if not already present
  if (!ctx.functions.has(def.glsl.body)) {
      ctx.functions.add(`${def.glsl.signature} {
${def.glsl.body}
}`);
  }

  // Register internal op functions for vec2 if needed
  if (!ctx.functions.has('vec2 opUnion(vec2 d1, vec2 d2)')) {
      ctx.functions.add(`vec2 opUnion(vec2 d1, vec2 d2) { return (d1.x < d2.x) ? d1 : d2; }`);
      ctx.functions.add(`vec2 opSubtract(vec2 d1, vec2 d2) { return (-d2.x > d1.x) ? vec2(-d2.x, d2.y) : d1; }`);
      ctx.functions.add(`vec2 opIntersect(vec2 d1, vec2 d2) { return (d1.x > d2.x) ? d1 : d2; }`);
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
  const sig = def.glsl.signature;

  // Helper to build argument list including implicit ones
  const buildArgs = (explicitArgs: string[]) => {
      const allArgs: string[] = [];
      const sigParams = sig.split('(')[1].split(')')[0].split(',').map(p => p.trim());
      
      let explicitIdx = 0;
      for (const p of sigParams) {
          const name = p.split(' ')[1];
          
          if (name === 'p') {
              allArgs.push(currentDomainVar);
          } else if (name === 'time' || name === 'uTime') {
              allArgs.push('uTime');
          } else if (name === 'audio' || name === 'uRms' || name === 'uPeak') {
              allArgs.push('uRms');
          } else if (explicitIdx < explicitArgs.length) {
              allArgs.push(explicitArgs[explicitIdx++]);
          }
      }
      return allArgs.join(', ');
  };

  // 1. Domain Transforms
  if (def.category.startsWith('domain')) {
      const callArgs = buildArgs(paramArgs);
      const newP = `${funcName}(${callArgs})`;
      
      const childConn = inputs[0];
      if (childConn) {
          return emitNode(ctx, childConn.from, newP, codeAccumulator);
      }
      return `vec2(10.0, ${nodeIndex}.0)`; 
  }
  
  // 2. Operations
  if (def.category.startsWith('ops')) {
      const childResults = inputs.map(conn => emitNode(ctx, conn.from, currentDomainVar, codeAccumulator));
      
      if (childResults.length === 0) return `vec2(10.0, ${nodeIndex}.0)`;
      if (childResults.length === 1) return childResults[0];

      // Handle standard boolean ops using our vec2 wrappers
      if (funcName === 'opUnion' || funcName === 'opSubtract' || funcName === 'opIntersect') {
          return `${funcName}(${childResults[0]}, ${childResults[1]})`;
      }

      // Fallback for complex ops (onion, round, etc) - they only affect distance, preserve ID
      const allCallArgs = [childResults[0] + '.x', ...paramArgs];
      const callArgs = buildArgs(allCallArgs);
      return `vec2(${funcName}(${callArgs}), ${childResults[0]}.y)`;
  }
  
  // 3. Primitives
  if (def.category.startsWith('shapes') || def.category === 'fields') {
      let pArg = currentDomainVar;
      if (def.coordSpace === '2d' && !currentDomainVar.endsWith('.xy')) pArg = `${currentDomainVar}.xy`;
      
      const callArgs = buildArgs(paramArgs);
      return `vec2(${funcName}(${callArgs}), ${nodeIndex}.0)`;
  }

  return `vec2(10.0, ${nodeIndex}.0)`;
};

const addUniform = (ctx: BuildContext, name: string, instId: string, paramId: string, type: SdfParamType) => {
    // Basic type mapping
    let glType = type;
    if (type === 'angle') glType = 'float';
    if (type === 'color') glType = 'vec4';
    
    ctx.uniforms.push({ name, instanceId: instId, parameterId: paramId, type: glType as any, offset: 0 });
};

const getFuncName = (sig: string) => sig.split('(')[0].split(' ').pop()!;