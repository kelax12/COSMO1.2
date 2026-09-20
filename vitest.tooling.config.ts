// vitest.tooling.config.ts
// ═══════════════════════════════════════════════════════════════════
// C-82 — la couverture ne s'arrêtait pas à `src/` par hasard, elle s'y
// arrêtait sans que personne l'ait décidé.
// ═══════════════════════════════════════════════════════════════════
//
// `vitest.config.ts` mesure `src/**` et rien d'autre. En étaient absents :
//
//   · `scripts/**` — LE CODE QUI DÉCIDE SI LA CI EST VERTE. Un parseur de
//     garde qui cesse de détecter laisse tous ses jobs verts : c'est la classe
//     de défaut que `scripts/CLAUDE.md` documente en quatre exemples réels ;
//   · `supabase/functions/**` — le code qui déplace de l'argent.
//
// 🔴 POURQUOI UN SECOND FICHIER, ET PAS UNE LIGNE DANS `include`.
// Les seuils globaux de `vitest.config.ts` (26 / 26 / 21 / 22) portent sur
// TOUT ce qui est inclus. Ajouter `scripts/**` au même `include` ferait
// tomber ces chiffres, et la seule façon de garder la CI verte serait de les
// BAISSER — exactement ce que l'énoncé de C-82 interdit, et ce que la règle 3
// du `CLAUDE.md` racine interdit. Deux périmètres, deux configs, deux jeux de
// seuils : chacun ne peut plus que monter.
//
// 🔴 CE QUE CE FICHIER NE MESURE PAS, ET POURQUOI — `supabase/functions/**`.
// Ces modules sont du Deno : ils importent depuis `https://deno.land/...` et
// `npm:stripe`, et AUCUN test du dépôt ne les importe. Les onze témoins qui
// les couvrent (`src/refund.guard.test.ts`, `src/rate-limit.guard.test.ts`,
// `src/edge-mail-functions.guard.test.ts`…) les lisent comme du TEXTE. Un
// provider v8 ne peut instrumenter que ce qui est CHARGÉ : les inclure ici
// rendrait « 0 % » sur la totalité, un chiffre qui décrirait le harnais et pas
// le code.
// ❌ Ne pas « corriger » ça en abaissant un seuil pour absorber des zéros.
// ✅ Ce qui les couvre réellement est ailleurs, et c'est écrit :
//    · `scripts/edge-function-coverage.mjs` — plancher de témoins par fonction
//      (aucune Edge Function sans au moins un témoin qui la nomme) ;
//    · `scripts/check-edge-deploy.mjs` — le code DÉPLOYÉ contre le dépôt ;
//    · `scripts/check-edge-smoke.mjs` — le COMPORTEMENT déployé (C-91).
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'scripts/**/*.{test,spec}.mjs',
      'eslint-rules/**/*.{test,spec}.mjs',
    ],
    exclude: ['node_modules/**', 'dist/**', '.worktrees/**'],
    clearMocks: true,
    // Même borne que `vitest.config.ts`, même raison (C-47) : plusieurs
    // sessions travaillent sur cette machine, et un worker qui ne répond plus
    // est compté comme un test en échec alors qu'il n'a rien exécuté.
    pool: 'forks',
    maxWorkers: 2,
    testTimeout: 20_000,
    hookTimeout: 20_000,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'json-summary'],
      reportsDirectory: './coverage-tooling',
      include: ['scripts/**/*.mjs', 'eslint-rules/**/*.js'],
      exclude: [
        'scripts/**/*.{test,spec}.mjs',
        // Sondes jetables d'un audit daté : elles ne sont pas de la garde, et
        // les inclure ferait baisser un plancher pour du code mort.
        'scripts/_c5*-probe.mjs',
        'scripts/_c5*-app-probe.mjs',
        // Outils d'exploration lancés à la main, jamais en CI.
        'scripts/visual-audit*.mjs',
        'scripts/capture-*.mjs',
        'scripts/profile-landing.mjs',
        'scripts/landing-*-probe.mjs',
        'scripts/analyze-entry.mjs',
        'scripts/diagnose-rls-state.mjs',
        'scripts/optimize-images.mjs',
      ],
      // 🔴 LES SEUILS NE SONT PAS ICI, ET C'EST VOULU.
      // `thresholds` de vitest juge un rapport dont trois fichiers ont pu
      // sortir EN SILENCE (cf. la liste des shebangs ci-dessus) : il
      // prononcerait donc un verdict sur un périmètre réduit sans le dire.
      // C'est `scripts/check-tooling-coverage.mjs` qui juge, APRÈS avoir
      // vérifié que le périmètre est complet. `npm run check:tooling-coverage`
      // enchaîne les deux.
      thresholds: {},
    },
  },
});
