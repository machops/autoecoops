import { z } from 'zod';

const configSchema = z.object({
  SERVICE_NAME: z.literal('memory-hub'),
  VERSION: z.string().default('1.0.0'),
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4002),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  // PostgreSQL + pgvector
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/memory_hub'),
  DB_POOL_MIN: z.coerce.number().int().default(2),
  DB_POOL_MAX: z.coerce.number().int().default(20),
  DB_SSL: z.coerce.boolean().default(false),

  // Embedding Model
  EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),
  EMBEDDING_DIMENSIONS: z.coerce.number().int().default(1536),
  EMBEDDING_MODEL_VERSION: z.string().default('v1.0'),
  OPENAI_API_KEY: z.string().optional(),

  // Chunking
  CHUNK_SIZE: z.coerce.number().int().default(512),
  CHUNK_OVERLAP: z.coerce.number().int().default(64),
  MAX_DOCUMENT_SIZE_MB: z.coerce.number().default(50),

  // ClamAV
  CLAMAV_HOST: z.string().default('clamav'),
  CLAMAV_PORT: z.coerce.number().int().default(3310),
  CLAMAV_ENABLED: z.coerce.boolean().default(true),

  // Auth
  AUTH_SERVICE_URL: z.string().url().default('http://auth-service:4001'),

  // Metrics
  METRICS_PORT: z.coerce.number().int().default(9091),

  // Tracing
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().default('http://otel-collector:4318'),
});

export type MemoryHubConfig = z.infer<typeof configSchema>;

function loadConfig(): MemoryHubConfig {
  const result = configSchema.safeParse({
    SERVICE_NAME: 'memory-hub',
    ...process.env,
  });

  if (!result.success) {
    console.error('Configuration validation failed:', JSON.stringify(result.error.format(), null, 2));
    process.exit(1);
  }

  return result.data;
}

export const config = loadConfig();
