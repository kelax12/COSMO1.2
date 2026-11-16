import { test, expect, loginViaUi, goto, reload, expectNoErrorToast } from './helpers';

/**
 * Heure de Paris passée 20:00, `findNextFreeSlot` ne trouve plus une heure
 * libre avant 22:00 et propose demain 9:00 : hors de la vue rechargée (lundi,
 * un dimanche soir). L'horloge du navigateur recule alors à midi le même jour.
 * Elle ne fait que reculer : un jeton émis par le serveur n'expire jamais
 * côté client avant son heure.
 */
function heureDuParcours(now = new Date()): Date | null {
  const heure = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', hourCycle: 'h23' }).format(now),
  );
  return heure < 20 ? null : new Date(now.getTime() - (heure - 12) * 3_600_000);
}

/**
 * Parcours 4 · créer un événement d'agenda. La modale se pré-remplit sur le
 * prochain créneau libre ; on ne touche qu'au titre et on valide.
 */
test("créer un événement d'agenda, relu après rechargement", async ({ page, makeAccount }) => {
  const midi = heureDuParcours();
  if (midi) await page.clock.install({ time: midi });
  const account = await makeAccount('agenda');
  await loginViaUi(page, account);

  const title = `Événement réel ${Date.now()}`;
  await goto(page, '/agenda');
  await page.getByRole('button', { name: /^nouveau$/i }).filter({ visible: true }).first().click({ timeout: 30_000 });

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await dialog.getByPlaceholder("nom de l'événement").fill(title);
  await dialog.getByRole('button', { name: /^valider$/i }).click();
  await expect(dialog).toBeHidden({ timeout: 15_000 });

  // L'écriture a atteint la table `events` (lue sous la RLS du compte)...
  await expect.poll(async () => {
    const { data } = await account.client.from('events').select('title').eq('title', title);
    return data?.length ?? 0;
  }, { timeout: 15_000, message: 'aucun evenement ecrit dans la table events' }).toBe(1);

  // ... et l'agenda rechargé le peint, sans passer par le cache.
  await reload(page);
  await expect(page.getByText(title).first()).toBeAttached({ timeout: 30_000 });
  await expectNoErrorToast(page);
});
