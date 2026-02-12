import pino from 'pino';

export const logger = pino({
  name: 'policy-audit',
  level: process.env.LOG_LEVEL ?? 'info',
  formatters: {
    level(label: string) { return { level: label }; },
    bindings() { return { service: 'policy-audit', platformId: 'core' }; },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  serializers: { err: pino.stdSerializers.err, req: pino.stdSerializers.req, res: pino.stdSerializers.res },
  redact: { paths: ['req.headers.authorization', '*.password'], censor: '[REDACTED]' },
});
