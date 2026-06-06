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
    // `node` suffit : la logique testée est pure (pas de DOM). Les tests qui
    // auraient besoin du DOM doivent déclarer `// @vitest-environment jsdom`
    // en tête de fichier.
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // L'ancien dossier Vitest jamais activé + les E2E Playwright ne doivent
    // pas être ramassés par Vitest.
    exclude: ['e2e/**', 'node_modules/**', 'dist/**', 'src/__test__/**'],
    clearMocks: true,
  },
});
