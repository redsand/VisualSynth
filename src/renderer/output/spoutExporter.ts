/**
 * Spout Exporter
 *
 * Handles Spout texture sharing output for VJ integration.
 * Spout is Windows-only and allows sharing OpenGL textures with other applications
 * like Resolume Arena, TouchDesigner, and OBS.
 *
 * Note: This requires the electron-spout native addon to be installed and built.
 * The addon must be loaded in the main process and exposed via IPC.
 */

import type { SpoutOutputConfig } from '../../shared/outputConfig';

export interface SpoutExporter {
  /** Check if Spout is available on this system */
  isAvailable(): Promise<boolean>;
  /** Enable Spout output */
  enable(config: SpoutOutputConfig): Promise<boolean>;
  /** Disable Spout output */
  disable(): Promise<void>;
  /** Send current canvas frame to Spout */
  sendFrame(canvas: HTMLCanvasElement): Promise<void>;
  /** Get current status */
  getStatus(): Promise<{
    enabled: boolean;
    senderName: string;
    connectedReceivers: number;
  }>;
  /** Update sender name */
  setSenderName(name: string): Promise<void>;
}

/**
 * Create a Spout exporter instance
 * Uses IPC to communicate with the main process where the native Spout binding lives
 */
export const createSpoutExporter = (): SpoutExporter => {
  let enabled = false;
  let senderName = 'VisualSynth';

  // Check if the Spout API is exposed from the main process
  const hasSpoutApi = () => {
    return typeof (window as any).visualSynth?.spoutIsAvailable === 'function';
  };

  return {
    async isAvailable(): Promise<boolean> {
      if (!hasSpoutApi()) {
        console.log('Spout API not available - electron-spout not installed');
        return false;
      }
      try {
        return await (window as any).visualSynth.spoutIsAvailable();
      } catch (error) {
        console.error('Error checking Spout availability:', error);
        return false;
      }
    },

    async enable(config: SpoutOutputConfig): Promise<boolean> {
      if (!hasSpoutApi()) {
        console.warn('Cannot enable Spout - API not available');
        return false;
      }
      try {
        const result = await (window as any).visualSynth.spoutEnable(config.senderName);
        if (result) {
          enabled = true;
          senderName = config.senderName;
        }
        return result;
      } catch (error) {
        console.error('Error enabling Spout:', error);
        return false;
      }
    },

    async disable(): Promise<void> {
      if (!hasSpoutApi()) return;
      try {
        await (window as any).visualSynth.spoutDisable();
        enabled = false;
      } catch (error) {
        console.error('Error disabling Spout:', error);
      }
    },

    async sendFrame(canvas: HTMLCanvasElement): Promise<void> {
      if (!enabled || !hasSpoutApi()) return;
      try {
        // Get the WebGL context and texture
        const gl = canvas.getContext('webgl2');
        if (!gl) return;

        // For now, we'll send the canvas pixels as a fallback
        // Ideally, we'd share the GL texture directly for zero-copy performance
        await (window as any).visualSynth.spoutSendTexture(
          canvas.width,
          canvas.height
        );
      } catch (error) {
        // Don't spam console on every frame
      }
    },

    async getStatus(): Promise<{
      enabled: boolean;
      senderName: string;
      connectedReceivers: number;
    }> {
      if (!hasSpoutApi()) {
        return { enabled: false, senderName, connectedReceivers: 0 };
      }
      try {
        return await (window as any).visualSynth.spoutGetStatus();
      } catch (error) {
        return { enabled, senderName, connectedReceivers: 0 };
      }
    },

    async setSenderName(name: string): Promise<void> {
      if (!hasSpoutApi()) return;
      try {
        await (window as any).visualSynth.spoutSetSenderName(name);
        senderName = name;
      } catch (error) {
        console.error('Error setting Spout sender name:', error);
      }
    }
  };
};
