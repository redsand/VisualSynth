import fs from 'fs';
import path from 'path';
import type { MilkwaveAuditReport } from '../src/shared/milkwaveStatus';

const PRESETS_DIR = path.resolve(__dirname, '../assets/presets');
const REPORT_JSON = path.join(PRESETS_DIR, 'milkwave_audit_report.json');
const CERT_REPORT_JSON = path.join(PRESETS_DIR, 'milkwave_certification_report.json');
const CERT_SUMMARY_MD = path.join(PRESETS_DIR, 'milkwave_certification_summary.md');

interface CertificationResult {
  id: string;
  name: string;
  certificationStatus: 'certified-safe' | 'degraded-usable' | 'broken-archive';
  scores: {
    compile: number; // 0-1
    stability: number; // 0-1
    completeness: number; // 0-1
  };
  reasons: string[];
  proofPassed: boolean;
  proofFailedSteps: string[];
}

function calculateScores(report: MilkwaveAuditReport) {
  let compile = 0;
  if (report.warpCompiled) compile += 0.5;
  if (report.compCompiled) compile += 0.5;
  if (report.errors.length > 0) compile *= 0.5;

  let stability = 1.0;
  if (report.classification === 'runtime-failed') stability = 0;
  if (report.errors.some(e => e.includes('link') || e.includes('memory'))) stability *= 0.2;

  let completeness = 0.5; // base
  if (report.classification === 'native-supported') completeness = 1.0;
  if (report.fallbackUsed) completeness *= 0.7;
  if (report.shapesRendered > 0) completeness += 0.1;
  if (report.wavesRendered > 0) completeness += 0.1;
  completeness = Math.min(1.0, completeness);

  return { compile, stability, completeness };
}

function certify() {
  if (!fs.existsSync(REPORT_JSON)) {
    console.error(`Audit report not found at ${REPORT_JSON}. Please run audit-milkwave first.`);
    process.exit(1);
  }

  const auditData = JSON.parse(fs.readFileSync(REPORT_JSON, 'utf-8'));
  const results: CertificationResult[] = [];

  for (const report of auditData.results as (MilkwaveAuditReport & { expectedSupport: string })[]) {
    const scores = calculateScores(report);
    const reasons: string[] = [];
    const proofPassed = report.proof?.proven ?? false;
    const proofFailedSteps = (report.proof?.steps ?? [])
      .filter(step => !step.passed)
      .map(step => step.id);

    let status: 'certified-safe' | 'degraded-usable' | 'broken-archive' = 'broken-archive';

    if (proofPassed && report.classification === 'native-supported' && !report.fallbackUsed && report.errors.length === 0) {
      status = 'certified-safe';
    } else if (report.classification === 'runtime-failed') {
      status = 'broken-archive';
      reasons.push(...report.errors);
    } else {
      status = 'degraded-usable';
      if (report.fallbackUsed) reasons.push('Fallback used for some features');
      if (report.errors.length > 0) reasons.push(...report.errors);
    }
    if (!proofPassed) {
      reasons.push(`Proof failed: ${proofFailedSteps.join(', ') || 'unknown-steps'}`);
    }

    results.push({
      id: report.id,
      name: report.name,
      certificationStatus: status,
      scores,
      reasons,
      proofPassed,
      proofFailedSteps
    });
  }

  const certificationReport = {
    timestamp: new Date().toISOString(),
    selection: auditData.selection ?? null,
    stats: {
      total: results.length,
      certifiedSafe: results.filter(r => r.certificationStatus === 'certified-safe').length,
      degradedUsable: results.filter(r => r.certificationStatus === 'degraded-usable').length,
      brokenArchive: results.filter(r => r.certificationStatus === 'broken-archive').length,
    },
    results
  };

  fs.writeFileSync(CERT_REPORT_JSON, JSON.stringify(certificationReport, null, 2));

  // Markdown Summary
  let md = `# Milkwave Certification Report\n\n`;
  md += `**Date**: ${certificationReport.timestamp}\n`;
  md += `**Total Presets**: ${certificationReport.stats.total}\n`;
  if (certificationReport.selection?.mode === 'pack') {
    md += `**Pack**: ${certificationReport.selection.pack}\n`;
    md += `**Pack Size**: ${certificationReport.selection.packSize}\n`;
  }
  md += `\n`;

  md += `## Summary\n\n`;
  md += `| Status | Count | Description |\n`;
  md += `| :--- | :--- | :--- |\n`;
  md += `| **Certified Safe** | ${certificationReport.stats.certifiedSafe} | Native support, no errors, no fallback. High stability. |\n`;
  md += `| **Degraded Usable** | ${certificationReport.stats.degradedUsable} | Functional but with fallbacks or minor issues. |\n`;
  md += `| **Broken/Archive** | ${certificationReport.stats.brokenArchive} | Critical failures or missing features. Not club-safe. |\n\n`;

  md += `## Certified Safe Presets ✅\n\n`;
  results.filter(r => r.certificationStatus === 'certified-safe').forEach(r => {
    md += `- **${r.name}** (${r.id}) - Score: ${((r.scores.compile + r.scores.stability + r.scores.completeness) / 3).toFixed(2)}\n`;
  });

  md += `\n## Proof Failures ⚠️\n\n`;
  results.filter(r => !r.proofPassed).forEach(r => {
    md += `- **${r.name}** (${r.id}) - Failed steps: ${r.proofFailedSteps.join(', ') || 'unknown'}\n`;
  });

  md += `\n## Broken / Archive Candidates ❌\n\n`;
  results.filter(r => r.certificationStatus === 'broken-archive').forEach(r => {
    md += `- **${r.name}** (${r.id}) - Reasons: ${r.reasons.join(', ')}\n`;
  });

  fs.writeFileSync(CERT_SUMMARY_MD, md);

  console.log(`Certification complete. Results written to ${CERT_REPORT_JSON} and ${CERT_SUMMARY_MD}`);

  // Update preset metadata if they exist
  for (const res of results) {
    const presetPath = path.join(PRESETS_DIR, `${res.id}.json`);
    if (fs.existsSync(presetPath)) {
      const content = JSON.parse(fs.readFileSync(presetPath, 'utf-8'));
      if (content.metadata) {
        content.metadata.milkwave = {
          ...content.metadata.milkwave,
          certificationStatus: res.certificationStatus,
          lastCertifiedAt: certificationReport.timestamp,
          qualityScores: res.scores,
          proofPassed: res.proofPassed,
          proofFailedSteps: res.proofFailedSteps
        };
        fs.writeFileSync(presetPath, JSON.stringify(content, null, 2));
      }
    }
  }
}

certify();
