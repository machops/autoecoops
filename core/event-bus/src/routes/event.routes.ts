import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { publishEvent, replayEvents } from '../producers/stream.producer';
import { logger } from '../middleware/logger';
import type { ApiResponse } from '@autoecops/shared-types';

const router = Router();

const publishSchema = z.object({
  type: z.string().min(1),
  source: z.string().min(1),
  subject: z.string().optional(),
  traceId: z.string().uuid(),
  actor: z.object({
    id: z.string().min(1),
    type: z.enum(['user', 'service', 'system']),
  }),
  resource: z.object({
    kind: z.string().min(1),
    id: z.string().min(1),
    namespace: z.string().optional(),
  }),
  policyDecision: z.object({
    verdict: z.enum(['allow', 'deny', 'warn']),
    policyId: z.string(),
    policyVersion: z.string(),
    reason: z.string(),
    complianceTags: z.array(z.string()),
    evaluatedAt: z.string(),
  }).optional(),
  idempotencyKey: z.string().min(1),
  priority: z.enum(['critical', 'high', 'normal', 'low']).default('normal'),
  data: z.unknown(),
  streamName: z.string().min(1),
});

// ============================================================================
// POST /events/publish - Publish an event to a stream
// ============================================================================
router.post('/publish', async (req: Request, res: Response): Promise<void> => {
  const validation = publishSchema.safeParse(req.body);

  if (!validation.success) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid event payload',
        details: validation.error.format(),
      },
    } satisfies ApiResponse<never>);
    return;
  }

  const { streamName, ...eventData } = validation.data;

  try {
    const result = await publishEvent(eventData, { streamName });

    res.status(201).json({
      success: true,
      data: result,
      meta: {
        requestId: uuidv4(),
        traceId: eventData.traceId,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to publish event');
    res.status(500).json({
      success: false,
      error: { code: 'PUBLISH_FAILED', message: 'Failed to publish event' },
    } satisfies ApiResponse<never>);
  }
});

// ============================================================================
// GET /events/replay/:streamName - Replay events from a stream
// ============================================================================
router.get('/replay/:streamName', async (req: Request, res: Response): Promise<void> => {
  const { streamName } = req.params;
  const { startId, endId, count } = req.query as {
    startId?: string;
    endId?: string;
    count?: string;
  };

  try {
    const events = await replayEvents(
      streamName,
      startId ?? '0-0',
      endId ?? '+',
      count ? parseInt(count, 10) : 100,
    );

    res.json({
      success: true,
      data: { events, total: events.length },
      meta: {
        requestId: uuidv4(),
        traceId: (req.headers['x-trace-id'] as string) ?? uuidv4(),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error({ error, streamName }, 'Failed to replay events');
    res.status(500).json({
      success: false,
      error: { code: 'REPLAY_FAILED', message: 'Failed to replay events' },
    } satisfies ApiResponse<never>);
  }
});

export default router;
