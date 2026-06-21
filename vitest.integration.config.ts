import { defineConfig } from 'vitest/config';

// ═══════════════════════════════════════════════════════════════════
// Config Vitest DÉDIÉE aux tests RLS d'intégration (e2e/rls/*.test.ts).
// Séparée de vitest.config.ts À DESSEIN :
//   - la suite unitaire reste rapide, environnement node, SANS réseau ;
//   - ces tests-ci parlent à une vraie stack Supabase (GoTrue + PostgREST)
//     et ne doivent PAS tourner en CI dans le job unitaire.
// Lancée par `npm run test:rls` et le job CI `rls-integration`.
//
// Prérequis env : SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
// ═══════════════════════════════════════════════════════════════════
export default defineConfig({
  test: {
    environment: 'node',
    include: ['e2e/rls/**/*.test.ts'],
    // Sérialisé : évite que des créations/suppressions d'utilisateurs
    // concurrentes se marchent dessus sur la même base.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Pas de seuils de couverture ici (logique testée = la DB, pas du JS).
  },
});
