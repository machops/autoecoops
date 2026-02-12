import { logger } from '../middleware/logger';
import { config } from '../config';
import type { Actor, PolicyVerdict } from '@autoecops/shared-types';

// ============================================================================
// RBAC Role & Permission Definitions
// ============================================================================
interface RoleDefinition {
  name: string;
  permissions: string[];
  inherits?: string[];
}

interface RBACPolicy {
  roles: Record<string, RoleDefinition>;
  lastSyncedAt: string;
  version: string;
}

const DEFAULT_RBAC_POLICY: RBACPolicy = {
  roles: {
    'platform-admin': {
      name: 'Platform Administrator',
      permissions: [
        'platform:*',
        'audit:read',
        'audit:export',
        'infra:read',
        'infra:sync',
        'infra:rollback',
        'policy:read',
        'policy:write',
      ],
    },
    'platform-operator': {
      name: 'Platform Operator',
      permissions: [
        'platform:read',
        'platform:execute',
        'audit:read',
        'infra:read',
        'infra:sync',
        'policy:read',
      ],
    },
    'platform-viewer': {
      name: 'Platform Viewer',
      permissions: [
        'platform:read',
        'audit:read',
        'infra:read',
        'policy:read',
      ],
    },
    'service-account': {
      name: 'Service Account',
      permissions: [
        'platform:execute',
        'event:publish',
        'event:subscribe',
        'memory:read',
        'memory:write',
        'audit:write',
      ],
    },
  },
  lastSyncedAt: new Date().toISOString(),
  version: '1.0.0',
};

let currentPolicy: RBACPolicy = DEFAULT_RBAC_POLICY;
let syncInterval: NodeJS.Timeout | null = null;

// ============================================================================
// RBAC Evaluation
// ============================================================================
function resolvePermissions(roles: string[]): Set<string> {
  const permissions = new Set<string>();

  for (const roleName of roles) {
    const role = currentPolicy.roles[roleName];
    if (!role) {
      logger.warn({ role: roleName }, 'Unknown role referenced');
      continue;
    }

    for (const perm of role.permissions) {
      permissions.add(perm);
    }

    if (role.inherits) {
      const inherited = resolvePermissions(role.inherits);
      for (const perm of inherited) {
        permissions.add(perm);
      }
    }
  }

  return permissions;
}

function matchPermission(required: string, granted: string): boolean {
  if (granted === '*') return true;
  if (granted === required) return true;

  const grantedParts = granted.split(':');
  const requiredParts = required.split(':');

  for (let i = 0; i < grantedParts.length; i++) {
    if (grantedParts[i] === '*') return true;
    if (grantedParts[i] !== requiredParts[i]) return false;
  }

  return grantedParts.length === requiredParts.length;
}

export function checkPermission(actor: Actor, requiredPermission: string): PolicyVerdict {
  const grantedPermissions = resolvePermissions(actor.roles);

  for (const granted of grantedPermissions) {
    if (matchPermission(requiredPermission, granted)) {
      return 'allow';
    }
  }

  logger.info(
    { actorId: actor.id, requiredPermission, roles: actor.roles },
    'Permission denied',
  );
  return 'deny';
}

export function checkMultiplePermissions(
  actor: Actor,
  requiredPermissions: string[],
  mode: 'all' | 'any' = 'all',
): PolicyVerdict {
  const results = requiredPermissions.map((perm) => checkPermission(actor, perm));

  if (mode === 'all') {
    return results.every((r) => r === 'allow') ? 'allow' : 'deny';
  }
  return results.some((r) => r === 'allow') ? 'allow' : 'deny';
}

// ============================================================================
// Policy Sync (from policy-audit service)
// ============================================================================
export async function syncRBACPolicy(): Promise<void> {
  try {
    logger.info('Syncing RBAC policy from policy-audit service');
    // In production, this fetches from policy-audit service
    // For now, use default policy
    currentPolicy = {
      ...DEFAULT_RBAC_POLICY,
      lastSyncedAt: new Date().toISOString(),
    };
    logger.info({ version: currentPolicy.version }, 'RBAC policy synced');
  } catch (error) {
    logger.error({ error }, 'Failed to sync RBAC policy, using cached version');
  }
}

export function startRBACSyncLoop(): void {
  syncRBACPolicy();
  syncInterval = setInterval(syncRBACPolicy, config.RBAC_SYNC_INTERVAL_MS);
  logger.info({ intervalMs: config.RBAC_SYNC_INTERVAL_MS }, 'RBAC sync loop started');
}

export function stopRBACSyncLoop(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    logger.info('RBAC sync loop stopped');
  }
}

export function getCurrentPolicy(): RBACPolicy {
  return { ...currentPolicy };
}
