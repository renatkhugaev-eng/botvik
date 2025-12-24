/**
 * ══════════════════════════════════════════════════════════════════════════════
 * RETRY UTILITIES WITH EXPONENTIAL BACKOFF
 * ══════════════════════════════════════════════════════════════════════════════
 * 
 * Professional retry logic for unreliable operations:
 * - Exponential backoff with jitter
 * - Configurable retry conditions
 * - Abort signal support
 * - Timeout handling
 * 
 * Usage:
 *   import { retry, retryFetch } from '@/lib/retry';
 *   
 *   const result = await retry(() => fetchData(), {
 *     maxRetries: 3,
 *     baseDelayMs: 1000,
 *   });
 */

import { logger } from "@/lib/logger";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  
  /** Base delay in milliseconds (default: 1000) */
  baseDelayMs?: number;
  
  /** Maximum delay in milliseconds (default: 30000) */
  maxDelayMs?: number;
  
  /** Exponential factor (default: 2) */
  factor?: number;
  
  /** Add random jitter to prevent thundering herd (default: true) */
  jitter?: boolean;
  
  /** Function to determine if error should trigger retry */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  
  /** Called before each retry */
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
  
  /** Abort signal for cancellation */
  signal?: AbortSignal;
  
  /** Operation timeout in milliseconds */
  timeoutMs?: number;
  
  /** Context for logging */
  context?: string;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: unknown;
  attempts: number;
  totalTimeMs: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, "signal" | "context" | "timeoutMs" | "onRetry">> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  factor: 2,
  jitter: true,
  shouldRetry: () => true,
};

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate delay with exponential backoff and optional jitter
 */
function calculateDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  factor: number,
  jitter: boolean
): number {
  // Exponential backoff: baseDelay * factor^attempt
  const exponentialDelay = baseDelayMs * Math.pow(factor, attempt);
  
  // Cap at maximum delay
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs);
  
  // Add jitter (±25% randomness) to prevent thundering herd
  if (jitter) {
    const jitterRange = cappedDelay * 0.25;
    const randomJitter = (Math.random() - 0.5) * 2 * jitterRange;
    return Math.max(0, cappedDelay + randomJitter);
  }
  
  return cappedDelay;
}

/**
 * Sleep for specified milliseconds, respecting abort signal
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("Aborted"));
      return;
    }
    
    const timeout = setTimeout(resolve, ms);
    
    if (signal) {
      signal.addEventListener("abort", () => {
        clearTimeout(timeout);
        reject(new Error("Aborted"));
      }, { once: true });
    }
  });
}

/**
 * Wrap operation with timeout
 */
function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    
    if (signal?.aborted) {
      clearTimeout(timeout);
      reject(new Error("Aborted"));
      return;
    }
    
    operation()
      .then((result) => {
        clearTimeout(timeout);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeout);
        reject(error);
      });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN RETRY FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Retry an async operation with exponential backoff
 * 
 * @example
 * const result = await retry(
 *   () => fetch('/api/data').then(r => r.json()),
 *   {
 *     maxRetries: 3,
 *     baseDelayMs: 1000,
 *     shouldRetry: (error) => error instanceof NetworkError,
 *   }
 * );
 */
export async function retry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const {
    maxRetries = DEFAULT_OPTIONS.maxRetries,
    baseDelayMs = DEFAULT_OPTIONS.baseDelayMs,
    maxDelayMs = DEFAULT_OPTIONS.maxDelayMs,
    factor = DEFAULT_OPTIONS.factor,
    jitter = DEFAULT_OPTIONS.jitter,
    shouldRetry = DEFAULT_OPTIONS.shouldRetry,
    onRetry,
    signal,
    timeoutMs,
    context = "retry",
  } = options;
  
  const startTime = Date.now();
  let lastError: unknown;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Check for abort
    if (signal?.aborted) {
      return {
        success: false,
        error: new Error("Aborted"),
        attempts: attempt,
        totalTimeMs: Date.now() - startTime,
      };
    }
    
    try {
      // Execute operation (with optional timeout)
      const result = timeoutMs
        ? await withTimeout(operation, timeoutMs, signal)
        : await operation();
      
      return {
        success: true,
        data: result,
        attempts: attempt + 1,
        totalTimeMs: Date.now() - startTime,
      };
      
    } catch (error) {
      lastError = error;
      
      // Check if we should retry
      if (attempt >= maxRetries || !shouldRetry(error, attempt)) {
        break;
      }
      
      // Calculate delay
      const delayMs = calculateDelay(attempt, baseDelayMs, maxDelayMs, factor, jitter);
      
      // Log retry
      logger.warn(`[${context}] Retry attempt ${attempt + 1}/${maxRetries}`, {
        error: error instanceof Error ? error.message : String(error),
        delayMs: Math.round(delayMs),
      });
      
      // Call onRetry callback
      onRetry?.(error, attempt + 1, delayMs);
      
      // Wait before retry
      await sleep(delayMs, signal);
    }
  }
  
  return {
    success: false,
    error: lastError,
    attempts: maxRetries + 1,
    totalTimeMs: Date.now() - startTime,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// FETCH WITH RETRY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Fetch with automatic retry for network errors
 * 
 * @example
 * const response = await retryFetch('/api/data', {
 *   method: 'POST',
 *   body: JSON.stringify(data),
 * }, {
 *   maxRetries: 3,
 *   retryOnStatus: [502, 503, 504],
 * });
 */
export async function retryFetch(
  url: string,
  init?: RequestInit,
  options: RetryOptions & {
    /** HTTP status codes to retry on (default: [408, 429, 500, 502, 503, 504]) */
    retryOnStatus?: number[];
  } = {}
): Promise<Response> {
  const {
    retryOnStatus = [408, 429, 500, 502, 503, 504],
    ...retryOptions
  } = options;
  
  const result = await retry(
    async () => {
      const response = await fetch(url, init);
      
      // Throw on retryable status codes
      if (retryOnStatus.includes(response.status)) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response;
    },
    {
      context: `fetch:${url}`,
      shouldRetry: (error) => {
        // Retry on network errors
        if (error instanceof TypeError && error.message.includes("fetch")) {
          return true;
        }
        // Retry on our thrown HTTP errors
        if (error instanceof Error && error.message.startsWith("HTTP ")) {
          return true;
        }
        return false;
      },
      ...retryOptions,
    }
  );
  
  if (!result.success) {
    throw result.error;
  }
  
  return result.data!;
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export default retry;

