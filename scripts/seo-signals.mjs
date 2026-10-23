// ═══════════════════════════════════════════════════════════════════
// Signaux SEO hebdomadaires · SEO.md AM-4, ACQUISITION-BACKLINKS.md AM-1, AM-2
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 POURQUOI CE FICHIER EXISTE (2026-10-23)
//
// Les audits SEO mesuraient la CONFORMITÉ (balises, sitemap, Lighthouse) et
// jamais le RÉSULTAT : note 80 et 0 clic non marqué ont coexisté depuis le
// 2026-08-19, et la Search Console n'a été relue qu'une fois, à la main.
// Trois choses n'étaient regardées par rien :
//
//   1 · le résultat Search Console : requêtes NON MARQUE (sans « cosmo »),
//       clics, impressions, position, sur 28 jours (SEO.md AM-4) ;
//   2 · les backlinks déclarés `fait` dans ACQUISITION-BACKLINKS.md : un lien
//       retiré était invisible (AM-1, `M-55`) ;
//   3 · l'autorité de domaine : domaines référents, mesurés par rien (AM-2).
//
// Ce script relève les trois, ajoute UN point daté à
// `docs/seo-signals-series.json`, et échoue (exit 1) :
//   · sur un secret absent : jamais de moitié sautée en silence ;
//   · sur un backlink `fait` perdu (page disparue, lien retiré, `rel` dégradé),
//     ou `fait` sans page source déclarée ;
//   · sur un domaine référent présent au point précédent et absent de celui-ci.
//
// Le point est ÉCRIT même quand le verdict est rouge : c'est ce jour-là que
// la série a de la valeur. Le workflow le commite, puis rend le verdict.
//
// ⚠️ CE QU'IL NE PROUVE PAS. La Search Console exclut les requêtes rares
// (anonymisées) : un total non marque est un PLANCHER. Bing ne voit que les
// liens que Bing a explorés : ses domaines référents ne sont pas ceux de
// Google, c'est une mesure gratuite et reproductible, pas « la » vérité. Une
// page source rendue en JavaScript peut ne pas montrer son lien au `fetch` :
// le rouge le dira, la relecture humaine tranchera.
//
// Aucune dépendance hors bibliothèque standard. Pas de shebang (cf.
// `check-tooling-coverage.mjs`). Témoin : `seo-signals.guard.test.mjs`.
// ═══════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { createSign } from 'node:crypto';

const RACINE = process.cwd();
export const SERIE = join(RACINE, 'docs', 'seo-signals-series.json');
const BACKLINKS = join(RACINE, 'docs', 'ACQUISITION-BACKLINKS.md');

/** Propriété Search Console par défaut : type DOMAINE (cf. SEO.md AM-4). */
export const PROPRIETE_DEFAUT = 'sc-domain:thecosmo.app';
/** Le domaine dont on cherche les liens entrants. */
export const DOMAINE = 'thecosmo.app';
/** Une requête MARQUE contient « cosmo », la définition de SEO.md § 4. */
export const MARQUE = /cosmo/i;
/** La fenêtre Search Console, et le délai de consolidation de ses données. */
const JOURS = 28;
const DELAI_GSC = 3;
/** Requêtes non marque gardées dans la série (les plus vues). */
const TOP_REQUETES = 25;
/** Bornes Bing : un domaine neuf a peu de liens, on ne pagine pas sans fin. */
const BING_PAGES_MAX = 5;
const BING_CIBLES_MAX = 20;

const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const JETON_GOOGLE = 'https://oauth2.googleapis.com/token';
const BING_API = 'https://ssl.bing.com/webmaster/api.svc/json';

// ─── 1 · Dates ──────────────────────────────────────────────────────

const jour = (d) => d.toISOString().slice(0, 10);

/** La fenêtre de 28 jours qui finit DELAI_GSC jours avant `maintenant`. */
export function fenetre(maintenant = new Date()) {
  const fin = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), maintenant.getUTCDate() - DELAI_GSC));
  const debut = new Date(fin.getTime() - (JOURS - 1) * 86_400_000);
  return { debut: jour(debut), fin: jour(fin) };
}

// ─── 2 · Search Console ─────────────────────────────────────────────

const b64url = (v) => Buffer.from(v).toString('base64url');

/** Lit le JSON du compte de service ; refuse un JSON sans les deux clés utiles. */
export function lireCompteDeService(brut) {
  if (!brut || !String(brut).trim()) throw new Error('GSC_SERVICE_ACCOUNT_JSON absent');
  let compte;
  try {
    compte = JSON.parse(brut);
  } catch {
    throw new Error("GSC_SERVICE_ACCOUNT_JSON n'est pas du JSON (coller le fichier de clé entier)");
  }
  if (!compte.client_email || !compte.private_key) {
    throw new Error('GSC_SERVICE_ACCOUNT_JSON sans client_email ou private_key');
  }
  return compte;
}

/** L'assertion JWT RS256 échangée contre un jeton d'accès (OAuth 2, compte de service). */
export function assertionJwt(compte, maintenant = Date.now()) {
  const iat = Math.floor(maintenant / 1000);
  const entete = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const corps = b64url(JSON.stringify({ iss: compte.client_email, scope: SCOPE, aud: JETON_GOOGLE, iat, exp: iat + 3600 }));
  const signe = createSign('RSA-SHA256').update(`${entete}.${corps}`).sign(compte.private_key, 'base64url');
  return `${entete}.${corps}.${signe}`;
}

async function jetonGoogle(compte, fetchFn) {
  const rep = await fetchFn(JETON_GOOGLE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: assertionJwt(compte),
    }).toString(),
  });
  if (!rep.ok) throw new Error(`jeton Google refusé (HTTP ${rep.status})`);
  const { access_token: jeton } = await rep.json();
  if (!jeton) throw new Error('jeton Google vide');
  return jeton;
}

/** Corps d'une requête Search Analytics, non marque si `nonMarque`. */
export function corpsRequete({ debut, fin }, { nonMarque, parRequete }) {
  return {
    startDate: debut,
    endDate: fin,
    type: 'web',
    ...(parRequete ? { dimensions: ['query'], rowLimit: 1000 } : {}),
    ...(nonMarque
      ? { dimensionFilterGroups: [{ filters: [{ dimension: 'query', operator: 'excludingRegex', expression: '(?i)cosmo' }] }] }
      : {}),
  };
}

const arrondi = (x, n) => (x == null ? null : Math.round(x * 10 ** n) / 10 ** n);

/** Les totaux d'une réponse sans dimension. Aucune ligne : zéro, position inconnue. */
export function totaux(reponse) {
  const l = reponse?.rows?.[0];
  if (!l) return { clics: 0, impressions: 0, ctr: 0, position: null };
  return { clics: l.clicks ?? 0, impressions: l.impressions ?? 0, ctr: arrondi(l.ctr ?? 0, 4), position: arrondi(l.position, 1) };
}

/**
 * Les requêtes d'une réponse par `query`, refiltrées côté client : le filtre
 * serveur est une regex RE2 qu'on ne voit pas tourner, une requête marque qui
 * passerait gonflerait le non-marque, le sens rassurant.
 */
export function requetesNonMarque(reponse, max = TOP_REQUETES) {
  return (reponse?.rows ?? [])
    .map((l) => ({ requete: String(l.keys?.[0] ?? ''), clics: l.clicks ?? 0, impressions: l.impressions ?? 0, position: arrondi(l.position, 1) }))
    .filter((r) => r.requete && !MARQUE.test(r.requete))
    .sort((a, b) => b.impressions - a.impressions || b.clics - a.clics || a.requete.localeCompare(b.requete))
    .slice(0, max);
}

export async function releverSearchConsole({ brut, propriete, periode, fetchFn }) {
  const compte = lireCompteDeService(brut);
  const jeton = await jetonGoogle(compte, fetchFn);
  const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(propriete)}/searchAnalytics/query`;
  const interroger = async (corps) => {
    const rep = await fetchFn(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${jeton}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(corps),
    });
    if (!rep.ok) {
      throw new Error(`Search Analytics HTTP ${rep.status} sur ${propriete}`
        + (rep.status === 403 ? ' : le compte de service est-il utilisateur de la propriété ?' : ''));
    }
    return rep.json();
  };
  const [toutes, nonMarque, parRequete] = await Promise.all([
    interroger(corpsRequete(periode, { nonMarque: false })),
    interroger(corpsRequete(periode, { nonMarque: true })),
    interroger(corpsRequete(periode, { nonMarque: true, parRequete: true })),
  ]);
  return { propriete, toutes: totaux(toutes), non_marque: totaux(nonMarque), requetes_non_marque: requetesNonMarque(parRequete) };
}

// ─── 3 · Backlinks déclarés « fait » ────────────────────────────────

const estNotreHote = (hote) => hote === DOMAINE || hote.endsWith(`.${DOMAINE}`);

/**
 * Les lignes du tableau des annuaires, cellule par cellule. La page source
 * est la première URL de la colonne « Note » qui n'est PAS sur thecosmo.app :
 * le tableau n'a pas de colonne dédiée, et l'ajouter changerait sa forme.
 */
export function backlinksDeclares(texte) {
  const out = [];
  for (const ligne of texte.split(/\r?\n/)) {
    const cellules = ligne.split('|').slice(1, -1).map((c) => c.trim());
    if (cellules.length !== 7 || !/^\d+$/.test(cellules[0])) continue;
    const etat = cellules[3].replace(/`/g, '');
    const source = [...cellules[6].matchAll(/https?:\/\/[^\s)<>`"'\]]+/g)]
      .map((m) => m[0].replace(/[.,;:]+$/, ''))
      .find((u) => {
        try { return !estNotreHote(new URL(u).hostname); } catch { return false; }
      }) ?? null;
    out.push({ numero: Number(cellules[0]), site: cellules[1].replace(/\*/g, ''), etat, faitLe: cellules[4], source });
  }
  return out;
}

const attribut = (balise, nom) => {
  const m = balise.match(new RegExp(`\\s${nom}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return m ? (m[1] ?? m[2] ?? m[3]) : null;
};

/** Les liens d'une page HTML vers thecosmo.app, avec leur `rel`. */
export function liensVersNous(html, base) {
  const out = [];
  for (const m of String(html).matchAll(/<a\b[^>]*>/gi)) {
    const href = attribut(m[0], 'href');
    if (!href) continue;
    let url;
    try { url = new URL(href, base); } catch { continue; }
    if (!/^https?:$/.test(url.protocol) || !estNotreHote(url.hostname)) continue;
    const rel = (attribut(m[0], 'rel') ?? '').toLowerCase().split(/\s+/).filter(Boolean).sort();
    out.push({ href: url.href, rel: rel.join(' ') || 'follow' });
  }
  return out;
}

/** Un lien suivi vaut plus qu'un `nofollow` / `ugc` / `sponsored`. */
export const estSuivi = (rel) => !/\b(nofollow|ugc|sponsored)\b/.test(rel);

export async function verifierBacklink(b, fetchFn) {
  if (!b.source) return { ...b, present: false, statut: null, rel: null, motif: 'aucune page source dans la colonne Note' };
  let rep;
  try {
    rep = await fetchFn(b.source, { redirect: 'follow', headers: { 'User-Agent': 'cosmo-seo-signals (+https://thecosmo.app)', Accept: 'text/html' } });
  } catch (e) {
    return { ...b, present: false, statut: null, rel: null, motif: `page injoignable (${e?.message ?? e})` };
  }
  if (!rep.ok) return { ...b, present: false, statut: rep.status, rel: null, motif: `page source en HTTP ${rep.status}` };
  const liens = liensVersNous(await rep.text(), rep.url || b.source);
  if (liens.length === 0) return { ...b, present: false, statut: rep.status, rel: null, motif: 'la page ne contient plus de lien vers thecosmo.app' };
  const meilleur = liens.find((l) => estSuivi(l.rel)) ?? liens[0];
  return { ...b, present: true, statut: rep.status, rel: meilleur.rel, motif: null };
}

// ─── 4 · Autorité : domaines référents vus par Bing ─────────────────

/** Domaine enregistrable approché : `www.` retiré, sous-domaines gardés. */
export const domaineDe = (url) => {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ''); } catch { return null; }
};

async function bing(methode, params, cle, fetchFn) {
  const qs = new URLSearchParams({ ...params, apikey: cle });
  const rep = await fetchFn(`${BING_API}/${methode}?${qs}`, { headers: { Accept: 'application/json' } });
  if (!rep.ok) throw new Error(`Bing ${methode} HTTP ${rep.status}`);
  const json = await rep.json();
  if (json?.ErrorCode != null) throw new Error(`Bing ${methode} : ${json.Message ?? json.ErrorCode}`);
  return json?.d ?? {};
}

/** Domaines référents : sources de `GetUrlLinks`, nos propres hôtes exclus. */
export function agregerDomaines(details) {
  const domaines = new Set();
  for (const d of details) {
    const dom = domaineDe(d?.Url);
    if (dom && !estNotreHote(dom)) domaines.add(dom);
  }
  return [...domaines].sort();
}

export async function releverAutorite({ cle, site = `https://${DOMAINE}/`, fetchFn }) {
  if (!cle || !String(cle).trim()) throw new Error('BING_WEBMASTER_API_KEY absent');
  const cibles = [];
  let liens = 0;
  for (let page = 0; page < BING_PAGES_MAX; page++) {
    const d = await bing('GetLinkCounts', { siteUrl: site, page: String(page) }, cle, fetchFn);
    for (const l of d.Links ?? []) { cibles.push(l.Url); liens += l.Count ?? 0; }
    if (page + 1 >= (d.TotalPages ?? 0)) break;
  }
  const details = [];
  for (const cible of cibles.slice(0, BING_CIBLES_MAX)) {
    for (let page = 0; page < BING_PAGES_MAX; page++) {
      const d = await bing('GetUrlLinks', { siteUrl: site, link: cible, page: String(page) }, cle, fetchFn);
      details.push(...(d.Details ?? []));
      if (page + 1 >= (d.TotalPages ?? 0)) break;
    }
  }
  const domaines = agregerDomaines(details);
  return {
    source: 'bing-webmaster',
    liens_entrants: liens,
    domaines_referents: domaines.length,
    domaines,
    tronque: cibles.length > BING_CIBLES_MAX,
  };
}

// ─── 5 · Comparaison et série ───────────────────────────────────────

/** Les rouges d'un point, comparé au point précédent de la série. */
export function comparer(point, precedent) {
  const rouges = [];
  for (const b of point.backlinks?.verifies ?? []) {
    if (!b.present) rouges.push(`backlink PERDU · #${b.numero} ${b.site} (${b.source ?? 'sans source'}) : ${b.motif}`);
    const avant = precedent?.backlinks?.verifies?.find((p) => p.numero === b.numero && p.source === b.source);
    if (b.present && avant?.present && estSuivi(avant.rel) && !estSuivi(b.rel)) {
      rouges.push(`backlink DÉGRADÉ · #${b.numero} ${b.site} : rel « ${avant.rel} » devenu « ${b.rel} »`);
    }
  }
  const avant = precedent?.autorite?.domaines;
  const maintenant = point.autorite?.domaines;
  if (Array.isArray(avant) && Array.isArray(maintenant) && !point.autorite?.tronque) {
    const perdus = avant.filter((d) => !maintenant.includes(d));
    if (perdus.length) rouges.push(`domaine(s) référent(s) PERDU(S) depuis le ${precedent.date} : ${perdus.join(', ')}`);
  }
  return rouges;
}

/** La série, avec le point du jour (un seul par date : le dernier relevé gagne). */
export function ajouterPoint(serie, point) {
  const points = (serie?.points ?? []).filter((p) => p.date !== point.date);
  points.push(point);
  points.sort((a, b) => a.date.localeCompare(b.date));
  return { _note: 'Écrit par scripts/seo-signals.mjs (workflow seo-signals.yml), jamais à la main.', points };
}

/** Le relevé complet. Chaque moitié qui échoue laisse `null` et une erreur, jamais un silence. */
export async function run({ env = process.env, fetchFn = globalThis.fetch, maintenant = new Date(), serie = { points: [] }, docBacklinks } = {}) {
  const erreurs = [];
  const periode = fenetre(maintenant);
  const point = { date: jour(maintenant), periode, gsc: null, backlinks: null, autorite: null };

  try {
    point.gsc = await releverSearchConsole({ brut: env.GSC_SERVICE_ACCOUNT_JSON, propriete: env.GSC_SITE_URL || PROPRIETE_DEFAUT, periode, fetchFn });
  } catch (e) {
    erreurs.push(`Search Console NON MESURÉE : ${e.message}`);
  }

  try {
    const faits = backlinksDeclares(docBacklinks ?? readFileSync(BACKLINKS, 'utf8')).filter((b) => b.etat === 'fait');
    point.backlinks = { declares_faits: faits.length, verifies: [] };
    for (const b of faits) point.backlinks.verifies.push(await verifierBacklink(b, fetchFn));
  } catch (e) {
    erreurs.push(`backlinks NON VÉRIFIÉS : ${e.message}`);
  }

  try {
    point.autorite = await releverAutorite({ cle: env.BING_WEBMASTER_API_KEY, fetchFn });
  } catch (e) {
    erreurs.push(`autorité NON MESURÉE : ${e.message}`);
  }

  const precedent = [...(serie?.points ?? [])].filter((p) => p.date < point.date).pop() ?? null;
  const rouges = [...erreurs, ...comparer(point, precedent)];
  point.rouges = rouges;
  return { point, serie: ajouterPoint(serie, point), rouges };
}

/** Le résumé imprimé : des agrégats et des domaines publics, aucun secret. */
export function resume({ point, rouges }) {
  const l = [`Signaux SEO du ${point.date} (fenêtre ${point.periode.debut} → ${point.periode.fin})`];
  if (point.gsc) {
    const { toutes: t, non_marque: n } = point.gsc;
    l.push(`  Search Console (${point.gsc.propriete})`);
    l.push(`    toutes requêtes : ${t.clics} clic(s), ${t.impressions} impression(s), position ${t.position ?? 'inconnue'}`);
    l.push(`    NON MARQUE      : ${n.clics} clic(s), ${n.impressions} impression(s), position ${n.position ?? 'inconnue'}`);
    for (const r of point.gsc.requetes_non_marque.slice(0, 10)) l.push(`      · « ${r.requete} » ${r.impressions} imp., ${r.clics} clic(s), pos. ${r.position}`);
  }
  if (point.backlinks) {
    l.push(`  Backlinks déclarés fait : ${point.backlinks.declares_faits}`);
    for (const b of point.backlinks.verifies) l.push(`    ${b.present ? '✓' : '✖'} #${b.numero} ${b.site} · ${b.present ? `rel ${b.rel}` : b.motif}`);
  }
  if (point.autorite) {
    l.push(`  Autorité (Bing) : ${point.autorite.domaines_referents} domaine(s) référent(s), ${point.autorite.liens_entrants} lien(s) entrant(s)`);
    for (const d of point.autorite.domaines) l.push(`    · ${d}`);
  }
  l.push(rouges.length ? `\n✖ ${rouges.length} rouge(s) :\n${rouges.map((r) => `  - ${r}`).join('\n')}` : '\n✓ aucun rouge');
  return l.join('\n');
}

const estLanceDirectement =
  process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].split(sep).join('/')}`).href;

if (estLanceDirectement) {
  // Lecture directe, sans `existsSync` avant : vérifier puis lire laisse une
  // fenêtre où le fichier change (CodeQL, js/file-system-race). Seul un
  // fichier ABSENT donne une série vide ; un JSON abîmé fait planter.
  let serie = { points: [] };
  try {
    serie = JSON.parse(readFileSync(SERIE, 'utf8'));
  } catch (e) {
    if (e?.code !== 'ENOENT') throw e;
  }
  const res = await run({ serie });
  writeFileSync(SERIE, `${JSON.stringify(res.serie, null, 2)}\n`, 'utf8');
  console.log(resume(res));
  console.log(`\nSérie écrite : docs/seo-signals-series.json (${res.serie.points.length} point(s)).`);
  process.exit(res.rouges.length ? 1 : 0);
}
