import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { vectorSearch } from '../services/search.service';
import { ingestDocument } from '../services/ingest.service';
import { logger } from '../services/logger.service';
import type { ApiResponse, SearchResult } from '@autoecops/shared-types';

const router = Router();

// ============================================================================
// POST /memory/search - Vector similarity search
// ============================================================================
router.post('/search', async (req: Request, res: Response): Promise<void> => {
  const { query, topK, similarityThreshold, filters } = req.body as {
    query?: string;
    topK?: number;
    similarityThreshold?: number;
    filters?: { source?: string; documentId?: string; modelVersion?: string };
  };

  if (!query || query.trim().length === 0) {
    res.status(400).json({
      success: false,
      error: { code: 'MISSING_QUERY', message: 'Query is required' },
    } satisfies ApiResponse<never>);
    return;
  }

  try {
    const results = await vectorSearch(query, { topK, similarityThreshold, filters });

    res.json({
      success: true,
      data: { results, total: results.length },
      meta: {
        requestId: uuidv4(),
        traceId: (req.headers['x-trace-id'] as string) ?? uuidv4(),
        timestamp: new Date().toISOString(),
      },
    } satisfies ApiResponse<{ results: SearchResult[]; total: number }>);
  } catch (error) {
    logger.error({ error }, 'Search failed');
    res.status(500).json({
      success: false,
      error: { code: 'SEARCH_FAILED', message: 'Vector search failed' },
    } satisfies ApiResponse<never>);
  }
});

// ============================================================================
// POST /memory/ingest - Ingest a document
// ============================================================================
router.post('/ingest', async (req: Request, res: Response): Promise<void> => {
  const { title, source, content, metadata } = req.body as {
    title?: string;
    source?: string;
    content?: string;
    metadata?: Record<string, unknown>;
  };

  if (!title || !source || !content) {
    res.status(400).json({
      success: false,
      error: { code: 'MISSING_FIELDS', message: 'title, source, and content are required' },
    } satisfies ApiResponse<never>);
    return;
  }

  try {
    const result = await ingestDocument({ title, source, content, metadata });

    res.status(201).json({
      success: true,
      data: result,
      meta: {
        requestId: uuidv4(),
        traceId: (req.headers['x-trace-id'] as string) ?? uuidv4(),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ingestion failed';
    logger.error({ error }, 'Ingestion failed');

    const statusCode = message.includes('virus scan') ? 422 : 500;
    res.status(statusCode).json({
      success: false,
      error: { code: 'INGEST_FAILED', message },
    } satisfies ApiResponse<never>);
  }
});

export default router;
