/**
 * AutoEcoOps Ecosystem - Shared Types
 * @module @autoecops/shared-types
 * @version 1.0.0
 */

// ============================================================================
// Trace & Correlation
// ============================================================================
export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  sessionId?: string;
  baggage?: Record<string, string>;
}

// ============================================================================
// Identity & Authorization
// ============================================================================
export interface Actor {
  id: string;
  type: 'user' | 'service' | 'system';
  email?: string;
  roles: string[];
  permissions: string[];
  tenantId?: string;
}

export interface JWTPayload {
  sub: string;
  iss: string;
  aud: string | string[];
  exp: number;
  iat: number;
  jti: string;
  roles: string[];
  permissions: string[];
  tenantId?: string;
  sessionId: string;
}

export interface AuthContext {
  actor: Actor;
  token: string;
  trace: TraceContext;
  issuedAt: Date;
  expiresAt: Date;
}

// ============================================================================
// Event Bus
// ============================================================================
export type EventPriority = 'critical' | 'high' | 'normal' | 'low';

export interface DomainEvent<T = unknown> {
  id: string;
  type: string;
  source: string;
  specVersion: '1.0';
  time: string;
  dataContentType: 'application/json';
  subject?: string;
  traceId: string;
  actor: Pick<Actor, 'id' | 'type'>;
  resource: {
    kind: string;
    id: string;
    namespace?: string;
  };
  policyDecision?: PolicyDecision;
  idempotencyKey: string;
  priority: EventPriority;
  data: T;
}

// ============================================================================
// Policy & Audit
// ============================================================================
export type PolicyVerdict = 'allow' | 'deny' | 'warn';

export interface PolicyDecision {
  verdict: PolicyVerdict;
  policyId: string;
  policyVersion: string;
  reason: string;
  complianceTags: string[];
  evaluatedAt: string;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  traceId: string;
  actor: Pick<Actor, 'id' | 'type' | 'email'>;
  resource: {
    kind: string;
    id: string;
    namespace?: string;
  };
  action: string;
  result: 'success' | 'failure' | 'denied';
  policyDecision?: PolicyDecision;
  complianceTags: string[];
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Structured Logging
// ============================================================================
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface StructuredLog {
  timestamp: string;
  level: LogLevel;
  traceId: string;
  spanId: string;
  service: string;
  platformId: string;
  action: string;
  decision?: PolicyVerdict;
  message: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Health & Readiness
// ============================================================================
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface HealthCheck {
  status: HealthStatus;
  version: string;
  uptime: number;
  timestamp: string;
  checks: Record<string, {
    status: HealthStatus;
    latencyMs: number;
    message?: string;
  }>;
}

// ============================================================================
// API Response Envelope
// ============================================================================
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    requestId: string;
    traceId: string;
    timestamp: string;
    pagination?: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  };
}

// ============================================================================
// Memory Hub
// ============================================================================
export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  embedding?: number[];
  metadata: {
    source: string;
    page?: number;
    chunkIndex: number;
    totalChunks: number;
    modelVersion: string;
  };
  createdAt: string;
}

export interface SearchResult {
  chunk: DocumentChunk;
  score: number;
  highlights?: string[];
}

// ============================================================================
// Infra Manager
// ============================================================================
export type SyncStatus = 'synced' | 'out-of-sync' | 'progressing' | 'degraded' | 'unknown';

export interface InfraState {
  clusterId: string;
  namespace: string;
  application: string;
  syncStatus: SyncStatus;
  healthStatus: HealthStatus;
  revision: string;
  lastSyncedAt: string;
  driftDetected: boolean;
  driftDetails?: string[];
}

// ============================================================================
// Configuration
// ============================================================================
export interface ServiceConfig {
  serviceName: string;
  version: string;
  environment: 'development' | 'staging' | 'production';
  port: number;
  logLevel: LogLevel;
  auth: {
    issuerUrl: string;
    audience: string;
    jwksUri: string;
  };
  database?: {
    host: string;
    port: number;
    name: string;
    ssl: boolean;
    poolMin: number;
    poolMax: number;
  };
  redis?: {
    host: string;
    port: number;
    password?: string;
    tls: boolean;
  };
  observability: {
    metricsPort: number;
    tracingEndpoint: string;
    tracingSampleRate: number;
  };
}
