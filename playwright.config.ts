import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config — tests E2E critiques pour COSMO.
 *
 * Lance sur Chromium uniquement par défaut (gain de temps en CI).
 * Pour tester iOS Safari, ajouter le project "webkit-mobile" via flag.
 *
 * Le test reuseExistingServer permet de lancer les tests sans avoir à
 * redémarrer le dev server entre runs.
 */
export default defineConfig({
  testDir: './e2e',
  // Uniquement les *.spec.ts : e2e/rls/*.test.ts sont des tests Vitest
  // (vitest.integration.config.ts) que Playwright ne doit pas collecter.
  testMatch: '**/*.spec.ts',
  // 120 s : le tout premier test paie la compilation Vite à froid de l'app
  // (≈46k LOC : LandingPage + GSAP, puis DashboardPage + recharts, lazy tous
  // les deux). 60 s ne suffisaient plus — le clic sur le CTA démo lui-même
  // restait bloqué pendant la compilation et le test expirait DANS la fixture,
  // ce qui donnait un faux « sélecteur cassé ». Les tests suivants (serveur
  // chaud) tournent en 3-10 s, donc ce plafond ne masque aucune lenteur réelle.
  timeout: 120_000,
  expect: { timeout: 5_000 },
  fullyParallel: false, // mode démo partage localStorage → exécution séquentielle
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    // baseURL aligné sur le script `npm start` (port 3000 réseau)
    // pour réutiliser un dev server existant sans en redémarrer un.
    // Override via PLAYWRIGHT_BASE_URL si besoin.
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
  webServer: {
    // npm start lance vite sur 0.0.0.0:3000 — utilisé par les tests E2E.
    // reuseExistingServer évite de redémarrer si tu as déjà `npm start` ouvert.
    command: 'npm start',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
