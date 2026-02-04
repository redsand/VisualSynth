/**
 * NDI Sender
 *
 * Handles NDI (Network Device Interface) output for streaming integration.
 * NDI is cross-platform and allows sending video over the network to applications
 * like OBS, vMix, Wirecast, and other NDI-compatible software.
 *
 * Note: This requires the grandiose native addon to be installed and built.
 * The addon must be loaded in the main process and exposed via IPC.
 */

import type { NdiOutputConfig } from '../../shared/outputConfig';

export interface NdiSender {
  /** Check if NDI is available on this system */
  isAvailable(): Promise<boolean>;
  /** Enable NDI output */
  enable(config: NdiOutputConfig): Promise<boolean>;
  /** Disable NDI output */
  disable(): Promise<void>;
  /** Send current canvas frame over NDI */
  sendFrame(canvas: HTMLCanvasElement): Promise<void>;
  /** Get current status */
  getStatus(): Promise<{
    enabled: boolean;
    senderName: string;
    connectedReceivers: string[];
  }>;
  /** Update sender name */
  setSenderName(name: string): Promise<void>;
}

/**
 * Create an NDI sender instance
 * Uses IPC to communicate with the main process where the native NDI binding lives
 */
export const createNdiSender = (): NdiSender => {
  let enabled = false;
  let senderName = 'VisualSynth';
  let frameBuffer: Uint8ClampedArray | null = null;
  let frameCanvas: HTMLCanvasElement | null = null;
  let frameCtx: CanvasRenderingContext2D | null = null;

  // Check if the NDI API is exposed from the main process
  const hasNdiApi = () => {
    return typeof (window as any).visualSynth?.ndiIsAvailable === 'function';
  };

  // Create offscreen canvas for pixel extraction
  const ensureFrameBuffer = (width: number, height: number) => {
    if (!frameCanvas || frameCanvas.width !== width || frameCanvas.height !== height) {
      frameCanvas = document.createElement('canvas');
      frameCanvas.width = width;
      frameCanvas.height = height;
      frameCtx = frameCanvas.getContext('2d', { willReadFrequently: true });
    }
    return frameCtx;
  };

  return {
    async isAvailable(): Promise<boolean> {
      if (!hasNdiApi()) {
        console.log('NDI API not available - grandiose not installed');
        return false;
      }
      try {
        return await (window as any).visualSynth.ndiIsAvailable();
      } catch (error) {
        console.error('Error checking NDI availability:', error);
        return false;
      }
    },

    async enable(config: NdiOutputConfig): Promise<boolean> {
      if (!hasNdiApi()) {
        console.warn('Cannot enable NDI - API not available');
        return false;
      }
      try {
        const result = await (window as any).visualSynth.ndiEnable({
          senderName: config.senderName,
          groups: config.groups
        });
        if (result) {
          enabled = true;
          senderName = config.senderName;
        }
        return result;
      } catch (error) {
        console.error('Error enabling NDI:', error);
        return false;
      }
    },

    async disable(): Promise<void> {
      if (!hasNdiApi()) return;
      try {
        await (window as any).visualSynth.ndiDisable();
        enabled = false;
      } catch (error) {
        console.error('Error disabling NDI:', error);
      }
    },

    async sendFrame(canvas: HTMLCanvasElement): Promise<void> {
      if (!enabled || !hasNdiApi()) return;

      try {
        const width = canvas.width;
        const height = canvas.height;

        // Get 2D context for pixel extraction
        const ctx = ensureFrameBuffer(width, height);
        if (!ctx || !frameCanvas) return;

        // Draw WebGL canvas to 2D canvas
        ctx.drawImage(canvas, 0, 0);

        // Get pixel data (RGBA)
        const imageData = ctx.getImageData(0, 0, width, height);

        // Send frame data to main process via IPC
        // Using Transferable to avoid memory copy when possible
        await (window as any).visualSynth.ndiSendFrame({
          data: imageData.data.buffer,
          width,
          height,
          fourCC: 'RGBA'
        });
      } catch (error) {
        // Don't spam console on every frame
      }
    },

    async getStatus(): Promise<{
      enabled: boolean;
      senderName: string;
      connectedReceivers: string[];
    }> {
      if (!hasNdiApi()) {
        return { enabled: false, senderName, connectedReceivers: [] };
      }
      try {
        return await (window as any).visualSynth.ndiGetStatus();
      } catch (error) {
        return { enabled, senderName, connectedReceivers: [] };
      }
    },

    async setSenderName(name: string): Promise<void> {
      if (!hasNdiApi()) return;
      try {
        await (window as any).visualSynth.ndiSetSenderName(name);
        senderName = name;
      } catch (error) {
        console.error('Error setting NDI sender name:', error);
      }
    }
  };
};
