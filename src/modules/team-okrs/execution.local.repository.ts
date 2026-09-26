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
} from './execution.types';
import { LocalStorageTeamOKRsRepository } from './local.repository';

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

  async getCheckins(krId: string): Promise<KRCheckin[]> {
    return (readJsonArray<KRCheckin>(KR_CHECKINS_STORAGE_KEY) ?? [])
      .filter((c) => c.krId === krId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  async postCheckin(input: PostKRCheckinInput): Promise<void> {
    // Même geste qu'en production (`post_kr_checkin`) : la valeur du KR ET le
    // point d'étape, ensemble.
    const okrs = new LocalStorageTeamOKRsRepository();
    await okrs.updateKeyResult(input.krId, { currentValue: input.value });
    okrs.setKeyResultHealth(input.krId, input.status);
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
