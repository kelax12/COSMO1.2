// ═══════════════════════════════════════════════════════════════════
// TEAM-OKRS · Exécution (mig. 153) — cycles, projets reliés, points d'étape
// ═══════════════════════════════════════════════════════════════════

import type { ProjectHealth } from '@/modules/team-projects/types';

/** Période d'OKR de l'organisation (T1, S2…). Dates locales 'YYYY-MM-DD'. */
export interface OkrCycle {
  id: string;
  orgId: string;
  name: string;
  startDate: string;
  endDate: string;
}

export interface CreateOkrCycleInput {
  name: string;
  startDate: string;
  endDate: string;
}

/** Lien KR ↔ projet : le KR avance avec les tâches terminées du projet. */
export interface KRProjectLink {
  krId: string;
  projectId: string;
}

/** Point d'étape daté d'un KR : valeur, état déclaré, note. */
export interface KRCheckin {
  id: string;
  krId: string;
  value: number;
  status: ProjectHealth;
  note: string | null;
  authorId: string | null;
  createdAt: string;
}

export interface PostKRCheckinInput {
  krId: string;
  value: number;
  status: ProjectHealth;
  note?: string;
}
