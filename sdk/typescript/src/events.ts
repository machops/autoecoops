import type { EcosystemClient, RequestOptions } from './client';

export class EventClient {
  constructor(private readonly client: EcosystemClient) {}

  async publish(event: Record<string, unknown>, streamName: string, options?: RequestOptions) {
    return this.client.request('POST', '/events/publish', { ...event, streamName }, options);
  }

  async replay(streamName: string, startId?: string, count?: number, options?: RequestOptions) {
    const params = new URLSearchParams();
    if (startId) params.set('startId', startId);
    if (count) params.set('count', count.toString());
    return this.client.request('GET', `/events/replay/${streamName}?${params}`, undefined, options);
  }
}
