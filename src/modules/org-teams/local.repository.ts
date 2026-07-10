// ═══════════════════════════════════════════════════════════════════
// ORG-TEAMS MODULE - LocalStorage Repository (mode démo)
// ═══════════════════════════════════════════════════════════════════
//
// Seeds Nova Studio : 2 équipes (« Design » avec Marie/Sophie/Camille,
// « Dev » avec Jean/Lucas). Rechargées à chaque loginDemo().

import { IOrgTeamsRepository } from './repository';
import { OrgTeam, OrgTeamMember, CreateOrgTeamInput } from './types';
import { ORG_TEAMS_STORAGE_KEY, ORG_TEAM_MEMBERS_STORAGE_KEY } from './constants';

const DEMO_ORG_ID = 'org-demo-1';
const DEMO_USER_ID = 'demo-user';
const DAY = 24 * 60 * 60 * 1000;

const DEMO_TEAMS: OrgTeam[] = [
  { id: 'team-design', orgId: DEMO_ORG_ID, name: 'Design', color: 'purple', createdBy: DEMO_USER_ID, createdAt: new Date(Date.now() - 40 * DAY).toISOString() },
  { id: 'team-dev', orgId: DEMO_ORG_ID, name: 'Dev', color: 'blue', createdBy: DEMO_USER_ID, createdAt: new Date(Date.now() - 40 * DAY).toISOString() },
];

const DEMO_TEAM_MEMBERS: OrgTeamMember[] = [
  { teamId: 'team-design', orgId: DEMO_ORG_ID, userId: 'friend-1' },
  { teamId: 'team-design', orgId: DEMO_ORG_ID, userId: 'friend-3' },
  { teamId: 'team-design', orgId: DEMO_ORG_ID, userId: 'user-camille' },
  { teamId: 'team-dev', orgId: DEMO_ORG_ID, userId: 'friend-2' },
  { teamId: 'team-dev', orgId: DEMO_ORG_ID, userId: 'user-lucas' },
];

function readOrSeed<T>(key: string, seed: T): T {
  const data = localStorage.getItem(key);
  if (!data) {
    const clone = JSON.parse(JSON.stringify(seed)) as T;
    localStorage.setItem(key, JSON.stringify(clone));
    return clone;
  }
  try {
    return JSON.parse(data) as T;
  } catch {
    const clone = JSON.parse(JSON.stringify(seed)) as T;
    localStorage.setItem(key, JSON.stringify(clone));
    return clone;
  }
}

export class LocalStorageOrgTeamsRepository implements IOrgTeamsRepository {
  private getTeamsArray(): OrgTeam[] {
    return readOrSeed<OrgTeam[]>(ORG_TEAMS_STORAGE_KEY, DEMO_TEAMS);
  }
  private saveTeams(teams: OrgTeam[]): void {
    localStorage.setItem(ORG_TEAMS_STORAGE_KEY, JSON.stringify(teams));
  }
  private getMembershipsArray(): OrgTeamMember[] {
    return readOrSeed<OrgTeamMember[]>(ORG_TEAM_MEMBERS_STORAGE_KEY, DEMO_TEAM_MEMBERS);
  }
  private saveMemberships(m: OrgTeamMember[]): void {
    localStorage.setItem(ORG_TEAM_MEMBERS_STORAGE_KEY, JSON.stringify(m));
  }

  async getTeams(orgId: string): Promise<OrgTeam[]> {
    return this.getTeamsArray().filter((t) => t.orgId === orgId);
  }

  async getTeamMembers(orgId: string): Promise<OrgTeamMember[]> {
    return this.getMembershipsArray().filter((m) => m.orgId === orgId);
  }

  async createTeam(orgId: string, input: CreateOrgTeamInput): Promise<OrgTeam> {
    const team: OrgTeam = {
      id: crypto.randomUUID(),
      orgId,
      name: input.name,
      color: input.color ?? 'blue',
      createdBy: DEMO_USER_ID,
      createdAt: new Date().toISOString(),
    };
    this.saveTeams([...this.getTeamsArray(), team]);
    return team;
  }

  async deleteTeam(teamId: string): Promise<void> {
    this.saveTeams(this.getTeamsArray().filter((t) => t.id !== teamId));
    this.saveMemberships(this.getMembershipsArray().filter((m) => m.teamId !== teamId));
  }

  async addTeamMember(teamId: string, orgId: string, userId: string): Promise<void> {
    const memberships = this.getMembershipsArray();
    if (memberships.some((m) => m.teamId === teamId && m.userId === userId)) return;
    this.saveMemberships([...memberships, { teamId, orgId, userId }]);
  }

  async removeTeamMember(teamId: string, userId: string): Promise<void> {
    this.saveMemberships(
      this.getMembershipsArray().filter((m) => !(m.teamId === teamId && m.userId === userId)),
    );
  }
}
