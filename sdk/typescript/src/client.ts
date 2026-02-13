import { TracingContext, createTrace } from './tracing';
import { EcosystemError, NetworkError } from './errors';
import { AuthClient } from './auth';
import { MemoryClient } from './memory';
import { EventClient } from './events';
import { PolicyClient } from './policy';
import { InfraClient } from './infra';

export interface ClientConfig {
  baseUrl: string;
  token?: string;
  timeout?: number;
  retries?: number;
  retryDelayMs?: number;
}

export interface RequestOptions {
  tracing?: TracingContext;
  timeout?: number;
  retries?: number;
}

export class EcosystemClient {
  private readonly config: Required<ClientConfig>;
  readonly auth: AuthClient;
  readonly memory: MemoryClient;
  readonly events: EventClient;
  readonly policy: PolicyClient;
  readonly infra: InfraClient;

  constructor(config: ClientConfig) {
    this.config = {
      baseUrl: config.baseUrl.replace(/\/$/, ''),
      token: config.token ?? '',
      timeout: config.timeout ?? 30000,
      retries: config.retries ?? 3,
      retryDelayMs: config.retryDelayMs ?? 1000,
    };

    this.auth = new AuthClient(this);
    this.memory = new MemoryClient(this);
    this.events = new EventClient(this);
    this.policy = new PolicyClient(this);
    this.infra = new InfraClient(this);
  }

  setToken(token: string): void {
    this.config.token = token;
  }

  /**
   * Make an HTTP request to the API.
   * 
   * @template T - Expected response type
   * @param method - HTTP method (GET, POST, etc.)
   * @param path - API endpoint path
   * @param body - Request body (optional)
   * @param options - Request options (retries, timeout, tracing)
   * @returns Promise resolving to response data of type T
   * 
   * @remarks
   * For 204 No Content responses or empty bodies, this method returns `undefined`.
   * When using this method, ensure your type T accounts for potentially undefined values
   * (e.g., use `T | undefined` or optional chaining when the endpoint may return 204).
   * 
   * @throws {EcosystemError} For HTTP errors (4xx/5xx status codes)
   * @throws {NetworkError} For network failures or timeouts
   */
  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options: RequestOptions = {},
  ): Promise<T> {
    const tracing = options.tracing ?? createTrace();
    const maxRetries = options.retries ?? this.config.retries;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        options.timeout ?? this.config.timeout,
      );

      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...tracing.toHeaders(),
        };

        if (this.config.token) {
          headers['Authorization'] = `Bearer ${this.config.token}`;
        }

        const response = await fetch(`${this.config.baseUrl}${path}`, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorBody = await response.text();
          let parsed: { error?: { code?: string; message?: string } } = {};
          try { parsed = JSON.parse(errorBody); } catch { /* noop */ }

          throw new EcosystemError(
            parsed.error?.message ?? `HTTP ${response.status}`,
            parsed.error?.code ?? 'HTTP_ERROR',
            response.status,
            tracing.traceId,
          );
        }

        // Handle 204 No Content and empty responses
        if (response.status === 204) {
          return undefined as T;
        }

        const contentType = response.headers.get('content-type');
        const contentLength = response.headers.get('content-length');
        
        // Return undefined for empty bodies or non-JSON responses
        if (contentLength === '0' || !contentType?.includes('json')) {
          return undefined as T;
        }

        return (await response.json()) as T;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (error instanceof EcosystemError && error.statusCode < 500) {
          throw error; // Don't retry client errors
        }

        if (attempt < maxRetries) {
          const delay = this.config.retryDelayMs * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      } finally {
        clearTimeout(timeoutId);
      }
    }

    throw new NetworkError(
      lastError?.message ?? 'Request failed after retries',
      this.config.baseUrl,
      tracing.traceId,
    );
  }
}
