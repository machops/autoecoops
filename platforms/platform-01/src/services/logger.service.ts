import pino from 'pino';

export const logger = pino({
  name: 'platform-01',
  level: process.env.LOG_LEVEL ?? 'info',
  formatters: {
    level(label: string) { return { level: label }; },
    bindings() { return { service: 'platform-01-indestructible-autoops', platformId: 'platform-01' }; },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  serializers: { err: pino.stdSerializers.err, req: pino.stdSerializers.req, res: pino.stdSerializers.res },
  redact: { paths: ['req.headers.authorization', '*.password', '*.token'], censor: '[REDACTED]' },
});
