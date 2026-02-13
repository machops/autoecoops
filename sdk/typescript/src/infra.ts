import type { EcosystemClient, RequestOptions } from './client';

export class InfraClient {
  constructor(private readonly client: EcosystemClient) {}

  async getApplication(name: string, options?: RequestOptions) {
    return this.client.request('GET', `/infra/applications/${name}`, undefined, options);
  }

  async sync(name: string, revision?: string, prune = false, options?: RequestOptions) {
    return this.client.request('POST', `/infra/applications/${name}/sync`, { revision, prune }, options);
  }

  async rollback(name: string, targetRevision: number, options?: RequestOptions) {
    return this.client.request('POST', `/infra/applications/${name}/rollback`, { targetRevision }, options);
  }

  async checkDrift(options?: RequestOptions) {
    return this.client.request('GET', '/infra/drift', undefined, options);
  }
}
