import {
  test, expect, loginViaUi, seedTask, tasksList, goto, reload, expectNoErrorToast,
} from './helpers';

const TOGGLE_UNCHECKED = '[aria-label="Marquer comme complétée"]';

/**
 * Parcours 2 · creer, modifier, terminer une tache. La CREATION par l'ecran est
 * en `test.fixme` dans `schema-drift.spec.ts` (defaut de base rejouee) : ici la
 * tache est posee par le client du compte, avec une echeance, puis modifiee et
 * terminee par l'interface. Chaque ecriture est RELUE
 * apres un rechargement de page ET par le client authentifie du compte : le
 * cache React Query masquerait sinon une ecriture qui n'a jamais atteint Postgres.
 */
test('créer, modifier puis terminer une tâche', async ({ page, makeAccount }) => {
  const account = await makeAccount('tasks');
  await loginViaUi(page, account);

  const created = `Tâche réelle ${Date.now()}`;
  const renamed = `${created} (modifiée)`;

  // ── Créer (écriture réelle, sous la RLS du compte) ─────────────────
  await seedTask(account, created);
  await goto(page, '/tasks');
  await expect(tasksList(page).getByText(created, { exact: true }).filter({ visible: true }).first())
    .toBeVisible({ timeout: 30_000 });
  {
    const { data, error } = await account.client.from('tasks').select('name, completed').eq('name', created);
    expect(error, error?.message).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].completed).toBe(false);
  }

  // ── Modifier ──────────────────────────────────────────────────────
  await tasksList(page).getByText(created, { exact: true }).filter({ visible: true }).first().click();
  const edit = page.getByRole('dialog', { name: /modifier la tâche/i });
  await expect(edit).toBeVisible({ timeout: 15_000 });
  await edit.locator('#task-name').fill(renamed);
  await edit.getByRole('button', { name: /^sauvegarder$/i }).click();
  await expect(edit).toBeHidden({ timeout: 15_000 });

  await reload(page);
  await expect(tasksList(page).getByText(renamed, { exact: true }).filter({ visible: true }).first())
    .toBeVisible({ timeout: 30_000 });
  await expect(tasksList(page).getByText(created, { exact: true })).toHaveCount(0);
  {
    const { data } = await account.client.from('tasks').select('name').eq('name', renamed);
    expect(data).toHaveLength(1);
  }

  // ── Terminer ──────────────────────────────────────────────────────
  const row = tasksList(page).locator('tr').filter({ hasText: renamed });
  await row.locator(TOGGLE_UNCHECKED).first().click();
  // Terminee, la ligne quitte la liste des taches a faire (ou porte la case cochee).
  await expect(row.locator(TOGGLE_UNCHECKED)).toHaveCount(0, { timeout: 15_000 });

  // La base dit « terminee » avant meme le rechargement...
  await expect.poll(async () => {
    const { data } = await account.client.from('tasks').select('completed').eq('name', renamed);
    return data?.[0]?.completed;
  }, { timeout: 15_000 }).toBe(true);

  // ... et la page rechargee la relit terminee, jamais rouverte.
  await reload(page);
  await expect(tasksList(page)).toBeVisible({ timeout: 30_000 });
  await expect(tasksList(page).locator(TOGGLE_UNCHECKED).filter({ visible: true })).toHaveCount(0);
  await expectNoErrorToast(page);
});
