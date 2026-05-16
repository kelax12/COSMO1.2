/**
 * Wraps a promise with a hard timeout. If the promise doesn't resolve or
 * reject within `ms`, it rejects with a clear error message.
 *
 * Belt-and-suspenders with the fetch-level AbortController in
 * `src/lib/supabase.ts` (8 s per HTTP request). That inner timeout trips
 * first and produces a concrete AbortError React Query can retry on a fresh
 * socket; this outer 10 s wrapper is the safety net if a `queryFn` ever runs
 * code other than a Supabase fetch (e.g. LocalStorage in demo mode) that
 * could still hang.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number = 10_000,
  message = 'Délai d\'attente dépassé. Vérifie ta connexion.'
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  }) as Promise<T>;
}
