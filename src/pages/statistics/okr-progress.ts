// ═══════════════════════════════════════════════════════════════════
// Avancement d'un OKR, scindé en DEUX : acquis avant la période / gagné pendant
// ═══════════════════════════════════════════════════════════════════
//
// La barre d'avancement de la section OKR montre en vert ce qui était déjà
// atteint au DÉBUT de la période affichée (7 / 30 / 365 jours), et en violet
// ce qui a été gagné depuis. Rien de tout cela n'est stocké : l'avancement
// passé se RECONSTRUIT depuis le journal `kr_completions`.
//
// ⚠️ Ce qui rend la reconstruction exacte : le journal porte UNE LIGNE PAR
// UNITÉ de `currentValue` (une « rep »), appendée au + et retirée au −
// (`appendKRReps` / `removeKRReps`, parité Supabase ↔ localStorage). Donc
//     currentValue(début de période) = currentValue(maintenant) − reps de la période.
// La valeur INITIALE d'un KR n'est jamais journalisée (état de base, cf.
// repository) : elle reste donc dans le « avant », ce qui est exactement sa
// place. Deux bornes subsistent, assumées : l'écriture est clampée à
// `MAX_REPS_PER_WRITE` et une baisse retire les reps les plus récentes. Le
// résultat est donc borné dans [0, avancement courant] plutôt que supposé exact.

import type { OKR } from '@/modules/okrs';
import type { KRCompletion } from '@/modules/kr-completions/types';
import { recalcProgress } from '@/modules/okrs/progress';

export interface OkrProgressSplit {
  id: string;
  title: string;
  /** Avancement courant de l'OKR, 0–100. */
  progress: number;
  /** Avancement déjà acquis au début de la période, 0–100. */
  progressBefore: number;
  /** Points d'avancement gagnés pendant la période, ≥ 0. */
  progressGained: number;
  /** Temps investi sur la période, en minutes (journal `kr_completions`). */
  workedTime: number;
}

/** Nombre de reps journalisées par KR à l'intérieur de la période. */
export function repsByKeyResult(
  startDate: Date,
  endDate: Date,
  krCompletions: readonly KRCompletion[],
): Map<string, number> {
  const reps = new Map<string, number>();
  for (const completion of krCompletions) {
    const at = new Date(completion.completedAt);
    if (Number.isNaN(at.getTime()) || at < startDate || at > endDate) continue;
    reps.set(completion.krId, (reps.get(completion.krId) ?? 0) + 1);
  }
  return reps;
}

/**
 * Avancement scindé de chaque OKR sur la période, plus le temps investi.
 *
 * `workedTimeByObjective` vient de `okrTimeByObjective` : on le passe en
 * paramètre au lieu de le recalculer, pour que le détail somme EXACTEMENT au
 * total affiché au-dessus (même parcours du journal).
 *
 * ⚠️ Un KR sans `estimated_time` vaut 0 minute — c'est juste (cf. CLAUDE.md).
 * Un OKR peut donc AVANCER sans peser une seule minute : filtrer sur le temps
 * seul le ferait disparaître de la liste alors qu'il a progressé.
 */
export function okrProgressSplit(
  startDate: Date,
  endDate: Date,
  krCompletions: readonly KRCompletion[],
  objectives: readonly OKR[],
  workedTimeByObjective: ReadonlyMap<string, number>,
): OkrProgressSplit[] {
  const reps = repsByKeyResult(startDate, endDate, krCompletions);

  return objectives.map(okr => {
    const progress = recalcProgress(okr.keyResults).progress;
    const before = okr.keyResults.map(kr => ({
      ...kr,
      currentValue: Math.max(0, kr.currentValue - (reps.get(kr.id) ?? 0)),
    }));
    // Borne haute : une reprise de reps ou un clamp d'écriture ne doit jamais
    // produire un « avant » supérieur à l'avancement courant, donc un gain
    // négatif qui rendrait une barre à largeur négative.
    const progressBefore = Math.max(0, Math.min(recalcProgress(before).progress, progress));

    return {
      id: okr.id,
      title: okr.title,
      progress,
      progressBefore,
      progressGained: progress - progressBefore,
      workedTime: workedTimeByObjective.get(okr.id) ?? 0,
    };
  });
}
