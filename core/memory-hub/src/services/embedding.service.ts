import { config } from '../config';
import { logger } from './logger.service';

// ============================================================================
// Text Chunking
// ============================================================================
export interface TextChunk {
  content: string;
  index: number;
  totalChunks: number;
}

export function chunkText(text: string): TextChunk[] {
  const { CHUNK_SIZE, CHUNK_OVERLAP } = config;
  const sentences = text.split(/(?<=[.!?。！？])\s+/);
  const chunks: TextChunk[] = [];
  let currentChunk = '';
  let currentLength = 0;

  for (const sentence of sentences) {
    if (currentLength + sentence.length > CHUNK_SIZE && currentChunk.length > 0) {
      chunks.push({ content: currentChunk.trim(), index: chunks.length, totalChunks: 0 });

      // Keep overlap
      const words = currentChunk.split(/\s+/);
      const overlapWords = words.slice(-Math.ceil(CHUNK_OVERLAP / 5));
      currentChunk = overlapWords.join(' ') + ' ' + sentence;
      currentLength = currentChunk.length;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
      currentLength += sentence.length;
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push({ content: currentChunk.trim(), index: chunks.length, totalChunks: 0 });
  }

  // Update totalChunks
  return chunks.map((chunk) => ({ ...chunk, totalChunks: chunks.length }));
}

// ============================================================================
// Embedding Generation
// ============================================================================
export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = config.OPENAI_API_KEY;

  if (!apiKey) {
    logger.warn('OPENAI_API_KEY not set, returning zero vector');
    return new Array(config.EMBEDDING_DIMENSIONS).fill(0);
  }

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.EMBEDDING_MODEL,
        input: text,
        dimensions: config.EMBEDDING_DIMENSIONS,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Embedding API error: ${response.status} ${errorBody}`);
    }

    const data = await response.json() as {
      data: Array<{ embedding: number[] }>;
    };

    return data.data[0].embedding;
  } catch (error) {
    logger.error({ error }, 'Failed to generate embedding');
    throw error;
  }
}

export async function generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
  const MAX_BATCH_SIZE = 100;
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
    const batch = texts.slice(i, i + MAX_BATCH_SIZE);
    const embeddings = await Promise.all(batch.map(generateEmbedding));
    results.push(...embeddings);
  }

  return results;
}
