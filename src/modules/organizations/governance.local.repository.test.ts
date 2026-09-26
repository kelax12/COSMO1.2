// @vitest-environment jsdom
// ═══════════════════════════════════════════════════════════════════
// Assistant de départ en démo — mode `transfer` (mig. 164)
//
// Audit du 2026-09-24, cas « transfert de responsabilité » : il n'existait
// que pour la propriété de l'organisation. Le mode `transfer` transmet tâches,
// projets portés et rôles de responsable SANS faire partir la personne.
// ═══════════════════════════════════════════════════════════════════
import { beforeEach, describe, expect, it } from 'vitest';
import { LocalStorageOrgGovernanceRepository } from './governance.local.repository';
import { LocalStorageOrganizationsRepository, DEMO_ORG_ID } from './local.repository';
import { LocalStorageTeamProjectsRepository } from '@/modules/team-projects/local.repository';
import { LocalStorageOrgTeamsRepository } from '@/modules/org-teams/local.repository';

describe('offboardMember — mode transfer', () => {
  beforeEach(() => localStorage.clear());

  it('transmet tâches, projets et rôle de responsable, la personne RESTE', async () => {
    const orgs = new LocalStorageOrganizationsRepository();
    const projects = new LocalStorageTeamProjectsRepository();
    const teams = new LocalStorageOrgTeamsRepository();
    const governance = new LocalStorageOrgGovernanceRepository();

    const tasks = await projects.getTasks(DEMO_ORG_ID);
    const open = tasks.find((t) => !t.completed && t.assigneeIds.length > 0 && !t.assigneeIds.includes('demo-user'));
    expect(open).toBeTruthy();
    const from = open!.assigneeIds[0];
    const to = (await orgs.getMembers(DEMO_ORG_ID)).find((m) => m.userId !== from && m.userId !== 'demo-user')!.userId;
    await projects.updateProject(open!.projectId, { ownerId: from });
    const team = (await teams.getTeams(DEMO_ORG_ID))[0];
    await teams.addTeamMember(team.id, DEMO_ORG_ID, from);
    await teams.setTeamLead(team.id, from, true);

    const impact = await governance.getDepartureImpact(DEMO_ORG_ID, from);
    expect(impact.projects).toBeGreaterThan(0);

    await governance.offboardMember({
      orgId: DEMO_ORG_ID, userId: from, tasksTo: to, projectsTo: to, leadsTo: to, mode: 'transfer',
    });

    const after = await projects.getTasks(DEMO_ORG_ID);
    expect(after.find((t) => t.id === open!.id)?.assigneeIds).toContain(to);
    expect(after.find((t) => t.id === open!.id)?.assigneeIds).not.toContain(from);
    expect((await projects.getProjects(DEMO_ORG_ID)).find((p) => p.id === open!.projectId)?.ownerId).toBe(to);
    const memberships = await teams.getTeamMembers(DEMO_ORG_ID);
    expect(memberships.find((m) => m.teamId === team.id && m.userId === to)?.isLead).toBe(true);
    // Le rôle PASSE : la source ne le garde pas.
    expect(memberships.find((m) => m.teamId === team.id && m.userId === from)?.isLead).toBe(false);
    // Et la personne est toujours là, sans suspension.
    const member = (await orgs.getMembers(DEMO_ORG_ID)).find((m) => m.userId === from);
    expect(member).toBeTruthy();
    expect(member?.suspendedAt ?? null).toBeNull();
  });

  it('en transfer, une cible absente ne touche à rien', async () => {
    const projects = new LocalStorageTeamProjectsRepository();
    const governance = new LocalStorageOrgGovernanceRepository();
    const before = await projects.getTasks(DEMO_ORG_ID);
    const open = before.find((t) => !t.completed && t.assigneeIds.length > 0 && !t.assigneeIds.includes('demo-user'))!;
    await governance.offboardMember({ orgId: DEMO_ORG_ID, userId: open.assigneeIds[0], mode: 'transfer' });
    const after = await projects.getTasks(DEMO_ORG_ID);
    expect(after.find((t) => t.id === open.id)?.assigneeIds).toEqual(open.assigneeIds);
  });
});
