import { Pool } from 'pg';
import { config } from '../config';
import { logger } from './logger.service';
import type { AuditEntry } from '@autoecops/shared-types';

let pool: Pool;

export async function initAuditStore(): Promise<void> {
  pool = new Pool({
    connectionString: config.DATABASE_URL,
    min: config.DB_POOL_MIN,
    max: config.DB_POOL_MAX,
    ssl: config.DB_SSL ? { rejectUnauthorized: false } : false,
  });

  const client = await pool.connect();
  try {
    // Create immutable audit table (no UPDATE/DELETE triggers)
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        trace_id TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        actor_type TEXT NOT NULL,
        actor_email TEXT,
        resource_kind TEXT NOT NULL,
        resource_id TEXT NOT NULL,
        resource_namespace TEXT,
        action TEXT NOT NULL,
        result TEXT NOT NULL CHECK (result IN ('success', 'failure', 'denied')),
        policy_decision JSONB,
        compliance_tags TEXT[] DEFAULT '{}',
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Partition by month for performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_entries (timestamp DESC)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_trace_id ON audit_entries (trace_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_entries (actor_id, actor_type)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_entries (resource_kind, resource_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_compliance ON audit_entries USING GIN (compliance_tags)
    `);

    // Prevent UPDATE and DELETE on audit_entries (immutability)
    await client.query(`
      CREATE OR REPLACE FUNCTION prevent_audit_modification()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'Audit entries are immutable. UPDATE and DELETE operations are prohibited.';
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS prevent_audit_update ON audit_entries
    `);
    await client.query(`
      CREATE TRIGGER prevent_audit_update
      BEFORE UPDATE OR DELETE ON audit_entries
      FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification()
    `);

    logger.info('Audit store initialized with immutability constraints');
  } finally {
    client.release();
  }
}

// ============================================================================
// Write Audit Entry (append-only)
// ============================================================================
export async function writeAuditEntry(entry: Omit<AuditEntry, 'id'>): Promise<string> {
  const result = await pool.query(
    `INSERT INTO audit_entries
     (timestamp, trace_id, actor_id, actor_type, actor_email, resource_kind, resource_id,
      resource_namespace, action, result, policy_decision, compliance_tags, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING id`,
    [
      entry.timestamp,
      entry.traceId,
      entry.actor.id,
      entry.actor.type,
      entry.actor.email ?? null,
      entry.resource.kind,
      entry.resource.id,
      entry.resource.namespace ?? null,
      entry.action,
      entry.result,
      entry.policyDecision ? JSON.stringify(entry.policyDecision) : null,
      entry.complianceTags,
      entry.metadata ? JSON.stringify(entry.metadata) : '{}',
    ],
  );

  return result.rows[0].id;
}

// ============================================================================
// Query Audit Entries
// ============================================================================
export interface AuditQuery {
  startTime?: string;
  endTime?: string;
  actorId?: string;
  resourceKind?: string;
  resourceId?: string;
  action?: string;
  result?: string;
  complianceTag?: string;
  traceId?: string;
  page?: number;
  pageSize?: number;
}

export async function queryAuditEntries(query: AuditQuery): Promise<{
  entries: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const { page = 1, pageSize = 50 } = query;
  const offset = (page - 1) * pageSize;
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (query.startTime) { conditions.push(`timestamp >= $${paramIdx++}`); params.push(query.startTime); }
  if (query.endTime) { conditions.push(`timestamp <= $${paramIdx++}`); params.push(query.endTime); }
  if (query.actorId) { conditions.push(`actor_id = $${paramIdx++}`); params.push(query.actorId); }
  if (query.resourceKind) { conditions.push(`resource_kind = $${paramIdx++}`); params.push(query.resourceKind); }
  if (query.resourceId) { conditions.push(`resource_id = $${paramIdx++}`); params.push(query.resourceId); }
  if (query.action) { conditions.push(`action = $${paramIdx++}`); params.push(query.action); }
  if (query.result) { conditions.push(`result = $${paramIdx++}`); params.push(query.result); }
  if (query.complianceTag) { conditions.push(`$${paramIdx++} = ANY(compliance_tags)`); params.push(query.complianceTag); }
  if (query.traceId) { conditions.push(`trace_id = $${paramIdx++}`); params.push(query.traceId); }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM audit_entries ${whereClause}`,
    params,
  );
  const total = parseInt(countResult.rows[0].count, 10);

  params.push(pageSize, offset);
  const dataResult = await pool.query(
    `SELECT * FROM audit_entries ${whereClause}
     ORDER BY timestamp DESC
     LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    params,
  );

  const entries: AuditEntry[] = dataResult.rows.map((row) => ({
    id: row.id,
    timestamp: row.timestamp,
    traceId: row.trace_id,
    actor: { id: row.actor_id, type: row.actor_type, email: row.actor_email },
    resource: { kind: row.resource_kind, id: row.resource_id, namespace: row.resource_namespace },
    action: row.action,
    result: row.result,
    policyDecision: row.policy_decision,
    complianceTags: row.compliance_tags,
    metadata: row.metadata,
  }));

  return { entries, total, page, pageSize };
}

export async function healthCheck(): Promise<{ status: string; latencyMs: number }> {
  const start = Date.now();
  try { await pool.query('SELECT 1'); return { status: 'healthy', latencyMs: Date.now() - start }; }
  catch { return { status: 'unhealthy', latencyMs: Date.now() - start }; }
}

export async function shutdownAuditStore(): Promise<void> {
  if (pool) { await pool.end(); logger.info('Audit store pool closed'); }
}
