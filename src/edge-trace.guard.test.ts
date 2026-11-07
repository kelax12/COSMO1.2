// OBS-02 : le traçage des Edge Functions n'emporte ni PII, ni dépendance au secret.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_TRACES_SAMPLE_RATE,
  parseSampleRate,
  scrubEvent,
  scrubText,
  wrapHandler,
  type TraceSdk,
  type TraceSpan,
} from '../supabase/functions/_shared/trace-core';

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

const UUID = '3f8b2a4e-9c1d-4e7a-8b5f-0a1b2c3d4e5f';
const EMAIL = 'marie.durand@example.com';

function fakeSdk() {
  const span: TraceSpan & { attrs: Record<string, unknown>; status?: unknown } = {
    attrs: {},
    setAttribute(k, v) { this.attrs[k] = v; },
    setStatus(s) { this.status = s; },
  };
  const spans: { name: string; op: string; attributes?: Record<string, unknown> }[] = [];
  const sdk: TraceSdk = {
    startSpan: (options, cb) => { spans.push(options); return cb(span); },
    captureException: vi.fn(() => 'id'),
    flush: vi.fn(async () => true),
  };
  return { sdk, span, spans };
}

const req = () =>
  new Request(`https://x.supabase.co/functions/v1/stripe-org-portal?email=${EMAIL}`, {
    method: 'POST',
    headers: { Authorization: 'Bearer secret-token-value' },
    body: JSON.stringify({ orgId: UUID }),
  });

describe('parseSampleRate', () => {
  it('défaut bas, valeurs invalides ignorées', () => {
    expect(parseSampleRate(undefined)).toBe(DEFAULT_TRACES_SAMPLE_RATE);
    expect(parseSampleRate('0.25')).toBe(0.25);
    expect(parseSampleRate('5')).toBe(DEFAULT_TRACES_SAMPLE_RATE);
    expect(parseSampleRate('x')).toBe(DEFAULT_TRACES_SAMPLE_RATE);
  });
});

describe('scrubEvent (Edge)', () => {
  const dirty = () => ({
    request: { url: 'https://x/functions/v1/f?token=abc', headers: { authorization: 'Bearer abc' } },
    user: { id: UUID, ip_address: '1.2.3.4' },
    server_name: 'edge-runtime-host',
    transaction: `POST stripe-org-portal ${EMAIL}`,
    exception: {
      values: [{
        value: `echec pour ${EMAIL} client cus_NfAbCdEfGhIj org ${UUID} eyJhbGciOi.eyJzdWIiOi.SflKxwRJSMeKKF2QT4 sk_live_abcdef1234567890`,
      }],
    },
    spans: [{ description: `GET https://api.stripe.com/v1/customers/cus_NfAbCdEfGhIj?email=${EMAIL}` }],
  });
  it('ne laisse partir ni e-mail, ni UUID, ni identifiant Stripe, ni JWT, ni clé', () => {
    const json = JSON.stringify(scrubEvent(dirty()));
    for (const leak of [EMAIL, UUID, 'cus_NfAbCdEfGhIj', 'eyJhbGciOi', 'sk_live_abcdef', '1.2.3.4', 'edge-runtime-host', 'token=abc']) {
      expect(json, leak).not.toContain(leak);
    }
  });
  it('TÉMOIN : l évènement brut les contient', () => {
    const json = JSON.stringify(dirty());
    for (const leak of [EMAIL, UUID, 'cus_NfAbCdEfGhIj', 'sk_live_abcdef', '1.2.3.4']) expect(json).toContain(leak);
  });
  it('scrubText retire la chaîne de requête d une adresse', () => {
    expect(scrubText('voir https://a.b/c?x=1&y=2 fin')).toBe('voir https://a.b/c fin');
  });
});

describe('wrapHandler', () => {
  it('sans SDK, le gestionnaire est appelé tel quel', async () => {
    const handler = vi.fn(async () => new Response('ok'));
    const res = await wrapHandler('f', handler, { load: async () => null })(req());
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
  });
  it('un chargement qui lève ne casse pas la fonction', async () => {
    const res = await wrapHandler('f', async () => new Response('ok'), {
      load: async () => { throw new Error('boom'); },
    })(req());
    expect(await res.text()).toBe('ok');
  });
  it('le span ne porte que le slug, la méthode et le statut : jamais URL, en-tête, corps', async () => {
    const { sdk, span, spans } = fakeSdk();
    await wrapHandler('stripe-org-portal', async () => new Response('x', { status: 502 }), {
      load: async () => sdk,
    })(req());
    expect(spans).toHaveLength(1);
    expect(spans[0].name).toBe('POST stripe-org-portal');
    const json = JSON.stringify([spans, span.attrs]);
    for (const leak of [EMAIL, UUID, 'secret-token-value', 'supabase.co', 'orgId']) expect(json).not.toContain(leak);
    expect(span.attrs['http.response.status_code']).toBe(502);
    expect(span.status).toMatchObject({ code: 2 });
  });
  it('une exception est capturée puis relancée, et le flush part', async () => {
    const { sdk } = fakeSdk();
    const wait = vi.fn();
    const boom = new Error('boom');
    await expect(
      wrapHandler('f', async () => { throw boom; }, { load: async () => sdk, waitUntil: wait })(req()),
    ).rejects.toBe(boom);
    expect(sdk.captureException).toHaveBeenCalledWith(boom, { tags: { 'edge.function': 'f' } });
    expect(wait).toHaveBeenCalledOnce();
  });
});

describe('trace.ts : le branchement', () => {
  const trace = read('supabase/functions/_shared/trace.ts');
  it('DSN absent : gestionnaire rendu tel quel, SDK importé à la demande', () => {
    expect(trace).toMatch(/if \(!Deno\.env\.get\('SENTRY_DSN_EDGE'\)\?\.trim\(\)\) return handler/);
    // Spécificateur littéral : une variable n'entrerait pas dans le graphe déployé.
    expect(trace).toMatch(/await import\('npm:@sentry\/deno@\d+\.\d+\.\d+'\)/);
    expect(trace).not.toMatch(/^import .*@sentry/m);
  });
  it('aucune PII par défaut, aucune intégration par défaut', () => {
    expect(trace).toContain('sendDefaultPii: false');
    expect(trace).toContain('defaultIntegrations: false');
    expect(trace).toContain('beforeSendTransaction');
    expect(trace).toContain('beforeSend:');
  });
  it('aucun attribut de span ne vient d une requête ou d un utilisateur', () => {
    const core = read('supabase/functions/_shared/trace-core.ts').replace(/\/\/.*$/gm, '');
    expect(core).not.toMatch(/req\.(url|headers|json|text|formData)/);
    expect(core).not.toMatch(/user\.id|user_id|customer/i);
  });
});

describe('les fonctions de facturation et delete-account sont tracées', () => {
  const slugs = [
    'delete-account', 'stripe-create-checkout', 'stripe-org-checkout', 'stripe-org-portal',
    'stripe-org-refund', 'stripe-org-subscription', 'stripe-webhook', 'renewal-notice', 'seat-alert',
  ];
  it.each(slugs)('%s', (slug) => {
    const src = read(`supabase/functions/${slug}/index.ts`);
    expect(src).toContain(`Deno.serve(withTrace('${slug}', async (req) => {`);
    expect(src).toContain("import { withTrace } from '../_shared/trace.ts'");
    expect(src).toMatch(/\n\}\)\)\r?\n/);
  });
});
