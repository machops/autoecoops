import { z } from 'zod';

const configSchema = z.object({
  SERVICE_NAME: z.literal('event-bus'),
  VERSION: z.string().default('1.0.0'),
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4003),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  // Redis Streams
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_TLS: z.coerce.boolean().default(false),
  REDIS_MAX_RETRIES: z.coerce.number().int().default(3),

  // Stream Configuration
  STREAM_MAX_LEN: z.coerce.number().int().default(100000),
  CONSUMER_GROUP_PREFIX: z.string().default('autoecops'),
  CONSUMER_BLOCK_MS: z.coerce.number().int().default(5000),
  CONSUMER_COUNT: z.coerce.number().int().default(10),

  // Deduplication
  DEDUP_WINDOW_SECONDS: z.coerce.number().int().default(3600),

  // Dead Letter Queue
  DLQ_MAX_RETRIES: z.coerce.number().int().default(5),
  DLQ_STREAM_SUFFIX: z.string().default(':dlq'),

  // Auth
  AUTH_SERVICE_URL: z.string().url().default('http://auth-service:4001'),

  // Metrics
  METRICS_PORT: z.coerce.number().int().default(9092),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().default('http://otel-collector:4318'),
});

export type EventBusConfig = z.infer<typeof configSchema>;

function loadConfig(): EventBusConfig {
  const result = configSchema.safeParse({ SERVICE_NAME: 'event-bus', ...process.env });
  if (!result.success) {
    console.error('Config validation failed:', JSON.stringify(result.error.format(), null, 2));
    process.exit(1);
  }
  return result.data;
}

export const config = loadConfig();
