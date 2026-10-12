import { test, expect, navTo } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * Guide entreprise (mode démo, org « Nova Studio ») : une démo ouvre le
 * formulaire VIDE et n'écrit rien. Desktop uniquement : le bouton flottant
 * n'est pas rendu sous 768 px, le cas est donc sauté sur les projects mobiles.
 */

// Clés `cosmo_*` qui changent légitimement pendant le parcours, exclues NOMMÉMENT :
// - `cosmo_org_guide_seen` : le premier clic sur le bouton flottant pose ce drapeau, c'est voulu.
// - `cosmo_last_visited_page` : la démo navigue vers `/entreprise/teams` pour ouvrir le
//   formulaire, et cette clé mémorise la dernière route visitée. Ce n'est pas une donnée.
const IGNORED_KEYS = new Set(['cosmo_org_guide_seen', 'cosmo_last_visited_page']);

async function snapshotCosmoStorage(page: Page): Promise<Record<string, string>> {
  return page.evaluate((ignored) => {
    return Object.fromEntries(
      Object.entries(localStorage).filter(([k]) => k.startsWith('cosmo_') && !ignored.includes(k)),
    );
  }, [...IGNORED_KEYS]);
}

test.describe('Guide entreprise (démo)', () => {
  test.describe.configure({ timeout: 120_000 });

  test('une démo ouvre le formulaire sans rien écrire', async ({ demoPage: page, viewport }) => {
    test.skip((viewport?.width ?? 0) < 768, 'guide entreprise : desktop uniquement');

    await navTo(page, /entreprise/i, /\/entreprise/);
    await expect(page.getByRole('heading', { name: /nova studio/i })).toBeVisible({ timeout: 15_000 });

    const before = await snapshotCosmoStorage(page);

    await page.getByRole('button', { name: /ouvrir le guide entreprise/i }).click();
    await page.getByRole('button', { name: /^créer une équipe$/i }).click();
    await expect(page.locator('[data-guide-id="team-form-name"]')).toBeVisible({ timeout: 10_000 });

    await page.keyboard.press('Escape');
    await expect(page.getByRole('toolbar')).toHaveCount(0);

    expect(await snapshotCosmoStorage(page)).toEqual(before);
    expect(await page.evaluate(() => localStorage.getItem('cosmo_org_guide_seen'))).not.toBeNull();
  });
});
