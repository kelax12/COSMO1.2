// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStorageOrganizationsRepository, DEMO_ORG_ID } from './local.repository';
import {
  ORGS_STORAGE_KEY,
  ORG_MEMBERS_STORAGE_KEY,
  ORG_JOIN_REQUESTS_STORAGE_KEY,
} from './constants';

const SECOND_ORG_ID = 'org-test-second';
const DAY = 24 * 60 * 60 * 1000;

/**
 * Seconde organisation où l'utilisateur démo est MEMBRE SIMPLE, sous Nina.
 *
 * Elle était seedée par le produit (« Atelier Lune ») jusqu'au 2026-08-27.
 * Elle en a été retirée : au-delà d'une organisation, `Layout` remplace le lien
 * de navigation par un menu, et la démo perdait le clic milieu et l'ouverture
 * en nouvel onglet pour montrer un switcher dont personne n'avait besoin.
 *
 * 🔴 Elle est reconstituée ICI parce que TOUTE la couverture des refus
 * non-admin en dépendait. La retirer des seeds sans la remettre dans les tests
 * aurait supprimé, en silence, la seule preuve qu'un membre simple ne peut ni
 * renommer l'organisation, ni régénérer son code, ni créer un lien
 * d'invitation, ni déplacer quelqu'un dans la pyramide.
 */
async function seedSecondOrg(repo: LocalStorageOrganizationsRepository) {
  // Force le seed initial : le repository ne l'écrit qu'à la première lecture.
  await repo.getMyOrganizations();
  const orgs = JSON.parse(localStorage.getItem(ORGS_STORAGE_KEY) ?? '[]');
  const members = JSON.parse(localStorage.getItem(ORG_MEMBERS_STORAGE_KEY) ?? '[]');
  orgs.push({
    id: SECOND_ORG_ID,
    name: 'Atelier Lune',
    joinCode: 'COSMO-LUNE77',
    ownerId: 'user-nina',
    createdAt: new Date(Date.now() - 45 * DAY).toISOString(),
    description: 'Collectif d\'artisans céramistes.',
    industry: 'Artisanat',
  });
  const joinedAt = new Date(Date.now() - 20 * DAY).toISOString();
  members.push(
    { orgId: SECOND_ORG_ID, userId: 'user-nina', role: 'admin', managerId: null, joinedAt, displayName: 'Nina Rousseau', email: 'nina.rousseau@email.com' },
    { orgId: SECOND_ORG_ID, userId: 'demo-user', role: 'member', managerId: 'user-nina', joinedAt, displayName: 'Vous', email: 'demo@cosmo.app' },
    { orgId: SECOND_ORG_ID, userId: 'user-theo', role: 'member', managerId: 'user-nina', joinedAt, displayName: 'Théo Garnier', email: 'theo.garnier@email.com' },
  );
  localStorage.setItem(ORGS_STORAGE_KEY, JSON.stringify(orgs));
  localStorage.setItem(ORG_MEMBERS_STORAGE_KEY, JSON.stringify(members));
}

describe('LocalStorageOrganizationsRepository (démo, multi-org v2)', () => {
  let repo: LocalStorageOrganizationsRepository;

  beforeEach(() => {
    localStorage.clear();
    repo = new LocalStorageOrganizationsRepository();
  });

  it('seede UNE SEULE entreprise : Nova Studio, où l\'utilisateur démo est admin', async () => {
    const orgs = await repo.getMyOrganizations();
    expect(orgs.length).toBe(1);
    const nova = orgs[0];
    expect(nova.id).toBe(DEMO_ORG_ID);
    expect(nova.name).toBe('Nova Studio');
    expect(nova.myRole).toBe('admin');
    expect(nova.joinCode).toBe('COSMO-DEMO42');
    expect(nova.industry).toBe('Design & Tech');
  });

  it('ne seede plus « Atelier Lune » (retirée le 2026-08-27)', async () => {
    const orgs = await repo.getMyOrganizations();
    expect(orgs.some((o) => o.name === 'Atelier Lune')).toBe(false);
    const members = JSON.parse(localStorage.getItem(ORG_MEMBERS_STORAGE_KEY) ?? '[]');
    expect(members.every((m: { orgId: string }) => m.orgId === DEMO_ORG_ID)).toBe(true);
  });

  it("retourne l'annuaire par organisation (pas de fuite entre orgs)", async () => {
    await seedSecondOrg(repo);
    const novaMembers = await repo.getMembers(DEMO_ORG_ID);
    const luneMembers = await repo.getMembers(SECOND_ORG_ID);
    expect(novaMembers.length).toBe(6);
    expect(luneMembers.length).toBe(3);
    expect(novaMembers.every((m) => m.orgId === DEMO_ORG_ID)).toBe(true);
    expect(luneMembers.every((m) => m.orgId === SECOND_ORG_ID)).toBe(true);
  });

  it("seede une demande d'adhésion en attente sur Nova Studio", async () => {
    await seedSecondOrg(repo);
    const requests = await repo.getPendingJoinRequests(DEMO_ORG_ID);
    expect(requests.length).toBe(1);
    expect(requests[0].requesterName).toBe('Hugo Lefèvre');
    expect((await repo.getPendingJoinRequests(SECOND_ORG_ID)).length).toBe(0);
  });

  it('accepte une demande → ajoute le membre à la bonne org', async () => {
    await seedSecondOrg(repo);
    const [req] = await repo.getPendingJoinRequests(DEMO_ORG_ID);
    await repo.respondJoinRequest(req.id, true);
    expect((await repo.getPendingJoinRequests(DEMO_ORG_ID)).length).toBe(0);
    const members = await repo.getMembers(DEMO_ORG_ID);
    expect(members.some((m) => m.userId === req.userId && m.role === 'member')).toBe(true);
    // Atelier Lune n'est pas affectée.
    expect((await repo.getMembers(SECOND_ORG_ID)).length).toBe(3);
  });

  it('multi-org : créer une nouvelle entreprise ajoute une 3e org (admin)', async () => {
    await seedSecondOrg(repo);
    const created = await repo.createOrganization('Ma Boîte');
    const orgs = await repo.getMyOrganizations();
    expect(orgs.length).toBe(3);
    expect(orgs.find((o) => o.id === created.id)?.myRole).toBe('admin');
    expect(created.joinCode).toMatch(/^COSMO-/);
  });

  it('updateOrganization : admin met à jour le profil de Nova Studio', async () => {
    const updated = await repo.updateOrganization(DEMO_ORG_ID, {
      name: 'Nova Studio SAS',
      description: 'Nouveau pitch',
      industry: 'Tech',
    });
    expect(updated.name).toBe('Nova Studio SAS');
    const orgs = await repo.getMyOrganizations();
    expect(orgs.find((o) => o.id === DEMO_ORG_ID)?.description).toBe('Nouveau pitch');
  });

  it('updateOrganization : refuse si non-admin (Atelier Lune)', async () => {
    await seedSecondOrg(repo);
    await expect(repo.updateOrganization(SECOND_ORG_ID, { name: 'Hack' })).rejects.toThrow();
  });

  it('quitter Atelier Lune (membre) fonctionne, mais pas Nova Studio (dernier admin)', async () => {
    await seedSecondOrg(repo);
    await repo.leaveOrganization(SECOND_ORG_ID);
    expect((await repo.getMyOrganizations()).length).toBe(1);
    await expect(repo.leaveOrganization(DEMO_ORG_ID)).rejects.toThrow();
  });

  it('rejette le double-traitement d\'une demande', async () => {
    const [req] = await repo.getPendingJoinRequests(DEMO_ORG_ID);
    await repo.respondJoinRequest(req.id, true);
    await expect(repo.respondJoinRequest(req.id, true)).rejects.toThrow();
  });

  it('requestJoin : erreur générique sur code inconnu, refus si déjà membre', async () => {
    await expect(repo.requestJoin('COSMO-ZZZZZZ')).rejects.toMatchObject({ code: 'invalid_link' });
    await expect(repo.requestJoin('COSMO-DEMO42')).rejects.toMatchObject({ code: 'already_a_member' });
  });

  // ─── Pyramide (v2, lot 1b) ──────────────────────────────────────────

  it('seede la pyramide Nova Studio : arbre N+1 + Camille non placée', async () => {
    const { buildOrgTree } = await import('./types');
    const members = await repo.getMembers(DEMO_ORG_ID);
    const { roots, unplaced } = buildOrgTree(members, 'demo-user');
    expect(roots.length).toBe(1);
    expect(roots[0].member.userId).toBe('demo-user');
    expect(roots[0].children.map((c) => c.member.userId).sort()).toEqual(['friend-1', 'user-lucas']);
    const marie = roots[0].children.find((c) => c.member.userId === 'friend-1')!;
    expect(marie.children.map((c) => c.member.userId).sort()).toEqual(['friend-2', 'friend-3']);
    expect(unplaced.map((m) => m.userId)).toEqual(['user-camille']);
  });

  it('setMemberManager : place Camille sous Lucas', async () => {
    await repo.setMemberManager(DEMO_ORG_ID, 'user-camille', 'user-lucas');
    const members = await repo.getMembers(DEMO_ORG_ID);
    expect(members.find((m) => m.userId === 'user-camille')?.managerId).toBe('user-lucas');
  });

  it('setMemberManager : refuse les cycles (Marie sous Jean, son subordonné)', async () => {
    await expect(repo.setMemberManager(DEMO_ORG_ID, 'friend-1', 'friend-2')).rejects.toMatchObject({ code: 'hierarchy_cycle' });
  });

  it('setMemberManager : refuse un responsable hors org et soi-même', async () => {
    await expect(repo.setMemberManager(DEMO_ORG_ID, 'friend-2', 'user-nina')).rejects.toThrow();
    await expect(repo.setMemberManager(DEMO_ORG_ID, 'friend-2', 'friend-2')).rejects.toThrow();
  });

  it('setMemberManager : non-admin limité à son sous-arbre (Atelier Lune)', async () => {
    await seedSecondOrg(repo);
    // Dans Atelier Lune, demo-user est membre sans subordonnés → aucun droit.
    await expect(repo.setMemberManager(SECOND_ORG_ID, 'user-theo', 'demo-user')).rejects.toMatchObject({ code: 'out_of_scope' });
  });

  it('removeMember re-parente les subordonnés au grand-parent', async () => {
    // Retirer Marie : Jean et Sophie remontent sous demo-user.
    await repo.removeMember(DEMO_ORG_ID, 'friend-1');
    const members = await repo.getMembers(DEMO_ORG_ID);
    expect(members.find((m) => m.userId === 'friend-2')?.managerId).toBe('demo-user');
    expect(members.find((m) => m.userId === 'friend-3')?.managerId).toBe('demo-user');
  });

  // ─── Invitations placées + code (v2, lot 1c) ────────────────────────

  it('createInviteLink : lien placé sous Marie, expire à J+7, révocable', async () => {
    const link = await repo.createInviteLink(DEMO_ORG_ID, 'friend-1');
    expect(link.managerId).toBe('friend-1');
    expect(new Date(link.expiresAt).getTime()).toBeGreaterThan(Date.now() + 6 * 24 * 60 * 60 * 1000);
    expect((await repo.getInviteLinks(DEMO_ORG_ID)).length).toBe(1);
    await repo.revokeInviteLink(link.id);
    expect((await repo.getInviteLinks(DEMO_ORG_ID)).length).toBe(0);
  });

  it('createInviteLink : refuse pour un non-admin hors de son sous-arbre (Atelier Lune)', async () => {
    await seedSecondOrg(repo);
    await expect(repo.createInviteLink(SECOND_ORG_ID, 'user-nina')).rejects.toThrow();
  });

  it('regenerateJoinCode : nouveau code valide, admin only', async () => {
    await seedSecondOrg(repo);
    const code = await repo.regenerateJoinCode(DEMO_ORG_ID);
    // Depuis la mig. 083 (faille M-7) : 10 caractères (~49,5 bits) au lieu de 6.
    expect(code).toMatch(/^COSMO-[A-HJ-KM-NP-Z2-9]{10}$/);
    const orgs = await repo.getMyOrganizations();
    expect(orgs.find((o) => o.id === DEMO_ORG_ID)?.joinCode).toBe(code);
    // Membre simple sur Atelier Lune → refus.
    await expect(repo.regenerateJoinCode(SECOND_ORG_ID)).rejects.toThrow();
  });

  it('survit à un localStorage corrompu et reseede (B12/B14)', async () => {
    localStorage.setItem(ORGS_STORAGE_KEY, '{invalid json');
    expect((await repo.getMyOrganizations()).length).toBe(1);

    localStorage.removeItem(ORGS_STORAGE_KEY);
    localStorage.removeItem(ORG_MEMBERS_STORAGE_KEY);
    localStorage.removeItem(ORG_JOIN_REQUESTS_STORAGE_KEY);
    const fresh = new LocalStorageOrganizationsRepository();
    expect((await fresh.getMembers(DEMO_ORG_ID)).length).toBe(6);
    expect((await fresh.getPendingJoinRequests(DEMO_ORG_ID)).length).toBe(1);
  });
});
