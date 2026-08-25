// vitest.config.ts
// Config dédiée aux tests unitaires (logique métier pure). Séparée de
// vite.config.ts pour ne pas mêler la stratégie de build (manualChunks,
// esbuild drop) à la config de test. Vitest lit ce fichier en priorité.
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    // `node` suffit pour la logique pure. Les tests DOM (hooks/composants)
    // déclarent `// @vitest-environment jsdom` en tête de fichier.
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    // `scripts/**` : tests du CLI COSMO (scripts/cosmo/), en .mjs. Sans cette
    // entrée ils ne seraient jamais ramassés et passeraient pour « verts ».
    // `src/**/*.mjs` : les helpers partagés avec `prerender.mjs` (Node brut,
    // sans bundler) sont en .mjs et leurs tests aussi, dont le test de parité
    // entre le calcul d'URL du prérendu et celui de l'app.
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      'src/**/*.{test,spec}.mjs',
      'scripts/**/*.{test,spec}.mjs',
    ],
    // L'ancien dossier Vitest jamais activé + les E2E Playwright ne doivent
    // pas être ramassés par Vitest.
    exclude: ['e2e/**', 'node_modules/**', 'dist/**', 'src/__test__/**'],
    clearMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'json-summary', 'html'],
      reportsDirectory: './coverage',
      // Ne mesure que le code applicatif testable. Exclut les barrels, types,
      // constantes, l'entrypoint, les composants shadcn (ui/), les showcases
      // marketing et les configs de tutoriel (markup statique).
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.{test,spec}.{ts,tsx}',
        'src/**/types.ts',
        'src/**/constants.ts',
        'src/**/index.ts',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/**/*.d.ts',
        'src/components/ui/**',
        'src/components/showcase/**',
        'src/tutorials/**',
        'src/lib/mockData.ts',
      ],
      // Gates ciblées : le code à fort risque (mappers = frontière sécurité
      // anti-mass-assignment, lib utilitaire, garde billing) doit rester
      // hautement couvert. Une régression de couverture y casse la CI.
      thresholds: {
        // ── Plancher GLOBAL (audit 9/10 phase 1) ──
        // Posé sous le réel mesuré pour empêcher toute régression nette. À
        // remonter au fil des phases (jamais au-dessus du mesuré courant).
        //
        // Re-calibré le 2026-08-18. `functions: 45` et `branches: 60` étaient
        // au-dessus du mesuré (21,5 % / 21,8 %) et violaient donc la règle
        // ci-dessus : ils ne protégeaient de rien, ils cassaient la CI à chaque
        // run. Le job `lint-test-build` était rouge en continu, ce qui rendait
        // muettes les gates utiles du même job (check:rls, i18n:check).
        // Ce ne sont PAS deux seuils « abaissés » : ils n'ont jamais
        // correspondu à un état atteint. Les vrais trous de couverture qu'ils
        // prétendaient couvrir ont été comblés par des tests (repositories
        // entreprise, uploads avatar, hooks dérivés) et sont gardés par les
        // gates par fichier ci-dessous, qui, elles, mordent réellement.
        //
        // lines/statements remontent de 10 → 25 : le plancher datait du
        // 2026-06-10 (12 % mesuré) et laissait passer 15 points de régression.
        // Recale au reel mesure le 2026-08-18 (26,67 / 26,28 / 21,48 / 21,86),
        // avec ~0,5 pt de marge. C'est un CLIQUET : la barre ne peut plus que
        // monter. Toute baisse nette casse la CI, y compris une baisse lente
        // due a du code neuf non teste, c'est exactement ce qui avait fait
        // deriver le projet de 12 % a 26 % sans que le plancher (10) bouge.
        //
        // 🔴 Ne JAMAIS baisser un de ces chiffres pour faire passer la CI.
        // Si une PR les fait tomber, c'est la PR qui manque de tests.
        // Les remonter apres un gain de couverture est en revanche attendu.
        lines: 26,
        statements: 26,
        functions: 21,
        // 21 -> 22 le 2026-08-25 : mesure a 22,75 %, donc la marge conventionnelle
        // de ~0,5 pt est respectee. Les trois autres NE sont PAS remontes, et
        // c'est une decision : leurs marges sont de 0,96 / 0,65 / 0,32 point,
        // soit ~20 fonctions pour la plus serree. Les recaler au mesure
        // reamorcerait des cette semaine le piege qu'on vient de desamorcer.
        // On banque la marge, on remontera quand elle sera confortable.
        branches: 22,
        // ── Gates par fichier (code à fort risque) ──
        'src/modules/**/mappers.ts': { lines: 95, functions: 100, statements: 95, branches: 85 },
        // Repositories Supabase = frontière sécurité (anti-mass-assignment,
        // gardes injection, RPCs atomiques).
        //
        // Remonte le 2026-08-25 apres la campagne de tests qui a fait passer le
        // glob de 63,74 % a 76,79 % de statements (team-categories 3 -> 88,
        // friends 40 -> 76, events 54 -> 83, organizations 64 -> 82, okrs
        // 49 -> 63). Mesure : 90,55 L / 76,79 S / 93,00 F / 65,89 B ; seuils
        // poses ~2 pt en dessous, comme le veut la convention du fichier.
        //
        // C'est CE cliquet-la qui mord en premier : un nouveau repository livre
        // sans test fera tomber le glob bien avant de bouger le plancher global.
        'src/modules/**/supabase.repository.ts': { lines: 88, functions: 90, statements: 74, branches: 63 },
        'src/lib/app-mode.store.ts': { lines: 70, functions: 75, statements: 70, branches: 75 },
        'src/lib/utils.ts': { lines: 100, functions: 100, statements: 100, branches: 100 },
        'src/lib/hooks/use-habit-pauses.ts': { lines: 90, functions: 100, statements: 90, branches: 75 },
        'src/lib/hooks/useDebounce.ts': { lines: 60, functions: 60, statements: 60, branches: 80 },
        'src/modules/tasks/hooks.derived.ts': { lines: 65, functions: 60, statements: 65, branches: 85 },
        // Extractions phase 3 (logique pure des god-components)
        'src/lib/avatar-upload.ts': { lines: 100, functions: 100, statements: 100, branches: 90 },
        'src/components/AddTaskForm.validation.ts': { lines: 100, functions: 100, statements: 100, branches: 90 },
        'src/modules/billing/ad-limit.ts': { lines: 100, functions: 100, statements: 100, branches: 90 },
        // Définition canonique de « premium » côté client, extraite de
        // billing.context.tsx (audit 2026-06-10). Une régression ici = accès
        // premium incorrect pour tous les comptes.
        'src/modules/billing/subscription.logic.ts': { lines: 100, functions: 100, statements: 100, branches: 85 },
        'src/lib/email.ts': { lines: 100, functions: 100, statements: 100, branches: 90 },
        'src/lib/withTimeout.ts': { lines: 90, functions: 100, statements: 90, branches: 75 },
        'src/lib/workTimeCalculator.ts': { lines: 90, functions: 100, statements: 90, branches: 75 },
        'src/lib/pagination.warning.ts': { lines: 90, functions: 100, statements: 90, branches: 75 },
        'src/lib/acknowledged-shares.ts': { lines: 90, functions: 100, statements: 90, branches: 80 },
        // Socle i18n, traverse toute l'app (chaque libellé, chaque date, chaque
        // URL localisée). Une régression y est invisible en dev (le moteur
        // retombe sur le français) mais casse EN/ES en prod. Les catalogues
        // .json ne sont pas concernés : `include` ne prend que .ts/.tsx.
        // Seuils posés SOUS le réel mesuré (100/100/100 lignes-fonctions-
        // statements ; branches 94 / 100 / 93), même convention que le plancher
        // global : on interdit la régression sans exiger l'inatteignable.
        'src/i18n/locale.ts': { lines: 100, functions: 100, statements: 100, branches: 90 },
        'src/i18n/translate.ts': { lines: 100, functions: 100, statements: 100, branches: 100 },
        'src/i18n/routes.ts': { lines: 100, functions: 100, statements: 100, branches: 90 },
      },
    },
  },
});
