export class EcosystemError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly traceId?: string;

  constructor(message: string, code: string, statusCode: number, traceId?: string) {
    super(message);
    this.name = 'EcosystemError';
    this.code = code;
    this.statusCode = statusCode;
    this.traceId = traceId;
  }
}

export class AuthError extends EcosystemError {
  constructor(message: string, traceId?: string) {
    super(message, 'AUTH_ERROR', 401, traceId);
    this.name = 'AuthError';
  }
}

export class PolicyError extends EcosystemError {
  readonly verdict: string;
  readonly policyId: string;

  constructor(message: string, verdict: string, policyId: string, traceId?: string) {
    super(message, 'POLICY_DENIED', 403, traceId);
    this.name = 'PolicyError';
    this.verdict = verdict;
    this.policyId = policyId;
  }
}

export class NetworkError extends EcosystemError {
  readonly service: string;

  constructor(message: string, service: string, traceId?: string) {
    super(message, 'NETWORK_ERROR', 503, traceId);
    this.name = 'NetworkError';
    this.service = service;
  }
}

export class ValidationError extends EcosystemError {
  readonly details: unknown;

  constructor(message: string, details: unknown, traceId?: string) {
    super(message, 'VALIDATION_ERROR', 400, traceId);
    this.name = 'ValidationError';
    this.details = details;
  }
}
