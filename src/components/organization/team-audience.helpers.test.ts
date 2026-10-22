// ═══════════════════════════════════════════════════════════════════
// Ce qu'un retrait d'équipe fait perdre (audit du 2026-09-24, étape 4)
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import type { OrgMember } from '@/modules/organizations';
import type { OrgTeamMember } from '@/modules/org-teams';
import type { TeamProject, TeamProjectTeam } from '@/modules/team-projects';
import { projectsLostOnTeamLeave, teamsOfProject } from './team-audience.helpers';

const m = (userId: string, managerId: string | null = null, role: 'admin' | 'member' = 'member') =>
  ({ userId, managerId, role, displayName: userId } as OrgMember);
const tm = (teamId: string, userId: string): OrgTeamMember => ({ teamId, orgId: 'o', userId, isLead: false });
const p = (id: string, teamId: string | null, extra: Partial<TeamProject> = {}) =>
  ({ id, orgId: 'o', name: id, color: 'blue', createdBy: 'x', createdAt: '', teamId, ...extra } as TeamProject);

describe('projectsLostOnTeamLeave', () => {
  const members = [m('boss'), m('ana', 'boss'), m('bob'), m('root', null, 'admin')];
  const memberships = [tm('T1', 'ana'), tm('T2', 'ana'), tm('T1', 'bob')];
  const projects = [p('p1', 'T1'), p('p2', 'T2'), p('pOrg', null), p('pArch', 'T1', { archivedAt: '2026-01-01' })];

  it('perd les projets de l’équipe quittée qu’aucune autre équipe ne lui ouvre', () => {
    const lost = projectsLostOnTeamLeave({ userId: 'ana', teamId: 'T1', members, memberships, projects, projectTeams: [] });
    expect(lost.map((x) => x.id)).toEqual(['p1']);
  });

  it('une équipe ASSOCIÉE dont la personne reste membre garde la vue (mig. 164)', () => {
    const projectTeams: TeamProjectTeam[] = [{ projectId: 'p1', teamId: 'T2' }];
    expect(projectsLostOnTeamLeave({ userId: 'ana', teamId: 'T1', members, memberships, projects, projectTeams })).toEqual([]);
  });

  it('un manager garde la vue tant qu’un subordonné est dans l’équipe', () => {
    const withBoss = [...memberships, tm('T1', 'boss')];
    expect(projectsLostOnTeamLeave({ userId: 'boss', teamId: 'T1', members, memberships: withBoss, projects, projectTeams: [] })).toEqual([]);
  });

  it('un admin ne perd jamais rien ; un projet d’entreprise ou archivé non plus', () => {
    expect(projectsLostOnTeamLeave({ userId: 'root', teamId: 'T1', members, memberships, projects, projectTeams: [] })).toEqual([]);
    const lost = projectsLostOnTeamLeave({ userId: 'bob', teamId: 'T1', members, memberships, projects, projectTeams: [] });
    expect(lost.map((x) => x.id)).toEqual(['p1']);
  });

  it('teamsOfProject réunit l’équipe principale et les associées', () => {
    expect([...teamsOfProject(p('p1', 'T1'), [{ projectId: 'p1', teamId: 'T3' }, { projectId: 'p9', teamId: 'T4' }])]).toEqual(['T1', 'T3']);
  });
});
