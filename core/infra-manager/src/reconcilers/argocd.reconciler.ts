import { config } from '../config';
import { logger } from '../services/logger.service';
import type { InfraState, SyncStatus, HealthStatus } from '@autoecops/shared-types';

// ============================================================================
// ArgoCD API Client
// ============================================================================
interface ArgoApplication {
  metadata: { name: string; namespace: string };
  status: {
    sync: { status: string; revision: string };
    health: { status: string };
    operationState?: { phase: string; message: string };
    reconciledAt: string;
  };
}

async function argocdFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const url = `${config.ARGOCD_SERVER_URL}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(config.ARGOCD_AUTH_TOKEN ? { 'Authorization': `Bearer ${config.ARGOCD_AUTH_TOKEN}` } : {}),
  };

  return fetch(url, {
    ...options,
    headers: { ...headers, ...(options.headers as Record<string, string>) },
  });
}

// ============================================================================
// Application State
// ============================================================================
export async function getApplicationState(appName: string): Promise<InfraState> {
  try {
    const response = await argocdFetch(`/api/v1/applications/${appName}`);
    if (!response.ok) {
      throw new Error(`ArgoCD API error: ${response.status}`);
    }

    const app = (await response.json()) as ArgoApplication;

    const syncStatusMap: Record<string, SyncStatus> = {
      'Synced': 'synced',
      'OutOfSync': 'out-of-sync',
      'Unknown': 'unknown',
    };

    const healthStatusMap: Record<string, HealthStatus> = {
      'Healthy': 'healthy',
      'Degraded': 'degraded',
      'Missing': 'unhealthy',
      'Unknown': 'unhealthy',
    };

    return {
      clusterId: 'primary',
      namespace: app.metadata.namespace,
      application: app.metadata.name,
      syncStatus: syncStatusMap[app.status.sync.status] ?? 'unknown',
      healthStatus: healthStatusMap[app.status.health.status] ?? 'unhealthy',
      revision: app.status.sync.revision,
      lastSyncedAt: app.status.reconciledAt,
      driftDetected: app.status.sync.status === 'OutOfSync',
      driftDetails: app.status.sync.status === 'OutOfSync'
        ? [`Application ${appName} is out of sync`]
        : undefined,
    };
  } catch (error) {
    logger.error({ error, appName }, 'Failed to get application state');
    return {
      clusterId: 'primary',
      namespace: 'unknown',
      application: appName,
      syncStatus: 'unknown',
      healthStatus: 'unhealthy',
      revision: 'unknown',
      lastSyncedAt: new Date().toISOString(),
      driftDetected: false,
    };
  }
}

// ============================================================================
// Sync Application
// ============================================================================
export async function syncApplication(
  appName: string,
  revision?: string,
  prune: boolean = false,
): Promise<{ success: boolean; message: string }> {
  try {
    const body: Record<string, unknown> = { prune };
    if (revision) body.revision = revision;

    const response = await argocdFetch(`/api/v1/applications/${appName}/sync`, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Sync failed: ${response.status} ${errorText}`);
    }

    logger.info({ appName, revision, prune }, 'Application sync triggered');
    return { success: true, message: `Sync triggered for ${appName}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error, appName }, 'Sync failed');
    return { success: false, message };
  }
}

// ============================================================================
// Rollback Application
// ============================================================================
export async function rollbackApplication(
  appName: string,
  targetRevision: number,
): Promise<{ success: boolean; message: string }> {
  try {
    const response = await argocdFetch(`/api/v1/applications/${appName}/rollback`, {
      method: 'POST',
      body: JSON.stringify({ id: targetRevision }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Rollback failed: ${response.status} ${errorText}`);
    }

    logger.info({ appName, targetRevision }, 'Application rollback triggered');
    return { success: true, message: `Rollback to revision ${targetRevision} triggered for ${appName}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error, appName, targetRevision }, 'Rollback failed');
    return { success: false, message };
  }
}

// ============================================================================
// Drift Detection Loop
// ============================================================================
const MONITORED_APPS = [
  'auth-service',
  'memory-hub',
  'event-bus',
  'policy-audit',
  'infra-manager',
  'platform-01',
  'platform-02',
  'platform-03',
];

let driftInterval: NodeJS.Timeout | null = null;

export async function checkDrift(): Promise<InfraState[]> {
  const states: InfraState[] = [];

  for (const appName of MONITORED_APPS) {
    const state = await getApplicationState(appName);
    states.push(state);

    if (state.driftDetected) {
      logger.warn({ appName, syncStatus: state.syncStatus }, 'Drift detected');

      if (config.DRIFT_AUTO_SYNC) {
        logger.info({ appName }, 'Auto-sync enabled, triggering sync');
        await syncApplication(appName);
      }
    }
  }

  return states;
}

export function startDriftDetection(): void {
  checkDrift();
  driftInterval = setInterval(checkDrift, config.DRIFT_CHECK_INTERVAL_MS);
  logger.info({ intervalMs: config.DRIFT_CHECK_INTERVAL_MS }, 'Drift detection started');
}

export function stopDriftDetection(): void {
  if (driftInterval) { clearInterval(driftInterval); driftInterval = null; logger.info('Drift detection stopped'); }
}
