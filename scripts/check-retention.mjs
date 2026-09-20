// ═══════════════════════════════════════════════════════════════════
// C-93 — les DURÉES de conservation ne sont confrontées à AUCUNE donnée
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 LE DÉFAUT. `docs/RGPD-REGISTRE.md` déclare dix traitements, chacun avec
// sa durée de conservation. C'est la pièce qu'on produit en contrôle CNIL ou
// en due diligence. Rien, jamais, n'a vérifié qu'une seule ligne de la base
// respecte ce qui y est écrit.
//
// Un registre faux est pire qu'un registre absent : il atteste qu'on savait.
//
// ── CE QUI EST VÉRIFIABLE, ET COMMENT ───────────────────────────────
//
// Les dix traitements ne déclarent pas tous une durée bornée. Sept disent
// « durée de vie du compte », ce qui n'est pas une date. La traduction
// MESURABLE de cette phrase existe pourtant, et c'est même le contrôle qui
// compte le plus :
//
//   A. AUCUNE LIGNE ORPHELINE. « Durée de vie du compte » veut dire qu'aucune
//      ligne ne survit à la disparition de son `auth.users`. Une ligne
//      orpheline est une donnée personnelle conservée SANS BASE LÉGALE, et
//      c'est la forme qu'a prise le défaut RGPD réel de ce dépôt
//      (`shared_tasks` purgée sur la mauvaise colonne, `friends` symétrique).
//      ⚠️ Deux tables en sont EXEMPTÉES, et c'est écrit : `payment_records`
//      et `withdrawal_consents` sont des PREUVES dont la survie est
//      l'objet même (RGPD art. 17.3.b).
//
//   B. AUCUNE LIGNE PLUS VIEILLE QUE SA DURÉE, pour les traitements qui en
//      déclarent une bornée.
//
// ── CE QUE ÇA NE PROUVE PAS ─────────────────────────────────────────
//
// ⚠️ Que le registre est juste. Il dit que la BASE respecte ce que le
// registre DÉCLARE. Si le registre déclare dix ans là où la loi en demande
// six, cette garde le confirmera consciencieusement.
// ⚠️ Rien sur les données hors base : Sentry (90 jours annoncés), Vesk,
// Stripe. Elles relèvent de leurs fournisseurs et de leurs DPA.
//
// ❌ NE JAMAIS ALLONGER UNE DURÉE ICI POUR FAIRE PASSER LA GARDE. Un
//    dépassement dit qu'il faut purger, ou que le registre doit être corrigé
//    — et corriger un registre se fait en connaissance de cause, pas pour
//    éteindre un rouge.
// ═══════════════════════════════════════════════════════════════════

import { sep } from 'node:path';

const PROJET_DEFAUT = 'ykeugqfgklejcdbrmawy';

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
  { table: 'task_dependencies', colonne: 'user_id', traitement: 'T2' },
  { table: 'friends', colonne: 'user_id', traitement: 'T3' },
  { table: 'friend_requests', colonne: 'user_id', traitement: 'T3' },
  { table: 'subscriptions', colonne: 'user_id', traitement: 'T5' },
  { table: 'organization_members', colonne: 'user_id', traitement: 'T4' },
  { table: 'org_notifications', colonne: 'user_id', traitement: 'T4' },
];

/**
 * Les traitements à durée BORNÉE (contrôle B).
 *
 * `jours` : le maximum déclaré par le registre.
 * `colonne` : la colonne de date qui fait foi. 🔴 Elle a été RELEVÉE en base
 * le 2026-09-20 (`information_schema.columns`) et non devinée : trois de ces
 * tables n'ont pas de `created_at` — `payment_records` porte `occurred_at`,
 * `withdrawal_consents` porte `consented_at`, `renewal_notices` porte
 * `sent_at`. Une garde écrite sur `created_at` aurait échoué sur une erreur
 * SQL, donc rouge pour la mauvaise raison.
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
    table: 'rate_limits',
    colonne: 'window_start',
    // 🔴 `null` = AUCUNE DURÉE DÉCLARÉE AU REGISTRE, et c'est un constat, pas
    // un oubli de ce fichier. La première écriture posait 7 jours « parce
    // qu'une fenêtre glissante d'une semaine, ça paraît raisonnable » —
    // c'est-à-dire un chiffre INVENTÉ, exactement ce que l'en-tête de ce
    // script interdit. Mesuré en base le 2026-09-20 : une ligne, âgée de
    // 7 jours PILE. Un seuil à 7 aurait donc rougi le lendemain, sur une
    // borne que personne n'a décidée.
    //
    // Ce qui manque n'est pas un seuil : c'est une ligne au registre. Le
    // compte et l'âge sont donc IMPRIMÉS, et l'absence de durée signalée à
    // chaque run, jusqu'à ce qu'elle soit écrite (décision d'Axel).
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
 * Exécute du SQL en LECTURE via l'API Management de Supabase.
 *
 * 🔴 LECTURE SEULE, et ce n'est pas qu'une intention : `CLAUDE.md` interdit
 * toute écriture par ce chemin (il contourne la RLS). Les requêtes de ce
 * fichier sont toutes des `SELECT count(*)`.
 */
export async function interroger(sql, { token, projet, fetchImpl = fetch }) {
  const res = await fetchImpl(`https://api.supabase.com/v1/projects/${projet}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) throw new Error(`API Management : HTTP ${res.status} ${await res.text()}`);
  return res.json();
}

/** Le SQL du contrôle A : une ligne par table, le compte des orphelines. */
export function sqlOrphelines(tables = DUREE_DE_VIE_DU_COMPTE) {
  return tables
    .map(
      ({ table, colonne }) =>
        `SELECT '${table}' AS t, count(*)::int AS n FROM public.${table} x`
        + ` LEFT JOIN auth.users u ON u.id = x.${colonne} WHERE u.id IS NULL`,
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

// ── Exécution ──────────────────────────────────────────────────────

const estLanceDirectement =
  process.argv[1]
  && import.meta.url === new URL(`file://${process.argv[1].split(sep).join('/')}`).href;

if (estLanceDirectement) {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const projet = process.env.SUPABASE_PROJECT_REF || PROJET_DEFAUT;

  // 🔴 Pas de repli silencieux : sans jeton, cette garde ne mesure RIEN, et
  // un run vert dirait « les durées sont respectées » sans avoir lu une ligne.
  if (!token) {
    console.error(
      '✖ SUPABASE_ACCESS_TOKEN absent. Cette garde LIT la base de production :\n'
        + '  sans jeton elle ne mesure rien, et un run vert mentirait sur la pièce\n'
        + "  qu'on produit en contrôle CNIL. Le secret existe déjà au dépôt (il sert\n"
        + '  à `check:edge`).',
    );
    process.exit(1);
  }

  const erreurs = [];

  // ── A. Aucune ligne orpheline ──────────────────────────────────
  const orph = await interroger(sqlOrphelines(), { token, projet });
  const parTable = new Map((Array.isArray(orph) ? orph : orph.result ?? []).map((r) => [r.t, Number(r.n)]));
  if (parTable.size !== DUREE_DE_VIE_DU_COMPTE.length) {
    erreurs.push(
      `Le contrôle des lignes orphelines a rendu ${parTable.size} résultat(s) pour `
        + `${DUREE_DE_VIE_DU_COMPTE.length} table(s) attendue(s) : il n'a pas tout mesuré.`,
    );
  }
  console.log('Conservation · A. lignes survivant à leur compte (RGPD art. 17)');
  for (const { table, traitement } of DUREE_DE_VIE_DU_COMPTE) {
    const n = parTable.get(table);
    console.log(`  ${traitement} ${table.padEnd(24)} ${n ?? '—'} orpheline(s)`);
    if (n > 0 && !PREUVES.has(table)) {
      erreurs.push(
        `\`${table}\` : ${n} ligne(s) dont le compte n'existe plus (${traitement}).\n`
          + '    Le registre déclare « durée de vie du compte » : ces lignes sont des\n'
          + '    données personnelles conservées SANS BASE LÉGALE.',
      );
    }
  }

  // ── B. Aucune ligne plus vieille que sa durée ──────────────────
  const ages = await interroger(sqlAges(), { token, projet });
  const parAge = new Map(
    (Array.isArray(ages) ? ages : ages.result ?? []).map((r) => [r.t, { n: Number(r.n), age: Number(r.age) }]),
  );
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
      + '   respecte ce que le registre déclare. Et rien sur Sentry, Vesk ou Stripe,\n'
      + '   qui relèvent de leurs fournisseurs.',
  );

  if (erreurs.length > 0) {
    console.error('\n✖ Durées de conservation :');
    for (const e of erreurs) console.error(`  - ${e}\n`);
    process.exit(1);
  }
  console.log('\n✓ Aucune ligne au-delà de sa durée déclarée, aucune ligne sans compte.');
}
