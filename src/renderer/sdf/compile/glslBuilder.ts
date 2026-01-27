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
// Returns the variable name holding the result (float dist or vec3 p)
const emitNode = (ctx: BuildContext, instanceId: string, currentDomainVar: string, codeAccumulator: string): string => {
  const instance = ctx.instances.get(instanceId)!;
  const def = sdfRegistry.get(instance.nodeId)!;

  // If this node is a Domain Transform, it modifies P and passes it to its Input
  // BUT in our graph model, typically Shape -> Transform (Shape uses Transform)
  // Let's assume:
  // - Ops take Shapes as inputs (float d)
  // - Shapes take Transforms as inputs (vec3 p) ?? No, that's backwards.
  // Standard Scene Graph: Transform -> Shape.
  // Transform Input: Geometry (d). Output: Geometry (d, but transformed).
  // "opTranslate(Shape)" -> In code: Shape(Translate(p))
  
  // WAIT: In node graphs (like Blender), you chain Geometry.
  // Translate Node: Input Geometry -> Output Geometry.
  // Implementation: sdShape( opTranslate(p) )
  
  // Let's try to evaluate dependencies first.
  const inputs = ctx.inputs.get(instanceId) || [];
  inputs.sort((a, b) => a.slot - b.slot);

  // Register Function
  const funcName = getFuncName(def.glsl.signature);
  if (!ctx.functions.has(def.glsl.body)) {
      ctx.functions.add(`${def.glsl.signature} {
${def.glsl.body}
}`);
  }

  // Collect Parameters
  const args: string[] = [];
  
  // Handle Domain Transforms vs Shapes
  if (def.category === 'domain') {
      // Domain Transform Node
      // It transforms 'p' and returns new 'p'.
      // Usually used as input to a shape.
      // But here we are traversing from Root.
      // If Root is Union, it calls children.
      
      // Let's assume the graph flows DATA (Geometry).
      // If I am a Circle, I produce Distance.
      // If I am Translate, I take Distance? No, that's wrong.
      // Translate takes a Coordinate Space and produces a Coordinate Space?
      
      // SIMPLIFICATION FOR MVP:
      // All connections transmit Distance (float).
      // Domain Transforms are "modifiers" attached to Shapes?
      // Or:
      // Domain Transform Node has an input "Shape".
      // It renders "Shape" but with modified P.
      
      // Let's go with: Node = Function(Inputs...)
      // Translate(Shape) -> shape.map(p - offset)
      
      const childInput = inputs.find(i => i.slot === 0);
      if (childInput) {
          // We need to modify P for the child.
          // New P = op(currentP, args)
          
          // 1. Calculate parameters
          const paramArgs: string[] = [];
          for (const param of def.parameters) {
              const uName = `u_${instanceId}_${param.id}`;
              addUniform(ctx, uName, instanceId, param.id, param.type);
              paramArgs.push(uName);
          }
          
          const newPVar = `p_${instanceId}`;
          // Generate new P
          // We need a specific function signature for transforms that returns vec3
          // e.g. "vec3 opTranslate(vec3 p, vec3 offset)"
          // codeAccumulator is passed by reference-ish (string append doesn't work that way in JS recursion)
          // We must return code strings.
      }
  }
  
  // RESTARTING RECURSION STRATEGY
  // We construct the expression string directly.
  // map(p) = Union( Circle(p), Box(Rotate(p)) )
  
  const paramArgs: string[] = [];
  for (const param of def.parameters) {
      const uName = `u_${instanceId}_${param.id}`;
      addUniform(ctx, uName, instanceId, param.id, param.type);
      paramArgs.push(uName);
  }

  // Domain Transforms special case: They modify P for their children.
  if (def.category === 'domain') {
      // Expect 1 input (Geometry)
      // We apply transform to currentDomainVar, then eval child.
      // opTranslate(p, offset) -> returns NEW P
      const newP = `${funcName}(${currentDomainVar}, ${paramArgs.join(', ')})`;
      
      // Eval child with new P
      const childConn = inputs[0];
      if (childConn) {
          return emitNode(ctx, childConn.from, newP, codeAccumulator);
      }
      return '0.0'; // No child?
  }
  
  // Operations (Union, etc)
  if (def.category.startsWith('ops')) {
      // Eval all children with SAME P
      const childResults = inputs.map(conn => emitNode(ctx, conn.from, currentDomainVar, codeAccumulator));
      // Call op(d1, d2, ...)
      return `${funcName}(${childResults.join(', ')}${paramArgs.length ? ', ' + paramArgs.join(', ') : ''})`;
  }
  
  // Primitives
  if (def.category.startsWith('shapes')) {
      // Call shape(p, params)
      // Check for 2D/3D casting if needed
      let pArg = currentDomainVar;
      if (def.coordSpace === '2d') pArg = `${currentDomainVar}.xy`;
      
      return `${funcName}(${pArg}, ${paramArgs.join(', ')})`;
  }

  return '0.0'; // Fallback
};

const addUniform = (ctx: BuildContext, name: string, instId: string, paramId: string, type: SdfParamType) => {
    // Basic type mapping
    let glType = type;
    if (type === 'angle') glType = 'float';
    if (type === 'color') glType = 'vec4';
    
    ctx.uniforms.push({ name, instanceId: instId, parameterId: paramId, type: glType as any, offset: 0 });
};

const getFuncName = (sig: string) => sig.split('(')[0].split(' ').pop()!;