import {
  VisualNode,
  NodeInstance,
  RenderGraph,
  RenderGraphNode,
  RenderGraphConnection,
  FBOResource,
  TextureResource,
  ResourcePool,
  gpuCostEstimate
} from './visualNode';
import { getNodeById, FX_CATALOG } from './fxCatalog';

/**
 * Render Graph Implementation
 *
 * This module implements the generator -> FX -> compositor node model with:
 * - Sends/Returns for parallel FX chains
 * - Multi-output routing
 * - Feedback taps
 * - FBO/texture pooling
 * - Resolution negotiation per node
 */

// ============================================================================
// Graph Building & Validation
// ============================================================================

export interface GraphBuildResult {
  success: boolean;
  graph?: RenderGraph;
  errors: string[];
  warnings: string[];
}

export const createNodeInstance = (
  node: VisualNode,
  instanceId?: string
): NodeInstance => ({
  nodeId: node.id,
  instanceId: instanceId || `${node.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  parameterValues: Object.fromEntries(
    node.parameters.map((p) => [p.id, p.defaultValue])
  ),
  inputConnections: {},
  enabled: true,
  bypass: false,
  soloPreview: false
});

export const createRenderGraphNode = (
  node: VisualNode,
  instance: NodeInstance
): RenderGraphNode => ({
  instanceId: instance.instanceId,
  node,
  instance,
  framebufferIds: [],
  textureIds: []
});

export const createConnection = (
  fromInstanceId: string,
  fromOutputId: string,
  toInstanceId: string,
  toInputId: string
): RenderGraphConnection => ({
  fromInstanceId,
  fromOutputId,
  toInstanceId,
  toInputId
});

export const buildRenderGraph = (
  nodes: RenderGraphNode[],
  connections: RenderGraphConnection[],
  outputNodeId: string,
  resolution: { width: number; height: number },
  frameRate = 60
): GraphBuildResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate output node exists
  const outputNode = nodes.find((n) => n.instanceId === outputNodeId);
  if (!outputNode) {
    errors.push(`Output node not found: ${outputNodeId}`);
    return { success: false, errors, warnings };
  }

  // Validate all connections
  for (const conn of connections) {
    const fromNode = nodes.find((n) => n.instanceId === conn.fromInstanceId);
    const toNode = nodes.find((n) => n.instanceId === conn.toInstanceId);

    if (!fromNode) {
      errors.push(`Connection source not found: ${conn.fromInstanceId}`);
      continue;
    }
    if (!toNode) {
      errors.push(`Connection destination not found: ${conn.toInstanceId}`);
      continue;
    }

    const fromOutput = fromNode.node.outputs.find((o) => o.id === conn.fromOutputId);
    const toInput = toNode.node.inputs.find((i) => i.id === conn.toInputId);

    if (!fromOutput) {
      errors.push(`Output port not found: ${conn.fromOutputId} on ${fromNode.node.name}`);
    }
    if (!toInput) {
      errors.push(`Input port not found: ${conn.toInputId} on ${toNode.node.name}`);
    }

    // Type compatibility check
    if (fromOutput && toInput && fromOutput.type !== toInput.type) {
      warnings.push(
        `Type mismatch: ${fromOutput.type} -> ${toInput.type} (${fromNode.node.name} -> ${toNode.node.name})`
      );
    }
  }

  // Check for required inputs
  for (const node of nodes) {
    for (const input of node.node.inputs) {
      if (input.required) {
        const hasConnection = connections.some(
          (c) => c.toInstanceId === node.instanceId && c.toInputId === input.id
        );
        if (!hasConnection) {
          errors.push(`Required input not connected: ${input.name} on ${node.node.name}`);
        }
      }
    }
  }

  // Check for cycles (simple DFS)
  const hasCycle = detectCycle(nodes, connections);
  if (hasCycle) {
    // Cycles are allowed only for feedback nodes
    const feedbackNodes = nodes.filter((n) => n.node.supportsFeedback);
    if (feedbackNodes.length === 0) {
      errors.push('Graph contains cycles but no feedback-enabled nodes');
    } else {
      warnings.push('Graph contains feedback loop(s)');
    }
  }

  if (errors.length > 0) {
    return { success: false, errors, warnings };
  }

  const graph: RenderGraph = {
    id: `graph-${Date.now()}`,
    name: 'Render Graph',
    nodes,
    connections,
    outputNodeId,
    resolution,
    frameRate
  };

  return { success: true, graph, errors, warnings };
};

const detectCycle = (
  nodes: RenderGraphNode[],
  connections: RenderGraphConnection[]
): boolean => {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  const dfs = (nodeId: string): boolean => {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    const outgoingConnections = connections.filter((c) => c.fromInstanceId === nodeId);
    for (const conn of outgoingConnections) {
      if (!visited.has(conn.toInstanceId)) {
        if (dfs(conn.toInstanceId)) return true;
      } else if (recursionStack.has(conn.toInstanceId)) {
        return true;
      }
    }

    recursionStack.delete(nodeId);
    return false;
  };

  for (const node of nodes) {
    if (!visited.has(node.instanceId)) {
      if (dfs(node.instanceId)) return true;
    }
  }

  return false;
};

// ============================================================================
// Execution Order (Topological Sort)
// ============================================================================

export const computeExecutionOrder = (graph: RenderGraph): string[] => {
  const inDegree = new Map<string, number>();
  const adjacencyList = new Map<string, string[]>();

  // Initialize
  for (const node of graph.nodes) {
    inDegree.set(node.instanceId, 0);
    adjacencyList.set(node.instanceId, []);
  }

  // Build adjacency list and compute in-degrees
  for (const conn of graph.connections) {
    const neighbors = adjacencyList.get(conn.fromInstanceId) || [];
    neighbors.push(conn.toInstanceId);
    adjacencyList.set(conn.fromInstanceId, neighbors);
    inDegree.set(conn.toInstanceId, (inDegree.get(conn.toInstanceId) || 0) + 1);
  }

  // Kahn's algorithm
  const queue: string[] = [];
  const result: string[] = [];

  for (const [nodeId, degree] of inDegree) {
    if (degree === 0) {
      queue.push(nodeId);
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current);

    for (const neighbor of adjacencyList.get(current) || []) {
      const newDegree = (inDegree.get(neighbor) || 1) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  // Handle feedback loops - add remaining nodes
  for (const node of graph.nodes) {
    if (!result.includes(node.instanceId)) {
      result.push(node.instanceId);
    }
  }

  return result;
};

// ============================================================================
// Sends/Returns (Parallel FX Chains)
// ============================================================================

export interface SendReturn {
  id: string;
  name: string;
  sourceNodeId: string;
  sourceOutputId: string;
  fxChain: string[];  // Node instance IDs in order
  returnNodeId: string;
  returnInputId: string;
  wetAmount: number;
}

export const createSendReturn = (
  name: string,
  sourceNodeId: string,
  sourceOutputId: string,
  fxChain: string[],
  returnNodeId: string,
  returnInputId: string,
  wetAmount = 1.0
): SendReturn => ({
  id: `send-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  name,
  sourceNodeId,
  sourceOutputId,
  fxChain,
  returnNodeId,
  returnInputId,
  wetAmount
});

export const expandSendReturns = (
  graph: RenderGraph,
  sendReturns: SendReturn[]
): RenderGraph => {
  const expandedConnections = [...graph.connections];

  for (const sr of sendReturns) {
    // Add connection from source to first FX
    if (sr.fxChain.length > 0) {
      const firstFx = graph.nodes.find((n) => n.instanceId === sr.fxChain[0]);
      if (firstFx && firstFx.node.inputs.length > 0) {
        expandedConnections.push(createConnection(
          sr.sourceNodeId,
          sr.sourceOutputId,
          sr.fxChain[0],
          firstFx.node.inputs[0].id
        ));
      }
    }

    // Chain FX together
    for (let i = 0; i < sr.fxChain.length - 1; i++) {
      const current = graph.nodes.find((n) => n.instanceId === sr.fxChain[i]);
      const next = graph.nodes.find((n) => n.instanceId === sr.fxChain[i + 1]);
      if (current && next && current.node.outputs.length > 0 && next.node.inputs.length > 0) {
        expandedConnections.push(createConnection(
          sr.fxChain[i],
          current.node.outputs[0].id,
          sr.fxChain[i + 1],
          next.node.inputs[0].id
        ));
      }
    }

    // Connect last FX to return
    if (sr.fxChain.length > 0) {
      const lastFx = graph.nodes.find((n) => n.instanceId === sr.fxChain[sr.fxChain.length - 1]);
      if (lastFx && lastFx.node.outputs.length > 0) {
        expandedConnections.push(createConnection(
          sr.fxChain[sr.fxChain.length - 1],
          lastFx.node.outputs[0].id,
          sr.returnNodeId,
          sr.returnInputId
        ));
      }
    }
  }

  return {
    ...graph,
    connections: expandedConnections
  };
};

// ============================================================================
// Feedback Taps
// ============================================================================

export interface FeedbackTap {
  id: string;
  sourceNodeId: string;
  sourceOutputId: string;
  targetNodeId: string;
  targetInputId: string;
  delay: number;  // Frames of delay (0 = previous frame)
}

export const createFeedbackTap = (
  sourceNodeId: string,
  sourceOutputId: string,
  targetNodeId: string,
  targetInputId: string,
  delay = 0
): FeedbackTap => ({
  id: `feedback-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  sourceNodeId,
  sourceOutputId,
  targetNodeId,
  targetInputId,
  delay
});

// ============================================================================
// Resource Pool Management (FBO/Texture Pooling)
// ============================================================================

export const createResourcePool = (
  maxFBOs = 16,
  maxTextures = 32
): ResourcePool => ({
  fbos: new Map(),
  textures: new Map(),
  maxFBOs,
  maxTextures,
  currentFrame: 0
});

export const allocateFBO = (
  pool: ResourcePool,
  width: number,
  height: number,
  ownerNodeId: string | null = null
): string | null => {
  // Look for existing unused FBO with matching dimensions
  for (const [id, fbo] of pool.fbos) {
    if (!fbo.inUse && fbo.width === width && fbo.height === height) {
      fbo.inUse = true;
      fbo.lastUsedFrame = pool.currentFrame;
      fbo.ownerNodeId = ownerNodeId;
      return id;
    }
  }

  // Check if we can allocate a new FBO
  if (pool.fbos.size >= pool.maxFBOs) {
    // Try to reclaim oldest unused FBO
    let oldestId: string | null = null;
    let oldestFrame = Infinity;
    for (const [id, fbo] of pool.fbos) {
      if (!fbo.inUse && fbo.lastUsedFrame < oldestFrame) {
        oldestFrame = fbo.lastUsedFrame;
        oldestId = id;
      }
    }
    if (oldestId) {
      pool.fbos.delete(oldestId);
    } else {
      return null; // No available FBOs
    }
  }

  // Create new FBO entry (actual WebGL resources created by renderer)
  const id = `fbo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  pool.fbos.set(id, {
    id,
    framebuffer: null,
    texture: null,
    width,
    height,
    inUse: true,
    lastUsedFrame: pool.currentFrame,
    ownerNodeId
  });

  return id;
};

export const releaseFBO = (pool: ResourcePool, id: string): void => {
  const fbo = pool.fbos.get(id);
  if (fbo) {
    fbo.inUse = false;
    fbo.ownerNodeId = null;
  }
};

export const allocateTexture = (
  pool: ResourcePool,
  width: number,
  height: number,
  format: 'rgba8' | 'rgba16f' | 'rgba32f' = 'rgba8',
  ownerNodeId: string | null = null
): string | null => {
  // Look for existing unused texture with matching properties
  for (const [id, tex] of pool.textures) {
    if (!tex.inUse && tex.width === width && tex.height === height && tex.format === format) {
      tex.inUse = true;
      tex.lastUsedFrame = pool.currentFrame;
      tex.ownerNodeId = ownerNodeId;
      return id;
    }
  }

  // Check if we can allocate a new texture
  if (pool.textures.size >= pool.maxTextures) {
    let oldestId: string | null = null;
    let oldestFrame = Infinity;
    for (const [id, tex] of pool.textures) {
      if (!tex.inUse && tex.lastUsedFrame < oldestFrame) {
        oldestFrame = tex.lastUsedFrame;
        oldestId = id;
      }
    }
    if (oldestId) {
      pool.textures.delete(oldestId);
    } else {
      return null;
    }
  }

  const id = `tex-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  pool.textures.set(id, {
    id,
    texture: null,
    width,
    height,
    format,
    inUse: true,
    lastUsedFrame: pool.currentFrame,
    ownerNodeId
  });

  return id;
};

export const releaseTexture = (pool: ResourcePool, id: string): void => {
  const tex = pool.textures.get(id);
  if (tex) {
    tex.inUse = false;
    tex.ownerNodeId = null;
  }
};

export const advanceFrame = (pool: ResourcePool): void => {
  pool.currentFrame++;
};

export const cleanupUnusedResources = (pool: ResourcePool, maxAge = 60): void => {
  const threshold = pool.currentFrame - maxAge;

  for (const [id, fbo] of pool.fbos) {
    if (!fbo.inUse && fbo.lastUsedFrame < threshold) {
      pool.fbos.delete(id);
    }
  }

  for (const [id, tex] of pool.textures) {
    if (!tex.inUse && tex.lastUsedFrame < threshold) {
      pool.textures.delete(id);
    }
  }
};

// ============================================================================
// Resolution Negotiation
// ============================================================================

export interface ResolutionConfig {
  baseWidth: number;
  baseHeight: number;
  scaleFactor: number;
  minWidth: number;
  minHeight: number;
}

export const negotiateNodeResolution = (
  node: VisualNode,
  config: ResolutionConfig
): { width: number; height: number } => {
  const { baseWidth, baseHeight, scaleFactor, minWidth, minHeight } = config;
  const { preferredResolution } = node.resourceRequirements;

  let scale = scaleFactor;
  switch (preferredResolution) {
    case 'full':
      scale = 1.0;
      break;
    case 'half':
      scale = 0.5;
      break;
    case 'quarter':
      scale = 0.25;
      break;
    case 'eighth':
      scale = 0.125;
      break;
    case 'dynamic':
      // Use the provided scale factor
      break;
  }

  const width = Math.max(minWidth, Math.floor(baseWidth * scale));
  const height = Math.max(minHeight, Math.floor(baseHeight * scale));

  return { width, height };
};

export const allocateGraphResources = (
  graph: RenderGraph,
  pool: ResourcePool,
  config: ResolutionConfig
): Map<string, { fbos: string[]; textures: string[] }> => {
  const allocations = new Map<string, { fbos: string[]; textures: string[] }>();

  for (const node of graph.nodes) {
    const resolution = negotiateNodeResolution(node.node, config);
    const { framebuffers, textures } = node.node.resourceRequirements;

    const fboIds: string[] = [];
    const textureIds: string[] = [];

    for (let i = 0; i < framebuffers; i++) {
      const id = allocateFBO(pool, resolution.width, resolution.height, node.instanceId);
      if (id) fboIds.push(id);
    }

    for (let i = 0; i < textures; i++) {
      const id = allocateTexture(pool, resolution.width, resolution.height, 'rgba8', node.instanceId);
      if (id) textureIds.push(id);
    }

    allocations.set(node.instanceId, { fbos: fboIds, textures: textureIds });
    node.framebufferIds = fboIds;
    node.textureIds = textureIds;
  }

  return allocations;
};

export const releaseGraphResources = (
  graph: RenderGraph,
  pool: ResourcePool,
  allocations: Map<string, { fbos: string[]; textures: string[] }>
): void => {
  for (const [, alloc] of allocations) {
    for (const fboId of alloc.fbos) {
      releaseFBO(pool, fboId);
    }
    for (const texId of alloc.textures) {
      releaseTexture(pool, texId);
    }
  }
};

// ============================================================================
// Cost Estimation
// ============================================================================

export const estimateGraphCost = (graph: RenderGraph): {
  totalCostMs: number;
  nodeBreakdown: { nodeId: string; costMs: number }[];
  warnings: string[];
} => {
  const nodeBreakdown: { nodeId: string; costMs: number }[] = [];
  const warnings: string[] = [];
  let totalCostMs = 0;

  for (const node of graph.nodes) {
    const costMs = gpuCostEstimate[node.node.gpuCostTier] || 1.0;
    nodeBreakdown.push({ nodeId: node.instanceId, costMs });
    totalCostMs += costMs;
  }

  const targetFrameTime = 1000 / graph.frameRate;
  if (totalCostMs > targetFrameTime * 0.8) {
    warnings.push(
      `Estimated cost (${totalCostMs.toFixed(1)}ms) exceeds 80% of frame budget (${targetFrameTime.toFixed(1)}ms)`
    );
  }

  if (totalCostMs > targetFrameTime) {
    warnings.push(
      `Graph may not achieve target frame rate of ${graph.frameRate}fps`
    );
  }

  return { totalCostMs, nodeBreakdown, warnings };
};

// ============================================================================
// Graph Serialization
// ============================================================================

export const serializeGraph = (graph: RenderGraph): string => {
  const serializable = {
    ...graph,
    nodes: graph.nodes.map((n) => ({
      instanceId: n.instanceId,
      nodeId: n.node.id,
      instance: n.instance
    }))
  };
  return JSON.stringify(serializable, null, 2);
};

export const deserializeGraph = (json: string): RenderGraph | null => {
  try {
    const data = JSON.parse(json);
    const nodes: RenderGraphNode[] = data.nodes.map((n: { nodeId: string; instanceId: string; instance: NodeInstance }) => {
      const node = getNodeById(n.nodeId);
      if (!node) throw new Error(`Unknown node: ${n.nodeId}`);
      return createRenderGraphNode(node, n.instance);
    });

    return {
      id: data.id,
      name: data.name,
      nodes,
      connections: data.connections,
      outputNodeId: data.outputNodeId,
      resolution: data.resolution,
      frameRate: data.frameRate
    };
  } catch {
    return null;
  }
};
