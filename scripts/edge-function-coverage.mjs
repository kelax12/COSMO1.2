// ═══════════════════════════════════════════════════════════════════
// C-82 (second volet) — ce qui tient lieu de couverture aux Edge Functions
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 LE PROBLÈME. `supabase/functions/**` est le code qui DÉPLACE DE L'ARGENT,
// et la couverture du dépôt s'arrêtait à `src/`. Le réflexe serait d'étendre
// `coverage.include` ; il ne marche pas, et il faut dire pourquoi plutôt que
// de l'essayer et d'obtenir un zéro qu'on finirait par contourner :
//
//   · ces modules sont du DENO. Ils importent depuis `https://deno.land/...`
//     et `npm:stripe`, résolutions que ni Vite ni Node ne savent faire ici ;
//   · AUCUN test du dépôt ne les importe. Les onze témoins qui les couvrent
//     (`src/refund.guard.test.ts`, `src/rate-limit.guard.test.ts`,
//     `src/edge-mail-functions.guard.test.ts`, `src/org-deletion.guard.test.ts`…)
//     les lisent comme du TEXTE et vérifient des motifs dedans ;
//   · un provider v8 n'instrumente que ce qui est CHARGÉ. Les inclure rendrait
//     « 0 % » sur la totalité — un chiffre qui décrit le harnais, pas le code,
//     et le genre de zéro qu'on finit par exclure « provisoirement ».
//
// CE QUE CETTE GARDE MESURE À LA PLACE, et qui est vrai : aucune Edge Function
// ne peut exister sans qu'au moins UN témoin la nomme. C'est un plancher de
// présence, pas un pourcentage de lignes, et il est annoncé comme tel.
//
// ❌ NE JAMAIS ÉCRIRE QUE `supabase/functions/**` EST « COUVERT À N % ».
//    Il ne l'est pas, et il ne peut pas l'être par cette chaîne.
// ✅ Les trois choses qui le couvrent réellement, chacune sur un axe :
//    · ce fichier              — aucune fonction sans témoin ;
//    · `check-edge-deploy.mjs` — le code DÉPLOYÉ est celui du dépôt (C-35) ;
//    · `check-edge-smoke.mjs`  — le COMPORTEMENT déployé répond (C-91).
//
// ⚠️ UN TÉMOIN QUI NOMME UNE FONCTION N'EST PAS UN TEST DE CETTE FONCTION.
//    Le plancher dit « quelqu'un regarde ce fichier », pas « ce fichier est
//    juste ». C'est le maximum honnête que cette forme de mesure permette.
// ═══════════════════════════════════════════════════════════════════

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const RACINE = process.cwd();
const FONCTIONS = join(RACINE, 'supabase', 'functions');

/**
 * Le plancher, posé AU RÉEL MESURÉ le 2026-09-20. C'est un cliquet : un
 * témoin qui disparaît fait rougir la garde.
 *
 * Mesure de la pose, en nombre de fichiers de test qui NOMMENT la fonction :
 *   delete-account 7 · renewal-notice 3 · report-bug 5 ·
 *   stripe-create-checkout 2 · stripe-org-checkout 3 · stripe-org-portal 5 ·
 *   stripe-org-refund 3 · stripe-webhook 2
 *
 * 🔴 Le plancher est à 1, pas au mesuré, et c'est délibéré : à 2 ou 3, la
 * garde deviendrait un compteur de mentions, qu'on satisferait en citant un
 * nom dans un commentaire. Ce qu'on veut interdire est le cas franc — une
 * fonction déployée que RIEN ne regarde.
 */
const PLANCHER = 1;

/** Les dossiers de `supabase/functions` qui ne sont pas des fonctions. */
const NON_FONCTIONS = new Set(['_shared']);

/** Liste des Edge Functions, par leur nom de dossier. */
export function listerFonctions(racine = RACINE) {
  const base = join(racine, 'supabase', 'functions');
  if (!existsSync(base)) return [];
  return readdirSync(base)
    .filter((n) => statSync(join(base, n)).isDirectory())
    .filter((n) => !NON_FONCTIONS.has(n))
    .sort();
}

/** Tous les fichiers de test du dépôt, en chemins POSIX relatifs. */
export function listerTemoins(racine = RACINE) {
  const out = [];
  const interessant = /\.(test|spec)\.(ts|tsx|mjs)$/;
  const marcher = (rep) => {
    for (const entree of readdirSync(rep)) {
      if (entree === 'node_modules' || entree === 'dist' || entree === '.worktrees') continue;
      const chemin = join(rep, entree);
      if (statSync(chemin).isDirectory()) marcher(chemin);
      else if (interessant.test(entree)) out.push(relative(racine, chemin).split(sep).join('/'));
    }
  };
  for (const dossier of ['src', 'scripts', 'e2e']) {
    const base = join(racine, dossier);
    if (existsSync(base)) marcher(base);
  }
  return out.sort();
}

/** Pour chaque fonction, les témoins qui la nomment. */
export function temoinsParFonction(racine = RACINE) {
  const fonctions = listerFonctions(racine);
  const temoins = listerTemoins(racine);
  const contenus = new Map(temoins.map((t) => [t, readFileSync(join(racine, t), 'utf8')]));
  const out = new Map();
  for (const f of fonctions) {
    out.set(
      f,
      temoins.filter((t) => contenus.get(t).includes(f)),
    );
  }
  return out;
}

const estLanceDirectement =
  process.argv[1]
  && import.meta.url === new URL(`file://${process.argv[1].split(sep).join('/')}`).href;

if (estLanceDirectement) {
  if (!existsSync(FONCTIONS)) {
    console.error('✖ supabase/functions introuvable.');
    process.exit(1);
  }
  const par = temoinsParFonction();
  const nues = [];
  console.log('Témoins par Edge Function (plancher : ' + PLANCHER + ')');
  for (const [fonction, temoins] of par) {
    console.log(`  ${fonction.padEnd(24)} ${String(temoins.length).padStart(2)}`);
    if (temoins.length < PLANCHER) nues.push(fonction);
  }
  if (nues.length > 0) {
    console.error(
      `\n✖ ${nues.length} Edge Function(s) qu'AUCUN témoin ne nomme : ${nues.join(', ')}.`
        + "\n  Ce code est déployé et déplace de l'argent ou des données personnelles."
        + '\n  ❌ Ne pas retirer la fonction de cette liste : lui écrire un témoin.',
    );
    process.exit(1);
  }
  console.log(`\n✓ ${par.size} Edge Functions, toutes nommées par au moins ${PLANCHER} témoin.`);
  console.log('⚠️ Rappel : un témoin qui NOMME une fonction ne la TESTE pas. Ce plancher');
  console.log('   interdit le cas franc, il ne mesure aucun pourcentage de lignes.');
}
