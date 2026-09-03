import { translator } from '@/i18n/useT';

/**
 * Code d'erreur stable d'un dépassement de délai.
 *
 * i18n — le prédicat `retry` de React Query (src/App.tsx) identifiait un
 * timeout par `msg.includes('Délai')`, c'est-à-dire par une sous-chaîne du
 * message FR. Traduire ce message aurait cassé silencieusement le fail-fast
 * iOS (retour aux ~17 s de chargement perçu). L'identification passe
 * désormais par ce code, indépendant de la langue.
 */
export const TIMEOUT_ERROR_CODE = 'TIMEOUT';

/** Erreur levée par `withTimeout` — porte `code = 'TIMEOUT'`. */
export class TimeoutError extends Error {
  readonly code = TIMEOUT_ERROR_CODE;

  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * `true` si l'erreur est un dépassement de délai, quelle que soit la langue
 * du message. Reconnaît aussi les abandons produits par le navigateur
 * (AbortController de src/lib/supabase.ts), dont les messages sont en anglais
 * et hors de notre contrôle — eux peuvent rester matchés par sous-chaîne.
 */
export function isTimeoutError(error: unknown): boolean {
  if (error instanceof TimeoutError) return true;
  if (typeof error === 'object' && error !== null && 'code' in error) {
    if ((error as { code?: unknown }).code === TIMEOUT_ERROR_CODE) return true;
  }
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  const msg = error instanceof Error ? error.message : '';
  return /timeout|aborted/i.test(msg);
}

/**
 * Wraps a promise with a hard timeout. If the promise doesn't resolve or
 * reject within `ms`, it rejects with a `TimeoutError`.
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
  message?: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      // Message résolu DANS le timer, et non en valeur par défaut de
      // paramètre : ce module est importé au démarrage, et le littéral
      // français en dur s'affichait tel quel à un anglophone (revue du
      // 2026-09-02, point 24). `errors.api.TIMEOUT` porte déjà la phrase.
      reject(new TimeoutError(message ?? translator('errors').t('api.TIMEOUT')));
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  }) as Promise<T>;
}
