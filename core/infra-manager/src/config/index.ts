import { z } from 'zod';

const configSchema = z.object({
  SERVICE_NAME: z.literal('infra-manager'),
  VERSION: z.string().default('1.0.0'),
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4005),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  // ArgoCD
  ARGOCD_SERVER_URL: z.string().url().default('https://argocd-server.argocd.svc.cluster.local'),
  ARGOCD_AUTH_TOKEN: z.string().default(''),
  ARGOCD_INSECURE: z.coerce.boolean().default(true),

  // Drift Detection
  DRIFT_CHECK_INTERVAL_MS: z.coerce.number().int().default(60000),
  DRIFT_AUTO_SYNC: z.coerce.boolean().default(false),

  // Rollback
  ROLLBACK_MAX_HISTORY: z.coerce.number().int().default(10),
  ROLLBACK_COOLDOWN_MS: z.coerce.number().int().default(300000),

  // Auth
  AUTH_SERVICE_URL: z.string().url().default('http://auth-service:4001'),
  POLICY_AUDIT_URL: z.string().url().default('http://policy-audit:4004'),
  EVENT_BUS_URL: z.string().url().default('http://event-bus:4003'),

  // Metrics
  METRICS_PORT: z.coerce.number().int().default(9094),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().default('http://otel-collector:4318'),
});

export type InfraManagerConfig = z.infer<typeof configSchema>;

function loadConfig(): InfraManagerConfig {
  const result = configSchema.safeParse({ SERVICE_NAME: 'infra-manager', ...process.env });
  if (!result.success) { console.error('Config validation failed:', JSON.stringify(result.error.format(), null, 2)); process.exit(1); }
  return result.data;
}

export const config = loadConfig();
