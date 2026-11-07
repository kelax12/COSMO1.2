// ═══════════════════════════════════════════════════════════════════
// TEAM-OKRS MODULE - LocalStorage Repository (mode démo)
// ═══════════════════════════════════════════════════════════════════
//
// Seeds : 3 OKR d'équipe avec KR assignés et progressions variées (pour que
// le dashboard équipe soit parlant). Déterministe, rechargé à loginDemo().

import { ITeamOKRsRepository } from './repository';
import { TeamOKR, TeamKeyResult, CreateTeamOKRInput, UpdateTeamOKRInput, UpdateTeamKRInput, SyncTeamKRInput, TrashedTeamOKR } from './types';
import { TEAM_OKRS_STORAGE_KEY, TEAM_OKR_TRASH_DAYS, TEAM_OKR_TRASH_STORAGE_KEY } from './constants';
import { safeGetItem, safeSetItem, writeJsonOrThrow } from '@/lib/safe-json';
import { makeApiError } from '@/lib/normalizeApiError';
import { DEMO_USER_ID, DEMO_OKRS, localizeOkrs } from './local.seed';

/** Qui a supprimé, en démo : l'unique utilisateur de démonstration. */
const DEMO_TRASH_USER_ID = 'demo-user';

interface TrashEntry {
  okr: TeamOKR;
  deletedAt: string;
  deletedBy: string | null;
}

const readTrash = (): TrashEntry[] => {
  const raw = safeGetItem(TEAM_OKR_TRASH_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as TrashEntry[]) : [];
  } catch {
    return [];
  }
};

function readOrSeed(): TeamOKR[] {
  const data = safeGetItem(TEAM_OKRS_STORAGE_KEY);
  if (!data) {
    const clone = JSON.parse(JSON.stringify(localizeOkrs(DEMO_OKRS))) as TeamOKR[];
    safeSetItem(TEAM_OKRS_STORAGE_KEY, JSON.stringify(clone));
    return clone;
  }
  try {
    return JSON.parse(data) as TeamOKR[];
  } catch {
    const clone = JSON.parse(JSON.stringify(DEMO_OKRS)) as TeamOKR[];
    safeSetItem(TEAM_OKRS_STORAGE_KEY, JSON.stringify(clone));
    return clone;
  }
}

export class LocalStorageTeamOKRsRepository implements ITeamOKRsRepository {
  private save(okrs: TeamOKR[]): void {
    writeJsonOrThrow(TEAM_OKRS_STORAGE_KEY, okrs);
  }

  async getAll(orgId: string): Promise<TeamOKR[]> {
    // Coercition legacy : les OKR d'équipe créés avant le rattachement d'équipes
    // n'ont pas `teamIds` — on garantit un tableau ([] = objectif d'entreprise).
    return readOrSeed()
      .filter((o) => o.orgId === orgId)
      .map((o) => {
        const teamIds = Array.isArray(o.teamIds) ? o.teamIds : [];
        // Seeds et stockages d'avant la mig. 205 : audience déduite des liens.
        return {
          ...o,
          teamIds,
          audience: o.audience ?? (teamIds.length > 0 ? 'teams' : 'org'),
          memberIds: Array.isArray(o.memberIds) ? o.memberIds : [],
        };
      });
  }

  async create(orgId: string, input: CreateTeamOKRInput): Promise<TeamOKR> {
    const okrs = readOrSeed();
    const okrId = crypto.randomUUID();
    const okr: TeamOKR = {
      id: okrId,
      orgId,
      title: input.title,
      description: input.description,
      categoryId: input.categoryId ?? null,
      startDate: input.startDate,
      endDate: input.endDate,
      createdBy: DEMO_USER_ID,
      createdAt: new Date().toISOString(),
      teamIds: input.teamIds ?? [],
      audience: input.audience ?? ((input.teamIds ?? []).length > 0 ? 'teams' : 'org'),
      memberIds: input.audience === 'custom' ? input.memberIds ?? [] : [],
      keyResults: input.keyResults.map((kr) => {
        const target = kr.targetValue > 0 ? kr.targetValue : 1;
        const current = Math.max(0, Math.min(kr.currentValue ?? 0, target));
        return {
          id: crypto.randomUUID(),
          okrId,
          orgId,
          title: kr.title,
          currentValue: current,
          targetValue: target,
          unit: kr.unit,
          assigneeId: kr.assigneeId ?? null,
          completed: current >= target,
          completedAt: current >= target ? new Date().toISOString() : null,
          weight: kr.weight && kr.weight >= 1 ? Math.min(10, Math.round(kr.weight)) : 1,
          estimatedTime: kr.estimatedTime && kr.estimatedTime > 0 ? Math.round(kr.estimatedTime) : 30,
          progressMode: kr.progressMode ?? 'manual',
          contributorIds: kr.contributorIds ?? [],
        };
      }),
      parentOkrId: input.parentOkrId ?? null,
    };
    this.save([okr, ...okrs]);
    return okr;
  }

  async update(okrId: string, input: UpdateTeamOKRInput): Promise<void> {
    const okrs = readOrSeed();
    const okr = okrs.find((o) => o.id === okrId);
    if (!okr) throw makeApiError('not_found');
    if (input.title !== undefined) okr.title = input.title;
    if (input.description !== undefined) okr.description = input.description;
    if (input.categoryId !== undefined) okr.categoryId = input.categoryId;
    if (input.startDate !== undefined) okr.startDate = input.startDate;
    if (input.endDate !== undefined) okr.endDate = input.endDate;
    if (input.teamIds !== undefined) okr.teamIds = input.teamIds;
    if (input.audience !== undefined) okr.audience = input.audience;
    if (input.memberIds !== undefined) okr.memberIds = okr.audience === 'custom' ? input.memberIds : [];
    if (input.parentOkrId !== undefined) {
      // Miroir du trigger `validate_team_okr_parent` (mig. 153) : ni soi-même,
      // ni un descendant.
      let cursor = input.parentOkrId;
      for (let depth = 0; cursor && depth < 20; depth++) {
        if (cursor === okrId) throw makeApiError('okr_parent_cycle');
        cursor = okrs.find((o) => o.id === cursor)?.parentOkrId ?? null;
      }
      okr.parentOkrId = input.parentOkrId;
    }
    this.save(okrs);
  }

  async remove(okrId: string): Promise<void> {
    // Corbeille (mig. 193) : l'objectif ENTIER (KR compris) attend 30 jours.
    const okrs = readOrSeed();
    const okr = okrs.find((o) => o.id === okrId);
    if (!okr) throw makeApiError('not_found');
    writeJsonOrThrow(TEAM_OKR_TRASH_STORAGE_KEY, [
      { okr, deletedAt: new Date().toISOString(), deletedBy: DEMO_TRASH_USER_ID },
      ...readTrash(),
    ]);
    this.save(okrs.filter((o) => o.id !== okrId));
  }

  /** Démo seulement : recopie l'état du dernier point d'étape sur le KR, comme `post_kr_checkin`. */
  setKeyResultHealth(krId: string, health: TeamKeyResult['health']): void {
    const okrs = readOrSeed();
    for (const okr of okrs) {
      const kr = okr.keyResults.find((k) => k.id === krId);
      if (!kr) continue;
      kr.health = health;
      kr.healthUpdatedAt = new Date().toISOString();
      this.save(okrs);
      return;
    }
  }

  async getTrash(orgId: string): Promise<TrashedTeamOKR[]> {
    const since = Date.now() - TEAM_OKR_TRASH_DAYS * 86_400_000;
    return readTrash()
      .filter((e) => e.okr.orgId === orgId && Date.parse(e.deletedAt) > since)
      .map((e) => ({ id: e.okr.id, title: e.okr.title, deletedAt: e.deletedAt, deletedBy: e.deletedBy, createdBy: e.okr.createdBy }));
  }

  async restore(okrId: string): Promise<void> {
    const trash = readTrash();
    const entry = trash.find((e) => e.okr.id === okrId);
    if (!entry) throw makeApiError('not_found');
    this.save([entry.okr, ...readOrSeed()]);
    writeJsonOrThrow(TEAM_OKR_TRASH_STORAGE_KEY, trash.filter((e) => e.okr.id !== okrId));
  }

  async purge(okrId: string): Promise<void> {
    writeJsonOrThrow(TEAM_OKR_TRASH_STORAGE_KEY, readTrash().filter((e) => e.okr.id !== okrId));
  }

  async updateKeyResult(krId: string, input: UpdateTeamKRInput): Promise<void> {
    const okrs = readOrSeed();
    for (const okr of okrs) {
      const kr = okr.keyResults.find((k) => k.id === krId);
      if (!kr) continue;
      if (input.title !== undefined) kr.title = input.title;
      if (input.currentValue !== undefined) kr.currentValue = input.currentValue;
      if (input.targetValue !== undefined && input.targetValue > 0) kr.targetValue = input.targetValue;
      if (input.unit !== undefined) kr.unit = input.unit;
      if (input.assigneeId !== undefined) kr.assigneeId = input.assigneeId;
      if (input.weight !== undefined) kr.weight = input.weight >= 1 ? Math.min(10, Math.round(input.weight)) : 1;
      if (input.estimatedTime !== undefined) kr.estimatedTime = input.estimatedTime > 0 ? Math.round(input.estimatedTime) : 30;
      if (input.progressMode !== undefined) kr.progressMode = input.progressMode;
      if (input.contributorIds !== undefined) kr.contributorIds = [...new Set(input.contributorIds)];
      if (input.completed !== undefined) {
        kr.completed = input.completed;
        kr.completedAt = input.completed ? new Date().toISOString() : null;
      }
      this.save(okrs);
      return;
    }
    throw makeApiError('not_found');
  }

  async syncKeyResults(okrId: string, orgId: string, krs: SyncTeamKRInput[]): Promise<void> {
    const okrs = readOrSeed();
    const okr = okrs.find((o) => o.id === okrId);
    if (!okr) throw makeApiError('not_found');
    const existing = new Map(okr.keyResults.map((k) => [k.id, k]));
    const next: TeamKeyResult[] = krs.slice(0, 10).map((input) => {
      const target = input.targetValue > 0 ? input.targetValue : 1;
      const current = Math.max(0, Math.min(input.currentValue ?? 0, target));
      const prev = input.id ? existing.get(input.id) : undefined;
      const completed = current >= target;
      return {
        id: prev?.id ?? crypto.randomUUID(),
        okrId,
        orgId,
        title: input.title,
        currentValue: current,
        targetValue: target,
        unit: input.unit ?? prev?.unit,
        assigneeId: input.assigneeId ?? null,
        completed,
        completedAt: completed ? (prev?.completed ? prev.completedAt : new Date().toISOString()) : null,
        weight: input.weight && input.weight >= 1 ? Math.min(10, Math.round(input.weight)) : 1,
        estimatedTime: input.estimatedTime && input.estimatedTime > 0 ? Math.round(input.estimatedTime) : 30,
        progressMode: input.progressMode ?? prev?.progressMode ?? 'manual',
        contributorIds: input.contributorIds ?? prev?.contributorIds ?? [],
      };
    });
    okr.keyResults = next;
    this.save(okrs);
  }
}
