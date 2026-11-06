// @ts-check
// Test de mutation (AM-3 de `docs/TESTING.md`), joué chaque semaine par
// `.github/workflows/mutation.yml`. Les tests lancés : `vitest.mutation.config.ts`.
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: 'vitest',
  vitest: { configFile: 'vitest.mutation.config.ts', related: false },
  coverageAnalysis: 'perTest',
  mutate: [
    'supabase/functions/_shared/refund-replay.ts',
    'supabase/functions/_shared/refund-amount.ts',
    'supabase/functions/_shared/org-billing-contact.ts',
    'src/modules/billing/*.logic.ts',
    'src/lib/query-retry.ts',
    'src/lib/restore-id.ts',
    'src/modules/tasks/recurrence.ts',
  ],
  reporters: ['clear-text', 'progress', 'html', 'json'],
  htmlReporter: { fileName: 'reports/mutation/index.html' },
  jsonReporter: { fileName: 'reports/mutation/mutation.json' },
  concurrency: 2,
  // `break` = score mesuré le 2026-10-23 après renforcement (99,16 %, 235/237).
  // Reprise le 2026-11-06 après la logique de facturation du 11-02 (396 mutants,
  // 33 survivants, 91,67 %) : voir `docs/TESTING.md`, ligne AM-3.
  // Les survivants restants sont ÉQUIVALENTS (aucune entrée ne distingue les
  // deux programmes) :
  //   · `recurrence.ts`, `currentKey >= todayKey` → `>` : à égalité, les deux
  //     branches rendent la même clé ;
  //   · `org-billing.logic.ts`, `tierByQuota`, `t.maxMembers >= quota` → `>` : ce
  //     repli ne s'exécute que si la recherche EXACTE (`=== quota`) n'a rien
  //     trouvé, donc qu'AUCUN palier n'a `maxMembers === quota` ; `>=` et `>`
  //     ne diffèrent que sur cette égalité. Vrai pour toute grille et toute
  //     valeur de `quota`, `NaN` compris (les deux sont faux).
  // 🔴 Ne jamais baisser ce seuil ni exclure un mutant pour passer : un mutant
  // qui survit se tue par une assertion.
  //
  // Ce qui n'est PLUS un équivalent (2026-11-06) :
  //   · `tierForMemberCount` / `recommendedTier`, `maxMembers === null ||` →
  //     `false ||` : sur la VRAIE grille le repli « dernier palier » rend le
  //     même palier, mais une grille substituée avec le palier illimité en tête
  //     les distingue (`org-billing.logic.test.ts`, `withGrid`). Ce sont des
  //     assertions, pas une exclusion.
  //   · `refund-amount.ts` : la garde `Number.isFinite` de `withinWithdrawalWindow`
  //     et le test `now >= periodEnd` de `refundAmount` étaient RÉDONDANTS
  //     (NaN et ±Infinity rendent toute comparaison fausse ; un instant à la fin
  //     de période donne `daysRemaining = 0`, donc la même décision). Quatre
  //     mutants équivalents, qui auraient suffi seuls à passer sous 99 sur ce
  //     nombre de mutants. Le code redondant a été retiré (comportement
  //     identique, 98 788 entrées comparées avant/après, NaN et ±Infinity
  //     compris) plutôt que d'exclure les mutants.
  thresholds: { high: 95, low: 90, break: 99 },
  tempDirName: '.stryker-tmp',
  cleanTempDir: 'always',
};
