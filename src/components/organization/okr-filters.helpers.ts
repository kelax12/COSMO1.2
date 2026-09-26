// ═══════════════════════════════════════════════════════════════════
// Filtres de l'onglet OKR : équipe, porteur, état (audit 2026-09-24,
// « Filtres : 🔴 équipe, responsable, état »). Logique PURE.
//
// « Porteur » : le responsable d'un KR (`assigneeId`) OU l'un de ses
// contributeurs (mig. 160). Un objectif n'a pas de responsable propre (#10) :
// on le retrouve par les personnes qui portent ses résultats clés.
// ═══════════════════════════════════════════════════════════════════

import type { KRProjectLink, TeamOKR } from '@/modules/team-okrs';
import type { TeamProjectTaskStats } from '@/modules/team-projects';
import { okrRatioPercent } from './okr-execution.helpers';

export type OkrState = 'done' | 'on_track' | 'at_risk' | 'off_track' | 'no_checkin';
export const OKR_STATES: readonly OkrState[] = ['on_track', 'at_risk', 'off_track', 'no_checkin', 'done'];

/**
 * État d'un objectif : atteint (100 %), sinon le PIRE état déclaré parmi ses KR
 * ouverts (un seul KR hors trajectoire suffit à alerter), sinon « sans point
 * d'étape ». Un état n'est jamais inventé : l'absence de déclaration se dit.
 */
export function okrState(
  okr: TeamOKR,
  links: KRProjectLink[],
  statsById: Map<string, TeamProjectTaskStats>,
): OkrState {
  if (okr.keyResults.length > 0 && okrRatioPercent(okr.keyResults, links, statsById) >= 100) return 'done';
  const open = okr.keyResults.filter((k) => !k.completed);
  if (open.some((k) => k.health === 'off_track')) return 'off_track';
  if (open.some((k) => k.health === 'at_risk')) return 'at_risk';
  if (open.some((k) => k.health === 'on_track')) return 'on_track';
  return 'no_checkin';
}

/** Personnes qui portent au moins un KR de l'objectif. */
export function okrCarriers(okr: TeamOKR): Set<string> {
  const out = new Set<string>();
  for (const kr of okr.keyResults) {
    if (kr.assigneeId) out.add(kr.assigneeId);
    for (const id of kr.contributorIds ?? []) out.add(id);
  }
  return out;
}

export interface OkrFilters {
  /** '' = toutes, 'org' = objectifs d'entreprise (sans équipe), sinon un id d'équipe. */
  team: string;
  /** Porteur, ou '' pour tout le monde. */
  person: string;
  /** État, ou '' pour tous. */
  state: OkrState | '';
}

export const EMPTY_OKR_FILTERS: OkrFilters = { team: '', person: '', state: '' };

export function filterOkrs(
  okrs: TeamOKR[],
  f: OkrFilters,
  links: KRProjectLink[],
  statsById: Map<string, TeamProjectTaskStats>,
): TeamOKR[] {
  return okrs.filter((o) => {
    if (f.team === 'org' && o.teamIds.length > 0) return false;
    if (f.team && f.team !== 'org' && !o.teamIds.includes(f.team)) return false;
    if (f.person && !okrCarriers(o).has(f.person)) return false;
    if (f.state && okrState(o, links, statsById) !== f.state) return false;
    return true;
  });
}
