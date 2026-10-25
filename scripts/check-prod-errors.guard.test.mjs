// ═══════════════════════════════════════════════════════════════════
// TÉMOIN · `check-prod-errors.mjs` (OBSERVABILITE AM-1, AM-2, AM-3)
// ═══════════════════════════════════════════════════════════════════
//
// La garde ne tourne que dans un job planifié, avec trois jetons, contre
// trois services distants. Personne ne la voit échouer sur une PR : une
// expression cassée dedans ne se découvrirait que le jour où la production
// se trompe, et elle répondrait « rien de plus que d'habitude ».
//
// Ce fichier n'appelle AUCUN service : il teste les fonctions pures
// (DSN, familles, agrégats, comparaison) et injecte un `fetch` factice pour
// la pagination et les réponses en erreur.
//
// ⚠️ CE QU'IL NE PROUVE PAS : que les API distantes répondent la forme
// supposée ici. Celle de Supabase a été relevée le 2026-10-23 ; celles de
// Sentry et de Vercel suivent leur documentation et la CLI officielle, et
// c'est le premier run planifié qui les confirmera.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  FAMILLES,
  SONDES_UPTIME,
  SQL_SUPABASE,
  LIGNES_MAX_SUPABASE,
  jetonsManquants,
  sentryDepuisDsn,
  resumerSentry,
  lireSentry,
  normaliserChemin,
  classer,
  agregerSupabase,
  lireSupabase,
  agregerVercel,
  lireVercel,
  comparer,
} from './check-prod-errors.mjs';

const ENV_COMPLET = {
  SENTRY_AUTH_TOKEN: 's',
  VITE_SENTRY_DSN: 'https://cle@o4511435877777408.ingest.de.sentry.io/4511435880661072',
  VERCEL_TOKEN: 'v',
  SUPABASE_ACCESS_TOKEN: 'p',
};

/** Une réponse `fetch` minimale. */
const reponse = (corps, { status = 200, link = '' } = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (nom) => (nom.toLowerCase() === 'link' ? link : null) },
  json: async () => corps,
  text: async () => JSON.stringify(corps),
});

/** Une référence complète et basse, pour juger la comparaison. */
const REF = {
  sentry: { plafond_issues: 0 },
  vercel: { plafond_erreurs: 0 },
  supabase: {
    plafonds_famille: Object.fromEntries(FAMILLES.map((f) => [f, 5])),
    plafond_couple_inconnu: 2,
    couples: { '/rest/v1/events 409': 4 },
  },
};
const familles = (vals = {}) => ({ ...Object.fromEntries(FAMILLES.map((f) => [f, 0])), ...vals });
const supabaseCalme = () => ({ total_requetes: 1000, familles: familles(), couples: {} });

// ═══════════════════════════════════════════════════════════════════
describe('témoin · jetons : échec fermé', () => {
  it('TEMOIN : chaque jeton absent est NOMMÉ, aucun n est facultatif', () => {
    expect(jetonsManquants(ENV_COMPLET)).toEqual([]);
    for (const cle of ['SENTRY_AUTH_TOKEN', 'VERCEL_TOKEN', 'SUPABASE_ACCESS_TOKEN']) {
      const env = { ...ENV_COMPLET, [cle]: '' };
      expect(jetonsManquants(env)).toEqual([cle]);
    }
    expect(jetonsManquants({})).toHaveLength(4);
  });

  it('le DSN est remplaçable par SENTRY_ORG + SENTRY_PROJECT, pas par un seul des deux', () => {
    const sansDsn = { ...ENV_COMPLET, VITE_SENTRY_DSN: '' };
    expect(jetonsManquants({ ...sansDsn, SENTRY_ORG: 'o', SENTRY_PROJECT: 'p' })).toEqual([]);
    expect(jetonsManquants({ ...sansDsn, SENTRY_ORG: 'o' })).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════════
describe('témoin · Sentry (AM-1)', () => {
  it('TEMOIN : le DSN donne la RÉGION, l organisation et le projet', () => {
    expect(sentryDepuisDsn(ENV_COMPLET.VITE_SENTRY_DSN)).toEqual({
      api: 'https://de.sentry.io',
      org: '4511435877777408',
      projet: '4511435880661072',
    });
    expect(sentryDepuisDsn('https://k@o12.ingest.sentry.io/34')?.api).toBe('https://sentry.io');
    expect(sentryDepuisDsn('https://k@o12.ingest.us.sentry.io/34')?.api).toBe('https://sentry.io');
  });

  it('un DSN illisible rend null, jamais un hôte deviné', () => {
    expect(sentryDepuisDsn('')).toBeNull();
    expect(sentryDepuisDsn('https://k@exemple.org/34')).toBeNull();
    expect(sentryDepuisDsn('https://k@o12.ingest.sentry.io/')).toBeNull();
  });

  it('`resumerSentry` fusionne nouvelles et régressions, une issue vue deux fois compte une fois', () => {
    const { issues } = resumerSentry([
      { raison: 'nouvelle', issues: [{ id: '1', shortId: 'COSMO-1', title: 'A', count: '7', userCount: 3 }] },
      { raison: 'regression', issues: [{ id: '1' }, { id: '2', title: 'B' }] },
    ]);
    expect(issues.map((i) => [i.id, i.raison])).toEqual([['1', 'nouvelle'], ['2', 'regression']]);
    expect(issues[0]).toMatchObject({ court: 'COSMO-1', evenements: 7, utilisateurs: 3 });
  });

  it('TEMOIN : `lireSentry` lit les DEUX recherches, suit les pages, et refuse une réponse en erreur', async () => {
    const urls = [];
    const fetchImpl = async (url) => {
      urls.push(url);
      if (url.includes('cursor=suite')) {
        return reponse([{ id: '9' }], { link: '<https://de.sentry.io/x?cursor=fin>; rel="next"; results="false"' });
      }
      if (url.includes('firstSeen')) {
        return reponse([{ id: '1' }], { link: '<https://de.sentry.io/x?cursor=suite>; rel="next"; results="true"' });
      }
      return reponse([{ id: '2' }]);
    };
    const { issues } = await lireSentry({ env: ENV_COMPLET, fetchImpl });
    expect(issues.map((i) => i.id).sort()).toEqual(['1', '2', '9']);
    expect(urls[0]).toContain('https://de.sentry.io/api/0/organizations/4511435877777408/issues/');
    expect(urls[0]).toContain('project=4511435880661072');
    expect(urls[0]).toContain('statsPeriod=24h');
    expect(urls.some((u) => decodeURIComponent(u).includes('is:regressed'))).toBe(true);
    expect(urls).not.toContain('https://de.sentry.io/x?cursor=fin');

    await expect(lireSentry({ env: ENV_COMPLET, fetchImpl: async () => reponse({}, { status: 401 }) }))
      .rejects.toThrow(/HTTP 401/);
  });
});

// ═══════════════════════════════════════════════════════════════════
describe('témoin · chemins et familles', () => {
  it('`normaliserChemin` retire chaîne de requête, identifiants et nombres', () => {
    expect(normaliserChemin('/rest/v1/events?select=*')).toBe('/rest/v1/events');
    expect(normaliserChemin('/storage/v1/object/avatars/0b0e8f2a-1c3d-4e5f-8a9b-0c1d2e3f4a5b/p.png'))
      .toBe('/storage/v1/object/avatars/:id/p.png');
    expect(normaliserChemin('/rest/v1/tasks/42')).toBe('/rest/v1/tasks/:n');
    expect(normaliserChemin('')).toBe('/');
  });

  it('TEMOIN : `classer` range chaque réponse dans SA famille', () => {
    expect(classer('/rest/v1/tasks', 503)).toBe('5xx');
    expect(classer('/auth/v1/health', 401)).toBe('sonde_uptime');
    expect(classer('/rest/v1/', 401)).toBe('sonde_uptime');
    expect(classer('/functions/v1/report-bug', 405, true)).toBe('sonde_edge');
    // Le même 400 sans la marque de la sonde est un VRAI appel non signé.
    expect(classer('/functions/v1/stripe-webhook', 400, false)).toBe('webhook_non_signe');
    expect(classer('/functions/v1/stripe-webhook', 400, true)).toBe('sonde_edge');
    expect(classer('/auth/v1/token', 400)).toBe('refus_auth');
    expect(classer('/rest/v1/events', 409)).toBe('4xx_metier');
    // Une sonde qui rend un 5xx n'est plus une sonde : c'est une panne.
    expect(classer('/functions/v1/report-bug', 500, true)).toBe('5xx');
  });

  it('les sondes uptime sont exactement les deux chemins de `uptime.yml`', () => {
    expect([...SONDES_UPTIME].sort()).toEqual(['/auth/v1/health 401', '/rest/v1/ 401']);
  });
});

// ═══════════════════════════════════════════════════════════════════
describe('témoin · Supabase (AM-3)', () => {
  it('TEMOIN : `agregerSupabase` somme par famille, et les sondes ne font pas de couple', () => {
    const m = agregerSupabase(1514, [
      { chemin: '/auth/v1/health', statut: 401, n: 98 },
      { chemin: '/rest/v1/events', statut: 409, n: 4 },
      { chemin: '/rest/v1/events?on_conflict=id', statut: '409', n: '2' },
      { chemin: '/functions/v1/report-bug', statut: 405, n: 4, sonde: 1 },
      { chemin: '/functions/v1/stripe-webhook', statut: 400, n: 1, sonde: 0 },
      { chemin: '/rest/v1/tasks', statut: 502, n: 1 },
      { chemin: '/rest/v1/tasks', statut: 200, n: 50 },
    ]);
    expect(m.total_requetes).toBe(1514);
    expect(m.familles).toEqual(familles({
      sonde_uptime: 98, '4xx_metier': 6, sonde_edge: 4, webhook_non_signe: 1, '5xx': 1,
    }));
    expect(m.couples).toEqual({
      '/auth/v1/health 401': 98,
      '/rest/v1/events 409': 6,
      '/functions/v1/stripe-webhook 400': 1,
      '/rest/v1/tasks 502': 1,
    });
  });

  it('TEMOIN : le SQL lit la passerelle ET les Edge Functions', () => {
    expect(SQL_SUPABASE.total).toContain("'edge_logs'");
    expect(SQL_SUPABASE.total).toContain("'function_edge_logs'");
    expect(SQL_SUPABASE.passerelle).toContain("source = 'edge_logs'");
    expect(SQL_SUPABASE.fonctions).toContain("source = 'function_edge_logs'");
    expect(SQL_SUPABASE.fonctions).toContain("request.pathname");
    for (const sql of [SQL_SUPABASE.passerelle, SQL_SUPABASE.fonctions]) {
      expect(sql).toContain('>= 400');
      expect(sql).toContain(`limit ${LIGNES_MAX_SUPABASE}`);
    }
  });

  it('TEMOIN : une erreur SQL rendue dans un 200, ou une réponse tronquée, fait JETER', async () => {
    const enErreur = async () => reponse({ error: 'restricted wildcard' });
    await expect(lireSupabase({ env: ENV_COMPLET, fetchImpl: enErreur })).rejects.toThrow(/refusée/);

    const tronquee = async (url) => (decodeURIComponent(url).includes('select count()')
      ? reponse({ result: [{ n: 10 }] })
      : reponse({ result: Array.from({ length: LIGNES_MAX_SUPABASE }, () => ({ chemin: '/x', statut: 404, n: 1 })) }));
    await expect(lireSupabase({ env: ENV_COMPLET, fetchImpl: tronquee })).rejects.toThrow(/tronquée/);
  });

  it('TEMOIN : `lireSupabase` lit les deux sources, sur 24 h, du projet par défaut', async () => {
    const urls = [];
    const fetchImpl = async (url) => {
      urls.push(url);
      return reponse({ result: decodeURIComponent(url).includes('select count()') ? [{ n: 7 }] : [] });
    };
    const m = await lireSupabase({ env: ENV_COMPLET, maintenant: Date.parse('2026-10-23T12:00:00Z'), fetchImpl });
    expect(m.total_requetes).toBe(7);
    expect(urls).toHaveLength(3);
    expect(urls[0]).toContain('/v1/projects/ykeugqfgklejcdbrmawy/analytics/endpoints/logs');
    expect(decodeURIComponent(urls[0])).toContain('iso_timestamp_start=2026-10-22T12:00:00.000Z');
    expect(decodeURIComponent(urls[0])).toContain('iso_timestamp_end=2026-10-23T12:00:00.000Z');
  });
});

// ═══════════════════════════════════════════════════════════════════
describe('témoin · Vercel (AM-2)', () => {
  it('TEMOIN : un 5xx OU un journal `error` est une erreur, un 204 propre non', () => {
    const m = agregerVercel([
      { requestId: 'a', requestPath: '/api/collect', statusCode: 500, logs: [] },
      // Le collecteur répond 204 même quand l'écriture échoue : seul le
      // journal le dit.
      { requestId: 'b', requestPath: '/api/collect', statusCode: 204, logs: [{ level: 'error', message: 'insert refusé' }] },
      { requestId: 'c', requestPath: '/api/collect', statusCode: 204, logs: [{ level: 'info', message: 'ok' }] },
      { requestId: 'd', requestPath: '/api/collect?x=1', statusCode: 204, logs: [{ level: 'warning', message: 'lent' }] },
      // Vue par les deux filtres (`level` et `statusCode`) : comptée une fois.
      { requestId: 'a', requestPath: '/api/collect', statusCode: 500, logs: [] },
    ]);
    expect(m.total).toBe(2);
    expect(m.couples).toEqual({ '/api/collect 500': 1, '/api/collect 204': 1 });
    expect(m.exemples['/api/collect 204']).toBe('insert refusé');
  });

  it('TEMOIN : `lireVercel` pagine, lit la PRODUCTION, et refuse une réponse en erreur', async () => {
    const urls = [];
    const fetchImpl = async (url) => {
      urls.push(new URL(url));
      const u = new URL(url);
      if (u.searchParams.get('level') && u.searchParams.get('page') === '0') {
        return reponse({ rows: [{ requestId: 'a', requestPath: '/api/collect', statusCode: 500 }], hasMoreRows: true });
      }
      if (u.searchParams.get('level')) {
        return reponse({ rows: [{ requestId: 'b', requestPath: '/api/collect', statusCode: 502 }], hasMoreRows: false });
      }
      return reponse({ rows: [], hasMoreRows: false });
    };
    const m = await lireVercel({ env: ENV_COMPLET, maintenant: 1_000_000_000_000, fetchImpl });
    expect(m.total).toBe(2);
    expect(urls).toHaveLength(3);
    expect(urls[0].origin + urls[0].pathname).toBe('https://vercel.com/api/logs/request-logs');
    expect(urls[0].searchParams.get('projectId')).toBe('prj_n3erde0uRnc6S27BHS3gWxhYAoFU');
    expect(urls[0].searchParams.get('ownerId')).toBe('team_iihZIsetJUOwpZNkZXLSw2dO');
    expect(urls[0].searchParams.get('environment')).toBe('production');
    expect(urls[0].searchParams.get('level')).toBe('error,fatal');
    expect(urls[2].searchParams.get('statusCode')).toBe('5xx');
    expect(Number(urls[0].searchParams.get('endDate')) - Number(urls[0].searchParams.get('startDate')))
      .toBe(24 * 60 * 60 * 1000);

    await expect(lireVercel({ env: ENV_COMPLET, fetchImpl: async () => reponse({}, { status: 403 }) }))
      .rejects.toThrow(/HTTP 403/);
    await expect(lireVercel({ env: ENV_COMPLET, fetchImpl: async () => reponse({ items: [] }) }))
      .rejects.toThrow(/sans `rows`/);
  });
});

// ═══════════════════════════════════════════════════════════════════
describe('témoin · la comparaison à la référence', () => {
  it('une production calme, sous chaque plafond, ne rougit pas', () => {
    const { ecarts } = comparer(REF, {
      sentry: { issues: [] },
      vercel: { total: 0, couples: {}, exemples: {} },
      supabase: { total_requetes: 1000, familles: familles({ '4xx_metier': 4 }), couples: { '/rest/v1/events 409': 4 } },
    });
    expect(ecarts).toEqual([]);
  });

  it('TEMOIN : une issue Sentry et une erreur Vercel au-delà du plafond ROUGISSENT, nommées', () => {
    const { ecarts } = comparer(REF, {
      sentry: { issues: [{ id: '1', court: 'COSMO-7', titre: 'TypeError', raison: 'regression', evenements: 3, utilisateurs: 2, lien: null }] },
      vercel: { total: 1, couples: { '/api/collect 500': 1 }, exemples: { '/api/collect 500': 'boom' } },
    });
    expect(ecarts.some((e) => e.includes('1 issue(s)'))).toBe(true);
    expect(ecarts.some((e) => e.includes('COSMO-7') && e.includes('regression'))).toBe(true);
    expect(ecarts.some((e) => e.includes('/api/collect 500') && e.includes('boom'))).toBe(true);
  });

  it('TEMOIN : une famille, un couple connu ou un couple NOUVEAU au-delà de son plafond rougissent', () => {
    const { ecarts } = comparer(REF, {
      supabase: {
        total_requetes: 1000,
        familles: familles({ '5xx': 6 }),
        couples: { '/rest/v1/events 409': 5, '/rest/v1/rpc/neuve 401': 3, '/rest/v1/rpc/bruit 401': 2 },
      },
    });
    expect(ecarts.some((e) => e.includes('`5xx`') && e.includes('6'))).toBe(true);
    expect(ecarts.some((e) => e.includes('/rest/v1/events 409') && e.includes('plafond 4'))).toBe(true);
    expect(ecarts.some((e) => e.includes('NOUVEAU') && e.includes('/rest/v1/rpc/neuve 401'))).toBe(true);
    // À la tolérance pile, un couple inconnu passe : c'est le bruit admis.
    expect(ecarts.some((e) => e.includes('/rest/v1/rpc/bruit 401'))).toBe(false);
  });

  it('TEMOIN : zéro requête lue, ou une référence incomplète, ROUGISSENT au lieu de conclure', () => {
    const vide = comparer(REF, { supabase: { total_requetes: 0, familles: familles(), couples: {} } });
    expect(vide.ecarts.some((e) => e.includes('AUCUNE requête'))).toBe(true);

    const incomplete = comparer({ supabase: { plafonds_famille: {}, couples: {} } }, {
      sentry: { issues: [] },
      vercel: { total: 0, couples: {} },
      supabase: supabaseCalme(),
    });
    expect(incomplete.ecarts.some((e) => e.includes('plafond_issues'))).toBe(true);
    expect(incomplete.ecarts.some((e) => e.includes('plafond_erreurs'))).toBe(true);
    expect(incomplete.ecarts.some((e) => e.includes('plafond_couple_inconnu'))).toBe(true);
    expect(incomplete.ecarts.filter((e) => e.includes('n a pas de plafond'))).toHaveLength(FAMILLES.length);
  });

  it('une source en panne n est pas comparée (sa panne est déjà une erreur du run)', () => {
    expect(comparer(REF, {}).ecarts).toEqual([]);
  });

  it('un couple de la référence absent aujourd hui est une BAISSE, pas un écart', () => {
    const { ecarts, baisses } = comparer(REF, { supabase: supabaseCalme() });
    expect(ecarts).toEqual([]);
    expect(baisses).toEqual(['Supabase · `/rest/v1/events 409` : 0 sur 24 h.']);
  });
});

// ═══════════════════════════════════════════════════════════════════
describe('témoin · la référence commitée', () => {
  const reference = JSON.parse(readFileSync(join(process.cwd(), 'scripts', 'prod-errors.reference.json'), 'utf8'));

  it('chaque famille a un plafond, et Sentry comme Vercel en ont un', () => {
    for (const f of FAMILLES) expect(typeof reference.supabase.plafonds_famille[f]).toBe('number');
    expect(typeof reference.sentry.plafond_issues).toBe('number');
    expect(typeof reference.vercel.plafond_erreurs).toBe('number');
    expect(typeof reference.supabase.plafond_couple_inconnu).toBe('number');
  });

  it('aucune 5xx n est admise, et chaque plafond porte sa raison dans `_notes`', () => {
    expect(reference.supabase.plafonds_famille['5xx']).toBe(0);
    for (const f of FAMILLES) expect(reference._notes[f]).toBeTruthy();
    expect(reference._notes.sentry).toBeTruthy();
    expect(reference._notes.vercel).toBeTruthy();
  });

  it('la référence elle-même ne rougit pas sur le relevé du 2026-10-23', () => {
    const releve = agregerSupabase(1514, [
      { chemin: '/auth/v1/health', statut: 401, n: 98 },
      { chemin: '/rest/v1/', statut: 401, n: 92 },
      { chemin: '/auth/v1/user', statut: 403, n: 8 },
      { chemin: '/rest/v1/events', statut: 409, n: 4 },
      { chemin: '/functions/v1/stripe-webhook', statut: 400, n: 4, sonde: 1 },
    ]);
    expect(comparer(reference, { supabase: releve }).ecarts).toEqual([]);
  });
});
