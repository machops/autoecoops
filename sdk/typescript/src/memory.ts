import type { EcosystemClient, RequestOptions } from './client';

export class MemoryClient {
  constructor(private readonly client: EcosystemClient) {}

  async search(query: string, topK = 10, filters?: Record<string, string>, options?: RequestOptions) {
    return this.client.request('POST', '/memory/search', { query, topK, filters }, options);
  }

  async getDocument(documentId: string, options?: RequestOptions) {
    return this.client.request('GET', `/memory/documents/${documentId}`, undefined, options);
  }
}
