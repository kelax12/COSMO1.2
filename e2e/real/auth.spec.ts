import {
  test, expect, freshCredentials, findUserIdByEmail, signInClient, newSession, loginViaUi, goto, reload,
} from './helpers';

/**
 * Parcours 1 · inscription puis connexion par e-mail, contre la vraie base.
 *
 * Ce que la demo et le stub ne peuvent pas dire : que `auth.signUp` cree
 * VRAIMENT un compte GoTrue, que le trigger de profil a tourne, et qu'une
 * session neuve (autre navigateur, aucun stockage) ouvre ce meme compte avec
 * le mot de passe choisi a l'inscription.
 */
test('inscription puis connexion par e-mail', async ({ page, browser, baseURL, trackAccount }) => {
  const who = freshCredentials('signup');

  // ── Inscription par l'ecran, comme une personne ──────────────────
  await goto(page, '/signup');
  await page.locator('#auth-name').fill(who.name);
  await page.locator('#auth-email').fill(who.email);
  await page.locator('#auth-password').fill(who.password);
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/bonjour/i, { timeout: 30_000 });

  // Le compte existe vraiment dans la base (et sera supprime en fin de cas).
  const id = await findUserIdByEmail(who.email);
  expect(id, 'aucun compte cree par l\'inscription').not.toBeNull();
  trackAccount(id!);

  // La session survit a un rechargement (jeton persiste, relu par getSession).
  await reload(page);
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/bonjour/i, { timeout: 30_000 });

  // ── Connexion dans une session NEUVE (aucun stockage partage) ────
  const second = await newSession(browser, baseURL);
  try {
    await loginViaUi(second, who);
    await reload(second);
    await expect(second).toHaveURL(/\/dashboard/);
    await expect(second.getByRole('heading', { level: 1 })).toContainText(/bonjour/i, { timeout: 30_000 });
  } finally {
    await second.context().close();
  }

  // Le trigger d'inscription a cree le profil : lu par le client DU compte (RLS).
  const client = await signInClient(who.email, who.password);
  const { data: profile, error } = await client.from('profiles').select('id').eq('id', id!).maybeSingle();
  expect(error, error?.message).toBeNull();
  expect(profile?.id).toBe(id);
});

test('un mauvais mot de passe est refuse par la vraie base', async ({ page, makeAccount }) => {
  const account = await makeAccount('badpw');
  await goto(page, '/login');
  await page.locator('#auth-email').fill(account.email);
  await page.locator('#auth-password').fill(`${account.password}-faux`);
  await page.locator('form button[type="submit"]').click();
  await expect(page.getByRole('alert')).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/\/login/);
});
