// OKR d'entreprise reliés à l'exécution (mig. 160) — fonctions pures.
//
// Un KR en mode `tasks` avance avec les tâches TERMINÉES de ses projets
// reliés. Les chiffres viennent du SERVEUR (`get_team_project_task_stats`,
// mig. 191) : compter côté client exigerait toutes les tâches de
// l'organisation, et serait faux au-delà de la première page.

import type { KRProjectLink, OkrCycle } from '@/modules/team-okrs';
import type { TeamKeyResult, TeamOKR } from '@/modules/team-okrs';
import type { TeamProjectTaskStats } from '@/modules/team-projects';

export interface KrTaskProgress {
  done: number;
  total: number;
  projectCount: number;
}

/** Tâches terminées / totales des projets reliés à un KR. */
export function krTaskProgress(
  krId: string,
  links: KRProjectLink[],
  statsById: Map<string, TeamProjectTaskStats>,
): KrTaskProgress {
  let done = 0;
  let total = 0;
  let projectCount = 0;
  for (const l of links) {
    if (l.krId !== krId) continue;
    projectCount += 1;
    const s = statsById.get(l.projectId);
    if (!s) continue;
    done += s.completed;
    total += s.total;
  }
  return { done, total, projectCount };
}

/**
 * Avancement d'un KR, clampé [0,1]. Mode `tasks` avec au moins un projet
 * relié : tâches terminées / tâches. Sinon la valeur saisie (garde B17 :
 * `targetValue > 0`).
 */
export function effectiveKrRatio(
  kr: TeamKeyResult,
  links: KRProjectLink[],
  statsById: Map<string, TeamProjectTaskStats>,
): number {
  if (kr.completed) return 1;
  if (kr.progressMode === 'tasks') {
    const p = krTaskProgress(kr.id, links, statsById);
    if (p.projectCount > 0) return p.total > 0 ? p.done / p.total : 0;
  }
  if (kr.targetValue <= 0) return 0;
  return Math.max(0, Math.min(1, kr.currentValue / kr.targetValue));
}

/** Coefficient d'importance effectif : entier borné [1, 10], défaut 1. */
export function krWeight(kr: TeamKeyResult): number {
  const w = Math.round(Number(kr.weight));
  if (!Number.isFinite(w) || w < 1) return 1;
  return Math.min(w, 10);
}

/** Progression (%) d'un OKR : moyenne pondérée de ses KR. */
export function okrRatioPercent(
  keyResults: TeamKeyResult[],
  links: KRProjectLink[],
  statsById: Map<string, TeamProjectTaskStats>,
): number {
  let weighted = 0;
  let totalWeight = 0;
  for (const kr of keyResults) {
    const w = krWeight(kr);
    totalWeight += w;
    weighted += effectiveKrRatio(kr, links, statsById) * w;
  }
  return totalWeight > 0 ? Math.round((weighted / totalWeight) * 100) : 0;
}

/** Filtre de cycle : `''` tous, `'none'` sans cycle, sinon l'id d'un cycle. */
export type CycleFilter = string;

export function filterOkrsByCycle(okrs: TeamOKR[], filter: CycleFilter): TeamOKR[] {
  if (!filter) return okrs;
  if (filter === 'none') return okrs.filter((o) => !o.cycleId);
  return okrs.filter((o) => o.cycleId === filter);
}

/** Le cycle qui contient `today` ('YYYY-MM-DD'), le plus récent s'ils se chevauchent. */
export function currentCycle(cycles: OkrCycle[], today: string): OkrCycle | null {
  return cycles
    .filter((c) => c.startDate <= today && today <= c.endDate)
    .sort((a, b) => b.startDate.localeCompare(a.startDate))[0] ?? null;
}

/**
 * Objectifs auxquels `okr` peut contribuer : pas lui-même, ni un de ses
 * descendants (la base refuse le cycle, `okr_parent_cycle`, autant ne pas le
 * proposer).
 */
export function parentCandidates(okrs: TeamOKR[], okrId: string | undefined): TeamOKR[] {
  if (!okrId) return okrs;
  const descendants = new Set<string>([okrId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const o of okrs) {
      if (o.parentOkrId && descendants.has(o.parentOkrId) && !descendants.has(o.id)) {
        descendants.add(o.id);
        grew = true;
      }
    }
  }
  return okrs.filter((o) => !descendants.has(o.id));
}
