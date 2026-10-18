import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler from '../collect';

/**
 * Le collecteur est le SEUL chemin d'écriture de la mesure d'audience depuis
 * la mig. 223 (finding TR-1) : `track_hit` n'est plus exécutable que par
 * `service_role`. Ce qui compte ici est donc ce qu'il refuse AVANT d'appeler
 * la base, et la clé avec laquelle il l'appelle.
 *
 * Dossier `__tests__` : Vercel ne fait pas une fonction d'un chemin de `api/`
 * qui commence par un tiret bas. Un `api/collect.test.ts` serait déployé.
 */

const HOTE = 'cosmo.example';
const URL_SUPABASE = 'https://projet.supabase.co';
const SECRETE = 'sb_secret_TEMOIN_ne_doit_jamais_sortir';
const PUBLIQUE = 'cle_publique_anon_TEMOIN';
const NAVIGATEUR =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';

interface Options {
  method?: string;
  origin?: string | null;
  body?: string;
  ua?: string;
  headers?: Record<string, string>;
}

function requete({ method = 'POST', origin = `https://${HOTE}`, body, ua = NAVIGATEUR, headers = {} }: Options = {}) {
  const h = new Headers({
    host: HOTE,
    'user-agent': ua,
    'x-forwarded-for': '203.0.113.7, 10.0.0.1',
    'x-vercel-ip-country': 'FR',
    'x-vercel-ip-city': 'Saint-%C3%89tienne',
    ...headers,
  });
  if (origin !== null) h.set('origin', origin);
  const contenu = body ?? JSON.stringify({ kind: 'view', path: '/blog', lang: 'fr-FR' });
  return new Request(`https://${HOTE}/api/collect`, { method, headers: h, body: method === 'GET' ? undefined : contenu });
}

const rpc = vi.fn(async (_url: string, _init: RequestInit) => new Response('true', { status: 200 }));

/** Le seul appel sortant, décodé. */
function appel() {
  expect(rpc).toHaveBeenCalledTimes(1);
  const [url, init] = rpc.mock.calls[0];
  return {
    url,
    method: init.method,
    headers: new Headers(init.headers),
    p: (JSON.parse(String(init.body)) as { p: Record<string, unknown> }).p,
    brut: String(init.body),
  };
}

beforeEach(() => {
  vi.stubEnv('VITE_SUPABASE_URL', URL_SUPABASE);
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', PUBLIQUE);
  vi.stubEnv('SUPABASE_SECRET_KEY', SECRETE);
  vi.stubGlobal('fetch', rpc);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ce que le collecteur refuse avant tout appel à la base', () => {
  it('405 hors POST', async () => {
    expect((await handler(requete({ method: 'GET' }))).status).toBe(405);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('403 sans origine, pour une origine étrangère ou illisible', async () => {
    for (const origin of [null, 'https://evil.example', 'null', 'pas une url']) {
      expect((await handler(requete({ origin }))).status, String(origin)).toBe(403);
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it('413 au-delà de 2 Ko, comptés en octets et non en caractères', async () => {
    const corps = (rempli: string) => JSON.stringify({ kind: 'view', path: `/${rempli}` });
    const ascii = corps('a'.repeat(2048));
    expect((await handler(requete({ body: ascii }))).status).toBe(413);
    // 1 100 « é » : moins de 2 048 caractères, plus de 2 048 octets (deux chacun).
    const accents = corps('é'.repeat(1100));
    expect(accents.length).toBeLessThan(2048);
    expect(new TextEncoder().encode(accents).length).toBeGreaterThan(2048);
    expect((await handler(requete({ body: accents }))).status).toBe(413);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('413 sur un Content-Length annoncé trop grand, sans lire le corps', async () => {
    const res = await handler(requete({ headers: { 'content-length': '9999999' } }));
    expect(res.status).toBe(413);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('400 sur un type inconnu, un JSON invalide ou qui n est pas un objet', async () => {
    for (const body of [JSON.stringify({ kind: 'drop', path: '/' }), '{', 'null', '[]', '"view"']) {
      expect((await handler(requete({ body }))).status, body).toBe(400);
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it('204 pour un robot ou un user-agent vide, sans appel à la RPC', async () => {
    for (const ua of ['Googlebot/2.1 (+http://www.google.com/bot.html)', 'curl/8.4.0', '']) {
      expect((await handler(requete({ ua }))).status, ua).toBe(204);
    }
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('le seul appel en écriture', () => {
  it('appelle track_hit avec la clé SECRÈTE, jamais avec la clé publique', async () => {
    expect((await handler(requete())).status).toBe(204);
    const a = appel();
    expect(a.url).toBe(`${URL_SUPABASE}/rest/v1/rpc/track_hit`);
    expect(a.method).toBe('POST');
    expect(a.headers.get('apikey')).toBe(SECRETE);
    // Une clé `sb_secret_` n'est pas un JWT : en Bearer, la plateforme la rejette.
    expect(a.headers.get('authorization')).toBeNull();
    expect([...a.headers.values()].join(' ')).not.toContain(PUBLIQUE);
    expect(a.brut).not.toContain(SECRETE);
  });

  it('transmet ce que seul le serveur sait, et la première IP de la chaîne', async () => {
    await handler(requete());
    const { p } = appel();
    expect(p).toMatchObject({
      kind: 'view',
      path: '/blog',
      lang: 'fr-FR',
      ip: '203.0.113.7',
      ua: NAVIGATEUR,
      country: 'FR',
      city: 'Saint-Étienne',
      browser: 'Chrome',
      device: 'desktop',
    });
  });

  it('une ancienne clé service_role (un JWT) part aussi en Bearer', async () => {
    vi.stubEnv('SUPABASE_SECRET_KEY', 'eyJhbGciOiJIUzI1NiJ9.e30.signature');
    await handler(requete());
    const { headers } = appel();
    expect(headers.get('apikey')).toBe('eyJhbGciOiJIUzI1NiJ9.e30.signature');
    expect(headers.get('authorization')).toBe('Bearer eyJhbGciOiJIUzI1NiJ9.e30.signature');
  });

  it('503 sans clé secrète, sans repli sur la clé publique', async () => {
    vi.stubEnv('SUPABASE_SECRET_KEY', '');
    expect((await handler(requete())).status).toBe(503);
    vi.stubEnv('SUPABASE_SECRET_KEY', SECRETE);
    vi.stubEnv('VITE_SUPABASE_URL', '');
    expect((await handler(requete())).status).toBe(503);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('502 quand la base refuse ou ne répond pas, et le journal ne porte jamais la clé', async () => {
    rpc.mockResolvedValueOnce(new Response('{"code":"42501"}', { status: 401 }));
    expect((await handler(requete())).status).toBe(502);
    rpc.mockRejectedValueOnce(new Error('réseau'));
    expect((await handler(requete())).status).toBe(502);
    const journal = vi.mocked(console.error).mock.calls.flat().join(' ');
    expect(journal).toContain('401');
    expect(journal).not.toContain(SECRETE);
  });

  it('204 quand la RPC écarte l évènement (plafond atteint) : ce n est pas une panne', async () => {
    rpc.mockResolvedValueOnce(new Response('false', { status: 200 }));
    expect((await handler(requete())).status).toBe(204);
  });
});
