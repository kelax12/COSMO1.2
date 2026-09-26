// ═══════════════════════════════════════════════════════════════════
// OKR d'entreprise · calculs purs (mig. 160, audit 2026-09-23, M9)
//
// Aucun composant ne recalcule une progression : tout passe par ici, testé
// à part (`okr-execution.helpers.test.ts`).
// ═══════════════════════════════════════════════════════════════════

import type { TeamKeyResult, TeamOKR } from '@/modules/team-okrs';
import type { KRProjectLink, OkrCycle, ProjectProgress } from '@/modules/team-okrs/execution.types';

/** Coefficient d'importance effectif : entier borné [1, 10], défaut 1. */
export const krWeight = (kr: TeamKeyResult): number => {
  const w = Math.round(Number(kr.weight));
  if (!Number.isFinite(w) || w < 1) return 1;
  return Math.min(w, 10);
};

export interface KRProgressContext {
  links: KRProjectLink[];
  progress: ProjectProgress[];
}

/**
 * Progression d'un KR, dans [0, 1].
 *
 * `tasks` : tâches terminées / tâches totales des projets reliés, SANS
 * pondération par projet (un projet de 3 tâches ne pèse pas autant qu'un
 * projet de 300). Un KR en mode `tasks` sans projet relié, ou dont les projets
 * n'ont aucune tâche, vaut 0 : il ne prétend rien.
 * `manual` : valeur saisie / cible (garde B17 : cible > 0).
 */
export const krProgress = (kr: TeamKeyResult, ctx?: KRProgressContext): number => {
  if (kr.completed) return 1;
  if (kr.progressMode === 'tasks' && ctx) {
    const projectIds = new Set(ctx.links.filter((l) => l.krId === kr.id).map((l) => l.projectId));
    let total = 0;
    let done = 0;
    for (const p of ctx.progress) {
      if (!projectIds.has(p.projectId)) continue;
      total += p.total;
      done += p.done;
    }
    return total > 0 ? done / total : 0;
  }
  if (kr.targetValue <= 0) return 0;
  return Math.max(0, Math.min(1, kr.currentValue / kr.targetValue));
};

/** Progression d'un objectif, en %, moyenne pondérée de ses KR. */
export const okrProgress = (keyResults: TeamKeyResult[], ctx?: KRProgressContext): number => {
  let weighted = 0;
  let total = 0;
  for (const kr of keyResults) {
    const w = krWeight(kr);
    total += w;
    weighted += krProgress(kr, ctx) * w;
  }
  return total > 0 ? Math.round((weighted / total) * 100) : 0;
};

export type OkrHealth = 'on_track' | 'at_risk' | 'off_track' | 'none';

/** État d'un objectif : le PIRE état déclaré de ses KR (un seul KR hors piste suffit). */
export const okrHealth = (keyResults: TeamKeyResult[]): OkrHealth => {
  const states = keyResults.map((k) => k.health).filter(Boolean);
  if (states.includes('off_track')) return 'off_track';
  if (states.includes('at_risk')) return 'at_risk';
  if (states.includes('on_track')) return 'on_track';
  return 'none';
};

export interface OkrFilters {
  cycleId: string | null;
  teamId: string | null;
  health: OkrHealth | null;
  mine: boolean;
}

export const EMPTY_OKR_FILTERS: OkrFilters = { cycleId: null, teamId: null, health: null, mine: false };

/**
 * Filtre la liste. `teamId === 'org'` = objectifs d'entreprise (sans équipe).
 * « Les miens » : objectifs que j'ai posés ou dont je porte un KR.
 */
export const filterOkrs = (okrs: TeamOKR[], filters: OkrFilters, currentUserId?: string): TeamOKR[] =>
  okrs.filter((o) => {
    if (filters.cycleId && o.cycleId !== filters.cycleId) return false;
    if (filters.teamId === 'org' && o.teamIds.length > 0) return false;
    if (filters.teamId && filters.teamId !== 'org' && !o.teamIds.includes(filters.teamId)) return false;
    if (filters.health && okrHealth(o.keyResults) !== filters.health) return false;
    if (filters.mine) {
      if (!currentUserId) return false;
      const mine = o.createdBy === currentUserId
        || o.keyResults.some((k) => k.assigneeId === currentUserId || k.contributorIds?.includes(currentUserId));
      if (!mine) return false;
    }
    return true;
  });

export interface OkrNode {
  okr: TeamOKR;
  children: OkrNode[];
}

/**
 * Arbre d'alignement : chaque objectif sous celui auquel il contribue.
 * Un parent invisible (autre équipe, filtré) laisse son enfant à la racine :
 * l'arbre ne montre que ce qu'on a le droit de voir. Profondeur bornée à 20,
 * miroir du trigger `validate_team_okr_parent`.
 */
export const buildOkrTree = (okrs: TeamOKR[]): OkrNode[] => {
  const ids = new Set(okrs.map((o) => o.id));
  const childrenOf = new Map<string, TeamOKR[]>();
  for (const o of okrs) {
    if (o.parentOkrId && ids.has(o.parentOkrId) && o.parentOkrId !== o.id) {
      const arr = childrenOf.get(o.parentOkrId) ?? [];
      arr.push(o);
      childrenOf.set(o.parentOkrId, arr);
    }
  }
  const toNode = (okr: TeamOKR, depth: number, seen: Set<string>): OkrNode => ({
    okr,
    children: depth >= 20
      ? []
      : (childrenOf.get(okr.id) ?? [])
          .filter((c) => !seen.has(c.id))
          .map((c) => toNode(c, depth + 1, new Set([...seen, c.id]))),
  });
  const roots = okrs
    .filter((o) => !o.parentOkrId || !ids.has(o.parentOkrId))
    .map((o) => toNode(o, 0, new Set([o.id])));
  // Un objectif pris dans un cycle (que la base refuse, mais qu'une donnée
  // ancienne pourrait porter) n'est atteint par aucune racine : il remonte à
  // la racine plutôt que de disparaître de l'écran.
  const reached = new Set<string>();
  const walk = (n: OkrNode) => { reached.add(n.okr.id); n.children.forEach(walk); };
  roots.forEach(walk);
  for (const o of okrs) {
    if (!reached.has(o.id)) {
      const node = toNode(o, 0, new Set([o.id]));
      walk(node);
      roots.push(node);
    }
  }
  return roots;
};

/** Objectifs qu'on peut choisir comme parent de `okrId` : ni lui-même, ni un descendant. */
export const parentCandidates = (okrs: TeamOKR[], okrId?: string): TeamOKR[] => {
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
};

/** Le cycle qui contient aujourd'hui, s'il y en a un (sélection par défaut). */
export const currentCycle = (cycles: OkrCycle[], today = new Date().toLocaleDateString('en-CA')): OkrCycle | null =>
  cycles.find((c) => c.startDate <= today && today <= c.endDate) ?? null;
