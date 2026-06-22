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
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
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
        // ── Plancher GLOBAL ──
        // Posé JUSTE sous le réel mesuré pour empêcher toute régression nette
        // (ratchet). À remonter au fil des phases, jamais au-dessus du mesuré.
        // Mesuré 2026-06-22 (audit P0 couverture métier) : L/S 17.17 %,
        // F 66.37 %, B 75.17 % (marge ~1 pt pour la stabilité cross-CI).
        lines: 16,
        statements: 16,
        functions: 65,
        branches: 74,
        // ── Gates par fichier (code à fort risque) ──
        // Logique métier dérivée + LocalStorage repositories (démo) — couverts
        // à 95-100 % par l'audit P0. Ces gates verrouillent l'acquis.
        'src/modules/okrs/hooks.derived.ts': { lines: 95, functions: 100, statements: 95, branches: 88 },
        'src/modules/habits/hooks.derived.ts': { lines: 95, functions: 100, statements: 95, branches: 85 },
        'src/modules/okrs/repository.ts': { lines: 95, functions: 100, statements: 95, branches: 80 },
        'src/modules/kr-completions/repository.ts': { lines: 95, functions: 100, statements: 95, branches: 90 },
        'src/modules/friends/repository.ts': { lines: 95, functions: 100, statements: 95, branches: 80 },
        'src/modules/lists/repository.ts': { lines: 95, functions: 100, statements: 95, branches: 90 },
        'src/modules/categories/repository.ts': { lines: 95, functions: 100, statements: 95, branches: 90 },
        'src/modules/events/repository.ts': { lines: 90, functions: 90, statements: 90, branches: 80 },
        'src/modules/habits/local.repository.ts': { lines: 95, functions: 100, statements: 95, branches: 80 },
        'src/modules/tasks/local.repository.ts': { lines: 95, functions: 100, statements: 95, branches: 80 },
        'src/modules/billing/billing.repository.ts': { lines: 95, functions: 95, statements: 95, branches: 60 },
        'src/modules/friends/share-link.hooks.ts': { lines: 80, functions: 90, statements: 80, branches: 55 },
        // ── Gates par fichier (code à fort risque) ──
        'src/modules/**/mappers.ts': { lines: 95, functions: 100, statements: 95, branches: 85 },
        // Repositories Supabase = frontière sécurité (anti-mass-assignment,
        // gardes injection, RPCs atomiques). Min mesuré : friends 68L / lists 38B.
        'src/modules/**/supabase.repository.ts': { lines: 65, functions: 55, statements: 65, branches: 35 },
        'src/lib/app-mode.store.ts': { lines: 70, functions: 75, statements: 70, branches: 75 },
        // Factory d'aiguillage démo/prod = frontière de routage des données
        // (faille B20 : singletons stale après flip de mode). Couverture 100 %.
        'src/lib/repository.factory.ts': { lines: 100, functions: 100, statements: 100, branches: 90 },
        // Kill-switch Premium : tripwire anti-divergence (Stripe non finalisé).
        'src/modules/billing/premium-config.ts': { lines: 100, functions: 100, statements: 100, branches: 100 },
        'src/lib/utils.ts': { lines: 100, functions: 100, statements: 100, branches: 100 },
        'src/lib/hooks/use-habit-pauses.ts': { lines: 90, functions: 100, statements: 90, branches: 75 },
        'src/lib/hooks/useDebounce.ts': { lines: 60, functions: 60, statements: 60, branches: 80 },
        'src/modules/tasks/hooks.derived.ts': { lines: 65, functions: 60, statements: 65, branches: 85 },
        // Extractions phase 3 (logique pure des god-components)
        'src/lib/avatar-upload.ts': { lines: 100, functions: 100, statements: 100, branches: 90 },
        'src/components/AddTaskForm.validation.ts': { lines: 100, functions: 100, statements: 100, branches: 90 },
        'src/modules/billing/ad-limit.ts': { lines: 100, functions: 100, statements: 100, branches: 90 },
        // Définition canonique de « premium » côté client — extraite de
        // billing.context.tsx (audit 2026-06-10). Une régression ici = accès
        // premium incorrect pour tous les comptes.
        'src/modules/billing/subscription.logic.ts': { lines: 100, functions: 100, statements: 100, branches: 85 },
        'src/lib/email.ts': { lines: 100, functions: 100, statements: 100, branches: 90 },
        'src/lib/withTimeout.ts': { lines: 90, functions: 100, statements: 90, branches: 75 },
        'src/lib/workTimeCalculator.ts': { lines: 90, functions: 100, statements: 90, branches: 75 },
        'src/lib/pagination.warning.ts': { lines: 90, functions: 100, statements: 90, branches: 75 },
        'src/lib/acknowledged-shares.ts': { lines: 90, functions: 100, statements: 90, branches: 80 },
      },
    },
  },
});
