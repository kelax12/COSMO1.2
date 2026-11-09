// ═══════════════════════════════════════════════════════════════════
// detection-violation.mjs · LE DÉLAI DE 72 H COURT DEPUIS LA DÉTECTION,
// IL FAUT DONC QUE QUELQUE CHOSE DÉTECTE
//
// Appelé chaque matin par `.github/workflows/detection-violation.yml` (job
// `detecter`). Vague 6.1 du plan de reprise (OBS-01), reprise réécrite de la
// PR n° 125 ; `docs/OBSERVABILITE.md` AM-5.
//
// 🔴 POURQUOI CE FICHIER EXISTE
//
// `BK-1` (dumps de la base en clair dans les artefacts d'un dépôt public,
// 2026-08-29 au 2026-10-13) a été trouvée par un AUDIT, 45 jours après le
// début de l'exposition, et par aucune garde. Le délai CNIL de 72 h court
// depuis la prise de connaissance : une violation que rien ne regarde ne
// déclenche aucun compte à rebours.
//
// CE QU'IL LIT, chaque jour :
//   1 · les alertes de SECRET SCANNING ouvertes (`SECURITY_ALERTS_TOKEN`,
//       jeton fin en lecture seule : le jeton du run ne les lit pas) ;
//   2 · le CONTENU des artefacts déposés depuis 26 h (le dépôt est public) :
//       un dump, un export SQL, une base en clair, lus dans le zip lui-même ;
//   3 · les journaux Supabase (`edge_logs`, GET sur l'API Management,
//       24 h) : échecs d'authentification, échecs concentrés sur une IP,
//       réinitialisations, volume DISTINCT lu par un même compte, requêtes
//       d'un même compte, lignes rendues sans session.
//
// 🔴 LIGNES DISTINCTES, PAS LIGNES RENDUES : la PR n° 125 sommait les lignes
// de TOUTES les réponses d'un compte. Or l'application relit les mêmes pages
// sans cesse (invalidation de React Query après chaque écriture, retour sur
// l'onglet) : un usage ordinaire de la page OKR, qui relit son journal
// plafonné à 500 lignes après chaque mise à jour, franchissait le plancher
// sans exporter quoi que ce soit. D'où `lignes_sujet_max` : pour chaque
// compte, la somme, sur chaque FORME de requête distincte (chemin,
// paramètres, début de plage), de la plus grande réponse. Relire la même
// page ne compte qu'une fois ; paginer (offset, Range) ou varier les filtres
// compte chaque page. Limite écrite : une RPC paginée par son CORPS (absent
// des journaux) se replie sur une seule forme ; `requetes_sujet_max` la
// couvre en partie. La somme brute reste imprimée, pour mémoire, sans seuil.
//
// ⚠️ AUCUN IDENTIFIANT NE SORT DE SUPABASE : les requêtes exécutées rendent
// des MAXIMA et des COMPTES, jamais un compte ni une IP. Le résumé du job
// (public) ne porte donc que des nombres, des types d'alerte et des noms
// d'artefact. Pour identifier un compte, Axel rejoue `SQL_TRI` sur la
// fenêtre imprimée (MCP Supabase en lecture, ou Dashboard) : il n'est
// exécuté par aucun workflow.
//
// SORTIE : 0 = toutes les sources lues, aucun signal ; 1 = un signal, ou une
// source illisible. ❌ Jamais de vert sur une source non lue.
// ⚠️ Un signal n'est PAS une violation : c'est une prise de connaissance
// POSSIBLE. Le job `alerter` ouvre l'issue (propriétaire, échéance 72 h).
//
// 🔴 PAS DE SHEBANG : le témoin importe ce module (cf. `scripts/CLAUDE.md`).
// Témoin : `scripts/detection-violation.guard.test.mjs`.
// ═══════════════════════════════════════════════════════════════════
import { inflateRawSync, constants as zc } from 'node:zlib';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const GH = 'https://api.github.com';
const SB = 'https://api.supabase.com';
const PROJET_DEFAUT = 'ykeugqfgklejcdbrmawy';
const FENETRE_ARTEFACTS_H = 26;
const PREFIXE = 64 * 1024;
const TELECHARGEMENT_COMPLET = 100 * 1024 * 1024;
const MAX_ENTREES = 5000;

// ─── 1 · Seuils (planchers absolus) et vocabulaire des catégories ───

/** Au-dessus du plancher : signal. `categorie` est le SEUL mot qui sort du
 *  job vers l'alerte (vocabulaire fermé, `CATEGORIES`). */
export const MESURES = {
  echecs_auth: { plancher: 30, categorie: 'echecs-auth', libelle: "échecs d'authentification (4xx sur /auth/v1/token, verify, otp, recover, signup)" },
  echecs_auth_ip_max: { plancher: 15, categorie: 'echecs-auth-ip', libelle: "échecs d'authentification depuis une même IP" },
  reinitialisations: { plancher: 10, categorie: 'reinitialisations', libelle: 'demandes de réinitialisation de mot de passe' },
  lignes_sujet_max: { plancher: 20000, categorie: 'export-massif', libelle: 'lignes DISTINCTES lues par un même compte (export massif)' },
  requetes_sujet_max: { plancher: 5000, categorie: 'requetes-massives', libelle: "requêtes REST d'un même compte" },
  lignes_anon: { plancher: 200, categorie: 'lignes-anon', libelle: 'lignes REST rendues sans session (anon)' },
};

export const CATEGORIES = new Set([
  'secret-scanning', 'artefact-suspect', 'source-non-lue',
  ...Object.values(MESURES).map((m) => m.categorie),
]);

// ─── 2 · Journaux Supabase (ClickHouse, API Management, GET seul) ───

const SUJET = "log_attributes['request.sb.jwt.authorization.payload.subject']";
const AUTH_ECHEC = `
  source = 'edge_logs'
  AND log_attributes['request.method'] = 'POST'
  AND log_attributes['request.path'] IN ('/auth/v1/token', '/auth/v1/verify', '/auth/v1/otp', '/auth/v1/recover', '/auth/v1/signup')
  AND toInt32OrZero(log_attributes['response.status_code']) BETWEEN 400 AND 499`;
const LIGNES = `if(match(log_attributes['response.headers.content_range'], '^[0-9]+-[0-9]+'),
    toInt64OrZero(extract(log_attributes['response.headers.content_range'], '^[0-9]+-([0-9]+)'))
    - toInt64OrZero(extract(log_attributes['response.headers.content_range'], '^([0-9]+)-')) + 1, 0)`;
const REST = `source = 'edge_logs' AND startsWith(log_attributes['request.path'], '/rest/v1/')`;

/** Les requêtes EXÉCUTÉES. Chacune rend une seule ligne d'agrégats : un
 *  compte ou une IP n'apparaît que DANS une sous-requête, jamais en sortie. */
export const SQL_JOURNAUX = {
  totaux: `SELECT
  countIf(${AUTH_ECHEC}) AS echecs_auth,
  countIf(source = 'edge_logs' AND log_attributes['request.method'] = 'POST'
    AND log_attributes['request.path'] = '/auth/v1/recover') AS reinitialisations,
  sumIf(${LIGNES}, ${REST} AND ${SUJET} = ''
    AND log_attributes['request.sb.jwt.authorization.payload.role'] != 'service_role') AS lignes_anon,
  countIf(source = 'edge_logs') AS requetes_lues
FROM logs`,
  ip: `SELECT max(n) AS echecs_auth_ip_max FROM (
  SELECT log_attributes['request.headers.cf_connecting_ip'] AS ip, count() AS n
  FROM logs WHERE ${AUTH_ECHEC} GROUP BY ip)`,
  sujets: `SELECT max(distinctes) AS lignes_sujet_max, max(brutes) AS lignes_brutes_sujet_max, max(requetes) AS requetes_sujet_max FROM (
  SELECT sujet, sum(lmax) AS distinctes, sum(lsom) AS brutes, sum(n) AS requetes FROM (
    SELECT ${SUJET} AS sujet,
      log_attributes['request.path'] AS chemin,
      log_attributes['request.search'] AS parametres,
      extract(log_attributes['response.headers.content_range'], '^([0-9]+)-') AS debut,
      count() AS n, max(${LIGNES}) AS lmax, sum(${LIGNES}) AS lsom
    FROM logs WHERE ${REST} AND ${SUJET} != ''
    GROUP BY sujet, chemin, parametres, debut)
  GROUP BY sujet)`,
};

/** Pour le TRI À LA MAIN seulement (Axel, MCP en lecture ou Dashboard, sur
 *  la fenêtre imprimée par le run). ❌ Jamais exécutée par un workflow : elle
 *  rend des identifiants de compte. */
export const SQL_TRI = `SELECT sujet, sum(lmax) AS lignes_distinctes, sum(n) AS requetes, min(t0) AS debut, max(t1) AS fin FROM (
  SELECT ${SUJET} AS sujet, log_attributes['request.path'] AS chemin, log_attributes['request.search'] AS parametres,
    extract(log_attributes['response.headers.content_range'], '^([0-9]+)-') AS d,
    count() AS n, max(${LIGNES}) AS lmax, min(timestamp) AS t0, max(timestamp) AS t1
  FROM logs WHERE ${REST} AND ${SUJET} != '' GROUP BY sujet, chemin, parametres, d)
GROUP BY sujet ORDER BY lignes_distinctes DESC LIMIT 5`;

/** Une requête de journaux. GET seul, sur le seul point de lecture des journaux. */
export async function requeteJournaux(sql, { token, projet, debut, fin, fetchImpl = fetch }) {
  const q = new URLSearchParams({ sql, iso_timestamp_start: debut, iso_timestamp_end: fin });
  const res = await fetchImpl(`${SB}/v1/projects/${projet}/analytics/endpoints/logs?${q}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  const corps = await res.text();
  if (!res.ok) throw new Error(`API journaux Supabase : HTTP ${res.status}`);
  const json = JSON.parse(corps);
  if (json.error) throw new Error('API journaux Supabase : erreur de requête');
  if (!Array.isArray(json.result)) throw new Error('API journaux Supabase : réponse sans `result`');
  return json.result;
}

const n = (x) => Number(x ?? 0) || 0;

export async function lireJournaux(ctx) {
  const t = (await requeteJournaux(SQL_JOURNAUX.totaux, ctx))[0];
  if (!t) throw new Error('API journaux Supabase : aucune ligne de totaux');
  // 🔴 Anti-« garde qui répond sans mesurer » : sur 24 h, la passerelle voit
  // au moins les sondes d'`uptime.yml`. Zéro requête = une lecture qui ne
  // voit plus rien (source renommée, clé changée), pas un service calme.
  if (!(n(t.requetes_lues) > 0)) throw new Error('journaux Supabase : 0 requête sur 24 h, la lecture ne voit rien');
  const ip = (await requeteJournaux(SQL_JOURNAUX.ip, ctx))[0] ?? {};
  const s = (await requeteJournaux(SQL_JOURNAUX.sujets, ctx))[0] ?? {};
  // Liste blanche des champs : un champ inattendu dans la réponse (un
  // identifiant) ne traverse pas.
  return {
    mesures: {
      echecs_auth: n(t.echecs_auth),
      echecs_auth_ip_max: n(ip.echecs_auth_ip_max),
      reinitialisations: n(t.reinitialisations),
      lignes_sujet_max: n(s.lignes_sujet_max),
      requetes_sujet_max: n(s.requetes_sujet_max),
      lignes_anon: n(t.lignes_anon),
    },
    info: { requetes_lues: n(t.requetes_lues), lignes_brutes_sujet_max: n(s.lignes_brutes_sujet_max) },
  };
}

// ─── 3 · GitHub ────────────────────────────────────────────────────

async function ghPage(url, token, fetchImpl) {
  const res = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
  });
  if (!res.ok) throw new Error(`GitHub ${new URL(url).pathname} : HTTP ${res.status}`);
  return { json: await res.json(), suivante: /<([^>]+)>;\s*rel="next"/.exec(res.headers.get('link') ?? '')?.[1] ?? null };
}

/** Secret scanning. ⚠️ La réponse porte la VALEUR du secret (`secret`) :
 *  seuls le numéro, le type et la date en sont gardés. */
export async function lireSecretScanning({ depot, token, fetchImpl = fetch }) {
  const out = [];
  for (let url = `${GH}/repos/${depot}/secret-scanning/alerts?state=open&per_page=100`; url;) {
    const p = await ghPage(url, token, fetchImpl);
    for (const a of p.json) out.push({ numero: a.number, type: a.secret_type, cree: a.created_at });
    url = p.suivante;
  }
  return out;
}

// ─── 4 · Le CONTENU des artefacts (repris de la PR n° 125) ──────────

const CHIFFRE_MAGIE = (b) =>
  b.length > 0 && ([0x8c, 0xc3, 0x84, 0x85, 0xc1].includes(b[0]) ||
    b.subarray(0, 21).toString('latin1') === 'age-encryption.org/v1' ||
    b.subarray(0, 27).toString('latin1') === '-----BEGIN PGP MESSAGE-----');
const EXT_CHIFFRE = /\.(gpg|pgp|age|enc)$/i;
const EXT_BASE = /\.(dump|backup|bak|sqlite3?|db)$/i;
const DOMAINES_FICTIFS = /@(?:[\w-]+\.)*(?:example\.(?:com|org|net)|test|local|localhost|invalid|cosmo\.test|users\.noreply\.github\.com)$/i;

/** Ce qu'un début de fichier dit de lui. `null` = rien de suspect. */
export function classer(nom, debut) {
  const chiffre = EXT_CHIFFRE.test(nom) || CHIFFRE_MAGIE(debut);
  if (EXT_CHIFFRE.test(nom) && !CHIFFRE_MAGIE(debut)) return "porte une extension chiffrée mais son contenu n'est pas chiffré";
  if (chiffre) return null;
  const t = debut.toString('latin1');
  if (t.startsWith('PGDMP')) return 'dump PostgreSQL (format custom, en-tête PGDMP)';
  if (t.startsWith('SQLite format 3\u0000')) return 'base SQLite';
  if (/PostgreSQL database dump/.test(t)) return 'dump PostgreSQL (SQL en clair)';
  if (/^COPY\s+[\w."]+\s*\([^)]*\)\s+FROM\s+stdin;/m.test(t)) return 'données de table (COPY … FROM stdin)';
  if (/INSERT INTO\s+"?(?:public|auth)"?\./i.test(t)) return 'données de table (INSERT INTO public/auth)';
  if (EXT_BASE.test(nom)) return 'nom de dump ou de base, contenu non chiffré';
  const emails = new Set((t.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) ?? []).filter((e) => !DOMAINES_FICTIFS.test(e)));
  if (emails.size >= 20) return `${emails.size} adresses e-mail distinctes`;
  return null;
}

const u16 = (b, o) => b.readUInt16LE(o);
const u32 = (b, o) => b.readUInt32LE(o);
const u64 = (b, o) => Number(b.readBigUInt64LE(o));

/** Entrées d'un zip, lues par son répertoire central. `lire(debut, longueur)`
 *  rend les octets demandés : un tampon complet ou des requêtes `Range`. */
export async function entreesZip(taille, lire) {
  const queue = Math.min(taille, 65557 + 20);
  const fin = await lire(taille - queue, queue);
  let eocd = -1;
  for (let i = fin.length - 22; i >= 0; i--) if (u32(fin, i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('zip sans fin de répertoire central (EOCD)');
  let nb = u16(fin, eocd + 10);
  let tailleCd = u32(fin, eocd + 12);
  let debutCd = u32(fin, eocd + 16);
  const loc = eocd - 20;
  if (loc >= 0 && u32(fin, loc) === 0x07064b50) {
    const rec = await lire(u64(fin, loc + 8), 56);
    if (u32(rec, 0) !== 0x06064b50) throw new Error('zip64 : enregistrement de fin illisible');
    nb = u64(rec, 32);
    tailleCd = u64(rec, 40);
    debutCd = u64(rec, 48);
  }
  if (nb > MAX_ENTREES) throw new Error(`${nb} fichiers dans le zip, plus que les ${MAX_ENTREES} lus : contenu non vérifié`);
  const cd = await lire(debutCd, tailleCd);
  const out = [];
  let p = 0;
  for (let k = 0; k < nb; k++) {
    if (u32(cd, p) !== 0x02014b50) throw new Error('zip : répertoire central corrompu');
    const methode = u16(cd, p + 10);
    let comp = u32(cd, p + 20);
    let brut = u32(cd, p + 24);
    const ln = u16(cd, p + 28);
    const le = u16(cd, p + 30);
    const lc = u16(cd, p + 32);
    let local = u32(cd, p + 42);
    const nom = cd.subarray(p + 46, p + 46 + ln).toString('utf8');
    let x = p + 46 + ln;
    const finExtra = x + le;
    while (x + 4 <= finExtra) {
      const id = u16(cd, x);
      const lg = u16(cd, x + 2);
      if (id === 0x0001) {
        let q = x + 4;
        if (brut === 0xffffffff) { brut = u64(cd, q); q += 8; }
        if (comp === 0xffffffff) { comp = u64(cd, q); q += 8; }
        if (local === 0xffffffff) local = u64(cd, q);
      }
      x += 4 + lg;
    }
    out.push({ nom, methode, comp, brut, local });
    p = finExtra + lc;
  }
  return out;
}

/** Les premiers octets décompressés d'une entrée. */
export async function debutEntree(e, lire) {
  if (e.nom.endsWith('/') || e.comp === 0) return Buffer.alloc(0);
  const tete = await lire(e.local, 30);
  if (u32(tete, 0) !== 0x04034b50) throw new Error(`zip : en-tête local illisible pour ${e.nom}`);
  const donnees = e.local + 30 + u16(tete, 26) + u16(tete, 28);
  const brut = await lire(donnees, Math.min(e.comp, PREFIXE));
  if (e.methode === 0) return brut;
  if (e.methode === 8) return inflateRawSync(brut, { finishFlush: zc.Z_SYNC_FLUSH }).subarray(0, PREFIXE);
  throw new Error(`zip : méthode de compression ${e.methode} non lue pour ${e.nom}`);
}

/** Inspecte un zip déjà accessible par `lire`. Rend les fichiers suspects. */
export async function inspecterZip(taille, lire) {
  const suspects = [];
  for (const e of await entreesZip(taille, lire)) {
    if (e.nom.endsWith('/')) continue;
    const pourquoi = classer(e.nom, await debutEntree(e, lire));
    if (pourquoi) suspects.push({ fichier: e.nom, pourquoi });
  }
  return suspects;
}

/** Lecteur d'un artefact : tout le zip s'il est petit, sinon des `Range`
 *  sur l'URL signée vers laquelle GitHub redirige. */
export async function lecteurArtefact(a, token, fetchImpl, seuilComplet = TELECHARGEMENT_COMPLET) {
  const res = await fetchImpl(`${GH}/repos/${a.depot}/actions/artifacts/${a.id}/zip`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    redirect: 'manual',
  });
  const cible = res.headers.get('location');
  if (res.status !== 302 || !cible) throw new Error(`artefact ${a.nom} : HTTP ${res.status} au lieu d'une redirection`);
  if (a.taille <= seuilComplet) {
    const r = await fetchImpl(cible);
    if (!r.ok) throw new Error(`artefact ${a.nom} : téléchargement HTTP ${r.status}`);
    const tout = Buffer.from(await r.arrayBuffer());
    return { taille: tout.length, lire: async (d, l) => tout.subarray(d, d + l) };
  }
  const lire = async (d, l) => {
    const r = await fetchImpl(cible, { headers: { Range: `bytes=${d}-${d + l - 1}` } });
    if (r.status !== 206) throw new Error(`artefact ${a.nom} : lecture partielle refusée (HTTP ${r.status})`);
    return Buffer.from(await r.arrayBuffer());
  };
  return { taille: a.taille, lire };
}

export async function lireArtefacts({ depot, token, maintenant, fetchImpl = fetch }) {
  const limite = maintenant.getTime() - FENETRE_ARTEFACTS_H * 3600_000;
  const recents = [];
  // Les artefacts arrivent du plus récent au plus ancien : arrêt à la fenêtre.
  let url = `${GH}/repos/${depot}/actions/artifacts?per_page=100`;
  for (let page = 0; url; page++) {
    if (page >= 20) throw new Error('plus de 2 000 artefacts en 26 h : fenêtre non lue entièrement');
    const { json, suivante } = await ghPage(url, token, fetchImpl);
    url = suivante;
    for (const a of json.artifacts ?? []) {
      if (Date.parse(a.created_at) < limite) { url = null; break; }
      if (!a.expired) recents.push({ id: a.id, nom: a.name, taille: a.size_in_bytes, depot, run: a.workflow_run?.id });
    }
  }
  const suspects = [];
  for (const a of recents) {
    const { taille, lire } = await lecteurArtefact(a, token, fetchImpl);
    for (const s of await inspecterZip(taille, lire)) suspects.push({ artefact: a.nom, run: a.run, ...s });
  }
  return { lus: recents.length, suspects };
}

// ─── 5 · Décision (pure : le témoin la rejoue sans réseau) ──────────

/** Un nom venu de l'extérieur (artefact, fichier de zip : une PR depuis une
 *  fourche peut déposer un artefact) ne doit ni injecter une commande de
 *  workflow (`::`, `%`, retour à la ligne) ni casser le bloc du résumé
 *  (accent grave). Caractères de contrôle retirés, longueur bornée. */
export function propre(s, max = 80) {
  const t = String(s ?? '')
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/[`%]/g, '_')
    .replace(/::/g, ': :');
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

export function decider(sources) {
  const signaux = [];
  const s = sources;
  if (s.secretScanning?.ok) {
    for (const a of s.secretScanning.valeur) {
      signaux.push({ categorie: 'secret-scanning', resume: `alerte de secret scanning n° ${propre(a.numero, 10)} ouverte (${propre(a.type, 60)}, depuis le ${propre(String(a.cree).slice(0, 10), 10)})` });
    }
  }
  if (s.artefacts?.ok) {
    for (const x of s.artefacts.valeur.suspects) {
      signaux.push({ categorie: 'artefact-suspect', resume: `artefact « ${propre(x.artefact)} » (run ${propre(x.run, 20)}), fichier « ${propre(x.fichier)} » : ${x.pourquoi}` });
    }
  }
  const mesures = s.journaux?.ok ? s.journaux.valeur.mesures : {};
  for (const [cle, def] of Object.entries(MESURES)) {
    if (!s.journaux?.ok) break;
    const v = mesures[cle];
    if (v > def.plancher) signaux.push({ categorie: def.categorie, resume: `${def.libelle} : ${v} sur 24 h, seuil ${def.plancher}` });
  }
  const erreurs = Object.entries(s).filter(([, x]) => !x.ok).map(([k, x]) => `${k} : ${x.erreur}`);
  const categories = [...new Set([...signaux.map((x) => x.categorie), ...(erreurs.length ? ['source-non-lue'] : [])])].sort();
  const statut = signaux.length ? 'signal' : erreurs.length ? 'source-non-lue' : 'rien';
  return { signaux, erreurs, mesures, categories, statut, exit: statut === 'rien' ? 0 : 1 };
}

const iso = (d) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');

async function source(nom, f) {
  try {
    return [nom, { ok: true, valeur: await f() }];
  } catch (e) {
    return [nom, { ok: false, erreur: String(e?.message ?? e).slice(0, 200) }];
  }
}

/** Point d'entrée testable : rend `{ exit, lignes, resume, sorties }`, n'écrit rien. */
export async function executer(env, { fetchImpl = fetch, maintenant = new Date() } = {}) {
  const fin = iso(maintenant);
  const debut = iso(new Date(maintenant.getTime() - 24 * 3600_000));
  const manquants = [];
  if (!env.GH_TOKEN) manquants.push('GH_TOKEN (jeton du run : artefacts)');
  if (!env.SECURITY_ALERTS_TOKEN) manquants.push('SECURITY_ALERTS_TOKEN (alertes de secret scanning)');
  if (!env.SUPABASE_ACCESS_TOKEN) manquants.push('SUPABASE_ACCESS_TOKEN (journaux Supabase)');
  if (!env.REPO) manquants.push('REPO');
  if (manquants.length) {
    const ligne = `Échec FERMÉ, rien n'a été lu. Manquent : ${manquants.join(' ; ')}. Un jour sans lecture n'est pas un jour sans violation.`;
    return {
      exit: 1,
      lignes: [`::error title=detection::${ligne}`],
      resume: `### ✖ Détection de violation : aucune source lue\n\n${ligne}\n`,
      sorties: { statut: 'source-non-lue', categories: 'source-non-lue', detecte_le: fin },
    };
  }
  const depot = env.REPO;
  const projet = env.SUPABASE_PROJECT_REF || PROJET_DEFAUT;
  const sources = Object.fromEntries(await Promise.all([
    source('secretScanning', () => lireSecretScanning({ depot, token: env.SECURITY_ALERTS_TOKEN, fetchImpl })),
    source('artefacts', () => lireArtefacts({ depot, token: env.GH_TOKEN, maintenant, fetchImpl })),
    source('journaux', () => lireJournaux({ token: env.SUPABASE_ACCESS_TOKEN, projet, debut, fin, fetchImpl })),
  ]));
  const d = decider(sources);

  // Journal du run et résumé (PUBLICS) : nombres, types, noms d'artefact.
  const lignes = [];
  lignes.push(`Fenêtre des journaux : ${debut} → ${fin} ; artefacts : ${FENETRE_ARTEFACTS_H} h.`);
  for (const [k, x] of Object.entries(sources)) lignes.push(`  ${k} : ${x.ok ? 'lue' : 'NON LUE'}`);
  if (sources.artefacts.ok) lignes.push(`  artefacts inspectés : ${sources.artefacts.valeur.lus}`);
  if (sources.secretScanning.ok) lignes.push(`  alertes de secret scanning ouvertes : ${sources.secretScanning.valeur.length}`);
  for (const [k, def] of Object.entries(MESURES)) {
    if (sources.journaux.ok) lignes.push(`  ${k} = ${d.mesures[k]} (plancher ${def.plancher})`);
  }
  if (sources.journaux.ok) {
    const i = sources.journaux.valeur.info;
    lignes.push(`  pour mémoire, sans seuil : requêtes lues ${i.requetes_lues}, somme brute des lignes du compte le plus lu ${i.lignes_brutes_sujet_max}`);
  }
  for (const e of d.erreurs) lignes.push(`::error title=detection · source non lue::${e}`);
  for (const s of d.signaux) lignes.push(`::error title=detection · signal::${s.resume}`);
  lignes.push(`Détection : ${d.statut === 'signal' ? 'SIGNAL' : d.statut === 'source-non-lue' ? 'SOURCE NON LUE' : 'aucune, toutes sources lues'}.`);

  const titre = d.statut === 'rien' ? '### Détection de violation : aucun signal, toutes sources lues' : `### ✖ Détection de violation : ${d.statut === 'signal' ? 'SIGNAL' : 'SOURCE NON LUE'}`;
  const corps = lignes.filter((l) => !l.startsWith('::')).concat(d.erreurs.map((e) => `NON LUE · ${e}`), d.signaux.map((s) => `SIGNAL · ${s.resume}`));
  const tri = d.statut === 'signal' && d.signaux.some((s) => s.categorie !== 'secret-scanning' && s.categorie !== 'artefact-suspect')
    ? `\nTri (Axel) : rejouer \`SQL_TRI\` de \`scripts/detection-violation.mjs\` sur la fenêtre ci-dessus, en lecture (MCP Supabase ou Dashboard). Aucun identifiant n'est écrit ici.\n`
    : '';
  const resume = `${titre}\n\n\`\`\`\n${corps.join('\n')}\n\`\`\`\n${tri}`;
  return { exit: d.exit, lignes, resume, sorties: { statut: d.statut, categories: d.categories.join(','), detecte_le: fin } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let r;
  try {
    r = await executer(process.env);
  } catch (e) {
    const fin = iso(new Date());
    r = {
      exit: 1,
      lignes: [`::error title=detection::détecteur en panne (${String(e?.message ?? e).slice(0, 200)}) : échec fermé`],
      resume: '### ✖ Détection de violation : détecteur en panne\n',
      sorties: { statut: 'source-non-lue', categories: 'source-non-lue', detecte_le: fin },
    };
  }
  for (const l of r.lignes) console.log(l);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, r.resume);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(r.sorties).map(([k, v]) => `${k}=${v}\n`).join(''));
  }
  process.exit(r.exit);
}
