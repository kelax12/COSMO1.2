import { describe, it, expect, vi, afterEach } from 'vitest';
import { withTimeout, TimeoutError, isTimeoutError, TIMEOUT_ERROR_CODE } from './withTimeout';

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

  it('rejects with a TimeoutError carrying the stable code', async () => {
    vi.useFakeTimers();
    const hanging = new Promise<string>(() => {});
    const p = withTimeout(hanging, 1000);
    const assertion = expect(p).rejects.toSatisfy(
      (err: unknown) => err instanceof TimeoutError && (err as TimeoutError).code === TIMEOUT_ERROR_CODE
    );
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });
});

// i18n — `isTimeoutError` remplace un `msg.includes('Délai')` dans le prédicat
// retry de React Query (src/App.tsx). Il doit rester langue-indépendante :
// c'est ce qui garantit le fail-fast iOS après traduction des messages.
describe('isTimeoutError', () => {
  it('recognises a TimeoutError instance', () => {
    expect(isTimeoutError(new TimeoutError('peu importe la langue'))).toBe(true);
  });

  it('recognises a plain object carrying code TIMEOUT', () => {
    expect(isTimeoutError({ code: 'TIMEOUT' })).toBe(true);
  });

  it('recognises a browser AbortError', () => {
    expect(isTimeoutError(new DOMException('The operation was aborted.', 'AbortError'))).toBe(true);
  });

  it('recognises English browser timeout/abort messages', () => {
    expect(isTimeoutError(new Error('Request timeout'))).toBe(true);
    expect(isTimeoutError(new Error('The user aborted a request.'))).toBe(true);
  });

  it('does not flag unrelated errors', () => {
    expect(isTimeoutError(new Error('row-level security'))).toBe(false);
    expect(isTimeoutError({ code: 'PGRST116' })).toBe(false);
    expect(isTimeoutError('une chaîne')).toBe(false);
    expect(isTimeoutError(null)).toBe(false);
  });
});
