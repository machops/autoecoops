import { v4 as uuidv4 } from 'uuid';

export class TracingContext {
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId?: string;
  readonly startTime: number;

  constructor(traceId?: string, parentSpanId?: string) {
    this.traceId = traceId ?? uuidv4();
    this.spanId = uuidv4();
    this.parentSpanId = parentSpanId;
    this.startTime = Date.now();
  }

  createChild(): TracingContext {
    return new TracingContext(this.traceId, this.spanId);
  }

  toHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'x-trace-id': this.traceId,
      'x-span-id': this.spanId,
    };
    if (this.parentSpanId) {
      headers['x-parent-span-id'] = this.parentSpanId;
    }
    return headers;
  }

  elapsed(): number {
    return Date.now() - this.startTime;
  }
}

export function createTrace(traceId?: string): TracingContext {
  return new TracingContext(traceId);
}
