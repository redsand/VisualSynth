import type { MilkwaveShaderDiagnostics } from './milkwaveDiagnostics';

export type MilkwaveRuntimeStatus = 'success' | 'degraded' | 'fallback' | 'failed';

export interface MilkwaveAuditReport {
  id: string;
  name: string;
  classification: 'native-supported' | 'supported-with-degradation' | 'fallback-only' | 'runtime-failed';
  warpCompiled: boolean;
  compCompiled: boolean;
  fallbackUsed: boolean;
  shapesRendered: number;
  wavesRendered: number;
  errors: string[];
  warnings: string[];
  auditAt: string;
}

export interface MilkDropCompileReportPass {
  requested: boolean;
  status: MilkwaveRuntimeStatus;
  diagnostics: MilkwaveShaderDiagnostics;
  patchedDiagnostics?: MilkwaveShaderDiagnostics;
  compiled: boolean;
  fallbackUsed: boolean;
  error?: string;
  linkError?: string;
}

export interface MilkDropCompileReport {
  warp: MilkDropCompileReportPass;
  comp: MilkDropCompileReportPass;
}
