import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { errorCode, isDefinitiveError, shouldRetryQuery } from './query-retry';
import { normalizeApiError } from './normalizeApiError';
import { TimeoutError } from './withTimeout';

// `normalizeApiError` trace le détail serveur dans Sentry ; sans client
// initialisé c'est un no-op, mais on garde la console propre.
beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

describe('errorCode', () => {
  it('lit le code d\'une ApiError', () => {
    expect(errorCode(normalizeApiError({ code: '42501', message: 'denied' }))).toBe('42501');
  });

  it('lit AUSSI le code d\'une PostgrestError brute, non normalisée', () => {
    expect(errorCode({ code: 'PGRST301', message: 'JWT expired' })).toBe('PGRST301');
  });

  it('rend null quand il n\'y a pas de code exploitable', () => {
    expect(errorCode(new Error('boom'))).toBeNull();
    expect(errorCode('boom')).toBeNull();
    expect(errorCode(null)).toBeNull();
    expect(errorCode({ code: '' })).toBeNull();
  });
});

describe('isDefinitiveError — un échec NOMMÉ par le serveur ne se rejoue pas', () => {
  it.each(['42501', 'PGRST116', 'PGRST301', '23505', '23503', 'seat_limit_reached', 'expired_link'])(
    '%s est définitif',
    (code) => {
      expect(isDefinitiveError(normalizeApiError({ code, message: 'x' }))).toBe(true);
    },
  );

  it.each(['NETWORK_ERROR', 'GENERIC_ERROR'])('%s reste rejouable (cause inconnue)', (code) => {
    expect(isDefinitiveError(normalizeApiError({ code, message: 'x' }))).toBe(false);
  });

  it('une erreur sans code n\'est pas définitive', () => {
    expect(isDefinitiveError(new Error('boom'))).toBe(false);
  });
});

describe('shouldRetryQuery', () => {
  it('ne retente jamais au-delà du premier échec', () => {
    expect(shouldRetryQuery(1, new Error('boom'))).toBe(false);
    expect(shouldRetryQuery(2, new Error('boom'))).toBe(false);
  });

  it('retente une fois une cause inconnue', () => {
    expect(shouldRetryQuery(0, new Error('boom'))).toBe(true);
  });

  it('retente une coupure réseau — elle, elle peut passer au second essai', () => {
    const networkError = normalizeApiError(new Error('Failed to fetch'));
    expect(networkError.code).toBe('NETWORK_ERROR');
    expect(shouldRetryQuery(0, networkError)).toBe(true);
  });

  // ── La régression que ce module existe pour empêcher ──
  //
  // Avant le correctif : `error instanceof Error` était faux (objet littéral),
  // et le test portait sur le message traduit. Les deux gardes ci-dessous
  // échouaient donc, et un refus RLS repartait pour un tour.
  it('ne retente PAS un refus RLS (42501)', () => {
    expect(shouldRetryQuery(0, normalizeApiError({ code: '42501', message: 'row-level security' }))).toBe(false);
  });

  it('ne retente PAS une erreur PostgREST', () => {
    expect(shouldRetryQuery(0, normalizeApiError({ code: 'PGRST116', message: 'not found' }))).toBe(false);
  });

  it('ne retente PAS un refus métier promu depuis un RAISE EXCEPTION', () => {
    const refusal = normalizeApiError({ code: 'P0001', message: 'seat_limit_reached' });
    expect(refusal.code).toBe('seat_limit_reached');
    expect(shouldRetryQuery(0, refusal)).toBe(false);
  });

  it('ne retente PAS un dépassement de délai (fail-fast iOS)', () => {
    expect(shouldRetryQuery(0, new TimeoutError('Délai dépassé'))).toBe(false);
  });

  it('ne retente PAS un abandon du navigateur', () => {
    expect(shouldRetryQuery(0, new DOMException('The operation was aborted.', 'AbortError'))).toBe(false);
  });
});
