import { describe, expect, it } from 'vitest';
import { canSeeReports, reportAccess } from './report-access.helpers';
import type { OrgTeam, OrgTeamMember } from '@/modules/org-teams';

const team = (id: string, createdBy: string | null = 'x'): OrgTeam =>
  ({ id, orgId: 'o', name: id, color: 'blue', description: null, createdBy, createdAt: '' }) as OrgTeam;
const lead = (teamId: string, userId: string, isLead = true): OrgTeamMember =>
  ({ teamId, orgId: 'o', userId, isLead, addedAt: '' }) as unknown as OrgTeamMember;

const teams = [team('a'), team('b'), team('c', 'me')];

describe('reportAccess (miroir de la policy de la mig. 202)', () => {
  it('admin (les deux droits) : entreprise et toutes les équipes', () => {
    const r = reportAccess({ 'report.org': true, 'report.allTeams': true }, teams, [], 'me');
    expect(r.canOrg).toBe(true);
    expect(r.teams.map((t) => t.id)).toEqual(['a', 'b', 'c']);
  });

  it('responsable sans droit : seulement les équipes qu’il dirige ou a créées', () => {
    const r = reportAccess({ 'report.org': false, 'report.allTeams': false }, teams, [lead('a', 'me'), lead('b', 'me', false)], 'me');
    expect(r.canOrg).toBe(false);
    expect(r.teams.map((t) => t.id)).toEqual(['a', 'c']);
  });

  it('`report.allTeams` sans être responsable : toutes les équipes', () => {
    const r = reportAccess({ 'report.org': false, 'report.allTeams': true }, teams, [], 'me');
    expect(r.teams).toHaveLength(3);
  });

  it('membre simple : aucun rapport, la section est masquée', () => {
    const r = reportAccess({ 'report.org': false, 'report.allTeams': false }, [team('a')], [lead('a', 'me', false)], 'me');
    expect(canSeeReports(r)).toBe(false);
  });
});
