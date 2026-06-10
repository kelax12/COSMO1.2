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
        'src/modules/**/mappers.ts': { lines: 95, functions: 100, statements: 95, branches: 85 },
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
