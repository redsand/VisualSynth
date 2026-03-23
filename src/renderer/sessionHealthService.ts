import { SessionHealth, HealthStatus } from '../shared/sessionHealth';
import { MilkwaveRuntimeStatus } from '../shared/milkwaveStatus';
import { SongDetectionState, SongDetectionDiagnostics } from '../shared/songDetectionStatus';

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
      fxHealth: {
        bloom: true,
        radialGravity: true,
        motionEcho: true,
        spectralSmear: true,
        sdf: true,
        particles: true
      },
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
    // Rolling average
    this.health.avgFps = this.health.avgFps * 0.95 + fps * 0.05;
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

  updateSongDetection(status: SongDetectionState, diagnostics?: SongDetectionDiagnostics) {
    this.health.songDetectionStatus = status;
    if (diagnostics) {
      this.health.songDetectionDiagnostics = diagnostics;
    }
    this.updateStatus();
    this.notify();
  }

  updateFxHealth(fx: Partial<SessionHealth['fxHealth']>) {
    this.health.fxHealth = { ...this.health.fxHealth, ...fx };
    this.updateStatus();
    this.notify();
  }

  setPreset(presetId: string, sceneId?: string) {
    this.health.activePresetId = presetId;
    this.health.activeSceneId = sceneId;
    this.notify();
  }

  incrementAssetWarnings() {
    this.health.assetWarningCount++;
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
    this.health.failedReason = message;
    this.notify();
  }

  private updateStatus() {
    let status: HealthStatus = 'nominal';
    let degradedReasons: string[] = [];
    let failedReasons: string[] = [];

    // Critical failures
    if (this.health.fps < 20) failedReasons.push('FPS critically low');
    if (this.health.milkwaveStatus === 'failed') failedReasons.push('Milkwave engine failed');
    if (this.health.songDetectionStatus === 'failed') failedReasons.push('Audio detection failed');
    
    // Check if any core FX are failing
    if (!this.health.fxHealth.sdf && !this.health.fxHealth.particles) {
      failedReasons.push('Core render engines failed');
    }

    if (failedReasons.length > 0) {
      status = 'critical';
      this.health.failedReason = failedReasons.join(', ');
    } else {
      // Degraded states
      if (this.health.fps < 45) degradedReasons.push('FPS dropped');
      if (this.health.milkwaveStatus === 'fallback') degradedReasons.push('Milkwave in fallback mode');
      if (this.health.milkwaveStatus === 'degraded') degradedReasons.push('Milkwave degraded');
      if (this.health.assetWarningCount > 5) degradedReasons.push('Multiple asset load failures');
      if (Object.values(this.health.fxHealth).some(v => !v)) degradedReasons.push('Some FX disabled/failed');

      if (degradedReasons.length > 0) {
        status = 'degraded';
        this.health.degradedReason = degradedReasons.join(', ');
      } else {
        this.health.degradedReason = undefined;
        this.health.failedReason = undefined;
      }
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
