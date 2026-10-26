// vitest.mutation.config.ts
// Config de Vitest lue par Stryker seulement (`stryker.config.mjs`, AM-3).
// Elle ne ramasse QUE les tests unitaires du périmètre muté : la suite entière
// rejouée à chaque mutant coûterait des heures, et les gardes TEXTUELLES
// (`*.guard.test.ts`, qui relisent le source) tueraient un mutant pour la
// mauvaise raison, parce que son texte a changé et non parce qu'une assertion
// a vu le comportement changer.
import { defineConfig } from 'vitest/config';
import base from './vitest.config';

// Pas de `mergeConfig` : il CONCATÈNE les tableaux, donc `include` aurait
// gardé toute la suite de `vitest.config.ts`.
export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: [
      'src/modules/billing/refund-replay.test.ts',
      'src/modules/billing/refund-amount.test.ts',
      'src/modules/billing/org-billing-contact.test.ts',
      'src/modules/billing/org-billing.logic.test.ts',
      'src/modules/billing/subscription.logic.test.ts',
      'src/lib/query-retry.test.ts',
      'src/lib/restore-id.test.ts',
      'src/modules/tasks/recurrence.test.ts',
    ],
    coverage: { enabled: false },
  },
});
