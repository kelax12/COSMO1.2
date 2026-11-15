import { test, expect, loginViaUi, goto, reload, escapeRe, expectNoErrorToast } from './helpers';

/**
 * Parcours 3 · cocher une habitude. La coche vit dans `habit_completions` (une
 * ligne par jour coche, mig. 248, DAT-02) cote serveur : c'est la forme exacte de
 * ce que la demo ne rejoue pas (cles de date locales, lecture par la RPC
 * `get_my_habits`).
 */
test('cocher une habitude, relue après rechargement', async ({ page, makeAccount }) => {
  const account = await makeAccount('habits');
  await loginViaUi(page, account);

  const name = `Habitude réelle ${Date.now()}`;
  await goto(page, '/habits');

  // ── Créer l'habitude ──────────────────────────────────────────────
  await page
    .getByRole('button', { name: /^(nouvelle( habitude)?|créer une habitude)$/i })
    .filter({ visible: true })
    .first()
    .click({ timeout: 30_000 });
  await page.getByPlaceholder(/lire 30 minutes/i).filter({ visible: true }).first().fill(name);
  await page.getByRole('button', { name: "Créer l'habitude" }).filter({ visible: true }).first().click();

  // Les cases de la semaine : « <nom>, <date> » (role checkbox), futures desactivees.
  const cells = page.getByRole('checkbox', { name: new RegExp(`^${escapeRe(name)}, `) });
  const todayCell = () => cells.and(page.locator(':not([disabled])')).last();
  await expect(todayCell()).toBeVisible({ timeout: 30_000 });

  // Rechargée, l'habitude existe encore : elle a ete ecrite en base.
  await reload(page);
  await expect(todayCell()).toBeVisible({ timeout: 30_000 });
  await expect(todayCell()).toHaveAttribute('aria-checked', 'false');

  // ── Cocher aujourd'hui ────────────────────────────────────────────
  await todayCell().click();
  await expect(todayCell()).toHaveAttribute('aria-checked', 'true', { timeout: 15_000 });
  await expect.poll(async () => {
    const { data: habit } = await account.client.from('habits').select('id').eq('name', name);
    const habitId = habit?.[0]?.id;
    if (!habitId) return 0;
    const { data } = await account.client.from('habit_completions').select('day').eq('habit_id', habitId);
    return data?.length ?? 0;
  }, { timeout: 15_000, message: 'aucune ligne ecrite dans habit_completions' }).toBeGreaterThan(0);

  // ── Rechargement : la coche est relue depuis la base ──────────────
  await reload(page);
  await expect(todayCell()).toBeVisible({ timeout: 30_000 });
  await expect(todayCell()).toHaveAttribute('aria-checked', 'true');
  await expectNoErrorToast(page);
});
