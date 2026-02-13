import type { EcosystemClient, RequestOptions } from './client';

export class AuthClient {
  constructor(private readonly client: EcosystemClient) {}

  async verify(token: string, options?: RequestOptions) {
    return this.client.request('POST', '/auth/verify', { token }, options);
  }

  async authorize(permission: string, options?: RequestOptions) {
    return this.client.request('POST', '/auth/authorize', { permission }, options);
  }

  async listRoles(options?: RequestOptions) {
    return this.client.request('GET', '/auth/roles', undefined, options);
  }
}
