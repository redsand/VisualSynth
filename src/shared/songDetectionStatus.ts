export type SongDetectionState = 
  | 'idle' 
  | 'initializing' 
  | 'listening' 
  | 'analyzing' 
  | 'detected' 
  | 'cooldown' 
  | 'degraded' 
  | 'failed';

export interface SongDetectionStatus {
  state: SongDetectionState;
  enteredAt: number;
  lastUpdateAt: number;
  reason?: string;
  lastError?: string;
  details?: {
    confidence?: number;
    lastDetectionTime?: number;
    cooldownRemainingMs?: number;
    bufferHealth?: number; // 0-1
    activeChunks?: number;
    totalBytes?: number;
  };
}

export interface SongDetectionDiagnostics {
  status: SongDetectionStatus;
  captureActive: boolean;
  streamActive: boolean;
  deviceId: string | null;
  settings: {
    enabled: boolean;
    minTrackMs: number;
    changeThreshold: number;
    cooldownMs: number;
  };
  metrics: {
    totalDetections: number;
    failedDetections: number;
    lastSuccessAt?: number;
    lastFailureAt?: number;
  };
}
