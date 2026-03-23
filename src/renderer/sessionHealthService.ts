import { SessionHealth, HealthStatus } from '../shared/sessionHealth';
import { MilkwaveRuntimeStatus } from '../shared/milkwaveStatus';
import { SongDetectionState } from '../shared/songDetectionStatus';

class SessionHealthService {
  private health: SessionHealth;
  private listeners: Array<(health: SessionHealth) => void> = [];

  constructor() {
    this.health = {
      status: 'nominal',
      fps: 60,
      avgFps: 60,
      droppedFrames: 0,
      frameTimeMs: 16.6,
      milkwaveStatus: 'success',
      songDetectionStatus: 'idle',
      assetWarningCount: 0,
      startTime: new Date().toISOString(),
      uptimeSeconds: 0
    };

    setInterval(() => {
      this.health.uptimeSeconds = Math.floor(
        (Date.now() - new Date(this.health.startTime).getTime()) / 1000
      );
      this.notify();
    }, 1000);
  }

  getHealth(): SessionHealth {
    return { ...this.health };
  }

  updateFps(fps: number, frameTimeMs: number) {
    this.health.fps = fps;
    this.health.frameTimeMs = frameTimeMs;
    this.updateStatus();
    this.notify();
  }

  reportDroppedFrame() {
    this.health.droppedFrames++;
    this.updateStatus();
    this.notify();
  }

  updateMilkwaveStatus(status: MilkwaveRuntimeStatus) {
    this.health.milkwaveStatus = status;
    this.updateStatus();
    this.notify();
  }

  updateSongDetectionStatus(status: SongDetectionState) {
    this.health.songDetectionStatus = status;
    this.updateStatus();
    this.notify();
  }

  reportError(message: string, stack?: string) {
    this.health.lastError = {
      message,
      stack,
      timestamp: new Date().toISOString()
    };
    this.health.status = 'critical';
    this.notify();
  }

  private updateStatus() {
    let status: HealthStatus = 'nominal';

    if (this.health.fps < 30 || this.health.milkwaveStatus === 'failed' || this.health.milkwaveStatus === 'fallback') {
      status = 'critical';
    } else if (this.health.fps < 50 || this.health.milkwaveStatus === 'degraded' || this.health.assetWarningCount > 0) {
      status = 'degraded';
    }

    this.health.status = status;
  }

  subscribe(listener: (health: SessionHealth) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l(this.health));
  }
}

export const sessionHealthService = new SessionHealthService();
