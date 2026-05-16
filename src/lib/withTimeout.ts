/**
 * Wraps a promise with a hard timeout. If the promise doesn't resolve or
 * reject within `ms`, it rejects with a clear error message.
 *
 * Used to guard React Query `queryFn`s against indefinitely-hanging
 * Supabase requests — on mobile Safari fetches can stall silently for
 * minutes after a backgrounding event, leaving pages stuck on their
 * loading skeleton. With this wrapper, the query errors out fast and
 * the page's error UI takes over.
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
