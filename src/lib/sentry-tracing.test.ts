// OBS-02 : la mesure de performance ne part ni sans consentement, ni avec un
// e-mail, un UUID ou un jeton dans un nom de transaction ou une adresse de span.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CookieConsent } from './cookie-consent';
import {
  DEFAULT_TRACES_SAMPLE_RATE,
  makeTracesSampler,
  parameterizeRoute,
  parseTracesSampleRate,
  scrubTransaction,
  tracingEnabled,
} from './sentry-tracing';

const UUID = '3f8b2a4e-9c1d-4e7a-8b5f-0a1b2c3d4e5f';
const EMAIL = 'marie.durand@example.com';
const TOKEN = 'aB3dE6gH9jK2mN5pQ8sT1vW4yZ7';

describe('parseTracesSampleRate', () => {
  it('lit un taux valide', () => {
    expect(parseTracesSampleRate('0.05')).toBe(0.05);
    expect(parseTracesSampleRate('0')).toBe(0);
    expect(parseTracesSampleRate('1')).toBe(1);
  });
  it('retombe sur 0,1 si absent, vide, illisible ou hors de [0, 1]', () => {
    for (const raw of [undefined, null, '', '  ', 'abc', '5', '-0.2', 'NaN', 'Infinity']) {
      expect(parseTracesSampleRate(raw)).toBe(DEFAULT_TRACES_SAMPLE_RATE);
    }
  });
  it('le défaut est bas', () => {
    expect(DEFAULT_TRACES_SAMPLE_RATE).toBeLessThanOrEqual(0.1);
  });
});

describe('consentement', () => {
  it('seul « accepted » autorise la mesure ; null et refused non', () => {
    expect(tracingEnabled('accepted')).toBe(true);
    expect(tracingEnabled('refused')).toBe(false);
    expect(tracingEnabled(null)).toBe(false);
  });
  it('le sampler suit le consentement à chaque appel', () => {
    let consent: CookieConsent = 'accepted';
    const sampler = makeTracesSampler(0.2, () => consent);
    expect(sampler()).toBe(0.2);
    consent = 'refused';
    expect(sampler()).toBe(0);
    consent = null;
    expect(sampler()).toBe(0);
  });
  it('une transaction est jetée si le consentement est tombé entre le début et l envoi', () => {
    expect(scrubTransaction({ transaction: '/tasks' }, 'refused')).toBeNull();
    expect(scrubTransaction({ transaction: '/tasks' }, null)).toBeNull();
    expect(scrubTransaction({ transaction: '/tasks' }, 'accepted')).not.toBeNull();
  });
});

describe('parameterizeRoute', () => {
  it.each([
    ['/invite/' + TOKEN, '/invite/:token'],
    ['/org-invite/short', '/org-invite/:token'],
    ['/entreprise/okr/' + UUID, '/entreprise/okr/:id'],
    ['/entreprise/projects/42', '/entreprise/projects/:id'],
    ['/blog/mon-article-seo', '/blog/:slug'],
    ['/en/invite/' + TOKEN, '/en/invite/:token'],
    ['/tasks?code=' + TOKEN + '#access_token=' + TOKEN, '/tasks'],
    ['/dashboard', '/dashboard'],
    ['/', '/'],
  ])('%s devient %s', (input, expected) => {
    expect(parameterizeRoute(input)).toBe(expected);
  });
  it('est idempotent', () => {
    const once = parameterizeRoute('/invite/' + TOKEN);
    expect(parameterizeRoute(once)).toBe(once);
  });
  it('masque un e-mail posé dans un segment', () => {
    expect(parameterizeRoute('/x/' + EMAIL)).not.toContain('@');
  });
});

describe('scrubTransaction : aucune PII ne survit', () => {
  const dirty = () => ({
    transaction: `/invite/${TOKEN}?email=${EMAIL}`,
    user: { id: UUID },
    request: {
      url: `https://thecosmo.app/invite/${TOKEN}?code=${TOKEN}&e=${EMAIL}`,
      query_string: `code=${TOKEN}`,
      headers: { Authorization: `Bearer ${TOKEN}` },
      cookies: { a: TOKEN },
    },
    contexts: {
      trace: { data: { 'url.full': `https://thecosmo.app/p/${UUID}?x=${EMAIL}`, 'http.query': EMAIL } },
    },
    spans: [
      {
        description: `GET https://abc.supabase.co/rest/v1/tasks?user_id=eq.${UUID}&email=eq.${EMAIL}`,
        data: {
          url: `https://abc.supabase.co/rest/v1/tasks?user_id=eq.${UUID}`,
          'http.query': `user_id=eq.${UUID}`,
          'url.query': `email=eq.${EMAIL}`,
          'server.address': 'abc.supabase.co',
          'http.response.status_code': 200,
        },
      },
      {
        description: `POST /functions/v1/stripe-org-portal/${UUID}`,
        data: { 'http.url': `/functions/v1/x?token=${TOKEN}` },
      },
    ],
  });

  it('retire e-mail, UUID, jeton et utilisateur de tout l évènement', () => {
    const out = scrubTransaction(dirty(), 'accepted');
    const json = JSON.stringify(out);
    expect(json).not.toContain(EMAIL);
    expect(json).not.toContain(UUID);
    expect(json).not.toContain(TOKEN);
    expect(json).not.toContain('marie');
    expect(out).not.toHaveProperty('user');
    expect(out?.request).not.toHaveProperty('headers');
    expect(out?.request).not.toHaveProperty('cookies');
    expect(out?.request).not.toHaveProperty('query_string');
  });

  it('garde ce qui sert à lire la performance', () => {
    const out = scrubTransaction(dirty(), 'accepted');
    expect(out?.transaction).toBe('/invite/:token');
    expect(out?.spans?.[0].description).toBe('GET https://abc.supabase.co/rest/v1/tasks');
    expect(out?.spans?.[0].data?.['http.response.status_code']).toBe(200);
    expect(out?.spans?.[0].data?.['server.address']).toBe('abc.supabase.co');
  });

  it('TÉMOIN : le même évènement non nettoyé contient bien les trois valeurs', () => {
    const json = JSON.stringify(dirty());
    expect(json).toContain(EMAIL);
    expect(json).toContain(UUID);
    expect(json).toContain(TOKEN);
  });
});

describe('main.tsx : le branchement', () => {
  const main = readFileSync(join(__dirname, '..', 'main.tsx'), 'utf8');
  it('le traçage dépend du consentement et le taux n est plus en dur', () => {
    expect(main).toMatch(/tracingEnabled\(readConsent\(\)\)\s*\?\s*\[tracingIntegration\(Sentry\)\]\s*:\s*\[\]/);
    expect(main).toContain('tracesSampler: makeTracesSampler(tracesSampleRate, readConsent)');
    expect(main).not.toMatch(/tracesSampleRate:\s*0\.\d/);
  });
  it('les transactions passent par scrubTransaction et les routes par parameterizeRoute', () => {
    expect(main).toContain('scrubTransaction(scrubEvent(event), readConsent())');
    expect(main).toContain('parameterizeRoute(options.name)');
  });
});
