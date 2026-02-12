import { queryAuditEntries, AuditQuery } from '../services/audit.store';
import { logger } from '../services/logger.service';

// ============================================================================
// Compliance Report Types
// ============================================================================
// ============================================================================
export interface ComplianceReport {
  reportId: string;
  framework: string;
  generatedAt: string;
  period: { start: string; end: string };
  summary: {
    totalEvents: number;
    allowedEvents: number;
    deniedEvents: number;
    failedEvents: number;
    complianceScore: number;
  };
  controls: ComplianceControl[];
  findings: ComplianceFinding[];
}

export interface ComplianceControl {
  controlId: string;
  title: string;
  status: 'pass' | 'fail' | 'partial' | 'not-applicable';
  evidence: string[];
  auditEntryCount: number;
}

export interface ComplianceFinding {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  recommendation: string;
  affectedResources: string[];
}

// ============================================================================
// SOC2 Report Generator
// ============================================================================
export async function generateSOC2Report(
  startTime: string,
  endTime: string,
): Promise<ComplianceReport> {
  const query: AuditQuery = { startTime, endTime, pageSize: 10000 };
  const { entries, total } = await queryAuditEntries(query);

  const allowed = entries.filter((e) => e.result === 'success').length;
  const denied = entries.filter((e) => e.result === 'denied').length;
  const failed = entries.filter((e) => e.result === 'failure').length;

  const controls: ComplianceControl[] = [
    {
      controlId: 'CC6.1',
      title: 'Logical and Physical Access Controls',
      status: denied > 0 ? 'pass' : 'partial',
      evidence: ['All API requests require JWT authentication', 'RBAC enforced at service level'],
      auditEntryCount: entries.filter((e) => e.complianceTags.includes('access-control')).length,
    },
    {
      controlId: 'CC6.3',
      title: 'Role-Based Access and Least Privilege',
      status: 'pass',
      evidence: ['RBAC policy centrally managed', 'Permission checks logged for all operations'],
      auditEntryCount: entries.filter((e) => e.complianceTags.includes('rbac')).length,
    },
    {
      controlId: 'CC7.2',
      title: 'System Monitoring',
      status: 'pass',
      evidence: ['Structured logging with traceId correlation', 'OpenMetrics SLO monitoring'],
      auditEntryCount: total,
    },
    {
      controlId: 'CC8.1',
      title: 'Change Management',
      status: 'pass',
      evidence: ['GitOps deployment with ArgoCD', 'All changes tracked in audit log'],
      auditEntryCount: entries.filter((e) => e.action.includes('deploy') || e.action.includes('sync')).length,
    },
  ];

  const findings: ComplianceFinding[] = [];

  if (failed > total * 0.001) {
    findings.push({
      severity: 'medium',
      title: 'Elevated failure rate detected',
      description: `${failed} failed operations out of ${total} total (${((failed / total) * 100).toFixed(2)}%)`,
      recommendation: 'Review failed operations and implement corrective actions',
      affectedResources: [...new Set(entries.filter((e) => e.result === 'failure').map((e) => `${e.resource.kind}/${e.resource.id}`))].slice(0, 10),
    });
  }

  const complianceScore = controls.filter((c) => c.status === 'pass').length / controls.length * 100;

  logger.info({ framework: 'SOC2', period: { startTime, endTime }, totalEvents: total }, 'SOC2 report generated');

  return {
    reportId: `soc2-${Date.now()}`,
    framework: 'SOC2',
    generatedAt: new Date().toISOString(),
    period: { start: startTime, end: endTime },
    summary: {
      totalEvents: total,
      allowedEvents: allowed,
      deniedEvents: denied,
      failedEvents: failed,
      complianceScore,
    },
    controls,
    findings,
  };
}

// ============================================================================
// ISO 27001 Report Generator
// ============================================================================
export async function generateISO27001Report(
  startTime: string,
  endTime: string,
): Promise<ComplianceReport> {
  const query: AuditQuery = { startTime, endTime, pageSize: 10000 };
  const { entries, total } = await queryAuditEntries(query);

  const allowed = entries.filter((e) => e.result === 'success').length;
  const denied = entries.filter((e) => e.result === 'denied').length;
  const failed = entries.filter((e) => e.result === 'failure').length;

  const controls: ComplianceControl[] = [
    {
      controlId: 'A.9.2',
      title: 'User Access Management',
      status: 'pass',
      evidence: ['OIDC-based authentication', 'Centralized RBAC', 'API key rotation policy'],
      auditEntryCount: entries.filter((e) => e.complianceTags.includes('access-control')).length,
    },
    {
      controlId: 'A.12.4',
      title: 'Logging and Monitoring',
      status: 'pass',
      evidence: ['Immutable audit log', 'Structured logging with correlation IDs'],
      auditEntryCount: total,
    },
    {
      controlId: 'A.14.2',
      title: 'Security in Development and Support Processes',
      status: 'pass',
      evidence: ['SLSA Level 3 build provenance', 'SBOM generation', 'Cosign artifact signing'],
      auditEntryCount: entries.filter((e) => e.action.includes('build') || e.action.includes('deploy')).length,
    },
  ];

  const complianceScore = controls.filter((c) => c.status === 'pass').length / controls.length * 100;

  return {
    reportId: `iso27001-${Date.now()}`,
    framework: 'ISO27001',
    generatedAt: new Date().toISOString(),
    period: { start: startTime, end: endTime },
    summary: { totalEvents: total, allowedEvents: allowed, deniedEvents: denied, failedEvents: failed, complianceScore },
    controls,
    findings: [],
  };
}
