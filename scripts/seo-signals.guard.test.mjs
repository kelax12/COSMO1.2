// ═══════════════════════════════════════════════════════════════════
// seo-signals.guard.test.mjs · LE TÉMOIN DES SIGNAUX SEO
//
// 🔴 POURQUOI CE FICHIER EXISTE (2026-10-23)
//
// `scripts/seo-signals.mjs` ferme trois angles morts (SEO.md AM-4,
// ACQUISITION-BACKLINKS.md AM-1 et AM-2). Il peut mentir de quatre façons,
// toutes dans le sens rassurant :
//   · lire une page sans lien vers thecosmo.app comme un backlink présent ;
//   · compter une requête « cosmo » dans le non-marque ;
//   · ne pas voir un domaine référent disparu entre deux points ;
//   · sortir en 0 sans secret, une moitié du travail sautée en silence.
// Chaque cas TÉMOIN soumet au code RÉEL un de ces états, avec un `fetch`
// injecté : aucun appel réseau.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateKeyPairSync, createVerify } from 'node:crypto';
import { load } from 'js-yaml';
import {
  fenetre, lireCompteDeService, assertionJwt, corpsRequete, totaux, requetesNonMarque,
  backlinksDeclares, liensVersNous, estSuivi, verifierBacklink, agregerDomaines,
  releverAutorite, comparer, ajouterPoint, run, resume, PROPRIETE_DEFAUT,
} from './seo-signals.mjs';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const CLE_PEM = privateKey.export({ type: 'pkcs8', format: 'pem' });
const COMPTE = JSON.stringify({ client_email: 'releve@projet.iam.gserviceaccount.com', private_key: CLE_PEM });

const json = (corps, status = 200) => new Response(JSON.stringify(corps), { status, headers: { 'Content-Type': 'application/json' } });
const html = (corps, status = 200) => new Response(corps, { status, headers: { 'Content-Type': 'text/html' } });

const TABLEAU = (lignes) => [
  '| # | Site | Coût | État | Fait le | Ce qu\'il faut préparer | Note |',
  '|---|---|---|---|---|---|---|',
  ...lignes,
].join('\n');

/** Un faux Internet : Google, Bing et les pages sources, rien d'autre. */
function internet({ pages = {}, domainesBing = ['alternativeto.net'], gscStatus = 200 } = {}) {
  const vus = [];
  const fetchFn = async (url, init = {}) => {
    const u = String(url);
    vus.push({ url: u, init });
    if (u === 'https://oauth2.googleapis.com/token') return json({ access_token: 'jeton' });
    if (u.startsWith('https://searchconsole.googleapis.com/')) {
      if (gscStatus !== 200) return json({}, gscStatus);
      const corps = JSON.parse(init.body);
      if (corps.dimensions) {
        return json({ rows: [
          { keys: ['todo list gratuite'], clicks: 1, impressions: 40, position: 31.24 },
          { keys: ['Cosmo app'], clicks: 9, impressions: 90, position: 2 },
          { keys: ['template okr'], clicks: 0, impressions: 12, position: 55 },
        ] });
      }
      return json({ rows: [corps.dimensionFilterGroups ? { clicks: 1, impressions: 52, ctr: 0.01923, position: 38.66 } : { clicks: 10, impressions: 142, ctr: 0.0704, position: 12.3 }] });
    }
    if (u.startsWith('https://ssl.bing.com/webmaster/api.svc/json/GetLinkCounts')) {
      return json({ d: { Links: [{ Url: 'https://thecosmo.app/', Count: domainesBing.length }], TotalPages: 1 } });
    }
    if (u.startsWith('https://ssl.bing.com/webmaster/api.svc/json/GetUrlLinks')) {
      return json({ d: { Details: domainesBing.map((d) => ({ Url: `https://www.${d}/fiche`, AnchorText: 'Cosmo' })), TotalPages: 1 } });
    }
    if (u in pages) return pages[u]();
    throw new Error(`appel réseau refusé : ${u}`);
  };
  return { fetchFn, vus };
}

const ENV = { GSC_SERVICE_ACCOUNT_JSON: COMPTE, BING_WEBMASTER_API_KEY: 'cle' };
const MAINTENANT = new Date('2026-10-26T06:17:00Z');

describe('seo-signals · Search Console', () => {
  it('fenêtre de 28 jours finissant 3 jours avant le relevé', () => {
    expect(fenetre(MAINTENANT)).toEqual({ debut: '2026-09-26', fin: '2026-10-23' });
  });

  it('TÉMOIN : une requête marque renvoyée par le serveur ne compte pas dans le non-marque', () => {
    const r = requetesNonMarque({ rows: [
      { keys: ['COSMO todo'], clicks: 5, impressions: 99, position: 3 },
      { keys: ['planner'], clicks: 0, impressions: 4, position: 70 },
    ] });
    expect(r.map((x) => x.requete)).toEqual(['planner']);
  });

  it('demande le filtre non marque au serveur, et pas sur la requête « toutes »', () => {
    const p = { debut: 'a', fin: 'b' };
    expect(corpsRequete(p, { nonMarque: true }).dimensionFilterGroups[0].filters[0])
      .toEqual({ dimension: 'query', operator: 'excludingRegex', expression: '(?i)cosmo' });
    expect(corpsRequete(p, { nonMarque: false }).dimensionFilterGroups).toBeUndefined();
    expect(corpsRequete(p, { nonMarque: true, parRequete: true }).dimensions).toEqual(['query']);
  });

  it('une réponse sans ligne vaut zéro clic et une position INCONNUE, pas 0', () => {
    expect(totaux({})).toEqual({ clics: 0, impressions: 0, ctr: 0, position: null });
    expect(totaux({ rows: [{ clicks: 2, impressions: 9, ctr: 0.22222, position: 41.27 }] }))
      .toEqual({ clics: 2, impressions: 9, ctr: 0.2222, position: 41.3 });
  });

  it('TÉMOIN : un compte de service illisible ou incomplet est refusé, jamais ignoré', () => {
    expect(() => lireCompteDeService('')).toThrow(/absent/);
    expect(() => lireCompteDeService('{pas du json')).toThrow(/pas du JSON/);
    expect(() => lireCompteDeService('{"client_email":"x"}')).toThrow(/private_key/);
  });

  it('signe une assertion JWT RS256 vérifiable, portée lecture seule', () => {
    const jwt = assertionJwt(JSON.parse(COMPTE), 1_700_000_000_000);
    const [h, c, s] = jwt.split('.');
    expect(createVerify('RSA-SHA256').update(`${h}.${c}`).verify(publicKey, s, 'base64url')).toBe(true);
    const corps = JSON.parse(Buffer.from(c, 'base64url').toString());
    expect(corps).toMatchObject({ scope: 'https://www.googleapis.com/auth/webmasters.readonly', iat: 1_700_000_000, exp: 1_700_003_600 });
  });
});

describe('seo-signals · backlinks déclarés', () => {
  const doc = TABLEAU([
    '| 1 | **Appvizer** (FR) | Gratuit | `fait` | 2026-10-01 | Fiche | Fiche : https://www.appvizer.fr/cosmo. Vers https://thecosmo.app |',
    '| 2 | **AlternativeTo** | Gratuit | `a-faire` | - | Description | Rien |',
    '| 3 | **SaaSHub** | Gratuit | `fait` | 2026-10-02 | Description | lien vers https://thecosmo.app seulement |',
  ]);

  it('lit chaque ligne, son état, et la première page source hors thecosmo.app', () => {
    expect(backlinksDeclares(doc)).toEqual([
      { numero: 1, site: 'Appvizer (FR)', etat: 'fait', faitLe: '2026-10-01', source: 'https://www.appvizer.fr/cosmo' },
      { numero: 2, site: 'AlternativeTo', etat: 'a-faire', faitLe: '-', source: null },
      { numero: 3, site: 'SaaSHub', etat: 'fait', faitLe: '2026-10-02', source: null },
    ]);
  });

  it('lit le tableau RÉEL de ACQUISITION-BACKLINKS.md : huit lignes, chacune dans un des cinq états', () => {
    const vrai = backlinksDeclares(readFileSync(join(process.cwd(), 'docs/ACQUISITION-BACKLINKS.md'), 'utf8'));
    expect(vrai.map((b) => b.numero)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    for (const b of vrai) expect(['a-faire', 'en-cours', 'fait', 'refuse', 'abandonne']).toContain(b.etat);
  });

  it('TÉMOIN : une page sans lien vers thecosmo.app ne compte aucun lien', () => {
    expect(liensVersNous('<a href="https://cosmo-app.example">x</a><a href="https://thecosmo.app.evil.io/">y</a>', 'https://s.io/')).toEqual([]);
  });

  it('note le rel de chaque lien, relatif ou absolu, www compris', () => {
    const l = liensVersNous(
      `<a class="x" href='https://www.thecosmo.app/fr/' rel="ugc NoFollow">a</a>
       <A HREF=https://thecosmo.app>b</A>`,
      'https://s.io/',
    );
    expect(l).toEqual([
      { href: 'https://www.thecosmo.app/fr/', rel: 'nofollow ugc' },
      { href: 'https://thecosmo.app/', rel: 'follow' },
    ]);
    expect(estSuivi('follow')).toBe(true);
    expect(estSuivi('noopener')).toBe(true);
    expect(estSuivi('sponsored')).toBe(false);
  });

  it('TÉMOIN : page disparue, page sans lien, page injoignable, source absente : quatre liens PERDUS', async () => {
    const b = (source) => ({ numero: 1, site: 'S', etat: 'fait', source });
    const { fetchFn } = internet({ pages: {
      'https://a.io/404': () => html('', 404),
      'https://a.io/vide': () => html('<a href="https://autre.io">x</a>'),
      'https://a.io/ok': () => html('<a href="https://thecosmo.app" rel="nofollow">x</a><a href="https://thecosmo.app/en/">y</a>'),
    } });
    const r404 = await verifierBacklink(b('https://a.io/404'), fetchFn);
    const rVide = await verifierBacklink(b('https://a.io/vide'), fetchFn);
    const rPanne = await verifierBacklink(b('https://a.io/panne'), fetchFn);
    const rSans = await verifierBacklink(b(null), fetchFn);
    for (const r of [r404, rVide, rPanne, rSans]) expect(r.present).toBe(false);
    expect(r404.motif).toMatch(/HTTP 404/);
    const ok = await verifierBacklink(b('https://a.io/ok'), fetchFn);
    expect(ok).toMatchObject({ present: true, rel: 'follow' });
  });
});

describe('seo-signals · autorité', () => {
  it('compte les domaines référents distincts, www retiré, nos hôtes exclus', () => {
    expect(agregerDomaines([
      { Url: 'https://www.saashub.com/a' }, { Url: 'https://saashub.com/b' },
      { Url: 'https://thecosmo.app/blog' }, { Url: 'pas une url' }, { Url: 'https://blog.x.io/' },
    ])).toEqual(['blog.x.io', 'saashub.com']);
  });

  it('TÉMOIN : sans clé Bing, la mesure échoue au lieu de rendre 0 domaine', async () => {
    await expect(releverAutorite({ cle: '', fetchFn: () => { throw new Error('aucun appel attendu'); } })).rejects.toThrow(/BING_WEBMASTER_API_KEY absent/);
  });

  it('remonte une erreur Bing en clair (clé refusée)', async () => {
    const fetchFn = async () => json({ ErrorCode: 3, Message: 'InvalidApiKey' });
    await expect(releverAutorite({ cle: 'x', fetchFn })).rejects.toThrow(/InvalidApiKey/);
  });
});

describe('seo-signals · comparaison et série', () => {
  const pt = (date, { verifies = [], domaines = [] } = {}) => ({ date, backlinks: { verifies }, autorite: { domaines, tronque: false } });
  const lien = (present, rel) => ({ numero: 1, site: 'Appvizer', source: 'https://a.io', present, rel, motif: present ? null : 'la page ne contient plus de lien vers thecosmo.app' });

  it('TÉMOIN : un domaine référent présent la semaine passée et absent aujourd hui est rouge', () => {
    const r = comparer(pt('2026-10-26', { domaines: ['b.io'] }), pt('2026-10-19', { domaines: ['a.io', 'b.io'] }));
    expect(r).toEqual(['domaine(s) référent(s) PERDU(S) depuis le 2026-10-19 : a.io']);
  });

  it('TÉMOIN : un backlink fait et perdu est rouge, un lien suivi devenu nofollow aussi', () => {
    expect(comparer(pt('d', { verifies: [lien(false, null)] }), null)[0]).toMatch(/backlink PERDU · #1 Appvizer/);
    expect(comparer(pt('d', { verifies: [lien(true, 'nofollow')] }), pt('c', { verifies: [lien(true, 'follow')] })))
      .toEqual(['backlink DÉGRADÉ · #1 Appvizer : rel « follow » devenu « nofollow »']);
  });

  it('un domaine gagné, ou un relevé tronqué, ne fait rien rougir', () => {
    expect(comparer(pt('d', { domaines: ['a.io', 'c.io'] }), pt('c', { domaines: ['a.io'] }))).toEqual([]);
    const tronque = { ...pt('d'), autorite: { domaines: [], tronque: true } };
    expect(comparer(tronque, pt('c', { domaines: ['a.io'] }))).toEqual([]);
  });

  it('un point par date, la série triée', () => {
    const s = ajouterPoint({ points: [{ date: '2026-10-19', v: 1 }, { date: '2026-10-26', v: 1 }] }, { date: '2026-10-26', v: 2 });
    expect(s.points).toEqual([{ date: '2026-10-19', v: 1 }, { date: '2026-10-26', v: 2 }]);
  });
});

describe('seo-signals · relevé complet', () => {
  const doc = TABLEAU(['| 1 | **Appvizer** | Gratuit | `fait` | 2026-10-01 | F | https://www.appvizer.fr/cosmo |']);
  const pages = { 'https://www.appvizer.fr/cosmo': () => html('<a href="https://thecosmo.app" rel="noopener">Cosmo</a>') };

  it('mesure les trois moitiés et ne rougit pas quand tout est là', async () => {
    const { fetchFn, vus } = internet({ pages });
    const { point, rouges } = await run({ env: ENV, fetchFn, maintenant: MAINTENANT, docBacklinks: doc });
    expect(rouges).toEqual([]);
    expect(point.gsc).toMatchObject({ propriete: PROPRIETE_DEFAUT, non_marque: { clics: 1, impressions: 52, position: 38.7 } });
    expect(point.gsc.requetes_non_marque.map((r) => r.requete)).toEqual(['todo list gratuite', 'template okr']);
    expect(point.backlinks.verifies[0]).toMatchObject({ present: true, rel: 'noopener' });
    expect(point.autorite).toMatchObject({ domaines_referents: 1, domaines: ['alternativeto.net'] });
    expect(vus.some((v) => v.url.includes(encodeURIComponent('sc-domain:thecosmo.app')))).toBe(true);
    expect(resume({ point, rouges })).toMatch(/NON MARQUE {6}: 1 clic\(s\), 52 impression\(s\)/);
  });

  it('TÉMOIN : sans aucun secret, le relevé est ROUGE, deux fois, et ne touche ni Google ni Bing', async () => {
    const { fetchFn, vus } = internet({ pages });
    const { point, rouges } = await run({ env: {}, fetchFn, maintenant: MAINTENANT, docBacklinks: doc });
    expect(rouges).toEqual([
      'Search Console NON MESURÉE : GSC_SERVICE_ACCOUNT_JSON absent',
      'autorité NON MESURÉE : BING_WEBMASTER_API_KEY absent',
    ]);
    expect(point.gsc).toBeNull();
    expect(point.autorite).toBeNull();
    expect(vus.every((v) => !/google|bing/.test(v.url))).toBe(true);
  });

  it('TÉMOIN : une propriété refusée (403) est rouge, avec la piste du compte de service', async () => {
    const { fetchFn } = internet({ pages, gscStatus: 403 });
    const { rouges } = await run({ env: { ...ENV, GSC_SITE_URL: 'https://thecosmo.app/' }, fetchFn, maintenant: MAINTENANT, docBacklinks: doc });
    expect(rouges[0]).toMatch(/HTTP 403 sur https:\/\/thecosmo\.app\/ : le compte de service est-il utilisateur/);
  });

  it('TÉMOIN : un domaine Bing perdu depuis le point précédent fait rougir le relevé entier', async () => {
    const { fetchFn } = internet({ pages, domainesBing: [] });
    const serie = { points: [{ date: '2026-10-19', autorite: { domaines: ['alternativeto.net'] } }] };
    const { rouges, serie: apres } = await run({ env: ENV, fetchFn, maintenant: MAINTENANT, serie, docBacklinks: doc });
    expect(rouges).toEqual(['domaine(s) référent(s) PERDU(S) depuis le 2026-10-19 : alternativeto.net']);
    expect(apres.points.map((p) => p.date)).toEqual(['2026-10-19', '2026-10-26']);
  });
});

describe('seo-signals.yml · TÉMOIN : le job mesure ou échoue, et son rouge est poussé', () => {
  const lire = (f) => readFileSync(join(process.cwd(), '.github/workflows', f), 'utf8');
  const wf = load(lire('seo-signals.yml'));
  const etapes = wf.jobs.releve.steps;

  it('est écouté par ci-alert.yml sous son nom exact', () => {
    expect(load(lire('ci-alert.yml')).on.workflow_run.workflows).toContain(wf.name);
  });

  it('planifié, aucune étape conditionnée à la présence d un secret', () => {
    expect(wf.on.schedule[0].cron).toMatch(/^\S+ \S+ \* \* \d$/);
    for (const e of etapes) expect(String(e.if ?? '')).not.toMatch(/secrets\./);
  });

  it('chaque artefact a une durée de rétention', () => {
    const artefacts = etapes.filter((e) => String(e.uses ?? '').startsWith('actions/upload-artifact@'));
    expect(artefacts.length).toBeGreaterThan(0);
    for (const a of artefacts) expect(a.with['retention-days']).toBeGreaterThan(0);
  });

  it('le verdict rougit aussi quand la mesure n a rien écrit (sortie vide)', () => {
    const verdict = etapes.find((e) => e.name === 'Verdict');
    expect(verdict.run).toContain('steps.mesure.outputs.rouge }}" != "false"');
  });
});
