import pino from 'pino';

export const logger = pino({
  name: 'platform-02',
  level: process.env.LOG_LEVEL ?? 'info',
  formatters: {
    level(label: string) { return { level: label }; },
    bindings() { return { service: 'platform-02-iaops', platformId: 'platform-02' }; },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  serializers: { err: pino.stdSerializers.err },
  redact: { paths: ['*.token', '*.password', '*.secret'], censor: '[REDACTED]' },
});
