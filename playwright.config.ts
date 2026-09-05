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
      testIgnore: '**/stubbed/**',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-safari',
      // ─── Deux specs ne sont PAS jouées ici, et il faut dire pourquoi ───
      //
      // `demo-calendar` et `demo-task-dependencies` visent un DOM qui n'est
      // pas forké par viewport : le panneau de calendrier et la popup de
      // dépendances sont exactement les mêmes composants sur les deux. Ce qui
      // diffère, c'est la NAVIGATION pour y arriver — et sur `/tasks` en
      // 390 px, mesuré le 2026-09-05, les commandes qui y mènent n'existent
      // pas : ni « Tout replanifier » (bandeau des tâches en retard), ni
      // « Sélectionner » (barre d'actions groupées), et la carte mobile n'a
      // pas de menu de ligne équivalent. Les jouer ici mesurerait la
      // navigation deux fois et le calendrier zéro fois de plus.
      //
      // 🔴 Ce n'est PAS un constat que tout va bien sur mobile : c'est un
      // écart de produit, noté comme tel dans `docs/TESTING.md`. Un `skip`
      // silencieux l'aurait fait disparaître ; cette liste le nomme.
      testIgnore: [
        '**/stubbed/**',
        '**/demo-calendar.spec.ts',
        '**/demo-task-dependencies.spec.ts',
      ],
      use: { ...devices['iPhone 12'] },
    },
    // ─── Parcours HORS mode démo ────────────────────────────────────
    //
    // Les deux projects ci-dessus passent tous par `e2e/fixtures.ts`, donc par
    // le mode démo — c'est ce qui rend la suite instantanée et sans réseau.
    // Mais toute garde qui commence par `!isDemo` est alors STRUCTURELLEMENT
    // hors de portée : `FirstRunSetup` n'est pas resté sans parcours par
    // oubli, il l'est resté parce qu'aucun test ne pouvait l'atteindre.
    //
    // Ce project sert l'app en mode Vite `e2e-stub` (`.env.e2e-stub`), c'est-à-
    // dire avec deux variables Supabase NON VIDES pointant un hôte inexistant,
    // que `e2e/supabase-stub.ts` intercepte. Un seul viewport : ce qu'on y
    // vérifie est un enchaînement d'écrans et un corps de requête, pas un
    // comportement responsive.
    {
      name: 'supabase-stub',
      testMatch: '**/stubbed/*.spec.ts',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:3210' },
    },
  ],
  webServer: [
    {
      // npm start lance vite sur 127.0.0.1:3000 — utilisé par les tests E2E.
      // reuseExistingServer évite de redémarrer si tu as déjà `npm start` ouvert.
      command: 'npm start',
      url: 'http://localhost:3000',
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      // 🔴 `--mode e2e-stub` est la SEULE chose qui distingue ce serveur du
      // premier, et elle n'est pas cosmétique : Vite charge alors
      // `.env.e2e-stub` PAR-DESSUS `.env`, ce qui remplace les deux variables
      // Supabase vides par des valeurs non vides. Sans ça, l'app retombe en
      // mode démo automatique et les specs de `e2e/stubbed/` testeraient
      // exactement ce que les autres testent déjà.
      command: 'npx vite --mode e2e-stub --host 127.0.0.1 --port 3210',
      url: 'http://127.0.0.1:3210',
      // 🔴 Les deux variables sont repassées EXPLICITEMENT, en plus de
      // `.env.e2e-stub`, et ce n'est pas une ceinture-bretelles décorative :
      // le job `e2e` de la CI injecte `VITE_SUPABASE_URL` / `_ANON_KEY` depuis
      // les secrets du dépôt, et Vite donne la priorité à `process.env` sur un
      // fichier `.env.<mode>`. Sans cette surcharge, le jour où ces secrets
      // sont renseignés, ce serveur pointerait le VRAI projet Supabase et les
      // specs de `e2e/stubbed/` iraient parler à la production avec une
      // session forgée. L'hôte doit rester celui qui ne résout pas.
      env: {
        VITE_SUPABASE_URL: 'https://stub.cosmo.invalid',
        VITE_SUPABASE_ANON_KEY: 'e2e-stub-anon-key-not-a-secret',
      },
      // 🔴 `false`, contrairement au serveur de démo, et ce n'est pas un
      // réglage de confort. Ce dépôt a plusieurs sessions actives, chacune
      // capable de laisser un `vite` derrière elle : réutiliser un serveur
      // trouvé sur ce port ferait jouer les specs de `e2e/stubbed/` contre une
      // app en mode DÉMO, où l'écran qu'elles testent ne monte jamais. Elles
      // passeraient en mesurant la mauvaise boîte. Une collision de port doit
      // échouer bruyamment.
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
