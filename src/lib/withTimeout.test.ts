import { describe, it, expect, vi, afterEach } from 'vitest';
import { withTimeout } from './withTimeout';

afterEach(() => vi.useRealTimers());

describe('withTimeout', () => {
  it('resolves with the value when the promise settles in time', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 1000)).resolves.toBe('ok');
  });

  it('propagates rejection from the inner promise', async () => {
    await expect(withTimeout(Promise.reject(new Error('inner')), 1000)).rejects.toThrow('inner');
  });

  it('rejects with the timeout message when the promise hangs past ms', async () => {
    vi.useFakeTimers();
    const hanging = new Promise<string>(() => {});
    const p = withTimeout(hanging, 1000, 'boom');
    const assertion = expect(p).rejects.toThrow('boom');
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });
});
