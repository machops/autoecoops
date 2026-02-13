import { z } from 'zod';

const configSchema = z.object({
  SERVICE_NAME: z.literal('platform-02'),
  PLATFORM_ID: z.literal('platform-02'),
  VERSION: z.string().default('1.0.0'),
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().default(5002),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  AUTH_SERVICE_URL: z.string().url().default('http://auth-service:4001'),
  MEMORY_HUB_URL: z.string().url().default('http://memory-hub:4002'),
  EVENT_BUS_URL: z.string().url().default('http://event-bus:4003'),
  POLICY_AUDIT_URL: z.string().url().default('http://policy-audit:4004'),
  INFRA_MANAGER_URL: z.string().url().default('http://infra-manager:4005'),

  // GitOps
  GITOPS_REPO_URL: z.string().default(''),
  GITOPS_BRANCH: z.string().default('main'),

  // Supply Chain
  SBOM_REQUIRED: z.coerce.boolean().default(true),
  SIGNATURE_REQUIRED: z.coerce.boolean().default(true),
  VULNERABILITY_THRESHOLD: z.enum(['none', 'low', 'medium', 'high', 'critical']).default('high'),

  METRICS_PORT: z.coerce.number().int().default(9102),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().default('http://otel-collector:4318'),
});

export type Platform02Config = z.infer<typeof configSchema>;

function loadConfig(): Platform02Config {
  const result = configSchema.safeParse({ SERVICE_NAME: 'platform-02', PLATFORM_ID: 'platform-02', ...process.env });
  if (!result.success) { console.error('Config validation failed:', JSON.stringify(result.error.format(), null, 2)); process.exit(1); }
  return result.data;
}

export const config = loadConfig();
