// ═══════════════════════════════════════════════════════════════════
// TEAM-OKRS : règles d'écriture d'un KR d'équipe (implémentation de référence)
// ═══════════════════════════════════════════════════════════════════
//
// ARC-01 : ces règles étaient réécrites dans `local.repository.ts` ET dans
// `supabase.repository.ts`, et la démo avait dérivé (unité, mode de progression
// et contributeurs gardés à la synchronisation, là où la production les
// remet à leur défaut). Les deux repositories les lisent désormais ici ; la
// suite de contrat `src/test/contracts/__test__/team-okrs.contract.ts` fixe le
// comportement observable.
import type { CreateTeamKRInput, KRProgressMode } from './types';

/** Coefficient d'importance : entier borné [1, 10], défaut 1 (absent, NaN ou < 1). */
export const teamKRWeight = (weight: number | null | undefined): number => {
  const w = Math.round(Number(weight));
  if (!Number.isFinite(w) || w < 1) return 1;
  return Math.min(w, 10);
};

/** Durée estimée par unité (min) : entier > 0, défaut 30 (parité avec la colonne). */
export const teamKREstimatedTime = (minutes: number | null | undefined): number =>
  minutes && minutes > 0 ? Math.round(minutes) : 30;

/** Cible d'un KR : > 0 (CHECK `target_value > 0`, mig. 063), défaut 1. */
export const teamKRTarget = (target: number): number => (target > 0 ? target : 1);

export interface NormalizedTeamKR {
  title: string;
  currentValue: number;
  targetValue: number;
  unit: string | null;
  assigneeId: string | null;
  weight: number;
  estimatedTime: number;
  progressMode: KRProgressMode;
  contributorIds: string[];
  completed: boolean;
}

/**
 * Champs d'un KR d'équipe tels qu'ils s'écrivent à la création ou à la
 * synchronisation (édition d'un OKR) : cible > 0, valeur bornée [0, cible],
 * terminé dès la cible atteinte, défauts explicites pour tout champ absent.
 */
export function normalizeTeamKR(input: CreateTeamKRInput): NormalizedTeamKR {
  const targetValue = teamKRTarget(input.targetValue);
  const currentValue = Math.max(0, Math.min(input.currentValue ?? 0, targetValue));
  return {
    title: input.title,
    currentValue,
    targetValue,
    unit: input.unit ?? null,
    assigneeId: input.assigneeId ?? null,
    weight: teamKRWeight(input.weight),
    estimatedTime: teamKREstimatedTime(input.estimatedTime),
    progressMode: input.progressMode ?? 'manual',
    contributorIds: input.contributorIds ?? [],
    completed: currentValue >= targetValue,
  };
}
