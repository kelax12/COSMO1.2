// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStorageOrganizationsRepository, DEMO_ORG_ID, DEMO_ORG_2_ID } from './local.repository';
import {
  ORGS_STORAGE_KEY,
  ORG_MEMBERS_STORAGE_KEY,
  ORG_JOIN_REQUESTS_STORAGE_KEY,
} from './constants';

describe('LocalStorageOrganizationsRepository (démo, multi-org v2)', () => {
  let repo: LocalStorageOrganizationsRepository;

  beforeEach(() => {
    localStorage.clear();
    repo = new LocalStorageOrganizationsRepository();
  });

  it('seede DEUX entreprises : Nova Studio (admin) et Atelier Lune (membre)', async () => {
    const orgs = await repo.getMyOrganizations();
    expect(orgs.length).toBe(2);
    const nova = orgs.find((o) => o.id === DEMO_ORG_ID);
    const lune = orgs.find((o) => o.id === DEMO_ORG_2_ID);
    expect(nova?.name).toBe('Nova Studio');
    expect(nova?.myRole).toBe('admin');
    expect(nova?.joinCode).toBe('COSMO-DEMO42');
    expect(nova?.industry).toBe('Design & Tech');
    expect(lune?.name).toBe('Atelier Lune');
    expect(lune?.myRole).toBe('member');
  });

  it("retourne l'annuaire par organisation (pas de fuite entre orgs)", async () => {
    const novaMembers = await repo.getMembers(DEMO_ORG_ID);
    const luneMembers = await repo.getMembers(DEMO_ORG_2_ID);
    expect(novaMembers.length).toBe(6);
    expect(luneMembers.length).toBe(3);
    expect(novaMembers.every((m) => m.orgId === DEMO_ORG_ID)).toBe(true);
    expect(luneMembers.every((m) => m.orgId === DEMO_ORG_2_ID)).toBe(true);
  });

  it("seede une demande d'adhésion en attente sur Nova Studio", async () => {
    const requests = await repo.getPendingJoinRequests(DEMO_ORG_ID);
    expect(requests.length).toBe(1);
    expect(requests[0].requesterName).toBe('Hugo Lefèvre');
    expect((await repo.getPendingJoinRequests(DEMO_ORG_2_ID)).length).toBe(0);
  });

  it('accepte une demande → ajoute le membre à la bonne org', async () => {
    const [req] = await repo.getPendingJoinRequests(DEMO_ORG_ID);
    await repo.respondJoinRequest(req.id, true);
    expect((await repo.getPendingJoinRequests(DEMO_ORG_ID)).length).toBe(0);
    const members = await repo.getMembers(DEMO_ORG_ID);
    expect(members.some((m) => m.userId === req.userId && m.role === 'member')).toBe(true);
    // Atelier Lune n'est pas affectée.
    expect((await repo.getMembers(DEMO_ORG_2_ID)).length).toBe(3);
  });

  it('multi-org : créer une nouvelle entreprise ajoute une 3e org (admin)', async () => {
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
    await expect(repo.updateOrganization(DEMO_ORG_2_ID, { name: 'Hack' })).rejects.toThrow();
  });

  it('quitter Atelier Lune (membre) fonctionne, mais pas Nova Studio (dernier admin)', async () => {
    await repo.leaveOrganization(DEMO_ORG_2_ID);
    expect((await repo.getMyOrganizations()).length).toBe(1);
    await expect(repo.leaveOrganization(DEMO_ORG_ID)).rejects.toThrow();
  });

  it('rejette le double-traitement d\'une demande', async () => {
    const [req] = await repo.getPendingJoinRequests(DEMO_ORG_ID);
    await repo.respondJoinRequest(req.id, true);
    await expect(repo.respondJoinRequest(req.id, true)).rejects.toThrow();
  });

  it('requestJoin : erreur générique sur code inconnu, refus si déjà membre', async () => {
    await expect(repo.requestJoin('COSMO-ZZZZZZ')).rejects.toThrow('Code invalide');
    await expect(repo.requestJoin('COSMO-DEMO42')).rejects.toThrow(/déjà membre/);
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
    await expect(repo.setMemberManager(DEMO_ORG_ID, 'friend-1', 'friend-2')).rejects.toThrow(/cycle/i);
  });

  it('setMemberManager : refuse un responsable hors org et soi-même', async () => {
    await expect(repo.setMemberManager(DEMO_ORG_ID, 'friend-2', 'user-nina')).rejects.toThrow();
    await expect(repo.setMemberManager(DEMO_ORG_ID, 'friend-2', 'friend-2')).rejects.toThrow();
  });

  it('setMemberManager : non-admin limité à son sous-arbre (Atelier Lune)', async () => {
    // Dans Atelier Lune, demo-user est membre sans subordonnés → aucun droit.
    await expect(repo.setMemberManager(DEMO_ORG_2_ID, 'user-theo', 'demo-user')).rejects.toThrow(/sous vous/);
  });

  it('removeMember re-parente les subordonnés au grand-parent', async () => {
    // Retirer Marie : Jean et Sophie remontent sous demo-user.
    await repo.removeMember(DEMO_ORG_ID, 'friend-1');
    const members = await repo.getMembers(DEMO_ORG_ID);
    expect(members.find((m) => m.userId === 'friend-2')?.managerId).toBe('demo-user');
    expect(members.find((m) => m.userId === 'friend-3')?.managerId).toBe('demo-user');
  });

  it('survit à un localStorage corrompu et reseede (B12/B14)', async () => {
    localStorage.setItem(ORGS_STORAGE_KEY, '{invalid json');
    expect((await repo.getMyOrganizations()).length).toBe(2);

    localStorage.removeItem(ORGS_STORAGE_KEY);
    localStorage.removeItem(ORG_MEMBERS_STORAGE_KEY);
    localStorage.removeItem(ORG_JOIN_REQUESTS_STORAGE_KEY);
    const fresh = new LocalStorageOrganizationsRepository();
    expect((await fresh.getMembers(DEMO_ORG_ID)).length).toBe(6);
    expect((await fresh.getPendingJoinRequests(DEMO_ORG_ID)).length).toBe(1);
  });
});
