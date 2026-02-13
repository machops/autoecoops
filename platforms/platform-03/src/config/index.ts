import { z } from 'zod';

const configSchema = z.object({
  SERVICE_NAME: z.literal('platform-03'),
  PLATFORM_ID: z.literal('platform-03'),
  VERSION: z.string().default('1.0.0'),
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().default(5003),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  AUTH_SERVICE_URL: z.string().url().default('http://auth-service:4001'),
  MEMORY_HUB_URL: z.string().url().default('http://memory-hub:4002'),
  EVENT_BUS_URL: z.string().url().default('http://event-bus:4003'),
  POLICY_AUDIT_URL: z.string().url().default('http://policy-audit:4004'),
  INFRA_MANAGER_URL: z.string().url().default('http://infra-manager:4005'),

  // Node Baseline
  BASELINE_CHECK_INTERVAL_MS: z.coerce.number().int().default(300000),
  BASELINE_DRIFT_THRESHOLD: z.coerce.number().default(5),

  // Edge Agent
  EDGE_HEARTBEAT_INTERVAL_MS: z.coerce.number().int().default(30000),
  EDGE_AGENT_TIMEOUT_MS: z.coerce.number().int().default(60000),

  METRICS_PORT: z.coerce.number().int().default(9103),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().default('http://otel-collector:4318'),
});

export type Platform03Config = z.infer<typeof configSchema>;

function loadConfig(): Platform03Config {
  const result = configSchema.safeParse({ SERVICE_NAME: 'platform-03', PLATFORM_ID: 'platform-03', ...process.env });
  if (!result.success) { console.error('Config validation failed:', JSON.stringify(result.error.format(), null, 2)); process.exit(1); }
  return result.data;
}

export const config = loadConfig();
