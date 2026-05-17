export const MAX_RETRIES = 3;
export const BACKOFF_DELAYS: readonly number[] = [1000, 2000, 4000];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === MAX_RETRIES) {
        break;
      }
      const ms = BACKOFF_DELAYS[attempt] ?? BACKOFF_DELAYS[BACKOFF_DELAYS.length - 1] ?? 1000;
      await delay(ms);
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(typeof lastError === 'string' ? lastError : 'withRetry failed');
}
