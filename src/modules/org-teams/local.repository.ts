// ═══════════════════════════════════════════════════════════════════
// ORG-TEAMS MODULE - LocalStorage Repository (mode démo)
// ═══════════════════════════════════════════════════════════════════
//
// Seeds Nova Studio : 2 équipes (« Design » avec Marie/Sophie/Camille,
// « Dev » avec Jean/Lucas). Rechargées à chaque loginDemo().

import { IOrgTeamsRepository } from './repository';
import { OrgTeam, OrgTeamMember, CreateOrgTeamInput, TeamDeletionImpact, DeleteTeamInput } from './types';
import { ORG_TEAMS_STORAGE_KEY, ORG_TEAM_MEMBERS_STORAGE_KEY } from './constants';
import { TEAM_PROJECTS_STORAGE_KEY } from '@/modules/team-projects/constants';
import { TEAM_OKRS_STORAGE_KEY } from '@/modules/team-okrs/constants';
import { LocalStorageTeamProjectsRepository } from '@/modules/team-projects/local.repository';
import { LocalStorageTeamOKRsRepository } from '@/modules/team-okrs/local.repository';
import { makeApiError } from '@/lib/normalizeApiError';
import { safeGetItem, safeSetItem, writeJsonOrThrow } from '@/lib/safe-json';

const DEMO_ORG_ID = 'org-demo-1';
const DEMO_USER_ID = 'demo-user';
const DAY = 24 * 60 * 60 * 1000;

/** Forme minimale lue dans le stockage démo des projets et des OKR (mig. 151). */
interface StoredProject { teamId?: string | null; archivedAt?: string | null }
interface StoredOkr { teamIds?: string[] }

/** Lit un tableau JSON du stockage démo, `[]` s'il est absent ou illisible. */
function readArray<T>(key: string): T[] {
  try {
    const parsed = JSON.parse(safeGetItem(key) ?? '[]');
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

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
    };
    this.saveTeams([...this.getTeamsArray(), team]);
    return team;
  }

  /**
   * Force l'écriture des seeds projets et OKR avant de les lire. Sans ça, une
   * démo qui n'a jamais ouvert l'onglet Projets n'a encore rien en stockage :
   * on lirait `[]`, on l'écrirait, et les projets démo disparaîtraient.
   */
  private async materializeSeeds(teamId: string): Promise<void> {
    const orgId = this.getTeamsArray().find((t) => t.id === teamId)?.orgId;
    if (!orgId) return;
    await new LocalStorageTeamProjectsRepository().getProjects(orgId);
    await new LocalStorageTeamOKRsRepository().getAll(orgId);
  }

  async getDeletionImpact(teamId: string): Promise<TeamDeletionImpact> {
    await this.materializeSeeds(teamId);
    const projects = readArray<StoredProject>(TEAM_PROJECTS_STORAGE_KEY).filter((p) => p.teamId === teamId);
    const okrs = readArray<StoredOkr>(TEAM_OKRS_STORAGE_KEY).filter((o) => o.teamIds?.includes(teamId));
    return {
      activeProjects: projects.filter((p) => !p.archivedAt).length,
      archivedProjects: projects.filter((p) => !!p.archivedAt).length,
      soleOkrs: okrs.filter((o) => o.teamIds?.length === 1).length,
      sharedOkrs: okrs.filter((o) => (o.teamIds?.length ?? 0) > 1).length,
    };
  }

  /**
   * Miroir de `delete_team_with_transfer` (mig. 151) : on déplace, puis on
   * vérifie qu'il ne reste rien, et on n'écrit qu'à la fin. Jamais de
   * `teamId: null` : en démo aussi, supprimer une équipe n'ouvre rien.
   */
  async deleteTeam({ teamId, targetTeamId, archiveProjects }: DeleteTeamInput): Promise<void> {
    const teams = this.getTeamsArray();
    if (!teams.some((t) => t.id === teamId)) throw makeApiError('team_not_found');
    if (targetTeamId === teamId) throw makeApiError('team_transfer_same_team');
    if (targetTeamId && !teams.some((t) => t.id === targetTeamId)) throw makeApiError('team_transfer_target_invalid');
    await this.materializeSeeds(teamId);

    const now = new Date().toISOString();
    const projects = readArray<StoredProject>(TEAM_PROJECTS_STORAGE_KEY).map((p) =>
      targetTeamId && p.teamId === teamId
        ? { ...p, teamId: targetTeamId, archivedAt: archiveProjects ? p.archivedAt ?? now : p.archivedAt }
        : p,
    );
    const okrs = readArray<StoredOkr>(TEAM_OKRS_STORAGE_KEY).map((o) => {
      const ids = o.teamIds ?? [];
      if (!ids.includes(teamId)) return o;
      // Lien vers la cible AVANT le retrait : l'OKR ne passe jamais par « aucune équipe ».
      const withTarget = targetTeamId && !ids.includes(targetTeamId) ? [...ids, targetTeamId] : ids;
      const rest = withTarget.filter((id) => id !== teamId);
      return rest.length > 0 ? { ...o, teamIds: rest } : o;
    });

    const stillBound =
      projects.some((p) => p.teamId === teamId) || okrs.some((o) => o.teamIds?.includes(teamId));
    if (stillBound) throw makeApiError('team_has_dependents');

    writeJsonOrThrow(TEAM_PROJECTS_STORAGE_KEY, projects);
    writeJsonOrThrow(TEAM_OKRS_STORAGE_KEY, okrs);
    this.saveTeams(teams.filter((t) => t.id !== teamId));
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
