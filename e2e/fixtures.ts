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

    // 4. Skip onboarding général + tutoriels par page
    //    L'overlay onboarding est posé 500ms après loginDemo() et bloque
    //    tous les clics. Les tutoriels page (Tasks/Habits/OKR/Agenda) se
    //    déclenchent à l'arrivée sur leur page respective.
    //    On marque tout comme "vu" dans localStorage pour neutraliser.
    await page.evaluate(() => {
      try {
        localStorage.removeItem('cosmo_onboarding_pending');
        // Désormais 2 flags par page (desktop + mobile) — neutraliser les deux
        for (const page of ['tasks', 'agenda', 'habits', 'okr']) {
          localStorage.setItem(`cosmo_tutorial_seen_${page}_desktop`, '1');
          localStorage.setItem(`cosmo_tutorial_seen_${page}_mobile`, '1');
          // Ancien flag (rétro-compat avec versions précédentes)
          localStorage.setItem(`cosmo_tutorial_seen_${page}`, '1');
        }
      } catch { /* ignore */ }
    });

    // Si l'onboarding overlay est déjà visible (apparu pendant les 500ms),
    // on le ferme explicitement
    const onboardingDialog = page.locator('[role="dialog"][aria-labelledby="onb-title"]');
    if (await onboardingDialog.isVisible({ timeout: 1500 }).catch(() => false)) {
      await page.getByRole('button', { name: /passer le tutoriel/i }).click();
      await onboardingDialog.waitFor({ state: 'hidden', timeout: 3000 });
    }

    await use(page);
  },
});

export { expect };
