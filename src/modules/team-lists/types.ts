// ═══════════════════════════════════════════════════════════════════
// TEAM-LISTS MODULE - Types (mig. 203)
//
// Une liste d'entreprise a EXACTEMENT la forme d'une liste personnelle :
// c'est ce qui permet à l'onglet Tâches de réutiliser `TaskListsBar` telle
// quelle. Seules différences : l'organisation, et `isDefault`, qui n'est
// jamais stocké en base (préférence de chacun, cf. `default-pin.ts`).
// ═══════════════════════════════════════════════════════════════════

import type { TaskList, SmartRulePreset } from '@/modules/lists/types';

export interface TeamList extends TaskList {
  orgId: string;
}

export interface CreateTeamListInput {
  name: string;
  color: string;
  type?: 'manual' | 'smart';
  smartRule?: SmartRulePreset;
}

/** Champs modifiables : jamais orgId ni taskIds (la jonction a ses propres écritures). */
export interface UpdateTeamListInput {
  name?: string;
  color?: string;
  position?: number;
}
