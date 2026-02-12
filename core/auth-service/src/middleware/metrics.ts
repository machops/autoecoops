import { Request, Response, NextFunction } from 'express';
import client, { Registry, Counter, Histogram, Gauge } from 'prom-client';

const register = new Registry();

client.collectDefaultMetrics({ register, prefix: 'autoecops_auth_' });

export const httpRequestsTotal = new Counter({
  name: 'autoecops_auth_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status_code'] as const,
  registers: [register],
});

export const httpRequestDuration = new Histogram({
  name: 'autoecops_auth_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path', 'status_code'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.2, 0.5, 1, 2.5, 5],
  registers: [register],
});

export const authVerificationsTotal = new Counter({
  name: 'autoecops_auth_verifications_total',
  help: 'Total number of token verifications',
  labelNames: ['result'] as const,
  registers: [register],
});

export const rbacDecisionsTotal = new Counter({
  name: 'autoecops_auth_rbac_decisions_total',
  help: 'Total number of RBAC decisions',
  labelNames: ['verdict'] as const,
  registers: [register],
});

export const activeSessionsGauge = new Gauge({
  name: 'autoecops_auth_active_sessions',
  help: 'Number of active sessions',
  registers: [register],
});

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = process.hrtime.bigint();

  res.on('finish', () => {
    const durationNs = Number(process.hrtime.bigint() - startTime);
    const durationSeconds = durationNs / 1e9;
    const normalizedPath = normalizePath(req.route?.path ?? req.path);

    httpRequestsTotal.inc({
      method: req.method,
      path: normalizedPath,
      status_code: res.statusCode.toString(),
    });

    httpRequestDuration.observe(
      {
        method: req.method,
        path: normalizedPath,
        status_code: res.statusCode.toString(),
      },
      durationSeconds,
    );
  });

  next();
}

function normalizePath(path: string): string {
  return path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/\d+/g, '/:id');
}

export async function getMetrics(): Promise<string> {
  return register.metrics();
}

export { register };
