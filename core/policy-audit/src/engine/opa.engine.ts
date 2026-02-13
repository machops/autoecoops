import { config } from '../config';
import { logger } from '../services/logger.service';
import type { PolicyDecision, PolicyVerdict } from '@autoecops/shared-types';

// ============================================================================
// OPA Policy Evaluation
// ============================================================================
export interface PolicyInput {
  actor: { id: string; type: string; roles: string[] };
  resource: { kind: string; id: string; namespace?: string };
  action: string;
  context?: Record<string, unknown>;
}

export interface OPAResponse {
  result: {
    allow: boolean;
    violations?: string[];
    warnings?: string[];
    compliance_tags?: string[];
  };
}

export async function evaluatePolicy(
  policyPath: string,
  input: PolicyInput,
): Promise<PolicyDecision> {
  const url = `${config.OPA_URL}${config.OPA_POLICY_PATH}/${policyPath}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input }),
    });

    if (!response.ok) {
      throw new Error(`OPA returned ${response.status}: ${await response.text()}`);
    }

    const data = (await response.json()) as OPAResponse;
    const result = data.result;

    let verdict: PolicyVerdict = 'deny';
    if (result.allow) {
      verdict = result.warnings && result.warnings.length > 0 ? 'warn' : 'allow';
    }

    return {
      verdict,
      policyId: policyPath,
      policyVersion: config.VERSION,
      reason: result.allow
        ? (result.warnings?.join('; ') ?? 'Policy evaluation passed')
        : (result.violations?.join('; ') ?? 'Policy evaluation denied'),
      complianceTags: result.compliance_tags ?? [],
      evaluatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error({ error, policyPath }, 'OPA evaluation failed');

    // Fail-closed: deny on error
    return {
      verdict: 'deny',
      policyId: policyPath,
      policyVersion: config.VERSION,
      reason: `Policy evaluation error: ${error instanceof Error ? error.message : 'unknown'}`,
      complianceTags: [],
      evaluatedAt: new Date().toISOString(),
    };
  }
}

// ============================================================================
// Built-in Policy Evaluator (fallback when OPA is unavailable)
// ============================================================================
export function evaluateBuiltinPolicy(input: PolicyInput): PolicyDecision {
  const { actor, action } = input;

  // Basic deny-by-default policy
  const adminActions = ['delete', 'rollback', 'policy:write'];
  const operatorActions = ['execute', 'sync', 'deploy'];

  let verdict: PolicyVerdict = 'deny';
  let reason = 'No matching policy rule';

  if (actor.roles.includes('platform-admin')) {
    verdict = 'allow';
    reason = 'Admin role grants full access';
  } else if (actor.roles.includes('platform-operator') && !adminActions.includes(action)) {
    verdict = operatorActions.includes(action) ? 'allow' : 'warn';
    reason = verdict === 'allow' ? 'Operator role grants operational access' : 'Action requires review';
  } else if (actor.roles.includes('platform-viewer') && action === 'read') {
    verdict = 'allow';
    reason = 'Viewer role grants read access';
  }

  return {
    verdict,
    policyId: 'builtin-rbac',
    policyVersion: '1.0.0',
    reason,
    complianceTags: ['rbac', 'access-control'],
    evaluatedAt: new Date().toISOString(),
  };
}
