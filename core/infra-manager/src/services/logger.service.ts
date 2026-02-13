import pino from 'pino';

export const logger = pino({
  name: 'infra-manager',
  level: process.env.LOG_LEVEL ?? 'info',
  formatters: {
    level(label: string) { return { level: label }; },
    bindings() { return { service: 'infra-manager', platformId: 'core' }; },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  serializers: { err: pino.stdSerializers.err },
  redact: { paths: ['*.token', '*.password'], censor: '[REDACTED]' },
});
