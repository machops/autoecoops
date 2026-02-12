import { z } from 'zod';

const configSchema = z.object({
  SERVICE_NAME: z.literal('auth-service'),
  VERSION: z.string().default('1.0.0'),
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4001),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  // OIDC Provider (Keycloak)
  OIDC_ISSUER_URL: z.string().url().default('http://keycloak:8080/realms/autoecops'),
  OIDC_CLIENT_ID: z.string().min(1).default('autoecops-api'),
  OIDC_CLIENT_SECRET: z.string().min(1).default('change-me-in-production'),
  OIDC_AUDIENCE: z.string().min(1).default('autoecops-api'),
  JWKS_URI: z.string().url().optional(),
  JWKS_CACHE_TTL_SECONDS: z.coerce.number().int().default(600),

  // RBAC
  RBAC_SYNC_INTERVAL_MS: z.coerce.number().int().default(30000),
  RBAC_CACHE_TTL_SECONDS: z.coerce.number().int().default(300),

  // API Key Management
  API_KEY_ROTATION_DAYS: z.coerce.number().int().default(90),
  API_KEY_HASH_ALGORITHM: z.enum(['sha256', 'sha384', 'sha512']).default('sha256'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().default(100),

  // Metrics
  METRICS_PORT: z.coerce.number().int().default(9090),

  // Tracing
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().default('http://otel-collector:4318'),
  OTEL_SERVICE_NAME: z.literal('auth-service').default('auth-service'),
});

export type AuthServiceConfig = z.infer<typeof configSchema>;

function loadConfig(): AuthServiceConfig {
  const result = configSchema.safeParse({
    SERVICE_NAME: 'auth-service',
    OTEL_SERVICE_NAME: 'auth-service',
    ...process.env,
  });

  if (!result.success) {
    const formatted = result.error.format();
    console.error('Configuration validation failed:', JSON.stringify(formatted, null, 2));
    process.exit(1);
  }

  return result.data;
}

export const config = loadConfig();
