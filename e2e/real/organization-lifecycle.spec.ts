import { randomUUID } from 'node:crypto';
import { test, expect, adminClient, loginViaUi, newSession, goto, dismissOrgWelcome, createOrgViaUi, expectNoErrorToast } from './helpers';

/**
 * Parcours 8 et 9 · cycle de vie d'une entreprise contre la vraie base (TST-03).
 *
 *   • Suppression d'organisation : par son propriétaire, depuis la zone de
 *     danger. Un membre simple ne l'atteint pas, et la RPC `delete_organization`
 *     (mig. 138), seule porte vers un DELETE, le refuse même appelée à la main.
 *   • Facturation SANS Stripe : l'état d'abonnement est lu sous la RLS
 *     (`is_org_member`), aucun compte ne peut l'écrire (SELECT seul accordé,
 *     mig. 101), et un abonnement actif interdit la suppression (filet serveur).
 *
 * Le rattachement du membre est posé par `service_role` (préparation de
 * données, jamais une assertion) : l'invitation par lien est jouée à part
 * (`organization.spec.ts`). Aucun appel Stripe : l'abonnement actif est une
 * ligne posée à la main, le webhook n'est pas en jeu.
 */

async function addMember(orgId: string, userId: string): Promise<void> {
  const { error } = await adminClient.from('organization_members').insert({ org_id: orgId, user_id: userId, role: 'member' });
  expect(error, error?.message).toBeNull();
}

test("entreprise : suppression par le propriétaire, refusée au membre", async ({ page, browser, baseURL, makeAccount }) => {
  const owner = await makeAccount('delowner');
  const member = await makeAccount('delmember');
  const orgName = `Entreprise à supprimer ${Date.now()}`;

  const orgId = await createOrgViaUi(page, owner, orgName);
  await addMember(orgId, member.id);

  // ── Le membre : aucune zone de danger, et la RPC le refuse ────────
  const memberPage = await newSession(browser, baseURL);
  try {
    await loginViaUi(memberPage, member);
    await goto(memberPage, '/entreprise/settings');
    await dismissOrgWelcome(memberPage);
    await expect(memberPage.getByRole('heading').first()).toBeVisible({ timeout: 30_000 });
    await memberPage.waitForTimeout(2_000);
    await expect(memberPage.getByRole('button', { name: /supprimer l'entreprise/i })).toHaveCount(0);

    const refused = await member.client.rpc('delete_organization', { p_org: orgId });
    expect(refused.error?.message ?? '').toMatch(/not_org_owner/);
    const { data: stillThere } = await owner.client.from('organizations').select('id').eq('id', orgId);
    expect(stillThere).toHaveLength(1);
  } finally {
    await memberPage.context().close();
  }

  // ── Le propriétaire supprime, par l'interface ─────────────────────
  await goto(page, '/entreprise/settings');
  await dismissOrgWelcome(page);
  await page
    .getByRole('navigation', { name: /rubriques des paramètres/i })
    .getByRole('button', { name: /zone de danger/i })
    .click({ timeout: 30_000 });
  await page.getByRole('button', { name: /supprimer l'entreprise/i }).click();
  const confirm = page.getByRole('button', { name: /supprimer cette entreprise/i });
  await expect(confirm).toBeDisabled();
  await page.locator('#delete-org-confirm').fill(orgName);
  await expect(confirm).toBeEnabled();
  await confirm.click();

  // Relu en base, sous la RLS : l'organisation et le rattachement du membre sont partis.
  await expect
    .poll(async () => (await owner.client.from('organizations').select('id').eq('id', orgId)).data?.length, { timeout: 30_000 })
    .toBe(0);
  const { data: memberships } = await member.client.from('organization_members').select('org_id').eq('org_id', orgId);
  expect(memberships).toHaveLength(0);
  await expectNoErrorToast(page);
});

test("entreprise : état d'abonnement lu sous la RLS, jamais écrit, et garde de suppression", async ({ page, makeAccount }) => {
  const owner = await makeAccount('billowner');
  const member = await makeAccount('billmember');
  const outsider = await makeAccount('billoutsider');
  const orgName = `Entreprise facturée ${Date.now()}`;

  const orgId = await createOrgViaUi(page, owner, orgName);
  await addMember(orgId, member.id);

  // Palier gratuit : aucune ligne d'abonnement.
  const { data: noSub } = await owner.client.from('org_subscriptions').select('org_id').eq('org_id', orgId);
  expect(noSub).toHaveLength(0);

  // Un abonnement actif, posé à la main (aucun Stripe).
  const { error: seedError } = await adminClient.from('org_subscriptions').insert({
    org_id: orgId, tier_key: 't10', max_members: 10, status: 'active', billing_interval: 'monthly',
    current_period_end: new Date(Date.now() + 30 * 86_400_000).toISOString(),
  });
  expect(seedError, seedError?.message).toBeNull();

  // Lecture : propriétaire et membre la voient, un tiers non.
  for (const who of [owner, member]) {
    const { data } = await who.client.from('org_subscriptions').select('tier_key, status').eq('org_id', orgId);
    expect(data).toEqual([{ tier_key: 't10', status: 'active' }]);
  }
  const { data: seenByOutsider } = await outsider.client.from('org_subscriptions').select('org_id').eq('org_id', orgId);
  expect(seenByOutsider).toHaveLength(0);

  // Écriture : aucun compte, pas même le propriétaire, ne peut modifier l'abonnement.
  for (const who of [owner, member]) {
    const upd = await who.client.from('org_subscriptions').update({ tier_key: 'tmax', max_members: null }).eq('org_id', orgId).select();
    expect(upd.error !== null || (upd.data ?? []).length === 0).toBe(true);
    const ins = await who.client.from('org_subscriptions').insert({ org_id: randomUUID(), tier_key: 'tmax', status: 'active' });
    expect(ins.error).not.toBeNull();
  }
  const { data: unchanged } = await adminClient.from('org_subscriptions').select('tier_key').eq('org_id', orgId).single();
  expect(unchanged?.tier_key).toBe('t10');

  // Filet serveur : un abonnement actif interdit la suppression, même par le propriétaire.
  const blocked = await owner.client.rpc('delete_organization', { p_org: orgId });
  expect(blocked.error?.message ?? '').toMatch(/org_has_active_subscription/);
  const { data: stillThere } = await owner.client.from('organizations').select('id').eq('id', orgId);
  expect(stillThere).toHaveLength(1);

  // L'écran d'abonnement charge pour le propriétaire (garde d'accès côté interface).
  await goto(page, '/entreprise/billing');
  await dismissOrgWelcome(page);
  await expect(page.getByText(/abonnement de l'organisation/i).first()).toBeVisible({ timeout: 30_000 });
});
