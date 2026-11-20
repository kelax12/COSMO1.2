// ═══════════════════════════════════════════════════════════════════
// check-sql-prod.mjs · les gardes qui interrogent la PRODUCTION en SQL
//
// Trois gardes fusionnées (MAI-02), un fichier, trois sous-commandes
// (`npm run check:<nom>` pointe ici, avec son argument) :
//   node scripts/check-sql-prod.mjs acquisition [--live]  · C-101 : annuaires, fraîcheur des chiffres, compteurs (--live)
//   node scripts/check-sql-prod.mjs db-cost               · C-87  : EXPLAIN sous RLS, plafonds et PENTE du coût
//   node scripts/check-sql-prod.mjs retention             · C-93  : durées de conservation vs la donnée
// Sans argument connu : échec. Pas de « toutes », elles n'ont ni le même
// secret ni le même cycle de vie. Workflows : `gardes-calendrier.yml`
// (acquisition, moitié documentaire) et `posture.yml` (les trois, avec
// `SUPABASE_ACCESS_TOKEN`). Témoins : `gardes-posture.guard.test.mjs`.
//
// 🔴 LECTURE SEULE sur la base : `CLAUDE.md` interdit toute écriture par
// l'API Management (elle contourne la RLS). Toute requête d'ici est un
// `SELECT`, ou un `EXPLAIN` joué dans une transaction annulée.
// 🔴 Secret absent = ÉCHEC, jamais un repli silencieux : une garde ne se rend
// pas conditionnelle à la présence de son propre secret.
// ═══════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { estLance, interrogerSupabase } from './ops-alert.mjs';

const RACINE = process.cwd();
const PROJET_DEFAUT = 'ykeugqfgklejcdbrmawy';

/** Les lignes d'une réponse de l'API Management, quelle que soit sa forme. */
const lignesDe = (reponse) => (Array.isArray(reponse) ? reponse : reponse.result ?? []);

/** Le jeton et le projet ; sans jeton, `message` sur stderr et sortie 1. */
function secrets(message) {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    console.error(message);
    process.exit(1);
  }
  return { token, projet: process.env.SUPABASE_PROJECT_REF || PROJET_DEFAUT };
}

// ═══════════════════════════════════════════════════════════════════
// C-101 · acquisition : aucune action n'est reliée à son résultat
// ═══════════════════════════════════════════════════════════════════
//
// Le tracking `?ref=` est complet (`src/lib/attribution.ts`, trigger
// `handle_new_user_profile` mig. 097, `get_admin_stats` mig. 099). Ce qui
// manquait était de REGARDER les chiffres. Trois moitiés :
//
// 1. Les chiffres de `docs/ACQUISITION.md` ÉCHOUENT quand ils vieillissent
//    trop (marqueur explicite, plafond `AGE_MAX_JOURS`). Un document de
//    pilotage périmé est pire qu'absent : on décide sur un état qui n'existe
//    plus. Les chiffres frais sont imprimés avec `--live`.
// 2. `docs/ACQUISITION-BACKLINKS.md` : colonne d'état à cinq valeurs, date
//    obligatoire sur `fait` et `refuse`. Sans colonne d'état, « pas encore
//    tenté » et « tenté sans effet » se confondent, et appellent des décisions
//    opposées.
// 3. Les compteurs en base : `--live` seulement (exige le jeton) ; sans
//    l'option, le run le DIT au lieu de laisser croire qu'il a tout regardé.
//
// ⚠️ Il ne vérifie PAS qu'un backlink posé existe encore (AM-1 : il faut
// l'API Search Console, donc un compte Google), ni l'autorité de domaine.

const BACKLINKS = join(RACINE, 'docs', 'ACQUISITION-BACKLINKS.md');
const ACQUISITION = join(RACINE, 'docs', 'ACQUISITION.md');

/** Les cinq états admis pour une action d'annuaire. */
export const ETATS = ['a-faire', 'en-cours', 'fait', 'refuse', 'abandonne'];

/** Les états dont la DATE est obligatoire. */
const ETATS_DATES = new Set(['fait', 'refuse']);

/**
 * L'âge maximal des chiffres de `ACQUISITION.md`, en jours.
 *
 * 45 et pas 30 : le plan qu'il porte se mesure en mois, et une relance
 * mensuelle qui tombe deux jours trop tôt apprend à ignorer la garde. 45
 * laisse passer un mois plus une marge, et refuse un trimestre.
 */
const AGE_MAX_JOURS = 45;

/** Les lignes du tableau des annuaires. */
export function lignesAnnuaires(texte) {
  // Le tableau a sept colonnes depuis C-101 : # | Site | Coût | État | Fait le
  // | Ce qu'il faut préparer | Note.
  return [...texte.matchAll(/^\|\s*(\d+)\s*\|([^|]*)\|([^|]*)\|\s*`?([a-z-]+)`?\s*\|([^|]*)\|/gm)].map((m) => ({
    numero: Number(m[1]),
    site: m[2].trim(),
    etat: m[4].trim(),
    date: m[5].trim(),
  }));
}

/**
 * La date de la dernière REMESURE, lue sur un marqueur EXPLICITE.
 *
 * 🔴 `<!-- chiffres-remesures: AAAA-MM-JJ -->`, et surtout pas « la date la
 * plus récente citée quelque part » : n'importe quelle ligne ajoutée au
 * document rajeunirait les chiffres sans que personne les ait rejoués. Une
 * garde qui prend la première date venue répond sans mesurer.
 */
export function dateDeRemesure(texte) {
  return /<!--\s*chiffres-remesures:\s*(20\d\d-\d\d-\d\d)\s*-->/.exec(texte)?.[1] ?? null;
}

/**
 * Les compteurs d'acquisition.
 *
 * ⚠️ Il EXCLUT les mêmes comptes que `get_admin_stats` (mig. 149) : sans ça
 * le compte de démonstration, qui porte 120 tâches et ne s'est jamais
 * connecté, gonflerait le chiffre. Deux totaux d'utilisateurs différents
 * selon l'endroit où on les lit est exactement ce que la mig. 149 a corrigé.
 */
export const SQL_COMPTEURS = `
SELECT
  (SELECT count(*)::int FROM auth.users
     WHERE id <> ALL(public.admin_stats_excluded_uids())) AS utilisateurs,
  (SELECT count(*)::int FROM auth.users
     WHERE id <> ALL(public.admin_stats_excluded_uids())
       AND created_at >= now() - interval '30 days')      AS inscrits_30j,
  (SELECT count(*)::int FROM auth.users
     WHERE id <> ALL(public.admin_stats_excluded_uids())
       AND last_sign_in_at >= now() - interval '7 days')  AS actifs_7j,
  (SELECT count(*)::int FROM public.profiles
     WHERE acquisition_source IS NOT NULL)                AS avec_source,
  (SELECT count(*)::int FROM public.organizations)        AS organisations
`.trim();

async function acquisition() {
  const erreurs = [];

  // ═══ MOITIÉ 1 · le tableau des annuaires ═════════════════════════
  if (!existsSync(BACKLINKS)) {
    erreurs.push(`${BACKLINKS} introuvable.`);
  } else {
    const lignes = lignesAnnuaires(readFileSync(BACKLINKS, 'utf8'));
    // 🔴 Anti-« garde qui répond sans mesurer » : un tableau qui change de
    // forme rendrait zéro ligne, donc zéro erreur.
    if (lignes.length < 5) {
      erreurs.push(
        `Seulement ${lignes.length} ligne(s) d'annuaire reconnue(s) : le tableau a changé `
          + 'de forme, et cette garde ne sait plus le lire.',
      );
    }
    const parEtat = {};
    for (const l of lignes) {
      parEtat[l.etat] = (parEtat[l.etat] ?? 0) + 1;
      if (!ETATS.includes(l.etat)) {
        erreurs.push(
          `Annuaire ${l.numero} (${l.site}) : état \`${l.etat}\` inconnu. `
            + `Les cinq admis : ${ETATS.join(', ')}.`,
        );
        continue;
      }
      const aUneDate = /20\d\d-\d\d-\d\d/.test(l.date);
      if (ETATS_DATES.has(l.etat) && !aUneDate) {
        erreurs.push(
          `Annuaire ${l.numero} (${l.site}) : état \`${l.etat}\` SANS date.\n`
            + "    « Fait » sans date décrit un instant qu'on ne peut plus situer, donc\n"
            + "    qui n'appelle jamais de relecture — et un backlink RETIRÉ est\n"
            + '    invisible (AM-1 de ce document).',
        );
      }
      if (!ETATS_DATES.has(l.etat) && aUneDate) {
        erreurs.push(
          `Annuaire ${l.numero} (${l.site}) : état \`${l.etat}\` AVEC une date. `
            + 'Une date sur un « à faire » ne veut rien dire ; la retirer, ou changer l état.',
        );
      }
    }
    console.log('Acquisition · annuaires');
    console.log(`  ${lignes.length} ligne(s) : `
      + Object.entries(parEtat).sort().map(([e, n]) => `${e} ${n}`).join(' · '));
  }

  // ═══ MOITIÉ 2 · la fraîcheur des chiffres ════════════════════════
  if (!existsSync(ACQUISITION)) {
    erreurs.push(`${ACQUISITION} introuvable.`);
  } else {
    const derniere = dateDeRemesure(readFileSync(ACQUISITION, 'utf8'));
    if (!derniere) {
      erreurs.push(
        '`docs/ACQUISITION.md` ne porte pas de marqueur `<!-- chiffres-remesures:\n'
          + '    AAAA-MM-JJ -->` : impossible de juger sa fraîcheur, et impossible de la\n'
          + '    deviner à partir des autres dates du document sans se tromper.',
      );
    } else {
      const jours = Math.floor((Date.now() - Date.parse(derniere)) / 86_400_000);
      console.log(`\nAcquisition · chiffres remesurés le ${derniere} (il y a ${jours} j)`);
      if (jours > AGE_MAX_JOURS) {
        erreurs.push(
          `\`docs/ACQUISITION.md\` n'a pas été remesuré depuis ${jours} jours `
            + `(plafond ${AGE_MAX_JOURS}).\n`
            + '    Un document de pilotage périmé est pire qu absent : on décide sur un\n'
            + '    état qui n existe plus. Les chiffres frais sont imprimés ci-dessous\n'
            + '    quand `--live` est passé.',
        );
      }
    }
  }

  // ═══ MOITIÉ 3 · les compteurs, en base ═══════════════════════════
  if (!process.argv.includes('--live')) {
    console.log(
      '\n⚠️ COMPTEURS NON REJOUÉS : ce run n a pas lu la base. Pour les rejouer :\n'
        + '     SUPABASE_ACCESS_TOKEN=… node scripts/check-sql-prod.mjs acquisition --live',
    );
  } else {
    const { token, projet } = secrets(
      '\n✖ `--live` demandé sans SUPABASE_ACCESS_TOKEN. Une garde ne se rend pas\n'
        + '  conditionnelle à la présence de son propre secret.',
    );
    const l = lignesDe(await interrogerSupabase(SQL_COMPTEURS, { token, projet }))[0] ?? {};
    console.log('\nAcquisition · compteurs REJOUÉS en base');
    console.log(`  utilisateurs (hors comptes exclus) : ${l.utilisateurs}`);
    console.log(`  inscrits sur 30 jours              : ${l.inscrits_30j}`);
    console.log(`  actifs sur 7 jours                 : ${l.actifs_7j}`);
    console.log(`  inscriptions avec source \`?ref=\`   : ${l.avec_source}`);
    console.log(`  organisations                      : ${l.organisations}`);
    console.log(
      '\n  ⚠️ `inscriptions avec source` À ZÉRO n est PAS une panne du tracking :\n'
        + '     la chaîne `?ref=` est complète et testée (`src/lib/attribution.test.ts`).\n'
        + '     Zéro veut dire que personne n est arrivé par un lien porteur — ce qui\n'
        + '     est cohérent avec les huit annuaires encore à `a-faire`.',
    );
  }
  return erreurs;
}

// ═══════════════════════════════════════════════════════════════════
// C-87 · db-cost : le coût SERVEUR et sa CROISSANCE, en continu
// ═══════════════════════════════════════════════════════════════════
//
// Les plans d'exécution étaient rejoués à la main : le dépôt savait dire ce
// que coûte une lecture AUJOURD'HUI, jamais à quelle VITESSE ce coût monte.
// Or la question de C-15 est « à partir de quel volume elle cesse de tenir ».
// Un point isolé ne répond pas à ça. Une PENTE, oui.
//
// Il joue les requêtes de RÉFÉRENCE en `EXPLAIN (ANALYZE, BUFFERS)` et ajoute
// un point daté à une série COMMITÉE (`docs/db-cost-series.json`). Il échoue
// si une requête dépasse son plafond ABSOLU (garde-fou grossier), ou si sa
// PENTE dépasse un facteur déclaré (le contrôle qui compte).
//
// 🔴 JOUÉES SOUS LE RÔLE `authenticated`, AVEC LES CLAIMS D'UN COMPTE RÉEL,
// DANS UNE TRANSACTION ANNULÉE. Sans ça l'API exécute en superutilisateur, la
// RLS ne s'applique pas, et le plan mesuré n'est PAS celui d'un utilisateur
// (la RLS entreprise coûte ~60× le prédicat de `tasks`).
// ⚠️ `ROLLBACK` systématique : aucune écriture, jamais.
// ⚠️ Ne mesure PAS le coût FACTURÉ (Supabase ne l'expose pas par requête) :
// le coût du planificateur et le temps d'exécution en sont le proxy. Ni la
// charge réelle : `scalability-volume.yml` répond à ça (mensuel, C-86).
//
// ❌ NE JAMAIS RELEVER UN PLAFOND POUR FAIRE PASSER LE JOB. Un dépassement
//    dit que la requête a changé de plan, presque toujours un index perdu ou
//    une policy réécrite.

const SERIE = join(RACINE, 'docs', 'db-cost-series.json');

/**
 * Le compte de référence. C'est le compte de SEED, choisi exprès : il porte
 * des données dans toutes les tables, et il n'appartient à personne.
 */
const COMPTE = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

/**
 * LES REQUÊTES DE RÉFÉRENCE.
 *
 * `plafond_ms`   : garde-fou absolu sur le temps d'exécution.
 * `plafond_cout` : garde-fou absolu sur le coût du planificateur.
 * `pourquoi`     : ce que cette requête représente dans le produit.
 *
 * ⚠️ Les plafonds sont posés LARGES : ils attrapent un changement de plan,
 * pas une variation de charge du serveur. C'est la pente qui attrape la
 * dérive lente.
 */
export const REQUETES = [
  {
    id: 'tasks-liste',
    sql: 'SELECT * FROM public.tasks ORDER BY created_at DESC LIMIT 50',
    plafond_ms: 400,
    plafond_cout: 20000,
    pourquoi:
      'La lecture la plus fréquente du produit : la liste de tâches. Son '
      + 'prédicat RLS porte un `OR` (tâches partagées) qui interdit un simple '
      + 'parcours d index.',
  },
  {
    id: 'events-mois',
    sql: "SELECT * FROM public.events WHERE start_time >= now() - interval '31 days' ORDER BY start_time",
    plafond_ms: 400,
    plafond_cout: 20000,
    pourquoi: "Le mois courant de l'agenda, rechargé à chaque navigation de vue.",
  },
  {
    id: 'habits-completions',
    sql: 'SELECT * FROM public.habits ORDER BY created_at',
    plafond_ms: 400,
    plafond_cout: 20000,
    pourquoi:
      'Les habitudes portent leurs complétions en JSON, bornées par la '
      + 'mig. 119 : cette ligne est celle qui mesure si la borne tient.',
  },
  {
    id: 'kr-completions-stats',
    sql: "SELECT count(*), sum(1) FROM public.kr_completions WHERE completed_at >= now() - interval '365 days'",
    plafond_ms: 400,
    plafond_cout: 20000,
    pourquoi:
      'La source du temps investi sur les OKR (C-77). Elle grossit d une '
      + 'ligne par complétion et ne sera jamais purgée.',
  },
];

/** Combien de facteurs d'augmentation on tolère entre le plus vieux point gardé et le plus récent. */
const FACTEUR_PENTE = 3;

/** Sur combien de points on juge la pente. En dessous, on ne juge pas. */
const POINTS_MIN_POUR_PENTE = 4;

/** Le SQL d'un EXPLAIN joué sous la RLS, dans une transaction annulée. */
export function sqlExplain(requete, compte = COMPTE) {
  const claims = JSON.stringify({ sub: compte, role: 'authenticated' });
  return [
    'BEGIN;',
    'SET LOCAL ROLE authenticated;',
    `SET LOCAL request.jwt.claims = '${claims}';`,
    `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${requete.sql};`,
    'ROLLBACK;',
  ].join('\n');
}

/** Les chiffres qui comptent, extraits d'un plan JSON. */
export function extraire(planJson) {
  const racine = Array.isArray(planJson) ? planJson[0] : planJson;
  const p = racine?.Plan ?? {};
  const noeuds = [];
  const parcourir = (n) => {
    noeuds.push(n['Node Type']);
    for (const f of n.Plans ?? []) parcourir(f);
  };
  if (p['Node Type']) parcourir(p);
  return {
    cout: p['Total Cost'] ?? null,
    ms: racine?.['Execution Time'] ?? null,
    planification_ms: racine?.['Planning Time'] ?? null,
    blocs: p['Shared Hit Blocks'] ?? null,
    lignes: p['Actual Rows'] ?? null,
    seq_scans: noeuds.filter((n) => n === 'Seq Scan').length,
  };
}

/** La pente entre le premier et le dernier point d'une série de valeurs. */
export function pente(valeurs) {
  const propres = valeurs.filter((v) => typeof v === 'number' && v > 0);
  if (propres.length < 2) return null;
  return propres[propres.length - 1] / propres[0];
}

async function dbCost() {
  // 🔴 Pas de repli : sans jeton ce script ne mesure rien.
  const { token, projet } = secrets(
    '✖ SUPABASE_ACCESS_TOKEN absent. Ce script joue des EXPLAIN contre la\n'
      + '  production : sans jeton il n a rien à ajouter à la série, et un run vert\n'
      + '  laisserait croire que le coût a été suivi.',
  );

  const point = { date: new Date().toISOString().slice(0, 10), mesures: {} };
  const erreurs = [];

  console.log('Coût serveur · EXPLAIN sous RLS, rôle `authenticated`, transaction annulée');
  for (const r of REQUETES) {
    let m;
    try {
      const lignes = lignesDe(await interrogerSupabase(sqlExplain(r), { token, projet }));
      const plan = lignes[0]?.['QUERY PLAN'] ?? lignes[0]?.['Query Plan'] ?? lignes[0];
      m = extraire(plan);
    } catch (e) {
      erreurs.push(`\`${r.id}\` : ${e.message}`);
      continue;
    }
    point.mesures[r.id] = m;
    console.log(
      `  ${r.id.padEnd(24)} coût ${String(Math.round(m.cout ?? -1)).padStart(7)}  `
        + `${String(Math.round(m.ms ?? -1)).padStart(5)} ms  `
        + `${String(m.blocs ?? '—').padStart(6)} blocs  ${m.seq_scans} seq-scan(s)`,
    );
    if (m.ms !== null && m.ms > r.plafond_ms) {
      erreurs.push(
        `\`${r.id}\` : ${Math.round(m.ms)} ms > plafond ${r.plafond_ms} ms.\n    ${r.pourquoi}`,
      );
    }
    if (m.cout !== null && m.cout > r.plafond_cout) {
      erreurs.push(
        `\`${r.id}\` : coût ${Math.round(m.cout)} > plafond ${r.plafond_cout}.\n`
          + '    Un coût qui explose vient presque toujours d un index perdu ou d une\n'
          + '    policy réécrite. ❌ Ne pas relever le plafond.',
      );
    }
  }

  // ── La série, et la PENTE ────────────────────────────────────────
  // Pas d'`existsSync` avant la lecture : vérifier puis lire le même chemin
  // est une course (CodeQL js/file-system-race, M-60). L'absence se lit dans
  // l'erreur de lecture elle-même.
  let serieLue = null;
  try {
    serieLue = JSON.parse(readFileSync(SERIE, 'utf8'));
  } catch (e) {
    if (e?.code !== 'ENOENT') throw e;
  }
  const serie = serieLue
    ?? {
      _comment: [
        'C-87 — série temporelle du coût serveur. Écrite par',
        '`node scripts/check-sql-prod.mjs db-cost`, jamais à la main.',
        "🔴 Ce qui compte ici n'est pas un point, c'est la PENTE : le dépôt savait",
        'dire ce que coûte une lecture aujourd hui, jamais à quelle vitesse ce coût',
        'monte.',
      ],
      points: [],
    };

  // Un point par jour : un rejeu le même jour remplace, il ne double pas.
  serie.points = serie.points.filter((p) => p.date !== point.date);
  serie.points.push(point);
  // On garde deux ans de points quotidiens au maximum : au-delà, la pente se
  // lit sur un fichier qu'on ne relit plus.
  serie.points = serie.points.slice(-730);

  if (serie.points.length >= POINTS_MIN_POUR_PENTE) {
    console.log(`\nPente sur ${serie.points.length} point(s)`);
    for (const r of REQUETES) {
      const couts = serie.points.map((p) => p.mesures?.[r.id]?.cout);
      const f = pente(couts);
      if (f === null) continue;
      console.log(`  ${r.id.padEnd(24)} ×${f.toFixed(2)} depuis ${serie.points[0].date}`);
      if (f > FACTEUR_PENTE) {
        erreurs.push(
          `\`${r.id}\` : le coût a été multiplié par ${f.toFixed(2)} depuis `
            + `${serie.points[0].date} (tolérance ×${FACTEUR_PENTE}).\n`
            + `    ${r.pourquoi}\n`
            + "    C'est le contrôle que ce script existe pour rendre : une pente, pas\n"
            + '    une valeur. ❌ Ne pas élargir la tolérance.',
        );
      }
    }
  } else {
    console.log(
      `\n⚠️ ${serie.points.length} point(s) dans la série : il en faut ${POINTS_MIN_POUR_PENTE}`
        + '\n   pour juger une pente. Les plafonds ABSOLUS, eux, s appliquent déjà.',
    );
  }

  writeFileSync(SERIE, `${JSON.stringify(serie, null, 2)}\n`, 'utf8');
  console.log(`\nSérie écrite : ${SERIE} (${serie.points.length} point(s)).`);
  return erreurs;
}

// ═══════════════════════════════════════════════════════════════════
// C-93 · retention : les DURÉES de conservation face à la donnée
// ═══════════════════════════════════════════════════════════════════
//
// `docs/RGPD-REGISTRE.md` déclare dix traitements, chacun avec sa durée. Rien
// n'avait jamais vérifié qu'une seule ligne de la base la respecte. Un
// registre faux est pire qu'un registre absent : il atteste qu'on savait.
//
// Sept traitements disent « durée de vie du compte », ce qui n'est pas une
// date. La traduction MESURABLE existe pourtant :
//   A. AUCUNE LIGNE ORPHELINE : aucune ligne ne survit à son `auth.users`.
//      Une orpheline est une donnée personnelle conservée SANS BASE LÉGALE.
//      ⚠️ Deux tables en sont EXEMPTÉES, et c'est écrit : `payment_records`
//      et `withdrawal_consents` sont des PREUVES dont la survie est l'objet
//      même (RGPD art. 17.3.b).
//   B. AUCUNE LIGNE PLUS VIEILLE QUE SA DURÉE, pour les traitements qui en
//      déclarent une bornée.
//
// ⚠️ Ça ne prouve PAS que le registre est juste : la base respecte ce que le
// registre DÉCLARE. Ni rien sur Sentry (90 jours annoncés) ou Stripe, qui
// relèvent de leurs fournisseurs et de leurs DPA.
//
// ❌ NE JAMAIS ALLONGER UNE DURÉE ICI POUR FAIRE PASSER LA GARDE. Un
//    dépassement dit qu'il faut purger, ou que le registre doit être corrigé,
//    en connaissance de cause, pas pour éteindre un rouge.

/**
 * Les tables sous « durée de vie du compte » (contrôle A).
 *
 * `colonne` : la colonne qui porte l'identifiant du compte.
 */
export const DUREE_DE_VIE_DU_COMPTE = [
  { table: 'tasks', colonne: 'user_id', traitement: 'T2' },
  { table: 'events', colonne: 'user_id', traitement: 'T2' },
  { table: 'habits', colonne: 'user_id', traitement: 'T2' },
  { table: 'okrs', colonne: 'user_id', traitement: 'T2' },
  { table: 'key_results', colonne: 'user_id', traitement: 'T2' },
  { table: 'kr_completions', colonne: 'user_id', traitement: 'T2' },
  { table: 'categories', colonne: 'user_id', traitement: 'T2' },
  { table: 'lists', colonne: 'user_id', traitement: 'T2' },
  { table: 'user_activity_days', colonne: 'user_id', traitement: 'T10' },
  { table: 'account_inactivity_notices', colonne: 'user_id', traitement: 'T1' },
  { table: 'task_dependencies', colonne: 'user_id', traitement: 'T2' },
  { table: 'friends', colonne: 'user_id', traitement: 'T3' },
  // 🔴 C-112 · `friend_requests` n'a PAS de `user_id` : elle porte les DEUX
  // comptes, `sender_id` et `receiver_id` (relu dans `information_schema`).
  // Une colonne inexistante fait échouer toute l'UNION en 42703 : AUCUNE table
  // n'est alors contrôlée. Chaque colonne est une ligne : une demande survit à
  // son émetteur comme à son destinataire, et les deux sont des orphelines.
  { table: 'friend_requests', colonne: 'sender_id', traitement: 'T3' },
  { table: 'friend_requests', colonne: 'receiver_id', traitement: 'T3' },
  { table: 'subscriptions', colonne: 'user_id', traitement: 'T5' },
  { table: 'organization_members', colonne: 'user_id', traitement: 'T4' },
  { table: 'org_notifications', colonne: 'user_id', traitement: 'T4' },
];

/**
 * Les traitements à durée BORNÉE (contrôle B).
 *
 * `jours` : le maximum déclaré par le registre.
 * `colonne` : la colonne de date qui fait foi. 🔴 RELEVÉE en base
 * (`information_schema.columns`), non devinée : `payment_records` porte
 * `occurred_at`, `withdrawal_consents` `consented_at`, `renewal_notices`
 * `sent_at`. Une garde écrite sur `created_at` échouerait sur une erreur SQL,
 * donc rouge pour la mauvaise raison.
 */
export const DUREES_BORNEES = [
  {
    table: 'payment_records',
    colonne: 'occurred_at',
    jours: 3653, // dix ans
    traitement: 'T6',
    source: 'Registre T6 : « dix ans » (CGI art. L102 B, journal inaltérable mig. 125).',
  },
  {
    table: 'payment_closures',
    colonne: 'period_end',
    jours: 3653,
    traitement: 'T6',
    source: 'Registre T6, même durée que les écritures qu elles scellent.',
  },
  {
    // M4 (mig. 152) : la corbeille des tâches d'équipe. `deleted_at` est NULL
    // pour toute tâche vivante, donc `min(deleted_at)` ne mesure que la
    // corbeille. La purge (pg_cron, 03:45 UTC) retire ce qui dépasse 30 jours ;
    // 31 laisse passer le jour de décalage entre deux purges, rien de plus.
    table: 'team_tasks',
    colonne: 'deleted_at',
    jours: 31,
    traitement: 'T4',
    source: 'Registre T4 : « tâches supprimées : 30 jours en corbeille, puis effacement » (mig. 152).',
  },
  {
    table: 'rate_limits',
    colonne: 'window_start',
    // 🔴 `null` = AUCUNE DURÉE DÉCLARÉE AU REGISTRE, un constat, pas un oubli
    // de ce fichier. Poser 7 jours « parce que ça paraît raisonnable » serait
    // un chiffre INVENTÉ : la mesure en base (une ligne, âgée de 7 jours PILE)
    // rougirait le lendemain sur une borne que personne n'a décidée.
    // Ce qui manque est une ligne au registre : le compte et l'âge sont donc
    // IMPRIMÉS, et l'absence de durée signalée à chaque run, jusqu'à ce
    // qu'elle soit écrite (décision d'Axel).
    jours: null,
    traitement: 'T7',
    source:
      'Compteur anti-abus à fenêtre glissante (mig. 139). Les lignes portent un '
      + "haché salé d'adresse IP, donc une donnée à caractère personnel — et "
      + 'aucune purge ne les retire. Le registre ne déclare pas de durée pour ce '
      + 'traitement.',
  },
  {
    table: 'email_lookup_quota',
    colonne: 'window_start',
    jours: null,
    traitement: 'T1',
    source:
      'Même nature que `rate_limits` : un quota à fenêtre, pas un historique. '
      + 'Aucune durée déclarée au registre non plus.',
  },
];

/** Les tables dont la survie est l'objet même. Exemptées du contrôle A. */
export const PREUVES = new Set(['payment_records', 'payment_closures', 'withdrawal_consents', 'renewal_notices']);

/**
 * Le libellé d'une ligne du contrôle A. Une table peut porter DEUX colonnes de
 * compte (`friend_requests`) : la clé est donc `table.colonne`, jamais la
 * table seule, sinon la seconde écraserait la première dans le résultat.
 */
export const libelle = ({ table, colonne }) => `${table}.${colonne}`;

/** Le SQL du contrôle A : une ligne par couple table/colonne, le compte des orphelines. */
export function sqlOrphelines(tables = DUREE_DE_VIE_DU_COMPTE) {
  return tables
    .map(
      ({ table, colonne }) =>
        `SELECT '${libelle({ table, colonne })}' AS t, count(*)::int AS n FROM public.${table} x`
        + ` LEFT JOIN auth.users u ON u.id = x.${colonne}`
        // 🔴 `IS NOT NULL` : une colonne de compte NULLE n'a jamais désigné de
        // compte, donc elle ne peut pas lui survivre (`friend_requests.
        // receiver_id` NULL = invitation vers une adresse sans compte). Sans ce
        // filtre, la garde rougit pour une fausse raison.
        + ` WHERE x.${colonne} IS NOT NULL AND u.id IS NULL`,
    )
    .join('\nUNION ALL ');
}

/** Le SQL du contrôle B : l'âge de la plus vieille ligne, en jours. */
export function sqlAges(bornees = DUREES_BORNEES) {
  return bornees
    .map(
      ({ table, colonne }) =>
        `SELECT '${table}' AS t, count(*)::int AS n,`
        + ` COALESCE(EXTRACT(DAY FROM now() - min(${colonne}))::int, 0) AS age`
        + ` FROM public.${table}`,
    )
    .join('\nUNION ALL ');
}

async function retention() {
  // 🔴 Pas de repli silencieux : sans jeton, cette garde ne mesure RIEN, et
  // un run vert dirait « les durées sont respectées » sans avoir lu une ligne.
  const { token, projet } = secrets(
    '✖ SUPABASE_ACCESS_TOKEN absent. Cette garde LIT la base de production :\n'
      + '  sans jeton elle ne mesure rien, et un run vert mentirait sur la pièce\n'
      + "  qu'on produit en contrôle CNIL. Le secret existe déjà au dépôt (il sert\n"
      + '  à `check:edge`).',
  );
  const erreurs = [];

  // ── A. Aucune ligne orpheline ──────────────────────────────────
  const orph = await interrogerSupabase(sqlOrphelines(), { token, projet });
  const parTable = new Map(lignesDe(orph).map((r) => [r.t, Number(r.n)]));
  if (parTable.size !== DUREE_DE_VIE_DU_COMPTE.length) {
    erreurs.push(
      `Le contrôle des lignes orphelines a rendu ${parTable.size} résultat(s) pour `
        + `${DUREE_DE_VIE_DU_COMPTE.length} table(s) attendue(s) : il n'a pas tout mesuré.`,
    );
  }
  console.log('Conservation · A. lignes survivant à leur compte (RGPD art. 17)');
  for (const { table, colonne, traitement } of DUREE_DE_VIE_DU_COMPTE) {
    const n = parTable.get(libelle({ table, colonne }));
    console.log(`  ${traitement} ${libelle({ table, colonne }).padEnd(32)} ${n ?? '—'} orpheline(s)`);
    if (n > 0 && !PREUVES.has(table)) {
      erreurs.push(
        `\`${table}\` : ${n} ligne(s) dont le compte n'existe plus (${traitement}).\n`
          + '    Le registre déclare « durée de vie du compte » : ces lignes sont des\n'
          + '    données personnelles conservées SANS BASE LÉGALE.',
      );
    }
  }

  // ── B. Aucune ligne plus vieille que sa durée ──────────────────
  const ages = await interrogerSupabase(sqlAges(), { token, projet });
  const parAge = new Map(lignesDe(ages).map((r) => [r.t, { n: Number(r.n), age: Number(r.age) }]));
  console.log('\nConservation · B. âge de la plus vieille ligne');
  const sansDuree = [];
  for (const d of DUREES_BORNEES) {
    const v = parAge.get(d.table);
    console.log(
      `  ${d.traitement} ${d.table.padEnd(24)} ${String(v?.n ?? '—').padStart(6)} ligne(s), `
        + `plus vieille ${v?.age ?? '—'} j (max déclaré ${d.jours === null ? 'AUCUN' : `${d.jours} j`})`,
    );
    if (d.jours === null) {
      // 🔴 Pas une erreur, et pas un silence non plus. Le registre ne déclare
      // rien pour cette table : on ne peut donc PAS juger, et inventer un
      // seuil ici reviendrait à écrire le registre depuis un script. Le fait
      // est imprimé à chaque run pour qu'il ne s'installe pas.
      if (v && v.n > 0) {
        sansDuree.push(`${d.table} (${v.n} ligne(s), plus vieille ${v.age} j, ${d.traitement})`);
      }
      continue;
    }
    if (v && v.n > 0 && v.age > d.jours) {
      erreurs.push(
        `\`${d.table}\` : une ligne de ${v.age} jours, au-delà des ${d.jours} déclarés (${d.traitement}).\n`
          + `    ${d.source}\n`
          + '    ❌ Ne pas allonger la durée pour éteindre ce rouge : purger, ou corriger\n'
          + '       le registre en connaissance de cause.',
      );
    }
  }

  if (sansDuree.length > 0) {
    console.log(
      `\n🔎 ${sansDuree.length} table(s) portant des données personnelles SANS durée\n`
        + '   déclarée au registre art. 30 :\n'
        + `     ${sansDuree.join('\n     ')}\n`
        + "   Ce n'est PAS un échec de cette garde : c'est une ligne qui manque au\n"
        + '   registre, et une décision (quelle durée ?) qui appartient à Axel.\n'
        + '   ❌ Ne pas la trancher ici en posant un seuil : ce serait écrire le\n'
        + '      registre depuis un script.',
    );
  }

  console.log(
    '\n⚠️ Ce que ça ne prouve pas : que le REGISTRE est juste. Ça dit que la base\n'
      + '   respecte ce que le registre déclare. Et rien sur Sentry ou Stripe,\n'
      + '   qui relèvent de leurs fournisseurs.',
  );
  return erreurs;
}

// ── Les trois gardes : ce qui les distingue, et le verdict commun ────

/** `titre` : l'en-tête des erreurs ; `ok` : la ligne du run vert. */
const GARDES = {
  acquisition: {
    executer: acquisition,
    titre: '\n✖ Acquisition :',
    ok: '\n✓ Annuaires datés et étiquetés, chiffres dans leur fenêtre de fraîcheur.',
  },
  'db-cost': {
    executer: dbCost,
    titre: '\n✖ Coût serveur :',
    ok: '✓ Aucun plafond franchi, aucune pente au-delà de la tolérance.',
  },
  retention: {
    executer: retention,
    titre: '\n✖ Durées de conservation :',
    ok: '\n✓ Aucune ligne au-delà de sa durée déclarée, aucune ligne sans compte.',
  },
};

if (estLance(import.meta.url)) {
  const garde = GARDES[process.argv[2]];
  if (!garde) {
    console.error(`✖ Garde inconnue « ${process.argv[2] ?? ''} ». Admises : ${Object.keys(GARDES).join(', ')}.`);
    process.exit(1);
  }
  const erreurs = await garde.executer();
  if (erreurs.length > 0) {
    console.error(garde.titre);
    for (const e of erreurs) console.error(`  - ${e}\n`);
    process.exit(1);
  }
  console.log(garde.ok);
}
