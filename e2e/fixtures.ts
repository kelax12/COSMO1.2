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
  demoPage: async ({ page }, use) => {
    await page.goto('/');
    // Le CTA principal sur LandingPage (post-quick-wins) est la démo
    await page.getByRole('button', { name: /essayer maintenant/i }).click();
    // Attendre le dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 10_000 });
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/bonjour/i);
    // Skip onboarding s'il s'affiche
    const skipBtn = page.getByRole('button', { name: /passer|^x$/i }).first();
    if (await skipBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await skipBtn.click();
    }
    await use(page);
  },
});

export { expect };
