import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright, parcours contre une VRAIE base Supabase locale (TST-03).
 *
 * Ce fichier n'est lu que par `.github/workflows/e2e-supabase.yml`, qui monte
 * la pile (`supabase start`), rejoue les migrations, construit l'app avec
 * `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` de cette pile, puis lance :
 *
 *     npx playwright test -c playwright.real.config.ts
 *
 * 🔴 POURQUOI UNE CONFIG A PART, et pas un project de `playwright.config.ts` :
 * ce dernier declare deux `webServer` (le serveur de demo du port 3000 et le
 * serveur `e2e-stub`). Jouer `--project=supabase-real` les demarrerait quand
 * meme, pour rien, et le premier est celui d'une app en mode DEMO. Les specs de
 * `e2e/real/` sont par ailleurs exclues (`testIgnore`) de chaque project de
 * `playwright.config.ts` : aucun ne peut les ramasser par erreur et les jouer
 * sans pile derriere.
 *
 * ⚠️ L'app est SERVIE depuis `dist/` (`vite preview`), construite AVANT ce
 * lancement avec les variables de la pile locale. Un serveur de developpement
 * recompilerait a froid pendant les tests, ce que les autres projects paient
 * deja assez cher en chauffe.
 */
const PORT = 3220;

export default defineConfig({
  testDir: './e2e/real',
  testMatch: '**/*.spec.ts',
  // 180 s par parcours (deux ou trois comptes pour le partage et l'entreprise) : chacun cree ses comptes, passe par plusieurs ecrans et
  // recharge la page apres chaque ecriture. Pas de compilation a froid ici.
  timeout: 180_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  // Une reprise, pas deux : chaque parcours cree ses PROPRES comptes (adresse
  // horodatee), donc une reprise ne rencontre jamais l'etat de la precedente.
  retries: 0, // TODO-ITERATION: remettre 1 avant livraison
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-real' }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    // Un clic sur un element absent echoue en 30 s avec son nom, pas au delai du CAS.
    actionTimeout: 30_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'supabase-real',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `npx vite preview --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    timeout: 60_000,
    // Une collision de port doit echouer bruyamment : reutiliser un serveur
    // trouve la servirait peut-etre une app construite pour un AUTRE backend.
    reuseExistingServer: false,
  },
});
