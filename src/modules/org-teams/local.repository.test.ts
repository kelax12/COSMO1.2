// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStorageOrgTeamsRepository } from './local.repository';

const ORG = 'org-demo-1';

describe('LocalStorageOrgTeamsRepository (démo)', () => {
  let repo: LocalStorageOrgTeamsRepository;

  beforeEach(() => {
    localStorage.clear();
    repo = new LocalStorageOrgTeamsRepository();
  });

  it('seede 2 équipes (Design, Dev) avec leurs membres', async () => {
    const teams = await repo.getTeams(ORG);
    expect(teams.map((t) => t.name).sort()).toEqual(['Design', 'Dev']);
    const memberships = await repo.getTeamMembers(ORG);
    expect(memberships.filter((m) => m.teamId === 'team-design').length).toBe(3);
    expect(memberships.filter((m) => m.teamId === 'team-dev').length).toBe(2);
  });

  it('crée une équipe, y ajoute/retire un membre (idempotent)', async () => {
    const team = await repo.createTeam(ORG, { name: 'Marketing' });
    await repo.addTeamMember(team.id, ORG, 'friend-1');
    await repo.addTeamMember(team.id, ORG, 'friend-1'); // doublon ignoré
    let memberships = await repo.getTeamMembers(ORG);
    expect(memberships.filter((m) => m.teamId === team.id).length).toBe(1);

    await repo.removeTeamMember(team.id, 'friend-1');
    memberships = await repo.getTeamMembers(ORG);
    expect(memberships.filter((m) => m.teamId === team.id).length).toBe(0);
  });

  it('supprimer une équipe purge ses appartenances', async () => {
    await repo.deleteTeam('team-design');
    expect((await repo.getTeams(ORG)).length).toBe(1);
    expect((await repo.getTeamMembers(ORG)).some((m) => m.teamId === 'team-design')).toBe(false);
  });
});
