import { test, expect, navTo } from './fixtures';

/**
 * Section « Langue » des Réglages.
 *
 * Elle vit dans l'onglet Apparence mais comme SECTION à part entière, et non
 * comme une ligne de la carte « Thème » : la langue n'est pas un réglage
 * d'apparence, et elle y était introuvable.
 *
 * ⚠️ Ces tests ne présument JAMAIS de la langue de départ. Playwright lance
 * Chromium en `en-US`, donc la détection automatique ouvre l'app en anglais —
 * un test écrit « en français » passerait sur la machine d'Axel et échouerait
 * en CI. On lit la langue courante et on bascule vers l'autre.
 */

/** Ouvre Réglages › Apparence. */
async function openAppearanceTab(page: import('@playwright/test').Page) {
  await navTo(page, /param(è|e)tres|settings/i, /\/settings/);
  await page
    .getByRole('button', { name: /apparence|appearance/i })
    .filter({ visible: true })
    .first()
    .click();
}

test('Réglages : la langue a sa propre section, distincte du thème', async ({ demoPage: page }) => {
  await openAppearanceTab(page);

  // Titre de section propre — un `heading`, et non une ligne perdue dans la
  // carte « Thème ». C'est tout l'objet du changement.
  await expect(
    page.getByRole('heading', { name: /^(langue|language)$/i })
  ).toBeVisible({ timeout: 10_000 });

  const group = page.getByRole('radiogroup', { name: /langue|language/i });
  await expect(group).toBeVisible();

  // Une option par langue servie, et exactement une active.
  expect(await group.getByRole('radio').count()).toBeGreaterThan(1);
  await expect(group.getByRole('radio', { checked: true })).toHaveCount(1);
});

test('Réglages : changer de langue recharge la page sur l’URL équivalente', async ({ demoPage: page }) => {
  await openAppearanceTab(page);

  const group = page.getByRole('radiogroup', { name: /langue|language/i });
  await expect(group).toBeVisible({ timeout: 10_000 });

  const current = await page.locator('html').getAttribute('lang');
  const target = current === 'fr' ? 'en' : 'fr';

  // `[lang="…"]` : sélecteur stable, indépendant du libellé affiché.
  await group.locator(`[lang="${target}"]`).click();

  // Contrat de `localeSwitchTarget` : `basename` étant figé au montage du
  // routeur, la bascule DOIT passer par un vrai chargement de page, vers
  // l'équivalent préfixé (ou dé-préfixé pour la locale par défaut).
  const expectedUrl = target === 'fr' ? /\/settings$/ : new RegExp(`/${target}/settings$`);
  await page.waitForURL(expectedUrl, { timeout: 15_000 });
  await expect(page.locator('html')).toHaveAttribute('lang', target);

  // La préférence survit au rechargement.
  //
  // Régression réelle attrapée par ce test : `clearDemoStorage()` balaye toutes
  // les clés `cosmo_*`, et `cosmo_locale` en fait partie — entrer en démo
  // effaçait donc la langue choisie. La clé est désormais dans PRESERVE_KEYS.
  expect(await page.evaluate(() => localStorage.getItem('cosmo_locale'))).toBe(target);
});
