// ═══════════════════════════════════════════════════════════════════
// OBSERVABILITE AM-1 · AM-2 · AM-3 : les erreurs de PRODUCTION, lues
// chaque jour, comparées à une référence d'écart commitée
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 LE DÉFAUT. Trois sources savaient que la production se trompait, et
// aucune n'était relue par quoi que ce soit :
//   · AM-1 · Sentry : le SDK remonte, le tableau de bord existe, rien ne le
//     lit. Une régression vue par cent utilisateurs ne faisait échouer aucun
//     job ;
//   · AM-2 · les erreurs d'exécution Vercel (`api/collect.ts`) : le
//     collecteur d'audience pouvait échouer en silence, l'audience tombant à
//     zéro sans alerte ;
//   · AM-3 · les journaux Supabase : lus à la main, le jour où quelqu'un y
//     pensait (relevé du 2026-10-23 dans `docs/OBSERVABILITE.md`).
//
// ── CE QUE CE SCRIPT PROUVE ─────────────────────────────────────────
//
// Sur les 24 dernières heures :
//   1. Sentry : les issues NOUVELLES (`firstSeen` dans la fenêtre) ou en
//      RÉGRESSION (`is:regressed`, revue dans la fenêtre), non résolues ;
//   2. Vercel : les requêtes de production qui ont journalisé une erreur
//      (`error` / `fatal`) ou rendu un 5xx, par chemin et statut ;
//   3. Supabase (journaux de la passerelle, `edge_logs`) : les réponses
//      >= 400, rangées en quatre familles (5xx, refus d'authentification,
//      appels non signés au webhook Stripe, 4xx métier) et par couple
//      « chemin statut ».
// Chaque mesure est comparée à `scripts/prod-errors.reference.json`. Un
// dépassement fait ÉCHOUER le job, et `ci-alert.yml` le pousse.
//
// ── CE QU'IL NE PROUVE PAS ──────────────────────────────────────────
//
//   · qu'une erreur SOUS le plafond est bénigne : la garde juge un ÉCART à
//     la référence, pas un absolu. « 0 écart » veut dire « rien de plus que
//     d'habitude », pas « rien » ;
//   · qu'une erreur qui ne remonte NULLE PART n'existe pas : une exception
//     avalée par un `catch` muet n'atteint ni Sentry ni les journaux ;
//   · que Vercel a reçu du trafic : zéro erreur sur zéro requête est un
//     vert. Supabase, lui, doit rendre au moins une requête lue, sinon la
//     garde refuse de conclure (une source renommée rend aussi zéro) ;
//   · les journaux Postgres, PostgREST et des Edge Functions eux-mêmes :
//     seule la PASSERELLE est lue, c'est elle qui porte le statut rendu au
//     client. Les `Thread killed by timeout manager` de PostgREST, sans
//     réponse d'erreur au client, ne sont pas comptés.
//
// 🔴 ÉCHEC FERMÉ. Un jeton absent fait ÉCHOUER le job, jamais émettre un
// avertissement dans un run vert : sans jeton cette garde ne lit rien, et
// son vert affirmerait que la production va bien sans l'avoir regardée.
// Les trois sources sont lues même quand l'une échoue, pour que le rapport
// dise tout ce qu'il a pu voir.
//
// ❌ NE JAMAIS RELEVER UN PLAFOND DE LA RÉFÉRENCE POUR FAIRE PASSER LA CI.
//    Un dépassement dit qu'il s'est passé quelque chose : le lire d'abord
//    (issue Sentry, chemin, statut), corriger ou résoudre à la source (une
//    issue réglée se résout DANS Sentry), et seulement ensuite, s'il s'agit
//    d'un nouveau régime normal, recaler avec sa raison dans `_notes`.
// ═══════════════════════════════════════════════════════════════════

import { readFileSync, existsSync } from 'node:fs';
import { join, sep } from 'node:path';

const RACINE = process.cwd();
const REFERENCE = join(RACINE, 'scripts', 'prod-errors.reference.json');

export const PROJET_SUPABASE_DEFAUT = 'ykeugqfgklejcdbrmawy';
export const PROJET_VERCEL_DEFAUT = 'prj_n3erde0uRnc6S27BHS3gWxhYAoFU';
export const EQUIPE_VERCEL_DEFAUT = 'team_iihZIsetJUOwpZNkZXLSw2dO';

/** Fenêtre lue, en millisecondes. L'API Supabase plafonne à 24 h. */
export const FENETRE_MS = 24 * 60 * 60 * 1000;

/** Au-delà, une réponse est jugée TRONQUÉE et la garde refuse de conclure. */
export const LIGNES_MAX_SUPABASE = 1000;
export const PAGES_MAX_VERCEL = 20;

export const FAMILLES = ['5xx', 'sonde_uptime', 'sonde_edge', 'refus_auth', 'webhook_non_signe', '4xx_metier'];

/**
 * Les 401 que la sonde `uptime.yml` provoque EXPRÈS : sans `apikey`, la
 * passerelle répond 401, et c'est sa preuve de vie (deux fois par heure,
 * relances comprises). Ils forment leur propre famille : comptés avec les
 * refus d'authentification, ils en feraient plus de 90 % et noieraient un
 * vrai pic de mots de passe refusés.
 */
export const SONDES_UPTIME = new Set(['/auth/v1/health 401', '/rest/v1/ 401']);

// ── Les jetons ─────────────────────────────────────────────────────

/**
 * Les variables sans lesquelles une source ne se lit pas. Rend la liste des
 * absentes : vide = tout est là.
 *
 * ⚠️ `VITE_SENTRY_DSN` n'est pas un secret (il part dans le bundle), mais
 * c'est lui qui désigne l'organisation et le projet Sentry. Sans lui ni
 * `SENTRY_ORG` + `SENTRY_PROJECT`, on ne saurait pas QUOI lire.
 */
export function jetonsManquants(env) {
  const manquants = [];
  if (!env.SENTRY_AUTH_TOKEN) manquants.push('SENTRY_AUTH_TOKEN');
  if (!env.VITE_SENTRY_DSN && !(env.SENTRY_ORG && env.SENTRY_PROJECT)) {
    manquants.push('VITE_SENTRY_DSN (ou SENTRY_ORG + SENTRY_PROJECT)');
  }
  if (!env.VERCEL_TOKEN) manquants.push('VERCEL_TOKEN');
  if (!env.SUPABASE_ACCESS_TOKEN) manquants.push('SUPABASE_ACCESS_TOKEN');
  return manquants;
}

// ── Sentry (AM-1) ──────────────────────────────────────────────────

/**
 * L'hôte d'API, l'organisation et le projet, lus dans le DSN.
 *
 * Forme : `https://<clé>@o<org>.ingest[.<région>].sentry.io/<projet>`. La
 * région compte : un projet hébergé en `de` ne se lit pas sur `sentry.io`.
 * Rend `null` sur un DSN illisible, jamais un hôte deviné.
 */
export function sentryDepuisDsn(dsn) {
  let url;
  try {
    url = new URL(dsn);
  } catch {
    return null;
  }
  const hote = url.hostname.match(/^o(\d+)\.ingest(?:\.([a-z]+))?\.sentry\.io$/);
  const projet = url.pathname.replace(/^\/+|\/+$/g, '');
  if (!hote || !/^\d+$/.test(projet)) return null;
  const region = hote[2] && hote[2] !== 'us' ? hote[2] : null;
  return {
    api: region ? `https://${region}.sentry.io` : 'https://sentry.io',
    org: hote[1],
    projet,
  };
}

/**
 * Les deux recherches : les issues NÉES dans la fenêtre, et celles qui y sont
 * REVENUES après résolution. Une régression a un `firstSeen` ancien : la
 * première recherche seule ne la verrait jamais.
 */
export const RECHERCHES_SENTRY = [
  { raison: 'nouvelle', query: 'is:unresolved firstSeen:-24h' },
  { raison: 'regression', query: 'is:unresolved is:regressed lastSeen:-24h' },
];

/** Fusionne les deux listes par identifiant ; une issue vue deux fois compte une fois. */
export function resumerSentry(listes) {
  const parId = new Map();
  for (const { raison, issues } of listes) {
    for (const i of issues ?? []) {
      if (parId.has(i.id)) continue;
      parId.set(i.id, {
        id: i.id,
        court: i.shortId ?? i.id,
        titre: i.title ?? '(sans titre)',
        raison,
        evenements: Number(i.count ?? 0),
        utilisateurs: Number(i.userCount ?? 0),
        lien: i.permalink ?? null,
      });
    }
  }
  return { issues: [...parId.values()] };
}

/** Lit une recherche Sentry, pages comprises (en-tête `Link`, `results="true"`). */
async function issuesSentry({ cible, token, query, fetchImpl }) {
  const out = [];
  let url =
    `${cible.api}/api/0/organizations/${cible.org}/issues/`
    + `?project=${encodeURIComponent(cible.projet)}&statsPeriod=24h&limit=100`
    + `&query=${encodeURIComponent(query)}`;
  for (let page = 0; url && page < 10; page += 1) {
    const res = await fetchImpl(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Sentry · GET issues → HTTP ${res.status} ${await res.text()}`);
    const corps = await res.json();
    if (!Array.isArray(corps)) throw new Error('Sentry · réponse qui n est pas une liste d issues');
    out.push(...corps);
    const suivant = (res.headers?.get?.('link') ?? '')
      .split(',')
      .find((l) => l.includes('rel="next"') && l.includes('results="true"'));
    url = suivant ? suivant.match(/<([^>]+)>/)?.[1] ?? null : null;
  }
  return out;
}

export async function lireSentry({ env, fetchImpl = fetch }) {
  const cible =
    env.SENTRY_ORG && env.SENTRY_PROJECT
      ? { api: env.SENTRY_API_URL || 'https://sentry.io', org: env.SENTRY_ORG, projet: env.SENTRY_PROJECT }
      : sentryDepuisDsn(env.VITE_SENTRY_DSN);
  if (!cible) throw new Error('Sentry · DSN illisible : organisation et projet introuvables');
  const listes = [];
  for (const { raison, query } of RECHERCHES_SENTRY) {
    listes.push({ raison, issues: await issuesSentry({ cible, token: env.SENTRY_AUTH_TOKEN, query, fetchImpl }) });
  }
  return resumerSentry(listes);
}

// ── Chemins et familles ────────────────────────────────────────────

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/**
 * Un chemin débarrassé de ce qui varie d'un appel à l'autre : chaîne de
 * requête, identifiants, nombres. Sans ça, `/storage/v1/object/<uuid>` ferait
 * un couple NOUVEAU par utilisateur, et la garde rougirait sur du bruit.
 */
export function normaliserChemin(chemin) {
  return String(chemin ?? '')
    .split('?')[0]
    .replace(UUID, ':id')
    .split('/')
    .map((s) => (/^\d+$/.test(s) ? ':n' : s))
    .join('/') || '/';
}

/**
 * La famille d'une réponse d'erreur de la passerelle Supabase.
 * `sonde` : la requête porte la signature de `check:edge-smoke` (cf.
 * `SQL_SUPABASE.fonctions`).
 */
export function classer(chemin, statut, sonde = false) {
  if (statut >= 500) return '5xx';
  if (SONDES_UPTIME.has(`${chemin} ${statut}`)) return 'sonde_uptime';
  if (sonde && chemin.startsWith('/functions/v1/')) return 'sonde_edge';
  // `stripe-webhook` refuse un appel sans signature valide par un 400
  // (`Invalid signature`, `supabase/functions/stripe-webhook/index.ts`).
  if (chemin.startsWith('/functions/v1/stripe-webhook') && statut === 400) return 'webhook_non_signe';
  if (chemin.startsWith('/auth/v1/')) return 'refus_auth';
  return '4xx_metier';
}

// ── Supabase (AM-3) ────────────────────────────────────────────────

/**
 * Le SQL (dialecte ClickHouse de l'API Management, table unifiée `logs`).
 *
 * 🔴 DEUX SOURCES, mesuré le 2026-10-23. `edge_logs` porte `/rest`,
 * `/auth`, `/storage`, `/realtime`, mais AUCUNE requête `/functions/v1/*` :
 * celles-ci ne vivent que dans `function_edge_logs`, sous
 * `request.pathname`. Lire la seule `edge_logs` rendait le webhook Stripe
 * invisible, donc toujours à zéro.
 *
 * ⚠️ Les sondes de `check:edge-smoke` (12 fonctions, à chaque run
 * d'`Edge deploy drift`) arrivent avec l'agent `node` et rendent EXPRÈS
 * 400, 401 ou 405. Les « 5 appels sans signature » au webhook relevés le
 * 2026-10-23 étaient ces sondes. Elles forment la famille `sonde_edge` : un
 * 401 d'un vrai client (`curl`, navigateur) reste compté à part.
 *
 * `count()` total : c'est lui qui distingue « aucune erreur » de « aucune
 * requête lue ».
 */
export const SQL_SUPABASE = {
  total: "select count() as n from logs where source in ('edge_logs', 'function_edge_logs')",
  passerelle:
    "select log_attributes['request.path'] as chemin,"
    + " toInt32OrZero(log_attributes['response.status_code']) as statut,"
    + ' count() as n'
    + " from logs where source = 'edge_logs'"
    + " and toInt32OrZero(log_attributes['response.status_code']) >= 400"
    + ' group by chemin, statut order by n desc'
    + ` limit ${LIGNES_MAX_SUPABASE}`,
  fonctions:
    "select log_attributes['request.pathname'] as chemin,"
    + " toInt32OrZero(log_attributes['response.status_code']) as statut,"
    + " log_attributes['request.headers.user_agent'] = 'node' as sonde,"
    + ' count() as n'
    + " from logs where source = 'function_edge_logs'"
    + " and toInt32OrZero(log_attributes['response.status_code']) >= 400"
    + ' group by chemin, statut, sonde order by n desc'
    + ` limit ${LIGNES_MAX_SUPABASE}`,
};

/**
 * Range les lignes `{ chemin, statut, n, sonde? }` par famille et par couple
 * normalisé. Les sondes ne font pas de couple : elles n'ont qu'un plafond de
 * famille, leur nombre suivant celui des runs de la CI.
 */
export function agregerSupabase(total, lignes) {
  const familles = Object.fromEntries(FAMILLES.map((f) => [f, 0]));
  const couples = {};
  for (const l of lignes) {
    const statut = Number(l.statut);
    const n = Number(l.n);
    if (!(statut >= 400) || !(n > 0)) continue;
    const chemin = normaliserChemin(l.chemin);
    const famille = classer(chemin, statut, l.sonde === true || l.sonde === 1 || l.sonde === '1');
    familles[famille] += n;
    if (famille === 'sonde_edge') continue;
    const cle = `${chemin} ${statut}`;
    couples[cle] = (couples[cle] ?? 0) + n;
  }
  return { total_requetes: Number(total), familles, couples };
}

async function sqlSupabase({ projet, token, sql, debut, fin, fetchImpl }) {
  const url =
    `https://api.supabase.com/v1/projects/${projet}/analytics/endpoints/logs`
    + `?sql=${encodeURIComponent(sql)}`
    + `&iso_timestamp_start=${encodeURIComponent(debut)}&iso_timestamp_end=${encodeURIComponent(fin)}`;
  const res = await fetchImpl(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Supabase · GET logs → HTTP ${res.status} ${await res.text()}`);
  const corps = await res.json();
  // 🔴 L'API rend une erreur SQL dans un 200 (`{ "error": "…" }`). La lire
  // comme « zéro ligne » ferait un vert sur une requête qui n'a pas tourné.
  if (corps?.error) throw new Error(`Supabase · requête refusée : ${JSON.stringify(corps.error)}`);
  if (!Array.isArray(corps?.result)) throw new Error('Supabase · réponse sans `result`');
  return corps.result;
}

export async function lireSupabase({ env, maintenant = Date.now(), fetchImpl = fetch }) {
  const projet = env.SUPABASE_PROJECT_REF || PROJET_SUPABASE_DEFAUT;
  const fin = new Date(maintenant).toISOString();
  const debut = new Date(maintenant - FENETRE_MS).toISOString();
  const commun = { projet, token: env.SUPABASE_ACCESS_TOKEN, debut, fin, fetchImpl };
  const [total] = await sqlSupabase({ ...commun, sql: SQL_SUPABASE.total });
  const lignes = [];
  for (const sql of [SQL_SUPABASE.passerelle, SQL_SUPABASE.fonctions]) {
    const rendu = await sqlSupabase({ ...commun, sql });
    if (rendu.length >= LIGNES_MAX_SUPABASE) {
      throw new Error(`Supabase · ${rendu.length} couples rendus, réponse tronquée : la garde refuse de conclure`);
    }
    lignes.push(...rendu);
  }
  return agregerSupabase(total?.n ?? 0, lignes);
}

// ── Vercel (AM-2) ──────────────────────────────────────────────────

const RANG_NIVEAU = { fatal: 3, error: 2, warning: 1 };

/**
 * Range les requêtes en erreur par couple « chemin statut ». Une requête est
 * une erreur si elle a rendu un 5xx OU journalisé un `error` / `fatal` :
 * `api/collect.ts` peut répondre 204 en ayant échoué à écrire.
 */
export function agregerVercel(lignes) {
  const vues = new Set();
  const couples = {};
  const exemples = {};
  for (const l of lignes) {
    if (l.requestId && vues.has(l.requestId)) continue;
    if (l.requestId) vues.add(l.requestId);
    const statut = Number(l.statusCode ?? l.responseStatusCode ?? 0);
    const pire = (l.logs ?? []).reduce(
      (acc, x) => ((RANG_NIVEAU[x.level] ?? 0) > (RANG_NIVEAU[acc?.level] ?? 0) ? x : acc),
      null,
    );
    const enErreur = statut >= 500 || (RANG_NIVEAU[pire?.level] ?? 0) >= RANG_NIVEAU.error;
    if (!enErreur) continue;
    const cle = `${normaliserChemin(l.requestPath)} ${statut || '?'}`;
    couples[cle] = (couples[cle] ?? 0) + 1;
    if (!exemples[cle] && pire?.message) exemples[cle] = String(pire.message).slice(0, 160);
  }
  const total = Object.values(couples).reduce((a, b) => a + b, 0);
  return { total, couples, exemples };
}

/**
 * Lit les journaux de requêtes de production. Même point d'accès que
 * `vercel logs --project` (la CLI officielle), et non le flux
 * `/v1/.../runtime-logs` : celui-ci est un FLUX par déploiement, qui reste
 * ouvert et ne rend pas une fenêtre de 24 h.
 */
async function journauxVercel({ env, filtre, debut, fin, fetchImpl }) {
  const out = [];
  for (let page = 0; ; page += 1) {
    if (page >= PAGES_MAX_VERCEL) {
      throw new Error(`Vercel · plus de ${PAGES_MAX_VERCEL} pages pour \`${filtre}\` : réponse tronquée`);
    }
    const params = new URLSearchParams({
      projectId: env.VERCEL_PROJECT_ID || PROJET_VERCEL_DEFAUT,
      ownerId: env.VERCEL_TEAM_ID || EQUIPE_VERCEL_DEFAUT,
      environment: 'production',
      startDate: String(debut),
      endDate: String(fin),
      page: String(page),
    });
    const [cle, valeur] = filtre.split('=');
    params.set(cle, valeur);
    const res = await fetchImpl(`https://vercel.com/api/logs/request-logs?${params}`, {
      headers: { Authorization: `Bearer ${env.VERCEL_TOKEN}` },
    });
    if (!res.ok) throw new Error(`Vercel · GET request-logs (${filtre}) → HTTP ${res.status} ${await res.text()}`);
    const corps = await res.json();
    if (!Array.isArray(corps?.rows)) throw new Error('Vercel · réponse sans `rows`');
    out.push(...corps.rows);
    if (!corps.hasMoreRows) return out;
  }
}

export async function lireVercel({ env, maintenant = Date.now(), fetchImpl = fetch }) {
  const commun = { env, debut: maintenant - FENETRE_MS, fin: maintenant, fetchImpl };
  const lignes = [
    ...(await journauxVercel({ ...commun, filtre: 'level=error,fatal' })),
    ...(await journauxVercel({ ...commun, filtre: 'statusCode=5xx' })),
  ];
  return agregerVercel(lignes);
}

// ── La comparaison ─────────────────────────────────────────────────

/**
 * Mesure contre référence. Rend `{ ecarts, baisses }` : un écart fait
 * échouer, une baisse est seulement imprimée (une amélioration à enregistrer).
 * Une source absente de la mesure (lecture en échec) n'est pas comparée :
 * son échec est déjà une erreur du run.
 */
export function comparer(reference, mesure) {
  const ecarts = [];
  const baisses = [];

  if (mesure.sentry) {
    const plafond = reference.sentry?.plafond_issues;
    if (typeof plafond !== 'number') {
      ecarts.push('Sentry : `plafond_issues` absent de la référence, rien à quoi comparer.');
    } else if (mesure.sentry.issues.length > plafond) {
      ecarts.push(
        `Sentry : ${mesure.sentry.issues.length} issue(s) nouvelle(s) ou en régression sur 24 h (plafond ${plafond}).`,
      );
      for (const i of mesure.sentry.issues) {
        ecarts.push(
          `  Sentry ${i.raison} · ${i.court} · ${i.titre} · ${i.evenements} événement(s), `
            + `${i.utilisateurs} utilisateur(s)${i.lien ? ` · ${i.lien}` : ''}`,
        );
      }
    }
  }

  if (mesure.vercel) {
    const plafond = reference.vercel?.plafond_erreurs;
    if (typeof plafond !== 'number') {
      ecarts.push('Vercel : `plafond_erreurs` absent de la référence, rien à quoi comparer.');
    } else if (mesure.vercel.total > plafond) {
      ecarts.push(`Vercel : ${mesure.vercel.total} requête(s) de production en erreur sur 24 h (plafond ${plafond}).`);
      for (const [cle, n] of Object.entries(mesure.vercel.couples).sort((a, b) => b[1] - a[1])) {
        const ex = mesure.vercel.exemples?.[cle];
        ecarts.push(`  Vercel · ${cle} · ${n}${ex ? ` · « ${ex} »` : ''}`);
      }
    }
  }

  if (mesure.supabase) {
    const ref = reference.supabase ?? {};
    const m = mesure.supabase;
    if (!(m.total_requetes > 0)) {
      ecarts.push(
        'Supabase : AUCUNE requête lue sur 24 h. Zéro erreur sur zéro requête n est pas un vert : '
          + 'la source `edge_logs` a pu être renommée.',
      );
    }
    for (const f of FAMILLES) {
      const plafond = ref.plafonds_famille?.[f];
      const n = m.familles[f] ?? 0;
      if (typeof plafond !== 'number') {
        ecarts.push(`Supabase : la famille \`${f}\` n a pas de plafond dans la référence.`);
      } else if (n > plafond) {
        ecarts.push(`Supabase · famille \`${f}\` : ${n} sur 24 h (plafond ${plafond}).`);
      }
    }
    const inconnu = ref.plafond_couple_inconnu;
    if (typeof inconnu !== 'number') {
      ecarts.push('Supabase : `plafond_couple_inconnu` absent de la référence.');
    }
    for (const [cle, n] of Object.entries(m.couples)) {
      const plafond = ref.couples?.[cle];
      if (typeof plafond === 'number') {
        if (n > plafond) ecarts.push(`Supabase · \`${cle}\` : ${n} sur 24 h (plafond ${plafond}).`);
      } else if (typeof inconnu === 'number' && n > inconnu) {
        ecarts.push(
          `Supabase · couple NOUVEAU \`${cle}\` : ${n} sur 24 h. Absent de la référence `
            + `(tolérance ${inconnu} pour un couple inconnu).`,
        );
      }
    }
    for (const cle of Object.keys(ref.couples ?? {})) {
      if (!(cle in m.couples)) baisses.push(`Supabase · \`${cle}\` : 0 sur 24 h.`);
    }
  }

  return { ecarts, baisses };
}

// ── Exécution ──────────────────────────────────────────────────────

const estLanceDirectement =
  process.argv[1]
  && import.meta.url === new URL(`file://${process.argv[1].split(sep).join('/')}`).href;

if (estLanceDirectement) {
  const env = process.env;

  // 🔴 Pas de repli, pas de source sautée : un jeton absent est un échec.
  const manquants = jetonsManquants(env);
  if (manquants.length > 0) {
    console.error(
      `✖ ${manquants.length} variable(s) absente(s) : ${manquants.join(', ')}.\n`
        + '  Sans elles cette garde ne lit pas la source correspondante, et un run\n'
        + '  vert affirmerait que la production va bien sans l avoir regardée.\n'
        + '  Les poser dans les secrets Actions du dépôt (`gh secret set <NOM>`).',
    );
    process.exit(1);
  }

  if (!existsSync(REFERENCE)) {
    console.error(`✖ ${REFERENCE} absent : rien à quoi comparer.`);
    process.exit(1);
  }
  const reference = JSON.parse(readFileSync(REFERENCE, 'utf8'));

  const maintenant = Date.now();
  const mesure = {};
  const pannes = [];
  for (const [nom, lire] of [
    ['sentry', lireSentry],
    ['vercel', lireVercel],
    ['supabase', lireSupabase],
  ]) {
    try {
      mesure[nom] = await lire({ env, maintenant });
    } catch (e) {
      pannes.push(`${nom} : lecture en échec, ${e.message}`);
    }
  }

  console.log(`Erreurs de production · fenêtre ${new Date(maintenant - FENETRE_MS).toISOString()} → ${new Date(maintenant).toISOString()}`);
  if (mesure.sentry) {
    console.log(`\nSentry · ${mesure.sentry.issues.length} issue(s) nouvelle(s) ou en régression`);
    for (const i of mesure.sentry.issues) console.log(`  ${i.raison.padEnd(10)} ${i.court}  ${i.titre}`);
  }
  if (mesure.vercel) {
    console.log(`\nVercel · ${mesure.vercel.total} requête(s) de production en erreur`);
    for (const [cle, n] of Object.entries(mesure.vercel.couples)) console.log(`  ${String(n).padStart(5)}  ${cle}`);
  }
  if (mesure.supabase) {
    const s = mesure.supabase;
    console.log(`\nSupabase · ${s.total_requetes} requête(s) à la passerelle`);
    for (const f of FAMILLES) {
      console.log(`  ${f.padEnd(20)} ${String(s.familles[f]).padStart(5)}  (plafond ${reference.supabase?.plafonds_famille?.[f] ?? '?'})`);
    }
    for (const [cle, n] of Object.entries(s.couples).sort((a, b) => b[1] - a[1])) {
      const p = reference.supabase?.couples?.[cle];
      console.log(`  ${String(n).padStart(5)}  ${cle}${p === undefined ? '  (NOUVEAU)' : `  (plafond ${p})`}`);
    }
  }

  const { ecarts, baisses } = comparer(reference, mesure);
  if (baisses.length > 0) {
    console.log('\n🔎 Couples de la référence absents aujourd hui (la garde ne rougit pas dessus) :');
    for (const b of baisses) console.log(`  - ${b}`);
  }
  console.log(
    `\nRéférence posée le ${reference.pose_le}.`
      + '\n⚠️ La garde juge un ÉCART, pas un absolu : « 0 écart » veut dire « rien de plus'
      + '\n   que d habitude », pas « aucune erreur ».',
  );

  const erreurs = [...pannes, ...ecarts];
  if (erreurs.length > 0) {
    console.error('\n✖ Erreurs de production :');
    for (const e of erreurs) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log('\n✓ Aucun écart à la référence.');
}
