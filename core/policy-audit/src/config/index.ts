import { z } from 'zod';

const configSchema = z.object({
  SERVICE_NAME: z.literal('policy-audit'),
  VERSION: z.string().default('1.0.0'),
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4004),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  // PostgreSQL (append-only audit store)
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/policy_audit'),
  DB_POOL_MIN: z.coerce.number().int().default(2),
  DB_POOL_MAX: z.coerce.number().int().default(20),
  DB_SSL: z.coerce.boolean().default(false),

  // OPA
  OPA_URL: z.string().url().default('http://opa:8181'),
  OPA_POLICY_PATH: z.string().default('/v1/data/autoecops'),

  // Compliance
  COMPLIANCE_FRAMEWORKS: z.string().default('SOC2,ISO27001'),
  AUDIT_RETENTION_DAYS: z.coerce.number().int().default(2555), // ~7 years

  // Auth
  AUTH_SERVICE_URL: z.string().url().default('http://auth-service:4001'),

  // Metrics
  METRICS_PORT: z.coerce.number().int().default(9093),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().default('http://otel-collector:4318'),
});

export type PolicyAuditConfig = z.infer<typeof configSchema>;

function loadConfig(): PolicyAuditConfig {
  const result = configSchema.safeParse({ SERVICE_NAME: 'policy-audit', ...process.env });
  if (!result.success) {
    console.error('Config validation failed:', JSON.stringify(result.error.format(), null, 2));
    process.exit(1);
  }
  return result.data;
}

export const config = loadConfig();
