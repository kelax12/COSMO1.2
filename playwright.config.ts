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
    // ─── Locale du navigateur : française, comme l'utilisateur cible ───
    //
    // Sans ça, Chromium et WebKit annoncent `en-US`. Depuis la phase 2 i18n,
    // la racine `/` redirige alors vers `/en/` et la landing rend en anglais —
    // or toutes les fixtures et la plupart des sélecteurs sont écrits en
    // français (« Essayer maintenant — sans inscription »). Résultat : les ~55
    // tests passant par le mode démo échouaient dans la fixture, sur les deux
    // projets, avec un `TimeoutError` qui ressemblait à un sélecteur cassé.
    //
    // L'app est 100 % française (cf. CLAUDE.md) : un navigateur francophone est
    // la configuration NORMALE, pas un cas particulier. Les tests qui vérifient
    // la détection automatique de langue (e2e/i18n-routing.spec.ts) surchargent
    // eux-mêmes `navigator.language` via `addInitScript` — ils restent donc
    // indépendants de ce réglage, et c'est ce qui rend ce défaut sans danger.
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // `retain-on-failure` ENREGISTRE tout et jette après coup : chaque test paie
    // la capture, et la fermeture du contexte attend le flush du .webm. Mesuré
    // sur cette machine : fixture démo à 12,8 s sans vidéo contre 55,4 s avec,
    // plus 21 s de flush — soit un test à 3 min au lieu de 30 s, et un budget
    // vidéo de ~30 min sur les 82 tests.
    // `on-first-retry` s'aligne sur `trace` : rien en local (retries=0), et une
    // vidéo en CI (retries=2) sur la 2ᵉ tentative d'un test qui échoue — donc
    // la même valeur de diagnostic là où on en a besoin, sans la taxe partout.
    video: 'on-first-retry',
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
