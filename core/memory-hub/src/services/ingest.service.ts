import { createHash } from 'crypto';
import { Socket } from 'net';
import { config } from '../config';
import { getPool, withTransaction } from './database.service';
import { chunkText, generateBatchEmbeddings } from './embedding.service';
import { logger } from './logger.service';

// ============================================================================
// ClamAV Virus Scanning
// ============================================================================
async function scanWithClamAV(content: Buffer): Promise<{ clean: boolean; result: string }> {
  if (!config.CLAMAV_ENABLED) {
    return { clean: true, result: 'scanning disabled' };
  }

  return new Promise((resolve, reject) => {
    const socket = new Socket();
    const TIMEOUT_MS = 30000;
    let response = '';

    socket.setTimeout(TIMEOUT_MS);

    socket.connect(config.CLAMAV_PORT, config.CLAMAV_HOST, () => {
      const sizeBuffer = Buffer.alloc(4);
      sizeBuffer.writeUInt32BE(content.length, 0);

      socket.write('zINSTREAM\0');
      socket.write(sizeBuffer);
      socket.write(content);

      const endBuffer = Buffer.alloc(4);
      endBuffer.writeUInt32BE(0, 0);
      socket.write(endBuffer);
    });

    socket.on('data', (data) => {
      response += data.toString();
    });

    socket.on('end', () => {
      const clean = response.includes('OK') && !response.includes('FOUND');
      resolve({ clean, result: response.trim() });
    });

    socket.on('error', (err) => {
      logger.error({ err }, 'ClamAV scan error');
      reject(err);
    });

    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('ClamAV scan timeout'));
    });
  });
}

// ============================================================================
// Document Ingestion
// ============================================================================
export interface IngestRequest {
  title: string;
  source: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface IngestResult {
  documentId: string;
  chunksCreated: number;
  scanStatus: string;
}

export async function ingestDocument(request: IngestRequest): Promise<IngestResult> {
  const { title, source, content, metadata = {} } = request;

  // Validate size
  const sizeBytes = Buffer.byteLength(content, 'utf-8');
  const maxBytes = config.MAX_DOCUMENT_SIZE_MB * 1024 * 1024;
  if (sizeBytes > maxBytes) {
    throw new Error(`Document exceeds maximum size of ${config.MAX_DOCUMENT_SIZE_MB}MB`);
  }

  const contentHash = createHash('sha256').update(content).digest('hex');

  // Check for duplicate
  const pool = getPool();
  const existing = await pool.query(
    'SELECT id FROM documents WHERE content_hash = $1',
    [contentHash],
  );
  if (existing.rows.length > 0) {
    logger.info({ contentHash }, 'Duplicate document detected');
    return {
      documentId: existing.rows[0].id,
      chunksCreated: 0,
      scanStatus: 'duplicate',
    };
  }

  // Virus scan
  let scanStatus = 'pending';
  try {
    const scanResult = await scanWithClamAV(Buffer.from(content, 'utf-8'));
    scanStatus = scanResult.clean ? 'clean' : 'infected';
    if (!scanResult.clean) {
      logger.warn({ title, scanResult: scanResult.result }, 'Infected document detected');
      throw new Error('Document failed virus scan');
    }
  } catch (error) {
    if ((error as Error).message === 'Document failed virus scan') throw error;
    logger.warn({ error }, 'ClamAV unavailable, marking as pending');
    scanStatus = 'pending';
  }

  // Chunk and embed
  const chunks = chunkText(content);
  const texts = chunks.map((c) => c.content);
  const embeddings = await generateBatchEmbeddings(texts);

  // Store in transaction
  const result = await withTransaction(async (client) => {
    const docResult = await client.query(
      `INSERT INTO documents (title, source, content_hash, metadata, scan_status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [title, source, contentHash, JSON.stringify(metadata), scanStatus],
    );
    const documentId = docResult.rows[0].id;

    for (let i = 0; i < chunks.length; i++) {
      const embeddingStr = `[${embeddings[i].join(',')}]`;
      await client.query(
        `INSERT INTO document_chunks (document_id, content, embedding, chunk_index, total_chunks, model_version, metadata)
         VALUES ($1, $2, $3::vector, $4, $5, $6, $7)`,
        [
          documentId,
          chunks[i].content,
          embeddingStr,
          chunks[i].index,
          chunks[i].totalChunks,
          config.EMBEDDING_MODEL_VERSION,
          JSON.stringify(metadata),
        ],
      );
    }

    return { documentId, chunksCreated: chunks.length, scanStatus };
  });

  logger.info(
    { documentId: result.documentId, chunks: result.chunksCreated, scanStatus },
    'Document ingested',
  );

  return result;
}
