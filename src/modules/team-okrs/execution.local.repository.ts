// ═══════════════════════════════════════════════════════════════════
// TEAM-OKRS · Exécution — mode démo (localStorage)
// ═══════════════════════════════════════════════════════════════════

import { readJsonArray, writeJsonOrThrow } from '@/lib/safe-json';
import type { IOkrExecutionRepository } from './execution.repository';
import type {
  CreateOkrCycleInput,
  KRCheckin,
  KRProjectLink,
  OkrCycle,
  PostKRCheckinInput,
  ProjectProgress,
} from './execution.types';
import { LocalStorageTeamOKRsRepository } from './local.repository';
import { TEAM_OKRS_STORAGE_KEY } from './constants';
import type { TeamOKR } from './types';
import { LocalStorageTeamProjectsRepository } from '@/modules/team-projects/local.repository';

export const OKR_CYCLES_STORAGE_KEY = 'cosmo_team_okr_cycles';
export const KR_PROJECTS_STORAGE_KEY = 'cosmo_team_kr_projects';
export const KR_CHECKINS_STORAGE_KEY = 'cosmo_team_kr_checkins';

export class LocalStorageOkrExecutionRepository implements IOkrExecutionRepository {
  async getCycles(orgId: string): Promise<OkrCycle[]> {
    return (readJsonArray<OkrCycle>(OKR_CYCLES_STORAGE_KEY) ?? [])
      .filter((c) => c.orgId === orgId)
      .sort((a, b) => (a.startDate < b.startDate ? 1 : -1));
  }

  async createCycle(orgId: string, input: CreateOkrCycleInput): Promise<OkrCycle> {
    const cycle: OkrCycle = { id: crypto.randomUUID(), orgId, ...input };
    writeJsonOrThrow(OKR_CYCLES_STORAGE_KEY, [cycle, ...(readJsonArray<OkrCycle>(OKR_CYCLES_STORAGE_KEY) ?? [])]);
    return cycle;
  }

  async deleteCycle(cycleId: string): Promise<void> {
    writeJsonOrThrow(
      OKR_CYCLES_STORAGE_KEY,
      (readJsonArray<OkrCycle>(OKR_CYCLES_STORAGE_KEY) ?? []).filter((c) => c.id !== cycleId),
    );
  }

  async getKRProjects(_orgId: string): Promise<KRProjectLink[]> {
    return readJsonArray<KRProjectLink>(KR_PROJECTS_STORAGE_KEY) ?? [];
  }

  async setKRProjects(_orgId: string, krId: string, projectIds: string[]): Promise<void> {
    const others = (readJsonArray<KRProjectLink>(KR_PROJECTS_STORAGE_KEY) ?? []).filter((l) => l.krId !== krId);
    writeJsonOrThrow(KR_PROJECTS_STORAGE_KEY, [
      ...others,
      ...[...new Set(projectIds)].map((projectId) => ({ krId, projectId })),
    ]);
  }

  async getProjectProgress(orgId: string): Promise<ProjectProgress[]> {
    const byProject = new Map<string, ProjectProgress>();
    for (const t of await new LocalStorageTeamProjectsRepository().getTasks(orgId)) {
      const p = byProject.get(t.projectId) ?? { projectId: t.projectId, total: 0, done: 0 };
      p.total += 1;
      if (t.completed) p.done += 1;
      byProject.set(t.projectId, p);
    }
    return [...byProject.values()];
  }

  async getCheckins(krId: string): Promise<KRCheckin[]> {
    return (readJsonArray<KRCheckin>(KR_CHECKINS_STORAGE_KEY) ?? [])
      .filter((c) => c.krId === krId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  async postCheckin(input: PostKRCheckinInput): Promise<void> {
    // Même geste qu'en production (`post_kr_checkin`) : la valeur du KR ET le
    // point d'étape, ensemble.
    await new LocalStorageTeamOKRsRepository().updateKeyResult(input.krId, { currentValue: input.value });
    // Miroir de `post_kr_checkin` : l'état du dernier point d'étape est
    // recopié sur le KR.
    const okrs = readJsonArray<TeamOKR>(TEAM_OKRS_STORAGE_KEY) ?? [];
    const now = new Date().toISOString();
    writeJsonOrThrow(TEAM_OKRS_STORAGE_KEY, okrs.map((o) => ({
      ...o,
      keyResults: o.keyResults.map((k) => (k.id === input.krId ? { ...k, health: input.status, healthUpdatedAt: now } : k)),
    })));
    const checkin: KRCheckin = {
      id: crypto.randomUUID(),
      krId: input.krId,
      value: input.value,
      status: input.status,
      note: input.note?.trim() || null,
      authorId: 'demo-user',
      createdAt: new Date().toISOString(),
    };
    writeJsonOrThrow(KR_CHECKINS_STORAGE_KEY, [checkin, ...(readJsonArray<KRCheckin>(KR_CHECKINS_STORAGE_KEY) ?? [])]);
  }
}
