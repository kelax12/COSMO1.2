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
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false, // mode démo partage localStorage → exécution séquentielle
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
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
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
