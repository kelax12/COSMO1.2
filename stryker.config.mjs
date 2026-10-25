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
  // Les deux survivants sont ÉQUIVALENTS (aucun test ne peut les tuer) :
  //   · `recurrence.ts`, `currentKey >= todayKey` → `>` : à égalité, les deux
  //     branches rendent la même clé ;
  //   · `org-billing.logic.ts`, `t.maxMembers === null ||` → `false ||` : le
  //     repli `?? dernier palier` rend le même palier illimité.
  // 🔴 Ne jamais baisser ce seuil ni exclure un mutant pour passer : un mutant
  // qui survit se tue par une assertion.
  thresholds: { high: 95, low: 90, break: 99 },
  tempDirName: '.stryker-tmp',
  cleanTempDir: 'always',
};
