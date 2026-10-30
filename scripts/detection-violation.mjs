// ═══════════════════════════════════════════════════════════════════
// detection-violation.mjs · LE DÉLAI DE 72 H COURT DEPUIS LA DÉTECTION,
// ET IL FAUT DONC QUE QUELQUE CHOSE DÉTECTE
//
// Appelé chaque matin par `.github/workflows/detection-violation.yml`.
// `docs/RGPD-VIOLATION.md` AM-2 / AM-2bis / AM-3, `docs/OBSERVABILITE.md` AM-5.
//
// 🔴 POURQUOI CE FICHIER EXISTE
//
// `BK-1` (dumps de la base en clair dans les artefacts d'un dépôt public,
// 2026-08-29 → 2026-10-13) a été trouvée par un AUDIT, quarante-cinq jours
// après le début de l'exposition, et par aucune garde. Le délai CNIL de 72 h
// court depuis la prise de connaissance : une violation que rien ne regarde
// ne déclenche aucun compte à rebours. Et un registre des violations vide ne
// disait pas si c'était « aucune violation » ou « aucune détection » (AM-3).
//
// CE QU'IL LIT, chaque jour, sur les dernières 24 h (26 h pour les artefacts) :
//   1 · alertes GitHub de SECRET SCANNING ouvertes ;
//   2 · alertes GitHub de CODE SCANNING de sécurité ouvertes ;
//   3 · le CONTENU des artefacts du dépôt (public) : un dump, un export SQL
//       ou une base en clair, lus par le zip lui-même, pas par leur nom ;
//   4 · les journaux Supabase (`edge_logs`, API Management) : échecs
//       d'authentification, échecs concentrés sur une IP, demandes de
//       réinitialisation, lignes lues par un même compte (export massif),
//       lignes rendues à `anon` (une RLS qui fuit), comparés à une RÉFÉRENCE
//       d'écart tirée des jours précédents.
//
// CE QU'IL ÉCRIT : une ligne datée par run dans `journal.jsonl`, que le
// workflow chiffre (gpg, `BACKUP_PASSPHRASE`) avant de la déposer. Chaque
// ligne dit quelles sources ont été LUES et ce qu'elles ont donné : un
// registre vide se lit désormais contre ce journal. Les détails (IP, compte,
// numéro d'alerte) n'existent QUE dans ce fichier chiffré ; le journal du run
// et le message d'alerte ne portent que des comptes.
//
// SORTIE : 0 = toutes les sources lues, aucun signal ; 1 = un signal, ou une
// source illisible. ❌ Jamais de vert sur une source non lue : une garde qui
// saute sa moitié en silence répond sans mesurer (`scripts/CLAUDE.md`).
// ⚠️ Un signal n'est PAS une violation. C'est une prise de connaissance
// POSSIBLE : le message porte l'échéance de 72 h, pour qu'elle soit posée en
// rappel dès la lecture (retour d'expérience de BK-1, AM-1).
//
// 🔴 PAS DE SHEBANG : le témoin importe ce module (cf. `ops-alert.mjs`).
// Témoin : `scripts/detection-violation.guard.test.mjs`.
// ═══════════════════════════════════════════════════════════════════
import { inflateRawSync, constants as zc } from 'node:zlib';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { deliver } from './ops-alert.mjs';

const GH = 'https://api.github.com';
const SB = 'https://api.supabase.com';
const PROJET_DEFAUT = 'ykeugqfgklejcdbrmawy';
export const NOM_JOURNAL = 'detection-journal';
const FENETRE_ARTEFACTS_H = 26;
const PREFIXE = 64 * 1024;
const TELECHARGEMENT_COMPLET = 100 * 1024 * 1024;
const MAX_ENTREES = 5000;

// ─── 1 · Seuils : un plancher absolu ET une référence d'écart ──────

/** `plancher` : en dessous, jamais un signal (bruit d'un petit service).
 *  Au-dessus, le signal part si la valeur dépasse aussi la référence tirée
 *  des jours précédents (moyenne + 4 écarts-types, à partir de 7 jours). */
export const MESURES = {
  echecs_auth: { plancher: 30, libelle: "échecs d'authentification (4xx sur /auth/v1/token, verify, otp, recover, signup)" },
  echecs_auth_ip_max: { plancher: 15, libelle: "échecs d'authentification depuis une même IP" },
  reinitialisations: { plancher: 10, libelle: 'demandes de réinitialisation de mot de passe' },
  lignes_sujet_max: { plancher: 20000, libelle: 'lignes REST lues par un même compte (export massif)' },
  requetes_sujet_max: { plancher: 5000, libelle: 'requêtes REST d un même compte' },
  lignes_anon: { plancher: 200, libelle: 'lignes REST rendues sans session (anon)' },
};

export function reference(serie, plancher) {
  const xs = serie.filter((x) => Number.isFinite(x));
  if (xs.length < 7) return { seuil: plancher, base: `plancher seul (${xs.length} jour(s) de référence, 7 requis)` };
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = Math.max(1, Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length));
  const ecart = Math.ceil(m + 4 * sd);
  return ecart > plancher
    ? { seuil: ecart, base: `moyenne ${m.toFixed(1)} + 4 × ${sd.toFixed(1)} sur ${xs.length} jours` }
    : { seuil: plancher, base: `plancher (référence ${ecart} sur ${xs.length} jours)` };
}

/** Série d'une mesure dans le journal précédent : runs de `main` seulement,
 *  28 derniers, un par jour (le dernier du jour). */
export function serieDe(journal, cle) {
  const parJour = new Map();
  for (const l of journal) {
    if (l.branche !== 'main' || !l.mesures || !Number.isFinite(l.mesures[cle])) continue;
    parJour.set(String(l.date).slice(0, 10), l.mesures[cle]);
  }
  return [...parJour.entries()].sort().slice(-28).map(([, v]) => v);
}

// ─── 2 · Journaux Supabase (ClickHouse, API Management) ───────────

const AUTH_ECHEC = `
  source = 'edge_logs'
  AND log_attributes['request.method'] = 'POST'
  AND log_attributes['request.path'] IN ('/auth/v1/token', '/auth/v1/verify', '/auth/v1/otp', '/auth/v1/recover', '/auth/v1/signup')
  AND toInt32OrZero(log_attributes['response.status_code']) BETWEEN 400 AND 499`;
const LIGNES = `if(match(log_attributes['response.headers.content_range'], '^[0-9]+-[0-9]+'),
    toInt64OrZero(extract(log_attributes['response.headers.content_range'], '^[0-9]+-([0-9]+)'))
    - toInt64OrZero(extract(log_attributes['response.headers.content_range'], '^([0-9]+)-')) + 1, 0)`;
const REST = `source = 'edge_logs' AND startsWith(log_attributes['request.path'], '/rest/v1/')`;

/** Chaque requête rend des agrégats ; seules `ip_max` et `sujet_max` portent
 *  un identifiant, qui ne quitte jamais le journal chiffré. */
export const SQL_JOURNAUX = {
  totaux: `SELECT
  countIf(${AUTH_ECHEC}) AS echecs_auth,
  countIf(source = 'edge_logs' AND log_attributes['request.method'] = 'POST'
    AND log_attributes['request.path'] = '/auth/v1/recover') AS reinitialisations,
  sumIf(${LIGNES}, ${REST} AND log_attributes['request.sb.jwt.authorization.payload.subject'] = ''
    AND log_attributes['request.sb.jwt.authorization.payload.role'] != 'service_role') AS lignes_anon,
  countIf(source = 'edge_logs') AS requetes_lues
FROM logs`,
  ip_max: `SELECT log_attributes['request.headers.cf_connecting_ip'] AS ip, count() AS n
FROM logs WHERE ${AUTH_ECHEC}
GROUP BY ip ORDER BY n DESC LIMIT 3`,
  sujet_max: `SELECT log_attributes['request.sb.jwt.authorization.payload.subject'] AS sujet,
  count() AS requetes, sum(${LIGNES}) AS lignes
FROM logs WHERE ${REST} AND log_attributes['request.sb.jwt.authorization.payload.subject'] != ''
GROUP BY sujet ORDER BY lignes DESC LIMIT 3`,
};

export async function requeteJournaux(sql, { token, projet, debut, fin, fetchImpl = fetch }) {
  const q = new URLSearchParams({ sql, iso_timestamp_start: debut, iso_timestamp_end: fin });
  const res = await fetchImpl(`${SB}/v1/projects/${projet}/analytics/endpoints/logs?${q}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const corps = await res.text();
  if (!res.ok) throw new Error(`API journaux Supabase : HTTP ${res.status} ${corps.slice(0, 200)}`);
  const json = JSON.parse(corps);
  if (json.error) throw new Error(`API journaux Supabase : ${JSON.stringify(json.error).slice(0, 200)}`);
  if (!Array.isArray(json.result)) throw new Error('API journaux Supabase : réponse sans `result`');
  return json.result;
}

export async function lireJournaux(ctx) {
  const t = (await requeteJournaux(SQL_JOURNAUX.totaux, ctx))[0];
  if (!t) throw new Error('API journaux Supabase : aucune ligne de totaux');
  // 🔴 Anti-« garde qui répond sans mesurer » : sur 24 h, la passerelle voit
  // au moins les sondes d'`uptime.yml`. Zéro requête = une requête qui ne lit
  // plus rien (source renommée, clé changée), pas un service calme.
  if (!(Number(t.requetes_lues) > 0)) throw new Error('journaux Supabase : 0 requête sur 24 h, la lecture ne voit rien');
  const ips = await requeteJournaux(SQL_JOURNAUX.ip_max, ctx);
  const sujets = await requeteJournaux(SQL_JOURNAUX.sujet_max, ctx);
  const n = (x) => Number(x ?? 0) || 0;
  return {
    mesures: {
      echecs_auth: n(t.echecs_auth),
      echecs_auth_ip_max: n(ips[0]?.n),
      reinitialisations: n(t.reinitialisations),
      lignes_sujet_max: Math.max(0, ...sujets.map((s) => n(s.lignes))),
      requetes_sujet_max: Math.max(0, ...sujets.map((s) => n(s.requetes))),
      lignes_anon: n(t.lignes_anon),
    },
    details: { requetes_lues: n(t.requetes_lues), ips, sujets },
  };
}

// ─── 3 · GitHub ────────────────────────────────────────────────────

/** Une page de l'API GitHub, et l'URL de la suivante. */
async function ghPage(url, token, fetchImpl) {
  const res = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
  });
  if (!res.ok) throw new Error(`GitHub ${new URL(url).pathname} : HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  return { json: await res.json(), suivante: /<([^>]+)>;\s*rel="next"/.exec(res.headers.get('link') ?? '')?.[1] ?? null };
}

async function gh(chemin, token, fetchImpl) {
  const out = [];
  for (let url = `${GH}${chemin}`; url;) {
    const p = await ghPage(url, token, fetchImpl);
    out.push(p.json);
    url = p.suivante;
  }
  return out;
}

/** Secret scanning. ⚠️ La réponse porte la valeur du secret (`secret`) :
 *  elle n'est JAMAIS recopiée, ni au journal du run, ni dans le chiffré. */
export async function lireSecretScanning({ depot, token, fetchImpl = fetch }) {
  const pages = await gh(`/repos/${depot}/secret-scanning/alerts?state=open&per_page=100`, token, fetchImpl);
  return pages.flat().map((a) => ({ numero: a.number, type: a.secret_type, cree: a.created_at, url: a.html_url }));
}

export async function lireCodeScanning({ depot, token, fetchImpl = fetch }) {
  const pages = await gh(`/repos/${depot}/code-scanning/alerts?state=open&per_page=100`, token, fetchImpl);
  return pages.flat().map((a) => ({
    numero: a.number,
    regle: a.rule?.id,
    gravite: a.rule?.security_severity_level ?? null,
    url: a.html_url,
  }));
}

// ─── 4 · Le CONTENU des artefacts ───────────────────────────────────

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
  if (eocd < 0) throw new Error("zip sans fin de répertoire central (EOCD)");
  let n = u16(fin, eocd + 10);
  let tailleCd = u32(fin, eocd + 12);
  let debutCd = u32(fin, eocd + 16);
  const loc = eocd - 20;
  if (loc >= 0 && u32(fin, loc) === 0x07064b50) {
    const rec = await lire(u64(fin, loc + 8), 56);
    if (u32(rec, 0) !== 0x06064b50) throw new Error('zip64 : enregistrement de fin illisible');
    n = u64(rec, 32);
    tailleCd = u64(rec, 40);
    debutCd = u64(rec, 48);
  }
  if (n > MAX_ENTREES) throw new Error(`${n} fichiers dans le zip, plus que les ${MAX_ENTREES} lus : contenu non vérifié`);
  const cd = await lire(debutCd, tailleCd);
  const out = [];
  let p = 0;
  for (let k = 0; k < n; k++) {
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
  if (e.methode === 8) {
    const sortie = inflateRawSync(brut, { finishFlush: zc.Z_SYNC_FLUSH });
    return sortie.subarray(0, PREFIXE);
  }
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
  // Les artefacts arrivent du plus récent au plus ancien : on s'arrête à la fenêtre.
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
    for (const s of await inspecterZip(taille, lire)) suspects.push({ artefact: a.nom, id: a.id, run: a.run, ...s });
  }
  return { lus: recents.length, octets: recents.reduce((s, a) => s + a.taille, 0), suspects };
}

// ─── 5 · Le journal précédent (chiffré), d'où vient la référence ─────

/** gpg symétrique, phrase par fichier temporaire (jamais en argument). */
export function dechiffrer(chiffre, phrase) {
  const dir = mkdtempSync(join(tmpdir(), 'dv-'));
  try {
    writeFileSync(join(dir, 'p'), phrase, { mode: 0o600 });
    writeFileSync(join(dir, 'c'), chiffre);
    const r = spawnSync('gpg', ['--batch', '--yes', '--pinentry-mode', 'loopback', '--passphrase-file', join(dir, 'p'), '-o', join(dir, 'clair'), '-d', join(dir, 'c')], { stdio: 'pipe' });
    if (r.status !== 0) throw new Error('journal précédent : déchiffrement refusé (phrase changée ?)');
    return readFileSync(join(dir, 'clair'), 'utf8');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function lignesJournal(texte) {
  return texte.split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
}

/** Le dernier journal déposé par un run de `main`. `null` au premier run. */
export async function journalPrecedent({ depot, token, phrase, fetchImpl = fetch }) {
  const [json] = await gh(`/repos/${depot}/actions/artifacts?name=${NOM_JOURNAL}&per_page=100`, token, fetchImpl);
  const a = (json.artifacts ?? [])
    .filter((x) => !x.expired && x.workflow_run?.head_branch === 'main')
    .sort((x, y) => Date.parse(y.created_at) - Date.parse(x.created_at))[0];
  if (!a) return null;
  const { taille, lire } = await lecteurArtefact({ id: a.id, nom: a.name, taille: a.size_in_bytes, depot }, token, fetchImpl);
  const e = (await entreesZip(taille, lire)).find((x) => x.nom.endsWith('.gpg'));
  if (!e) throw new Error('journal précédent : aucun fichier chiffré dans l artefact');
  const tete = await lire(e.local, 30);
  const d = e.local + 30 + u16(tete, 26) + u16(tete, 28);
  const brut = await lire(d, e.comp);
  const chiffre = e.methode === 8 ? inflateRawSync(brut) : brut;
  return lignesJournal(dechiffrer(chiffre, phrase));
}

// ─── 6 · Décision ───────────────────────────────────────────────────

/** Tout est pur ici : le témoin rejoue la décision sans réseau. */
export function decider({ sources, precedent = [] }) {
  const signaux = [];
  const mesures = {};
  const seuils = {};
  const s = sources;
  if (s.secretScanning?.ok) {
    for (const a of s.secretScanning.valeur) signaux.push({ source: 'secret-scanning', resume: `alerte de secret ouverte (${a.type})`, detail: a });
  }
  if (s.codeScanning?.ok) {
    for (const a of s.codeScanning.valeur.filter((x) => x.gravite)) {
      signaux.push({ source: 'code-scanning', resume: `alerte de sécurité ouverte (${a.gravite})`, detail: a });
    }
  }
  if (s.artefacts?.ok) {
    for (const x of s.artefacts.valeur.suspects) signaux.push({ source: 'artefacts', resume: `artefact « ${x.artefact} » : ${x.pourquoi}`, detail: x });
  }
  if (s.journaux?.ok) {
    for (const [cle, def] of Object.entries(MESURES)) {
      const v = s.journaux.valeur.mesures[cle];
      mesures[cle] = v;
      const r = reference(serieDe(precedent, cle), def.plancher);
      seuils[cle] = r;
      if (v > r.seuil) signaux.push({ source: 'journaux-supabase', resume: `${def.libelle} : ${v} sur 24 h, seuil ${r.seuil}`, detail: { cle, valeur: v, ...r } });
    }
  }
  const erreurs = Object.entries(s).filter(([, x]) => !x.ok).map(([k, x]) => `${k} : ${x.erreur}`);
  return { signaux, erreurs, mesures, seuils, exit: signaux.length || erreurs.length ? 1 : 0 };
}

const iso = (d) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');

/** Message POUSSÉ : des comptes et des types, jamais une IP ni un compte. */
export function messageAlerte({ signaux, maintenant, runUrl }) {
  const echeance = new Date(maintenant.getTime() + 72 * 3600_000);
  const par = {};
  for (const s of signaux) par[s.source] = (par[s.source] ?? 0) + 1;
  return (
    `🚨 [cosmo/détection] ${signaux.length} signal(aux) de violation POSSIBLE : ` +
    Object.entries(par).map(([k, n]) => `${k} ×${n}`).join(', ') +
    `. Détecté le ${iso(maintenant)} : si une violation est confirmée, notification CNIL avant le ${iso(echeance)} ` +
    `(72 h, docs/RGPD-VIOLATION.md). Poser ce rappel MAINTENANT. Détails dans le journal chiffré du run : ${runUrl}`
  );
}

async function source(nom, f) {
  try {
    return [nom, { ok: true, valeur: await f() }];
  } catch (e) {
    return [nom, { ok: false, erreur: String(e?.message ?? e).slice(0, 300) }];
  }
}

/** Point d'entrée testable : rend `{ exit, lignes, journal }`, n'écrit rien. */
export async function executer(env, { fetchImpl = fetch, maintenant = new Date(), precedentImpl = journalPrecedent, deliverImpl = deliver } = {}) {
  const lignes = [];
  const manquants = [];
  if (!env.GH_TOKEN) manquants.push('GH_TOKEN (jeton du run)');
  if (!env.SECURITY_ALERTS_TOKEN) manquants.push('SECURITY_ALERTS_TOKEN (alertes de secret scanning)');
  if (!env.SUPABASE_ACCESS_TOKEN) manquants.push('SUPABASE_ACCESS_TOKEN (journaux Supabase)');
  if ((env.PASSPHRASE ?? '').length < 32) manquants.push('BACKUP_PASSPHRASE (32 caractères au moins : chiffre le journal)');
  if (!env.WEBHOOK) manquants.push('OPS_ALERT_WEBHOOK_URL (pousse un signal)');
  if (!env.REPO) manquants.push('REPO');
  if (manquants.length) {
    lignes.push(`::error title=detection::Échec FERMÉ, rien n'a été lu. Manquent : ${manquants.join(' ; ')}. Un jour sans lecture n'est pas un jour sans violation.`);
    return { exit: 1, lignes, journal: null };
  }
  const depot = env.REPO;
  const projet = env.SUPABASE_PROJECT_REF || PROJET_DEFAUT;
  const fin = iso(maintenant);
  const debut = iso(new Date(maintenant.getTime() - 24 * 3600_000));

  let precedent = [];
  let notePrecedent = 'aucun (premier run)';
  try {
    const p = await precedentImpl({ depot, token: env.GH_TOKEN, phrase: env.PASSPHRASE, fetchImpl });
    if (p) { precedent = p; notePrecedent = `${p.length} ligne(s)`; }
  } catch (e) {
    // La référence manque, la lecture du jour reste possible : planchers seuls,
    // et le run ROUGIT quand même (une référence perdue doit se voir).
    notePrecedent = `ILLISIBLE : ${String(e?.message ?? e).slice(0, 200)}`;
  }

  const sources = Object.fromEntries(await Promise.all([
    source('secretScanning', () => lireSecretScanning({ depot, token: env.SECURITY_ALERTS_TOKEN, fetchImpl })),
    source('codeScanning', () => lireCodeScanning({ depot, token: env.GH_TOKEN, fetchImpl })),
    source('artefacts', () => lireArtefacts({ depot, token: env.GH_TOKEN, maintenant, fetchImpl })),
    source('journaux', () => lireJournaux({ token: env.SUPABASE_ACCESS_TOKEN, projet, debut, fin, fetchImpl })),
  ]));
  if (notePrecedent.startsWith('ILLISIBLE')) sources.reference = { ok: false, erreur: `journal précédent ${notePrecedent}` };
  const d = decider({ sources, precedent });

  const journal = {
    date: fin,
    run: env.RUN_URL ?? null,
    branche: env.BRANCHE ?? null,
    sources: Object.fromEntries(Object.entries(sources).map(([k, x]) => [k, x.ok ? 'lue' : `ERREUR : ${x.erreur}`])),
    mesures: d.mesures,
    seuils: Object.fromEntries(Object.entries(d.seuils).map(([k, r]) => [k, r.seuil])),
    artefacts_lus: sources.artefacts?.ok ? sources.artefacts.valeur.lus : null,
    alertes_code_ouvertes: sources.codeScanning?.ok ? sources.codeScanning.valeur.length : null,
    // Les détails ne vivent qu'ici : ce fichier est chiffré avant tout dépôt.
    journaux_details: sources.journaux?.ok ? sources.journaux.valeur.details : null,
    detection: d.signaux.length ? 'SIGNAL' : d.erreurs.length ? 'SOURCE NON LUE' : 'aucune, toutes sources lues',
    signaux: d.signaux,
  };

  // Journal du run (PUBLIC) : statuts et comptes, rien d'autre.
  lignes.push(`Fenêtre : ${debut} → ${fin}. Journal précédent : ${notePrecedent}.`);
  for (const [k, x] of Object.entries(sources)) lignes.push(`  ${k} : ${x.ok ? 'lue' : 'NON LUE'}`);
  if (sources.artefacts?.ok) lignes.push(`  artefacts inspectés (${FENETRE_ARTEFACTS_H} h) : ${sources.artefacts.valeur.lus}`);
  for (const [k, v] of Object.entries(d.mesures)) lignes.push(`  ${k} = ${v} (seuil ${d.seuils[k].seuil}, ${d.seuils[k].base})`);
  for (const e of d.erreurs) lignes.push(`::error title=detection · source non lue::${e}`);
  for (const s of d.signaux) lignes.push(`::error title=detection · signal::${s.source} : ${s.source === 'journaux-supabase' || s.source === 'secret-scanning' || s.source === 'code-scanning' ? s.resume : 'contenu suspect dans un artefact (détail dans le journal chiffré)'}`);

  if (d.signaux.length) {
    const code = await deliverImpl(env.WEBHOOK, messageAlerte({ signaux: d.signaux, maintenant, runUrl: env.RUN_URL ?? '' }));
    journal.alerte = code >= 200 && code < 300 ? `poussée (HTTP ${code})` : `NON POUSSÉE (HTTP ${code || 'aucune'})`;
    lignes.push(`Alerte de détection ${journal.alerte}.`);
  }
  lignes.push(`Détection : ${journal.detection}.`);
  return { exit: d.exit, lignes, journal, precedent };
}

// Entrée CLI : écrit `journal.jsonl` (clair, chiffré par l'étape suivante).
if (process.argv[1] && process.argv[1].endsWith('detection-violation.mjs')) {
  const r = await executer(process.env);
  for (const l of r.lignes) console.log(l);
  if (r.journal) {
    const garde = [...(r.precedent ?? []), r.journal].slice(-400);
    writeFileSync('journal.jsonl', `${garde.map((l) => JSON.stringify(l)).join('\n')}\n`, { mode: 0o600 });
  }
  process.exit(r.exit);
}
