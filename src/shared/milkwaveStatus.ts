import type { MilkwaveShaderDiagnostics } from './milkwaveDiagnostics';

export type MilkwaveRuntimeStatus = 'success' | 'degraded' | 'fallback' | 'failed';
export type MilkwaveProofStepId =
  | 'compile-warp'
  | 'compile-comp'
  | 'render-activity'
  | 'no-fallback'
  | 'no-errors';

export interface MilkwaveProofStep {
  id: MilkwaveProofStepId;
  label: string;
  passed: boolean;
  details: string;
}

export interface MilkwaveAuditProof {
  proven: boolean;
  fallbackReached: boolean;
  visibleActivity: boolean;
  stepCount: number;
  passedStepCount: number;
  steps: MilkwaveProofStep[];
}

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
  proof: MilkwaveAuditProof;
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
