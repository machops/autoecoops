import pino from 'pino';

const SERVICE_NAME = 'auth-service';
const PLATFORM_ID = 'core';

export const logger = pino({
  name: SERVICE_NAME,
  level: process.env.LOG_LEVEL ?? 'info',
  formatters: {
    level(label: string) {
      return { level: label };
    },
    bindings() {
      return {
        service: SERVICE_NAME,
        platformId: PLATFORM_ID,
      };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.secret'],
    censor: '[REDACTED]',
  },
});
