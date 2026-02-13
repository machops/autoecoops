import { getRedis } from '../producers/stream.producer';
import { config } from '../config';
import { logger } from '../middleware/logger';

export type EventHandler = (eventData: Record<string, string>, streamId: string) => Promise<void>;

interface ConsumerOptions {
  streamName: string;
  groupName: string;
  consumerName: string;
  handler: EventHandler;
  blockMs?: number;
  count?: number;
}

// ============================================================================
// Consumer Group Management
// ============================================================================
export async function ensureConsumerGroup(streamName: string, groupName: string): Promise<void> {
  const redis = getRedis();
  try {
    await redis.xgroup('CREATE', streamName, groupName, '0', 'MKSTREAM');
    logger.info({ streamName, groupName }, 'Consumer group created');
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('BUSYGROUP')) {
      logger.debug({ streamName, groupName }, 'Consumer group already exists');
    } else {
      throw error;
    }
  }
}

// ============================================================================
// Stream Consumer Loop
// ============================================================================
export async function startConsumer(options: ConsumerOptions): Promise<() => void> {
  const {
    streamName,
    groupName,
    consumerName,
    handler,
    blockMs = config.CONSUMER_BLOCK_MS,
    count = config.CONSUMER_COUNT,
  } = options;

  await ensureConsumerGroup(streamName, groupName);

  let running = true;
  const redis = getRedis();

  const consume = async (): Promise<void> => {
    while (running) {
      try {
        const results = await redis.xreadgroup(
          'GROUP', groupName, consumerName,
          'COUNT', count,
          'BLOCK', blockMs,
          'STREAMS', streamName, '>',
        );

        if (!results) continue;

        for (const [_stream, messages] of results) {
          for (const [messageId, fields] of messages) {
            const fieldMap: Record<string, string> = {};
            for (let i = 0; i < fields.length; i += 2) {
              fieldMap[fields[i]] = fields[i + 1];
            }

            try {
              await handler(fieldMap, messageId);
              await redis.xack(streamName, groupName, messageId);
            } catch (error) {
              logger.error(
                { error, messageId, streamName },
                'Failed to process message',
              );
              await handleFailedMessage(streamName, groupName, messageId, fieldMap);
            }
          }
        }
      } catch (error) {
        if (running) {
          logger.error({ error }, 'Consumer loop error');
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }
  };

  // Process pending messages first
  await processPending(streamName, groupName, consumerName, handler);

  // Start main consumer loop
  consume();

  return () => {
    running = false;
  };
}

// ============================================================================
// Pending Message Recovery
// ============================================================================
async function processPending(
  streamName: string,
  groupName: string,
  consumerName: string,
  handler: EventHandler,
): Promise<void> {
  const redis = getRedis();

  try {
    const pending = await redis.xreadgroup(
      'GROUP', groupName, consumerName,
      'COUNT', 100,
      'STREAMS', streamName, '0',
    );

    if (!pending) return;

    for (const [_stream, messages] of pending) {
      for (const [messageId, fields] of messages) {
        if (!fields || fields.length === 0) continue;

        const fieldMap: Record<string, string> = {};
        for (let i = 0; i < fields.length; i += 2) {
          fieldMap[fields[i]] = fields[i + 1];
        }

        try {
          await handler(fieldMap, messageId);
          await redis.xack(streamName, groupName, messageId);
          logger.info({ messageId }, 'Pending message processed');
        } catch (error) {
          logger.error({ error, messageId }, 'Failed to process pending message');
        }
      }
    }
  } catch (error) {
    logger.error({ error }, 'Failed to process pending messages');
  }
}

// ============================================================================
// Dead Letter Queue
// ============================================================================
async function handleFailedMessage(
  streamName: string,
  groupName: string,
  messageId: string,
  fields: Record<string, string>,
): Promise<void> {
  const redis = getRedis();
  const retryCountKey = `retry:${streamName}:${messageId}`;
  const retryCount = await redis.incr(retryCountKey);
  await redis.expire(retryCountKey, 86400);

  if (retryCount >= config.DLQ_MAX_RETRIES) {
    const dlqStream = `${streamName}${config.DLQ_STREAM_SUFFIX}`;
    await redis.xadd(
      dlqStream,
      '*',
      ...Object.entries({
        ...fields,
        originalStream: streamName,
        originalMessageId: messageId,
        failureCount: retryCount.toString(),
        movedToDlqAt: new Date().toISOString(),
      }).flat(),
    );

    await redis.xack(streamName, groupName, messageId);
    await redis.del(retryCountKey);

    logger.warn(
      { messageId, dlqStream, retryCount },
      'Message moved to DLQ',
    );
  }
}
