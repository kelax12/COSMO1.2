// ═══════════════════════════════════════════════════════════════════
// TEAM-OKRS MODULE - LocalStorage Repository (mode démo)
// ═══════════════════════════════════════════════════════════════════
//
// Seeds : 3 OKR d'équipe avec KR assignés et progressions variées (pour que
// le dashboard équipe soit parlant). Déterministe, rechargé à loginDemo().

import { ITeamOKRsRepository } from './repository';
import {
  TeamOKR,
  CreateTeamOKRInput,
  UpdateTeamOKRInput,
  UpdateTeamKRInput,
} from './types';
import { TEAM_OKRS_STORAGE_KEY } from './constants';

const DEMO_ORG_ID = 'org-demo-1';
const DEMO_USER_ID = 'demo-user';

const DEMO_OKRS: TeamOKR[] = [
  {
    id: 'tokr-1',
    orgId: DEMO_ORG_ID,
    title: 'Réussir le lancement produit',
    description: 'Faire du lancement un succès mesurable sur le trimestre.',
    category: 'Croissance',
    createdBy: DEMO_USER_ID,
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
    keyResults: [
      { id: 'tkr-1', okrId: 'tokr-1', orgId: DEMO_ORG_ID, title: 'Atteindre 1000 inscrits', currentValue: 640, targetValue: 1000, unit: 'inscrits', assigneeId: 'friend-1', completed: false },
      { id: 'tkr-2', okrId: 'tokr-1', orgId: DEMO_ORG_ID, title: 'Obtenir 15 retombées presse', currentValue: 15, targetValue: 15, unit: 'articles', assigneeId: 'user-camille', completed: true, completedAt: new Date(Date.now() - 3 * 86400000).toISOString() },
      { id: 'tkr-3', okrId: 'tokr-1', orgId: DEMO_ORG_ID, title: 'Taux de conversion 5 %', currentValue: 3.2, targetValue: 5, unit: '%', assigneeId: 'friend-2', completed: false },
    ],
  },
  {
    id: 'tokr-2',
    orgId: DEMO_ORG_ID,
    title: 'Livrer la refonte du site',
    description: 'Mettre en ligne le nouveau site, rapide et accessible.',
    category: 'Produit',
    createdBy: 'friend-1',
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    keyResults: [
      { id: 'tkr-4', okrId: 'tokr-2', orgId: DEMO_ORG_ID, title: 'Score Lighthouse ≥ 95', currentValue: 88, targetValue: 95, unit: 'pts', assigneeId: 'friend-2', completed: false },
      { id: 'tkr-5', okrId: 'tokr-2', orgId: DEMO_ORG_ID, title: '100 % des pages migrées', currentValue: 70, targetValue: 100, unit: '%', assigneeId: 'friend-3', completed: false },
    ],
  },
  {
    id: 'tokr-3',
    orgId: DEMO_ORG_ID,
    title: 'Renforcer la culture d\'équipe',
    description: 'Améliorer l\'engagement et l\'onboarding interne.',
    category: 'Interne',
    createdBy: DEMO_USER_ID,
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    keyResults: [
      { id: 'tkr-6', okrId: 'tokr-3', orgId: DEMO_ORG_ID, title: 'Onboarder 3 recrues', currentValue: 2, targetValue: 3, unit: 'personnes', assigneeId: 'demo-user', completed: false },
      { id: 'tkr-7', okrId: 'tokr-3', orgId: DEMO_ORG_ID, title: 'Score eNPS ≥ 40', currentValue: 34, targetValue: 40, unit: 'pts', assigneeId: 'user-lucas', completed: false },
    ],
  },
];

function readOrSeed(): TeamOKR[] {
  const data = localStorage.getItem(TEAM_OKRS_STORAGE_KEY);
  if (!data) {
    const clone = JSON.parse(JSON.stringify(DEMO_OKRS)) as TeamOKR[];
    localStorage.setItem(TEAM_OKRS_STORAGE_KEY, JSON.stringify(clone));
    return clone;
  }
  try {
    return JSON.parse(data) as TeamOKR[];
  } catch {
    const clone = JSON.parse(JSON.stringify(DEMO_OKRS)) as TeamOKR[];
    localStorage.setItem(TEAM_OKRS_STORAGE_KEY, JSON.stringify(clone));
    return clone;
  }
}

export class LocalStorageTeamOKRsRepository implements ITeamOKRsRepository {
  private save(okrs: TeamOKR[]): void {
    localStorage.setItem(TEAM_OKRS_STORAGE_KEY, JSON.stringify(okrs));
  }

  async getAll(orgId: string): Promise<TeamOKR[]> {
    return readOrSeed().filter((o) => o.orgId === orgId);
  }

  async create(orgId: string, input: CreateTeamOKRInput): Promise<TeamOKR> {
    const okrs = readOrSeed();
    const okrId = crypto.randomUUID();
    const okr: TeamOKR = {
      id: okrId,
      orgId,
      title: input.title,
      description: input.description,
      category: input.category,
      startDate: input.startDate,
      endDate: input.endDate,
      createdBy: DEMO_USER_ID,
      createdAt: new Date().toISOString(),
      keyResults: input.keyResults.map((kr) => ({
        id: crypto.randomUUID(),
        okrId,
        orgId,
        title: kr.title,
        currentValue: 0,
        targetValue: kr.targetValue > 0 ? kr.targetValue : 1,
        unit: kr.unit,
        assigneeId: kr.assigneeId ?? null,
        completed: false,
        completedAt: null,
        weight: kr.weight && kr.weight >= 1 ? Math.min(10, Math.round(kr.weight)) : 1,
      })),
    };
    this.save([okr, ...okrs]);
    return okr;
  }

  async update(okrId: string, input: UpdateTeamOKRInput): Promise<void> {
    const okrs = readOrSeed();
    const okr = okrs.find((o) => o.id === okrId);
    if (!okr) throw new Error('OKR introuvable');
    if (input.title !== undefined) okr.title = input.title;
    if (input.description !== undefined) okr.description = input.description;
    if (input.category !== undefined) okr.category = input.category;
    if (input.startDate !== undefined) okr.startDate = input.startDate;
    if (input.endDate !== undefined) okr.endDate = input.endDate;
    this.save(okrs);
  }

  async remove(okrId: string): Promise<void> {
    this.save(readOrSeed().filter((o) => o.id !== okrId));
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
      if (input.completed !== undefined) {
        kr.completed = input.completed;
        kr.completedAt = input.completed ? new Date().toISOString() : null;
      }
      this.save(okrs);
      return;
    }
    throw new Error('Key result introuvable');
  }
}
