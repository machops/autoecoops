import type { EcosystemClient, RequestOptions } from './client';

export class PolicyClient {
  constructor(private readonly client: EcosystemClient) {}

  async evaluate(policyPath: string, input: Record<string, unknown>, options?: RequestOptions) {
    return this.client.request('POST', '/policy/evaluate', { policyPath, input }, options);
  }

  async writeAudit(entry: Record<string, unknown>, options?: RequestOptions) {
    return this.client.request('POST', '/audit/write', entry, options);
  }

  async queryAudit(params: Record<string, string>, options?: RequestOptions) {
    const qs = new URLSearchParams(params);
    return this.client.request('GET', `/audit/query?${qs}`, undefined, options);
  }

  async generateReport(framework: string, startTime: string, endTime: string, options?: RequestOptions) {
    return this.client.request('POST', '/reports/compliance', { framework, startTime, endTime }, options);
  }
}
