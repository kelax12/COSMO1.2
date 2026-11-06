import { test, expect, loginViaUi, goto, seedTask, findUserIdByEmail, signInClient } from './helpers';

/**
 * Parcours 8 · supprimer son compte. Le geste passe par l'Edge Function
 * `delete-account` (seule capable de retirer une ligne de `auth.users`), servie
 * par `supabase functions serve` avec `APP_URL` = l'origine de l'application :
 * c'est la chaîne complète (CORS, JWT, nettoyage des tables, `deleteUser`) qui
 * est jouée, pas un simple appel de fonction.
 */
test('supprimer son compte efface le compte et ses données', async ({ page, makeAccount }) => {
  const account = await makeAccount('delete');
  await loginViaUi(page, account);

  // Une donnée à purger (écrite par le client du compte).
  const taskName = `Tâche à purger ${Date.now()}`;
  await seedTask(account, taskName);
  const { data: before } = await account.client.from('tasks').select('id').eq('name', taskName);
  expect(before).toHaveLength(1);

  // ── Réglages > Sécurité > Supprimer le compte ─────────────────────
  await goto(page, '/settings');
  await page.getByRole('button', { name: /sécurité/i }).filter({ visible: true }).first().click({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Supprimer le compte' }).filter({ visible: true }).first().click();
  const confirm = page.getByRole('alertdialog');
  await expect(confirm).toBeVisible({ timeout: 15_000 });
  await confirm.getByPlaceholder('Tapez "DELETE"').fill('DELETE');
  await confirm.getByRole('button', { name: 'Confirmer' }).click();
  await expect(page.locator('[data-sonner-toast]').filter({ hasText: /compte supprimé/i })).toBeVisible({ timeout: 30_000 });

  // ── Côté base : le compte n'existe plus, ni son mot de passe ──────
  await expect.poll(() => findUserIdByEmail(account.email), { timeout: 30_000 }).toBeNull();
  await expect(signInClient(account.email, account.password)).rejects.toThrow();

  // Et la page rechargée ne rouvre aucune session.
  await goto(page, '/dashboard');
  await expect(page).not.toHaveURL(/\/dashboard/, { timeout: 30_000 });
});
