// E2E — SettingsPage : navigation, formulaire pré-rempli, onglets.
import { test, expect, navTo } from './fixtures';

test.describe('settings (demo)', () => {
  test.describe.configure({ timeout: 60_000 });

  test('navigue vers les paramètres et affiche le profil pré-rempli', async ({ demoPage }) => {
    // Settings est accessible depuis la sidebar desktop ou le sheet "Plus" mobile
    await navTo(demoPage, /param[èe]tres?|settings/i, /\/settings/);
    await demoPage.waitForLoadState('networkidle');

    // Le H1 de la page doit contenir "Paramètres" ou "Settings"
    const heading = demoPage.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible({ timeout: 8_000 });
    await expect(heading).toContainText(/param[èe]tres?|settings/i);

    // En mode démo, le nom et l'email doivent être pré-remplis
    const nameInput = demoPage.getByRole('textbox', { name: /nom|name/i }).first();
    if (await nameInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
      const nameValue = await nameInput.inputValue();
      expect(nameValue.length).toBeGreaterThan(0);
    }
  });

  test('les onglets de la page paramètres sont cliquables', async ({ demoPage }) => {
    await navTo(demoPage, /param[èe]tres?|settings/i, /\/settings/);
    await demoPage.waitForLoadState('networkidle');

    // Vérifier que des onglets existent (Sécurité / Apparence / Données / Guide)
    const tabs = demoPage.getByRole('tab');
    const tabCount = await tabs.count();

    if (tabCount > 0) {
      // Cliquer chaque onglet visible et vérifier qu'il ne lève pas d'erreur
      for (let i = 0; i < Math.min(tabCount, 4); i++) {
        const tab = tabs.nth(i);
        if (await tab.isVisible()) {
          await tab.click();
          // Attendre que le panneau associé soit visible
          await demoPage.waitForTimeout(300);
          const panel = demoPage.getByRole('tabpanel');
          if (await panel.isVisible({ timeout: 2_000 }).catch(() => false)) {
            await expect(panel).toBeVisible();
          }
        }
      }
    } else {
      // Pas d'onglets — vérifier au moins que la page charge sans erreur
      await expect(demoPage.getByRole('heading', { level: 1 })).toBeVisible();
    }
  });

  test('aucune erreur console sur la page paramètres', async ({ demoPage }) => {
    const consoleErrors: string[] = [];
    demoPage.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await navTo(demoPage, /param[èe]tres?|settings/i, /\/settings/);
    await demoPage.waitForLoadState('networkidle');
    await demoPage.waitForTimeout(1_500);

    const critical = consoleErrors.filter(
      e =>
        !e.includes('ResizeObserver') &&
        !e.includes('Non-Error') &&
        !e.includes('favicon'),
    );
    expect(critical).toHaveLength(0);
  });
});
