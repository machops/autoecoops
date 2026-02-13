import { config } from '../config';
import { logger } from '../services/logger.service';

// ============================================================================
// SLO Definitions
// ============================================================================
export interface SLODefinition {
  name: string;
  metric: string;
  target: number;
  window: string;
  query: string;
}

export interface SLOStatus {
  name: string;
  current: number;
  target: number;
  budget: number;
  budgetRemaining: number;
  status: 'met' | 'at-risk' | 'breached';
  evaluatedAt: string;
}

const SLO_DEFINITIONS: SLODefinition[] = [
  {
    name: 'availability',
    metric: 'availability_ratio',
    target: config.SLO_AVAILABILITY_TARGET,
    window: '30d',
    query: '1 - (sum(rate(http_requests_total{status=~"5.."}[30d])) / sum(rate(http_requests_total[30d])))',
  },
  {
    name: 'latency-p95',
    metric: 'latency_p95_ms',
    target: config.SLO_P95_LATENCY_MS,
    window: '30d',
    query: 'histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[30d])) by (le)) * 1000',
  },
  {
    name: 'error-rate',
    metric: 'error_rate_percent',
    target: config.SLO_ERROR_RATE_TARGET,
    window: '30d',
    query: 'sum(rate(http_requests_total{status=~"5.."}[30d])) / sum(rate(http_requests_total[30d])) * 100',
  },
];

// ============================================================================
// Prometheus Query
// ============================================================================
async function queryPrometheus(promql: string): Promise<number> {
  try {
    const url = `${config.PROMETHEUS_URL}/api/v1/query?query=${encodeURIComponent(promql)}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Prometheus query failed: ${response.status}`);
    }

    const data = await response.json() as {
      data: { result: Array<{ value: [number, string] }> };
    };

    if (data.data.result.length === 0) {
      return 0;
    }

    return parseFloat(data.data.result[0].value[1]);
  } catch (error) {
    logger.error({ error, promql }, 'Prometheus query failed');
    return -1;
  }
}

// ============================================================================
// SLO Evaluation
// ============================================================================
export async function evaluateSLOs(): Promise<SLOStatus[]> {
  const results: SLOStatus[] = [];

  for (const slo of SLO_DEFINITIONS) {
    const current = await queryPrometheus(slo.query);

    let status: 'met' | 'at-risk' | 'breached';
    let budgetRemaining: number;

    if (slo.name === 'latency-p95' || slo.name === 'error-rate') {
      // Lower is better
      budgetRemaining = ((slo.target - current) / slo.target) * 100;
      status = current <= slo.target ? 'met' : current <= slo.target * 1.1 ? 'at-risk' : 'breached';
    } else {
      // Higher is better (availability)
      budgetRemaining = ((current - slo.target) / (100 - slo.target)) * 100;
      status = current >= slo.target ? 'met' : current >= slo.target * 0.99 ? 'at-risk' : 'breached';
    }

    const sloStatus: SLOStatus = {
      name: slo.name,
      current,
      target: slo.target,
      budget: 100 - slo.target,
      budgetRemaining: Math.max(0, budgetRemaining),
      status,
      evaluatedAt: new Date().toISOString(),
    };

    results.push(sloStatus);

    if (status !== 'met') {
      logger.warn({ slo: slo.name, current, target: slo.target, status }, 'SLO violation detected');
    }
  }

  return results;
}

// ============================================================================
// Observer Loop
// ============================================================================
let observerInterval: NodeJS.Timeout | null = null;

export function startSLOObserver(): void {
  evaluateSLOs();
  observerInterval = setInterval(evaluateSLOs, config.OBSERVER_POLL_INTERVAL_MS);
  logger.info({ intervalMs: config.OBSERVER_POLL_INTERVAL_MS }, 'SLO observer started');
}

export function stopSLOObserver(): void {
  if (observerInterval) { clearInterval(observerInterval); observerInterval = null; }
}
