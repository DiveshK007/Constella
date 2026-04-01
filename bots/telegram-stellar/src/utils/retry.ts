/**
 * Retry with exponential backoff for blockchain operations.
 */

interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Only retry on these error conditions (default: retry all) */
  retryIf?: (error: unknown) => boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  retryIf: () => true,
};

/**
 * Retry an async operation with exponential backoff.
 *
 * @example
 * const account = await withRetry(() => horizon.loadAccount(address));
 * const result = await withRetry(() => horizon.submitTransaction(tx), { maxAttempts: 2 });
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts?: RetryOptions
): Promise<T> {
  const { maxAttempts, baseDelayMs, maxDelayMs, retryIf } = {
    ...DEFAULT_OPTIONS,
    ...opts,
  };

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry if the error is not retryable
      if (!retryIf(error)) {
        throw error;
      }

      // Don't retry on the last attempt
      if (attempt === maxAttempts) {
        break;
      }

      // Exponential backoff with jitter
      const delay = Math.min(
        baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 500,
        maxDelayMs
      );
      console.log(
        `Retry ${attempt}/${maxAttempts} after ${Math.round(delay)}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Predicate: retry on network/timeout errors but NOT on validation errors.
 * Stellar Horizon returns 400 for invalid transactions — those should not be retried.
 */
export function isRetryableHorizonError(error: unknown): boolean {
  if (error && typeof error === "object") {
    const err = error as Record<string, unknown>;
    // HTTP status from Horizon
    const status = (err.response as Record<string, unknown>)?.status;
    if (typeof status === "number") {
      // 4xx errors are not retryable (bad request, not found, etc.)
      if (status >= 400 && status < 500) return false;
      // 5xx and network errors are retryable
      return true;
    }
    // Network errors (ECONNREFUSED, ETIMEDOUT, etc.)
    const code = err.code;
    if (typeof code === "string" && ["ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN"].includes(code)) {
      return true;
    }
  }
  return true; // Default: retry unknown errors
}
