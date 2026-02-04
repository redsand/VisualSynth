/**
 * Output Manager
 *
 * Unified manager for all output integrations (Spout, NDI).
 * Handles initialization, frame sending, and status monitoring.
 */

import { createSpoutExporter, type SpoutExporter } from './spoutExporter';
import { createNdiSender, type NdiSender } from './ndiSender';
import type { OutputIntegrationConfig, OutputIntegrationStatus } from '../../shared/outputConfig';

export interface OutputManager {
  /** Initialize output integrations */
  initialize(): Promise<void>;
  /** Update configuration and enable/disable outputs */
  updateConfig(config: OutputIntegrationConfig): Promise<void>;
  /** Send frame to all enabled outputs */
  sendFrame(canvas: HTMLCanvasElement): void;
  /** Get status of all outputs */
  getStatus(): Promise<OutputIntegrationStatus>;
  /** Cleanup and disable all outputs */
  dispose(): Promise<void>;
}

/**
 * Create an output manager instance
 */
export const createOutputManager = (): OutputManager => {
  const spout = createSpoutExporter();
  const ndi = createNdiSender();

  let spoutAvailable = false;
  let ndiAvailable = false;
  let spoutEnabled = false;
  let ndiEnabled = false;
  let frameThrottle = 0;
  const targetFps = 60;
  const frameInterval = 1000 / targetFps;

  return {
    async initialize(): Promise<void> {
      // Check availability of each output type
      [spoutAvailable, ndiAvailable] = await Promise.all([
        spout.isAvailable(),
        ndi.isAvailable()
      ]);

      console.log('Output integrations initialized:', {
        spout: spoutAvailable ? 'available' : 'not available',
        ndi: ndiAvailable ? 'available' : 'not available'
      });
    },

    async updateConfig(config: OutputIntegrationConfig): Promise<void> {
      // Handle Spout
      if (config.spout.enabled && !spoutEnabled && spoutAvailable) {
        const success = await spout.enable(config.spout);
        spoutEnabled = success;
        if (success) {
          console.log('Spout output enabled:', config.spout.senderName);
        }
      } else if (!config.spout.enabled && spoutEnabled) {
        await spout.disable();
        spoutEnabled = false;
        console.log('Spout output disabled');
      } else if (config.spout.enabled && spoutEnabled) {
        // Update sender name if changed
        await spout.setSenderName(config.spout.senderName);
      }

      // Handle NDI
      if (config.ndi.enabled && !ndiEnabled && ndiAvailable) {
        const success = await ndi.enable(config.ndi);
        ndiEnabled = success;
        if (success) {
          console.log('NDI output enabled:', config.ndi.senderName);
        }
      } else if (!config.ndi.enabled && ndiEnabled) {
        await ndi.disable();
        ndiEnabled = false;
        console.log('NDI output disabled');
      } else if (config.ndi.enabled && ndiEnabled) {
        // Update sender name if changed
        await ndi.setSenderName(config.ndi.senderName);
      }
    },

    sendFrame(canvas: HTMLCanvasElement): void {
      // Throttle frame sending to target FPS
      const now = performance.now();
      if (now - frameThrottle < frameInterval) {
        return;
      }
      frameThrottle = now;

      // Send to enabled outputs (fire and forget)
      if (spoutEnabled) {
        void spout.sendFrame(canvas);
      }
      if (ndiEnabled) {
        void ndi.sendFrame(canvas);
      }
    },

    async getStatus(): Promise<OutputIntegrationStatus> {
      const [spoutStatus, ndiStatus] = await Promise.all([
        spout.getStatus(),
        ndi.getStatus()
      ]);

      return {
        spout: {
          available: spoutAvailable,
          enabled: spoutStatus.enabled,
          senderName: spoutStatus.senderName,
          connectedReceivers: spoutStatus.connectedReceivers
        },
        ndi: {
          available: ndiAvailable,
          enabled: ndiStatus.enabled,
          senderName: ndiStatus.senderName,
          connectedReceivers: ndiStatus.connectedReceivers
        }
      };
    },

    async dispose(): Promise<void> {
      if (spoutEnabled) {
        await spout.disable();
        spoutEnabled = false;
      }
      if (ndiEnabled) {
        await ndi.disable();
        ndiEnabled = false;
      }
      console.log('Output integrations disposed');
    }
  };
};
