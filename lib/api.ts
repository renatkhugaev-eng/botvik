/**
 * API client with automatic Telegram authentication and retry support
 * 
 * Features:
 * - Automatic Telegram initData authentication
 * - Retry with exponential backoff for network errors
 * - Configurable retry behavior
 * 
 * Usage:
 * ```ts
 * import { api } from "@/lib/api";
 * 
 * const data = await api.get("/api/leaderboard");
 * const result = await api.post("/api/quiz/1/answer", { optionId: 1 });
 * 
 * // With retry options
 * const data = await api.get("/api/data", { retry: { maxRetries: 5 } });
 * ```
 */

function getInitData(): string | null {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const telegram = (window as any).Telegram;
  return telegram?.WebApp?.initData || null;
}

// ═══════════════════════════════════════════════════════════════════════════
// RETRY CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

type RetryConfig = {
  /** Maximum retry attempts (default: 2) */
  maxRetries?: number;
  /** Base delay in ms (default: 500) */
  baseDelayMs?: number;
  /** HTTP status codes to retry (default: [408, 429, 500, 502, 503, 504]) */
  retryOnStatus?: number[];
  /** Disable retry entirely */
  disabled?: boolean;
};

const DEFAULT_RETRY: Required<RetryConfig> = {
  maxRetries: 2,
  baseDelayMs: 500,
  retryOnStatus: [408, 429, 500, 502, 503, 504],
  disabled: false,
};

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function calculateBackoff(attempt: number, baseMs: number): number {
  // Exponential backoff with jitter: base * 2^attempt + random(0-base)
  const exponential = baseMs * Math.pow(2, attempt);
  const jitter = Math.random() * baseMs;
  return Math.min(exponential + jitter, 30000); // Cap at 30 seconds
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type FetchOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: unknown;
  headers?: Record<string, string>;
  cache?: RequestCache;
  retry?: RetryConfig;
};

// ═══════════════════════════════════════════════════════════════════════════
// CORE FETCH WITH RETRY
// ═══════════════════════════════════════════════════════════════════════════

async function apiFetch<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const { method = "GET", body, headers = {}, cache, retry = {} } = options;
  
  const retryConfig = { ...DEFAULT_RETRY, ...retry };
  const initData = getInitData();
  
  const fetchHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...headers,
  };
  
  // Add Telegram auth header if available
  if (initData) {
    fetchHeaders["X-Telegram-Init-Data"] = initData;
  }
  
  let lastError: Error | null = null;
  const maxAttempts = retryConfig.disabled ? 1 : retryConfig.maxRetries + 1;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(url, {
        method,
        headers: fetchHeaders,
        body: body ? JSON.stringify(body) : undefined,
        cache,
      });
      
      // Check if we should retry this status
      if (!response.ok) {
        const shouldRetry = 
          !retryConfig.disabled &&
          attempt < retryConfig.maxRetries &&
          retryConfig.retryOnStatus.includes(response.status);
        
        if (shouldRetry) {
          const delay = calculateBackoff(attempt, retryConfig.baseDelayMs);
          console.warn(`[API] Retry ${attempt + 1}/${retryConfig.maxRetries} for ${url} (${response.status}), waiting ${Math.round(delay)}ms`);
          await sleep(delay);
          continue;
        }
        
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(response.status, errorData.error || "Request failed", errorData);
      }
      
      return response.json();
      
    } catch (error) {
      lastError = error as Error;
      
      // Only retry on network errors, not API errors
      const isNetworkError = error instanceof TypeError && error.message.includes("fetch");
      const shouldRetry = 
        !retryConfig.disabled &&
        isNetworkError &&
        attempt < retryConfig.maxRetries;
      
      if (shouldRetry) {
        const delay = calculateBackoff(attempt, retryConfig.baseDelayMs);
        console.warn(`[API] Retry ${attempt + 1}/${retryConfig.maxRetries} for ${url} (network error), waiting ${Math.round(delay)}ms`);
        await sleep(delay);
        continue;
      }
      
      throw error;
    }
  }
  
  throw lastError || new Error("Request failed after retries");
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const api = {
  get: <T>(url: string, options?: Omit<FetchOptions, "method" | "body">) =>
    apiFetch<T>(url, { ...options, method: "GET" }),
    
  post: <T>(url: string, body?: unknown, options?: Omit<FetchOptions, "method" | "body">) =>
    apiFetch<T>(url, { ...options, method: "POST", body }),
    
  put: <T>(url: string, body?: unknown, options?: Omit<FetchOptions, "method" | "body">) =>
    apiFetch<T>(url, { ...options, method: "PUT", body }),
    
  patch: <T>(url: string, body?: unknown, options?: Omit<FetchOptions, "method" | "body">) =>
    apiFetch<T>(url, { ...options, method: "PATCH", body }),
    
  delete: <T>(url: string, options?: Omit<FetchOptions, "method" | "body">) =>
    apiFetch<T>(url, { ...options, method: "DELETE" }),
};

/**
 * Legacy fetch with auth headers (for gradual migration)
 */
export function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const initData = getInitData();
  
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  
  if (initData) {
    headers.set("X-Telegram-Init-Data", initData);
  }
  
  return fetch(url, {
    ...options,
    headers,
  });
}

