import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getApplicationState, syncApplication, rollbackApplication, checkDrift } from '../reconcilers/argocd.reconciler';
import { logger } from '../services/logger.service';
import type { ApiResponse, InfraState } from '@autoecops/shared-types';

const router = Router();

// GET /infra/applications/:name - Get application state
router.get('/applications/:name', async (req: Request, res: Response): Promise<void> => {
  const { name } = req.params;
  try {
    const state = await getApplicationState(name);
    res.json({
      success: true, data: state,
      meta: { requestId: uuidv4(), traceId: (req.headers['x-trace-id'] as string) ?? uuidv4(), timestamp: new Date().toISOString() },
    } satisfies ApiResponse<InfraState>);
  } catch (error) {
    logger.error({ error, name }, 'Failed to get application state');
    res.status(500).json({ success: false, error: { code: 'STATE_FETCH_FAILED', message: 'Failed to get application state' } });
  }
});

// POST /infra/applications/:name/sync - Trigger sync
router.post('/applications/:name/sync', async (req: Request, res: Response): Promise<void> => {
  const { name } = req.params;
  const { revision, prune } = req.body as { revision?: string; prune?: boolean };

  const result = await syncApplication(name, revision, prune);
  res.status(result.success ? 200 : 500).json({
    success: result.success, data: result,
    meta: { requestId: uuidv4(), traceId: (req.headers['x-trace-id'] as string) ?? uuidv4(), timestamp: new Date().toISOString() },
  });
});

// POST /infra/applications/:name/rollback - Trigger rollback
router.post('/applications/:name/rollback', async (req: Request, res: Response): Promise<void> => {
  const { name } = req.params;
  const { targetRevision } = req.body as { targetRevision?: number };

  if (!targetRevision) {
    res.status(400).json({ success: false, error: { code: 'MISSING_REVISION', message: 'targetRevision is required' } });
    return;
  }

  const result = await rollbackApplication(name, targetRevision);
  res.status(result.success ? 200 : 500).json({
    success: result.success, data: result,
    meta: { requestId: uuidv4(), traceId: (req.headers['x-trace-id'] as string) ?? uuidv4(), timestamp: new Date().toISOString() },
  });
});

// GET /infra/drift - Check drift across all applications
router.get('/drift', async (req: Request, res: Response): Promise<void> => {
  try {
    const states = await checkDrift();
    const drifted = states.filter((s) => s.driftDetected);
    res.json({
      success: true,
      data: { applications: states, driftedCount: drifted.length, totalCount: states.length },
      meta: { requestId: uuidv4(), traceId: (req.headers['x-trace-id'] as string) ?? uuidv4(), timestamp: new Date().toISOString() },
    });
  } catch (error) {
    logger.error({ error }, 'Drift check failed');
    res.status(500).json({ success: false, error: { code: 'DRIFT_CHECK_FAILED', message: 'Drift check failed' } });
  }
});

export default router;
