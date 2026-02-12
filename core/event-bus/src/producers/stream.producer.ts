import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { logger } from '../middleware/logger';
import type { DomainEvent, EventPriority } from '@autoecops/shared-types';

let redis: Redis;

export function initRedis(): Redis {
  redis = new Redis(config.REDIS_URL, {
    password: config.REDIS_PASSWORD,
    tls: config.REDIS_TLS ? {} : undefined,
    maxRetriesPerRequest: config.REDIS_MAX_RETRIES,
    retryStrategy(times: number) {
      const delay = Math.min(times * 200, 5000);
      return delay;
    },
    lazyConnect: false,
  });

  redis.on('connect', () => logger.info('Redis connected'));
  redis.on('error', (err) => logger.error({ err }, 'Redis error'));
  redis.on('close', () => logger.warn('Redis connection closed'));

  return redis;
}

export function getRedis(): Redis {
  return redis;
}

// ============================================================================
// Deduplication
// ============================================================================
async function isDuplicate(idempotencyKey: string): Promise<boolean> {
  const dedupKey = `dedup:${idempotencyKey}`;
  const exists = await redis.exists(dedupKey);
  return exists === 1;
}

async function markProcessed(idempotencyKey: string): Promise<void> {
  const dedupKey = `dedup:${idempotencyKey}`;
  await redis.setex(dedupKey, config.DEDUP_WINDOW_SECONDS, '1');
}

// ============================================================================
// Publish Event
// ============================================================================
export interface PublishOptions {
  streamName: string;
  maxLen?: number;
}

export async function publishEvent<T>(
  event: Omit<DomainEvent<T>, 'id' | 'specVersion' | 'time' | 'dataContentType'>,
  options: PublishOptions,
): Promise<{ eventId: string; streamId: string }> {
  const { streamName, maxLen = config.STREAM_MAX_LEN } = options;

  // Deduplication check
  if (await isDuplicate(event.idempotencyKey)) {
    logger.info({ idempotencyKey: event.idempotencyKey }, 'Duplicate event detected, skipping');
    return { eventId: event.idempotencyKey, streamId: 'duplicate' };
  }

  const fullEvent: DomainEvent<T> = {
    id: uuidv4(),
    specVersion: '1.0',
    time: new Date().toISOString(),
    dataContentType: 'application/json',
    ...event,
  };

  const fields: Record<string, string> = {
    id: fullEvent.id,
    type: fullEvent.type,
    source: fullEvent.source,
    time: fullEvent.time,
    traceId: fullEvent.traceId,
    actorId: fullEvent.actor.id,
    actorType: fullEvent.actor.type,
    resourceKind: fullEvent.resource.kind,
    resourceId: fullEvent.resource.id,
    idempotencyKey: fullEvent.idempotencyKey,
    priority: fullEvent.priority,
    data: JSON.stringify(fullEvent.data),
  };

  if (fullEvent.subject) fields.subject = fullEvent.subject;
  if (fullEvent.resource.namespace) fields.resourceNamespace = fullEvent.resource.namespace;
  if (fullEvent.policyDecision) fields.policyDecision = JSON.stringify(fullEvent.policyDecision);

  const streamId = await redis.xadd(
    streamName,
    'MAXLEN', '~', maxLen.toString(),
    '*',
    ...Object.entries(fields).flat(),
  );

  await markProcessed(fullEvent.idempotencyKey);

  logger.info(
    {
      eventId: fullEvent.id,
      type: fullEvent.type,
      stream: streamName,
      streamId,
    },
    'Event published',
  );

  return { eventId: fullEvent.id, streamId: streamId! };
}

// ============================================================================
// Replay Events
// ============================================================================
export async function replayEvents(
  streamName: string,
  startId: string = '0-0',
  endId: string = '+',
  count: number = 100,
): Promise<DomainEvent[]> {
  const results = await redis.xrange(streamName, startId, endId, 'COUNT', count);

  return results.map(([_id, fields]) => {
    const fieldMap: Record<string, string> = {};
    for (let i = 0; i < fields.length; i += 2) {
      fieldMap[fields[i]] = fields[i + 1];
    }

    return {
      id: fieldMap.id,
      type: fieldMap.type,
      source: fieldMap.source,
      specVersion: '1.0' as const,
      time: fieldMap.time,
      dataContentType: 'application/json' as const,
      subject: fieldMap.subject,
      traceId: fieldMap.traceId,
      actor: { id: fieldMap.actorId, type: fieldMap.actorType as 'user' | 'service' | 'system' },
      resource: {
        kind: fieldMap.resourceKind,
        id: fieldMap.resourceId,
        namespace: fieldMap.resourceNamespace,
      },
      policyDecision: fieldMap.policyDecision ? JSON.parse(fieldMap.policyDecision) : undefined,
      idempotencyKey: fieldMap.idempotencyKey,
      priority: fieldMap.priority as EventPriority,
      data: JSON.parse(fieldMap.data),
    };
  });
}

export async function shutdownRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    logger.info('Redis disconnected');
  }
}
