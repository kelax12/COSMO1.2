// ═══════════════════════════════════════════════════════════════════
// TEAM-OKRS · Exécution — mode démo (localStorage)
// ═══════════════════════════════════════════════════════════════════

import { readJsonArray, writeJsonOrThrow } from '@/lib/safe-json';
import type { IOkrExecutionRepository } from './execution.repository';
import type {
  KRCheckin,
  KRProjectLink,
  PostKRCheckinInput,
} from './execution.types';
import { LocalStorageTeamOKRsRepository } from './local.repository';

export const KR_PROJECTS_STORAGE_KEY = 'cosmo_team_kr_projects';
export const KR_CHECKINS_STORAGE_KEY = 'cosmo_team_kr_checkins';

export class LocalStorageOkrExecutionRepository implements IOkrExecutionRepository {
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
