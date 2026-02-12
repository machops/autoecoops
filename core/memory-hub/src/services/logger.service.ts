import pino from 'pino';

export const logger = pino({
  name: 'memory-hub',
  level: process.env.LOG_LEVEL ?? 'info',
  formatters: {
    level(label: string) { return { level: label }; },
    bindings() { return { service: 'memory-hub', platformId: 'core' }; },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  serializers: { err: pino.stdSerializers.err, req: pino.stdSerializers.req, res: pino.stdSerializers.res },
  redact: { paths: ['req.headers.authorization', '*.password', '*.apiKey'], censor: '[REDACTED]' },
});
