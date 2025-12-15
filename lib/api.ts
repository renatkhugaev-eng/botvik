/**
 * API client with automatic Telegram authentication
 * 
 * Usage:
 * ```ts
 * import { api } from "@/lib/api";
 * 
 * const data = await api.get("/api/leaderboard");
 * const result = await api.post("/api/quiz/1/answer", { optionId: 1 });
 * ```
 */

function getInitData(): string | null {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const telegram = (window as any).Telegram;
  return telegram?.WebApp?.initData || null;
}

type FetchOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: unknown;
  headers?: Record<string, string>;
  cache?: RequestCache;
};

async function apiFetch<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const { method = "GET", body, headers = {}, cache } = options;
  
  const initData = getInitData();
  
  const fetchHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...headers,
  };
  
  // Add Telegram auth header if available
  if (initData) {
    fetchHeaders["X-Telegram-Init-Data"] = initData;
  }
  
  const response = await fetch(url, {
    method,
    headers: fetchHeaders,
    body: body ? JSON.stringify(body) : undefined,
    cache,
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(response.status, errorData.error || "Request failed", errorData);
  }
  
  return response.json();
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

