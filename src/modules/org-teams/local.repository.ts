// ═══════════════════════════════════════════════════════════════════
// ORG-TEAMS MODULE - LocalStorage Repository (mode démo)
// ═══════════════════════════════════════════════════════════════════
//
// Seeds Nova Studio : 2 équipes (« Design » avec Marie/Sophie/Camille,
// « Dev » avec Jean/Lucas). Rechargées à chaque loginDemo().

import { IOrgTeamsRepository } from './repository';
import type { OrgTeam, OrgTeamMember, CreateOrgTeamInput, UpdateOrgTeamInput, DeleteOrgTeamOptions, TeamDeletionImpact } from './types';
import { ORG_TEAMS_STORAGE_KEY, ORG_TEAM_MEMBERS_STORAGE_KEY } from './constants';
import { readJsonArray, safeGetItem, safeSetItem, writeJsonOrThrow } from '@/lib/safe-json';
import { makeApiError } from '@/lib/normalizeApiError';
import { LocalStorageTeamProjectsRepository } from '@/modules/team-projects/local.repository';
import { TEAM_PROJECTS_STORAGE_KEY } from '@/modules/team-projects/constants';
import type { TeamProject } from '@/modules/team-projects/types';
import { LocalStorageTeamOKRsRepository } from '@/modules/team-okrs/local.repository';
import { TEAM_OKRS_STORAGE_KEY } from '@/modules/team-okrs/constants';
import type { TeamOKR } from '@/modules/team-okrs/types';

const DEMO_ORG_ID = 'org-demo-1';
const DEMO_USER_ID = 'demo-user';
const DAY = 24 * 60 * 60 * 1000;

const DEMO_TEAMS: OrgTeam[] = [
  { id: 'team-design', orgId: DEMO_ORG_ID, name: 'Design', color: 'purple', createdBy: DEMO_USER_ID, createdAt: new Date(Date.now() - 40 * DAY).toISOString() },
  { id: 'team-dev', orgId: DEMO_ORG_ID, name: 'Dev', color: 'blue', createdBy: DEMO_USER_ID, createdAt: new Date(Date.now() - 40 * DAY).toISOString() },
];

// Chaque équipe a un responsable (mig. 107) : une organisation de démo dont
// aucune équipe n'aurait de responsable montrerait le cas dégradé plutôt que
// le nominal. Marie et Jean sont déjà les deux managers de la pyramide démo.
const DEMO_TEAM_MEMBERS: OrgTeamMember[] = [
  { teamId: 'team-design', orgId: DEMO_ORG_ID, userId: 'friend-1', isLead: true },
  { teamId: 'team-design', orgId: DEMO_ORG_ID, userId: 'friend-3', isLead: false },
  { teamId: 'team-design', orgId: DEMO_ORG_ID, userId: 'user-camille', isLead: false },
  { teamId: 'team-dev', orgId: DEMO_ORG_ID, userId: 'friend-2', isLead: true },
  { teamId: 'team-dev', orgId: DEMO_ORG_ID, userId: 'user-lucas', isLead: false },
];

function readOrSeed<T>(key: string, seed: T): T {
  const data = safeGetItem(key);
  if (!data) {
    const clone = JSON.parse(JSON.stringify(seed)) as T;
    safeSetItem(key, JSON.stringify(clone));
    return clone;
  }
  try {
    return JSON.parse(data) as T;
  } catch {
    const clone = JSON.parse(JSON.stringify(seed)) as T;
    safeSetItem(key, JSON.stringify(clone));
    return clone;
  }
}

export class LocalStorageOrgTeamsRepository implements IOrgTeamsRepository {
  private getTeamsArray(): OrgTeam[] {
    return readOrSeed<OrgTeam[]>(ORG_TEAMS_STORAGE_KEY, DEMO_TEAMS);
  }
  private saveTeams(teams: OrgTeam[]): void {
    writeJsonOrThrow(ORG_TEAMS_STORAGE_KEY, teams);
  }
  private getMembershipsArray(): OrgTeamMember[] {
    return readOrSeed<OrgTeamMember[]>(ORG_TEAM_MEMBERS_STORAGE_KEY, DEMO_TEAM_MEMBERS);
  }
  private saveMemberships(m: OrgTeamMember[]): void {
    writeJsonOrThrow(ORG_TEAM_MEMBERS_STORAGE_KEY, m);
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
      description: input.description ?? null,
    };
    this.saveTeams([...this.getTeamsArray(), team]);
    return team;
  }

  async updateTeam(teamId: string, input: UpdateOrgTeamInput): Promise<OrgTeam> {
    const teams = this.getTeamsArray();
    const team = teams.find((t) => t.id === teamId);
    if (!team) throw makeApiError('not_found');
    if (input.name !== undefined) team.name = input.name;
    if (input.color !== undefined) team.color = input.color;
    if (input.description !== undefined) team.description = input.description || null;
    this.saveTeams(teams);
    return team;
  }

  /**
   * Miroir de `delete_org_team` (mig. 151) : l'équipe ne part pas en
   * emportant la confidentialité de son travail. Les tableaux voisins sont
   * semés AVANT d'être lus, sinon une démo jamais ouverte sur Projets
   * sèmerait plus tard des projets rattachés à une équipe disparue.
   */
  private async readTeamWork(): Promise<{ projects: TeamProject[]; okrs: TeamOKR[] }> {
    const orgId = this.getTeamsArray()[0]?.orgId ?? DEMO_ORG_ID;
    await new LocalStorageTeamProjectsRepository().getProjects(orgId);
    await new LocalStorageTeamOKRsRepository().getAll(orgId);
    return {
      projects: readJsonArray<TeamProject>(TEAM_PROJECTS_STORAGE_KEY) ?? [],
      okrs: readJsonArray<TeamOKR>(TEAM_OKRS_STORAGE_KEY) ?? [],
    };
  }

  async getTeamDeletionImpact(teamId: string): Promise<TeamDeletionImpact> {
    const { projects, okrs } = await this.readTeamWork();
    return {
      projects: projects.filter((p) => p.teamId === teamId).length,
      okrs: okrs.filter((o) => o.teamIds.length === 1 && o.teamIds[0] === teamId).length,
    };
  }

  async deleteTeam(teamId: string, options?: DeleteOrgTeamOptions): Promise<void> {
    const { projects, okrs } = await this.readTeamWork();
    const target = options?.targetTeamId ?? null;
    const owned = projects.some((p) => p.teamId === teamId)
      || okrs.some((o) => o.teamIds.length === 1 && o.teamIds[0] === teamId);
    if (owned && !target && !options?.makePublic) throw makeApiError('team_has_dependents');
    if (target || options?.makePublic) {
      writeJsonOrThrow(TEAM_PROJECTS_STORAGE_KEY, projects.map((p) => (p.teamId === teamId ? { ...p, teamId: target } : p)));
      writeJsonOrThrow(TEAM_OKRS_STORAGE_KEY, okrs.map((o) => {
        if (!o.teamIds.includes(teamId)) return o;
        const rest = o.teamIds.filter((id) => id !== teamId);
        return { ...o, teamIds: target && !rest.includes(target) ? [...rest, target] : rest };
      }));
    }
    this.saveTeams(this.getTeamsArray().filter((t) => t.id !== teamId));
    this.saveMemberships(this.getMembershipsArray().filter((m) => m.teamId !== teamId));
  }

  async addTeamMember(teamId: string, orgId: string, userId: string): Promise<void> {
    const memberships = this.getMembershipsArray();
    if (memberships.some((m) => m.teamId === teamId && m.userId === userId)) return;
    this.saveMemberships([...memberships, { teamId, orgId, userId, isLead: false }]);
  }

  async removeTeamMember(teamId: string, userId: string): Promise<void> {
    this.saveMemberships(
      this.getMembershipsArray().filter((m) => !(m.teamId === teamId && m.userId === userId)),
    );
  }

  async setTeamLead(teamId: string, userId: string, isLead: boolean): Promise<void> {
    // Miroir de la policy UPDATE (mig. 107) : on ne promeut qu'une
    // appartenance existante — jamais de création implicite.
    this.saveMemberships(
      this.getMembershipsArray().map((m) =>
        m.teamId === teamId && m.userId === userId ? { ...m, isLead } : m,
      ),
    );
  }
}
