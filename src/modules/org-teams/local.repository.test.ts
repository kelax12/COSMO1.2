// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStorageOrgTeamsRepository } from './local.repository';
import { TEAM_PROJECTS_STORAGE_KEY } from '@/modules/team-projects/constants';
import { TEAM_OKRS_STORAGE_KEY } from '@/modules/team-okrs/constants';

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
    await repo.deleteTeam({ teamId: 'team-design', targetTeamId: 'team-dev', archiveProjects: false });
    expect((await repo.getTeams(ORG)).length).toBe(1);
    expect((await repo.getTeamMembers(ORG)).some((m) => m.teamId === 'team-design')).toBe(false);
  });

  // M5 (mig. 151) : en démo comme en prod, supprimer une équipe n'ouvre rien.
  describe('suppression sans fuite (M5)', () => {
    const projects = () => JSON.parse(localStorage.getItem(TEAM_PROJECTS_STORAGE_KEY) ?? '[]') as { teamId: string | null; archivedAt?: string | null }[];
    const okrs = () => JSON.parse(localStorage.getItem(TEAM_OKRS_STORAGE_KEY) ?? '[]') as { teamIds: string[] }[];

    it('sans cible, refuse tant que l équipe porte un projet ou un OKR, et n écrit rien', async () => {
      const impact = await repo.getDeletionImpact('team-dev');
      expect(impact.activeProjects + impact.archivedProjects + impact.soleOkrs).toBeGreaterThan(0);
      const before = localStorage.getItem(TEAM_PROJECTS_STORAGE_KEY);

      await expect(
        repo.deleteTeam({ teamId: 'team-dev', targetTeamId: null, archiveProjects: false }),
      ).rejects.toMatchObject({ code: 'team_has_dependents' });
      expect(localStorage.getItem(TEAM_PROJECTS_STORAGE_KEY)).toBe(before);
      expect((await repo.getTeams(ORG)).some((t) => t.id === 'team-dev')).toBe(true);
    });

    it('avec cible, déplace projets et OKR, et aucun ne devient visible par toute l organisation', async () => {
      await repo.getDeletionImpact('team-dev'); // écrit les seeds avant de les compter
      const devProjects = projects().filter((p) => p.teamId === 'team-dev').length;
      const orgWideBefore = projects().filter((p) => p.teamId === null).length;
      const companyOkrsBefore = okrs().filter((o) => o.teamIds.length === 0).length;

      await repo.deleteTeam({ teamId: 'team-dev', targetTeamId: 'team-design', archiveProjects: true });

      expect(projects().filter((p) => p.teamId === 'team-dev')).toHaveLength(0);
      expect(projects().filter((p) => p.teamId === null)).toHaveLength(orgWideBefore);
      const moved = projects().filter((p) => p.teamId === 'team-design' && p.archivedAt);
      expect(moved.length).toBeGreaterThanOrEqual(devProjects);
      expect(okrs().some((o) => o.teamIds.includes('team-dev'))).toBe(false);
      expect(okrs().filter((o) => o.teamIds.length === 0)).toHaveLength(companyOkrsBefore);
    });

    it('refuse de se transférer à elle-même', async () => {
      await expect(
        repo.deleteTeam({ teamId: 'team-dev', targetTeamId: 'team-dev', archiveProjects: false }),
      ).rejects.toMatchObject({ code: 'team_transfer_same_team' });
    });
  });
});
