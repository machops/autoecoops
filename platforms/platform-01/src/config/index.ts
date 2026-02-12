import { z } from 'zod';

const configSchema = z.object({
  SERVICE_NAME: z.literal('platform-01'),
  PLATFORM_ID: z.literal('platform-01'),
  VERSION: z.string().default('1.0.0'),
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().default(5001),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  // Core Service URLs
  AUTH_SERVICE_URL: z.string().url().default('http://auth-service:4001'),
  MEMORY_HUB_URL: z.string().url().default('http://memory-hub:4002'),
  EVENT_BUS_URL: z.string().url().default('http://event-bus:4003'),
  POLICY_AUDIT_URL: z.string().url().default('http://policy-audit:4004'),
  INFRA_MANAGER_URL: z.string().url().default('http://infra-manager:4005'),

  // Observability Targets
  PROMETHEUS_URL: z.string().url().default('http://prometheus:9090'),
  ALERTMANAGER_URL: z.string().url().default('http://alertmanager:9093'),

  // Self-Healing
  HEALING_ENABLED: z.coerce.boolean().default(true),
  HEALING_MAX_RETRIES: z.coerce.number().int().default(3),
  HEALING_COOLDOWN_MS: z.coerce.number().int().default(60000),
  HEALING_ESCALATION_THRESHOLD: z.coerce.number().int().default(5),

  // Observer
  OBSERVER_POLL_INTERVAL_MS: z.coerce.number().int().default(30000),
  SLO_AVAILABILITY_TARGET: z.coerce.number().default(99.99),
  SLO_P95_LATENCY_MS: z.coerce.number().int().default(200),
  SLO_ERROR_RATE_TARGET: z.coerce.number().default(0.1),

  // Redis (for state)
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Metrics
  METRICS_PORT: z.coerce.number().int().default(9101),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().default('http://otel-collector:4318'),
});

export type Platform01Config = z.infer<typeof configSchema>;

function loadConfig(): Platform01Config {
  const result = configSchema.safeParse({ SERVICE_NAME: 'platform-01', PLATFORM_ID: 'platform-01', ...process.env });
  if (!result.success) { console.error('Config validation failed:', JSON.stringify(result.error.format(), null, 2)); process.exit(1); }
  return result.data;
}

export const config = loadConfig();
