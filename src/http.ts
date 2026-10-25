import {
  BMKGError,
  BMKGNetworkError,
  BMKGParseError,
  BMKGTimeoutError,
} from "./errors.js";

export interface HTTPClientOptions {
  baseURL?: string;
  timeout?: number;
  retries?: number;
  userAgent?: string;
}

export interface RetryInfo {
  attempt: number;
  maxRetries: number;
  nextRetryDelay: number;
}

export class HTTPClient {
  private readonly baseURL: string;
  private readonly timeout: number;
  private readonly retries: number;
  private readonly userAgent: string;

  constructor(options: HTTPClientOptions = {}) {
    this.baseURL = options.baseURL ?? "";
    this.timeout = options.timeout ?? 8000;
    this.retries = options.retries ?? 2;
    this.userAgent = options.userAgent ?? "bmkg-ts/1.0.0";
  }

  /**
   * Perform an HTTP GET request with timeout, retry, and backoff.
   */
  async get<T = unknown>(
    path: string,
    options: HTTPClientOptions = {}
  ): Promise<T> {
    const url = path.startsWith("http") ? path : `${this.baseURL}${path}`;
    const timeoutMs = options.timeout ?? this.timeout;
    const maxRetries = options.retries ?? this.retries;
    const lastErr = new Map<number, Error>();

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          signal: abortController.signal,
          headers: {
            "User-Agent": this.userAgent,
            Accept: "application/json, application/xml, text/xml, */*",
          },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const body = await this.safeText(response);
          if (response.status === 429) {
            lastErr.set(
              attempt,
              new BMKGError(
                `Rate limited by BMKG API (HTTP 429). ${body}`,
                response.status,
                "RATE_LIMITED"
              )
            );
            if (attempt < maxRetries) {
              await this.sleep(this.backoffDelay(attempt));
              continue;
            }
            throw lastErr.get(attempt)!;
          }
          if (response.status >= 500) {
            lastErr.set(
              attempt,
              new BMKGError(
                `BMKG API error (HTTP ${response.status}). ${body}`,
                response.status,
                `HTTP_${response.status}`
              )
            );
            if (attempt < maxRetries) {
              await this.sleep(this.backoffDelay(attempt));
              continue;
            }
            throw lastErr.get(attempt)!;
          }
          throw new BMKGError(
            `HTTP ${response.status}: ${body}`,
            response.status,
            `HTTP_${response.status}`
          );
        }

        const contentType = response.headers.get("content-type") ?? "";
        const body = await response.text();

        if (contentType.includes("json")) {
          try {
            return JSON.parse(body) as T;
          } catch (err) {
            throw new BMKGParseError(
              `Failed to parse JSON response: ${(err as Error).message}`,
              body
            );
          }
        }

        if (contentType.includes("xml") || contentType.includes("text/xml")) {
          return body as unknown as T;
        }

        return body as unknown as T;
      } catch (err) {
        clearTimeout(timeoutId);

        if (err instanceof BMKGError || err instanceof BMKGParseError) {
          if (err instanceof BMKGError && err.status === 429) {
            if (attempt < maxRetries) {
              await this.sleep(this.backoffDelay(attempt));
              continue;
            }
          }
          throw err;
        }

        if (err instanceof Error) {
          if (err.name === "AbortError") {
            throw new BMKGTimeoutError(
              `Request timed out after ${timeoutMs}ms`
            );
          }
          if (err.message?.includes("fetch")) {
            lastErr.set(attempt, new BMKGNetworkError(err.message, err));
          } else {
            lastErr.set(attempt, err);
          }
        }
      }

      if (attempt < maxRetries) {
        await this.sleep(this.backoffDelay(attempt));
      }
    }

    throw lastErr.get(maxRetries)!;
  }

  private backoffDelay(attempt: number): number {
    const base = 200;
    const maxDelay = 2000;
    const exponential = Math.min(base * Math.pow(2, attempt), maxDelay);
    const jitter = exponential * 0.5 * Math.random();
    return exponential + jitter;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async safeText(response: Response): Promise<string> {
    try {
      return await response.text();
    } catch {
      return "";
    }
  }
}