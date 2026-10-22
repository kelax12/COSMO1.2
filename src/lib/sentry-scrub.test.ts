import { describe, it, expect } from 'vitest';
import { scrubBreadcrumb, scrubEvent, scrubText, scrubUrl } from './sentry-scrub';

const UUID = '3f2b9c1e-8a4d-4e6f-9b0a-1c2d3e4f5a6b';

describe('scrubText', () => {
  it('masque e-mails et UUID', () => {
    expect(scrubText(`user alex@exemple.fr id ${UUID}`)).toBe('user [email] id [uuid]');
  });
});

describe('scrubUrl', () => {
  it.each([
    ['https://thecosmo.app/invite/abcDEF123', 'https://thecosmo.app/invite/[jeton]'],
    ['/org-invite/zzz-yyy?x=1', '/org-invite/[jeton]?x=1'],
    [`/org-invite/${UUID}`, '/org-invite/[jeton]'],
    ['https://thecosmo.app/dashboard?code=secret123&ok=1', 'https://thecosmo.app/dashboard?code=[filtré]&ok=1'],
    ['/reset-password#access_token=eyJabc&refresh_token=r1&type=recovery', '/reset-password#access_token=[filtré]&refresh_token=[filtré]&type=recovery'],
    ['/tasks?token=t', '/tasks?token=[filtré]'],
  ])('%s', (input, expected) => {
    expect(scrubUrl(input)).toBe(expected);
  });

  // TÉMOIN : une adresse sans secret ressort intacte. Sans lui, un nettoyage
  // qui effacerait tout passerait les cas ci-dessus.
  it('laisse intacte une adresse sans secret', () => {
    expect(scrubUrl('https://thecosmo.app/tasks?view=list#top')).toBe('https://thecosmo.app/tasks?view=list#top');
  });
});

describe('scrubEvent', () => {
  it("nettoie l'URL, la transaction, le message, les exceptions et les fils d'Ariane", () => {
    const event = scrubEvent({
      message: 'échec pour alex@exemple.fr',
      transaction: '/invite/abc',
      request: { url: 'https://thecosmo.app/invite/abc?code=c', query_string: 'code=c' },
      exception: { values: [{ value: `ligne ${UUID}` }] },
      breadcrumbs: [{ message: 'nav', data: { from: '/org-invite/xyz', to: '/dashboard?code=k' } }],
    });
    expect(event.message).toBe('échec pour [email]');
    expect(event.transaction).toBe('/invite/[jeton]');
    expect(event.request?.url).toBe('https://thecosmo.app/invite/[jeton]?code=[filtré]');
    expect(event.request?.query_string).toBeUndefined();
    expect(event.exception?.values?.[0].value).toBe('ligne [uuid]');
    expect(event.breadcrumbs?.[0].data).toEqual({ from: '/org-invite/[jeton]', to: '/dashboard?code=[filtré]' });
  });
});

describe('scrubBreadcrumb', () => {
  it("nettoie l'URL d'une requête fetch", () => {
    const crumb = scrubBreadcrumb({ data: { url: 'https://x.supabase.co/auth/v1/verify?token=abc', method: 'GET' } });
    expect(crumb.data).toEqual({ url: 'https://x.supabase.co/auth/v1/verify?token=[filtré]', method: 'GET' });
  });
});
