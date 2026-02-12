import pino from 'pino';

export const logger = pino({
  name: 'platform-03',
  level: process.env.LOG_LEVEL ?? 'info',
  formatters: {
    level(label: string) { return { level: label }; },
    bindings() { return { service: 'platform-03-machine-native-ops', platformId: 'platform-03' }; },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  serializers: { err: pino.stdSerializers.err },
  redact: { paths: ['*.token', '*.password'], censor: '[REDACTED]' },
});
