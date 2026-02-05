/**
 * Burst SDF Manager
 *
 * Manages beat-triggered SDF shape spawns with expanding animations.
 * Uses the burst envelope system from lfoUtils for smooth expansions.
 */

import type { SdfNodeInstance, SdfNodeDefinition } from '../api';
import { createNodeInstance } from '../api';
import { sdfRegistry } from '../registry';
import {
  BurstEnvelopeParams,
  BurstEnvelopeState,
  BurstTrigger,
  createDefaultBurstState,
  updateBurstEnvelope,
  getBurstTriggerValue,
  getActiveBurstValues,
  DEFAULT_BURST_PARAMS
} from '../../../shared/lfoUtils';

// ============================================================================
// Types
// ============================================================================

export interface BurstSdfConfig {
  /** Which SDF shape to spawn (node definition ID) */
  shapeId: string;
  /** Base parameters for the shape */
  baseParams: Record<string, number | number[] | boolean>;
  /** Burst envelope configuration */
  envelope: BurstEnvelopeParams;
  /** Parameter to animate with envelope (e.g., 'radius', 'size') */
  animatedParam: string;
  /** Start value for animated param (at envelope = 0) */
  animStartValue: number;
  /** End value for animated param (at envelope = 1) */
  animEndValue: number;
  /** Whether to also fade opacity based on envelope */
  fadeOpacity: boolean;
  /** Color for the shape (optional) */
  color?: [number, number, number];
  /** Position offset from center (normalized 0-1) */
  position?: [number, number];
}

export interface BurstSdfInstance {
  /** Configuration for this burst type */
  config: BurstSdfConfig;
  /** Envelope state for managing concurrent bursts */
  envelopeState: BurstEnvelopeState;
  /** Active SDF node instances for rendering */
  activeNodes: (SdfNodeInstance | null)[];
}

export interface BurstSdfManagerState {
  /** Registered burst configurations */
  bursts: BurstSdfInstance[];
  /** Global enable flag */
  enabled: boolean;
}

// ============================================================================
// Manager Class
// ============================================================================

export class BurstSdfManager {
  private state: BurstSdfManagerState = {
    bursts: [],
    enabled: true
  };

  /**
   * Register a new burst SDF configuration
   */
  addBurst(config: BurstSdfConfig): number {
    const nodeDef = sdfRegistry.get(config.shapeId);
    if (!nodeDef) {
      console.warn(`BurstSdfManager: Shape "${config.shapeId}" not found in registry`);
      return -1;
    }

    const maxConcurrent = config.envelope.maxConcurrent || 8;
    const instance: BurstSdfInstance = {
      config,
      envelopeState: createDefaultBurstState(maxConcurrent),
      activeNodes: new Array(maxConcurrent).fill(null)
    };

    this.state.bursts.push(instance);
    return this.state.bursts.length - 1;
  }

  /**
   * Remove a burst configuration by index
   */
  removeBurst(index: number): void {
    if (index >= 0 && index < this.state.bursts.length) {
      this.state.bursts.splice(index, 1);
    }
  }

  /**
   * Clear all burst configurations
   */
  clearBursts(): void {
    this.state.bursts = [];
  }

  /**
   * Update burst manager state
   * @param dt Delta time in seconds
   * @param currentTime Current time in seconds
   * @param audioData Audio analysis data
   */
  update(
    dt: number,
    currentTime: number,
    audioData: { peak: number; bass: number; mid: number; high: number }
  ): void {
    if (!this.state.enabled) return;

    for (const burst of this.state.bursts) {
      // Get trigger value based on envelope trigger type
      const triggerValue = getBurstTriggerValue(burst.config.envelope.trigger, audioData);

      // Update envelope state
      const newEnvelopeState = updateBurstEnvelope(
        burst.envelopeState,
        burst.config.envelope,
        dt,
        currentTime,
        triggerValue
      );

      // Update active nodes based on envelope instances
      for (let i = 0; i < newEnvelopeState.instances.length; i++) {
        const envInstance = newEnvelopeState.instances[i];

        if (envInstance.active) {
          // Create or update node
          if (!burst.activeNodes[i]) {
            burst.activeNodes[i] = this.createNodeForBurst(burst.config, i, currentTime);
          }

          // Update animated parameters
          if (burst.activeNodes[i]) {
            const node = burst.activeNodes[i]!;
            const t = envInstance.value; // 0-1 envelope value

            // Interpolate animated parameter
            const animValue = burst.config.animStartValue +
              (burst.config.animEndValue - burst.config.animStartValue) * t;
            node.params[burst.config.animatedParam] = animValue;

            // Fade opacity if configured
            if (burst.config.fadeOpacity) {
              // Fade out as value increases (expanding = fading)
              node.params['opacity'] = 1 - t * 0.8;
            }
          }
        } else {
          // Deactivate node
          burst.activeNodes[i] = null;
        }
      }

      burst.envelopeState = newEnvelopeState;
    }
  }

  /**
   * Get all active SDF nodes for rendering
   */
  getActiveNodes(): SdfNodeInstance[] {
    const nodes: SdfNodeInstance[] = [];

    for (const burst of this.state.bursts) {
      for (const node of burst.activeNodes) {
        if (node) {
          nodes.push(node);
        }
      }
    }

    return nodes;
  }

  /**
   * Get burst values for shader uniforms (for gl-based rendering)
   */
  getBurstUniformData(burstIndex: number, currentTime: number): {
    values: number[];
    ages: number[];
    actives: number[];
  } | null {
    const burst = this.state.bursts[burstIndex];
    if (!burst) return null;

    return getActiveBurstValues(burst.envelopeState, currentTime);
  }

  /**
   * Manually trigger a burst
   */
  triggerManual(burstIndex: number, currentTime: number): void {
    const burst = this.state.bursts[burstIndex];
    if (!burst) return;

    // Find inactive slot and activate
    for (let i = 0; i < burst.envelopeState.instances.length; i++) {
      if (!burst.envelopeState.instances[i].active) {
        burst.envelopeState.instances[i] = {
          active: true,
          stage: 'attack',
          value: 0,
          timeInStage: 0,
          spawnTime: currentTime
        };
        break;
      }
    }
  }

  /**
   * Set enabled state
   */
  setEnabled(enabled: boolean): void {
    this.state.enabled = enabled;
  }

  /**
   * Get state for serialization
   */
  getState(): BurstSdfManagerState {
    return this.state;
  }

  private createNodeForBurst(
    config: BurstSdfConfig,
    slotIndex: number,
    currentTime: number
  ): SdfNodeInstance {
    const baseParams = { ...config.baseParams };

    // Set initial animated param value
    baseParams[config.animatedParam] = config.animStartValue;

    // Set color if provided
    if (config.color) {
      baseParams['color'] = config.color;
    }

    // Set position if provided
    if (config.position) {
      baseParams['position'] = config.position;
    }

    const node = createNodeInstance(config.shapeId, baseParams, {
      label: `burst-${config.shapeId}-${slotIndex}`
    });

    // Override instance ID for deterministic tracking
    node.instanceId = `burst_${config.shapeId}_${slotIndex}`;

    return node;
  }
}

// ============================================================================
// Preset Configurations
// ============================================================================

/**
 * Create an expanding ring burst preset
 */
export const createExpandingRingPreset = (
  options?: Partial<BurstSdfConfig>
): BurstSdfConfig => ({
  shapeId: 'ring',
  baseParams: {
    radius: 0.05,
    thickness: 0.02
  },
  envelope: {
    ...DEFAULT_BURST_PARAMS,
    attack: 0.05,
    hold: 0,
    decay: 0.6,
    trigger: 'audio.bass',
    threshold: 0.5
  },
  animatedParam: 'radius',
  animStartValue: 0.05,
  animEndValue: 0.8,
  fadeOpacity: true,
  ...options
});

/**
 * Create an expanding star burst preset
 */
export const createExpandingStarPreset = (
  options?: Partial<BurstSdfConfig>
): BurstSdfConfig => ({
  shapeId: 'star',
  baseParams: {
    outerRadius: 0.1,
    innerRadius: 0.04,
    points: 5
  },
  envelope: {
    ...DEFAULT_BURST_PARAMS,
    attack: 0.03,
    hold: 0.05,
    decay: 0.4,
    trigger: 'audio.peak',
    threshold: 0.6
  },
  animatedParam: 'outerRadius',
  animStartValue: 0.1,
  animEndValue: 0.6,
  fadeOpacity: true,
  ...options
});

/**
 * Create a hexagon pulse preset
 */
export const createHexagonPulsePreset = (
  options?: Partial<BurstSdfConfig>
): BurstSdfConfig => ({
  shapeId: 'polygon',
  baseParams: {
    radius: 0.1,
    sides: 6
  },
  envelope: {
    ...DEFAULT_BURST_PARAMS,
    attack: 0.02,
    hold: 0.1,
    decay: 0.3,
    trigger: 'audio.mid',
    threshold: 0.55
  },
  animatedParam: 'radius',
  animStartValue: 0.1,
  animEndValue: 0.5,
  fadeOpacity: true,
  ...options
});

/**
 * Create concentric circles preset (multiple rings at once)
 */
export const createConcentricRingsPreset = (): BurstSdfConfig[] => {
  const rings: BurstSdfConfig[] = [];
  const delays = [0, 0.08, 0.16]; // Staggered timing

  for (let i = 0; i < 3; i++) {
    rings.push({
      shapeId: 'ring',
      baseParams: {
        radius: 0.05 + i * 0.02,
        thickness: 0.015
      },
      envelope: {
        ...DEFAULT_BURST_PARAMS,
        attack: 0.04 + i * 0.02,
        hold: 0,
        decay: 0.5 + i * 0.1,
        trigger: 'audio.bass',
        threshold: 0.5
      },
      animatedParam: 'radius',
      animStartValue: 0.05 + i * 0.02,
      animEndValue: 0.6 + i * 0.15,
      fadeOpacity: true
    });
  }

  return rings;
};

// ============================================================================
// Singleton Instance
// ============================================================================

export const burstSdfManager = new BurstSdfManager();
