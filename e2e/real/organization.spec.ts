import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import { test, expect, loginViaUi, newSession, goto, reload, expectNoErrorToast } from './helpers';

/** L'accueil d'un espace entreprise recouvre l'écran à la première visite. */
async function dismissOrgWelcome(page: Page): Promise<void> {
  const welcome = page.getByRole('dialog', { name: /^bienvenue/i });
  if (await welcome.isVisible({ timeout: 8_000 }).catch(() => false)) {
    await welcome.getByRole('button', { name: /^commencer/i }).click();
    await expect(welcome).toBeHidden();
  }
}

/**
 * Parcours 7 · une entreprise de bout en bout : création, invitation d'un
 * membre par lien, tâche d'équipe visible par ce membre et invisible pour un
 * tiers. La visibilité (`can_access_team_project`, `get_my_team_tasks`) est une
 * frontière de RLS : seule une vraie base peut la démentir.
 *
 * Le projet d'équipe est posé en préalable par le même INSERT que l'application
 * (`createProject`, sous la RLS de l'administratrice) ; la création de la tâche
 * d'équipe, elle, passe par l'interface.
 */
test("entreprise : inviter un membre, tâche d'équipe visible par lui seul", async ({ page, browser, baseURL, makeAccount }) => {
  const admin = await makeAccount('orgadmin');
  const member = await makeAccount('orgmember');
  const outsider = await makeAccount('outsider');
  const orgName = `Entreprise réelle ${Date.now()}`;
  const projectName = `Projet réel ${Date.now()}`;
  const taskName = `Tâche d'équipe ${Date.now()}`;

  // ── Création de l'entreprise, par l'interface ─────────────────────
  await loginViaUi(page, admin);
  await goto(page, '/entreprise/onboarding');
  await page.getByRole('button', { name: /créer une entreprise/i }).click({ timeout: 30_000 });
  await page.getByLabel("Nom de l'entreprise").fill(orgName);
  await page.getByRole('button', { name: "Créer l'entreprise" }).click();
  // Facturation active hors démo : l'effectif est demandé, le gratuit suffit ici.
  await page.getByRole('button', { name: /plus tard, commencer en gratuit/i }).click({ timeout: 30_000 });
  await expect(page).toHaveURL(/\/entreprise/, { timeout: 30_000 });
  await dismissOrgWelcome(page);

  // L'entreprise est en base, et l'administratrice en est membre.
  const { data: org, error: orgError } = await admin.client.from('organizations').select('id').eq('name', orgName).single();
  expect(orgError, orgError?.message).toBeNull();
  const orgId = org!.id as string;

  // ── Invitation par lien, générée dans l'interface ─────────────────
  await goto(page, '/entreprise/members');
  await dismissOrgWelcome(page);
  await page.getByRole('main').getByRole('button', { name: /^inviter$/i }).first().click({ timeout: 30_000 });
  const invite = page.getByRole('dialog', { name: /^inviter$/i });
  await expect(invite).toBeVisible({ timeout: 15_000 });
  await invite.getByRole('tab', { name: /^lien$/i }).click();
  await invite.getByRole('button', { name: /^générer un lien$/i }).click();
  const link = await invite.locator('code').first().innerText({ timeout: 15_000 });
  const claimPath = new URL(link).pathname;
  expect(claimPath).toMatch(/^\/org-invite\/[0-9a-f-]{36}$/);

  // ── Le membre ouvre le lien dans SA session et rejoint ────────────
  const memberPage = await newSession(browser, baseURL);
  const outsiderPage = await newSession(browser, baseURL);
  try {
    await loginViaUi(memberPage, member);
    await goto(memberPage, claimPath);
    await memberPage.getByRole('checkbox').check();
    await memberPage.getByRole('button', { name: /^rejoindre l'entreprise$/i }).click();
    await expect(memberPage.getByText(`Vous avez rejoint ${orgName} !`)).toBeVisible({ timeout: 30_000 });

    // Le rattachement est en base, lu sous la RLS du membre.
    const { data: membership } = await member.client.from('organization_members').select('org_id, role').eq('org_id', orgId).eq('user_id', member.id);
    expect(membership).toHaveLength(1);

    // ── Projet (préalable) puis tâche d'équipe, par l'interface ─────
    const { error: projectError } = await admin.client.from('team_projects').insert({
      id: randomUUID(), org_id: orgId, created_by: admin.id, name: projectName, color: 'blue', team_id: null,
    });
    expect(projectError, projectError?.message).toBeNull();

    await goto(page, '/entreprise/tasks');
    await dismissOrgWelcome(page);
    await page.getByRole('button', { name: /nouvelle tâche/i }).filter({ visible: true }).first().click({ timeout: 30_000 });
    const dialog = page.getByRole('dialog', { name: /nouvelle tâche d'équipe/i });
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await dialog.locator('#team-task-name').fill(taskName);
    const projectField = dialog.locator('#team-task-project');
    if (/choisir un projet/i.test((await projectField.innerText()) ?? '')) {
      await projectField.click();
      await page.getByRole('menuitem', { name: projectName }).click();
    }
    await dialog.getByRole('button', { name: /^créer la tâche$/i }).click();
    await expect(dialog).toBeHidden({ timeout: 15_000 });

    await reload(page);
    await expect(page.getByText(taskName).first()).toBeVisible({ timeout: 30_000 });
    await expectNoErrorToast(page);

    // ── Le membre la voit (interface ET base) ───────────────────────
    await goto(memberPage, '/entreprise/tasks');
    await dismissOrgWelcome(memberPage);
    await expect(memberPage.getByText(taskName).first()).toBeVisible({ timeout: 30_000 });
    const { data: seenByMember } = await member.client.from('team_tasks').select('name').eq('name', taskName);
    expect(seenByMember).toHaveLength(1);

    // ── Le tiers (hors entreprise) ne la voit NULLE PART ────────────
    await loginViaUi(outsiderPage, outsider);
    await goto(outsiderPage, '/entreprise/tasks');
    await expect(outsiderPage.getByRole('heading').first()).toBeVisible({ timeout: 30_000 });
    await outsiderPage.waitForTimeout(2_000);
    await expect(outsiderPage.getByText(taskName)).toHaveCount(0);
    const { data: seenByOutsider, error: outsiderError } = await outsider.client.from('team_tasks').select('name').eq('name', taskName);
    expect(outsiderError, outsiderError?.message).toBeNull();
    expect(seenByOutsider).toHaveLength(0);
    const { data: orgsOfOutsider } = await outsider.client.from('organizations').select('id').eq('id', orgId);
    expect(orgsOfOutsider).toHaveLength(0);
  } finally {
    await memberPage.context().close();
    await outsiderPage.context().close();
  }
});
