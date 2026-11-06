import { test, expect, loginViaUi, goto, reload, expectNoErrorToast } from './helpers';

/**
 * Parcours 5 · créer un OKR et faire progresser un résultat clé. C'est le
 * parcours où C-77 (`okrTime` à 0 en production pendant 17 jours, juste en
 * démo) aurait été attrapé : le résultat clé vit dans une table à part en base,
 * il se relit après rechargement, jamais depuis un état local.
 */
test('créer un OKR et faire progresser un résultat clé', async ({ page, makeAccount }) => {
  const account = await makeAccount('okr');
  await loginViaUi(page, account);

  const objective = `Objectif réel ${Date.now()}`;
  const keyResult = `Résultat clé ${Date.now()}`;
  await goto(page, '/okr');

  // ── Créer l'objectif et son résultat clé (un est déjà présent) ────
  await page
    .getByRole('button', { name: /^(créer un nouvel objectif|créer un okr)$/i })
    .filter({ visible: true })
    .first()
    .click({ timeout: 30_000 });
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await dialog.locator('#okr-title').fill(objective);
  await dialog.getByPlaceholder('Résultat clé mesurable').filter({ visible: true }).first().fill(keyResult);
  await dialog.getByRole('button', { name: 'Créer', exact: true }).filter({ visible: true }).first().click();
  await expect(dialog).toBeHidden({ timeout: 15_000 });

  // ── Rechargement : l'objectif et son résultat clé viennent de la base ──
  await reload(page);
  await expect(page.getByText(objective).filter({ visible: true }).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(keyResult).filter({ visible: true }).first()).toBeVisible();

  // ── Faire progresser le résultat clé : deux crans ────────────────
  const plus = page.getByRole('button', { name: `Augmenter ${keyResult}` }).filter({ visible: true }).first();
  const progress = page.getByRole('spinbutton', { name: `Avancement de ${keyResult} sur 100` }).filter({ visible: true }).first();
  await expect(progress).toHaveValue('0');
  await plus.click();
  await expect(progress).toHaveValue('1');
  await plus.click();
  await expect(progress).toHaveValue('2');

  await expect.poll(async () => {
    const { data } = await account.client.from('key_results').select('current_value').eq('title', keyResult);
    return data?.[0]?.current_value;
  }, { timeout: 15_000, message: 'key_results.current_value n\'a pas atteint la base' }).toBe(2);

  // ── Rechargement : la progression est relue, pas rejouée ──────────
  await reload(page);
  await expect(
    page.getByRole('spinbutton', { name: `Avancement de ${keyResult} sur 100` }).filter({ visible: true }).first(),
  ).toHaveValue('2', { timeout: 30_000 });
  await expectNoErrorToast(page);
});
