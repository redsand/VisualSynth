import type { MilkwaveRuntimeStatus } from './milkwaveStatus';
import type { SongDetectionState } from './songDetectionStatus';

export type HealthStatus = 'nominal' | 'degraded' | 'critical';

export interface SessionHealth {
  status: HealthStatus;
  fps: number;
  avgFps: number;
  droppedFrames: number;
  frameTimeMs: number;
  gpuTimeMs?: number;
  
  cpuUsage?: number;
  memoryUsageMB?: number;
  
  activePresetId?: string;
  activeSceneId?: string;
  
  milkwaveStatus: MilkwaveRuntimeStatus;
  songDetectionStatus: SongDetectionState;
  
  assetWarningCount: number;
  lastError?: {
    message: string;
    timestamp: string;
    stack?: string;
  };
  
  startTime: string;
  uptimeSeconds: number;
}

export const getHealthColor = (status: HealthStatus): string => {
  switch (status) {
    case 'nominal': return '#4caf50';
    case 'degraded': return '#ff9800';
    case 'critical': return '#f44336';
    default: return '#9e9e9e';
  }
};
