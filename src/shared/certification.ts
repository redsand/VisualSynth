export type CertificationLevel = 'safe' | 'degraded' | 'unstable' | 'archived';

export interface CertificationMetadata {
  level: CertificationLevel;
  lastAuditAt: string;
  auditWarnings: string[];
  performanceScore: number; // 0-1
  visualScore: number; // 0-1
  stabilityScore: number; // 0-1
}

export const getCertificationColor = (level: CertificationLevel): string => {
  switch (level) {
    case 'safe': return '#4caf50'; // Green
    case 'degraded': return '#ff9800'; // Orange
    case 'unstable': return '#f44336'; // Red
    case 'archived': return '#9e9e9e'; // Grey
    default: return '#9e9e9e';
  }
};
