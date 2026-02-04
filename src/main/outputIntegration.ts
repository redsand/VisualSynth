/**
 * Output Integration Handlers (Main Process)
 *
 * IPC handlers for Spout and NDI output integrations.
 * These require native modules to be installed:
 * - electron-spout for Spout (Windows only)
 * - grandiose for NDI (cross-platform)
 *
 * When native modules are not available, these handlers return
 * graceful fallback responses.
 */

import { ipcMain, BrowserWindow } from 'electron';

// Spout state
let spoutModule: any = null;
let spoutSender: any = null;
let spoutEnabled = false;
let spoutSenderName = 'VisualSynth';

// NDI state
let ndiModule: any = null;
let ndiSender: any = null;
let ndiEnabled = false;
let ndiSenderName = 'VisualSynth';

/**
 * Try to load the Spout native module
 */
const tryLoadSpout = (): boolean => {
  if (spoutModule !== null) return spoutModule !== false;
  if (process.platform !== 'win32') {
    spoutModule = false;
    return false;
  }
  try {
    // Try to require electron-spout
    // This will fail if not installed, which is fine
    spoutModule = require('electron-spout');
    console.log('Spout module loaded successfully');
    return true;
  } catch (error) {
    console.log('Spout module not available:', (error as Error).message);
    spoutModule = false;
    return false;
  }
};

/**
 * Try to load the NDI native module
 */
const tryLoadNdi = (): boolean => {
  if (ndiModule !== null) return ndiModule !== false;
  try {
    // Try to require grandiose
    // This will fail if not installed, which is fine
    ndiModule = require('grandiose');
    console.log('NDI module (grandiose) loaded successfully');
    return true;
  } catch (error) {
    console.log('NDI module not available:', (error as Error).message);
    ndiModule = false;
    return false;
  }
};

/**
 * Register all Spout/NDI IPC handlers
 */
export const registerOutputIntegrationHandlers = (mainWindow: BrowserWindow): void => {
  // --- Spout Handlers ---

  ipcMain.handle('spout:is-available', () => {
    return tryLoadSpout();
  });

  ipcMain.handle('spout:enable', async (_event, senderName: string) => {
    if (!tryLoadSpout() || !spoutModule) return false;
    try {
      // Create Spout sender with the WebGL context from the renderer
      // Note: This requires electron-spout to be properly set up
      spoutSender = new spoutModule.SpoutSender(senderName);
      spoutSenderName = senderName;
      spoutEnabled = true;
      return true;
    } catch (error) {
      console.error('Failed to enable Spout:', error);
      return false;
    }
  });

  ipcMain.handle('spout:disable', async () => {
    if (spoutSender) {
      try {
        spoutSender.release?.();
      } catch (error) {
        console.error('Error releasing Spout sender:', error);
      }
      spoutSender = null;
    }
    spoutEnabled = false;
  });

  ipcMain.handle('spout:send-texture', async (_event, width: number, height: number) => {
    if (!spoutEnabled || !spoutSender) return;
    try {
      // In a full implementation, this would share the GL texture
      // For now, we'd need to get the texture from the renderer's GL context
      // This is complex in Electron and requires careful handling
      spoutSender.sendTexture?.(width, height);
    } catch (error) {
      // Silently fail on frame send errors
    }
  });

  ipcMain.handle('spout:get-status', () => {
    return {
      enabled: spoutEnabled,
      senderName: spoutSenderName,
      connectedReceivers: spoutSender?.getConnectedCount?.() ?? 0
    };
  });

  ipcMain.handle('spout:set-sender-name', async (_event, name: string) => {
    if (!spoutSender) return;
    try {
      spoutSender.setName?.(name);
      spoutSenderName = name;
    } catch (error) {
      console.error('Error setting Spout sender name:', error);
    }
  });

  // --- NDI Handlers ---

  ipcMain.handle('ndi:is-available', () => {
    return tryLoadNdi();
  });

  ipcMain.handle('ndi:enable', async (_event, config: { senderName: string; groups: string }) => {
    if (!tryLoadNdi() || !ndiModule) return false;
    try {
      // Create NDI sender
      ndiSender = await ndiModule.send({
        name: config.senderName,
        groups: config.groups || undefined
      });
      ndiSenderName = config.senderName;
      ndiEnabled = true;
      return true;
    } catch (error) {
      console.error('Failed to enable NDI:', error);
      return false;
    }
  });

  ipcMain.handle('ndi:disable', async () => {
    if (ndiSender) {
      try {
        await ndiSender.destroy?.();
      } catch (error) {
        console.error('Error destroying NDI sender:', error);
      }
      ndiSender = null;
    }
    ndiEnabled = false;
  });

  ipcMain.handle('ndi:send-frame', async (_event, frame: {
    data: ArrayBuffer;
    width: number;
    height: number;
    fourCC: string;
  }) => {
    if (!ndiEnabled || !ndiSender) return;
    try {
      // Send RGBA frame data over NDI
      await ndiSender.send({
        data: Buffer.from(frame.data),
        width: frame.width,
        height: frame.height,
        fourCC: frame.fourCC
      });
    } catch (error) {
      // Silently fail on frame send errors
    }
  });

  ipcMain.handle('ndi:get-status', () => {
    return {
      enabled: ndiEnabled,
      senderName: ndiSenderName,
      connectedReceivers: [] // NDI doesn't easily expose connected receivers
    };
  });

  ipcMain.handle('ndi:set-sender-name', async (_event, name: string) => {
    // NDI requires recreating the sender to change the name
    // For now, just update our stored name
    ndiSenderName = name;
  });
};

/**
 * Cleanup output integrations on app quit
 */
export const cleanupOutputIntegrations = async (): Promise<void> => {
  if (spoutSender) {
    try {
      spoutSender.release?.();
    } catch (error) {
      console.error('Error releasing Spout on cleanup:', error);
    }
    spoutSender = null;
  }
  if (ndiSender) {
    try {
      await ndiSender.destroy?.();
    } catch (error) {
      console.error('Error destroying NDI on cleanup:', error);
    }
    ndiSender = null;
  }
  spoutEnabled = false;
  ndiEnabled = false;
};
