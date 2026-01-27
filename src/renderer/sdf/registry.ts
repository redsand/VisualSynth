/**
 * SDF Node Registry
 *
 * Manages registration, lookup, and versioning of SDF node definitions.
 * Provides category/search functionality for the UI.
 */

import type {
  SdfNodeDefinition,
  SdfNodeCategory,
  SdfCoordSpace,
  SdfNodeRegistry
} from './api';

// ============================================================================
// Registry Implementation
// ============================================================================

class SdfNodeRegistryImpl implements SdfNodeRegistry {
  private nodes = new Map<string, SdfNodeDefinition>();
  private byCategory = new Map<SdfNodeCategory, Set<string>>();
  private byCoordSpace = new Map<SdfCoordSpace, Set<string>>();
  private favoriteIds = new Set<string>();
  private recentIds: string[] = [];

  register(node: SdfNodeDefinition): void {
    if (this.nodes.has(node.id)) {
      console.warn(`SDF node "${node.id}" already registered, overwriting.`);
    }

    // Validate node definition
    this.validateNode(node);

    this.nodes.set(node.id, node);

    // Index by category
    if (!this.byCategory.has(node.category)) {
      this.byCategory.set(node.category, new Set());
    }
    this.byCategory.get(node.category)!.add(node.id);

    // Index by coordinate space
    const spaces: SdfCoordSpace[] = node.coordSpace === 'both'
      ? ['2d', '3d']
      : [node.coordSpace];

    for (const space of spaces) {
      if (!this.byCoordSpace.has(space)) {
        this.byCoordSpace.set(space, new Set());
      }
      this.byCoordSpace.get(space)!.add(node.id);
    }
  }

  get(id: string): SdfNodeDefinition | undefined {
    return this.nodes.get(id);
  }

  getAll(): SdfNodeDefinition[] {
    return Array.from(this.nodes.values());
  }

  getByCategory(category: SdfNodeCategory): SdfNodeDefinition[] {
    const ids = this.byCategory.get(category);
    if (!ids) return [];
    return Array.from(ids)
      .map(id => this.nodes.get(id)!)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  getByCoordSpace(space: SdfCoordSpace): SdfNodeDefinition[] {
    const ids = this.byCoordSpace.get(space);
    if (!ids) return [];
    return Array.from(ids)
      .map(id => this.nodes.get(id)!)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  search(query: string): SdfNodeDefinition[] {
    const q = query.toLowerCase().trim();
    if (!q) return this.getAll();

    const results: Array<{ node: SdfNodeDefinition; score: number }> = [];

    for (const node of this.nodes.values()) {
      let score = 0;

      // Exact ID match
      if (node.id === q) score += 100;

      // ID starts with query
      if (node.id.startsWith(q)) score += 50;

      // Name contains query
      if (node.name.toLowerCase().includes(q)) {
        score += 30;
        if (node.name.toLowerCase().startsWith(q)) score += 20;
      }

      // Tags contain query
      if (node.tags?.some(tag => tag.toLowerCase().includes(q))) {
        score += 15;
      }

      // Description contains query
      if (node.description?.toLowerCase().includes(q)) {
        score += 5;
      }

      if (score > 0) {
        results.push({ node, score });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .map(r => r.node);
  }

  has(id: string): boolean {
    return this.nodes.has(id);
  }

  // Favorites management
  toggleFavorite(id: string): boolean {
    if (this.favoriteIds.has(id)) {
      this.favoriteIds.delete(id);
      return false;
    }
    this.favoriteIds.add(id);
    return true;
  }

  getFavorites(): SdfNodeDefinition[] {
    return Array.from(this.favoriteIds)
      .filter(id => this.nodes.has(id))
      .map(id => this.nodes.get(id)!)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  isFavorite(id: string): boolean {
    return this.favoriteIds.has(id);
  }

  // Recents management
  addRecent(id: string, limit = 10): void {
    this.recentIds = [id, ...this.recentIds.filter(i => i !== id)].slice(0, limit);
  }

  getRecents(): SdfNodeDefinition[] {
    return this.recentIds
      .filter(id => this.nodes.has(id))
      .map(id => this.nodes.get(id)!);
  }

  // Validation
  private validateNode(node: SdfNodeDefinition): void {
    if (!node.id || !/^[a-z][a-z0-9_-]*$/.test(node.id)) {
      throw new Error(`Invalid node ID: "${node.id}". Must be lowercase alphanumeric with underscores/dashes.`);
    }
    if (!node.name) {
      throw new Error(`Node "${node.id}" must have a name.`);
    }
    if (!node.version || !/^\d+\.\d+\.\d+$/.test(node.version)) {
      throw new Error(`Node "${node.id}" must have a valid semver version.`);
    }
    if (!node.glsl || !node.glsl.signature || !node.glsl.body) {
      throw new Error(`Node "${node.id}" must have GLSL code with signature and body.`);
    }

    // Validate parameters have unique IDs
    const paramIds = new Set<string>();
    for (const param of node.parameters) {
      if (paramIds.has(param.id)) {
        throw new Error(`Node "${node.id}" has duplicate parameter ID: "${param.id}"`);
      }
      paramIds.add(param.id);
    }

    // Validate mod targets reference valid parameters
    for (const target of node.modTargets) {
      if (!paramIds.has(target.parameterId)) {
        throw new Error(`Node "${node.id}" mod target references unknown parameter: "${target.parameterId}"`);
      }
    }

    // Validate defaults exist for all parameters
    for (const param of node.parameters) {
      if (!(param.id in node.defaults) && param.default === undefined) {
        console.warn(`Node "${node.id}" parameter "${param.id}" has no default value.`);
      }
    }
  }

  // Statistics
  getStats(): {
    totalNodes: number;
    byCategory: Record<string, number>;
    byCoordSpace: Record<string, number>;
    byCostTier: Record<string, number>;
  } {
    const byCostTier: Record<string, number> = { LOW: 0, MED: 0, HIGH: 0 };
    for (const node of this.nodes.values()) {
      byCostTier[node.gpuCostTier] = (byCostTier[node.gpuCostTier] || 0) + 1;
    }

    const byCategory: Record<string, number> = {};
    for (const [cat, ids] of this.byCategory.entries()) {
      byCategory[cat] = ids.size;
    }

    const byCoordSpace: Record<string, number> = {};
    for (const [space, ids] of this.byCoordSpace.entries()) {
      byCoordSpace[space] = ids.size;
    }

    return {
      totalNodes: this.nodes.size,
      byCategory,
      byCoordSpace,
      byCostTier
    };
  }
}

// ============================================================================
// Singleton Registry Instance
// ============================================================================

export const sdfRegistry = new SdfNodeRegistryImpl();

// ============================================================================
// Registration Helper
// ============================================================================

export const registerSdfNode = (node: SdfNodeDefinition): void => {
  sdfRegistry.register(node);
};

export const registerSdfNodes = (nodes: SdfNodeDefinition[]): void => {
  for (const node of nodes) {
    sdfRegistry.register(node);
  }
};

// ============================================================================
// Node Definition Builder (Fluent API)
// ============================================================================

export class SdfNodeBuilder {
  private node: Partial<SdfNodeDefinition> = {
    version: '1.0.0',
    parameters: [],
    modTargets: [],
    defaults: {},
    deterministic: true,
    tags: []
  };

  id(id: string): this {
    this.node.id = id;
    return this;
  }

  name(name: string): this {
    this.node.name = name;
    return this;
  }

  version(version: string): this {
    this.node.version = version;
    return this;
  }

  category(category: SdfNodeCategory): this {
    this.node.category = category;
    return this;
  }

  coordSpace(space: SdfCoordSpace): this {
    this.node.coordSpace = space;
    return this;
  }

  costTier(tier: 'LOW' | 'MED' | 'HIGH'): this {
    this.node.gpuCostTier = tier;
    return this;
  }

  description(desc: string): this {
    this.node.description = desc;
    return this;
  }

  tags(...tags: string[]): this {
    this.node.tags = tags;
    return this;
  }

  param(
    id: string,
    name: string,
    type: 'float' | 'int' | 'bool' | 'vec2' | 'vec3' | 'angle',
    defaultValue: number | number[] | boolean,
    options?: { min?: number; max?: number; step?: number; group?: string; tooltip?: string; modulatable?: boolean }
  ): this {
    this.node.parameters!.push({
      id,
      name,
      type,
      default: defaultValue,
      modulatable: options?.modulatable ?? true,
      ...options
    });
    this.node.defaults![id] = defaultValue;
    return this;
  }

  modTarget(parameterId: string, minRange = 0, maxRange = 1, bipolar = false): this {
    this.node.modTargets!.push({
      parameterId,
      minRange,
      maxRange,
      bipolar,
      curve: 'linear'
    });
    return this;
  }

  glsl(signature: string, body: string, deps?: string[], requires?: string[]): this {
    this.node.glsl = { signature, body, dependencies: deps, requires };
    return this;
  }

  deterministic(value: boolean): this {
    this.node.deterministic = value;
    return this;
  }

  build(): SdfNodeDefinition {
    if (!this.node.id || !this.node.name || !this.node.category ||
        !this.node.coordSpace || !this.node.gpuCostTier || !this.node.glsl) {
      throw new Error('SdfNodeBuilder: missing required fields');
    }
    return this.node as SdfNodeDefinition;
  }

  register(): SdfNodeDefinition {
    const node = this.build();
    sdfRegistry.register(node);
    return node;
  }
}

export const defineNode = (): SdfNodeBuilder => new SdfNodeBuilder();

// ============================================================================
// Version Migration Utilities
// ============================================================================

export interface SdfMigration {
  fromVersion: string;
  toVersion: string;
  migrate: (nodeData: SdfNodeInstance) => SdfNodeInstance;
}

const migrations = new Map<string, SdfMigration[]>();

export const registerMigration = (migration: SdfMigration): void => {
  const key = `${migration.fromVersion}`;
  if (!migrations.has(key)) {
    migrations.set(key, []);
  }
  migrations.get(key)!.push(migration);
};

export const migrateNodeInstance = (
  nodeData: SdfNodeInstance & { _version?: string },
  targetVersion: string
): SdfNodeInstance => {
  let current = { ...nodeData };
  let currentVersion = nodeData._version || '1.0.0';

  while (currentVersion !== targetVersion) {
    const availableMigrations = migrations.get(currentVersion);
    if (!availableMigrations || availableMigrations.length === 0) {
      console.warn(`No migration path from ${currentVersion} to ${targetVersion}`);
      break;
    }

    const migration = availableMigrations.find(m => m.toVersion === targetVersion) ||
                     availableMigrations[0];

    current = migration.migrate(current);
    currentVersion = migration.toVersion;
  }

  return current;
};

// ============================================================================
// Category Utilities
// ============================================================================

export const getAllCategories = (): SdfNodeCategory[] => [
  'shapes2d',
  'shapes2d-advanced',
  'shapes3d',
  'shapes3d-advanced',
  'ops',
  'ops-smooth',
  'domain',
  'domain-warp',
  'fields',
  'composition',
  'utils'
];

export const getCategoriesFor2D = (): SdfNodeCategory[] => [
  'shapes2d',
  'shapes2d-advanced',
  'ops',
  'ops-smooth',
  'domain',
  'domain-warp',
  'fields',
  'composition',
  'utils'
];

export const getCategoriesFor3D = (): SdfNodeCategory[] => [
  'shapes3d',
  'shapes3d-advanced',
  'ops',
  'ops-smooth',
  'domain',
  'domain-warp',
  'fields',
  'composition',
  'utils'
];
