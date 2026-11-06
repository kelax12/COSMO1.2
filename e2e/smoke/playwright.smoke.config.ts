import { defineConfig, devices } from '@playwright/test';

/**
 * Config du contrôle de fumée de production (`e2e/smoke/prod.smoke.ts`).
 *
 * ❌ PAS de `webServer` : la cible est un site déjà en ligne. C'est ce qui la
 * distingue de `playwright.config.ts`, qui sert l'app en local.
 *
 * `SMOKE_BASE_URL` pointe ailleurs que la production (aperçu Vercel, essai).
 * Sans lui : le domaine de production, public (docs/DEPLOYMENT.md § 9).
 */
export default defineConfig({
  testDir: '.',
  testMatch: '**/*.smoke.ts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  // Une retentative absorbe un réseau de runner capricieux, pas un site cassé :
  // un site cassé échoue trois fois de suite.
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list']],
  outputDir: '../../test-results/smoke',
  use: {
    baseURL: process.env.SMOKE_BASE_URL || 'https://thecosmo.app',
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'smoke-prod', use: { ...devices['Desktop Chrome'] } }],
});
