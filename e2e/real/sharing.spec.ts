import {
  test, expect, loginViaUi, createTaskViaUi, tasksList, newSession, goto, reload, expectNoErrorToast,
} from './helpers';

/**
 * Parcours 6 · partager une tâche entre deux comptes.
 *
 * La RLS de `shared_tasks` (mig. 036) et `get_my_tasks()` (mig. 103 : une
 * tâche partagée n'apparaît chez le destinataire qu'APRÈS son acceptation) ne
 * se prouvent qu'avec deux vrais comptes. L'amitié est posée par les mêmes
 * appels que l'application (`friend_requests` puis `accept_friend_request_v2`),
 * en préalable : le geste testé est le PARTAGE, par l'interface.
 */
test('partager une tâche entre deux comptes', async ({ page, browser, baseURL, makeAccount }) => {
  const alice = await makeAccount('alice');
  const bob = await makeAccount('bob');

  // ── Préalable : Alice et Bob sont amis (appels réels du module friends) ──
  const { data: request, error: reqError } = await alice.client
    .from('friend_requests')
    .insert([{ email: bob.email, status: 'pending', sent_at: new Date().toISOString(), sender_id: alice.id }])
    .select()
    .single();
  expect(reqError, reqError?.message).toBeNull();
  const { error: acceptError } = await bob.client.rpc('accept_friend_request_v2', { request_id: request!.id });
  expect(acceptError, acceptError?.message).toBeNull();

  // ── Alice crée une tâche et la partage avec Bob, par l'interface ─────────
  await loginViaUi(page, alice);
  const taskName = `Tâche partagée ${Date.now()}`;
  await createTaskViaUi(page, taskName);
  await reload(page);
  await tasksList(page).getByText(taskName, { exact: true }).filter({ visible: true }).first().click();
  const modal = page.getByRole('dialog', { name: /modifier la tâche/i });
  await expect(modal).toBeVisible({ timeout: 15_000 });
  await modal.getByRole('tab', { name: /^partager/i }).click();
  await modal.getByText(bob.name).filter({ visible: true }).first().click();
  await modal.getByRole('button', { name: /^(sauvegarder|enregistrer)$/i }).click();
  await expect(modal).toBeHidden({ timeout: 15_000 });

  // Le partage est en base, lu sous la RLS de la propriétaire.
  await expect.poll(async () => {
    const { data } = await alice.client.from('shared_tasks').select('friend_id').eq('friend_id', bob.id);
    return data?.length ?? 0;
  }, { timeout: 15_000, message: 'aucune ligne shared_tasks pour Bob' }).toBe(1);

  // Rechargée, la tâche d'Alice porte toujours son partage.
  await reload(page);
  await tasksList(page).getByText(taskName, { exact: true }).filter({ visible: true }).first().click();
  await expect(
    page.getByRole('dialog', { name: /modifier la tâche/i }).getByRole('tab', { name: /^partager \(1\)/i }),
  ).toBeVisible({ timeout: 15_000 });
  await expectNoErrorToast(page);

  // ── Bob : la tâche attend dans sa boîte de réception, puis il l'accepte ──
  const bobPage = await newSession(browser, baseURL);
  try {
    await loginViaUi(bobPage, bob);
    await goto(bobPage, '/tasks');
    // Avant acceptation, la tâche N'EST PAS dans sa liste (mig. 103).
    await expect(tasksList(bobPage)).toBeVisible({ timeout: 30_000 });
    await expect(bobPage.getByText(taskName, { exact: true })).toHaveCount(0);

    await bobPage.getByRole('button', { name: /boîte de réception/i }).filter({ visible: true }).first().click();
    await bobPage.getByRole('button', { name: `Accepter la tâche partagée ${taskName}` }).click();

    await expect(tasksList(bobPage).getByText(taskName, { exact: true }).filter({ visible: true }).first())
      .toBeVisible({ timeout: 30_000 });

    // Rechargée, la tâche acceptée est relue depuis la base.
    await reload(bobPage);
    await expect(tasksList(bobPage).getByText(taskName, { exact: true }).filter({ visible: true }).first())
      .toBeVisible({ timeout: 30_000 });
    const { data: mine } = await bob.client.rpc('get_my_tasks');
    expect((mine as Array<{ name: string }>).map((t) => t.name)).toContain(taskName);
  } finally {
    await bobPage.context().close();
  }
});
