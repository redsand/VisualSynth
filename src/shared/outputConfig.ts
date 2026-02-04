/**
 * Output Integration Types
 *
 * Configuration for Spout and NDI output integrations
 */

export interface SpoutOutputConfig {
  enabled: boolean;
  senderName: string;
}

export interface NdiOutputConfig {
  enabled: boolean;
  senderName: string;
  groups: string;
}

export interface OutputIntegrationConfig {
  spout: SpoutOutputConfig;
  ndi: NdiOutputConfig;
}

export interface OutputIntegrationStatus {
  spout: {
    available: boolean;
    enabled: boolean;
    senderName: string;
    connectedReceivers: number;
  };
  ndi: {
    available: boolean;
    enabled: boolean;
    senderName: string;
    connectedReceivers: string[];
  };
}

export const DEFAULT_OUTPUT_INTEGRATION_CONFIG: OutputIntegrationConfig = {
  spout: {
    enabled: false,
    senderName: 'VisualSynth'
  },
  ndi: {
    enabled: false,
    senderName: 'VisualSynth',
    groups: ''
  }
};
