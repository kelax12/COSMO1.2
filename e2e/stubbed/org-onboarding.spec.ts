import { test, expect } from '@playwright/test';
import { gotoStubbed, installSupabaseStub, STUB_USER_ID } from '../supabase-stub';

/**
 * ═══════════════════════════════════════════════════════════════════
 * Accueil entreprise (2026-10-03) : le parcours, pas seulement les unités
 * ═══════════════════════════════════════════════════════════════════
 *
 * Même raison d'être que `first-run.spec.ts` : ces écrans ne s'ouvrent que
 * HORS mode démo (la mise en place suppose une vraie entreprise, l'accueil
 * membre se garde de la démo), donc aucune spec de la suite démo ne peut les
 * atteindre.
 *
 * Ce que ces cas vérifient, et que les unités ne pouvaient pas vérifier :
 *  • que chaque étape de la mise en place ÉCRIT au moment où elle est validée,
 *    mesuré sur les requêtes réellement parties (invitations, équipe, projet
 *    depuis un modèle, objectif d'entreprise) ;
 *  • que la fin mène à l'espace entreprise SANS l'accueil membre (la personne
 *    vient de tout poser) ;
 *  • qu'un membre arrivé par invitation est accueilli UNE fois, et pas à la
 *    visite suivante.
 *
 * ⚠️ Rien ici ne prouve le serveur (RLS, triggers) : cf. l'en-tête de
 * `e2e/supabase-stub.ts`.
 */

const ORG = {
  id: 'org-onb-1',
  name: 'Nova Studio',
  join_code: 'COSMO-7KQ2M9XA4B',
  owner_id: STUB_USER_ID,
  created_at: '2026-10-03T08:00:00Z',
};
const MEMBER_WELCOME = /bienvenue dans l'espace entreprise/i;

test.describe('accueil entreprise (EnterpriseOnboarding + MemberWelcome)', () => {
  test('la mise en place écrit à chaque étape, puis ouvre l espace sans accueil membre', async ({ page }) => {
    const stub = await installSupabaseStub(page);
    stub.reply('rpc/get_my_org_inbox', {});
    stub.reply('organization_members', [{ role: 'admin', organizations: ORG }]);
    stub.reply('rpc/create_org_email_invitations', [
      { email: 'marie@nova.fr', token: 't1', status: 'created' },
      { email: 'paul@nova.fr', token: 't2', status: 'created' },
    ]);
    stub.reply('functions/v1/send-org-invite', { sent: 2, failed: 0 });

    await gotoStubbed(page, `/entreprise/onboarding?setup=${ORG.id}`, page.getByLabel(/adresses e-mail/i));

    // ── Invitations ──
    await page.getByLabel(/adresses e-mail/i).fill('marie@nova.fr, paul@nova.fr');
    await page.getByRole('button', { name: /envoyer les 2 invitations/i }).click();
    await expect(page.getByRole('status').filter({ hasText: /2 invitations envoyées/i })).toBeVisible();
    const invites = stub.writesTo('rpc/create_org_email_invitations');
    expect(invites).toHaveLength(1);
    expect(JSON.stringify(invites[0].body)).toContain('marie@nova.fr');
    await page.getByRole('button', { name: /^continuer/i }).click();

    // ── Équipe ──
    await page.getByLabel(/nom de la première équipe/i).fill('Produit');
    await page.getByRole('button', { name: /créer l'équipe/i }).click();
    await expect.poll(() => stub.writesTo('org_teams').length, { timeout: 30_000 }).toBe(1);

    // ── Projet, depuis un modèle ──
    await page.getByRole('radio', { name: /sprint/i }).check();
    await page.getByRole('button', { name: /créer le projet/i }).click();
    await expect
      .poll(() => stub.writesTo('rpc/create_team_project_with_tasks').length, { timeout: 30_000 })
      .toBe(1);

    // ── Cap : un objectif d'entreprise ──
    await page.getByLabel(/objectif de l'entreprise/i).fill('Devenir la référence');
    await page.getByLabel(/^résultat clé/i).fill('Signer de nouveaux clients');
    await page.getByRole('button', { name: /fixer le cap/i }).click();
    await expect.poll(() => stub.writesTo('team_okrs').length, { timeout: 30_000 }).toBe(1);

    // ── Fin ──
    await expect(page.getByText(/cap fixé : « devenir la référence »/i)).toBeVisible();
    await page.getByRole('button', { name: /ouvrir l'espace entreprise/i }).click();
    await expect(page).toHaveURL(/\/entreprise$/);
    // Qui vient de tout mettre en place n'a pas besoin de la visite des lieux.
    await page.waitForTimeout(1_500);
    await expect(page.getByRole('dialog', { name: MEMBER_WELCOME })).toHaveCount(0);
  });

  test('un membre est accueilli une fois dans l espace entreprise, pas à la visite suivante', async ({ page }) => {
    const stub = await installSupabaseStub(page);
    stub.reply('rpc/get_my_org_inbox', {});
    stub.reply('organization_members', [{ role: 'member', organizations: ORG }]);

    await gotoStubbed(page, '/entreprise', page.getByRole('dialog', { name: MEMBER_WELCOME }));
    await expect(page.getByRole('list', { name: /les lieux à connaître/i })).toBeVisible();
    // Focus d'entrée sur l'action, pas sur la croix : Entrée valide l'accueil.
    await expect(page.getByRole('button', { name: /c'est parti/i })).toBeFocused();
    // Échap emprunte le même chemin que « C'est parti » : l'accueil est vu.
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: MEMBER_WELCOME })).toBeHidden();

    await page.reload({ waitUntil: 'commit' });
    await expect(page.getByRole('heading', { name: 'Nova Studio' }).first()).toBeVisible({ timeout: 60_000 });
    await page.waitForTimeout(1_500);
    await expect(page.getByRole('dialog', { name: MEMBER_WELCOME })).toHaveCount(0);
  });

  test('l accueil membre ne s ouvre pas par-dessus un lien profond', async ({ page }) => {
    const stub = await installSupabaseStub(page);
    stub.reply('rpc/get_my_org_inbox', {});
    stub.reply('organization_members', [{ role: 'member', organizations: ORG }]);

    await gotoStubbed(page, '/entreprise/tasks?task=stub-task-1', page.getByRole('heading', { name: 'Nova Studio' }));
    await page.waitForTimeout(1_500);
    await expect(page.getByRole('dialog', { name: MEMBER_WELCOME })).toHaveCount(0);
  });
});
