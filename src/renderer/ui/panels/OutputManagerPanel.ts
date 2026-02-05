/**
 * Output Manager Panel
 *
 * UI panel for managing Spout/NDI output integrations.
 * Provides enable toggles, sender names, and status indicators.
 */

import type { Store } from '../../state/store';
import { setStatus } from '../../state/events';

// ============================================================================
// Types
// ============================================================================

export interface OutputManagerPanelApi {
  /** Refresh panel state from current output status */
  refresh: () => Promise<void>;
  /** Get current panel container element */
  getContainer: () => HTMLElement;
}

export interface OutputManagerPanelDeps {
  store: Store;
}

// ============================================================================
// Panel Implementation
// ============================================================================

export const createOutputManagerPanel = ({ store }: OutputManagerPanelDeps): OutputManagerPanelApi => {
  // Create panel container
  const container = document.createElement('div');
  container.id = 'output-manager-panel';
  container.className = 'panel output-manager-panel';

  // State
  let spoutAvailable = false;
  let spoutEnabled = false;
  let spoutSenderName = 'VisualSynth';
  let spoutReceivers = 0;

  let ndiAvailable = false;
  let ndiEnabled = false;
  let ndiSenderName = 'VisualSynth';

  // ============================================================================
  // Build UI
  // ============================================================================

  const buildUI = () => {
    container.innerHTML = `
      <div class="panel-header">
        <h3>VJ Output Integration</h3>
        <span class="panel-subtitle">Stream visuals to external software</span>
      </div>

      <div class="output-section spout-section">
        <div class="section-header">
          <span class="section-icon">📺</span>
          <h4>Spout Output</h4>
          <span class="platform-badge">Windows</span>
        </div>

        <div class="output-status" id="spout-status">
          <span class="status-indicator unavailable"></span>
          <span class="status-text">Checking availability...</span>
        </div>

        <div class="output-controls" id="spout-controls">
          <div class="control-row">
            <label class="toggle-label">
              <input type="checkbox" id="spout-enabled" disabled />
              <span>Enable Spout</span>
            </label>
          </div>

          <div class="control-row">
            <label>Sender Name</label>
            <input type="text" id="spout-sender-name" value="VisualSynth" disabled />
          </div>

          <div class="control-row receivers-row">
            <span class="receivers-label">Connected Receivers:</span>
            <span class="receivers-count" id="spout-receivers">0</span>
          </div>
        </div>
      </div>

      <div class="output-section ndi-section">
        <div class="section-header">
          <span class="section-icon">🌐</span>
          <h4>NDI Output</h4>
          <span class="platform-badge">Cross-platform</span>
        </div>

        <div class="output-status" id="ndi-status">
          <span class="status-indicator unavailable"></span>
          <span class="status-text">Checking availability...</span>
        </div>

        <div class="output-controls" id="ndi-controls">
          <div class="control-row">
            <label class="toggle-label">
              <input type="checkbox" id="ndi-enabled" disabled />
              <span>Enable NDI</span>
            </label>
          </div>

          <div class="control-row">
            <label>Sender Name</label>
            <input type="text" id="ndi-sender-name" value="VisualSynth" disabled />
          </div>

          <div class="control-row">
            <label>Groups (optional)</label>
            <input type="text" id="ndi-groups" placeholder="e.g., Public, Local" disabled />
          </div>
        </div>
      </div>

      <div class="output-info">
        <p>
          <strong>Spout</strong> shares GPU textures with apps like Resolume, TouchDesigner, and OBS (with Spout plugin).
        </p>
        <p>
          <strong>NDI</strong> streams video over network to apps like OBS, vMix, and other NDI-compatible software.
        </p>
        <p class="install-note">
          Note: These features require optional native modules. Install them with:<br/>
          <code>npm install electron-spout grandiose</code>
        </p>
      </div>
    `;

    // Get references to elements
    const spoutStatus = container.querySelector('#spout-status') as HTMLDivElement;
    const spoutEnabledCheckbox = container.querySelector('#spout-enabled') as HTMLInputElement;
    const spoutSenderNameInput = container.querySelector('#spout-sender-name') as HTMLInputElement;
    const spoutReceiversSpan = container.querySelector('#spout-receivers') as HTMLSpanElement;

    const ndiStatus = container.querySelector('#ndi-status') as HTMLDivElement;
    const ndiEnabledCheckbox = container.querySelector('#ndi-enabled') as HTMLInputElement;
    const ndiSenderNameInput = container.querySelector('#ndi-sender-name') as HTMLInputElement;
    const ndiGroupsInput = container.querySelector('#ndi-groups') as HTMLInputElement;

    // ============================================================================
    // Event Handlers
    // ============================================================================

    // Spout enable toggle
    spoutEnabledCheckbox.addEventListener('change', async () => {
      if (spoutEnabledCheckbox.checked) {
        const name = spoutSenderNameInput.value || 'VisualSynth';
        const success = await window.visualSynth.spoutEnable(name);
        if (success) {
          spoutEnabled = true;
          spoutSenderName = name;
          setStatus(`Spout enabled: ${name}`);
          updateSpoutStatus();
        } else {
          spoutEnabledCheckbox.checked = false;
          setStatus('Failed to enable Spout');
        }
      } else {
        await window.visualSynth.spoutDisable();
        spoutEnabled = false;
        setStatus('Spout disabled');
        updateSpoutStatus();
      }
    });

    // Spout sender name change
    spoutSenderNameInput.addEventListener('change', async () => {
      if (spoutEnabled) {
        const name = spoutSenderNameInput.value || 'VisualSynth';
        await window.visualSynth.spoutSetSenderName(name);
        spoutSenderName = name;
        setStatus(`Spout sender name: ${name}`);
      }
    });

    // NDI enable toggle
    ndiEnabledCheckbox.addEventListener('change', async () => {
      if (ndiEnabledCheckbox.checked) {
        const name = ndiSenderNameInput.value || 'VisualSynth';
        const groups = ndiGroupsInput.value || '';
        const success = await window.visualSynth.ndiEnable({ senderName: name, groups });
        if (success) {
          ndiEnabled = true;
          ndiSenderName = name;
          setStatus(`NDI enabled: ${name}`);
          updateNdiStatus();
        } else {
          ndiEnabledCheckbox.checked = false;
          setStatus('Failed to enable NDI');
        }
      } else {
        await window.visualSynth.ndiDisable();
        ndiEnabled = false;
        setStatus('NDI disabled');
        updateNdiStatus();
      }
    });

    // NDI sender name change
    ndiSenderNameInput.addEventListener('change', async () => {
      if (ndiEnabled) {
        const name = ndiSenderNameInput.value || 'VisualSynth';
        await window.visualSynth.ndiSetSenderName(name);
        ndiSenderName = name;
        setStatus(`NDI sender name: ${name}`);
      }
    });

    // ============================================================================
    // Status Update Functions
    // ============================================================================

    const updateSpoutStatus = () => {
      const indicator = spoutStatus.querySelector('.status-indicator') as HTMLSpanElement;
      const text = spoutStatus.querySelector('.status-text') as HTMLSpanElement;

      indicator.className = 'status-indicator';

      if (!spoutAvailable) {
        indicator.classList.add('unavailable');
        text.textContent = 'Not available (install electron-spout)';
        spoutEnabledCheckbox.disabled = true;
        spoutSenderNameInput.disabled = true;
      } else if (spoutEnabled) {
        indicator.classList.add('active');
        text.textContent = `Active: ${spoutSenderName}`;
        spoutEnabledCheckbox.disabled = false;
        spoutEnabledCheckbox.checked = true;
        spoutSenderNameInput.disabled = false;
      } else {
        indicator.classList.add('available');
        text.textContent = 'Available - click to enable';
        spoutEnabledCheckbox.disabled = false;
        spoutEnabledCheckbox.checked = false;
        spoutSenderNameInput.disabled = false;
      }

      spoutReceiversSpan.textContent = String(spoutReceivers);
    };

    const updateNdiStatus = () => {
      const indicator = ndiStatus.querySelector('.status-indicator') as HTMLSpanElement;
      const text = ndiStatus.querySelector('.status-text') as HTMLSpanElement;

      indicator.className = 'status-indicator';

      if (!ndiAvailable) {
        indicator.classList.add('unavailable');
        text.textContent = 'Not available (install grandiose)';
        ndiEnabledCheckbox.disabled = true;
        ndiSenderNameInput.disabled = true;
        ndiGroupsInput.disabled = true;
      } else if (ndiEnabled) {
        indicator.classList.add('active');
        text.textContent = `Active: ${ndiSenderName}`;
        ndiEnabledCheckbox.disabled = false;
        ndiEnabledCheckbox.checked = true;
        ndiSenderNameInput.disabled = false;
        ndiGroupsInput.disabled = false;
      } else {
        indicator.classList.add('available');
        text.textContent = 'Available - click to enable';
        ndiEnabledCheckbox.disabled = false;
        ndiEnabledCheckbox.checked = false;
        ndiSenderNameInput.disabled = false;
        ndiGroupsInput.disabled = false;
      }
    };

    // Store update functions for refresh
    (container as any)._updateSpoutStatus = updateSpoutStatus;
    (container as any)._updateNdiStatus = updateNdiStatus;
  };

  // Build initial UI
  buildUI();

  // ============================================================================
  // API
  // ============================================================================

  const refresh = async () => {
    try {
      // Check Spout availability
      spoutAvailable = await window.visualSynth.spoutIsAvailable();
      if (spoutAvailable) {
        const status = await window.visualSynth.spoutGetStatus();
        spoutEnabled = status.enabled;
        spoutSenderName = status.senderName;
        spoutReceivers = status.connectedReceivers ?? 0;
      }

      // Check NDI availability
      ndiAvailable = await window.visualSynth.ndiIsAvailable();
      if (ndiAvailable) {
        const status = await window.visualSynth.ndiGetStatus();
        ndiEnabled = status.enabled;
        ndiSenderName = status.senderName;
      }

      // Update UI
      const updateSpoutStatus = (container as any)._updateSpoutStatus;
      const updateNdiStatus = (container as any)._updateNdiStatus;
      if (updateSpoutStatus) updateSpoutStatus();
      if (updateNdiStatus) updateNdiStatus();
    } catch (error) {
      console.error('[OutputManagerPanel] Error refreshing status:', error);
    }
  };

  const getContainer = () => container;

  return {
    refresh,
    getContainer
  };
};

// ============================================================================
// Styles (inject into document)
// ============================================================================

export const injectOutputManagerStyles = () => {
  const styleId = 'output-manager-styles';
  if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    .output-manager-panel {
      padding: 16px;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 8px;
      margin: 8px 0;
    }

    .output-manager-panel .panel-header {
      margin-bottom: 16px;
    }

    .output-manager-panel .panel-header h3 {
      margin: 0 0 4px 0;
      font-size: 14px;
      color: #fff;
    }

    .output-manager-panel .panel-subtitle {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.5);
    }

    .output-section {
      background: rgba(255, 255, 255, 0.05);
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 12px;
    }

    .section-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
    }

    .section-header h4 {
      margin: 0;
      font-size: 13px;
      flex-grow: 1;
    }

    .section-icon {
      font-size: 16px;
    }

    .platform-badge {
      font-size: 10px;
      padding: 2px 6px;
      background: rgba(100, 100, 255, 0.3);
      border-radius: 4px;
      color: rgba(255, 255, 255, 0.7);
    }

    .output-status {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 4px;
      margin-bottom: 12px;
    }

    .status-indicator {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }

    .status-indicator.unavailable {
      background: #666;
    }

    .status-indicator.available {
      background: #4a9;
    }

    .status-indicator.active {
      background: #4f4;
      box-shadow: 0 0 8px #4f4;
    }

    .status-text {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.8);
    }

    .output-controls {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .control-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .control-row label {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.6);
      min-width: 80px;
    }

    .toggle-label {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
    }

    .toggle-label input[type="checkbox"] {
      width: 16px;
      height: 16px;
    }

    .toggle-label span {
      font-size: 12px;
      color: #fff;
    }

    .control-row input[type="text"] {
      flex: 1;
      padding: 4px 8px;
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      color: #fff;
      font-size: 11px;
    }

    .control-row input[type="text"]:disabled {
      opacity: 0.5;
    }

    .receivers-row {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.5);
    }

    .receivers-count {
      font-weight: bold;
      color: #4f4;
    }

    .output-info {
      margin-top: 16px;
      padding: 12px;
      background: rgba(255, 255, 255, 0.03);
      border-radius: 6px;
    }

    .output-info p {
      font-size: 10px;
      color: rgba(255, 255, 255, 0.5);
      margin: 0 0 8px 0;
      line-height: 1.4;
    }

    .output-info p:last-child {
      margin-bottom: 0;
    }

    .output-info code {
      background: rgba(0, 0, 0, 0.3);
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 10px;
    }

    .install-note {
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      padding-top: 8px !important;
      margin-top: 8px;
    }
  `;
  document.head.appendChild(style);
};
