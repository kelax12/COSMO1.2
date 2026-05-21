import { test as base, expect, Page } from '@playwright/test';

/**
 * Fixture commune : démarre chaque test en mode démo authentifié sur /dashboard.
 *
 * Le mode démo est instantané (pas de réseau Supabase, seed local) — parfait
 * pour les tests E2E. On clique le bouton "Essayer maintenant — sans
 * inscription" sur la landing, puis on attend que le dashboard soit affiché.
 *
 * Note : si l'onboarding overlay s'affiche (premier loginDemo), on le ferme
 * pour ne pas interférer avec les assertions du test.
 */
export const test = base.extend<{ demoPage: Page }>({
  demoPage: async ({ page, context }, use) => {
    // 1. État propre — clear cookies + storage Supabase + flags démo
    //    (sinon RootRoute redirige immédiatement vers /dashboard si session
    //     déjà active, et le CTA "Essayer maintenant" n'existe pas).
    await context.clearCookies();
    await page.goto('/');
    await page.evaluate(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch { /* ignore */ }
    });
    // Reload pour repartir d'une LandingPage propre
    await page.goto('/');

    // 2. Cliquer le CTA démo principal
    //    Le bouton a aria-label "Essayer la démo sans inscription"
    //    et un texte visible "Essayer maintenant — sans inscription"
    const demoBtn = page.getByRole('button', { name: /essayer.*sans inscription/i }).first();
    await demoBtn.waitFor({ state: 'visible', timeout: 10_000 });
    await demoBtn.click();

    // 3. Attendre le dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 10_000 });
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/bonjour/i);

    // 4. Skip onboarding — l'overlay est posé 500ms après loginDemo() et
    //    bloque tous les clics (role=dialog aria-modal). On l'attend puis
    //    on le ferme via le bouton X (aria-label="Passer le tutoriel").
    //    Fallback : si l'overlay n'apparaît pas dans 2s, on continue.
    const onboardingDialog = page.locator('[role="dialog"][aria-labelledby="onb-title"]');
    if (await onboardingDialog.isVisible({ timeout: 2500 }).catch(() => false)) {
      // Cliquer le X (aria-label "Passer le tutoriel") — unique au sein du dialog
      await page.getByRole('button', { name: /passer le tutoriel/i }).click();
      // Attendre la fermeture
      await onboardingDialog.waitFor({ state: 'hidden', timeout: 3000 });
    }

    await use(page);
  },
});

export { expect };
