import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { withRetry, MAX_RETRIES, BACKOFF_DELAYS } from '../../src/utils/retry.js';

describe('retry constants', () => {
  it('exposes MAX_RETRIES=3', () => {
    expect(MAX_RETRIES).toBe(3);
  });

  it('exposes BACKOFF_DELAYS=[1000,2000,4000]', () => {
    expect(BACKOFF_DELAYS).toEqual([1000, 2000, 4000]);
  });
});

describe('withRetry', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns result immediately if first attempt succeeds', async () => {
    const fn = jest.fn<() => Promise<string>>().mockResolvedValue('ok');
    const promise = withRetry(fn);
    await expect(promise).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and eventually succeeds', async () => {
    const fn = jest
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('fail-1'))
      .mockRejectedValueOnce(new Error('fail-2'))
      .mockResolvedValue('ok');

    const promise = withRetry(fn);
    await jest.advanceTimersByTimeAsync(1000);
    await jest.advanceTimersByTimeAsync(2000);
    await expect(promise).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws after MAX_RETRIES attempts', async () => {
    const err = new Error('always fails');
    const fn = jest.fn<() => Promise<string>>().mockRejectedValue(err);

    const promise = withRetry(fn);
    const assertion = expect(promise).rejects.toThrow('always fails');
    await jest.advanceTimersByTimeAsync(1000);
    await jest.advanceTimersByTimeAsync(2000);
    await jest.advanceTimersByTimeAsync(4000);
    await assertion;
    expect(fn).toHaveBeenCalledTimes(MAX_RETRIES + 1);
  });

  it('waits BACKOFF_DELAYS[0]=1000ms before first retry', async () => {
    const fn = jest
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok');

    const promise = withRetry(fn);
    // Let initial rejection settle
    await Promise.resolve();
    await Promise.resolve();
    expect(fn).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(999);
    expect(fn).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1);
    await expect(promise).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
