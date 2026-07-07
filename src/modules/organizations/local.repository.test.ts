// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStorageOrganizationsRepository } from './local.repository';
import {
  ORG_STORAGE_KEY,
  ORG_MEMBERS_STORAGE_KEY,
  ORG_JOIN_REQUESTS_STORAGE_KEY,
} from './constants';

describe('LocalStorageOrganizationsRepository (démo)', () => {
  let repo: LocalStorageOrganizationsRepository;

  beforeEach(() => {
    localStorage.clear();
    repo = new LocalStorageOrganizationsRepository();
  });

  it("seede l'entreprise Nova Studio dont l'utilisateur démo est admin", async () => {
    const org = await repo.getMyOrganization();
    expect(org).not.toBeNull();
    expect(org?.name).toBe('Nova Studio');
    expect(org?.joinCode).toBe('COSMO-DEMO42');
    expect(org?.myRole).toBe('admin');
  });

  it("retourne l'annuaire des membres seedés", async () => {
    const org = await repo.getMyOrganization();
    const members = await repo.getMembers(org!.id);
    expect(members.length).toBe(6);
    expect(members.some((m) => m.role === 'manager')).toBe(true);
    expect(members.find((m) => m.userId === 'demo-user')?.role).toBe('admin');
  });

  it('seede une demande d\'adhésion en attente', async () => {
    const org = await repo.getMyOrganization();
    const requests = await repo.getPendingJoinRequests(org!.id);
    expect(requests.length).toBe(1);
    expect(requests[0].status).toBe('pending');
    expect(requests[0].requesterName).toBe('Hugo Lefèvre');
  });

  it('accepte une demande → ajoute le membre et retire la demande de la file', async () => {
    const org = await repo.getMyOrganization();
    const [req] = await repo.getPendingJoinRequests(org!.id);
    await repo.respondJoinRequest(req.id, true);

    const pending = await repo.getPendingJoinRequests(org!.id);
    expect(pending.length).toBe(0);

    const members = await repo.getMembers(org!.id);
    expect(members.some((m) => m.userId === req.userId && m.role === 'member')).toBe(true);
  });

  it('refuse une demande → ne crée pas de membre', async () => {
    const org = await repo.getMyOrganization();
    const [req] = await repo.getPendingJoinRequests(org!.id);
    const before = (await repo.getMembers(org!.id)).length;

    await repo.respondJoinRequest(req.id, false);

    expect((await repo.getPendingJoinRequests(org!.id)).length).toBe(0);
    expect((await repo.getMembers(org!.id)).length).toBe(before);
  });

  it('rejette le double-traitement d\'une demande', async () => {
    const org = await repo.getMyOrganization();
    const [req] = await repo.getPendingJoinRequests(org!.id);
    await repo.respondJoinRequest(req.id, true);
    await expect(repo.respondJoinRequest(req.id, true)).rejects.toThrow();
  });

  it('empêche de créer/rejoindre une entreprise (déjà membre en démo)', async () => {
    await expect(repo.createOrganization('Autre')).rejects.toThrow();
    await expect(repo.requestJoin('COSMO-ABCDEF')).rejects.toThrow();
  });

  it('ne mute pas les seeds au niveau module (clone défensif, B12)', async () => {
    // Accepter une demande sur une 1re instance...
    const org = await repo.getMyOrganization();
    const [req] = await repo.getPendingJoinRequests(org!.id);
    await repo.respondJoinRequest(req.id, true);

    // ...puis repartir de zéro (clearDemoStorage simulé) doit reseeder proprement.
    localStorage.removeItem(ORG_STORAGE_KEY);
    localStorage.removeItem(ORG_MEMBERS_STORAGE_KEY);
    localStorage.removeItem(ORG_JOIN_REQUESTS_STORAGE_KEY);
    const fresh = new LocalStorageOrganizationsRepository();
    const freshOrg = await fresh.getMyOrganization();
    expect((await fresh.getMembers(freshOrg!.id)).length).toBe(6);
    expect((await fresh.getPendingJoinRequests(freshOrg!.id)).length).toBe(1);
  });

  it('survit à un localStorage corrompu (safeParse, B14)', async () => {
    localStorage.setItem(ORG_STORAGE_KEY, '{invalid json');
    const org = await repo.getMyOrganization();
    expect(org?.name).toBe('Nova Studio');
  });
});
