import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { verifyToken, introspectToken, extractActorFromPayload } from '../services/oidc.service';
import { checkPermission, getCurrentPolicy } from '../services/rbac.service';
import { authMiddleware } from '../middleware/auth.middleware';
import { authVerificationsTotal, rbacDecisionsTotal } from '../middleware/metrics';
import { logger } from '../middleware/logger';
import type { ApiResponse, Actor, PolicyDecision } from '@autoecops/shared-types';

const router = Router();

// ============================================================================
// POST /auth/verify - Verify a JWT token
// ============================================================================
router.post('/verify', async (req: Request, res: Response): Promise<void> => {
  const { token } = req.body as { token?: string };

  if (!token) {
    res.status(400).json({
      success: false,
      error: { code: 'MISSING_TOKEN', message: 'Token is required' },
      meta: {
        requestId: uuidv4(),
        traceId: req.traceContext?.traceId ?? 'unknown',
        timestamp: new Date().toISOString(),
      },
    } satisfies ApiResponse<never>);
    return;
  }

  try {
    const payload = await verifyToken(token);
    const actor = extractActorFromPayload(payload);
    authVerificationsTotal.inc({ result: 'success' });

    res.json({
      success: true,
      data: { actor, expiresAt: new Date(payload.exp * 1000).toISOString() },
      meta: {
        requestId: uuidv4(),
        traceId: req.traceContext?.traceId ?? 'unknown',
        timestamp: new Date().toISOString(),
      },
    } satisfies ApiResponse<{ actor: Actor; expiresAt: string }>);
  } catch (error) {
    authVerificationsTotal.inc({ result: 'failure' });
    const message = error instanceof Error ? error.message : 'Verification failed';
    logger.warn({ traceId: req.traceContext?.traceId, error: message }, 'Token verification failed');

    res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message },
      meta: {
        requestId: uuidv4(),
        traceId: req.traceContext?.traceId ?? 'unknown',
        timestamp: new Date().toISOString(),
      },
    } satisfies ApiResponse<never>);
  }
});

// ============================================================================
// POST /auth/introspect - Introspect token (RFC 7662)
// ============================================================================
router.post('/introspect', async (req: Request, res: Response): Promise<void> => {
  const { token } = req.body as { token?: string };

  if (!token) {
    res.status(400).json({
      success: false,
      error: { code: 'MISSING_TOKEN', message: 'Token is required' },
    } satisfies ApiResponse<never>);
    return;
  }

  const result = await introspectToken(token);
  res.json({
    success: true,
    data: result,
    meta: {
      requestId: uuidv4(),
      traceId: req.traceContext?.traceId ?? 'unknown',
      timestamp: new Date().toISOString(),
    },
  });
});

// ============================================================================
// POST /auth/authorize - Check RBAC permission
// ============================================================================
router.post('/authorize', authMiddleware(), async (req: Request, res: Response): Promise<void> => {
  const { permission, resource } = req.body as {
    permission?: string;
    resource?: { kind: string; id: string; namespace?: string };
  };

  if (!permission) {
    res.status(400).json({
      success: false,
      error: { code: 'MISSING_PERMISSION', message: 'Permission is required' },
    } satisfies ApiResponse<never>);
    return;
  }

  const actor = req.authContext!.actor;
  const verdict = checkPermission(actor, permission);
  rbacDecisionsTotal.inc({ verdict });

  const decision: PolicyDecision = {
    verdict,
    policyId: 'rbac-v1',
    policyVersion: getCurrentPolicy().version,
    reason: verdict === 'allow'
      ? `Actor ${actor.id} has permission ${permission}`
      : `Actor ${actor.id} lacks permission ${permission}`,
    complianceTags: ['rbac', 'access-control'],
    evaluatedAt: new Date().toISOString(),
  };

  logger.info(
    {
      traceId: req.traceContext?.traceId,
      actorId: actor.id,
      permission,
      verdict,
      resource,
    },
    'Authorization decision',
  );

  res.json({
    success: true,
    data: { decision },
    meta: {
      requestId: uuidv4(),
      traceId: req.traceContext?.traceId ?? 'unknown',
      timestamp: new Date().toISOString(),
    },
  } satisfies ApiResponse<{ decision: PolicyDecision }>);
});

// ============================================================================
// GET /auth/rbac/policy - Get current RBAC policy (admin only)
// ============================================================================
router.get(
  '/rbac/policy',
  authMiddleware('policy:read'),
  (_req: Request, res: Response): void => {
    res.json({
      success: true,
      data: getCurrentPolicy(),
      meta: {
        requestId: uuidv4(),
        traceId: _req.traceContext?.traceId ?? 'unknown',
        timestamp: new Date().toISOString(),
      },
    });
  },
);

export default router;
