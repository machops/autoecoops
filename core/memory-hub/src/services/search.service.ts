import { getPool } from './database.service';
import { generateEmbedding } from './embedding.service';
import { logger } from './logger.service';
import type { SearchResult, DocumentChunk } from '@autoecops/shared-types';

const DEFAULT_TOP_K = 10;
const DEFAULT_SIMILARITY_THRESHOLD = 0.7;

export interface SearchOptions {
  topK?: number;
  similarityThreshold?: number;
  filters?: {
    source?: string;
    documentId?: string;
    modelVersion?: string;
  };
}

export async function vectorSearch(
  query: string,
  options: SearchOptions = {},
): Promise<SearchResult[]> {
  const {
    topK = DEFAULT_TOP_K,
    similarityThreshold = DEFAULT_SIMILARITY_THRESHOLD,
    filters,
  } = options;

  const startTime = Date.now();

  try {
    const queryEmbedding = await generateEmbedding(query);
    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    let whereClause = 'WHERE 1 = 1';
    const params: unknown[] = [embeddingStr, topK];
    let paramIndex = 3;

    if (filters?.source) {
      whereClause += ` AND d.source = $${paramIndex++}`;
      params.push(filters.source);
    }
    if (filters?.documentId) {
      whereClause += ` AND dc.document_id = $${paramIndex++}`;
      params.push(filters.documentId);
    }
    if (filters?.modelVersion) {
      whereClause += ` AND dc.model_version = $${paramIndex++}`;
      params.push(filters.modelVersion);
    }

    const sql = `
      SELECT
        dc.id,
        dc.document_id,
        dc.content,
        dc.chunk_index,
        dc.total_chunks,
        dc.model_version,
        dc.metadata,
        dc.created_at,
        d.source,
        1 - (dc.embedding <=> $1::vector) AS similarity
      FROM document_chunks dc
      JOIN documents d ON d.id = dc.document_id
      ${whereClause}
        AND d.scan_status = 'clean'
      ORDER BY dc.embedding <=> $1::vector
      LIMIT $2
    `;

    const pool = getPool();
    const result = await pool.query(sql, params);

    const searchResults: SearchResult[] = result.rows
      .filter((row: { similarity: number }) => row.similarity >= similarityThreshold)
      .map((row: {
        id: string;
        document_id: string;
        content: string;
        chunk_index: number;
        total_chunks: number;
        model_version: string;
        metadata: Record<string, unknown>;
        created_at: string;
        source: string;
        similarity: number;
      }) => ({
        chunk: {
          id: row.id,
          documentId: row.document_id,
          content: row.content,
          metadata: {
            source: row.source,
            chunkIndex: row.chunk_index,
            totalChunks: row.total_chunks,
            modelVersion: row.model_version,
          },
          createdAt: row.created_at,
        } as DocumentChunk,
        score: row.similarity,
      }));

    const durationMs = Date.now() - startTime;
    logger.info(
      { query: query.slice(0, 100), topK, resultsCount: searchResults.length, durationMs },
      'Vector search completed',
    );

    return searchResults;
  } catch (error) {
    logger.error({ error, query: query.slice(0, 100) }, 'Vector search failed');
    throw error;
  }
}
