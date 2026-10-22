// ═══════════════════════════════════════════════════════════════════
// C-101 — aucune action d'acquisition n'est reliée à son résultat
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 UN ÉNONCÉ DE C-101 ÉTAIT PÉRIMÉ, ET IL FAUT LE DIRE AVANT LE RESTE.
// « Le tracking `?ref=` reste un développement ouvert » est FAUX au
// 2026-09-20, vérifié bout en bout :
//   · `src/lib/attribution.ts` capte `?ref=` / `utm_source` en first-touch,
//     au tout premier chargement (`captureFirstTouch` dans `main.tsx`) ;
//   · `clearDemoStorage` PRÉSERVE `cosmo_first_touch` — un visiteur venu de
//     `?ref=tiktok` qui passe par la démo reste attribué ;
//   · `AuthContext.register` lit `readFirstTouch()` et le passe en metadata ;
//   · le trigger `handle_new_user_profile` (mig. 097) le RE-VALIDE côté
//     serveur, parce que la metadata vient du client ;
//   · `get_admin_stats` v3 (mig. 099) rend `signups_by_source`,
//     `activation_48h` et `retention_d7_by_source`.
// C'est une chaîne complète, du paramètre d'URL au tableau de bord. Ce qui
// manquait n'était pas le tracking : c'était de REGARDER les chiffres.
//
// ── CE QUI RESTE, ET QUE CE SCRIPT FERME ────────────────────────────
//
// 1. LES CHIFFRES DE `docs/ACQUISITION.md` DATENT DU 2026-08-14 et rien ne
//    les rejoue. Un document de pilotage périmé est pire qu'absent : on
//    décide sur un état du marché qui n'existe plus. Ce script rejoue les
//    compteurs contre la base et ÉCHOUE quand le document a trop vieilli, en
//    imprimant les chiffres frais à recopier.
//
// 2. LES ACTIONS MANUELLES DE `docs/ACQUISITION-BACKLINKS.md` n'avaient ni
//    date ni état. Une liste sans colonne d'état ne distingue pas « pas
//    encore tenté » de « tenté sans effet », et les deux appellent des
//    décisions opposées. Ce script vérifie la colonne, ses cinq valeurs, et
//    la date obligatoire sur `fait` et `refuse`.
//
// ⚠️ CE QU'IL NE FAIT PAS. Il ne vérifie PAS qu'un backlink posé existe
// encore (AM-1 de ce document) : ça demande l'API Search Console, donc un
// compte Google connecté, donc un geste. Et il ne mesure pas l'autorité de
// domaine, qui n'a pas de source gratuite fiable.
//
// ── DEUX MOITIÉS, DEUX PRÉREQUIS ────────────────────────────────────
//
// La moitié DOCUMENTAIRE tourne partout, sans secret. La moitié BASE exige
// `SUPABASE_ACCESS_TOKEN` et se demande par `--live` ; sans l'option, le
// script le DIT au lieu de laisser croire qu'il a tout regardé.
// ═══════════════════════════════════════════════════════════════════

import { readFileSync, existsSync } from 'node:fs';
import { join, sep } from 'node:path';

const RACINE = process.cwd();
const BACKLINKS = join(RACINE, 'docs', 'ACQUISITION-BACKLINKS.md');
const ACQUISITION = join(RACINE, 'docs', 'ACQUISITION.md');
const PROJET_DEFAUT = 'ykeugqfgklejcdbrmawy';

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
 * plus récente citée quelque part ». La première écriture de cette garde
 * faisait exactement ça : elle trouvait le 2026-09-20 d'une note sur une
 * migration et déclarait les chiffres frais, alors qu'ils dataient du 09-14.
 * N'importe quelle ligne ajoutée au document rajeunissait donc les chiffres
 * sans que personne les ait rejoués — une garde qui prend la première date
 * venue répond sans mesurer.
 */
export function dateDeRemesure(texte) {
  return /<!--\s*chiffres-remesures:\s*(20\d\d-\d\d-\d\d)\s*-->/.exec(texte)?.[1] ?? null;
}

/** Exécute du SQL en LECTURE via l'API Management. */
export async function interroger(sql, { token, projet, fetchImpl = fetch }) {
  const res = await fetchImpl(`https://api.supabase.com/v1/projects/${projet}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) throw new Error(`API Management : HTTP ${res.status} ${await res.text()}`);
  return res.json();
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

// ── Exécution ──────────────────────────────────────────────────────

const estLanceDirectement =
  process.argv[1]
  && import.meta.url === new URL(`file://${process.argv[1].split(sep).join('/')}`).href;

if (estLanceDirectement) {
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
        + '     SUPABASE_ACCESS_TOKEN=… node scripts/check-acquisition.mjs --live',
    );
  } else {
    const token = process.env.SUPABASE_ACCESS_TOKEN;
    const projet = process.env.SUPABASE_PROJECT_REF || PROJET_DEFAUT;
    // 🔴 Pas de repli silencieux.
    if (!token) {
      console.error(
        '\n✖ `--live` demandé sans SUPABASE_ACCESS_TOKEN. Une garde ne se rend pas\n'
          + '  conditionnelle à la présence de son propre secret.',
      );
      process.exit(1);
    }
    const reponse = await interroger(SQL_COMPTEURS, { token, projet });
    const l = (Array.isArray(reponse) ? reponse : reponse.result ?? [])[0] ?? {};
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

  if (erreurs.length > 0) {
    console.error('\n✖ Acquisition :');
    for (const e of erreurs) console.error(`  - ${e}\n`);
    process.exit(1);
  }
  console.log('\n✓ Annuaires datés et étiquetés, chiffres dans leur fenêtre de fraîcheur.');
}
