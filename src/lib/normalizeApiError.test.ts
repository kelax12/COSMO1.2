import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { normalizeApiError } from './normalizeApiError';

// normalizeApiError logs the original (server) detail via console.error — silence
// it in tests and assert the public `message` never leaks raw server text (V7/N1).
beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

describe('normalizeApiError — whitelisted codes', () => {
  it.each([
    ['23505', 'Cette ressource existe déjà.'],
    ['23503', 'Action impossible en raison de dépendances existantes.'],
    ['PGRST116', 'La ressource demandée est introuvable.'],
    ['rate_limit_exceeded', 'Trop de requêtes. Veuillez patienter un instant.'],
  ])('maps %s to its friendly message', (code, expected) => {
    const out = normalizeApiError({ code, message: 'internal detail' });
    expect(out.code).toBe(code);
    expect(out.message).toBe(expected);
  });
});

describe('normalizeApiError — never leaks raw server message (V7)', () => {
  it('keeps the generic message for an unknown code and stashes the raw one in originalMessage only', () => {
    const raw =
      'duplicate key value violates unique constraint "subscriptions_user_id_key"';
    const out = normalizeApiError({ code: 'XX999', message: raw });
    expect(out.message).toBe('Une erreur inattendue est survenue.');
    expect(out.message).not.toContain('subscriptions_user_id_key');
    expect(out.originalMessage).toBe(raw);
  });

  it('unwraps a nested { error: { code } } shape', () => {
    const out = normalizeApiError({ error: { code: '23505', message: 'x' } });
    expect(out.code).toBe('23505');
    expect(out.message).toBe('Cette ressource existe déjà.');
  });

  it('classifies fetch failures as NETWORK_ERROR', () => {
    const out = normalizeApiError(new Error('Failed to fetch'));
    expect(out.code).toBe('NETWORK_ERROR');
    expect(out.message).toBe('Connexion réseau perdue ou instable.');
  });

  it('does not echo a raw Error message to the UI', () => {
    const out = normalizeApiError(new Error('secret stack at /srv/app.ts:42'));
    expect(out.code).toBe('GENERIC_ERROR');
    expect(out.message).toBe('Une erreur inattendue est survenue.');
    expect(out.originalMessage).toContain('secret stack');
  });

  it('handles a plain string error generically', () => {
    const out = normalizeApiError('boom');
    expect(out.code).toBe('GENERIC_ERROR');
    expect(out.message).toBe('Une erreur inattendue est survenue.');
    expect(out.originalMessage).toBe('boom');
  });
});
